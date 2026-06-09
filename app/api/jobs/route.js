import { NextResponse } from "next/server";
import { createJob, getJobs } from "@/lib/data";
import { cleanText, requireFields } from "@/lib/validators";

export async function GET() {
  try {
    const jobs = await getJobs();
    return NextResponse.json({ data: jobs });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const payload = {
      company: cleanText(body.company),
      role: cleanText(body.role),
      neighborhood: cleanText(body.neighborhood),
      salary: cleanText(body.salary),
      shift: cleanText(body.shift),
      contact: cleanText(body.contact),
      description: cleanText(body.description),
    };

    const validation = requireFields(payload, [
      "company",
      "role",
      "neighborhood",
      "salary",
      "shift",
      "contact",
      "description",
    ]);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    const result = await createJob(payload);

    if (!result.configured) {
      return NextResponse.json(
        {
          error:
            "Banco de dados ainda não configurado. Configure o Supabase para salvar vagas em produção.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
