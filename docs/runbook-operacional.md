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
npm.cmd run ops:provision-netlify -- --phase site
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
5. Site Netlify indisponível ou produção não comprovadamente bloqueada exige
   interrupção e nova aprovação.
6. Tokens, senha do banco e credenciais do admin permanecem somente na sessão.

Depois da criação, registre somente refs/IDs não sensíveis no manifesto,
execute bootstrap idempotente e verificação:

```powershell
npm.cmd run ops:bootstrap-staging-admin -- --execute --confirm-ref <novo-staging-ref>
npm.cmd run ops:verify-staging -- --confirm-ref <novo-staging-ref>
npm.cmd run ops:provision-netlify -- --phase configure-staging --execute --confirm-site roberto-multimarcas-pdv
npm.cmd run test:e2e:staging-smoke
```

O smoke remoto é somente leitura: login, dashboard e rotas protegidas. Não
reutiliza seed/reset E2E local e não cria caixa, produto ou venda.

Em falha após pausar o staging legado, preserve evidências. Para restaurá-lo,
pause primeiro o novo staging, confirme novamente ambos os refs e respeite o
limite de dois projetos Supabase Free ativos. A produção Vercel legada continua
sendo o rollback imediato. Consulte [Ambientes](ambientes.md),
[Supabase CLI](supabase-cli.md) e [Netlify CLI](netlify-cli.md).

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
