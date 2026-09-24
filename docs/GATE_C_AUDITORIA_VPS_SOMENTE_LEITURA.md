# Gate C — Auditoria VPS somente leitura (frente Cursor)

**Status:** `PARCIAL` — aguarda execução do bloco único na Web Console e
colagem da saída sanitizada.
**Frente:** Cursor / VPS / HML / migração legada.
**Branch:** `cursor/vps-hml-gate-c-legado-392b`
**Base comprovada:** `origin/main` @ `ca4171600cc30f9922c2f8b2ccb8b22d06aa6888`
**PR Codex (não editar):** #33 `codex/comercial-360` (draft)
**Programa:** `docs/PROGRAMA_COMERCIAL_360_OMNICANAL_EXECUCAO_AUTONOMA.md` (PR #33)
**Runbook VPS:** `docs/OPERACAO_DEV_VPS.md`
**Deploy preparado (PR #33):** `docs/COMERCIAL_360_V1_DEPLOY.md` +
`scripts/deploy/comercial360-{canary,smoke,rollback}.sh`

Este lote é **somente documentação e ferramentas de leitura**. Não altera VPS,
banco, API 3080, migrations, Auth, buckets, ClamAV, frontend HTTP nem a PR #33.

---

## 1. Objetivo do Gate C

Fechar, com evidência sanitizada, a auditoria inicial da VPS DEV antes de
qualquer canário (D), migration real (E) ou promoção (F):

1. identidade do **banco efetivo** usado pela API oficial;
2. histórico de `schema_migrations` (aplicadas vs código candidato);
3. rede Docker e porta isolada livre para canário;
4. estado dos backups (caminho, tamanho, hash; restaurabilidade = gate à parte);
5. caminho de rollback da API (container/imagem preservados);
6. dependências do Supabase Auth (containers saudáveis ≠ Auth homologado).

Scripts preparados ou CI com PostgreSQL efêmero **não** fecham este gate.

---

## 2. Limites desta sessão (Cursor Cloud)

| Capacidade | Estado nesta sessão |
|---|---|
| MCP Hostinger VPS | **indisponível** (namespace ausente no ambiente) |
| Web Console autenticada | **não operável** daqui (URL pública só entrega a página do terminal) |
| SSH / escrita VPS | **proibido** neste gate |
| API local 3080 no cloud agent | inacessível (esperado; a API vive na VPS) |
| Consulta GitHub PR #33 | feita: draft, HEAD `b7019c6774412bdbafd2944bde4d7edde8c223f2`, CI frontend/backend SUCCESS |

**Inferência:** sem Web Console autenticada nesta sessão, o Gate C **não pode
ser marcado APROVADO** só com histórico. Continua **PARCIAL** até a saída do
bloco §6 ser colada e analisada.

---

## 3. Fatos observados (já comprovados / informados)

Legenda: **FATO** = evidência independente ou usuário + handoff; **INFERÊNCIA** =
conclusão ainda não fechada.

### 3.1 Identidade e runtime

| Item | Classificação | Evidência |
|---|---|---|
| VPS `srv1982741` | FATO (usuário / histórico Hostinger) | handoff Comercial 360 |
| Web Console informada | FATO (URL) | `https://bos2.hostingervps.com/4423/` — exige sessão do usuário |
| API `erp-api-dev` :3080 | FATO | imagem `runtime07b-main-ca0bc5f3`; health/ready HTTP 200 |
| Meta 3080 | FATO | `ERP-RUNTIME-07B`; `auth.mode=dev_headers` |
| Auth novo da PR #33 homologado na 3080 | **NÃO** | 07B/`dev_headers` ≠ `supabase_user` |
| Containers Supabase Auth/DB/Storage “healthy” | FATO (histórico MCP/usuário) | saúde de container ≠ SQL nem Auth de produto |
| PR #33 mesclada | **NÃO** | draft aberto |
| Migrations 016–024 na VPS | **NÃO evidenciadas** | handoff: 001–015 uma vez; 016+ ausentes na captura |

### 3.2 Banco / migrations

| Item | Classificação | Evidência |
|---|---|---|
| `schema_migrations` com 001–015, 1× cada | FATO (captura usuário + handoff) | sem 016–022/024 na captura de 15 linhas |
| `auth.users=0`, `profiles=2` ativos sem Auth | FATO (captura agregada) | Auth produto **não** homologado |
| `groups=2`, `empresas=3` | FATO agregado | sem PII |
| Comparação IP API vs DB = NO | FATO inconclusivo | proxy/IPv6/tradução possível |
| `current_database` + cluster API vs `supabase-db` = MATCH | FATO (handoff 2026-09-24) | fecha parcialmente identidade de cluster/banco **naquele instante** |
| Consulta foi ao banco efetivo da API **agora** | INFERÊNCIA até revalidar | precisa do bloco §6 na mesma janela de operação |

### 3.3 Rede, canário, backup, rollback

| Item | Classificação | Evidência |
|---|---|---|
| API e DB na rede Docker compartilhada | FATO (histórico) | nome exato da rede deve ser relido no precheck |
| Porta 3086 livre em instantes anteriores | FATO histórico | **não** assumir livre agora |
| Backup SQL ~21/09, ~486969 bytes, SHA-256, dump completo | FATO (handoff) | restaurabilidade **não** testada |
| Container/imagem rollback R07B preservados | FATO (handoff) | integridade de restore de schema **não** comprovada |
| Scanner ClamAV / buckets DAM / Produto HTTP | **não comprovados** | fora do Gate C de fechamento; gates próprios |

---

## 4. Critério de APROVADO / PARCIAL / BLOQUEADO

### APROVADO (Gate C)

Todas verdadeiras, com saída sanitizada do §6:

1. Identidade: `api_db_name` = `direct_db_name` e `api_cluster` = `direct_cluster` (MATCH).
2. Migrations: lista 001–015 exatamente 1×; nenhuma duplicata; registrar se existe id >015.
3. Rede: nome da rede do `erp-api-dev` e do `supabase-db` iguais; porta candidata ≠3080 e sem listener.
4. Backup: ao menos um arquivo com tamanho + SHA-256 + marcador de dump completo; caminho sob `/opt/erp-zuccaro/backups` (sem conteúdo).
5. Rollback: container/imagem R07B inspectáveis (nome/imagem/status), sem apagar.
6. Auth dependência: containers Auth/DB reportados; **e** registro explícito de que `auth.mode=dev_headers` na 3080 **não** homologa Auth da PR #33.
7. Nenhuma escrita VPS neste gate.

### PARCIAL (estado atual)

Itens históricos existem, mas falta **revalidação na mesma sessão operacional**
(bloco §6) e/ou backup novo pré-implantação / teste de restauração isolada
(esses dois últimos podem permanecer pendentes como *pré-requisitos de E/F*,
desde que documentados — o Gate C fecha a auditoria de leitura; E/F exigem
backup fresco autorizado).

### BLOQUEADO

Qualquer divergência de cluster/banco, migration duplicada, ausência de
rollback preservado, tentativa de usar CI efêmera como prova DEV, ou pedido de
escrita/canário sem autorização.

---

## 5. Contratos a comunicar ao Codex (PR #33)

Sem editar a branch do Codex. Mensagens objetivas:

1. Gate C Cursor: **PARCIAL** até saída do bloco §6; Hostinger MCP ausente neste ambiente.
2. Imagem oficial atual: R07B `ca0bc5f3` / `dev_headers` — canário deve exigir `auth.mode=supabase_user` (já no script da PR #33).
3. Migrations VPS evidenciadas: **001–015**; candidatas 016–024 só no código/CI — **não aplicar** sem Gate E + backup.
4. SHA de imagem imutável do canário deve ser o **MERGE_SHA da main** após merge da PR #33 — nunca build da branch feature.
5. Autorizar juntos: digest da imagem, lista exata de migrations faltantes, identidade sintética Auth para smoke D.

---

## 6. UM bloco somente leitura — colar na Web Console

**Preferência:** copiar o script versionado (mesmo conteúdo):

```bash
# Na Web Console (VPS), com o repo ou o arquivo disponível:
bash scripts/vps/gate-c-read-only.sh
```

Artefato: `scripts/vps/gate-c-read-only.sh` (somente leitura).

**Instruções ao operador humano**

1. Abrir a Web Console já autenticada da VPS (`srv1982741`).
2. Colar **apenas** o conteúdo de `scripts/vps/gate-c-read-only.sh`, ou executá-lo se o arquivo estiver na VPS.
3. Confirmar que não há `cat`/print de `.env`, URL, senha, token, e-mail, nome ou UUID individual.
4. Devolver a saída bruta (já sanitizada pelo próprio script) nesta conversa ou no PR.
5. Opcional (na workstation com o checkout):
   `bash scripts/vps/gate-d-f-precheck.sh --from-gate-c-output saida-gate-c.txt`

O corpo completo do script está em `scripts/vps/gate-c-read-only.sh` — **não**
duplicar aqui para evitar deriva. Se precisar colar sem git na VPS, abra o
arquivo no GitHub (branch desta frente) e cole o conteúdo integral.
---

## 7. O que NÃO fazer após colar o bloco

- Não aplicar migrations 016–024.
- Não reiniciar `erp-api-dev` / não alterar bind 3080.
- Não criar canário.
- Não rotacionar/reutilizar token Hostinger exposto em chat.
- Não imprimir `.env` / `DATABASE_URL` / JWT / chaves.
- Não commitár saída com PII; apenas agregados do script.

---

## 8. Próximo passo desta frente (já preparado em paralelo)

1. Aguardar saída do `scripts/vps/gate-c-read-only.sh` → atualizar este documento
   para APROVADO ou BLOQUEADO.
2. Rodar `scripts/vps/gate-d-f-precheck.sh --from-gate-c-output <saida>` na
   workstation (não aplica migration).
3. Preparação Gates D–F: `docs/GATES_D_F_PREPARACAO_CANARIO.md`.
4. Descoberta legado: `docs/LEGADO_BACKUP_DESCOBERTA_SOMENTE_LEITURA.md` +
   `docs/LEGADO_MAPEAMENTO_CANONICO_RASCUNHO.md` +
   `scripts/legado/inventario-backup-erp-antigo.sh`.
