import { NextResponse } from "next/server";
import { createInterview, createResume, getJobs } from "@/lib/data";
import { sendCandidateConfirmationEmail, sendNewResumeEmail } from "@/lib/email-notifications";
import { checkGoogleCalendarAvailability, createGoogleMeetEvent } from "@/lib/google-calendar";
import { sendInternalWhatsappNotification, sendInterviewNotifications } from "@/lib/notifications";
import { requestIp, verifyTurnstileToken } from "@/lib/turnstile";
import { cleanText, requireFields } from "@/lib/validators";

const allowedRoles = new Set([
  "Auxiliar de Serviços Gerais (ASG)",
  "Repositor de Buffet",
  "Atendente",
  "Cozinheiro",
  "Chef executivo",
]);

const priorityRoleMap = {
  asg: "Auxiliar de Serviços Gerais (ASG)",
  "repositor de buffet": "Repositor de Buffet",
  atendente: "Atendente",
  cozinheiro: "Cozinheiro",
  "chef executivo": "Chef executivo",
};

function normalizeDesiredRole(rawRole) {
  const cleaned = cleanText(rawRole);
  const key = normalizeSearchText(cleaned);
  return priorityRoleMap[key] || cleaned;
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const inactiveJobStatuses = new Set([
  "archived",
  "arquivada",
  "closed",
  "draft",
  "encerrada",
  "fechada",
  "inactive",
  "inativa",
  "pausada",
  "paused",
  "rascunho",
]);

function jobSearchText(job) {
  return normalizeSearchText(
    [
      job.role,
      job.title,
      job.position,
      job.area,
      job.company,
      job.trade_name,
      job.neighborhood,
      job.description,
      job.requirements,
    ].join(" "),
  );
}

function isSchedulableJob(job) {
  const status = normalizeSearchText(job?.status || "published").trim();

  if (inactiveJobStatuses.has(status)) {
    return false;
  }

  if (job?.published === false) {
    return false;
  }

  return true;
}

function jobStatusPriority(job) {
  const status = normalizeSearchText(job?.status || "published").trim();

  if (status === "published" || status === "publicada") {
    return 0;
  }

  if (status === "active" || status === "ativa") {
    return 1;
  }

  if (!status) {
    return 2;
  }

  return 3;
}

function parseSaoPauloDateTime(value) {
  const cleanValue = cleanText(value);

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(cleanValue) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(cleanValue)) {
    return new Date(`${cleanValue.slice(0, 16)}:00-03:00`);
  }

  return new Date(cleanValue);
}

function addMinutes(value, minutes) {
  return new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString();
}

function roleMatcherFor(desiredRole) {
  const normalizedRole = normalizeSearchText(desiredRole);

  if (normalizedRole.includes("servicos gerais") || /\basg\b/.test(normalizedRole)) {
    return (text) =>
      text.includes("auxiliar de servicos gerais") ||
      text.includes("servicos gerais") ||
      /\basg\b/.test(text);
  }

  if (
    normalizedRole.includes("repositor de buffet") ||
    (normalizedRole.includes("repositor") && normalizedRole.includes("buffet"))
  ) {
    return (text) =>
      text.includes("repositor de buffet") ||
      (text.includes("repositor") && text.includes("buffet"));
  }

  if (normalizedRole.includes("atendente")) {
    return (text) => text.includes("atendente");
  }

  if (normalizedRole.includes("cozinheiro")) {
    return (text) => text.includes("cozinheiro");
  }

  if (
    normalizedRole.includes("chef executivo") ||
    (normalizedRole.includes("chef") && normalizedRole.includes("executivo"))
  ) {
    return (text) =>
      text.includes("chef executivo") ||
      (text.includes("chef") && text.includes("executivo"));
  }

  return null;
}

function findJobForRole(jobs, desiredRole) {
  const matcher = roleMatcherFor(desiredRole);

  if (!matcher) {
    return null;
  }

  return (
    jobs
      .filter(isSchedulableJob)
      .filter((job) => matcher(jobSearchText(job)))
      .sort((firstJob, secondJob) => jobStatusPriority(firstJob) - jobStatusPriority(secondJob))[0] || null
  );
}

function areaForRole(role) {
  const normalizedRole = normalizeSearchText(role);

  if (normalizedRole.includes("atendente")) {
    return "Atendimento";
  }

  if (normalizedRole.includes("repositor")) {
    return "Atendimento";
  }

  if (normalizedRole.includes("cozinheiro") || normalizedRole.includes("chef executivo")) {
    return "Cozinha";
  }

  return "Limpeza";
}

