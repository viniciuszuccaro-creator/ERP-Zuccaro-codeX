# Parecer Cursor — PR #212 @ `a37dca55`

**PR:** [#212](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/212)  
**Branch Codex:** `codex/comercial-expedicao-dev-gates-20261005`  
**Espelho Cursor:** `cursor/comercial-expedicao-dev-gates-392b`  
**SHA revisado:** `a37dca55` (+ `bee11785`)  
**Data:** 2026-10-05  
**Veredito:** **APPROVED** (gate de teste; sem inventar saldo)

---

## Escopo

Reforço do gate DEV no `runtime11-expedicao-persistent-postgres`: despacho sem linha em `expedicao_estoque_saldos` deve falhar fechado; após baseline isolado, retry aplica exatamente um movimento.

## Checklist

| Critério | Resultado |
|---|---|
| Fonte oficial = `expedicao_estoque_saldos` | OK — UPDATE exige linha existente; ausência → `ESTOQUE_BASELINE_OR_SALDO_INSUFICIENTE` |
| Não inventa saldo de abertura | OK — teste **insere** baseline só após o bloqueio; produção não cria saldo implícito |
| Sem movimento/auditoria em falha | OK — asserts `movementCount=0`, eventos Pedido=0, audit Pedido/Estoque=0 |
| Retry idempotente pós-baseline | OK — exatamente 1 movimento após insert reconciliado |
| Fixture produto com `unidade_medida_id` | OK — `a37dca55` evita FK quebrada no produto sem saldo |
| Trava 026 / migration 032 | Intactas — diff só em teste + STATUS/HANDOFF |
| Tip-port Cursor / outbox / DAM | Não tocados |

## Limitações

- Prova depende de `DATABASE_URL` (runtime11). Sem PG real, o gate permanece skip — coerente com #213.
- Não cobre grants/RLS operacionais VPS nem saldo de abertura reconciliado de produção (gates próprios).

## Próximo

Homologar runtime11 quando houver PG isolado; manter VPS/Auth/publisher BLOCKED.
