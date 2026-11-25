import { PLATFORMS, PRODUCT, type PlatformId } from "@/config/product";
import { formatCents } from "@/lib/format";
import { LockIcon } from "../icons";

export function OrderSummary({ platform }: { platform?: PlatformId }) {
  return (
    <aside aria-labelledby="resumo" className="rounded-xl border border-gold/30 bg-ink-2 p-6 lg:sticky lg:top-6">
      <h3 id="resumo" className="text-sm font-bold uppercase tracking-[0.25em] text-gold">
        Resumo do pedido
      </h3>
      <div className="mt-5 flex items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="font-semibold">{PRODUCT.name}</p>
          <p className="mt-1 text-sm text-zinc-400">
            Plataforma: {platform ? PLATFORMS[platform].label : <span className="text-zinc-500">selecione</span>}
          </p>
          <p className="text-sm text-zinc-400">Quantidade: 1</p>
        </div>
        <p className="whitespace-nowrap font-semibold">{formatCents(PRODUCT.priceCents)}</p>
      </div>
      <dl className="mt-5 space-y-2 text-sm">
        <div className="flex justify-between text-zinc-400">
          <dt>Subtotal</dt>
          <dd>{formatCents(PRODUCT.priceCents)}</dd>
        </div>
        <div className="flex justify-between text-zinc-400">
          <dt>Entrega digital</dt>
          <dd>Grátis</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <dt className="font-bold uppercase tracking-wider">Total</dt>
          <dd className="text-2xl font-black text-gold">{formatCents(PRODUCT.priceCents)}</dd>
        </div>
      </dl>
      <p className="mt-5 flex items-center gap-2 text-xs text-zinc-500">
        <LockIcon width={16} height={16} /> Pagamento processado pelo Mercado Pago (PIX ou cartão de crédito).
      </p>
    </aside>
  );
}
