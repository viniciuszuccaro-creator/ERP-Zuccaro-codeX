# Expedição — Integração Romaneio canônica (Pedidos → despacho)

## Escopo

Branch `cursor/expedicao-integracao-romaneio-canonico-392b` (base tip #196) conecta a tela existente `IntegracaoRomaneio` à policy canônica, sem módulo paralelo:

1. `selectPedidosParaRomaneio` — elegibilidade grupo∧empresa (exclui retirada/cancelados)
2. `planEntregasFromPedidosParaRomaneio` — create/reuse idempotente via `assertEntregaOnCreate`
3. Checklist de saída + confirmação dupla
4. `resolveRomaneioDespacho` — romaneio + patches com `sequencia_rota`
5. Persistência com **rollback** se update de entrega falhar no meio
6. `resolvePedidoLegadoAposRomaneio` — side-effect descritivo Pedido → Em Trânsito (reserva Codex)

## Não alterado (reserva Codex)

Pedido/Orçamento services, migration 026–035, classificação histórica, mapeador legado, Armado/Corte/Dobra.
Export Empresas / reconciliação legado — frente do chat principal (não duplicar).

## Homologação rápida

1. Empresa ativa + permissão Romaneio → lista só pedidos elegíveis da empresa.
2. Pedido de outra empresa selecionado → bloqueia.
3. Checklist incompleto → botão desabilitado / mutation bloqueia.
4. Confirmação cancelada → audita e aborta.
5. Pedidos sem Entrega → cria Entrega `Pronto para Expedir`, depois despacha.
6. Retry com mesmas entregas → reusa Romaneio (`Romaneio.integracao.retry`).
7. Falha de update no meio → rollback + auditoria `Romaneio.integracao.rollback`.
8. Pedido legado atualizado para Em Trânsito (coordenação Codex).
9. Soft∨→∧ no caminho ocorrência/comprovante/notificador/reversa/chat (grupo∧empresa).
10. `ComprovanteEntregaDigital` e `RegistroOcorrenciaLogistica` usam `resolveRegistroEntregaFinal` + asserts (mesmo contrato de `DetalhesEntregaView`).

## Soft∨ residual (fora do caminho crítico)

Dashboards/config/financeiro com visão consolidada de grupo ainda usam `group ∨ empresa` de forma deliberada em alguns gates de leitura; mutações sensíveis do fluxo operacional já exigem ∧.

## Rollback de código

Reverter commits desta branch / fechar draft PR. Sem migration.
