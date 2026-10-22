# Abrir o ERP em outro computador

## Conexao do agente: resultado da inspecao e acao interativa (2026-10-22)

Este chat continua coordenador. O executor desta inspecao e o sandbox
`/workspace/ERP-Zuccaro-codeX`, NAO o Codespace. Nesta retomada nao existe comando
remoto comprovado no Codespace nem na VPS. Autorizacao do proprietario esta
registrada; o bloqueio e capacidade/autenticacao do canal, nao falta de permissao
generica. Nenhum novo Codespace, clone, chave, token, daemon ou porta foi criado.

### Resultado por caminho

| Caminho | Evidencia atual | Decisao |
| --- | --- | --- |
| Git HTTPS do sandbox | refs branch/PR342 conferidas em67c002a4; CIs4432/4433 SUCCESS | permite publicar continuidade sanitizada |
| `gh codespace` neste sandbox | `gh`/`ssh` presentes; GET `https://api.github.com/user/codespaces/potential-xylophone-5gj7r9v9qqg637vxp` retorna `Forbidden`; dominio fora da allowlist ativa | acesso remoto bloqueado antes da consulta; escopo do GitHub nao comprovado |
| SSH neste sandbox | sem configuracao SSH, identidade publica ou agente; home/config em filesystem somente leitura | nao executar `gh codespace ssh`: o help informa geracao automatica de chave quando ausente |
| Codex CLI0.159.2 | `--remote` aceita app-server ws/wss/unix; `remote-control` inicia daemon/pareamento | nao e conector direto para URL github.dev nem migra este executor; nao iniciar servidor/pareamento como contorno |
| VS Code desktop + GitHub Codespaces | procedimento oficial GitHub consultado; VS Code/GUI nao instalados neste executor | caminho principal suportado, requer acao interativa no computador do proprietario |
| Cursor | README oficial OpenAI cita suporte da extensao Codex ao Cursor; binario Cursor ausente aqui | isso NAO prova suporte da extensao GitHub Codespaces no Cursor nem conexao remota real |
| VPS/Hostinger | skills disponiveis, zero ferramentas `VPS_*` expostas; config MCP local somente leitura; sem alias/identidade SSH herdados | sem leitura/configuracao real da VPS nesta retomada |

### Acao exata no computador do proprietario

1. No **VS Code desktop**, abrir **Remote Explorer**, escolher **GitHub Codespaces**,
   clicar **Sign in to GitHub** se solicitado e entrar na mesma conta proprietaria.
2. Selecionar **potential-xylophone-5gj7r9v9qqg637vxp** e clicar no **icone de conexao
   (plug)**. Conectar/retomar SOMENTE esse recurso; nao usar Create/New/Rebuild.
3. No IDE remoto, abrir a extensao oficial **Codex** e usar **Sign in with ChatGPT**
   com a conta existente. Nao selecionar autenticacao por API key. A instalacao/
   disponibilidade remota da extensao deve ser verificada no cliente; nao foi
   presumida a partir deste chat ou do navegador github.dev.
4. Antes de implementar/sincronizar, o AGENTE desse IDE deve executar a prova
   abaixo, devolver o recibo sanitizado e assumir a reserva de escritor. Abrir a
   janela por si so ou o proprietario rodar pwd nao prova executor do agente.

Nao ha neste executor uma ferramenta que clique/login nesse VS Code desktop ou
anexe este chat cloud ao IDE. A conversa permanece aqui; o IDE fornece execucao
no mesmo checkout, sequencialmente. Este e o limite definitivo da sessao atual,
nao uma promessa de conexao remota ja realizada.

### Prova inicial do executor remoto (nao executada por este sandbox)

O comando se recusa a escrever se nao estiver no checkout/identidade esperados.
Cria SOMENTE seu proprio arquivo sintetico em /tmp (fora do checkout), rele/le
SHA256 e remove em finally. Nao toca marcadores de persistencia anteriores.

```sh
cd /workspaces/ERP-Zuccaro-codeX
python3 - <<'PY'
import os, pathlib, subprocess, tempfile, hashlib, json, datetime, uuid, urllib.parse
expected = 'potential-xylophone-5gj7r9v9qqg637vxp'
assert os.environ.get('CODESPACE_NAME') == expected, 'executor nao comprovado no Codespace esperado'
assert pathlib.Path.cwd().resolve() == pathlib.Path('/workspaces/ERP-Zuccaro-codeX')
def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()
origin = git('remote', 'get-url', 'origin')
if origin.startswith('git@github.com:'):
    host, repo = 'github.com', origin.split(':', 1)[1]
else:
    parsed = urllib.parse.urlsplit(origin)
    host, repo = parsed.hostname, parsed.path.strip('/')
repo = repo.removesuffix('.git')
assert host == 'github.com' and repo == 'viniciuszuccaro-creator/ERP-Zuccaro-codeX'
branch, sha = git('branch', '--show-current'), git('rev-parse', 'HEAD')
assert branch == 'codex/consolidacao-infra-20261017'
content = json.dumps({'probe': 'erp-agent-connection', 'nonce': str(uuid.uuid4()),
                      'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}).encode()
fd, name = tempfile.mkstemp(prefix='erp-agent-connection-', suffix='.json', dir='/tmp')
path = pathlib.Path(name)
try:
    with os.fdopen(fd, 'wb') as stream:
        stream.write(content)
    obtained = path.read_bytes()
    assert obtained == content
    proof = {'path': name, 'bytes': len(obtained), 'sha256': hashlib.sha256(obtained).hexdigest()}
finally:
    path.unlink()
assert not path.exists()
print(json.dumps({'codespace': expected, 'cwd': str(pathlib.Path.cwd()),
                  'repository': repo, 'branch': branch, 'sha': sha,
                  'status': git('status', '--short'), 'probe': proof, 'removed': True}))
PY
```

