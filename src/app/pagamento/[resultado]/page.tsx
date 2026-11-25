import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PaymentResult } from "@/components/payment/PaymentResult";
import { clientIp } from "@/lib/http";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { orderIdSchema, paymentIdSchema } from "@/lib/validation/checkout";
import { resultSlugFor, type ResultSlug } from "@/server/orders/status";
import { getPublicOrder, syncPayment } from "@/server/orders/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Status do pagamento", robots: { index: false, follow: false } };

const SLUGS: readonly ResultSlug[] = ["aprovado", "pendente", "recusado"];

type Props = {
  params: Promise<{ resultado: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Página de retorno do Checkout Pro (back_urls).
 * Os parâmetros da URL NÃO determinam o resultado: servem apenas para localizar
 * o pedido e o pagamento, cujo status real é consultado na API do Mercado Pago
 * e lido do banco. Se o usuário cair na rota "errada", é redirecionado.
 */
export default async function PaymentResultPage({ params, searchParams }: Props) {
  const { resultado } = await params;
  if (!SLUGS.includes(resultado as ResultSlug)) notFound();

  const query = await searchParams;
  const orderId = orderIdSchema.safeParse(first(query.external_reference));
  if (!orderId.success) return <PaymentResult order={null} />;

  const paymentId = paymentIdSchema.safeParse(first(query.payment_id) ?? first(query.collection_id));
  if (paymentId.success) {
    const limit = rateLimit(`result-sync:${clientIp(await headers())}`, 20, 60 * 1000);
    if (limit.ok) {
      try {
        await syncPayment(paymentId.data);
      } catch (error) {
        // O webhook continua sendo a fonte principal; aqui é apenas aceleração.
        logger.warn("result_page.sync_failed", { paymentId: paymentId.data, error });
      }
    }
  }

  const order = await getPublicOrder(orderId.data);
  if (!order) return <PaymentResult order={null} />;

  const expected = resultSlugFor(order.status);
  if (expected !== resultado) redirect(`/pagamento/${expected}?external_reference=${order.id}`);

  return <PaymentResult order={order} />;
}
