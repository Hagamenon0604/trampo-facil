const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioSmsFrom = process.env.TWILIO_SMS_FROM;
const twilioWhatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
const twilioWhatsappContentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID;

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
