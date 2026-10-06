# Bloqueios únicos — candidata estoque @ `d21f97cb`

**Branch:** `codex/comercial-expedicao-cliente360-207-209-20261005`  
**SHA tip:** `d21f97cb2fe7e86b26fbc894bf43007f11883ffc` (docs pós-B2; código B2 = `2c6e898e`)  
**CI tip:** frontend / backend / expedicao-comercial-compose **SUCCESS**  
**Data:** 2026-10-06 (substitui `b8492074`)

## Fechado

| ID | Item | Evidência |
|---|---|---|
| B1 | Automacao HTTP | `3decc4e4` |
| B2 | `useFluxoPedido` | `2c6e898e`; parecer Cursor APPROVED COM RESSALVAS (#222) |
| B4 | PG integrado R11_STOCK | **CI efêmera** `test:postgres` (mov. única, retry, concorrência, saldo, rollback multi-item). Local agente sem `DATABASE_URL` = skip sanitizado (não inventar) |

## Abertos

| ID | Bloqueio | Sev | Intervenção |
|---|---|---|---|
| B3 | Snapshots privados G/E/produto/unidade/corte | P1 | Staging privado + URL; fixture `NOT_EXTRACTED`; ready≠carga |
| B4-local | `DATABASE_URL` no agente Cloud | P2 | URL isolada se quiser repro local ≠ CI |
| B5 | Telas autenticadas (Bearer) | P1 | Sessão; 127.0.0.1 ≠ VPS |
| B6 | Homolog DEV backup/restore/smoke | P1 | Gate humano; sem 3080 |
| R2 | `GerarOPModal` / Apontamento / OtimizadorCorte | P2 | Comercial (adiado) |
| B7 | Publisher outbox real | Fora | #203 in-repo |
| B8 | Gap 032 / trava 026 | Histórico | — |

## Nota Cursor

Parecer B2 @ `2c6e898e` **permanece**; tip `d21f97cb` é documental (checklist + fixture). Não reabrir B2. Legado SFTP continua HUMAN_NEXT FileZilla (export 153440Z).
