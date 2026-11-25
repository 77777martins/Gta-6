import Image from "next/image";
import type { ReactNode } from "react";
import { IMAGES } from "@/assets";
import type { PaymentCopy } from "@/lib/payment-copy";
import { PLATFORMS, PRODUCT } from "@/config/product";
import { CheckIcon, ClockIcon, GamepadIcon, KeyIcon, MailIcon, ShieldIcon } from "./icons";

function buildItems(payment: PaymentCopy): { icon: ReactNode; title: string; text: string }[] {
  return [
  { icon: <CheckIcon />, title: `${PRODUCT.editionName} completa`, text: PRODUCT.completeDescription },
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
    text: payment.cardEnabled
      ? `Processado por ${payment.processor}. Não armazenamos dados do seu cartão.`
      : `PIX processado por ${payment.processor}, com confirmação automática.`,
  },
  ];
}

export function Benefits({ payment }: { payment: PaymentCopy }) {
  const items = buildItems(payment);
  return (
    <section aria-labelledby="beneficios" className="border-t border-line/60 bg-ink py-20">
      <div className="container-page">
        <p className="eyebrow">O que você recebe</p>
        <h2 id="beneficios" className="mt-3 text-3xl font-black uppercase sm:text-4xl">
          Tudo claro antes de comprar
        </h2>
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line lg:aspect-auto lg:h-full">
            <Image
              src={IMAGES.promoCar.src}
              alt={IMAGES.promoCar.alt}
              fill
              placeholder="blur"
              sizes="(min-width: 1024px) 460px, 100vw"
              className="object-cover object-[60%_top]"
            />
            <div aria-hidden className="absolute inset-0 ring-1 ring-inset ring-white/10" />
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <li
                key={item.title}
                className="group rounded-xl border border-line bg-ink-2 p-6 transition hover:-translate-y-0.5 hover:border-blood/60 sm:last:odd:col-span-2"
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
      </div>
    </section>
  );
}
