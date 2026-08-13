# Git E GitHub

## Identidade

A identidade global configurada nesta maquina e:

```txt
Guiherme Almeida <almeida.guilherme37@gmail.com>
```

O e-mail esta associado e verificado na conta GitHub `almeidaguil`.

## GitHub CLI

O GitHub CLI esta instalado e usa autenticacao HTTPS armazenada no cofre de
credenciais do Windows:

```powershell
gh auth status --hostname github.com
gh repo view almeidaguil/espaco-personalize-pdv
```

Nunca use `gh auth token` em logs, documentos ou arquivos versionados.

## Assinatura De Commits

Novos commits sao assinados automaticamente com uma chave SSH Ed25519 dedicada:

```txt
Fingerprint: SHA256:7TPpT8PIjUYXufde8rBoXADjzJlnFCisfYuTog1GHuU
Chave publica: %USERPROFILE%/.ssh/id_ed25519_github_signing.pub
```

Configuracao efetiva:

```powershell
git config --global gpg.format ssh
git config --global gpg.ssh.program C:/Windows/System32/OpenSSH/ssh-keygen.exe
git config --global user.signingkey "C:/Users/Guilherme A/.ssh/id_ed25519_github_signing.pub"
git config --global commit.gpgsign true
```

O servico `ssh-agent` inicia automaticamente. Se a chave nao estiver carregada
depois de reiniciar o Windows, execute e informe a senha da chave:

```powershell
ssh-add "$env:USERPROFILE/.ssh/id_ed25519_github_signing"
```

Valide a configuracao sem criar um commit no projeto:

```powershell
ssh-add -l -E sha256
git config --get commit.gpgsign
git config --get user.signingkey
```

## Fluxo De Branches

O fluxo oficial do projeto e:

```txt
feature/* -> develop -> main
```

- Trabalhos comecam em `feature/*`, criada a partir de `develop` atualizado.
- Pull requests de funcionalidade apontam para `develop`.
- Pull requests de release promovem `develop` para `main`.
- Commits e pushes diretos em `main` sao proibidos.
- Force push em `main` e `develop` e proibido.

## Protecoes No GitHub

As branches `main` e `develop` exigem:

- pull request antes do merge;
- branch atualizada e check `Quality checks` aprovado;
- commits assinados;
- historico linear;
- conversas do pull request resolvidas;
- regras aplicadas tambem a administradores;
- bloqueio de force push e exclusao da branch.

O repositorio individual usa zero aprovacoes humanas obrigatorias porque o autor
nao pode aprovar o proprio pull request. Os gates automaticos permanecem
obrigatorios. Quando houver outro mantenedor, configure ao menos uma aprovacao e
exija nova aprovacao apos mudancas relevantes.
