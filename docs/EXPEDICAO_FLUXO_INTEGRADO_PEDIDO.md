# Expedição — fluxo integrado Pedido→pendências (lacunas pós-#195)

## Escopo

Branch `cursor/expedicao-fluxo-integrado-pedido-392b` fecha lacunas do fluxo consolidado (#195):

1. Seleção de **Pedidos** elegíveis para separação (`selectPedidosParaSeparacao`)
2. **Unidades** na conferência (unidade pedida × separada)
3. **Rollback** de despacho parcial (`applyDespachoPatchesWithRollback` + wire no `RomaneioForm`)
4. Soft `group||empresa` endurecido em `PedidosEntregaTab`, `IntegracaoRomaneio`, `SeparacaoConferenciaIA`
5. UI: picker de Pedido na Separação IA; atalho Separação na listagem de entregas

## Não alterado (reserva Codex)

Pedido/Orçamento services, migration 026–035, classificação histórica, mapeador legado, Armado/Corte/Dobra.

Side-effect legado `updateInContext("Pedido")` permanece documentado em `EXPEDICAO_SEPARACAO_PEDIDO_LEGADO.md`.

## Homologação rápida

1. Empresa ativa → Separação IA lista só pedidos elegíveis da empresa.
2. Troca de empresa → seleção cruzada bloqueada.
3. Conferência com unidade divergente → bloqueia.
4. Romaneio com 2+ entregas: se update falhar no meio → status das já despachadas volta (rollback) e auditoria `Romaneio.gerar.rollback`.
5. Listagem: botão Separação em “Aguardando/Em Separação”.

## Rollback de código

Reverter commits desta branch / fechar draft PR. Sem migration.
