import { createHash, timingSafeEqual } from "crypto";

export const adminCookieName = "tf_admin_session";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function createAdminSessionValue() {
  if (!isAdminConfigured()) {
    return null;
  }

  return hash(process.env.ADMIN_PASSWORD);
}

export function isAdminPasswordValid(password) {
  if (!isAdminConfigured()) {
    return false;
  }

  const expected = Buffer.from(hash(process.env.ADMIN_PASSWORD));
  const received = Buffer.from(hash(password || ""));

  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function isAdminSessionValid(cookieStore) {
  if (!isAdminConfigured()) {
    return false;
  }

  return cookieStore.get(adminCookieName)?.value === createAdminSessionValue();
}
