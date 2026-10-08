# Provisionamento Dos Ambientes Roberto Multimarcas

**Data:** 7 de outubro de 2026

**Status:** desenho aprovado e revisado para Vercel Hobby

**Escopo:** PR08 — provisionamento e bootstrap da Roberto Multimarcas

## 1. Objetivo

Preparar ambientes exclusivos da Roberto Multimarcas sem custo mensal, sem
interromper a aplicação legada durante o PR08 e sem expor credenciais. O PR08
entrega um novo staging funcional, o projeto de hospedagem preparado e um
procedimento seguro e reproduzível para o corte de produção no PR09.

O sistema continuará privado e será operado pelo proprietário da loja, que
declarou uso pessoal e não comercial para fins de enquadramento no Vercel Hobby.
A hospedagem alvo será Vercel Hobby e o banco continuará no Supabase Free.

## 2. Restrições Aprovadas

- O custo mensal base deve permanecer em zero.
- Staging e produção devem usar projetos Supabase distintos.
- A região preferencial dos novos projetos é `sa-east-1`.
- No máximo dois projetos Supabase gratuitos podem permanecer ativos.
- O runtime legado de produção deve continuar disponível durante o PR08.
- Projetos legados serão pausados antes de qualquer hipótese de exclusão.
- Nenhuma exclusão de projeto remoto faz parte do PR08.
- Produção nova não será criada, inicializada ou conectada durante o PR08.
- Nenhuma chave, token, senha, dado pessoal ou conteúdo de Storage pode ser
  versionado ou registrado em logs.
- Toda operação remota mutável deve validar organização, ambiente, nome e
  project ref imediatamente antes da execução.
- Scripts mutáveis devem executar em `dry-run` por padrão e exigir uma opção
  explícita de execução.

## 3. Estado Atual Confirmado

### Supabase

Organização acessível pela CLI: `almeidaguil's Org`.

| Uso atual       | Nome                             | Project ref            | Região      | Estado inicial |
| --------------- | -------------------------------- | ---------------------- | ----------- | -------------- |
| Staging legado  | `espaco-personalize-pdv-staging` | `gpywbeoqcovjrfnmbdqx` | `us-west-2` | ativo          |
| Produção legada | `espaco-personalize-pdv`         | `ciixpfquwmlsvzleattv` | `us-west-2` | ativo          |

Os dois projetos ocupam a cota gratuita. Projetos pausados não contam para essa
cota e podem ser restaurados pelo período oferecido pela plataforma.

### Hospedagem

O projeto Vercel legado `espaco-personalize-pdv` permanecerá intacto durante o
PR08. O staging usa o projeto dedicado `roberto-multimarcas-pdv-staging`; o
ambiente Production desse projeto representa somente staging. O projeto
`roberto-multimarcas-pdv` fica reservado e vazio para a produção do PR09.

O repositório GitHub `almeidaguil/espaco-personalize-pdv` é público e será a
origem dos deploys via API. O PR08 não cria integração Git persistente: o
bootstrap usa a feature branch registrada e a publicação de `develop` após o
merge exige nova operação explícita. O acesso Vercel deve ser autorizado pelo
proprietário e cada operação deve validar projeto e conta antes de alterar o
ambiente remoto.

## 4. Estratégia De Substituição Sem Custo

Criar staging e produção novos ao mesmo tempo exigiria quatro projetos ativos e
causaria custo ou a indisponibilidade antecipada da produção legada. A
substituição será escalonada.

### PR08

1. Validar conta, organização, cota, região e identidade dos alvos.
2. Inventariar o staging legado sem copiar conteúdo sensível para o repositório.
3. Registrar evidências redigidas suficientes para restauração e auditoria.
4. Pausar somente `gpywbeoqcovjrfnmbdqx`, após confirmação literal do ref.
5. Confirmar que a produção legada `ciixpfquwmlsvzleattv` continua saudável.
6. Criar `roberto-multimarcas-pdv-staging` em `sa-east-1` no plano gratuito.
7. Aplicar a cadeia imutável de migrations no novo staging, sem `db reset` remoto.
8. Criar somente o administrador inicial de homologação.
9. Validar schema, grants, RLS, RPCs e smoke autenticado.
10. Reservar `roberto-multimarcas-pdv` sem variáveis ou deployments.
11. Criar `roberto-multimarcas-pdv-staging` e configurar Production desse
    projeto somente contra o novo staging.
12. Manter a publicação de `main` e a produção real bloqueadas até o PR09.

Ao final do PR08 haverá dois projetos ativos: produção legada e staging novo.

### PR09

Durante uma janela de corte aprovada:

