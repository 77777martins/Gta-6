import { z } from "zod";
import { PLATFORM_IDS } from "@/config/product";
import { isValidCpf, onlyDigits } from "./cpf";
import { isValidBrPhone, normalizeBrPhone } from "./phone";

/**
 * Schema compartilhado entre formulário (feedback imediato) e API (fonte de verdade).
 * Note que NÃO existe campo de preço: o valor é sempre definido no servidor.
 */
export const checkoutSchema = z.object({
  name: z
    .string()
    .trim()
    .min(5, "Informe seu nome completo.")
    .max(120, "Nome muito longo.")
    .regex(/^[\p{L}][\p{L}' .-]+$/u, "Use apenas letras no nome.")
    .refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome."),
  email: z.string().trim().toLowerCase().max(254).email("E-mail inválido."),
  cpf: z
    .string()
    .trim()
    .transform(onlyDigits)
    .refine(isValidCpf, "CPF inválido."),
  // Opcional: facilita o contato do atendimento sobre o pedido.
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? normalizeBrPhone(v) : undefined))
    .refine((v) => v === undefined || isValidBrPhone(v), "Telefone inválido. Use DDD + número."),
  platform: z.enum(PLATFORM_IDS, { errorMap: () => ({ message: "Selecione a plataforma." }) }),
  acceptTerms: z.boolean().refine((v) => v, "É necessário aceitar as condições de compra."),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;

/** Chave de idempotência: UUID v4 gerado no navegador. */
export const idempotencyKeySchema = z.string().uuid();

export const orderIdSchema = z.string().uuid();
export const paymentIdSchema = z.string().regex(/^\d{1,32}$/);