function logNotificationFailure(context, result) {
  if (result?.status === "failed") {
    globalThis.console.warn(`[public-interviews] Falha em ${context}.`, {
      provider: result.provider,
      reason: result.reason,
    });
  }
}

function logInterviewNotificationFailures(results) {
  for (const result of results || []) {
    if (result?.status === "failed") {
      globalThis.console.warn("[public-interviews] Falha em notificação de entrevista ao candidato.", {
        channel: result.channel,
        reason: result.reason,
      });
    }
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const payload = {
      desired_role: normalizeDesiredRole(body.desired_role),
      name: cleanText(body.name),
      phone: cleanText(body.phone),
      email: cleanText(body.email),
      starts_at: cleanText(body.starts_at),
      observations: cleanText(body.observations),
      lgpd_accepted: Boolean(body.lgpd_accepted),
    };

    if (cleanText(body.website)) {
      return NextResponse.json({ error: "Não foi possível validar o envio." }, { status: 400 });
    }

    const captcha = await verifyTurnstileToken({
      token: cleanText(body["cf-turnstile-response"]),
      remoteIp: requestIp(request),
    });

    if (!captcha.success) {
      globalThis.console.warn("[public-interviews] Falha na verificação Turnstile.", {
        reason: captcha.reason,
        hasToken: Boolean(cleanText(body["cf-turnstile-response"])),
      });
      return NextResponse.json(
        { error: "Confirme a verificação de segurança e tente novamente." },
        { status: 400 },
      );
    }

    const validation = requireFields(payload, ["desired_role", "name", "phone", "starts_at"]);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    if (!allowedRoles.has(payload.desired_role)) {
      return NextResponse.json(
        { error: "Escolha uma vaga disponível para agendamento." },
        { status: 400 },
      );
    }

    if (!payload.lgpd_accepted) {
      return NextResponse.json(
        { error: "É necessário aceitar o tratamento de dados para agendar a entrevista." },
        { status: 400 },
      );
    }

    const startsAt = parseSaoPauloDateTime(payload.starts_at);

    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "Informe uma data e horário válidos." }, { status: 400 });
    }

    if (startsAt.getTime() < Date.now() + 60 * 60 * 1000) {
      return NextResponse.json(
        { error: "Escolha um horário com pelo menos 1 hora de antecedência." },
        { status: 400 },
      );
    }

    const startsAtIso = startsAt.toISOString();
    const endsAtIso = addMinutes(startsAtIso, 30);
    const jobs = await getJobs({ includeDrafts: true });
    const job = findJobForRole(jobs, payload.desired_role);

    if (!job) {
      globalThis.console.warn(
        "[public-interviews] Vaga ativa não encontrada; prosseguindo com agendamento prioritário.",
        {
          desiredRole: payload.desired_role,
          isPriorityRole: allowedRoles.has(payload.desired_role),
        },
      );
    }

    let availability = { status: "skipped", available: true, reason: "Google Calendar não configurado." };

    try {
      availability = await checkGoogleCalendarAvailability({
        startsAt: startsAtIso,
        endsAt: endsAtIso,
      });
    } catch (caughtError) {
      globalThis.console.warn("[public-interviews] Falha ao consultar Agenda Google; seguindo com tentativa de criação do evento.", {
        reason: caughtError.message,
        startsAt: startsAtIso,
        jobId: job?.id,
      });

      availability = {
        status: "check_failed",
        available: true,
        reason: caughtError.message,
      };
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

    if (availability.status !== "checked") {
      globalThis.console.warn("[public-interviews] Disponibilidade não confirmada; tentando confirmar pelo evento do Google.", {
        status: availability.status,
        reason: availability.reason,
        startsAt: startsAtIso,
        jobId: job?.id,
      });
    }

    const resumeResult = await createResume({
      job_id: job?.id || null,
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      desired_role: payload.desired_role,
      area: areaForRole(payload.desired_role),
      city: "São Paulo",
      neighborhood: "A definir",
      availability: `Entrevista escolhida: ${payload.starts_at}`,
      experience: payload.observations || `Agendamento direto para ${payload.desired_role}.`,
      lgpd_accepted: true,
    });

    if (!resumeResult.configured) {
      return NextResponse.json(
        { error: "Banco de dados ainda não configurado para salvar agendamentos." },
        { status: 503 },
      );
    }

    const resume = resumeResult.data;
    const interviewPayload = {
      resume_id: resume.id,
      job_id: job?.id || null,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      channel: "online",
      location: "",
      notes: [
        "Agendamento realizado pelo candidato.",
        `Vaga escolhida: ${payload.desired_role}`,
        payload.observations ? `Observações: ${payload.observations}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    };
    let meet = { status: "skipped", reason: "Google Calendar não configurado." };

    try {
      meet = await createGoogleMeetEvent({ resume, job, interview: interviewPayload });

      if (meet.meetLink) {
        interviewPayload.location = meet.meetLink;
        interviewPayload.notes = [interviewPayload.notes, meet.htmlLink ? `Evento Google Agenda: ${meet.htmlLink}` : null]
          .filter(Boolean)
          .join("\n");
      }
    } catch (caughtError) {
      globalThis.console.error("[public-interviews] Falha ao criar evento Google Agenda/Meet.", {
        reason: caughtError.message,
        startsAt: startsAtIso,
        jobId: job?.id,
        resumeId: resume.id,
        googleCalendarId: meet.calendarId,
      });

      return NextResponse.json(
        {
          error:
            "Não foi possível criar o evento na Agenda Google. O agendamento não foi confirmado. Tente novamente em alguns minutos ou fale com a A&S pelo WhatsApp.",
        },
        { status: 502 },
      );
    }

    if (meet.status !== "created" || !meet.eventId) {
      globalThis.console.error("[public-interviews] Google Agenda não criou evento para o agendamento.", {
        status: meet.status,
        reason: meet.reason,
        startsAt: startsAtIso,
        jobId: job?.id,
        resumeId: resume.id,
        googleCalendarId: meet.calendarId,
      });

      return NextResponse.json(
        {
          error:
            "A Agenda Google ainda não confirmou o evento. O agendamento não foi concluído. Tente novamente em alguns minutos ou fale com a A&S pelo WhatsApp.",
          data: { meet },
        },
        { status: 502 },
      );
    }

    globalThis.console.info("[public-interviews] Evento Google confirmado para agendamento.", {
      resumeId: resume.id,
      jobId: job?.id,
      desiredRole: payload.desired_role,
      startsAt: startsAtIso,
      googleCalendarId: meet.calendarId,
      googleEventId: meet.eventId,
      googleEventLink: meet.htmlLink,
    });

    const interviewResult = await createInterview(interviewPayload);

    if (!interviewResult.configured) {
      return NextResponse.json(
        { error: "Banco de dados ainda não configurado para salvar entrevistas." },
        { status: 503 },
      );
    }

    const [emailNotification, candidateConfirmation, candidateNotifications, whatsappNotification] =
      await Promise.all([
        sendNewResumeEmail({
          resume,
          application: resumeResult.application,
          job,
        }).catch((error) => ({ status: "failed", reason: error.message })),
        sendCandidateConfirmationEmail({
          resume,
          application: resumeResult.application,
          job,
        }).catch((error) => ({ status: "failed", reason: error.message })),
        sendInterviewNotifications({
          resume,
          interview: interviewResult.data,
          job,
        }).catch((error) => [{ channel: "automatic", status: "failed", reason: error.message }]),
        sendInternalWhatsappNotification({
          resume,
          interview: interviewResult.data,
          job,
          source: "schedule",
        }).catch((error) => ({ status: "failed", reason: error.message })),
      ]);

    logNotificationFailure("notificação por e-mail para A&S", emailNotification);
    logNotificationFailure("confirmação por e-mail ao candidato", candidateConfirmation);
    logInterviewNotificationFailures(candidateNotifications);
    logNotificationFailure("notificação interna por WhatsApp", whatsappNotification);

    globalThis.console.info("[public-interviews] Agendamento processado.", {
      interviewId: interviewResult.data?.id,
      resumeId: resume.id,
      jobId: job?.id,
      desiredRole: payload.desired_role,
      startsAt: startsAtIso,
      googleCalendarId: meet.calendarId,
      googleEventId: meet.eventId,
      adminEmailStatus: emailNotification?.status,
      candidateEmailStatus: candidateConfirmation?.status,
      whatsappStatus: whatsappNotification?.status,
      candidateNotificationStatus: (candidateNotifications || [])
        .map((notification) => `${notification.channel}:${notification.status}`)
        .join(","),
    });

    return NextResponse.json(
      {
        data: {
          resume,
          application: resumeResult.application,
          interview: interviewResult.data,
          availability,
          meet,
          emailNotification,
          candidateConfirmation,
          candidateNotifications,
          whatsappNotification,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
TOOL_NAME: run_terminal_command
BEGIN_ARG: command
"grep -n \"job\" app/api/public-interviews/route.js"
END_ARG