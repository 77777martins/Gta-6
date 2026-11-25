import "server-only";
import { getMercadoPagoPublicKey, isTransparentCheckout, pixProvider } from "@/lib/env";

/**
 * Textos ao cliente sobre COMO ele paga, derivados do modo realmente ativo.
 * Evita informar processador ou meio de pagamento que não está disponível
 * (ex.: "cartão" quando só há PIX via Pixoupay).
 */
export type PaymentCopy = {
  /** "PIX" ou "PIX ou cartão de crédito" */
  methods: string;
  /** Quem processa o pagamento. */
  processor: string;
  cardEnabled: boolean;
  /** Frase curta para o resumo do pedido. */
  summaryNote: string;
};

export function getPaymentCopy(): PaymentCopy {
  const transparent = isTransparentCheckout();
  const cardViaMp = Boolean(getMercadoPagoPublicKey());
  const usesPixoupay = transparent && pixProvider() === "pixoupay";

  // Links de pagamento, Checkout Pro e Checkout Transparente do MP: tudo pelo Mercado Pago.
  let processor = "Mercado Pago";
  let cardEnabled = true;
  if (usesPixoupay) {
    cardEnabled = cardViaMp;
    processor = cardViaMp ? "Pixoupay (PIX) e Mercado Pago (cartão)" : "Pixoupay";
  }

  const methods = cardEnabled ? "PIX ou cartão de crédito" : "PIX";
  return { methods, processor, cardEnabled, summaryNote: `Pagamento processado por ${processor} (${methods}).` };
}
