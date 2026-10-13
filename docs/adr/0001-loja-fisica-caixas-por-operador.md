# ADR 0001 - Loja Fisica Com Caixas Por Operador

- Status: aceito
- Data: 2026-10-01
- Decisores: produto e engenharia
- Plano relacionado:
  [Plano de reestruturacao para loja fisica](../plano-reestruturacao-loja-fisica.md)

## Contexto

O sistema foi criado para vendas temporarias em eventos. Por isso, eventos sao
obrigatorios em sessoes de caixa, vendas, relatorios e parte da navegacao.

A operacao passa a atender exclusivamente a Roberto Multimarcas, uma loja
fisica permanente. Manter um evento ativo para cada periodo de vendas adiciona
etapas sem valor ao trabalho diario e aumenta o risco de uma venda ser
registrada no contexto errado.

A loja tambem pode ter mais de um vendedor operando ao mesmo tempo. Cada
vendedor precisa responder por seu proprio saldo, suas vendas e seu fechamento,
sem impedir que os demais continuem trabalhando.

Os dados atuais pertencem a operacao anterior e podem ser descartados durante o
corte controlado para o novo modelo.

A aplicacao publica tambem precisa deixar de usar a identidade e a URL da
Espaco Personalize.

## Decisao

### Contexto Operacional

O evento deixa de fazer parte do dominio alvo. A sessao de caixa passa a ser o
contexto financeiro obrigatorio de cada venda.

Cada sessao possui:

- operador responsavel;
- data operacional no fuso `America/Sao_Paulo`;
- instante de abertura e, quando aplicavel, de fechamento;
- saldo inicial;
- totais esperados, valor contado e diferenca;
- responsavel pelo fechamento.

### Cardinalidade Dos Caixas

Cada operador pode ter no maximo uma sessao aberta por vez. Operadores
diferentes podem manter sessoes abertas simultaneamente.

Depois de fechar sua sessao, o mesmo operador pode abrir outra no mesmo dia. A
regra sera garantida no banco por indice unico parcial sobre `operator_id` para
registros com status `open`.

### Identidade E Tempo

Identidade, instantes e data operacional sao definidos no servidor:

- `operator_id` deriva de `auth.uid()`;
- `opened_at`, `completed_at` e `closed_at` usam o relogio do servidor;
- `business_date` deriva do instante de abertura no fuso
  `America/Sao_Paulo`.

O frontend envia a intencao e os dados que somente o usuario pode informar,
como saldo inicial, itens, pagamento e valor contado.

### Isolamento E Autorizacao

- Operadores abrem, usam e fecham somente o proprio caixa.
- Uma venda somente pode usar a sessao aberta do usuario autenticado.
- Administradores podem consultar todas as sessoes.
- Fechamento administrativo de caixa alheio permanece permitido, com
  `closed_by` e validacoes de auditoria.
- Estoque e compartilhado e continua protegido contra vendas concorrentes.
- Escritas financeiras diretas permanecem bloqueadas; operacoes criticas usam
  RPCs transacionais.

### Migracao

A migracao sera progressiva:

1. adicionar colunas, indices e RPCs compativeis;
2. desacoplar relatorios e consultas de vendas;
3. ativar o novo fluxo de caixa e PDV;
4. remover rotas, modulos, colunas e tabela de eventos;
5. reinicializar os ambientes de forma controlada;
6. promover a versao aprovada de `develop` para `main`.

Migrations ja aplicadas nao serao reescritas. A evolucao e a remocao do legado
ocorrerao por novas migrations.

O reset remoto exige identificacao explicita do ambiente, validacao do project
ref, backup tecnico e confirmacao antes da execucao.

### Infraestrutura

Serao preferidos projetos novos e vazios para a Roberto Multimarcas:

- Vercel `roberto-multimarcas-pdv`;
- Supabase `roberto-multimarcas-pdv-staging`;
- Supabase `roberto-multimarcas-pdv`.

Os projetos antigos permanecem intactos durante desenvolvimento, validacao e
janela de rollback. Criacao com eventual custo, exclusao ou desativacao exigem
confirmacao especifica. A URL publica com a marca sera fornecida pela Vercel,
pois endpoints Supabase usam project refs aleatorios.

## Alternativas Consideradas

### Manter Um Evento Diario Automatico

Rejeitada porque preservaria uma entidade sem significado para a loja e
manteria acoplamentos desnecessarios em caixa, venda e relatorio.

### Um Unico Caixa Global Por Dia

Rejeitada porque mistura responsabilidades financeiras de vendedores
simultaneos e dificulta a reconciliacao individual.

### Identificar Caixa Pelo Dispositivo

Rejeitada neste momento porque o responsavel financeiro e o vendedor
autenticado. Dispositivos podem mudar durante o expediente e nao substituem a
auditoria por usuario.

### Limitar A Uma Sessao Por Operador E Dia

Rejeitada porque impediria reabertura legitima depois de fechamento antecipado,
troca de turno ou contingencia.

### Reescrever O Historico De Migrations

Rejeitada porque ambientes remotos ja possuem historico aplicado. Novas
migrations preservam rastreabilidade e permitem validar o caminho de upgrade.

### Renomear E Limpar Os Projetos Existentes

Rejeitada como estrategia principal porque reduz o isolamento, aumenta o risco
de destruir a operacao anterior antes da validacao e enfraquece o rollback.
Projetos novos permitem construir e homologar sem alterar o ambiente legado.

### Trocar Banco E Aplicacao Em Um Unico PR

Rejeitada pelo risco de deploy parcial e pela dificuldade de revisar, testar e
reverter uma alteracao extensa.

## Consequencias

### Positivas

- Menos etapas para iniciar as vendas diarias.
- Responsabilidade financeira clara por vendedor.
- Operacao simultanea sem mistura de caixas.
- Relatorios adequados a periodos, operadores e sessoes.
- Modelo de dominio alinhado ao uso real da loja.

### Custos E Riscos

- Banco e aplicacao precisarao conviver temporariamente com campos legados.
- RPCs, RLS, relatorios e E2E exigem revisao coordenada.
- O reset remoto e destrutivo e precisa de runbook e protecoes especificas.
- Projetos adicionais podem depender de quota ou custo ainda nao aprovado.
- Documentos operacionais devem continuar descrevendo o runtime atual ate o
  corte, para nao orientar usuarios a um fluxo ainda indisponivel.

## Criterios De Validacao

- O mesmo operador nao abre duas sessoes simultaneas.
- Operadores diferentes abrem caixas ao mesmo tempo.
- O operador fecha e reabre uma sessao no mesmo dia.
- Vendas nao podem usar caixa alheio ou fechado.
- Vendas concorrentes nao geram estoque negativo.
- Fechamento e relatorios nao misturam valores entre operadores.
- O schema final nao possui dependencia de eventos.
- O caminho completo de migration funciona em banco vazio e banco atualizado.
