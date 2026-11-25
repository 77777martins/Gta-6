import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { clientIp, isSameOrigin, jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { checkoutSchema, idempotencyKeySchema } from "@/lib/validation/checkout";
import { PaymentProviderError } from "@/server/mercadopago/client";
import { IdempotencyConflictError, SalesClosedError } from "@/server/orders/errors";
import { createCheckout } from "@/server/orders/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024;

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers, env().APP_URL)) return jsonError(403, "Origem não permitida.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return jsonError(415, "Content-Type deve ser application/json.");
  }

  const limit = rateLimit(`checkout:${clientIp(request.headers)}`, 10, 10 * 60 * 1000);
  if (!limit.ok) {
    return jsonError(429, "Muitas tentativas. Aguarde alguns minutos.", {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const idempotencyKey = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
  if (!idempotencyKey.success) return jsonError(400, "Requisição inválida.");

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return jsonError(413, "Requisição muito grande.");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, "JSON inválido.");
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Verifique os dados informados.", fields: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  try {
    const result = await createCheckout(parsed.data, idempotencyKey.data);
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SalesClosedError) {
      return jsonError(503, "As vendas ainda não estão abertas. Fale com o atendimento para mais informações.");
    }
    if (error instanceof IdempotencyConflictError) {
      return jsonError(409, "Este pedido já foi processado. Recarregue a página para iniciar uma nova compra.");
    }
    if (error instanceof PaymentProviderError) {
      logger.error("checkout.mercadopago_error", { status: error.status, error });
      return jsonError(502, "Não foi possível iniciar o pagamento agora. Tente novamente em instantes.");
    }
    logger.error("checkout.unexpected_error", { error });
    return jsonError(500, "Erro inesperado. Tente novamente.");
  }
}
