## CODEX LEGADO — sair do só-sintético / executor host (2026-10-07T19:17Z)

Recebido. **Permissão ≠ HD montado no Cloud.** Confirmação efetiva neste agente:

| Probe | Resultado |
|---|---|
| Executor Cloud | **sem** arquivo privado (`EXPORT_FOUND=NONE`) |
| Self-hosted workers | **0** (`LEGACY_NO_SELF_HOSTED_WORKER`) |
| Desktop agent listado | `bc-d973626e…` source=desktop, `usePrivateWorker=false` — **não** é executor HD |
| SSH key | `NO_SSH_KEY` |
| Inventário | `backup_dir_found=NO` |
| Checksum 153440Z | **UNVERIFIED** (não mismatch) |
| Contagens REAIS backup | **0 / NÃO processadas** — ainda só sintético disponível aqui |
| Contagens sintéticas | inalteradas (staging 8→4/1/1/2; vínculos 3/4) — **não** substituem efetivo |

**Executor autorizado identificado para o passo real:** `host_local` no PC do proprietário
(`scripts/legado/executar-verifier-host-local.sh`) — um comando, sem re-export/CADESP.

**HUMAN_NEXT (mínima):**
```bash
bash scripts/legado/executar-verifier-host-local.sh
# ou: bash scripts/legado/executar-verifier-host-local.sh --reports-dir "D:/BACKUP ERP ANTIGO - CODEX/04_REPORTS"
```
Colar só `PASTE_TO_GIT_HOST_*` + JSON do verifier. Alternativa: `cursor worker start` nesse PC.

Bloqueio específico: `LEGACY_HD_NOT_MOUNTED_ON_CLOUD_AGENT` + `LEGACY_NO_SELF_HOSTED_WORKER`.
Mapper #48 intocado. `importAuthorized=false`. Primeira carga operacional **ainda sob gate**.

## CODEX LEGADO — pacote paralelo checksum/ETL (2026-10-07T13:07Z)


Recebido. Transferência humana já confirmada — **sem** nova transferência/CADESP/export.

### Acesso efetivo (este Cloud)
| Probe | Resultado |
|---|---|
| SSH key | `NO_SSH_KEY` |
| Self-hosted worker | 0 |
| Inventário HD | `backup_dir_found=NO` |
| Leaf export / topology | **NONE** neste filesystem |
| Verifier no arquivo real | **NÃO executado** (`LEGACY_HD_NOT_MOUNTED_ON_CLOUD_AGENT`) |
| Checksum match 153440Z | **UNVERIFIED** (não mismatch) |
| `gh pr edit` #211 | `Resource not accessible by integration` |

### Pacote migração — SINTÉTICO (fixtures) ≠ processamento efetivo do backup

```
kind=synthetic_fixture_migration_package
effectiveBackupProcessing=false
importAuthorized=false
origem: verified=2 failed=0 all_origins_verified=true
vinculos: comprovados=3 quarentena=4 empresasOperacionais=2 agrupamentos=1 blockedRealHdMap=true
staging: origem=8 carregados=4 reusos=1 conflitos=1 quarentena=2 rejeitados=0
  porEmpresa: GRUPO=2 CPA=1 3Z=1
  monetary: CPA=10050 3Z=5000 diff=0 reconciliado=true
classificador_fixture: selo=c5c78e00…dbc67 operacionais=2 terceiraLinha=neverDelete
dependencias_gate: HD 04_REPORTS + sameFileAsPaste + CADESP reusado + backup destino + aprovação humana
reversao: docs/LEGADO_PLANO_IMPORTACAO_REVERSAO_GATE.md
```

### HUMAN_NEXT (executor com HD — único caminho do checksum real)
```bash
node scripts/legado/verificar-evidencia-erp-novo-pre-vps.mjs \
  --export "D:/BACKUP ERP ANTIGO - CODEX/04_REPORTS/legado-empresas-api-20261006T153440Z.json" \
  --reports-dir "D:/BACKUP ERP ANTIGO - CODEX/04_REPORTS"
```
Devolver só JSON do verifier. Depois classificar + staging efetivo sobre backup.

Mapper #48 intocado. #216/#217.

## CODEX LEGADO — transferência confirmada pelo proprietário (2026-10-07)


Recebido (chat principal). **Transferência do export confirmada pelo proprietário.**
NÃO pedir CADESP de novo. NÃO repetir export.

| Item | Estado |
|---|---|
| Export VPS | `legado-empresas-api-20261006T153440Z.json` |
| SHA esperado (paste) | `18e2ab9a085dda6040d4d63d2dfc88d702b0a84203a5cf19d80358c46cca3d7e` |
| Transferência | **confirmada pelo proprietário** (HD privado) |
| Checksum match neste Cloud | **UNVERIFIED** — HD Windows **não montado** aqui (`backup_dir_found=NO`, arquivo local ausente); **não** declarar mismatch |
| ERP novo pré-VPS ID+CNPJ | fonte Gate 18 no HD: `current-erp-company-topology-proof.json` — recuperação física ainda exige PC/HD |
| Staging sintético (paralelo) | origem 8 → carregados 4 / reusos 1 / conflitos 1 / quarentena 2; monetário OK; `importAuthorized=false` |
| PR #211 | OPEN; `gh pr edit` **Resource not accessible** neste token — atualizar título/corpo via Cursor/humano com texto abaixo |
| Mapper #48 | intocado |

**HUMAN_NEXT (PC com HD — mínimo):**
```bash
node scripts/legado/verificar-evidencia-erp-novo-pre-vps.mjs \
  --export "D:/BACKUP ERP ANTIGO - CODEX/04_REPORTS/legado-empresas-api-20261006T153440Z.json" \
  --reports-dir "D:/BACKUP ERP ANTIGO - CODEX/04_REPORTS"
```
Devolver só JSON do verifier (`sameFileAsPaste`, `paresIdCnpj`, `blocked`). Depois:
classificar → CADESP já recebido → staging comprovados / quarentena.

