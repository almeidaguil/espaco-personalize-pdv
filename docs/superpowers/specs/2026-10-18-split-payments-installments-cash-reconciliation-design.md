# Pagamentos Divididos, Parcelamento E Conferência Do Caixa

**Data:** 18 de outubro de 2026

**Status:** desenho aprovado

**Escopo:** dois PRs incrementais para pagamentos com até dois métodos,
parcelamento no crédito e conferência do fechamento por método de pagamento

## 1. Objetivo

Adequar o PDV da Roberto Multimarcas a três necessidades da operação diária:

- receber uma venda com um ou dois métodos de pagamento distintos;
- registrar pagamentos em cartão de crédito à vista ou parcelados em até três
  vezes, sem juros ou alteração do total;
- conferir dinheiro, Pix, crédito e débito separadamente ao fechar o caixa,
  comparando o sistema com o numerário, o extrato e as guias das maquininhas.

As regras financeiras continuarão sendo validadas no domínio, no servidor e
no banco. O navegador apenas apresentará os cálculos e enviará a intenção do
operador.

## 2. Decisões Aprovadas

- Uma venda terá um ou dois métodos de pagamento.
- Quando houver dois métodos, eles deverão ser distintos.
- Dois ou mais cartões de crédito físicos serão consolidados em um único
  pagamento `credit_card`.
- Cada método deverá contribuir com pelo menos R$ 0,01 para a venda.
- Somente o pagamento em dinheiro poderá superar a parcela que falta pagar e
  gerar troco.
- O cartão de crédito terá uma única condição por venda: à vista, 2x ou 3x,
  mesmo quando o cliente usar mais de um cartão físico.
- O parcelamento não terá juros, taxas ou alteração do valor da venda.
- O fechamento conferirá dinheiro, Pix, crédito e débito separadamente.
- Os campos de valor conferido iniciarão vazios e todos deverão ser preenchidos
  conscientemente pelo operador, inclusive com zero quando aplicável.
- Qualquer diferença positiva ou negativa em qualquer método exigirá senha de
  administrador. Diferenças entre métodos não poderão se compensar para
  contornar essa autorização.
- O total de vendas concluídas continuará sendo exibido como informação geral,
  mas não substituirá a conferência individual dos recebimentos.

## 3. Modelo De Pagamentos Da Venda

### 3.1 Contrato De Domínio

O contrato de criação da venda deixará de receber `payment` e passará a receber
`payments`, contendo uma ou duas entradas. Cada entrada terá:

- `method`: `cash`, `pix`, `credit_card` ou `debit_card`;
- `amountInCents`: valor bruto recebido por esse método;
- `installmentCount`: obrigatório entre 1 e 3 para crédito e ausente nos
  demais métodos.

O resultado persistido incluirá também `changeInCents`. Somente a entrada em
dinheiro poderá ter troco maior que zero.

A contribuição líquida de cada pagamento será:

```txt
netPayment = amountInCents - changeInCents
```

As invariantes serão:

- a coleção contém uma ou duas entradas;
- os métodos não se repetem;
- cada contribuição líquida é de pelo menos um centavo;
- pagamentos que não sejam dinheiro não têm troco;
- a soma das contribuições líquidas é exatamente o total líquido da venda;
- sem dinheiro, a soma dos valores informados deve ser exatamente o total;
- com dinheiro, eventual excedente da soma bruta será integralmente atribuído
  como troco ao pagamento em dinheiro.

Exemplo: em uma venda de R$ 100,00, Pix de R$ 40,00 e dinheiro recebido de
R$ 70,00 produzem contribuição líquida de R$ 60,00 em dinheiro e troco de
R$ 10,00.

### 3.2 Persistência

A tabela `payments` continuará armazenando uma linha por método da venda. Uma
migration aditiva deverá:

- adicionar `installment_count smallint`;
- verificar e abortar com mensagem explícita se houver duplicidades históricas
  incompatíveis com a nova chave;
- preencher pagamentos de crédito existentes com `1`;
- exigir `installment_count between 1 and 3` para `credit_card`;
- exigir `installment_count is null` para os demais métodos;
- adicionar unicidade para `(sale_id, method)`;
- preservar os índices existentes e adicionar somente os necessários para as
  consultas novas.

Os valores existentes não serão reescritos além do preenchimento seguro do
parcelamento dos pagamentos de crédito. Migrations já aplicadas não serão
alteradas.

### 3.3 Finalização Transacional

Será criada a RPC versionada `finalize_sale_v5`, mantendo `finalize_sale_v4`
temporariamente disponível para o runtime anterior. A nova função receberá o
identificador da venda, o caixa, os itens, o desconto e um array JSON de
pagamentos.

