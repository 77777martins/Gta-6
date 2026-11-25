import { describe, expect, it } from "vitest";
import { toSaoPauloIso } from "@/lib/datetime";
import { rejectionMessage } from "@/lib/payment-messages";
import { cardPaymentSchema } from "@/lib/validation/card-payment";
import { parseMercadoPagoPublicKey } from "@/lib/validation/mp-public-key";

describe("toSaoPauloIso", () => {
  it("formata no fuso -03:00 exigido pelo Mercado Pago", () => {
    expect(toSaoPauloIso(new Date("2026-11-25T21:30:00.000Z"))).toBe("2026-11-25T18:30:00.000-03:00");
  });
});

describe("parseMercadoPagoPublicKey", () => {
  it("aceita chaves APP_USR e TEST", () => {
    expect(parseMercadoPagoPublicKey(" APP_USR-accd4967-55a8-4482-b6d0-ae77d1234567 ")).toMatch(/^APP_USR-/);
    expect(parseMercadoPagoPublicKey("TEST-12345678-aaaa-bbbb-cccc-1234567890ab")).toMatch(/^TEST-/);
  });
  it("rejeita vazio, access token no lugar errado e lixo", () => {
    expect(parseMercadoPagoPublicKey(undefined)).toBeNull();
    expect(parseMercadoPagoPublicKey("chave")).toBeNull();
    expect(parseMercadoPagoPublicKey('APP_USR-"><script>')).toBeNull();
  });
});

describe("cardPaymentSchema", () => {
  const valid = {
    token: "ff8080814c11e237014c1ff593b57b4d",
    payment_method_id: "master",
    issuer_id: "24",
    installments: 3,
    transaction_amount: 299.9,
    payer: { email: "a@b.com", identification: { type: "CPF", number: "52998224725" } },
  };
  it("aceita o payload do Card Payment Brick", () => {
    const data = cardPaymentSchema.parse(valid);
    expect(data.issuer_id).toBe(24);
    expect(data.installments).toBe(3);
  });
  it.each([
    ["token inválido", { token: "<x>" }],
    ["parcelas acima de 12", { installments: 13 }],
    ["bandeira inválida", { payment_method_id: "MASTER;DROP" }],
    ["valor negativo", { transaction_amount: -1 }],
  ])("rejeita %s", (_, patch) => {
    expect(cardPaymentSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe("rejectionMessage", () => {
  it("traduz motivos conhecidos e tem mensagem padrão", () => {
    expect(rejectionMessage("cc_rejected_bad_filled_security_code")).toContain("CVV");
    expect(rejectionMessage("cc_rejected_insufficient_amount")).toContain("Limite");
    expect(rejectionMessage("algo_novo")).toContain("Pagamento recusado");
    expect(rejectionMessage(null)).toContain("Pagamento recusado");
  });
});
