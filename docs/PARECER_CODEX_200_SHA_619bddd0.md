# Parecer Cursor sobre tip Codex Expedição Pedido — PR #200

**Canal:** documental (`docs/`, `STATUS_DO_PROJETO.md`, `HANDOFF_ATUAL.md`) — comentários de PR indisponíveis ao agente.

**Escopo deste parecer:** exclusivamente o tip `#200` no SHA abaixo.  
**Não** estende, reaproveita nem transfere o parecer de `#178` (`docs/PARECER_CODEX_178_SHA_4f8c6593.md`).

## Identidade revisada

| Campo | Valor |
|---|---|
| PR | **#200** |
| Título | feat(expedicao): validar Pedido canônico e limites de quantidade |
| Branch | `codex/pedido-expedicao-contract-20261001` |
| **SHA exato** | `619bddd0e550cad2957a7343100a098319ad79bd` |
| Base declarada | `cursor/expedicao-persistencia-canonica-392b` (#199) |
| Commits tip | `bdeea05b` → `3e842669` → **`619bddd0`** |
| Estado | **candidata** (não FINAL; CI tip ainda sob revisão) |

## O que o SHA `619bddd0` altera (leitura objetiva)

1. **Pedido vinculado na criação de Entrega:** `getForExpedicao` + `FOR UPDATE` (via repo), exige `PRONTO_ENTREGA` + `tipo_operacao=ENTREGA`, snapshots canônicos e itens alinhados ao Pedido (`ENTREGA_PEDIDO_ITENS_DIVERGENTES` / `PEDIDO_NAO_EXPEDIVEL`).
2. **Limites parcial/devolução** e bloqueios de cancelamento/despacho de Entrega vinculada enquanto compensação de estoque não estiver `applied`.
3. **Migration:** tip Codex já reconhece **`036_expedicao_entregas_romaneios.sql`** (sem reintroduzir `025_expedicao` no tree deste SHA).
4. **Portas Pedido/estoque:** permanecem no contrato `reserved` / fail quando `failed` — sem tip-port do executor Comercial neste SHA.

## Parecer (Cursor / Expedição #199)

1. **Compatibilidade de numeração:** neste SHA, Expedição permanece em **036** — alinhado à reserva comercial **025–035** do tip `#178` (parecer separado). Sem colisão observada em `server/migrations/` deste tip.
2. **Contrato Pedido:** a validação `getForExpedicao` é desejável para o gate de criação vinculada; **não** autoriza tip-port automático das portas Pedido/estoque da #199 até declaração FINAL + coordenação explícita.
3. **Não mesclar pareceres:** aprovação/compatibilidade documentada para `#178@4f8c6593` **não** se aplica automaticamente a `#200@619bddd0`. Qualquer promoção exige reavaliação deste SHA (ou sucessor pinado).
4. **Risco residual:** tip `#200` declara conflitos semânticos históricos com composição `#178` e deixa CI Linux do próprio tip sob responsabilidade do Codex; Cursor **não** tip-porta nem mergeia este branch.
5. **Arquivos compartilhados:** `expedicaoService.ts` / router / migrations — propriedade Cursor na #199 para superfície de persistência canônica; evolução Contrato Pedido neste tip Codex deve ser revisada por SHA antes de integração.

## Conclusão

| Decisão | Valor |
|---|---|
| Tip-port para #199 | **NÃO** |
| Extensão do parecer #178 → #200 | **NÃO** |
| Merge / VPS / migração operacional | **Bloqueado** |
| Próximo passo | Aguardar FINAL do Codex no #200 + CI verde do tip; reavaliar por SHA se o tip avançar além de `619bddd0` |

**Registro:** parecer emitido apenas no canal documental combinado (PR comments bloqueados ao agente).