**Texto sugerido título #211:**
`legado: export 153440Z transferido — checksum/HD verifier + staging`

## CODEX LEGADO — revalidação pré-VPS (2026-10-06T17:27Z)


Status: **BLOCKED** / **HUMAN_NEXT**. Reexecução real neste Cloud:
`NO_SSH_KEY`; inventário `backup_dir_found=NO`; verifier exit 2
(`LEGACY_EXPORT_PATH_MISSING`, `LEGACY_REPORTS_DIR_NOT_PROVIDED`).
Checksum match export↔HD: **não** (arquivo local ausente).
CADESP não re-pedido. Tip Codex `7c255148`; PR #211 OPEN.
Testes verifier+classificar+staging 16/16 PASS (sintéticos).

## CODEX LEGADO — evidência ERP novo pré-VPS (ID+CNPJ) (2026-10-06)


Recebido. Prioridade: recuperar evidência do **ERP novo anterior à VPS**
(registros com **ID + CNPJ juntos**), separada da importação do ERP antigo.
CADESP **não** pedido de novo.

### Ações reais neste Cloud

1. SFTP/HD: **BLOCKED** — `ssh_keys_present=false`; `/mnt/d` ausente;
   `LEGACY_SFTP_NO_KEY_AND_HD_UNMOUNTED` (sem transferência falsa).
2. Inventário HD: `inventario-backup-erp-antigo.sh` → `backup_dir_found=NO`.
3. Ferramenta nova (metadados): `scripts/legado/verificar-evidencia-erp-novo-pre-vps.mjs`
   — confere SHA do export VPS vs paste e conta pares id+cnpj_sha256 no
   topology-proof **sem** imprimir IDs/CNPJ.
4. Testes: `legado-verificar-evidencia-erp-novo-pre-vps` + regressão classificar/
   staging/vínculo PASS.

### Evidência sanitizada já conhecida (STATUS Gate 18 — só no HD)

- Leaf pré-VPS: `current-erp-company-topology-proof.json` em `04_REPORTS`
  (quatro fontes: 1 Grupo + 2 Empresas; hashes de ID e CNPJ estáveis).
- Export VPS paste: `legado-empresas-api-20261006T153440Z.json`
  sha256 esperado `18e2ab9a085dda6040d4d63d2dfc88d702b0a84203a5cf19d80358c46cca3d7e`
  (groups=2, empresas=3) — **mesmo arquivo?** só após SFTP + verifier.
- Confronto: preservar **três linhas** VPS + refs; Grupo CPA=agrupamento;
  CPA Ferro + 3Z = operacionais desejadas; rótulo ≠ vínculo.

### HUMAN_NEXT (mínima)

