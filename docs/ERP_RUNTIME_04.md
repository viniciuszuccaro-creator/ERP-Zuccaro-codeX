# ERP-RUNTIME-04 — Cliente MASTER DATA

**Status:** `IMPLEMENTATION_READY — DEV_MIGRATION_PENDING`
**Branch:** `cursor/erp-runtime-04-cliente-master-data-392b`
**Base:** `74b68257` (precheck DEV aprovado)
**Pré-requisito:** migrations 001–008 confirmadas no PostgreSQL DEV

## Objetivo

Consolidar **Cliente** como MASTER DATA real no PostgreSQL/API do ERP Zuccaro.

Este lote **não** é Cliente 360º. É a fundação de identidade reutilizável por Comercial, Pedido, CRM, Financeiro, Fiscal, Portal, Site, Marketplace, etc.

## Modelo

```
CLIENTE MASTER (group_id)
        |
        +---- cliente_empresas (vínculo operacional futuro)
        |
        +---- contatos / endereços / pedidos / … (lotes futuros)
```

- Identidade no **Grupo** (não duplicar por empresa).
- Relacionamento empresa em `cliente_empresas` (mínimo neste lote).
- PF e PJ no mesmo agregado (`tipo`).
- Código sequencial via `reserve_entity_codigo(group_id, 'Cliente')`.
- Unicidade de documento: `documento_normalizado` por `group_id`.

## Implementado

| Item | Detalhe |
|---|---|
| Migration | `009_clientes_master_data.sql` |
| Validadores | `documentoValidators.ts` (CPF/CNPJ + máscara) |
| Service/API | CREATE/GET/LIST/SEARCH/COUNT/UPDATE/INACTIVATE/RESTORE |
| Soft delete | `ativo=false`; list/search/count default ativo; GET 404; restore dedicado |
| Auditoria | create/update/soft_delete/restore/duplicate_block (documento mascarado) |
| Seed | Cliente PJ/PF A + PJ B sintéticos; UPSERT convergente |
| Frontend HTTP | **fora** de `HTTP_PILOT_ENTITIES` |

## RBAC (chaves canônicas documentadas)

`cadastros.cliente.visualizar|criar|editar|inativar|restaurar|importar|exportar`

Enforcement granular completo permanece no lote Auth; backend já fail-closed por tenant.

## Proibições deste lote

Sem Cliente 360º · sem Pedido 360º · sem Site/Portal/Marketplace paralelo · sem ativar HTTP no frontend · sem merge main · sem RUNTIME-05 · sem aplicar migration no VPS pelo Cloud Agent

## Docs

- `docs/ERP_RUNTIME_04_DEV_RUNBOOK.md`
