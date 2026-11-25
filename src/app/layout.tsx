import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { PRODUCT } from "@/config/product";
import { STORE } from "@/config/store";
import { formatCents } from "@/lib/format";
import "./globals.css";

const description = `Compre ${PRODUCT.shortName} por ${formatCents(PRODUCT.priceCents)}. Pagamento seguro via PIX ou cartão de crédito pelo Mercado Pago.`;

export const metadata: Metadata = {
  title: `${PRODUCT.shortName} | ${STORE.name}`,
  description,
  metadataBase: process.env.APP_URL ? new URL(process.env.APP_URL) : undefined,
  openGraph: { title: PRODUCT.shortName, description, type: "website", locale: "pt_BR" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#07070a", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Lê os headers para que o Next aplique o nonce da CSP (renderização dinâmica).
  await headers();
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
