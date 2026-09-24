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

### 2) Criar usuário Auth sintético (cofre local)

Usar **Studio** do Supabase self-hosted **ou** Admin API GoTrue (`POST /auth/v1/admin/users`) com `service_role` lida do `.env` da VPS **sem echo**.

Requisitos do user:
- e-mail/senha **somente** de teste (domínio sintético, ex. `*.dev.synthetic.local`)
- `email_confirm=true` (ou confirmar no Studio)
- anotar o UUID do user **só no cofre local** (não no PASTE)

### 3) Profile ERP sintético + vínculo

**Não** reutilizar os 2 profiles ativos sem Auth sem prova de que são sintéticos seguros para Bearer. Preferir **profile novo** com:
- `group_id` / `empresa_id` sintéticos existentes (ou do seed)
- `permissoes` mínimas Orçamento + Pedido (além do necessário)
- `auth_user_id` = UUID do Auth (passo 2)
- `ativo=true`

Exemplo de vínculo (substituir placeholders **na VPS**; não imprimir UUIDs no paste):

```bash
# Contagens ANTES (já feitas): auth_users=0
# Após create+vínculo:
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT 'auth_users='||count(*)::text FROM auth.users;"
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT 'profiles_com_auth='||count(*)::text FROM profiles WHERE auth_user_id IS NOT NULL;"
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT 'profiles_ativos_sem_auth='||count(*)::text
   FROM profiles WHERE ativo AND auth_user_id IS NULL;"
```

Esperado para OK: `auth_users>=1` e `profiles_com_auth>=1`.

### 4) PASTE sanitizado (só após contagens reais)

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
