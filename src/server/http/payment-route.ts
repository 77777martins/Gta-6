import "server-only";
import type { NextRequest } from "next/server";
import { env, isTransparentCheckout } from "@/lib/env";
import { clientIp, isSameOrigin, jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { orderIdSchema } from "@/lib/validation/checkout";
import { PaymentProviderError } from "@/server/mercadopago/client";
import { OrderNotPayableError, PaymentInputError, SalesClosedError } from "@/server/orders/errors";

/**
 * Proteções comuns às rotas de pagamento (PIX e cartão):
 * modo transparente ativo, vendas abertas, mesma origem, JSON, rate limit e id válido.
 * Retorna o id do pedido ou uma resposta de erro pronta.
 */
export async function guardPaymentRequest(
  request: NextRequest,
  params: Promise<{ id: string }>,
  bucket: string,
): Promise<{ orderId: string } | { error: Response }> {
  if (!isTransparentCheckout()) return { error: jsonError(404, "Não encontrado.") };
  if (!env().SALES_ENABLED) return { error: jsonError(503, "As vendas ainda não estão abertas.") };
  if (!isSameOrigin(request.headers, env().APP_URL)) return { error: jsonError(403, "Origem não permitida.") };
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return { error: jsonError(415, "Content-Type deve ser application/json.") };
  }
  const limit = rateLimit(`${bucket}:${clientIp(request.headers)}`, 10, 10 * 60 * 1000);
  if (!limit.ok) {
    return {
      error: jsonError(429, "Muitas tentativas. Aguarde alguns minutos.", {
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }),
    };
  }
  const id = orderIdSchema.safeParse((await params).id);
  if (!id.success) return { error: jsonError(404, "Pedido não encontrado.") };
  return { orderId: id.data };
}

/** Converte erros de domínio em respostas HTTP amigáveis, sem vazar detalhes internos. */
export function paymentErrorResponse(error: unknown, context: Record<string, unknown>): Response {
  if (error instanceof SalesClosedError) return jsonError(503, "As vendas ainda não estão abertas.");
  if (error instanceof OrderNotPayableError) {
    if (error.reason === "not_found") return jsonError(404, "Pedido não encontrado.");
    if (error.reason === "in_process") {
      return jsonError(409, "Já existe um pagamento em análise para este pedido. Aguarde a confirmação.");
    }
    return jsonError(409, "Este pedido não aceita mais pagamento. Recarregue a página para iniciar uma nova compra.");
  }
  if (error instanceof PaymentInputError) return jsonError(422, error.message);
  if (error instanceof PaymentProviderError) {
    logger.error("payment.provider_error", { ...context, status: error.status, error });
    return jsonError(502, "Não foi possível processar o pagamento agora. Tente novamente em instantes.");
  }
  logger.error("payment.unexpected_error", { ...context, error });
  return jsonError(500, "Erro inesperado. Tente novamente.");
}
