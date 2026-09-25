# Gate F — promoção 3080 (cartão)

**Status:** `EXECUTED_OK` · promoção + Auth + smoke na 3080 **OK** (`16:40:30Z`) · tag `comercial360-main-894b0db8`.
**Próximo (opcional):** cleanup §E da identidade sintética. Sem re-promover.

## Autorização + merge + canário + promoção + pós-smoke

```text
assinatura_formal=VINICIUS
opcao_digest=A
utc_merge=2026-09-25T16:11:21Z
merge_sha8=894b0db8
GATE_F_BUILD_CANARY=OK
utc_mutation_ok_canary=2026-09-25T16:30:56Z
utc_promote=2026-09-25T16:35:34Z
utc_post_promote_smoke=2026-09-25T16:40:30Z
official_image=erp-zuccaro-erp-api:comercial360-main-894b0db8
rollback_container=erp-api-dev-r07b-pre-f-20260925-163531
GATE_F_PROMOTE_STATUS=OK
GATE_F_POST_PROMOTE_SMOKE=OK
AUTH_SYNTHETIC_STATUS=OK
GATE_D_MUTATION_SMOKE=OK
EXECUTE_GATE_F=EXECUTED_OK
alter_3080=PERFORMED
auth_mode=supabase_user
expected_runtime=ERP-RUNTIME-08B
```

Evidências:
- mutação canário: `docs/vps/evidence/gate-f-mutation-smoke-ok-894b0db8-2026-09-25.txt`
- promoção: `docs/vps/evidence/gate-f-promote-ok-894b0db8-2026-09-25.txt`
- pós-promote 3080: `docs/vps/evidence/gate-f-post-promote-smoke-ok-3080-894b0db8-2026-09-25.txt`

## Cleanup §E (opcional)

```bash
cd /opt/erp-zuccaro
CONFIRM_GATE_D_CLEANUP=YES \
SYNTH_EMAIL='gate-d.synth@dev.synthetic.local' \
  bash scripts/vps/gate-d-cleanup-auth-synthetic.sh
```

Colar só `PASTE_TO_GIT` (sem senha/token/UUID).

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
