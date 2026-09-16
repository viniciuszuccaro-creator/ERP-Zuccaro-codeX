# ERP-DEV-DEPLOY-01 — Primeiro deploy DEV na Hostinger

**Decisão deste lote (Cursor):** preparação + runbook humano.  
**NÃO executado neste lote:** SSH, migrate remoto, `docker compose up`, alteração de firewall/DNS/Supabase.

**Data:** 2026-09-16  
**Branch:** `cursor/erp-dev-deploy-01-392b`  
**Base:** `main` com ERP-RUNTIME-01 já incorporado  
**Fonte de código:** GitHub `main`  
**Validação inicial:** **local no VPS** (`127.0.0.1`) — DNS ainda não é blocker

---

## Fases

| Fase | Quem | O quê |
|---|---|---|
| **A** | Cursor/GitHub | Artefatos, compose, docs, testes (este lote) |
| **B** | Humano no VPS | Runbook curto abaixo |
| **C** | Humano | Validar health/ready/Marca/audit/multiempresa |

---

## Estratégias (resumo)

### Network

- ERP **não** altera `/root/supabase/docker`.
- ERP anexa-se à **network Docker externa real** do Supabase.
- Descobrir com `docker network ls` (não inventar nome).
- Variável: `ERP_DOCKER_NETWORK=<nome_real>`.

### DATABASE_URL

- Somente rede interna Docker.
- Formato: `postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/postgres`
- Host tipico do serviço Postgres no stack Supabase: `db` (confirmar no `docker network inspect`).
- **Nunca** IP público, **nunca** abrir `5432`.

### Env / secrets

- Arquivo no VPS: `/opt/erp-zuccaro/.env.erp.dev`
- Template no Git: `.env.erp.dev.example` (placeholders)
- `chmod 600`
- Secrets **somente** no VPS — nunca GitHub / frontend / docs com valor real

### Migrations

1. `pg_dump` (backup DEV)  
2. `node dist/db/migrate.js` via container `erp-api`  
3. Seed sintético `server/scripts/seed-dev-synthetic.sql`  
4. Validar `/ready` + CRUD Marca + `audit_logs`

### Docker

- Compose: `docker-compose.erp.yml` (separado)
- Portas: `127.0.0.1:3080` (API), `127.0.0.1:3081` (web)
- Restart: `unless-stopped`
- Limits: API 512MB / 0.5 CPU; web 128MB / 0.25 CPU
- Frontend: `VITE_ERP_BACKEND=http` + same-origin nginx proxy (`/api`, `/health`, `/ready`)

### CORS (sem DNS)

- `http://127.0.0.1:3081,http://localhost:3081`
- Futuro (quando DNS): acrescentar `https://erp-dev.cpaferroeaco.com.br`
- Sem wildcard

---

## Proibições absolutas

- `db reset` / `DROP DATABASE` / `docker volume rm` / `docker compose down -v` no Supabase  
- Abrir `5432` / `8000` / `6543` no UFW  
- Remover `erp-docker-firewall.service`  
- Versionar senha/service_role/JWT/SSH  
- Deploy automático CI ainda  
- Editar código manualmente no VPS (só pull do GitHub)

---

# RUNBOOK HUMANO (comandos curtos)

> Um comando por passo.  
> Se der erro: **PARAR** e registrar a saída.  
> Placeholders: `<POSTGRES_PASSWORD>`, `<SUPABASE_DOCKER_NETWORK>`, etc.

---

### B0 — Pré-checagem (não destrutivo)

**Comando:**

```bash
docker ps
```

**Resultado esperado:** containers Supabase (db, auth, rest, kong, etc.) `Up`.

**Se der erro:** PARAR. Não continuar sem Supabase saudável.

---

**Comando:**

```bash
sudo ufw status
```

**Resultado esperado:** 22/80/443 allow; sem 5432/8000/6543 públicos.

**Se der erro:** PARAR. Não abrir portas novas.

---

**Comando:**

```bash
systemctl is-active erp-docker-firewall.service
```

**Resultado esperado:** `active`

**Se der erro:** PARAR. Não remover o serviço.

---

### B1 — Descobrir network do Supabase

**Comando:**

```bash
docker network ls
```

**Resultado esperado:** lista com network do stack Supabase (nome real).

**Se der erro:** PARAR.

**Comando (substitua NOME):**

```bash
docker network inspect NOME
```

**Resultado esperado:** container `db` (ou equivalente Postgres) na mesma network. Anote:

- `ERP_DOCKER_NETWORK=<SUPABASE_DOCKER_NETWORK>`
- hostname Postgres (geralmente `db`)

**Se der erro:** PARAR. Não inventar hostname.

---

### B2 — Usuário de deploy (recomendado; bootstrap root ok)

**Comando:**

```bash
id
```

**Resultado esperado:** mostra usuário atual.

**Se for root:** após o primeiro deploy, criar usuário dedicado (não automatizado neste lote).

---

### B3 — Diretório do ERP (código via Git)

**Comando:**

```bash
sudo mkdir -p /opt/erp-zuccaro
```

**Resultado esperado:** diretório criado (ou já existe).

---

**Comando:**

```bash
sudo chown "$USER":"$USER" /opt/erp-zuccaro
```

**Resultado esperado:** ownership ok.

---

**Comando:**

```bash
cd /opt/erp-zuccaro
```

---

**Comando (clone — use deploy key / HTTPS com token; NÃO senha GitHub):**

```bash
git clone https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX.git .
```

**Se o diretório já tiver clone:**

```bash
git fetch origin main
```

```bash
git checkout main
```

```bash
git pull origin main
```

**Resultado esperado:** working tree com `docker-compose.erp.yml` e `server/`.

**Se der erro:** PARAR. Não editar código no VPS.

---

### B4 — Arquivo de secrets (fora do Git)

**Comando:**

```bash
cp .env.erp.dev.example .env.erp.dev
```

---

**Comando:**

```bash
chmod 600 .env.erp.dev
```

---

**Comando:**

```bash
nano .env.erp.dev
```

Preencher somente placeholders:

- `<POSTGRES_PASSWORD>`
- `<SUPABASE_DOCKER_NETWORK>`
- opcional: anon/service role (não obrigatório para Marca neste lote)

**Resultado esperado:** arquivo existe, modo `600`, sem valores commitados.

**Se der erro:** PARAR.

---

### B5 — Backup Postgres ANTES da migration

**Comando (descobrir container db):**

```bash
docker ps --format '{{.Names}}'
```

Anote o nome do container Postgres (ex.: algo com `db`).

---

**Comando:**

```bash
mkdir -p /opt/erp-zuccaro/backups
```

---

**Comando (troque CONTAINER_DB):**

```bash
docker exec CONTAINER_DB pg_dump -U postgres -d postgres -Fc -f /tmp/erp-dev-pre-migrate.dump
```

---

**Comando:**

```bash
docker cp CONTAINER_DB:/tmp/erp-dev-pre-migrate.dump /opt/erp-zuccaro/backups/erp-dev-pre-migrate.dump
```

**Resultado esperado:** arquivo dump no host. Se DB vazio, dump ainda é válido — registrar “DB vazio/DEV”.

**Se der erro:** PARAR. Não migrar sem backup.

---

### B6 — Exportar network no shell atual

**Comando:**

```bash
export ERP_DOCKER_NETWORK=<SUPABASE_DOCKER_NETWORK>
```

---

### B7 — Build dos containers ERP

**Comando:**

```bash
cd /opt/erp-zuccaro
```

---

**Comando:**

```bash
docker compose -f docker-compose.erp.yml build
```

**Resultado esperado:** build `erp-api` e `erp-web` OK.

**Se der erro:** PARAR. Não forçar `--no-cache` em loop sem ler o log.

---

### B8 — Subir API/Web (sem derrubar Supabase)

**Comando:**

```bash
docker compose -f docker-compose.erp.yml up -d
```

**Resultado esperado:** `erp-api-dev` e `erp-web-dev` created/started.

**Se der erro:** PARAR. **Não** usar `down -v` no Supabase.

---

### B9 — Health / Ready

**Comando:**

```bash
curl -s http://127.0.0.1:3080/health
```

**Resultado esperado:** JSON com `"status":"ok"`.

---

**Comando:**

```bash
curl -s http://127.0.0.1:3080/ready
```

**Resultado esperado:** `"status":"ready"` e `"database":"ok"`.

**Se der erro:** PARAR. Checar `DATABASE_URL` / network / logs.

---

### B10 — Migrations

**Comando:**

```bash
docker compose -f docker-compose.erp.yml run --rm --no-deps erp-api node dist/db/migrate.js
```

**Resultado esperado:** JSON listando `001_foundation.sql`, `002_rls_foundation.sql`, `003_marcas_pilot.sql` aplicados.

**Se der erro:** PARAR. Restaurar dump se necessário (humano).

---

### B11 — Seed sintético

