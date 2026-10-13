# PR06 - Remocao Completa Do Legado De Eventos

## Contexto

O PR05 ativou o fluxo definitivo de loja fisica: cada operador autenticado
abre o proprio caixa, o PDV usa essa sessao automaticamente e as vendas nao
dependem mais de eventos. O repositorio ainda preserva o modulo, as rotas, as
fixtures e o schema de eventos para permitir a transicao incremental.

O PR06 encerra essa transicao. O resultado deve representar exclusivamente a
operacao diaria da Roberto Multimarcas, sem permitir que codigo novo ou
clientes antigos continuem usando o contexto de evento.

## Objetivo

Remover eventos do runtime, da navegacao, dos testes operacionais e do schema
final, preservando o historico de migrations e decisoes arquiteturais. Caixa,
venda, cancelamento, estoque e relatorios devem continuar funcionando por
operador e sessao de caixa.

## Resultado Para O Usuario

- O menu nao apresenta mais `Eventos`.
- `/events` e `/events/new` deixam de existir.
- Um usuario autenticado que acessar uma dessas URLs recebe o 404 nativo da
  aplicacao, com mensagem em portugues e link para o painel.
- Um usuario anonimo continua sendo direcionado ao login antes de visualizar
  qualquer rota privada, inclusive uma URL antiga.
- Manual, runbook, checklist e manifesto descrevem somente a rotina de loja
  fisica.

## Escopo

### Aplicacao

- Excluir `src/app/events` e todo o modulo `src/modules/events`.
- Remover o item `/events` do `AppHeader`.
- Adicionar `src/app/not-found.tsx` com uma experiencia controlada de 404 em
  portugues e retorno ao painel.
- Remover testes, fixtures e contratos TypeScript exclusivos de eventos.
- Remover dependencias residuais de `event_id` em clientes de teste e payloads
  E2E.
- Atualizar a descricao publica do PWA para a operacao da Roberto Multimarcas.

### Banco

- Criar uma nova migration; migrations aplicadas nunca serao reescritas.
- Remover `cash_sessions.event_id` e `sales.event_id`.
- Remover FKs, indices, triggers e funcoes legadas associados a eventos.
- Remover `public.events` sem `CASCADE`.
- Recriar `finalize_sale_v3(uuid, uuid, jsonb, jsonb)` sem mencionar ou gravar
  `event_id`, preservando autenticacao, idempotencia, locks, validacao de
  estoque, pagamento, grants, `security definer` e `search_path` controlado.
- Notificar o PostgREST para recarregar o schema ao fim da migration.

### Testes E Ferramentas

- Remover o setup E2E que cria um evento ativo.
- Atualizar scripts de integracao para o schema final sem `event_id`.
- Substituir testes de compatibilidade com RPCs legadas por testes que provam
  sua ausencia.
- Manter cobertura de RLS, escritas financeiras bloqueadas, concorrencia de
  estoque, corrida venda/fechamento, cancelamento, relatorios e CSV.

### Documentacao Operacional

- Atualizar `README.md`, `AGENTS.md`, manual, runbook, checklist de go-live,
  gate E2E, observabilidade e planos vigentes.
- Marcar o PR05 como concluido no plano de reestruturacao.
- Marcar o PR06 como concluido somente depois de suas evidencias finais.

## Fora Do Escopo

- Reescrever ou apagar migrations historicas.
- Alterar o ADR 0001 ou o plano historico do PR05 para esconder a transicao.
- Remover palavras como `event` usadas pela API do navegador, por exemplo
  `onChange`, `dispatchEvent` e `pointer-events`.
- Criar usuarios multioperador e ampliar o E2E para navegadores independentes;
  isso pertence ao PR07.
- Criar ou alterar projetos Vercel ou Supabase; isso pertence ao PR08.
- Aplicar migration, reset ou exclusao em qualquer banco remoto.
- Promover `develop` para `main`; isso pertence ao PR09.

## Arquitetura Da Remocao

### Ordem Da Migration

A migration sera atomica e usara nomes e assinaturas exatos. A ordem sera:

1. Recriar `public.finalize_sale_v3(uuid, uuid, jsonb, jsonb)` sem a coluna
   `event_id` no `insert into public.sales`.
2. Remover os triggers:
   - `cash_sessions_prepare_legacy_insert`;
   - `sales_prepare_insert`.
3. Remover as funcoes:
   - `public.prepare_legacy_cash_session_insert()`;
   - `public.prepare_sale_insert()`;
   - `public.close_event(uuid)`;
   - `public.open_cash_session_v2(integer, uuid)`;
   - `public.finalize_sale_v2(uuid, jsonb, jsonb)`;
   - `public.finalize_sale(uuid, uuid, uuid, timestamptz, jsonb, jsonb,
integer)`.
4. Remover explicitamente os indices:
   - `cash_sessions_one_open_per_event_operator_idx`;
   - `cash_sessions_event_idx`;
   - `sales_event_completed_at_idx`.
5. Remover explicitamente as FKs:
   - `cash_sessions_event_id_fkey`;
   - `sales_event_id_fkey`.
6. Remover `cash_sessions.event_id` e `sales.event_id`.
7. Executar `drop table public.events` sem `cascade`.
8. Executar `notify pgrst, 'reload schema'`.

