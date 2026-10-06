# Manual Do Usuário Final

Este manual orienta a operação diária da loja física Roberto Multimarcas.
O sistema é privado, exige login e pode ser instalado como PWA.

## Perfis E Responsabilidades

O operador abre o próprio caixa, vende, consulta suas vendas e fecha sua sessão.
Pode consultar produtos, estoque e relatórios dentro das permissões de acesso.
Não pode operar nem fechar o caixa de outro vendedor.

O admin gerencia produtos, ajustes de estoque e usuários em `Configurações`,
consulta todos os caixas e vendas e executa fechamento administrativo em
contingência. Também pode abrir o próprio caixa e vender, seguindo as mesmas
regras dos operadores.

Cada usuário pode manter no máximo um caixa aberto por vez. Operadores
diferentes podem ter caixas abertos simultaneamente. O estoque é compartilhado
pela loja; as vendas e os pagamentos ficam vinculados ao operador e ao seu caixa.

## Preparação Do Dia Ou Turno

Antes de começar, confirme:

- acesso ativo do operador e disponibilidade de um admin;
- internet no dispositivo;
- produtos ativos cadastrados e saldos corretos em `/stock`;
- dinheiro inicial disponível para abrir o próprio caixa.

O cadastro de produto não acrescenta estoque: o admin registra o saldo por
movimentação em `/stock`. Vendas, caixa, estoque e relatórios dependem de conexão
com o servidor nesta versão.

## Login E Instalação Do App

1. Acesse `/login` e informe `E-mail` e `Senha`.
2. Use `Mostrar` se precisar conferir a senha e `Lembrar e-mail` se desejar
   guardar o e-mail no dispositivo.
3. Clique em `Entrar` e confira o painel em `/dashboard`.

Se esquecer a senha, solicite a redefinição a um admin em `/settings`.
Nesta versão não há recuperação autônoma de senha pelo usuário.

Para instalar o PWA, abra o sistema no navegador e use `Instalar app`,
`Adicionar à tela inicial` ou a opção equivalente. Confirme e abra o app instalado.
Se aparecer `Sem conexão`, interrompa a operação e reconecte o dispositivo.

## Abrir O Próprio Caixa

1. Confira `Meu caixa` no painel.
2. Se ainda não houver caixa aberto, acesse `/cash/open`.
3. Informe `Valor inicial`, correspondente ao dinheiro físico disponível.
4. Clique em `Abrir caixa` e aguarde a confirmação.
5. Abra `/pdv` e confira a identificação da sua sessão.

O sistema associa a abertura ao usuário autenticado e calcula a data operacional
no fuso de São Paulo. Se o seu caixa já estiver aberto, continue nessa sessão.
Uma segunda abertura simultânea para o mesmo usuário é recusada.

## Realizar Uma Venda

1. Acesse `/pdv` e confira o seu caixa aberto.
2. Em `Buscar produto`, pesquise por nome ou SKU.
3. Clique em `Adicionar` e ajuste as quantidades com `+` e `-`.
4. Confira os itens, o estoque disponível e o total.
5. Escolha `Dinheiro`, `Pix`, `Cartão de crédito` ou `Cartão de débito`.
6. Para dinheiro, informe `Valor recebido` e confira o troco. O valor deve cobrir
   o total. Nos demais meios, `Valor do pagamento` corresponde ao total da venda.
7. Confirme o recebimento e clique em `Finalizar venda`.
8. Aguarde a mensagem de sucesso antes de iniciar outra venda.

O PDV usa automaticamente o caixa aberto do usuário autenticado. Sem esse caixa,
a tela orienta a abertura e bloqueia a finalização. O servidor valida identidade,
caixa, produtos, preços, estoque e pagamento ao concluir a operação.

A venda registra itens, pagamento e baixa de estoque. Pix e cartão são registrados
no sistema; a confirmação do recebimento ocorre na conta ou no terminal usado
pela loja, sem integração automática com esses serviços.

## Consultar E Cancelar Vendas

1. Acesse `/sales`.
2. Use os filtros de período operacional, operador, sessão de caixa e status.
3. Clique em `Filtrar` e abra a venda em `/sales/[id]` para conferir os detalhes.

Operadores consultam as próprias vendas; admins podem consultar todas.
O período operacional considera a data de abertura do caixa no fuso de São Paulo.

Para cancelar, solicite autorização administrativa:

1. Confira itens e valores no detalhe da venda.
2. Na seção `Cancelamento da venda`, informe `Senha administrativa` de um admin
   ativo e autorizado.
3. Marque a confirmação e clique em `Cancelar venda`.
4. Aguarde a confirmação e confira o status e a devolução do estoque.

A venda cancelada permanece no histórico. O cancelamento devolve estoque e
compensa o financeiro. Após o fechamento do caixa, gera ajuste financeiro separado
e mantém a conferência original do fechamento; o relatório mostra esse ajuste
na data do cancelamento.

## Fechar E Reabrir Caixa

