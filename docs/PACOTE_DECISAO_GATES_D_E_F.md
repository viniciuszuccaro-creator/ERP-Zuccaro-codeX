# Pacote de decisão por gate — D / E / F (corrigido e verificável)

## Distinção obrigatória de estado

| Estado | Significado | Valor atual |
|---|---|---|
| `READY_FOR_REVIEW` | Pacote técnico revisável | **SIM** |
| `AUTHORIZED` | Checkbox + assinatura no termo §C | **NÃO** |
| `EXECUTED` | Merge / Gate E / D / F / 3080 | **NÃO** |

`GATE_*_READY=YES` **nunca** autoriza nem executa.

Simulação #33→#34: branch `cursor/integracao-sim-33-34-392b` / PR #35 (**main intocada**).

---

## 1. O que cada prova comprova (e o que não comprova)

### A) API R07B (`ca0bc5f3`) × schema 001–024 — Postgres isolado

| Item | Valor |
|---|---|
| Script | `scripts/vps/prove-r07b-api-schema-compat.sh` |
| Guarda DROP SCHEMA | `scripts/vps/assert-isolated-database-url.sh` — bloqueia `dbname=postgres`; exige `ISOLATED_DATABASE_NAME` + `ALLOW_DROP_SCHEMA_PUBLIC=ISOLATED_ONLY` |
| Evidência | `docs/vps/evidence/r07b-api-schema-016-024-compat.txt` |
| API sob teste | **Somente** commit `ca0bc5f3529b9071fe80e58dae6aa966a9d6c740` (imagem 3080 `runtime07b-main-ca0bc5f3`) |
| Schema | Migrations **001–024** do checkout integrado (#33), aplicadas no Postgres **isolado** |
| Operações | `/health`, `/ready`, `/api/v1/meta` (=`ERP-RUNTIME-07B`), Produto **list/get/create/patch** |
| Resultado local | `R07B_API_COMPAT_STATUS=OK` |
| **Não comprova** | Homologação na VPS; Auth `supabase_user`; canário; que a 3080 já rode schema 016+ |
| **Proibido** | Executar o script com `DATABASE_URL` do DEV oficial / VPS (`dbname=postgres`) |

### B) Restore do dump pré-Gate E em outro Postgres

| Item | Valor |
|---|---|
| Script Web Console | `scripts/vps/restore-pre-gate-e-isolated-webconsole.sh` |
| Evidência | `docs/vps/evidence/restore-isolated-db-pending.txt` |
| Status | **`OK`** (Web Console 2026-09-24T15:55:00Z) |
| Dump | `pre-gate-e-20260924-140304.sql` sha256=`e72ca99b…` bytes=`390275` (permanece na VPS) |
| Banco isolado | `erp_restore_isolated_20260924_155458` |
| Migrations no isolado | **15** (001–015) · `isolated_migrations_match_pre_gate_e=YES` |
| DEV | `dev_untouched=YES` (`postgres` / mig=15) |
| **Não autoriza** | D/E/F · merge · canário · 3080 · apply migrations |

### C) GO/NO-GO local

| Item | Valor |
|---|---|
| Script | `scripts/vps/go-nogo-def.sh` |
| `GATE_E_READY` | **NO** se 016–024 ausentes de `origin/main` (`main_missing_migrations_016_024`) |
| `GATE_D_READY` / `GATE_F_READY` | **NO** — digest pós-merge + Auth sintético pendentes |
| `DECISION_STATE` | `READY_FOR_REVIEW` |

### D) Self-test de procedimento de restore (filesystem)

| Item | Valor |
|---|---|
| Script | `scripts/vps/validate-isolated-restore.sh --self-test` |
| Comprova | Alvo isolado ≠ DEV; marcador DEV inalterado |
| **Não comprova** | Restauração do dump VPS em banco Postgres |

---

## 2. Revisão PR #33 / #34 / #35

| PR | Papel | Merge na main nesta etapa |
|---|---|---|
| #33 | Código Comercial 360 + migrations 016–024 | **NÃO** |
| #34 | Gate C / go-nogo / termo / pacote Cursor | **NÃO** |
| #35 | Simulação integração #33→#34 + provas | **NÃO** (draft) |

---

## 3. Bloqueios objetivos (antes de AUTHORIZED / EXECUTED)

1. Autorização humana no termo §C (assinatura + checkbox)
2. Merge #33 na `main` (após undraft/review) — 016–024 ainda **ausentes** de `origin/main`
3. Dump pré-Gate E restaurado em Postgres isolado (**OK**; DEV intocado) — **não** autoriza apply Gate E
4. Digest de imagem pós-merge (`PENDING_BUILD_AFTER_MERGE`) — bloqueia D/F
5. Auth sintético (`PENDING_AUTH_GATE`) — bloqueia D
6. Gate E schema na VPS ainda não aplicado — bloqueia D
7. 3080 permanece R07B até F autorizado

---

## 4. Proibições desta etapa

Não merge na main · não migration VPS · não canário · não promoção 3080.