O caminho legado de `finalize_sale_v4` continuará aceitando exatamente um
pagamento. Quando esse pagamento for crédito, a camada de compatibilidade o
persistirá como `installment_count = 1`, equivalente a crédito à vista. Assim,
a nova constraint não interromperá o runtime implantado.

A função deverá, na mesma transação:

1. obter o usuário autenticado;
2. confirmar que o caixa está aberto e pertence ao operador autenticado;
3. carregar e bloquear os produtos necessários;
4. recalcular subtotal, desconto e total usando os dados persistidos;
5. validar quantidade, distinção e estrutura dos pagamentos;
6. validar o parcelamento e calcular o troco exclusivamente no dinheiro;
7. confirmar que as contribuições líquidas totalizam a venda;
8. persistir venda, itens, pagamentos e movimentos de estoque;
9. incluir pagamentos normalizados e parcelamento no fingerprint de
   idempotência;
10. retornar a venda com todos os pagamentos persistidos.

Para idempotência, os pagamentos serão ordenados por método antes de compor o
fingerprint. Repetir a mesma requisição em outra ordem continuará representando
a mesma intenção. Qualquer alteração de método, valor ou parcelamento será
tratada como conflito, e não como repetição válida.

## 4. Experiência No PDV

O PDV iniciará com uma forma de pagamento. A ação `Dividir pagamento`
adicionará a segunda, e o seletor excluirá o método já escolhido.

Cada bloco de pagamento apresentará método e valor. Pix, débito e crédito, em
uma venda sem divisão, receberão automaticamente o valor total. O dinheiro
permitirá informar o valor efetivamente entregue pelo cliente para cálculo do
troco.

Quando houver divisão, a interface exibirá em tempo real:

- total da venda;
- total bruto informado;
- total líquido atribuído aos métodos;
- valor restante;
- troco, quando houver dinheiro.

Selecionar crédito exibirá `À vista`, `2x` e `3x`. Para 2x ou 3x, a interface
mostrará o valor aproximado das parcelas e avisará quando o último centavo
precisar ser ajustado na última parcela. Esse cálculo é apenas informativo: o
banco guarda o total da parcela de crédito e a quantidade de parcelas, sem
criar recebíveis individuais.

A tela será mobile first, com blocos grandes para toque, rótulos acessíveis e
mensagens específicas para método repetido, valor faltante, contribuição menor
que R$ 0,01 e parcelamento inválido. Após uma venda concluída, carrinho,
desconto, métodos, valores e parcelamento serão limpos juntos.

## 5. Conferência Do Fechamento

### 5.1 Valores Esperados

O servidor calculará os valores esperados somente a partir das vendas
concluídas vinculadas ao caixa:

- dinheiro: saldo inicial mais pagamentos em dinheiro menos trocos;
- Pix: soma dos pagamentos Pix;
- crédito: soma dos pagamentos em crédito, independentemente de 1x, 2x ou 3x;
- débito: soma dos pagamentos em débito.

Vendas canceladas não entrarão nos valores esperados. O total de vendas
concluídas continuará sendo a soma dos totais líquidos das vendas, qualquer que
seja o método, e será mostrado separadamente como resumo operacional.

### 5.2 Valores Conferidos E Diferenças

O fechamento mostrará uma linha ou cartão para cada método, com:

- valor esperado;
- campo obrigatório de valor conferido, inicialmente vazio;
- diferença calculada como `conferido - esperado`.

O operador conferirá dinheiro físico, extrato Pix e guias de crédito e débito.
Um valor positivo representa sobra; um valor negativo representa falta. A
interface mostrará a diferença individual e poderá mostrar a soma geral apenas
como resumo. A autorização sempre considerará cada método individualmente.

Exemplo: com saldo inicial zero e R$ 200,00 de vendas em crédito, o fechamento
mostrará dinheiro esperado de R$ 0,00 e crédito esperado de R$ 200,00. Ao
informar respectivamente R$ 0,00 e R$ 200,00, todas as diferenças serão zero.

### 5.3 Autorização

Se todas as diferenças forem zero, o operador autorizado poderá fechar o caixa
normalmente. Se qualquer método tiver sobra ou falta, a senha de administrador
será obrigatória, inclusive quando quem estiver fechando já tiver perfil de
administrador.

A interface exibirá o campo de senha assim que detectar uma diferença, mas a
decisão definitiva ocorrerá na RPC. O banco recalculará os valores esperados e
rejeitará o fechamento divergente sem uma senha administrativa válida.

## 6. Persistência Da Conferência

Será criada a tabela `cash_session_reconciliations`, com uma linha por caixa e
método de pagamento:

