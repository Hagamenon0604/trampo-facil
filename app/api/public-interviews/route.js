import { NextResponse } from "next/server";
import { createInterview, createResume, getJobs } from "@/lib/data";
import { sendCandidateConfirmationEmail, sendNewResumeEmail } from "@/lib/email-notifications";
import { checkGoogleCalendarAvailability, createGoogleMeetEvent } from "@/lib/google-calendar";
import { sendInternalWhatsappNotification, sendInterviewNotifications } from "@/lib/notifications";
import { requestIp, verifyTurnstileToken } from "@/lib/turnstile";
import { cleanText, requireFields } from "@/lib/validators";

const allowedRoles = new Set(["Auxiliar de Serviços Gerais (ASG)", "Atendente"]);

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

function findJobForRole(jobs, desiredRole) {
  const normalizedRole = normalizeSearchText(desiredRole);

  return jobs.find((job) => {
    const text = normalizeSearchText([job.role, job.description].join(" "));
    const isPublished = job.status === "published";

    if (normalizedRole.includes("servicos gerais") || normalizedRole.includes("asg")) {
      return isPublished && (text.includes("servicos gerais") || /\basg\b/.test(text));
    }

    if (normalizedRole.includes("atendente")) {
      return isPublished && text.includes("atendente");
    }

    return false;
  });
}

function areaForRole(role) {
  return normalizeSearchText(role).includes("atendente") ? "Atendimento" : "Limpeza";
}

export async function POST(request) {
  try {
    const body = await request.json();
    const payload = {
      desired_role: cleanText(body.desired_role),
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
      return NextResponse.json(
        { error: "Não encontramos uma vaga ativa para esse agendamento." },
        { status: 404 },
      );
    }

    let availability = { status: "skipped", available: true, reason: "Google Calendar não configurado." };

    try {
      availability = await checkGoogleCalendarAvailability({
        startsAt: startsAtIso,
        endsAt: endsAtIso,
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

    const resumeResult = await createResume({
      job_id: job.id,
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
      job_id: job.id,
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
      meet = { status: "failed", reason: caughtError.message };
    }

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
