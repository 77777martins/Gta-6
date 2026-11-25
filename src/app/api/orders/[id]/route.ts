import { NextResponse, type NextRequest } from "next/server";
import { clientIp, jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { orderIdSchema } from "@/lib/validation/checkout";
import { getPublicOrder, refreshPendingOrder } from "@/server/orders/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Status público do pedido, usado pela página "pendente" para acompanhar o PIX.
 * O ID é um UUID v4 aleatório (não enumerável) e a resposta não contém dados pessoais.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limit = rateLimit(`order-status:${clientIp(request.headers)}`, 60, 60 * 1000);
  if (!limit.ok) return jsonError(429, "Muitas consultas. Aguarde um instante.");

  const id = orderIdSchema.safeParse((await params).id);
  if (!id.success) return jsonError(404, "Pedido não encontrado.");

  try {
    await refreshPendingOrder(id.data);
  } catch (error) {
    // Falha na consulta ao MP não impede responder com o status já salvo.
    logger.warn("order_status.refresh_failed", { orderId: id.data, error });
  }

  const order = await getPublicOrder(id.data);
  if (!order) return jsonError(404, "Pedido não encontrado.");
  return NextResponse.json({ status: order.status }, { headers: { "Cache-Control": "no-store" } });
}
