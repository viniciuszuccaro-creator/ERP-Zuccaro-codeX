# Parecer Cursor — #221 writer-guard HTTP Pedido/Entrega @ `690e44c7`

**PR:** [#221](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/221)  
**Branch:** `codex/comercial-pedido-entrega-http-guard-20261006`  
**SHA revisado:** `690e44c7f61dc32b6e1b70e8e7cb2d641015fb9e`  
**Commits:** `a24c743b` (entrega) · `690e44c7` (retirada)  
**Base declarada:** `codex/comercial-expedicao-cliente360-207-209-20261005` @ ancestral `7cbe3a30` (**antes** de `06ed1141` CLI)  
**Data:** 2026-10-06  
**Veredito:** **APPROVED COM RESSALVAS**

> Pareceres #218/#219/#220 e `06ed1141` **não** se transferem a este SHA. Incorporação na candidata tip (`7ea1519a`/`06ed1141`) exige merge/rebase que **preserve** CLI `reconcile:stock`.

---

## Escopo

Bloqueia writers locais `MovimentacaoEstoque` / `produto.estoque_atual` nas abas Pedido→Entrega e Pedido→Retirada quando `isHttpExpedicaoEnabled()` (backend HTTP **e** `VITE_ERP_HTTP_EXPEDICAO=true`). Modo legado preservado (`!modoHttpExpedicao`).

## Checklist

| Critério | Resultado |
|---|---|
| Flag AND (http + flag) | OK — teste unitário |
| Entrega: botão oculto + alert + revalida no onClick | OK |
| Retirada: mutation aborta antes do 1º efeito + handle + UI | OK |
| Modo legado | OK — botão/baixa locais permanecem |
| Retry / chamada direta | OK na UI — `isHttpExpedicaoEnabled()` reavaliado no handler/mutation |
| Testes Cursor | `pedido-entrega-http-writer-guard` **3/3 PASS** |
| Dupla movimentação HTTP nestas abas | Mitigada |

## Lacunas residuais (Comercial — item 2 do pacote)

Ainda escrevem estoque local **sem** o mesmo guard neste HEAD:

| Caminho | Nota |
|---|---|
| `useFluxoPedido.jsx` | reserva/baixa faturamento/cancelamento/OP |
| `ComprovanteEntregaDigital.jsx` | tem ramos `isHttpExpedicaoMode`; confirmar todos os writers |
| `LogisticaReversa.jsx` | ramo HTTP já evita SPA; ramo local ainda grava |

Não fazem parte do diff #221 — listados para a consolidação na candidata.

## Base / consolidação

#221 **não** contém `06ed1141` (CLI #219). Ao incorporar na candidata tip: cherry-pick/merge dos commits `a24c743b`+`690e44c7` **sobre** `7ea1519a`/`06ed1141`, sem tip-port cego que apague a CLI.

## Telas / PG

| Probe | Resultado |
|---|---|
| erp-dev health/ready/meta | 200 (`ERP-RUNTIME-08B`) |
| Fluxo autenticado separação→…→cancelamento | **BLOCKED** — Bearer |
| PG real candidata | **BLOCKED** — `DATABASE_URL` |

## Próximo

Comercial consolida #221 + #219 na candidata tip; fecha lacunas `useFluxoPedido`/comprovante se no escopo. Cursor revalida o SHA pós-merge (parecer novo).
