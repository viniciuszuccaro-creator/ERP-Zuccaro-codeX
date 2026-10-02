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
- UI `VITE_ERP_HTTP_EXPEDICAO=true`
- Playwright: reload real (`expedicao-api-pg`) + SPA `/Expedicao`×BFF+PGlite (`expedicao-erp-telas-pg`)
- CI `expedicao-comercial-compose`: fetch tip Comercial `4f8c6593`; skip/ausência = fail
- Pareceres: #178 `4f8c6593`; #200 `619bddd0` (não estende #178)

### Gates

Merge/VPS bloqueado. Migration 036 não aplicar em operação neste PR.
