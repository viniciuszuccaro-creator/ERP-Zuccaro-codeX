# Pacote de decisão por gate — D / E / F (sem execução)

## Distinção obrigatória de estado

| Estado | Significado | Valor atual |
|---|---|---|
| `READY_FOR_REVIEW` | Pacote técnico pronto para humano revisar | **SIM** (`DECISION_STATE=READY_FOR_REVIEW`) |
| `AUTHORIZED` | Checkbox + assinatura no termo §C | **NÃO** (`AUTHORIZATION=NOT_GRANTED`) |
| `EXECUTED` | Merge / Gate E / D / F / 3080 realizados | **NÃO** (`EXECUTED=NO`) |

`GATE_*_READY=YES` **nunca** autoriza nem executa.

**Integração simulada publicada em** `cursor/integracao-sim-33-34-392b` (main intocada).

```bash
bash scripts/vps/go-nogo-def.sh
```

---

## 1. Revisão PR #33 e PR #34 (sem merge na main)

| PR | Branch | Tip | Draft | mergeable | CI | Conflitos vs main |
|---|---|---|---|---|---|---|
| #33 | `codex/comercial-360` | `ceeb92e9…` | sim | MERGEABLE/CLEAN | SUCCESS | nenhum |
| #34 | `cursor/vps-hml-gate-c-legado-392b` | tip atual | sim | MERGEABLE | ver CI do tip | nenhum |
| `main` | — | `ca417160…` | — | — | — | base |

**Simulação de integração #33 → #34** (branch `cursor/integracao-sim-33-34-392b`, **não** altera `main`):
resolve conflito previsto em `STATUS_DO_PROJETO.md` preservando topo Cursor + handoff Codex. Evidência em `docs/vps/evidence/integracao-sim-33-34.txt`.

Ordem real (só após AUTHORIZED): undraft+merge #33 → merge #34 (opcional) → Gate E da **main** pós-merge.

---

## 2. Prontidão por gate (comprovada)

| Gate | READY | Motivo principal |
|---|---|---|
| **E** | **NO** | `main_missing_migrations_016_024` (016–024 ausentes de `origin/main`) |
| **D** | **NO** | digest `PENDING_BUILD_AFTER_MERGE` + Auth `PENDING_AUTH_GATE` + schema E |
| **F** | **NO** | D pendente + digest + 3080 R07B |

Pendências **reais** D/F (não circular para E): digest pós-merge; Auth sintético.

Anti-circular: digest/Auth **não** entram em `gate_e_blockers`.
Fonte Gate E: 016–024 **na main** (comprovado via `git ls-tree`); ausência = `main_migrations_016_024=PENDING_ABSENT`.

---

## 3. Migrations 016–024

Presentes na PR #33; **ausentes** em `main` e na VPS (001–015 1×).

Migrator: uma invocação, uma TX por arquivo. Fatias 016–017 / 018–024 = revisão, não duas execuções.

Maior risco residual: **018** (ALTER `produtos` + CHECKs).

---

## 4. Compatibilidade R07B × schema 016–024 (sintético)

Prova em PGlite (`server/tests/r07b-schema-016-024-compat.test.ts`):

- Aplica 001–024 (fonte `origin/codex/comercial-360` se checkout local não tiver 016+)
- Confirma colunas 018 em `produtos` (`workflow_status`, `multiplo_venda`, …) com defaults
- SELECT/UPDATE legado de Produto (estilo R07B) OK
- `/health` + `/ready` HTTP 200
- Tabelas 016/017/024 existem; R07B as ignora
- **Resultado:** `R07B_SCHEMA_COMPAT=OK` · **não** altera 3080/VPS

---

## 5. Restore isolado do backup pre-Gate E

Procedimento validado com dump **sintético** (`scripts/vps/validate-isolated-restore.sh --self-test`):

- Alvo: PGlite isolado · `dev_database_touched=NO` · `vps_dump_used=NO`
- Evidência: `docs/vps/evidence/restore-isolated-validation.txt`
- Dump real VPS (`pre-gate-e-20260924-140304.sql`) **não** versionado; **não** restaurado sobre DEV

---

## 6. Backup / rollback (fatos)

| Item | Valor |
|---|---|
| Backup VPS | `pre-gate-e-20260924-140304.sql` bytes=`390275` sha256=`e72ca99b…cae3f80` |
| Integridade | header/tail/sha256/mode600=YES |
| Restore isolado | `VALIDATED_SYNTHETIC` (procedimento); dump VPS ainda não refeito em isolado |
| Rollback API | imagem `runtime07b-main-ca0bc5f3` (dry-run OK) |

---

## 7. Decisão pedida (termo §C — ainda em aberto)

Não pedir assinatura até este pacote estar revisado. Campos em aberto:

- [ ] Autorizo merge #33
- [ ] Autorizo Gate E
- [ ] Autorizo Gate D
- [ ] Autorizo Gate F

Assinatura: aberta · `AUTHORIZATION=NOT_GRANTED` · `EXECUTED=NO`
