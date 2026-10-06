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
- Vercel

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
- Staging usa a branch `develop`, Vercel Preview e um projeto Supabase isolado.
- Producao usa a branch `main`, Vercel Production e outro projeto Supabase.
- Arquivos com valores reais sao locais ou gerenciados pela Vercel e nunca sao
  versionados.
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
- [Supabase CLI](docs/supabase-cli.md)
- [Vercel CLI](docs/vercel-cli.md)
- [Git e GitHub](docs/git-github.md)
