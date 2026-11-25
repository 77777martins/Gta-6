"use client";

import { useState } from "react";
import { PLATFORMS, PLATFORM_IDS, type PlatformId } from "@/config/product";
import { trackThenNavigate } from "@/lib/analytics/pixels";
import { AlertIcon } from "../icons";
import { OrderSummary } from "./OrderSummary";

type Props = {
  salesEnabled: boolean;
  links: Partial<Record<PlatformId, string>>;
  supportText: string | null;
};

/**
 * Checkout simplificado: o cliente escolhe a plataforma e é levado ao link de
 * pagamento do Mercado Pago, que coleta nome, e-mail, CPF e processa PIX/cartão.
 */
export function PaymentLinkCheckout({ salesEnabled, links, supportText }: Props) {
  const available = PLATFORM_IDS.filter((id) => links[id]);
  const [platform, setPlatform] = useState<PlatformId | undefined>(available.length === 1 ? available[0] : undefined);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const sameLinkForAll = available.length > 1 && new Set(available.map((id) => links[id])).size === 1;

  function handleBuy() {
    setError(null);
    if (!platform) return setError("Selecione a plataforma.");
    if (!accepted) return setError("É necessário aceitar as condições de compra.");
    const link = links[platform];
    if (!link) return setError("Plataforma indisponível no momento.");
    setRedirecting(true);
    trackThenNavigate(link, PLATFORMS[platform].label);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="rounded-xl border border-line bg-ink-2 p-6 sm:p-8">
        {!salesEnabled && (
          <div role="status" className="mb-6 flex gap-3 rounded-lg border border-gold/40 bg-gold/10 p-4 text-sm text-gold-soft">
            <AlertIcon className="shrink-0" />
            <p>As vendas ainda não estão abertas. Volte em breve.</p>
          </div>
        )}

        <fieldset disabled={!salesEnabled || redirecting} className="space-y-6 disabled:opacity-80">
          <legend className="sr-only">Escolha da plataforma</legend>

          <div role="radiogroup" aria-labelledby="platform-label">
            <p id="platform-label" className="mb-1.5 text-sm font-semibold">Plataforma</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {available.map((id) => (
                <label key={id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-line bg-ink px-4 py-3 transition has-[:checked]:border-gold has-[:checked]:bg-gold/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold">
                  <input type="radio" name="platform" value={id} checked={platform === id}
                    onChange={() => {
                      setPlatform(id);
                      setError(null);
                    }} className="size-4 accent-[var(--color-gold)]" />
                  <span className="font-semibold">{PLATFORMS[id].label}</span>
                </label>
              ))}
            </div>
            {sameLinkForAll && supportText && (
              <p className="mt-2 text-xs text-zinc-500">
                Após pagar, informe a plataforma escolhida ao atendimento {supportText}.
              </p>
            )}
          </div>

          <ol className="space-y-1.5 rounded-lg border border-line bg-ink p-4 text-sm text-zinc-400">
            <li>1. Você será levado ao ambiente seguro do Mercado Pago.</li>
            <li>2. Informe seus dados e pague com PIX ou cartão de crédito.</li>
            <li>3. Use um e-mail válido: o código de ativação será enviado para ele.</li>
          </ol>

          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input type="checkbox" checked={accepted} onChange={(e) => {
                setAccepted(e.target.checked);
                setError(null);
              }}
              className="mt-0.5 size-4 accent-[var(--color-blood)]" />
            <span>
              Li e concordo com as{" "}
              <a href="#condicoes" className="text-gold underline underline-offset-2">condições de compra, entrega e privacidade</a>.
            </span>
          </label>

          {error && (
            <div role="alert" className="flex gap-3 rounded-lg border border-blood/50 bg-blood/10 p-4 text-sm text-red-200">
              <AlertIcon className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button type="button" onClick={handleBuy} className="btn-primary w-full" aria-busy={redirecting}>
            {redirecting && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            {redirecting ? "Abrindo o Mercado Pago…" : "Finalizar compra"}
          </button>
        </fieldset>
      </div>

      <OrderSummary platform={platform} />
    </div>
  );
}
