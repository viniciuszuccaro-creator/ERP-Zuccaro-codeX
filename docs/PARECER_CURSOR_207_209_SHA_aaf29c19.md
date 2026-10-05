# Parecer Cursor — candidata #207+#209 @ `aaf29c19`

**SHA Codex:** `aaf29c197d2b91d21a81de854605c642834355e0`  
**PR espelho:** #213 (`cursor/comercial-expedicao-cliente360-207-209-392b`)  
**Data:** 2026-10-05  
**Revisor:** Cursor

## Escopo revalidado

Revalidação do **HEAD integrado** (pareceres isolados de #207/#209 **não** se transferem). Base #207 `506a5d35` + semântica #209 + segregação margem.

## Checklist

| Tema | Resultado |
| --- | --- |
| #209 agregação além da página | OK — `topProducts` + teste 205 pedidos |
| Estados / produto+unidade / RBAC / tenant | OK — só FINALIZADO; chave composta; `visualizar`; scope empresa |
| Decimais PG | **Corrigido neste follow-up** — `to_char` 6 casas (#210) |
| EM_ABERTO/CANCELADO | **Coberto neste follow-up** |
| Margem segregada | OK no tip — outro aprovador |
| À vista | Presente no tip (política + testes) |
| Ledger estoque | `expedicao_estoque_saldos` + opt-in ports; SPA sem MovimentacaoEstoque paralelo |
| Migrations / 026 | Gap 032 documentado; trava 026 preservada (asserts compose) |
| PG real E2E fluxo completo | **PENDENTE** — `DATABASE_URL` ausente / skip runtime11 |
| VPS / DEV smoke | **BLOCKED** — gates |

## Veredito

**APPROVED com follow-up Cursor** no tip da #213 (decimal + estados). Sem tip-port; merge/VPS humanos.

## Próximo

Com `DATABASE_URL` isolado: `runtime11-expedicao-persistent-postgres`. Pacote DEV só sob gate. Outbox/DAM independente (#202/#203) não disputar.
