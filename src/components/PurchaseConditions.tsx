import { PRODUCT } from "@/config/product";

/** Condições de compra na própria página (CDC art. 49 e LGPD), sem páginas extras. */
export function PurchaseConditions() {
  const items = [
    { title: "Entrega", text: PRODUCT.delivery },
    {
      title: "Direito de arrependimento",
      text: "Você pode desistir da compra em até 7 dias (art. 49 do CDC). Após o resgate do código de ativação na plataforma, o produto é considerado utilizado.",
    },
    {
      title: "Pagamento",
      text: "Processado pelo Mercado Pago. O pedido só é confirmado após a aprovação do pagamento, validada automaticamente pelo nosso sistema.",
    },
    {
      title: "Privacidade (LGPD)",
      text: "Usamos nome, e-mail e CPF exclusivamente para processar o pagamento, entregar o produto e emitir documentos fiscais. Não armazenamos dados de cartão. Cookies de marketing (Meta e TikTok) só são ativados se você aceitar no aviso de cookies.",
    },
  ];

  return (
    <section id="condicoes" aria-labelledby="condicoes-title" className="scroll-mt-4 border-t border-line/60 py-16">
      <div className="container-page">
        <h2 id="condicoes-title" className="text-xl font-black uppercase tracking-wide">
          Condições de compra
        </h2>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2">
          {items.map((i) => (
            <div key={i.title}>
              <dt className="font-semibold text-gold">{i.title}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-zinc-400">{i.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
