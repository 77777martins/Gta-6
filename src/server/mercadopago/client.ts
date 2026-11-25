import "server-only";
import { MercadoPagoConfig, MercadoPagoError, MPConnectionError, Payment, Preference } from "mercadopago";
import { createHash } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";

/**
 * Integração com o SDK oficial do Mercado Pago (somente servidor).
 *
 * As respostas são revalidadas com Zod: o restante do sistema depende apenas
 * dos campos que realmente usa, não da forma completa da API.
 */
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

let config: MercadoPagoConfig | undefined;

function mpConfig(): MercadoPagoConfig {
  config ??= new MercadoPagoConfig({
    accessToken: env().MERCADOPAGO_ACCESS_TOKEN,
    options: { timeout: 10_000, maxRetries: 2 },
  });
  return config;
}

/** Converte qualquer falha do SDK num erro único, sem vazar o corpo da resposta. */
function toProviderError(operation: string, error: unknown): PaymentProviderError {
  if (error instanceof PaymentProviderError) return error;
  if (error instanceof MPConnectionError) {
    return new PaymentProviderError(`Mercado Pago ${operation}: falha de conexão/timeout`, 503);
  }
  if (error instanceof MercadoPagoError) {
    return new PaymentProviderError(`Mercado Pago ${operation}: HTTP ${error.status}`, error.status || 503);
  }
  const name = error instanceof Error ? error.name : "unknown";
  return new PaymentProviderError(`Mercado Pago ${operation}: falha de rede (${name})`, 503);
}

/** Impressão digital da credencial atual (SHA-256 truncado; nunca o token em si). */
export function credentialFingerprint(): string {
  return createHash("sha256").update(env().MERCADOPAGO_ACCESS_TOKEN).digest("hex").slice(0, 16);
}

export function isMercadoPagoHost(hostname: string): boolean {
  return /(^|\.)mercadopago\.com(\.[a-z]{2})?$/.test(hostname) || /(^|\.)mercadolibre\.com$/.test(hostname);
}

// ---------- Preferência (Checkout Pro) ----------

export type CreatePreferenceInput = {
  orderId: string;
  item: { id: string; title: string; unitPriceCents: number; currency: string };
  payer: { name: string; email: string; cpf: string; phone?: string | null };
};

const preferenceSchema = z.object({ id: z.string().min(1), init_point: z.string().url() });

export async function createPreference(input: CreatePreferenceInput) {
  const { APP_URL, MERCADOPAGO_MAX_INSTALLMENTS, MERCADOPAGO_STATEMENT_DESCRIPTOR } = env();
  const [firstName = "", ...rest] = input.payer.name.split(/\s+/);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  let response: unknown;
  try {
    response = await new Preference(mpConfig()).create({
      body: {
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
          ...(input.payer.phone
            ? { phone: { area_code: input.payer.phone.slice(0, 2), number: input.payer.phone.slice(2) } }
            : {}),
        },
        // Somente PIX (bank_transfer) e cartão de crédito.
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
      },
      // Mesmo pedido + mesma credencial => mesma chave: retries não duplicam preferências.
      requestOptions: { idempotencyKey: `pref-${input.orderId}-${credentialFingerprint()}` },
    });
  } catch (error) {
    throw toProviderError("criar preferência", error);
  }

  const parsed = preferenceSchema.safeParse(response);
  if (!parsed.success) throw new PaymentProviderError("Resposta inesperada ao criar preferência", 502);

  const checkoutUrl = new URL(parsed.data.init_point);
  if (checkoutUrl.protocol !== "https:" || !isMercadoPagoHost(checkoutUrl.hostname)) {
    throw new PaymentProviderError("URL de checkout fora do domínio do Mercado Pago", 502);
  }
  return {
    preferenceId: parsed.data.id,
    checkoutUrl: checkoutUrl.toString(),
    credentialFp: credentialFingerprint(),
  };
}

// ---------- Pagamento ----------

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
  date_of_expiration: z.string().nullish(),
  point_of_interaction: z
    .object({
      transaction_data: z
        .object({
          qr_code: z.string().nullish(),
          qr_code_base64: z.string().nullish(),
          ticket_url: z.string().nullish(),
        })
        .nullish(),
    })
    .nullish(),
});

export type MercadoPagoPayment = z.infer<typeof paymentSchema>;

/** Consulta o pagamento direto no Mercado Pago: única fonte de verdade sobre o status. */
export async function getPayment(paymentId: string): Promise<MercadoPagoPayment> {
  if (!/^\d{1,32}$/.test(paymentId)) throw new PaymentProviderError("ID de pagamento inválido", 400);

  let response: unknown;
  try {
    response = await new Payment(mpConfig()).get({ id: paymentId });
  } catch (error) {
    throw toProviderError("consultar pagamento", error);
  }

  const parsed = paymentSchema.safeParse(response);
  if (!parsed.success) throw new PaymentProviderError("Resposta inesperada ao consultar pagamento", 502);
  return parsed.data;
}

// ---------- Criação de pagamento (Checkout Transparente) ----------

export type CreatePaymentBody = NonNullable<Parameters<Payment["create"]>[0]>["body"];

/**
 * Cria um pagamento direto (PIX ou cartão tokenizado). A chave de idempotência
 * garante que um retry da mesma tentativa não gere cobrança duplicada.
 */
export async function createPayment(body: CreatePaymentBody, idempotencyKey: string): Promise<MercadoPagoPayment> {
  let response: unknown;
  try {
    response = await new Payment(mpConfig()).create({ body, requestOptions: { idempotencyKey } });
  } catch (error) {
    throw toProviderError("criar pagamento", error);
  }
  const parsed = paymentSchema.safeParse(response);
  if (!parsed.success) throw new PaymentProviderError("Resposta inesperada ao criar pagamento", 502);
  return parsed.data;
}
