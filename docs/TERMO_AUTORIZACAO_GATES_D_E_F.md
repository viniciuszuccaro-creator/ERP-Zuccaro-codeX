# Termo de autorização — Gates D / E / F

**Status:** fatos atualizados pós-merge `#35` (`main` = `2fc2fc80…`).
Estados: `READY_FOR_REVIEW` ≠ `AUTHORIZED` ≠ `EXECUTED`. `GATE_*_READY` não autoriza.
Sem checkbox do gate + **assinatura formal** do responsável → **não executar**.

```bash
bash scripts/vps/go-nogo-def.sh
# GATE_E_READY=YES (016–024 na main) — READY≠autorização de execução
```

Pacote: `docs/PACOTE_DECISAO_GATES_D_E_F.md`.
Cartão Gate E: `docs/GATE_E_MIGRATIONS_CARTAO.md`.

Data (UTC) atualização Cursor: `2026-09-24T17:45:00Z`
Responsável (assinatura humana): VINICIUS
Merge integração: PR **#35** → `main` @ `2fc2fc80adb9ca876be6ca3d29aab49305839e8a`
  (contém #33 `ceeb92e9…` + #34 `f41d87e5…`)
`main` observada: `2fc2fc80adb9ca876be6ca3d29aab49305839e8a`
Evidência Gate C: `docs/vps/evidence/gate-c-2026-09-24.txt` (**APROVADO**)
Restore isolado prévio: `RESTORE_ISOLATED_DB_STATUS=OK` (`docs/vps/evidence/restore-isolated-db-pending.txt`)
  — dump **não** versionado (`dump_committed_to_git=NO`)

---

## Fatos comprovados (Gate C + pós-merge #35)

| Fato | Valor |
|---|---|
| VPS | `srv1982741` |
| API oficial 3080 | imagem R07B `runtime07b-main-ca0bc5f3` (**preservar**; sem Gate F) |
| Health / ready (Gate C) | HTTP 200 |
| Rede | `supabase_default` |
| DB DEV | `postgres` (cluster Gate C) |
| Migrations na **main** | **001–024 presentes** (pós-#35) |
| Migrations no **DEV** (antes do Gate E) | 001–015 (1×); 016–024 **ainda a aplicar** |
| Auth 3080 | `dev_headers` (não é Gate D/F) |
| `GATE_E_READY` | **YES** (código na main; não autoriza apply sozinho) |

---

## A. Decisões técnicas

| Decisão | Valor |
|---|---|
| Gate E | **uma invocação** do migrator canônico (`server`: `npm run migrate`) — aplica pendentes 016–024 em ordem; **1 TX por arquivo** |
| Escopo autorizado (quando §C Gate E + assinatura) | somente DEV; main pin `2fc2fc80adb9ca876be6ca3d29aab49305839e8a` |
| Gate D / F / 3080 | **não autorizados** nesta rodada |
| Tag imagem / canário | fora de escopo |

---

## B. Backup e rollback

| Item | Valor | Confirmação humana |
|---|---|---|
| Backup isolado (prova anterior) | restore OK; sha `e72ca99b…` / bytes `390275` | [x] evidência Git |
| Backup **novo** imediatamente antes do apply | **obrigatório** via `create-pre-gate-e-backup.sh` (ainda não colado nesta autorização) | [ ] |
| Integridade do backup novo | header/tail/sha256/mode600 | [ ] |
| Dump no GitHub | **proibido** | — |
| Rollback API R07B | imagem `ca0bc5f3` preservada; sem promoção 3080 | [ ] |
| Rollback schema | restore do backup novo (autorizado à parte) ≠ rollback API | [ ] |

---

## C. Autorizações explícitas

Marcar **apenas** o autorizado. Sem marca = **não executar**.
`GATE_*_READY=YES` **não** substitui esta seção.

- [ ] ~~Merge PR #33~~ — **obsoleto**; merge feito via **#35** em `2fc2fc80…`
- [x] **Gate E** — aplicar 016–024 da **main** `@2fc2fc80adb9ca876be6ca3d29aab49305839e8a` no DEV (uma invocação)
- [ ] **Gate D** — **NÃO autorizado**
- [ ] **Gate F** — **NÃO autorizado** (3080 inalterada)

### Registro de autorização (chat Cursor)

```text
utc_registro_autorizacao=2026-09-24T17:35:00Z
utc_assinatura_formal=2026-09-24 (informada: 24/09/2026)
canal=Cursor_agent_chat
texto_autorizacao_humana=
  "Autorizo o Gate E no DEV, limitado às migrations 016–024 da main no commit
   2fc2fc80adb9ca876be6ca3d29aab49305839e8a. Não autorizo Gate D, Gate F nem
   alteração da 3080."
checkbox_gate_e=MARKED
assinatura_formal=VINICIUS
EXECUTE_GATE_E=AUTHORIZED_PENDING_NEW_BACKUP_AND_WEBCONSOLE
gate_d=NOT_AUTHORIZED
gate_f=NOT_AUTHORIZED
alter_3080=NOT_AUTHORIZED
```

Assinatura responsável: VINICIUS
Data/hora (UTC): 24/09/2026

**Estado operacional (2026-09-24):** backup OK · migrate 016–024 **aplicado** no DEV ·
`test:postgres` ainda pendente (falhou por `tsx`/devDeps; cartão §5 corrigido) ·
3080 permanece R07B · D/F **não** autorizados.

---

## D. Sequência concreta para decisão (após este termo) — ordem e efeitos

```text
0) Assinatura formal neste termo (§C) + backup novo validado
1) Web Console: main @ 2fc2fc80 · DB DEV = postgres · R07B image preservada
2) create-pre-gate-e-backup.sh → colar PASTE_TO_GIT (sem dump no Git)
3) Pré-check / rollback-dry-run R07B
4) Gate E: migrator canônico uma vez (host sem npm → docker run efêmero +
   volume migrations @2fc2fc80; ver cartão §3; 1 TX/arquivo; sem tocar 3080)
5) Conferir 016–024 cada 1× em schema_migrations
6) npm run test:postgres no Postgres DEV real
7) /health /ready + ops R07B na 3080 (somente leitura/smoke; sem troca de imagem)
8) Evidência sanitizada no GitHub
```

Se migration N falhar após 016…N−1: **parar**; listar `schema_migrations`; sem canário; 3080 permanece R07B.

---

## E. Proibições

Não Gate D/F · não alterar 3080 · não canário · não commitar dump/`.env`/segredos · não aplicar a partir de branch feature · não inventar assinatura.