- `cash_session_id uuid`, referência ao caixa;
- `method payment_method`;
- `expected_amount_in_cents integer` não negativo;
- `counted_amount_in_cents integer` não negativo;
- `difference_amount_in_cents integer`, igual a conferido menos esperado;
- `created_at timestamptz`, definido pelo servidor.

A chave será `(cash_session_id, method)`. Uma constraint protegerá a igualdade
da diferença. Escritas diretas permanecerão bloqueadas; a tabela será gravada
somente pela função transacional de fechamento.

Será criada a RPC versionada `close_cash_session_v2`. Ela receberá o caixa, as
quatro conferências e a senha administrativa opcional. A função deverá:

1. validar usuário ativo e permissão sobre o caixa;
2. bloquear a sessão e confirmar que ainda está aberta;
3. exigir exatamente uma conferência para cada método conhecido, sem
   duplicidades;
4. rejeitar valores ausentes, negativos ou fora do intervalo seguro;
5. calcular os quatro valores esperados a partir dos pagamentos persistidos;
6. calcular todas as diferenças;
7. exigir senha administrativa se alguma diferença for diferente de zero;
8. inserir as quatro linhas de reconciliação;
9. fechar o caixa e registrar `closed_by` e horário do servidor;
10. manter os campos legados da sessão espelhando exclusivamente a linha de
    dinheiro.

Todas as operações ocorrerão na mesma transação. Se qualquer validação falhar,
nem a reconciliação nem o fechamento serão persistidos.

Os campos existentes `expected_amount_in_cents`, `counted_amount_in_cents` e
`difference_amount_in_cents` de `cash_sessions` continuarão representando o
dinheiro físico. Isso mantém compatibilidade com o contrato atual enquanto as
consultas são migradas. A função antiga `close_cash_session` permanecerá
executável somente enquanto o runtime antigo estiver implantado. No corte do
segundo PR, depois que a aplicação estiver usando `close_cash_session_v2`, seu
privilégio de execução será revogado para impedir que a conferência por método
seja contornada. A definição poderá permanecer no banco para rastreabilidade e
ser removida em um PR posterior.

## 7. Consultas, Relatórios E Auditoria

Detalhes e histórico de venda listarão todos os pagamentos, com método, valor
líquido, troco quando aplicável e parcelamento do crédito.

Relatórios por método deverão:

- somar a contribuição líquida de cada pagamento;
- contar uma venda uma vez em cada método que ela utilizou;
- manter o total geral de vendas sem duplicação;
- deixar claro que a soma das contagens por método pode superar a quantidade
  geral quando houver pagamentos divididos;
- permitir distinguir crédito à vista, 2x e 3x quando o detalhamento for
  solicitado.

Detalhes e relatórios de caixa apresentarão as quatro reconciliações. O
histórico preservará esperado, conferido e diferença de cada método, o usuário
que fechou e o horário. Cancelar uma venda continuará devolvendo estoque uma
única vez e preservará seus pagamentos originais para auditoria.

As políticas RLS seguirão as permissões de caixa vigentes: o operador poderá
consultar seus próprios fechamentos e o administrador poderá consultar todos.
Nenhum usuário autenticado terá permissão de inserir ou alterar diretamente as
reconciliações financeiras.

## 8. Compatibilidade E Segurança

- A identidade do operador sempre virá da sessão autenticada.
- Preços, desconto, estoque, pagamentos, troco, valores esperados e diferenças
  serão recalculados no servidor e protegidos no banco.
- Escritas financeiras ocorrerão somente por RPCs `security definer` com
  `search_path` controlado e grants mínimos.
- O cliente não informará operador, valor esperado, diferença nem horário de
  fechamento.
- Os contratos novos serão aditivos e versionados.
- As funções atuais continuarão atendendo o runtime anterior durante a
  primeira etapa. O contrato legado de venda continuará representando crédito
  como à vista; o fechamento legado perderá acesso no corte da aplicação para
  não criar uma rota de desvio das novas regras.
- Nenhuma migration aplicada será reescrita.
- Nenhuma credencial ou dado de ambiente será incluído nos PRs.

## 9. Tratamento De Erros

- Zero ou mais de dois pagamentos: rejeitar a venda integralmente.
- Método repetido: rejeitar; cartões físicos múltiplos devem ser consolidados.
- Contribuição líquida menor que R$ 0,01: rejeitar.
- Soma líquida diferente do total: rejeitar sem persistir venda ou estoque.
- Troco sem dinheiro ou contribuição líquida negativa: rejeitar.
- Parcelamento ausente ou fora de 1 a 3 no crédito: rejeitar.
- Parcelamento informado em outro método: rejeitar.
- Preço ou estoque alterado durante a finalização: recalcular, bloquear e
  retornar erro operacional claro.