`DROP TABLE` sem `CASCADE` e a remocao explicita dos objetos conhecidos fazem
dependencias inesperadas interromperem a migration. Isso evita esconder um
acoplamento residual em ambientes migrados.

Os indices atuais por operador, data operacional, status e sessao permanecem.
Os triggers genericos `*_set_updated_at`, as RLS financeiras e as RPCs V3
permanecem.

### Rotas Antigas E 404

As pastas das rotas serao excluidas; nao havera redirect nem componente
residual em `/events`. O `not-found.tsx` global fornece a apresentacao
controlada, mas o status HTTP permanece `404`.

O proxy de autenticacao continua protegendo toda a aplicacao. Assim, um acesso
anonimo a uma URL antiga preserva o destino no parametro `next` e solicita
login. Depois de autenticado, o destino inexistente apresenta o 404.

### E2E Sem Evento

O `globalSetup` atual existe para localizar eventos E2E e fechar caixas
associados a eles. Ele sera removido junto com sua referencia no Playwright.
Os fluxos atuais ja preparam e encerram a propria sessao de caixa.

O PR06 nao introduzira a nova seed multioperador nem limpeza administrativa
global. Essa evolucao permanece no PR07, evitando misturar remocao de legado
com a nova arquitetura de dados E2E.

## Contratos Que Devem Permanecer

- No maximo um caixa aberto por operador.
- Operadores diferentes podem manter caixas abertos simultaneamente.
- O servidor deriva a identidade de `auth.uid()`.
- Toda venda usa a sessao aberta exata do operador autenticado.
- Escritas financeiras diretas permanecem bloqueadas.
- Fechamento administrativo registra `closed_by`.
- Vendas e fechamento serializam pela mesma sessao de caixa.
- Estoque compartilhado nunca fica negativo sob concorrencia.
- Cancelamento preserva historico e devolve estoque.
- Relatorios e CSV permanecem consistentes por periodo, operador e caixa.
- Datas operacionais usam `America/Sao_Paulo`.

## Estrategia De Testes

### Contrato De Schema

Um teste pgTAP dedicado comprovara:

- ausencia de `public.events`;
- ausencia das duas colunas `event_id`;
- ausencia das seis funcoes e dos dois triggers legados;
- ausencia dos tres indices e das duas FKs legadas;
- ausencia de `event_id` e `events` na definicao de funcoes ativas;
- existencia, assinatura, grants, `security definer` e `search_path` das RPCs
  V3;
- permanencia de RLS e dos indices do modelo de loja fisica.

### Dois Caminhos De Banco

1. **Upgrade:** partir do schema do PR05, aplicar somente a migration do PR06 e
   executar pgTAP e integracoes.
2. **Banco vazio:** executar `supabase db reset` com todo o historico e repetir
   o contrato e as integracoes.

Os dois caminhos devem produzir o mesmo contrato catalogado. A validacao e
local; nenhum project ref remoto sera usado.

### Aplicacao E Navegador

- Testes de unidade devem provar que a navegacao nao inclui eventos.
- E2E autenticado deve receber `404` e a tela controlada em `/events` e
  `/events/new`.
- E2E anonimo deve continuar sendo direcionado ao login.
- Os smoke tests positivos deixam de listar as rotas removidas.
- A suite operacional repete abertura, venda, cancelamento, fechamento,
  reabertura, relatorio e exportacao CSV sem fixtures de evento.

### Gates

O PR so pode ser publicado depois de passar:

```text
npm run format:check
npm run lint
npm run type-check
npm test
npm run test:db
npm run build
npm run test:e2e:required
```

Tambem sera executada uma busca final de dependencias ativas. Referencias em
migrations historicas, ADRs e planos historicos serao permitidas e
documentadas; referencias em runtime, fixtures atuais e documentacao
operacional falharao o aceite.

## Estrategia De Entrega E Rollback

O PR06 integra codigo e migration no mesmo conjunto revisavel, mas nao executa
operacoes remotas. O caminho de deploy futuro deve publicar uma versao que nao
usa eventos e aplicar a migration apenas no ambiente explicitamente aprovado.

Como a migration remove schema e dados de eventos, rollback remoto nao sera
feito por `down migration`. Antes de qualquer aplicacao remota, os PRs de
provisionamento/release devem confirmar project ref e backup. Os novos
ambientes da Roberto Multimarcas devem preferencialmente nascer vazios por
`db reset`; projetos legados permanecem intactos durante a janela de rollback.

## Criterios De Aceite

- Nenhuma rota, modulo, navegacao ou mensagem operacional depende de eventos.
- `/events` e `/events/new` respondem com 404 controlado para autenticados.
- `public.events`, `cash_sessions.event_id` e `sales.event_id` nao existem no
  schema final.
- Nenhuma funcao ativa referencia eventos ou `event_id`.
- RPCs V3, RLS, grants e indices da loja fisica permanecem corretos.
- Upgrade do schema do PR05 e reset completo passam o mesmo contrato.
- Build, testes unitarios, banco e E2E passam sem fixtures de evento.
- Manual, runbook e checklist descrevem exclusivamente a Roberto Multimarcas.
- Nenhuma credencial e versionada e nenhum banco remoto e alterado.