No PC com FileZilla/chave + HD:
1. SFTP o JSON VPS existente → `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS\` (nome único se colidir).
2. `node scripts/legado/verificar-evidencia-erp-novo-pre-vps.mjs --export <json> --reports-dir <04_REPORTS>`
3. Devolver só o JSON de saída do verifier (sem payload).

`importAuthorized=false`; mapper #48 intocado; #216/#217.

## CODEX LEGADO — transferência SFTP do export existente (2026-10-06)


Recebido. **Não** refiz export. Primeira ação **real** (não tip-only):

```
FIRST_ACTION=sftp_get_existing_export
command=sftp -o BatchMode=yes root@srv1982741.hstgr.cloud get /root/erp-private/legado-empresas-api-20261006T153440Z.json
sftp_exit=255
result=Permission denied (publickey,password)
local_file_present=false
windows_04_reports=ABSENT (/mnt/d/... não montado)
self_hosted_workers=0
ssh_keys_present=false
expected_sha256=18e2ab9a085dda6040d4d63d2dfc88d702b0a84203a5cf19d80358c46cca3d7e
TRANSFER_STATUS=FAILED
BLOCKED=LEGACY_SFTP_NO_KEY_AND_HD_UNMOUNTED
```

Destino canônico (ainda não gravado daqui):
`D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS\legado-empresas-api-20261006T153440Z.json`
(se colidir, sufixo `-copy` / UTC — **não sobrescrever**).

**HUMAN_NEXT (mínima — PC do proprietário com FileZilla/SFTP key):**
1. Baixar só o arquivo VPS já existente (não re-exportar).
2. `sha256sum` remoto e local = `18e2ab9a085dda6040d4d63d2dfc88d702b0a84203a5cf19d80358c46cca3d7e`.
3. Avisar o chat; então classificar + CADESP + staging comprovados.

Classificador/staging reais: **BLOCKED** até hash remoto=local no HD.
`importAuthorized=false`; mapper #48 intocado; #216/#217.

## CODEX LEGADO — pacote identidade/procedência/staging (2026-10-06)


Recebido. Sem duplicar. Paste VPS já válido (`executed=true`, tip docs `49e7b33b`).

- JSON `legado-empresas-api-20261006T153440Z.json` (**sha256** `18e2ab9a…3d7e`):
  ainda **só na VPS** — HD ausente neste agente → classificador VPS **NÃO** rodou.
- **HUMAN_NEXT:** SFTP VPS → `BACKUP ERP ANTIGO - CODEX/04_REPORTS/` (nome novo,
  não sobrescrever). Sem re-colar script; sem retry SSH/MCP.
- CADESP: reusado (não pedido de novo). Confrontação IDs/refs **PENDENTE** pós-SFTP.
- #211 procedência Git: PR OPEN (`d89d1d92…`); fontes privadas reais **BLOCKED** (HD).
  Fixture origem: `all_origins_verified=true`, `operationalImportAuthorized=false`.
- Staging fixture (independente): origem 8 → carregados 4 / reusos 1 / conflitos 1 /
  quarentena 2; monetário CPA 10050 / 3Z 5000; diff 0; `importAuthorized=false`;
  `blockedRealHdExtract=true`.
- Classificador **fixture** (não é o JSON VPS): seloSha256
  `c5c78e00e16df7413882b39742b35bab5f9a85997790567da41bf1cfa1cdbc67`;
  2 operacionais + 3ª linha agrupamento neverDelete.
- Testes independentes: 37/37 PASS. Mapper #48 intocado. #216/#217.

## CODEX LEGADO — paste Web Console proprietário (2026-10-06T15:34:40Z)


Recebido. Sem tarefa duplicada. **Export VPS confirmado pelo paste**
(`executed=true`). Este Cloud Agent **não** leu o JSON privado.

### PRECHECK (sanitizado)

```
health=200
ready=200
runtime=ERP-RUNTIME-08B
auth_mode=supabase_user
precheck_line=postgres|pgcrypto=yes|groups=yes|empresas=yes|empresas_cols=yes|groups_cols=yes
digest_probe_len=64
```

### PASTE (sanitizado — sem CNPJ, sem IDs de linha)

```
executed=true
lote=legado-empresas-api-somente-leitura
importAuthorized=false
operationalLoadAuthorized=false
neverDelete=true
cadesp_reused=true
cadesp_redocument_requested=false
api_container=erp-api-dev
api_image=erp-zuccaro-erp-api
api_status=running
db_container=supabase-db
current_database=postgres
cluster_id_sha256=d3b739b0883ed3a2d6419d2c388ffd16019c4e79ce6183696ac8e79cd73c6a78
private_file=legado-empresas-api-20261006T153440Z.json
private_sha256=18e2ab9a085dda6040d4d63d2dfc88d702b0a84203a5cf19d80358c46cca3d7e
groups=2
empresas=3
empresas_ativas=3
match_label_cpa_ferro=1
match_label_3z=1
match_label_grupo_cpa=1
outras_linhas_empresa_nao_apagar=1
coordenacao=#216/#217
```

VPS path: `/root/erp-private/legado-empresas-api-20261006T153440Z.json`
Classificação / CADESP / `seloSha256` do classificador: **PENDENTE** — JSON
ainda não no HD deste agente.

**HUMAN_NEXT (único):** SFTP o arquivo **novo** (não sobrescrever) →
`BACKUP ERP ANTIGO - CODEX/04_REPORTS/`; depois
`node scripts/legado/classificar-empresas-api-legado.mjs --export <path>`;
confrontar CADESP já recebido; CPA+3Z operacionais; 3ª linha `neverDelete`;
staging só comprovados; resto quarentena; `importAuthorized=false`; mapper #48
intocado; sem carga operacional.

## CODEX LEGADO — bloco Web Console alinhado ao chat (2026-10-06)


Recebido. Sem tarefa duplicada. **Sem** novo retry SSH/MCP.
Neste Cloud Agent: sem Web Console autenticada, sem docker local VPS, HD ausente.
`127.0.0.1` nesta VM **≠** VPS. **export NOT_PERFORMED.**

Script = conteúdo idêntico em `4b5d3b94` e tip `7d063b17`
(`scripts/legado/exportar-empresas-api-somente-leitura.sh`).

Caminho privado (nome novo, nunca sobrescrever):
`/root/erp-private/legado-empresas-api-<UTC>.json`

Uma intervenção humana: Cursor/humano cola o script **completo** (mesmo bloco do
chat principal) na Web Console root da VPS DEV; devolve PRECHECK + PASTE;
SFTP o JSON novo ao HD `04_REPORTS`. Depois: confrontar IDs/Grupos/nomes/refs
com CADESP já recebido; preservar 3ª linha; staging só comprovados;
`importAuthorized=false`; mapper #48 intocado.

## CODEX LEGADO — parecer Cursor 4b5d3b94 (2026-10-06)

Recebido. Sem tarefa duplicada. Veredito Cursor: **APPROVED COM RESSALVAS**
(`docs/PARECER_CURSOR_211_SHA_4b5d3b94.md`). Cursor **não** executou o export.

Nova tentativa de execução real neste agente: SSH `publickey` denied; Hostinger
MCP timeout; workers self-hosted=0. **export NOT_PERFORMED.** Probe externo
health/ready ainda 200 — não substitui o paste Web Console.

Intervenção humana (inalterada, SHA `4b5d3b94`):
1. Colar o script **inteiro** no Web Console.
2. Devolver `PASTE_TO_GIT_PRECHECK` + `PASTE_TO_GIT`.
3. JSON privado **nome novo** no HD `04_REPORTS`.
4. `executed=false` se health/ready/pgcrypto falhar.

Mapper #48 intocado. `importAuthorized=false`.

## CODEX LEGADO — tentativa de execução do export API (2026-10-06)


Recebido. **Não** declarei execução só porque o comando existia.

Tentativa neste Cloud Agent (autorização do proprietário usada):
- Hostinger MCP `vps_virtual-machines_list`: **timeout** (não executa SQL/Web Console).
- SSH `srv1982741.hstgr.cloud`: **Permission denied (publickey)** — sem chave neste VM.
- SFTP: cliente presente; autenticação igual ao SSH → **não transferiu**.
- Probe **externo** (não é o export): `erp-dev`/`api-erp-dev` health HTTP 200,
  ready HTTP 200, `database=configured/ok`, runtime `ERP-RUNTIME-08B`,
  `auth.mode=supabase_user`. Isso **não** prova pgcrypto/`digest` nem listou empresas.
- HD / #211 fontes privadas: **BLOCKED** neste VM ≠ backup inexistente no PC.
- CADESP: reusado; não pedido de novo.
- `importAuthorized=false`. Mapper Cursor #48 intocado. #216/#217 ≠ importação.

**Export empresas: NOT_PERFORMED neste agente.**

Comando Web Console **revisado** (pré-checagem health/ready/schema/pgcrypto `digest`
**antes** do SELECT de empresas): `scripts/legado/exportar-empresas-api-somente-leitura.sh`

Intervenção humana (exata):
1. hPanel Hostinger → VPS DEV → Web Console root.
2. Colar o `.sh` inteiro (um paste).
3. Se `PASTE_TO_GIT_PRECHECK` falhar: parar; não há JSON de empresas.
4. Se `executed=true`: SFTP o arquivo **novo**
   `/root/erp-private/legado-empresas-api-<UTC>.json` → HD `04_REPORTS` (nunca GitHub, nunca sobrescrever).
5. Colar no chat só PRECHECK + PASTE (hash/last4). Não apagar terceira linha.

```
PASTE_TO_GIT_BEGIN
executed=false
executor=cloud_agent
export_empresas=NOT_PERFORMED
probe_external=erp-dev+api-erp-dev
health=200
ready=200
runtime=ERP-RUNTIME-08B
auth.mode=supabase_user
database_signal=configured/ok
pgcrypto_digest=UNVERIFIED
schema_groups_empresas=UNVERIFIED
ssh=publickey_denied
hostinger_mcp=timeout
cadesp_reused=true
cadesp_redocument_requested=false
importAuthorized=false
neverDelete=true
coordenacao=#216/#217
HUMAN_NEXT=colar script revisado na Web Console; SFTP JSON novo ao HD
PASTE_TO_GIT_END
```

## CODEX LEGADO — pacote empresas API / CADESP / #211 (2026-10-06)


Recebido (destinatário CODEX LEGADO). Primeira ação: continuar na branch
existente `codex/legado-origem-relatorios-392b` **sem** tarefa duplicada nem
plano de importação novo.

- CADESP/Gate 18 **reusado**; não solicitar os mesmos comprovantes.
- HD ausente neste VM; MCP Hostinger list-VPS **timeout** → sem acesso direto
  funcional. Backup do proprietário **não** é declarado inexistente.
- Comando Web Console (1 paste, somente leitura):
  `scripts/legado/exportar-empresas-api-somente-leitura.sh`
  → arquivo privado **nome novo** `/root/erp-private/legado-empresas-api-<UTC>.json`.
- Classificador (fixture): CPA Ferro e Aço + 3Z LTDA operacionais; terceira
  linha Grupo CPA = agrupamento; `neverDelete=true`; `importAuthorized=false`.
- Staging sintético inalterado: origem 8 → carregados 4 / reusos 1 / conflitos 1 /
  quarentena 2; monetário CPA 10050 / 3Z 5000; extração real HD **BLOCKED**.
- #211: Git ancestral ok; procedência de fontes privadas **BLOCKED** neste VM.
- Coordenação #216/#217: ausência de tela ≠ importação.
- Mapper Cursor #48 intocado; sem tip-port; sem carga operacional.
- Intervenção humana: colar o `.sh` na Web Console da VPS DEV; transferir JSON
  privado ao HD `04_REPORTS`; devolver só `PASTE_TO_GIT_*`.
- SHA remoto: `3adc790030116332f2d677ab649666a9057ecbf8`.

## CODEX LEGADO — coordenação Comercial/Cursor (canônico, 2026-10-05)

Instrução do chat principal (obrigatória para Legado e para Comercial/Cursor):

> Para Comercial/Cursor, acrescente: Investiguem a diferença entre a versão anterior do ERP novo e a VPS: commit/imagem implantada, flags, configurações, rotas, layouts e permissões. Entreguem uma lista de diferenças comprovadas e correções em branch própria, coordenada com o legado. Não tratem toda ausência de tela ou cadastro como problema de importação.

Regras Legado derivadas:

- Layouts/funcionalidades ausentes podem ser causa de **versão implantada**, flags, rotas, layouts ou RBAC — não de ETL/staging.
- Legado **não** classifica ausência de tela/cadastro como falha de importação sem evidência Comercial/Cursor da VPS.
- Coordenar evidências: Legado entrega contagens/staging/quarentena; Comercial/Cursor entrega diff versão anterior ↔ VPS.
- `importAuthorized=false` / `operationalLoadAuthorized=false`; sem carga operacional; sem tip-port; Cursor #48 intocado.

O que Legado precisa do Comercial/Cursor (para não confundir com importação):

1. SHA/commit e tag/digest da **imagem** implantada na VPS (API + SPA).
2. Runtime/`EXPECTED_RUNTIME` e `auth.mode` efetivos (`/api/v1/meta`).
3. Flags HTTP/opt-in (Produto, Comercial, canais, etc.) e env relevantes **sem segredos**.
4. Rotas/menus/layouts visíveis vs esperados no commit da imagem.
5. Permissões/RBAC do perfil de teste (owner vs synth) no seletor Grupo/CPA/3Z.
6. Lista de diferenças comprovadas vs versão anterior + branch própria de correção.

## CODEX LEGADO — plano importação/reversão gate (2026-10-05)

- Branch: `codex/legado-origem-relatorios-392b` @ `cb63c769fd5f03a52b7ec967018c8750dbfbf9fa` (itens 1–5 do programa).
- Plano: `docs/LEGADO_PLANO_IMPORTACAO_REVERSAO_GATE.md` — pré-requisitos, ordem, reconciliação (centavos), rollback, critérios GO/NO-GO.
- `importAuthorized=false` / `operationalLoadAuthorized=false`; promoção staging→operacional proibida até autorização humana.
- Backup original somente leitura; sem PII/dumps no Git; Cursor #48 não editado.
- Coordenação Comercial/Cursor: ver bloco acima — ausência de tela ≠ falha de importação.
- Próximo: **aguardar gate humano** + evidências VPS do Comercial/Cursor (HD montado + backup destino restauro-testado + ata).

## CODEX LEGADO — checkpoint staging isolado (2026-10-05)

- Branch: `codex/legado-origem-relatorios-392b` (itens 1–3).
- Item 3: `carregar-staging-isolado-legado.mjs` — ETL sintético com dedupe, dependências, reconciliação por empresa em centavos e quarentena sem prova; `importAuthorized=false` / `operationalLoadAuthorized=false`.
- Fixture dry-run: origem 8 → carregados 4 / reusos 1 / conflitos 1 / quarentena 2; monetary CPA 10050 + 3Z 5000 centavos; diff 0.
- HD/extração real BLOCKED neste VM. Cursor #48 não editado.
- Próximo: plano de importação/reversão (gate) sem carga operacional.

## CODEX LEGADO — checkpoint vínculos jurídicos (2026-10-05)

- Branch: `codex/legado-origem-relatorios-392b` (itens 1–2 do programa Legado).
- Item 1 (origem relatórios): `validar-origem-relatorios-privados.mjs` + fixture; HD real BLOCKED neste VM.
- Item 2 (identidade jurídica): `resolver-vinculo-juridico-legado.mjs` + contrato sintético — CPA Ferro e Aço / 3Z LTDA = operacionais; Grupo CPA (`003`) = agrupamento não emissor; EMP03/pasta não prova empresa; `importAuthorized=false`.
- Cursor #48 (`mapear-registro-sintetico.mjs`, `LEGADO_MAPEAMENTO_CANONICO_RASCUNHO.md`) não editado.
- Próximo: staging isolado com deduplicação/dependências/reconciliação por empresa; quarentena sem prova; sem carga operacional sem gate.
- Mapa privado real de aliases continua só no HD (`04_REPORTS`); não publicar PII/dumps.

## Resposta Codex ao contrato Cursor do canario - PR #34 secao 4 (2026-09-24)
- Fonte: PR #33 branch codex/comercial-360 em bfdfe834; PR #34 branch cursor/vps-hml-gate-c-legado-392b em e40a8a61. Main ainda ca417160. O Gate C foi marcado aprovado pelo Cursor com evidencias sanitizadas; isso NAO autoriza D/E/F, migration ou Auth novo.
- 1. EXPECTED_RUNTIME=ERP-RUNTIME-08B. `server/src/api/router.ts` fixa esse valor em `/api/v1/meta`. O default `COMERCIAL-360-V1` de `scripts/deploy/comercial360-canary.sh` esta incorreto para este candidato; antes do Gate D passar EXPECTED_RUNTIME explicitamente e ajustar o default em checkpoint validado. Revalidar meta na imagem da MAIN, nao confiar em branch.
- 2. `auth.mode=supabase_user` e requisito de aceitaçao, nao fato do DEV. `server/src/config/env.ts` permite configurar ERP_AUTH_MODE=supabase_user e exige SUPABASE_URL+SUPABASE_ANON_KEY; producao usa este modo por padrao e rejeita dev_headers. `requestContext.ts` valida Bearer no Supabase Auth e resolve `profiles.auth_user_id` ativo e escopado. O canario deve iniciar com configuracao local segura e o smoke deve verificar `/meta` + requisiçao autenticada real. Nao exibir env, token ou chave.
- 3. Gate E: aplicar somente migrations faltantes 016-024 da MAIN ja revisada, em ordem numerica pelo migrator canonico, numa janela autorizada com backup NOVO e rollback preparado. Dividir o controle em 016-017 (Orcamento/Pedido) e 018-024 (Produto/PIM/DAM/canais), conferindo contagens e invariantes apos cada fatia; falha interrompe e bloqueia Gate D. Nao usar API de todo o Comercial 360 sobre esquema parcial; `test:postgres` real (>0, 0 fail/skip) ao final, sem reaplicar 001-015. Nenhuma fatia esta autorizada ou aplicada agora.
- 4. Tag futura `erp-zuccaro-erp-api:comercial360-main-<MERGE_SHA8>` construida somente do SHA efetivamente mesclado na MAIN. Registrar MERGE_SHA, image ID/digest obtidos do build/inspect e prova do canario usando a mesma imagem; nao reutilizar SHA da branch. Digest/tag finais INDETERMINADOS ate merge e build; nao alegar imagem imutavel existente.
- 5. `auth.users=0` e dois profiles ativos sem `auth_user_id` tornam smoke Bearer impossivel hoje. Em gate Auth separado e autorizado, provisionar identidade de teste exclusivamente sintética no Supabase Auth self-hosted, vincular seu UUID a profile ERP sintetico ativo no Grupo/Empresa sinteticos autorizados, com permissoes minimas Orcamento/Pedido. Validar scope positivo e RBAC/tenant negativos. Token, senha, email e chaves somente no ambiente seguro; nenhum valor no Git/log/handoff. Depois revogar sessao/desabilitar identidade de teste conforme procedimento auditavel. Nao reutilizar automaticamente os dois profiles existentes sem provar que sao sinteticos.
- Coordenacao: Cursor revisa este contrato e as verificacoes Gate D/E na PR #34; Codex revisa requisitos da PR #33. Ordem sugerida: fechar/revisar PR #34 documental-operacional primeiro; revisar PR #33 e seu default de runtime; so entao decidir merges por revisao humana e atualizar SHA da MAIN. PR #33 segue draft, sem merge; 3080 continua R07B.
- Frente independente Cliente 360 esta somente no workspace local, sem push e sem CI deste codigo; testes focados passaram, suite completa e build local sofreram OOM. Nao apresentar o endpoint como disponivel no remoto ou na VPS.

## Contrato Cursor/deploy - preco por ClienteEmpresa (2026-09-24)
- API read-only: GET /api/v1/tabelas-preco/preco-cliente?clienteEmpresaId=<uuid>&produtoId=<uuid>&unidadeMedidaId=<uuid>&businessDate=YYYY-MM-DD. Resposta {data: ResolvedPrice|null}; 422 para query/campo invalido, 403 para RBAC negado/ator ausente, 404 seguro para vinculo ClienteEmpresa fora do tenant. Nao enviar tabelaPrecoId, groupId ou empresaId na query; estes ultimos vem do contexto autenticado.
- Backend: TabelaPrecoService consulta ClienteRepository.getEmpresaLinkById no mesmo Grupo/Empresa e usa tabela_preco_id configurada no vinculo, com fallback para tabela padrao autorizada. Produto especifico de outra Empresa nao resolve; mestre compartilhado do Grupo pode resolver. RBAC exige Cadastros.tabela_preco.visualizar e Cadastros.cliente_empresa.visualizar.
- Nenhuma migration ou variavel nova. Frontend HTTP de TabelaPreco permanece nao ativado como piloto; nao ligar na 3080 R07B. Orcamento/Pedido e seus snapshots de itens nao foram alterados. Futuro consumo exige preco efetivo no servidor, regra comercial de alçada/desconto e teste de nao retroatividade antes de habilitar a captura em vendas.
- PR #33 continua draft. Migrations 023/024 somente codigo/CI; gate DEV real segue separado da CI efemera. Nenhuma aplicacao de migration, seed, Auth novo, canario ou promocao neste checkpoint.

## Contrato Cursor/deploy - resolucao de preco (2026-09-24)
- Onda 2: TabelaPrecoService.resolvePrice permanece contrato interno, sem rota nova, flag HTTP, migration ou configuracao. Requer contexto autenticado groupId/empresaId, TenantGuard e RBAC Cadastros.tabela_preco.visualizar; input estrito aceita produtoId, unidadeMedidaId, businessDate opcional YYYY-MM-DD real e clienteEmpresaTabelaId opcional. Nunca aceitar tenant/ator do payload.
- Repositories PostgreSQL e in-memory resolvem somente Produto ativo do Grupo, compartilhado (empresa_id NULL) ou proprietario da Empresa em contexto, e Unidade ativa do Grupo. Tabela e item continuam sujeitos a vinculo empresarial, vigencia e estado. ID de tabela especifica nao deve ser exposto como escolha livre ao frontend antes de validar o vinculo ClienteEmpresa.
- Orcamento/Pedido nao foram alterados. Ao integrar, escolher tabela autorizada pelo ClienteEmpresa/canal, calcular no servidor e persistir snapshot imutavel do preco por item; nao recalcular vendas historicas a partir da tabela atual. Requer teste tenant A/B, fallback, vigencia, concorrencia e RBAC antes de habilitar HTTP.
- Migrations 023/024 estao somente no codigo/CI; nenhuma aplicada na VPS. Gate C ainda exige restauracao isolada, backup novo e precheck de porta/canario. Preservar API 3080 R07B e PR #33 draft.

## Contrato Cursor/deploy - Produto por canal (2026-09-24)
- PR #33 segue draft, branch codex/comercial-360. A migration aditiva 024_produto_canais_rascunho.sql e o CRUD canonico de Produto/canais estao no codigo/CI; nao aplicar na VPS sem gate aprovado, novo backup, teste de restauracao e precheck da porta isolada. A migration 023 tambem nao foi aplicada na VPS.
- API: GET/POST /api/v1/produtos/:id/canais, PATCH/DELETE /api/v1/produtos/:id/canais/:canalId. POST aceita somente canal, sku?, nome?, descricao?; PATCH aceita somente subconjunto nao vazio de sku, nome, descricao. Canal exige slug minusculo; status permanece RASCUNHO. DELETE e inativacao logica. Respostas 201/200, erros 400/403/404/409.
- Contratos: escopo vem exclusivamente do contexto autenticado Grupo/Empresa; Produto deve estar ativo e pertencer a Empresa, RBAC Cadastros.produto.visualizar/editar, auditoria na mesma transacao. Nao enviar groupId, empresaId, actorId, status ou preco no body. SKU e unico por Grupo/Empresa/canal, inclusive soft-deleted. CRUD nao aciona catalogo, outbox de publicacao, preco, estoque, fiscal ou integracao externa.
- Configuracao: nenhuma variavel nova. Produto HTTP continua opt-in/desligado na 3080; sem Auth real homologado, nao ativar VITE_ERP_HTTP_PRODUTO nem associar IDs legados. StoragePort/scanner/publicacao permanecem gates separados.
- Testes: service/in-memory, HTTP e PostgreSQL sintetico na suite existente. CI do novo HEAD deve confirmar backend/frontend e E2E PostgreSQL sem fail/skip antes de handoff operacional.
- Proximo deploy autorizado deve inventariar migrations reais, aplicar somente faltantes da MAIN aprovada, validar RLS/FORCE e smoke autenticado no canario isolado; 3080 so muda em gate de promocao explicito.

## Checkpoint vigente - Comercial 360 / Gate C (2026-09-23)
- Branch `codex/comercial-360`, PR #33 draft e sem merge; ultimo HEAD funcional antes deste checkpoint documental `c3df0c3ca0f95a4c27e21de7b91cb002fb154f53`. CI `35919084889` frontend/backend SUCCESS, incluindo PostgreSQL efemero. A CI nao homologa o DEV real.
- Migrations 001-022 existem no repositorio/CI; a evidencia agregada fornecida pelo usuario da VPS mostrou somente 001-015 aplicadas uma vez. Nao executar 016-022, seed, Auth novo, scanner, Produto HTTP ou canario sem gate especifico.
- API oficial 3080 permanece R07B/`dev_headers` conforme capturas fornecidas; backup SQL de 21/09 tem tamanho, hash e marcador de dump completo, mas nao teve restauracao comprovada. Imagem/container de rollback R07B preservados; 3086 estava livre no momento da consulta, sem autorizar implantacao.
- Gate C PARCIAL: comparar em leitura somente a conexao efetiva da API com uma conexao direta ao `supabase-db` por identidade do servidor/migrations, sem imprimir URL ou credenciais; confirmar restaurabilidade e backup atualizado no gate autorizado. Comparar apenas IP nao e prova suficiente.
- Orientacoes R08 abaixo sao historicas. Nao usar a secao antiga "Passo historico R08B" como ordem de execucao atual. Preservar PR draft, main e 3080 ate gate separado.
## Checkpoint vigente - Gate C, evidencia Web Console (2026-09-24)
- Captura do usuario mostrou `conexao_api_vs_supabase_db=MATCH` ao comparar `current_database()` e identificador do cluster PostgreSQL da API e do `supabase-db`. A divergencia anterior de IP era inconclusiva e nao deve ser usada para negar este resultado.
- Backup SQL de 21/09: 486969 bytes, SHA-256 calculado, marcador de dump completo; restaurabilidade ainda nao testada. Rollback R07B: container preservado/exited e imagem presente. Porta 3086 livre no instante da consulta; 3080 preservada.
- PR #33 permanece draft e sem merge. HEAD anterior `38bb311709673e87fd00c00e9a81d0c660c0bf6b`, CI `35985748032` SUCCESS; migrations 001-024 no codigo/CI, somente 001-015 evidenciadas na VPS. Gate C nao autoriza canario/migration: falta restauracao isolada, backup novo pre-implantacao e precheck imediatamente antes do uso. Auth novo, scanner real e Produto HTTP nao homologados.
- As secoes de 23/09 abaixo sao historicas e nao substituem este checkpoint.

## Gate C - precheck Web Console adicional (2026-09-23)
- Backup SQL de 21/09/2026 encontrado com 486969 bytes, SHA-256 calculado e marcador de dump completo; restauracao nao testada e backup atualizado ainda pendente para o gate autorizado.
- API oficial `erp-api-dev` running na imagem R07B; container de rollback R07B exited e imagem preservada. Porta 3086 sem listener nem container ativo no instante da consulta; 3080 preservada.
- Gate C segue parcial ate comparacao read-only da conexao efetiva da API com `supabase-db`. Nao iniciar canario, Auth novo, migration ou promocao com base apenas nesse precheck.

## Gate C - Web Console complementar (2026-09-23)
- Evidencia fornecida pelo usuario: API oficial 3080 na imagem R07B, health/ready 200; Auth/DB healthy; API e DB na rede `supabase_default`. Conexao da API reportou banco `postgres` e 15 migrations.
- Comparacao de IP retornou `api_usa_supabase_db=NO`; resultado e inconclusivo para identidade fisica por possivel proxy/IPv6/traducao. Nao declarar banco divergente nem Gate C aprovado ate comparar conexao efetiva e conexao direta ao DB.
- Backups de 20/09 e containers antigos de rollback aparecem preservados, sem verificacao de integridade/restaurabilidade. Porta 3086 nao apareceu em `ss` entre os filtros; 3080 segue oficial. Nao houve escrita VPS ou ativacao.

## Gate C prioritario - checkpoint de 2026-09-23
- PR #33 draft/mergeable no HEAD `750a4ab14854e184d6fb2fc8afef7f6e2094b277`; CI `35910005796` frontend/backend e PostgreSQL efemero SUCCESS. A CI do commit funcional `52167840` (`35909747751`) tambem passou.
- Evidencia VPS nao avancou nesta sessao: Web Console falhou antes de abrir (`helper_unknown_error: apply deny-read ACLs`) e nao ha ferramenta VPS interna disponivel. Banco efetivo da API, rede, backup e rollback continuam sem precheck atual; nao inferir Gate C aprovado.
- O bloco unico de leitura sanitizada foi entregue ao usuario. Nao executar Auth, scanner, Produto HTTP, migration ou promocao na 3080 ate gates separados.

## Gate C DEV - evidencia SQL agregada (2026-09-23)
- Web Console informada pelo usuario: `schema_migrations` possui `id`/`applied_at`; 001-015 cada 1x, 016-022 ausentes nas 15 linhas. `auth.users=0`, `profiles=2`, `groups=2`, `empresas=3`; ambos os perfis ativos estao sem Auth. Sem vinculos de grupo/empresa invalidos nas contagens.
- Nome do banco da API e `current_database()` nao visiveis na captura; identidade do banco da API ainda pendente. Gate C nao aprovado para Auth/canario: API oficial 3080 permanece 07B/`dev_headers`.
- Nenhuma escrita VPS realizada. Continuar somente leitura para banco/rede/backup/rollback; identidade sintetica e perfil requerem gate autorizado separado.

## Gate DEV parcial - 2026-09-23
- Web Console, conforme evidencia informada pelo usuario: API oficial `erp-api-dev` em 3080, imagem `runtime07b-main-ca0bc5f3`; health/ready 200; meta `ERP-RUNTIME-07B`, `auth.mode=dev_headers`.
- MCP Hostinger confirmou VPS `srv1982741` running e Supabase Auth/DB/Storage healthy. Nao ha evidencia SQL de migrations nem dos vinculos de profiles nesta sessao.
- Gate C ainda nao aprovado. PR #33 segue draft; codigo Auth novo nao foi implantado/homologado. Nenhuma acao de escrita na VPS, 3080 preservada.
- Consultas agregadas e gates condicionais constam em `COMERCIAL_360_V1_DEPLOY.md`.


## Checkpoint Comercial 360 - 2026-09-23 (PR #33 draft)
- Branch `codex/comercial-360`; referencia comprovada antes deste checkpoint: `865e23d29ed72d6b00180fc52a4bde572f85c864`; CI `35873286965` verde com PostgreSQL efemero. A `main` e a VPS nao foram alteradas aqui.
- Migrations 001-021 existem no repositorio. Orcamento/Pedido iniciais e Produto/PIM/DAM/Auth estao preparados em codigo; Produto HTTP desligado e midias em QUARENTENA. Nenhuma aplicacao real das migrations 016-021 foi comprovada.
- Gate C DEV ainda sem auditoria VPS verificavel nesta sessao: MCP Hostinger nao expos ferramentas VPS e Web Console falhou antes de abrir. Nao assumir estado atual da API 3080, Auth, PostgreSQL ou buckets a partir do historico abaixo.
- Proximo gate: auditoria somente leitura via Web Console/Hostinger VPS, saida sanitizada; depois homologacao controlada de Auth/perfis. Sem SSH, migration, seed, restart, bucket, ClamAV na VPS, promocao ou merge neste checkpoint.

# ERP ZUCCARO — Handoff atual

## Atualizacao Comercial 360 V1 - 2026-09-21

- Branch de trabalho: `codex/comercial-360`; PR aberta: `#33`; nao mesclada.
- Checkpoint funcional do frontend: `0040e994a8d4c3c3cdd417cc9502fa332c6b3567`; preparação de deploy validada: `3c96bb677aef9c5498842005a6a4a2dd3bc36de3`.
- CI final comprovada antes do fechamento documental: workflow PR `35667460162`, frontend/backend `SUCCESS`; migrate, seed sintetico e PostgreSQL E2E passaram.
- Orçamento e Pedido usam backend HTTP canonico, tenant Grupo/Empresa, RBAC fail-closed e auditoria transacional. Migrations novas 016/017 foram validadas somente no PostgreSQL efemero da CI.
- Preparacao de deploy: `COMERCIAL_360_V1_DEPLOY.md` e `scripts/deploy/comercial360-{canary,smoke,rollback}.sh`. Os scripts nao foram executados; rollback e dry-run por padrao.
- VPS permanece intocada por esta versao: API oficial 3080, migrations aplicadas, imagens, containers e backups continuam no estado operacional descrito abaixo. Proximo gate exige merge e autorizacao VPS separados.
Atualizado em 2026-09-20 após o diagnóstico definitivo do gate do ERP-RUNTIME-08.

