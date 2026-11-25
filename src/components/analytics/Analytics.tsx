"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { hasAnyPixel } from "@/lib/analytics/config";
import { CONSENT_EVENT, readConsent, writeConsent, type Consent } from "@/lib/analytics/consent";
import { loadPixels, trackConversion } from "@/lib/analytics/pixels";

/**
 * Carrega os pixels somente após consentimento (LGPD) e envia ViewContent na
 * página de vendas. Sem nenhum pixel configurado, não renderiza nada.
 */
export function Analytics() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent | null | "unknown">("unknown");

  useEffect(() => {
    if (!hasAnyPixel) return;
    setConsent(readConsent());
    const onChange = (e: Event) => setConsent((e as CustomEvent<Consent>).detail);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (consent !== "granted") return;
    loadPixels();
    if (pathname === "/") trackConversion("ViewContent");
  }, [consent, pathname]);

  if (!hasAnyPixel || consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-xl border border-line bg-ink-2/95 p-4 shadow-2xl shadow-black/60 backdrop-blur sm:inset-x-auto sm:left-4"
    >
      <p className="text-sm text-zinc-300">
        Usamos cookies de marketing para medir nossos anúncios e melhorar sua experiência. Você pode aceitar ou recusar.{" "}
        <Link href="/#condicoes" className="text-gold underline underline-offset-2">
          Saiba mais
        </Link>
        .
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => writeConsent("granted")}
          className="flex-1 rounded-md bg-blood px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-blood-dark"
        >
          Aceitar
        </button>
        <button
          type="button"
          onClick={() => writeConsent("denied")}
          className="flex-1 rounded-md border border-line px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-zinc-300 transition hover:border-gold hover:text-gold"
        >
          Recusar
        </button>
      </div>
    </div>
  );
}
