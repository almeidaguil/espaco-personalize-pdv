# Observabilidade

Estratégia mínima de observabilidade do runtime da loja física Roberto Multimarcas.

## Objetivo

Detectar falhas de produção e correlacionar operações sem registrar credenciais,
dados pessoais ou payloads completos.

## O Que Já Existe

- Logs do servidor em JSON para falhas inesperadas na finalização e no
  cancelamento de venda e no fechamento de caixa.
- Redação de campos sensíveis pelo logger local.
- GitHub Actions, deployment Vercel de staging dedicado, contrato de banco e E2E
  Release Gate como sinais de qualidade antes da release.

Os logs atuais identificam a operação e a falha. Não presumir que todo registro
já inclua IDs de operador, caixa e venda; usar esses identificadores quando
disponíveis para a investigação.

## Ocorrências Críticas

Monitorar:

- `sale.create.failed`;
- `sale.cancel.failed`;
- `cash.close.failed`;
- falhas recorrentes de login/autenticação;
- erros de conectividade com Supabase;
- falhas de deploy ou do gate E2E;
- inconsistências de estoque, associação de venda ao caixa ou reconciliação.

## Onde Observar

Fontes atuais:

- Vercel Runtime Logs de `roberto-multimarcas-pdv-staging`;
- Vercel Runtime Logs do projeto legado para a produção enquanto o PR09 não
  ocorrer;
- Supabase Logs;
- GitHub Actions.

Sentry, centralização de logs e alertas automáticos são possíveis evoluções,
ainda não entregues por este PR. Até sua definição, o responsável operacional
acompanha as fontes atuais e registra incidentes.

## Registro De Incidente E Segurança

- Registrar horário, operação, mensagem técnica sanitizada e, para identificação
  das entidades, somente IDs de operador, sessão de caixa e venda disponíveis.
- Não registrar nomes, e-mails, dados de cliente, credenciais ou dados de pagamento.
- Nunca registrar senha, token, secret key, cookie, cabeçalho de autorização
  ou payload completo de formulário.
- Não copiar chaves locais ou remotas para logs, screenshots, relatórios ou commits.
- Conferir conteúdo de traces antes de compartilhar; proteger arquivos que
  contenham sessão autenticada.
- Revisar e rotacionar segredos expostos antes da produção.

O logger redige campos com nomes sensíveis, mas isso não autoriza enviar dados
sensíveis no texto da mensagem ou em outros campos.

## Checklist Antes Do Go-Live

- [ ] Confirmar acesso aos logs dos projetos Vercel novo e legado e do Supabase.
- [ ] Conferir consumo e limites vigentes do Vercel Hobby e bloquear deployments
      não essenciais perto do limite.
- [ ] Executar smoke em ambiente isolado e conferir diagnóstico de falhas.
- [ ] Definir responsável e canal seguro de acompanhamento de incidentes.
- [ ] Conferir acesso restrito aos traces e evidências.
- [ ] Decidir a futura ferramenta de centralização e alertas.

Para resposta operacional, consulte o
[Runbook operacional](runbook-operacional.md).
