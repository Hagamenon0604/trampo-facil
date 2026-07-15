const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioSmsFrom = process.env.TWILIO_SMS_FROM;
const twilioWhatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
const twilioWhatsappContentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID;
const defaultBusinessWhatsapp = "+5511950877154";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://vagas.aesgestao.com";
}

function enabled(value) {
  return value !== "false";
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
}

function normalizeWhatsappSender(sender) {
  if (!sender) {
    return "";
  }

  return sender.startsWith("whatsapp:") ? sender : `whatsapp:${sender}`;
}

function businessWhatsappTo() {
  return normalizePhone(process.env.BUSINESS_WHATSAPP_TO || process.env.NOTIFICATION_WHATSAPP_TO || defaultBusinessWhatsapp);
}

function channelName(channel) {
  const labels = {
    online: "Online",
    phone: "Telefone",
    onsite: "Presencial",
  };

  return labels[channel] || channel;
}

export function formatInterviewDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function buildInterviewMessage({ resume, interview, job }) {
  const jobText = job ? ` para a vaga de ${job.role} (${job.company})` : "";
  const locationText = interview.location ? `\nLocal/link: ${interview.location}` : "";

  return [
    `Olá, ${resume.name}. Tudo bem?`,
    `Aqui é da A&S Gestão de Pessoas. Sua entrevista${jobText} foi agendada para ${formatInterviewDate(interview.starts_at)}.`,
    `Formato: ${channelName(interview.channel)}.${locationText}`,
    "Pode confirmar sua presença por aqui?",
  ].join("\n\n");
}

function buildInternalResumeMessage({ resume, interview, job, source }) {
  const isSchedule = source === "schedule";
  const lines = [
    isSchedule ? "Novo agendamento no Trampo Fácil" : "Novo currículo no Trampo Fácil",
    "",
    job ? `Vaga: ${job.role} - ${job.company}` : `Vaga: ${resume?.desired_role || "Sem vaga específica"}`,
    `Nome: ${resume?.name || "Não informado"}`,
    `Telefone: ${resume?.phone || "Não informado"}`,
    resume?.email ? `E-mail: ${resume.email}` : null,
    resume?.area ? `Área: ${resume.area}` : null,
    resume?.city || resume?.neighborhood
      ? `Região: ${[resume?.city, resume?.neighborhood].filter(Boolean).join(" - ")}`
      : null,
    resume?.resume_file_name ? `Currículo anexado: ${resume.resume_file_name}` : "Currículo anexado: não",
    interview?.starts_at ? `Entrevista: ${formatInterviewDate(interview.starts_at)}` : null,
    interview?.location ? `Link/local: ${interview.location}` : null,
    "",
    `Abrir painel: ${appUrl()}/admin`,
  ];

  return lines.filter(Boolean).join("\n");
}

async function sendTwilioMessage(params) {
  const body = new URLSearchParams(params);
  const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Falha ao enviar mensagem pela Twilio.");
  }

  return result.sid;
}

export async function sendInterviewNotifications({ resume, interview, job }) {
  const canUseTwilio = Boolean(twilioAccountSid && twilioAuthToken);
  const phone = normalizePhone(resume?.phone);
  const message = buildInterviewMessage({ resume, interview, job });
  const results = [];

  if (!canUseTwilio || !phone) {
    return [
      {
        channel: "automatic",
        status: "skipped",
        reason: "Twilio não configurado ou telefone inválido.",
      },
    ];
  }

  if (enabled(process.env.SEND_SMS_ON_INTERVIEW) && twilioSmsFrom) {
    try {
      const sid = await sendTwilioMessage({
        From: twilioSmsFrom,
        To: phone,
        Body: message,
      });
      results.push({ channel: "sms", status: "sent", sid });
    } catch (error) {
      results.push({ channel: "sms", status: "failed", reason: error.message });
    }
  }

  if (enabled(process.env.SEND_WHATSAPP_ON_INTERVIEW) && twilioWhatsappFrom) {
    const params = {
      From: normalizeWhatsappSender(twilioWhatsappFrom),
      To: `whatsapp:${phone}`,
    };

    if (twilioWhatsappContentSid) {
      params.ContentSid = twilioWhatsappContentSid;
      params.ContentVariables = JSON.stringify({
        1: resume.name,
        2: formatInterviewDate(interview.starts_at),
        3: job ? `${job.role} (${job.company})` : "oportunidade A&S",
        4: channelName(interview.channel),
        5: interview.location || "",
      });
    } else {
      params.Body = message;
    }

    try {
      const sid = await sendTwilioMessage(params);
      results.push({ channel: "whatsapp", status: "sent", sid });
    } catch (error) {
      results.push({ channel: "whatsapp", status: "failed", reason: error.message });
    }
  }

  if (!results.length) {
    results.push({
      channel: "automatic",
      status: "skipped",
      reason: "Remetentes de SMS/WhatsApp não configurados.",
    });
  }

  return results;
}

export async function sendInternalWhatsappNotification({ resume, interview, job, source = "resume" }) {
  const to = businessWhatsappTo();

  if (!enabled(process.env.SEND_WHATSAPP_TO_BUSINESS)) {
    return { channel: "whatsapp-business", status: "skipped", reason: "WhatsApp interno desativado." };
  }

  if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsappFrom || !to) {
    return {
      channel: "whatsapp-business",
      status: "skipped",
      reason: "Twilio WhatsApp ou número comercial não configurado.",
    };
  }

  try {
    const sid = await sendTwilioMessage({
      From: normalizeWhatsappSender(twilioWhatsappFrom),
      To: normalizeWhatsappSender(to),
      Body: buildInternalResumeMessage({ resume, interview, job, source }),
    });

    return { channel: "whatsapp-business", status: "sent", sid };
  } catch (error) {
    return { channel: "whatsapp-business", status: "failed", reason: error.message };
  }
}
