# ERP-RUNTIME-07B — TabelaPreco canônica

**Status:** `IMPLEMENTADO NA BRANCH / AGUARDANDO REVIEW`  
**Branch:** `cursor/erp-runtime-07b-tabela-preco-392b`  
**Baseline 06B:** `67686298be2fa125966e714b1cf20759a7991765`  
**Software/API DEV oficial:** permanece `ERP-RUNTIME-06B` até promoção futura.  
**Frontend HTTP:** `false`. TabelaPreco **não** entra em `HTTP_PILOT_ENTITIES`.

Especificação: `docs/ERP_RUNTIME_07A_ESPECIFICACAO_TABELA_PRECO.md` (PR #27).  
Diagnóstico: `docs/ERP_RUNTIME_07_DIAGNOSTICO.md` (PR #26).  
Este arquivo descreve a implementação. Não promove DEV, não acessa VPS e não
inicia runtime posterior.

## Objetivo

Persistir preço comercial canônico com:

- `tabelas_preco` (cabeçalho; ownership Grupo + empresa origem);
- `tabela_preco_empresas` (autorização N:N + padrão por Empresa);
- `tabela_preco_itens` (produto + unidade; `NUMERIC(18,6)`);
- `cliente_empresas.tabela_preco_id` (específica; NULL = fallback).

## Migration

Somente `server/migrations/013_tabelas_preco.sql`. Migrations 001–012 imutáveis.

### Multiempresa

- Tenant raiz: `group_id`.
- Ownership: `empresa_id` NOT NULL (origem). Sem tabela órfã de Grupo.
- Compartilhamento: somente N:N `tabela_preco_empresas` (dona auto-vinculada no create).
- Sem flag `compartilhar_grupo`.
- Nome: unique parcial `(group_id, empresa_id, lower(nome)) WHERE ativo` —
  Empresas A e A2 podem ter **ATACADO** ativas independentemente.
- Código: `reserve_entity_codigo(group_id,'TabelaPreco',6)`.

### Padrão e fallback

1. `ClienteEmpresa.tabela_preco_id` ativa+vigente+autorizada;
2. padrão (`eh_padrao`) ativo+vigente da Empresa;
3. sem preço (fail-closed; nunca zero implícito).

Índice único parcial: um `eh_padrao=true AND ativo=true` por `empresa_id`.

### Item / unidade / dinheiro

- Identidade permanente: `(tabela_preco_id, produto_id, unidade_medida_id)`.
- Unidade = principal do produto ou secundária cadastrada.
- Conversão/peso teórico permanecem no Produto/UnidadeMedida.
- `preco NUMERIC(18,6) >= 0`; escala >6 rejeitada; moeda BRL no cabeçalho.

### Soft delete

`ativo=false` sem hard delete. Inativar bloqueada se padrão ativo ou
`ClienteEmpresa` ativo apontando a tabela. Restore mesma identidade; sem cascade.

### RLS / RBAC / Audit

- ENABLE + FORCE nas três tabelas; sem policy permissiva; `REVOKE PUBLIC`.
- RBAC `Cadastros.tabela_preco.*` fail-closed.
- `audit_logs` atômico na mesma TX.

### API

Base `/api/v1/tabelas-preco` (+ empresas, padrão, itens, restore).  
ClienteEmpresa set/clear `tabela_preco_id` na API existente.  
Meta: `runtime: ERP-RUNTIME-07B`, `tabelaPreco.frontendHttp: false`.

## Fora de escopo

Pedido, Orçamento, Estoque, pagamento, Vendedor, Contato, faixas, reajuste,
cópia, PriceBrain, Base44 cutover, frontend HTTP, VPS, merge.

## Testes

`server/tests/runtime07b.test.ts` (PGlite): migration/seed2x, RLS/FORCE,
ATACADO A/A2, CRUD/padrão/fallback/monetário, cross-tenant, RBAC, audit rollback.
Gate PostgreSQL real permanece para promoção DEV (`ERP_RUNTIME_07B_DEV_RUNBOOK.md`).
