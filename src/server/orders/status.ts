import type { OrderStatus } from "@prisma/client";

/**
 * Deriva o status do pedido a partir de TODAS as tentativas de pagamento.
 * Regras:
 * - Pagamentos com valor/moeda divergentes nunca contam (possível fraude).
 * - Um pagamento aprovado vence tentativas recusadas anteriores.
 * - Estorno/chargeback só valem quando não existe outro pagamento aprovado.
 * - Sem pagamento válido, o pedido segue PENDING.
 */
export type PaymentSnapshot = { status: string; amountMatches: boolean };

const PENDING_STATUSES = new Set(["pending", "in_process", "authorized", "in_mediation"]);

export function deriveOrderStatus(payments: PaymentSnapshot[]): OrderStatus {
  const statuses = new Set(payments.filter((p) => p.amountMatches).map((p) => p.status));

  if (statuses.has("approved")) return "APPROVED";
  if (statuses.has("charged_back")) return "CHARGED_BACK";
  if (statuses.has("refunded")) return "REFUNDED";
  if ([...statuses].some((s) => PENDING_STATUSES.has(s))) return "PENDING";
  if (statuses.has("cancelled")) return "CANCELLED";
  if (statuses.has("rejected")) return "REJECTED";
  return "PENDING";
}

/**
 * Status em que o pedido ainda aceita (nova) tentativa de pagamento:
 * recusado ou PIX expirado podem tentar de novo; pago/estornado/contestado, não.
 */
export const PAYABLE_STATUSES: readonly OrderStatus[] = ["PENDING", "REJECTED", "CANCELLED"];

export function isPayable(status: OrderStatus): boolean {
  return PAYABLE_STATUSES.includes(status);
}

/** Rota de resultado correspondente a cada status. */
export type ResultSlug = "aprovado" | "pendente" | "recusado";

export function resultSlugFor(status: OrderStatus): ResultSlug {
  if (status === "APPROVED") return "aprovado";
  if (status === "PENDING") return "pendente";
  return "recusado";
}

/** Converte valor decimal da API (ex.: 299.9) em centavos sem erro de ponto flutuante. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
