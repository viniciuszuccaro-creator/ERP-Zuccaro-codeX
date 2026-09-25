# Gate F — promoção 3080 (cartão)

**Status:** `AUTHORIZED_OPTION_A` · `WAITING_VPS_BUILD` — merge #37 **OK** (`894b0db8`).  
**EXECUTED:** **NÃO**. 3080 permanece R07B até build + re-smoke + promoção.

## Autorização + merge registrados

```text
utc_assinatura_formal=2026-09-25
assinatura_formal=VINICIUS
opcao_digest=A
utc_merge=2026-09-25T16:11:21Z
pr_merged=#37
merge_sha=894b0db8f7583137204e1026c6eee26475c7025c
merge_sha8=894b0db8
EXECUTE_GATE_F=AUTHORIZED_WAITING_VPS_BUILD
alter_3080=NOT_PERFORMED
```

## Sequência VPS (agora)

### 1) Build + canário (sem 3080)

```bash
cd /opt/erp-zuccaro
git fetch origin main && git checkout --detach origin/main
test "$(git rev-parse --short=8 HEAD)" = "894b0db8"

CONFIRM_GATE_F_BUILD_RESMOKE=YES \
ERP_DOCKER_NETWORK='supabase_default' \
  bash scripts/vps/gate-f-option-a-build-canary.sh
```

Esperado: `merge_sha8=894b0db8` · `image_tag=...comercial360-main-894b0db8` · `GATE_F_BUILD_CANARY=OK` · `alter_3080=NOT_PERFORMED`.

### 2) Re-smoke mutação

```bash
SYNTH_PASS="$(openssl rand -base64 24)"
SYNTH_EMAIL='gate-d.synth@dev.synthetic.local'
SYNTH_EMAIL="$SYNTH_EMAIL" SYNTH_PASS="$SYNTH_PASS" \
  bash scripts/vps/provision-gate-d-auth-synthetic.sh
SYNTH_EMAIL="$SYNTH_EMAIL" SYNTH_PASS="$SYNTH_PASS" \
  bash scripts/vps/gate-d-smoke-mutation-orc-ped.sh
unset SYNTH_PASS
```

Esperado: `canary_image=...comercial360-main-894b0db8` · `ped_convert=201` · `GATE_D_MUTATION_SMOKE=OK`.

### 3) Promoção 3080 (só após mutação OK na nova tag)

Procedimento alinhado a `docs/COMERCIAL_360_V1_DEPLOY.md` / rollback R07B preservado:

1. Confirmar imagem canário == `$TAG` (mesmo `image_id`).
2. Dry-run rollback: `CONFIRM_ROLLBACK=NO bash scripts/deploy/comercial360-rollback.sh` (com `ROLLBACK_CONTAINER` R07B preservado).
3. Backup novo imediato (se política VPS exigir).
4. Promover: parar/renomear `erp-api-dev`, subir oficial com `$TAG` em **3080** + `ERP_AUTH_MODE=supabase_user` + rede `supabase_default` (overlay Supabase como no canário).
5. Smoke 3080: health/ready/meta (`ERP-RUNTIME-08B` · `supabase_user`) + re-provision Auth + Bearer/mutação.
6. Registrar evidência sanitizada · `EXECUTE_GATE_F=EXECUTED_OK`.

**Parar se:** SHA/tag divergir, mutação falhar, meta ≠ 08B/supabase_user, rollback dry-run falhar.

## Pré-requisitos (checklist)

| # | Item | Estado |
|---|---|---|
| 1 | Gate C APROVADO | OK |
| 2 | Gate E APROVADO | OK |
| 3 | Gate D completo | OK |
| 4 | Assinatura Gate F opção A | **OK** VINICIUS 2026-09-25 |
| 5 | Merge fix na main | **OK** #37 → `894b0db8` |
| 6 | Build `comercial360-main-894b0db8` | **PENDENTE VPS** |
| 7 | Re-smoke mutação nessa tag | aguarda build |
| 8 | Backup + rollback R07B | confirmar no instante da promoção |

## Regras

- **Não** promover `comercial360-main-2fc2fc80` (sem fix).
- **Não** promover `comercial360-gate-d-*` nesta autorização (opção B não escolhida).
- Rollback de API ≠ rollback de schema.
- `CONFIRM_ROLLBACK=YES` só com autorização.
