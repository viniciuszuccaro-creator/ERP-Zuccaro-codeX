# ERP-RUNTIME-04 — Cliente MASTER DATA

**Status:** `ERP-RUNTIME-04 — CONCLUÍDO E VALIDADO NO DEV`
**Merge oficial:** `e3fbbf324e8727acfb9cdefab546bda3c243a3f0` (PR #16)
**Validação DEV:** 2026-09-18
**Migrations no DEV:** 001–009 confirmadas

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
- `clientes.empresa_id` é somente empresa de origem/preferencial para
  compatibilidade; **não** define ownership da identidade. O relacionamento
  empresarial canônico é `cliente_empresas`.
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
| Integridade | trigger valida Cliente e Empresa contra o mesmo `group_id` |
| RLS | ENABLE + FORCE, sem policy permissiva; sequence sem acesso PUBLIC |

## RBAC backend

`cadastros.cliente.visualizar|criar|editar|inativar|restaurar|importar|exportar`

As ações implementadas usam enforcement real no `ClienteService`, via
`PostgresRbacGuard`. O guard carrega `profiles.permissoes` no backend e reutiliza
o formato canônico do `entityGuard`:
`{ Cadastros: { cliente: ['visualizar', ...] } }`.

- LIST/GET → `visualizar`
- POST → `criar`
- PATCH → `editar`
- DELETE lógico → `inativar`
- POST restore → `restaurar`

Sem actor, perfil tenant-scoped ou permissão: `403 PERMISSION_DENIED`.
Importar/exportar ficam preparados, mas sem endpoints neste lote.
Selecionar Cliente em Pedido será uma permissão própria do fluxo Comercial; não
concede `cadastros.cliente.editar`.

## RLS e sequence

O padrão permanece o de `002_rls_foundation.sql`: BFF com role privilegiada e
tenant + RBAC na aplicação; roles comuns recebem RLS fail-closed sem policies.
`clientes`, `cliente_empresas` e `entity_code_sequences` usam `ENABLE` + `FORCE`.
A tabela e a função de reserva têm privilégios PUBLIC revogados; a função não é
`SECURITY DEFINER`.

Os testes executam migrations 001–009 em PostgreSQL embutido e comprovam:
zero leitura/write para role comum, bloqueio de reserva cross-tenant, sequências
independentes e concorrentes, e integridade Cliente/Empresa/Grupo.

## Validação E2E real no DEV

Em 18/09/2026, a migration `009_clientes_master_data.sql` foi aplicada
manualmente e validada no PostgreSQL DEV. As migrations 001–009 estão OK.

Estruturas confirmadas:

- `clientes`, `cliente_empresas` e `entity_code_sequences`: OK;
- RLS `ENABLE=true` e `FORCE=true` nas três estruturas;
- seed executado duas vezes, convergente e sem duplicação;
- Grupo A com dois clientes-base e Grupo B com um cliente-base.

E2E contra a API e o PostgreSQL DEV:

| Verificação | Resultado |
|---|---|
| Runtime `/api/v1/meta` | `ERP-RUNTIME-04` |
| LIST Grupo A / Grupo B | HTTP 200 |
| Cliente A acessado pelo Grupo B | HTTP 404 |
| RBAC sem actor / actor inválido | HTTP 403 |
| CREATE PF + código sequencial | HTTP 201 / OK |
| GET / busca / paginação e count | HTTP 200 |
| Soft delete / GET após exclusão | HTTP 200 / HTTP 404 |
| Restore | HTTP 200 |
| CNPJ duplicado | HTTP 409 `DUPLICATE_DOCUMENT` |
| Auditoria | create, soft_delete e restore confirmados |
| Documento integral em auditoria | 0 ocorrências; máscara OK |

## Promoção da API DEV

- API oficial DEV: `127.0.0.1:3080`;
- imagem promovida: `erp-zuccaro-erp-api:runtime04-683e0cfb`;
- Cliente MASTER DATA, multiempresa, RBAC, auditoria e API Cliente: OK;
- Cliente continua fora de `HTTP_PILOT_ENTITIES` do frontend;
- rollback RUNTIME-03 preservado temporariamente em
  `erp-api-dev-runtime03-backup`;
- dumps pre-runtime04 também permanecem preservados.

## Limites preservados

Sem Cliente 360º · sem Pedido 360º · sem Site/Portal/Marketplace paralelo ·
sem ativar HTTP no frontend · sem RUNTIME-05.

## Docs

- `docs/ERP_RUNTIME_04_DEV_RUNBOOK.md`
