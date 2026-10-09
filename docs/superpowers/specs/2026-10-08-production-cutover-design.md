# PR09 - Release E Corte De Produção Roberto Multimarcas

## 1. Status

Desenho aprovado pelo proprietário em 2026-10-08.

Este documento define o PR09-A, de preparação e provisionamento controlado, e o
PR09-B, de release de `develop` para `main`. A aprovação deste desenho não
autoriza a pausa da produção legada. Essa mutação exige uma nova confirmação
literal imediatamente antes da janela de corte.

## 2. Objetivo

Publicar a primeira produção da Roberto Multimarcas sem custo mensal base,
partindo de um banco vazio, com somente o administrador inicial e sem migrar
dados da operação Espaço Personalize.

O corte deve:

- preservar staging e produção em projetos Supabase distintos;
- manter no máximo dois projetos Supabase Free ativos;
- usar `sa-east-1` nos projetos novos;
- manter a produção legada pausada por 30 dias para rollback;
- publicar a aplicação em `https://roberto-multimarcas-pdv.vercel.app`;
- proteger o sistema pelo login da aplicação e pelo Supabase Auth;
- impedir exclusões automáticas e vazamento de segredos;
- ser reproduzível, retomável e auditável pelo terminal.

## 3. Decisões Aprovadas

1. A produção nova começa com banco operacional vazio.
2. Não serão migrados usuários, produtos, estoque, vendas, caixas ou Storage da
   Espaço Personalize.
3. O único usuário criado durante o corte será o administrador designado pelo
   proprietário. Seu e-mail permanecerá somente no Credential Manager e na
   memória do processo.
4. Vendedores serão cadastrados depois pelo administrador em `/settings`.
5. Produtos e estoque inicial serão cadastrados manualmente pelo sistema.
6. A URL inicial será o domínio padrão do projeto Vercel reservado:
   `https://roberto-multimarcas-pdv.vercel.app`.
7. Produção não usará Vercel Authentication, pois vendedores futuros não serão
   membros da conta Vercel. Rotas privadas continuarão protegidas pela aplicação.
8. A produção legada ficará pausada por 30 dias. Sua exclusão não faz parte do
   PR09 e exigirá autorização futura específica.
9. Staging novo permanecerá ativo durante e depois do corte.
10. O corte será dividido em PR09-A e PR09-B.

## 4. Estado Inicial E Alvos

### 4.1 Supabase

Organização autorizada: `wcqoluxxlvglqtebcucz`.

| Uso             | Nome                              | Project ref            | Região      | Estado esperado antes do corte |
| --------------- | --------------------------------- | ---------------------- | ----------- | ------------------------------ |
| staging legado  | `espaco-personalize-pdv-staging`  | `gpywbeoqcovjrfnmbdqx` | `us-west-2` | pausado                        |
| produção legada | `espaco-personalize-pdv`          | `ciixpfquwmlsvzleattv` | `us-west-2` | saudável e ativo               |
| staging novo    | `roberto-multimarcas-pdv-staging` | `otsxpchqtfypxgzjzrxs` | `sa-east-1` | saudável e ativo               |
| produção nova   | `roberto-multimarcas-pdv`         | pendente               | `sa-east-1` | ausente                        |

Projetos pausados não contam para o limite gratuito. O Supabase documenta uma
janela de restauração de até um ano, mas a janela operacional aprovada neste
projeto é de 30 dias.

### 4.2 Vercel

Organização autorizada: `team_jstETBWBHJi0hsir3a3bAkbK`.

| Uso      | Projeto                           | Project ID                         | Estado esperado antes do corte |
| -------- | --------------------------------- | ---------------------------------- | ------------------------------ |
| staging  | `roberto-multimarcas-pdv-staging` | `prj_fb7pug2hcbCGI1XIMLz5VuMr4S79` | ativo e protegido              |
| produção | `roberto-multimarcas-pdv`         | `prj_oBs2uc7uxsHMc7ssHFKczfi52LMq` | reservado e vazio              |

O projeto Vercel legado `espaco-personalize-pdv` não será excluído nem
reconfigurado no PR09. Ele continuará disponível para o rollback da operação
legada durante a janela aprovada.

## 5. Estrutura Das Entregas

### 5.1 PR09-A - Preparação E Provisionamento Controlado

Branch: `feature/production-cutover`, integrada em `develop` exclusivamente por
pull request.

O PR09-A terá duas fases internas.

#### Fase A - Preparação sem mutação remota

- evoluir o manifesto para identidades separadas de staging e produção;
- implementar políticas e comandos específicos de produção;
- implementar inventário, evidência de backup e estado retomável;
- implementar provisionamento Supabase, bootstrap, Vercel, verificação e smoke;
- escrever testes, runbook, checklist e rollback;
- executar todos os gates locais;
- abrir o PR e obter revisão independente e checks verdes.

