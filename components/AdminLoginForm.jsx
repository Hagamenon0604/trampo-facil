"use client";

import { useState, useTransition } from "react";

export function AdminLoginForm({ nextPath }) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    startTransition(async () => {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Não foi possível entrar.");
        return;
      }

      window.location.href = nextPath;
    });
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label>
        Senha de acesso
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button primary full" type="submit" disabled={isPending}>
        Entrar
      </button>
    </form>
  );
}
