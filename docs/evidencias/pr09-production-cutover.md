# Evidências PR09 - Corte De Produção

## Estado Do Documento

Template criado na fase local da Task 8 e atualizado somente depois da captura
de saídas reais e redigidas. Resultados ainda não observados permanecem como
`PENDENTE`.

Este arquivo nunca deve conter token, chave, senha, e-mail do administrador,
conteúdo de linhas, hash de senha ou valor de variável de ambiente.

## Identidades Autorizadas

| Item                       | Valor esperado                                                           | Resultado observado |
| -------------------------- | ------------------------------------------------------------------------ | ------------------- |
| Organização Supabase       | `wcqoluxxlvglqtebcucz`                                                   | `CONFIRMADO`        |
| Staging legado             | `espaco-personalize-pdv-staging` / `gpywbeoqcovjrfnmbdqx` / `us-west-2`  | `CONFIRMADO`        |
| Staging Roberto            | `roberto-multimarcas-pdv-staging` / `otsxpchqtfypxgzjzrxs` / `sa-east-1` | `CONFIRMADO`        |
| Produção legada            | `espaco-personalize-pdv` / `ciixpfquwmlsvzleattv` / `us-west-2`          | `CONFIRMADO`        |
| Produção Roberto           | `roberto-multimarcas-pdv` / `wjuzwjbvctbyfvgmprmd` / `sa-east-1`         | `CONFIRMADO`        |
| Organização Vercel         | `team_jstETBWBHJi0hsir3a3bAkbK`                                          | `CONFIRMADO`        |
| Projeto Vercel de produção | `roberto-multimarcas-pdv` / `prj_oBs2uc7uxsHMc7ssHFKczfi52LMq`           | `CONFIRMADO`        |
| URL estável                | `https://roberto-multimarcas-pdv.vercel.app`                             | `CONFIRMADO`        |

## Git E Pull Requests

| Evidência                                             | Valor                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| PR09-A URL (`feature/production-cutover` → `develop`) | `https://github.com/almeidaguil/espaco-personalize-pdv/pull/169` |
| PR09-A commit SHA assinado                            | `e2473eb05cb659b5a55d1e8da9084ff6aace3a14`                       |
| PR09-A Quality URL/resultado                          | `APROVADO` (2m27s)                                               |
| PR09-A Database contract URL/resultado                | `APROVADO` (3m49s)                                               |
| PR09-A E2E Release Gate URL/resultado                 | `APROVADO` (5m41s)                                               |
| PR09-A revisão independente                           | `PENDENTE`                                                       |
| PR09-A merge SHA assinado em `develop`                | `PENDENTE`                                                       |
| PR09-B URL (`develop` → `main`)                       | `PENDENTE`                                                       |
| PR09-B Quality URL/resultado                          | `PENDENTE`                                                       |
| PR09-B Database contract URL/resultado                | `PENDENTE`                                                       |
| PR09-B E2E Release Gate URL/resultado                 | `PENDENTE`                                                       |
| PR09-B merge SHA assinado em `main`                   | `PENDENTE`                                                       |

## Gates Locais Do PR09-A

| Comando                                                | Resultado                    | Data/hora (`America/Sao_Paulo`) |
| ------------------------------------------------------ | ---------------------------- | ------------------------------- |
| `npm.cmd run format:check`                             | `APROVADO`                   | `2026-10-10 08:43:45 -03:00`    |
| `npm.cmd run lint`                                     | `APROVADO`                   | `2026-10-10 08:43:45 -03:00`    |
| `npm.cmd run type-check`                               | `APROVADO`                   | `2026-10-10 08:43:45 -03:00`    |
| `npm.cmd test`                                         | `APROVADO` (124/124; 670)    | `2026-10-10 08:43:45 -03:00`    |
| `npm.cmd run test:no-event-legacy`                     | `APROVADO`                   | `2026-10-10 03:33:11 -03:00`    |
| `npm.cmd run test:db`                                  | `APROVADO` (upgrade PR05)    | `2026-10-10 03:33:11 -03:00`    |
| `npm.cmd run build`                                    | `APROVADO`                   | `2026-10-10 03:33:11 -03:00`    |
| `npm.cmd run test:e2e:local-reset`                     | `APROVADO` (48/48)           | `2026-10-10 03:33:11 -03:00`    |
| Scan de segredos/e-mail pessoal em arquivos rastreados | `APROVADO` (diff PR09 limpo) | `2026-10-10 03:33:11 -03:00`    |

O scan global encontrou duas referências históricas ao e-mail do autor em
documentos de configuração Git anteriores ao PR09. O diff completo do PR09 e
os arquivos desta tarefa não adicionam segredo nem e-mail pessoal.

