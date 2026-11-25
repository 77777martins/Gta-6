import { describe, expect, it } from "vitest";
import { deriveOrderStatus, isPayable, resultSlugFor, toCents } from "@/server/orders/status";

const p = (status: string, amountMatches = true) => ({ status, amountMatches });

describe("deriveOrderStatus", () => {
  it("sem pagamentos permanece pendente", () => {
    expect(deriveOrderStatus([])).toBe("PENDING");
  });

  it("aprovação vence tentativas recusadas anteriores", () => {
    expect(deriveOrderStatus([p("rejected"), p("approved")])).toBe("APPROVED");
  });

  it("NUNCA aprova pagamento com valor divergente", () => {
    expect(deriveOrderStatus([p("approved", false)])).toBe("PENDING");
  });

  it("mapeia estados finais", () => {
    expect(deriveOrderStatus([p("rejected")])).toBe("REJECTED");
    expect(deriveOrderStatus([p("cancelled")])).toBe("CANCELLED");
    expect(deriveOrderStatus([p("refunded")])).toBe("REFUNDED");
    expect(deriveOrderStatus([p("charged_back")])).toBe("CHARGED_BACK");
    expect(deriveOrderStatus([p("in_process"), p("rejected")])).toBe("PENDING");
  });

  it("só permite nova tentativa de pagamento em pedidos não pagos", () => {
    expect(isPayable("PENDING")).toBe(true);
    expect(isPayable("REJECTED")).toBe(true);
    expect(isPayable("CANCELLED")).toBe(true);
    expect(isPayable("APPROVED")).toBe(false);
    expect(isPayable("REFUNDED")).toBe(false);
    expect(isPayable("CHARGED_BACK")).toBe(false);
  });

  it("converte valores e rotas corretamente", () => {
    expect(toCents(299.9)).toBe(29990);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(resultSlugFor("APPROVED")).toBe("aprovado");
    expect(resultSlugFor("PENDING")).toBe("pendente");
    expect(resultSlugFor("REFUNDED")).toBe("recusado");
  });
});
