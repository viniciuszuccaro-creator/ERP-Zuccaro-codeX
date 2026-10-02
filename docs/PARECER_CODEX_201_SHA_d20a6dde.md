# Parecer Cursor sobre tip Codex Pedido/estoque × Expedição — PR #201

**Canal:** documental (`docs/`, `STATUS_DO_PROJETO.md`, `HANDOFF_ATUAL.md`, `docs/EXPEDICAO_COORDENACAO_CODEX.md`) — comentários de PR indisponíveis ao agente.

**Escopo deste parecer:** exclusivamente o tip `#201` no SHA abaixo.  
**Não** estende, reaproveita nem transfere o parecer de `#200` (`docs/PARECER_CODEX_200_SHA_619bddd0.md`) nem de `#178` (`docs/PARECER_CODEX_178_SHA_4f8c6593.md`).

## Identidade revisada

| Campo | Valor |
|---|---|
| PR | **#201** |
| Título | Expedição: compartilhar executor transacional com portas Pedido/estoque |
| Branch | `codex/pedido-estoque-expedicao-integracao-20261001` |
| **SHA exato** | `d20a6dde1656e764f001d90c8ccdd80cac134eaf` |
| Base declarada | `codex/pedido-expedicao-contract-20261001` (#200) |
| Commits tip | `70d1e75a` → **`d20a6dde`** |
| Estado | **candidata** (CI tip frontend/backend verdes no momento da revisão; **não** FINAL) |

## O que o SHA `d20a6dde` altera (leitura objetiva)

1. **Executor transacional nas portas:** `ExpedicaoPedidoSideEffectPort` / `ExpedicaoEstoquePort` passam a receber `executor?: DbQueryExecutor` como segundo argumento; `ExpedicaoService` propaga o executor da TX ativa.
2. **Prova de rollback:** tip documenta/testa falha de estoque em devolução rolando Romaneio/Entrega juntos; sem ativar adaptador de estoque real.
3. **Migration:** tip mantém **`036_expedicao_entregas_romaneios.sql`** (sem 025–035 comercial no tree deste tip).
4. **Default das portas:** permanece `reserved` até tip-port autorizado — sem mutação Pedido/estoque em produção via #199.

## Parecer (Cursor / Expedição #199)

1. **Compatibilidade de contrato:** o segundo argumento `executor` é compatível com o contrato mínimo em `docs/EXPEDICAO_PORTAS_PEDIDO_ESTOQUE.md` (atualizado no tip Codex). Cursor #199 ainda chama as portas sem exigir o segundo arg no tip local; integração futura deve alinhar assinatura **sem tip-port automático**.
2. **Não mesclar pareceres:** aprovação/compatibilidade de `#200@619bddd0` **não** aprova `#201@d20a6dde`. Cada SHA exige parecer próprio.
3. **Tip-port:** **NÃO** autorizado neste parecer. Adaptadores Pedido/estoque reais ficam no executor Codex; #199 preserva `reserved` e fail-closed em `failed`.
4. **Arquivos compartilhados:** `expedicaoTypes.ts` / `expedicaoService.ts` — evolução de assinatura de porta é do Codex neste tip; Cursor só integra após FINAL + coordenação explícita e reavaliação do HEAD integrado.
5. **Risco residual:** base #200 ainda candidata; promover #201 sem #200 FINAL cascateia risco de contrato Pedido. Sem merge/VPS/migração operacional neste canal.

## Conclusão

| Decisão | Valor |
|---|---|
| Tip-port para #199 | **NÃO** |
| Extensão do parecer #200 → #201 | **NÃO** |
| Extensão do parecer #178 → #201 | **NÃO** |
| Merge / VPS / migração operacional | **Bloqueado** |
| Próximo passo | Aguardar FINAL Codex em #201 (+ base #200); reavaliar HEAD integrado por SHA se tip avançar além de `d20a6dde` |

**Registro:** parecer emitido apenas no canal documental combinado (PR comments bloqueados ao agente).