Na primeira execução do PR09-A, o banco e o E2E iniciaram stacks Supabase
locais simultâneas e disputaram a porta `54322`. Os workflows agora compartilham
um grupo de concorrência por PR/ref, com cancelamento desativado, para serializar
somente os gates que usam essas portas. O contrato dessa configuração possui
teste automatizado.

## Fase 1 - Preflight E Backup

Comandos previstos:

```powershell
npm.cmd run ops:verify-target -- --provider supabase --environment legacy-production --operation read
npm.cmd run ops:inventory-production -- --output .provisioning/production-backup/production-backup.json
npm.cmd run ops:provision-production -- --inventory .provisioning/production-backup/production-backup.json
npm.cmd run ops:provision-vercel-production -- --phase audit
```

O audit Vercel deste preflight não depende de estado de cutover e deve apenas
confirmar, sem mutações, que o projeto reservado continua vazio.

| Evidência remota                                | Resultado                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| Staging legado `INACTIVE`                       | `CONFIRMADO`                                                       |
| Staging Roberto `ACTIVE_HEALTHY`                | `CONFIRMADO`                                                       |
| Produção legada `ACTIVE_HEALTHY`                | `CONFIRMADO`                                                       |
| Produção Roberto ausente                        | `CONFIRMADO`                                                       |
| Vercel reservado com zero variáveis/deployments | `CONFIRMADO`; Authentication desabilitada e audit aprovado         |
| Projetos Supabase ativos antes da pausa         | `2`                                                                |
| Inventário: caminho local autorizado            | `.provisioning/production-backup/production-backup.json`           |
| Inventário: origem exata                        | `ciixpfquwmlsvzleattv` / `espaco-personalize-pdv`                  |
| Inventário: timestamp/idade                     | `2026-10-12T16:24:49.019Z`; válido no preflight                    |
| Inventário: SHA-256                             | `1e21343c2e7e604a8e7c7eaf2bd897feab69024ea4cc217a7c35ff4960132d18` |
| Inventário: validação de integridade            | `APROVADO` pelo dry-run Supabase                                   |

O preflight de 2026-10-10 não realizou mutações. O projeto Vercel reservado
continua com zero variáveis e zero deployments, mas a API reportou Vercel
Authentication como `all_except_custom_domains`. Esse estado é incompatível
com o login próprio da aplicação e interrompe o corte. A mesma API representa
a ausência de bypass com o sentinela vazio `{"": null}`; o auditor ganhou uma
regressão para aceitar somente esse sentinela e continuar rejeitando qualquer
identificador real de bypass.

Em `2026-10-12 13:24:14 -03:00`, após autorização explícita para o projeto
`prj_oBs2uc7uxsHMc7ssHFKczfi52LMq` da organização
`team_jstETBWBHJi0hsir3a3bAkbK`, a Vercel Authentication foi alterada de
`all_except_custom_domains` para `none`. Os guardrails confirmaram o nome
`roberto-multimarcas-pdv`, preset Next.js, Node.js 22.x, domínio padrão exato,
zero variáveis, zero deployments, ausência de bypass e projeto ainda não
vinculado ao Git. A releitura posterior e
`npm.cmd run ops:provision-vercel-production -- --phase audit` foram aprovadas.

A primeira renovação do inventário Supabase em `2026-10-12` foi interrompida
antes da escrita do artefato porque o endpoint oficial de chaves retornou HTTP
500 em duas requisições independentes. Uma nova tentativa pelo mesmo caminho
oficial foi concluída às `2026-10-12T16:24:49.019Z`; a evidência íntegra recebeu
o SHA-256 registrado acima e o dry-run do provisionador foi aprovado. A
listagem oficial confirmou o legado e o staging Roberto como `ACTIVE_HEALTHY`,
o staging legado como `INACTIVE`, a produção Roberto ausente e exatamente dois
projetos ativos. Nenhuma mutação Supabase foi realizada.

## Fase 2 - Confirmação E Pausa

Frase literal a ser solicitada imediatamente antes da pausa:

```text
CONFIRMO PAUSAR A PRODUÇÃO LEGADA espaco-personalize-pdv DA ORGANIZAÇÃO wcqoluxxlvglqtebcucz, REF ciixpfquwmlsvzleattv
```

Comando previsto após a confirmação nova:

```powershell
npm.cmd run ops:provision-production -- --inventory .provisioning/production-backup/production-backup.json --execute --confirm-legacy-ref ciixpfquwmlsvzleattv --confirm-target-name roberto-multimarcas-pdv
```

| Evidência remota                           | Resultado    |
| ------------------------------------------ | ------------ |
| Confirmação literal recebida no checkpoint | `CONFIRMADO` |
| Produção legada pausada e `INACTIVE`       | `CONFIRMADO` |
| Staging Roberto permaneceu saudável        | `CONFIRMADO` |
| Vaga na cota Free confirmada após a pausa  | `CONFIRMADO` |

