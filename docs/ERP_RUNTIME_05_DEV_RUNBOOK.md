# ERP-RUNTIME-05 — Runbook DEV

**Status:** `IMPLEMENTATION_READY — DEV_MIGRATION_PENDING`

Não executar antes do review/aprovação. Execução humana no VPS DEV; nunca em
PROD. Não remover `erp-api-dev-runtime03-backup` nem dumps existentes.

## 1. Atualizar código e validar

```bash
cd /opt/erp-zuccaro
```

```bash
git fetch origin
```

```bash
git pull origin cursor/erp-runtime-05-cliente-empresa-392b
```

```bash
cd /opt/erp-zuccaro/server
```

```bash
npm ci
```

```bash
npm run test
```

```bash
npm run typecheck
```

```bash
npm run build
```

## 2. Backup obrigatório

```bash
mkdir -p /opt/erp-zuccaro/backups
```

```bash
docker exec supabase-db pg_dump -U postgres -d postgres > /opt/erp-zuccaro/backups/pre-runtime05-$(date +%Y%m%d%H%M).sql
```

## 3. Conferir e aplicar migration

```bash
node dist/db/migrate.js --status
```

Esperado antes: 001–009 aplicadas; 010 pendente.

```bash
node dist/db/migrate.js
```

```bash
node dist/db/migrate.js --status
```

Esperado depois: `010_cliente_empresas_comercial.sql` aplicada.

## 4. Seed sintético convergente

```bash
docker exec -i supabase-db psql -U postgres -d postgres < /opt/erp-zuccaro/server/scripts/seed-dev-synthetic.sql
```

```bash
docker exec -i supabase-db psql -U postgres -d postgres < /opt/erp-zuccaro/server/scripts/seed-dev-synthetic.sql
```

A segunda execução não pode duplicar ClienteEmpresa.

## 5. Verificações

- Cliente PJ A possui vínculos Empresa A e Empresa A2;
- A está liberado; A2 está bloqueado com motivo/actor;
- Cliente B permanece isolado no Grupo B;
- Cliente A + Empresa B é bloqueado no banco;
- vínculo repetido permanece único;
- `cliente_empresas` mantém RLS ENABLE/FORCE;
- LIST/GET/create/update/block/unblock/inactivate/restore funcionam;
- Empresa A não acessa A2; Grupo A autorizado consolida A/A2;
- actor sem cada permissão recebe 403;
- list/count/filtros/paginação/busca são consistentes;
- auditoria contém link/update/block/unblock/inactivate/restore sem CPF/CNPJ.

## 6. Restrições

- não ativar `ClienteEmpresa` ou `Cliente` em `HTTP_PILOT_ENTITIES`;
- não migrar campos comerciais Base44 nem habilitar dual-write;
- não acessar PROD;
- não remover rollback RUNTIME-03;
- não iniciar RUNTIME-06.

## Rollback

Em falha, parar a API nova e restaurar o dump `pre-runtime05-*` conforme
procedimento operacional aprovado. Não executar DROP/limpeza manual sem
autorização.
