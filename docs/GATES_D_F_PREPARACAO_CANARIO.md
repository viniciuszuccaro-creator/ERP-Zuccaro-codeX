# Gates D–F — Preparação (frente Cursor / VPS)

**Status:** `PREPARADO / NÃO EXECUTADO`
**Depende de:** Gate C APROVADO (auditoria somente leitura) + merge autorizado da
PR funcional + autorização humana explícita para cada gate.
**Não executa:** canário, migration real, promoção 3080, seed, ClamAV na VPS.

Fonte de scripts (na PR #33 / futuros na `main` após merge):

- `docs/COMERCIAL_360_V1_DEPLOY.md`
- `scripts/deploy/comercial360-canary.sh`
- `scripts/deploy/comercial360-smoke.sh`
- `scripts/deploy/comercial360-rollback.sh`
- `docs/OPERACAO_DEV_VPS.md`

Esta frente **não duplica** os scripts do Codex. Documenta a ordem operacional
Cursor ↔ Codex e os critérios de evidência na VPS.

---

## Pré-validação sem execução (Cursor)

```bash
# No checkout desta frente — não toca VPS
bash scripts/vps/gate-d-f-precheck.sh --local

# Depois da saída Gate C salva em arquivo sanitizado
bash scripts/vps/gate-d-f-precheck.sh --from-gate-c-output saida-gate-c.txt \
  --candidate-migrations server/migrations
# Se o checkout ainda for só main (001-015), missing_for_gate_e=NONE.
# Para simular candidatas da PR #33, aponte --candidate-migrations para um
# diretório que contenha 016-024 (sem aplicá-las).
```

O precheck **nunca** inicia canário nem aplica SQL.

---

## Ordem obrigatória

```text
Gate C (leitura) → Gate E (schema, se a imagem exigir) → Gate D (canário)
→ Gate F (promoção 3080) → observação pós-deploy
```

Se a imagem nova **depende** de migrations 016+, o Gate E antecede o smoke
funcional completo do D. Health/ready/meta do canário pode subir antes, mas
smoke autenticado de Orçamento/Pedido só após schema compatível.

A API oficial **3080 permanece R07B** até o Gate F autorizado.

---

## Gate D — Canário isolado

### Pré-requisitos

| # | Requisito | Evidência |
|---|---|---|
| 1 | Gate C APROVADO | doc Gate C + saída sanitizada |
| 2 | PR funcional revisada + CI verde | GitHub Checks |
| 3 | `MERGE_SHA` da **main** (não da branch feature) | `git rev-parse origin/main` pós-merge |
| 4 | Imagem imutável `erp-zuccaro-erp-api:comercial360-main-<sha8>` | digest local/remoto |
| 5 | Porta isolada ≠3080 e livre no instante | saída `ss` / script |
| 6 | Rede Docker = mesma do precheck C | nome de rede |
| 7 | `ENV_FILE` só na VPS (nunca no Git) | existência do arquivo, sem conteúdo |
| 8 | `EXPECTED_RUNTIME` alinhado ao `/api/v1/meta` da main | contrato Codex |

### Build imagem main (somente registro de digest — sem canário)

Pré-requisito: Gate E OK · main `@2fc2fc80…` · **não** autoriza Gate D.

Colar na Web Console. **Não** restart `erp-api-dev` · **não** canário · **não** 3080.

```bash
set -euo pipefail
cd /opt/erp-zuccaro
git fetch origin main
git checkout --detach origin/main
test "$(git rev-parse HEAD)" = "2fc2fc80adb9ca876be6ca3d29aab49305839e8a"
SHA8=2fc2fc80
TAG="erp-zuccaro-erp-api:comercial360-main-${SHA8}"

docker build -t "$TAG" ./server

ID="$(docker image inspect -f '{{.Id}}' "$TAG")"
SIZE="$(docker image inspect -f '{{.Size}}' "$TAG")"
CREATED="$(docker image inspect -f '{{.Created}}' "$TAG")"
# RepoDigests pode ser vazio em tag só local — OK; Id basta para registro.
RD="$(docker image inspect -f '{{index .RepoDigests 0}}' "$TAG" 2>/dev/null || true)"

echo 'PASTE_TO_GIT_BEGIN'
echo "merge_sha=2fc2fc80adb9ca876be6ca3d29aab49305839e8a"
echo "merge_sha8=${SHA8}"
echo "image_tag=${TAG}"
echo "image_id_prefix=${ID:0:19}"
echo "image_size_bytes=${SIZE}"
echo "image_created=${CREATED}"
echo "repo_digest=${RD:-local_tag_only}"
echo 'DIGEST_STATUS=OK'
echo 'AUTHORIZES_CANARY=NO'
echo 'AUTHORIZES_GATE_D=NO'
echo 'alter_3080=NOT_PERFORMED'
echo 'PASTE_TO_GIT_END'

docker ps --format '{{.Names}} {{.Image}}' | grep -E 'erp-api-dev|supabase-db' || true
curl -sS -o /dev/null -w 'health=%{http_code}\n' http://127.0.0.1:3080/health
curl -sS -o /dev/null -w 'ready=%{http_code}\n' http://127.0.0.1:3080/ready
```

Colar `PASTE_TO_GIT_*` em `docs/vps/evidence/image-digest-comercial360-latest.txt` (sem `.env`).
Com `DIGEST_STATUS=OK`, o go-nogo passa a `image_digest_status=REGISTERED` (Auth sintético ainda pendente).

### Execução Gate D (quando autorizado)

```bash
# Na VPS, após autorização — NÃO executar neste lote documental
IMAGE='erp-zuccaro-erp-api:comercial360-main-<sha8>'
ENV_FILE='/opt/erp-zuccaro/.env'   # caminho real aprovado; não commitar
ERP_DOCKER_NETWORK='<rede do Gate C>'
EXPECTED_RUNTIME='<runtime da main>'
CANARY_PORT='<porta FREE do Gate C>'
./scripts/deploy/comercial360-canary.sh
BASE_URL="http://127.0.0.1:${CANARY_PORT}" EXPECTED_RUNTIME="$EXPECTED_RUNTIME" \
  ./scripts/deploy/comercial360-smoke.sh
```

Critérios do script (já codificados na PR #33):

- rejeita porta 3080 e nome `erp-api-dev`;
- exige `auth.mode=supabase_user` no meta;
- smoke exige entidades `Orcamento` e `Pedido` em `httpEntities`.

Smoke autenticado (Bearer sintético, RBAC negado, cross-tenant) permanece
**gate manual autorizado** — `dev_headers` **não** conta.

### Resultado possível

- **APROVADO:** canário ready + smoke meta + smoke autenticado sintético OK.
- **PARCIAL:** container up, Auth/smoke incompleto.
- **BLOQUEADO:** meta/runtime/auth divergente; porta/rede inválida; 3080 tocada.

---

## Gate E — Migrations / compatibilidade

### Pré-requisitos

| # | Requisito |
|---|---|
| 1 | Gate C APROVADO |
| 2 | Backup **novo** em `/opt/erp-zuccaro/backups` (caminho + bytes + SHA-256) |
| 3 | Rollback R07B preservado |
| 4 | Lista de migrations faltantes = só ids da **main** aprovada ausentes em `schema_migrations` |
| 5 | Migrator canônico + `ON_ERROR_STOP` |
| 6 | Autorização humana explícita |

### Após apply (somente ids faltantes)

1. Conferir cada migration da main exatamente 1×; investigar qualquer id inesperado.
2. `npm run test:postgres` no checkout exato da main, PostgreSQL **real**, >0 testes, 0 fail/skip.
3. RLS + FORCE nas tabelas novas; compatibilidade com runtime R07B se rollback de API for necessário sem reverter schema.

**Não** reaplicar 001–015. **Não** usar CI efêmera como prova deste gate.

---

## Gate F — Promoção e smoke oficial

### Pré-requisitos

| # | Requisito |
|---|---|
| 1 | D APROVADO com o **mesmo digest** a promover |
| 2 | E APROVADO se schema novo for requisito da imagem |
| 3 | Autorização expressa de promoção |
| 4 | Backup + rollback preservados |
| 5 | Script rollback em dry-run OK imediatamente antes |

### Execução

- Parar/renomear oficial e promover **somente** a imagem que passou em D.
- Pós-promoção: health/ready/meta em 3080; smoke autenticado sintético; auditoria; monitoramento.
- Rollback de API ≠ rollback de schema (decisões independentes).
- `CONFIRM_ROLLBACK=YES` só com autorização humana.

Até F: **3080 = R07B / `dev_headers`**.

---

## Matriz código preparado × recurso ativo na VPS

| Recurso | Código/CI (PR #33) | VPS agora (evidência) |
|---|---|---|
| Orçamento/Pedido HTTP | preparado | **não** na 3080 (07B) |
| Migrations 016–024 | no repo/CI | **aplicadas no DEV** (`GATE_E_STATUS=OK`) |
| Auth `supabase_user` | no código | 3080 = `dev_headers` |
| Canário script | preparado · default `ERP-RUNTIME-08B` | **não** executado |
| Scanner ClamAV real | socket local em código | **não** homologado na VPS |
| Produto HTTP / DAM buckets | opt-in desligado | **não** habilitado |
| Imagem comercial360-main-\* | build Web Console pendente | só R07B oficial na 3080 |

---

## Critério de parada

Parar sem improvisar se: SHA/imagem divergirem; backup falhar; migration
duplicada; canário usar 3080; smoke Auth/RBAC/cross-tenant falhar; rollback
ausente; ou se pedirem promoção sem D/E.