## Fase 3 - Produção Supabase

Depois da criação, preencher o ref somente com o valor observado e persistido no
manifesto. O comando de retomada previsto é:

```powershell
npm.cmd run ops:provision-production -- --inventory .provisioning/production-backup/production-backup.json --execute --confirm-target-ref <production-ref>
npm.cmd run ops:bootstrap-production-admin -- --execute --confirm-ref <production-ref>
```

Em retomada após criação parcial, o primeiro comando exige o ref literal
observado, reconcilia a identidade completa e não cria outro projeto. A janela
de uma hora vale imediatamente antes da pausa; depois de `legacy-paused`, o
artefato precisa corresponder exatamente ao hash, origem e timestamp gravados
no estado retomável.

| Evidência remota                                    | Resultado                                     |
| --------------------------------------------------- | --------------------------------------------- |
| Novo project ref                                    | `wjuzwjbvctbyfvgmprmd`                        |
| Novo hostname                                       | `wjuzwjbvctbyfvgmprmd.supabase.co`            |
| Nome/organização/região exatos                      | `CONFIRMADO`                                  |
| Commit assinado que persiste ref/hostname           | `dfa911c602f6abb3c1067d5fc27d1db837ebe8cd`    |
| Migration dry-run                                   | `APROVADO`                                    |
| Migration push real                                 | `APROVADO` (24 migrations em paridade)        |
| Auth: signup público e acesso anônimo desabilitados | `CONFIRMADO`                                  |
| Auth: senha mínima 14                               | `CONFIRMADO`                                  |
| Auth: HIBP indisponível no Free                     | `EXCEÇÃO AUTORIZADA`; `unavailable-free-plan` |
| Auth: site URL e allowlist exatas                   | `CONFIRMADO`                                  |
| Exatamente um admin                                 | `CONFIRMADO`                                  |
| Zero operadores/outros usuários                     | `CONFIRMADO`                                  |
| Zero dados operacionais                             | `CONFIRMADO`                                  |

O push remoto alinhou as 24 migrations locais e remotas. A primeira tentativa
de Auth parou visivelmente em HTTP 402 porque HaveIBeenPwned exige Supabase Pro;
o PATCH foi atômico e os defaults permaneceram inalterados. Em seguida, o
proprietário autorizou literalmente a continuidade sem custo. A retomada exige
`--confirm-auth-exception SUPABASE_FREE_WITHOUT_HIBP`, mantém signup e acesso
anônimo desabilitados, senha mínima 14 e URLs exatas, e registra a exceção
`unavailable-free-plan`. Nenhum outro erro de Auth pode usar esse fallback.

Em `2026-10-12 18:32:58 -03:00`, após o commit assinado
`e2473eb05cb659b5a55d1e8da9084ff6aace3a14` passar Quality, contrato do banco,
E2E e Vercel, a retomada idempotente concluiu `database-ready`. A releitura da
Management API confirmou signup desabilitado, acesso anônimo desabilitado,
login por e-mail habilitado, senha mínima de 14 caracteres, HIBP desabilitado e
URL/allowlist restritas a `https://roberto-multimarcas-pdv.vercel.app`. O estado
operacional registra explicitamente `unavailable-free-plan`; nenhum segredo ou
identificador do administrador foi gravado nesta evidência.

O primeiro gerador local de senha encontrou uma API criptográfica incompatível
com a versão do PowerShell. O aviso foi detectado antes de qualquer criação
remota; o dry-run confirmou zero usuários e a credencial local provisória foi
substituída imediatamente. A credencial definitiva usa 32 bytes de entropia do
gerador criptográfico do sistema, produz senha de 47 caracteres e fica somente
no Windows Credential Manager. O bootstrap posterior criou exatamente um
perfil `admin`, confirmou zero operadores e zero linhas nas tabelas
operacionais, e registrou a fase `admin-ready`.

## Fase 4 - Vercel E Deployment Provisório

Comandos previstos:

```powershell
npm.cmd run ops:provision-vercel-production -- --phase audit --execute --confirm-project prj_oBs2uc7uxsHMc7ssHFKczfi52LMq
npm.cmd run ops:provision-vercel-production -- --phase configure --execute --confirm-project prj_oBs2uc7uxsHMc7ssHFKczfi52LMq
npm.cmd run ops:provision-vercel-production -- --phase deploy --source-ref feature/production-cutover --commit-sha <signed-commit-sha> --execute --confirm-project prj_oBs2uc7uxsHMc7ssHFKczfi52LMq
npm.cmd run ops:provision-vercel-production -- --phase verify --execute --confirm-project prj_oBs2uc7uxsHMc7ssHFKczfi52LMq
```

