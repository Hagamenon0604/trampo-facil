import { NextResponse } from "next/server";
import { createResume, getResumes } from "@/lib/data";
import { cleanText, requireFields } from "@/lib/validators";

export async function GET() {
  try {
    const resumes = await getResumes();
    return NextResponse.json({ data: resumes });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const payload = {
      name: cleanText(body.name),
      phone: cleanText(body.phone),
      email: cleanText(body.email),
      desired_role: cleanText(body.desired_role),
      neighborhood: cleanText(body.neighborhood),
      availability: cleanText(body.availability),
      experience: cleanText(body.experience),
      lgpd_accepted: Boolean(body.lgpd_accepted),
    };

    const validation = requireFields(payload, [
      "name",
      "phone",
      "desired_role",
      "neighborhood",
      "experience",
    ]);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    if (!payload.lgpd_accepted) {
      return NextResponse.json(
        { error: "É necessário aceitar o tratamento de dados para enviar o currículo." },
        { status: 400 },
      );
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

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
