# ERP-RUNTIME-04 — Runbook DEV (migration 009 + seed Cliente)

**NÃO executar pelo Cursor Cloud Agent sem acesso autorizado.** Humano no VPS. Um comando por etapa.

Antes: **pg_dump**.

```bash
cd /opt/erp-zuccaro
```

```bash
git fetch origin
```

```bash
git pull origin cursor/erp-runtime-04-cliente-master-data-392b
```

```bash
mkdir -p /opt/erp-zuccaro/backups
```

```bash
docker exec supabase-db pg_dump -U postgres -d postgres > /opt/erp-zuccaro/backups/pre-runtime04-$(date +%Y%m%d%H%M).sql
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

Confirmar presença de `009_clientes_master_data.sql` em `schema_migrations`.

```bash
docker exec -i supabase-db psql -U postgres -d postgres < /opt/erp-zuccaro/server/scripts/seed-dev-synthetic.sql
```

```bash
docker exec -i supabase-db psql -U postgres -d postgres < /opt/erp-zuccaro/server/scripts/seed-dev-synthetic.sql
```

(segunda execução: idempotente — sem duplicate key)

## Smoke SQL (somente leitura)

```bash
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
SELECT id, group_id, codigo, tipo, documento_normalizado, ativo
FROM clientes
WHERE id IN (
  '99999999-aaaa-4aaa-8aaa-999999999991',
  '99999999-aaaa-4aaa-8aaa-999999999992',
  '99999999-bbbb-4bbb-8bbb-999999999993'
)
ORDER BY group_id, codigo;
SQL
```

Esperado: 2 clientes no Grupo A (PJ+PF) e 1 no Grupo B (PJ).

## API smoke (após restart do BFF)

Headers: `x-group-id` / `x-empresa-id` do seed.

- `GET /api/v1/meta` → `runtime: ERP-RUNTIME-04`, `cliente.frontendHttp: false`
- `GET /api/v1/clientes?limit=10` no Grupo A → 2 ativos
- `GET /api/v1/clientes` no Grupo B → não lista clientes A
- POST com mesmo CNPJ formatado diferente → `409 DUPLICATE_DOCUMENT`

## Rollback

Restaurar dump `pre-runtime04-*.sql`. Não dropar tabelas em produção/DEV sem plano.
