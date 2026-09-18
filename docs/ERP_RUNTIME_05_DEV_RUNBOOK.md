# ERP-RUNTIME-05 — Runbook DEV

**Status:** `ERP-RUNTIME-05 — CONCLUÍDO E VALIDADO NO DEV`

Executado manualmente e aprovado no DEV em 18/09/2026. Este runbook permanece
como histórico operacional; não reexecutar sem nova autorização e backup.
Nunca executar em PROD. Não remover backups ou dumps existentes.

## Procedimento histórico executado

### 1. Atualizar código e validar

```bash
cd /opt/erp-zuccaro
```

```bash
git fetch origin
```

```bash
git pull origin main
```

Referência oficial: `079f594c798c33d903cd4e70a673f9f068639142`.

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

### 2. Backup obrigatório

```bash
mkdir -p /opt/erp-zuccaro/backups
```

```bash
docker exec supabase-db pg_dump -U postgres -d postgres > /opt/erp-zuccaro/backups/pre-runtime05-$(date +%Y%m%d%H%M).sql
```

### 3. Conferir e aplicar migration

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

### 4. Seed sintético convergente

```bash
docker exec -i supabase-db psql -U postgres -d postgres < /opt/erp-zuccaro/server/scripts/seed-dev-synthetic.sql
```

```bash
docker exec -i supabase-db psql -U postgres -d postgres < /opt/erp-zuccaro/server/scripts/seed-dev-synthetic.sql
```

A segunda execução não pode duplicar ClienteEmpresa.

### 5. Verificações

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
- mutation e INSERT em `audit_logs` compartilham a mesma transação;
- falha forçada de auditoria mantém link/update/block/unblock/inactivate/restore
  no estado anterior;
- criação de Cliente com `empresa_id` também rollbacka Cliente + vínculo se a
  auditoria falhar.

## Resultado confirmado

- migrations 001–010: OK;
- migration 010 aplicada;
- seed executado duas vezes e convergente;
- API DEV oficial: ERP-RUNTIME-05;
- multiempresa, RBAC, RLS, unicidade, lifecycle, auditoria, atomicidade e PII:
  aprovados;
- `BAD_LINKS=0`, `DUP_COUNT=0`, `RLS_STATE=true|true`;
- ClienteEmpresa continua fora de `HTTP_PILOT_ENTITIES`.

## Restrições preservadas

- não ativar `ClienteEmpresa` ou `Cliente` em `HTTP_PILOT_ENTITIES`;
- não migrar campos comerciais Base44 nem habilitar dual-write;
- não acessar PROD;
- não remover rollback RUNTIME-03;
- não iniciar RUNTIME-06 neste closeout.

## Rollback

Em falha, parar a API nova e restaurar o dump `pre-runtime05-*` conforme
procedimento operacional aprovado. Não executar DROP/limpeza manual sem
autorização.

`erp-api-dev-runtime04-backup` e `erp-api-dev-runtime03-backup` permanecem
preservados temporariamente. Não executar prune/removal nesta tarefa.