**Comando (troque CONTAINER_DB):**

```bash
docker cp server/scripts/seed-dev-synthetic.sql CONTAINER_DB:/tmp/seed-dev-synthetic.sql
```

---

**Comando:**

```bash
docker exec CONTAINER_DB psql -U postgres -d postgres -f /tmp/seed-dev-synthetic.sql
```

**Resultado esperado:** `INSERT 0 1` (ou similar) sem erro.

**Se der erro:** PARAR.

---

### B12 — Piloto Marca (API)

Group A:

```bash
curl -s http://127.0.0.1:3080/api/v1/marcas -H 'X-Group-Id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
```

**Resultado esperado:** lista com MARCA TESTE A/B.

---

Create:

```bash
curl -s -X POST http://127.0.0.1:3080/api/v1/marcas -H 'Content-Type: application/json' -H 'X-Group-Id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' -H 'X-Empresa-Id: cccccccc-cccc-4ccc-8ccc-cccccccccccc' -H 'X-Actor-Email: dev@example.com' -H 'X-Request-Id: deploy01-create-1' -d '{"nome_marca":"MARCA TESTE C"}'
```

**Resultado esperado:** HTTP 201 + `id` UUID.

---

Update (troque ID):

```bash
curl -s -X PATCH http://127.0.0.1:3080/api/v1/marcas/ID -H 'Content-Type: application/json' -H 'X-Group-Id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' -d '{"descricao":"atualizada"}'
```

---

Soft delete (troque ID):

```bash
curl -s -X DELETE http://127.0.0.1:3080/api/v1/marcas/ID -H 'X-Group-Id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
```

**Resultado esperado:** `"ativo": false`.

---

### B13 — Multiempresa

```bash
curl -s http://127.0.0.1:3080/api/v1/marcas -H 'X-Group-Id: bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
```

**Resultado esperado:** lista **vazia** (Group B não vê marcas do Group A).

**Se der erro / vazamento:** PARAR.

---

### B14 — Auditoria

**Comando (troque CONTAINER_DB):**

```bash
docker exec CONTAINER_DB psql -U postgres -d postgres -c "SELECT entity, action, request_id, group_id, actor_email, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10;"
```

**Resultado esperado:** linhas `Marca` create/update/soft_delete com `request_id` e `group_id`.

---

### B15 — Frontend local

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3081/
```

**Resultado esperado:** `200`

```bash
curl -s http://127.0.0.1:3081/health
```

**Resultado esperado:** JSON health via proxy nginx.

**Não abrir firewall** para 3081.

---

### B16 — Logs (sem secrets)

```bash
docker compose -f docker-compose.erp.yml logs --tail 100 erp-api
```

```bash
docker compose -f docker-compose.erp.yml logs --tail 50 erp-web
```

---

### B17 — Restart policy (opcional)

```bash
docker update --restart unless-stopped erp-api-dev
```

```bash
docker update --restart unless-stopped erp-web-dev
```

```bash
docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' erp-api-dev
```

**Resultado esperado:** `unless-stopped`

---

### B18 — Confirmar Supabase intacto

```bash
docker ps
```

**Resultado esperado:** containers Supabase ainda `Up` (não reiniciados destrutivamente).

---

## Fase C — Checklist de aceite DEV local

- [ ] `/health` ok  
- [ ] `/ready` database ok  
- [ ] migrations 001–003 aplicadas  
- [ ] seed sintético presente  
- [ ] LIST/GET/CREATE/UPDATE/SOFT DELETE Marca  
- [ ] Group B não vê Group A  
- [ ] `audit_logs` preenchidos  
- [ ] portas só em `127.0.0.1`  
- [ ] UFW / DOCKER-USER intactos  
- [ ] nenhum secret no Git  

Quando DNS ativar (lote futuro): Caddy → `erp-dev` / `api-erp-dev` / `supabase-dev` / `studio-dev` (Studio com VPN/allowlist).

---

## Comandos perigosos — NÃO usar

```text
docker compose down -v
docker volume rm
DROP DATABASE
supabase db reset
ufw allow 5432
```

---

## Futuro (fora deste lote)

1. DNS + Caddy + TLS  
2. Usuário Linux de deploy (não-root) + deploy key  
3. CI/CD controlado  
4. ERP-RUNTIME-02  
5. Studio protegido  

---

## Decisão Cursor

`ERP_DEV_DEPLOY_01_READY_FOR_MANUAL_DEPLOY`

(Deploy real = Fase B humana; Cursor não acessa VPS neste lote.)
