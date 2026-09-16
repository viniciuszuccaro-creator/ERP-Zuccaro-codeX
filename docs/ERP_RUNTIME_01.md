# ERP-RUNTIME-01 — Fundação Hostinger + Supabase self-hosted

**Status:** fundação pronta para deploy DEV (sem executar deploy neste lote)  
**Data:** 2026-09-16  
**Branch:** `cursor/erp-runtime-01-392b`  
**Decisão de infra:** Hostinger VPS + Supabase self-hosted + PostgreSQL + API/BFF própria + frontend React atual  
**GitHub:** fonte oficial do código  
**Base44:** sandbox/referência apenas — **não** é runtime oficial do ERP principal

Referências: `docs/DIAGNOSTICO_RUNTIME_ERP.md`, `docs/COMPARATIVO_PLATAFORMAS_ERP.md` (HYBRID_TRANSITION).

---

## 1. Objetivo deste lote

Criar a **fundação** do novo runtime, sem migrar o ERP inteiro:

- API/BFF Node.js + TypeScript
- Migrations versionadas
- Schema multiempresa + RLS fail-closed
- Repository pattern
- HttpApiClient + feature flag
- Piloto **Marca** end-to-end (harness/teste)
- Docker separado do compose do Supabase
- Documentação de deploy DEV (sem executar)

**Fora de escopo:** Site CPA S2S, Financeiro/Fiscal/Estoque, Auth completa, Storage/Realtime, HML/PROD, deploy VPS, SSH, remoção Base44.

---

## 2. Arquitetura

```text
ERP React (Vite)
    |
    v
base44Client facade  +  VITE_ERP_BACKEND=local|http|remote
    |
    +-- local  → localBase44 (fallback DEV; preservado)
    +-- remote → SDK Base44 (sandbox legado)
    +-- http   → HttpApiClient (piloto Marca) + localBase44 (demais entidades)
                    |
                    v
               API/BFF (server/)
                    |
                    v
         Service → Repository → PostgreSQL (Supabase self-hosted)
```

Regra crítica: a UI **não** chama Supabase/Postgres diretamente.

---

## 3. Entidade piloto: Marca

**Por quê Marca?**

- Cadastro simples (nome, descrição, ativo, etc.)
- Fora de Financeiro / Fiscal / Estoque / Pagamento / NF-e
- Uso leve no frontend (`ValidadorFase2`)
- Permite validar facade → HTTP → BFF → SQL → auditoria sem risco operacional

Soft-delete: `DELETE` marca `ativo=false` (sem hard delete).

---

## 4. Schema / migrations

Arquivos em `server/migrations/`:

| Arquivo | Conteúdo |
|---|---|
| `001_foundation.sql` | `groups`, `empresas`, `profiles`, `audit_logs`, `integration_events`, timestamps UTC |
| `002_rls_foundation.sql` | RLS + FORCE RLS fail-closed (sem policies abertas) |
| `003_marcas_pilot.sql` | tabela `marcas` + índices + RLS |

### Como aplicar

```bash
cd server
cp .env.example .env   # preencher DATABASE_URL real somente fora do Git
npm install
npm run migrate
npm run migrate:status
```

### Como validar

```bash
npm run migrate:status
# pending deve ficar vazio
curl -s http://127.0.0.1:3080/ready
```

### Rollback

Migrations são forward-only neste lote. Rollback manual:

1. Backup (`pg_dump`) antes de aplicar em DEV.
2. Reverter objetos do arquivo mais recente se necessário (ex.: `DROP TABLE marcas` apenas se vazio/seguro).
3. Remover linha correspondente em `schema_migrations`.

Não executar migrate remoto a partir deste agente.

---

## 5. API endpoints

| Método | Path | Auth/scope |
|---|---|---|
| GET | `/health` | público (sem secrets) |
| GET | `/ready` | verifica Postgres |
| GET | `/api/v1/meta` | metadados seguros |
| GET | `/api/v1/marcas` | `X-Group-Id` obrigatório |
| GET | `/api/v1/marcas/:id` | tenant scope |
| POST | `/api/v1/marcas` | tenant + validação + audit |
| PATCH | `/api/v1/marcas/:id` | tenant + audit |
| DELETE | `/api/v1/marcas/:id` | soft-delete + audit |

Headers:

- `X-Group-Id` (obrigatório nas rotas de domínio)
- `X-Empresa-Id` (opcional)
- `X-Actor-Id` / `X-Actor-Email` (auditoria; fundação auth)
- `X-Request-Id` (correlation; gerado se ausente)

---