1. Pare novas vendas e aguarde a conclusão das operações em andamento.
2. Acesse `/cash/close` e confira seu nome, horário de abertura e identificação
   da sessão.
3. Revise `Valor inicial`, `Vendas`, `Esperado` e `Cancelado`.
4. Conte o dinheiro físico e preencha `Valor contado no caixa`.
5. Confira a diferença exibida e clique em `Fechar caixa`.
6. Se houver falta, solicite a senha de um admin ativo para autorizar o fechamento.
7. Aguarde a mensagem de sucesso e confira a sessão no relatório.

O dinheiro esperado considera o valor inicial e os pagamentos em dinheiro,
descontando troco e cancelamentos aplicáveis. Pix, crédito e débito ficam na
conciliação, mas não compõem o dinheiro físico esperado.

Depois de fechar, você pode abrir outra sessão em `/cash/open`, inclusive no
mesmo dia, informando o novo valor inicial. As sessões mantêm históricos separados.
Fechar seu caixa não interrompe caixas de outros operadores.

Em contingência, o admin entra com a própria conta em `/cash/close`, identifica
o caixa do operador e executa a conferência e o fechamento. O sistema registra
quem realizou o fechamento. O admin usa o próprio caixa quando precisa vender.

## Produtos E Estoque

Para cadastrar um produto, o admin acessa `/products`, clica em `Novo produto`,
preenche os campos do formulário e salva. Para editar, abre a edição do produto
na lista. A alteração do cadastro não altera o saldo de estoque.

Para registrar saldo ou correção:

1. O admin acessa `/stock` e localiza `Registrar movimentação`.
2. Escolhe um produto ativo.
3. Seleciona `Ajuste inicial` para entrada positiva ou `Ajuste manual` para
   entrada positiva ou saída negativa.
4. Informa `Quantidade` e clica em `Registrar ajuste`.
5. Confere o saldo e o histórico na mesma tela.

Cada ajuste gera uma movimentação. Vendas e cancelamentos também aparecem no
histórico; o estoque não deve ser corrigido diretamente pelo cadastro de produto.

## Gestão De Usuários

Estas ações estão em `/settings` e são exclusivas do admin:

- Em `Criar operador`, informar nome completo, e-mail e senha temporária e
  clicar em `Criar operador`. A conta é criada com perfil `Operador`.
- Na lista de usuários, alterar `Perfil` entre `Operador` e `Admin` e clicar
  em `Salvar` conforme a responsabilidade da pessoa.
- Em `Nova senha temporária`, informar a nova senha e clicar em `Redefinir`.
  Entregar a credencial por canal seguro.
- Usar `Desativar acesso` ou `Ativar acesso` conforme a necessidade operacional.
  A desativação preserva o histórico.

O admin não pode rebaixar o próprio perfil nem desativar o próprio acesso nessa
tela. Antes de desativar um operador, confira suas pendências e feche o caixa
em contingência, se necessário. Não compartilhe a senha administrativa entre
pessoas que não tenham responsabilidade de autorização.

## Relatórios E Exportação CSV

1. Acesse `/reports`.
2. Informe `Data inicial` e `Data final` do período operacional.
3. Escolha `Vendedor` e `Sessão de caixa` para detalhar ou mantenha todas as
   opções permitidas para consolidar.
4. Clique em `Aplicar filtros`.
5. Confira receita, vendas canceladas, ajustes após fechamento, pagamentos,
   sessões, produtos e divergências.
6. Clique em `Exportar CSV` e confira os dados com os mesmos filtros da tela.

O admin pode consolidar os caixas da loja; o operador consulta apenas os dados
permitidos do próprio usuário. Uma sessão que atravesse a meia-noite mantém a
data operacional calculada na abertura.

## Checklist Diário

No início do dia ou turno: validar acesso, internet, produtos e estoque; abrir
o próprio caixa e conferir a sessão no PDV.

Durante a operação: conferir itens, pagamento e troco; aguardar confirmação;
solicitar admin para cancelamentos, faltas ou contingência de fechamento.

No encerramento do dia: conferir vendas, fechar cada caixa, revisar os relatórios
e guardar o CSV conforme a rotina financeira da loja.

## Solução De Problemas

- Falha de login: confira e-mail e senha; peça ao admin para verificar o acesso
  e redefinir a senha, se necessário.
- Produto ausente: limpe a busca e confira cadastro ativo e saldo em `/stock`.
- Venda bloqueada: confira seu caixa aberto, itens, estoque e valor do pagamento.
  Se a resposta da finalização for incerta, consulte `/sales` antes de tentar
  novamente para evitar duplicidade.
- Sem internet: pare a operação, reconecte e recarregue a página. Confira a
  última venda antes de retomar.
- Caixa com falta: reconte o dinheiro, revise as vendas e solicite autorização
  administrativa se a divergência persistir.

Para a rotina completa e resposta a incidentes, consulte o
[Runbook operacional](runbook-operacional.md).
