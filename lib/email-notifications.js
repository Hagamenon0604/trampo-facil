import { getGoogleAccessToken } from "@/lib/google-calendar";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://vagas.aesgestao.com";
}

function recipients() {
  return String(process.env.ADMIN_NOTIFY_EMAIL || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function htmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textRows(rows) {
  return rows.map(([label, value]) => `${label}: ${value || "Não informado"}`).join("\n");
}

function encodeHeader(value) {
  const text = String(value || "");
  const isAscii = Array.from(text).every((character) => character.charCodeAt(0) <= 127);
  return isAscii ? text : `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function encodeBase64Url(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildEmailContent({ resume, application, job }) {
  const subject = application
    ? `Nova candidatura: ${resume.desired_role}`
    : `Novo currículo: ${resume.desired_role}`;
  const adminUrl = `${appUrl()}/admin`;
  const rows = [
    ["Tipo", application ? "Candidatura em vaga" : "Cadastro no banco de currículos"],
    ["Vaga", job ? `${job.role} · ${job.company}` : "Sem vaga específica"],
    ["Nome", resume.name],
    ["Telefone", resume.phone],
    ["E-mail", resume.email || "Não informado"],
    ["Cargo", resume.desired_role],
    ["Área", resume.area || "Não informada"],
    ["Cidade", resume.city || "Não informada"],
    ["Região", resume.neighborhood],
    ["Arquivo", resume.resume_file_name || "Sem anexo"],
  ];
  const htmlRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="border: 1px solid #d9dfeb; font-weight: 700; padding: 10px;">${htmlEscape(label)}</td>
          <td style="border: 1px solid #d9dfeb; padding: 10px;">${htmlEscape(value)}</td>
        </tr>
      `,
    )
    .join("");
  const preheader = application
    ? "Uma nova candidatura foi recebida em uma vaga publicada."
    : "Um novo currículo entrou no banco de talentos.";
  const text = `${preheader}\n\n${textRows(rows)}\n\nAbrir painel: ${adminUrl}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #1d2433; line-height: 1.5;">
      <h1 style="margin-bottom: 8px;">${htmlEscape(subject)}</h1>
      <p>${htmlEscape(preheader)}</p>
      <table style="border-collapse: collapse; margin: 18px 0; width: 100%;">
        ${htmlRows}
      </table>
      <p style="color: #5f6878;">Os dados completos e o currículo anexado ficam disponíveis no painel protegido.</p>
      <p>
        <a href="${adminUrl}" style="background: #e84f35; color: #fff; display: inline-block; font-weight: 700; padding: 12px 16px; text-decoration: none;">
          Abrir painel
        </a>
      </p>
    </div>
  `;

  return { subject, rows, preheader, text, html };
}

function buildGmailRawMessage({ to, from, replyTo, subject, text, html }) {
  const boundary = `tf-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = [
    from ? `From: ${from}` : null,
    `To: ${to.join(", ")}`,
    replyTo ? `Reply-To: ${replyTo}` : null,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
    .filter(Boolean)
    .join("\r\n");

  return `${headers}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${text}\r\n\r\n--${boundary}\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${html}\r\n\r\n--${boundary}--`;
}

async function sendWithGmail({ to, from, replyTo, subject, text, html }) {
  if (!from) {
    return { status: "skipped", reason: "Remetente Gmail não configurado." };
  }

  const accessToken = await getGoogleAccessToken();
  const raw = encodeBase64Url(buildGmailRawMessage({ to, from, replyTo, subject, text, html }));

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || "Falha ao enviar e-mail pelo Gmail.");
  }

  return { status: "sent", provider: "gmail" };
}

async function sendWithResend({ to, from, replyTo, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { status: "skipped", reason: "Resend não configurado." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      reply_to: replyTo || undefined,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return { status: "failed", reason: error.message || "Falha ao enviar e-mail." };
  }

  return { status: "sent", provider: "resend" };
}

export async function sendNewResumeEmail({ resume, application, job }) {
  const to = recipients();
  const gmailFrom = process.env.GMAIL_FROM_EMAIL || "";
  const resendFrom = process.env.NOTIFY_FROM_EMAIL || "Trampo Fácil <onboarding@resend.dev>";

  if (!to.length) {
    return { status: "skipped", reason: "Destinatário de e-mail não configurado." };
  }

  const content = buildEmailContent({ resume, application, job });
  const payload = {
    to,
    replyTo: resume.email || "",
    ...content,
  };

  try {
    const gmailResult = await sendWithGmail({ ...payload, from: gmailFrom });

    if (gmailResult.status === "sent") {
      return gmailResult;
    }
  } catch (gmailError) {
    const resendResult = await sendWithResend({
      ...payload,
      from: resendFrom,
    });

    if (resendResult.status === "sent") {
      return resendResult;
    }

    return {
      status: "failed",
      provider: "gmail",
      reason: gmailError.message || resendResult.reason || "Falha ao enviar e-mail.",
    };
  }

  try {
    const resendResult = await sendWithResend({
      ...payload,
      from: resendFrom,
    });

    if (resendResult.status === "sent") {
      return resendResult;
    }

    return {
      status: "failed",
      provider: "gmail",
      reason: resendResult.reason || "Gmail não configurado e Resend indisponível.",
    };
  } catch (resendError) {
    return {
      status: "failed",
      provider: "resend",
      reason: resendError.message || "Falha ao enviar e-mail.",
    };
  }
}
