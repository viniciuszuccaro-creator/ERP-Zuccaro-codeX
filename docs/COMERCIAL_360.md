# Comercial 360

## Decisao arquitetural

Evoluir `src/pages/Comercial.jsx` e os contratos backend existentes. Nao criar modulo paralelo. Cadastros Gerais permanece fonte mestre: Cliente/ClienteEmpresa, Produto, Unidade, TabelaPreco e CondicaoPagamento. Toda operacao comercial exige `groupId`, `empresaId`, ator, RBAC backend fail-closed e auditoria transacional.

## Inventario de reaproveitamento

| Dominio | Estrutura existente | Uso no plano |
| --- | --- | --- |
| Frontend Comercial | `src/pages/Comercial.jsx` | tela can?nica para Pedido/Orcamento |
| Clientes | `CadastroClienteCompleto`, `clienteTypes`, repositories e `cliente_empresas` | cliente mestre e elegibilidade por empresa |
| Precos | `tabelaPrecoService`, `postgresTabelaPrecoRepository` | tabela visivel e preco empresarial |
| Condicoes | CondicaoPagamento R08B | parcelas, escopo e referencia ClienteEmpresa |
| Produtos | `produtoTypes`, repositories e Cadastros | item, unidade e disponibilidade |
| Producao | componentes em `src/components/producao` | destino apenas de itens produtivos |
| Expedicao | componentes em `src/components/expedicao` | entrega, retirada e romaneio |
| Auditoria/RBAC | `audit_logs`, guards e services | trilha atomica e autorizacao |

Duplicidades a evitar: `CriarPedidoChat`, `OrcamentoSite`, `PedidosCliente` e componentes do Portal sao consumidores/canais; nao serao novos mestres de Pedido ou Orcamento.

## Fluxo e estados

`Em aberto -> Aguardando aprovacao -> Aprovado -> Reserva/Separacao -> Producao (quando aplicavel) -> Pronto para retirada ou entrega -> Expedicao -> Faturamento parcial/total -> Finalizado`.

Cancelamento e restauracao sao auditados; nao usar estado `Fechado`. Tipo de NF pertence ao faturamento, nao ao Pedido.

## Matriz RBAC minima

| Acao | Permissao |
| --- | --- |
| visualizar | `comercial.pedido.visualizar` / `comercial.orcamento.visualizar` |
| criar/editar | `comercial.pedido.criar`, `comercial.pedido.editar`, equivalentes de orcamento |
| aprovar/desconto | `comercial.pedido.aprovar`, `comercial.pedido.desconto.aprovar` |
| cancelar/restaurar | chaves especificas de cancelar/restaurar |
| converter | `comercial.orcamento.converter-pedido` |

Frontend oculta ou desabilita; backend autoriza e bloqueia acesso direto.

## Modelo e invariantes do Lote A

Agregados can?nicos: Orcamento + Itens e Pedido + Itens. Cada cabe?alho tem grupo, empresa proprietaria, cliente/ClienteEmpresa validos, codigo sequencial reservado no backend, lifecycle, totais calculados no servidor, soft delete e auditoria antes/depois. Itens usam Produto/Unidade existentes, quantidade/valor/desconto validados. Conversao Orcamento->Pedido e idempotente, preserva origem e nao duplica itens.

Descontos por item e total obedecem limite do perfil; acima do limite ficam aguardando aprovacao. Nao ha saldo, estoque, NF ou titulo financeiro duplicado no Lote A.

## Plano de migrations e API

Nenhuma migration aplicada sera alterada. O Lote A primeiro confirma se ja existem tabelas/contratos de Pedido/Orcamento; somente schema inexistente e aprovado recebe migration aditiva em lote proprio, com RLS+FORCE, FKs tenant-aware e rollback documentado. API/facade reutiliza router, TenantGuard, RBAC, transacao e audit existentes; frontend adota facade hibrida sem confiar no navegador para autorizacao.

## Lotes

A: Orcamento/Pedido/Itens/Totais/Descontos basicos/Conversao.
B: preco, condicao, desconto e aprovacao.
C: estoque, reserva e producao.
D: expedicao, faturamento e financeiro.
E: frontend, integracao e E2E.

## Testes do Lote A

Criar, editar, listar, obter, inativar/restaurar, conversao idempotente, Grupo/Empresa cruzados bloqueados, ator sem permissao bloqueado, desconto acima da alcada, calculo server-side, auditoria e concorrencia do codigo. Validar pagina??o e filtros quando a listagem existir.

## Diagnostico do Lote A

A busca focal em `server/src`, migrations e testes confirmou ausencia de contrato backend, tabela ou rota de Pedido/Orcamento. `server/src/api/router.ts` declara que ambos nao estao implementados; migrations 013/014 tambem os excluem explicitamente. Portanto o Lote A devera introduzir somente os agregados canonicos, em migration aditiva e branch propria deste lote, reutilizando ClienteEmpresa, Produto, TabelaPreco, CondicaoPagamento, sequencia, TenantGuard, RBAC e audit existentes. Nenhuma tela paralela sera criada.

## Lote A3.1 - Frontend funcional de Orcamento

