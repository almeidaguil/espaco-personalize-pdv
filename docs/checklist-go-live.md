# Checklist De Go-Live

Checklist para validação e liberação contínua da operação da loja física
Roberto Multimarcas.

A reestruturação para loja física com caixa por operador, pagamentos divididos,
descontos auditados e módulo de estoque integrado foi concluída nas versões
`v2.0.0` e `v2.1.0`, com deploy em produção e tags publicadas no GitHub.
A produção Roberto opera ativamente com dados reais preservados. Qualquer nova
evolução segue rigorosamente os checkpoints abaixo antes de ser promovida.

## Regra De Release

O último release publicado é `v2.2.0`. A correção de vulnerabilidades de
segurança do npm e alinhamento de tipos do Next.js App Router atualiza a
versão para `2.2.1`. Toda alteração de código deve respeitar o
versionamento semântico (SemVer):

- **Patch (2.2.x)**: correções de bugs, ajustes de documentação ou refatorações
  sem alteração de contratos;
- **Minor (2.x.0)**: adição de novas funcionalidades retrocompatíveis;
- **Major (x.0.0)**: mudanças incompatíveis com contratos de banco, APIs ou
  fluxos operacionais existentes.

`package.json` e `package-lock.json` devem permanecer alinhados à versão vigente.
A tag Git e a release no GitHub só podem ser criadas após o merge em `main`,
deploy bem-sucedido na Vercel de produção, verificação de conformidade e smoke
test aprovado.

**Regra mandatória de promoção:** Nenhum deploy em produção deve acontecer sem
que a versão correspondente tenha sido previamente deployada e testada em staging.

1. Concluir a alteração em branch `feature/*`, com commits assinados.
2. Integrar em `develop` por pull request com checks de qualidade e E2E aprovados.
3. Realizar o deploy do commit integrado em staging (`ops:rollout-staging`) e
   executar a validação e testes no ambiente de staging. Nenhum deploy em
   produção é permitido sem esta etapa concluída e aprovada. Se houver
   migrations, validar aplicação coordenada em staging antes de produção.
4. Somente após a aprovação e validação em staging, abrir pull request de release
   de `develop` para `main` e revisar o diff.
5. Fazer merge em `main` via pull request.
6. Realizar deploy do commit exato de `main` na Vercel de produção.
7. Executar `ops:verify-production` e `test:e2e:production-smoke` somente leitura.
8. Monitorar por 30 minutos e publicar a tag assinada da versão correspondente.

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
- RPCs `open_cash_session_v3`, `finalize_sale_v5`, `cancel_sale` e
  `close_cash_session_v2` disponíveis; fechamento legado sem permissão de
  execução para usuários da aplicação;
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

- Aplicar primeiro em staging e validar o schema e as RPCs usando as fases coordenadas descritas em
  [Promoção para staging](vercel-cli.md#promover-uma-vers%C3%A3o-para-staging).
  Não aplicar o corte legado antes do deploy e do smoke financeiro aprovados.
- Em produção, usar a sequência protegida
  [Promoção para produção](vercel-cli.md#promover-uma-vers%C3%A3o-para-produ%C3%A7%C3%A3o):
  backup recente e verificado, migration foundation, deployment do SHA exato de
  `main`, migration cutover, verificação completa e smoke somente leitura.
- Confirmar banco alinhado às migrations da versão aprovada.
- Manter RLS nas tabelas operacionais e validar isolamento por operador.
- Manter migrations históricas imutáveis.
- Não executar reset remoto como parte do teste local.

Não existe reset remoto no PR09. O provisionamento de produção executa dry-run
de migration antes do push real e bloqueia diante de divergência. Restore,
delete e SQL manual também são proibidos pela automação.

## 4. Acessos E Segredos

O baseline inicial do corte PR09-A exigia somente um administrador e banco
operacional vazio. Esse requisito histórico não se aplica à promoção 2.0.0: a
produção atual contém contas e dados operacionais autorizados. Para esta
release, conferir:

- contas existentes e seus papéis autorizados, sem exigir exatamente um admin;
- inventário de produtos, vendas, pagamentos, estoque e caixas preservado antes
  e depois das migrations; não exigir banco operacional vazio;
- signup público desabilitado conforme a política do projeto;
- `leaked password protection` habilitada no Supabase Auth ou, no plano Free,
  exceção explícita registrada como `unavailable-free-plan`, sem reduzir os
  demais controles;
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
- [ ] Projeto Vercel `prj_oBs2uc7uxsHMc7ssHFKczfi52LMq` inventariado: recursos
      preexistentes preservados; reconciliação e autorização específicas do
      PR09 concluídas antes de qualquer mutação.
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

- [x] PR #191 promoveu o snapshot revisado para `main`; merge assinado
      `41b83edab9c78a583e1bb2f1c7df750911ec566b`.
- [x] Quality e E2E Release Gate pós-merge verdes, sem bypass.
- [x] Merge produziu commit assinado e compatível com histórico linear.
- [ ] Audit Vercel permite `main` e confirma as três variáveis inalteradas.
- [ ] Deploy final usa o SHA assinado resultante de `main`.
- [ ] Gate final recebeu deployment ID, URL imutável, `source-ref main` e o
      mesmo SHA assinado, sem reescrever manifesto ou estado versionado.
- [ ] Fingerprint das três variáveis do deployment corresponde à URL e às
      chaves lidas do Supabase de produção, sem expor seus valores.
- [ ] Deployment, alias e banco foram revalidados. A exigência de um único
      admin e banco vazio vale para o primeiro provisionamento; depois da
      operação validada, preservar os dados existentes, exigir perfis ligados
      a usuários Auth com papéis permitidos e verificar os invariantes
      financeiros antes/depois das migrations.
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
