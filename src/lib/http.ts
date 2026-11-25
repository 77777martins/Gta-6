import "server-only";
import { NextResponse } from "next/server";

/**
 * IP do cliente. Confia no primeiro valor de X-Forwarded-For, o que só é seguro
 * atrás de um proxy confiável (Vercel, Nginx, Cloudflare) que sobrescreve o header.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

/**
 * Proteção CSRF para rotas chamadas pelo próprio site: exige que Origin
 * corresponda ao domínio da aplicação. Combinado com Content-Type JSON
 * obrigatório, bloqueia envios forjados por outros sites.
 */
export function isSameOrigin(headers: Headers, appUrl: string): boolean {
  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

export function jsonError(status: number, error: string, init?: { headers?: HeadersInit }) {
  return NextResponse.json({ error }, { status, headers: init?.headers });
}
