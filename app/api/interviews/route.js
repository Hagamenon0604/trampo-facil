import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createInterview, getInterviews, getJobs, getResumes } from "@/lib/data";
import { isAdminSessionValid } from "@/lib/admin-auth";
import { checkGoogleCalendarAvailability, createGoogleMeetEvent } from "@/lib/google-calendar";
import { sendInterviewNotifications } from "@/lib/notifications";
import { cleanText, requireFields } from "@/lib/validators";

export async function GET() {
  try {
    if (!isAdminSessionValid(await cookies())) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const interviews = await getInterviews();
    return NextResponse.json({ data: interviews });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function logInterviewNotificationFailures(results) {
  for (const result of results || []) {
    if (result?.status === "failed") {
      globalThis.console.warn("[interviews] Falha em notificação de entrevista ao candidato.", {
        channel: result.channel,
        reason: result.reason,
      });
    }
  }
}

export async function POST(request) {
  try {
    if (!isAdminSessionValid(await cookies())) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const payload = {
      resume_id: cleanText(body.resume_id),
      job_id: cleanText(body.job_id),
      starts_at: cleanText(body.starts_at),
      ends_at: cleanText(body.ends_at),
      channel: cleanText(body.channel) || "online",
      location: cleanText(body.location),
      notes: cleanText(body.notes),
    };

    const validation = requireFields(payload, ["resume_id", "starts_at", "channel"]);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    const [resumes, jobs] = await Promise.all([getResumes(), getJobs({ includeDrafts: true })]);
    const resume = resumes.find((item) => item.id === payload.resume_id);
    const job = jobs.find((item) => item.id === payload.job_id);
    let availability = { status: "skipped", available: true, reason: "Google Calendar não configurado." };
    let meet = { status: "skipped", reason: "Entrevista não é online ou já possui local/link." };

    try {
      availability = await checkGoogleCalendarAvailability({
        startsAt: payload.starts_at,
        endsAt: payload.ends_at,
      });
    } catch (caughtError) {
      return NextResponse.json(
        { error: `Não foi possível consultar a Agenda Google: ${caughtError.message}` },
        { status: 502 },
      );
    }

    if (availability.status === "checked" && !availability.available) {
      return NextResponse.json(
        {
          error: "Esse horário já possui compromisso na Agenda Google. Escolha outro horário para a entrevista.",
          data: { availability },
        },
        { status: 409 },
      );
    }

    if (resume && payload.channel === "online" && !payload.location) {
      try {
        meet = await createGoogleMeetEvent({ resume, job, interview: payload });

        if (meet.meetLink) {
          payload.location = meet.meetLink;
          payload.notes = [payload.notes, meet.htmlLink ? `Evento Google Agenda: ${meet.htmlLink}` : null]
            .filter(Boolean)
            .join("\n");
        }
      } catch (caughtError) {
        meet = { status: "failed", reason: caughtError.message };
      }
    }

    if (meet.status === "failed") {
      globalThis.console.warn("[interviews] Falha ao criar evento Google Agenda/Meet.", {
        reason: meet.reason,
        startsAt: payload.starts_at,
        jobId: payload.job_id,
        resumeId: payload.resume_id,
      });
    }

    const result = await createInterview(payload);

    if (!result.configured) {
      return NextResponse.json(
        { error: "Banco de dados ainda não configurado para salvar entrevistas." },
        { status: 503 },
      );
    }

    const notifications = resume
      ? await sendInterviewNotifications({ resume, interview: result.data, job })
      : [{ channel: "automatic", status: "skipped", reason: "Candidato não encontrado." }];

    logInterviewNotificationFailures(notifications);

    return NextResponse.json({ data: { interview: result.data, availability, meet, notifications } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
