# ERP-RUNTIME-03 — Runbook DEV (comandos curtos)

**NÃO executar pelo Cursor.** Humano no VPS. Um comando por etapa.

Antes: **pg_dump**.

```bash
cd /opt/erp-zuccaro
```

```bash
git fetch origin
```

```bash
git pull origin cursor/erp-runtime-03-392b
```

```bash
mkdir -p /opt/erp-zuccaro/backups
```

```bash
docker exec supabase-db pg_dump -U postgres -d postgres > /opt/erp-zuccaro/backups/pre-runtime03-$(date +%Y%m%d%H%M).sql
```

```bash
cd /opt/erp-zuccaro/server
```

```bash
npm ci
```

```bash
npm run build
```

```bash
node dist/db/migrate.js --status
```

```bash
node dist/db/migrate.js
```

```bash
node dist/db/migrate.js --status
```

```bash
docker exec -i supabase-db psql -U postgres -d postgres < /opt/erp-zuccaro/server/scripts/seed-dev-synthetic.sql
```

```bash
cd /opt/erp-zuccaro
```

```bash
docker compose -f docker-compose.erp.yml build
```

```bash
docker compose -f docker-compose.erp.yml up -d
```

```bash
curl -sS http://127.0.0.1:3080/health
```

```bash
curl -sS http://127.0.0.1:3080/ready
```

```bash
curl -sS http://127.0.0.1:3080/api/v1/meta
```

Smoke Produto A (paginação):

```bash
curl -sS 'http://127.0.0.1:3080/api/v1/produtos?limit=5' -H 'x-group-id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
```

Cross-tenant FK (deve 409):

```bash
curl -sS -o /tmp/fk.json -w '%{http_code}\n' -X POST http://127.0.0.1:3080/api/v1/produtos -H 'content-type: application/json' -H 'x-group-id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' -H 'x-empresa-id: cccccccc-cccc-4ccc-8ccc-cccccccccccc' -d '{"descricao":"FK Cross","marca_id":"ffffffff-ffff-4fff-8fff-ffffffffffff"}'
```

```bash
cat /tmp/fk.json
```

Rollback: nova migration corretiva; restore só em incidente controlado.
