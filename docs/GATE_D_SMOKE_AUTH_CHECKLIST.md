# Gate D — checklist de Auth sintético + smoke

**Status:** `ASSINADO` · Gate Auth + Gate D autorizados (VINICIUS · 24/09/2026)  
**Execução:** Auth **primeiro** na Web Console → depois canário Gate D  
**Pré-condições:** Gate E OK · digest `comercial360-main-2fc2fc80` REGISTERED · 3080 R07B  
**Não autorizados:** Gate F · alteração 3080  
**Não usar:** `dev_headers` como prova de Auth.  
**Não publicar:** mídia · token · e-mail · senha · UUID no Git.

Complementa `docs/GATES_D_F_PREPARACAO_CANARIO.md` e
`docs/CONTRATO_CURSOR_CODEX_VPS_CANARIO.md`.

---

## Pré-requisitos

| # | Item | Evidência |
|---|---|---|
| 1 | Gate C APROVADO | `score-gate-c.sh` |
| 2 | Gate E OK (schema 016–024 DEV) | `gate-e-webconsole-2026-09-24.txt` |
| 3 | `EXPECTED_RUNTIME=ERP-RUNTIME-08B` | canary default + `/meta` |
| 4 | Imagem `comercial360-main-2fc2fc80` | digest **REGISTERED** |
| 5 | Termo §C Gate Auth + Gate D marcados + assinatura | **OK** · VINICIUS · 24/09/2026 |
| 6 | Canário up em porta ≠3080 | após (5) |
| 7 | Meta canário: `auth.mode=supabase_user` | smoke |
| 8 | Identidade sintética + profile vinculado | **fora do Git** |
| 9 | Grupo/Empresa sintéticos | seed / escopo mínimo |

---

## Gate Auth — provisionamento (Web Console, autorizado)

**Baseline Auth (2026-09-25T12:07Z):** `auth_users_count=1` · `profiles_com_auth_count=1` · `AUTH_SYNTHETIC_STATUS=OK`.
`profiles_ativos_sem_auth_count=2` (legado preservado). Segredos só no cofre local.

**Canário + Bearer (2026-09-25T13:14Z):** `CANARY_READY` 3086 · `SMOKE_OK` meta · `GATE_D_BEARER_SMOKE=OK`
(`no_auth=401` · `orc_list=200` · `ped_list=200` · tenant group/empresa YES).

Ordem fail-closed. **Nunca** colar e-mail, senha, token, service_role ou UUID no chat/Git.

### 1) Descobrir Auth (só nomes)

```bash
docker ps --format '{{.Names}}' | grep -Ei 'auth|kong|gotrue' || true
# Confirmar 3080 intacta
curl -sS -o /dev/null -w 'health=%{http_code}\n' http://127.0.0.1:3080/health
```

### 2) Provisionamento via script (recomendado — evita paste de prosa)

Na Web Console, **só estas linhas** (defina email/senha locais; não cole prosa):

```bash
cd /opt/erp-zuccaro
curl -fsSL 'https://raw.githubusercontent.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/cursor/pos-gate-e-prep-d-392b/scripts/vps/provision-gate-d-auth-synthetic.sh' -o /tmp/provision-gate-d-auth.sh
chmod +x /tmp/provision-gate-d-auth.sh
# Gere a senha NA VPS e guarde no cofre local (não cole senha/UUID no chat):
SYNTH_PASS="$(openssl rand -base64 24)"
printf 'SENHA_GERADA — copie para o cofre local agora, depois limpe o scroll.\n'
SYNTH_EMAIL='gate-d.synth@dev.synthetic.local' SYNTH_PASS="$SYNTH_PASS" \
  bash /tmp/provision-gate-d-auth.sh
unset SYNTH_PASS
```

Envie ao chat **apenas** o bloco `PASTE_TO_GIT_*` (sem JSON Auth).  
Se `BLOCKED: auth_user_not_created`, rode Studio → Add user e avise o `http_kong=` / `auth_error_hint=`.

**Não** use `source` em `/root/supabase/docker/.env` — há linhas inválidas (ex.: `Organization` na L151) que quebram o shell. O script lê só `KEY=VALUE` via `env_get`.

Se `http_direct_*=200` seguido de `422` e `auth_user_created=NO`, o usuário pode já existir: baixe de novo o script (volume `/tmp` + resolve SQL) e reexecute.

### 2b) Blocos manuais (alternativa) — **uma sessão contínua**

Containers: `supabase-auth`, `supabase-studio`.  
Preferir §2 (script). Manual abaixo **sem** `source` do `.env`.