1. Congelar alterações e inventariar a produção legada.
2. Confirmar backup, rollback e project ref `ciixpfquwmlsvzleattv`.
3. Pausar a produção legada.
4. Criar `roberto-multimarcas-pdv` em `sa-east-1`.
5. Aplicar migrations, criar o administrador real e cadastrar os dados iniciais.
6. Configurar as variáveis de Production do novo projeto Vercel.
7. Publicar, executar smoke, reconciliar e monitorar.
8. Restaurar a produção legada somente se o critério de rollback for acionado;
   nesse caso, o novo projeto correspondente deverá ser pausado primeiro para
   respeitar a cota gratuita.

Ao final do corte haverá dois projetos ativos: staging novo e produção nova. Os
dois projetos legados permanecerão pausados enquanto forem necessários para
rollback.

## 5. Componentes Do PR08

### 5.1 Manifesto Não Sensível De Ambientes

Um manifesto versionado será a fonte dos nomes, provedores, organização, região,
branches e refs autorizados. Ele não conterá URLs assinadas, chaves ou senhas.

O staging novo começará sem ref no manifesto. Depois da criação, seu ref será
registrado em um commit separado e validado por formato. A produção nova
permanecerá declarada como pendente até o PR09.

### 5.2 Validador De Alvo Remoto

Uma biblioteca pura e uma CLI pequena devem:

- classificar o comando como leitura ou mutação;
- validar nome do ambiente, provedor, organização, project ref e hostname;
- rejeitar os refs legados quando o comando se destinar ao ambiente novo;
- rejeitar o ref de produção em operações exclusivas de staging;
- exigir `--execute` e confirmação literal para mutações;
- retornar mensagens sem incluir valores de segredos;
- produzir saída estruturada apropriada para testes e CI.

O validador será reutilizado pelos comandos de inventário, bootstrap e
verificação. Nenhum script remoto poderá implementar sua própria lógica de
confirmação de maneira divergente.

### 5.3 Inventário Legado

O inventário será somente leitura e registrará:

- versão e região do projeto;
- lista de migrations conhecida;
- tabelas operacionais e contagens de linhas;
- quantidade de usuários agrupada por função, sem e-mails ou IDs pessoais;
- nomes de buckets, quantidade de objetos e tamanho agregado, sem conteúdo;
- configuração relevante de Auth e integrações, quando disponível sem segredo;
- dependências conhecidas da Vercel e do GitHub.

Evidências locais potencialmente sensíveis devem ficar em diretório ignorado. O
documento versionado conterá apenas o resumo redigido e os hashes ou horários
necessários para auditoria.

### 5.4 Provisionamento Supabase

O provisionamento deverá:

- validar novamente a organização e a cota imediatamente antes da criação;
- gerar senha de banco nova fora dos argumentos registrados e fora do Git;
- solicitar o menor tamanho gratuito disponível;
- usar `sa-east-1` e interromper se a região não estiver disponível;
- aguardar o estado saudável com polling limitado, sem esperas arbitrárias;
- registrar somente nome, ref, região e estado não sensíveis;
- executar `supabase db push` somente depois de um dry-run bem-sucedido;
- nunca executar `supabase db reset` em projeto remoto.

Falha parcial não autoriza exclusão automática. O runbook deve indicar como
retomar cada etapa idempotente ou pausar manualmente o projeto recém-criado.

### 5.5 Bootstrap Do Administrador

O bootstrap remoto será separado da seed E2E local. Ele deverá:

- aceitar credenciais apenas por variáveis de processo temporárias;
- validar o ref de staging antes de criar clientes Supabase;
- criar ou reconciliar exatamente um perfil `admin` pelo e-mail informado;
- exigir senha forte e impedir credenciais conhecidas de testes;
- ser idempotente para o mesmo administrador;
- nunca criar operadores, produtos, caixas ou vendas;
- não imprimir e-mail completo, senha, token ou chave;
- falhar explicitamente se encontrar um perfil incompatível.

A conta de produção não será criada por esse fluxo no PR08.

### 5.6 Vercel

Os projetos Vercel deverão:

- usar `roberto-multimarcas-pdv-staging` para staging e reservar
  `roberto-multimarcas-pdv` para produção futura na conta pessoal aprovada;
- permanecer distinto do projeto legado `espaco-personalize-pdv`;
- usar somente o repositório público autorizado como `gitSource` da API, sem
  conexão Git persistente no PR08, depois de comprovar as proteções;
- usar o preset Next.js e Node.js 22 conforme `.nvmrc` e `package.json`;
- executar o build oficial do projeto;
- configurar as três variáveis Supabase somente em Production do projeto
  dedicado de staging, sem copiá-las para
  arquivos versionados e marcando a chave de servidor como sensível;
- apontar a URL estável do projeto dedicado somente para o staging Supabase;
- não configurar variável ou deployment no projeto reservado, não associar
  domínio produtivo e não publicar a branch `main` no PR08;
- auditar todos os targets de deployment, exigir exatamente três variáveis no
  projeto dedicado e identidade, variáveis, deployments e domínios vazios no
  projeto reservado, tolerando apenas o domínio padrão `.vercel.app` criado
  automaticamente;
