import { Benefits } from "@/components/Benefits";
import { CheckoutSection } from "@/components/checkout/CheckoutSection";
import { Hero } from "@/components/Hero";
import { PurchaseConditions } from "@/components/PurchaseConditions";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { isSalesEnabled } from "@/lib/env";

export default function HomePage() {
  const salesEnabled = isSalesEnabled();
  return (
    <>
      <SiteHeader />
      <main>
        <Hero salesEnabled={salesEnabled} />
        <Benefits />
        <CheckoutSection salesEnabled={salesEnabled} />
        <PurchaseConditions />
      </main>
      <SiteFooter />
      <WhatsAppButton />
    </>
  );
}