**A+B juntos (obrigatório na mesma sessão):**
```bash
set -euo pipefail
ENV_FILE=/root/supabase/docker/.env
env_get() {
  local key="$1" line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -1 || true)"
  [[ -n "$line" ]] || return 0
  line="${line#${key}=}"
  line="${line%$'\r'}"
  if [[ "$line" =~ ^\".*\"$ ]]; then line="${line:1:${#line}-2}"
  elif [[ "$line" =~ ^\'.*\'$ ]]; then line="${line:1:${#line}-2}"; fi
  printf '%s' "$line"
}
SR="$(env_get SERVICE_ROLE_KEY)"
[[ -z "$SR" ]] && SR="$(env_get SUPABASE_SERVICE_ROLE_KEY)"
test -n "$SR"
AUTH_BASE="$(env_get API_EXTERNAL_URL)"
[[ -z "$AUTH_BASE" ]] && AUTH_BASE="$(env_get SUPABASE_PUBLIC_URL)"
[[ -z "$AUTH_BASE" ]] && AUTH_BASE="$(env_get KONG_URL)"
[[ -z "$AUTH_BASE" ]] && AUTH_BASE="http://127.0.0.1:8000"
AUTH_BASE="${AUTH_BASE%/}"
echo "auth_base_len=${#AUTH_BASE}"
curl -sS -o /dev/null -w 'auth_health=%{http_code}\n' "${AUTH_BASE}/auth/v1/health" || true

# Defina email/senha LOCAIS (não envie ao chat), depois rode o resto:
# SYNTH_EMAIL='gate-d.synth@dev.synthetic.local'
# SYNTH_PASS='senha-forte-local'
test -n "${SYNTH_EMAIL:-}" && test -n "${SYNTH_PASS:-}"
curl -sS -o /tmp/auth-create.json -w 'http=%{http_code}\n' \
  -X POST "${AUTH_BASE}/auth/v1/admin/users" \
  -H "apikey: ${SR}" \
  -H "Authorization: Bearer ${SR}" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\",\"email_confirm\":true}"
test -s /tmp/auth-create.json
python3 -c "import json;d=json.load(open('/tmp/auth-create.json'));u=d.get('id')or(d.get('user')or{}).get('id');open('/tmp/auth-uuid.txt','w').write(u or '');print('auth_user_created='+('YES' if u else 'NO'))"
test -s /tmp/auth-uuid.txt
```

Se `auth_health`/`http` falhar, tente via rede Docker (sem Kong):
```bash
NET=$(docker inspect -f '{{range $k,$_ := .NetworkSettings.Networks}}{{println $k}}{{end}}' supabase-auth | head -1)
docker run --rm --network "$NET" -v /tmp:/tmp curlimages/curl:8.5.0 \
  -sS -o /tmp/auth-create.json -w 'http=%{http_code}\n' \
  -X POST 'http://auth:9999/admin/users' \
  -H "apikey: ${SR}" \
  -H "Authorization: Bearer ${SR}" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\",\"email_confirm\":true}"
```
(Se o hostname interno for `supabase-auth`, troque `http://auth:9999` por `http://supabase-auth:9999`.)

**C — profile (só se `auth_user_created=YES`):**
```bash
AUTH_UUID="$(cat /tmp/auth-uuid.txt)"
test -n "$AUTH_UUID"
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v auth_uuid="$AUTH_UUID" <<'SQL'
INSERT INTO profiles (
  id, email, full_name, role, ativo, group_id, empresa_id, auth_user_id, permissoes
) VALUES (
  gen_random_uuid(),
  'gate-d.synth@dev.synthetic.local',
  'Gate D Synth Actor',
  'user',
  true,
  (SELECT id FROM groups ORDER BY id LIMIT 1),
  (SELECT id FROM empresas WHERE group_id=(SELECT id FROM groups ORDER BY id LIMIT 1) ORDER BY id LIMIT 1),
  :'auth_uuid'::uuid,
  '{"Comercial":{"orcamento":["visualizar","criar","editar","cancelar"],"pedido":["visualizar","criar","editar","cancelar","converter-pedido","alterar-status"]}}'::jsonb
);
SQL
```

**D — contagens**
```bash
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT 'auth_users='||count(*)::text FROM auth.users;"
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT 'profiles_com_auth='||count(*)::text FROM profiles WHERE auth_user_id IS NOT NULL;"
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT 'profiles_ativos_sem_auth='||count(*)::text FROM profiles WHERE ativo AND auth_user_id IS NULL;"
```

**Plano B (UI):** Supabase Studio → Authentication → Add user (confirm) → anotar UUID no cofre → rodar só o bloco C com `AUTH_UUID=...` (não colar UUID no chat) → bloco D.

### 5) PASTE sanitizado (só após contagens reais)

