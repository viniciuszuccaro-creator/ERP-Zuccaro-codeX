# Gate F — promoção 3080 (cartão)

**Status:** `AUTHORIZED_OPTION_A` · `WAITING_PROMOTE` — mutação OK em `comercial360-main-894b0db8` (`16:30:56Z`).  
**EXECUTED:** **NÃO** até `CONFIRM_GATE_F_PROMOTE=YES`.

## Autorização + merge + canário

```text
assinatura_formal=VINICIUS
opcao_digest=A
utc_merge=2026-09-25T16:11:21Z
merge_sha8=894b0db8
GATE_F_BUILD_CANARY=OK
GATE_D_MUTATION_SMOKE=OK
utc_mutation_ok=2026-09-25T16:30:56Z
canary_image=erp-zuccaro-erp-api:comercial360-main-894b0db8
EXECUTE_GATE_F=AUTHORIZED_WAITING_PROMOTE
```

Evidência mutação: `docs/vps/evidence/gate-f-mutation-smoke-ok-894b0db8-2026-09-25.txt`.

## Promoção 3080 (agora)

```bash
cd /opt/erp-zuccaro
git fetch origin cursor/gate-f-pos-merge-a-392b && git checkout cursor/gate-f-pos-merge-a-392b
git pull origin cursor/gate-f-pos-merge-a-392b

# Dry-run rollback (opcional, leitura)
ROLLBACK_CONTAINER='erp-api-dev' OFFICIAL_CONTAINER='erp-api-dev' CONFIRM_ROLLBACK=NO \
  bash scripts/deploy/comercial360-rollback.sh || true

CONFIRM_GATE_F_PROMOTE=YES \
IMAGE='erp-zuccaro-erp-api:comercial360-main-894b0db8' \
ERP_DOCKER_NETWORK='supabase_default' \
  bash scripts/vps/gate-f-option-a-promote-3080.sh
```

Esperado: `GATE_F_PROMOTE_STATUS=OK` · `official_image_after=...894b0db8` · `rollback_container=erp-api-dev-r07b-pre-f-…` · meta 3080 `ERP-RUNTIME-08B` / `supabase_user`.

### Pós-promoção (Auth + smoke na 3080)

```bash
SYNTH_PASS="$(openssl rand -base64 24)"
SYNTH_EMAIL='gate-d.synth@dev.synthetic.local'
SYNTH_EMAIL="$SYNTH_EMAIL" SYNTH_PASS="$SYNTH_PASS" \
  bash scripts/vps/provision-gate-d-auth-synthetic.sh
CANARY_PORT='3080' SYNTH_EMAIL="$SYNTH_EMAIL" SYNTH_PASS="$SYNTH_PASS" \
  bash scripts/vps/gate-d-smoke-mutation-orc-ped.sh
unset SYNTH_PASS
```

(ajuste: smoke usa `CANARY_PORT`/`BASE_URL` — se o script fixar 3086, use `BASE_URL=http://127.0.0.1:3080`.)

## Regras

- **Não** promover `2fc2fc80`.
- Promover **somente** a mesma tag do canário com mutação OK.
- Rollback: `ROLLBACK_CONTAINER=<nome r07b-pre-f>` `CONFIRM_ROLLBACK=YES` `comercial360-rollback.sh`.
