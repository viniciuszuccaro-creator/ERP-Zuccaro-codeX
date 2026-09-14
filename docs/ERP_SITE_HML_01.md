# ERP-SITE-HML-01 - Homologacao consolidada

Data: 2026-09-13
Repositorio: `viniciuszuccaro-creator/ERP-Zuccaro-codeX`
Escopo: ERP-SITE-01 a ERP-SITE-12
Decisao: **ERP_READY_FOR_SITE_E2E**

Esta decisao autoriza a preparacao dos testes integrados com o Site CPA. Ela nao significa `GO_LIVE_READY`, nao ativa provider externo e nao autoriza dados reais, producao, pagamento ou publicacao.

## Resultado executivo

- P0 abertos: **0**.
- P1 abertos: **0**.
- P1 corrigido: health anunciava cinco capabilities centrais como `ready` sem sondar as dependencias reais.
- P2: dependencias externas e melhorias nao bloqueantes listadas neste documento.
- Operacoes publicas: **43**, todas unicas, com nome valido e roteamento confirmado.
- Testes ERP-SITE consolidados: **186/186 aprovados**.

## Matriz ERP-SITE

| Lote | Operations | Capability | Status | Testes | Blockers |
|---|---|---|---|---:|---|
| 01 Fundacao | `siteHealth` | gateway/health | Aprovado | 9 | Credenciais reais devem ser configuradas por ambiente |
| 02 Cliente | `siteClienteResolve` | `CUSTOMER_RESOLVE` | Aprovado | 11 | Criacao/vinculo continuam sujeitos a aprovacao humana |
| 03 Catalogo | `siteCatalogoList` | `CATALOG_READ` | Aprovado | 13 | Compra depende de preco e estoque validos |
| 04 Pedido | `sitePedidoCreate` | `ORDER_CREATE` | Aprovado | 19 | Pagamento e frete obedecem dependencias proprias |
| 05 Orcamento | `siteOrcamentoCreate/Get`, `siteNegociacaoGet/Responder` | `QUOTE_CREATE`, `NEGOTIATION` | Aprovado | 17 | Conversao sempre revalida Pedido |
| 06 Pagamento | `sitePagamentoCreate/Status/Cancel` | `PAYMENT` | Condicional | 19 | Provider, credencial e webhook por Empresa |
| 07 Portal | sete operacoes `sitePortal*` | `PORTAL*` | Condicional | 16 | Storage privado/assinador para documentos |
| 08 Entrega | quatro operacoes `siteEntrega*` | `DELIVERY` | Aprovado/degraded sem storage | 16 | Provas dependem de storage privado |
| 09 Chat | seis operacoes `siteChat*` | `CHAT` | Degraded | 19 | Scanner/anexo e realtime nao comprovados |
| 10 Armacao | cinco operacoes `siteArmacao*` | `PRODUCTION_INTAKE` | Degraded | 17 | Scanner/DWG; `PRODUCTION_RELEASE` bloqueado |
| 11 Obras | seis operacoes Obra/Projeto/Centro de Custo | `WORK*` | Aprovado | 16 | Mutacoes de mestre nao pertencem ao Site |
| 12 Oportunidades | quatro operacoes `siteOportunidade*` | `OPPORTUNITY_*` | Aprovado | 11 | `COMMERCIAL_COPILOT` degraded sem IA governada |

## Inventario oficial de operations

Fundacao e Cliente: `siteHealth`, `siteClienteResolve`.

Catalogo, Pedido e negociacao: `siteCatalogoList`, `sitePedidoCreate`, `siteOrcamentoCreate`, `siteOrcamentoGet`, `siteNegociacaoGet`, `siteNegociacaoResponder`.

Pagamento: `sitePagamentoCreate`, `sitePagamentoStatus`, `sitePagamentoCancel`. O webhook de provider possui contrato proprio assinado e nao e uma operation publica do gateway do Site.

