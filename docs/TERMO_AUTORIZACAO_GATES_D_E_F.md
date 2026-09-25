# Termo de autorização — Gates D / E / F

**Status:** Gate E/D **OK** · Gate F **EXECUTED_OK** · promoção 3080 + Auth + smoke OK (`16:40:30Z`) · tag `comercial360-main-894b0db8` · rollback `erp-api-dev-r07b-pre-f-20260925-163531`.
Estados: `READY_FOR_REVIEW` ≠ `AUTHORIZED` ≠ `EXECUTED`. `GATE_*_READY` não autoriza.
Sem checkbox do gate + **assinatura formal** do responsável → **não executar**.

```bash
bash scripts/vps/go-nogo-def.sh
# GATE_E_READY=YES · image_digest=REGISTERED · auth_synthetic=OK · GATE_D_READY depende go-nogo
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
| API oficial 3080 | `comercial360-main-894b0db8` (**Gate F EXECUTED_OK** · `16:35:34Z`) |
| Health / ready 3080 | HTTP 200 (antes e depois da promoção) |
| Rollback 3080 | `erp-api-dev-r07b-pre-f-20260925-163531` (ex-R07B `ca0bc5f3`) |
| Rede | `supabase_default` |
| DB DEV | `postgres` · schema **001–024** (`GATE_E_STATUS=OK`) |
| `test:postgres` DEV | OK (fail=0) |
| Imagem promovida | `erp-zuccaro-erp-api:comercial360-main-894b0db8` · runtime `ERP-RUNTIME-08B` |
| Auth 3080 | `supabase_user` · pós-smoke **OK** (`16:40:30Z`) |
| Auth sintético | **OK** na 3080 pós-promote (`auth_users=1` · `profiles_com_auth=1`) |
| `GATE_D_READY` | Gate D completo · Gate F promoção + pós-smoke **OK** |

---

## A. Decisões técnicas

| Decisão | Valor |
|---|---|
| Gate E | **EXECUTADO** — 016–024 no DEV |
| Imagem canário | tag `comercial360-main-2fc2fc80` · build feito · **não** iniciada |
| Gate Auth | identidade **somente sintética** no Supabase Auth self-hosted + profile ERP sintético; segredos **fora do Git**; revogar após teste |
| Gate D | canário porta ≠3080 · `EXPECTED_RUNTIME=ERP-RUNTIME-08B` · `auth.mode=supabase_user` · smoke checklist |
| Gate F / 3080 | **EXECUTED_OK** · merge #37 · promoção `894b0db8` · `alter_3080=PERFORMED` |

---

## B. Backup e rollback

| Item | Valor | Confirmação |
|---|---|---|
| Backup pré-Gate E | `pre-gate-e-20260924-174755.sql` · sha `83a9e97d…` | [x] |
| Dump no GitHub | **proibido** | — |
| Rollback API R07B | container `erp-api-dev-r07b-pre-f-20260925-163531` (imagem `ca0bc5f3`) | [x] pós-Gate F |
| Rollback canário | `comercial360-rollback.sh` dry-run (quando D autorizado) | [ ] |

---

## C. Autorizações explícitas

Marcar **apenas** o autorizado. Sem marca = **não executar**.

- [ ] ~~Merge PR #33~~ — **obsoleto**; merge via **#35**
- [x] **Gate E** — 016–024 no DEV @ `2fc2fc80…` — **EXECUTADO** (`GATE_E_STATUS=OK`)
- [x] **Gate Auth sintético** — provisionar identidade de teste + vincular `profiles.auth_user_id` (Grupo/Empresa sintéticos; RBAC mínimo Orçamento/Pedido; **não** reutilizar profiles sem prova; credenciais fora do Git; revogar após smoke)
- [x] **Gate D** — canário em porta ≠3080 + smoke meta + Bearer + browser URL + mutação Orçamento→Pedido OK (`comercial360-gate-d-2b45292e` from-checkout · `GATE_D_MUTATION_SMOKE=OK` · 14:37Z); digest MAIN `2fc2fc80` permanece REGISTERED para promoção futura
- [x] **Gate F** — promoção 3080 · **AUTHORIZED_OPTION_A** (VINICIUS · 2026-09-25) · merge #37 **OK** (`894b0db8`) · **EXECUTED_OK** (`16:35:34Z`)

### Registro Gate F opção A (assinado 2026-09-25 · executado)

```text
utc_registro=2026-09-25T15:37:00Z
canal=Cursor_agent_chat
texto_autorizacao_humana=
  "Autorizo Gate F (promoção 3080) na opção A:
   merge do fix Orçamento→Pedido na main, build comercial360-main-<MERGE_SHA8>,
   re-smoke mutação no canário com essa tag, depois promover essa imagem.
   Não autorizo promoção da tag MAIN antiga 2fc2fc80 sem o fix."
