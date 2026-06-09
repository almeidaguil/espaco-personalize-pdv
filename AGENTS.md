# Espaco Personalize PDV

Estas instrucoes orientam agentes trabalhando neste workspace.

## Contexto Do Projeto

Projeto: Espaco Personalize PDV.

Objetivo: sistema privado de vendas para eventos presenciais.

Stack fixa:

- Next.js
- TypeScript
- Tailwind
- Supabase
- Vercel
- Zod
- Vitest
- Testing Library
- Playwright
- ESLint
- Prettier
- Husky
- Commitlint
- GitHub Actions

Principios:

- Mobile First
- PWA
- Sistema privado
- Usuarios: Admin e Operador

Modulos principais:

- Produtos
- Eventos
- PDV
- Caixa
- Estoque
- Relatorios

Documento de referencia do plano: [docs/plano-desenvolvimento-pdv.md](docs/plano-desenvolvimento-pdv.md).

Plano incremental de execucao: [docs/plano-execucao-incremental.md](docs/plano-execucao-incremental.md).

Padroes tecnicos oficiais: [docs/padroes-tecnicos.md](docs/padroes-tecnicos.md).

## Agentes

Use estes papeis quando o usuario pedir com "Atue como ...":

- Tech Lead: coordena decisoes e devolve a decisao final. Considera Arquiteto, PO, DBA/Supabase, UX, DevOps e QA.
- Arquiteto: define arquitetura, padroes, tecnologias, escalabilidade, seguranca, modelagem, modulos, APIs e estrutura do sistema.
- Product Owner: cria backlog, prioridades e historias de usuario.
- Desenvolvedor Fullstack: implementa codigo, APIs, componentes e telas.
- DBA/Supabase: modela tabelas, indices, relacionamentos, migrations, RLS, auth, storage, policies e triggers.
- UX/UI: desenha fluxos e interfaces com foco Mobile First e velocidade operacional.
- QA: cria cenarios, testes manuais, testes automatizados e validacoes de regressao.
- DevOps/PWA: cuida de Vercel, GitHub, CI/CD, variaveis, monitoramento, manifest, offline, cache e instalacao.

Na pratica, priorize estes 6 agentes: Tech Lead, Arquiteto, Desenvolvedor Fullstack, DBA/Supabase, UX e QA.

## Convencoes

- Idioma das respostas e textos do produto: Portugues.
- Codigo: Ingles.
- Banco: `snake_case`.
- Frontend: `camelCase`.
- Componentes React: `PascalCase`.
- Arquivos: `kebab-case`.
- Commits: Conventional Commits.
- Branches: `feature/nome-da-funcionalidade`.

## Padroes Tecnicos Obrigatorios

- Clean Code.
- Clean Architecture.
- SOLID.
- TypeScript forte.
- Testes automatizados.
- CI/CD.
- Padronizacao de codigo.
- Separacao por camadas.
- Validacao no servidor.
- Seguranca no Supabase.

## Arquitetura Base

```txt
src/
  app/
  modules/
    products/
      domain/
      application/
      infra/
      presentation/
    sales/
      domain/
      application/
      infra/
      presentation/
    stock/
    cash/
    reports/
  shared/
    components/
    lib/
    utils/
    types/
    validations/
```

Camadas:

- Domain: regras puras do negocio.
- Application: casos de uso.
- Infra: Supabase, banco, storage e servicos externos.
- Presentation: telas, componentes, formularios e actions do Next.js.

Regra de ouro:

- O frontend nao decide regra critica.
- O frontend envia a intencao.
- Use cases e servidor validam finalizar venda, cancelar venda, abrir caixa e ajustar estoque.

## Design System

- Visual minimalista.
- Foco em velocidade de operacao.
- Paleta: `#1e3275`, `#f5c313`, `#ffffff`.
- Mobile First.

## Regras De Negocio

- Toda venda gera movimentacao de estoque.
- Toda venda gera registro financeiro.
- Cancelamento devolve estoque e mantem historico.
- Produto nunca altera estoque diretamente.
- Todo ajuste de estoque gera movimentacao.
- Cada venda deve estar vinculada a um evento.
- Caixa deve ser controlado por evento/turno.

## MVP

A primeira versao util deve conter:

- Login.
- Cadastro de produtos.
- Cadastro de eventos.
- PDV.
- Pagamento.
- Troco.
- Baixa de estoque.
- Vendas registradas.
- Relatorio por evento.
- Exportacao CSV.

## Rotas Principais

- `/login`
- `/dashboard`
- `/products`
- `/products/new`
- `/events`
- `/events/new`
- `/pdv`
- `/sales`
- `/sales/[id]`
- `/cash/open`
- `/cash/close`
- `/stock`
- `/reports`
- `/settings`

## Tabelas Principais

- `profiles`
- `products`
- `categories`
- `events`
- `cash_sessions`
- `sales`
- `sale_items`
- `payments`
- `stock_movements`

## Seguranca

- Usar RLS.
- Validar no servidor.
- Proteger APIs e actions.
- Evitar logica critica no frontend.
