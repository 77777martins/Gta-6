"use client";

import { useEffect } from "react";
import { CONSENT_EVENT, readConsent } from "@/lib/analytics/consent";
import { loadPixels, trackConversion } from "@/lib/analytics/pixels";

/**
 * Envia o evento de compra uma única vez por pedido (modo integração completa,
 * página "aprovado"). O id do pedido deduplica o evento nas plataformas.
 */
export function PurchaseTracker({ orderId }: { orderId: string }) {
  useEffect(() => {
    const key = `purchase-tracked:${orderId}`;
    const fire = () => {
      if (readConsent() !== "granted") return;
      try {
        if (window.sessionStorage.getItem(key)) return;
        window.sessionStorage.setItem(key, "1");
      } catch {
        // sem storage: o eventId ainda deduplica no lado das plataformas
      }
      loadPixels();
      trackConversion("Purchase", { eventId: orderId });
    };
    fire();
    window.addEventListener(CONSENT_EVENT, fire);
    return () => window.removeEventListener(CONSENT_EVENT, fire);
  }, [orderId]);

  return null;
}
