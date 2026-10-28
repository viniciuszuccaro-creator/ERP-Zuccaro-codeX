# Operação DEV: GitHub, Codex, Cursor e VPS

## Prioridade e separacao vigentes (2026-10-26)

A entrada em uso segue PLANO_GO_LIVE.md; lista unica no topo de
STATUS_DO_PROJETO.md. VPS recebe somente versao especificamente aprovada;
Codespace existente concentra evolucao/testes, GitHub o codigo/historico e
armazenamento privado os dados/backups. Os dados da VPS DEV descritos abaixo
nao comprovam producao homologada. Preparar nao autoriza executar o fluxo de
promocao, alterar permissoes/schema, importar ou substituir o par atual.


## Fontes de verdade

- GitHub `viniciuszuccaro-creator/ERP-Zuccaro-codeX`: código e histórico Git.
- VPS DEV: estado operacional do ambiente em Docker.
- PostgreSQL DEV: migrations e dados sintéticos reais.
- PR e CI: revisão e gates de código; não substituem os gates PostgreSQL reais.

## Ferramentas e precheck

Codex e Cursor são intercambiáveis. Cada workspace é descartável e deve nascer
ou sincronizar do repositório canônico. Antes de editar, confirmar repositório,
branch, HEAD e `git status`; depois ler este documento, `HANDOFF_ATUAL.md` e
os documentos do runtime relacionado.

Se GitHub, workspace, VPS ou handoff divergirem, parar e diagnosticar. Não
resetar, fazer force-push, reaplicar migration, recriar container ou corrigir
silenciosamente.

## Fluxo normal

```text
branch → implementação/testes → push → PR draft → CI/review/hardening
→ precheck VPS → backup → migration autorizada → PostgreSQL real/E2E
→ pre-merge → merge → build da main → canário da main → promoção 3080
→ restart gate → pós-promoção → fechamento
```

Merge não é promoção. Migration não é promoção. CI local não substitui
PostgreSQL real. Frontend não substitui segurança. Documentação não é
autorização operacional.

## VPS DEV

- Hostname Hostinger: `srv1982741`.
- Domínios: `https://erp-dev.cpaferroeaco.com.br/` (SPA + same-origin `/api`) · `api-erp-dev` quando aplicável.
- Raiz: `/opt/erp-zuccaro`.
- Compose: `docker-compose.erp.yml` · env na VPS: `.env.erp.dev` (nunca no Git).
- PostgreSQL Docker: `supabase-db`.
- API oficial: `erp-api-dev` · bind `127.0.0.1:3080`.
- SPA oficial: `erp-web-dev` · bind `127.0.0.1:3081`.
- Rede Docker observada em operação: `supabase_default` (revalidar no precheck; não presumir se divergir).
- Backups: `/opt/erp-zuccaro/backups` (arquivos reais só na VPS; no Git só path/bytes/sha256 sanitizados em `docs/vps/evidence/`).

A rede Docker deve ser consultada na configuração existente durante uma tarefa
VPS autorizada; não deve ser presumida. Não documentar senhas, tokens, arquivos
de ambiente, cookies, dados de clientes, chave privada SSH nem IP público desnecessário.

## Acesso operacional Cursor / Codex (canônico)

### Codespace Codex — acesso dedicado aprovado, prazo vigente

Aprovado pelo proprietário em28/10/2026: provisionar somente usuário novo `erp-codex-ro`, sem sudo/docker, senha bloqueada, chave dedicada com `restrict,expiry-time="20261227T235900Z"`. Chave válida até27/12/2026 às20:59 America/Sao_Paulo; conta expira28/12/2026; revogar antecipadamente ao concluir a frente. Isto substitui os prazos30/10 e31/10 dos blocos históricos. Não autoriza privilégios administrativos ao Codex, alteração de chaves atuais, sshd/firewall, carga, DDL, grants ou deploy. Conta existente exige inspeção de procedência/configuração, nunca sobrescrita.

Chave local exclusiva já preparada, não gerar outra: diretório privado0700 `/home/codespace/erp-legado-privado-20261023/access-codex-readonly-20261028`; `id_ed25519`0600 permanece somente local. Fingerprint CLIENTE público: `SHA256:D+z9tzBoEVkhLfmUwWOunGGUpC05vPLm2m3vYMPTELI`. Não é identidade HOST. Nenhum envio de credenciais ao chat/GitHub; nesta etapa usar arquivo privado existente, sem exigir Runtime Secrets nem upload de secrets. Os nomes ERP_CODEX_VPS_* dos registros históricos não indicam valores efetivamente disponíveis.

