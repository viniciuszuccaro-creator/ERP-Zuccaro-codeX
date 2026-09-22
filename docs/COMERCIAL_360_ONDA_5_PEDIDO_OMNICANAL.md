# Comercial 360 - Contrato da Onda 5: Pedido 360 Omnicanal

## Baseline preservado

O agregado `Pedido` da migration 017 é canônico e já oferece tenant, número por Empresa, ClienteEmpresa/local/obra, tabela/condição, origem de Orçamento, vendedor, Entrega/Retirada, data solicitada, itens/snapshots, produção, totais, status, histórico, RBAC, audit e conversão idempotente. A Onda 5 evolui esse agregado; não cria Pedido por canal.

## Lacunas e modelo alvo

- Origem/canal controlados: manual, orçamento, Site CPA, Portal B2B, App, Chatbot, marketplace e importação.
- Identificadores externos e idempotency key com unicidade por tenant/origem/canal; repetição divergente gera conflito.
- Tipo comercial dos itens/pedido: revenda, Armado, Corte e Dobra, fabricado, kit, serviço ou misto, derivado dos produtos e snapshots.
- Contato, campanha e vendedor; endereço/local confirmado para Entrega.
- Acréscimos, frete e impostos estimados sem permitir total informado pelo cliente.
- Crédito e aprovação como referências/eventos do Financeiro, sem copiar saldo.
- Reserva/separação como referências do Estoque, sem gravar saldo no Pedido.
- Faturamento e entrega parciais representados por vínculos/quantidades, sem reescrever item original.
- Anexos e observações versionados/sanitizados pelo contrato DAM.

## Estados e marcos

Preservar os estados atuais enquanto consumidores migram. A evolução será aditiva e mapeada para o fluxo completo: aprovação, reserva/separação, produção quando aplicável, pronto, expedição/retirada, faturamento e `FINALIZADO`. Não usar “Fechado”.

- Antes de reserva/produção/faturamento: edição conforme RBAC.
- Após marco crítico: alteração material cria revisão/solicitação de mudança e operações compensatórias nos módulos donos.
- Cancelamento exige motivo e avaliação de impactos; não apaga Pedido, histórico, reserva, OP, entrega, NF ou título.
- Tipo de NF é exigido somente no gate de faturamento e pertence ao Fiscal; Pedido guarda apenas referência/snapshot necessário.

## Contratos downstream

- Estoque: solicitação idempotente de reserva/liberação por item e empresa.
- Produção: solicitação de OP com revisão técnica congelada para itens produtivos.
- Expedição: Entrega/Retirada, janela, peso/volume e endereço confirmado.
- Financeiro: análise de crédito, geração de parcelas/títulos e recebimentos.
- Fiscal: faturamento parcial/total pela Empresa jurídica responsável.
- Outbox: eventos versionados `pedido.criado`, `pedido.revisado`, `pedido.status-alterado`, `pedido.cancelado` e solicitações aos módulos donos.

Nenhuma integração downstream é marcada concluída apenas por gravar status no Pedido.

## API, concorrência e RBAC

Preservar `/api/v1/pedidos`. Extensões futuras usam sub-recursos para revisões, aprovações, vínculos e operações em lote. Toda mutação usa uma transação, request ID, executor compartilhado, audit e outbox. Idempotência e lock impedem pedido/número/reserva duplicados.

Permissões mínimas: visualizar, criar, editar, cancelar, alterar-status, converter, revisar, aprovar-desconto, aprovar-crédito, reservar, liberar-reserva, enviar-producao, enviar-expedicao e solicitar-faturamento. Cada módulo downstream reautoriza sua própria ação.

## Compatibilidade

Frontend canônico e operação legada preservada como fallback continuam na mesma entrada Comercial. Site/Portal/Chatbot/marketplaces deixam de persistir pedidos próprios somente após adaptadores, reconciliação e E2E. Campos novos são opcionais durante transição; snapshots históricos permanecem imutáveis.

## Primeiro checkpoint de implementação

1. Adicionar origem/canal/external ID/idempotency ao domínio atual com migration aditiva após reconferir `main`.
2. Cobrir create manual, conversão e canal externo com o mesmo service/repository.
3. Testar repetição igual/divergente, concorrência, tenant e audit rollback.
4. Só então integrar outbox; crédito/reserva/produção continuam bloqueados até APIs proprietárias.

## Aceite

Um único Pedido por operação externa; nenhuma duplicação por retry; Empresa proprietária preservada; snapshots e valores server-side; marcos impedem mutação retroativa; downstream explícito e idempotente; RBAC/auditoria/tenant em todas as ações; zero dados reais.