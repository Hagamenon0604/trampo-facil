import { NextResponse } from "next/server";
import {
  adminCookieName,
  createAdminSessionValue,
  isAdminConfigured,
  isAdminPasswordValid,
} from "@/lib/admin-auth";

export async function POST(request) {
  const body = await request.json();

  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD ainda não foi configurado no ambiente." },
      { status: 503 },
    );
  }

  if (!isAdminPasswordValid(body.password)) {
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName, createAdminSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
