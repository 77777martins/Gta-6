"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import { AlertIcon, CheckIcon } from "../../icons";
import { StatusPoller } from "../../payment/StatusPoller";

type Pix = { qrCode: string; qrCodeBase64: string; ticketUrl: string | null; expiresAt: string | null };

export function PixPanel({ orderId }: { orderId: string }) {
  const [pix, setPix] = useState<Pix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json().catch(() => ({}))) as Partial<Pix> & { error?: string };
      if (!res.ok || !json.qrCode || !json.qrCodeBase64) {
        setError(json.error ?? "Não foi possível gerar o PIX. Tente novamente.");
        return;
      }
      setPix(json as Pix);
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      setError("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  }

  if (!pix) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-400">
          Gere o QR Code e pague pelo app do seu banco. A confirmação é automática e leva poucos segundos.
        </p>
        {error && (
          <div role="alert" className="flex gap-3 rounded-lg border border-blood/50 bg-blood/10 p-4 text-sm text-red-200">
            <AlertIcon className="shrink-0" />
            <p>{error}</p>
          </div>
        )}
        <button type="button" onClick={generate} disabled={loading} className="btn-primary w-full" aria-busy={loading}>
          {loading && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
          {loading ? "Gerando PIX…" : "Gerar QR Code PIX"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- QR Code dinâmico em data URI */}
      <img
        src={`data:image/png;base64,${pix.qrCodeBase64}`}
        alt="QR Code PIX para pagamento"
        width={220}
        height={220}
        className="mx-auto rounded-lg bg-white p-2"
      />
      <ol className="mx-auto max-w-sm space-y-1 text-left text-sm text-zinc-400">
        <li>1. Abra o app do seu banco e escolha pagar com PIX.</li>
        <li>2. Escaneie o QR Code ou use o código “copia e cola”.</li>
        <li>3. Confirme o pagamento. Esta página atualiza sozinha.</li>
      </ol>
      <div>
        <label htmlFor="pix-code" className="mb-1.5 block text-left text-sm font-semibold">
          PIX copia e cola
        </label>
        <textarea
          id="pix-code"
          readOnly
          value={pix.qrCode}
          rows={3}
          onFocus={(e) => e.currentTarget.select()}
          className="field-input resize-none font-mono text-xs"
        />
        <button type="button" onClick={copy} className="btn-primary mt-3 w-full">
          {copied ? (
            <>
              <CheckIcon width={18} height={18} /> Código copiado!
            </>
          ) : (
            "Copiar código PIX"
          )}
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        {pix.expiresAt
          ? `Válido até ${formatDateTime(new Date(pix.expiresAt))} (horário de Brasília).`
          : "Pague logo após gerar: o QR Code tem validade limitada."}
      </p>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <StatusPoller orderId={orderId} />
    </div>
  );
}
