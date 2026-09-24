# Termo de autorização — Gates D / E / F

**Status:** Gate E **EXECUTADO** · digest imagem **REGISTERED** · Gate Auth/D/F **aguardam** assinatura.
Estados: `READY_FOR_REVIEW` ≠ `AUTHORIZED` ≠ `EXECUTED`. `GATE_*_READY` não autoriza.
Sem checkbox do gate + **assinatura formal** do responsável → **não executar**.

```bash
bash scripts/vps/go-nogo-def.sh
# GATE_E_READY=YES · image_digest=REGISTERED · GATE_D_READY=NO (auth_synthetic)
```

Pacote: `docs/PACOTE_DECISAO_GATES_D_E_F.md`.
Cartão Gate E: `docs/GATE_E_MIGRATIONS_CARTAO.md`.
Checklist Auth/D: `docs/GATE_D_SMOKE_AUTH_CHECKLIST.md`.

Data (UTC) atualização Cursor: `2026-09-24T20:12:00Z`
Responsável (assinatura humana): VINICIUS
Merge integração: PR **#35** → `main` @ `2fc2fc80adb9ca876be6ca3d29aab49305839e8a`
`main` observada: `2fc2fc80adb9ca876be6ca3d29aab49305839e8a`
Evidência Gate C: `docs/vps/evidence/gate-c-2026-09-24.txt` (**APROVADO**)
Gate E: `docs/vps/evidence/gate-e-webconsole-2026-09-24.txt` (**OK**)
Digest: `docs/vps/evidence/image-digest-comercial360-latest.txt` (**REGISTERED**)

---

## Fatos comprovados (Gate C + pós-merge #35 + Gate E)

| Fato | Valor |
|---|---|
| VPS | `srv1982741` |
| API oficial 3080 | imagem R07B `runtime07b-main-ca0bc5f3` (**preservar**; sem Gate F) |
| Health / ready 3080 | HTTP 200 |
| Rede | `supabase_default` |
| DB DEV | `postgres` · schema **001–024** (`GATE_E_STATUS=OK`) |
| `test:postgres` DEV | OK (fail=0) |
| Imagem canário candidata | `erp-zuccaro-erp-api:comercial360-main-2fc2fc80` · digest REGISTERED |
| Auth 3080 | `dev_headers` (não homologa Gate D) |
| Auth sintético | **ainda não provisionado** (`PENDING_AUTH_GATE`) |
| `GATE_D_READY` | **NO** — falta Auth + autorização §C |

---

## A. Decisões técnicas

| Decisão | Valor |
|---|---|
| Gate E | **EXECUTADO** — 016–024 no DEV |
| Imagem canário | tag `comercial360-main-2fc2fc80` · build feito · **não** iniciada |
| Gate Auth | identidade **somente sintética** no Supabase Auth self-hosted + profile ERP sintético; segredos **fora do Git**; revogar após teste |
| Gate D | canário porta ≠3080 · `EXPECTED_RUNTIME=ERP-RUNTIME-08B` · `auth.mode=supabase_user` · smoke checklist |
| Gate F / 3080 | **não** nesta rodada até D APROVADO + termo F |

---

## B. Backup e rollback

| Item | Valor | Confirmação |
|---|---|---|
| Backup pré-Gate E | `pre-gate-e-20260924-174755.sql` · sha `83a9e97d…` | [x] |
| Dump no GitHub | **proibido** | — |
| Rollback API R07B | imagem `ca0bc5f3` na 3080 preservada | [x] evidência |
| Rollback canário | `comercial360-rollback.sh` dry-run (quando D autorizado) | [ ] |

---

## C. Autorizações explícitas

Marcar **apenas** o autorizado. Sem marca = **não executar**.

- [ ] ~~Merge PR #33~~ — **obsoleto**; merge via **#35**
- [x] **Gate E** — 016–024 no DEV @ `2fc2fc80…` — **EXECUTADO** (`GATE_E_STATUS=OK`)
- [ ] **Gate Auth sintético** — provisionar identidade de teste + vincular `profiles.auth_user_id` (Grupo/Empresa sintéticos; RBAC mínimo Orçamento/Pedido; **não** reutilizar profiles sem prova; credenciais fora do Git; revogar após smoke)
- [ ] **Gate D** — canário `comercial360-main-2fc2fc80` em porta ≠3080 + smoke meta + smoke Bearer (checklist); **exige** Gate Auth OK
- [ ] **Gate F** — **NÃO autorizado** (3080 inalterada)

### Registro Gate E (já assinado)

```text
utc_assinatura_formal=2026-09-24
assinatura_formal=VINICIUS
checkbox_gate_e=MARKED
GATE_E_STATUS=OK
```

Assinatura responsável (Gate E): VINICIUS
Data/hora (UTC): 24/09/2026

### Registro Gate Auth / Gate D (aguardar assinatura)

```text
utc_registro_pedido=2026-09-24T20:12:00Z
canal=Cursor_agent_chat
texto_pedido=
  "Autorizo o Gate Auth sintético no DEV (identidade de teste + profile
   vinculado; segredos fora do Git; revogação após smoke) e, em seguida,
   o Gate D (canário comercial360-main-2fc2fc80 + smoke). Não autorizo
   Gate F nem alteração da 3080."
checkbox_gate_auth=PENDING
checkbox_gate_d=PENDING
assinatura_formal=PENDING_HUMAN
EXECUTE_AUTH=NO
EXECUTE_GATE_D=NO
gate_f=NOT_AUTHORIZED
alter_3080=NOT_AUTHORIZED
```

Assinatura responsável (Auth / D): PENDING_HUMAN
Data/hora (UTC): PENDING_HUMAN

**Estado operacional:** E OK · digest REGISTERED · Auth/D **WAITING_SIGNATURE** · F/3080 bloqueados.

---

## D. Sequência concreta para decisão (Auth → D, após assinatura §C)

```text
1) Gate Auth: provisionar user Auth sintético (Supabase self-hosted)
2) Vincular UUID a profile ERP sintético ativo (Grupo/Empresa sintéticos)
3) Evidência sanitizada: auth_users_count>=1 · profile_com_auth=1 · AUTH_SYNTHETIC_STATUS=OK
   (sem e-mail/senha/token/UUID no Git)
4) Subir canário: IMAGE=...comercial360-main-2fc2fc80 · porta ≠3080 · ERP_AUTH_MODE=supabase_user
5) comercial360-smoke.sh + smoke Bearer (checklist §B/§C)
6) Revogar/desabilitar identidade de teste; evidência Gate D sanitizada
7) 3080 permanece R07B até Gate F autorizado
```

Detalhe operacional: `docs/GATE_D_SMOKE_AUTH_CHECKLIST.md`.

---

## E. Proibições

Não inventar assinatura · não Auth com dados reais · não token/senha no Git · não canário sem Auth · não porta 3080 · não Gate F nesta rodada · não `dev_headers` como prova de Auth.
