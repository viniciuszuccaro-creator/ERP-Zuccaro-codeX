# ERP-RUNTIME-03 — Produto MASTER DATA

**Status:** seed tenant A/B corrigido (sem deploy VPS neste lote)
**Branch:** `cursor/runtime03-seed-tenant-fix-392b`
**Base main:** `e4fb0ed0`
**Pré-requisito:** RUNTIME-03 na main (`e4fb0ed0`)

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

Constantes: `server/scripts/seedDevIds.ts`.

## Docs

- `docs/ERP_RUNTIME_03_PRODUTO_MATRIX.md`
- `docs/ERP_RUNTIME_03_PRODUTO_UI_GAP.md`
- `docs/ERP_RUNTIME_03_DEV_RUNBOOK.md`

## Proibições

Sem Hostinger/SSH/migrate remoto · sem merge main · sem DNS/HTTPS · sem ativar Produto no frontend · sem Base44 removal
