/**
 * Integração Pixoupay com PostgreSQL real (API do Pixoupay mockada).
 * Executa só com TEST_DATABASE_URL definida. O banco é limpo durante os testes.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const dbUrl = process.env.TEST_DATABASE_URL;

vi.mock("@/server/pixoupay/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/pixoupay/client")>();
  return { ...actual, createPixoupayCharge: vi.fn(), getPixoupayTransaction: vi.fn() };
});

describe.skipIf(!dbUrl)("Pixoupay (integração)", async () => {
  process.env.DATABASE_URL = dbUrl;
  process.env.APP_URL = "http://localhost:3000";
  process.env.SALES_ENABLED = "true";
  process.env.PIXOUPAY_SECRET_TOKEN = "sk_test_1234567890";
  process.env.PIXOUPAY_WEBHOOK_TOKEN = "webhook_token_abcdefghijklmnop";
  delete process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

  const { prisma } = await import("@/lib/db");
  const pixou = await import("@/server/pixoupay/client");
  const { createCheckout } = await import("@/server/orders/service");
  const { createPixPayment } = await import("@/server/orders/transparent");
  const { POST: webhook } = await import("@/app/api/webhooks/pixoupay/route");
  const { NextRequest } = await import("next/server");

  const input = { name: "Maria da Silva", email: "maria@example.com", cpf: "52998224725", platform: "PS5" as const, acceptTerms: true };
  const PAY_ID = "390b5525-4629-4463-a32a-e0cd432d939b";
  const charge = (o: Record<string, unknown> = {}) => ({
    id: PAY_ID,
    status: "pending" as const,
    total_amount: 29990,
    created_at: new Date().toISOString(),
    pix: { code: "00020126870014br.gov.bcb.pix", qrcode_base64: "iVBORw0KGgo=" },
    ...o,
  });
  const hook = (id: string, token = "webhook_token_abcdefghijklmnop") =>
    webhook(
      new NextRequest(`http://localhost:3000/api/webhooks/pixoupay?token=${token}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 200)}` },
        body: JSON.stringify({ event: "transaction.processed", data: { id, status: "paid", total_amount: 1 } }),
      }),
    );

  beforeEach(async () => {
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();
    vi.mocked(pixou.createPixoupayCharge).mockReset();
    vi.mocked(pixou.getPixoupayTransaction).mockReset();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("cria o PIX com external_id único, webhook com token e valor do pedido", async () => {
    const { orderId } = await createCheckout(input, randomUUID(), { transparent: true });
    vi.mocked(pixou.createPixoupayCharge).mockResolvedValueOnce(charge());
    const pix = await createPixPayment(orderId);
    expect(pix.qrCode).toContain("br.gov.bcb.pix");
    const args = vi.mocked(pixou.createPixoupayCharge).mock.calls[0]![0];
    expect(args).toMatchObject({ externalId: `${orderId}_1`, amountCents: 29990 });
    expect(args.postbackUrl).toBe("http://localhost:3000/api/webhooks/pixoupay?token=webhook_token_abcdefghijklmnop");
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: PAY_ID } });
    expect(row).toMatchObject({ provider: "pixoupay", status: "pending", pixCode: "00020126870014br.gov.bcb.pix" });
  });

  it("reaproveita o QR Code ainda pendente (sem nova cobrança)", async () => {
    const { orderId } = await createCheckout(input, randomUUID(), { transparent: true });
    vi.mocked(pixou.createPixoupayCharge).mockResolvedValueOnce(charge());
    await createPixPayment(orderId);
    vi.mocked(pixou.getPixoupayTransaction).mockResolvedValueOnce(charge());
    const again = await createPixPayment(orderId);
    expect(again.qrCode).toContain("br.gov.bcb.pix");
    expect(pixou.createPixoupayCharge).toHaveBeenCalledTimes(1);
  });

  it("PIX expirado gera nova cobrança com novo external_id", async () => {
    const { orderId } = await createCheckout(input, randomUUID(), { transparent: true });
    vi.mocked(pixou.createPixoupayCharge).mockResolvedValueOnce(charge());
    await createPixPayment(orderId);
    vi.mocked(pixou.getPixoupayTransaction).mockResolvedValueOnce(charge({ status: "expired" }));
    vi.mocked(pixou.createPixoupayCharge).mockResolvedValueOnce(charge({ id: randomUUID() }));
    await createPixPayment(orderId);
    expect(vi.mocked(pixou.createPixoupayCharge).mock.calls[1]![0].externalId).toBe(`${orderId}_2`);
  });

  it("webhook com token válido confirma na API e aprova o pedido", async () => {
    const { orderId } = await createCheckout(input, randomUUID(), { transparent: true });
    vi.mocked(pixou.createPixoupayCharge).mockResolvedValueOnce(charge());
    await createPixPayment(orderId);
    vi.mocked(pixou.getPixoupayTransaction).mockResolvedValueOnce(charge({ status: "paid" }));
    const res = await hook(PAY_ID);
    expect(res.status).toBe(200);
    expect(pixou.getPixoupayTransaction).toHaveBeenCalledWith(PAY_ID);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("APPROVED");
  });

  it("webhook falso: token errado é recusado e nada muda", async () => {
    const { orderId } = await createCheckout(input, randomUUID(), { transparent: true });
    vi.mocked(pixou.createPixoupayCharge).mockResolvedValueOnce(charge());
    await createPixPayment(orderId);
    const res = await hook(PAY_ID, "token_errado_aaaaaaaaaaaaaaaaaaaa");
    expect(res.status).toBe(401);
    expect(pixou.getPixoupayTransaction).not.toHaveBeenCalled();
  });

  it("webhook com token certo mas status real pendente NÃO aprova (não confia no payload)", async () => {
    const { orderId } = await createCheckout(input, randomUUID(), { transparent: true });
    vi.mocked(pixou.createPixoupayCharge).mockResolvedValueOnce(charge());
    await createPixPayment(orderId);
    vi.mocked(pixou.getPixoupayTransaction).mockResolvedValueOnce(charge({ status: "pending" }));
    await hook(PAY_ID);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PENDING");
  });

  it("ignora ids que não foram criados por este site", async () => {
    const res = await hook(randomUUID());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ processed: false });
    expect(pixou.getPixoupayTransaction).not.toHaveBeenCalled();
  });

  it("valor divergente nunca aprova; pago nunca volta para pendente", async () => {
    const { orderId } = await createCheckout(input, randomUUID(), { transparent: true });
    vi.mocked(pixou.createPixoupayCharge).mockResolvedValueOnce(charge());
    await createPixPayment(orderId);
    vi.mocked(pixou.getPixoupayTransaction).mockResolvedValueOnce(charge({ status: "paid", total_amount: 100 }));
    await hook(PAY_ID);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PENDING");

    vi.mocked(pixou.getPixoupayTransaction).mockResolvedValueOnce(charge({ status: "paid" }));
    await hook(PAY_ID);
    vi.mocked(pixou.getPixoupayTransaction).mockResolvedValueOnce(charge({ status: "pending" }));
    await hook(PAY_ID);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("APPROVED");
  });
});
