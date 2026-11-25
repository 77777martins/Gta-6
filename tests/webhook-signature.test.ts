import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildManifest, verifyWebhookSignature } from "@/server/mercadopago/signature";

const secret = "test-webhook-secret-1234567890";

function sign(dataId: string, requestId: string, ts: string) {
  const v1 = createHmac("sha256", secret).update(buildManifest(dataId, requestId, ts)).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("verifyWebhookSignature", () => {
  it("monta o manifesto no formato documentado pelo Mercado Pago", () => {
    expect(buildManifest("ABC123", "req-1", "1700")).toBe("id:abc123;request-id:req-1;ts:1700;");
    expect(buildManifest(null, null, "1700")).toBe("ts:1700;");
  });

  it("aceita assinatura válida", () => {
    const xSignature = sign("123456", "req-1", "1704908010");
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-1", dataId: "123456", secret })).toBe(true);
  });

  it("rejeita payload adulterado, segredo errado e header ausente/malformado", () => {
    const xSignature = sign("123456", "req-1", "1704908010");
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-1", dataId: "999999", secret })).toBe(false);
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-2", dataId: "123456", secret })).toBe(false);
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-1", dataId: "123456", secret: "outro-segredo-qualquer" })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: null, xRequestId: "req-1", dataId: "123456", secret })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: "ts=1,v1=zz", xRequestId: "req-1", dataId: "123456", secret })).toBe(false);
  });
});
