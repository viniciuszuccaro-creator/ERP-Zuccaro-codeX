# Bloqueios únicos — candidata estoque / Expedição @ `e242564f`

**Branch:** `codex/comercial-expedicao-cliente360-207-209-20261005`  
**SHA:** `e242564fc74122f415528ff7f16afdbcf6c66fa0`  
**CI tip:** frontend / backend / expedicao-comercial-compose **SUCCESS**  
**Data:** 2026-10-06 (Cursor — revalidação pós cherry-pick parcial #221)

## Incorporado neste SHA

| Item | Status |
|---|---|
| #219 unidade canônica + CLI `reconcile:stock` (`06ed1141`) | OK (ancestral) |
| #221 Entrega HTTP guard | OK (`8f2d1b55`) |
| #221 Retirada HTTP guard | OK (`aa10475b`) |
| Teste comprovante/reversa sem `MovimentacaoEstoque` HTTP | OK (docs commit `e242564f`) |

## Bloqueios / gaps (lista única)

| ID | Bloqueio | Severidade | Responsável | Intervenção |
|---|---|---|---|---|
| B1 | AutomacaoFluxoPedido **sem** guard HTTP neste tip (`48bce2f7`/`3decc4e4` não ancestral) | P0 anti-dupla | Comercial | Cherry-pick #223 `3decc4e4`→`f5591d55` sobre este tip; preservar CLI |
| B2 | `useFluxoPedido.jsx` ainda grava `MovimentacaoEstoque` local (reserva/faturamento/cancel/OP) sem `isHttpExpedicaoEnabled` | P0 residual | Comercial | Guard HTTP nos writers ou redirecionar ao ledger |
| B3 | Snapshots privados Grupo/Empresa/produto/unidade/corte | P1 | Comercial | URL privada + gate; não publicar PII |
| B4 | Prova PostgreSQL real (movimentação única, retry, concorrência, saldo, rollback multi-item) | P1 | Comercial | `DATABASE_URL` isolado + grants; PGlite ≠ PG real |
| B5 | Homologação DEV / smoke autenticado nas telas (separação→romaneio→despacho→parcial/devolução/cancel) | P1 | Cursor+Comercial | Bearer / sessão; 127.0.0.1 ≠ VPS |
| B6 | Backup/reversão operacional VPS | P1 gate | Humano+gates | Sem promoção 3080; MCP Hostinger sob gate |
| B7 | Publisher real outbox / publicação externa | Fora | — | Não simular sucesso externo (#203 in-repo OK) |
| B8 | Gap migration 032 / trava 026 | Histórico | — | Não inventar saldo/032 |

## Não fazer

- Tip-port cego de #221 que apague `06ed1141` / CLI.
- Merge main / promoção 3080 sem gate.
- Inventar sucesso de telas Bearer ou PG sem URL.
- Editar outbox/DAM (#203) a partir da candidata (dono Cursor).

## Após B1

Cursor emite parecer novo no SHA consolidado (não reutilizar `48bce2f7` nem `690e44c7`).
