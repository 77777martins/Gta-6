import { describe, expect, it } from "vitest";
import { isValidBrPhone, maskBrPhone, normalizeBrPhone } from "@/lib/validation/phone";
import { formatCents, formatDateTime } from "@/lib/format";

describe("telefone brasileiro", () => {
  it("aceita celular e fixo, com ou sem máscara/+55", () => {
    expect(isValidBrPhone("(11) 91234-5678")).toBe(true);
    expect(isValidBrPhone("+55 21 3456-7890")).toBe(true);
    expect(normalizeBrPhone("+55 (11) 91234-5678")).toBe("11912345678");
  });

  it("rejeita DDD inválido, celular sem 9 e tamanhos errados", () => {
    expect(isValidBrPhone("(01) 91234-5678")).toBe(false);
    expect(isValidBrPhone("(11) 81234-5678")).toBe(false);
    expect(isValidBrPhone("1191234")).toBe(false);
  });

  it("aplica máscara progressiva", () => {
    expect(maskBrPhone("11")).toBe("(11");
    expect(maskBrPhone("119123")).toBe("(11) 9123");
    expect(maskBrPhone("1134567890")).toBe("(11) 3456-7890");
    expect(maskBrPhone("11912345678")).toBe("(11) 91234-5678");
  });
});

describe("formatação pt-BR", () => {
  it("moeda e data no fuso de São Paulo", () => {
    expect(formatCents(29990).replace(/\s/g, " ")).toBe("R$ 299,90");
    // 03:30 UTC = 00:30 em Brasília (UTC-3)
    expect(formatDateTime(new Date("2026-11-25T03:30:00Z"))).toBe("25/11/2026, 00:30");
  });
});
