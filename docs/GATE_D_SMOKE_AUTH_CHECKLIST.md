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

**Baseline atual (2026-09-24):** `auth_users=0` · `profiles_ativos_sem_auth=2` → **ainda PENDING**.  
PASTE com `AUTH_SYNTHETIC_STATUS=OK` e placeholders `<N>` **não vale** — rejeitado.

Ordem fail-closed. **Nunca** colar e-mail, senha, token, service_role ou UUID no chat/Git.

### 1) Descobrir Auth (só nomes)

```bash
docker ps --format '{{.Names}}' | grep -Ei 'auth|kong|gotrue' || true
# Confirmar 3080 intacta
curl -sS -o /dev/null -w 'health=%{http_code}\n' http://127.0.0.1:3080/health
```

### 2–4) Blocos só-comando (não colar prosa no shell)

Containers: `supabase-auth`, `supabase-studio`. Colar **A → B → C → D** isolados.

**A — carregar service_role**
```bash
set -euo pipefail
set -a
source /root/supabase/docker/.env
set +a
SR="${SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"
test -n "$SR"
AUTH_BASE="${API_EXTERNAL_URL:-${SUPABASE_PUBLIC_URL:-http://127.0.0.1:8000}}"
AUTH_BASE="${AUTH_BASE%/}"
echo 'service_role_loaded=YES'
```

**B — criar user Auth** (antes: `SYNTH_EMAIL=...` e `SYNTH_PASS=...` só no shell local)
```bash
test -n "${SYNTH_EMAIL:-}" && test -n "${SYNTH_PASS:-}"
curl -sS -o /tmp/auth-create.json -w 'http=%{http_code}\n' \
  -X POST "${AUTH_BASE}/auth/v1/admin/users" \
  -H "apikey: ${SR}" \
  -H "Authorization: Bearer ${SR}" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\",\"email_confirm\":true}"
python3 -c "import json;d=json.load(open('/tmp/auth-create.json'));u=d.get('id')or(d.get('user')or{}).get('id');open('/tmp/auth-uuid.txt','w').write(u or '');print('auth_user_created='+('YES' if u else 'NO'))"
```

**C — profile + vínculo**
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

**D — contagens (enviar só estas linhas)**
```bash
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT 'auth_users='||count(*)::text FROM auth.users;"
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT 'profiles_com_auth='||count(*)::text FROM profiles WHERE auth_user_id IS NOT NULL;"
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT 'profiles_ativos_sem_auth='||count(*)::text FROM profiles WHERE ativo AND auth_user_id IS NULL;"
```

Se A falhar: `ls /root/supabase/docker/.env /opt/erp-zuccaro/.env* 2>/dev/null`

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

```bash
IMAGE='erp-zuccaro-erp-api:comercial360-main-2fc2fc80'
ENV_FILE='<caminho .env canário na VPS — não no Git>'
ERP_DOCKER_NETWORK='supabase_default'
EXPECTED_RUNTIME='ERP-RUNTIME-08B'
CANARY_PORT='3086'   # confirmar livre; nunca 3080
# ENV do canário: ERP_AUTH_MODE=supabase_user (+ URL/anon key server-side)
./scripts/deploy/comercial360-canary.sh
```

### B. Meta / superfície HTTP

```bash
BASE_URL="http://127.0.0.1:${CANARY_PORT}" \
EXPECTED_RUNTIME=ERP-RUNTIME-08B \
  ./scripts/deploy/comercial360-smoke.sh
```

### C. Bearer sintético — permitido

Com token válido (somente cofre local):

1. Orçamento: list → get → create → update → cancel  
2. Conversão idempotente Orçamento→Pedido  
3. Pedido: list → get → update → status → cancel → histórico  
4. Totais recalculados pelo servidor  

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
