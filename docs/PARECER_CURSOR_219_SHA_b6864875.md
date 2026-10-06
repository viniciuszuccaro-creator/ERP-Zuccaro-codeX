# Parecer Cursor — #219 reconciliação offline @ `b6864875`

**PR:** [#219](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/219)  
**Branch:** `codex/comercial-ledger-reconciliacao-20261006`  
**SHA revisado:** `b68648754142c57ee7bec8289b2da15cb0461881`  
**Ancestrais no pacote:** `20793df9` (gate corte/unidade) · `d8ca9488` (vazio) · `ec8fe57a` (UTC equivalente) · `b6864875` (CLI sanitizado)  
**Base:** `codex/comercial-expedicao-cliente360-207-209-20261005`  
**Data:** 2026-10-06  
**Veredito:** **APPROVED COM RESSALVAS**

> Parecer [#218](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/218) @ `7f0dc127` **não** se transfere a este SHA. Incorporação na candidata #213 é passo Comercial **após** este parecer; `ready=true` **não** autoriza carga, INSERT de abertura nem `EXPEDICAO_PERSISTENT_PORTS`.

---

## Escopo

Comparador puro `reconcileExpedicaoStock` + CLI `server/scripts/reconcileExpedicaoStock.ts` (`npm run reconcile:stock`). Sem banco, sem rede, sem writer, sem migration. Relatório agregado (contagens + códigos de conflito), sem IDs/quantidades no stdout.

## Checklist

| Critério | Resultado |
|---|---|
| Escopo Grupo/Empresa/produto | OK — chave `group/empresa/produto`; empresa distinta gera `MISSING_LEDGER` + `MISSING_SOURCE` |
| Unidade não convertida / não somada | OK no comparador — `UNIT_MISMATCH` se `unidadeId` diverge; duas linhas do mesmo produto (unidades diferentes) → `DUPLICATE_KEY` |
| Duplicidade | OK — `DUPLICATE_KEY` por lado; evidenceId não entra na chave |
| Precisão NUMERIC(18,6) | OK — micros inteiros; 7ª casa / negativo / `1.` inválidos |
| Cortes comparáveis | OK — UTC `Z`; `2026-10-06T12:00:00Z` ≡ `.00Z` ≡ `.000Z`; calendário impossível → `INVALID_SNAPSHOT`; offset `+00:00` rejeitado |
| Snapshot vazio ≠ zero | OK — `EMPTY_SNAPSHOT`; ausência não vira abertura |
| CLI sem PII | OK — teste recusa `private-*` e quantidades no stdout/stderr; limite 16 MiB; `exit 2` se não `ready` |
| Não escreve saldo | OK — função pura; CLI só lê JSON local |
| Duplicidade de módulo | OK — não replica mapper #48 nem writer de estoque |
| Unidade **no ledger 037** | **NÃO fechado** — ver R1 |

## Unidade canônica (R1)

`produtos.unidade_medida_id` é **uma** coluna por produto (cadastro). `expedicao_estoque_saldos` permanece PK `(group_id, empresa_id, produto_id)` **sem** coluna de unidade; movimentos 037 também não guardam unidade.

O comparador **assume** uma linha por produto e **recusa** somar unidades distintas. Isso não prova que a quantidade extraída foi contada na unidade do cadastro. Se o mapeador anexar `unidade_medida_id` do JOIN depois de ler um saldo em outra UOM, `ready` pode passar em falso.

Contrato exigido na extração (Comercial, staging privado):

1. Unidade viaja **no mesmo registro de evidência** que a quantidade (não JOIN posterior sem prova).
2. Produto sem unidade canônica comprovada → quarentena, não soma.
3. Locais/lotes/embalagens não se agregam neste gate.

## Testes Cursor neste SHA

| Prova | Resultado |
|---|---|
| `expedicao-stock-reconciliation.test.ts` | **7/7 PASS** |
| `expedicao-stock-reconciliation-cli.test.ts` | **1/1 PASS** (com `node_modules` do server; worktree sem deps falha `tsx` — não é defeito do comparador) |
| Snapshots reais origem×destino | **BLOCKED** — não há JSON privado neste VM |
| `DATABASE_URL` / runtime11 PG | **BLOCKED** B1 |

CI GitHub do tip: acompanhar backend do `b6864875` (frontend/compose/concurrency já PASS na rodada observada).

## Ressalvas (não ativar)

| ID | Estado |
|---|---|
| R1 | PK ledger sem unidade; cadastro tem unidade única, quantidade do ledger é adimensional |
| R2 | `ready` ≠ cobertura de local/lote, writers congelados, backup/restore, piloto, gate humano |
| R3 | Extração/mapeamento **fora** deste PR; CLI não lê PostgreSQL |
| B1/B5 | Sem snapshots reais nem INSERT de abertura |

## Próximo

Comercial incorpora #219 na candidata **depois** deste parecer; extrai snapshots privados com procedência/corte; CLI no staging; não copiar JSON real para o GitHub.
