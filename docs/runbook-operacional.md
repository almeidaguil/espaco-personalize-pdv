# Runbook Operacional

Roteiro diário de operação da loja física Roberto Multimarcas. Use junto com o
[Manual do usuário final](manual-usuario-final.md) e o
[Checklist de go-live](checklist-go-live.md).

## Responsabilidades

- Admin: gerencia acessos, produtos e estoque; consulta todos os caixas; autoriza
  cancelamentos e faltas; executa fechamento administrativo em contingência.
- Operador: entra com a própria conta, abre seu caixa, vende, consulta suas vendas
  e fecha sua sessão.
- Responsável financeiro: função da equipe que confere dinheiro, diferenças,
  relatórios e CSV, respeitando o perfil de acesso atribuído no sistema.

Cada operador mantém no máximo um caixa aberto. Vários operadores podem trabalhar
simultaneamente. O admin também pode abrir o próprio caixa e vender. O estoque é
compartilhado; vendas e financeiro permanecem vinculados à sessão e ao operador.

## Início Do Dia/Turno

1. Confirmar internet e abertura do PWA nos dispositivos.
2. Confirmar acesso ativo de admins e operadores.
3. Conferir produtos ativos em `/products` e estoque em `/stock`.
4. Definir quem atenderá às autorizações administrativas e contingências.
5. Cada operador entra com a própria conta e confere `Meu caixa` no painel.
6. Sem sessão aberta, acessa `/cash/open`, informa `Valor inicial` e abre o caixa.
7. Acessa `/pdv` e confere a identificação da própria sessão.
8. O admin confere `Caixas abertos` no painel quando houver vários vendedores.

Se um caixa já estiver aberto, confirme se é a sessão que deve continuar.
Não abra outra sessão para o mesmo operador antes de fechar a anterior.
A data operacional é calculada na abertura no fuso de São Paulo e permanece
mesmo se a sessão atravessar a meia-noite.

Bloqueie o início das vendas se o login falhar, o próprio caixa não puder ser
aberto, os produtos ou saldos estiverem incorretos ou o dispositivo estiver
sem conexão.

## Durante A Operação

Para cada venda:

1. Buscar produto por nome ou SKU, adicionar e conferir quantidade e saldo.
2. Conferir total e forma de pagamento.
3. Para dinheiro, informar valor recebido e conferir troco.
4. Para Pix ou cartão, confirmar o recebimento na conta ou no terminal da loja.
5. Finalizar e aguardar a confirmação antes da próxima venda.

O PDV localiza automaticamente o caixa do usuário autenticado. Não existe escolha
de outro vendedor para registrar a venda. Não recarregue durante a finalização.
Se a resposta for incerta, consulte `/sales` antes de repetir a operação.

## Cancelamento

1. Localizar a venda em `/sales` e abrir o detalhe.
2. Conferir itens, valor, operador e sessão.
3. Solicitar autorização de um admin ativo.
4. Informar a senha administrativa, marcar a confirmação e cancelar.
5. Conferir status cancelado, reposição do estoque e resultado no relatório.

A venda permanece no histórico. Após fechamento do caixa, o cancelamento produz
ajuste financeiro separado na data do cancelamento e preserva o resumo do
fechamento original.

## Fechamento, Reabertura E Contingência

1. Parar novas vendas na sessão e aguardar operações em andamento.
2. Acessar `/cash/close` e conferir vendedor, horário e identificação da sessão.
3. Conferir valor inicial, vendas, esperado e cancelado.
4. Contar somente o dinheiro físico e preencher `Valor contado no caixa`.
5. Se houver falta, reconferir e solicitar senha administrativa se persistir.
6. Fechar e aguardar confirmação.
7. Conferir a sessão e a diferença em `/reports`.

Pix, crédito e débito são conciliados, mas não entram no dinheiro físico esperado.
Fechar um caixa não interrompe os outros. O mesmo operador pode abrir outra sessão
no mesmo dia em `/cash/open`; o novo valor inicial e histórico são independentes.

Se o operador estiver indisponível, o admin entra com a própria conta e fecha
o caixa dele em `/cash/close`, conferindo nome, horário e sessão antes da ação.
O responsável pelo fechamento é registrado. Para vender durante a contingência,
o admin abre ou utiliza o próprio caixa.

