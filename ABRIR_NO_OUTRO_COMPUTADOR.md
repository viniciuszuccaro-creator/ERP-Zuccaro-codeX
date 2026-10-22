# Abrir o ERP em outro computador

## Caminho unico homologado para desenvolvimento - Codespaces (2026-10-22)

Coordenacao: manter o chat existente **Nuvem ERP-Zuccaro-codeX**, por decisao
expressa posterior do proprietario. Isso nao depende de trocar o executor.
Nao iniciar Gate2 pela recomendacao historica: prioridade e ambiente unico,
Comercial360 e migracao legada coordenada.

Endereco do UNICO Codespace criado:
https://potential-xylophone-5gj7r9v9qqg637vxp.github.dev/

Repositorio `viniciuszuccaro-creator/ERP-Zuccaro-codeX`, branch
`codex/consolidacao-infra-20261017`, checkout `/workspaces/ERP-Zuccaro-codeX`.
Candidata inicialmente verificada/testada:
`6f0f0298f8180c45a195987e7f5efef65a298f25`, PR342, CI4427 SUCCESS.
Instalacao/checks e stop/start com nova conexao web comprovados;36artefatos e
arquivo sintetico nao commitado conservados por hash. A1 repetido apos restart:
7PASS/0FAIL/0SKIP. Estado e eventual SHA documental posterior no topo de
`docs/HANDOFF_ATUAL.md`. Nao e homologacao operacional do ERP nem teste fisico
do computador de casa; e prova do mecanismo de retomada por outro acesso web.

1. De casa ou da empresa, entrar na MESMA conta GitHub autorizada e abrir o
   endereco acima. Alternativa: https://github.com/codespaces e selecionar
   `potential-xylophone-5gj7r9v9qqg637vxp`. Nao clicar Create/New codespace.
2. Retomar esse mesmo Codespace se estiver parado. Conferir branch, HEAD e
   alteracoes no terminal antes de sincronizar; nao trocar para main antiga.

```sh
pwd
git branch --show-current
git rev-parse HEAD
git status --short
nvm use 22
```

3. Ler o handoff existente. Se houver dirty, preservar diff, arquivos novos e
   hashes antes de qualquer sincronizacao; nunca descartar alteracoes.
4. Codigo/testes usam fixtures sinteticas. Original legado intocado e dados
   reais/PII/backups/certificados/chaves/env foraGit/CI/logs/chats. Autorizacao
   posterior permite staging privado remoto e acesso a lotes minimos protegidos
   por Codespace/Cursor,FORA do checkout,apos provar destino/ACL/criptografia/
   integridade/retencao. Nao e importacao operacional nem transferencia executada.
5. Ao terminar, preservar/publicar somente o lote validado na branch existente
   e usar Stop codespace no painel GitHub. Nao apagar o Codespace para sair.
   Fechar a aba sozinho nao garante parada imediata. Storage continua consumindo
   franquia enquanto o Codespace existir; parada conserva trabalho, nao e backup.

Conta Free: franquia documentada de120core-horas e15GB-mes. Em2cores sao ate60h
de execucao por mes, antes de outros consumos. Nao e uso profissional ilimitado.
Orcamento do PRODUTO Codespaces US$0 com Usage blocked conferido diretamente,
sem alterar cobranca. Ao esgotar franquia, parar/aguardar renovacao; nao elevar
orcamento nem contratar recursos. A retencao automatica exige manter codigo
validado publicado e material privado preservado fora do ambiente.

O chat **Nuvem ERP-Zuccaro-codeX** e o coordenador. Seu executor cloud anterior
NAO e automaticamente este Codespace. Nao editar nos dois ambientes nem usar
checkout divergente em cada PC; um escritor autorizado por vez.
Publicacao no GitHub, homologacao de desenvolvimento e implantacao VPS sao gates
distintos. Este roteiro nao autoriza operacao real, importacao ou deploy.

## Agente no IDE remoto e preservacao do programa

Caminho informado pelo proprietario: VSCode desktop,extensao GitHub Codespaces,
Remote Explorer -> GitHub Codespaces -> login existente -> conectar ao MESMO
recurso (icone de conexao,nao Create). Codex oficial no IDE remoto com a conta;
nao configurar API paga. Suporte da extensao no Cursor nao e presumido.
O agente deve provar pwd/origin sanitizado/branch/SHA/status e marcador sintetico
temporario escrito/lido/removido antes de afirmar que executa nesse Codespace.

Preservar layout azul-claro aprovado e funcionalidades/submodulos,com desenho
aprovado antes de mudancas amplas. Codigos numericos sequenciais sao requisito
transversal com reserva backend; preservar legado/IDs sem renumeracao silenciosa.
Fontes,lacunas,autorizacoes atuais e fluxo sequencial sem executor remoto no topo
de [HANDOFF_ATUAL.md](docs/HANDOFF_ATUAL.md). Nao criar outra frente nem substituir
a candidata pela main antiga. Telefone/app/site/canais/industria seguem no programa.

## Historico local - nao usar como frente paralela

As instrucoes locais abaixo sao historicas. Nao extrair ZIP nem clonar outro ERP
para a rotina casa/empresa. O clone independente preservado fica para
preservacao/recuperacao controlada, sem desenvolvimento concorrente. A rotina
passa para o Codespace acima; nao substituir as cinco worktrees/captura originais.

## Historico local — 1. Instalar antes

Instale o Node.js LTS:

https://nodejs.org/

## Historico local — 2. Extrair o ZIP

Extraia o ZIP em uma pasta simples, por exemplo:

```text
C:\ERP Zuccaro\erp-integra-portatil
```

Se for usar GitHub em vez do ZIP, clone o repositorio novo:

```powershell
git clone https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX.git "C:\ERP Zuccaro\ERP-Zuccaro-codeX"
cd "C:\ERP Zuccaro\ERP-Zuccaro-codeX"
```

## Historico local — 3. Rodar o projeto

Abra o PowerShell dentro da pasta extraida e rode:

```powershell
npm install
npm run dev -- --host 0.0.0.0
```

Depois abra:

```text
http://localhost:5173/
```

## Historico local — 4. Confirmar modo local

O arquivo `.env.local` deve estar assim:

```env
VITE_LOCAL_ONLY=true
VITE_BASE44_APP_ID=local-erp-integra
VITE_BASE44_BACKEND_URL=http://localhost:5173/local
VITE_BASE44_API_KEY=
```

Assim o sistema abre em modo local e nao grava no Base44 nem no GitHub.

## Historico local — 5. Se nao abrir

Rode:

```powershell
npm run build
```

Se a porta 5173 estiver ocupada:

```powershell
npm run dev -- --port 5174
```

E abra:

```text
http://localhost:5174/
```

## Historico local — 6. Continuar o plano de melhoria

Para continuar em outro computador, abra primeiro:

```text
STATUS_DO_PROJETO.md
PLANO_MELHORIA_ERP_ZUCCARO.md
```

O `STATUS_DO_PROJETO.md` tem o ultimo checkpoint, o que ja foi feito e qual deve ser o proximo foco.