## Referências

- Repositório: `viniciuszuccaro-creator/ERP-Zuccaro-codeX`.
- SHA funcional 07B: `ca0bc5f3529b9071fe80e58dae6aa966a9d6c740`.
- Um commit documental posterior, quando existir, deve ser registrado separado
  desse SHA funcional.

## DEV

- VPS: `/opt/erp-zuccaro`.
- API oficial 3080: `ERP-RUNTIME-07B`.
- Imagem: `erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3`.
- PostgreSQL: migrations 001–015 aplicadas exatamente uma vez. As migrations 014 e
  015 são imutáveis e não devem ser reaplicadas manualmente.
- `013_tabelas_preco.sql` permanece aplicada uma vez.

O pós-promoção 07B foi aprovado. A API oficial, banco e VPS não são alterados
por esta documentação.

## Último runtime e agregados canônicos

O ERP-RUNTIME-07B está fechado. Os agregados relevantes são Produto, Cliente,
ClienteEmpresa, ClienteLocal, Obra, TabelaPreco, TabelaPrecoEmpresa e
TabelaPrecoItem.

TabelaPreco tem origem por Empresa, autorização N:N, padrão por Empresa e
referência específica nullable em ClienteEmpresa. A resolução é específica,
depois padrão, depois sem preço. Itens usam Produto + Unidade, valores
`NUMERIC(18,6)`, vigência no cabeçalho, soft delete, RLS, RBAC e auditoria.

