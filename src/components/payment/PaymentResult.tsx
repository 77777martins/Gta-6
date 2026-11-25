import type { OrderStatus } from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatCents } from "@/lib/format";
import type { PublicOrderView } from "@/server/orders/service";
import { AlertIcon, CheckIcon, ClockIcon } from "../icons";
import { WhatsAppButton } from "../WhatsAppButton";
import { StatusPoller } from "./StatusPoller";

type Tone = "success" | "warning" | "danger";

const CONTENT: Record<OrderStatus | "UNKNOWN", { tone: Tone; title: string; text: (email?: string) => string }> = {
  APPROVED: {
    tone: "success",
    title: "Pagamento aprovado!",
    text: (email) => `Seu pedido está confirmado. O código de ativação será enviado para ${email ?? "o seu e-mail"}.`,
  },
  PENDING: {
    tone: "warning",
    title: "Pagamento pendente",
    text: () =>
      "Estamos aguardando a confirmação do Mercado Pago. Se você pagou com PIX, a confirmação costuma ser rápida e esta página atualiza sozinha.",
  },
  REJECTED: {
    tone: "danger",
    title: "Pagamento recusado",
    text: () => "O pagamento não foi aprovado e nenhum valor foi cobrado. Você pode tentar novamente com outro meio de pagamento.",
  },
  CANCELLED: {
    tone: "danger",
    title: "Pagamento cancelado",
    text: () => "Este pagamento foi cancelado ou expirou. Você pode iniciar uma nova compra quando quiser.",
  },
  REFUNDED: {
    tone: "danger",
    title: "Pagamento estornado",
    text: () => "O valor deste pedido foi estornado. Em caso de dúvidas, fale com o atendimento.",
  },
  CHARGED_BACK: {
    tone: "danger",
    title: "Pagamento contestado",
    text: () => "Este pagamento foi contestado junto à operadora. Fale com o atendimento para mais detalhes.",
  },
  UNKNOWN: {
    tone: "warning",
    title: "Não encontramos este pedido",
    text: () => "Se você concluiu um pagamento, aguarde alguns minutos e confira seu e-mail ou fale com o atendimento.",
  },
};

const TONE: Record<Tone, { ring: string; icon: ReactNode }> = {
  success: { ring: "bg-emerald-500/15 text-emerald-400", icon: <CheckIcon width={32} height={32} /> },
  warning: { ring: "bg-gold/15 text-gold", icon: <ClockIcon width={32} height={32} /> },
  danger: { ring: "bg-blood/15 text-blood", icon: <AlertIcon width={32} height={32} /> },
};

export function PaymentResult({ order }: { order: PublicOrderView | null }) {
  const content = CONTENT[order?.status ?? "UNKNOWN"];
  const tone = TONE[content.tone];
  const canRetry = order && order.status !== "APPROVED" && order.status !== "PENDING";

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-ink px-4 py-16">
      <div className="w-full max-w-lg animate-rise rounded-2xl border border-line bg-ink-2 p-8 text-center">
        <span className={`mx-auto inline-flex size-16 items-center justify-center rounded-full ${tone.ring}`}>{tone.icon}</span>
        <h1 className="mt-5 text-2xl font-black uppercase sm:text-3xl">{content.title}</h1>
        <p className="mt-3 text-zinc-400">{content.text(order?.emailMasked)}</p>

        {order && (
          <dl className="mt-6 space-y-2 rounded-lg border border-line bg-ink p-4 text-left text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Pedido</dt>
              <dd className="font-mono">{order.id.slice(0, 8).toUpperCase()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Produto</dt>
              <dd className="text-right">{order.productName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Total</dt>
              <dd className="font-semibold text-gold">{formatCents(order.totalCents)}</dd>
            </div>
          </dl>
        )}

        {order?.status === "PENDING" && <StatusPoller orderId={order.id} />}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {canRetry && (
            <Link href="/#comprar" className="btn-primary">
              Tentar novamente
            </Link>
          )}
          <Link href="/" className="inline-flex items-center justify-center rounded-md border border-line px-6 py-4 text-sm font-bold uppercase tracking-widest transition hover:border-gold hover:text-gold">
            Voltar ao início
          </Link>
        </div>
      </div>
      <WhatsAppButton message={order ? `Olá! Preciso de ajuda com o pedido ${order.id.slice(0, 8).toUpperCase()}.` : undefined} />
    </main>
  );
}
