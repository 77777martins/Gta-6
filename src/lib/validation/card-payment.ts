import { z } from "zod";

/**
 * Dados enviados pelo Card Payment Brick após a tokenização do cartão.
 * Nenhum dado sensível do cartão chega aqui: apenas o token de uso único.
 * O valor é conferido no servidor contra o pedido (nunca confiado).
 */
export const cardPaymentSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9-]{10,200}$/, "Token inválido."),
  payment_method_id: z.string().regex(/^[a-z_]{2,30}$/, "Bandeira inválida."),
  issuer_id: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isInteger(v) && v > 0), "Emissor inválido."),
  installments: z.coerce.number().int().min(1).max(12),
  transaction_amount: z.number().positive(),
  payer: z
    .object({
      email: z.string().email().optional(),
      identification: z
        .object({ type: z.enum(["CPF", "CNPJ"]), number: z.string().regex(/^\d{11,14}$/) })
        .optional(),
    })
    .optional(),
});

export type CardPaymentInput = z.infer<typeof cardPaymentSchema>;
