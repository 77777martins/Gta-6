/** Public Key do Mercado Pago (pública por natureza; usada no navegador para tokenizar o cartão). */
export function parseMercadoPagoPublicKey(value: string | undefined): string | null {
  const key = (value ?? "").trim().replace(/^["']|["']$/g, "").trim();
  return /^(APP_USR|TEST)-[A-Za-z0-9-]{20,80}$/.test(key) ? key : null;
}