## Encerramento Do Dia

1. Encerrar novas vendas e conferir operações ainda em andamento.
2. Cada operador fecha o próprio caixa.
3. O admin confere se ficou algum caixa aberto e trata a contingência necessária.
4. Revisar vendas, cancelamentos e diferenças de fechamento.
5. Em `/reports`, aplicar o período operacional e consolidar os vendedores
   permitidos; detalhar sessões quando houver divergência.
6. Exportar CSV e guardar conforme a rotina financeira da loja.
7. Registrar incidentes e pendências para o próximo turno.

## Falhas E Respostas Rápidas

### Sem Conexão

1. Interromper novas operações.
2. Conferir internet; trocar para rede segura disponível, se necessário.
3. Reconectar e recarregar a página.
4. Consultar a última venda em `/sales` antes de repetir uma tentativa incerta.
5. Retomar depois que o aviso desaparecer e o PDV carregar normalmente.

Nesta versão não há venda offline.

### Produto Ausente Ou Sem Saldo

1. Limpar busca por nome/SKU.
2. Conferir produto ativo em `/products` e saldo em `/stock`.
3. Admin corrige cadastro ou registra movimentação quando necessário.
4. Recarregar o PDV e conferir o produto.

### Venda Sem Confirmação

1. Consultar `/sales` antes de reenviar.
2. Se a venda existir, conferir itens, valor e sessão e seguir a operação.
3. Se não existir, conferir caixa próprio aberto, estoque e pagamento.
4. Se houver dúvida sobre o resultado, parar e chamar o admin.
5. Registrar horário, mensagem e IDs de operador, caixa e venda, quando disponíveis.
6. Consultar logs conforme [Observabilidade](observabilidade.md), sem credenciais.

### Falta No Caixa

1. Reconferir dinheiro físico, vendas, troco e cancelamentos.
2. Separar pagamentos digitais da contagem física.
3. Se a diferença persistir, solicitar autorização administrativa para fechar.
4. Guardar a divergência com a conferência financeira da sessão.

### Acesso Bloqueado

1. Conferir e-mail e senha com o usuário.
2. Admin verifica se o acesso está ativo em `/settings`.
3. Redefinir senha quando necessário e entregá-la por canal seguro.
4. Se houver caixa pendente de usuário indisponível, executar fechamento
   administrativo após a conferência.

## Provisionamento Controlado Do PR08

Antes de qualquer acesso remoto, execute os dry-runs e revise
`config/remote-environments.json`:

```powershell
npm.cmd run ops:verify-target -- --provider supabase --environment legacy-staging --operation read
npm.cmd run ops:inventory-staging -- --confirm-ref gpywbeoqcovjrfnmbdqx
npm.cmd run ops:provision-staging
npm.cmd run ops:provision-vercel -- --phase configure-staging
npm.cmd run ops:provision-vercel -- --phase deploy-staging
npm.cmd run ops:provision-vercel -- --phase verify-staging
```

Regras obrigatórias:

1. Produção legada `ciixpfquwmlsvzleattv` deve estar saudável antes e depois
   de toda mutação.
2. A pausa do staging `espaco-personalize-pdv-staging`, ref
   `gpywbeoqcovjrfnmbdqx`, exige confirmação explícita imediatamente antes da
   execução; autorização anterior ou genérica não substitui esse checkpoint.
3. Não excluir projetos. O novo staging parcial é preservado para diagnóstico.
4. Não usar `db reset` remoto, não aplicar SQL manual e não criar produção no
   PR08.
5. O projeto Vercel dedicado `roberto-multimarcas-pdv-staging` deve usar preset Next.js e Node 22.x. Qualquer
   divergência de conta, project ID, repositório ou framework exige interrupção.
6. O target técnico Production é permitido somente no projeto dedicado terminado em
   `-staging`; o projeto reservado `roberto-multimarcas-pdv` deve permanecer sem
   variáveis, domínios customizados e deployments de qualquer target até o
   PR09; somente seu domínio padrão `.vercel.app` é esperado. O ambiente lógico
   autorizado pelo validador continua sendo exclusivamente `staging`.
