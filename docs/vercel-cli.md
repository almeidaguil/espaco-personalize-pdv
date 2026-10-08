# Vercel CLI

Runbook do Vercel para o staging da Roberto Multimarcas. O proprietário
declarou uso pessoal e não comercial para o plano Hobby. Durante o PR08 o
projeto novo recebe somente configuração e deployment Preview; Production
permanece exclusiva do ambiente legado até o corte aprovado do PR09.

## Versão E Autenticação

Use a versão validada no projeto:

```powershell
vercel.cmd --version
```

Versão esperada: `62.7.0`, executada com Node.js `22.23.2`. Se for necessário
autenticar novamente, use o fluxo OAuth oficial e confirme a identidade:

```powershell
vercel.cmd login
vercel.cmd whoami
```

A sessão fica no perfil local. Não copie tokens para arquivos versionados,
documentação, issue, PR ou argumentos registrados. Automações não interativas
podem receber `VERCEL_TOKEN` somente no processo e devem removê-lo ao final.

## Alvos Do PR08

- produção legada: projeto Vercel `espaco-personalize-pdv`, intacto;
- staging novo: projeto Vercel `roberto-multimarcas-pdv`;
- project ID novo: `prj_oBs2uc7uxsHMc7ssHFKczfi52LMq`;
- org ID: `team_jstETBWBHJi0hsir3a3bAkbK`;
- Supabase de staging: `otsxpchqtfypxgzjzrxs`;
- Supabase de produção: continua `ciixpfquwmlsvzleattv` no legado.

O diretório `.vercel/` gerado pelo vínculo local permanece ignorado pelo Git.
Os IDs não são segredos, mas todo comando mutável deve compará-los com o
manifesto antes de prosseguir.

## Preflight Obrigatório

Execute inspeções somente leitura antes de qualquer configuração:

```powershell
vercel.cmd project inspect roberto-multimarcas-pdv
vercel.cmd ls roberto-multimarcas-pdv
```

O primeiro preflight encontrou o projeto sem deployments, mas ainda com
framework `Other` e Node `24.x`. Corrija e revalide para preset Next.js e Node
22.x antes do primeiro Preview. Interrompa em caso de divergência de conta,
project ID, repositório, framework ou versão de Node.

## Restrições De Production

No PR08 é proibido:

- executar `vercel --prod`;
- criar ou atualizar variável no ambiente Production;
- associar alias ou domínio produtivo a um Preview;
- publicar a branch `main` pelo projeto novo;
- promover um Preview para Production;
- alterar ou excluir o projeto Vercel legado.

Antes de conectar o repositório, impeça deploy automático de `main` e confirme
que a integração permitirá somente o fluxo Preview aprovado. O domínio principal
`roberto-multimarcas-pdv.vercel.app` não deve ser tratado como staging enquanto
não houver um deployment de Production no PR09.

## Variáveis De Preview

Configure somente o ambiente Preview:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Os valores entram pela API HTTPS ou entrada padrão da CLI, nunca em linha de
comando ou arquivo versionado. `SUPABASE_SECRET_KEY` deve ser sensível. Depois da
gravação, confira apenas nomes, ambiente e metadados; não leia ou imprima os
valores.

## Deployment E Validação

O provisionador deve executar primeiro em dry-run:

```powershell
npm.cmd run ops:provision-vercel -- --phase deploy-preview
npm.cmd run ops:provision-vercel -- --phase configure-preview
```

Na execução autorizada, o provisionador cria o deployment a partir da referência
Git aprovada pela API, sem conectar a integração Git e sem informar `target`.
Se a Vercel classificar a operação como Production, o artefato é removido e a
execução falha fechada. Registre a URL HTTPS exata do Preview, atualize o
`site_url` e a allowlist do Supabase de staging e execute o smoke somente
leitura contra essa URL.

Ao final, comprove por metadados:

- deployment com ambiente `Preview`;
- projeto, conta e repositório iguais ao manifesto;
- variáveis presentes somente em Preview;
- zero Production Deployments, variáveis Production e aliases produtivos;
- projeto Vercel e Supabase legados de produção intactos.

## Falhas E Retomada

Em qualquer divergência, pare sem promover ou excluir recursos. Preserve o
Preview parcial para diagnóstico e retome apenas etapas idempotentes depois de
corrigir o manifesto ou a configuração. A tentativa Netlify anterior permanece
registrada somente como evidência histórica. Exclua apenas deployments falhos
identificados exatamente quando isso for necessário para restaurar o estado
comprovado de zero Production Deployments.

Em 2026-10-07, o primeiro deployment do projeto novo foi classificado como
Production tanto pela CLI quanto pela API com referência Git, mesmo sem
`--prod` ou `target`. Todos os artefatos falhos foram removidos e a automação
passou a falhar fechada. Não repita o deploy nesse projeto até resolver a
[ocorrência conhecida da Vercel](https://github.com/vercel/vercel/issues/17069)
ou aprovar um projeto de staging dedicado.
