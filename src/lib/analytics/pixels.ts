/**
 * Carregamento dos pixels (Meta e TikTok) e envio de eventos de conversão.
 * Os scripts só são carregados após o consentimento do visitante.
 * Sem pixel configurado ou sem consentimento, todas as funções são inofensivas.
 */
import { PRODUCT } from "@/config/product";
import { ANALYTICS } from "./config";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFn = (...args: any[]) => void;
declare global {
  interface Window {
    fbq?: AnyFn & Record<string, any>;
    _fbq?: unknown;
    ttq?: any[] & Record<string, any>;
  }
}

let loaded = false;

function injectScript(src: string) {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/** Equivalente ao snippet oficial da Meta, sem script inline (compatível com a CSP). */
function loadMeta(id: string) {
  if (window.fbq) return;
  const fbq: any = function (...args: any[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  };
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  injectScript("https://connect.facebook.net/en_US/fbevents.js");
  fbq("init", id);
  fbq("track", "PageView");
}

/** Equivalente ao snippet oficial do TikTok, sem script inline (compatível com a CSP). */
function loadTikTok(id: string) {
  if (window.ttq) return;
  const ttq: any = [];
  window.ttq = ttq;
  ttq.methods = [
    "page", "track", "identify", "instances", "debug", "on", "off", "once", "ready",
    "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent",
  ];
  ttq.setAndDefer = (target: any, method: string) => {
    target[method] = (...args: any[]) => target.push([method, ...args]);
  };
  for (const method of ttq.methods) ttq.setAndDefer(ttq, method);
  ttq.instance = (pixelId: string) => {
    const instance = ttq._i[pixelId] || [];
    for (const method of ttq.methods) ttq.setAndDefer(instance, method);
    return instance;
  };
  const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
  ttq._i = { [id]: Object.assign([], { _u: url }) };
  ttq._t = { [id]: Date.now() };
  ttq._o = { [id]: {} };
  injectScript(`${url}?sdkid=${encodeURIComponent(id)}&lib=ttq`);
  ttq.page();
}

export function loadPixels(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  if (ANALYTICS.metaPixelId) loadMeta(ANALYTICS.metaPixelId);
  if (ANALYTICS.tiktokPixelId) loadTikTok(ANALYTICS.tiktokPixelId);
}

export function pixelsLoaded(): boolean {
  return loaded;
}

type Conversion = "ViewContent" | "InitiateCheckout" | "Purchase";

/** Nome equivalente de cada evento no TikTok. */
const TIKTOK_EVENT: Record<Conversion, string> = {
  ViewContent: "ViewContent",
  InitiateCheckout: "InitiateCheckout",
  Purchase: "CompletePayment",
};

/**
 * Envia um evento de conversão com valor em BRL. `eventId` deduplica o evento
 * (ex.: id do pedido na compra), evitando contagem dupla em recarregamentos.
 */
export function trackConversion(event: Conversion, opts: { platform?: string; eventId?: string } = {}): void {
  if (!loaded) return;
  const value = PRODUCT.priceCents / 100;
  const contentName = opts.platform ? `${PRODUCT.shortName} — ${opts.platform}` : PRODUCT.shortName;

  window.fbq?.(
    "track",
    event,
    { value, currency: PRODUCT.currency, content_ids: [PRODUCT.sku], content_name: contentName, content_type: "product" },
    opts.eventId ? { eventID: opts.eventId } : undefined,
  );
  window.ttq?.track?.(
    TIKTOK_EVENT[event],
    {
      value,
      currency: PRODUCT.currency,
      contents: [{ content_id: PRODUCT.sku, content_name: contentName, quantity: 1, price: value }],
      content_type: "product",
    },
    opts.eventId ? { event_id: opts.eventId } : undefined,
  );
}

/**
 * Dispara o evento e só então navega (até `maxWaitMs`), para que a saída para o
 * Mercado Pago não cancele o envio do evento de início de checkout.
 */
export function trackThenNavigate(url: string, platform?: string, maxWaitMs = 350): void {
  trackConversion("InitiateCheckout", { platform });
  if (!loaded) return window.location.assign(url);
  window.setTimeout(() => window.location.assign(url), maxWaitMs);
}
