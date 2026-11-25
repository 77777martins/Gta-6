"use client";

import { useState } from "react";
import { CardPanel } from "./CardPanel";
import { PixPanel } from "./PixPanel";

type Props = {
  orderId: string;
  /** Sem Public Key do Mercado Pago, só o PIX é oferecido. */
  publicKey: string | null;
  email: string;
  maxInstallments: number;
  onBack: () => void;
};

type Method = "pix" | "card";

/** Etapa de pagamento dentro do site: abas PIX e cartão de crédito. */
export function TransparentPayment({ orderId, publicKey, email, maxInstallments, onBack }: Props) {
  const [method, setMethod] = useState<Method>("pix");

  const tab = (id: Method, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={method === id}
      aria-controls={`panel-${id}`}
      onClick={() => setMethod(id)}
      className={`flex-1 rounded-md px-4 py-3 text-sm font-bold uppercase tracking-wider transition ${
        method === id ? "bg-gold text-ink" : "text-zinc-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-xl border border-line bg-ink-2 p-6 sm:p-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-lg font-black uppercase">Pagamento</h3>
        <button type="button" onClick={onBack} className="text-sm text-gold underline underline-offset-2">
          Alterar dados
        </button>
      </div>

      {publicKey ? (
        <div role="tablist" aria-label="Forma de pagamento" className="mb-6 flex gap-2 rounded-lg border border-line bg-ink p-1">
          {tab("pix", "PIX")}
          {tab("card", "Cartão de crédito")}
        </div>
      ) : (
        <p className="mb-6 text-sm font-semibold uppercase tracking-wider text-gold">Pagamento via PIX</p>
      )}

      <div id={`panel-${method}`} role="tabpanel">
        {method === "pix" || !publicKey ? (
          <PixPanel orderId={orderId} />
        ) : (
          <CardPanel orderId={orderId} publicKey={publicKey} email={email} maxInstallments={maxInstallments} />
        )}
      </div>
    </div>
  );
}
