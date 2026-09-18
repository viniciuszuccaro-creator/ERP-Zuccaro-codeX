# ERP-RUNTIME-06A — Runbook DEV

**Status:** `IMPLEMENTATION_READY — DEV_MIGRATION_PENDING`

Execução futura exclusivamente humana e após review. Não acessar PROD, não
remover backups e não iniciar RUNTIME-06B.

## 1. Precheck

```bash
cd /opt/erp-zuccaro
```

```bash
git fetch origin
```

```bash
git pull origin cursor/erp-runtime-06a-cliente-locais-392b
```

```bash
cd /opt/erp-zuccaro/server
```

```bash
npm ci
```

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build
```

```bash
node dist/db/migrate.js --status
```

Esperado: migrations 001–010 aplicadas e 011 pendente.

## 2. Backup

```bash
mkdir -p /opt/erp-zuccaro/backups
```

```bash
docker exec supabase-db pg_dump -U postgres -d postgres > /opt/erp-zuccaro/backups/pre-runtime06a-$(date +%Y%m%d%H%M).sql
```

## 3. Migration

```bash
node dist/db/migrate.js
```

```bash
node dist/db/migrate.js --status
```

Confirmar `011_cliente_locais.sql`.

## 4. Seed duas vezes

```bash
docker exec -i supabase-db psql -U postgres -d postgres < /opt/erp-zuccaro/server/scripts/seed-dev-synthetic.sql
```

```bash
docker exec -i supabase-db psql -U postgres -d postgres < /opt/erp-zuccaro/server/scripts/seed-dev-synthetic.sql
```

Confirmar quatro Locais sintéticos, finalidades convergentes e nenhum propósito
OBRA.

## 5. Estrutura e integridade

- tabelas `cliente_locais` e `cliente_local_finalidades`;
- RLS ENABLE/FORCE em ambas;
- Cliente/Local cross-group bloqueado;
- uma finalidade por Local;
- no máximo um principal por Cliente/finalidade;
- nenhum campo/tabela Obra;
- nenhum backfill real.

## 6. E2E em API temporária

- `/api/v1/meta` retorna `ERP-RUNTIME-06A`;
- Grupo A cria/lista/edita Locais;
- multifinalidade no mesmo Local;
- troca de principal ENTREGA;
- concorrência termina com um único principal;
- Empresa A elegível acessa;
- Empresa A2 sem elegibilidade recebe 403;
- Grupo B recebe 404;
- RBAC por ação recebe 403 quando negado;
- geo válido/ausente aceito; limites inválidos bloqueados;
- equivalente formatado retorna `POSSIBLE_DUPLICATE`;
- complemento distinto permitido;
- Local principal não pode ser inativado;
- após remover principal: inactivate/GET 404/restore;
- paginação/count/busca/filtros;
- auditoria atômica sem endereço completo;
- falha de auditoria rollbacka PATCH e SET_PRIMARY.

## 7. Promoção

Promover imagem/API oficial somente após aprovação explícita do E2E. Até lá, a
API DEV oficial permanece ERP-RUNTIME-05.

Não ativar ClienteLocal em `HTTP_PILOT_ENTITIES`.

## Rollback

Restaurar o dump `pre-runtime06a-*` pelo procedimento aprovado. Não executar
DROP, prune ou remoção de backups sem autorização.
