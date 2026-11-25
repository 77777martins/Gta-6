import { STORE } from "@/config/store";

export function SiteFooter() {
  return (
    <footer className="border-t border-line/60 bg-ink py-10 text-xs text-zinc-500">
      <div className="container-page space-y-3">
        <p className="font-semibold text-zinc-300">{STORE.name}</p>
        {(STORE.legalName || STORE.cnpj) && (
          <p>
            {STORE.legalName}
            {STORE.cnpj && ` · CNPJ ${STORE.cnpj}`}
          </p>
        )}
        {STORE.address && <p>{STORE.address}</p>}
        {STORE.email && (
          <p>
            Contato: <a className="underline" href={`mailto:${STORE.email}`}>{STORE.email}</a>
          </p>
        )}
        <p className="max-w-3xl">
          Grand Theft Auto, GTA e Rockstar Games são marcas de suas respectivas detentoras (Take-Two Interactive Software,
          Inc.). Esta loja é independente e não é afiliada, patrocinada ou endossada pela Rockstar Games ou pela Take-Two.
        </p>
        <p>© {new Date().getFullYear()} {STORE.name}. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
