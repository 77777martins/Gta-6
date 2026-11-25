/** Falha ao falar com um provedor de pagamento (Mercado Pago, Pixoupay). */
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
