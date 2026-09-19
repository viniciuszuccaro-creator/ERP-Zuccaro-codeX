# ERP-RUNTIME-07B — DEV Runbook (não executar neste lote)

**Status:** documentação apenas. **NÃO** aplicar 013 no DEV remoto. **NÃO**
acessar VPS. **NÃO** promover API.

## Pré-requisitos

- Baseline mergeado com 001–012.
- Branch de código `cursor/erp-runtime-07b-tabela-preco-392b` aprovada.
- Review humano da especificação 07A e desta implementação.
- `DATABASE_URL` PostgreSQL real de DEV (não PGlite).

## Passos futuros (quando autorizados)

1. Backup / snapshot do schema DEV.
2. `npm run migrate` no server apontando para DEV (aplica `013_tabelas_preco.sql`).
3. Rodar `seed-dev-synthetic.sql` (idempotente) se ambiente sintético.
4. Gate PostgreSQL real: RLS/FORCE, FK/triggers, concorrência, IDOR, RBAC.
5. Atualizar meta runtime DEV para `ERP-RUNTIME-07B` somente após gate verde.
6. Manter `frontendHttp=false` e `HTTP_PILOT_ENTITIES` sem TabelaPreco.

## Rollback conceitual

- Não dropar 001–012.
- Se necessário, desativar rotas/feature flag e manter dados (soft).
- Rollback destrutivo de 013 exige plano e autorização explícitos.

## Checklist de promoção

- [ ] Review PR de código
- [ ] Gate PG real verde
- [ ] Seed 2× convergente no DEV
- [ ] Meta `frontendHttp=false` confirmada
- [ ] Sem dual-write Base44
- [ ] Sem merge automático deste runbook
