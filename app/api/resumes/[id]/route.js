import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminSessionValid } from "@/lib/admin-auth";
import { updateResume } from "@/lib/data";
import { cleanText } from "@/lib/validators";

export async function PATCH(request, { params }) {
  try {
    if (!isAdminSessionValid(await cookies())) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const payload = {
      status: cleanText(body.status),
      favorite: typeof body.favorite === "boolean" ? body.favorite : undefined,
      tags: body.tags,
      internal_notes: body.internal_notes !== undefined ? cleanText(body.internal_notes) : undefined,
      score_experience: body.score_experience,
      score_availability: body.score_availability,
      score_communication: body.score_communication,
      score_distance: body.score_distance,
      score_fit: body.score_fit,
    };

    const result = await updateResume(id, payload);

    if (!result.configured) {
      return NextResponse.json(
        { error: "Banco de dados ainda não configurado para atualizar candidatos." },
        { status: 503 },
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
