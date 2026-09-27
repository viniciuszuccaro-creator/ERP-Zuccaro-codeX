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

## Gate 025 — correção Codex coordenada (2026-09-27)

A migration 025 ainda não aplicada na VPS (auditoria read-only:001–024) deixa falhas de SET NOT NULL propagarem ao migrator. Reexecução2x preserva origem MANUAL/ORCAMENTO. Trigger sintético que mantém NULL no backfill prova erro23502 e rollback sem registrar schema_migrations, em PGlite e PostgreSQL isolado da CI. Nenhuma migration histórica001–024 alterada nem migration paralela criada. Conteúdo deve ser adotado como canônico entre #50 e #92, com revisão Cursor antes da integração; não aplicar na VPS nesta frente. #51/#52/#53, grants/policies operacionais e providers permanecem gates independentes; canaisOFF. #96 acesso tem prioridade e não é substituída por este lote.

## Versionamento de entradas externas — candidato consolidado

O recibo de entrada mantém external_id e idempotency_key no Orçamento raiz. Descendentes mantêm origem/canal/campanha e apontam para a mesma raiz, mas não copiam as chaves únicas de transporte; retry externo continua recebendo o documento original. A supersessão libera o número aberto antes de inserir a nova versão, na mesma transação dos itens e dos dois audits. Falha em qualquer passo reverte a supersessão; nenhuma versão aberta fica perdida. A migration027 ainda não aplicada faz backfill da raiz dos históricos e impõe NOT NULL; INSERT inicial gera id e raiz juntos.

Testes nos quatro canais usam preço calculado pelo serviço existente, histórico1/2/3, isolamento e falha real de audit com rollback. SQL027 é executado2x contra históricos. Ordem de integração: acesso#96 primeiro; candidato canônico025–028 corrigido/revisado no lote#92 em coordenação com#50–#53; contratos029–032 revalidados;033/RLS e grants de papel operacional homologados;#93 monitoramento. Cursor deve revisar HEAD final e CI deve passar antes merge; depois CI PUSHmain, backup/migration/canário/deploy. Provedores reais e canais permanecem desligados até homologação específica. Não há autorização técnica implícita para inventar mapeamento histórico de tipo comercial (#51).

Tipo de Produto não reconhecido agora bloqueia a venda com422 antes de persistência, inclusive com hint de produção. Uma decisão comercial explícita deve regularizar o cadastro; repetir a mesma entrada após o ajuste não duplica venda nem encontra nonce falsamente consumido. Isso fecha a conversão silenciosa no runtime, mas não resolve o backfill histórico026 nem inventa política comercial de classificação.

## Gate histórico026

A primeira introdução de tipo_comercial/tipo_comercial_snapshot exige tabelas vazias ou um lote de mapeamento histórico explícito já validado. Havendo dados sem essas colunas,026 aborta antes do DDL com PEDIDO_HISTORICAL_TYPE_MAPPING_REQUIRED sob lock; não rotula tudo como REVENDA. Reexecução preserva snapshots previamente classificados e valida NOT NULL. SQL real em PGlite/PG prova rollback sem registro de migration e preservação de SERVICO após repetição2x. O bloqueio de segurança não equivale a um backfill aprovado: conferir os históricos do destino, preservar backup, definir/revisar mapeamento e reconciliar antes de aplicar. Não apagar pedidos para liberar o gate.