## 6. Feature flag

| Variável | Valores | Efeito |
|---|---|---|
| `VITE_ERP_BACKEND` | `local` (default) / `http` / `remote` | seleciona backend |
| `VITE_ERP_API_BASE_URL` | URL do BFF | usado no modo `http` |

Não seleciona produção automaticamente.

Escopo HTTP no browser (temporário): `localStorage.erp_runtime_scope` JSON com `groupId` / `empresaId` / `actorEmail`.

---

## 7. Tabela de ENV (sem valores reais)

| ENV | USED_BY | SECRET | REQUIRED | DESCRIPTION |
|---|---|---|---|---|
| `VITE_ERP_BACKEND` | frontend | não | não | `local` \| `http` \| `remote` |
| `VITE_ERP_API_BASE_URL` | frontend | não | se http | Base URL do BFF |
| `NODE_ENV` | server | não | sim | development/test/production |
| `ERP_ENV` | server | não | sim | dev/hml/prod |
| `PORT` | server | não | não | default 3080 |
| `DATABASE_URL` | server | **sim** | prod/ready | Postgres Supabase |
| `SUPABASE_URL` | server | não* | futuro | URL gateway Supabase |
| `SUPABASE_ANON_KEY` | server | **sim** | futuro auth | nunca no browser deste desenho BFF |
| `SUPABASE_SERVICE_ROLE_KEY` | server | **sim** | futuro | **somente server** |
| `CORS_ORIGINS` | server | não | sim | lista CSV |
| `BODY_LIMIT` | server | não | não | limite JSON |
| `RATE_LIMIT_*` | server | não | não | rate limit |
| `REQUIRE_DATABASE` | server | não | não | força DATABASE_URL |
| `APP_VERSION` | server | não | não | versão health |

\* URL em si não é segredo; tokens sim.

Arquivos exemplo: `.env.example`, `server/.env.example`.

---

## 8. HOSTINGER DEV DEPLOY (documentado — NÃO executar neste lote)

Domínios reservados:

- `erp-dev.cpaferroeaco.com.br`
- `api-erp-dev.cpaferroeaco.com.br`
- `supabase-dev.cpaferroeaco.com.br`
- `studio-dev.cpaferroeaco.com.br`

Passos futuros (humano no VPS, sem senha no Git):

1. Confirmar Supabase self-hosted saudável (já existente).
2. Criar `.env.erp.dev` no VPS a partir de `.env.example` (secrets locais).
3. Conectar `docker-compose.erp.yml` à rede Docker do Supabase (`ERP_DOCKER_NETWORK`).
4. `docker compose -f docker-compose.erp.yml build`
5. Rodar migrate uma vez com `DATABASE_URL` apontando ao Postgres interno.
6. `docker compose -f docker-compose.erp.yml up -d`
7. Proxy reverso (Caddy/Nginx) 443 → `127.0.0.1:3080` (API) e `127.0.0.1:3081` (web).
8. Firewall: manter 5432/8000/6543 bloqueados externamente; só 22/80/443 públicos.
9. Validar `/health`, `/ready`, CRUD Marca com dados sintéticos.
10. CI no GitHub valida build; deploy via SSH key (nunca password no repositório).

**Este lote não faz SSH, não altera o VPS e não aplica migration remota.**

---

## 9. Segurança

- Helmet, CORS restrito, body limit, rate limit foundation
- Service role só server-side
- Erros sem stack em production
- Request ID em todas as respostas de erro
- RLS fail-closed nas tabelas empresariais
- Multiempresa desde a primeira migration (`group_id` / `empresa_id`)

---

## 10. Critérios de aceite

- [x] API/BFF existe (`server/`)
- [x] `/health` e `/ready`
- [x] Migrations versionadas
- [x] Schema foundation + multiempresa + RLS
- [x] Repositories (Marca + contrato Empresa)
- [x] HttpApiClient + feature flag
- [x] localBase44 preservado
- [x] Piloto Marca E2E em harness
- [x] Auditoria create/update/soft-delete
- [x] Docker ERP separado
- [x] Nenhum segredo versionado
- [x] Testes / lint / build (ver relatório do commit)

---

## 11. Próximo passo

Após aprovação humana e deploy DEV manual: **ERP-RUNTIME-02** (ampliar entidades / Auth foundation real).  
Site CPA S2S permanece reservado a **ERP-RUNTIME-05**.

---

## 12. Decisão

Ver relatório do agente / STATUS: `ERP_RUNTIME_01_READY_FOR_DEV_DEPLOY` se validações locais passarem.