Portal: `sitePortalPedidos`, `sitePortalPedidoGet`, `sitePortalNfe`, `sitePortalBoletos`, `sitePortalDuplicatas`, `sitePortalPagamentos`, `sitePortalDocumento`.

Entrega: `siteEntregaList`, `siteEntregaGet`, `siteEntregaTimeline`, `siteEntregaComprovantes`.

Chat: `siteChatStart`, `siteChatMessage`, `siteChatPoll`, `siteChatHistory`, `siteChatClose`, `siteChatReopen`.

Armacao: `siteArmacaoCreate`, `siteArmacaoGet`, `siteArmacaoUpdate`, `siteArmacaoConfirm`, `siteArmacaoEnviarParaComercial`.

Obras: `siteObraList`, `siteObraGet`, `siteProjetoList`, `siteProjetoGet`, `siteCentroCustoList`, `siteCentroCustoGet`.

Oportunidades: `siteOportunidadeList`, `siteOportunidadeGet`, `siteOportunidadeContext`, `siteOportunidadeSignal`.

Nao foram encontradas duplicidades, conflitos de nome ou operacoes de dominio sem roteamento.

## Capabilities e health

O health retorna `status`, `timestamp`, versao, origem, escopo, capabilities e dependencias sem segredo. `CUSTOMER_RESOLVE`, `CATALOG_READ`, `ORDER_CREATE`, `QUOTE_CREATE` e `NEGOTIATION` agora dependem de sondagem real de entidades e metodos; falha no nucleo torna o health `blocked`.

Dependencia externa indisponivel torna o health `degraded`, sem impedir por si so o inicio do E2E. Estados esperados:

- `CUSTOMER_RESOLVE`, `CATALOG_READ`, `ORDER_CREATE`, `QUOTE_CREATE`, `NEGOTIATION`, `OPPORTUNITY_READ`: `ready` somente com dependencias consultaveis.
- `PAYMENT`: `ready` somente com provider, metodos, credenciais e mapeamento configurados.
- `PORTAL`, `PORTAL_FINANCIAL`, `PORTAL_FISCAL`, `PORTAL_DOCUMENT`: calculados separadamente.
- `DELIVERY`: `degraded` quando leitura funciona sem assinador privado.
- `CHAT`: `degraded` enquanto anexo seguro e realtime nao estiverem comprovados.
- `WORK`, `WORK_PROJECTS`, `WORK_COST_CENTER`: dependem das entidades existentes.
- `PRODUCTION_INTAKE`: `degraded` sem storage/scanner; `PRODUCTION_RELEASE`: sempre `blocked` neste contrato.
- `OPPORTUNITY_SIGNAL`: depende de leitura e criacao real de Oportunidade.
- `COMMERCIAL_COPILOT`: `degraded` com regras estruturadas; IA generativa nao e anunciada como pronta.

## Seguranca, RBAC e multiempresa

Foram revalidados token de servico, HMAC, timestamp, nonce, replay, rate limit, ledger idempotente, correlation ID, limite de payload, Grupo e Empresa resolvidos no servidor. A credencial `SITE_CPA` nao e superadmin.

As suites cobrem acesso cruzado para Cliente, Produto, Pedido, Orcamento, Pagamento, NF-e, Entrega, Chat, Armacao, Obra, Projeto, Centro de Custo e Oportunidade. IDs adulterados ou recursos de outro Cliente/Grupo/Empresa falham fechados.

Os papeis `ADMIN_EMPRESA`, `COMPRADOR`, `FINANCEIRO` e `CONSULTA` sao avaliados por operacao. O papel vem do vinculo empresarial aprovado, nunca do payload. `allowedWorkIds` e aplicado nos fluxos de obra.

Mass assignment de pagamento, status, role, preco, vendedor, producao, score e prioridade e bloqueado ou ignorado conforme o contrato. `paid=true` nao liquida titulo; confirmacao de Armacao nao aprova tecnicamente; sugestao nao executa acao.

