# Observabilidade

Este documento define a estrategia minima de observabilidade para a V1 do
Espaco Personalize PDV.

## Objetivo

Detectar falhas reais de producao sem registrar dados sensiveis de usuarios,
senhas temporarias, tokens, cookies ou chaves Supabase/Vercel.

## O Que Ja Existe

- Logs server-side estruturados em JSON para falhas inesperadas de:
  - finalizacao de venda;
  - cancelamento de venda;
  - fechamento de caixa.
- Redacao automatica de campos sensiveis pelo logger local.
- GitHub Actions, Vercel Preview e E2E Release Gate como sinais de qualidade
  antes de release.

## Eventos Criticos

Monitorar estes cenarios em producao:

- `sale.create.failed`
- `sale.cancel.failed`
- `cash.close.failed`
- falhas de login/autenticacao recorrentes;
- erros de conectividade Supabase;
- falhas de deploy na Vercel;
- falhas do workflow E2E antes de release.

## Onde Observar

Primeira versao:

- Vercel Runtime Logs;
- Supabase Logs;
- GitHub Actions.

Evolucao recomendada:

- Sentry para erros de aplicacao;
- Logflare ou ferramenta equivalente para centralizar logs Supabase/Vercel;
- alerta simples para erro recorrente em vendas, cancelamentos e caixa.

## Regras De Seguranca

- Nunca registrar senha, token, secret key, cookie, Authorization header ou
  payload completo de formulario.
- Nunca registrar dados de pagamento alem de status tecnico da operacao.
- Preferir IDs tecnicos, nome do evento somente quando necessario e mensagens
  genericas.
- Antes de producao, rotacionar segredos expostos durante desenvolvimento.

## Checklist Antes Do Go-live

- [ ] Confirmar acesso aos logs da Vercel.
- [ ] Confirmar acesso aos logs do Supabase.
- [ ] Executar smoke test e verificar se falhas aparecem nos logs.
- [ ] Definir canal de alerta manual inicial para falhas de venda/caixa.
- [ ] Decidir se Sentry/Logflare entra na V1 ou na primeira iteracao pos-go-live.
