# Manual Do Usuario Final

Este manual explica como usar o Espaco Personalize PDV no dia a dia. O foco e operacao rapida em eventos presenciais.

## Perfis Do Sistema

### Admin

Pode:

- acessar `Configuracoes`;
- criar usuarios;
- promover operador para admin;
- redefinir senha temporaria;
- ativar e desativar acessos;
- cadastrar produtos;
- ajustar estoque;
- criar e finalizar eventos;
- acompanhar relatorios;
- cancelar vendas com senha administrativa;
- autorizar fechamento de caixa com falta.

### Operador

Pode:

- entrar no sistema;
- abrir caixa;
- vender no PDV;
- consultar vendas;
- fechar o proprio caixa;
- consultar produtos, eventos, estoque e relatorios conforme liberado pela navegacao.

Nao pode:

- acessar `Configuracoes` administrativas;
- criar ou promover usuarios;
- alterar regras criticas sem validacao do servidor.

## Antes De Comecar

Antes de iniciar um evento, confirme:

- o usuario consegue entrar em `/login`;
- existe pelo menos um evento ativo;
- os produtos estao cadastrados;
- o estoque foi ajustado em `/stock`;
- o operador que vai vender ja tem acesso criado;
- o caixa sera aberto para o evento correto;
- o dispositivo esta com internet.

Observacoes importantes:

- o sistema e privado e exige autenticacao;
- o sistema agora pode ser instalado como PWA;
- se a conexao cair, o app mostra aviso de `Sem conexao`;
- nesta versao, vendas, caixa, estoque e relatorios dependem de conexao com o servidor;
- cadastro de produto nao adiciona estoque sozinho: o saldo deve ser registrado em `/stock`.

## Como Entrar No Sistema

1. Acesse `/login`.
2. Informe `E-mail`.
3. Informe `Senha`.
4. Se quiser, use `Mostrar` para conferir a senha digitada.
5. Se usar sempre o mesmo dispositivo, marque `Lembrar e-mail`.
6. Clique em `Entrar`.

Se esquecer a senha:

- o proprio usuario nao redefine a senha sozinho nesta versao;
- solicite a redefinicao a um admin em `Configuracoes`.

## Como Instalar Como App

No celular ou computador:

1. Abra o sistema no navegador.
2. Procure a opcao `Instalar app`, `Adicionar a tela inicial` ou equivalente do navegador.
3. Confirme a instalacao.
4. Abra o app instalado normalmente.

Se o dispositivo ficar sem internet:

- o sistema mostra um aviso no topo;
- ao navegar sem conexao, o app pode exibir uma tela informando que e preciso reconectar para continuar usando o PDV.

## Fluxo Do Operador

## 1. Verificar O Painel

Apos o login, o painel mostra o estado operacional do dia. Use os atalhos principais:

- `Produtos`
- `Estoque`
- `Eventos`
- `PDV`
- `Caixa`
- `Relatorios`

Se nao houver evento ativo, o painel orienta a criar um evento antes de vender.

## 2. Abrir Caixa

1. Acesse `/cash/open`.
2. Escolha o evento.
3. Informe o valor inicial.
4. Clique em `Abrir caixa`.

Resultado esperado:

- o caixa passa a ficar disponivel no PDV;
- o sistema vincula o caixa ao operador e ao evento.

## 3. Realizar Uma Venda

1. Acesse `/pdv`.
2. Confirme se ha evento ativo.
3. Confirme se existe caixa aberto.
4. Em `Buscar produto`, pesquise por nome ou SKU.
5. Clique em `Adicionar` no produto desejado.
6. Ajuste a quantidade com `+` e `-`.
7. Confira o `Total`.
8. Em `Caixa da venda`, escolha o caixa correto.
9. Informe o `Valor recebido`.
10. Confira o troco mostrado na tela.
11. Clique em `Finalizar venda`.

Comportamentos importantes:

- a lista de produtos no PDV e paginada;
- o valor recebido deve ser suficiente para a venda;
- o botao de finalizar fica preso na area inferior no mobile para acelerar a operacao;
- a venda registra historico financeiro e baixa de estoque automaticamente;
- nesta versao, o fluxo operacional visivel do PDV esta preparado para venda com valor recebido e troco.

## 4. Consultar Vendas

1. Acesse `/sales`.
2. Abra a lista de vendas registradas.
3. Entre no detalhe da venda que deseja conferir.

No detalhe da venda, e possivel:

- revisar os itens vendidos;
- conferir os valores;
- cancelar a venda quando houver autorizacao administrativa.

## 5. Cancelar Uma Venda

O cancelamento exige validacao administrativa.

1. Acesse o detalhe da venda em `/sales/[id]`.
2. Localize a secao `Cancelamento`.
3. Informe a `Senha administrativa`.
4. Marque a confirmacao de cancelamento.
5. Clique em `Cancelar venda`.

O que acontece ao cancelar:

- a venda permanece registrada no historico;
- o status da venda muda para cancelada;
- o estoque dos itens volta automaticamente.

Senha administrativa operacional atual:

- `123456`

Importante:

- esta senha e temporaria para homologacao;
- antes da producao final, ela deve ser trocada.

## 6. Fechar Caixa

1. Acesse `/cash/close`.
2. Localize o caixa aberto correto.
3. Confira:
   `Inicial`, `Vendido`, `Esperado`, `Cancelado`
4. Informe o `Valor contado no caixa`.
5. Clique em `Fechar caixa`.

Se o valor contado for menor que o esperado:

- a tela mostra quanto esta faltando;
- o sistema exige `Senha administrativa`;
- o fechamento so e concluido com a autorizacao correta.

Senha administrativa operacional atual:

- `123456`

## Rotina Do Admin

## 1. Cadastrar Produto

