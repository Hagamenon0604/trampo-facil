import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeGoogleCode } from "@/lib/google-calendar";
import { isAdminSessionValid } from "@/lib/admin-auth";

function htmlPage({ title, body }) {
  return new NextResponse(
    `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { background: #f7f9fc; color: #1d2433; font-family: system-ui, sans-serif; margin: 0; padding: 32px; }
      main { background: white; border: 1px solid #d9dfeb; border-radius: 8px; margin: 0 auto; max-width: 760px; padding: 28px; }
      code, pre { background: #f1f4f9; border-radius: 8px; overflow-wrap: anywhere; padding: 12px; white-space: pre-wrap; }
      a { color: #e84f35; font-weight: 800; }
    </style>
  </head>
  <body><main>${body}</main></body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}

export async function GET(request) {
  const cookieStore = await cookies();

  if (!isAdminSessionValid(cookieStore)) {
    return NextResponse.redirect(new URL("/admin/login?next=/api/google/connect", request.url));
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = cookieStore.get("tf_google_oauth_state")?.value;

  if (error) {
    return htmlPage({
      title: "Google não conectado",
      body: `<h1>Google não conectado</h1><p>Erro retornado pelo Google: <code>${error}</code></p>`,
    });
  }

  if (!code || !state || state !== expectedState) {
    return htmlPage({
      title: "Conexão inválida",
      body: "<h1>Conexão inválida</h1><p>O estado da conexão não confere. Inicie a conexão novamente pelo painel.</p>",
    });
  }

  try {
    const token = await exchangeGoogleCode({ code, request });
    const refreshToken = token.refresh_token;

    if (!refreshToken) {
      return htmlPage({
        title: "Refresh token não retornado",
        body:
          "<h1>Quase lá</h1><p>O Google não retornou refresh token. Tente conectar novamente pelo painel. Se necessário, remova o acesso anterior do app na conta Google e conecte de novo.</p>",
      });
    }

    return htmlPage({
      title: "Google conectado",
      body: `<h1>Google conectado</h1>
<p>Copie este valor para a variável <strong>GOOGLE_REFRESH_TOKEN</strong> na Vercel e faça um redeploy.</p>
<pre>${refreshToken}</pre>
<p>Depois disso, cada entrevista online poderá criar um evento no Google Agenda com link único do Meet e cada novo currículo poderá gerar uma notificação por e-mail.</p>
<p><a href="/admin">Voltar ao painel</a></p>`,
    });
  } catch (caughtError) {
    return htmlPage({
      title: "Erro ao conectar Google",
      body: `<h1>Erro ao conectar Google</h1><p>${caughtError.message}</p>`,
    });
  }
}
