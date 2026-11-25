import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { clientIp, jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { paymentIdSchema } from "@/lib/validation/checkout";
import { verifyWebhookSignature } from "@/server/mercadopago/signature";
import { syncPayment } from "@/server/orders/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook do Mercado Pago (configurado no painel: Suas integrações > Webhooks,
 * evento "Pagamentos").
 *
 * 1. Valida a assinatura HMAC (x-signature) — sem ela, 401.
 * 2. NÃO confia no corpo: consulta o pagamento na API do MP (syncPayment).
 * 3. Processamento idempotente: reentregas e replays são inofensivos.
 * 4. Responde 5xx em falha transitória para o MP reenviar.
 */
export async function POST(request: NextRequest) {
  const limit = rateLimit(`webhook:${clientIp(request.headers)}`, 300, 60 * 1000);
  if (!limit.ok) return jsonError(429, "rate limited");

  const url = request.nextUrl;
  const dataId = url.searchParams.get("data.id");
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic");

  const valid = verifyWebhookSignature({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
    secret: env().MERCADOPAGO_WEBHOOK_SECRET,
  });
  if (!valid) {
    logger.warn("webhook.invalid_signature", { ip: clientIp(request.headers), type });
    return jsonError(401, "invalid signature");
  }

  if (type !== "payment") return NextResponse.json({ ignored: true });

  const paymentId = paymentIdSchema.safeParse(dataId);
  if (!paymentId.success) return jsonError(400, "invalid payment id");

  try {
    const status = await syncPayment(paymentId.data);
    return NextResponse.json({ received: true, processed: status !== null });
  } catch (error) {
    logger.error("webhook.processing_failed", { paymentId: paymentId.data, error });
    return jsonError(500, "processing failed");
  }
}
