# ERP-RUNTIME-03 — Matriz MASTER DATA do Produto

**Data:** 2026-09-16  
**Branch:** `cursor/erp-runtime-03-392b`  
**Fonte:** `ProdutoForm.jsx`, `ProdutoFormCompleto.jsx`, `ProdutoFormV22_Completo.jsx`, `VisualizadorProdutos.jsx`, migration `006`.

## Decisões estruturais

| Entidade imaginada | Decisão |
|---|---|
| Categoria | **Não criar** — não existe como `base44.entities.*` |
| SubgrupoProduto | **Não criar** — não existe |
| Fabricante | Usar **Marca** existente |
| Preço / Custo / Estoque operacional | **Adiados** (transactional) |

## Domínios

| Classe | Conteúdo | RUNTIME-03 |
|---|---|---|
| A Identificação | id, codigo, codigo_barras, descricao, nome, status, ativo | **SIM** |
| B Classificação | tipo_item, marca_id, grupo_produto_id, setor_atividade_id, grupo_legado, tipo_aco, eh_bitola | **SIM** |
| C Medidas/Peso | peso_*, bitola_*, dimensões, unidade_*, fatores_conversao JSON | **SIM** (estrutura; sem fatores CPA reais) |
| D Fiscal cadastral | ncm, cest, origem_mercadoria | **SIM** parcial |
| E Comercial | preco_venda, margem | **NÃO** |
| F Custos | custo_aquisicao, custo_medio | **NÃO** |
| G Estoque | estoque_*, saldo, reserva, localizacao | **NÃO** |
| H Compras | fornecedor operacional | **NÃO** |
| I Produção | OP/composição operacional | **NÃO** |
| J Logística | frete operacional | **NÃO** |
| K Marketplace | exibir_no_site/marketplace | **NÃO** (gap UI) |
| L Outros | tributacao/CFOP/CST | **NÃO** (fiscal operacional) |

## Campos (resumo)

| CAMPO | MASTER? | MIGRAR_R03? | MOTIVO |
|---|---|---|---|
| codigo | A | sim | identificação; unique por group_id |
| codigo_barras | A | sim | EAN/GTIN cadastral |
| descricao / nome | A | sim | já em 006 |
| tipo_item | B | sim | Revenda/MP/etc. |
| marca_id / grupo_produto_id / setor_atividade_id / unidade_medida_id | B | sim | FKs tenant-scoped |
| eh_bitola, bitola_diametro_mm, peso_teorico_kg_m, comprimento_barra_padrao_m | C | sim | master aço; sem fórmula universal |
| unidades_secundarias / fatores_conversao | C | sim | JSON; sem inventar fatores |
| peso_liquido/bruto, altura/largura/comprimento, volume_m3 | C | sim | cadastro |
| ncm, cest, origem_mercadoria | D | sim | cadastral only |
| preco_venda, custo_*, estoque_* | E/F/G | **não** | transactional |
| tributacao, cfop_* | L | **não** | motor fiscal futuro |

## Integridade

- `assert_empresa_belongs_to_group` (004)
- `assert_produto_fk_same_tenant` (008) — marca/unidade/grupo/setor mesmo `group_id`