| Evidência remota                        | Resultado                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Exatamente três variáveis `Production`  | `CONFIRMADO`                                                              |
| `SUPABASE_SECRET_KEY` marcada sensível  | `CONFIRMADO`                                                              |
| Preset Next.js / Node.js 22.x           | `CONFIRMADO`                                                              |
| Deployment ID                           | `dpl_TPMhRTBXKrsfz4GBraLXV7fg2PuC`                                        |
| Deployment URL imutável                 | `https://roberto-multimarcas-gvgkm8qvh-guilherme-a-s-projects.vercel.app` |
| Deployment `READY`                      | `CONFIRMADO`                                                              |
| Alias estável exato                     | `https://roberto-multimarcas-pdv.vercel.app`                              |
| Commit implantado                       | `4076d945192132f753965924680916efdd466dcf`                                |
| Vercel Authentication/bypasses ausentes | `CONFIRMADO`                                                              |

O projeto foi auditado imediatamente antes da configuração. As três variáveis
foram reconciliadas exclusivamente no target `Production`; seus valores foram
mantidos em memória e não aparecem nesta evidência. O deployment imutável da
branch `feature/production-cutover` ficou `READY`, recebeu o alias estável e
passou a releitura de identidade, fingerprint e proteção. O manifesto registra
somente ID e URL não sensíveis do deployment.

## Fase 5 - Verificação, Smoke E Monitoramento

Comandos previstos:

```powershell
npm.cmd run ops:verify-production -- --confirm-ref <production-ref>
npm.cmd run test:e2e:production-smoke
```

| Evidência remota                          | Resultado  |
| ----------------------------------------- | ---------- |
| Verificação do contrato Supabase          | `PENDENTE` |
| Verificação do contrato Vercel            | `PENDENTE` |
| Smoke autenticado somente leitura         | `PENDENTE` |
| Ausência de request mutável no smoke      | `PENDENTE` |
| Início da janela de monitoramento         | `PENDENTE` |
| Verificações a cada cinco minutos         | `PENDENTE` |
| Fim da janela após 30 minutos sem lacunas | `PENDENTE` |
| Logs/availability sem erro crítico        | `PENDENTE` |

## Fase 6 - PR09-B E Deployment Final

| Evidência remota                                | Resultado  |
| ----------------------------------------------- | ---------- |
| Audit Vercel permitindo `main`                  | `PENDENTE` |
| SHA assinado de `main` implantado               | `PENDENTE` |
| Deployment final ID/URL imutável                | `PENDENTE` |
| Alias estável apontando para o deployment final | `PENDENTE` |
| Fingerprint das variáveis do deployment final   | `PENDENTE` |
| Verificação remota final                        | `PENDENTE` |
| Smoke somente leitura final                     | `PENDENTE` |
| Monitoramento final de 30 minutos               | `PENDENTE` |
| Produção legada preservada para rollback        | `PENDENTE` |
| Data final da janela de 30 dias                 | `PENDENTE` |

Comandos previstos para a evidência final, usando somente identificadores não
sensíveis:

```powershell
npm.cmd run ops:verify-production -- --confirm-ref <production-ref> --deployment-id <main-deployment-id> --deployment-url <immutable-main-deployment-url> --source-ref main --commit-sha <signed-main-sha>
npm.cmd run test:e2e:production-smoke -- --deployment-id <main-deployment-id> --deployment-url <immutable-main-deployment-url> --source-ref main --commit-sha <signed-main-sha>
```

## Preparação Operacional Posterior

| Marco manual                                       | Resultado  |
| -------------------------------------------------- | ---------- |
| Vendedores cadastrados pela aplicação              | `PENDENTE` |
| Produtos cadastrados pela aplicação                | `PENDENTE` |
| Estoque inicial lançado pela aplicação             | `PENDENTE` |
| Venda/cancelamento/fechamento/relatório conferidos | `PENDENTE` |
| Dois operadores reais validados simultaneamente    | `PENDENTE` |

O marco técnico pode terminar antes desses cadastros. O primeiro marco
operacional somente termina depois da validação com dois operadores.

## Incidentes E Rollback

| Campo                                           | Valor      |
| ----------------------------------------------- | ---------- |
| Incidente identificado                          | `PENDENTE` |
| Escritas operacionais já ocorreram?             | `PENDENTE` |
| Decisão: interromper / rollback / reconciliação | `PENDENTE` |
| Nova autorização para restauração, se aplicável | `PENDENTE` |
| Resultado da restauração manual, se aplicável   | `PENDENTE` |

Nenhuma exclusão, restauração ou reinicialização remota é automática. Antes de
escritas, o rollback pausa o novo projeto e restaura manualmente o legado após
nova autorização. Depois de escritas, preserve ambos os estados e reconcilie
manualmente. A produção legada permanece pausada por 30 dias e sua eventual
exclusão exige autorização futura específica.
