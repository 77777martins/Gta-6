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
