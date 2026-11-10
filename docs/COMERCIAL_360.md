# Comercial 360

## Decisao vigente do proprietario (2026-11-10)

A Central de Vendas360 ocupa o acesso atual Pedidos. Retirar somente a entrada
separada Orcamento do menu, preservando registros, servicos, historicos e acessos
anteriores por redirecionamento quando necessario. Esta decisao substitui a de
05/11 sobre ocupar Orcamentos; nao criar outra central ou candidata.
Referencia aprovada: documento Comercial360, revisao consolidada10/11, versao6.
Hierarquia: Regra-Mae atualizada > decisoes especificas10/11 > ORDEM2 > imagem.
Preservar identidade azul/branca, proporcoes, duas grades simultaneas e Cliente360
retratil/destacavel; nao adicionar paineis permanentes. O texto de12colunas e
Fechar Orcamento em Aberto prevalece sobre a imagem ilustrativa desatualizada.
Cursor permanece escritor da interface/composicao; Codex revisa backend/legado.
Orcamento e Pedido permanecem registros distintos e vinculados; nao unir seus
estados, persistencias ou efeitos. Mapa dirigido de integracoes, dependencias de
Fornecedor/Produto e limites das provas foi reconciliado no programa existente
`PROGRAMA_COMERCIAL_360_OMNICANAL_EXECUCAO_AUTONOMA.md`, secao de05/11.
As lacunas historicas do Lote A abaixo nao descrevem ausencia atual de API:
orcamentoService/pedidoService e rotas canonicas JA existem. Nao reimplementa-las.
API/Auth/browser com os100clientes HML ainda exigem a prova registrada no HANDOFF.

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

Cancelamento e restauracao sao auditados. A decisao10/11 exige o fluxo de negocio
ABERTO -> verificacoes/aprovacoes -> FECHADO -> PRODUCAO/ENTREGA/RETIRA. Mapear os
estados canonicos existentes antes de alterar enums ou persistencia; o fluxo
historico acima nao autoriza ignorar essa decisao nem criar estado paralelo.
Ajustar Pedido somente em Producao/Entrega/Retira, sujeito a travas e revalidacao
de endereco, condicao, destino e tipo de NF antes da emissao; a identidade fiscal
e a emissao continuam no dominio Fiscal da empresa juridica, nunca do Grupo.

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

## Historico - diagnostico inicial do Lote A, superado pela implementacao

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
