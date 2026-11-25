import { NextResponse, type NextRequest } from "next/server";

/**
 * Content-Security-Policy com nonce por requisição (mitigação de XSS).
 * O Next.js lê o nonce do header CSP da requisição e o aplica aos próprios scripts.
 * Estilos usam 'unsafe-inline' porque atributos style não aceitam nonce (risco baixo).
 */
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV !== "production";

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic': scripts injetados pelo nosso código (pixels, após consentimento)
    // são permitidos; os hosts abaixo valem só para navegadores sem suporte a ele.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://connect.facebook.net https://analytics.tiktok.com${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.facebook.com https://*.tiktok.com",
    "font-src 'self'",
    "connect-src 'self' https://www.facebook.com https://connect.facebook.net https://*.tiktok.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
