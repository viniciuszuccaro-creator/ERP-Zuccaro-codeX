# Coordenação Cursor (#199) × Codex (#178 / #200) — contratos e propriedade

**Canal documental combinado** (comentários de PR bloqueados para o agente): este arquivo + `docs/HANDOFF_ATUAL.md` + `STATUS_DO_PROJETO.md`.

## SHA observado — tip Comercial #178 (parecer separado)

| Campo | Valor |
|---|---|
| PR | #178 |
| Branch | `codex/comercial-corrige-parecer-155` |
| SHA | `4f8c6593506f681689e021226ab024f57c7aede9` |
| Parecer | `docs/PARECER_CODEX_178_SHA_4f8c6593.md` |
| Tip-port | **Não** — candidata |

## SHA observado — tip Pedido/Expedição #200 (parecer separado; NÃO estende #178)

| Campo | Valor |
|---|---|
| PR | #200 |
| Branch | `codex/pedido-expedicao-contract-20261001` |
| SHA | `619bddd0e550cad2957a7343100a098319ad79bd` |
| Parecer | `docs/PARECER_CODEX_200_SHA_619bddd0.md` |
| Tip-port | **Não** — candidata; parecer #178 **não** se aplica automaticamente |

## Propriedade de arquivos (antes de editar áreas compartilhadas)

| Área | Dono | Cursor #199 |
|---|---|---|
| `server/migrations/025`–`035` (comercial) | **Codex** | Não criar/alterar; Expedição usa **036** |
| `server/migrations/036_expedicao_*` | **Cursor** | Único dono |
| Pedido/Orçamento services, snapshots, tip-port adapters | **Codex** | Não tip-port; contrato em `EXPEDICAO_PORTAS_PEDIDO_ESTOQUE.md` |
| `expedicaoTypes` / `expedicaoService` / repos Expedição | **Cursor** | Melhoria no existente |
| `server/src/app.ts`, `router.ts`, `rbacGuard.ts` | **Compartilhado** | Só trechos Expedição; sem reverter Comercial |
| `src/api/httpApiClient.js`, `runtimeBackend.js`, `base44Client.js` | **Compartilhado** | Só superfície Expedição |
| Telas `src/components/expedicao/**`, `logistica/IntegracaoRomaneio` | **Cursor** | Wire BFF |
| SPA Pedido legado `updateInContext("Pedido")` | **Codex contrato** | Descritivo; HTTP canônico não muta Pedido |

## Contrato vigente

1. Portas `ExpedicaoPedidoSideEffectPort` / `ExpedicaoEstoquePort` — default `reserved`.
2. Migration Expedição = **036** (sem colisão com 025–035).
3. Sem tip-port na branch Expedição enquanto #178/#200 forem candidatas.
4. Composição integrada: aplicar comercial 025–035 **depois** 024 e **antes** 036; CI job `expedicao-comercial-compose` falha se ref Comercial ausente ou suíte skip.
5. Pareceres por **SHA exato** — nunca estender automaticamente #178 → #200.
