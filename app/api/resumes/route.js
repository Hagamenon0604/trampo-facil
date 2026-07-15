import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createResume, getJobs, getResumes, updateResumeFile, uploadResumeFile } from "@/lib/data";
import { isAdminSessionValid } from "@/lib/admin-auth";
import { cleanText, requireFields } from "@/lib/validators";
import { sendNewResumeEmail } from "@/lib/email-notifications";
import { sendCandidateConfirmationEmail } from "@/lib/email-notifications";
import { sendInternalWhatsappNotification } from "@/lib/notifications";
import { requestIp, verifyTurnstileToken } from "@/lib/turnstile";

const allowedResumeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function readPayload(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return {
      body: Object.fromEntries(formData.entries()),
      file: formData.get("resume_file"),
    };
  }

  return {
    body: await request.json(),
    file: null,
  };
}

function validateResumeFile(file) {
  if (!file || typeof file === "string" || !file.size) {
    return null;
  }

  if (!allowedResumeTypes.has(file.type)) {
    return "Envie o currículo em PDF, Word ou imagem.";
  }

  if (file.size > 8 * 1024 * 1024) {
    return "O currículo deve ter até 8MB.";
  }

  return null;
}

function logNotificationFailure(context, result) {
  if (result?.status === "failed") {
    globalThis.console.warn(`[resumes] Falha em ${context}.`, {
      provider: result.provider,
      reason: result.reason,
    });
  }
}

export async function GET() {
  try {
    if (!isAdminSessionValid(await cookies())) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const resumes = await getResumes();
    return NextResponse.json({ data: resumes });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { body, file } = await readPayload(request);
    const payload = {
      job_id: cleanText(body.job_id),
      name: cleanText(body.name),
      phone: cleanText(body.phone),
      email: cleanText(body.email),
      area: cleanText(body.area),
      desired_role: cleanText(body.desired_role),
      city: cleanText(body.city),
      neighborhood: cleanText(body.neighborhood),
      availability: cleanText(body.availability),
      experience: cleanText(body.experience),
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

    const requiredFields = [
      "name",
      "phone",
      "desired_role",
      "area",
      "city",
      "neighborhood",
    ];
    const fileProvided = file && typeof file !== "string" && file.size;

    if (!fileProvided) {
      requiredFields.push("experience");
    }

    const validation = requireFields(payload, requiredFields);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    if (!payload.lgpd_accepted) {
      return NextResponse.json(
        { error: "É necessário aceitar o tratamento de dados para enviar o currículo." },
        { status: 400 },
      );
    }

    const fileError = validateResumeFile(file);

    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }

    const result = await createResume(payload);

    if (!result.configured) {
      return NextResponse.json(
        {
          error:
            "Banco de dados ainda não configurado. Configure o Supabase para salvar currículos em produção.",
        },
        { status: 503 },
      );
    }

    let resume = result.data;

    if (file && typeof file !== "string" && file.size) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const upload = await uploadResumeFile({
        resumeId: resume.id,
        fileName: file.name,
        contentType: file.type,
        bytes,
      });

      if (upload.path) {
        const updated = await updateResumeFile(resume.id, {
          resume_file_path: upload.path,
          resume_file_name: file.name,
          resume_file_type: file.type,
          resume_file_size: file.size,
        });

        resume = updated.data || {
          ...resume,
          resume_file_path: upload.path,
          resume_file_name: file.name,
          resume_file_type: file.type,
          resume_file_size: file.size,
        };
      }
    }

    const jobs = payload.job_id ? await getJobs({ includeDrafts: true }) : [];
    const relatedJob = jobs.find((job) => job.id === payload.job_id);
    const emailNotification = await sendNewResumeEmail({
      resume,
      application: result.application,
      job: relatedJob,
    }).catch((error) => ({ status: "failed", reason: error.message }));
    const candidateConfirmation = await sendCandidateConfirmationEmail({
      resume,
      application: result.application,
      job: relatedJob,
    }).catch((error) => ({ status: "failed", reason: error.message }));
    const whatsappNotification = await sendInternalWhatsappNotification({
      resume,
      job: relatedJob,
      source: "resume",
    }).catch((error) => ({ status: "failed", reason: error.message }));

    logNotificationFailure("notificação por e-mail para A&S", emailNotification);
    logNotificationFailure("confirmação por e-mail ao candidato", candidateConfirmation);
    logNotificationFailure("notificação interna por WhatsApp", whatsappNotification);

    return NextResponse.json(
      {
        data: {
          ...resume,
          application: result.application,
          emailNotification,
          candidateConfirmation,
          whatsappNotification,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
