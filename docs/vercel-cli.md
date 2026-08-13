# Vercel CLI

Este projeto usa o Vercel CLI para vincular o repositorio, sincronizar variaveis
de ambiente, executar validacoes locais e gerenciar deploys.

## Instalacao Local Da Maquina

O CLI foi instalado globalmente no Node.js 22 gerenciado pelo NVM:

```powershell
npm.cmd install --global vercel@latest
vercel.cmd --version
```

Ao trocar a versao ativa do Node.js no NVM, pode ser necessario instalar o CLI
novamente nessa versao. O projeto usa a versao definida em `.nvmrc`.

## Autenticacao

Use o fluxo OAuth oficial no navegador:

```powershell
vercel.cmd login
vercel.cmd whoami
```

A sessao e armazenada no perfil local do usuario. Nao grave tokens da Vercel em
arquivos versionados.

## Vinculo Com O Projeto

O login nao vincula automaticamente este repositorio a um projeto da Vercel.
Esse vinculo sera feito quando o ambiente remoto estiver definido:

```powershell
vercel.cmd link
```

O diretorio `.vercel/` gerado pelo vinculo e ignorado pelo Git.

## Ambientes Remotos

- `Production` usa a branch `main` e o Supabase de producao.
- `Preview` da branch `develop` usa o Supabase de staging.
- `Development` nao possui credenciais remotas; use o Supabase CLI local.
- Valores reais devem ser configurados na Vercel e nunca commitados.

Depois do vinculo, copie variaveis para arquivos locais ignorados somente quando
necessario:

```powershell
vercel.cmd env pull .env.staging.local --environment preview --git-branch develop
vercel.cmd env pull .env.production.local --environment production
```

O Next.js nao possui um `NODE_ENV=staging` nativo. Prefira testar staging pela
URL de Preview da Vercel, evitando executar o aplicativo local contra dados
remotos desnecessariamente.

## CI/CD

Automacoes nao devem usar uma sessao pessoal interativa. Quando necessario,
configure `VERCEL_TOKEN` como secret no provedor de CI e rotacione o token antes
da entrega de producao.
