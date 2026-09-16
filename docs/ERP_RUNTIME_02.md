# ERP-RUNTIME-02 — Migração controlada da camada de Cadastros

**Status:** pronto para review (sem deploy VPS neste lote)  
**Data:** 2026-09-16  
**Branch:** `cursor/erp-runtime-02-392b`  
**Base main:** `c943ba09` (ERP-DEV-DEPLOY-01 reconciliado)  
**Pré-requisito:** ERP-RUNTIME-01 + ERP-DEV-DEPLOY-01 na main; Marca E2E validada no VPS

Referências: `docs/ERP_RUNTIME_01.md`, `docs/ERP_DEV_DEPLOY_01.md`, `docs/ERP_RUNTIME_02_CADASTROS_MATRIX.md`, `docs/ERP_RUNTIME_02_DEV_RUNBOOK.md`.

---

## 1. Objetivo

Expandir o padrão comprovado de **Marca** para a base de Cadastros, sem migrar o ERP inteiro e sem remover Base44/localBase44.

```text
UI → facade/adapter → HttpApiClient → API/BFF → Service → Repository → PostgreSQL
```

A UI **não** acessa PostgreSQL nem SDK Supabase para dados empresariais neste lote.

---

## 2. Inventário real (resumo)

Entidades reais encontradas: `Marca`, `UnidadeMedida`, `GrupoProduto`, `SetorAtividade`, `Produto`, `TabelaPreco`/`TabelaPrecoItem`, `Fornecedor`, `Cliente`, …

**Não existem** como entity: `Categoria`, `Fabricante`, `SubgrupoProduto`.

---

## 3. Entidades deste lote

| Entidade | Classe | HTTP piloto frontend | Postgres | Observação |
|---|---|---|---|---|
| Marca | A | sim (R01) | `marcas` | Mantida; TenantGuard reforçado |
| UnidadeMedida | A | **sim** | `unidades_medida` | CRUD completo |
| GrupoProduto | A | **sim** | `grupos_produto` | CRUD completo |
| SetorAtividade | A | **sim** | `setores_atividade` | CRUD completo |
| Produto (base) | B | **não** | `produtos` | Schema+API+repo; sem estoque/custo/fiscal op. |

**Adiados:** TabelaPreco (regras/histórico), Fornecedor (Compras/Financeiro), Produto operacional.

---

## 4. Migrations (imutáveis 001–003)

| Arquivo | Conteúdo |
|---|---|
| `004_tenant_integrity.sql` | `assert_empresa_belongs_to_group` + triggers marcas/profiles |
| `005_cadastros_simples.sql` | unidades_medida, grupos_produto, setores_atividade + RLS FORCE + índices + tenant trigger |
| `006_produtos_base.sql` | produtos master-only + FKs + RLS FORCE |

Correções futuras → **nova** migration. Nunca editar 001–003 aplicadas no DEV.

---

## 5. Multiempresa + RLS

- Toda entidade empresarial: `group_id` + `empresa_id` (nullable quando escopo grupo)
- Integridade: empresa deve pertencer ao group (DB trigger + `TenantGuard`)
- RLS: `ENABLE` + `FORCE` fail-closed em todas as tabelas novas
- Modelo atual: BFF usa role privilegiada; policies JWT/Auth planejadas com autenticação completa
- Frontend **não** é mecanismo de segurança

---

## 6. Camadas

| Camada | Artefatos |
|---|---|
| Repository | `postgresCadastroRepositories.ts`, `inMemoryCadastroRepositories.ts`, `PostgresMarcaRepository` |
| Service | `TenantCrudService`, `MarcaService` (+ TenantGuard) |
| API | `/api/v1/unidades-medida`, `/grupos-produto`, `/setores-atividade`, `/produtos`, `/marcas` |
| Client | `HttpApiClient` + `HTTP_PILOT_ENTITIES` |
| Feature flag | `VITE_ERP_BACKEND=local\|http\|remote` — fallback local preservado |

CRUD: LIST / GET / CREATE / UPDATE / SOFT DELETE (`ativo=false`).

Auditoria: `audit_logs` com before/after, actor, group, empresa, entity, request_id.

---

## 7. Compatibilidade

Preservado: localBase44, localEntityGuard, ERP-SITE, B2B, GO-LIVE-HML, Marca R01, Docker erp-api-dev/erp-web-dev, portas 3080/3081, compose Supabase intocado.

Não migrado: Financeiro, Fiscal, Estoque operacional, Vendas, Compras, Produção, RH, PIX/Boleto.

---

## 8. Dados

Somente seed sintético A/B em `server/scripts/seed-dev-synthetic.sql`. Sem dados reais CPA.

---

## 9. Testes

- `server/tests/runtime01.test.ts` — Marca + migrations 001–006
- `server/tests/runtime02.test.ts` — CRUD, audit before/after, A/B, cross-tenant 409, validação
- `tests/http-api-client.test.js` — rotas piloto + Produto prepared

---

## 10. Proibições deste lote

Não: deploy Hostinger, SSH, migrate remoto, merge main, RUNTIME-03, DNS/Caddy/HTTPS, remover Base44, alterar Site CPA.

---

## 11. Decisão

Emitida no relatório do agente: `ERP_RUNTIME_02_READY_FOR_REVIEW` ou `ERP_RUNTIME_02_BLOCKED`.
