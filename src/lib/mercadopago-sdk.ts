/**
 * Carrega o SDK JS v2 do Mercado Pago uma única vez (necessário para o Card
 * Payment Brick, que tokeniza o cartão em iframes seguros do Mercado Pago).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => any;
  }
}

const SDK_URL = "https://sdk.mercadopago.com/js/v2";
let loading: Promise<void> | null = null;

export function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.MercadoPago) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Falha ao carregar o SDK do Mercado Pago"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
