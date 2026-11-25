import type { ReactNode } from "react";
import { PLATFORMS, PRODUCT } from "@/config/product";
import { ClockIcon, GamepadIcon, KeyIcon, MailIcon, ShieldIcon } from "./icons";

const items: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <GamepadIcon />,
    title: "Plataformas",
    text: `Compatível com ${Object.values(PLATFORMS)
      .map((p) => p.label)
      .join(" e ")}. Escolha a sua no checkout.`,
  },
  { icon: <KeyIcon />, title: "Licença", text: PRODUCT.licenseType },
  { icon: <MailIcon />, title: "Entrega", text: PRODUCT.delivery },
  { icon: <ClockIcon />, title: "Disponibilidade", text: PRODUCT.availability },
  {
    icon: <ShieldIcon />,
    title: "Pagamento seguro",
    text: "Processado pelo Mercado Pago. Não armazenamos dados do seu cartão.",
  },
];

export function Benefits() {
  return (
    <section aria-labelledby="beneficios" className="border-t border-line/60 bg-ink py-20">
      <div className="container-page">
        <p className="eyebrow">O que você recebe</p>
        <h2 id="beneficios" className="mt-3 text-3xl font-black uppercase sm:text-4xl">
          Tudo claro antes de comprar
        </h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.title}
              className="group rounded-xl border border-line bg-ink-2 p-6 transition hover:-translate-y-0.5 hover:border-blood/60"
            >
              <span className="inline-flex size-11 items-center justify-center rounded-lg bg-blood/10 text-blood transition group-hover:bg-blood group-hover:text-white">
                {item.icon}
              </span>
              <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
