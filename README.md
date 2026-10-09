# Roberto Multimarcas PDV

Sistema privado, mobile first e PWA para vendas, estoque, caixas por operador e
relatorios de uma loja fisica.

O runtime opera com caixas individuais por operador. O modulo da operacao
anterior foi removido da aplicacao e do schema final. Cada operador pode manter
um caixa aberto, operadores diferentes podem trabalhar simultaneamente e uma
nova sessao pode ser aberta no mesmo dia depois do fechamento. O servidor
identifica o responsavel pela sessao autenticada. Consulte o
[plano de reestruturacao](docs/plano-reestruturacao-loja-fisica.md) e o
[ADR de caixas por operador](docs/adr/0001-loja-fisica-caixas-por-operador.md).

## Stack

- Next.js
- TypeScript
- Tailwind
- Supabase
- Zod
- Vitest
- Testing Library
- Playwright
- ESLint
- Prettier
- Husky
- Commitlint
- GitHub Actions
- Vercel (projetos independentes para staging e produção)

## Ambiente Local

Pre-requisitos:

- Git;
- NVM for Windows `1.2.2` ou outro gerenciador compativel;
- Node.js `22.23.2` e npm `10.x`;
- Docker Desktop com backend WSL 2, necessario para executar o Supabase local.

Depois de abrir um novo terminal na raiz do repositorio, ative a versao definida
em `.nvmrc`:

```powershell
$projectNodeVersion = (Get-Content .nvmrc).Trim()
nvm install $projectNodeVersion
nvm use $projectNodeVersion
node --version
npm.cmd --version
docker version
docker compose version
```

Instale as dependencias exatamente como registradas no lockfile:

```powershell
npm.cmd ci
```

## Ambientes E Fluxo Git

- Desenvolvimento local usa `.env.local` e o Supabase CLI local.
- Staging tem `develop` como branch de referência e usa o projeto Vercel
  dedicado `roberto-multimarcas-pdv-staging` com um Supabase isolado. O
  deployment inicial do PR08 é um snapshot auditável da branch
  `feature/provision-roberto-environments`; no merge, esse mesmo commit passa a
  compor `develop`. O PR08 não implementa deploy contínuo: promoções futuras
  exigem um fluxo versionado posterior. O ambiente `Production` desse projeto
  Vercel representa exclusivamente staging.
- O PR09-A prepara o corte na branch `feature/production-cutover`, preserva a
  produção legada pausada por 30 dias e provisiona Supabase/Vercel exclusivos
  para `roberto-multimarcas-pdv`. Toda mutação exige o checkpoint literal do
  runbook; resultados remotos continuam `PENDENTE` até serem evidenciados.
- O PR09-B promove `develop` para `main` exclusivamente por pull request e
  publica o commit assinado resultante na URL
  `https://roberto-multimarcas-pdv.vercel.app`.
- A produção nova começa com somente um administrador e banco operacional
  vazio. Vendedores, produtos e estoque são cadastrados manualmente pela
  aplicação; a validação com dois operadores ocorre depois desse preparo.
- Arquivos com valores reais são locais ou gerenciados pelo provedor e nunca
  são versionados.
- Commits diretos na `main` sao proibidos. O fluxo oficial e
  `feature/*` -> `develop` -> `main`, sempre por pull request.

Consulte [Ambientes](docs/ambientes.md) para a matriz completa, variaveis,
promocao de migrations e processo de release.

## Documentacao

- [Plano de desenvolvimento](docs/plano-desenvolvimento-pdv.md)
- [Plano de execucao incremental](docs/plano-execucao-incremental.md)
- [Plano de reestruturacao para loja fisica](docs/plano-reestruturacao-loja-fisica.md)
- [ADR: loja fisica com caixas por operador](docs/adr/0001-loja-fisica-caixas-por-operador.md)
- [Padroes tecnicos](docs/padroes-tecnicos.md)
- [Gate E2E de release](docs/e2e-release-gate.md)
- [Manual do usuario final](docs/manual-usuario-final.md)
- [Checklist de go-live](docs/checklist-go-live.md)
- [Observabilidade](docs/observabilidade.md)
- [Runbook operacional](docs/runbook-operacional.md)
- [Plano de preparacao do ambiente](docs/plano-preparacao-ambiente.md)
- [Ambientes](docs/ambientes.md)
- [Desenho do corte de produção PR09](docs/superpowers/specs/2026-10-08-production-cutover-design.md)
- [Evidências do corte de produção PR09](docs/evidencias/pr09-production-cutover.md)
- [Supabase CLI](docs/supabase-cli.md)
- [Vercel CLI](docs/vercel-cli.md)
- [Git e GitHub](docs/git-github.md)
