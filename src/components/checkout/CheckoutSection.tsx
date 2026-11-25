import { supportChannelText } from "@/config/store";
import type { PaymentLinks } from "@/lib/env";
import { CheckoutForm } from "./CheckoutForm";
import { PaymentLinkCheckout } from "./PaymentLinkCheckout";

type Props = {
  salesEnabled: boolean;
  paymentLinks: PaymentLinks | null;
  transparent: { publicKey: string; maxInstallments: number } | null;
};

/**
 * Modo de pagamento, por prioridade:
 * 1. Checkout Transparente (Public Key configurada) — paga dentro do site
 * 2. Link de pagamento (links configurados)
 * 3. Checkout Pro (redirecionamento)
 */
export function CheckoutSection({ salesEnabled, paymentLinks, transparent }: Props) {
  const useLinks = !transparent && paymentLinks;
  return (
    <section id="comprar" aria-labelledby="checkout-title" className="scroll-mt-4 bg-gradient-to-b from-ink to-ink-2/40 py-20">
      <div className="container-page">
        <p className="eyebrow">Checkout seguro</p>
        <h2 id="checkout-title" className="mt-3 text-3xl font-black uppercase sm:text-4xl">
          Finalize sua compra
        </h2>
        <p className="mt-3 max-w-2xl text-zinc-400">
          {useLinks
            ? "Escolha a plataforma e conclua o pagamento no Mercado Pago, com PIX ou cartão de crédito."
            : "Preencha seus dados, escolha a plataforma e conclua o pagamento. A confirmação é automática."}
        </p>
        <div className="mt-10">
          {useLinks ? (
            <PaymentLinkCheckout salesEnabled={salesEnabled} links={paymentLinks} supportText={supportChannelText()} />
          ) : (
            <CheckoutForm salesEnabled={salesEnabled} transparent={transparent} />
          )}
        </div>
      </div>
    </section>
  );
}
