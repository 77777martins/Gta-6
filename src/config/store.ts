/**
 * Dados públicos da loja (exibidos no site). Variáveis NEXT_PUBLIC_* vão para o
 * navegador — nunca coloque segredos aqui.
 *
 * O Decreto 7.962/2013 exige que lojas virtuais exibam razão social, CNPJ,
 * endereço e contato. Preencha antes de vender.
 */
function digits(value: string | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export const STORE = {
  name: process.env.NEXT_PUBLIC_STORE_NAME || "Loja de Games",
  legalName: process.env.NEXT_PUBLIC_STORE_LEGAL_NAME || "",
  cnpj: process.env.NEXT_PUBLIC_STORE_CNPJ || "",
  address: process.env.NEXT_PUBLIC_STORE_ADDRESS || "",
  email: process.env.NEXT_PUBLIC_STORE_EMAIL || "",
  whatsapp: digits(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER),
} as const;

/** "5511912345678" -> "+55 (11) 91234-5678" */
export function formatStorePhone(): string | null {
  const local = STORE.whatsapp.slice(2);
  if (!/^\d{12,13}$/.test(STORE.whatsapp)) return null;
  return local.length === 11
    ? `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
    : `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
}

export function whatsappLink(message: string): string | null {
  if (!/^\d{12,13}$/.test(STORE.whatsapp)) return null;
  return `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(message)}`;
}
