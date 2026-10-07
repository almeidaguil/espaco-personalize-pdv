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

## Netlify

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

Durante a primeira tentativa, a API criou o shell e recusou ativar a proteção
antes do vínculo ao repositório. O shell foi preservado, identificado pelo ID
acima e recuperado somente após validação de conta, nome, ausência de vínculo e
confirmação literal do ID. A automação passou a ordenar criação, vínculo e
proteção, com cobertura automatizada para recuperação explícita.

## Estado Do Checkpoint

- Dry-runs Supabase e Netlify: aprovados.
- Inventário redigido: aprovado.
- Site Netlify não produtivo: criado, vinculado e validado.
- Staging legado Supabase: pausado, estado `INACTIVE`.
- Produção legada Supabase: ativa, saudável e inalterada.
- Novo staging Supabase: criado, saudável e com migrations aplicadas em
  `2026-10-07T16:37:23.6584486Z`.
- Auth do novo staging: signup público e anônimo desativados, senha mínima de 14
  caracteres e URL/allowlist restritas ao site Netlify aprovado.
- Proteção HaveIBeenPwned: indisponível no plano Free; a API respondeu `402` e a
  automação aplicou somente o fallback explicitamente permitido.
- Bootstrap do administrador: concluído em `2026-10-07T19:35:24.8780997Z`, com
  exatamente um usuário e perfil `admin`; e-mail e credencial não registrados.
- Variáveis Netlify, deploy não produtivo e smoke: pendentes.

Na primeira retomada, o Node 22 no Windows recusou executar `npx.cmd` diretamente
com `spawnSync` e retornou `EINVAL`. Um executor compartilhado passou a usar o
interpretador do Windows apenas para arquivos `.cmd`, mantendo os argumentos
controlados e credenciais somente no ambiente do processo. A senha efêmera do
banco foi rotacionada somente no novo staging e nunca foi registrada.