Depois da prova: ler AGENTS/HANDOFF/status/programa; preservar dirty/diff e codigo
novo privadamente FORA checkout, sem ler/copiar env, segredos, certificados ou
backup. Nao alterar captura/cinco worktrees nem descartar arquivos. Divergencia
inesperada de codigo interrompe sincronizacao ate reconciliacao, sem reset/stash
silencioso/force. Comparar refs e SHA publicado desta entrega antes de fetch.
Com checkout limpo e ancestor confirmado: fetch da MESMA branch e fast-forward
somente seguro ao SHA EXATO publicado. Nunca trocar por main nem adotar tip
inesperado. Revalidar HEAD/status depois. O SHA documental final desta entrega
fica no remoto/PR; runtime validado em5ab608e6/67c002a4, sem alteracao de codigo
por esta inspecao administrativa.

Com Node22/dependencias existentes e SHA correto, executar primeiro os testes
pertinentes, sem reinstalacao ou banco operacional:

```sh
node --test tests/produto-completo-ecommerce.test.js tests/cursor-identidade-consolidacao.test.js tests/publication-baseline-contracts.test.js
```

Registrar host/SHA/comando/exit/contagens reais;37/0/0 anterior e historico, nao
resultado da conexao nova. Nao repetir backend/PG/A1 inalterados por rotina.
Preservar/publicar o lote validado na mesma branch/PR; ao terminar usar Stop do
MESMO Codespace e manter budget zero. Nao ativar billing/API paga.

### Cursor: mesma maquina, compatibilidade ainda a provar

O caminho CLI documentado pelo GitHub e `gh codespace ssh -c NOME`; o help local
oferece `gh codespace ssh --config` para configuracao OpenSSH. Requer GitHub
CLI autenticado no cliente, acesso API/transportes e sshd existente no Codespace;
sem identidade valida o CLI pode gerar chave automaticamente. Nao executar isso
silenciosamente nem copiar chaves/credenciais para o Git/checkout/chat.

Para Cursor, usar apenas o suporte Remote-SSH do cliente se instalado/compativel
com essa configuracao OpenSSH/ProxyCommand e testar a MESMA prova acima. Nao
presumir compatibilidade da extensao Microsoft GitHub Codespaces no Cursor. Nao
ha Cursor neste executor e a documentacao remota do Cursor nao foi acessivel:
status **NAO VALIDADO**, sem alegar conexao. Se esse cliente nao aceitar o canal,
a alternativa concreta e VS Code + GitHub Codespaces + Codex, nao novo clone.

Codex e Cursor nunca escrevem juntos: antes de trocar, encerrar o lote/registrar
HEAD e dirty, liberar a reserva e so entao assumir pelo outro cliente no MESMO
checkout. Nenhum tunnel/porta publica/agente SSH encaminhado foi habilitado.

### Rede do sandbox e Hostinger: configuracao salva versus ativa

Rascunho oficial do ambiente salvo com `api.github.com` como unico dominio
customizado adicional; presets existentes preservados. Referencia antiga main
foi substituida pelo checkout existente/commit exato; instalador nao alterado.
Start_skill passou a retomada sem iniciar Docker/banco/servicos, conforme este
fluxo. Nenhum segredo/recurso/cobranca foi criado. Ferramenta retornou saved e
requires_publish=true: NAO e rede aplicada, snapshot publicado, restauracao
comprovada ou conexao Codespace. Nao ampliar dominios de transporte por palpite.

Se optar pelo CLI a partir DESTE sandbox, revisar/salvar as alteracoes nas
configuracoes do ambiente; a publicacao solicitada pela ferramenta cria snapshot
e reconecta o ambiente. Preservacao local nao e backup externo comprovado: nao
executar reset/recriacao/teste de restore para tentar aplicar a rede. A aplicacao
interativa pertence a plataforma; revalidar API somente apos mudanca real.
Permissao de rede nao prova escopo Codespaces do GitHub nem acesso SSH. O caminho
IDE acima nao depende de publicar/restaurar o sandbox antigo.

Hostinger: o plugin fornece instrucoes, mas nao disponibiliza ferramentas VPS
nesta sessao. /home/agent/.codex/config.toml esta em filesystem ro, portanto nao
foi registrada configuracao MCP descartavel nem improvisada API Hostinger. O
cliente que hospeda o conector precisa disponibilizar hostinger-vps-mcp e concluir
seu OAuth **Allow**; aqui nao abriu tela de consentimento e nao ha como afirmar
login. Alternativa concreta para o precheck: console/SSH existente da VPS na
estacao com acesso ja configurado, por UM executor autorizado; nao inventar alias
no Codespace nem copiar chave para ele. Capacidade/ACL/criptografia/recuperacao/
retencao dependem desse recibo, nao do titulo do chat ou de metricas API.

Fontes consultadas: [GitHub CLI/Codespaces](https://docs.github.com/en/codespaces/developing-in-a-codespace/using-github-codespaces-with-github-cli),
[VS Code/Codespaces](https://docs.github.com/en/codespaces/developing-in-a-codespace/using-github-codespaces-in-visual-studio-code),
[OpenAI Codex README oficial](https://github.com/openai/codex#readme), help dos
CLIs instalados e configuracao/erros sanitizados deste executor. Nao foram lidos
chats externos, relatorio privado da estacao, credenciais ou dados reais.


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
