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
git pull origin cursor/runtime03-seed-tenant-fix-392b
```

```bash
mkdir -p /opt/erp-zuccaro/backups
```

```bash
docker exec supabase-db pg_dump -U postgres -d postgres > /opt/erp-zuccaro/backups/pre-runtime03-seed-fix-$(date +%Y%m%d%H%M).sql
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
docker exec -i supabase-db psql -U postgres -d postgres < /opt/erp-zuccaro/server/scripts/seed-dev-synthetic.sql
```

(segunda execução: idempotente — sem duplicate key / TENANT_FK_MISMATCH)

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

Smoke Produto B (Grupo B — Marca B REAL `b0b0b0b0-...`, NÃO o legado `ffffffff`):

```bash
curl -sS 'http://127.0.0.1:3080/api/v1/produtos?limit=5' -H 'x-group-id: bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
```

Cross-tenant FK: Produto Grupo A + Marca B REAL → deve 409 `TENANT_FK_MISMATCH`:

```bash
curl -sS -o /tmp/fk.json -w '%{http_code}\n' -X POST http://127.0.0.1:3080/api/v1/produtos -H 'content-type: application/json' -H 'x-group-id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' -H 'x-empresa-id: cccccccc-cccc-4ccc-8ccc-cccccccccccc' -d '{"descricao":"FK Cross","marca_id":"b0b0b0b0-bbbb-4bbb-8bbb-b0b0b0b0b0b0"}'
```

Cross-tenant FK: Produto Grupo B + Marca LEGACY `ffffffff` (Grupo A) → deve 409:

```bash
curl -sS -o /tmp/fk-legacy.json -w '%{http_code}\n' -X POST http://127.0.0.1:3080/api/v1/produtos -H 'content-type: application/json' -H 'x-group-id: bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' -H 'x-empresa-id: dddddddd-dddd-4ddd-8ddd-dddddddddddd' -d '{"descricao":"FK Legacy","marca_id":"ffffffff-ffff-4fff-8fff-ffffffffffff"}'
```

```bash
cat /tmp/fk.json
```

```bash
cat /tmp/fk-legacy.json
```

## Seed tenant (IDs)

| Papel | ID | group_id | empresa_id |
|---|---|---|---|
| Marca A | `eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee` | Grupo A | Empresa A |
| Marca LEGACY (nome histórico "TESTE B") | `ffffffff-ffff-4fff-8fff-ffffffffffff` | Grupo A | Empresa A |
| Marca B REAL | `b0b0b0b0-bbbb-4bbb-8bbb-b0b0b0b0b0b0` | Grupo B | Empresa B |

Nomes "A"/"B" **não** definem tenant. Não mover o legado `ffffffff` para o Grupo B.

**Partial-state:** se Produto B já existir com `marca_id = ffffffff`, a reexecução do seed (UPSERT só no ID `88888888-…`) reconcilia para Marca B REAL. Registros com outros IDs não são alterados.

Rollback: nova migration corretiva; restore só em incidente controlado.
