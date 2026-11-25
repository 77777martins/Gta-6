import Image from "next/image";
import { IMAGES } from "@/assets";
import { PRODUCT } from "@/config/product";
import { formatCents } from "@/lib/format";

/**
 * Banner de chamada intermediária (segundo CTA antes do checkout).
 * - Mobile: arte em 16:9 e texto abaixo (não cobre os personagens).
 * - sm+: texto sobre o céu, à esquerda da arte.
 */
export function PromoBanner({ salesEnabled }: { salesEnabled: boolean }) {
  return (
    <section aria-labelledby="promo-title" className="relative isolate overflow-hidden bg-ink">
      <div className="relative aspect-video w-full lg:aspect-[21/9]">
        <Image
          src={IMAGES.bannerHeist.src}
          alt={IMAGES.bannerHeist.alt}
          fill
          placeholder="blur"
          sizes="100vw"
          className="object-cover object-[70%_center]"
        />
        <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-r from-ink/90 via-ink/40 to-transparent sm:block" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-ink to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink to-transparent" />
      </div>

      <div className="container-page relative -mt-4 pb-12 sm:absolute sm:inset-0 sm:mt-0 sm:flex sm:items-center sm:pb-0">
        <div className="sm:max-w-md">
          <p className="eyebrow">Bem-vindo a Leonida</p>
          <h2 id="promo-title" className="mt-3 text-2xl font-black uppercase leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] sm:text-4xl">
            Sua próxima jogada começa aqui
          </h2>
          <p className="mt-3 text-zinc-300 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)] sm:text-zinc-200">
            {PRODUCT.shortName} por {formatCents(PRODUCT.priceCents)}, com pagamento seguro via PIX ou cartão.
          </p>
          <a href="#comprar" className="btn-primary mt-5 w-full sm:w-auto">
            {salesEnabled ? "Garantir o meu" : "Ver detalhes"}
          </a>
        </div>
      </div>
    </section>
  );
}
