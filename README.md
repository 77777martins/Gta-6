# Landing page de vendas — GRAND THEFT AUTO VI

Landing page de alta conversão com **checkout próprio**, pagamento via **Mercado Pago (PIX e cartão de crédito)**, **confirmação automática por webhook com validação de assinatura** e registro de pedidos em **PostgreSQL**.

> ⚠️ **Antes de habilitar vendas** (`SALES_ENABLED=true`), confirme:
> 1. Disponibilidade comercial do produto e **autorização para revenda** (contrato com distribuidor/publisher).
> 2. Plataformas oficialmente suportadas (edite `src/config/product.ts`).
> 3. Prazo real de entrega e textos de disponibilidade (`src/config/product.ts`).
> 4. Dados legais da loja (razão social, CNPJ, endereço, contato — Decreto 7.962/2013).
> 5. Direito de uso de qualquer imagem promocional adicionada (o projeto não inclui arte oficial).
>
> Com `SALES_ENABLED=false` (padrão) o site funciona normalmente, mas o checkout fica bloqueado **no backend** e a interface informa que as vendas ainda não abriram.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Formulário | React Hook Form + Zod (schema compartilhado com o backend) |
| Backend | Route Handlers do Next.js (Node runtime) |
| Banco | PostgreSQL + Prisma 6 |
| Pagamento | SDK oficial `mercadopago` (Checkout Pro) + Webhooks com `WebhookSignatureValidator` |
| Testes | Vitest (unitários + integração com Postgres real) |
| Localização | pt-BR, R$, datas em `America/Sao_Paulo`, CPF e telefone BR |

## Arquitetura

```
src/
├── app/
│   ├── page.tsx                      # Landing page (Hero, Benefícios, Checkout, Condições)
│   ├── pagamento/[resultado]/        # /pagamento/aprovado | pendente | recusado
│   └── api/
│       ├── checkout/                 # POST: cria pedido + preferência no Mercado Pago
│       ├── webhooks/mercadopago/     # POST: notificação assinada do Mercado Pago
│       └── orders/[id]/              # GET: status público (polling do PIX)
├── components/                       # UI (server components + formulário client)
├── config/                           # Produto (preço!) e dados públicos da loja
├── lib/                              # env, db, logger, rate limit, validações
├── server/
│   ├── mercadopago/                  # SDK oficial (preferência, pagamento, assinatura)
│   └── orders/                       # Regras de negócio de pedidos/pagamentos
└── middleware.ts                     # CSP com nonce por requisição
prisma/                               # Schema e migrações (com CHECK constraints)
tests/                                # Vitest
```

### Fluxo de compra

1. Cliente preenche o formulário → `POST /api/checkout` com header `Idempotency-Key`.
2. Backend valida (Zod), cria o pedido `PENDING` com **preço definido no servidor** e cria uma preferência no Mercado Pago (`external_reference` = ID do pedido).
3. Cliente é redirecionado ao Checkout Pro e paga com PIX ou cartão.
4. Mercado Pago chama `POST /api/webhooks/mercadopago` → assinatura HMAC validada → o backend **consulta o pagamento na API do MP** (nunca confia no payload) → confere valor/moeda → atualiza o pedido.
5. O cliente volta para `/pagamento/{aprovado|pendente|recusado}`. A página **ignora o status da URL**: consulta o MP e o banco e redireciona para a página do status real. No PIX pendente, a página acompanha o pedido e atualiza sozinha.

## Como executar (desenvolvimento)

Pré-requisitos: Node.js ≥ 20.11 e Docker (ou um PostgreSQL disponível).

```bash
# 1. Dependências
npm install

# 2. Variáveis de ambiente
cp .env.example .env
# edite .env: DATABASE_URL, MERCADOPAGO_ACCESS_TOKEN (TEST-...), MERCADOPAGO_WEBHOOK_SECRET

# 3. Banco de dados
docker compose up -d db
npm run db:migrate

# 4. Rodar
npm run dev        # http://localhost:3000
```

### Testes

```bash
npm test                                   # unitários
TEST_DATABASE_URL="postgresql://gta:troque_esta_senha@localhost:5432/gta_test" npm test
# ↑ inclui integração (idempotência concorrente, aprovação, valor adulterado...).
#   Use um banco EXCLUSIVO para testes: ele é limpo a cada execução.
npm run typecheck && npm run lint
```

### Testar o pagamento de ponta a ponta (sandbox)