- Caixa inexistente, fechado ou de outro operador: rejeitar.
- Conferência ausente, duplicada ou negativa: rejeitar o fechamento.
- Qualquer divergência sem senha administrativa válida: manter o caixa aberto.
- Concorrência no fechamento: somente a primeira transação válida poderá
  concluir; as demais receberão erro de caixa já fechado.

## 10. Estratégia De Entrega

### PR 1 — Fundação Aditiva No Banco

- adicionar parcelamento e unicidade aos pagamentos;
- criar `cash_session_reconciliations` e suas proteções;
- criar `finalize_sale_v5` e `close_cash_session_v2`;
- preservar `finalize_sale_v4`, `close_cash_session` e o runtime implantado;
- adicionar testes de contrato, autorização, idempotência, cálculos e rollback;
- validar migrations em banco vazio e sobre o schema atual.

### PR 2 — Aplicação, Interface E Consultas

- migrar domínio, casos de uso e repositórios para coleções de pagamentos;
- implementar até dois métodos e parcelamento no PDV;
- migrar detalhes, histórico e relatórios;
- implementar a conferência obrigatória dos quatro métodos no fechamento;
- exigir senha administrativa na aplicação e no banco para qualquer
  divergência;
- revogar o acesso de execução à função antiga de fechamento no corte
  controlado, depois que a aplicação estiver usando a versão nova;
- atualizar documentação operacional;
- adicionar testes unitários, de componentes, integração e E2E.

Cada PR partirá da versão mais recente de `develop`, será integrado somente por
pull request e manterá o sistema funcional. A remoção dos contratos antigos
será um trabalho posterior à estabilização em produção.

## 11. Estratégia De Testes

### Banco E Domínio

- uma forma e duas formas distintas;
- rejeição de método repetido e terceiro método;
- valores mínimos, soma exata e intervalos seguros;
- dinheiro único e dividido, com e sem troco;
- Pix, débito e crédito sem troco;
- crédito à vista, 2x e 3x e rejeição de parcelamento inválido;
- idempotência com pagamentos em ordens diferentes;
- concorrência de estoque e rollback integral;
- esperado por método com vendas concluídas, divididas e canceladas;
- exigência de senha para sobra ou falta em qualquer método;
- divergências opostas em dois métodos sem compensação de autorização;
- fechamento concorrente e manutenção do caixa aberto após erro.

### Aplicação E Interface

- inclusão, remoção e troca do segundo método;
- exclusão do método já selecionado;
- cálculo de restante, contribuição líquida e troco;
- seleção e limpeza de parcelamento;
- restauração completa do PDV após sucesso;
- campos de conferência vazios, obrigatórios e acessíveis;
- exibição correta de esperado, conferido e diferença por método;
- solicitação de senha para sobra e falta;
- detalhes e relatórios sem duplicar o total geral da venda.

### Gates

Os dois PRs executarão `format:check`, `lint`, `type-check`, Vitest e `build`.
O PR de banco executará reset local e testes de contrato. O PR de aplicação
executará os fluxos E2E críticos de venda, cancelamento, estoque, abertura e
fechamento. A versão integrada em `develop` será validada em staging antes de
qualquer PR de release para `main`.

## 12. Fora De Escopo

- três ou mais métodos em uma venda;
- repetir o mesmo método em linhas diferentes;
- identificar cartões físicos, bandeiras, adquirentes ou códigos de
  autorização;
- juros, taxas, acréscimos ou preço diferente por método;
- parcelamento acima de 3x;
- agenda de recebíveis ou baixa individual de parcelas;
- conciliação automática com bancos ou adquirentes;
- estornos parciais ou rateio de cancelamento entre pagamentos;
- remoção imediata das RPCs antigas.

## 13. Critérios De Aceite

- Admin e operador com caixa próprio aberto concluem vendas com um ou dois
  métodos distintos.
- Cada método contribui com pelo menos R$ 0,01, e somente dinheiro gera troco.
- Crédito registra à vista, 2x ou 3x sem alterar o total.
- Venda, estoque, pagamentos e idempotência permanecem transacionais.
- Detalhes e relatórios exibem todos os pagamentos sem duplicar o total geral.
- O fechamento apresenta dinheiro, Pix, crédito e débito esperados
  separadamente.
- O operador precisa preencher os quatro valores conferidos.
- A diferença exibida é somente `conferido - esperado` para cada método.
- Qualquer sobra ou falta exige senha de administrador no servidor.
- Os campos legados do caixa continuam representando dinheiro e o runtime
  anterior permanece funcional durante a transição.
- Banco vazio, upgrade, testes automatizados, build e E2E aplicáveis passam
  antes do merge de cada PR.
