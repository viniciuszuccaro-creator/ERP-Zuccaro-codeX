# ERP-RUNTIME-08B — Runbook do gate VPS

Este runbook é preparatório. Não autoriza SSH, aplicação de migration, restart, promoção ou alteração da porta 3080.

1. Confirmar que a main e o PR aprovado correspondem ao commit revisado.
2. No gate autorizado: executar precheck, criar backup novo em `/opt/erp-zuccaro/backups` e preservar os rollbacks existentes.
3. Verificar `schema_migrations`: 001–013 registradas uma vez e 014 ausente.
4. Aplicar somente `014_condicoes_pagamento.sql` em transação controlada.
5. Executar seed sintético duas vezes e comprovar idempotência.
6. Validar RLS/FORCE, cross-group/cross-company, RBAC sem actor, parcelas inválidas, padrão único, default ClienteEmpresa e auditoria com rollback.
7. Parar a API temporária e registrar as evidências. Não promover 3080 neste gate; merge, build da main, canário e promoção são fases posteriores.
