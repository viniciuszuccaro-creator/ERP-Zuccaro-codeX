# Gate F — promoção 3080 (cartão)

**Status:** `EXECUTED_OK` · promoção + Auth + smoke 3080 + cleanup §E **OK** · tag `comercial360-main-894b0db8`.
**Gate F VPS:** **fechado**. Sem re-promover.

## Registro completo

```text
assinatura_formal=VINICIUS
opcao_digest=A
utc_merge=2026-09-25T16:11:21Z
merge_sha8=894b0db8
utc_mutation_ok_canary=2026-09-25T16:30:56Z
utc_promote=2026-09-25T16:35:34Z
utc_post_promote_smoke=2026-09-25T16:40:30Z
utc_cleanup=2026-09-25T16:47:44Z
official_image=erp-zuccaro-erp-api:comercial360-main-894b0db8
rollback_container=erp-api-dev-r07b-pre-f-20260925-163531
GATE_F_PROMOTE_STATUS=OK
GATE_F_POST_PROMOTE_SMOKE=OK
GATE_D_CLEANUP_STATUS=OK
EXECUTE_GATE_F=EXECUTED_OK
alter_3080=PERFORMED
auth_mode=supabase_user
expected_runtime=ERP-RUNTIME-08B
```

Evidências:
- mutação canário: `docs/vps/evidence/gate-f-mutation-smoke-ok-894b0db8-2026-09-25.txt`
- promoção: `docs/vps/evidence/gate-f-promote-ok-894b0db8-2026-09-25.txt`
- pós-promote 3080: `docs/vps/evidence/gate-f-post-promote-smoke-ok-3080-894b0db8-2026-09-25.txt`
- cleanup §E: `docs/vps/evidence/gate-f-cleanup-ok-2026-09-25.txt`

## Rollback (se necessário)

```bash
ROLLBACK_CONTAINER='erp-api-dev-r07b-pre-f-20260925-163531' \
OFFICIAL_CONTAINER='erp-api-dev' \
CONFIRM_ROLLBACK=YES \
  bash scripts/deploy/comercial360-rollback.sh
```

## Regras

- **Não** re-promover nem promover `2fc2fc80`.
- Rollback usa `erp-api-dev-r07b-pre-f-20260925-163531`.
- Segredos somente no cofre local.
