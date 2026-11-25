import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/http";
import { cardPaymentSchema } from "@/lib/validation/card-payment";
import { idempotencyKeySchema } from "@/lib/validation/checkout";
import { guardPaymentRequest, paymentErrorResponse } from "@/server/http/payment-route";
import { createCardPayment } from "@/server/orders/transparent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024;

/** Processa o pagamento com cartão tokenizado pelo Card Payment Brick. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardPaymentRequest(request, params, "card");
  if ("error" in guard) return guard.error;

  // Uma chave por tentativa: retry de rede da MESMA tentativa não cobra duas vezes.
  const attemptKey = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
  if (!attemptKey.success) return jsonError(400, "Requisição inválida.");

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return jsonError(413, "Requisição muito grande.");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, "JSON inválido.");
  }
  const parsed = cardPaymentSchema.safeParse(body);
  if (!parsed.success) return jsonError(422, "Dados do cartão inválidos. Revise e tente novamente.");

  try {
    const result = await createCardPayment(guard.orderId, parsed.data, attemptKey.data);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return paymentErrorResponse(error, { orderId: guard.orderId, method: "card" });
  }
}
