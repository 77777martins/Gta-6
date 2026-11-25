import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { clientIp, jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { syncPixoupayPayment } from "@/server/orders/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  event: z.string().max(64),
  data: z.object({ id: z.string().uuid() }),
});

function tokenMatches(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhook do Pixoupay. A documentação informa que NÃO há assinatura HMAC, então:
 * 1. Exige um token secreto na URL (PIXOUPAY_WEBHOOK_TOKEN), comparado em tempo constante.
 * 2. NUNCA confia no conteúdo: usa só o id e confirma o status na API do Pixoupay.
 * 3. Só aceita ids de cobranças criadas por este site (registradas no banco).
 */
export async function POST(request: NextRequest) {
  const limit = rateLimit(`webhook-pixoupay:${clientIp(request.headers)}`, 300, 60 * 1000);
  if (!limit.ok) return jsonError(429, "rate limited");

  const expected = env().PIXOUPAY_WEBHOOK_TOKEN;
  if (!expected) return jsonError(503, "webhook not configured");
  if (!tokenMatches(request.nextUrl.searchParams.get("token"), expected)) {
    logger.warn("pixoupay.webhook.invalid_token", { ip: clientIp(request.headers) });
    return jsonError(401, "unauthorized");
  }

  const raw = await request.text();
  if (raw.length > 16 * 1024) return jsonError(413, "payload too large");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, "invalid json");
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "invalid payload");

  try {
    const status = await syncPixoupayPayment(parsed.data.data.id);
    return NextResponse.json({ received: true, processed: status !== null });
  } catch (error) {
    logger.error("pixoupay.webhook.processing_failed", { paymentId: parsed.data.data.id, error });
    return jsonError(500, "processing failed");
  }
}
