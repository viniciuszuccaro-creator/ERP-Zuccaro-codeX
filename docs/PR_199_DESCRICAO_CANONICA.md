# Descrição canônica PR #199 (canal documental)

> ManagePullRequest bloqueado neste run (`PR URL must belong to the current repository`).
> Corpo abaixo substitui a menção incorreta a `025_expedicao_*`.

## Título

feat(expedicao): persistência canônica Entrega/Romaneio (BFF+PG)

## Corpo

### Objetivo

Candidata de **Expedição com persistência canônica**. SPA local = base de UX; **não** é prova de persistência real.

### O que entrou

- Migration **`036_expedicao_entregas_romaneios.sql`** (repo/CI only; sem aplicação operacional). Comercial #178 reserva **025–035** — Expedição **não** usa 025.
- Repos + `ExpedicaoService` + rotas `/api/v1/entregas|romaneios`
- Multiempresa ∧, RBAC fail-closed, auditoria, idempotência
- Portas Pedido/estoque **reserved** (sem tip-port)
- UI `VITE_ERP_HTTP_EXPEDICAO=true`; botão **Nova Entrega** abre `FormularioEntrega` existente
- Playwright: reload real + SPA `/Expedicao`×BFF+PGlite (criar/separar/romaneio/despacho/parcial/total/ocorrência/devolução + UI cards + persistência pós-reload)
- CI `expedicao-comercial-compose`: fetch tip Comercial `4f8c6593`; PGlite + **PostgreSQL isolado**; skip real = fail (não confundir `# skipped 0`); trava histórica **026**
- Pareceres: #178 `4f8c6593`; #200 `619bddd0` (não estende #178); #201 `d20a6dde` (não estende #200)

### Gates

Merge/VPS bloqueado. Migration 036 não aplicar em operação neste PR.