7. Tokens, senha do banco e credenciais do admin permanecem somente na sessão.

Depois da criação, registre somente refs/IDs não sensíveis no manifesto,
execute bootstrap idempotente e verificação:

```powershell
npm.cmd run ops:bootstrap-staging-admin -- --execute --confirm-ref <novo-staging-ref>
npm.cmd run ops:verify-staging -- --confirm-ref <novo-staging-ref>
npm.cmd run ops:provision-vercel -- --phase verify-staging --execute --confirm-project prj_fb7pug2hcbCGI1XIMLz5VuMr4S79
npm.cmd run test:e2e:staging-smoke -- --execute --confirm-project prj_fb7pug2hcbCGI1XIMLz5VuMr4S79
```

O smoke remoto é somente leitura: login, dashboard e rotas protegidas. Ele usa
um bypass Vercel temporário, mantém SSO habilitado e exige contagem final zero
de bypasses, mesmo quando o Playwright falha. O comando gerenciado recusa
bypass preexistente, cria e revoga pela API HTTPS sem segredo em argumentos,
não propaga o token Vercel ao navegador e desativa traces para não persistir o
header secreto. Não reutiliza seed/reset E2E local e não cria caixa, produto ou
venda.

Em falha após pausar o staging legado, preserve evidências. Para restaurá-lo,
pause primeiro o novo staging, confirme novamente ambos os refs e respeite o
limite de dois projetos Supabase Free ativos. A produção Vercel legada continua
sendo o rollback imediato. Consulte [Ambientes](ambientes.md),
[Supabase CLI](supabase-cli.md) e [Vercel CLI](vercel-cli.md).

## Corte De Produção Do PR09

O PR09 é dividido em duas entregas. O PR09-A prepara os comandos na branch
`feature/production-cutover`, executa o corte remoto autorizado, valida um
deployment provisório e entra em `develop` por pull request. O PR09-B é o pull
request de `develop` para `main`, seguido do deploy e da verificação do commit
assinado resultante de `main`.

Nenhuma etapa abaixo autoriza antecipadamente uma mutação remota. Execute um
checkpoint por vez, confira a saída real e atualize
[a evidência do PR09](evidencias/pr09-production-cutover.md) sem segredos.

### 1. Preflight Somente Leitura

1. Congelar mudanças concorrentes e confirmar a branch/commit assinados.
2. Confirmar checks locais e do PR09-A verdes.
3. Revalidar o manifesto, a organização Supabase
   `wcqoluxxlvglqtebcucz`, o projeto Vercel
   `prj_oBs2uc7uxsHMc7ssHFKczfi52LMq` e a região `sa-east-1`.
4. Confirmar a topologia: staging legado `INACTIVE`, staging Roberto
   `ACTIVE_HEALTHY`, produção legada `ACTIVE_HEALTHY`, produção Roberto ausente
   e projeto Vercel reservado ainda vazio.
5. Carregar credenciais apenas do Windows Credential Manager para variáveis
   temporárias da sessão. Nunca copie os valores para o comando ou documento.
6. Executar os dry-runs:

```powershell
npm.cmd run ops:verify-target -- --provider supabase --environment legacy-production --operation read
npm.cmd run ops:inventory-production -- --output .provisioning/production-backup/production-backup.json
npm.cmd run ops:provision-production -- --inventory .provisioning/production-backup/production-backup.json
npm.cmd run ops:provision-vercel-production -- --phase audit
```

O `audit` inicial da Vercel é estritamente somente leitura e pode ser executado
antes de existir estado de cutover. Nessa fase ele exige que o projeto reservado
esteja vazio; as fases `configure` e `deploy` continuam bloqueadas até o estado
correspondente do corte.

O inventário é somente leitura e precisa identificar a produção legada exata.
Antes da pausa, confira origem, hash, integridade e idade máxima de uma hora da
evidência. Ela registra schema, migrations, contagens, Auth e Storage sem dados
de linhas, e-mails, hashes de senha ou objetos.

### 2. Autorização Explícita Da Pausa

