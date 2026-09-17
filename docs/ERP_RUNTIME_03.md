# ERP-RUNTIME-03 — Produto MASTER DATA

**Status:** soft-delete visibility fix (sem deploy VPS neste lote)
**Branch:** `cursor/runtime03-produto-soft-delete-visibility-fix-392b`
**Base main:** `d7d027de`
**Pré-requisito:** seed reconciliation na main

## Objetivo

Transformar Produto em **MASTER DATA** sólido, separado de dados transacionais (estoque, preço, custo, fiscal operacional, produção).

## O que NÃO é Produto neste lote

saldo · movimentação · custo médio · preço · ICMS/PIS/COFINS · pedido · compra · OP

## Implementado

| Item | Detalhe |
|---|---|
| Migrations | `007_produtos_master_data.sql`, `008_produtos_fk_tenant.sql` (001–008 imutáveis neste fix) |
| Campos A/B/C + D cadastral | codigo_barras, tipo_item, medidas, bitola, ncm/cest/origem, JSON conversões |
| ProdutoService | tenant + FK same-group + reject operacional + paginação + busca |
| API | LIST com `meta{limit,offset,total,hasMore}`, GET/POST/PATCH/DELETE soft |
| Auditoria | `sanitizeAuditSnapshot` completo |
| HttpApiClient | `preparedEntities.Produto` expandido; **fora** de `HTTP_PILOT_ENTITIES` |
| Seed | PRODUTO DEV SINTETICO A/B com Marca B REAL tenant-scoped |

## Tenant FK

Produto Grupo A **não** pode referenciar Marca/Unidade/GrupoProduto/Setor do Grupo B (DB trigger + service `TENANT_FK_MISMATCH` 409).

## Seed tenant fix (RUNTIME-03)

Causa: ID `ffffffff-ffff-4fff-8fff-ffffffffffff` (nome histórico "MARCA TESTE B") no DEV pertence ao **Grupo A**; Produto B apontava para esse ID → `TENANT_FK_MISMATCH` (proteção correta).

Correção no seed (sem migration, sem mover tenant legado):

| Papel | ID | Tenant |
|---|---|---|
| Marca LEGACY | `ffffffff-ffff-4fff-8fff-ffffffffffff` | Grupo A / Empresa A (não mover) |
| Marca B REAL | `b0b0b0b0-bbbb-4bbb-8bbb-b0b0b0b0b0b0` | Grupo B / Empresa B |
| Produto B | usa Marca B REAL + FKs B | Grupo B |

**Reconciliação (partial-state):** Produto A/B usam `ON CONFLICT (id) DO UPDATE` **somente** nos IDs sintéticos `77777777-…` e `88888888-…`, para convergir `marca_id` legado → Marca B REAL sem tocar registros reais. Demais entidades do seed: `DO NOTHING`. Trigger 008 permanece ativo.

Constantes: `server/scripts/seedDevIds.ts`.

## Soft delete — visibilidade operacional

| Operação | Semântica |
|---|---|
| `GET /produtos` e `?search=` | **default `ativo=true`** (list + count + paginação). Soft-deleted não aparece. |
| `GET /produtos/:id` | soft-deleted → **404** `PRODUTO_NOT_FOUND` |
| `PATCH /produtos/:id` | soft-deleted → **404** (não edita inativo) |
| `DELETE /produtos/:id` | já inativo → **404** idempotente (sem audit false→false) |
| Persistência | registro permanece no Postgres (`ativo=false`); audit `soft_delete` intacta |

Filtro `ativo` combina com `group_id` (tenant). Sem `includeDeleted` neste lote.

## Docs

- `docs/ERP_RUNTIME_03_PRODUTO_MATRIX.md`
- `docs/ERP_RUNTIME_03_PRODUTO_UI_GAP.md`
- `docs/ERP_RUNTIME_03_DEV_RUNBOOK.md`

## Proibições

Sem Hostinger/SSH/migrate remoto · sem merge main · sem DNS/HTTPS · sem ativar Produto no frontend · sem Base44 removal
