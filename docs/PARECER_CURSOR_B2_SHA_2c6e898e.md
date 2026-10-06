# Parecer Cursor — B2 `useFluxoPedido` HTTP anti-dupla @ `2c6e898e`

**Branch:** `codex/comercial-expedicao-cliente360-207-209-20261005`  
**SHA funcional:** `2c6e898e865deb9810ebbcb3dc6406248bf67e02`  
**Harness legado VM:** `28dee1da64705eac5a573683bfeeaad57ccb046a`  
**Tip docs/CI:** `b8492074e254fc015fa61fb1fb89ecd8210b7d7c` (ancestral dos acima)  
**Data:** 2026-10-06  
**Veredito:** **APPROVED COM RESSALVAS**

> Pareceres #221 tip / candidata `f5591d55` **não** se transferem a este SHA.

---

## Escopo

Fail-closed no modo Expedição HTTP (`isHttpExpedicaoEnabled` AND):

| Entrada | Comportamento HTTP |
|---|---|
| `assertEscritaEstoqueLocalPermitida` | throw antes de qualquer `MovimentacaoEstoque` / `estoque_atual` |
| `reservarEstoqueItemAprovacao` / `baixarEstoqueItem` / `baixarMaterialProducao` / `liberarReservaEstoque` | assert no início (retry/chamada direta cobertos) |
| `aprovarPedidoCompleto` | omite loop de reserva; `estoqueHttpLedger=true` |
| `faturarPedidoCompleto` | omite baixa SPA; ledger flag |
| `concluirOPCompleto` | omite consumo material local |
| `cancelarPedidoCompleto` | omite liberação SPA; CR/status cancel seguem |
| `executarFechamentoCompleto` | aborta inteiro com `HTTP_ESTOQUE_LOCAL_BLOQUEADO` |

Modo legado: ramos `else` / ausência da flag preservam writers SPA.

## Checklist

| Critério | Resultado |
|---|---|
| Flag AND | OK (`runtimeBackend`) |
| Entradas diretas nos writers | OK — assert antes do 1º efeito |
| Orquestração omite efeitos | OK |
| Fechamento completo bloqueado | OK |
| Legado preservado | OK — `28dee1da` injeta HTTP=false no sandbox VM |
| Writer-guard | **6/6 PASS** (Cursor) |
| `pedido-faturamento-policy` | **32/32 PASS** (legado sandbox) |
| CLI `reconcile:stock` | Intacta |
| Dupla movimentação estoque nestes pontos HTTP | Mitigada |

## Ressalvas / residuais

| ID | Nota |
|---|---|
| R1 | Testes comportamentais do harness forçam HTTP=false — cobrem legado, não HTTP=true dinâmico |
| R2 | `GerarOPModal.jsx` ainda cria `MovimentacaoEstoque` sem o mesmo guard (fora do diff B2) |
| R3 | Aprovação/faturamento HTTP ainda alteram status/CR (não estoque) — esperado; não prova anti-dupla financeira/logística de ponta a ponta |
| R4 | Telas autenticadas / PG real | **BLOCKED** Bearer / `DATABASE_URL` |
| R5 | Módulo Estoque genérico (Recebimento/MovimentacoesTab etc.) fora deste lote |

## Próximo

Comercial: PG integrado + snapshots + homolog sob gates; opcional R2.  
Cursor: revalidar tip se B2 mudar; telas quando Bearer; outbox/DAM independente.
