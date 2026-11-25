import { NextResponse, type NextRequest } from "next/server";
import { guardPaymentRequest, paymentErrorResponse } from "@/server/http/payment-route";
import { createPixPayment } from "@/server/orders/transparent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Gera (ou reaproveita) o QR Code PIX do pedido. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardPaymentRequest(request, params, "pix");
  if ("error" in guard) return guard.error;

  try {
    const pix = await createPixPayment(guard.orderId);
    return NextResponse.json(pix, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return paymentErrorResponse(error, { orderId: guard.orderId, method: "pix" });
  }
}
