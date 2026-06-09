import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createInterview, getInterviews } from "@/lib/data";
import { isAdminSessionValid } from "@/lib/admin-auth";
import { cleanText, requireFields } from "@/lib/validators";

export async function GET() {
  try {
    if (!isAdminSessionValid(await cookies())) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const interviews = await getInterviews();
    return NextResponse.json({ data: interviews });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!isAdminSessionValid(await cookies())) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const payload = {
      resume_id: cleanText(body.resume_id),
      job_id: cleanText(body.job_id),
      starts_at: cleanText(body.starts_at),
      ends_at: cleanText(body.ends_at),
      channel: cleanText(body.channel) || "online",
      location: cleanText(body.location),
      notes: cleanText(body.notes),
    };

    const validation = requireFields(payload, ["resume_id", "starts_at", "channel"]);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    const result = await createInterview(payload);

    if (!result.configured) {
      return NextResponse.json(
        { error: "Banco de dados ainda não configurado para salvar entrevistas." },
        { status: 503 },
      );
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
