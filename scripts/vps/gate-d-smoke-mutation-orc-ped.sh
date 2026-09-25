#!/usr/bin/env bash
# Gate D — smoke de mutações sintéticas Orçamento → Pedido no canário (≠3080).
# Não imprime token, senha, UUID, .env. Não altera 3080. Não autoriza Gate F.
#
# Uso (mesma sessão openssl + provision, como o Bearer):
#   SYNTH_PASS='...' bash scripts/vps/gate-d-smoke-mutation-orc-ped.sh
set -euo pipefail

SYNTH_EMAIL="${SYNTH_EMAIL:-gate-d.synth@dev.synthetic.local}"
SYNTH_PASS="${SYNTH_PASS:?Set SYNTH_PASS from local vault}"
CANARY_PORT="${CANARY_PORT:-3086}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${CANARY_PORT}}"
SUPA_ENV="${SUPABASE_ENV_FILE:-/root/supabase/docker/.env}"

echo "GATE_D_MUTATION_SMOKE_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "alter_3080=NOT_PERFORMED"
echo "AUTHORIZES_GATE_F=NO"

CANARY_NAME="${CANARY_NAME:-erp-api-comercial360-canary}"
CANARY_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$CANARY_NAME" 2>/dev/null || true)"
CANARY_IMAGE_ID="$(docker inspect -f '{{.Image}}' "$CANARY_NAME" 2>/dev/null || true)"
echo "canary_name=${CANARY_NAME}"
echo "canary_image=${CANARY_IMAGE:-unknown}"
echo "canary_image_id_prefix=${CANARY_IMAGE_ID:0:19}"
if [[ "$CANARY_IMAGE" == *comercial360-main-* ]]; then
  echo "canary_image_is_main_immutable=YES"
  echo "HINT=ped_convert_500_likely_stale_main_image_rebuild_via_comercial360-canary-from-checkout.sh" >&2
else
  echo "canary_image_is_main_immutable=NO"
fi

case "${SYNTH_PASS}" in
  SENHA_DO_COFRE_OPENSSL|SENHA_DO_COFRE|SENHA_REAL_DO_COFRE|SENHA_FORTE_LOCAL|SUA_SENHA_FORTE|COLOQUE_SENHA_FORTE_AQUI|'...'|'…')
    echo 'BLOCKED: synth_pass_is_placeholder_from_chat' >&2
    exit 2
    ;;
