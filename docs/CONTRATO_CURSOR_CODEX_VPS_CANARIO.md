# Contrato Cursor ↔ Codex — VPS / canário / migrations

**Status:** `GATE C APROVADO — DECISÕES §4 DOCUMENTADAS / OPERACIONAL PENDENTE`
**Frente Cursor:** PR #34 `cursor/vps-hml-gate-c-legado-392b`
**Frente Codex:** PR #33 `codex/comercial-360` (draft; **não editada por esta frente**)
**Atualizado:** 2026-09-24 (respostas Codex no comentário da PR #34; HEAD #33 observado
`ceeb92e9` — revalidar no GitHub, não congelar)

Pacote operacional: `docs/PACOTE_AUTORIZACAO_GATES_D_E.md`.

Este arquivo **não** autoriza canário, migration real, promoção 3080 ou merge.
Decisões §4 documentadas ≠ Gates D/E/F executados ou aprovados.

---

## 0. Gate C (fechado)

| Item | Estado |
|---|---|
| Resultado | **APROVADO** |
| Evidência | `docs/vps/evidence/gate-c-2026-09-24.txt` |
| Relatório | `docs/GATE_C_RESULTADO_2026-09-24.md` |
| MATCH DB | sim |
| Migrations DEV | 001–015; faltam 016–024 |
| Ressalva | `meta_parse=ERR` no host (sem node); script corrigido para parse via container |

---

## 1. SHAs e artefatos (consultar GitHub; não congelar cegamente)

| Papel | Valor na data desta nota | Como revalidar |
|---|---|---|
| `main` base Cursor | consultar `git rev-parse origin/main` | `git fetch origin main` |
| PR #34 HEAD | consultar `gh pr view 34` | |
| PR #33 HEAD (Codex) | observado `ceeb92e9…` (draft; revalidar) | `gh pr view 33` |
| Imagem oficial VPS 3080 | `erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3` | Gate C — **preservar** |
| Rede Docker | `supabase_default` | Gate C |
| Imagem canário futura | `erp-zuccaro-erp-api:comercial360-main-<MERGE_SHA8>` | só após merge #33 + build |

**Regra:** nunca construir imagem oficial a partir da branch feature. Digest efetivo
**AGUARDA BUILD APÓS MERGE** — não inventar valor.

---

## 2. Runtime / Auth

| Fonte | Runtime | Auth |
|---|---|---|
| VPS 3080 (fato) | `ERP-RUNTIME-07B` | `dev_headers` — **não** homologa PR #33 |
| Meta código PR #33 | `ERP-RUNTIME-08B` (`/api/v1/meta`) | critério canário: `supabase_user` |
| Default script canário | ainda pode divergir (`COMERCIAL-360-V1`) | **não** usar default antigo no Gate D |
| Decisão Codex | **`ERP-RUNTIME-08B`** | comprovar `supabase_user` na imagem/canário pós-merge |

---

## 3. Migrations

Lista: `docs/vps/migrations-candidatas-comercial360.txt` (espelho PR #33, sem SQL).

| Faixa | `main` | PR #33 | VPS Gate C |
|---|---|---|---|
| 001–015 | sim | sim | aplicadas 1× |
| 016–024 | não | sim (incl. 024 canais) | **ausentes** |

Migrator atual (`server/src/db/migrate.ts`): **uma invocação** aplica **todos** os
SQL pendentes da MAIN em ordem (transação por arquivo). Fatias `016–017` e
`018–024` = inventário/revisão, **não** duas execuções nem pausa após 017.

```bash
bash scripts/vps/gate-d-f-precheck.sh --from-gate-c-output docs/vps/evidence/gate-c-2026-09-24.txt \
  --candidate-list docs/vps/migrations-candidatas-comercial360.txt
# → missing_for_gate_e=016,017,018,019,020,021,022,023,024
```

---

## 4. Confirmações Codex — decisões de interface documentadas

Fonte: comentário na PR #34 + handoff PR #33 @ `ceeb92e9` (CI documental SUCCESS).
Estado: **decisão registrada**; execução operacional **ainda pendente**.
**Não** marca D/E/F como executados ou autorizados.

- [x] `EXPECTED_RUNTIME` = `ERP-RUNTIME-08B` (meta `/api/v1/meta` PR #33). Default `COMERCIAL-360-V1` do canary diverge — corrigir na #33 ou exigir variável explícita; **não** Gate D com default antigo.
- [x] Meta da imagem imutável deve publicar `auth.mode=supabase_user` (critério a **comprovar** pós-merge; 3080 atual permanece `dev_headers` / R07B).
- [x] Gate E: aplicar **uma vez** faltantes `016–024` da MAIN em ordem (migrator atual = uma invocação). Fatias `016–017` / `018–024` só para revisão. Backup novo + prechecks + parada em erro; `test:postgres` real antes de D.
- [x] Tag pós-merge: `comercial360-main-<MERGE_SHA8>` da MAIN. **DIGEST EFETIVO = AGUARDA BUILD APÓS MERGE** (pendente operacional; não inventar).
- [x] Identidade Auth sintética para smoke D: **pendente de gate Auth próprio** (`auth.users=0`; não reutilizar profiles sem prova). Segredos fora do Git.

### Pendências operacionais (não são checkboxes §4)

| Pendência | Estado |
|---|---|
| Digest/imagem canário | `PENDING_BUILD_AFTER_MERGE` |
| Auth sintético + profile vinculado | `PENDING_AUTH_GATE` |
| Gate E / D / F execução | **não iniciados** |
| 3080 | R07B preservada |

Cursor confirma (já): rede `supabase_default`, portas candidatas FREE no snapshot
Gate C, backup metadados `pre-gate-e-20260924-140304.sql` (integridade YES;
`restore_destructive=NOT_PERFORMED`; `AUTHORIZES_GATES_DEF=NO`), rollback R07B,
MATCH DB.
