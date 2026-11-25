/**
 * Fonte única de verdade do produto vendido.
 *
 * O PREÇO É DEFINIDO APENAS AQUI, NO SERVIDOR. O frontend exibe estes valores,
 * mas o backend nunca aceita preço vindo do cliente.
 *
 * ATENÇÃO (antes de habilitar vendas com SALES_ENABLED=true):
 * - Confirme a autorização comercial para revender o produto.
 * - Confirme as plataformas oficialmente suportadas pela publisher.
 * - Ajuste `availability` e `delivery` para refletir a realidade do seu estoque.
 */

export const PLATFORMS = {
  PS5: { label: "PlayStation 5" },
  XBOX_SERIES: { label: "Xbox Series X|S" },
} as const;

export type PlatformId = keyof typeof PLATFORMS;
export const PLATFORM_IDS = Object.keys(PLATFORMS) as [PlatformId, ...PlatformId[]];

export const PRODUCT = {
  sku: "GTA6-ULT-DIGITAL",
  name: "Grand Theft Auto VI — Edição Ultimate (Digital)",
  editionName: "Edição Ultimate",
  shortName: "GRAND THEFT AUTO VI",
  priceCents: 29_990,
  currency: "BRL",
  /** Selo curto exibido em destaque. */
  completeLabel: "Jogo completo + extras",
  /** Explicação do que está (e não está) incluído — evita expectativa errada do cliente. */
  completeDescription:
    "Edição Ultimate: o jogo completo (não é demo nem versão de teste) mais o pacote de extras da Ultimate para o modo história — como veículos, armas, roupas e negócios exclusivos — liberados ao longo da campanha, conforme a descrição oficial da Rockstar Games.",
  licenseType: "Licença digital de uso pessoal, vinculada à conta da plataforma escolhida.",
  delivery:
    "Entrega digital: o código de ativação é enviado para o e-mail informado após a confirmação do pagamento.",
  availability:
    "Disponibilidade sujeita a confirmação. Consulte o atendimento antes da compra caso tenha dúvidas.",
} as const;
