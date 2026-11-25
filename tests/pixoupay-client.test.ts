import { afterEach, describe, expect, it, vi } from "vitest";

process.env.APP_URL = "http://localhost:3000";
process.env.DATABASE_URL = "postgresql://x:y@localhost:5432/z";
process.env.PIXOUPAY_SECRET_TOKEN = "sk_test_1234567890";

const { createPixoupayCharge, getPixoupayTransaction, normalizePixoupayStatus } = await import("@/server/pixoupay/client");

afterEach(() => vi.unstubAllGlobals());

describe("cliente Pixoupay", () => {
  it("envia a cobrança conforme a documentação (centavos, Bearer, telefone com 55)", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            id: "390b5525-4629-4463-a32a-e0cd432d939b",
            status: "pending",
            payment_method: "pix",
            pix: { code: "00020126870014br.gov.bcb.pix", qrcode_base64: "iVBORw0KGgo=" },
            total_amount: 29990,
            net_amount: 28000,
            created_at: "2026-11-25T17:45:19.084Z",
          },
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const charge = await createPixoupayCharge({
      externalId: "pedido_1",
      amountCents: 29990,
      buyer: { name: "Maria da Silva", email: "m@e.com", document: "52998224725", phone: "11912345678" },
      productName: "GTA VI",
      postbackUrl: "https://site/api/webhooks/pixoupay?token=abc",
    });

    expect(charge.pix.code).toContain("br.gov.bcb.pix");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.pixoupay.com/charge");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_1234567890");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ external_id: "pedido_1", payment_method: "pix", amount: 29990 });
    expect(body.buyer.phone).toBe("5511912345678");
  });

  it("aceita QR Code com prefixo data URI e valor decimal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: {
      id: "390b5525-4629-4463-a32a-e0cd432d939b", status: "pending",
      pix: { code: "00020126870014br.gov.bcb.pix", qrcode_base64: "data:image/png;base64,iVBORw0KGgo=" },
      total_amount: 29990.0,
    } }), { status: 201 })));
    const charge = await createPixoupayCharge({ externalId: "p_1", amountCents: 29990, buyer: { name: "Maria da Silva", email: "m@e.com", document: "52998224725" }, productName: "GTA VI" });
    expect(charge.pix.qrcode_base64).toBe("iVBORw0KGgo=");
    expect(charge.total_amount).toBe(29990);
  });

  it("transforma erro HTTP em erro de provedor sem vazar o corpo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "account_status_blocked", detail: "x" } }), { status: 403 })));
    await expect(getPixoupayTransaction("390b5525-4629-4463-a32a-e0cd432d939b")).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("account_status_blocked"),
    });
  });

  it("rejeita resposta fora do formato documentado", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { id: "x", status: "weird" } }), { status: 200 })));
    await expect(getPixoupayTransaction("390b5525-4629-4463-a32a-e0cd432d939b")).rejects.toMatchObject({ status: 502 });
  });

  it("normaliza os status", () => {
    expect(normalizePixoupayStatus("paid")).toBe("approved");
    expect(normalizePixoupayStatus("pending")).toBe("pending");
    expect(normalizePixoupayStatus("expired")).toBe("cancelled");
    expect(normalizePixoupayStatus("cancelled")).toBe("cancelled");
  });
});