assinatura_formal=VINICIUS
data_assinatura_utc=2026-09-25
checkbox_gate_f=MARKED
opcao_digest=A
utc_merge=2026-09-25T16:11:21Z
pr_merged=#37
merge_sha=894b0db8f7583137204e1026c6eee26475c7025c
merge_sha8=894b0db8
utc_mutation_ok_main_tag=2026-09-25T16:30:56Z
utc_promote=2026-09-25T16:35:34Z
promote_image=erp-zuccaro-erp-api:comercial360-main-894b0db8
official_image_before=erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3
official_image_after=erp-zuccaro-erp-api:comercial360-main-894b0db8
rollback_container=erp-api-dev-r07b-pre-f-20260925-163531
GATE_F_PROMOTE_STATUS=OK
EXECUTE_GATE_F=EXECUTED_OK
alter_3080=PERFORMED
health_3080_after=200
auth_mode=supabase_user
expected_runtime=ERP-RUNTIME-08B
evidence=docs/vps/evidence/gate-f-promote-ok-894b0db8-2026-09-25.txt
utc_post_promote_smoke=2026-09-25T16:40:30Z
GATE_F_POST_PROMOTE_SMOKE=OK
AUTH_SYNTHETIC_STATUS=OK
GATE_D_MUTATION_SMOKE=OK
evidence_post_smoke=docs/vps/evidence/gate-f-post-promote-smoke-ok-3080-894b0db8-2026-09-25.txt
```

Assinatura responsável (Gate F opção A): VINICIUS
Data/hora (UTC): 25/09/2026

**Próximo (opcional):** cleanup §E da identidade sintética. Gate F VPS **fechado**. Sem re-promoção.

### Registro Gate E (já assinado)

```text
utc_assinatura_formal=2026-09-24
assinatura_formal=VINICIUS
checkbox_gate_e=MARKED
GATE_E_STATUS=OK
```

Assinatura responsável (Gate E): VINICIUS
Data/hora (UTC): 24/09/2026

### Registro Gate Auth / Gate D (assinado)

```text
utc_registro_pedido=2026-09-24T20:12:00Z
utc_assinatura_formal=2026-09-24 (informada: 24/09/2026)
canal=Cursor_agent_chat
texto_autorizacao_humana=
  "Autorizo: Gate Auth sintético e Gate D. Não autorizo Gate F / 3080."
checkbox_gate_auth=MARKED
checkbox_gate_d=MARKED
assinatura_formal=VINICIUS
EXECUTE_AUTH=EXECUTED_OK
EXECUTE_GATE_D=EXECUTED_OK
GATE_D_MUTATION_SMOKE=OK
utc_mutation_ok=2026-09-25T14:37:07Z
GATE_D_NEGATIVES_SMOKE=OK
utc_negatives_ok=2026-09-25T15:13:45Z
GATE_D_CLEANUP_STATUS=OK
utc_cleanup_ok=2026-09-25T15:28:17Z
gate_f=EXECUTED_OK
merge_sha8=894b0db8
alter_3080=PERFORMED
utc_promote=2026-09-25T16:35:34Z
AUTH_SYNTHETIC_STATUS=OK
utc_auth_ok=2026-09-25T12:07:49Z
```

Assinatura responsável (Auth / D): VINICIUS
Data/hora (UTC): 24/09/2026

**Estado operacional:** E/D OK · Gate F **EXECUTED_OK** · 3080 em `comercial360-main-894b0db8` · pós-smoke OK · rollback R07B preservado.
**Ordem restante (opcional):** cleanup §E da identidade sintética.

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

Não inventar assinatura · não Auth com dados reais · não token/senha no Git · não canário sem Auth · não promover 3080 sem checkbox Gate F + texto A/B assinado · não `dev_headers` como prova de Auth · não promover MAIN `2fc2fc80` sem o fix do map Orçamento.