Imediatamente antes da pausa, apresente ao proprietário organização, nome, ref,
região, topologia ativa, hash/idade da evidência e o rollback. Solicite esta
frase exata, sem aceitar aprovação anterior, abreviada ou genérica:

```text
CONFIRMO PAUSAR A PRODUÇÃO LEGADA espaco-personalize-pdv DA ORGANIZAÇÃO wcqoluxxlvglqtebcucz, REF ciixpfquwmlsvzleattv
```

Sem essa confirmação nova, pare. Depois de recebê-la, execute uma única vez:

```powershell
npm.cmd run ops:provision-production -- --inventory .provisioning/production-backup/production-backup.json --execute --confirm-legacy-ref ciixpfquwmlsvzleattv --confirm-target-name roberto-multimarcas-pdv
```

O provisionador deve pausar somente `ciixpfquwmlsvzleattv`, esperar
`INACTIVE`, confirmar que o staging continua saudável e só então criar
`roberto-multimarcas-pdv` em `sa-east-1`. Se qualquer identidade ou estado
divergir, interrompa sem tentar corrigir pelo painel.

### 3. Persistência E Banco Novo

1. Validar organização, nome, novo ref, região e hostname retornados.
2. Persistir apenas o ref e hostname comprovados em
   `config/remote-environments.json`.
3. Executar os testes dirigidos e criar commit assinado antes de continuar.
4. Retomar com o ref persistido:

```powershell
npm.cmd run ops:provision-production -- --inventory .provisioning/production-backup/production-backup.json --execute --confirm-target-ref <production-ref>
```

Se a criação remota concluir, mas o polling ou a gravação local falhar, use esse
mesmo comando com o ref exato observado. O provisionador reconcilia
organização, nome, região, hostname e ref, registra `production-created` e não
cria um segundo projeto. Depois de `legacy-paused`, a evidência pode ter mais de
uma hora, mas deve ser exatamente o mesmo artefato registrado: origem,
`capturedAt` e SHA-256 divergentes bloqueiam a retomada.

Esse passo executa `supabase db push --linked --dry-run` antes do push real e
configura o Auth. Signup público deve permanecer desabilitado, a senha mínima
deve ter 14 caracteres, proteção contra senhas vazadas deve estar ativa e a URL
de site deve ser exatamente `https://roberto-multimarcas-pdv.vercel.app`.

Nunca execute `supabase db reset`, SQL manual, restore ou delete em projeto
remoto. Em falha de migration, preserve o projeto parcial e o estado retomável.

### 4. Administrador Único E Banco Vazio

Carregue e-mail, nome e senha somente do Credential Manager para
`PRODUCTION_ADMIN_EMAIL`, `PRODUCTION_ADMIN_FULL_NAME` e
`PRODUCTION_ADMIN_PASSWORD`, sem exibi-los. Execute:

```powershell
npm.cmd run ops:bootstrap-production-admin -- --execute --confirm-ref <production-ref>
```

O resultado aceitável é exatamente um perfil `admin`, zero operadores e zero
linhas operacionais. Usuário extra, papel divergente, e-mail diferente ou dado
operacional existente bloqueiam o corte; não sobrescreva nem limpe registros.

### 5. Vercel De Produção

O alvo exclusivo é `prj_oBs2uc7uxsHMc7ssHFKczfi52LMq`. Configure exatamente
as três variáveis de produção, mantendo `SUPABASE_SECRET_KEY` sensível, e
publique somente o commit assinado autorizado:

```powershell
npm.cmd run ops:provision-vercel-production -- --phase audit --execute --confirm-project prj_oBs2uc7uxsHMc7ssHFKczfi52LMq
npm.cmd run ops:provision-vercel-production -- --phase configure --execute --confirm-project prj_oBs2uc7uxsHMc7ssHFKczfi52LMq
npm.cmd run ops:provision-vercel-production -- --phase deploy --source-ref feature/production-cutover --commit-sha <signed-commit-sha> --execute --confirm-project prj_oBs2uc7uxsHMc7ssHFKczfi52LMq
npm.cmd run ops:provision-vercel-production -- --phase verify --execute --confirm-project prj_oBs2uc7uxsHMc7ssHFKczfi52LMq
```