## Idempotencia, auditoria e privacidade

Pedido, Orcamento, resposta de negociacao, Pagamento, mensagem, Armacao e sinal de Oportunidade possuem testes de repeticao e conflito. O mesmo evento legitimo nao cria dois Pedidos, pagamentos, chats, pacotes ou sinais.

Auditorias preservam operation, correlation ID, resultado, Grupo e Empresa, sem payload integral. Respostas externas nao incluem custo, margem, notas internas, comissao, credencial bancaria, segredo, storage path ou score CRM privado.

Documentos de Portal e comprovantes de Entrega exigem ownership, MIME permitido, URI privada, protecao contra traversal e URL assinada curta. Nota interna de Chat nunca vira mensagem publica.

## Configuracao para E2E

| Dependencia | Estado de homologacao | Acao antes do cenario correspondente |
|---|---|---|
| ERP runtime/Base44 | Contrato pronto | Disponibilizar ambiente de homologacao e entidades |
| Credencial SITE_CPA | Nao deve existir no Git | Configurar token, HMAC, Grupo e Empresas no ambiente |
| Payment provider | Condicional | Configurar sandbox Asaas/Juno, webhook e customer mapping |
| Storage privado | Condicional | Configurar assinador para documentos e provas |
| Malware scanner | Nao verificado | Exigir antes de liberar anexos tecnicos/chat |
| DWG converter | Nao verificado | Necessario somente para conversao automatica futura |
| AI provider | Nao verificado | Manter Copiloto em regras estruturadas/degraded |
| SMTP/WhatsApp | Nao requerido pelo nucleo | Homologar apenas quando o cenario utilizar envio externo |

Nenhum segredo deve ser impresso em log ou armazenado no frontend.

## Dataset necessario

Preparar no ambiente de homologacao, sem copiar dados reais automaticamente: Grupo CPA; CPA Ferro e Aco; empresa nao permitida para teste negativo; Cliente A e Cliente B; usuario externo para cada papel; vinculo aprovado e revogado; obras permitida e bloqueada; Produtos ativo/inativo/sem preco/sem estoque; tabela de preco; Pedido; Orcamento com versoes; NF-e; ContaReceber; tentativa de Pagamento; Entrega parcial e concluida; Conversa com nota interna; Armacao com revisao; Projeto/Centro de Custo; Oportunidade.

## Achados

### P0

Nenhum aberto.

### P1

Corrigido nesta homologacao: capabilities centrais fixas no health. A implementacao foi extraida para helper testavel e agora falha fechada quando a dependencia central nao responde.

Nenhum P1 permanece aberto.

### P2 / backlog

- Atualizar dados de Browserslist e revisar bundle principal em lote proprio.
- Homologar scanner, storage, DWG, IA e mensageria quando os provedores forem escolhidos.
- Executar E2E real contra ambiente de homologacao e Site CPA em etapa separada.

## Evidencias

- Suite consolidada ERP-SITE: 186/186 testes aprovados.
- Inventario: 43 operations unicas e roteadas.
- Cenarios existentes cobrem HMAC, replay, rate limit, idempotencia, cross-tenant, RBAC, mass assignment, privacidade, webhook, signed URL, Chat, Armacao e limites de IA.
- Nenhum dado real foi criado e o Site CPA nao foi alterado.

## Decisao

**ERP_READY_FOR_SITE_E2E**

O gateway, os contratos centrais, a seguranca e o isolamento estao aptos a iniciar testes integrados. Capabilities dependentes de provider continuam honestamente `blocked` ou `degraded`. A decisao de go-live permanece posterior e conjunta.

- Suite global: 438/438 testes aprovados.
- ESLint global, `audit:baseline`, build e `git diff --check` aprovados.
- Typecheck global: baseline historico mantido em 2.238 diagnosticos, sem regressao.
