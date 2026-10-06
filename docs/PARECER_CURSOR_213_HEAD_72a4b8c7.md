# Parecer Cursor — HEAD Comercial integrado #213 @ `72a4b8c7`

**PR espelho:** [#213](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/213)  
**Branch:** `cursor/comercial-expedicao-cliente360-207-209-392b`  
**SHA revisado:** `72a4b8c7f1c2` (merge Codex `f514c2e3`)  
**Candidata autoritativa:** `codex/comercial-expedicao-cliente360-207-209-20261005` @ `f514c2e3`  
**Data:** 2026-10-06  
**Veredito:** **APPROVED COM RESSALVAS** — o parecer **não** inclui #219

> Parecer [#218](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/218) @ `7f0dc127` **não** se transfere a este HEAD. Parecer `f514c2e3` cobre o merge #215 neste tip; esta nota revalida o **mesmo** SHA de código comercial **sem** o gate offline #219 (`b6864875` ainda está só na branch da #219).

---

## Escopo revalidado

#207+#209+#210+#212+#215: ledger HTTP, gate baseline, rollback multi-item, ensaio PGlite cadastro×ledger sem INSERT de abertura. **#219 não ancestral.**

## Checklist

| Critério | Resultado |
|---|---|
| #215 ancestral | OK — `5837b6e5` / `7f0dc127` |
| Rollback 2º item sem baseline | OK — PGlite **6/6 PASS** neste VM |
| `CONFLICT_LEDGER_ABSENT` | OK — órfão de cadastro não vira saldo |
| Unidade no ensaio | JOIN `produtos.unidade_medida_id`; PK ledger **sem** unidade (R1) |
| Gap 032 / trava 026 | Intactos |
| Tip-port outbox/DAM | Não |
| CI #213 @ `72a4b8c7` | **SUCCESS** (frontend, backend, compose, concurrency) |
| Fluxo telas API×PG, recarga, retry, RBAC, troca de empresa | **BLOCKED** B3 — `curl` 3080/5173 = 000; `DATABASE_URL` vazio |
| VPS ao vivo | **BLOCKED** B4 — Hostinger `vps_virtual-machines_list` timeout MCP |

## Ressalvas

Mesma lista B1–B6 do STATUS da candidata. R1 permanece até extração com unidade na evidência **ou** coluna/contrato no ledger. Incorporar #219 é lote Comercial seguinte, não aprovado por este parecer.

## Intervenção mínima (telas / VPS)

1. Confirmar API oficial `erp-api-dev` em `127.0.0.1:3080` (`/health` e `/ready` = 200) com flags HTTP já documentadas; SPA no bind autorizado.  
2. `DATABASE_URL` isolado (não operacional) → `runtime11-expedicao-persistent-postgres`.  
3. Hostinger: se MCP listar timeout persistir, hPanel → VPS DEV (somente leitura) **ou** informar `virtualMachineId` para `vps_virtual-machines_get`. Sem APPLY/migration/promoção.
