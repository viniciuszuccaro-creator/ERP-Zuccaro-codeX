# Pacote de decisão por gate — D / E / F (corrigido e verificável)

## Distinção obrigatória de estado

| Estado | Significado | Valor atual |
|---|---|---|
| `READY_FOR_REVIEW` | Pacote técnico revisável | **SIM** |
| `AUTHORIZED` | Checkbox + assinatura no termo §C | **NÃO** |
| `EXECUTED` | Merge / Gate E / D / F / 3080 | **NÃO** |

`GATE_*_READY=YES` **nunca** autoriza nem executa.

## Candidata única ao merge

| Item | Valor |
|---|---|
| PR | **#35** — candidata **única** ao merge em `main` |
| Branch | `cursor/integracao-sim-33-34-392b` |
| Contém #33 | **SIM** — HEAD `ceeb92e99954b39d3137dde497208b0db1010869` (`codex/comercial-360`) |
| Contém #34 | **SIM** — HEAD `f41d87e550f7c11d1863bbf8775d03398bebe2de` (`cursor/vps-hml-gate-c-legado-392b`) |
| Merge #33 ou #34 isoladas | **NÃO** — integrar só via #35 |
| Main nesta etapa | **intocada** até autorização humana do merge de #35 |

---

## 1. O que cada prova comprova (e o que não comprova)

### A) API R07B (`ca0bc5f3`) × schema 001–024 — Postgres isolado

| Item | Valor |
|---|---|
| Script | `scripts/vps/prove-r07b-api-schema-compat.sh` |
| Guarda DROP SCHEMA | `scripts/vps/assert-isolated-database-url.sh` — bloqueia `dbname=postgres`; exige `ISOLATED_DATABASE_NAME` + `ALLOW_DROP_SCHEMA_PUBLIC=ISOLATED_ONLY` |
| Evidência | `docs/vps/evidence/r07b-api-schema-016-024-compat.txt` |
| API sob teste | **Código do commit** `ca0bc5f3529b9071fe80e58dae6aa966a9d6c740` (worktree; meta `ERP-RUNTIME-07B`). **Não** é o image ID da 3080 |
| Schema | Migrations **001–024** do checkout integrado (#33), aplicadas no Postgres **isolado** |
| Operações | `/health`, `/ready`, `/api/v1/meta` (=`ERP-RUNTIME-07B`), Produto **list/get/create/patch** |
| Resultado | `R07B_API_COMPAT_STATUS=OK` |
| **Não comprova** | Homologação na VPS; Auth `supabase_user`; canário; que a 3080 já rode schema 016+; identidade de imagem Docker da 3080 |
| **Proibido** | Executar o script com `DATABASE_URL` do DEV oficial / VPS (`dbname=postgres`) |

### B) Restore do dump pré-Gate E em Postgres isolado

| Item | Valor |
|---|---|
| Script Web Console | `scripts/vps/restore-pre-gate-e-isolated-webconsole.sh` |
| Evidência | `docs/vps/evidence/restore-isolated-db-pending.txt` |
| Status | **`RESTORE_ISOLATED_DB_STATUS=OK`** (Web Console 2026-09-24T15:55:00Z) |
| Dump | `pre-gate-e-20260924-140304.sql` sha256=`e72ca99b…` bytes=`390275` |
| Dump no GitHub | **NÃO** — `dump_committed_to_git=NO`; arquivo permanece só na VPS (`dump_left_on_vps=YES`) |
| Banco isolado | `erp_restore_isolated_20260924_155458` |
| Migrations no isolado | **15** (001–015) · `isolated_migrations_match_pre_gate_e=YES` |
| DEV | `dev_untouched=YES` (`postgres` / mig=15) |
| **Não autoriza** | Gate E apply · D/F · canário · promoção 3080 |

### C) GO/NO-GO local

| Item | Valor |
|---|---|
| Script | `scripts/vps/go-nogo-def.sh` |
| `GATE_E_READY` | **NO** — 016–024 ausentes de `origin/main` (`main_missing_migrations_016_024`) |
| `GATE_D_READY` / `GATE_F_READY` | **NO** — digest pós-merge + Auth sintético pendentes |
| `backup_restore_isolated` | `OK_ISOLATED_REAL_DUMP` |
| `DECISION_STATE` | `READY_FOR_REVIEW` |

### D) Self-test de procedimento de restore (filesystem)

| Item | Valor |
|---|---|
| Script | `scripts/vps/validate-isolated-restore.sh --self-test` |
| Comprova | Alvo isolado ≠ DEV; marcador DEV inalterado |
| **Não comprova** | Restauração do dump VPS em banco Postgres (já coberta em B = OK) |

---

## 2. Papel das PRs

| PR | Papel | Merge isolado na main |
|---|---|---|
| #33 | Código Comercial 360 + migrations 016–024 | **NÃO** — entra só via #35 |
| #34 | Gate C / go-nogo / termo / pacote Cursor | **NÃO** — entra só via #35 |
| **#35** | **Candidata única** de integração (#33+#34 + provas) | **Somente com autorização humana** (ainda draft / não executado) |

---

## 3. Bloqueios objetivos (antes de AUTHORIZED / EXECUTED)

1. Autorização humana no termo §C (assinatura + checkbox) para o que for executar depois
2. Autorização humana do **merge de #35** (não de #33/#34 isoladas) — 016–024 só entram na `main` com esse merge
3. Dump pré-Gate E restaurado em Postgres isolado (**OK**; DEV intocado; dump **fora** do Git) — **não** autoriza apply Gate E
4. Digest de imagem pós-merge (`PENDING_BUILD_AFTER_MERGE`) — bloqueia D/F
5. Auth sintético (`PENDING_AUTH_GATE`) — bloqueia D
6. Gate E schema na VPS ainda não aplicado — bloqueia D
7. 3080 permanece R07B até F autorizado

---

## 4. Proibições desta etapa

Não merge na main · não migration VPS (Gate E) · não canário · não promoção 3080 · não enviar o dump SQL ao GitHub.
