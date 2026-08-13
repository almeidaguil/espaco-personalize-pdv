# Plano De Preparacao Do Ambiente

Este checklist acompanha a preparacao completa do ambiente local do projeto
Espaco Personalize PDV.

Regra de acompanhamento: uma tarefa somente e marcada como concluida depois de
executada e validada. Credenciais serao solicitadas apenas quando forem
necessarias para a etapa atual.

## Progresso

- [x] Auditar repositorio, scripts, variaveis, migrations, testes e ferramentas
      disponiveis.
- [x] Instalar e validar Git, Node.js, npm, npx e o gerenciador de versao do
      Node.js.
- [x] Instalar e validar Docker Desktop e WSL 2 para o Supabase local.
- [x] Fixar a versao do Node.js no repositorio e documentar os pre-requisitos
      locais.
- [x] Instalar as dependencias usando o lockfile e validar Husky e Commitlint.
- [x] Instalar o Chromium do Playwright e validar a instalacao.
- [x] Instalar e validar os CLIs do Supabase e da Vercel e autenticar as contas.
- [x] Subir o Supabase local, aplicar migrations e seed e verificar o banco.
- [x] Criar e preencher o `.env.local` com as credenciais do ambiente escolhido.
- [x] Executar o aplicativo localmente e validar login, rotas e conexao com o
      Supabase; validar Git, GitHub CLI, autenticacao no GitHub, identidade do
      usuario e assinatura de commits.
- [x] Executar verificacao de formatacao, lint, tipos, testes unitarios e build.
- [x] Configurar o `.env.e2e.local` quando as credenciais E2E forem fornecidas e
      executar o Playwright.
- [x] Validar workflows, hooks e documentacao final do ambiente de
      desenvolvimento.

## Validacoes Concluidas

### Ferramentas basicas

- Git `2.55.0.windows.4`.
- NVM for Windows `1.2.2`.
- Node.js `22.23.2`.
- npm e npx `10.9.8`.
- Versao `22.23.2` centralizada em `.nvmrc` e usada pelos workflows de CI.
- Faixas de Node.js e npm declaradas no `package.json` e no lockfile.

### Containers

- Docker Desktop `4.86.0`.
- Docker Engine `29.7.2`.
- Docker Compose `5.3.1`.
- WSL `2.7.11.0` com backend Linux WSL 2 operacional.

### Dependencias E Hooks

- Instalacao reproduzivel com `npm ci`: 559 pacotes.
- Auditoria de dependencias de producao e desenvolvimento: 0 vulnerabilidades.
- Next.js e `eslint-config-next` alinhados na versao segura `16.3.0`.
- Husky `9.1.7` com `core.hooksPath=.husky/_`.
- Commitlint `21.0.2` aceitando Conventional Commits e rejeitando mensagens
  invalidas.
- `lint-staged` `17.0.7` executado pelo hook de pre-commit.

### Navegador De Testes

- Playwright `1.60.0`.
- Chromium `148.0.7778.96` instalado no cache local do Playwright.
- Chromium headless, FFmpeg e Winldd instalados.
- Inicializacao headless e renderizacao de pagina local validadas.

### CLIs E Autenticacao

- Supabase CLI `2.105.0` instalado e fixado como dependencia do projeto.
- Supabase CLI autenticado e com acesso ao projeto `ciixpfquwmlsvzleattv`.
- Vercel CLI `58.11.0` instalado globalmente no Node.js 22 do NVM.
- Vercel CLI autenticado na conta `almeidaguil`.
- Nenhum token foi gravado no repositorio.

### Supabase Local

- Stack local iniciada com 10 conteineres operacionais.
- API local em `http://127.0.0.1:54321`.
- Studio local em `http://127.0.0.1:54323`.
- Mailpit local em `http://127.0.0.1:54324`.
- Banco PostgreSQL local na porta `54322`.
- `db reset` validado com 18 migrations aplicadas em ordem.
- Seed executado; atualmente o arquivo contem apenas um comentario e nao cria
  dados iniciais.
- Nove tabelas publicas e quatro RPCs criticas confirmadas.
- RLS habilitada em todas as tabelas publicas.
- Lint do banco concluido sem erros.

### Variaveis Locais

- `.env.local` criado com URL, publishable key e secret key da stack local.
- As tres variaveis conferidas contra `supabase status`.
- Publishable key validada no endpoint do Auth.
- Secret key validada no endpoint administrativo do Auth.
- Acesso anonimo direto a `products` bloqueado com `401`.
- `.env.local` confirmado como ignorado e nao rastreado pelo Git.
- `.env.example` atualizado somente com placeholders seguros.

### Git E GitHub