#### Procedimento administrativo humano único — console confiável, validação e retorno

1. No console autenticado do provedor, selecionar a VPS existente `srv1982741`, conferir identidade/endereço do servidor no painel e manter esta sessão administrativa humana. Não abrir SSH com host não validado nem delegar root ao Codex. Confirmar raiz `/opt/erp-zuccaro`; divergência interrompe o procedimento.
2. No Codespace, abrir o arquivo privado `access-codex-readonly-20261028/server-provisioning.PROPOSED.sh` sob o diretório acima (somente chave PÚBLICA está embutida). Copiar seu conteúdo e executar no console administrativo. O script já reflete a aprovação e foi validado por `sh -n`; não executar seu provisionamento no Codespace. Seu alcance exato: `useradd --create-home --user-group --shell /bin/bash --expiredate 2026-12-28 erp-codex-ro`; `passwd --lock erp-codex-ro`; home0700; `.ssh`0700 e authorized_keys0600 exclusivamente dessa conta; única chave dedicada com restrict/expiry-time acima. Sem sudo/grupos extras. Se conta existir, imprime apenas id/status/expiração e aborta sem modificá-la. Se grupo/home existir, aborta. Verifica sshd -t, versão com suporte a expiry-time e configuração efetiva para conta dedicada; não altera sshd. Verifica grupos/senha/política sudo; falha após criação expira/bloqueia somente conta nova. A configuração de Match por origem externa ainda precisa ser conferida na primeira conexão; não presume que addr127 represente o Codespace.
3. No MESMO console confiável, conferir a saída de `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` e a linha pública final `erp-dev-vps-canonical ssh-ed25519 ...`. Salvar SOMENTE essa linha como `known_hosts.verified` no diretório privado do Codespace, modo0600. Não copiar chave HOST privada. Conferir HostName do `ssh_config.proposed` contra o endereço da VPS verificado no painel; se domínio não for endpoint SSH direto, registrar o endereço correto privadamente antes de conectar. Não usar ssh-keyscan isolado, accept-new ou StrictHostKeyChecking=no. Informar conclusão/qualquer divergência sem colar chaves/credenciais no chat.
4. Após isso Codex valida arquivos/host/configuração e conecta pelo usuário dedicado, StrictHostKeyChecking=yes, UpdateHostKeys=no, BatchMode/IdentitiesOnly, sem senha/agent forwarding/TTY/forwardings. Executa os prechecks já autorizados, sem pedir aprovação por comando. Shell comum/restrict não garantem sandbox de arquivos. Não ler env/backups/credenciais por atalho, não adicionar docker/sudo. Dados de negócio somente depois de comprovar principal SQL EXISTENTE estritamente leitor, ACL/memberships/RLS, sessão e Grupo CPA, em contexto explícito e READ ONLY+ROLLBACK. Se acesso/role faltar, registrar requisito para pacote específico, sem grants automáticos. Não classificar coorte contra destino antes dessa prova.
5. Reversão/revogação ao concluir ou antecipadamente: no console administrativo, executar `revoke-dedicated-access.sh` do mesmo diretório privado. Expira/bloqueia exclusivamente erp-codex-ro, remove só a linha da chave erp-codex-ro-20261028 e encerra processos apenas do UID dedicado (nunca0). Preserva home/logs/evidências; sem userdel -r e sem tocar chaves/contas alheias. Expiração da chave/conta já limita prazo, mas não encerra sozinha sessões abertas: a revogação exige esse passo administrativo. Nenhum sudo adicional foi autorizado para automatizá-lo pelo usuário dedicado.

Scripts locais preparados, não executados no servidor. Ausência de canal administrativo disponível ao executor não é ausência de aprovação: a aprovação está vigente. Nenhuma conexão SSH antes da prova HOST; consulta e reconciliação ficam pendentes dessa execução humana e da comprovação do principal SQL. Procedimento não requer nova transferência do HD nem reconstrução do Codespace.

### Prévia privada sintética — iniciar, verificar e retomar

