import type { OrderStatus } from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatCents, formatDateTime, formatOrderNumber } from "@/lib/format";
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

const PAYMENT_LABEL: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão de crédito",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

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
            <Row label="Nº do pedido">
              <span className="font-mono font-semibold">{formatOrderNumber(order.id)}</span>
            </Row>
            <Row label="Data do pedido">{formatDateTime(order.createdAt)}</Row>
            {order.paidAt && <Row label="Pagamento confirmado">{formatDateTime(order.paidAt)}</Row>}
            {order.paymentType && (
              <Row label="Forma de pagamento">{PAYMENT_LABEL[order.paymentType] ?? "Mercado Pago"}</Row>
            )}
            <Row label="Produto">{order.productName}</Row>
            <Row label="Total">
              <span className="font-semibold text-gold">{formatCents(order.totalCents)}</span>
            </Row>
            <p className="pt-1 text-xs text-zinc-600">Horário de Brasília.</p>
          </dl>
        )}

        {order?.status === "APPROVED" && (
          <ol className="mt-5 space-y-1 text-left text-sm text-zinc-400">
            <li>1. Guarde o número do pedido acima.</li>
            <li>2. Acompanhe seu e-mail (verifique também o spam/lixo eletrônico).</li>
            <li>3. Dúvidas? Fale com o atendimento pelo WhatsApp informando o número do pedido.</li>
          </ol>
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
      <WhatsAppButton message={order ? `Olá! Preciso de ajuda com o pedido ${formatOrderNumber(order.id)}.` : undefined} />
    </main>
  );
}
