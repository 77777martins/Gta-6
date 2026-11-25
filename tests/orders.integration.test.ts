/**
 * Testes de integração com PostgreSQL real (API do Mercado Pago mockada).
 * Executados apenas quando TEST_DATABASE_URL estiver definida:
 *   TEST_DATABASE_URL=postgresql://... npm test
 * ATENÇÃO: o banco informado é limpo durante os testes. Use um banco exclusivo.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const dbUrl = process.env.TEST_DATABASE_URL;

vi.mock("@/server/mercadopago/client", () => {
  const credentialFingerprint = vi.fn(() => "fp-teste");
  return {
    PaymentProviderError: class extends Error {},
    credentialFingerprint,
    createPreference: vi.fn(async ({ orderId }: { orderId: string }) => ({
      preferenceId: `pref-${orderId}-${Math.random().toString(36).slice(2, 8)}`,
      checkoutUrl: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-${orderId}`,
      credentialFp: credentialFingerprint(),
    })),
    getPayment: vi.fn(),
  };
});

describe.skipIf(!dbUrl)("pedidos (integração)", async () => {
  process.env.DATABASE_URL = dbUrl;
  process.env.APP_URL = "http://localhost:3000";
  process.env.SALES_ENABLED = "true";
  process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-0000000000000000000000";
  process.env.MERCADOPAGO_WEBHOOK_SECRET = "test-webhook-secret-123";

  const { prisma } = await import("@/lib/db");
  const mp = await import("@/server/mercadopago/client");
  const { createCheckout, syncPayment } = await import("@/server/orders/service");

  const input = {
    name: "Maria da Silva",
    email: "maria@example.com",
    cpf: "52998224725",
    phone: "11912345678",
    platform: "PS5" as const,
    acceptTerms: true,
  };

  const mockPayment = (overrides: Record<string, unknown>) =>
    vi.mocked(mp.getPayment).mockResolvedValueOnce({
      id: "1001",
      status: "approved",
      status_detail: "accredited",
      external_reference: null,
      transaction_amount: 299.9,
      currency_id: "BRL",
      payment_method_id: "pix",
      payment_type_id: "bank_transfer",
      date_approved: new Date().toISOString(),
      date_last_updated: new Date().toISOString(),
      ...overrides,
    } as Awaited<ReturnType<typeof mp.getPayment>>);

  beforeAll(async () => {
    await prisma.$connect();
  });
  beforeEach(async () => {
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();
    vi.mocked(mp.createPreference).mockClear();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("mesma Idempotency-Key em requisições concorrentes gera um único pedido e uma preferência", async () => {
    const key = randomUUID();
    const results = await Promise.all([createCheckout(input, key), createCheckout(input, key), createCheckout(input, key)]);
    expect(new Set(results.map((r) => r.orderId)).size).toBe(1);
    expect(await prisma.order.count()).toBe(1);
    const order = await prisma.order.findFirstOrThrow();
    expect(order.totalCents).toBe(29990);
    expect(order.status).toBe("PENDING");
    expect(order.customerPhone).toBe("11912345678");
  });

  it("reaproveita pedido pendente recente do mesmo comprador em vez de duplicar", async () => {
    const a = await createCheckout(input, randomUUID());
    const b = await createCheckout(input, randomUUID());
    expect(b.orderId).toBe(a.orderId);
    expect(await prisma.order.count()).toBe(1);
  });

  it("troca de credencial (teste -> produção) gera link novo para o pedido reaproveitado", async () => {
    const a = await createCheckout(input, randomUUID());
    const before = await prisma.order.findUniqueOrThrow({ where: { id: a.orderId } });
    vi.mocked(mp.credentialFingerprint).mockReturnValue("fp-producao");
    const b = await createCheckout(input, randomUUID());
    const after = await prisma.order.findUniqueOrThrow({ where: { id: b.orderId } });
    expect(b.orderId).toBe(a.orderId);
    expect(after.mpPreferenceId).not.toBe(before.mpPreferenceId);
    expect(after.mpCredentialFp).toBe("fp-producao");
    expect(mp.createPreference).toHaveBeenCalledTimes(2);
    vi.mocked(mp.credentialFingerprint).mockReturnValue("fp-teste");
  });

  it("aprova o pedido quando o MP confirma o valor correto (idempotente)", async () => {
    const { orderId } = await createCheckout(input, randomUUID());
    mockPayment({ external_reference: orderId });
    mockPayment({ external_reference: orderId });
    expect(await syncPayment("1001")).toBe("APPROVED");
    expect(await syncPayment("1001")).toBe("APPROVED");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paidAt).not.toBeNull();
    expect(await prisma.payment.count()).toBe(1);
  });

  it("não aprova pagamento com valor adulterado", async () => {
    const { orderId } = await createCheckout(input, randomUUID());
    mockPayment({ external_reference: orderId, transaction_amount: 1 });
    expect(await syncPayment("1001")).toBe("PENDING");
  });

  it("recusa e depois aprovação na mesma preferência resulta em APPROVED", async () => {
    const { orderId } = await createCheckout(input, randomUUID());
    mockPayment({ id: "2001", external_reference: orderId, status: "rejected", date_approved: null });
    expect(await syncPayment("2001")).toBe("REJECTED");
    mockPayment({ id: "2002", external_reference: orderId });
    expect(await syncPayment("2002")).toBe("APPROVED");
  });

  it("ignora pagamentos que não pertencem à loja", async () => {
    mockPayment({ external_reference: "outra-loja-123" });
    expect(await syncPayment("1001")).toBeNull();
    mockPayment({ external_reference: randomUUID() });
    expect(await syncPayment("1001")).toBeNull();
  });
});