Reutilizar harness privado existente `decision-20261026/resume-20261028/browser-harness.mjs` sob `/home/codespace/erp-legado-privado-20261023`. Não é deploy nem banco operacional. Executar somente após conferir checkout/branch/HEAD/status/processos e inexistência de outro dono da5173. Em terminal próprio, cwd canônico, Node22:

```bash
ERP_PREVIEW_EXPECTED_SHA="$(git rev-parse HEAD)" PATH=/usr/local/share/nvm/versions/node/v22.23.4/bin:$PATH node /home/codespace/erp-legado-privado-20261023/decision-20261026/resume-20261028/browser-harness.mjs
```

Harness recusa Codespace/origin/branch/SHA divergentes e diff de runtime antes de criar recursos; diretório de recibos identity-preview-20261028 deve permanecer0700. Verificar listener real, encaminhamento5173 Private e HTTP local `/__erp_fixture` (sourceSha, synthetic, operationalDatabase=false), `/__erp_preview` (HEAD atual), aviso sintético antes/depois do login. Login exclusivamente fixture: entry.synthetic@example.test / synthetic-entry-only. URL HTTPS externa termina em `-5173.app.github.dev/Comercial`; usar localhost para teste local, preservando redirecionamento HTTPS de127.0.0.1. Não publicar logs completos ou credenciais reais.

Parar com Ctrl-C SOMENTE no terminal do harness próprio; cleanup usa seu container/labels/socket. Não matar processos genéricos nem tocar recursos alheios. Retomada repete verificações de identidade/exclusividade e comando: cria novo banco efêmero sintético, não recupera dados operacionais. Duração máxima6h/Codespace ativo; sem promessa24h ou mudança de suspensão/custos. Promoção para DEV diário exige gate existente de versão/imagens, autenticação/roles, backup/rollback, aprovação/deploy; não está autorizada por esta prévia.

Objetivo: qualquer agente ou PC novo consiga operar a VPS **sem** reenviar
credenciais no chat. Segredos ficam no ambiente Cursor (Runtime Secrets) ou no
Hostinger; o GitHub guarda só o contrato e os nomes.

### Secrets do ambiente Cursor (valores FORA do Git)

| Nome | Obrigatório | Conteúdo |
|---|---|---|
| `ERP_DEV_VPS_SSH_PRIVATE_KEY` | sim | chave **privada** OpenSSH completa (`-----BEGIN OPENSSH PRIVATE KEY-----` … `-----END-----`), ou corpo base64 OpenSSH que o agente reconstrói com headers |
| `ERP_DEV_VPS_SSH_USER` | recomendado | usuário SSH (em produção DEV: `root`) |

- Configurar em: Cursor → Environment → Secrets (Runtime Secret) · Apply to this environment.
- **Proibido** commitar a chave privada, colar no chat, PR, HANDOFF ou evidence.
- Trocar de computador: os secrets do Environment continuam; não é preciso reenviar no chat se o Environment for o mesmo.

### Recuperacao do canal existente (precedencia em22/10/2026)

Reutilizar primeiro o executor/alias/Runtime Secrets ja autorizado. A ausencia
no sandbox atual nao autoriza reprovisionar a VPS, gerar outra identidade ou
substituir authorized_keys. O bloco de provisionamento inicial abaixo e historico:
NUNCA executar seu `cat > authorized_keys` como rotina de recuperacao, pois pode
sobrescrever acessos existentes. Conferir recibo/metadados e canal original antes
de qualquer mudanca; chave privada somente pelo mecanismo de segredos, nunca chat.

### Chave pública autorizada na VPS (pode ir no Git)

