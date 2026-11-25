"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { PLATFORMS, PLATFORM_IDS } from "@/config/product";
import { maskCpf } from "@/lib/validation/cpf";
import { checkoutSchema, type CheckoutData, type CheckoutInput } from "@/lib/validation/checkout";
import { AlertIcon } from "../icons";
import { OrderSummary } from "./OrderSummary";

type ApiError = { error?: string; fields?: Partial<Record<keyof CheckoutInput, string[]>> };

function isTrustedCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)mercadopago\.com(\.br)?$/.test(url.hostname);
  } catch {
    return false;
  }
}

export function CheckoutForm({ salesEnabled }: { salesEnabled: boolean }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  // Uma chave de idempotência por combinação (e-mail + plataforma): reenvios do
  // mesmo pedido reaproveitam a chave; mudar os dados gera um novo pedido.
  const keys = useRef(new Map<string, string>());

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutInput, unknown, CheckoutData>({
    resolver: zodResolver(checkoutSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", cpf: "", platform: undefined, acceptTerms: false },
  });

  const platform = watch("platform");
  const cpfField = register("cpf");
  const busy = isSubmitting || redirecting;

  async function onSubmit(data: CheckoutData) {
    setServerError(null);
    const fingerprint = `${data.email}|${data.platform}`;
    const idempotencyKey = keys.current.get(fingerprint) ?? crypto.randomUUID();
    keys.current.set(fingerprint, idempotencyKey);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(data),
      });
      const json = (await response.json().catch(() => ({}))) as ApiError & { checkoutUrl?: unknown };

      if (!response.ok) {
        if (json.fields) {
          for (const [field, messages] of Object.entries(json.fields)) {
            if (messages?.[0]) setError(field as keyof CheckoutInput, { message: messages[0] });
          }
        }
        if (response.status === 409) keys.current.delete(fingerprint);
        setServerError(json.error ?? "Não foi possível iniciar o pagamento.");
        return;
      }

      if (!isTrustedCheckoutUrl(json.checkoutUrl)) {
        setServerError("Resposta inesperada do servidor. Tente novamente.");
        return;
      }
      setRedirecting(true);
      window.location.assign(json.checkoutUrl);
    } catch {
      setServerError("Falha de conexão. Verifique sua internet e tente novamente.");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="rounded-xl border border-line bg-ink-2 p-6 sm:p-8">
        {!salesEnabled && (
          <div role="status" className="mb-6 flex gap-3 rounded-lg border border-gold/40 bg-gold/10 p-4 text-sm text-gold-soft">
            <AlertIcon className="shrink-0" />
            <p>As vendas ainda não estão abertas. Fale com o atendimento para ser avisado assim que liberarmos.</p>
          </div>
        )}

        <fieldset disabled={!salesEnabled || busy} className="space-y-5 disabled:opacity-80">
          <legend className="sr-only">Dados do comprador</legend>

          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-semibold">
              Nome completo
            </label>
            <input id="name" autoComplete="name" className="field-input" placeholder="Como no documento"
              aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} {...register("name")} />
            {errors.name && <p id="name-error" className="field-error">{errors.name.message}</p>}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
                E-mail
              </label>
              <input id="email" type="email" inputMode="email" autoComplete="email" className="field-input"
                placeholder="voce@email.com" aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : "email-hint"} {...register("email")} />
              {errors.email ? (
                <p id="email-error" className="field-error">{errors.email.message}</p>
              ) : (
                <p id="email-hint" className="mt-1.5 text-xs text-zinc-500">O produto será enviado para este e-mail.</p>
              )}
            </div>
            <div>
              <label htmlFor="cpf" className="mb-1.5 block text-sm font-semibold">
                CPF
              </label>
              <input id="cpf" inputMode="numeric" autoComplete="off" className="field-input" placeholder="000.000.000-00"
                maxLength={14} aria-invalid={!!errors.cpf} aria-describedby={errors.cpf ? "cpf-error" : "cpf-hint"}
                {...cpfField}
                onChange={(e) => {
                  e.target.value = maskCpf(e.target.value);
                  void cpfField.onChange(e);
                }} />
              {errors.cpf ? (
                <p id="cpf-error" className="field-error">{errors.cpf.message}</p>
              ) : (
                <p id="cpf-hint" className="mt-1.5 text-xs text-zinc-500">Exigido pelo meio de pagamento e para emissão fiscal.</p>
              )}
            </div>
          </div>

          <div role="radiogroup" aria-labelledby="platform-label" aria-describedby={errors.platform ? "platform-error" : undefined}>
            <p id="platform-label" className="mb-1.5 text-sm font-semibold">Plataforma</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {PLATFORM_IDS.map((id) => (
                <label key={id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-line bg-ink px-4 py-3 transition has-[:checked]:border-gold has-[:checked]:bg-gold/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold">
                  <input type="radio" value={id} className="size-4 accent-[var(--color-gold)]" {...register("platform")} />
                  <span className="font-semibold">{PLATFORMS[id].label}</span>
                </label>
              ))}
            </div>
            {errors.platform && <p id="platform-error" className="field-error">{errors.platform.message}</p>}
          </div>

          <div>
            <label className="flex items-start gap-3 text-sm text-zinc-300">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-blood)]" aria-invalid={!!errors.acceptTerms}
                {...register("acceptTerms")} />
              <span>
                Li e concordo com as{" "}
                <a href="#condicoes" className="text-gold underline underline-offset-2">condições de compra, entrega e privacidade</a>.
              </span>
            </label>
            {errors.acceptTerms && <p className="field-error">{errors.acceptTerms.message}</p>}
          </div>

          {serverError && (
            <div role="alert" className="flex gap-3 rounded-lg border border-blood/50 bg-blood/10 p-4 text-sm text-red-200">
              <AlertIcon className="shrink-0" />
              <p>{serverError}</p>
            </div>
          )}

          <button type="submit" className="btn-primary w-full" aria-busy={busy}>
            {busy && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            {redirecting ? "Redirecionando ao pagamento…" : isSubmitting ? "Processando…" : "Finalizar compra"}
          </button>
          <p className="text-center text-xs text-zinc-500">
            Você será direcionado ao ambiente seguro do Mercado Pago para pagar com PIX ou cartão.
          </p>
        </fieldset>
      </form>

      <OrderSummary platform={platform} />
    </div>
  );
}
