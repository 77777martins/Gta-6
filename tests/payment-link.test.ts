import { describe, expect, it } from "vitest";
import { sanitizePaymentLink } from "@/lib/validation/payment-link";

describe("sanitizePaymentLink", () => {
  it.each([
    "https://mpago.la/1AbCdE",
    "https://mpago.li/2xYz",
    " https://link.mercadopago.com.br/minhaloja ",
    '"https://mpago.la/abc"',
  ])("aceita link oficial %j", (v) => {
    expect(sanitizePaymentLink(v)).toMatch(/^https:\/\//);
  });

  it.each([
    undefined,
    "",
    "http://mpago.la/abc",
    "https://mpago.la.golpe.com/abc",
    "https://evil.com/?r=mpago.la",
    "javascript:alert(1)",
    "mpago.la/abc",
  ])("rejeita %j", (v) => {
    expect(sanitizePaymentLink(v)).toBeNull();
  });
});
