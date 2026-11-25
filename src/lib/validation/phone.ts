import { onlyDigits } from "./cpf";

/**
 * Telefone brasileiro: DDD (11–99, sem zero) + 8 dígitos (fixo) ou 9 dígitos
 * começando com 9 (celular). Aceita entrada com máscara e/ou prefixo +55.
 */
export function normalizeBrPhone(value: string): string {
  const digits = onlyDigits(value);
  return digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
}

export function isValidBrPhone(value: string): boolean {
  const digits = normalizeBrPhone(value);
  return /^[1-9]{2}(9\d{8}|[2-5]\d{7})$/.test(digits);
}

/** Máscara progressiva: (11) 91234-5678 ou (11) 3456-7890. */
export function maskBrPhone(value: string): string {
  const d = normalizeBrPhone(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
