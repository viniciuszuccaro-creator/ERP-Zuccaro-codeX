# Termo de autorização — Gates D / E / F

**Status preparado:** fatos, SHAs, ordem, efeitos, backup e rollback **preenchidos**.
**Em aberto:** somente autorização humana específica (§C) + assinatura.
Sem checkbox + assinatura do gate correspondente → **não executar**.

```bash
bash scripts/vps/go-nogo-def.sh
# GATE_E_READY / GATE_D_READY / GATE_F_READY — READY≠autorização
```

Pacote: `docs/PACOTE_DECISAO_GATES_D_E_F.md`.

Data (UTC) preparação Cursor: `2026-09-24T14:30:00Z`
Responsável (assinatura humana): _______________
PR funcional #33 HEAD: `ceeb92e99954b39d3137dde497208b0db1010869` (draft — revalidar)
PR infra #34 HEAD: `c370204e3bee3f2194854cb5c077070509cf28bd`
`main` observada: `ca4171600cc30f9922c2f8b2ccb8b22d06aa6888`
Evidência Gate C: `docs/vps/evidence/gate-c-2026-09-24.txt` (**APROVADO**)

---

## Fatos comprovados (Gate C)

| Fato | Valor |
|---|---|
| VPS | `srv1982741` |
| API oficial 3080 | `erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3` (**preservar até F**) |
| Health / ready | HTTP 200 |
| Rede | `supabase_default` |
| DB | MATCH `postgres` / `7686065785209937954` |
| Migrations VPS | 001–015 (1×); 016–024 ausentes |
| Auth 3080 | `dev_headers` (não homologa #33) |
| `auth.users` | 0 |

---

## A. Decisões técnicas (Codex §4 — documentadas)

| Decisão | Valor |
|---|---|
| `EXPECTED_RUNTIME` | `ERP-RUNTIME-08B` (não usar default `COMERCIAL-360-V1` no D) |
| `auth.mode` canário | critério `supabase_user` (comprovar pós-merge) |
| Gate E | **uma invocação** 016–024 da MAIN; fatias = revisão |
| Tag imagem | `comercial360-main-<MERGE_SHA8>` · digest `PENDING_BUILD_AFTER_MERGE` |
| Auth sintético | `PENDING_AUTH_GATE` (gate próprio) |
| Rede / portas | `supabase_default` · revalidar FREE no instante do D |

---

## B. Backup e rollback (preenchidos)

| Item | Valor | Confirmação humana |
|---|---|---|
| Backup | `pre-gate-e-20260924-140304.sql` bytes=`390275` sha256=`e72ca99b453fa6b060b5264f636794b3a601202c18e4185deb12f0020cae3f80` | [ ] |
| Integridade | header/tail/sha256/mode600=YES · umask 0077 | [ ] |
| Restore isolado | `NOT_PERFORMED` (aviso Gate E) | [ ] |
| Rollback API R07B | dry-run OK · imagem `ca0bc5f3` preservada | [ ] |
| Rollback schema | restore autorizado do pre-gate-e ≠ rollback API | [ ] |

---

## C. Autorizações explícitas (ÚNICOS campos em aberto para execução)

Marcar **apenas** o autorizado agora. Sem marca = **não executar**.
`GATE_*_READY=YES` **não** substitui esta seção.

- [ ] **Merge PR #33** na `main` (após undraft/review; não é Gate E)
- [ ] **Gate E** — aplicar 016–024 da **main** pós-merge (uma invocação)
- [ ] **Gate D** — canário isolado + smoke (`EXPECTED_RUNTIME` + Auth sintético)
- [ ] **Gate F** — promoção 3080 (exige D OK + mesmo digest)

Assinatura responsável: _______________
Data/hora: _______________

---

## D. Sequência concreta para decisão (após este termo) — ordem e efeitos

```text
1) Merge #33 → main   | efeito: código+migrations 016-024 na MAIN; 3080 inalterada
2) Gate E             | efeito: schema DEV 016-024; R07B coexiste; se falha mid-way → PARAR
3) test:postgres real | efeito: prova schema; 0 fail/skip
4) Build imagem MAIN  | efeito: tag comercial360-main-<sha8>; digest registrado
5) Gate Auth          | efeito: identidade+profile sintéticos (fora do Git)
6) Gate D             | efeito: canário ≠3080; smoke Bearer; 3080 ainda R07B
7) Gate F             | efeito: 3080 → imagem do canário; rollback API ≠ schema
```

### Recuperação se migration N falhar após 016…N−1

Parar; não D/F; listar `schema_migrations`; forward-fix na MAIN **ou** restore isolado do pre-gate-e (autorizado); 3080 permanece R07B.

### Intervalo E→D (compatibilidade R07B)

3080 continua R07B/`dev_headers` com schema novo. Observar health/ready. Não promover. Se R07B quebrar → restore/forward-fix antes de D.

---

## E. Proibições

Não aplicar a partir de `codex/comercial-360` sem merge.
Não usar `dev_headers` como prova de Auth.
Não apagar backups/rollback.
Não commitar dump/`.env`/segredos.
Não alterar 3080 fora do Gate F autorizado.
`READY` / `GO_NOGO=YES_PENDING_HUMAN_FINAL` **não** autorizam execução.