Exija preset Next.js, Node.js 22.x, deployment `READY`, URL imutável, alias
estável e ausência de Vercel Authentication e bypass. Não altere o staging nem
o projeto Vercel legado e não crie domínio customizado.

### 6. Verificação, Smoke E Monitoramento

Execute a verificação remota e o smoke autenticado somente leitura:

```powershell
npm.cmd run ops:verify-production -- --confirm-ref <production-ref>
npm.cmd run test:e2e:production-smoke
```

O smoke cobre redirecionamento sem sessão, login do administrador e navegação
por dashboard, produtos, PDV, caixa, vendas, estoque e relatórios. Ele não cria
produto, estoque, caixa, venda, pagamento ou cancelamento, não cria bypass e não
usa variáveis `STAGING_*`.

Após cada deploy provisório ou final, observe por 30 minutos consecutivos:

- disponibilidade da URL estável e da URL imutável;
- logs de runtime e falhas de autenticação;
- erros críticos `sale.create.failed`, `sale.cancel.failed` e
  `cash.close.failed`;
- correspondência entre deployment, commit e manifesto.

Registre verificações no início, a cada cinco minutos e ao fim. Qualquer lacuna
de monitoramento, resposta incompleta ou estado desconhecido é falha e bloqueia
merge, release ou liberação operacional.

No PR09-B, repita audit, deploy, verificação, smoke e monitoramento usando
`--source-ref main` e o SHA assinado resultante do merge, sem alterar as três
variáveis. Não promova `main` enquanto o estado remoto for desconhecido.

O deploy final não altera o manifesto nem o estado terminal do deploy
provisório. Capture `deploymentId` e `deploymentUrl` retornados pelo Vercel e
execute o gate read-only ligado explicitamente ao SHA de `main`:

```powershell
npm.cmd run ops:provision-vercel-production -- --phase deploy --source-ref main --commit-sha <signed-main-sha> --execute --confirm-project prj_oBs2uc7uxsHMc7ssHFKczfi52LMq
npm.cmd run ops:provision-vercel-production -- --phase verify --source-ref main --commit-sha <signed-main-sha>
$env:PRODUCTION_BASE_URL = "<immutable-main-deployment-url>"
npm.cmd run ops:verify-production -- --confirm-ref <production-ref> --deployment-id <main-deployment-id> --deployment-url <immutable-main-deployment-url> --source-ref main --commit-sha <signed-main-sha>
npm.cmd run test:e2e:production-smoke -- --deployment-id <main-deployment-id> --deployment-url <immutable-main-deployment-url> --source-ref main --commit-sha <signed-main-sha>
```

O verificador resolve `origin/main`, confere o source Git e o alias no Vercel e
recalcula em memória o fingerprint da URL e das duas chaves obtidas diretamente
do Supabase de produção. Divergência entre esse fingerprint e a metadata do
deployment bloqueia o release; valores e chaves nunca são registrados.

### 7. Condições De Parada

Pare imediatamente se ocorrer qualquer item:

- organização, nome, ref, região, hostname, project ID ou commit divergente;
- evidência ausente, adulterada ou com origem incorreta; antes da pausa, também
  com mais de uma hora;
- staging Roberto ou produção legada sem estado saudável antes da pausa;
- produção legada sem chegar a `INACTIVE` ou cota gratuita sem vaga;
- projeto desconhecido ativo ou mais de dois projetos Supabase ativos;
- criação parcial, migration dry-run/real, Auth ou bootstrap com falha;
- Vercel reservado não vazio antes da configuração ou com proteção divergente;
- variável extra, deployment sem `READY`, alias divergente ou bypass ativo;
- verificação, smoke, checks, assinatura ou monitoramento com falha;
- qualquer segredo ou e-mail pessoal aparecendo em saída persistida.

Preserve o estado parcial e as evidências redigidas. A automação não deve
excluir, restaurar, reinicializar nem improvisar correções remotas.

### 8. Rollback Manual

Antes de qualquer produto, estoque, caixa ou venda real:

