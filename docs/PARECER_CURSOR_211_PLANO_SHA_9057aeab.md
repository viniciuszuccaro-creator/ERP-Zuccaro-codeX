# Parecer Cursor — Legado plano importação/reversão @ `9057aeab` / espelho `0b35fb45`

**PR espelho:** [#211](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/211)  
**Branch Codex:** `codex/legado-origem-relatorios-392b` tip `9057aeab`  
**Espelho Cursor:** `cursor/legado-origem-relatorios-392b` tip `0b35fb45`  
**Data:** 2026-10-05  
**Veredito:** **APPROVED** (rascunho de gate; carga operacional permanece proibida)

---

## Escopo (itens 4–5 do programa Legado)

Plano `docs/LEGADO_PLANO_IMPORTACAO_REVERSAO_GATE.md` + teste contratual `tests/legado-plano-importacao-reversao-gate.test.js`.

## Checklist

| Critério | Resultado |
|---|---|
| `importAuthorized=false` / `operationalLoadAuthorized=false` | OK — plano + loader staging |
| Não promove staging→operacional | OK — GO/NO-GO + §0 |
| Backup original somente leitura | OK — §1 / §5 / §8 |
| Vínculos CPA / 3Z operacionais; Grupo CPA agrupamento | OK — sem EMP03/pasta |
| Reconciliação em centavos inteiros | OK — §3 |
| Rollback por fatia sem tocar HD | OK — §5 |
| Mapper Cursor #48 intocado | OK — declaração + teste |
| Sem PII/dumps no Git | OK — §6 + teste negativo |
| Fixtures sintéticas ≠ evidência HD | OK — BLOCKED HD documentado |

## Testes locais (espelho)

`node --test tests/legado-plano-importacao-reversao-gate.test.js` → **4/4 PASS**

## Limitações / BLOCKED

- HD `BACKUP ERP ANTIGO - CODEX` ausente neste VM → itens 1–4 reais não reexecutados; fixtures não substituem.
- Carga operacional / promoção: **proibida** até gate humano + backup destino restauro-testado.

## Próximo

Aguardar autorização humana do gate Onda 25. Itens de preparação 1–5 do programa Legado estão documentados no #211.
