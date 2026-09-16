# ERP-RUNTIME-02 — Matriz de migração da camada de Cadastros

**Data:** 2026-09-16  
**Branch:** `cursor/erp-runtime-02-392b`  
**Inventário:** nomes reais do repositório (`localBase44Client`, forms, páginas).  
**Não inventar entidades.** Categoria / Fabricante / SubgrupoProduto **não existem** como `base44.entities.*`.

---

## Classificação

| Classe | Critério técnico |
|---|---|
| **A** | Cadastro simples; poucas FKs outbound; sem fluxo operacional financeiro/fiscal/estoque |
| **B** | Relacional (FKs entre cadastros); impacto médio em telas de produto |
| **C** | Hub central com dependências em Estoque/Preço/Fiscal/Vendas/Compras/Produção |

---

## Matriz

| ENTIDADE | NOME_ATUAL | DEPENDÊNCIAS | USOS | RISCO | MULTIEMPRESA | AUDITORIA | SOFT_DELETE | STATUS_HTTP | STATUS_POSTGRES | LOTE |
|---|---|---|---|---|---|---|---|---|---|---|
| Marca | `Marca` | Nenhuma crítica | ValidadorFase2, forms produto | Baixo | group_id + empresa_id | create/update/soft_delete | `ativo` | Pronto (piloto R01) | `marcas` | R01 ✓ / R02 mantém |
| Unidade de medida | `UnidadeMedida` | Referenciada por Produto | Cadastros, produto, estoque (ref) | Baixo | group_id + empresa_id | sim | `ativo` | Piloto HTTP R02 | `unidades_medida` | **R02 A** |
| Grupo de produto | `GrupoProduto` | Referenciado por Produto | ValidadorFase2, forms | Baixo/médio | group_id + empresa_id | sim | `ativo` | Piloto HTTP R02 | `grupos_produto` | **R02 A** |
| Setor de atividade | `SetorAtividade` | Referenciado por Produto | ValidadorFase2, forms | Baixo | group_id + empresa_id | sim | `ativo` | Piloto HTTP R02 | `setores_atividade` | **R02 A** |
| Produto (base) | `Produto` | Unidade, Grupo, Marca, Setor; consumo amplo | Estoque, Comercial, Produção, Dashboard… | Alto se completo | group_id + empresa_id | sim (base) | `ativo` | API base pronta; **fora** `HTTP_PILOT_ENTITIES` | `produtos` (só master) | **R02 B preparado** |
| Tabela de preço | `TabelaPreco` / `TabelaPrecoItem` | Produto, regras comerciais | Comercial, AplicadorTabelaPreco | Alto | group_id (legado) | — | — | Não | Não | **Adiado** |
| Fornecedor | `Fornecedor` | Compras, Financeiro, CNPJ, contas a pagar | Cadastros, Contratos, Despesas | Alto | `empresa_dona_id` + group | local policies | — | Não | Não | **Adiado** |
| Cliente | `Cliente` | Comercial, Financeiro, Portal | Várias telas | Alto | shared entity | — | — | Não | Não | Fora escopo R02 |
| Categoria | — | — | — | — | — | — | — | N/A | N/A | **Não existe** no ERP |
| Fabricante | — | — | — | — | — | — | — | N/A | N/A | **Não existe** (usar Marca) |
| SubgrupoProduto | — | — | — | — | — | — | — | N/A | N/A | **Não existe** |

---

## Seleção deste lote

**Implementados (CRUD HTTP + Postgres + audit + tenant):**

1. `UnidadeMedida` (A)
2. `GrupoProduto` (A)
3. `SetorAtividade` (A)
4. `Produto` cadastro-base (B preparado; API/repo/schema; **não** no feature flag frontend)

**Adiados com motivo técnico:**

- `TabelaPreco` / itens / regras / histórico → separar cadastro vs preços vs regras em lote próprio
- `Fornecedor` → dependências Compras/Financeiro/Fiscal/CNPJ
- Campos operacionais de `Produto` (saldo, custo médio, reservas, fiscal operacional, produção)

---

## Integridade tenant

- Trigger `assert_empresa_belongs_to_group()` (migration `004`)
- `TenantGuard` server-side em create/update
- Teste obrigatório: Group A + `empresa_id` do Group B → `409 TENANT_MISMATCH`