1. bloquear acesso ao ambiente novo;
2. pausar manualmente o Supabase novo para liberar a cota;
3. revalidar a produção legada `espaco-personalize-pdv`, organização
   `wcqoluxxlvglqtebcucz` e ref `ciixpfquwmlsvzleattv`;
4. solicitar outra autorização explícita para a restauração;
5. restaurar manualmente o legado pelo procedimento do provedor;
6. validar Auth, API e aplicação legada antes de liberar acesso;
7. preservar a produção nova para diagnóstico e registrar o incidente.

Depois de escritas operacionais, interrompa novas operações e preserve os dois
estados. Inventarie as escritas na produção nova e decida a reconciliação
manualmente antes de restaurar o legado. Não apague histórico financeiro.

A produção legada permanece pausada por 30 dias. Ao fim da janela, nenhuma
exclusão é automática: organização, nome e ref exigem nova autorização literal.

### 9. Preparação Operacional Posterior

O corte técnico termina com somente o administrador e o banco operacional
vazio. O proprietário cadastra manualmente pela aplicação, nesta ordem:

1. vendedores e acessos individuais;
2. produtos;
3. estoque inicial;
4. primeiro caixa e fluxo controlado de venda/cancelamento;
5. conferência de estoque, fechamento e relatório.

Depois que existirem duas contas reais, valide dois operadores em navegadores
separados, com caixas simultâneos e isolamento financeiro. Essa validação é
obrigatória para declarar concluído o primeiro marco operacional da loja.

## Smoke Test De Release Ou Primeiro Uso

Execute primeiro em ambiente isolado de homologação com o schema da versão.
No Supabase local exclusivo de testes, executar `npm run test:e2e:local-reset`:
o comando destrutivo reinicializa somente a base local, reaplica migrations,
cria ou atualiza admin e operadores A/B com credenciais efêmeras e executa a
suíte obrigatória. Recusa URLs remotas e project ref; não faz bootstrap remoto.
O workflow usa essa mesma stack efêmera em PRs para `develop` e `main`, sem
secrets, e para o Supabase mesmo em falha.

1. Fazer login e conferir painel e permissões.
2. Cadastrar produto e registrar saldo inicial.
3. Abrir caixa próprio e conferir associação automática no PDV.
4. Fazer venda em dinheiro com troco e venda em Pix ou cartão.
5. Conferir vendas e baixa de estoque.
6. Cancelar uma venda e conferir histórico, estoque e financeiro.
7. Fechar, conferir valores e reabrir no mesmo dia; fechar a nova sessão.
8. Com dois usuários em sessões de navegador separadas, conferir caixas
   simultâneos, associação de cada venda e continuidade ao fechar um dos caixas.
9. Conferir consulta restrita do operador e fechamento administrativo de outro
   caixa em contingência.
10. Conferir consolidado do período, filtros por vendedor/sessão e CSV.

Registre o resultado do smoke manual após deploy. O gate do PR07 já automatiza
caixas independentes, concorrência de abertura/vendas/fechamento, isolamento,
contingência auditada e relatórios/CSV multioperador, sem skips autenticados.
Os contextos de navegador e clientes são separados por identidade; a preparação
financeira usa RPCs. Traces e relatórios do CI são publicados somente em falha
E2E, por três dias, e podem conter sessões efêmeras sensíveis.
Não reutilize o reset local ou as credenciais de teste em produção.

Após deploy, o smoke de produção deve ser controlado pelo responsável: usar
cadastros reais, registrar o teste e compensar a venda por cancelamento quando
aplicável. Não apagar histórico financeiro para ocultar o teste.

## Critérios De Bloqueio

Interrompa a operação e corrija antes de vender se houver:

- login indisponível ou caixa próprio inacessível;
- venda atribuída ao operador ou caixa errado;
- acesso do operador a caixa ou venda alheia;
- venda confirmada ausente do histórico;
- estoque negativo ou cancelamento sem reposição;
- fechamento sem conferência registrada;
- relatórios/CSV com divergência não explicada;
- conexão instável que impeça confirmar as operações.

Guarde os registros financeiros do dia. Desative acessos temporários sem apagar
histórico. Correções seguem em `feature/*` a partir de `develop`, com checks e PR.
