# ERP-RUNTIME-08B — Runbook do gate VPS

O container temporário R08B iniciou normalmente, mas `/api/v1/meta` ainda
informava `ERP-RUNTIME-07B`. O gate aguardou `ERP-RUNTIME-08B`, expirou e seu
cleanup enviou `SIGTERM`; não houve crash ou OOM. O hotfix da branch corrige
somente essa metadata, sem ativar frontend HTTP. Este runbook não autoriza SSH,
restart, promoção ou alteração da porta 3080.

1. Confirmar que a main e o PR aprovado correspondem ao commit revisado.
2. No gate autorizado: executar precheck, criar backup novo em `/opt/erp-zuccaro/backups` e preservar os rollbacks existentes.
3. Verificar `schema_migrations`: 001–015 registradas uma vez; não reaplicar 014 ou 015.
4. Executar o seed sintético duas vezes para atualizar somente o RBAC idempotente
   de Condição de Pagamento. Não usar wildcard e não conceder a outros perfis.
5. Subir o canário temporário e exigir `/api/v1/meta.runtime = ERP-RUNTIME-08B`,
   `CondicaoPagamento` em `preparedEntities` e `frontendHttp=false` fora do piloto HTTP.
6. Para LIST/GET autorizado, usar o actor A
   `a4a4a4a4-aaaa-4aaa-8aaa-a4a4a4a4a4a4`, Grupo A
   `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` e Empresa A
   `cccccccc-cccc-4ccc-8ccc-cccccccccccc`. Sem actor e actor B no Grupo A devem
   retornar 403; Empresa B no Grupo A deve retornar `TENANT_MISMATCH`.
7. No worktree exato do PR, instalar dependências de teste em ambiente efêmero,
   fornecer `DATABASE_URL` somente pela sessão autorizada e executar
   `npm run test:postgres`. O runner exige `DATABASE_URL` e falha se
   `POSTGRES_E2E_TOTAL_TESTS` for zero. Não executar testes dentro da imagem
   runtime: ela contém somente dependências de produção e zero testes é esperado.
8. Validar RLS/FORCE, cross-group/cross-company, RBAC sem actor, parcelas inválidas, padrão único, default ClienteEmpresa e auditoria com rollback.
9. Parar a API temporária e registrar as evidências. A API oficial 3080 continua
   R07B; não promover 3080, não fazer merge e não criar migration 016 neste gate.

O teste `runtime08-postgres-e2e` conecta no PostgreSQL real e cobre LIST/GET
via API, RBAC, tenant cross-group e uma transação rollbackável de criação,
atualização e substituição de parcelas. Os testes de serviço/auditoria e as
barreiras de commit continuam cobertos pela suíte PGlite; PGlite não substitui
este gate PostgreSQL real.