## Frontend e rollback

`TabelaPreco.frontendHttp=false`; esse cutover não ocorreu.

Os rollbacks 06B e 06A estão preservados e não devem ser apagados.

## Diagnóstico do gate R08

As constraint triggers reais da 015 estão `DEFERRABLE INITIALLY DEFERRED` e a
barreira rejeita, no `COMMIT`, condição ativa sem parcelas, total de 99%, remoção
da única parcela e reativação sem parcelas. Os testes locais também comprovam o
rollback após cada falha.

O gate que registrou `INVALID_INSERT_EXIT=0` usava `docker exec` sem `-i`. Sem
stdin interativo, o heredoc do Bash não é encaminhado ao `psql`; o processo pode
encerrar com sucesso sem executar o `BEGIN`/`INSERT`/`COMMIT`. A causa é, portanto,
o harness, não aceitação persistida da condição inválida. Com `ON_ERROR_STOP=1`,
um erro SQL em execução não interativa precisa resultar em status não zero.

## Hotfix de metadata R08B

O container temporário do R08B iniciou normalmente. O gate aguardava
`ERP-RUNTIME-08B`, mas `/api/v1/meta` respondia literalmente
`ERP-RUNTIME-07B`; o timeout do gate provocou o cleanup com `SIGTERM`. Não
houve crash nem OOM. O hotfix da branch altera somente a identidade de metadata
para `ERP-RUNTIME-08B` e declara `CondicaoPagamento` como preparado no backend,
mantendo `frontendHttp=false` e fora do piloto HTTP.