#### Fase B - Janela de corte autorizada

- congelar mudanças concorrentes;
- revalidar todos os IDs, refs, estados, quota e custo;
- gerar a evidência de backup;
- solicitar confirmação literal da pausa da produção legada;
- pausar `ciixpfquwmlsvzleattv`;
- confirmar a vaga na cota gratuita;
- criar a produção nova em `sa-east-1`;
- persistir o novo ref e hostname no manifesto da branch;
- aplicar migrations e bootstrap do administrador;
- configurar e publicar o projeto Vercel reservado;
- executar verificação remota e smoke;
- repetir gates e checks antes do merge em `develop`.

Nenhuma mutação da Fase B pode ocorrer antes de a Fase A estar revisada e verde.

### 5.2 PR09-B - Release

O PR09-B será um pull request de `develop` para `main`.

- exigir histórico linear e commits assinados;
- exigir Quality, Database contract e E2E Release Gate;
- integrar pelo método permitido pelas proteções do repositório;
- publicar o commit resultante de `main` no projeto Vercel de produção;
- repetir verificação remota e smoke somente leitura;
- monitorar logs e disponibilidade depois do deploy.

O deployment provisório do PR09-A serve para validar o conteúdo exato antes do
release. O deployment final deve usar o commit de `main`.

## 6. Componentes

### 6.1 Manifesto De Ambientes V2

`config/remote-environments.json` deverá representar staging e produção como
alvos completos e independentes para Supabase e Vercel.

O manifesto conterá apenas valores não sensíveis:

- organização, nome, project ref, região e hostname Supabase;
- organização, scope, nome e project ID Vercel;
- repositório e commit/ref de origem autorizados;
- URL estável, deployment ID e URL imutável depois do deploy;
- política de proteção esperada por ambiente.

Durante a criação, o ref de produção começa nulo. Depois que a identidade remota
for validada, ref e hostname serão persistidos na branch antes do merge.

### 6.2 Política De Alvo Remoto

A política compartilhada deverá:

- distinguir `legacy-production`, `production`, `staging` e
  `legacy-staging`;
- impedir o uso de refs legados em operações de produção nova;
- impedir o uso do ref de staging em produção;
- validar organização, projeto, região, hostname e ambiente lógico;
- exigir `--execute` e confirmação literal para toda mutação;
- recusar opções sem valor, confirmações duplicadas e inventários fora da pasta
  autorizada;
- redigir valores sensíveis em erros, logs e resultados.

### 6.3 Evidência De Backup

O rollback primário será o snapshot preservado pela pausa do Supabase. Antes da
pausa, um pacote técnico local deverá registrar:

- identidade e estado do projeto;
- migrations e versão do banco;
- schema e extensões relevantes;
- contagens por tabela, sem conteúdo de linhas;
- inventário de Auth por quantidade e papéis, sem e-mails ou hashes;
- inventário de buckets e quantidade de objetos, sem conteúdo;
- configuração redigida necessária para recuperação;
- timestamp, hash da evidência e projeto de origem.

O pacote ficará em `.provisioning/production-backup/`, ignorado pelo Git, com
permissões locais restritas. Ele não substituirá um backup integral de dados; o
snapshot pausado continuará sendo a fonte de restauração da operação legada.

### 6.4 Estado Retomável

Cada fase escreverá um estado não sensível em
`.provisioning/production-cutover-state.json` com:

- fase concluída;
- IDs e refs já confirmados;
- timestamps e hashes das evidências;
- commit implantado;
- resultado das verificações.

O arquivo será ignorado pelo Git. Uma retomada não confiará apenas nesse estado:
ela consultará novamente os provedores e comparará a identidade real.

### 6.5 Provisionamento Supabase

O provisionador de produção deverá:

- executar dry-run por padrão;
- exigir evidência de backup recente;
- confirmar que produção legada e staging novo estão saudáveis;
- pausar somente a produção legada após confirmação literal;
- confirmar que o projeto ficou `INACTIVE` antes de criar outro;
- criar somente `roberto-multimarcas-pdv` em `sa-east-1`;
- validar a identidade completa imediatamente após a criação;
- executar `supabase db push --linked --dry-run` antes do push real;
- nunca executar `db reset` remotamente;
- configurar Auth com signup público bloqueado, senha mínima de 14 caracteres,
  proteção contra senhas vazadas e URL de produção exata;
- preservar o projeto parcial em caso de falha;
- nunca excluir ou restaurar projetos automaticamente.

### 6.6 Bootstrap Do Administrador

O bootstrap será idempotente e exclusivo para produção.

