import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildGoogleAuthUrl } from "@/lib/google-calendar";
import { isAdminSessionValid } from "@/lib/admin-auth";

export async function GET(request) {
  const cookieStore = await cookies();

  if (!isAdminSessionValid(cookieStore)) {
    return NextResponse.redirect(new URL("/admin/login?next=/api/google/connect", request.url));
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET antes de conectar o Google." },
      { status: 503 },
    );
  }

  const state = globalThis.crypto?.randomUUID?.() || String(Date.now());
  const response = NextResponse.redirect(buildGoogleAuthUrl({ request, state }));

  response.cookies.set("tf_google_oauth_state", state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
