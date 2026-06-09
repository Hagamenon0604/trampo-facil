import { NextResponse } from "next/server";

const adminCookieName = "tf_admin_session";

function hash(value) {
  const encoder = new TextEncoder();
  return crypto.subtle.digest("SHA-256", encoder.encode(value)).then((buffer) =>
    Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
  );
}

async function hasAdminSession(request) {
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    return false;
  }

  const expected = await hash(password);
  return request.cookies.get(adminCookieName)?.value === expected;
}

export async function proxy(request) {
  if (request.nextUrl.pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  if (await hasAdminSession(request)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
