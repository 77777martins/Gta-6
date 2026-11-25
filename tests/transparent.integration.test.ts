/**
 * Integração do Checkout Transparente com PostgreSQL real (API do MP mockada).
 * Executa só com TEST_DATABASE_URL definida. O banco é limpo durante os testes.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const dbUrl = process.env.TEST_DATABASE_URL;

vi.mock("@/server/mercadopago/client", () => ({
  PaymentProviderError: class extends Error {},
  credentialFingerprint: vi.fn(() => "fp"),
  createPreference: vi.fn(),
  getPayment: vi.fn(),
  createPayment: vi.fn(),
}));

describe.skipIf(!dbUrl)("checkout transparente (integração)", async () => {
  process.env.DATABASE_URL = dbUrl;
  process.env.APP_URL = "http://localhost:3000";
  process.env.SALES_ENABLED = "true";
  process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-0000000000000000000000";
  process.env.MERCADOPAGO_WEBHOOK_SECRET = "test-webhook-secret-123";

  const { prisma } = await import("@/lib/db");
  const mp = await import("@/server/mercadopago/client");
  const { createCheckout } = await import("@/server/orders/service");
  const { createPixPayment, createCardPayment } = await import("@/server/orders/transparent");
  const { OrderNotPayableError, PaymentInputError } = await import("@/server/orders/errors");

  const input = { name: "Maria da Silva", email: "maria@example.com", cpf: "52998224725", platform: "PS5" as const, acceptTerms: true };
  const card = {
    token: "ff8080814c11e237014c1ff593b57b4d",
    payment_method_id: "master",
    issuer_id: 24,
    installments: 1,
    transaction_amount: 299.9,
    payer: { identification: { type: "CPF" as const, number: "52998224725" } },
  };

  const payment = (o: Record<string, unknown>) =>
    ({
      id: "5001",
      status: "pending",
      status_detail: "pending_waiting_transfer",
      transaction_amount: 299.9,
      currency_id: "BRL",
      payment_method_id: "pix",
      payment_type_id: "bank_transfer",
      date_approved: null,
      date_last_updated: new Date().toISOString(),
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      point_of_interaction: { transaction_data: { qr_code: "00020126PIXCODE", qr_code_base64: "iVBORw0KGgo=", ticket_url: "https://www.mercadopago.com.br/payments/5001/ticket" } },
      ...o,
    }) as Awaited<ReturnType<typeof mp.getPayment>>;

  beforeEach(async () => {
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();
    vi.mocked(mp.createPayment).mockReset();
    vi.mocked(mp.getPayment).mockReset();
    vi.mocked(mp.createPreference).mockReset();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("no modo transparente o checkout só cria o pedido (sem preferência)", async () => {
    const result = await createCheckout(input, randomUUID(), { transparent: true });
    expect(result.checkoutUrl).toBeUndefined();
    expect(mp.createPreference).not.toHaveBeenCalled();
  });

  it("PIX: gera QR Code, registra o pagamento e reaproveita o QR ainda válido", async () => {
    const { orderId } = await createCheckout(input, randomUUID(), { transparent: true });
    vi.mocked(mp.createPayment).mockResolvedValueOnce(payment({ external_reference: orderId }));
    const pix = await createPixPayment(orderId);
    expect(pix.qrCode).toBe("00020126PIXCODE");
    expect(vi.mocked(mp.createPayment).mock.calls[0]![0]).toMatchObject({ transaction_amount: 299.9, payment_method_id: "pix", external_reference: orderId });

    vi.mocked(mp.getPayment).mockResolvedValueOnce(payment({ external_reference: orderId }));
    const again = await createPixPayment(orderId);
    expect(again.qrCode).toBe(pix.qrCode);
    expect(mp.createPayment).toHaveBeenCalledTimes(1);
  });

  it("PIX: QR expirado gera nova cobrança com outra chave de idempotência", async () => {
    const { orderId } = await createCheckout(input, randomUUID(), { transparent: true });
    vi.mocked(mp.createPayment).mockResolvedValueOnce(payment({ external_reference: orderId }));
    await createPixPayment(orderId);
    vi.mocked(mp.getPayment).mockResolvedValueOnce(payment({ external_reference: orderId, date_of_expiration: new Date(Date.now() - 1000).toISOString() }));
    vi.mocked(mp.createPayment).mockResolvedValueOnce(payment({ id: "5002", external_reference: orderId }));
    await createPixPayment(orderId);
    const keys = vi.mocked(mp.createPayment).mock.calls.map((c) => c[1]);
    expect(new Set(keys).size).toBe(2);
  });

  it("cartão aprovado aprova o pedido; nova tentativa é bloqueada", async () => {
    const { orderId } = await createCheckout(input, randomUUID(), { transparent: true });
    vi.mocked(mp.createPayment).mockResolvedValueOnce(
      payment({ id: "6001", external_reference: orderId, status: "approved", status_detail: "accredited", payment_method_id: "master", payment_type_id: "credit_card", date_approved: new Date().toISOString() }),
    );
    const result = await createCardPayment(orderId, card, randomUUID());
    expect(result).toMatchObject({ status: "approved", orderStatus: "APPROVED" });
    await expect(createCardPayment(orderId, card, randomUUID())).rejects.toBeInstanceOf(OrderNotPayableError);
  });

  it("cartão recusado permite nova tentativa (outro cartão) até aprovar", async () => {
    const { orderId } = await createCheckout(input, randomUUID(), { transparent: true });
    vi.mocked(mp.createPayment).mockResolvedValueOnce(
      payment({ id: "6002", external_reference: orderId, status: "rejected", status_detail: "cc_rejected_insufficient_amount", payment_method_id: "master", payment_type_id: "credit_card" }),
    );
    const result = await createCardPayment(orderId, card, randomUUID());
    expect(result).toMatchObject({ status: "rejected", statusDetail: "cc_rejected_insufficient_amount", orderStatus: "REJECTED" });

    vi.mocked(mp.createPayment).mockResolvedValueOnce(
      payment({ id: "6004", external_reference: orderId, status: "approved", status_detail: "accredited", payment_method_id: "visa", payment_type_id: "credit_card", date_approved: new Date().toISOString() }),
    );
    const retry = await createCardPayment(orderId, card, randomUUID());
    expect(retry.orderStatus).toBe("APPROVED");
  });

  it("depois de cartão recusado, ainda dá para pagar com PIX", async () => {
    const { orderId } = await createCheckout(input, randomUUID(), { transparent: true });
    vi.mocked(mp.createPayment).mockResolvedValueOnce(
      payment({ id: "6005", external_reference: orderId, status: "rejected", status_detail: "cc_rejected_other_reason", payment_method_id: "master", payment_type_id: "credit_card" }),
    );
    await createCardPayment(orderId, card, randomUUID());
    vi.mocked(mp.createPayment).mockResolvedValueOnce(payment({ id: "6006", external_reference: orderId }));
    await expect(createPixPayment(orderId)).resolves.toMatchObject({ qrCode: "00020126PIXCODE" });
  });

  it("bloqueia valor adulterado e não chama o Mercado Pago", async () => {
    const { orderId } = await createCheckout(input, randomUUID(), { transparent: true });
    await expect(createCardPayment(orderId, { ...card, transaction_amount: 1 }, randomUUID())).rejects.toBeInstanceOf(PaymentInputError);
    expect(mp.createPayment).not.toHaveBeenCalled();
  });

  it("bloqueia segunda cobrança enquanto o cartão está em análise", async () => {
    const { orderId } = await createCheckout(input, randomUUID(), { transparent: true });
    vi.mocked(mp.createPayment).mockResolvedValueOnce(
      payment({ id: "6003", external_reference: orderId, status: "in_process", status_detail: "pending_review_manual", payment_method_id: "master", payment_type_id: "credit_card" }),
    );
    await createCardPayment(orderId, card, randomUUID());
    await expect(createCardPayment(orderId, card, randomUUID())).rejects.toMatchObject({ reason: "in_process" });
  });
});
