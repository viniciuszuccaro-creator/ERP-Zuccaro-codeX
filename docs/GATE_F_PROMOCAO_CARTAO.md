# Gate F — promoção 3080 (cartão)

**Status:** `AUTHORIZED_OPTION_A` · `WAITING_MERGE` — assinatura VINICIUS (2026-09-25).  
**EXECUTED:** **NÃO**. 3080 permanece R07B até merge + build + re-smoke + promoção.

## Autorização registrada

```text
utc_assinatura_formal=2026-09-25
assinatura_formal=VINICIUS
opcao_digest=A
texto=Autorizo Gate F (promoção 3080) na opção A:
  merge do fix Orçamento→Pedido na main, build comercial360-main-<MERGE_SHA8>,
  re-smoke mutação no canário com essa tag, depois promover essa imagem.
  Não autorizo promoção da tag MAIN antiga 2fc2fc80 sem o fix.
EXECUTE_GATE_F=AUTHORIZED_WAITING_MERGE
alter_3080=NOT_YET_PERFORMED
```

Evidência: `docs/vps/evidence/gate-f-autorizacao-opcao-a-2026-09-25.txt`.

## Sequência obrigatória (opção A)

### 1) Merge na MAIN (humano / GitHub)

- PR candidata: **#37** (`cursor/pos-gate-e-prep-d-392b` → `main`) · CI verde · contém fix `20eda9e2` (map Orçamento).
- Após merge: anotar `MERGE_SHA` e `MERGE_SHA8` (`git rev-parse origin/main` / primeiros 8).

### 2) Build imagem imutável na VPS (ainda **sem** tocar 3080)

```bash
cd /opt/erp-zuccaro
git fetch origin main
git checkout --detach origin/main
MERGE_SHA="$(git rev-parse HEAD)"
MERGE_SHA8="${MERGE_SHA:0:8}"
TAG="erp-zuccaro-erp-api:comercial360-main-${MERGE_SHA8}"
test "$MERGE_SHA8" != "2fc2fc80"   # deve ser o SHA novo pós-merge

docker build -t "$TAG" ./server
ID="$(docker image inspect -f '{{.Id}}' "$TAG")"
echo "PASTE_TO_GIT_BEGIN"
echo "merge_sha=${MERGE_SHA}"
echo "merge_sha8=${MERGE_SHA8}"
echo "image_tag=${TAG}"
echo "image_id_prefix=${ID:0:19}"
echo "DIGEST_STATUS=OK"
echo "AUTHORIZES_PROMOTE=NO"
echo "alter_3080=NOT_PERFORMED"
echo "PASTE_TO_GIT_END"
```

### 3) Recriar canário 3086 com a **nova** tag MAIN + re-smoke mutação

```bash
docker rm -f erp-api-comercial360-canary 2>/dev/null || true

IMAGE="$TAG" \
ENV_FROM_CONTAINER='erp-api-dev' \
ERP_DOCKER_NETWORK='supabase_default' \
EXPECTED_RUNTIME='ERP-RUNTIME-08B' \
CANARY_PORT='3086' \
ERP_AUTH_MODE='supabase_user' \
bash scripts/deploy/comercial360-canary.sh

BASE_URL='http://127.0.0.1:3086' EXPECTED_RUNTIME=ERP-RUNTIME-08B \
  bash scripts/deploy/comercial360-smoke.sh

# Auth sintético foi banido no §E — re-provision obrigatório
SYNTH_PASS="$(openssl rand -base64 24)"
SYNTH_EMAIL='gate-d.synth@dev.synthetic.local'
SYNTH_EMAIL="$SYNTH_EMAIL" SYNTH_PASS="$SYNTH_PASS" \
  bash scripts/vps/provision-gate-d-auth-synthetic.sh
SYNTH_EMAIL="$SYNTH_EMAIL" SYNTH_PASS="$SYNTH_PASS" \
  bash scripts/vps/gate-d-smoke-mutation-orc-ped.sh
unset SYNTH_PASS
```

Esperado: `canary_image=...comercial360-main-<MERGE_SHA8>` · `ped_convert=201` · `GATE_D_MUTATION_SMOKE=OK`.

### 4) Promoção 3080 (só após mutação OK na nova tag)

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
| 5 | Merge fix na main | **PENDENTE** (PR #37) |
| 6 | Build `comercial360-main-<MERGE_SHA8>` | aguarda merge |
| 7 | Re-smoke mutação nessa tag | aguarda build |
| 8 | Backup + rollback R07B | confirmar no instante da promoção |

## Regras

- **Não** promover `comercial360-main-2fc2fc80` (sem fix).
- **Não** promover `comercial360-gate-d-*` nesta autorização (opção B não escolhida).
- Rollback de API ≠ rollback de schema.
- `CONFIRM_ROLLBACK=YES` só com autorização.