- Rota e entrada: `/comercial`, modulo `Orcamentos` no launchpad existente, aberto no gerenciador de janelas do ERP. Nao foi criada pagina ou rota paralela.
- Persistencia oficial: `createHttpApiClient().orcamentos`, exclusivamente nas rotas `/api/v1/orcamentos`; nao existe chamada a `base44.entities.Orcamento` nem armazenamento local como fonte oficial.
- Contexto: `groupId`, `empresaId`, `actorId` e `actorEmail` procedem de `useContextoVisual` e `UserContext`. As chaves React Query incluem Grupo e Empresa, e a troca de contexto fecha detalhes/formulario, reinicia pagina e carrega novo cache.
- Fontes mestres: ClienteEmpresa, Cliente, CondicaoPagamento, Produto e UnidadeMedida continuam usando `filterInContext`, o adaptador oficial ja existente, ate seus clientes HTTP frontend canonicos serem ativados. Nenhum cadastro foi duplicado.
- RBAC visual fail-closed: menu/lista/detalhe exigem `Comercial.orcamento.visualizar`; criar, editar e cancelar exigem as chaves exatas correspondentes. Editar/cancelar so aparecem em `EM_ABERTO`; o backend A2.3 continua autoridade final.
- Experiencia: listagem paginada pela `meta` da API, loading/vazio/erro recuperavel, formulario unico de criacao/edicao, detalhe, confirmacao de cancelamento preservando registro, bloqueio de duplo envio e aviso ao abandonar alteracoes.
- Precisao: quantidade, preco e desconto sao calculados em micros com `BigInt`; tenant, numero, status e totais nunca entram no payload do navegador.
- Limites: Pedido continua nao implementado. Erros HTTP sao apresentados com mensagens seguras; mapeamento 422 por campo permanece melhoria posterior caso o backend passe a retornar caminhos estruturados.

## Mapa preparatório — Central de Vendas 360 (2026-11-06)

## Decisão 10/11/2026 — Layout versão 6 aprovado (anexo + imagem)

**Substitui** a orientação anterior de “aguardar desenho” / soft-landing só em proposalMode.

- Launchpad: **Pedidos → Central de Vendas360°**; entrada separada **Orçamento** retirada.
- Orçamentos, pedidos, regras, serviços, registros e histórico permanecem **dentro** da Central (`OrcamentosTab` + `PedidoCanonicoPanel` + `CentralCliente360Panel`).
- Sem central paralela (`CentralVendas360Nova` / `OrcamentosV2` proibidos).
- Estrutura azul/branca versão 6: cabeçalho, faixa compacta, situações (início = Orçamentos em Aberto), tabela 12 colunas, grades simultâneas Corte/Revenda, Cliente360 lateral.
- Hierarquia: Regra-Mãe atualizada → decisões 10/11 → ORDEM2 → imagem ilustrativa.
- Contatos[] MASTER (a) permanece; aceite :15173 e composição #401 só pós-homolog.

Orçamentos/Pedidos existentes foram **reorganizados** na Central (não reescritos como módulo novo).

### Composição alvo (reuso — sem tela paralela)

| Zona | Papel | Estruturas existentes a reutilizar |
|------|-------|--------------------------------------|
| Centro | orçamento/itens, preços, unidades, descontos, estoque, totais | `OrcamentosTab`, `PedidoFormCompleto`/`PedidoItensEditor`, `SeletorUnidadeComConversao`, `DescontosItemPedido`, `ValidadorEstoquePedido`, `PedidoResumoTotal`, `orcamentoUiPolicy` |
| Contexto | Grupo/Empresa, cliente, vendedor, canal, situação | `useContextoVisual`, `WizardEtapa1Cliente`, `BadgeOrigemPedido`, launchpad `Comercial.jsx` |
| Atalhos | GoTo, atendimento, chatbot, site, e-commerce, marketplaces | `AcoesRapidasGlobal`, Hub/Chatbot existentes, `OrcamentoSite` (canal — não mestre) |
| Painéis | histórico, crédito, entregas/mapa, produção, NF, boleto/Pix, docs | `CentralCliente360Panel`, `HistoricoProdutosCliente`, `LimiteCreditoWidget`/`ValidacaoCredito`, `PainelEntregasPedido`, produção/expedição existentes, financeiro boleto |
| Rodapé | Incluir item, Salvar, Avançar, Voltar | rodapés de `PedidoFormCompleto` / wizard — mesma sessão/rascunho |

### Fluxo a preservar
abertos/orçamentos → verificações → fechados → produção, entrega ou retirada (itens mistos). Um atendimento; sem empilhar modais nem duplicar cadastros.

### Integrações (classificação)

| Integração | Estado |
|------------|--------|
| Cadastros mestres (cliente/produto/tabela/condição) | existente |
| Estoque / OP / expedição | parcial (componentes + pacotes InContext) |
| Crédito / CR / caixa | parcial |
| Chatbot / site / marketplace → rascunho humano | futura / canal consumidor |
| Bots respeitam preço/estoque/crédito/RBAC/aprovação | contrato a amarrar; exceções → atendimento |

### Próximo executável
1. ~~CI #542+#544+#545 + P1+Dashboard~~ → tip código `912bc7b0f` CI SUCCESS; pacote Codex em `docs/evidence/codex-review-pack-401-p1-dashboard-20261106.txt`.
2. Ports #467/#580 Fornecedor só após liberar WIP; #462 Banco (cadastro mestre ≠ infra DB) após rebase na candidata.
3. Desenho visual da Central — só após aprovação; até lá contratos/mapa abaixo.

### Contratos a preservar no desenho (sem tela paralela)
- Persistência: `createHttpApiClient().orcamentos` / pedidos canônicos — sem Base44 como fonte oficial.
- Rascunho: abrir painéis (histórico/crédito/estoque/entregas) sem perder itens/totais da sessão.
- Ações de etapa: Incluir item · Salvar · Avançar · Voltar — mesmos rodapés do form existente.
- Bots/canais: consumidores; exceções → atendimento humano; não marcar integração futura como funcional.
