import { describe, expect, it } from "vitest";
import { deriveOrderStatus, resultSlugFor, toCents } from "@/server/orders/status";

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

  it("converte valores e rotas corretamente", () => {
    expect(toCents(299.9)).toBe(29990);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(resultSlugFor("APPROVED")).toBe("aprovado");
    expect(resultSlugFor("PENDING")).toBe("pendente");
    expect(resultSlugFor("REFUNDED")).toBe("recusado");
  });
});