- manter Vercel Authentication ativa e criar bypass somente durante o smoke,
  com limpeza obrigatória e trace desativado;
- validar que a conta permanece no plano Hobby e interromper antes de qualquer
  recurso ou mudança de plano que possa gerar cobrança.

O projeto Vercel legado não será excluído ou alterado no PR08.

## 6. Fluxo De Dados E Segredos

```text
Supabase CLI/Vercel CLI
        |
        | metadados não sensíveis
        v
validador de alvo -----> manifesto versionado
        |
        | credenciais somente no processo
        v
inventário / migrations / bootstrap / smoke
        |
        +----> saída redigida para terminal e PR
        +----> evidência sensível apenas em diretório ignorado
```

Arquivos `.env*.local` continuam ignorados. O PR não deve criar arquivo com
segredos como mecanismo de transporte entre processos. Quando uma CLI exigir
persistência própria, o runbook deve identificar o armazenamento da ferramenta e
orientar logout ou rotação posterior.

## 7. Tratamento De Falhas

- Divergência de nome, ref, organização, região ou hostname: falhar fechado antes
  de abrir conexão mutável.
- Cota insuficiente: não pausar produção nem excluir projeto; interromper e
  registrar o estado real.
- Pausa do staging legado sem vaga liberada: restaurar staging ou aguardar a
  atualização da plataforma, sem tocar produção.
- Criação parcial: preservar o projeto para diagnóstico e executar novamente
  apenas verificações idempotentes.
- Migration com falha: interromper bootstrap e deploy; não aplicar correções
  manuais fora de migration.
- Bootstrap incompatível: não sobrescrever usuário; exigir intervenção.
- Deploy de staging com falha: preservar evidências, não promover e manter a
  produção legada ativa.
- Limite do Vercel Hobby próximo do fim: bloquear deploys não essenciais e
  avaliar o consumo antes de publicar novamente.

## 8. Testes E Evidências

### Automatizados No Repositório

- testes unitários do manifesto, parser e allowlist;
- testes de `dry-run` e confirmação literal;
- testes de recusa de ref legado, ref de produção, hostname inesperado e segredo
  em saída;
- testes do inventário com clientes falsos e dados pessoais sentinela;
- testes do bootstrap idempotente e de perfil incompatível;
- `format:check`, `lint`, `type-check`, `test`, `test:no-event-legacy` e `build`;
- banco local do zero, pgTAP e integrações;
- `test:e2e:local-reset` completo e sem skips autenticados.

### Remotos Em Staging

- migrations aplicadas e alinhadas ao repositório;
- tabelas, índices, constraints, grants, policies e RPCs esperados;
- signup público bloqueado e administrador inicial autenticando;
- escrita financeira direta bloqueada;
- smoke de login, dashboard e rotas protegidas no projeto Vercel dedicado;
- nenhum operador, caixa, venda ou produto criado pelo bootstrap;
- evidência redigida anexada ao PR sem credenciais.

O E2E remoto não reutilizará nem enfraquecerá a seed local do PR07. Uma eventual
suíte remota com usuários temporários exige desenho e aprovação separados.

## 9. Rollback

Durante o PR08, a produção legada permanece o rollback imediato porque não é
alterada. Se o staging novo falhar após a pausa do staging legado:

1. pausar o staging novo, caso necessário para liberar cota;
2. restaurar `gpywbeoqcovjrfnmbdqx`;
3. confirmar que suas chaves e integrações continuam válidas;
4. registrar o incidente sem apagar o projeto novo automaticamente.

No PR09, o rollback de produção terá runbook próprio e exigirá confirmar os refs
novo e legado imediatamente antes de qualquer pausa ou restauração.

## 10. Fora De Escopo

- excluir projetos Supabase ou o projeto Vercel legado;
- migrar vendas, caixas, usuários ou Storage da Espaço Personalize;
- cadastrar vendedores reais;
- carregar produtos ou estoque inicial;
- criar ou inicializar produção nova;
- publicar a aplicação de produção;
- executar venda real, cancelamento ou fechamento em produção;
- contratar plano pago ou habilitar cobrança automática.

Essas ações pertencem ao PR09 ou exigem autorização específica posterior.

## 11. Critérios De Aceite Do PR08

- staging legado inventariado e pausado com confirmação do ref;
- produção legada saudável e não modificada;
- staging Roberto Multimarcas ativo em `sa-east-1` e reproduzível pelas
  migrations;
- somente o administrador inicial presente após o bootstrap;
- RLS, grants e RPCs validados no ambiente novo;
- projeto Vercel dedicado criado e usando Production somente como staging;
- projeto reservado para produção com zero variáveis e deployments;
- comandos mutáveis protegidos por dry-run, allowlist e confirmação literal;
- nenhuma credencial ou dado pessoal presente em Git, logs ou artefatos;
- gates locais e do GitHub aprovados;
- runbook de provisionamento, recuperação e transição para o PR09 atualizado.
