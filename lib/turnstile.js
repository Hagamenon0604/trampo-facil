const verifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken({ token, remoteIp }) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    return { configured: false, success: true };
  }

  if (!token) {
    return { configured: true, success: false, reason: "missing-token" };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch(verifyUrl, {
    method: "POST",
    body,
  });
  const result = await response.json().catch(() => ({}));

  return {
    configured: true,
    success: Boolean(result.success),
    reason: result["error-codes"]?.join(", ") || "",
  };
}

export function requestIp(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
}
