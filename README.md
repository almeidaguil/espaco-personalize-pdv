# Roberto Multimarcas PDV

Sistema privado, Mobile First e PWA para vendas, estoque, caixas por operador e
relatórios de uma loja física.

O sistema opera com controle de caixa individual por operador. O módulo da
operação anterior foi descontinuado e completamente removido da aplicação e do
banco de dados. Cada operador mantém seu próprio caixa aberto, operadores
distintos operam simultaneamente e novas sessões podem ser abertas no mesmo dia
após o fechamento. O servidor deriva a identidade do operador diretamente da
sessão autenticada.

A versão em produção é a **v2.1.0**, que consolidou a operação da loja física
com caixas por operador, pagamentos divididos, descontos auditados, estoque
inicial no cadastro de produtos e fluxo mobile aprimorado.

Consulte o [plano de reestruturação](docs/plano-reestruturacao-loja-fisica.md) e o
[ADR de caixas por operador](docs/adr/0001-loja-fisica-caixas-por-operador.md).

## Funcionalidades Principais

- **PDV Ágil & Mobile First**: Venda rápida com busca de produtos por nome ou
  SKU, leitor de código de barras, carrinho dinâmico e layout responsivo.
- **Pagamentos Flexíveis & Troco**: Suporte a dinheiro, Pix, cartão de débito
  e cartão de crédito (à vista, 2x ou 3x). Opção de **Dividir pagamento** em até
  duas formas distintas com cálculo automático de troco para dinheiro.
- **Descontos Auditados**: Aplicação de desconto no valor total da venda com
  registro de autoria e validação no servidor.
- **Caixa por Operador**: Abertura com valor inicial, múltiplas sessões
  concorrentes de vendedores distintos, fechamento com 4 conferências
  obrigatórias (dinheiro, Pix, crédito, débito) e fechamento administrativo em
  contingência.
- **Estoque em Tempo Real**: Baixa automática por venda, reposição por
  cancelamento, ajustes manuais e entrada de quantidade inicial diretamente no
  cadastro de novos produtos (`/products/new`).
- **Relatórios & Exportação**: Consulta de vendas e fechamentos por período,
  operador e sessão de caixa, com exportação completa em formato CSV.
- **PWA Instalável**: Acesso direto na tela inicial em celulares e desktops, com
  visual minimalista e foco em velocidade operacional.

## Stack

- **Framework**: Next.js (App Router, Turbopack) & React 19
- **Linguagem**: TypeScript com tipagem estrita
- **Estilização**: Tailwind CSS (paleta `#1e3275`, `#f5c313`, `#ffffff`)
- **Backend & Auth**: Supabase (PostgreSQL, Row Level Security, RPCs transacionais)
- **Validação**: Zod no cliente e no servidor
- **Testes**: Vitest, Testing Library e Playwright (E2E)
- **Qualidade**: ESLint, Prettier, Husky, lint-staged, Commitlint
- **CI/CD**: GitHub Actions (Quality checks, Database contract, Playwright E2E)
- **Hospedagem**: Vercel (projetos independentes para staging e produção)

## Ambiente Local

Pré-requisitos:

- Git;
- NVM for Windows `1.2.2` ou gerenciador compatível;
- Node.js `22.23.2` e npm `10.9.8` (especificados em `.nvmrc` e `package.json`);
- Docker Desktop com backend WSL 2 (para o Supabase local).

Após abrir o terminal na raiz do repositório, ative o toolchain fixado:

```powershell
$projectNodeVersion = (Get-Content .nvmrc).Trim()
nvm use $projectNodeVersion
node --version
npm.cmd --version
docker version
```

Instale as dependências exatamente como registradas no lockfile:

```powershell
npm.cmd ci
```

Inicie o banco Supabase local isolado:

```powershell
npx.cmd supabase start
```

Execute a suíte de testes:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run type-check
npm.cmd run test:db
npm.cmd run test:e2e:local-reset
```

## Ambientes E Fluxo Git

- **Local**: usa `.env.local` e Supabase CLI local com Docker.
- **Staging**: projeto Vercel dedicado `roberto-multimarcas-pdv-staging`
  conectado ao Supabase de staging `otsxpchqtfypxgzjzrxs`. As promoções são
  controladas manualmente por SHA via `npm run ops:rollout-staging`.
- **Produção**: projeto Vercel `roberto-multimarcas-pdv` e Supabase de produção
  `wjuzwjbvctbyfvgmprmd`. A URL estável oficial é
  [https://roberto-multimarcas-pdv.vercel.app](https://roberto-multimarcas-pdv.vercel.app).
- **Fluxo Git**:
  - `feature/*` -> `develop` exclusivamente por pull request com Quality e E2E aprovados.
  - `develop` -> `main` exclusivamente por pull request de release com gates aprovados.
  - Commits e pushes diretos na `main` ou `develop` são proibidos.
  - Commits são assinados via SSH e seguem o padrão Conventional Commits.

Consulte [Ambientes](docs/ambientes.md) para a matriz completa, variáveis e
processo de release.

## Documentação

- [Plano de desenvolvimento](docs/plano-desenvolvimento-pdv.md)
- [Plano de execução incremental](docs/plano-execucao-incremental.md)
- [Plano de reestruturação para loja física](docs/plano-reestruturacao-loja-fisica.md)
- [ADR: loja física com caixas por operador](docs/adr/0001-loja-fisica-caixas-por-operador.md)
- [Padrões técnicos](docs/padroes-tecnicos.md)
- [Manual do usuário final](docs/manual-usuario-final.md)
- [Runbook operacional](docs/runbook-operacional.md)
- [Checklist de go-live](docs/checklist-go-live.md)
- [Gate E2E de release](docs/e2e-release-gate.md)
- [Observabilidade](docs/observabilidade.md)
- [Ambientes](docs/ambientes.md)
- [Supabase CLI](docs/supabase-cli.md)
- [Vercel CLI](docs/vercel-cli.md)
- [Git e GitHub](docs/git-github.md)
- [Evidências do corte de produção](docs/evidencias/pr09-production-cutover.md)
