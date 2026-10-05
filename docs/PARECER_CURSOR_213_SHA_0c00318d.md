# Parecer Cursor — candidata integrada #213 @ `0c00318d`

**PR espelho:** [#213](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/213)  
**Branch Codex autoritativa:** `codex/comercial-expedicao-cliente360-207-209-20261005`  
**SHA revisado:** `0c00318d` (tip docs `f43b9c28`)  
**Data:** 2026-10-05  
**Veredito:** **APPROVED COM RESSALVAS**

> O parecer [#214](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/214) @ `a37dca55` **não** aprova automaticamente este pacote. Revisão feita neste SHA.

---

## Escopo do SHA

Candidata #207+#209+#210+#212:

| Origem | Conteúdo no SHA |
|---|---|
| #207 | Expedição/Pedido portas persistentes, ledger 037 |
| #209+#210 | Cliente360 `topProducts` + `to_char` 6 casas + só FINALIZADO |
| #212 | Gate saldo inicial fail-closed + unidade no fixture |
| tip prévio | gap 032 assert, 037 sem INSERT saldo, skip path sanitizado, PGlite ledger |

## Checklist

| Critério | Resultado |
|---|---|
| Fonte oficial `expedicao_estoque_saldos` | OK — UPDATE exige linha; ausência → `ESTOQUE_BASELINE_OR_SALDO_INSUFICIENTE` |
| Não inventa saldo de abertura | OK — teste insere baseline só após bloqueio; 037 sem INSERT |
| Dupla movimentação SPA | OK — doc/meta: HTTP não cria `MovimentacaoEstoque` paralelo |
| Gap 032 / trava 026 | OK — asserts no runtime11 (+ compose/runtime01) |
| Rollback evento/audit em falha de estoque | OK — asserts #212 no teste |
| Retry pós-baseline = 1 movimento | OK |
| Margem/desconto/à vista pós-compose | OK — 19/19 PASS no tip anterior; código intacto neste delta |
| Cliente360 topProducts | OK — presente com `to_char` |
| Tip-port / outbox / DAM | Não tocados |

## Ressalvas (bloqueios reproduzíveis)

| ID | Estado |
|---|---|
| B1 DATABASE_URL / senha PG | **aberto** — 5432 escuta, `fe_sendauth`; runtime11 fluxo completo skip |
| B2 suíte PG real ponta a ponta | **aberto** (depende B1) |
| B3 telas SPA 3080/5173 | **aberto** — ports down neste VM |
| B4 VPS/Auth/publisher | **aberto** |
| B5 saldo abertura operacional | **aberto** — só gate de ausência testado |
| B6 Legado HD Onda 25 | **aberto** (#211) |
| B7 #212 fora da candidata | **fechado** neste SHA |

## Próximo

1. CI tip pós-merge no #213.  
2. Com `DATABASE_URL` isolado: executar runtime11 completo.  
3. Prova telas reais sob ERP DEV.  
4. Merge humano na ordem #207→#209+#210→#212→#213; supersedir espelhos #214/#210/#209/#212 isolados preservando pareceres.

## Extensão `899ec9b3`

Espelho PGlite do gate #212 no ledger (sem DATABASE_URL): mesma semântica fail-closed + retry. Não fecha B1 (PG real).
