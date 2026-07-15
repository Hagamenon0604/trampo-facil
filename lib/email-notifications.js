import { getGoogleAccessToken } from "@/lib/google-calendar";
import { getResumeFileAccess } from "@/lib/data";

const maxAttachmentBytes = 8 * 1024 * 1024;

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://vagas.aesgestao.com";
}

function recipients() {
  return String(process.env.ADMIN_NOTIFY_EMAIL || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function gmailSender() {
  const email = process.env.GMAIL_FROM_EMAIL || "";
  return email ? `Trampo Fácil <${email}>` : "";
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
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function wrapBase64(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");
}

function safeFileName(value) {
  return String(value || "curriculo")
    .replace(/["\r\n]/g, "")
    .slice(0, 160);
}

function buildEmailContent({ resume, application, job, attachmentsIncluded = false }) {
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
  const attachmentMessage = attachmentsIncluded
    ? "O currículo foi anexado a este e-mail e também fica disponível no painel protegido."
    : "Os dados completos e o currículo anexado ficam disponíveis no painel protegido.";
  const text = `${preheader}\n\n${textRows(rows)}\n\n${attachmentMessage}\n\nAbrir painel: ${adminUrl}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #1d2433; line-height: 1.5;">
      <h1 style="margin-bottom: 8px;">${htmlEscape(subject)}</h1>
      <p>${htmlEscape(preheader)}</p>
      <table style="border-collapse: collapse; margin: 18px 0; width: 100%;">
        ${htmlRows}
      </table>
      <p style="color: #5f6878;">${htmlEscape(attachmentMessage)}</p>
      <p>
        <a href="${adminUrl}" style="background: #e84f35; color: #fff; display: inline-block; font-weight: 700; padding: 12px 16px; text-decoration: none;">
          Abrir painel
        </a>
      </p>
    </div>
  `;

  return { subject, rows, preheader, text, html };
}

function buildCandidateConfirmationContent({ resume, application, job }) {
  const isApplication = Boolean(application && job);
  const subject = isApplication
    ? `Candidatura recebida: ${job.role}`
    : "Currículo recebido pela A&S Gestão";
  const heading = isApplication ? "Sua candidatura foi recebida" : "Seu currículo foi recebido";
  const detail = isApplication
    ? `Você se candidatou à vaga de ${job.role} em ${job.company}.`
    : "Seu perfil foi incluído no banco de talentos da A&S Gestão.";
  const text = [
    `Olá, ${resume.name}.`,
    "",
    detail,
    "A equipe da A&S poderá entrar em contato quando houver uma oportunidade compatível.",
    "",
    `Cargo informado: ${resume.desired_role}`,
    `Cidade/região: ${resume.city || "Não informada"} · ${resume.neighborhood}`,
    "",
    "Você pode solicitar atualização ou exclusão dos seus dados pelo e-mail andrea@aesgestao.com.",
    `Política de Privacidade: ${appUrl()}/privacidade`,
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; color: #1d2433; line-height: 1.6;">
      <p style="color: #e84f35; font-size: 13px; font-weight: 700; text-transform: uppercase;">A&S Gestão de Pessoas</p>
      <h1 style="margin-bottom: 8px;">${htmlEscape(heading)}</h1>
      <p>Olá, <strong>${htmlEscape(resume.name)}</strong>.</p>
      <p>${htmlEscape(detail)}</p>
      <p>A equipe da A&S poderá entrar em contato quando houver uma oportunidade compatível.</p>
      <div style="background: #f7f9fc; border: 1px solid #d9dfeb; margin: 20px 0; padding: 16px;">
        <p style="margin: 0 0 8px;"><strong>Cargo:</strong> ${htmlEscape(resume.desired_role)}</p>
        <p style="margin: 0;"><strong>Localização:</strong> ${htmlEscape(resume.city || "Não informada")} · ${htmlEscape(resume.neighborhood)}</p>
      </div>
      <p style="color: #5f6878; font-size: 14px;">
        Para atualizar ou excluir seus dados, escreva para
        <a href="mailto:andrea@aesgestao.com">andrea@aesgestao.com</a>.
      </p>
      <p style="font-size: 14px;">
        <a href="${appUrl()}/privacidade">Política de Privacidade</a>
      </p>
    </div>
  `;

  return { subject, text, html };
}

async function buildResumeAttachments(resume) {
  if (!resume?.id || !resume.resume_file_path) {
    return [];
  }

  try {
    const access = await getResumeFileAccess(resume.id, { download: true });

    if (!access?.data?.url) {
      return [];
    }

    const response = await fetch(access.data.url);

    if (!response.ok) {
      throw new Error(`Download do currículo retornou ${response.status}.`);
    }

    const content = Buffer.from(await response.arrayBuffer());

    if (content.length > maxAttachmentBytes) {
      throw new Error("Currículo maior que o limite de anexo.");
    }

    return [
      {
        filename: safeFileName(resume.resume_file_name || access.data.fileName),
        contentType:
          resume.resume_file_type ||
          response.headers.get("content-type") ||
          "application/octet-stream",
        content,
      },
    ];
  } catch (error) {
    globalThis.console.warn("[email] Não foi possível anexar currículo ao e-mail.", {
      resumeId: resume.id,
      reason: error.message,
    });
    return [];
  }
}

function buildAlternativePart({ boundary, text, html }) {
  return `--${boundary}\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${text}\r\n\r\n--${boundary}\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${html}\r\n\r\n--${boundary}--`;
}

function buildGmailRawMessage({ to, from, replyTo, subject, text, html, attachments = [] }) {
  const alternativeBoundary = `tf-alt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const mixedBoundary = `tf-mixed-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const hasAttachments = attachments.length > 0;
  const headers = [
    from ? `From: ${from}` : null,
    `To: ${to.join(", ")}`,
    replyTo ? `Reply-To: ${replyTo}` : null,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    hasAttachments
      ? `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`
      : `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
  ]
    .filter(Boolean)
    .join("\r\n");

  if (!hasAttachments) {
    return `${headers}\r\n\r\n${buildAlternativePart({ boundary: alternativeBoundary, text, html })}`;
  }

  const alternative = `--${mixedBoundary}\r\nContent-Type: multipart/alternative; boundary="${alternativeBoundary}"\r\n\r\n${buildAlternativePart({ boundary: alternativeBoundary, text, html })}`;
  const attachmentParts = attachments.map((attachment) => {
    const filename = safeFileName(attachment.filename);

    return [
      `--${mixedBoundary}`,
      `Content-Type: ${attachment.contentType || "application/octet-stream"}; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      wrapBase64(attachment.content),
    ].join("\r\n");
  });

  return `${headers}\r\n\r\n${[alternative, ...attachmentParts].join("\r\n")}\r\n--${mixedBoundary}--`;
}

async function sendWithGmail({ to, from, replyTo, subject, text, html, attachments = [] }) {
  if (!from) {
    return { status: "skipped", reason: "Remetente Gmail não configurado." };
  }

  const accessToken = await getGoogleAccessToken();
  const raw = encodeBase64Url(buildGmailRawMessage({ to, from, replyTo, subject, text, html, attachments }));

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
    globalThis.console.warn("[email] Falha no envio via Gmail.", {
      to,
      subject,
      reason: error.error?.message,
    });
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
  const gmailFrom = gmailSender();
  const resendFrom = process.env.NOTIFY_FROM_EMAIL || "Trampo Fácil <onboarding@resend.dev>";

  if (!to.length) {
    return { status: "skipped", reason: "Destinatário de e-mail não configurado." };
  }

  const attachments = await buildResumeAttachments(resume);
  const content = buildEmailContent({
    resume,
    application,
    job,
    attachmentsIncluded: attachments.length > 0,
  });
  const payload = {
    to,
    replyTo: resume.email || "",
    attachments,
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

export async function sendCandidateConfirmationEmail({ resume, application, job }) {
  if (!resume.email) {
    return { status: "skipped", reason: "Candidato não informou e-mail." };
  }

  const content = buildCandidateConfirmationContent({ resume, application, job });
  const payload = {
    to: [resume.email],
    from: gmailSender(),
    replyTo: process.env.ADMIN_NOTIFY_EMAIL?.split(",")[0]?.trim() || "",
    ...content,
  };

  try {
    return await sendWithGmail(payload);
  } catch (error) {
    return {
      status: "failed",
      provider: "gmail",
      reason: error.message || "Falha ao confirmar o cadastro por e-mail.",
    };
  }
}
