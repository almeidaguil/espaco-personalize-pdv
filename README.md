# Espaco Personalize PDV

Sistema privado, mobile first e PWA para vendas presenciais em eventos, estoque, caixa e relatorios.

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
