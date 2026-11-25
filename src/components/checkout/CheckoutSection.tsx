import { CheckoutForm } from "./CheckoutForm";

export function CheckoutSection({ salesEnabled }: { salesEnabled: boolean }) {
  return (
    <section id="comprar" aria-labelledby="checkout-title" className="scroll-mt-4 bg-gradient-to-b from-ink to-ink-2/40 py-20">
      <div className="container-page">
        <p className="eyebrow">Checkout seguro</p>
        <h2 id="checkout-title" className="mt-3 text-3xl font-black uppercase sm:text-4xl">
          Finalize sua compra
        </h2>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Preencha seus dados, escolha a plataforma e conclua o pagamento. A confirmação é automática.
        </p>
        <div className="mt-10">
          <CheckoutForm salesEnabled={salesEnabled} />
        </div>
      </div>
    </section>
  );
}
