# Parecer Cursor — #221 writer-guard HTTP Pedido/Entrega/Automação @ `48bce2f7`

**PR:** [#221](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/221)  
**Branch:** `codex/comercial-pedido-entrega-http-guard-20261006`  
**SHA revisado:** `48bce2f776c667d2901cd2a4f04ff50d4e287eeb`  
**Commits:** `a24c743b` (entrega) · `690e44c7` (retirada) · `48bce2f7` (AutomacaoFluxoPedido)  
**Base declarada:** `codex/comercial-expedicao-cliente360-207-209-20261005` @ ancestral `7cbe3a30` (**antes** de `06ed1141` CLI)  
**CI tip:** frontend / backend / expedicao-comercial-compose **SUCCESS**  
**Data:** 2026-10-06  
**Veredito:** **APPROVED COM RESSALVAS**

> Pareceres #218/#219/#220 e o parecer Cursor @ `690e44c7` **não** se transferem a este SHA. Revisão independente do tip `48bce2f7`.

---

## Escopo (delta vs `690e44c7`)

Além dos guards de Entrega/Retirada já aprovados com ressalvas:

| Ponto | Evidência |
|---|---|
| Import `isHttpExpedicaoEnabled` | `AutomacaoFluxoPedido.jsx` |
| `modoHttpExpedicao` | flag AND no render |
| Auto-execute bloqueado | `autoExecute && … && !modoHttpExpedicao` |
| Handler reavalia | `executarFluxoCompleto` inicia com `if (isHttpExpedicaoEnabled())` + toast + return |
| Botão disabled + alert | `disabled={… \|\| modoHttpExpedicao}` + `role="alert"` |
| Testes | `pedido-entrega-http-writer-guard` **4/4 PASS** (Cursor local) |

Modo legado preservado (`!modoHttpExpedicao` / ausência da flag).

## Checklist

| Critério | Resultado |
|---|---|
| Flag AND (http + `VITE_ERP_HTTP_EXPEDICAO`) | OK |
| Entrega / Retirada | OK (inalterados vs `690e44c7`) |
| Automação: auto + manual + UI | OK @ `48bce2f7` |
| Retry / chamada direta no handler | OK — reavaliado no click/mutation |
| CI tip #221 | SUCCESS |
| Dupla movimentação nestes pontos HTTP | Mitigada |

## Lacunas residuais (não resolvidas neste SHA)

| Caminho | Nota |
|---|---|
| `useFluxoPedido.jsx` | reserva/baixa faturamento/cancelamento/OP — sem `isHttpExpedicaoEnabled` |
| `baixarEstoque` local em Automacao | função deprecated ainda no arquivo; entrada pública `executarFluxoCompleto` está guardada |
| Comprovante / LogisticaReversa | já exclusivos HTTP na candidata tip (`e242564f` cobre com teste); fora do diff #221 tip |

## Consolidação na candidata

| SHA / PR | Estado na candidata `e242564f` |
|---|---|
| #219 CLI `06ed1141` | Ancestral — **preservar** |
| Entrega/Retirada (`8f2d1b55`/`aa10475b`) | Cherry-picked |
| Automacao `48bce2f7` / #223 `3decc4e4` | **AUSENTE** — Comercial deve cherry-pick `#223` (`3decc4e4`→`f5591d55`) **sobre** tip candidata sem tip-port cego |

PR irmão: [#223](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/223) (`codex/comercial-automacao-http-guard-20261006`) — mesmo guard Automacao rebased sobre candidata + CLI.

## Telas / PG

| Probe | Resultado |
|---|---|
| erp-dev health | **BLOCKED** Bearer / AUTH_REQUIRED |
| Fluxo autenticado SPA | **BLOCKED** Bearer |
| PG real | **BLOCKED** `DATABASE_URL` |

## Próximo

1. Comercial: cherry-pick Automacao (#223) na candidata tip; fechar `useFluxoPedido` se no escopo anti-dupla.  
2. Cursor: parecer novo no SHA pós-merge (este parecer **não** cobre o tip consolidado).  
3. Lista única de bloqueios candidata: `docs/BLOQUEIOS_CANDIDATA_ESTOQUE_e242564f.md`.
