# Parecer Cursor — PR #237 outbox sem publisher (SHA `4dcc61b4`)

**Revisor:** Cursor (chat principal ERP ZUCCARO)  
**PR:** https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/237  
**HEAD revisado:** `4dcc61b40c246a2aeb0a9ac6a36b9f396bf93dda`  
**Base:** `main` `f0549a89` (contém #231+#226+#225+#203)  
**CI HEAD:** frontend+backend **PASS**  
**Testes locais (worktree):** `runtime10-produto-outbox-claim` **22/22**; HTTP **7/7**

## Veredito

**APROVAR merge #237 → main.**

Correção necessária e alinhada ao contrato Onda 15: sem publisher/configuração explícita, o processamento não pode marcar evento como `published`.

## Requisitos conferidos

| Requisito | Resultado |
|---|---|
| Sem publisher configurado → nenhum evento vira “publicado” | **OK** — default `ERP_OUTBOX_CONSUMER_MODE=disabled`; `DisabledCatalogPublisher`; `runProdutoOutboxConsumer` autoriza e retorna **409** `OUTBOX_CONSUMER_DISABLED` **antes** do claim |
| Fake só com opt-in | **OK** — `ERP_OUTBOX_FAKE_ALLOWED=true` e `NODE_ENV !== 'production'`; senão force `disabled` |
| External nunca simula sucesso | **OK** — `ExternalCatalogPublisherGate` falha sem canal/credenciais; provider real permanece bloqueado |
| Tenant/RBAC | **OK** — testes HTTP exigem permissões; disabled path chama `authorize` antes do 409 |
| Modo desabilitado não altera eventos | **OK** — teste “process sem publisher configurado bloqueia antes do claim” |
| Falha de entrega / retry / idempotência | **OK** — fail→retry→dead_letter; confirm `already_published`; concorrência de claim |
| `.env.example` | **OK** — `disabled` por padrão |

## UI (#203) — distinção de estados

Arquivo: `src/components/cadastros/produto/ProdutoRelationsDamSection.jsx` (já em main via #203).

- Exibe contagens: `pending` · `processing` · `retry` · `dead_letter` · `published`.
- Lista operacional focada em `dead_letter` com reprocess/discard (RBAC).
- **Lacuna (não bloqueia #237):** UI não distingue `published` de ensaio (`fake`) vs entrega externa comprovada. Com #237, default disabled impede sucesso fictício no process; rótulo “published” na UI ainda não comunica “entrega canal comprovada”. Melhoria UX pode ser lote separado (não misturar neste PR).

## Fora de escopo / não regressões

- Sem migration, canal externo real, dados reais ou deploy VPS neste PR.
- Não duplicar implementação: apenas revisão + testes do tip Codex.

## Deploy erp-dev (contexto)

Main já integra #231/#226/#225/#203; SPA pública ainda `last-modified: 2026-09-27` e snapshots HTTP **200**. Deploy operacional **BLOCKED** neste Cloud: SSH `Permission denied (publickey)`; Hostinger MCP timeout em list/get apesar de auth OK.

## Próximo

1. HUMAN/Cursor com SSH ou Web Console: backup + rebuild SPA/API da main.  
2. Merge #237.  
3. (Opcional) lote UX: rótulos outbox pending/falha/entrega comprovada.