- e-mail obtido do Credential Manager e confirmado somente em memória;
- senha fornecida somente por variável temporária ou Credential Manager;
- exatamente um usuário e um perfil `admin` ao final;
- zero operadores e zero dados operacionais;
- falha fechada diante de usuário extra, papel divergente ou e-mail diferente;
- nenhuma senha, token ou e-mail completo em logs estruturados de evidência.

### 6.7 Vercel De Produção

O comando de produção deverá operar exclusivamente no projeto
`prj_oBs2uc7uxsHMc7ssHFKczfi52LMq`.

- auditar que o projeto reservado continua vazio antes da primeira mutação;
- configurar exatamente três variáveis no target Production;
- marcar `SUPABASE_SECRET_KEY` como sensível;
- usar preset Next.js e Node.js 22.x;
- publicar somente o repositório e commit autorizados;
- validar deployment READY, aliases e URL estável;
- não ativar Vercel Authentication em produção;
- não criar domínio customizado no PR09;
- não alterar staging ou o projeto Vercel legado;
- enviar segredos no corpo HTTPS ou stdin, nunca em argumentos de processo.

### 6.8 Verificação E Smoke

A verificação remota deverá ser majoritariamente somente leitura e confirmar:

- projeto linkado e migrations alinhadas;
- lint do banco, schema, extensões, RLS, policies e grants;
- exatamente um administrador e nenhum outro usuário;
- tabelas operacionais vazias;
- Auth configurado para a URL de produção;
- exatamente três variáveis Vercel;
- deployment READY e domínio estável;
- ausência de bypasses e proteções Vercel incompatíveis.

O smoke de produção cobrirá login, dashboard e rotas privadas. Não criará
produto, estoque, caixa, venda, pagamento ou cancelamento.

## 7. Fluxo Operacional

```text
preflight somente leitura
  -> inventário e evidência de backup
  -> aprovação da janela
  -> confirmação literal do ref legado
  -> pausa da produção legada
  -> confirmação de cota
  -> criação da produção nova
  -> persistência do novo ref
  -> migrations e Auth
  -> bootstrap do administrador
  -> configuração Vercel
  -> deploy do commit autorizado
  -> verificação remota
  -> smoke autenticado
  -> monitoramento
  -> merge PR09-A em develop
  -> release PR09-B para main
  -> deploy e smoke do commit de main
```

## 8. Tratamento De Falhas

- Identidade divergente: parar antes de qualquer mutação.
- Evidência ausente, antiga ou adulterada: bloquear a pausa.
- Produção legada não saudável: não iniciar o corte.
- Staging novo não saudável: não iniciar o corte.
- Pausa não confirmada: não criar produção.
- Cota não liberada: interromper e preservar o estado; não excluir projeto.
- Criação parcial: preservar o projeto e retomar somente após nova inspeção.
- Migration dry-run com falha: não aplicar migrations nem configurar Auth.
- Migration real com falha: preservar o projeto; não aplicar SQL manual.
- Bootstrap incompatível: não sobrescrever usuário.
- Vercel divergente: não configurar variáveis nem realizar deploy.
- Deploy falhou: preservar logs redigidos e não promover `main`.
- Smoke falhou: bloquear merge/release e avaliar rollback.
- Falha de monitoramento: tratar como estado desconhecido, não como sucesso.

## 9. Rollback

### 9.1 Antes De Escritas Operacionais Na Produção Nova

1. Bloquear acesso ao novo ambiente.
2. Pausar a produção nova para respeitar a cota gratuita.
3. Confirmar novamente o ref legado `ciixpfquwmlsvzleattv`.
4. Restaurar a produção legada.
5. Validar Auth, API e aplicação legada.
6. Registrar o incidente e preservar a produção nova para diagnóstico.

### 9.2 Depois De Escritas Operacionais

Um rollback depois de produtos, estoque, caixas ou vendas reais cria divergência
de dados. Nesse cenário:

1. interromper novas operações;
2. preservar ambos os estados;
3. inventariar as escritas feitas na produção nova;
4. decidir manualmente a reconciliação antes de restaurar o legado;
5. não apagar histórico financeiro para simplificar a volta.

O sistema não automatizará essa reconciliação.

### 9.3 Encerramento Da Janela

Após 30 dias de operação estável, o projeto legado poderá ser avaliado para
exclusão. Nenhuma exclusão será agendada ou executada automaticamente. O
proprietário deverá emitir uma nova autorização explícita com organização, nome
e project ref.

## 10. Segurança

