# Coordenação Cursor (#199) × Codex (#178) — contratos e propriedade

**Canal documental combinado** (comentários de PR bloqueados para o agente): este arquivo + `docs/HANDOFF_ATUAL.md` + `STATUS_DO_PROJETO.md`.

## SHA observado do tip Codex (parecer)

| Campo | Valor |
|---|---|
| PR | #178 |
| Branch | `codex/comercial-corrige-parecer-155` |
| SHA | `4f8c6593506f681689e021226ab024f57c7aede9` |
| CI | frontend+backend SUCCESS (observado) |
| Tip-port | **Não** — candidata |

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
3. Sem tip-port na branch Expedição enquanto #178 for candidata.
4. Composição integrada: aplicar comercial 025–035 **depois** 024 e **antes** 036; sem reescrever migrations aplicadas.

## O que Cursor não edita neste lote

- Branches/arquivos exclusivos do tip Comercial (Pedido/Orçamento/mig 025–035).
- Force-push, tip-port, merge main, migrate VPS.
