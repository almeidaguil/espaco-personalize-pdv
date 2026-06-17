# Runbook Operacional

Este runbook orienta a execucao real do Espaco Personalize PDV em eventos.
Use junto com o [Manual do usuario final](manual-usuario-final.md) e o
[Checklist de go-live](checklist-go-live.md).

## Objetivo

Dar ao admin e ao responsavel de operacao um roteiro curto para preparar,
executar, encerrar e validar um evento sem depender de memoria ou improviso.

## Papeis Durante O Evento

- Admin responsavel: cria usuarios, eventos, produtos, estoque, relatorios e
  autorizacoes administrativas.
- Operador de caixa: abre caixa, vende, consulta vendas e fecha o proprio caixa.
- Responsavel financeiro: confere valores, divergencias, relatorios e CSV.

## Antes Do Evento

Execute esta rotina pelo menos uma vez antes de iniciar as vendas:

1. Confirmar internet nos dispositivos que vao vender.
2. Confirmar que o PWA abre corretamente nos dispositivos de operacao.
3. Confirmar que admins e operadores conseguem entrar no sistema.
4. Criar ou validar o evento correto em `/events`.
5. Finalizar eventos antigos que nao devem aparecer como ativos.
6. Cadastrar produtos reais em `/products`.
7. Ajustar estoque inicial em `/stock`.
8. Abrir um caixa de teste controlado, se necessario.
9. Fazer uma venda pequena de teste e cancelar em seguida.
10. Verificar se estoque, vendas, caixa e relatorio refletem o teste.

Se o teste usou dados reais, registre a venda como teste controlado e cancele
antes de iniciar a operacao real.

## Abertura Da Operacao

1. Admin confirma que existe apenas um evento ativo.
2. Operador acessa `/cash/open`.
3. Operador escolhe o evento ativo.
4. Operador informa o valor inicial em dinheiro.
5. Operador abre o caixa.
6. Operador acessa `/pdv`.
7. Operador confirma que produtos aparecem e que o caixa esta disponivel.

Nao comece a vender se:

- nao houver evento ativo;
- nao houver caixa aberto;
- produtos reais nao aparecerem no PDV;
- estoque estiver zerado ou incorreto;
- o app estiver mostrando aviso de sem conexao.

## Durante As Vendas

Para cada venda:

1. Buscar produto por nome ou SKU.
2. Adicionar ao carrinho.
3. Conferir quantidade e estoque disponivel.
4. Escolher o meio de pagamento.
5. Informar valor recebido quando for dinheiro.
6. Conferir total e troco.
7. Finalizar a venda.
8. Aguardar a mensagem de sucesso antes de atender a proxima venda.

Boas praticas:

- nao recarregar a pagina durante a finalizacao de uma venda;
- nao vender produtos sem saldo;
- conferir o produto no carrinho antes de concluir;
- chamar admin para cancelamento, divergencia ou comportamento estranho.

## Cancelamento De Venda

Use cancelamento somente quando necessario:

1. Abrir `/sales`.
2. Localizar a venda.
3. Abrir o detalhe.
4. Conferir itens e valor.
5. Informar a senha administrativa operacional.
6. Confirmar o cancelamento.
7. Verificar se a venda ficou como cancelada.
8. Verificar se o estoque retornou em `/stock`.

Regra operacional:

- venda cancelada permanece no historico;
- cancelamento devolve estoque;
- cancelamento exige autorizacao administrativa.

## Falhas E Respostas Rapidas

### O Sistema Mostra Sem Conexao

1. Parar novas vendas.
2. Conferir internet do dispositivo.
3. Trocar de rede, se houver alternativa segura.
4. Recarregar a pagina apos reconectar.
5. Retomar somente quando o aviso sumir e o PDV carregar normalmente.

Nesta versao, venda offline nao deve ser feita no sistema.

### Produto Nao Aparece No PDV

1. Limpar busca por nome/SKU.
2. Verificar se o produto esta ativo em `/products`.
3. Verificar se o produto tem estoque em `/stock`.
4. Se o cadastro estiver errado, admin corrige em `/products`.

### Venda Nao Finaliza

1. Confirmar evento ativo.
2. Confirmar caixa aberto.
3. Confirmar estoque suficiente.
4. Conferir meio de pagamento e valor recebido.
5. Tentar novamente uma unica vez.
6. Se persistir, registrar horario, operador, produto e mensagem exibida.
7. Consultar logs conforme [Observabilidade](observabilidade.md).

### Caixa Com Falta

1. Conferir vendas em `/sales`.
2. Conferir dinheiro fisico.
3. Conferir total esperado na tela de fechamento.
4. Se a falta for real, admin autoriza com senha administrativa operacional.
5. Registrar a diferenca fora do sistema, se a rotina financeira exigir.

### Usuario Nao Consegue Entrar

1. Conferir e-mail digitado.
2. Conferir se o usuario esta ativo em `/settings`.
3. Admin redefine senha temporaria em `/settings`.
4. Usuario tenta novamente.

## Encerramento Do Evento

1. Parar novas vendas.
2. Conferir se nao ha venda em andamento.
3. Cada operador fecha o proprio caixa em `/cash/close`.
4. Responsavel financeiro confere valor contado e diferencas.
5. Admin revisa `/sales`.
6. Admin revisa `/reports`.
7. Exportar CSV, se necessario.
8. Admin finaliza o evento em `/events`.
9. Confirmar que nenhum caixa ficou aberto.

Nao finalize o evento antes de fechar todos os caixas.

## Smoke Test De Release Ou Primeiro Uso

Use este fluxo antes de liberar uma versao para operacao real:

1. Login como admin.
2. Criar operador de teste ou validar operador real.
3. Criar evento de teste controlado.
4. Criar produto de teste.
5. Ajustar estoque do produto.
6. Abrir caixa.
7. Fazer venda em dinheiro.
8. Fazer venda em Pix ou cartao.
9. Cancelar uma venda.
10. Fechar caixa.
11. Conferir relatorio por evento.
12. Exportar CSV.
13. Finalizar evento de teste.

Resultado esperado:

- estoque baixa na venda e volta no cancelamento;
- vendas aparecem em `/sales`;
- caixa fecha com total esperado;
- relatorio e CSV refletem os numeros;
- nenhum erro aparece no fluxo principal.

## Criterios De Bloqueio

Bloqueie a operacao e corrija antes de vender se ocorrer:

- login indisponivel para todos os usuarios;
- evento ativo incorreto;
- caixa nao abre;
- PDV nao carrega produtos;
- venda concluida nao aparece em `/sales`;
- estoque fica negativo;
- cancelamento nao devolve estoque;
- fechamento de caixa nao registra a conferencia;
- conexao instavel durante a operacao.

## Depois Do Evento

1. Guardar CSV e relatorios combinados com o financeiro.
2. Desativar usuarios temporarios, se houver.
3. Registrar incidentes e ajustes pedidos pela equipe.
4. Planejar correcoes em branch propria a partir de `develop`.
5. Manter a base limpa para o proximo evento.
