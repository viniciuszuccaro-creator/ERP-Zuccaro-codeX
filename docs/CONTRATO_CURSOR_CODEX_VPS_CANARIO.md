# Contrato Cursor ↔ Codex — VPS / canário / migrations

**Status:** `GATE C APROVADO — AGUARDA CONFIRMAÇÃO CODEX PARA D/E`
**Frente Cursor:** PR #34 `cursor/vps-hml-gate-c-legado-392b`
**Frente Codex:** PR #33 `codex/comercial-360` (draft; **não editada por esta frente**)
**Atualizado:** 2026-09-24 (pós evidência Web Console Gate C)

Pacote operacional: `docs/PACOTE_AUTORIZACAO_GATES_D_E.md`.

Este arquivo **não** autoriza canário, migration real, promoção 3080 ou merge.

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
| `main` base Cursor | `ca4171600cc30f9922c2f8b2ccb8b22d06aa6888` | `git fetch origin main && git rev-parse origin/main` |
| PR #34 HEAD | consultar `gh pr view 34` | |
| PR #33 HEAD (Codex) | `d073631a988c72ace83cbdd904bb50c2654c4c12` (+ posteriores) | `gh pr view 33` |
| Imagem oficial VPS 3080 | `erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3` | Gate C |
| Rede Docker | `supabase_default` | Gate C |
| Imagem canário futura | `erp-zuccaro-erp-api:comercial360-main-<sha8>` do **MERGE_SHA da main** | só após merge #33 |

**Regra:** nunca construir imagem oficial a partir da branch feature.

---

## 2. Runtime / Auth — proposta Cursor

| Fonte | Runtime | Auth |
|---|---|---|
| VPS 3080 (fato) | `ERP-RUNTIME-07B` | `dev_headers` |
| Meta código PR #33 | `ERP-RUNTIME-08B` | Bearer preparado; **não** homologado no DEV |
| Default script canário | `COMERCIAL-360-V1` | exige `supabase_user` |
| **Proposta Cursor** | **`ERP-RUNTIME-08B`** | imagem canário deve publicar `supabase_user` |

Usar `COMERCIAL-360-V1` contra meta `ERP-RUNTIME-08B` quebraria o canário.

`dev_headers` na 3080 **não** homologa Auth da PR #33.

---

## 3. Migrations

Lista: `docs/vps/migrations-candidatas-comercial360.txt` (espelho PR #33, sem SQL).

| Faixa | `main` | PR #33 | VPS Gate C |
|---|---|---|---|
| 001–015 | sim | sim | aplicadas 1× |
| 016–024 | não | sim (incl. 024 canais) | **ausentes** |

```bash
bash scripts/vps/gate-d-f-precheck.sh --from-gate-c-output docs/vps/evidence/gate-c-2026-09-24.txt \
  --candidate-list docs/vps/migrations-candidatas-comercial360.txt
# → missing_for_gate_e=016,017,018,019,020,021,022,023,024
```

---

## 4. Confirmações pedidas ao Codex

- [ ] `EXPECTED_RUNTIME` = `ERP-RUNTIME-08B` (ou meta alterada de forma coerente)
- [ ] Meta da imagem imutável terá `auth.mode=supabase_user`
- [ ] Estratégia Gate E: 016–024 juntas vs fatias
- [ ] Digest/tag pós-merge
- [ ] Identidade sintética Auth (sem segredo no Git) para smoke D

Cursor confirma (já): rede `supabase_default`, portas candidatas FREE no snapshot
Gate C, backup metadados, rollback R07B preservado, MATCH DB.
