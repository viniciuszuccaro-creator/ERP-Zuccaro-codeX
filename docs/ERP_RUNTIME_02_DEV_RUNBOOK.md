# ERP-RUNTIME-02 — Runbook DEV (comandos curtos)

**NÃO executar pelo Cursor.** Humano no VPS Hostinger.  
Console Web Hostinger: **um comando por etapa** (evita corrupção).

Pré-requisito: ERP-RUNTIME-01 + DEV-DEPLOY-01 já no ar; Marca saudável.

Antes de qualquer migrate no VPS: **pg_dump**.

---

## 0) Ir ao projeto

```bash
cd /opt/erp-zuccaro
```

---

## 1) Status git

```bash
git status
```

```bash
git fetch origin
```

```bash
git log -1 --oneline
```

---

## 2) Backup PostgreSQL (OBRIGATÓRIO)

```bash
mkdir -p /opt/backups/erp
```

```bash
docker exec supabase-db pg_dump -U postgres -d postgres > /opt/backups/erp/pre-runtime02-$(date +%Y%m%d%H%M).sql
```

```bash
ls -lh /opt/backups/erp | tail
```

---

## 3) Pull da branch (quando autorizada)

```bash
git pull origin cursor/erp-runtime-02-392b
```

(Alternativa pós-merge: `git pull origin main`.)

---

## 4) Migration status (ANTES)

```bash
cd /opt/erp-zuccaro/server
```

```bash
node dist/db/migrate.js --status
```

---

## 5) Build API

```bash
cd /opt/erp-zuccaro/server
```

```bash
npm ci
```

```bash
npm run build
```

---

## 6) Migrar

```bash
cd /opt/erp-zuccaro/server
```

```bash
node dist/db/migrate.js
```

---

## 7) Migration status (DEPOIS)

```bash
node dist/db/migrate.js --status
```

Esperado: `001` … `006` aplicadas.

---

## 8) Seed sintético (idempotente)

```bash
docker exec -i supabase-db psql -U postgres -d postgres < /opt/erp-zuccaro/server/scripts/seed-dev-synthetic.sql
```

---

## 9) Rebuild containers ERP

```bash
cd /opt/erp-zuccaro
```

```bash
docker compose -f docker-compose.erp.yml build
```

```bash
docker compose -f docker-compose.erp.yml up -d
```

---

## 10) Health / Ready

```bash
curl -sS http://127.0.0.1:3080/health
```

```bash
curl -sS http://127.0.0.1:3080/ready
```

```bash
curl -sS http://127.0.0.1:3080/api/v1/meta
```

---

## 11) Smoke tenant A (UnidadeMedida)

```bash
curl -sS -X POST http://127.0.0.1:3080/api/v1/unidades-medida -H 'content-type: application/json' -H 'x-group-id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' -H 'x-empresa-id: cccccccc-cccc-4ccc-8ccc-cccccccccccc' -H 'x-request-id: smoke-u-a' -d '{"sigla":"TO","nome_completo":"Tonelada Smoke A"}'
```

```bash
curl -sS 'http://127.0.0.1:3080/api/v1/unidades-medida' -H 'x-group-id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
```

---

## 12) Smoke isolamento B

```bash
curl -sS 'http://127.0.0.1:3080/api/v1/unidades-medida' -H 'x-group-id: bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
```

Grupo B **não** deve ver registros exclusivos do Grupo A.

---

## 13) Smoke cross-tenant (deve falhar 409)

```bash
curl -sS -o /tmp/cross.json -w '%{http_code}\n' -X POST http://127.0.0.1:3080/api/v1/unidades-medida -H 'content-type: application/json' -H 'x-group-id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' -d '{"sigla":"XT","nome_completo":"Cross","empresa_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}'
```

```bash
cat /tmp/cross.json
```

Esperado: HTTP `409` + `TENANT_MISMATCH`.

---

## 14) Rollback (preferência)

1. Nova migration corretiva (não editar 004–006 aplicadas).
2. Restore do dump **somente** em incidente controlado:

```bash
# SOMENTE com autorização explícita
# docker exec -i supabase-db psql -U postgres -d postgres < /opt/backups/erp/ARQUIVO.sql
```

---

## Proibido neste runbook

- Abrir 5432/8000 publicamente
- Alterar UFW / DOCKER-USER
- Resetar Supabase
- Migrar dados reais CPA
- Configurar DNS/Caddy/HTTPS neste lote
