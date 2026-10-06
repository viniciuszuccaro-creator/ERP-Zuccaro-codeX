# Parecer Cursor — candidata consolidada #219+#221+#223 @ `f5591d55`

**Branch:** `codex/comercial-expedicao-cliente360-207-209-20261005`  
**SHA revisado:** `f5591d55c92c70c72d60450a5e81e5430da1c621`  
**Incorporado:** #219 CLI `06ed1141` · #221 Entrega/Retirada (`8f2d1b55`/`aa10475b`) · #223 Automacao (`3decc4e4`) · docs `e242564f`  
**CI tip:** frontend / backend / expedicao-comercial-compose / concurrency **SUCCESS**  
**Data:** 2026-10-06  
**Veredito:** **APPROVED COM RESSALVAS**

> Pareceres #218/#220 e tip #221 `48bce2f7` / `690e44c7` **não** se transferem a este SHA. Revisão independente do tip consolidado.

---

## Checklist anti-dupla HTTP neste tip

| Caminho | Guard HTTP | Teste |
|---|---|---|
| `PedidosEntregaTab` | OK | writer-guard |
| `PedidosRetiradaTab` | OK | writer-guard |
| `AutomacaoFluxoPedido` | OK (`3decc4e4`) | writer-guard |
| `ComprovanteEntregaDigital` | OK (`isHttpExpedicaoMode`) | writer-guard |
| `LogisticaReversa` | OK (API devolução) | writer-guard |
| CLI `reconcile:stock` | Presente (ancestral) | — |
| Writer-guard local | **5/5 PASS** | Cursor |

Modo legado preservado quando a flag AND não está ativa.

## Ressalvas / bloqueios

Ver `docs/BLOQUEIOS_CANDIDATA_ESTOQUE_f5591d55.md` (B2 `useFluxoPedido` ainda P0 residual; B3–B8 PG/snapshots/Bearer/gates).

## Telas / PG

| Probe | Resultado |
|---|---|
| Fluxo autenticado | **BLOCKED** Bearer |
| PG real | **BLOCKED** `DATABASE_URL` |
| VPS MCP | **BLOCKED** timeout |

## Próximo

Comercial fecha B2 (`useFluxoPedido`). Cursor reemite parecer se o tip mudar. Sem merge main / tip-port outbox / promoção 3080.