```bash
# Substituir N pelos números reais das queries acima
echo 'PASTE_TO_GIT_BEGIN'
echo 'AUTH_SYNTHETIC_STATUS=OK'
echo "auth_users_count=${AUTH_USERS_COUNT}"
echo "profiles_com_auth_count=${PROFILES_COM_AUTH}"
echo "profiles_ativos_sem_auth_count=${PROFILES_SEM_AUTH}"
echo 'rbac_minimo=orcamento_pedido'
echo 'AUTHORIZES_CANARY=NO'
echo 'alter_3080=NOT_PERFORMED'
echo 'NOTE=segredos_somente_cofre_local'
echo 'PASTE_TO_GIT_END'
```

Gravar em `docs/vps/evidence/auth-synthetic-latest.txt`. Sem `<N>` literais.

---

## Sequência Gate D (após Auth OK + termo Gate D)

### A. Subir canário (porta ≠3080)

Use `bash`. Preferir `ENV_FROM_CONTAINER=erp-api-dev` (padrão Gate E) — `/opt/erp-zuccaro/.env` pode **não** existir.  
**Não** `cat`/cole `.env`. Vars no mesmo bloco.

```bash
cd /opt/erp-zuccaro
git pull origin cursor/pos-gate-e-prep-d-392b
curl -sS -o /dev/null -w 'health_3080=%{http_code}\n' http://127.0.0.1:3080/health
docker ps --format '{{.Names}}' | grep -E 'erp-api' || true
docker rm -f erp-api-comercial360-canary 2>/dev/null || true

IMAGE='erp-zuccaro-erp-api:comercial360-main-2fc2fc80' \
ENV_FROM_CONTAINER='erp-api-dev' \
ERP_DOCKER_NETWORK='supabase_default' \
EXPECTED_RUNTIME='ERP-RUNTIME-08B' \
CANARY_PORT='3086' \
ERP_AUTH_MODE='supabase_user' \
bash scripts/deploy/comercial360-canary.sh

BASE_URL='http://127.0.0.1:3086' EXPECTED_RUNTIME=ERP-RUNTIME-08B \
  bash scripts/deploy/comercial360-smoke.sh
```

### C. Bearer sintético — após canário com overlay Supabase

**Não** cole textos do chat como senha (`SENHA_DO_COFRE_OPENSSL`, etc.) — GoTrue responde `invalid_credentials`.  
Gere a senha **na VPS**, atualize o Auth na mesma sessão e rode o Bearer **sem** `unset` no meio:

```bash
cd /opt/erp-zuccaro
git pull origin cursor/pos-gate-e-prep-d-392b

# 1) Nova senha (guarde no cofre local; NÃO echo / NÃO cole no chat)
SYNTH_PASS="$(openssl rand -base64 24)"
SYNTH_EMAIL='gate-d.synth@dev.synthetic.local'

# 2) Atualiza senha do user Auth existente (idempotente)
SYNTH_EMAIL="$SYNTH_EMAIL" SYNTH_PASS="$SYNTH_PASS" \
  bash scripts/vps/provision-gate-d-auth-synthetic.sh
# Esperado: AUTH_SYNTHETIC_STATUS=OK (ou profile_linked=YES)

# 3) Bearer no canário 3086 — mesma SYNTH_PASS; script envia x-group-id/x-empresa-id do profile
SYNTH_EMAIL="$SYNTH_EMAIL" SYNTH_PASS="$SYNTH_PASS" \
  bash scripts/vps/gate-d-smoke-bearer-synthetic.sh
# Esperado: tenant_group_set=YES · no_auth=401 · orc_list=200 · ped_list=200 · GATE_D_BEARER_SMOKE=OK

unset SYNTH_PASS
```

Cole só `PASTE_TO_GIT_*` do Bearer (`GATE_D_BEARER_SMOKE=OK` · codes).  
Se o canário ainda não tiver `supabase_overlay=YES`, recrie-o antes do passo 3 (bloco §A).

### D. Negativos obrigatórios

| Caso | Esperado |
|---|---|
| Sem Authorization | 401/403 fail-closed |
| Token inválido/expirado | negado |
| Profile sem permissão Orçamento/Pedido | 403 |
| `empresa_id` de outra empresa sem vínculo | bloqueado |
| `group_id` adulterado | 403 ou 404 |
| Duplo submit sem idempotency | sem duplicata indevida / 409 |

### E. Limpeza

Revogar sessão / desabilitar identidade Auth de teste. Remover só IDs sintéticos do gate. Não truncar. 3080 intocada.

---

## O que este checklist NÃO cobre

- Scanner ClamAV / buckets DAM · Produto HTTP · Gate F / 3080 · importação legado  
- Gate E (já OK)

---

## Registro de evidência (sanitizado)

- `CANARY_PORT`, `IMAGE` tag, `EXPECTED_RUNTIME`, `meta_auth_mode=supabase_user`
- contagens Auth agregadas · pass/fail smoke  
- **nunca** token, e-mail, senha, UUID
