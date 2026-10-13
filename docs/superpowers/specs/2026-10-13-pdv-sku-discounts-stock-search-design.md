# SKU, Descontos No PDV E Busca Em Ajustes De Estoque

**Data:** 13 de outubro de 2026

**Status:** desenho aprovado

**Escopo:** três PRs incrementais para padronização de SKU, busca de produtos
no ajuste de estoque e desconto por venda no PDV

## 1. Objetivo

Melhorar a velocidade e a segurança da operação diária da Roberto Multimarcas
com três mudanças:

- persistir todo SKU em letras maiúsculas, independentemente da capitalização
  informada pelo usuário;
- permitir localizar produtos por nome, parte do nome ou SKU ao realizar um
  ajuste de estoque;
- permitir desconto em reais sobre o total da venda, com autoria e valores
  preservados para auditoria.

Cada mudança será entregue em um PR pequeno e funcional. Nenhum PR poderá
deixar o runtime incompatível com a versão anterior durante o deploy.

## 2. Decisões Aprovadas

- O desconto será um valor em reais aplicado à venda inteira.
- Admin e operador poderão conceder desconto quando tiverem um caixa aberto.
- O operador será sempre derivado da sessão autenticada no servidor.
- Uma venda deverá manter total final mínimo de R$ 0,01.
- O banco recalculará subtotal e total; valores calculados no navegador não
  serão tratados como fonte da verdade.
- O desconto não será rateado entre os itens nesta entrega.
- A autoria do desconto será o `operator_id` já registrado na venda. Como a
  mesma pessoa finaliza a venda e concede o desconto, não haverá uma segunda
  coluna de usuário com informação duplicada.
- A busca do ajuste de estoque será local sobre os produtos ativos que a tela
  já carrega. Paginação ou busca remota ficam fora deste escopo.

## 3. Estratégia De Entrega

### PR 1 — SKU Em Maiúsculas

Normalizar e proteger o SKU nas camadas de domínio, validação e banco. Esse PR
não altera preços, estoque ou o fluxo de vendas.

### PR 2 — Busca No Ajuste De Estoque

Substituir a lista simples de produtos do formulário de ajuste por um seletor
pesquisável e acessível. O contrato do caso de uso de ajuste permanece
inalterado: depois da seleção, ele continua recebendo somente o `productId`.

### PR 3 — Desconto No PDV

Evoluir o contrato financeiro de venda, o PDV, persistência, consultas e
relatórios para distinguir subtotal, desconto e total líquido.

Cada PR deverá nascer da versão mais recente de `develop`, executar seus gates
de qualidade e ser integrado exclusivamente por pull request.

## 4. PR 1 — Padronização De SKU

### 4.1 Regra Canônica

O SKU continuará opcional. Quando informado, seu valor canônico será:

1. remover espaços no início e no fim;
2. transformar todas as letras em maiúsculas;
3. converter uma string vazia em ausência de SKU.

Exemplo: `  rm-camisa-01 ` será persistido como `RM-CAMISA-01`.

O domínio aplicará a regra tanto na criação quanto na atualização. A validação
de entrada também devolverá o valor normalizado, mas o domínio continuará
defensivo para não depender de uma única porta de entrada.

### 4.2 Banco De Dados

Uma migration aditiva deverá:

- verificar se existem SKUs que colidiriam depois da normalização;
- falhar com uma mensagem explícita se houver colisão, sem escolher ou mesclar
  produtos automaticamente;
- normalizar os SKUs existentes com `upper(trim(sku))`;
- manter a unicidade do SKU canônico;
- adicionar uma constraint que rejeite SKU não canônico enviado por qualquer
  caminho que contorne a aplicação.

A aplicação normaliza a entrada; o banco protege a invariável. Não será usado
um trigger com mutação silenciosa.

### 4.3 Interface

O campo continuará aceitando digitação normal. Após a validação ou
persistência, o valor apresentado será o canônico em maiúsculas. Mensagens de
SKU duplicado deverão continuar compreensíveis para o usuário.

## 5. PR 2 — Busca De Produto No Ajuste De Estoque

### 5.1 Componente

O `<select>` com todos os produtos será substituído por um combobox controlado
que contenha:

- campo com o rótulo `Buscar produto`;
- busca por nome completo, parte do nome ou SKU;
- comparação sem diferenciar maiúsculas, minúsculas ou acentos;
- resultados limitados aos produtos ativos já autorizados para ajuste;
- identificação visual por `Nome do produto — SKU` quando houver SKU;
- estado explícito quando nenhum produto for encontrado;
- resumo do produto selecionado e ação para limpar ou trocar a seleção;
- `productId` enviado ao servidor somente depois de uma seleção válida.

O componente deverá funcionar com toque e teclado, expor nome e estados
acessíveis e preservar o foco durante a navegação. Digitar um texto parecido
com um produto não será suficiente: o usuário deverá selecionar um resultado.

### 5.2 Limites

Nesta etapa, a tela continuará carregando a coleção de produtos ativos uma vez
e filtrando-a no cliente. Isso evita mudar o repositório e mantém resposta
imediata para o volume esperado da loja. Busca remota, paginação e virtualização
só serão introduzidas mediante evidência de volume que justifique a
complexidade.

## 6. PR 3 — Desconto Por Venda

### 6.1 Modelo Financeiro

A venda passará a armazenar:

- `subtotal_in_cents`: soma dos itens usando os preços vigentes no servidor;
- `discount_in_cents`: desconto concedido em centavos;
- `total_in_cents`: total líquido, igual a subtotal menos desconto.

Para dados existentes, `subtotal_in_cents` será preenchido com o total atual e
`discount_in_cents` com zero. As colunas serão não nulas e terão constraints
que assegurem:

- subtotal positivo;
- desconto maior ou igual a zero;
- desconto menor que o subtotal;
- total mínimo de um centavo;
- `total_in_cents = subtotal_in_cents - discount_in_cents`.

Os itens continuarão registrando quantidade, preço unitário e total bruto por
item. Não haverá alteração retroativa dos preços dos itens para esconder o
desconto.

### 6.2 Contrato De Finalização

Será criada a RPC versionada `finalize_sale_v4`, com o desconto em centavos
como parâmetro explícito. Ela deverá:

1. obter o usuário autenticado;
2. confirmar que o caixa aberto pertence a esse usuário;
3. carregar e bloquear os produtos necessários;
4. recalcular o subtotal usando preços persistidos no banco;
5. validar `0 <= desconto < subtotal`;
6. calcular o total líquido;
7. validar pagamento e troco contra o total líquido;
8. persistir venda, itens, pagamento e movimentos de estoque na mesma
   transação;
9. incluir o desconto no fingerprint de idempotência;
10. registrar o usuário autenticado como `operator_id` da venda.

Chamadas com preço, desconto, pagamento, caixa ou operador inconsistentes
falharão integralmente. O frontend nunca poderá escolher a autoria do desconto.

A RPC `finalize_sale_v3` permanecerá temporariamente compatível com desconto
zero durante a publicação gradual. Ela não ganhará suporte a descontos e sua
remoção será tratada posteriormente, quando não houver clientes usando o
contrato antigo.

### 6.3 PDV

O resumo da venda exibirá, nesta ordem:

- subtotal;
- campo `Desconto (R$)`, iniciado em zero;
- total da venda em destaque.

O campo aceitará moeda brasileira e será convertido para centavos sem cálculos
em ponto flutuante. A interface bloqueará desconto negativo, igual ou superior
ao subtotal e total final abaixo de R$ 0,01, mas o servidor repetirá todas as
validações.

Para dinheiro, valor recebido e troco usarão o total líquido. Para Pix, crédito
e débito, o pagamento deverá ser exatamente o total líquido. Alterar itens ou
quantidades recalculará subtotal, limite do desconto, total e troco. Ao concluir
a venda, carrinho, desconto e pagamento serão limpos juntos.

### 6.4 Consultas, Auditoria E Relatórios

Detalhes e histórico da venda deverão mostrar subtotal, desconto e total
líquido. Quando o desconto for maior que zero, a interface identificará o
operador da venda como responsável pela concessão.

Relatórios deverão distinguir:

