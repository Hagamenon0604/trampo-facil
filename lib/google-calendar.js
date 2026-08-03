const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const googleCalendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
const googleScopes = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.send",
];

export function isGoogleCalendarConfigured() {
  return Boolean(googleClientId && googleClientSecret && googleRefreshToken);
}

export function getGoogleRedirectUri(request) {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }

  const origin = request ? new URL(request.url).origin : process.env.NEXT_PUBLIC_APP_URL;
  return `${origin}/api/google/callback`;
}

export function buildGoogleAuthUrl({ request, state }) {
  const redirectUri = getGoogleRedirectUri(request);
  const params = new URLSearchParams({
    client_id: googleClientId || "",
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: googleScopes.join(" "),
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode({ code, request }) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: googleClientId || "",
      client_secret: googleClientSecret || "",
      redirect_uri: getGoogleRedirectUri(request),
      grant_type: "authorization_code",
    }),
  });
  const result = await response.json();

  if (!response.ok) {
    globalThis.console.warn("[google] Falha ao trocar código OAuth.", {
      status: response.status,
      error: result.error,
      description: result.error_description,
    });
    throw new Error(result.error_description || result.error || "Falha ao conectar Google.");
  }

  return result;
}

export async function getGoogleAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: googleClientId || "",
      client_secret: googleClientSecret || "",
      refresh_token: googleRefreshToken || "",
      grant_type: "refresh_token",
    }),
  });
  const result = await response.json();

  if (!response.ok) {
    globalThis.console.warn("[google] Falha ao renovar token Google.", {
      status: response.status,
      error: result.error,
      description: result.error_description,
    });
    throw new Error(result.error_description || result.error || "Falha ao renovar token Google.");
  }

  return result.access_token;
}

function addMinutes(value, minutes) {
  return new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString();
}

function eventDescription({ resume, job, interview }) {
  return [
    "Entrevista agendada pelo Trampo Fácil.",
    "",
    `Candidato: ${resume.name}`,
    `Telefone: ${resume.phone}`,
    resume.email ? `E-mail: ${resume.email}` : null,
    `Cargo desejado: ${resume.desired_role}`,
    `Bairro: ${resume.neighborhood}`,
    job ? `Vaga: ${job.role} - ${job.company}` : null,
    interview.notes ? `Observações: ${interview.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export async function checkGoogleCalendarAvailability({ startsAt, endsAt, durationMinutes = 30 }) {
  if (!isGoogleCalendarConfigured()) {
    return {
      status: "skipped",
      available: true,
      reason: "Google Calendar não configurado.",
    };
  }

  const accessToken = await getGoogleAccessToken();
  const startDate = new Date(startsAt);
  const endDate = endsAt ? new Date(endsAt) : new Date(addMinutes(startsAt, durationMinutes));
  const params = new URLSearchParams({
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "10",
  });
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      googleCalendarId,
    )}/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  const result = await response.json();

  if (!response.ok) {
    globalThis.console.warn("[google] Falha ao consultar eventos da Agenda.", {
      status: response.status,
      reason: result.error?.message,
      details: result.error?.errors,
      calendarId: googleCalendarId,
    });
    throw new Error(result.error?.message || "Falha ao consultar disponibilidade no Google Agenda.");
  }

  const busyEvents = (result.items || []).filter(
    (event) => event.status !== "cancelled" && event.transparency !== "transparent",
  );

  return {
    status: "checked",
    available: busyEvents.length === 0,
    conflicts: busyEvents.map((event) => ({
      id: event.id,
      summary: event.summary || "Compromisso ocupado",
      startsAt: event.start?.dateTime || event.start?.date || "",
      endsAt: event.end?.dateTime || event.end?.date || "",
    })),
  };
}

export async function createGoogleMeetEvent({ resume, job, interview }) {
  if (!isGoogleCalendarConfigured()) {
    return {
      status: "skipped",
      reason: "Google Calendar não configurado.",
    };
  }

  const accessToken = await getGoogleAccessToken();
  const startDate = new Date(interview.starts_at);
  const endDate = interview.ends_at ? new Date(interview.ends_at) : new Date(addMinutes(interview.starts_at, 30));
  const requestId =
    globalThis.crypto?.randomUUID?.() || `trampo-facil-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const summary = job
    ? `Entrevista: ${resume.name} - ${job.role}`
    : `Entrevista: ${resume.name}`;
  const attendees = isValidEmail(resume.email) ? [{ email: resume.email.trim(), displayName: resume.name }] : [];
  const searchParams = new URLSearchParams({ conferenceDataVersion: "1" });

  if (attendees.length) {
    searchParams.set("sendUpdates", "all");
  }

  const eventPayload = {
    summary,
    description: eventDescription({ resume, job, interview }),
    start: {
      dateTime: startDate.toISOString(),
      timeZone: "America/Sao_Paulo",
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: "America/Sao_Paulo",
    },
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    },
  };

  if (attendees.length) {
    eventPayload.attendees = attendees;
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      googleCalendarId,
    )}/events?${searchParams.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    },
  );
  const result = await response.json();

  if (!response.ok) {
    globalThis.console.warn("[google] Falha ao criar evento com Google Meet.", {
      status: response.status,
      reason: result.error?.message,
      details: result.error?.errors,
      calendarId: googleCalendarId,
      hasAttendee: attendees.length > 0,
    });
    throw new Error(result.error?.message || "Falha ao criar evento Google Meet.");
  }

  const meetLink =
    result.hangoutLink || result.conferenceData?.entryPoints?.find((item) => item.uri)?.uri || "";

  globalThis.console.info("[google] Evento Google Meet criado.", {
    calendarId: googleCalendarId,
    eventId: result.id,
    startsAt: result.start?.dateTime || startDate.toISOString(),
    endsAt: result.end?.dateTime || endDate.toISOString(),
    htmlLink: result.htmlLink,
    hasMeetLink: Boolean(meetLink),
  });

  return {
    status: "created",
    calendarId: googleCalendarId,
    eventId: result.id,
    startsAt: result.start?.dateTime || startDate.toISOString(),
    endsAt: result.end?.dateTime || endDate.toISOString(),
    htmlLink: result.htmlLink,
    meetLink,
  };
}
