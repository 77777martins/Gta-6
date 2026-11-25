"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useId, useRef, useState } from "react";
import { PRODUCT } from "@/config/product";
import { loadMercadoPagoSdk } from "@/lib/mercadopago-sdk";
import { rejectionMessage } from "@/lib/payment-messages";
import { AlertIcon } from "../../icons";

type Props = { orderId: string; publicKey: string; email: string; maxInstallments: number };

/**
 * Pagamento com cartão via Card Payment Brick do Mercado Pago: os dados do
 * cartão são digitados em iframes do Mercado Pago e viram um token de uso único.
 * Nosso servidor recebe apenas o token e cria o pagamento.
 */
export function CardPanel({ orderId, publicKey, email, maxInstallments }: Props) {
  const containerId = `card-brick-${useId().replace(/:/g, "")}`;
  const controller = useRef<{ unmount: () => void } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    async function mount() {
      try {
        await loadMercadoPagoSdk();
        if (cancelled || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        controller.current = await mp.bricks().create("cardPayment", containerId, {
          initialization: { amount: PRODUCT.priceCents / 100, payer: { email } },
          customization: {
            paymentMethods: { minInstallments: 1, maxInstallments, types: { excluded: ["debit_card", "prepaid_card"] } },
            visual: { style: { theme: "dark" } },
          },
          callbacks: {
            onReady: () => !cancelled && setReady(true),
            onError: () => !cancelled && setError("Erro ao carregar o formulário do cartão. Recarregue a página."),
            onSubmit: (formData: any) => submit(formData),
          },
        });
      } catch {
        if (!cancelled) setError("Não foi possível carregar o pagamento com cartão. Tente o PIX ou recarregue a página.");
      }
    }

    void mount();
    return () => {
      cancelled = true;
      controller.current?.unmount();
      controller.current = null;
    };
    // `attempt` recria o formulário (novo token) após uma recusa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, publicKey, email, maxInstallments]);

  async function submit(formData: any): Promise<void> {
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/card`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(formData),
      });
      const json = (await res.json().catch(() => ({}))) as { status?: string; statusDetail?: string; error?: string };

      if (!res.ok) {
        setError(json.error ?? "Não foi possível processar o pagamento.");
        setAttempt((n) => n + 1);
        return;
      }
      if (json.status === "approved" || json.status === "in_process" || json.status === "pending" || json.status === "authorized") {
        const slug = json.status === "approved" ? "aprovado" : "pendente";
        window.location.assign(`/pagamento/${slug}?external_reference=${encodeURIComponent(orderId)}`);
        return;
      }
      setError(rejectionMessage(json.statusDetail));
      setAttempt((n) => n + 1);
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
      setAttempt((n) => n + 1);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="flex gap-3 rounded-lg border border-blood/50 bg-blood/10 p-4 text-sm text-red-200">
          <AlertIcon className="shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {!ready && !error && (
        <p className="flex items-center gap-2 text-sm text-zinc-400" role="status">
          <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-gold" />
          Carregando pagamento seguro…
        </p>
      )}
      <div id={containerId} key={attempt} />
      <p className="text-xs text-zinc-500">
        Os dados do cartão são digitados em ambiente seguro do Mercado Pago e não passam pelos nossos servidores.
      </p>
    </div>
  );
}
