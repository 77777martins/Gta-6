import type { StaticImageData } from "next/image";
import type { PlatformId } from "@/config/product";
import bannerHeist from "./banner-heist.webp";
import boxPs5 from "./box-ps5.webp";
import coverSquare from "./cover-square.webp";
import hero from "./hero-gta6.jpg";
import promoCar from "./promo-car.webp";

/**
 * Catálogo único de imagens do site (import estático = dimensões e blur automáticos).
 *
 * DIREITOS DE USO: arte promocional da Rockstar Games/Take-Two. Utilize apenas
 * com autorização (ex.: material de marketing fornecido ao revendedor).
 */
export type SiteImage = { src: StaticImageData; alt: string };

export const IMAGES = {
  hero: { src: hero, alt: "Arte promocional de Grand Theft Auto VI com os protagonistas e cenas de Leonida" },
  promoCar: { src: promoCar, alt: "Lucia e Jason, protagonistas de GTA VI, sobre um carro clássico em Leonida" },
  bannerHeist: { src: bannerHeist, alt: "Lucia e Jason mascarados saindo de um posto de gasolina ao entardecer" },
  coverSquare: { src: coverSquare, alt: "Capa de Grand Theft Auto VI" },
  boxPs5: { src: boxPs5, alt: "Capa de Grand Theft Auto VI para PlayStation 5" },
} satisfies Record<string, SiteImage>;

/**
 * Imagem do produto por plataforma. Só exibe a caixa de uma plataforma quando
 * ela foi escolhida — evita mostrar capa de PS5 para quem compra para Xbox.
 * Ao receber a capa oficial de Xbox, adicione-a aqui.
 */
export function productImageFor(platform?: PlatformId): SiteImage {
  return platform === "PS5" ? IMAGES.boxPs5 : IMAGES.coverSquare;
}