- Segredos ficam no Windows Credential Manager ou na memória do processo.
- Arquivos `.env.local`, evidências e backups permanecem ignorados pelo Git.
- Tokens, chaves e senhas não aparecem em argv, logs ou erros.
- Logs estruturados contêm somente IDs não sensíveis e estados.
- O frontend nunca escolhe o operador de operações financeiras.
- Signup público permanece desabilitado.
- Rotas privadas exigem sessão autenticada.
- Escritas financeiras diretas continuam bloqueadas; somente RPCs autorizadas
  podem criar ou compensar registros.
- Nenhum comando destrutivo aceita nome como substituto de project ref.
- A automação não contém operação de exclusão de Supabase ou Vercel.

## 11. Testes E Gates

### 11.1 Automatizados

- testes unitários do manifesto v2 e compatibilidade de leitura;
- testes de allowlist para todos os ambientes e provedores;
- testes de confirmação literal e `--execute`;
- testes de inventário, hash, validade e pasta autorizada da evidência;
- testes de retomada após cada falha parcial;
- testes de idempotência de Supabase, bootstrap e Vercel;
- testes de redação de segredos;
- testes que comprovem a ausência de exclusão automática;
- testes da configuração de Auth e da proteção de rotas;
- banco local do zero e caminho de upgrade;
- E2E local completo com admin e dois operadores efêmeros.

### 11.2 Gates Locais

```text
npm.cmd run format:check
npm.cmd run lint
npm.cmd run type-check
npm.cmd test
npm.cmd run test:no-event-legacy
npm.cmd run test:db
npm.cmd run build
npm.cmd run test:e2e:local-reset
```

### 11.3 Gates Remotos

- inventário e backup aprovados;
- produção legada pausada e staging novo saudável;
- produção nova saudável e vazia;
- verificação Supabase aprovada;
- verificação Vercel aprovada;
- smoke autenticado aprovado;
- zero bypasses ou variáveis excedentes;
- monitoramento sem erro crítico durante a janela definida no runbook.

### 11.4 Revisão

O PR09-A terá revisão independente com foco em:

- confusão entre staging, produção nova e produção legada;
- mutação antes de backup ou confirmação;
- segredo em argumentos, logs ou arquivos;
- retomada idempotente após falha parcial;
- rollback respeitando a cota gratuita;
- diferença entre documentação e estado remoto.

## 12. Validação Operacional Posterior

O bootstrap termina com somente o administrador e banco operacional vazio. Após
o corte, o proprietário fará pela interface:

1. cadastro dos vendedores;
2. cadastro de produtos;
3. lançamento do estoque inicial;
4. abertura e fechamento de caixa;
5. venda e cancelamento controlados;
6. conferência de estoque e relatório.

A validação com dois operadores será executada depois que duas contas reais
forem cadastradas. Ela não é pré-condição para criar a produção vazia, mas é
pré-condição para declarar concluído o primeiro marco operacional da loja.

## 13. Fora De Escopo

- migrar dados da Espaço Personalize;
- criar vendedores automaticamente;
- importar catálogo ou estoque por CSV;
- configurar domínio customizado;
- habilitar cobrança ou plano pago;
- excluir qualquer projeto legado;
- executar venda financeira durante o bootstrap;
- automatizar reconciliação de dados em rollback tardio;
- criar integração Git persistente com provedores sem desenho posterior.

## 14. Critérios De Aceite

### PR09-A

- automações fail-closed, idempotentes e testadas;
- inventário e evidência de backup válidos;
- produção legada pausada somente após confirmação literal;
- produção nova criada em `sa-east-1` e registrada no manifesto;
- migrations, Auth, RLS, policies e grants aprovados;
- exatamente um administrador e zero dados operacionais;
- projeto Vercel de produção com exatamente três variáveis e deploy READY;
- URL `https://roberto-multimarcas-pdv.vercel.app` autenticando o administrador;
- staging novo e projetos Vercel não alvo preservados;
- gates locais, remotos e do GitHub aprovados;
- nenhum segredo no repositório, logs ou artefatos.

### PR09-B

- PR de `develop` para `main` sem conflito;
- Quality, Database contract e E2E Release Gate aprovados;
- commit resultante assinado e presente em `origin/main`;
- deploy final originado do commit de `main`;
- verificação remota e smoke aprovados após o deploy;
- produção legada pausada e preservada para rollback por 30 dias;
- documentação operacional refletindo o estado implantado.

## 15. Referências

- `docs/plano-reestruturacao-loja-fisica.md`
- `docs/plano-execucao-incremental.md`
- `docs/runbook-operacional.md`
- `docs/ambientes.md`
- `docs/superpowers/specs/2026-10-07-roberto-environments-provisioning-design.md`
- `docs/evidencias/pr08-staging-provisioning.md`
- Supabase Project Pausing:
  `https://supabase.com/docs/guides/platform/free-project-pausing`
