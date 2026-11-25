import { describe, expect, it } from "vitest";
import { checkoutSchema } from "@/lib/validation/checkout";

const valid = {
  name: "Maria da Silva",
  email: "  Maria@Example.com ",
  cpf: "529.982.247-25",
  platform: "PS5",
  acceptTerms: true,
};

describe("checkoutSchema", () => {
  it("normaliza e-mail e CPF", () => {
    const data = checkoutSchema.parse(valid);
    expect(data.email).toBe("maria@example.com");
    expect(data.cpf).toBe("52998224725");
  });

  it("telefone é opcional e normalizado", () => {
    expect(checkoutSchema.parse({ ...valid, phone: "" }).phone).toBeUndefined();
    expect(checkoutSchema.parse({ ...valid, phone: "(11) 91234-5678" }).phone).toBe("11912345678");
  });

  it("ignora campos extras como preço enviado pelo cliente", () => {
    const data = checkoutSchema.parse({ ...valid, price: 1, totalCents: 1 });
    expect(data).not.toHaveProperty("price");
    expect(data).not.toHaveProperty("totalCents");
  });

  it.each([
    ["nome sem sobrenome", { name: "Maria" }],
    ["nome com HTML", { name: "<script>alert(1)</script> x" }],
    ["e-mail inválido", { email: "nao-e-email" }],
    ["CPF inválido", { cpf: "000.000.000-00" }],
    ["plataforma inexistente", { platform: "PC" }],
    ["termos não aceitos", { acceptTerms: false }],
    ["telefone inválido", { phone: "(11) 1234" }],
  ])("rejeita %s", (_, patch) => {
    expect(checkoutSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});
