# Parecer Cursor — HEAD integrado #213 @ `7cbe3a30`

**PR espelho:** [#213](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/213)  
**Branch Codex autoritativa:** `codex/comercial-expedicao-cliente360-207-209-20261005`  
**SHA revisado:** `7cbe3a309701adae23e4c3715444a10eaffafaa6`  
**Incorpora:** #215 · #219 comparator (`624cbc0c`/`09ba0d8d`/`762d35c9` ≡ `ec8fe57a`) · contrato unidade canônica  
**Data:** 2026-10-06  
**Veredito:** **APPROVED COM RESSALVAS**

> Pareceres [#218](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/218) @ `7f0dc127`, [#220](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/220) @ `b6864875` e `docs/PARECER_CURSOR_213_SHA_f514c2e3.md` **não** se transferem a este HEAD.

---

## Escopo

Candidata #207+#209+#210+#212+#215+#219 (comparador offline) + fail-closed de unidade na porta persistente, **sem** migration 038. PK do ledger permanece `(group_id, empresa_id, produto_id)`.

## Checklist

| Critério | Resultado |
|---|---|
| #215 ancestral | OK |
| #219 comparator na candidata | OK — função pura + testes (incl. `DUPLICATE_KEY` para 2 UOM no mesmo produto) |
| CLI #219 `b6864875` (`reconcile:stock`) | **Ausente** neste HEAD |
| Unidade canônica | OK runtime — `produtos.unidade_medida_id`; códigos `ESTOQUE_UNIDADE_CANONICA_AUSENTE` / `_MISMATCH` / `_COLISAO` |
| Não soma UOM distintas | OK — comparador + porta; PGlite: mismatch não movimenta; saldo inalterado |
| Não inventa saldo / gap 032 / 026 | Intactos |
| Fixture sanitizada | OK — `compared: 0`, `NOT_EXTRACTED`, sem PII |
| Snapshots reais origem×destino | **BLOCKED** B1/B4 |
| Tip-port outbox/DAM | Não |
| CI tip `7cbe3a30` | **SUCCESS** (run `37482604079`) |
| Testes Cursor neste VM | reconciliação **9/9** · PGlite **6/6** |

## Ressalva R1 (unidade) — estado pós-`7cbe3a30`

| Antes (#218) | Agora |
|---|---|
| PK sem unidade; só JOIN no ensaio | PK **ainda** sem unidade (correto: 1 UOM/produto) |
| Sem gate na porta | Porta bloqueia ausência/mismatch/colisão de `pedido_itens.unidade_id` vs canônica |
| Comparador podia passar se mapper anexasse UOM errada | Continua risco na **extração**; comparador não soma e exige `unidadeId` igual nos dois lados |

Não há coluna de unidade no ledger — e **não** deve haver se o cadastro for a única UOM. Contrato aceitável **desde que** a extração prove a unidade na evidência da quantidade. CLI sanitizado da #219 tip (`b6864875`) ainda não veio para a candidata.

## Ressalvas / bloqueios

| ID | Estado |
|---|---|
| B1 `DATABASE_URL` | Aberto — R11 PG real skip |
| B3 telas | Aberto — 3080/5173 down neste VM |
| B4 VPS | Aberto — MCP timeout |
| B5 snapshots | Aberto — fixture só `NOT_EXTRACTED` |
| R-CLI | CLI agregada #219 `b6864875` fora; `ready` ≠ carga |

## Próximo

Extração privada com corte/unidade comprovados; opcional trazer CLI #219; PG isolado; merge humano na ordem já documentada. Sem promoção 3080.