- valor bruto: soma dos subtotais;
- descontos concedidos: soma dos descontos;
- valor líquido: soma dos totais das vendas concluídas.

Fechamento de caixa, formas de pagamento e reconciliação financeira continuarão
usando o valor líquido efetivamente recebido. Cancelamentos preservarão os
valores originais e continuarão devolvendo estoque sem apagar a venda.

## 7. Segurança E Compatibilidade

- Identidade, preços, subtotal, desconto máximo, total, pagamento e estoque
  serão validados no servidor e novamente protegidos no banco.
- Escritas financeiras diretas continuarão bloqueadas por grants e RLS.
- Somente usuários autenticados com caixa próprio aberto poderão finalizar uma
  venda, com ou sem desconto.
- Migrations existentes não serão reescritas.
- As migrations novas serão aditivas e testadas do banco vazio e sobre o
  schema atual.
- O contrato anterior de venda continuará aceitando somente vendas sem
  desconto durante a transição.
- Nenhuma credencial, senha ou dado de ambiente fará parte dos PRs.

## 8. Tratamento De Erros

- SKU em formato não canônico por acesso direto: rejeitar no banco.
- Colisão de SKU durante a migration: abortar e exigir resolução explícita.
- Produto digitado, mas não selecionado no ajuste: não enviar o formulário.
- Produto inativo ou inexistente: manter validação definitiva do servidor.
- Desconto inválido ou acima do limite: rejeitar sem criar venda, pagamento ou
  movimento de estoque.
- Preço ou estoque alterado entre a montagem do carrinho e a confirmação:
  recalcular no servidor e retornar erro operacional claro.
- Repetição da mesma requisição: retornar a venda idempotente somente quando o
  fingerprint, incluindo desconto, for idêntico.

## 9. Estratégia De Testes

### PR 1

- testes de domínio para criação e atualização com SKU misto e espaços;
- testes de validação, formulário, actions e repositório;
- testes de banco para normalização, unicidade e constraint canônica;
- regressão de criação, edição e busca de produtos.

### PR 2

- testes do combobox por nome completo, trecho, SKU, caixa e acentos;
- seleção, troca, limpeza, ausência de resultados e submissão sem seleção;
- navegação por teclado, rótulos acessíveis e interação mobile;
- E2E do ajuste de estoque usando a busca.

### PR 3

- testes de domínio para subtotal, desconto mínimo/máximo e total líquido;
- testes de parsing monetário sem ponto flutuante;
- testes do caso de uso contra preço, estoque, caixa e usuário;
- testes da RPC para autorização, idempotência, pagamento, troco, constraints e
  rollback transacional;
- testes de detalhes, histórico, relatórios, cancelamento e fechamento;
- E2E de venda sem desconto e com desconto para dinheiro e pagamento não
  monetário;
- regressão E2E dos fluxos críticos de produto, estoque, caixa e venda.

Todos os PRs executarão `format:check`, `lint`, `type-check`, testes unitários,
integrações aplicáveis e `build`. Os gates de banco e E2E serão exigidos quando
o PR tocar nesses contratos.

## 10. Fora De Escopo

- desconto percentual;
- desconto por item;
- cupons ou campanhas promocionais;
- autorização especial ou limite de desconto por função;
- venda gratuita com total zero;
- alteração manual do operador responsável;
- paginação, virtualização ou busca remota de produtos no ajuste;
- importação ou alteração em massa de SKU.

## 11. Critérios De Aceite

- SKU criado ou editado por qualquer fluxo da aplicação é persistido em
  maiúsculas e o banco rejeita valores fora do padrão.
- O ajuste de estoque encontra produtos ativos por nome, trecho ou SKU e exige
  uma seleção válida antes do envio.
- Admin e operador com caixa próprio aberto podem conceder desconto em reais.
- O servidor impede desconto que deixe o total abaixo de R$ 0,01.
- Subtotal, desconto, total líquido e operador ficam preservados e visíveis na
  auditoria da venda.
- Pagamento, troco, caixa, relatórios e cancelamento permanecem reconciliados
  pelo valor correto.
- Venda sem desconto continua funcionando durante e depois da transição.
- Os três PRs são independentes, revisáveis e deixam o runtime funcional.