- Git `2.55.0.windows.4` e Git Credential Manager `2.9.0` validados.
- GitHub CLI `2.97.0` instalado e autenticado como `almeidaguil`.
- Acesso `ADMIN` ao repositorio remoto e leitura por HTTPS confirmados.
- Identidade global configurada como
  `Guiherme Almeida <almeida.guilherme37@gmail.com>`.
- E-mail confirmado como primario e verificado no GitHub.
- Chave SSH Ed25519 dedicada criada e cadastrada no GitHub como chave de
  assinatura.
- Assinatura SSH automatica habilitada para novos commits.
- Commit assinado validado em repositorio temporario, sem alterar o historico
  deste projeto.

### Aplicativo Local

- Aplicativo Next.js iniciado e acessivel em `http://127.0.0.1:3000`.
- Convencao descontinuada `middleware.ts` migrada para `src/proxy.ts`, conforme
  exigido pelo Next.js 16.
- Onze rotas privadas verificadas sem sessao e protegidas por redirecionamento
  para `/login`.
- Validacao de e-mail invalido confirmada na interface de login.
- Login por e-mail habilitado no Supabase, mantendo novos cadastros publicos
  bloqueados para preservar o carater privado do sistema.
- Usuario administrador local criado com e-mail confirmado; a senha permanece
  apenas no ambiente de teste e nao foi registrada na documentacao.
- Login valido confirmado pela API do Supabase e pelo formulario da aplicacao.
- Onze rotas principais responderam `200` durante a sessao autenticada.
- Acesso autenticado a `/login` redirecionado corretamente para `/`.

### Qualidade E Build

- Formatacao validada com Prettier em todos os arquivos rastreados pelo script.
- ESLint executado sem erros ou avisos.
- TypeScript validado com `tsc --noEmit`.
- Vitest executado com 106 arquivos e 356 testes aprovados.
- Build de producao do Next.js concluido com compilacao, tipos e geracao de
  paginas bem-sucedidos.
- Servidor de producao local iniciado e `/login` confirmado com HTTP `200`.

### Testes E2E

- `.env.e2e.local` criado com as credenciais do administrador local e confirmado
  como ignorado pelo Git.
- Verificador obrigatorio confirmou todas as variaveis E2E necessarias.
- Testes sincronizados com a hidratacao das telas interativas e com os estados
  persistidos apos o fechamento do caixa.
- Requisicao de validacao do CSV autenticada para testar diretamente a rota
  protegida, sem seguir o redirecionamento para o login.
- Playwright executado no Chromium com 43 de 43 testes aprovados.
- Cobertura E2E validada para acessibilidade, autenticacao, rotas, produtos,
  eventos, estoque, caixa, vendas, cancelamento, seguranca financeira,
  relatorios e exportacao CSV.
- Arquivos E2E alterados aprovados no Prettier, ESLint e TypeScript.

### Workflows, Hooks E Documentacao

- Workflows `Quality` e `E2E Release Gate` analisados e validados como YAML.
- `actions/checkout` e `actions/setup-node` atualizados para a versao principal
  oficial `v7`.
- Os cinco secrets exigidos pelo gate E2E foram confirmados no GitHub apenas
  pelos nomes, sem leitura ou exposicao dos valores.
- Hook de pre-commit executado com sucesso e integrado ao `lint-staged`.
- Commitlint confirmou uma mensagem Conventional Commits valida e rejeitou uma
  mensagem invalida.
- Identidade, assinatura SSH automatica e autenticacao do GitHub CLI
  reconfirmadas.
- README atualizado com os guias de Supabase CLI, Vercel CLI e Git/GitHub.
- Vinte e tres links locais da documentacao foram verificados sem destinos
  ausentes.
- Workflow de qualidade reproduzido localmente com Prettier, ESLint,
  TypeScript, 356 testes unitarios e build aprovados.
- Servidor de producao local iniciado em `http://127.0.0.1:3000` e `/login`
  confirmado com HTTP `200`.

### Ambientes E Fluxo Git

- Desenvolvimento local isolado com Supabase CLI e arquivos `.env.*.local`
  ignorados pelo Git.
- Vercel Preview da branch `develop` validada contra o projeto Supabase de
  staging `gpywbeoqcovjrfnmbdqx`.
- Vercel Production validada contra o projeto Supabase de producao
  `ciixpfquwmlsvzleattv`.
- Variaveis remotas removidas do ambiente Vercel Development para impedir uso
  acidental de dados remotos durante o desenvolvimento local.
- Branch `feature/environment-setup` baseada no `origin/develop` atualizado.
- `main` e `develop` protegidas com pull request, `Quality checks`, commits
  assinados, historico linear, conversas resolvidas e bloqueio de force push e
  exclusao.
