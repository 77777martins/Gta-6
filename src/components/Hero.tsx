import { PLATFORMS, PRODUCT } from "@/config/product";
import { formatCents } from "@/lib/format";

/**
 * Visual 100% em CSS (sem arte oficial): evita uso não licenciado de imagens
 * e mantém o carregamento instantâneo. Para usar imagens promocionais, obtenha
 * licença e adicione-as em /public com next/image.
 */
export function Hero({ salesEnabled }: { salesEnabled: boolean }) {
  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-16">
      {/* Céu de pôr do sol + brilhos */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20"
        style={{
          background:
            "radial-gradient(60% 55% at 78% 30%, rgba(232,182,76,0.35), transparent 60%)," +
            "radial-gradient(50% 60% at 10% 80%, rgba(225,29,46,0.35), transparent 65%)," +
            "linear-gradient(180deg, #07070a 0%, #1a0a10 55%, #07070a 100%)",
        }}
      />
      {/* Sol retrô com faixas */}
      <div aria-hidden className="absolute right-[-10%] top-[12%] -z-10 w-[70vw] max-w-[620px] opacity-35 sm:right-[2%] sm:opacity-100">
      <div
        className="aspect-square w-full animate-glow rounded-full"
        style={{
          background: "linear-gradient(180deg, #f5d58a 0%, #e8b64c 35%, #e11d2e 80%)",
          maskImage: "repeating-linear-gradient(180deg, #000 0 22px, transparent 22px 30px)",
          WebkitMaskImage: "repeating-linear-gradient(180deg, #000 0 22px, transparent 22px 30px)",
          filter: "blur(0.3px)",
        }}
      />
      </div>
      {/* Numeral gigante vazado */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-16 left-1/2 -z-10 -translate-x-1/2 select-none font-[family-name:var(--font-display)] text-[42vw] leading-none text-transparent opacity-30 sm:text-[28rem]"
        style={{ WebkitTextStroke: "2px rgba(255,255,255,0.18)" }}
      >
        VI
      </span>
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-ink to-transparent" />

      <div className="container-page py-16">
        <div className="max-w-2xl animate-rise">
          <p className="eyebrow">Edição Padrão · Mídia Digital</p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl font-black uppercase leading-[0.9] tracking-tight sm:text-7xl lg:text-8xl">
            Grand Theft
            <br />
            Auto <span className="text-blood">VI</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-zinc-300 sm:text-xl">
            Garanta sua cópia digital com pagamento 100% seguro via PIX ou cartão de crédito e confirmação automática do
            pagamento.
          </p>

          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm uppercase tracking-widest text-mist">Por apenas</p>
              <p className="font-[family-name:var(--font-display)] text-5xl font-black text-gold sm:text-6xl">
                {formatCents(PRODUCT.priceCents)}
              </p>
              <p className="mt-1 text-sm text-zinc-400">PIX ou cartão de crédito via Mercado Pago</p>
            </div>
            <a href="#comprar" className="btn-primary sm:mb-2">
              {salesEnabled ? "Comprar agora" : "Ver detalhes"}
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Plataformas">
            {Object.values(PLATFORMS).map((p) => (
              <li
                key={p.label}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider backdrop-blur"
              >
                {p.label}
              </li>
            ))}
          </ul>
          <p className="mt-4 max-w-xl text-xs text-zinc-500">{PRODUCT.availability}</p>
        </div>
      </div>
    </section>
  );
}