esac
[[ ${#SYNTH_PASS} -ge 12 ]] || { echo 'BLOCKED: synth_pass_too_short' >&2; exit 2; }

env_get() {
  local key="$1" line
  [[ -f "$SUPA_ENV" ]] || return 0
  line="$(grep -E "^${key}=" "$SUPA_ENV" 2>/dev/null | tail -1 || true)"
  [[ -n "$line" ]] || return 0
  line="${line#${key}=}"
  line="${line%$'\r'}"
  if [[ "$line" =~ ^\".*\"$ ]]; then line="${line:1:${#line}-2}"
  elif [[ "$line" =~ ^\'.*\'$ ]]; then line="${line:1:${#line}-2}"; fi
  printf '%s' "$line"
}

ANON="$(env_get ANON_KEY)"
[[ -z "$ANON" ]] && ANON="$(env_get SUPABASE_ANON_KEY)"
[[ -n "$ANON" && ${#ANON} -ge 40 ]] || { echo 'BLOCKED: supabase_anon_missing_or_stub' >&2; exit 2; }
echo "anon_len=${#ANON}"

AUTH_BASE='http://127.0.0.1:8000'
http_health="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 \
  -H "apikey: ${ANON}" "${AUTH_BASE}/auth/v1/health" 2>/dev/null || true)"
echo "auth_health_local=${http_health}"
[[ "$http_health" == "200" ]] || { echo 'BLOCKED: auth_local_8000_unreachable' >&2; exit 3; }

TMP_TOK="$(mktemp)"
TMP_GID="$(mktemp)"
TMP_EID="$(mktemp)"
TMP_CE="$(mktemp)"
TMP_COND="$(mktemp)"
TMP_PROD="$(mktemp)"
TMP_UNI="$(mktemp)"
TMP_BODY="$(mktemp)"
TMP_ORC="$(mktemp)"
TMP_PED="$(mktemp)"
cleanup() {
  rm -f "$TMP_TOK" "$TMP_GID" "$TMP_EID" "$TMP_CE" "$TMP_COND" "$TMP_PROD" "$TMP_UNI" \
    "$TMP_BODY" "$TMP_ORC" "$TMP_PED"
}
trap cleanup EXIT

docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v synth_email="$SYNTH_EMAIL" -At <<'SQL' >"$TMP_GID" 2>/dev/null || true
SELECT group_id::text FROM profiles
 WHERE lower(email)=lower(:'synth_email')
   AND auth_user_id IS NOT NULL AND ativo IS TRUE
 ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
 LIMIT 1;
SQL
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v synth_email="$SYNTH_EMAIL" -At <<'SQL' >"$TMP_EID" 2>/dev/null || true
SELECT empresa_id::text FROM profiles
 WHERE lower(email)=lower(:'synth_email')
   AND auth_user_id IS NOT NULL AND ativo IS TRUE
   AND empresa_id IS NOT NULL
 ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
 LIMIT 1;
SQL

GROUP_ID="$(tr -d '[:space:]' <"$TMP_GID" || true)"
EMPRESA_ID="$(tr -d '[:space:]' <"$TMP_EID" || true)"
[[ -n "$GROUP_ID" && ${#GROUP_ID} -ge 32 ]] || { echo 'BLOCKED: profile_group_id_missing' >&2; exit 4; }
[[ -n "$EMPRESA_ID" && ${#EMPRESA_ID} -ge 32 ]] || { echo 'BLOCKED: profile_empresa_id_missing' >&2; exit 4; }
echo "tenant_group_set=YES"
echo "tenant_empresa_set=YES"

# Refs comerciais no mesmo Grupo/Empresa (sem echo de UUID).
# Se o tenant do profile não tiver cadastros (caso típico pós-Auth sintético),
# cria fixtures mínimas marcadas GATE_D_MUTATION — idempotente.
ensure_out="$(mktemp)"
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v gid="$GROUP_ID" -v eid="$EMPRESA_ID" <<'SQL' >"$ensure_out" 2>&1 || true
BEGIN;

-- Unidade
INSERT INTO unidades_medida (id, group_id, empresa_id, sigla, nome_completo, tipo_grandeza, ativo)
SELECT gen_random_uuid(), :'gid'::uuid, :'eid'::uuid, 'UN', 'Unidade Gate-D', 'Unidade', true
WHERE NOT EXISTS (
  SELECT 1 FROM unidades_medida
  WHERE group_id=:'gid'::uuid AND ativo IS TRUE AND lower(sigla)='un'
);

-- Marca
INSERT INTO marcas (id, group_id, empresa_id, nome_marca, ativo)
SELECT gen_random_uuid(), :'gid'::uuid, :'eid'::uuid, 'GATE-D SYNTH', true
WHERE NOT EXISTS (
  SELECT 1 FROM marcas
  WHERE group_id=:'gid'::uuid AND ativo IS TRUE AND nome_marca='GATE-D SYNTH'
);

-- Grupo produto
INSERT INTO grupos_produto (id, group_id, empresa_id, nome_grupo, codigo, natureza, ativo)
SELECT gen_random_uuid(), :'gid'::uuid, :'eid'::uuid, 'GATE-D SYNTH', 'GATED-GP', 'Revenda', true
WHERE NOT EXISTS (
  SELECT 1 FROM grupos_produto
  WHERE group_id=:'gid'::uuid AND ativo IS TRUE
    AND (codigo='GATED-GP' OR nome_grupo='GATE-D SYNTH')
);

-- Setor
INSERT INTO setores_atividade (id, group_id, empresa_id, nome, tipo_operacao, ativo)
SELECT gen_random_uuid(), :'gid'::uuid, :'eid'::uuid, 'GATE-D SYNTH', 'Revenda', true
WHERE NOT EXISTS (
  SELECT 1 FROM setores_atividade
  WHERE group_id=:'gid'::uuid AND ativo IS TRUE AND nome='GATE-D SYNTH'
);

-- Produto mínimo
INSERT INTO produtos (
  id, group_id, empresa_id, codigo, descricao, nome, tipo_item,
  unidade_medida_id, unidade_principal, grupo_produto_id, marca_id, setor_atividade_id,
  status, ativo
)
SELECT
  gen_random_uuid(),
  :'gid'::uuid,
  :'eid'::uuid,
  'GATED-PROD',
  'PRODUTO GATE-D SYNTH',
  'PRODUTO GATE-D SYNTH',
  'Revenda',
  (SELECT id FROM unidades_medida WHERE group_id=:'gid'::uuid AND ativo IS TRUE AND lower(sigla)='un' ORDER BY created_at LIMIT 1),
  'UN',
  (SELECT id FROM grupos_produto WHERE group_id=:'gid'::uuid AND ativo IS TRUE AND (codigo='GATED-GP' OR nome_grupo='GATE-D SYNTH') ORDER BY created_at LIMIT 1),
  (SELECT id FROM marcas WHERE group_id=:'gid'::uuid AND ativo IS TRUE AND nome_marca='GATE-D SYNTH' ORDER BY created_at LIMIT 1),
  (SELECT id FROM setores_atividade WHERE group_id=:'gid'::uuid AND ativo IS TRUE AND nome='GATE-D SYNTH' ORDER BY created_at LIMIT 1),
  'Ativo',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM produtos
  WHERE group_id=:'gid'::uuid AND ativo IS TRUE
    AND (codigo='GATED-PROD' OR descricao='PRODUTO GATE-D SYNTH')
    AND (empresa_id IS NULL OR empresa_id=:'eid'::uuid)
);

-- Cliente PJ sintético (CNPJ válido de teste, nunca real)
INSERT INTO clientes (
  id, group_id, empresa_id, codigo, tipo, documento, documento_normalizado,
  razao_social, nome_fantasia, email, status, origem, source_system, migration_batch, ativo
)
SELECT
  gen_random_uuid(),
  :'gid'::uuid,
  :'eid'::uuid,
  COALESCE(reserve_entity_codigo(:'gid'::uuid, 'Cliente', 6), '900001'),
  'Pessoa Jurídica',
  '00.000.000/0001-91',
  '00000000000191',
  'CLIENTE GATE-D SYNTH LTDA',
  'Gate-D Synth',
  'gate-d.cliente@dev.synthetic.local',
  'Ativo',
  'ERP',
  'GATE_D_MUTATION',
  'GATE-D',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM clientes
  WHERE group_id=:'gid'::uuid AND ativo IS TRUE
    AND (
      documento_normalizado='00000000000191'
      OR source_system='GATE_D_MUTATION'
      OR email='gate-d.cliente@dev.synthetic.local'
    )
);

-- Vínculo ClienteEmpresa operacional
INSERT INTO cliente_empresas (
  group_id, cliente_id, empresa_id, ativo, situacao_comercial,
  habilitado_operacao, bloqueado, origem, source_system, migration_batch
)
SELECT
  :'gid'::uuid,
  c.id,
  :'eid'::uuid,
  true,
  'ATIVO',
  true,
  false,
  'ERP',
  'GATE_D_MUTATION',
  'GATE-D'
FROM clientes c
WHERE c.group_id=:'gid'::uuid AND c.ativo IS TRUE
  AND (
    c.documento_normalizado='00000000000191'
    OR c.source_system='GATE_D_MUTATION'
    OR c.email='gate-d.cliente@dev.synthetic.local'
  )
  AND NOT EXISTS (
    SELECT 1 FROM cliente_empresas ce
    WHERE ce.group_id=c.group_id AND ce.cliente_id=c.id AND ce.empresa_id=:'eid'::uuid
  )
LIMIT 1;

UPDATE cliente_empresas ce
SET ativo=true,
    situacao_comercial='ATIVO',
    habilitado_operacao=true,
    bloqueado=false,
    motivo_bloqueio=NULL,
    updated_at=timezone('utc', now())
FROM clientes c
WHERE ce.group_id=:'gid'::uuid
  AND ce.empresa_id=:'eid'::uuid
  AND ce.cliente_id=c.id
  AND c.group_id=:'gid'::uuid
  AND (
    c.documento_normalizado='00000000000191'
    OR c.source_system='GATE_D_MUTATION'
    OR c.email='gate-d.cliente@dev.synthetic.local'
  );

-- Condição de pagamento + vínculo empresa + parcela 100% (mesma transação)
-- codigo obrigatório: ^[0-9]{6}$
INSERT INTO condicoes_pagamento (
  id, group_id, empresa_id, codigo, nome, descricao, ativo, origem, source_system, migration_batch
)
SELECT
  gen_random_uuid(),
  :'gid'::uuid,
  :'eid'::uuid,
  COALESCE(reserve_entity_codigo(:'gid'::uuid, 'CondicaoPagamento', 6), '900001'),
  'GATE-D A VISTA',
  'Sintetica Gate-D',
  true,
  'ERP',
  'GATE_D_MUTATION',
  'GATE-D'
WHERE NOT EXISTS (
  SELECT 1 FROM condicoes_pagamento
  WHERE group_id=:'gid'::uuid AND ativo IS TRUE
    AND (nome='GATE-D A VISTA' OR source_system='GATE_D_MUTATION')
);

INSERT INTO condicao_pagamento_empresas (
  group_id, condicao_pagamento_id, empresa_id, eh_padrao, ativo
)
SELECT
  :'gid'::uuid,
  c.id,
  :'eid'::uuid,
  true,
  true
FROM condicoes_pagamento c
WHERE c.group_id=:'gid'::uuid AND c.ativo IS TRUE
  AND (c.nome='GATE-D A VISTA' OR c.source_system='GATE_D_MUTATION')
  AND NOT EXISTS (
    SELECT 1 FROM condicao_pagamento_empresas e
    WHERE e.condicao_pagamento_id=c.id AND e.empresa_id=:'eid'::uuid
  )
LIMIT 1;

UPDATE condicao_pagamento_empresas e
SET ativo=true, eh_padrao=true, updated_at=timezone('utc', now())
FROM condicoes_pagamento c
WHERE e.condicao_pagamento_id=c.id
  AND c.group_id=:'gid'::uuid
  AND e.empresa_id=:'eid'::uuid
  AND (c.nome='GATE-D A VISTA' OR c.source_system='GATE_D_MUTATION');

INSERT INTO condicao_pagamento_parcelas (
  group_id, condicao_pagamento_id, ordem, dias, percentual, ativo
)
SELECT
  :'gid'::uuid,
  c.id,
  1,
  0,
  100.000000,
  true
FROM condicoes_pagamento c
WHERE c.group_id=:'gid'::uuid AND c.ativo IS TRUE
  AND (c.nome='GATE-D A VISTA' OR c.source_system='GATE_D_MUTATION')
  AND NOT EXISTS (
    SELECT 1 FROM condicao_pagamento_parcelas p
    WHERE p.condicao_pagamento_id=c.id AND p.ordem=1
  )
LIMIT 1;

COMMIT;
SELECT 'ensure_ok';
SQL

if grep -q 'ensure_ok' "$ensure_out" 2>/dev/null; then
  echo 'refs_ensure=YES'
else
  echo 'refs_ensure=FAIL'
  # Sanitiza: não vaza UUID; só trecho curto do erro
  err_hint="$(grep -E 'ERROR:|BLOCKED|EXCEPTION' "$ensure_out" 2>/dev/null | head -1 | cut -c1-120 || true)"
  [[ -n "$err_hint" ]] && echo "refs_ensure_hint=${err_hint}" >&2
  echo 'BLOCKED: mutation_refs_ensure_failed' >&2
  rm -f "$ensure_out"
  exit 7
fi
rm -f "$ensure_out"

docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v gid="$GROUP_ID" -v eid="$EMPRESA_ID" -At <<'SQL' >"$TMP_CE" 2>/dev/null || true
SELECT id::text FROM cliente_empresas
 WHERE group_id=:'gid'::uuid AND empresa_id=:'eid'::uuid
   AND ativo IS TRUE AND bloqueado IS NOT TRUE AND habilitado_operacao IS TRUE
 ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
 LIMIT 1;
SQL
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v gid="$GROUP_ID" -v eid="$EMPRESA_ID" -At <<'SQL' >"$TMP_COND" 2>/dev/null || true
SELECT c.id::text FROM condicoes_pagamento c
 WHERE c.group_id=:'gid'::uuid AND c.ativo IS TRUE
   AND EXISTS (
     SELECT 1 FROM condicao_pagamento_empresas e
     WHERE e.condicao_pagamento_id=c.id
       AND e.group_id=c.group_id
       AND e.empresa_id=:'eid'::uuid
       AND e.ativo IS TRUE
   )
 ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
 LIMIT 1;
SQL
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v gid="$GROUP_ID" -v eid="$EMPRESA_ID" -At <<'SQL' >"$TMP_PROD" 2>/dev/null || true
SELECT id::text FROM produtos
 WHERE group_id=:'gid'::uuid AND ativo IS TRUE
   AND (empresa_id IS NULL OR empresa_id=:'eid'::uuid)
 ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
 LIMIT 1;
SQL

CLIENTE_EMPRESA_ID="$(tr -d '[:space:]' <"$TMP_CE" || true)"
CONDICAO_ID="$(tr -d '[:space:]' <"$TMP_COND" || true)"
PRODUTO_ID="$(tr -d '[:space:]' <"$TMP_PROD" || true)"

if [[ -z "$CLIENTE_EMPRESA_ID" || ${#CLIENTE_EMPRESA_ID} -lt 32 ]]; then
  echo 'refs_cliente_empresa=MISSING'
  echo 'BLOCKED: no_operable_cliente_empresa_in_tenant' >&2
  exit 7
fi
echo "refs_cliente_empresa=YES"
if [[ -z "$CONDICAO_ID" || ${#CONDICAO_ID} -lt 32 ]]; then
  echo 'refs_condicao=MISSING'
  echo 'BLOCKED: no_condicao_pagamento_in_tenant' >&2
  exit 7
fi
echo "refs_condicao=YES"
if [[ -z "$PRODUTO_ID" || ${#PRODUTO_ID} -lt 32 ]]; then
  echo 'refs_produto=MISSING'
  echo 'BLOCKED: no_produto_in_tenant' >&2
  exit 7
fi
echo "refs_produto=YES"

docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v pid="$PRODUTO_ID" -At <<'SQL' >"$TMP_UNI" 2>/dev/null || true
SELECT unidade_medida_id::text FROM produtos WHERE id=:'pid'::uuid LIMIT 1;
SQL
UNIDADE_ID="$(tr -d '[:space:]' <"$TMP_UNI" || true)"
[[ -n "$UNIDADE_ID" && ${#UNIDADE_ID} -ge 32 ]] || {
  echo 'BLOCKED: produto_unidade_missing' >&2
  exit 7
}
echo "refs_unidade=YES"

http_tok="$(curl -sS -o "$TMP_TOK" -w '%{http_code}' --connect-timeout 8 \
  -X POST "${AUTH_BASE}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON}" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\"}" \
  2>/dev/null || true)"
echo "http_token=${http_tok}"
TOK="$(python3 - "$TMP_TOK" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    print('')
    raise SystemExit(0)
print(d.get('access_token') or '')
PY
)"
echo "token_len=${#TOK}"
[[ -n "$TOK" ]] || { echo 'BLOCKED: token_not_issued' >&2; exit 5; }

auth_hdrs=(
  -H "Authorization: Bearer ${TOK}"
  -H "apikey: ${ANON}"
  -H "Content-Type: application/json"
  -H "x-group-id: ${GROUP_ID}"
  -H "x-empresa-id: ${EMPRESA_ID}"
)

VALIDADE="$(date -u -d '+30 days' +%Y-%m-%dT00:00:00.000Z 2>/dev/null || date -u -v+30d +%Y-%m-%dT00:00:00.000Z)"
ENTREGA="$(date -u -d '+45 days' +%Y-%m-%dT00:00:00.000Z 2>/dev/null || date -u -v+45d +%Y-%m-%dT00:00:00.000Z)"

ORC_PAYLOAD="$(python3 - <<PY
import json
print(json.dumps({
  "cliente_empresa_id": "${CLIENTE_EMPRESA_ID}",
  "condicao_pagamento_id": "${CONDICAO_ID}",
  "validade_em": "${VALIDADE}",
  "observacoes": "Gate D mutation smoke sintetico",
  "itens": [{
    "produto_id": "${PRODUTO_ID}",
    "unidade_id": "${UNIDADE_ID}",
    "descricao": "Item sintetico gate-d",
    "unidade_sigla": "UN",
    "quantidade": "1",
    "preco_unitario": "10",
    "desconto": "0"
  }]
}))
PY
)"

orc_create="$(curl -sS -o "$TMP_ORC" -w '%{http_code}' --connect-timeout 15 \
  -X POST "${BASE_URL}/api/v1/orcamentos" "${auth_hdrs[@]}" \
  -d "$ORC_PAYLOAD" 2>/dev/null || true)"
echo "orc_create=${orc_create}"
ORC_ID="$(python3 - "$TMP_ORC" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    print('')
    raise SystemExit(0)
print((d.get('data') or {}).get('id') or '')
PY
)"
[[ "$orc_create" == "201" && -n "$ORC_ID" ]] || {
  code="$(python3 -c "import json;d=json.load(open('$TMP_ORC'));e=d.get('error')or{};print(e.get('code')or d.get('code')or 'unknown')" 2>/dev/null || echo parse_fail)"
  echo "orc_create_error_code=${code}" >&2
  echo 'BLOCKED: orcamento_create_failed' >&2
  exit 8
}
echo "orc_id_len=${#ORC_ID}"

CONV_PAYLOAD="$(python3 - <<PY
import json
print(json.dumps({
  "tipo_operacao": "ENTREGA",
  "data_entrega_solicitada": "${ENTREGA}"
}))
PY
)"

ped_convert="$(curl -sS -o "$TMP_PED" -w '%{http_code}' --connect-timeout 15 \
  -X POST "${BASE_URL}/api/v1/orcamentos/${ORC_ID}/converter-pedido" "${auth_hdrs[@]}" \
  -d "$CONV_PAYLOAD" 2>/dev/null || true)"
echo "ped_convert=${ped_convert}"
PED_ID="$(python3 - "$TMP_PED" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    print('')
    raise SystemExit(0)
print((d.get('data') or {}).get('id') or '')
PY
)"
[[ "$ped_convert" == "201" && -n "$PED_ID" ]] || {
  code="$(python3 - "$TMP_PED" <<'PY'
import json, re, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    print('parse_fail')
    raise SystemExit(0)
e = d.get('error') or {}
print(e.get('code') or d.get('code') or 'unknown')
PY
)"
  # Mensagem sanitizada: sem UUID / sem body completo
  msg="$(python3 - "$TMP_PED" <<'PY'
import json, re, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    print('parse_fail')
    raise SystemExit(0)
e = d.get('error') or {}
raw = str(e.get('message') or d.get('message') or '')
raw = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}', '<uuid>', raw, flags=re.I)
raw = re.sub(r'\s+', ' ', raw).strip()
print((raw[:120] if raw else 'empty'))
PY
)"
  echo "ped_convert_error_code=${code}" >&2
  echo "ped_convert_error_msg_sanitized=${msg}" >&2
  echo "canary_image=${CANARY_IMAGE:-unknown}" >&2
  if [[ "$CANARY_IMAGE" == *comercial360-main-* ]]; then
    echo 'HINT=rebuild_canary_from_checkout_not_main_tag' >&2
  fi
  echo 'BLOCKED: pedido_convert_failed' >&2
  exit 8
}
echo "ped_id_len=${#PED_ID}"

# Idempotência: segunda conversão deve conflitar
ped_dup="$(curl -sS -o "$TMP_BODY" -w '%{http_code}' --connect-timeout 10 \
  -X POST "${BASE_URL}/api/v1/orcamentos/${ORC_ID}/converter-pedido" "${auth_hdrs[@]}" \
  -d "$CONV_PAYLOAD" 2>/dev/null || true)"
echo "ped_convert_dup=${ped_dup}"

ped_get="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 8 \
  "${auth_hdrs[@]}" "${BASE_URL}/api/v1/pedidos/${PED_ID}" 2>/dev/null || true)"
echo "ped_get=${ped_get}"

no_auth="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 \
  -X POST "${BASE_URL}/api/v1/orcamentos" -H 'Content-Type: application/json' -d '{}' \
  2>/dev/null || true)"
echo "mutation_no_auth=${no_auth}"

ok=YES
[[ "$orc_create" == "201" ]] || ok=NO
[[ "$ped_convert" == "201" ]] || ok=NO
[[ "$ped_get" == "200" ]] || ok=NO
[[ "$ped_dup" == "409" ]] || ok=NO
[[ "$no_auth" == "401" || "$no_auth" == "403" ]] || ok=NO

echo "PASTE_TO_GIT_BEGIN"
echo "orc_create=${orc_create}"
echo "ped_convert=${ped_convert}"
echo "ped_convert_dup=${ped_dup}"
echo "ped_get=${ped_get}"
echo "mutation_no_auth=${no_auth}"
echo "refs_cliente_empresa=YES"
echo "refs_condicao=YES"
echo "refs_produto=YES"
echo "refs_ensure=YES"
echo "canary_image=${CANARY_IMAGE:-unknown}"
echo "canary_image_is_main_immutable=$([[ "${CANARY_IMAGE:-}" == *comercial360-main-* ]] && echo YES || echo NO)"
echo "token_len=${#TOK}"
echo "anon_len=${#ANON}"
echo "GATE_D_MUTATION_SMOKE=$([[ "$ok" == "YES" ]] && echo OK || echo FAIL)"
echo "alter_3080=NOT_PERFORMED"
echo "AUTHORIZES_GATE_F=NO"
echo "NOTE=segredos_somente_cofre_local"
echo "PASTE_TO_GIT_END"
echo "GATE_D_MUTATION_SMOKE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
[[ "$ok" == "YES" ]] || exit 9
