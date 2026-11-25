import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature, WEBHOOK_TOLERANCE_SECONDS } from "@/server/mercadopago/signature";

const secret = "test-webhook-secret-1234567890";
const NOW_MS = 1_764_000_000_000;
const now = () => NOW_MS;
const ts = String(NOW_MS / 1000);

function sign(dataId: string, requestId: string, timestamp = ts) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  return `ts=${timestamp},v1=${createHmac("sha256", secret).update(manifest).digest("hex")}`;
}

const base = { xRequestId: "req-1", dataId: "123456", secret, now };

describe("verifyWebhookSignature (validador oficial do SDK)", () => {
  it("aceita assinatura válida", () => {
    expect(verifyWebhookSignature({ ...base, xSignature: sign("123456", "req-1") })).toEqual({ valid: true });
  });

  it("normaliza data.id alfanumérico para minúsculas", () => {
    const result = verifyWebhookSignature({ ...base, dataId: "ABC123", xSignature: sign("abc123", "req-1") });
    expect(result.valid).toBe(true);
  });

  it("rejeita payload adulterado, request-id trocado e segredo errado", () => {
    const xSignature = sign("123456", "req-1");
    expect(verifyWebhookSignature({ ...base, xSignature, dataId: "999999" }).valid).toBe(false);
    expect(verifyWebhookSignature({ ...base, xSignature, xRequestId: "req-2" }).valid).toBe(false);
    expect(verifyWebhookSignature({ ...base, xSignature, secret: "outro-segredo-qualquer" }).valid).toBe(false);
  });

  it("rejeita header ausente ou malformado", () => {
    expect(verifyWebhookSignature({ ...base, xSignature: null }).valid).toBe(false);
    expect(verifyWebhookSignature({ ...base, xSignature: "lixo" }).valid).toBe(false);
  });

  it("rejeita replay de notificação antiga", () => {
    const old = String(NOW_MS / 1000 - WEBHOOK_TOLERANCE_SECONDS - 60);
    const result = verifyWebhookSignature({ ...base, xSignature: sign("123456", "req-1", old) });
    expect(result).toEqual({ valid: false, reason: "TimestampOutOfTolerance" });
  });
});
