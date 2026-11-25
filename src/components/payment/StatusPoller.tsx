"use client";

import { useEffect, useState } from "react";

const INTERVAL_MS = 8_000;
const MAX_DURATION_MS = 15 * 60 * 1000;

/**
 * Acompanha um pedido pendente (ex.: PIX aguardando pagamento) e redireciona
 * para a página correta quando o backend confirmar a mudança de status.
 */
export function StatusPoller({ orderId }: { orderId: string }) {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function tick() {
      if (Date.now() - startedAt > MAX_DURATION_MS) return setExpired(true);
      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (res.ok) {
          const { status } = (await res.json()) as { status?: string };
          if (status && status !== "PENDING") {
            const slug = status === "APPROVED" ? "aprovado" : "recusado";
            window.location.replace(`/pagamento/${slug}?external_reference=${encodeURIComponent(orderId)}`);
            return;
          }
        }
      } catch {
        // Falha de rede: tenta novamente no próximo ciclo.
      }
      if (!cancelled) timer = setTimeout(tick, INTERVAL_MS);
    }

    timer = setTimeout(tick, INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId]);

  return (
    <p role="status" className="mt-4 flex items-center justify-center gap-2 text-sm text-zinc-400">
      {expired ? (
        "Ainda aguardando a confirmação. Recarregue a página mais tarde ou fale com o atendimento."
      ) : (
        <>
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-gold" />
          Aguardando confirmação do pagamento…
        </>
      )}
    </p>
  );
}
