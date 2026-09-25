# Gate F — promoção 3080 (cartão)

**Status:** `EXECUTED_OK` · promoção 3080 concluída (`16:35:34Z`) com `comercial360-main-894b0db8`.
**Próximo:** re-provision Auth sintético + smoke de mutação na **3080** (não re-promover).

## Autorização + merge + canário + promoção

```text
assinatura_formal=VINICIUS
opcao_digest=A
utc_merge=2026-09-25T16:11:21Z
merge_sha8=894b0db8
GATE_F_BUILD_CANARY=OK
GATE_D_MUTATION_SMOKE=OK
utc_mutation_ok=2026-09-25T16:30:56Z
utc_promote=2026-09-25T16:35:34Z
canary_image=erp-zuccaro-erp-api:comercial360-main-894b0db8
official_image_before=erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3
official_image_after=erp-zuccaro-erp-api:comercial360-main-894b0db8
rollback_container=erp-api-dev-r07b-pre-f-20260925-163531
GATE_F_PROMOTE_STATUS=OK
EXECUTE_GATE_F=EXECUTED_OK
alter_3080=PERFORMED
health_3080_after=200
auth_mode=supabase_user
expected_runtime=ERP-RUNTIME-08B
```

Evidências:
- mutação canário: `docs/vps/evidence/gate-f-mutation-smoke-ok-894b0db8-2026-09-25.txt`
- promoção: `docs/vps/evidence/gate-f-promote-ok-894b0db8-2026-09-25.txt`

## Pós-promoção (Auth + smoke na 3080) — executar agora

```bash
cd /opt/erp-zuccaro
git fetch origin cursor/gate-f-pos-merge-a-392b && git checkout cursor/gate-f-pos-merge-a-392b
git pull origin cursor/gate-f-pos-merge-a-392b

SYNTH_PASS="$(openssl rand -base64 24)"
SYNTH_EMAIL='gate-d.synth@dev.synthetic.local'
SYNTH_EMAIL="$SYNTH_EMAIL" SYNTH_PASS="$SYNTH_PASS" \
  bash scripts/vps/provision-gate-d-auth-synthetic.sh

CANARY_PORT='3080' SYNTH_EMAIL="$SYNTH_EMAIL" SYNTH_PASS="$SYNTH_PASS" \
  bash scripts/vps/gate-d-smoke-mutation-orc-ped.sh

unset SYNTH_PASS
```

Esperado: `AUTH_SYNTHETIC_STATUS=OK` · `http_token=200` · `orc_create=201` · `ped_convert=201` · `ped_convert_dup=409` · `GATE_D_MUTATION_SMOKE=OK` · meta 3080 `ERP-RUNTIME-08B` / `supabase_user`.

Colar só o bloco `PASTE_TO_GIT` (sem senha/token/UUID).

## Rollback (se necessário)

```bash
ROLLBACK_CONTAINER='erp-api-dev-r07b-pre-f-20260925-163531' \
OFFICIAL_CONTAINER='erp-api-dev' \
CONFIRM_ROLLBACK=YES \
  bash scripts/deploy/comercial360-rollback.sh
```

## Regras

- **Não** re-promover nem promover `2fc2fc80`.
- Rollback usa o container `erp-api-dev-r07b-pre-f-20260925-163531`.
- Segredos somente no cofre local.
