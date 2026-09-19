# ERP-RUNTIME-08B — Runbook do gate VPS

O primeiro gate aplicou a 014 uma vez no DEV, mas o seed falhou antes de
concluir porque a condição ativa e suas parcelas estavam em commits separados.
O hotfix mantém a constraint e agrupa o bloco R08 do seed em uma transação.
Não reaplicar a 014. Este runbook não autoriza SSH, restart, promoção ou alteração da porta 3080.

1. Confirmar que a main e o PR aprovado correspondem ao commit revisado.
2. No gate autorizado: executar precheck, criar backup novo em `/opt/erp-zuccaro/backups` e preservar os rollbacks existentes.
3. Verificar `schema_migrations`: 001–014 registradas uma vez; não reaplicar 014.
4. Retomar executando o seed sintético duas vezes e comprovar idempotência.
5. Executar E2E R08 contra PostgreSQL real.
6. Validar RLS/FORCE, cross-group/cross-company, RBAC sem actor, parcelas inválidas, padrão único, default ClienteEmpresa e auditoria com rollback.
7. Parar a API temporária e registrar as evidências. Não promover 3080 neste gate; merge, build da main, canário e promoção são fases posteriores.
