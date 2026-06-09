export function cleanText(value) {
  return String(value || "").trim();
}

export function requireFields(payload, fields) {
  const missing = fields.filter((field) => !cleanText(payload[field]));

  if (missing.length) {
    return {
      ok: false,
      message: `Campos obrigatórios ausentes: ${missing.join(", ")}`,
    };
  }

  return { ok: true };
}