1. No [painel de desenvolvedores](https://www.mercadopago.com.br/developers/panel/app) crie uma aplicação (Checkout Pro) e use as **credenciais de teste**.
2. Crie **usuários de teste** (vendedor e comprador) no painel.
3. Exponha o servidor local com HTTPS (ex.: `ngrok http 3000`) e use essa URL em `APP_URL`.
4. Em **Suas integrações → Webhooks**, cadastre `https://SEU_DOMINIO/api/webhooks/mercadopago`, marque o evento **Pagamentos** e copie a **assinatura secreta** para `MERCADOPAGO_WEBHOOK_SECRET`.
5. `SALES_ENABLED=true`, faça uma compra com o comprador de teste e os [cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/cards) (o nome do titular define o resultado: `APRO` aprova, `OTHE` recusa).
6. Verifique no banco (`npm run db:studio`) o pedido e o pagamento.

## Deploy em produção

1. Banco PostgreSQL gerenciado (Neon, Supabase, RDS, Railway…) com SSL.
2. Configure **todas** as variáveis de `.env.example` no provedor (exceto `TZ` na Vercel, que é reservada), com `APP_URL` em `https://`.
   - **Neon:** `DATABASE_URL` = string **com pooling** (`-pooler`) + `&pgbouncer=true&connect_timeout=15`; `DIRECT_URL` = string **sem pooling**.
3. **Vercel:** importe o repositório. O script `vercel-build` roda `prisma generate && prisma migrate deploy && next build`, ou seja, **as migrações são aplicadas automaticamente a cada deploy** (só as pendentes).
   - ⚠️ Cadastre `DATABASE_URL`/`DIRECT_URL` apenas no ambiente **Production** (ou use outro banco em Preview), para que deploys de preview não alterem o banco de produção.
   **Docker:** rode `npx prisma migrate deploy` no pipeline e depois `docker build -t gta6-store . && docker run --env-file .env -p 3000:3000 gta6-store`.
4. Cadastre o webhook no painel do Mercado Pago (teste e depois produção).
5. Teste com credenciais `TEST-`, depois troque para produção (`APP_USR-...`).
6. Só então `SALES_ENABLED=true`.

## Imagens

Todas as imagens ficam em `src/assets/` e são registradas em `src/assets/index.ts` (com texto alternativo). O `next/image` gera AVIF/WebP no tamanho de cada dispositivo e um placeholder borrado durante o carregamento.

| Arquivo | Onde aparece |
|---|---|
| `hero-gta6.jpg` | Capa (hero) e prévia de compartilhamento (Open Graph) |
| `promo-car.webp` | Seção de benefícios |
| `banner-heist.webp` | Banner com segunda chamada para compra |
| `box-ps5.webp` | Resumo do pedido quando a plataforma é PS5 |
| `cover-square.webp` | Resumo do pedido sem plataforma / Xbox |

Para trocar uma imagem, substitua o arquivo mantendo o nome. Para adicionar a capa de Xbox, inclua-a em `src/assets/index.ts` (`productImageFor`).

> ⚠️ As artes são propriedade da Rockstar Games/Take-Two. Use somente com autorização (ex.: material de marketing fornecido ao revendedor).

## Segurança implementada

- Credenciais apenas no servidor (`src/lib/env.ts` é `server-only` e validado com Zod).
- Preço e produto definidos exclusivamente no backend; o schema descarta campos extras.
- Webhook validado pelo `WebhookSignatureValidator` do SDK (HMAC-SHA256, tempo constante e **anti-replay** de 10 min); status sempre confirmado na API do MP.
- Verificação de **valor e moeda** antes de aprovar (pagamento divergente nunca aprova).
- **Idempotência** em 3 camadas (chave do cliente, reaproveitamento de pedido pendente, `X-Idempotency-Key` no MP) e lock de linha (`FOR UPDATE`) na atualização de status.
- CSRF: validação de `Origin` + `Content-Type: application/json` obrigatório.
- Rate limit por IP em checkout, webhook, consulta de status e página de retorno.
- CSP com nonce, `frame-ancestors 'none'`, `X-Frame-Options`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Logs estruturados com redação de dados sensíveis (CPF/tokens nunca logados; e-mail mascarado).
- Prisma (queries parametrizadas) + CHECK constraints no banco; chamadas ao MP apenas via SDK oficial (sem URL dinâmica, sem SSRF).
- Página pública de pedido sem dados pessoais (UUID não enumerável, e-mail mascarado).

## Limitações conhecidas / próximos passos

- **Entrega do produto é manual**: pedidos `APPROVED` devem ser atendidos pela equipe (campo `fulfilledAt` já existe). Próximo passo: estoque de chaves + envio automático por e-mail transacional.
- Rate limit em memória é por instância. Com múltiplas instâncias, use Redis (mesma interface em `src/lib/rate-limit.ts`).
- Painel administrativo de pedidos (hoje: `npm run db:studio` ou SQL).
- Política de retenção de dados pessoais (LGPD) para pedidos antigos.
