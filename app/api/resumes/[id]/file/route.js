import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAdminSessionValid } from "@/lib/admin-auth";
import { getResumeFileAccess } from "@/lib/data";

export async function GET(request, { params }) {
  try {
    if (!isAdminSessionValid(await cookies())) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;
    const download = new URL(request.url).searchParams.get("download") === "1";
    const result = await getResumeFileAccess(id, { download });

    if (!result.configured) {
      return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
    }

    if (!result.data) {
      return NextResponse.json({ error: "Este candidato não anexou um currículo." }, { status: 404 });
    }

    return NextResponse.redirect(result.data.url);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
