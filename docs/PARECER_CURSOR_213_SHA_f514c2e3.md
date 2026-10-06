# Parecer Cursor — HEAD integrado #213 @ `f514c2e3`

**PR espelho:** [#213](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/213)  
**Branch Codex autoritativa:** `codex/comercial-expedicao-cliente360-207-209-20261005`  
**SHA revisado:** `f514c2e3`  
**Incorpora:** #215 `5837b6e5` / `7f0dc127` + ensaio PGlite de reconciliação  
**Data:** 2026-10-06  
**Veredito:** **APPROVED COM RESSALVAS**

> Parecer [#218](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/218) @ `7f0dc127` **não** se transfere a este HEAD.

---

## Escopo

Candidata #207+#209+#210+#212+#215: rollback multi-item no ledger (PG skip + PGlite) e JOIN cadastro×`expedicao_estoque_saldos` sem inventar abertura.

## Checklist

| Critério | Resultado |
|---|---|
| #215 na autoritativa | OK — ancestral `5837b6e5` |
| Rollback 2º item sem baseline | OK — PGlite + R11 (skip sem URL) |
| Retry 1 movimento/item; cancel idempotente | OK |
| `CONFLICT_LEDGER_ABSENT` sem INSERT | OK — órfão de cadastro não vira saldo |
| Unidade no ensaio | OK — `unidade_medida_id` do **produto**; PK ledger continua sem unidade |
| Não inventa saldo | OK |
| Gap 032 / trava 026 | Intactos |
| Tip-port outbox/DAM | Não |

## Ressalvas (bloqueios)

| ID | Estado |
|---|---|
| B1 `DATABASE_URL` | Aberto — R11 fluxo PG real skip |
| B3 telas SPA | Aberto — 3080/5173 down |
| B4 VPS live | Aberto — MCP timeout; R07B/001–015 **históricos** |
| R1 unidade | PK `(group,empresa,produto)` — unidade só via JOIN produto |
| R6 cleanup | produtos órfãos/`laterProduct` no PGlite são efêmeros; não cobrem leak em PG real além do `finally` R11 |

## Próximo

CI deste tip; PG isolado para R11; preflight VPS só-leitura; merge humano na ordem já documentada.
