/** Formatação pt-BR com fuso fixo America/Sao_Paulo (independe do servidor/navegador). */
export const TIME_ZONE = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** 29990 -> "R$ 299,90" */
export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

/** -> "25/11/2026, 10:42" (horário de Brasília) */
export function formatDateTime(date: Date): string {
  return dateTime.format(date);
}

/** Número do pedido exibido ao cliente (8 primeiros caracteres do UUID). */
export function formatOrderNumber(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}