1. Acesse `/products`.
2. Clique em `Novo produto`.
3. Preencha nome, SKU, preco e status.
4. Salve o cadastro.

Lembrete:

- produto cadastrado ainda nao possui saldo por si so;
- o estoque precisa ser alimentado depois em `/stock`.

## 2. Ajustar Estoque

1. Acesse `/stock`.
2. Em `Registrar movimentacao`, escolha o produto.
3. Informe a quantidade.
4. Escolha o tipo de movimentacao disponivel.
5. Informe o motivo quando aplicavel.
6. Confirme a acao.

Na mesma tela, o admin consegue acompanhar:

- estoque atual;
- historico de movimentacoes.

## 3. Criar Evento

1. Acesse `/events`.
2. Clique em `Novo evento`.
3. Preencha:
   `Nome do evento`, `Local`, `Inicio`, `Termino`
4. Mantenha marcado `Evento ativo` quando o evento deve entrar em operacao.
5. Clique em `Salvar evento`.

Regra atual:

- o sistema trabalha com apenas um evento ativo por vez;
- um evento pode ter varios caixas abertos;
- um evento com caixa aberto nao deve ser finalizado antes do fechamento dos caixas.

## 4. Finalizar Evento

1. Acesse `/events`.
2. Localize o evento ativo.
3. Use a acao de encerramento disponivel na lista.

Antes de finalizar:

- confirme que nao ha caixa aberto para o evento;
- confirme que todas as vendas e conferencias do dia ja foram encerradas.

## 5. Criar Novo Usuario Operador

1. Acesse `/settings`.
2. Na secao `Criar operador`, preencha:
   `Nome completo`, `E-mail`, `Senha temporaria`
3. Clique em `Criar operador`.

Resultado esperado:

- o novo usuario nasce como `Operador`;
- ele ja pode entrar com a senha temporaria informada.

## 6. Promover Operador Para Admin

1. Acesse `/settings`.
2. Na lista `Usuarios do sistema`, localize o usuario.
3. No campo `Perfil`, altere de `Operador` para `Admin`.
4. Clique em `Salvar`.

Use isso apenas quando a pessoa realmente precisar:

- configuracoes;
- gestao de usuarios;
- estoque;
- eventos;
- relatorios;
- autorizacoes administrativas.

## 7. Rebaixar Admin Para Operador

1. Acesse `/settings`.
2. Localize o usuario admin.
3. No campo `Perfil`, altere para `Operador`.
4. Clique em `Salvar`.

Observacao:

- um admin nao consegue remover o proprio privilegio de admin pela propria linha quando isso bloquearia a administracao atual.

## 8. Redefinir Senha De Um Usuario

1. Acesse `/settings`.
2. Localize o usuario.
3. Na area `Senha temporaria`, informe a nova senha.
4. Clique em `Redefinir`.
5. Entregue a senha ao usuario por um canal seguro.

Boa pratica:

- oriente o usuario a trocar a senha temporaria assim que o fluxo oficial de troca estiver disponivel.

## 9. Ativar Ou Desativar Usuario

1. Acesse `/settings`.
2. Localize o usuario.
3. Clique em `Desativar` para bloquear o acesso.
4. Clique em `Ativar` para liberar novamente.

Importante:

- a desativacao nao apaga historico;
- o usuario apenas perde o acesso operacional.

## 10. Consultar Relatorios

1. Acesse `/reports`.
2. Escolha o evento desejado.
3. Revise os totais e os produtos vendidos.
4. Use a exportacao CSV quando precisar compartilhar ou auditar os dados fora do sistema.

Use os relatorios para:

- fechamento do evento;
- conferencia de vendas;
- comparacao entre eventos;
- apoio ao controle de estoque.

## Checklist Rapido De Operacao

### Inicio Do Evento

1. Confirmar evento ativo.
2. Confirmar produtos cadastrados.
3. Confirmar estoque ajustado.
4. Confirmar operadores com acesso.
5. Abrir caixa.
6. Testar uma navegacao rapida no PDV.

### Durante O Evento

1. Vender somente com caixa aberto.
2. Conferir troco antes de finalizar.
3. Consultar vendas quando houver duvida.
4. Chamar admin para cancelamentos e faltas no caixa.

### Encerramento Do Evento

1. Conferir vendas.
2. Fechar todos os caixas.
3. Revisar relatorios.
4. Finalizar o evento.

## Solucao De Problemas

### Nao consigo entrar

Verifique:

- e-mail digitado corretamente;
- senha correta;
- se o acesso esta ativo;
- se um admin pode redefinir sua senha.

### Nao aparece produto no PDV

Verifique:

- se o produto esta ativo;
- se o produto foi cadastrado corretamente;
- se a busca por nome ou SKU esta filtrando demais.

### Nao consigo vender

Verifique:

- se existe evento ativo;
- se existe caixa aberto;
- se ha itens no carrinho;
- se o valor recebido foi informado;
- se o valor recebido cobre o total da venda.

### O sistema ficou sem internet

Com a conexao indisponivel:

- o aviso `Sem conexao` aparece no topo;
- a operacao do PDV deve ser interrompida;
- reconecte o dispositivo e recarregue a pagina.

### Preciso cancelar venda ou fechar caixa com falta

Solicite um admin com a senha administrativa operacional.

Senha atual de homologacao:

- `123456`

## Observacoes Finais

- a senha administrativa operacional `123456` e temporaria e deve ser trocada antes da producao;
- o sistema foi desenhado para deixar a regra critica no servidor;
- cancelamento de venda, fechamento de caixa com falta e ajustes sensiveis sempre dependem de validacao controlada;
- antes da entrega final ao cliente, vale limpar os dados de homologacao e manter apenas os acessos reais necessarios.
