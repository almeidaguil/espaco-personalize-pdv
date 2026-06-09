# Padroes Tecnicos Oficiais - Espaco Personalize PDV

Este documento define a base tecnica obrigatoria do projeto.

## Principios Obrigatorios

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

## Stack Oficial

- Next.js.
- TypeScript.
- Tailwind.
- Supabase.
- Zod.
- Vitest.
- Testing Library.
- Playwright.
- ESLint.
- Prettier.
- Husky.
- lint-staged.
- Commitlint.
- GitHub Actions.
- Vercel.

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
      domain/
      application/
      infra/
      presentation/
    cash/
      domain/
      application/
      infra/
      presentation/
    reports/
      domain/
      application/
      infra/
      presentation/
  shared/
    components/
    lib/
    utils/
    types/
    validations/
```

## Camadas

### Domain

Regras puras do negocio. Nao deve depender de Next.js, Supabase, React ou APIs externas.

Exemplos:

- Produto nao pode ter preco negativo.
- Venda cancelada devolve estoque.
- Estoque nao pode ficar negativo.

### Application

Casos de uso e orquestracao das regras de negocio.

Exemplos:

- `CreateSaleUseCase`.
- `CancelSaleUseCase`.
- `OpenCashSessionUseCase`.
- `ExportSalesCsvUseCase`.

### Infra

Acesso a Supabase, banco, storage e servicos externos.

Exemplos:

- Repositories Supabase.
- Clients.
- Gateways.
- Adaptadores de storage.

### Presentation

Telas, componentes, formularios e actions do Next.js.

Exemplos:

- Pages/routes.
- Server actions.
- Components.
- Form handling.

## Regra De Ouro

O frontend nao decide regra critica.

Ele apenas envia a intencao:

- Finalizar venda.
- Cancelar venda.
- Abrir caixa.
- Ajustar estoque.

A regra deve ser validada no servidor e nos use cases.

## Validacao

- Usar Zod para validar entradas externas.
- Validar dados no servidor antes de executar use cases.
- Repetir no dominio as invariantes criticas que nao podem depender da UI.
- Nunca confiar apenas em estado ou validacao do frontend.

## Testes

Ferramentas:

- Vitest.
- Testing Library.
- Playwright.

Tipos:

- Unitarios.
- Integracao.
- E2E.

Prioridade de cobertura:

- Regras de venda.
- Estoque.
- Cancelamento.
- Caixa.
- Permissoes.
- Exportacao CSV.

Diretriz:

- Domain deve ter testes unitarios rapidos.
- Application deve testar casos de uso com mocks/fakes de repositories.
- Infra deve ter testes de integracao quando houver contrato importante.
- Presentation deve usar Testing Library para componentes e Playwright para fluxos essenciais.

## CI/CD

Pipeline no GitHub Actions:

- install.
- lint.
- type-check.
- test.
- build.
- deploy.

Regra:

- Nenhum codigo entra quebrado.
- Pull requests devem passar lint, type-check, testes e build.

## Convencoes

- Pastas: `kebab-case`.
- Componentes: `PascalCase`.
- Variaveis: `camelCase`.
- Banco: `snake_case`.
- Commits: Conventional Commits.
- Branches: `feature/nome-da-funcionalidade`.

Exemplos de commits:

- `feat: add product registration`
- `fix: correct stock movement on sale cancel`
- `test: add sale use case tests`
- `refactor: improve cash session service`

## Ferramentas De Padronizacao

- ESLint.
- Prettier.
- Husky.
- lint-staged.
- Commitlint.

## Criterio Tecnico Para Entregas

Cada entrega deve, quando aplicavel:

- Respeitar as camadas do modulo.
- Ter validacao no servidor.
- Ter tipos TypeScript explicitos nos contratos importantes.
- Ter testes proporcionais ao risco.
- Passar lint, type-check, test e build.
- Nao mover regra critica para o frontend.
