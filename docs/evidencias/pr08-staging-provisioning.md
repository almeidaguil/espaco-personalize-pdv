# Evidências Do Provisionamento De Staging — PR08

Registro redigido do provisionamento controlado dos ambientes da Roberto
Multimarcas. Tokens, chaves, senhas, e-mails, IDs pessoais e caminhos de objetos
não são registrados neste documento.

## Preflight

- Inventário capturado em: `2026-10-07T09:40:37.484Z`.
- Organização Supabase validada: `wcqoluxxlvglqtebcucz`.
- Staging legado validado: `espaco-personalize-pdv-staging`, ref
  `gpywbeoqcovjrfnmbdqx`, região `us-west-2`, estado `ACTIVE_HEALTHY`.
- Produção legada validada: ref `ciixpfquwmlsvzleattv`, região `us-west-2`,
  estado `ACTIVE_HEALTHY`.
- Região do novo staging validada: `sa-east-1` disponível.
- Novo staging Supabase: `roberto-multimarcas-pdv-staging`, ref
  `otsxpchqtfypxgzjzrxs`, região `sa-east-1`, estado `ACTIVE_HEALTHY`.
- SHA-256 da evidência privada ignorada pelo Git:
  `f23dbd663770a8ca3a9d44b7a24042c5c24b06ad365891717378c8eec252c3b1`.

## Contagens Do Staging Legado

| Tabela            | Registros |
| ----------------- | --------: |
| `profiles`        |         2 |
| `categories`      |         0 |
| `products`        |        34 |
| `stock_movements` |        49 |
| `cash_sessions`   |        41 |
| `sales`           |        24 |
| `sale_items`      |        24 |
| `payments`        |        24 |

## Tentativa Netlify Descartada

Validação concluída em `2026-10-07T11:14:28.6376212Z`.

- Conta: `6ac5be70c558d25c9b304db5`.
- Plano: Free, 300 créditos mensais, uso observado 0 e recarga automática
  desativada.
- Site: `roberto-multimarcas-pdv`.
- Site ID: `cf55faf1-cf67-4120-a2f4-23eb5600e6c7`.
- URL: `https://roberto-multimarcas-pdv.netlify.app`.
- Repositório: `almeidaguil/espaco-personalize-pdv`.
- Branch não produtiva autorizada: `develop`.
- Branch produtiva bloqueada: `netlify-production-disabled-pr09`.
- Comando de build: `npm run build`.
- Deploys produtivos fora do Git: bloqueados.
- Deploy executado: nenhum nesta etapa.

Esse site deixou de ser o alvo do PR08 antes da configuração de variáveis ou
de qualquer deploy. O registro acima é preservado como evidência histórica; ele
não descreve o runtime alvo atual. Nenhuma exclusão remota foi autorizada.

Durante a primeira tentativa, a API criou o shell e recusou ativar a proteção
antes do vínculo ao repositório. O shell foi preservado, identificado pelo ID
acima e recuperado somente após validação de conta, nome, ausência de vínculo e
confirmação literal do ID. A automação passou a ordenar criação, vínculo e
proteção, com cobertura automatizada para recuperação explícita.

## Pivot Para Vercel Hobby

O proprietário declarou que o uso é pessoal e não comercial e aprovou o Vercel
Hobby como novo destino. Preflight somente leitura executado em
`2026-10-07T19:53:05.8854578Z`:

- projeto novo: `roberto-multimarcas-pdv`;
- project ID: `prj_oBs2uc7uxsHMc7ssHFKczfi52LMq`;
- org ID: `team_jstETBWBHJi0hsir3a3bAkbK`;
- deployments encontrados: zero;
- Production Deployment criado: não;
- configuração inicial encontrada: framework `Other` e Node `24.x`;
- configuração corrigida e revalidada: framework `Next.js` e Node `22.x`;
- três variáveis gravadas somente em Preview; `SUPABASE_SECRET_KEY` marcada
  como Sensitive e Production sem variáveis.

O projeto novo será usado somente para Preview no PR08. Variáveis, aliases,
deployment de Production e `--prod` continuam proibidos. A produção Vercel e o
Supabase legados permanecem intactos.

Quatro tentativas pela CLI e uma tentativa pela API com referência Git foram
classificadas incorretamente como Production
pela Vercel, apesar da ausência de `--prod`; todas falharam no build antes de
publicar o runtime porque variáveis Preview não são injetadas em Production.
Cada deployment falho foi removido pelo ID exato e a consulta final voltou a
mostrar zero deployments de Production. O comportamento coincide com a
[ocorrência aberta na CLI da Vercel](https://github.com/vercel/vercel/issues/17069).
Os dois fluxos foram abandonados após a reprodução. A automação mantém remoção
automática e falha fechada se uma solicitação de Preview vier classificada como
Production. A consulta final mostrou zero deployments Production e Preview.

## Estado Do Checkpoint

- Dry-runs Supabase: aprovados. O dry-run Netlify permanece apenas como
  evidência da tentativa descartada.
- Inventário redigido: aprovado.
- Site Netlify: criado e vinculado, sem deploy ou variáveis; não é mais o alvo.
- Staging legado Supabase: pausado, estado `INACTIVE`.
- Produção legada Supabase: ativa, saudável e inalterada.
- Novo staging Supabase: criado, saudável e com migrations aplicadas em
  `2026-10-07T16:37:23.6584486Z`.
- Auth do novo staging: signup público e anônimo desativados e senha mínima de
  14 caracteres; URL/allowlist ainda apontam para a tentativa Netlify e devem ser
  atualizadas para a URL Vercel Preview exata antes do smoke.
- Proteção HaveIBeenPwned: indisponível no plano Free; a API respondeu `402` e a
  automação aplicou somente o fallback explicitamente permitido.
- Bootstrap do administrador: concluído em `2026-10-07T19:35:24.8780997Z`, com
  exatamente um usuário e perfil `admin`; e-mail e credencial não registrados.
- Vercel: framework/Node e variáveis Preview concluídos; o primeiro deployment
  Preview está bloqueado pelo defeito reproduzido da plataforma. Reconciliação
  do Auth e smoke dependem da decisão arquitetural sobre um projeto dedicado de
  staging.

Na primeira retomada, o Node 22 no Windows recusou executar `npx.cmd` diretamente
com `spawnSync` e retornou `EINVAL`. Um executor compartilhado passou a usar o
interpretador do Windows apenas para arquivos `.cmd`, mantendo os argumentos
controlados e credenciais somente no ambiente do processo. A senha efêmera do
banco foi rotacionada somente no novo staging e nunca foi registrada.
