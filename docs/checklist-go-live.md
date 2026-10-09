# Checklist De Go-Live

Checklist para liberar a operação da loja física Roberto Multimarcas.
O staging foi provisionado no PR08. O corte técnico de produção e a liberação
operacional pertencem ao PR09 e permanecem pendentes até que cada evidência
remota seja capturada. Banco criado não significa loja liberada.

## Regra De Release

1. Concluir a alteração em `feature/*`, com commits assinados.
2. Integrar em `develop` por PR com checks aprovados.
3. Executar o gate E2E em ambiente isolado e o smoke do
   [Runbook operacional](runbook-operacional.md).
4. Conferir banco, acessos, configuração de ambientes e segredos.
5. Concluir o PR09-A em `develop`, com corte provisório e evidência aprovados.
6. Abrir o PR09-B de `develop` para `main` e revisar o diff.
7. Publicar somente o commit assinado resultante de `main`.
8. Repetir verificação, smoke e monitoramento antes da liberação operacional.

## 1. Qualidade E Banco Local

Na raiz do repositório, com dependências instaladas:

O build exige `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` na sessão. Para validação sem credenciais,
usar a configuração pública de formato do workflow Quality: URL local
`http://127.0.0.1:54321` e placeholder `ci-publishable-key`.

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run type-check
npm.cmd run format:check
npm.cmd run test:no-event-legacy
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

Preparar a stack local isolada seguindo o
[Gate E2E de release](e2e-release-gate.md) e executar:

```powershell
npm.cmd run test:e2e:local-reset
```

O comando destrutivo apaga exclusivamente a base local de testes, reaplica
migrations e executa seed idempotente de admin, operador A e operador B com
credenciais efêmeras. Recusa alvos remotos e project ref. Não usa secrets no
workflow, que executa em PRs para `develop` e `main` com Supabase local efêmero.

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

O PR07 automatiza caixas independentes, abertura concorrente, isolamento,
contingência administrativa, disputa da última unidade e relatórios/CSV reais.
Exigir execução sem skips autenticados. O smoke manual após deploy complementa
a suíte. Em falha E2E no CI, os traces e relatórios são publicados por três dias;
tratar os artefatos como sensíveis. A stack é parada mesmo em falha.

## 3. Preparação Do Banco De Entrega

Antes de aplicar migrations remotamente, identificar o ambiente e validar o
project ref, o backup e a sequência de promoção conforme
[Ambientes](ambientes.md) e [Supabase CLI](supabase-cli.md).

- Aplicar primeiro em staging e validar o schema e as RPCs.
- Confirmar banco alinhado às migrations da versão aprovada.
- Manter RLS nas tabelas operacionais e validar isolamento por operador.
- Manter migrations históricas imutáveis.
- Não executar reset remoto como parte do teste local.

Não existe reset remoto no PR09. O provisionamento de produção executa dry-run
de migration antes do push real e bloqueia diante de divergência. Restore,
delete e SQL manual também são proibidos pela automação.

## 4. Acessos E Segredos

No corte técnico, conferir:

- exatamente um admin oficial e nenhum outro usuário;
- banco operacional vazio, sem produtos, estoque, caixas ou vendas;
- signup público desabilitado conforme a política do projeto;
- `leaked password protection` habilitada no Supabase Auth;
- senha administrativa operacional conhecida somente pelos autorizadores;
- usuários temporários desativados quando não fizerem parte da operação;
- segredos e senhas expostos durante homologação rotacionados;
- secrets do GitHub e variáveis Vercel atualizados após a rotação;
- arquivos locais com credenciais fora do versionamento.

Antes da liberação operacional, cadastrar vendedores reais manualmente pelo
sistema, entregar acessos por canal seguro e validar duas sessões independentes.

A `publishable key` é pública. `SUPABASE_SECRET_KEY`, senha do banco, tokens de
deploy e senhas operacionais são privados. Não usar valores de homologação como
segredos definitivos de produção.

## 5. Dados De Homologação E Dados Reais

- Executar QA em ambiente isolado; guardar evidências antes do reset local.
- Não levar produtos, vendas ou caixas de teste para a base de entrega.
- O bootstrap prepara somente o administrador; não criar vendedores por seed.
- Cadastrar vendedores, produtos e saldo inicial manualmente pela aplicação
  depois que o corte técnico estiver verificado.
- Conferir ausência de caixas de teste abertos e usuários temporários ativos.
- Se uma operação de teste controlado ocorrer em produção, preservar o histórico
  e registrar a compensação por cancelamento quando aplicável.
- Não apagar vendas ou movimentações financeiras para limpar relatórios reais.

## 6. Corte Técnico PR09-A

Todos os itens começam pendentes e só podem ser marcados com saída real e
redigida registrada em [PR09 - corte de produção](evidencias/pr09-production-cutover.md):

