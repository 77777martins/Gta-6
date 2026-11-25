import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validação de autenticidade do webhook do Mercado Pago.
 *
 * O MP envia `x-signature: ts=<ts>,v1=<hmac>` e `x-request-id`. O HMAC-SHA256
 * (chave = "assinatura secreta" do painel) é calculado sobre o manifesto:
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * onde data.id vem da QUERY STRING (em minúsculas se alfanumérico).
 * Partes ausentes são omitidas do manifesto.
 */
export type SignatureInput = {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
};

export function parseSignatureHeader(header: string): { ts?: string; v1?: string } {
  const out: { ts?: string; v1?: string } = {};
  for (const part of header.split(",")) {
    const [rawKey, ...rawValue] = part.split("=");
    const key = rawKey?.trim();
    const value = rawValue.join("=").trim();
    if (key === "ts") out.ts = value;
    if (key === "v1") out.v1 = value;
  }
  return out;
}

export function buildManifest(dataId: string | null, requestId: string | null, ts: string): string {
  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  return manifest;
}

export function verifyWebhookSignature({ xSignature, xRequestId, dataId, secret }: SignatureInput): boolean {
  if (!xSignature || !secret) return false;
  const { ts, v1 } = parseSignatureHeader(xSignature);
  if (!ts || !v1 || !/^[a-f0-9]{64}$/i.test(v1)) return false;

  const expected = createHmac("sha256", secret).update(buildManifest(dataId, xRequestId, ts)).digest();
  const received = Buffer.from(v1, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
