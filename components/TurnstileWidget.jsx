"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function TurnstileWidget({ action, resetKey }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.turnstile) {
      setScriptReady(true);
    }
  }, []);

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile) {
      return;
    }

    if (widgetIdRef.current !== null) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        // Widget may already have been removed by Cloudflare after a route transition.
      }
      widgetIdRef.current = null;
    }

    containerRef.current.innerHTML = "";
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: "light",
      size: "flexible",
    });

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore cleanup races when the challenge iframe is already gone.
        }
        widgetIdRef.current = null;
      }
    };
  }, [action, resetKey, scriptReady]);

  if (!siteKey) {
    return null;
  }

  return (
    <>
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
        onError={() => setScriptFailed(true)}
      />
      {scriptFailed ? (
        <p className="form-error">
          Não foi possível carregar a verificação de segurança. Recarregue a página e tente novamente.
        </p>
      ) : null}
      <div className="turnstile-container" ref={containerRef} />
    </>
  );
}
