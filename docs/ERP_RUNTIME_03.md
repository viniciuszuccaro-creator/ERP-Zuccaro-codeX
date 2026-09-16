# ERP-RUNTIME-03 — Produto MASTER DATA

**Status:** pronto para review (sem deploy VPS neste lote)  
**Branch:** `cursor/erp-runtime-03-392b`  
**Base main:** `411edc6a`  
**Pré-requisito:** RUNTIME-01/02 + audit fix na main

## Objetivo

Transformar Produto em **MASTER DATA** sólido, separado de dados transacionais (estoque, preço, custo, fiscal operacional, produção).

## O que NÃO é Produto neste lote

saldo · movimentação · custo médio · preço · ICMS/PIS/COFINS · pedido · compra · OP

## Implementado

| Item | Detalhe |
|---|---|
| Migrations | `007_produtos_master_data.sql`, `008_produtos_fk_tenant.sql` (001–006 imutáveis) |
| Campos A/B/C + D cadastral | codigo_barras, tipo_item, medidas, bitola, ncm/cest/origem, JSON conversões |
| ProdutoService | tenant + FK same-group + reject operacional + paginação + busca |
| API | LIST com `meta{limit,offset,total,hasMore}`, GET/POST/PATCH/DELETE soft |
| Auditoria | `sanitizeAuditSnapshot` completo |
| HttpApiClient | `preparedEntities.Produto` expandido; **fora** de `HTTP_PILOT_ENTITIES` |
| Seed | PRODUTO DEV SINTETICO A/B |

## Tenant FK

Produto Grupo A **não** pode referenciar Marca/Unidade/GrupoProduto/Setor do Grupo B (DB trigger + service `TENANT_FK_MISMATCH` 409).

## Docs

- `docs/ERP_RUNTIME_03_PRODUTO_MATRIX.md`
- `docs/ERP_RUNTIME_03_PRODUTO_UI_GAP.md`
- `docs/ERP_RUNTIME_03_DEV_RUNBOOK.md`

## Proibições

Sem Hostinger/SSH/migrate remoto · sem merge main · sem DNS/HTTPS · sem ativar Produto no frontend · sem Base44 removal
