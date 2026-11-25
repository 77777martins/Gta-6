import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { PaymentProviderError } from "@/server/payments/errors";

/**
 * Cliente da API do Pixoupay (somente PIX).
 * Documentação: https://www.pixoupay.com/apidocumentacao
 *   POST /charge       — cria cobrança PIX (valores em centavos)
 *   GET  /transaction  — consulta status (pending | paid | expired | cancelled)
 * URL base fixa (sem entrada do usuário) e respostas validadas com Zod.
 */
const BASE_URL = "https://api.pixoupay.com";
const TIMEOUT_MS = 10_000;

function token(): string {
  const value = env().PIXOUPAY_SECRET_TOKEN;
  if (!value) throw new PaymentProviderError("Pixoupay não configurado (PIXOUPAY_SECRET_TOKEN)", 503);
  return value;
}

async function request(path: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...init.headers },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown";
    throw new PaymentProviderError(`Pixoupay ${path}: falha de conexão (${reason})`, 503);
  }
  const json = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    // Só a mensagem curta de erro vai para o log; nunca o corpo inteiro.
    // O "detail" ajuda o suporte do Pixoupay a diagnosticar; é truncado e sem dados do comprador.
    const parsed = z
      .object({ error: z.object({ message: z.string(), detail: z.unknown().optional() }) })
      .safeParse(json);
    const detail = parsed.success && parsed.data.error.detail !== undefined
      ? ` — ${JSON.stringify(parsed.data.error.detail).slice(0, 300)}`
      : "";
    throw new PaymentProviderError(
      `Pixoupay ${path}: HTTP ${response.status}${parsed.success ? ` (${parsed.data.error.message}${detail})` : ""}`,
      response.status,
    );
  }
  return json;
}

export const PIXOUPAY_STATUSES = ["pending", "paid", "expired", "cancelled"] as const;
export type PixoupayStatus = (typeof PIXOUPAY_STATUSES)[number];

const transactionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(PIXOUPAY_STATUSES),
  // Tolerante a valor decimal (ex.: 29990.0); arredonda para centavos inteiros.
  total_amount: z.number().nonnegative().transform((v) => Math.round(v)),
  created_at: z.string().nullish(),
});

/** Aceita base64 puro ou com prefixo "data:image/...;base64," (removido). */
const base64Image = z
  .string()
  .transform((v) => v.replace(/^data:image\/[a-z+]+;base64,/i, "").replace(/\s+/g, ""))
  .pipe(z.string().regex(/^[A-Za-z0-9+/=]+$/));

const chargeResponseSchema = z.object({
  data: transactionSchema.extend({
    pix: z.object({
      code: z.string().min(10),
      qrcode_base64: base64Image,
    }),
  }),
});

export type PixoupayCharge = z.infer<typeof chargeResponseSchema>["data"];
export type PixoupayTransaction = z.infer<typeof transactionSchema>;

export type CreateChargeInput = {
  externalId: string;
  amountCents: number;
  buyer: { name: string; email: string; document: string; phone?: string | null };
  productName: string;
  postbackUrl?: string;
};

export async function createPixoupayCharge(input: CreateChargeInput): Promise<PixoupayCharge> {
  const json = await request("/charge", {
    method: "POST",
    body: JSON.stringify({
      external_id: input.externalId,
      payment_method: "pix",
      amount: input.amountCents,
      buyer: {
        name: input.buyer.name.slice(0, 100),
        email: input.buyer.email,
        document: input.buyer.document,
        // A API espera 12-13 dígitos (com DDI 55).
        ...(input.buyer.phone ? { phone: `55${input.buyer.phone}` } : {}),
      },
      product: { name: input.productName },
      ...(input.postbackUrl ? { postbackUrl: input.postbackUrl } : {}),
    }),
  });
  const parsed = chargeResponseSchema.safeParse(json);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new PaymentProviderError(`Pixoupay /charge: resposta inesperada (campos: ${fields})`, 502);
  }
  return parsed.data.data;
}

export async function getPixoupayTransaction(id: string): Promise<PixoupayTransaction> {
  if (!z.string().uuid().safeParse(id).success) throw new PaymentProviderError("ID Pixoupay inválido", 400);
  const json = await request(`/transaction?id=${encodeURIComponent(id)}`, { method: "GET" });
  const parsed = z.object({ data: transactionSchema }).safeParse(json);
  if (!parsed.success) throw new PaymentProviderError("Pixoupay /transaction: resposta inesperada", 502);
  return parsed.data.data;
}

/** Converte o status do Pixoupay para o vocabulário interno (mesmo do Mercado Pago). */
export function normalizePixoupayStatus(status: PixoupayStatus): string {
  switch (status) {
    case "paid":
      return "approved";
    case "pending":
      return "pending";
    default:
      return "cancelled"; // expired | cancelled
  }
}
