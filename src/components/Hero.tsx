import Image from "next/image";
import { PLATFORMS, PRODUCT } from "@/config/product";
import { formatCents } from "@/lib/format";
import heroImage from "@/assets/hero-gta6.jpg";

/**
 * Capa com arte promocional do jogo.
 *
 * Layout:
 * - Mobile: arte inteira em 16:9 (o logo central fica visível) e conteúdo abaixo.
 * - Desktop (lg+): arte em 16:9 (máx. 88% da altura da tela); o conteúdo sobrepõe
 *   apenas a faixa inferior da arte, sem cobrir o logo central.
 *
 * Performance: import estático gera width/height (sem layout shift) e
 * blurDataURL; next/image entrega AVIF/WebP redimensionado por dispositivo.
 *
 * DIREITOS DE USO: a arte é propriedade da Rockstar Games/Take-Two. Use apenas
 * com autorização (ex.: material de marketing fornecido ao revendedor oficial).
 */
export function Hero({ salesEnabled }: { salesEnabled: boolean }) {
  return (
    <section className="relative isolate overflow-hidden bg-ink">
      <div className="relative aspect-video max-h-[88svh] w-full">
        <Image
          src={heroImage}
          alt="Arte promocional de Grand Theft Auto VI com os protagonistas e cenas de Leonida"
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          quality={80}
          className="object-cover object-center"
        />
        {/* Gradientes garantem contraste do texto e transição suave para a página */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink via-ink/70 to-transparent" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-ink/80 to-transparent" />
      </div>

      <div className="container-page relative -mt-6 pb-14 lg:-mt-28 lg:pb-16">
        <div className="animate-rise lg:flex lg:items-end lg:justify-between lg:gap-10">
          <div className="max-w-2xl">
            <p className="eyebrow">Edição Padrão · Mídia Digital</p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-black uppercase leading-[0.95] tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:text-6xl">
              Grand Theft Auto <span className="text-blood">VI</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-zinc-200 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)] sm:text-lg">
              Garanta sua cópia digital com pagamento 100% seguro via PIX ou cartão de crédito e confirmação automática
              do pagamento.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Plataformas">
              {Object.values(PLATFORMS).map((p) => (
                <li
                  key={p.label}
                  className="rounded-full border border-white/20 bg-black/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider backdrop-blur"
                >
                  {p.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 rounded-xl border border-gold/30 bg-black/60 p-6 backdrop-blur-md lg:mt-0 lg:min-w-[320px]">
            <p className="text-sm uppercase tracking-widest text-mist">Por apenas</p>
            <p className="font-[family-name:var(--font-display)] text-5xl font-black text-gold">
              {formatCents(PRODUCT.priceCents)}
            </p>
            <p className="mt-1 text-sm text-zinc-400">PIX ou cartão de crédito via Mercado Pago</p>
            <a href="#comprar" className="btn-primary mt-5 w-full">
              {salesEnabled ? "Comprar agora" : "Ver detalhes"}
            </a>
          </div>
        </div>
        <p className="mt-6 max-w-xl text-xs text-zinc-500">{PRODUCT.availability}</p>
      </div>
    </section>
  );
}
