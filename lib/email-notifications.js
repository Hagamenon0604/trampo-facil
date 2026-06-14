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

export async function sendNewResumeEmail({ resume, application, job }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = recipients();
  const from = process.env.NOTIFY_FROM_EMAIL || "Trampo Fácil <onboarding@resend.dev>";

  if (!apiKey || !to.length) {
    return { status: "skipped", reason: "E-mail não configurado." };
  }

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
      reply_to: resume.email || undefined,
      text: `${preheader}\n\n${textRows(rows)}\n\nAbrir painel: ${adminUrl}`,
      html: `
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
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return { status: "failed", reason: error.message || "Falha ao enviar e-mail." };
  }

  return { status: "sent" };
}
