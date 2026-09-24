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

### Execução (quando autorizado)

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
| Migrations 016–024 | no repo/CI | **não** aplicadas (001–015) |
| Auth `supabase_user` | no código | 3080 = `dev_headers` |
| Canário script | preparado | **não** executado |
| Scanner ClamAV real | socket local em código | **não** homologado na VPS |
| Produto HTTP / DAM buckets | opt-in desligado | **não** habilitado |
| Imagem comercial360-main-\* | ainda não | só R07B oficial |

---

## Critério de parada

Parar sem improvisar se: SHA/imagem divergirem; backup falhar; migration
duplicada; canário usar 3080; smoke Auth/RBAC/cross-tenant falhar; rollback
ausente; ou se pedirem promoção sem D/E.
