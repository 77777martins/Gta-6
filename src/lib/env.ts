import "server-only";
import { z } from "zod";
import { PLATFORM_IDS, type PlatformId } from "@/config/product";
import { parseMercadoPagoPublicKey } from "@/lib/validation/mp-public-key";
import { sanitizePaymentLink } from "@/lib/validation/payment-link";

/**
 * Variáveis de ambiente validadas na primeira leitura. Falha cedo e de forma
 * explícita se algo obrigatório estiver ausente — nunca roda com config parcial.
 * Este módulo é server-only: segredos jamais chegam ao bundle do navegador.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  APP_URL: z
    .string()
    .url()
    .transform((v) => v.replace(/\/+$/, "")),
  // Tolerante a maiúsculas, espaços e aspas digitados no painel ("True", " true ").
  SALES_ENABLED: z
    .string()
    .optional()
    .transform((v) => parseBooleanFlag(v)),
  MERCADOPAGO_ACCESS_TOKEN: z.string().min(20),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(16),
  MERCADOPAGO_MAX_INSTALLMENTS: z.coerce.number().int().min(1).max(12).default(12),
  MERCADOPAGO_STATEMENT_DESCRIPTOR: z
    .string()
    .max(22)
    .regex(/^[A-Za-z0-9 ]*$/)
    .default("LOJA GAMES"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    // Mostra apenas os NOMES inválidos, nunca os valores.
    throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${fields}`);
  }
  const appUrl = new URL(parsed.data.APP_URL);
  const isLocalhost = ["localhost", "127.0.0.1"].includes(appUrl.hostname);
  if (parsed.data.NODE_ENV === "production" && appUrl.protocol !== "https:" && !isLocalhost) {
    throw new Error("APP_URL deve usar https em produção.");
  }
  cached = parsed.data;
  return cached;
}

/**
 * Leitura isolada da flag de vendas para a interface. Permite renderizar a
 * landing page mesmo sem as credenciais configuradas; a API de checkout
 * continua exigindo o env completo e validado.
 */
export function isSalesEnabled(): boolean {
  return parseBooleanFlag(process.env.SALES_ENABLED);
}

/** "true", "True", " TRUE ", "\"true\"" e "1" => true; qualquer outra coisa => false. */
export function parseBooleanFlag(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().replace(/^["']|["']$/g, "").trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

export type PaymentLinks = Partial<Record<PlatformId, string>>;

/**
 * Modo "link de pagamento": se houver links do Mercado Pago configurados, o site
 * redireciona para eles em vez de usar a integração via API.
 * - MERCADOPAGO_PAYMENT_LINK_PS5 / MERCADOPAGO_PAYMENT_LINK_XBOX_SERIES: um link por plataforma (recomendado)
 * - MERCADOPAGO_PAYMENT_LINK: link único, usado para plataformas sem link próprio
 * Retorna null quando nenhum link válido existe (modo integração completa).
 */
export function getPaymentLinks(): PaymentLinks | null {
  const fallback = sanitizePaymentLink(process.env.MERCADOPAGO_PAYMENT_LINK);
  const links: PaymentLinks = {};
  for (const id of PLATFORM_IDS) {
    const link = sanitizePaymentLink(process.env[`MERCADOPAGO_PAYMENT_LINK_${id}`]) ?? fallback;
    if (link) links[id] = link;
  }
  return Object.keys(links).length > 0 ? links : null;
}

/**
 * Checkout Transparente (pagamento dentro do site) fica ativo quando a Public Key
 * do Mercado Pago está configurada. Tem prioridade sobre os links de pagamento.
 */
export function getMercadoPagoPublicKey(): string | null {
  return parseMercadoPagoPublicKey(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY);
}

export function isTransparentCheckout(): boolean {
  return getMercadoPagoPublicKey() !== null;
}

/** Parcelas máximas para a interface (sem exigir o env completo). */
export function getMaxInstallments(): number {
  const n = Number.parseInt(process.env.MERCADOPAGO_MAX_INSTALLMENTS ?? "", 10);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : 12;
}
