/**
 * Aceita apenas links de pagamento oficiais do Mercado Pago (https), para que
 * uma variável mal digitada nunca mande o cliente para um domínio desconhecido.
 */
const ALLOWED_HOSTS = new Set([
  "mpago.la",
  "mpago.li",
  "link.mercadopago.com.br",
  "mercadopago.com.br",
  "www.mercadopago.com.br",
]);

export function sanitizePaymentLink(value: string | undefined): string | null {
  const raw = (value ?? "").trim().replace(/^["']|["']$/g, "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}
