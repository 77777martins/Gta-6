import { Benefits } from "@/components/Benefits";
import { CheckoutSection } from "@/components/checkout/CheckoutSection";
import { Hero } from "@/components/Hero";
import { PromoBanner } from "@/components/PromoBanner";
import { PurchaseConditions } from "@/components/PurchaseConditions";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { getPaymentCopy } from "@/lib/payment-copy";
import { getMaxInstallments, getMercadoPagoPublicKey, getPaymentLinks, isSalesEnabled, isTransparentCheckout } from "@/lib/env";

export default function HomePage() {
  const salesEnabled = isSalesEnabled();
  const payment = getPaymentCopy();
  const paymentLinks = getPaymentLinks();
  const publicKey = getMercadoPagoPublicKey();
  // Pagamento dentro do site: PIX (Pixoupay ou Mercado Pago) e cartão (só com a Public Key do Mercado Pago).
  const transparent = isTransparentCheckout() ? { publicKey, maxInstallments: getMaxInstallments() } : null;
  return (
    <>
      <SiteHeader />
      <main>
        <Hero salesEnabled={salesEnabled} payment={payment} />
        <Benefits payment={payment} />
        <PromoBanner salesEnabled={salesEnabled} payment={payment} />
        <CheckoutSection salesEnabled={salesEnabled} paymentLinks={paymentLinks} transparent={transparent} paymentNote={payment.summaryNote} />
        <PurchaseConditions payment={payment} />
      </main>
      <SiteFooter />
      <WhatsAppButton />
    </>
  );
}
