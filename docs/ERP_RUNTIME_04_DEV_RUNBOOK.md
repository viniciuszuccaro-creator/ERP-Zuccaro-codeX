# ERP-RUNTIME-04 — Runbook DEV (migration 009 + seed Cliente)

**Status:** executado e aprovado manualmente no DEV em 18/09/2026.

**Histórico operacional:** manter este runbook para rastreabilidade. Não
reexecutar migration/seed nem alterar o VPS nesta tarefa. Qualquer repetição
futura exige autorização, backup e conferência de `schema_migrations`.

**NÃO executar pelo Cursor Cloud Agent sem acesso autorizado.** Humano no VPS.
Um comando por etapa.

## Procedimento histórico aplicado

Antes: **pg_dump**.

```bash
cd /opt/erp-zuccaro
```

```bash
git fetch origin
```

```bash
git pull origin main
```

Referência oficial incorporada: `e3fbbf324e8727acfb9cdefab546bda3c243a3f0`.

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

Headers: `x-group-id` / `x-empresa-id` e `x-actor-id` sintéticos do seed.

- Actor A: `a4a4a4a4-aaaa-4aaa-8aaa-a4a4a4a4a4a4`
- Actor B: `b4b4b4b4-bbbb-4bbb-8bbb-b4b4b4b4b4b4`

- `GET /api/v1/meta` → `runtime: ERP-RUNTIME-04`, `cliente.frontendHttp: false`
- `GET /api/v1/clientes?limit=10` no Grupo A → 2 ativos
- `GET /api/v1/clientes` no Grupo B → não lista clientes A
- POST com mesmo CNPJ formatado diferente → `409 DUPLICATE_DOCUMENT`
- Actor A + `x-group-id` B → `403 PERMISSION_DENIED`

## Verificações de integridade

Antes do apply no DEV, o teste automatizado executa migrations 001–009 em
PostgreSQL embutido. Após o apply humano, repetir no DEV:

- Cliente A + Grupo B + Empresa B em `cliente_empresas` → bloqueado;
- Cliente A + Grupo A + Empresa B → bloqueado;
- Cliente A + Grupo A + Empresa A → permitido;
- role sem BYPASSRLS → zero linhas em `clientes`, `cliente_empresas` e
  `entity_code_sequences`;
- role comum não executa `reserve_entity_codigo`;
- duas reservas concorrentes no Grupo A retornam códigos diferentes;
- Grupo A e Grupo B mantêm sequências independentes.

## Rollback

Restaurar dump `pre-runtime04-*.sql`. Não dropar tabelas em produção/DEV sem plano.

O container `erp-api-dev-runtime03-backup` e os dumps pre-runtime04 estão
preservados temporariamente. Não remover até decisão posterior após o período de
estabilidade.
