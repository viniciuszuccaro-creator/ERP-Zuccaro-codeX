# Bloqueios únicos — candidata estoque / Expedição @ `f5591d55`

**Branch:** `codex/comercial-expedicao-cliente360-207-209-20261005`  
**SHA:** `f5591d55c92c70c72d60450a5e81e5430da1c621`  
**CI tip:** frontend / backend / compose / concurrency **SUCCESS**  
**Data:** 2026-10-06 (substitui lista `e242564f`)

## Fechado neste SHA

| ID | Item | Evidência |
|---|---|---|
| — | #219 CLI `reconcile:stock` | Ancestral `06ed1141`; script presente |
| — | #221 Entrega/Retirada | `8f2d1b55`/`aa10475b` |
| B1 | Automacao HTTP guard | `3decc4e4`→`f5591d55` (#223 MERGED) |
| — | Comprovante/Reversa exclusivos HTTP | Teste writer-guard |
| — | Writer-guard | **5/5 PASS** |

## Abertos

| ID | Bloqueio | Severidade | Responsável | Intervenção |
|---|---|---|---|---|
| B2 | `useFluxoPedido.jsx` grava estoque local (reserva/faturamento/OP/cancel) sem `isHttpExpedicaoEnabled` | P0 residual | Comercial (em curso) | Guard HTTP fail-closed; preservar legado |
| B3 | Snapshots privados Grupo/Empresa/produto/unidade/corte | P1 | Comercial | URL privada + gate; sem PII no Git |
| B4 | Prova PostgreSQL real (única mov., retry, concorrência, saldo, rollback multi-item) | P1 | Comercial | `DATABASE_URL` isolado; PGlite ≠ PG |
| B5 | Homologação DEV autenticada nas telas | P1 | Cursor+Comercial | Bearer / sessão; 127.0.0.1 ≠ VPS |
| B6 | Backup/reversão operacional VPS | P1 gate | Humano+gates | Sem promoção 3080 |
| B7 | Publisher real outbox | Fora | — | #203 in-repo OK; não simular externo |
| B8 | Gap 032 / trava 026 | Histórico | — | Não inventar saldo/032 |

## Não fazer

Tip-port outbox/DAM na candidata · merge main · inventar sucesso Bearer/PG · tip-port cego que apague CLI.
