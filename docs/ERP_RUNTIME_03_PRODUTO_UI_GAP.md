# ERP-RUNTIME-03 — Gap UI Produto (sem redesenho)

**Objetivo:** mapear formulário atual × PostgreSQL × API × frontend HTTP.  
**NÃO redesenhar UI neste lote.** Produto **não** entra em `HTTP_PILOT_ENTITIES`.

| Campo UI | Postgres | API | Frontend HTTP | Status | Ação futura |
|---|---|---|---|---|---|
| descricao | produtos.descricao | sim | prepared only | OK master | ativar HTTP após E2E |
| codigo | produtos.codigo | sim | prepared | OK | — |
| codigo_barras | produtos.codigo_barras | sim | prepared | OK R03 | — |
| tipo_item | produtos.tipo_item | sim | prepared | OK | — |
| setor_atividade_id | FK | sim | prepared | OK | — |
| grupo_produto_id | FK | sim | prepared | OK | — |
| marca_id | FK | sim | prepared | OK | — |
| unidade_principal / unidade_medida | colunas | sim | prepared | OK | — |
| unidades_secundarias | jsonb | sim | prepared | OK | — |
| fatores_conversao | jsonb | sim | prepared | OK | sem fatores CPA |
| eh_bitola / bitola / peso_teorico | colunas | sim | prepared | OK | — |
| peso/dimensões | colunas | sim | prepared | OK | — |
| ncm / cest / origem_mercadoria | colunas | sim | prepared | OK cadastral | — |
| preco_venda / custo_aquisicao | — | rejeitado 400 | local | adiado | RUNTIME preço/custo |
| estoque_* / localizacao | — | rejeitado 400 | local | adiado | RUNTIME estoque |
| tributacao / cfop_* | — | rejeitado 400 | local | adiado | RUNTIME fiscal |
| exibir_no_site / marketplace | — | não | local | adiado | K |
| foto_produto_url | coluna | sim | prepared | OK | storage futuro |

**Ativação HTTP do Produto (lote futuro):** schema validado ✓ · API ✓ · E2E VPS · tenant FK ✓ · auditoria ✓ · flag frontend.
