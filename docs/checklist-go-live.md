# Checklist De Go-Live

Este documento consolida o que precisa ser feito antes de promover o Espaco Personalize PDV para uso real em producao.

## Objetivo

Usar este checklist no momento em que a release sair de `develop` para `main` e depois para producao na Vercel.

## Regra De Release

O fluxo oficial e:

1. concluir as features em `feature/*`;
2. mergear em `develop` com checks verdes;
3. rodar o gate E2E final;
4. executar o [Runbook operacional](runbook-operacional.md) em modo smoke test;
5. revisar limpeza e configuracoes externas;
6. rotacionar segredos usados durante homologacao;
7. abrir PR de `develop` para `main`;
8. publicar a `main` somente quando tudo estiver validado.

## 1. Validacao Tecnica Obrigatoria

Antes de qualquer release:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run type-check
npm.cmd run format:check
npm.cmd run build
```

Tambem confirmar:

- `Quality checks` verde no PR final;
- sem conflitos entre `develop` e `main`;
- sem TODO critico aberto na release.

## 2. Gate E2E Obrigatorio

Rodar o fluxo documentado em [Gate E2E de release](e2e-release-gate.md).

Comando local esperado, quando as variaveis E2E estiverem configuradas:

```powershell
npm.cmd run test:e2e:required
```

Liberar a release somente se:

- o Playwright passar em ambiente real ou homologacao equivalente;
- login funcionar;
- criacao de produto funcionar;
- criacao de evento funcionar;
- abertura de caixa funcionar;
- fluxo de venda funcionar;
- venda em dinheiro e venda sem dinheiro funcionarem;
- cancelamento de venda funcionar;
- fechamento de caixa funcionar.
- regressao de RLS financeira continuar bloqueando escrita direta indevida.

## 3. Revisao De Banco E Migrations

Confirmar que o banco remoto esta alinhado com o repositorio:

```powershell
npx.cmd supabase migration list
npx.cmd supabase db push --linked
```

Se houver ambiente local pronto:

```powershell
npx.cmd supabase db reset
npx.cmd supabase db lint --local
```

Checklist:

- todas as migrations aplicadas no projeto remoto;
- sem divergencia entre schema local e remoto;
- sem erro de lint do banco;
- RPCs criticas existentes:
  - `finalize_sale`
  - `cancel_sale`
  - `close_cash_session`
  - `close_event`

## 4. Supabase Antes Da Producao

Conferir no painel e no projeto remoto:

- RLS ativa nas tabelas operacionais;
- signup publico desabilitado, se essa continuar sendo a decisao oficial;
- leaked password protection habilitada no Supabase Auth;
- secrets privados revisados;
- usuario admin real existente e validado;
- nenhum usuario de teste desnecessario mantido ativo.

Observacao:

- a `publishable key` pode ser publica;
- `secret key`, senha do banco, tokens de deploy e senhas operacionais nao podem permanecer como as usadas durante homologacao.

## 5. Rotacao De Segredos E Senhas

Antes da producao final, rotacionar:

- `SUPABASE_SECRET_KEY`
- senha do banco remoto usada pela CLI
- `VERCEL_TOKEN`
- qualquer token de GitHub ou deploy exposto durante homologacao
- senhas administrativas ou temporarias usadas durante homologacao
- senhas temporarias de usuarios de teste

Depois da rotacao:

- atualizar `.env.local` e `.env.e2e.local` locais;
- atualizar variaveis de ambiente na Vercel;
- atualizar secrets do GitHub Actions, se houver mudanca;
- atualizar `CREDENTIALS.local.md` localmente, sem versionar;
- validar login e E2E novamente.

Regra:

- nenhum segredo compartilhado durante homologacao deve ser tratado como segredo
  definitivo de producao;
- a senha administrativa operacional definitiva deve ser conhecida apenas por
  quem pode autorizar cancelamentos e fechamento de caixa com falta.

## 6. Limpeza Da Base Antes Da Entrega

Antes de entregar ao cliente final, remover ou encerrar:

- eventos de teste;
- caixas de teste;
- vendas de homologacao;
- produtos criados apenas para QA;
- usuarios de teste que nao farao parte da operacao real.

Manter:

- o admin oficial;
- os operadores reais;
- produtos reais;
- eventos reais, se a operacao ja for iniciar em seguida.

Checklist funcional:

- nenhum caixa aberto esquecido;
- nenhum evento de QA ativo;
- nenhuma venda fake misturada nos relatorios finais.
- nenhum usuario temporario ativo sem necessidade operacional.

Sequencia recomendada:

1. exportar qualquer evidencia de QA que precise ser guardada;
2. fechar caixas abertos;
3. finalizar eventos de teste;
4. remover ou desativar usuarios temporarios;
5. manter apenas dados reais de partida.

## 7. Configuracao Da Vercel

Conferir no projeto de producao:

- variaveis publicas e privadas cadastradas no ambiente `Production`;
- build apontando para a branch `main`;
- dominio oficial configurado corretamente;
- deploy da `main` sem erro;
- preview e production separados conforme esperado.

Ambiente de producao deve ter pelo menos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

## 8. Smoke Test Manual De Producao

Depois do deploy da `main`, executar um teste rapido manual:

1. entrar em `/login`;
2. verificar painel inicial;
3. criar ou validar um evento real de teste controlado;
4. abrir caixa;
5. criar ou usar um produto real de teste;
6. ajustar estoque;
7. realizar uma venda;
8. consultar a venda em `/sales`;
9. cancelar a venda, se for um teste controlado;
10. fechar caixa;
11. abrir `/reports` e validar os numeros.
12. exportar CSV e abrir o arquivo;
13. conferir se os logs de runtime estao acessiveis.

Se qualquer passo falhar:

- nao considerar a release pronta;
- corrigir em `feature/*` a partir de `develop`;
- repetir o fluxo.

O smoke test detalhado fica em [Runbook operacional](runbook-operacional.md).

## 9. Checklist Operacional Do Primeiro Dia

Antes do primeiro evento real:

- confirmar quem sao os admins;
- confirmar quem sao os operadores;
- distribuir logins e senhas temporarias por canal seguro;
- validar acesso em pelo menos um celular e um desktop;
- instalar o PWA nos dispositivos que vao operar;
- confirmar que o evento correto esta ativo;
- confirmar que o estoque inicial foi lancado;
- confirmar que a senha administrativa operacional definitiva foi definida e compartilhada apenas com quem precisa.

## 10. Promocao De Develop Para Main

No momento da release:

1. confirmar `develop` verde;
2. confirmar gate E2E verde;
3. confirmar checklist de banco, segredos e limpeza;
4. abrir PR de `develop` para `main`;
5. revisar diff final;
6. mergear o PR;
7. acompanhar o deploy de producao;
8. rodar o smoke test manual;
9. registrar a release.

## 11. Pos-Go-Live

Depois da publicacao:

- monitorar login, vendas e fechamento de caixa no primeiro uso;
- acompanhar `sale.create.failed`, `sale.cancel.failed` e `cash.close.failed`
  conforme [Observabilidade](observabilidade.md);
- registrar qualquer incidente encontrado;
- priorizar hotfixes em branch propria a partir de `develop`;
- manter `main` sincronizada apenas com releases realmente validadas.

## 12. Pendencias Manuais Conhecidas

Itens que nao dependem apenas de codigo:

- habilitar `leaked password protection` no Supabase Auth antes da producao;
- definir a senha administrativa operacional definitiva;
- rotacionar segredos expostos durante homologacao;
- limpar a base de teste;
- validar o usuario admin oficial final.
- confirmar acesso aos logs da Vercel e Supabase;
- decidir se Sentry/Logflare fica para V1 ou para a primeira iteracao
  pos-go-live.

## 13. Criterio Para Dizer "Pronto Para Produzir"

Podemos considerar o sistema pronto para uso real quando:

- `develop` estiver estavel;
- `main` estiver alinhada com `develop`;
- checks locais e remotos estiverem verdes;
- gate E2E passar;
- base estiver limpa;
- segredos estiverem rotacionados;
- admin e operadores reais estiverem configurados;
- smoke test de producao passar;
- o time operacional tiver em maos o [Manual do usuario final](manual-usuario-final.md);
- o responsavel pelo evento tiver em maos o [Runbook operacional](runbook-operacional.md);
- os logs minimos de producao estiverem acessiveis.
