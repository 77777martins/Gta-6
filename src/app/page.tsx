import { Benefits } from "@/components/Benefits";
import { CheckoutSection } from "@/components/checkout/CheckoutSection";
import { Hero } from "@/components/Hero";
import { PromoBanner } from "@/components/PromoBanner";
import { PurchaseConditions } from "@/components/PurchaseConditions";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { getMaxInstallments, getMercadoPagoPublicKey, getPaymentLinks, isSalesEnabled } from "@/lib/env";

export default function HomePage() {
  const salesEnabled = isSalesEnabled();
  const paymentLinks = getPaymentLinks();
  const publicKey = getMercadoPagoPublicKey();
  const transparent = publicKey ? { publicKey, maxInstallments: getMaxInstallments() } : null;
  return (
    <>
      <SiteHeader />
      <main>
        <Hero salesEnabled={salesEnabled} />
        <Benefits />
        <PromoBanner salesEnabled={salesEnabled} />
        <CheckoutSection salesEnabled={salesEnabled} paymentLinks={paymentLinks} transparent={transparent} />
        <PurchaseConditions />
      </main>
      <SiteFooter />
      <WhatsAppButton />
    </>
  );
}
