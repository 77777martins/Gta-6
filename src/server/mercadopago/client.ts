import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";

/**
 * Cliente HTTP mínimo da API REST do Mercado Pago.
 *
 * Decisão: usar fetch nativo em vez do SDK oficial — são só 2 endpoints,
 * o contrato fica explícito e validado com Zod, e evitamos uma dependência.
 * A URL base é FIXA (sem entrada do usuário), o que elimina risco de SSRF.
 */
const MP_API_BASE = "https://api.mercadopago.com";
const TIMEOUT_MS = 10_000;

export class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

async function mpRequest(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
  const { idempotencyKey, headers, ...rest } = init;
  const endpoint = path.split("/")[1];
  let response: Response;
  try {
    response = await fetch(`${MP_API_BASE}${path}`, {
      ...rest,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${env().MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
        ...headers,
      },
    });
  } catch (error) {
    // Timeout, DNS ou conexão recusada: tratado como indisponibilidade do provedor.
    const reason = error instanceof Error ? error.name : "unknown";
    throw new MercadoPagoError(`Falha de rede ao chamar Mercado Pago (${endpoint}: ${reason})`, 503);
  }

  if (!response.ok) {
    // O corpo de erro não é propagado ao cliente; apenas o status vai para o log.
    throw new MercadoPagoError(`Mercado Pago respondeu ${response.status} em ${endpoint}`, response.status);
  }
  return response.json() as Promise<unknown>;
}

// ---------- Preferências (Checkout Pro) ----------

export type CreatePreferenceInput = {
  orderId: string;
  item: { id: string; title: string; unitPriceCents: number; currency: string };
  payer: { name: string; email: string; cpf: string };
};

const preferenceResponseSchema = z.object({
  id: z.string().min(1),
  init_point: z.string().url(),
});

export async function createPreference(input: CreatePreferenceInput) {
  const { APP_URL, MERCADOPAGO_MAX_INSTALLMENTS, MERCADOPAGO_STATEMENT_DESCRIPTOR } = env();
  const [firstName = "", ...rest] = input.payer.name.split(/\s+/);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const body = {
    external_reference: input.orderId,
    items: [
      {
        id: input.item.id,
        title: input.item.title,
        quantity: 1,
        currency_id: input.item.currency,
        unit_price: input.item.unitPriceCents / 100,
        category_id: "games",
      },
    ],
    payer: {
      name: firstName,
      surname: rest.join(" "),
      email: input.payer.email,
      identification: { type: "CPF", number: input.payer.cpf },
    },
    // Apenas PIX (bank_transfer) e cartão de crédito.
    payment_methods: {
      excluded_payment_types: [{ id: "ticket" }, { id: "atm" }, { id: "debit_card" }, { id: "prepaid_card" }],
      installments: MERCADOPAGO_MAX_INSTALLMENTS,
    },
    back_urls: {
      success: `${APP_URL}/pagamento/aprovado`,
      pending: `${APP_URL}/pagamento/pendente`,
      failure: `${APP_URL}/pagamento/recusado`,
    },
    auto_return: "approved",
    statement_descriptor: MERCADOPAGO_STATEMENT_DESCRIPTOR,
    expires: true,
    expiration_date_to: expiresAt.toISOString(),
    metadata: { order_id: input.orderId },
  };

  const json = await mpRequest("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify(body),
    // Mesmo pedido => mesma chave: retries não criam preferências duplicadas.
    idempotencyKey: `pref-${input.orderId}`,
  });

  const parsed = preferenceResponseSchema.safeParse(json);
  if (!parsed.success) throw new MercadoPagoError("Resposta inesperada ao criar preferência", 502);

  const checkoutUrl = new URL(parsed.data.init_point);
  if (checkoutUrl.protocol !== "https:" || !isMercadoPagoHost(checkoutUrl.hostname)) {
    throw new MercadoPagoError("URL de checkout fora do domínio do Mercado Pago", 502);
  }
  return { preferenceId: parsed.data.id, checkoutUrl: checkoutUrl.toString() };
}

export function isMercadoPagoHost(hostname: string): boolean {
  return /(^|\.)mercadopago\.com(\.[a-z]{2})?$/.test(hostname) || /(^|\.)mercadolibre\.com$/.test(hostname);
}

// ---------- Pagamentos ----------

const paymentSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  status: z.string(),
  status_detail: z.string().nullish(),
  external_reference: z.string().nullish(),
  transaction_amount: z.number(),
  currency_id: z.string(),
  payment_method_id: z.string().nullish(),
  payment_type_id: z.string().nullish(),
  date_approved: z.string().nullish(),
  date_last_updated: z.string().nullish(),
});

export type MercadoPagoPayment = z.infer<typeof paymentSchema>;

/** Consulta o pagamento direto na API: única fonte de verdade sobre o status. */
export async function getPayment(paymentId: string): Promise<MercadoPagoPayment> {
  if (!/^\d{1,32}$/.test(paymentId)) throw new MercadoPagoError("ID de pagamento inválido", 400);
  const json = await mpRequest(`/v1/payments/${paymentId}`, { method: "GET" });
  const parsed = paymentSchema.safeParse(json);
  if (!parsed.success) throw new MercadoPagoError("Resposta inesperada ao consultar pagamento", 502);
  return parsed.data;
}
