# Coordenação Cursor (#199) × Codex (#178 / #200 / #201) — contratos e propriedade

**Canal documental combinado** (comentários de PR bloqueados para o agente): este arquivo + `docs/HANDOFF_ATUAL.md` + `STATUS_DO_PROJETO.md`.

## Encaminhamento de frentes (pacote paralelo)

| Frente | Executor | Ação |
|---|---|---|
| **Comercial 360** | Tarefa/chat **existente** Comercial 360 | Confirmado recebimento; **primeira ação** permanece naquele workspace (código Comercial **não** neste clone #199). Sem tarefa duplicada. |
| **Legado / staging privado** | Executor que **já** possui acesso ao staging | Continua lá; **não** abrir frente legado paralela neste agente. |
| **Expedição #199** | Cursor neste branch | Fechar CI compose, PG isolado, telas, pareceres por SHA. |

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

## SHA observado — tip Pedido/estoque executor #201 (parecer separado; NÃO estende #200)

| Campo | Valor |
|---|---|
| PR | #201 |
| Branch | `codex/pedido-estoque-expedicao-integracao-20261001` |
| SHA | `d20a6dde1656e764f001d90c8ccdd80cac134eaf` |
| Parecer | `docs/PARECER_CODEX_201_SHA_d20a6dde.md` |
| Tip-port | **Não** — candidata; parecer #200 **não** aprova automaticamente #201 |

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

1. Portas `ExpedicaoPedidoSideEffectPort` / `ExpedicaoEstoquePort` — default `reserved`. Tip #201 propõe `executor?` na assinatura; integração só após FINAL.
2. Migration Expedição = **036** (sem colisão com 025–035). Trava histórica **026** = tip Comercial `4f8c6593` inalterável no job compose.
3. Sem tip-port na branch Expedição enquanto #178/#200/#201 forem candidatas.
4. Composição integrada: comercial 025–035 **depois** 024 e **antes** 036; CI `expedicao-comercial-compose` = PGlite + PostgreSQL isolado; skip/ausência = fail (grep não confunde `# skipped 0`).
5. Pareceres por **SHA exato** — nunca estender automaticamente #178 → #200 → #201.
