# Checklist De Go-Live

Checklist para liberar a operação da loja física Roberto Multimarcas.
Documenta o runtime atual; não declara concluídos o QA multioperador (PR07),
o provisionamento dos novos ambientes (PR08) ou a release (PR09).

## Regra De Release

1. Concluir a alteração em `feature/*`, com commits assinados.
2. Integrar em `develop` por PR com checks aprovados.
3. Executar o gate E2E em ambiente isolado e o smoke do
   [Runbook operacional](runbook-operacional.md).
4. Conferir banco, acessos, configuração de ambientes e segredos.
5. Abrir PR de release de `develop` para `main` e revisar o diff.
6. Publicar somente após aprovação dos gates e da preparação operacional.
7. Conferir produção e registrar a release.

## 1. Qualidade E Banco Local

Na raiz do repositório, com dependências instaladas:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run type-check
npm.cmd run format:check
npm.cmd run build
```

No Supabase local isolado, confirmar o alvo local antes do reset. O comando
apaga os dados locais de teste e reaplica migrations e seed:

```powershell
npx.cmd supabase start
npx.cmd supabase db reset --local
npx.cmd supabase db lint --local
npm.cmd run test:db
```

Conferir também:

- `Quality checks` e `Database contract` aprovados;
- ausência de conflitos e pendências críticas;
- constraints, RLS e grants financeiros validados;
- RPCs `open_cash_session_v3`, `finalize_sale_v3`, `cancel_sale` e
  `close_cash_session` disponíveis;
- operador derivado da sessão autenticada; escritas financeiras diretas bloqueadas.

## 2. Gate E2E E Smoke Funcional

Preparar usuário e configuração seguindo o
[Gate E2E de release](e2e-release-gate.md) e executar:

```powershell
npm.cmd run e2e:seed-local
npm.cmd run test:e2e:required
```

A seed é exclusiva de Supabase local e cria/atualiza o admin E2E atual.
Não cria automaticamente dois operadores. Após reset local, executar a seed
novamente. A suíte altera dados e pode fechar caixas visíveis à conta E2E:
usar ambiente e usuários exclusivos de homologação.

Conferir o resultado automatizado e registrar o smoke manual:

- login, cadastro de produto e saldo inicial;
- abertura do próprio caixa e associação automática no PDV;
- recusa de segunda abertura simultânea para o mesmo usuário;
- venda em dinheiro com troco e venda em Pix ou cartão;
- baixa de estoque, cancelamento e reposição;
- fechamento e reabertura no mesmo dia;
- caixas simultâneos de usuários diferentes, com financeiro separado;
- fechamento de um caixa preservando a operação do outro;
- consulta do operador restrita aos próprios dados e contingência pelo admin;
- relatório por período, vendedor e sessão, com CSV equivalente;
- divergências e ajustes após fechamento conciliados.

Os cenários multioperador acima são verificações manuais até a ampliação prevista
no PR07. A execução do E2E atual não comprova sozinha essa cobertura.

## 3. Preparação Do Banco De Entrega

Antes de aplicar migrations remotamente, identificar o ambiente e validar o
project ref, o backup e a sequência de promoção conforme
[Ambientes](ambientes.md) e [Supabase CLI](supabase-cli.md).

- Aplicar primeiro em staging e validar o schema e as RPCs.
- Confirmar banco alinhado às migrations da versão aprovada.
- Manter RLS nas tabelas operacionais e validar isolamento por operador.
- Manter migrations históricas imutáveis.
- Não executar reset remoto como parte do teste local.

Qualquer reset remoto exige confirmação explícita do ambiente e validação do
project ref imediatamente antes da execução. O bootstrap dos ambientes novos
continua no PR08; o corte de produção continua no PR09.

## 4. Acessos E Segredos

Antes de produzir, conferir:

- admin oficial ativo e operadores reais cadastrados;
- signup público desabilitado conforme a política do projeto;
- `leaked password protection` habilitada no Supabase Auth;
- senha administrativa operacional conhecida somente pelos autorizadores;
- usuários temporários desativados quando não fizerem parte da operação;
- segredos e senhas expostos durante homologação rotacionados;
- secrets do GitHub e variáveis da Vercel atualizados após a rotação;
- arquivos locais com credenciais fora do versionamento.

A `publishable key` é pública. `SUPABASE_SECRET_KEY`, senha do banco, tokens de
deploy e senhas operacionais são privados. Não usar valores de homologação como
segredos definitivos de produção.

## 5. Dados De Homologação E Dados Reais

- Executar QA em ambiente isolado; guardar evidências antes do reset local.
- Não levar produtos, vendas ou caixas de teste para a base de entrega.
- Preparar somente admin, operadores, produtos e saldo inicial reais no ambiente
  de produção, conforme o procedimento de bootstrap aprovado.
- Conferir ausência de caixas de teste abertos e usuários temporários ativos.
- Se uma operação de teste controlado ocorrer em produção, preservar o histórico
  e registrar a compensação por cancelamento quando aplicável.
- Não apagar vendas ou movimentações financeiras para limpar relatórios reais.

## 6. Vercel E Promoção

Conferir no projeto que receberá a release:

- projeto, domínio e ambiente identificados;
- Preview e Production separados;
- `Production` associada à `main`;
- variáveis públicas e privadas apontando para o banco correto;
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e
  `SUPABASE_SECRET_KEY` configuradas;
- PR de `develop` para `main` com `Quality` e `E2E Release Gate` aprovados;
- deploy sem erros.

A criação e o vínculo dos projetos exclusivos da Roberto Multimarcas ainda
dependem do PR08. Não considerar essa infraestrutura entregue pelo PR06.

## 7. Smoke Manual Após Deploy

Com o responsável operacional, executar teste controlado e guardar evidências:

1. Fazer login e conferir painel e PWA.
2. Conferir produto real e saldo.
3. Abrir o próprio caixa e confirmar sua identificação no PDV.
4. Realizar uma venda e consultá-la em `/sales`.
5. Cancelar quando for teste controlado e conferir estoque e financeiro.
6. Fechar com dinheiro contado e conferir diferença.
7. Reabrir no mesmo dia para validar nova sessão e fechar novamente.
8. Conferir `/reports`, filtros e CSV.
9. Confirmar acesso aos logs de runtime.

Se algum passo falhar, bloquear a liberação operacional, corrigir em
`feature/*` a partir de `develop` e repetir a validação. O smoke completo e a
validação com usuários separados estão no
[Runbook operacional](runbook-operacional.md).

## 8. Primeiro Dia E Acompanhamento

- Definir admins, operadores e responsável pela conferência financeira.
- Entregar acessos por canal seguro e conferir login em celular e desktop.
- Instalar o PWA nos dispositivos e confirmar internet.
- Conferir estoque inicial e dinheiro de abertura por operador.
- Disponibilizar o [Manual do usuário final](manual-usuario-final.md) à equipe.
- No início do turno, cada operador abre ou continua seu próprio caixa.
- No encerramento, fechar cada sessão e consolidar o relatório.
- Monitorar `sale.create.failed`, `sale.cancel.failed` e `cash.close.failed`
  conforme [Observabilidade](observabilidade.md).
- Registrar incidentes com horário e IDs técnicos, sem credenciais.

## 9. Critério De Liberação

A operação só pode ser liberada após checks e gate E2E aprovados, ambiente correto,
acessos reais, estoque preparado, segredos revisados, smoke validado e responsável
operacional orientado. Pendências de ambiente e release precisam ser resolvidas
nos PRs correspondentes; este checklist não substitui esses gates.