## Diagnóstico RBAC e E2E R08B

O `403` do smoke de Condição de Pagamento é causado por seed RBAC incompleto,
não por falha do canário: o actor usado no gate,
`a4a4a4a4-aaaa-4aaa-8aaa-a4a4a4a4a4a4`, pertence ao Grupo A e pode operar as
Empresas A/A2, mas não possuía `Cadastros.condicao_pagamento.visualizar`.
LIST e GET exigem essa mesma ação; as demais ações são `criar`, `editar`,
`inativar`, `restaurar`, `vincular-empresa`, `gerenciar-parcelas` e
`definir-padrao`. O seed idempotente foi corrigido somente para os dois actors
sintéticos A/B, com essas ações explícitas e sem wildcard.

A imagem runtime contém somente artefatos de produção, portanto `npm test`
dentro dela encontrar zero testes é esperado e não prova E2E. O mecanismo
canônico do próximo gate é `npm run test:postgres` no worktree exato do PR,
com dependências de teste efêmeras e `DATABASE_URL` fornecida apenas no
ambiente do gate. O runner falha sem `DATABASE_URL` ou se executar zero testes.

O primeiro E2E PostgreSQL real executou um teste e chegou ao banco. LIST/GET
autorizados passaram, e RBAC/cross-group permaneceram bloqueados. A falha
`SQLSTATE 23514` veio exclusivamente do payload de teste: ele enviava
`E2E-...` para `codigo`, enquanto a constraint exige seis dígitos. A constraint
funcionou corretamente. O hotfix reserva, dentro da transação rollbackável, um
código numérico livre entre `900000` e `999999`; API e schema já eram coerentes.

## Passo historico R08B (nao executar como proximo gate)

Registro de 20/09, superado pelo checkpoint vigente acima. No Gate VPS autorizado, repetir somente o E2E PostgreSQL real e concluir o
canário. O seed RBAC já foi aplicado e não deve ser reaplicado por este hotfix;
não reaplicar migrations. A API oficial 3080 continua R07B. Não
criar migration 016, não promover a API R08 e não fazer merge neste gate.