Comentário: `erp-zuccaro-vps` · tipo ED25519  
Fingerprint: `SHA256:o2kp7MNg3H8D5ArHT34/BrI35J23/y9e8MIsdMqYwMA`

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAII8ouskwnfnbFg/qCD376xnYlxMwGTjR4OtphP8Vw2nm erp-zuccaro-vps
```

A chave no hPanel **não** injeta sozinha em VPS já criada. Tem de existir em
`/root/.ssh/authorized_keys` na instância viva (Web Console se SSH falhar):

```bash
mkdir -p /root/.ssh && chmod 700 /root/.ssh
cat > /root/.ssh/authorized_keys <<'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAII8ouskwnfnbFg/qCD376xnYlxMwGTjR4OtphP8Vw2nm erp-zuccaro-vps
EOF
chmod 600 /root/.ssh/authorized_keys
```

Conferir: `wnfnbFg` (F maiúsculo) · `YlxMw` (letra L) · `R4Otph` (letra O).

### Como o agente conecta

1. Resolver host: `getent hosts erp-dev.cpaferroeaco.com.br` (não gravar IP no Git).
2. Montar `~/.ssh/erp_dev_vps` a partir de `ERP_DEV_VPS_SSH_PRIVATE_KEY` (chmod 600).
3. `ssh -i ~/.ssh/erp_dev_vps -o BatchMode=yes -o IdentitiesOnly=yes "$ERP_DEV_VPS_SSH_USER@<host>" …`
4. Hostinger VPS MCP: útil para inventário; se timeout, SSH/Web Console são o caminho operacional.

### Rebuild SPA/API da main (já autorizado quando o lote pedir deploy)

```bash
cd /opt/erp-zuccaro
bash scripts/vps/create-pre-gate-e-backup.sh
git fetch origin main
CONFIRM_SPA_LOGIN_REBUILD=YES ERP_DOCKER_NETWORK=supabase_default GIT_REF=origin/main \
  bash scripts/vps/spa-login-rebuild-api-web.sh
```

Rollback (tags gravadas em `/opt/erp-zuccaro/.spa-login-rollback-tags`):

```bash
CONFIRM_SPA_LOGIN_ROLLBACK=YES ERP_DOCKER_NETWORK=supabase_default \
  ROLLBACK_TAG_FILE=/opt/erp-zuccaro/.spa-login-rollback-tags \
  bash scripts/vps/spa-login-rollback-api-web.sh