- [ ] Branch `feature/production-cutover` e commit assinado congelados.
- [ ] Gates locais completos e checks do PR09-A verdes.
- [ ] Staging legado `gpywbeoqcovjrfnmbdqx` confirmado `INACTIVE`.
- [ ] Staging Roberto `otsxpchqtfypxgzjzrxs` confirmado `ACTIVE_HEALTHY`.
- [ ] Produção legada `ciixpfquwmlsvzleattv` confirmada `ACTIVE_HEALTHY`.
- [ ] Projeto Vercel `prj_oBs2uc7uxsHMc7ssHFKczfi52LMq` confirmado vazio.
- [ ] Inventário recente, hash íntegro e origem legada exata confirmados.
- [ ] Organização, ref, topologia, evidência e rollback apresentados ao dono.
- [ ] Confirmação literal nova recebida imediatamente antes da pausa:

```text
CONFIRMO PAUSAR A PRODUÇÃO LEGADA espaco-personalize-pdv DA ORGANIZAÇÃO wcqoluxxlvglqtebcucz, REF ciixpfquwmlsvzleattv
```

- [ ] Produção legada chegou a `INACTIVE`; staging Roberto permaneceu saudável.
- [ ] Vaga gratuita confirmada antes da criação da produção Roberto.
- [ ] Produção Roberto criada somente em `sa-east-1`; identidade completa validada.
- [ ] Novo ref/hostname persistidos em commit assinado antes das migrations.
- [ ] Migration dry-run e push real aprovados; Auth exato validado.
- [ ] Bootstrap resultou em um admin, zero operadores e banco vazio.
- [ ] Vercel recebeu exatamente três variáveis `Production`, com secret sensível.
- [ ] Deployment provisório do SHA autorizado ficou `READY` e sem bypass/proteção.
- [ ] Verificação remota e smoke autenticado somente leitura aprovados.
- [ ] Logs e disponibilidade observados por 30 minutos, sem lacunas.
- [ ] PR09-A revisado, checks repetidos e mergeado em `develop` pelo fluxo oficial.

Qualquer identidade divergente, evidência inválida, cota indisponível, criação
parcial, falha de migration/Auth/bootstrap/deploy/smoke/check/monitoramento ou
segredo em saída interrompe o corte. Preserve o estado; não delete, restaure ou
reinicialize projeto automaticamente.

## 7. Release PR09-B

- [ ] PR de `develop` para `main` contém somente mudanças já revisadas.
- [ ] Quality, Database contract e E2E Release Gate verdes, sem bypass.
- [ ] Merge produz commit assinado e compatível com histórico linear.
- [ ] Audit Vercel permite `main` e confirma as três variáveis inalteradas.
- [ ] Deploy final usa o SHA assinado resultante de `main`.
- [ ] Gate final recebeu deployment ID, URL imutável, `source-ref main` e o
      mesmo SHA assinado, sem reescrever manifesto ou estado versionado.
- [ ] Fingerprint das três variáveis do deployment corresponde à URL e às
      chaves lidas do Supabase de produção, sem expor seus valores.
- [ ] Deployment, alias, banco, admin único e banco vazio foram revalidados.
- [ ] Smoke somente leitura e monitoramento de 30 minutos aprovados.
- [ ] Produção legada permanece pausada e preservada por 30 dias.

## 8. Preparação E Smoke Operacional

Somente depois do corte técnico, cadastrar vendedores, produtos e estoque
inicial manualmente pelo sistema. Com o responsável, executar teste controlado
e guardar evidências:

1. Fazer login e conferir painel e PWA.
2. Conferir produto real e saldo.
3. Abrir o próprio caixa e confirmar sua identificação no PDV.
4. Realizar uma venda e consultá-la em `/sales`.
5. Cancelar quando for teste controlado e conferir estoque e financeiro.
6. Fechar com dinheiro contado e conferir diferença.
7. Reabrir no mesmo dia para validar nova sessão e fechar novamente.
8. Conferir `/reports`, filtros e CSV.
9. Confirmar acesso aos logs de runtime.
10. Com dois vendedores reais e navegadores separados, abrir caixas simultâneos,
    vender sem mistura financeira e conferir o relatório consolidado/individual.

Se algum passo falhar, bloquear a liberação operacional, corrigir em
`feature/*` a partir de `develop` e repetir a validação. O smoke completo e a
validação com usuários separados estão no
[Runbook operacional](runbook-operacional.md).

## 9. Primeiro Dia E Acompanhamento

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

## 10. Rollback E Critério De Liberação

Antes de escritas reais, o rollback exige bloquear o novo ambiente, pausar o
novo Supabase, revalidar o ref legado, obter nova autorização e restaurar o
legado manualmente. Depois de escritas, interrompa operações, preserve ambos os
estados e faça reconciliação manual; não apague histórico financeiro.

O legado permanece pausado por 30 dias. Não há exclusão automática ou agendada;
qualquer descarte futuro exige outra autorização explícita com organização,
nome e ref.

A operação só pode ser liberada após checks e gate E2E aprovados, ambiente correto,
acessos reais, estoque preparado, segredos revisados, smoke validado e responsável
operacional orientado. Pendências de ambiente e release precisam ser resolvidas
nos PRs correspondentes; este checklist não substitui esses gates.
