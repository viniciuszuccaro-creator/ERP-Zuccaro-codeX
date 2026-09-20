# ERP-RUNTIME-08B — Runbook do gate VPS

O container temporário R08B iniciou normalmente, mas `/api/v1/meta` ainda
informava `ERP-RUNTIME-07B`. O gate aguardou `ERP-RUNTIME-08B`, expirou e seu
cleanup enviou `SIGTERM`; não houve crash ou OOM. O hotfix da branch corrige
somente essa metadata, sem ativar frontend HTTP. Este runbook não autoriza SSH,
restart, promoção ou alteração da porta 3080.

1. Confirmar que a main e o PR aprovado correspondem ao commit revisado.
2. No gate autorizado: executar precheck, criar backup novo em `/opt/erp-zuccaro/backups` e preservar os rollbacks existentes.
3. Verificar `schema_migrations`: 001–015 registradas uma vez; não reaplicar 014 ou 015.
4. Subir o canário temporário e exigir `/api/v1/meta.runtime = ERP-RUNTIME-08B`,
   `CondicaoPagamento` em `preparedEntities` e `frontendHttp=false` fora do piloto HTTP.
5. Executar E2E R08 contra PostgreSQL real. O seed já passou duas vezes e não
   deve ser reaplicado neste gate.
6. Validar RLS/FORCE, cross-group/cross-company, RBAC sem actor, parcelas inválidas, padrão único, default ClienteEmpresa e auditoria com rollback.
7. Parar a API temporária e registrar as evidências. A API oficial 3080 continua
   R07B; não promover 3080, não fazer merge e não criar migration 016 neste gate.