```

### Obrigatório após qualquer operação VPS (sempre)

1. Atualizar `docs/HANDOFF_ATUAL.md` + `STATUS_DO_PROJETO.md` com: SHA implantado, backup path/sha256, tags de rollback, o que falta validar no browser.
2. Evidência sanitizada em `docs/vps/evidence/` (sem dump, sem `.env`, sem chave).
3. Commit/push/PR — não deixar só no disco do agente.
4. Nunca gravar no Git: chave privada, senha, `.env.erp.dev`, dump SQL, tokens.

## Backup e rollback

Antes de migration, promoção ou gate destrutivo: executar backup/checkpoint
autorizado e guardar em `/opt/erp-zuccaro/backups`. Quando o gate exigir,
registrar caminho e hash. Nunca remover backups automaticamente.

Preservar ao menos o rollback imediato do runtime anterior durante a
estabilização. Rollback de API e rollback de schema são decisões independentes;
não reverter schema automaticamente se a API anterior continuar compatível.

## Migrations

Migrations históricas são imutáveis. Uma migration nova deve ser aditiva,
passar por precheck e backup, ser registrada em `schema_migrations` e ser
validada no PostgreSQL real antes da promoção. Usar transação e
`ON_ERROR_STOP` quando aplicável. Nunca reaplicar manualmente uma migration já
registrada sem diagnóstico.

## Segurança obrigatória

Todas as operações observam multiempresa, com `group_id` como tenant raiz e
Empresa no contexto aplicável. RLS + FORCE, RBAC fail-closed, bloqueio de
IDOR/cross-group/cross-company, allowlist contra mass assignment e auditoria
atômica são barreiras de backend e banco. A auditoria minimiza PII.

## Portas temporárias

A porta 3080 é oficial. Canários e testes usam porta temporária somente após
precheck de disponibilidade e devem ser parados ao final do gate. Nunca assumir
que uma porta, inclusive 3086, está livre.

## Incidente ou divergência

Registrar a evidência, interromper a mudança e decidir o próximo passo com
autorização. Não promover, apagar, resetar ou reiniciar para ocultar a
divergência.


## Gate proprietário: auditoria e promoção do candidato revisado

### Primeira senha na conta existente

Se o proprietário nunca definiu/recebeu senha, não usar BOOTSTRAP ou criar outro Auth. Após revisão Cursor/CI/merge, o modo `OWNER_ACCESS_MODE=PASSWORD` do mesmo script exige checkout limpo no APPROVED_SHA, banco/rede/tenant reais, decisões anteriores e `CONFIRM_OWNER_PASSWORD_RESET=YES`. Faz AUDIT/preflight/backup sem mudar API/SPA. O proprietário assume o Web Console antes da entrada: digita e confirma senha de 12–200 caracteres em prompt sem eco. Agente não lê, escolhe nem envia a senha.

O GET administrativo deve corresponder ao Auth existente confirmado. A senha segue por stdin até o Auth; nunca em argumento/env/arquivo/chat/log. Intenção e resultado são auditados sem credenciais. Não há retry automático nem rollback de Auth: timeout ou falha de auditoria após PUT deixam estado possivelmente alterado, exigem inspeção privada e eventual nova redefinição pelo proprietário. Não restaurar dump operacional ou senha antiga desconhecida para esconder falha. Preservar backups; confirmar login real e permissões depois. A chave administrativa continua somente no container, jamais no navegador.

PASSWORD exige perfil ativo admin com empresa_id NULL, vínculo Auth/Grupo válido, permissões completas do arquivo canônico owner-admin-permissoes.json e ausência de wildcard. Perfil rebaixado, vinculado a uma Empresa ou com permissões incompletas bloqueia antes de GET/PUT. Resposta PUT 2xx ilegível ou identidade divergente também é ambígua: registrar unconfirmed quando o banco está disponível, interromper sem retry e inspecionar antes de nova tentativa.

`deploy-owner-access-incidente.sh` tem modo AUDIT sem escrita. Informar OWNER_EMAIL explicitamente; não enviar senha em chat, env, argumento ou arquivo. Conferir Auth/perfil, grupo e ambas empresas pela conexão efetiva da API antes de selecionar IDs. Não inventar UUID, renomear seed nem duplicar conta. Reaproveitamento dos registros existentes foi autorizado pelo proprietário; `APPROVE_EXISTING_TENANT_MAPPING=YES` registra essa decisão no gate.

APPLY exige IDs válidos distintos, banco/rede reais, APPROVED_SHA completo igual ao checkout limpo, CONFIRM_OWNER_ACCESS_DEPLOY e CONFIRM_OWNER_GROUP_ADMIN. Somente depois de revisão do Cursor, CI e integração controlada; nenhum operador deve concorrer no Web Console. O procedimento faz backup custom + validação de arquivo, canário API/SPA, grant auditado e promoção das mesmas imagens. BOOTSTRAP é separado e exige CONFIRM_OWNER_TENANT_CREATE; criação Auth externa pode permanecer após falha posterior, exigindo nova auditoria antes de retry. Não executar BOOTSTRAP para o proprietário já existente.

Evidência mínima após promoção: SHA da label + image ID de API e SPA iguais aos canários; ready API/BFF; rejeição de cabeçalhos fabricados; logout completo e login com conta real, escolha de cada empresa, Comercial e Configurações. CI verde ou login sintético não encerram o incidente. Rollback preserva dados; usar restore seletivo de perfil explicitamente autorizado e auditável se necessário, não replay cego de dump. Preservar backups e rollback 06A.

## Acesso proprietário — falha operacional pg_read_file (2026-09-27)

- #96 mesclada na main 56dae6966ae39a11eac3064ca7bb0d67553e7765 após parecer Cursor sobre 23252cc e CI; CI PUSH main #1135/run36326407270 SUCCESS frontend/backend.
- VPS atualizada para esse SHA; AUDIT, identidade efetiva do banco, backup custom e canário API/SPA aprovados. APPLY abortou no provisionamento: `permission denied for function pg_read_file`, transação revertida, nenhuma promoção. Oficiais preservados; canário antigo exclusivamente localhost3086 parado reversivelmente com container/imagem preservados. Backups privados preservados.
- Correção candidata em branch própria: JSON por COPY do cliente psql tanto na concessão quanto no restore seletivo, sem conceder leitura de arquivos do servidor nem elevar o usuário PostgreSQL. Preserva locks, validação de tenant, auditoria, transação e decisões do proprietário. Teste PostgreSQL CI com NOSUPERUSER/NOBYPASSRLS verifica leitura negada e COPY bem-sucedido, inclusive aspas/barra/acentos e comando real do restore.
- Ainda requer CI do novo HEAD e revisão independente Cursor antes de merge/APPLY. Não declarar acesso/deploy concluído. Login real, duas empresas e Comercial/Configurações continuam pendentes; canais OFF. Nenhuma migration ou dado real publicado.
