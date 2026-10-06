# Parecer Cursor — PR #215 @ `7f0dc127`

**PR:** [#215](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/215)  
**Branch Codex:** `codex/comercial-ledger-multiitem-20261005`  
**SHA revisado:** `7f0dc127` (feat `5837b6e5`)  
**Base:** candidata `72c9dba9` / código `899ec9b3`  
**Data:** 2026-10-06  
**Veredito:** **APPROVED COM RESSALVAS**

> Pareceres #214/#213 **não** se transferem a este SHA.

---

## Escopo

Complemento da candidata autoritativa: prova R11 de **falha no segundo item** após dedução do primeiro na mesma transação; rollback de saldo/movimento/evento Pedido/audit; retry pós-baseline; cancelamento compensa uma vez (sem duplo crédito).

## Checklist

| Critério | Resultado |
|---|---|
| Não inventa saldo de abertura | OK — segundo produto sem linha em `expedicao_estoque_saldos`; insert só após falha |
| Rollback atômico da 1ª dedução | OK — `qty()` permanece 10; movimentos/eventos/audit = 0 |
| Retry 1 despacho por item | OK — 2 movimentos; saldo 8 |
| Compensação cancelamento idempotente | OK — saldo 10 + segundo item `2.000000`; retry cancel não duplica |
| Fonte oficial HTTP/BFF | OK — contrato limita ledger ao opt-in; Base44/local separado |
| Gap 032 / trava 026 | Intactos (sem migration nova) |
| Tip-port outbox/DAM / #213 | Não tocados |
| CI | SUCCESS (7 checks) neste SHA |

## Ressalvas

| ID | Tema | Detalhe |
|---|---|---|
| R1 | Unidade | Reconciliação documentada menciona `(group, empresa, produto, unidade)`; PK real de `expedicao_estoque_saldos` é `(group_id, empresa_id, produto_id)` **sem** `unidade_medida_id`. Não inventar coluna neste lote. |
| R2 | PG real | Teste vive em `runtime11-expedicao-persistent-postgres` (`skip` sem `DATABASE_URL`). Prova local = skip path; não inventar sucesso PG. |
| R3 | Ordenação | `laterProduct = e${uuid.slice(1)}` força sort após o produto seed; frágil se o seed UUID mudar de faixa. |
| R4 | Reconciliação operacional | O próprio contrato admite: atomicidade ≠ reconciliação Base44×ledger. Pendente ensaio isolado sem inventar saldos. |
| R5 | Telas | SPA 3080/5173 down neste VM — prova UI **não** feita neste SHA. |

## Próximo

Comercial incorpora `5837b6e5` na autoritativa; Cursor revalida o HEAD integrado (não este parecer isolado). R1 unidade fica para lote próprio se o negócio exigir saldo por unidade.
