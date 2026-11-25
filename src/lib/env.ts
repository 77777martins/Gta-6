import "server-only";
import { z } from "zod";

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
  SALES_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
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
  return process.env.SALES_ENABLED === "true";
}
