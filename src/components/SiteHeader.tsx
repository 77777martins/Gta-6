import Link from "next/link";
import { STORE } from "@/config/store";

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="text-sm font-black uppercase tracking-[0.25em] text-white">
          {STORE.name}
        </Link>
        <a
          href="#comprar"
          className="rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:border-gold hover:text-gold"
        >
          Comprar
        </a>
      </div>
    </header>
  );
}
