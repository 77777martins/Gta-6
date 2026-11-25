export class SalesClosedError extends Error {
  constructor() {
    super("Vendas não habilitadas");
    this.name = "SalesClosedError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("Chave de idempotência reutilizada com dados diferentes");
    this.name = "IdempotencyConflictError";
  }
}

/** Pedido inexistente ou que não aceita mais pagamento (já pago, cancelado...). */
export class OrderNotPayableError extends Error {
  constructor(readonly reason: "not_found" | "not_pending" | "in_process") {
    super(`Pedido não pode ser pago: ${reason}`);
    this.name = "OrderNotPayableError";
  }
}

/** Dados enviados pelo navegador não conferem com o pedido (possível adulteração). */
export class PaymentInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentInputError";
  }
}
