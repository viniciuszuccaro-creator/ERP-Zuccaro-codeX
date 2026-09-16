# PLANO_CPA_B2B_MARKETPLACE_ERP.md — EXECUÇÃO NO ERP ZUCCARO

## 0. FINALIDADE

Este documento é o plano de execução do ERP Zuccaro para suportar o CPA B2B Marketplace.

Plano mestre do produto/site: `viniciuszuccaro-creator/cpa-ferro-e-a-o/PLANO_CPA_B2B_MARKETPLACE.md`.

Antes de trabalhar, ler o `AGENTS.md` deste repositório. Não criar módulos, cadastros, portais, chats, fluxos ou endpoints paralelos se já houver estrutura equivalente.

O ERP é a fonte mestre operacional. O site é canal digital/comercial.

### Regra-mãe B2B

Nenhuma informação comercial, pedido, orçamento, pagamento, produção ou atendimento originado no Site CPA deve depender de redigitação manual para existir no ERP. Quando o usuário concluir uma ação comercial no site, os dados estruturados devem chegar ao módulo correspondente do ERP de forma segura, idempotente, auditável e vinculada aos identificadores oficiais.

---

# 1. H0 — HOMOLOGAÇÃO TÉCNICA OBRIGATÓRIA

Prioridade imediata. H0 não é go-live; serve para retirar o site de `BLOCKED_PENDING_ERP`.

## Fundação S2S

Implementar/confirmar:

- origem nativa `SITE_CPA`;
- service token S2S dedicado;
- `empresa_id` e `group_id` oficiais CPA;
- autenticação S2S server-to-server;
- `x-origem`;
- `x-correlation-id`;
- idempotency key;
- timeout;
- retry limitado;
- auditoria;
- logs sanitizados;
- proteção contra replay/abuso;
- error mapping estável.

## Contratos/endpoints esperados pelo site

### Catálogo
- leitura autorizada de produtos;
- categorias;
- especificações;
- preços permitidos;
- disponibilidade/estoque;
- token de leitura dedicado quando aplicável.

### Cliente
- `siteClienteResolve`;
- retorna/vincula `erp_customer_id` de forma segura;
- sem cadastro mestre paralelo no site;
- impedir cross-customer.

### Pedido
- `sitePedidoCreate`;
- consulta/status;
- idempotência;
- revalidação de produto/preço/estoque/condição;
- origem e correlação preservadas;
- retorno de `erpOrderId`.

### Chat
- `siteChatStart`;
- `siteChatMessage`;
- `siteChatPoll` ou mecanismo equivalente existente;
- integrar inbox/hub/chatbot atual do ERP;
- não criar CRM paralelo.

### Pagamento
- `sitePagamentoCreate`;
- `sitePagamentoStatus`;
- `sitePagamentoCancel`;
- webhook HMAC;
- idempotência;
- proteção replay;
- confirmação financeira somente backend.

### Portal
- `sitePortalPedidos`;
- `sitePortalNfe`;
- `sitePortalBoletos`;
- `sitePortalDuplicatas`;
- `sitePortalEntregas`;
- `sitePortalDocumento`.

Todo retorno deve ser filtrado por cliente/empresa. Documento sensível somente como base64 seguro ou URL HTTPS assinada de curta duração.

## Saída de H0

- contratos documentados;
- testes focados;
- evidência de chamadas reais;
- status de bloqueio atualizado;
- commit/push;
- sem declarar go-live.

---

# 2. B2B-01 — NÚCLEO COMERCIAL

Preservar `SITE_CPA` como origem técnica e distinguir finalidade comercial:

- `SITE_CPA_COMPRA`;
- `SITE_CPA_ORCAMENTO`;
- `SITE_CPA_ARMACAO`.

Todo registro vindo do site deve preservar:

- cliente;
- grupo/empresa;
- vendedor responsável;
- obra/projeto quando houver;
- origem;
- IDs externos e ERP;
- itens/SKU/especificações;
- unidade/quantidade;
- preço/tabela/desconto;
- frete;
- entrega/retirada;
- endereço;
- pagamento;
- observações/anexos;
- correlação;
- idempotência;
- auditoria.

Status mínimos:

`RASCUNHO -> RECEBIDO_SITE -> EM_ANALISE -> AGUARDANDO_CLIENTE -> APROVADO -> PEDIDO -> FATURAMENTO/PRODUCAO -> EXPEDICAO -> FINALIZADO`.

Exceções: `PENDENTE_SINCRONIZACAO`, `BLOQUEADO`, `CANCELADO`.

---

# 3. B2B-02 — CATÁLOGO B2B

ERP deve ser fonte mestre de:

- código/SKU;
- produto;
- categoria/subcategoria;
- especificação;
- marca;
- unidade;
- peso;
- conversões;
- tabela/preço autorizado;
- preço específico do cliente;
- promoções quando aplicáveis;
- estoque/disponibilidade;
- mínimo/múltiplo;
- status ativo;
- ficha técnica;
- empresa;
- regras de entrega/retirada.

Contrato deve suportar busca por código, descrição e variações de especificação.

---

# 4. B2B-03 — LISTA DE MATERIAIS / ORÇAMENTO

Receber lista estruturada do site e criar oportunidade/orçamento no fluxo Comercial/CRM existente.

Preservar:

- cliente;
- obra;
- itens;
- quantidade;
- observação por item;
- origem;
- vendedor;
- histórico.

Objetivo: vendedor não redigitar produtos.

Fluxo:

Recebido -> Revisão -> Precificação -> Negociação -> Proposta -> Aprovação -> Pedido.

---

# 5. B2B-04 — VENDA ONLINE

Antes de autorizar venda:

- revalidar produto;
- especificação;
- preço;
- estoque;
- unidade;
- quantidade;
- tabela;
- cliente;
- limite/crédito quando aplicável;
- condição;
- endereço;
- frete;
- empresa;
- restrições fiscais/comerciais.

Frontend nunca é fonte de verdade de preço, estoque ou autorização.

---

# 6. B2B-05 — CONTA EMPRESARIAL

Suportar CNPJ com múltiplos usuários, reutilizando cadastros/permissões existentes.

Perfis iniciais:

- Administrador da conta;
- Comprador;
- Financeiro.

Suportar:

- obras;
- endereços;
- compradores;
- centros de custo;
- tabela;
- condição;
- vendedor;
- limite;
- isolamento total entre clientes.

---

# 7. B2B-06 — NEGOCIAÇÃO

Receber ações como `Solicitar melhor preço`/`Negociar com vendedor`.

Vendedor deve revisar:

- preço;
- desconto;
- frete;
- prazo;
- condição;

Respeitar alçadas/RBAC/auditoria. Proposta deve voltar ao portal/site sem redigitação.

---

# 8. B2B-07/07A/07B — MONTE SUA ARMAÇÃO + PROJETO

O ERP deve receber dados estruturados do configurador e do leitor de projetos.

Tipos iniciais:

- Viga;
- Coluna;
- Estaca;
- Bloco;
- Sapata.

Campos devem preservar, quando aplicáveis:

- marca/identificação da peça;
- quantidade;
- largura;
- altura;
- comprimento;
- barras principais;
- bitola principal;
- estribos;
- bitola de estribo;
- espaçamento;
- observações;
- arquivo/revisão;
- origem no projeto;
- confiança da extração;
- confirmação humana.

Nenhum dado ausente pode ser inventado.

---

# 9. CPA PROJECT READER — CONTRATO ERP

Quando o site enviar projeto analisado, ERP deve armazenar/rastrear:

- arquivo original ou referência segura;
- hash;
- versão/REV;
- data;
- cliente;
- obra;
- extração original;
- peças estruturadas;
- alterações feitas pelo cliente/operador;
- origem por prancha/página/detalhe;
- nível de confiança;
- confirmação;
- vendedor/responsável;
- status.

Revisões nunca sobrescrevem silenciosamente versões anteriores.

---

# 10. B2B-08 — ARMAÇÃO -> ORÇAMENTO

Receber projeto/armações estruturados no Comercial.

Vendedor poderá:

- revisar;
- corrigir dentro do processo autorizado;
- precificar;
- aplicar regra comercial;
- definir frete;
- prazo;
- enviar proposta.

Sem redigitação.

---

# 11. B2B-08A — ARMAÇÃO -> PRODUÇÃO

Após aprovação:

Orçamento -> Pedido -> Ordem de Produção.

Reutilizar Produção existente e enviar automaticamente informações necessárias para:

- matéria-prima;
- corte;
- dobra;
- armado;
- quantidade;
- peso;
- etiquetas;
- separação;
- prazo;
- rastreabilidade do projeto/revisão.

Nenhum agente/IA libera produção sozinho sem autorização prevista.

---

# 12. B2B-09/B2B-10 — RECOMPRA E OBRAS

ERP deve suportar:

- histórico;
- duplicar pedido/lista;
- produtos frequentes;
- obra vinculada;
- endereço/responsável/centro de custo;
- pedidos/NF/boletos/entregas por obra quando aplicável.

---

# 13. B2B-11 — LOGÍSTICA

Expor ao site apenas eventos autorizados do fluxo real:

- Separação;
- Produção;
- Pronto;
- Roteirizado;
- Saiu para entrega;
- Entregue.

Quando permitido: previsão, comprovante, assinatura, documento/fotos autorizadas.

Nunca expor outros clientes, rota completa ou informação interna desnecessária.

---

# 14. B2B-12 — FINANCEIRO/FISCAL

Expor com isolamento por cliente:

- títulos em aberto;
- próximos vencimentos;
- vencidos;
- pagos;
- boleto/2ª via;
- PIX quando aplicável;
- duplicatas;
- NF-e;
- documentos autorizados.

ERP/fiscal continua fonte oficial.

---

# 15. B2B-13 — ATENDIMENTO OMNICHANNEL

Conversa do site deve entrar no atendimento existente com contexto permitido:

- cliente;
- usuário;
- página;
- produto;
- carrinho;
- lista;
- orçamento;
- pedido;
- obra;
- armação/projeto;
- vendedor.

Resposta do vendedor volta ao site pelo contrato homologado.

---

# 16. IA/AGENTES NO ERP

Agentes previstos:

- CPA Quote Agent;
- CPA Sales Copilot;
- CPA Support Agent;
- CPA Integration Watchdog;
- integrações com CPA Project Reader/Rebar Agent do fluxo do site.

Regras:

- menor privilégio;
- ferramentas específicas;
- RBAC;
- auditoria;
- correlação;
- sem segredo em prompt;
- sem inventar preço/estoque/medida;
- sem ação financeira/fiscal/produção crítica sem autorização;
- confirmação humana quando exigida.

---

# 17. OBSERVABILIDADE

Disponibilizar sinais suficientes para monitorar:

- disponibilidade ERP/API;
- catálogo;
- cliente;
- pedido;
- pagamento;
- portal;
- chat;
- Project Reader/importações;
- webhooks;
- latência;
- retries;
- erros persistentes;
- filas/dead-letter quando houver.

---

# 18. H1 — HOMOLOGAÇÃO FINAL B2B

Somente após as fases necessárias ao escopo inicial.

Testes ponta a ponta:

1. Compra direta -> ERP -> pagamento -> NF -> entrega -> portal.
2. Lista -> vendedor -> proposta -> aprovação -> pedido.
3. Armação manual -> vendedor -> produção.
4. Projeto PDF/DWG/DXF -> extração -> conferência -> ERP -> vendedor -> produção.
5. Chat site -> ERP -> vendedor -> resposta site.
6. Cliente A tentando acessar cliente B.
7. Replays/duplo clique/webhook repetido.
8. Falha ERP e recuperação.
9. Arquivo malicioso/grande/baixa confiança.
10. Rollback.

GO-LIVE só pode ser aprovado com build/testes/E2E reais, ERP/S2S, pagamento, fiscal, financeiro, produção, portal, chat, segurança, observabilidade e homologações comercial/fiscal/financeira aprovadas.

---

# 19. ORDEM CODEX RECOMENDADA

1. H0: `SITE_CPA` + token S2S + empresa/grupo + contratos comuns.
2. `siteClienteResolve`.
3. catálogo e `sitePedidoCreate`/status.
4. pagamento + webhook HMAC.
5. portal/documentos.
6. chat.
7. B2B-01 núcleo comercial.
8. B2B-03 lista/orçamento.
9. B2B-04 venda direta.
10. B2B-05/06 conta B2B + negociação.
11. B2B-07/08 contratos de armação/projeto.
12. B2B-08A produção.
13. logística/financeiro/atendimento/observabilidade.
14. H1 homologação final.

Cada lote autorizado deve terminar com status atualizado, testes aplicáveis, commit e push. Não avançar para o próximo lote sem autorização, salvo autorização explícita para continuidade.

---

# 20. EXECUCAO ERP-SITE-01 - FUNDACAO S2S

O gateway existente `legacyIntegrationsMirror` passa a reconhecer o contrato `SITE_CPA` versao `1`, sem alterar os contratos legados de API, marketplaces, pagamentos, fiscal ou configuracoes.

## Requisicao

Headers obrigatorios:

- `Authorization: Bearer <SITE_CPA_SERVICE_TOKEN>`;
- `Content-Type: application/json`;
- `x-origin: SITE_CPA`;
- `x-correlation-id`;
- `x-site-cpa-timestamp` em ISO-8601;
- `x-site-cpa-nonce` unico;
- `x-site-cpa-signature` HMAC-SHA256 de `timestamp.nonce.corpo-bruto`;
- `idempotency-key` para todas as operacoes exceto `siteHealth`.

Envelope:

```json
{
  "version": "1",
  "operation": "siteHealth",
  "context": {
    "empresaId": "empresa-autorizada-opcional"
  },
  "data": {}
}
```

O Grupo nunca e escolhido pelo Site: vem de `SITE_CPA_GROUP_ID`. A Empresa padrao vem de `SITE_CPA_DEFAULT_EMPRESA_ID` e qualquer Empresa solicitada precisa estar em `SITE_CPA_ALLOWED_EMPRESA_IDS` e pertencer ao Grupo configurado.

## Configuracao de ambiente

- `SITE_CPA_SERVICE_TOKEN`;
- `SITE_CPA_HMAC_SECRET`;
- `SITE_CPA_GROUP_ID`;
- `SITE_CPA_DEFAULT_EMPRESA_ID`;
- `SITE_CPA_ALLOWED_EMPRESA_IDS`;
- `SITE_CPA_RATE_LIMIT` opcional, padrao 120;
- `SITE_CPA_RATE_WINDOW_MS` opcional, padrao 60000.

Segredos nunca entram em commit, frontend, resposta ou auditoria.

## Persistencia e comportamento

- `IntegracaoEvento` registra somente hashes, correlacao, escopo, operacao, estado e resposta necessaria para idempotencia;
- nonce repetido, chave reutilizada com corpo diferente, Empresa/Grupo adulterados e ledger indisponivel falham fechados;
- o corpo JSON e limitado a 1 MiB;
- `siteHealth` e a unica operacao habilitada no ERP-SITE-01;
- operacoes dos lotes seguintes respondem `501 site_cpa_operation_not_implemented`, sem sucesso falso.

Proximo lote: ERP-SITE-02, resolucao de Cliente e solicitacao/aprovacao de vinculo empresarial, reutilizando Cliente, enderecos, contatos e RBAC existentes.

---

# 21. EXECUCAO ERP-SITE-02 - CLIENTE E CONTA EMPRESARIAL

A operacao siteClienteResolve foi integrada ao mesmo gateway v1. A deteccao do novo canal agora exige origem oficial SITE_CPA; uma operacao legada com nome site*, sem essa origem, continua fora do gateway S2S.

## Requisicao

~~~json
{
  "version": "1",
  "operation": "siteClienteResolve",
  "data": {
    "cnpj": "11.222.333/0001-81",
    "externalUserId": "usuario-estavel-do-site",
    "role": "COMPRADOR",
    "email": "dado-auxiliar@cliente.example"
  }
}
~~~

- identificadores mestres aceitos: CNPJ valido ou erpCustomerId previamente vinculado;
- externalUserId/siteUserId e obrigatorio para ownership da conta;
- e-mail e telefone nunca resolvem ou aprovam Cliente isoladamente;
- papeis externos permitidos: ADMIN_EMPRESA, COMPRADOR, FINANCEIRO e CONSULTA; eles nao equivalem ao perfil RBAC interno;
- groupId, empresaId, vendedor e papel enviados pelo Site nao sao confiados.

## Vinculo e ownership

- Cliente permanece o mestre da conta empresarial; nao existe cadastro paralelo;
- SolicitacaoAprovacao com tipo vinculo_site_cpa_cliente registra solicitacao, decisao e papel externo;
- ContatoB2B pode ser associado como referencia auxiliar por coincidencia exata dentro do Cliente e escopo, mas nunca aprova o vinculo;
- primeiro administrador, comprador ou outro membro somente recebe dados depois de aprovacao humana com Comercial.Aprovacoes.aprovar;
- repeticao da solicitacao para o mesmo Site user e Cliente reutiliza a pendencia;
- erpCustomerId e sempre revalidado contra Grupo, Empresa e vinculo aprovado.

## Resposta permitida

A resposta aprovada contem apenas erpCustomerId, codigo, CNPJ mascarado, nomes empresariais, situacao, tipo, conta verificada, usuario externo atual, vendedor validado, enderecos ativos, flags comerciais minimas, Grupo, Empresa, origem ERP e data de atualizacao.

Nao sao retornados custo, margem, dados bancarios, observacoes internas, tags de CRM, score de risco ou limite de credito detalhado.

O endereco principal existente e o unico que nasce como padrao. Locais de entrega/obra preservam seu proprio campo de padrao; a primeira posicao da lista nao concede essa condicao. Enderecos inativos nao sao selecionaveis.

O vendedor somente fica ASSIGNED quando o Colaborador indicado pelo Cliente esta ativo no mesmo Grupo/Empresa. Caso contrario, a resposta usa UNASSIGNED, sem inventar redistribuicao.

## Estados e erros

- 400 site_cpa_customer_invalid_document: CNPJ invalido;
- 400 site_cpa_customer_identifier_required: falta CNPJ/ERP Customer ID;
- 400 site_cpa_external_user_required: usuario externo ausente ou invalido;
- 400 site_cpa_business_role_invalid: papel externo fora da allowlist;
- 403 site_cpa_customer_forbidden: ID fora do ownership;
- 403 site_cpa_business_link_rejected: vinculo recusado;
- 404 site_cpa_customer_not_found: BLOCKED_PENDING_CUSTOMER_CREATION_POLICY;
- 409 site_cpa_customer_ambiguous: mais de um Cliente ativo no escopo;
- 409 site_cpa_address_policy_pending: BLOCKED_PENDING_ADDRESS_CREATE_POLICY;
- 423 site_cpa_customer_inactive ou site_cpa_customer_blocked;
- 503: leitura, gravacao, contato ou auditoria indisponivel.

siteHealth publica somente CUSTOMER_RESOLVE: ready. As capabilities futuras de usuarios, obras, condicao comercial e criacao de endereco permanecem inativas.

## Pendencias deliberadas

- criacao automatica de Cliente permanece bloqueada;
- criacao/alteracao automatica de endereco permanece bloqueada;
- listagem completa de membros, obras e condicao comercial fica para contratos futuros;
- integracao do Site CPA continua proibida ate homologacao da camada ERP.

Como cada request usa nonce e idempotencia do ERP-SITE-01, uma nova consulta posterior a decisao humana deve usar novo nonce e nova chave de idempotencia.

Proximo lote autorizado somente por solicitacao expressa: ERP-SITE-03 - Catalogo.

---

# 22. EXECUCAO ERP-SITE-03 - CATALOGO OFICIAL

A operacao siteCatalogoList foi integrada ao gateway S2S v1. Produto permanece a fonte mestre; CatalogoWeb controla publicacao, GrupoProduto fornece categorias, UnidadeMedida complementa a unidade oficial e TabelaPreco/TabelaPrecoItem fornecem preco contextual.

## Requisicao e filtros

A requisicao usa o envelope, assinatura, escopo, nonce, correlacao e idempotencia do ERP-SITE-01. O objeto data aceita somente:

- page, a partir de 1;
- pageSize entre 1 e 100;
- active como true, false ou all;
- updatedSince em data ISO valida;
- categoryId;
- sku oficial exato;
- productIds, com no maximo 100 IDs;
- erpCustomerId e externalUserId juntos, somente para preco empresarial aprovado.

Filtros desconhecidos nao viram consulta arbitraria. O Site nao escolhe Grupo/Empresa nem envia regras de preco/estoque.

## Resposta

Cada produto retorna somente:

- erpProductId, SKU/codigo, nome e descricao;
- categoria oficial e marca;
- status, active e unidade comercial;
- especificacoes estruturadas permitidas, spec code e relacao de variante quando existentes;
- preco, origem do preco, tabela segura, stale e data de atualizacao;
- disponibilidade por estado, sellable, quoteRequired, minimo e multiplo;
- peso/conversao apenas quando oficiais;
- imagem HTTP(S) oficial, origem ERP, updatedAt e TTL.

A resposta inclui categorias usadas na pagina, paginacao e metadados de sincronizacao: catalogVersion, snapshotAt, updatedSince, lastUpdatedAt, source, stale, TTL e sinal de scan truncado.

## Preco

- sem contexto de Cliente: usa somente preco_venda/preco padrao oficial positivo;
- Cliente aprovado sem tabela especifica: usa o mesmo preco padrao oficial;
- Cliente aprovado com tabela: exige TabelaPreco ativa no mesmo escopo e TabelaPrecoItem valido;
- tabela cruzada e bloqueada;
- tabela/item indisponivel nao usa fallback: price fica null, priceSource UNAVAILABLE, priceStale true, sellable false e quoteRequired true;
- custo, margem, markup, preco minimo e limite de desconto nunca sao retornados.

## Estoque e venda

Disponibilidade usa estoque_disponivel quando oficial; na ausencia, calcula estoque_atual menos estoque_reservado/quantidade_reservada. A quantidade exata nao sai do ERP.

Estados: IN_STOCK, LOW_STOCK, OUT_OF_STOCK, AVAILABLE_TO_ORDER e UNKNOWN. Dependencia desconhecida, produto/categoria/catalogo inativo, preco ausente ou unidade ausente impedem sellable e exigem orcamento.

## Publicacao, delta e multiempresa

- somente Produto explicitamente publicado ou associado ao CatalogoWeb entra no contrato;
- por padrao sao listados apenas itens ativos;
- active=false permite consultar desativados;
- updatedSince inclui alteracoes de Produto, CatalogoWeb e GrupoProduto, permitindo propagar inativacoes;
- Produto, categoria, catalogo, tabela e item de preco sao validados contra o Grupo/Empresa definidos pelo servidor;
- produtos compartilhados seguem a allowlist existente; registros de outra Empresa/Grupo sao descartados.

## Erros e observabilidade

- site_cpa_catalog_page_invalid;
- site_cpa_catalog_updated_since_invalid;
- site_cpa_catalog_filter_invalid;
- site_cpa_customer_context_invalid;
- site_cpa_catalog_scope_forbidden;
- site_cpa_catalog_unavailable;
- site_cpa_audit_unavailable.

A auditoria registra operacao, correlacao, Grupo, Empresa, pagina, tamanho, quantidade, uso de preco empresarial, duracao e resultado, nunca o catalogo inteiro.

siteHealth informa CUSTOMER_RESOLVE: ready e CATALOG_READ: ready. Pedido, pagamento, frete final e credito final permanecem fora deste lote.

Proximo lote somente com autorizacao expressa: ERP-SITE-04 - Pedido e Checkout.

---

# 23. EXECUCAO ERP-SITE-04 - PEDIDO E CHECKOUT

A operacao `sitePedidoCreate` foi integrada ao gateway S2S `v1`. O contrato cria um `Pedido` real com `itens_revenda` incorporados, reutilizando Cliente, Produto, CatalogoWeb, GrupoProduto, UnidadeMedida, TabelaPreco, TabelaPrecoItem, FormaPagamento, Colaborador, enderecos e referencias existentes.

## Requisicao

O objeto `data` aceita somente os dados necessarios ao checkout:

- `externalOrderId`, `externalUserId` e `erpCustomerId`;
- `items`, com 1 a 50 itens contendo `erpProductId`, quantidade e, quando aplicavel, spec, unidade e preco exibido;
- `deliveryMode` como DELIVERY/ENTREGA ou PICKUP/RETIRADA;
- `addressId` para entrega;
- data de entrega solicitada, referencia de ordem de compra, obra, projeto, centro de custo e observacoes sanitizadas.

Total, subtotal, desconto, frete, vendedor, preco, estoque, `sellable`, `quoteRequired`, condicao e credito enviados pelo Site nao sao autoridade.

## Revalidacao no ERP

- Cliente e usuario externo exigem vinculo aprovado no ERP-SITE-02 e papel `ADMIN_EMPRESA` ou `COMPRADOR`;
- Grupo e Empresa vem da credencial S2S e todos os registros sao revalidados no mesmo escopo;
- cada Produto precisa estar ativo, publicado, vendavel, com unidade/spec corretas, quantidade minima e multiplo validos;
- o preco e recalculado pelo ERP-SITE-03; divergencia retorna `PRICE_CHANGED` com snapshot atual permitido e nao cria Pedido;
- estoque fisico menos reservado e revalidado; indisponibilidade ou mudanca falha fechada, sem parcial silencioso;
- produto oficialmente sob encomenda preserva esse fluxo;
- endereco precisa pertencer ao Cliente; retirada nao exige endereco de entrega;
- obra precisa ser um endereco ativo do tipo OBRA; Projeto exige ownership do Cliente e Centro de Custo exige o mesmo escopo;
- FormaPagamento e condicao do Cliente sao oficiais; condicao a prazo valida o credito existente sem expor limites na resposta.

## Criacao e estado

O Pedido nasce com origem `SITE_CPA`, canal `Site B2B`, numero ERP estavel, referencia externa, contrato `v1`, Grupo, Empresa, Cliente e vendedor oficial. O estado inicial e `Aguardando Aprovacao`, com `status_aprovacao = pendente` e pagamento pendente.

Nenhum pagamento e confirmado. Entrega nasce com frete pendente e proxima acao de confirmacao; retirada usa o fluxo `Retirada`, sem frete. O pedido S2S pendente nao reserva estoque antes da aprovacao. A reserva existente continua disponivel no fluxo oficial posterior.

Pedido e itens sao uma unica gravacao. Auditoria obrigatoria ocorre antes e depois da criacao. Se a confirmacao posterior falhar, `externalOrderId` e hash canonico permitem recuperar o Pedido no retry sem duplica-lo.

## Idempotencia e resposta

O ledger do ERP-SITE-01 continua protegendo a chave de idempotencia. Alem disso, `externalOrderId` e persistido por Empresa/origem:

- mesmo pedido e mesmo payload retornam o Pedido existente;
- mesmo identificador com payload ou ownership diferente retorna conflito `409`;
- duplo clique/retry nao cria outro Pedido.

A resposta minimizada contem `erpOrderId`, numero, identificador externo, estado, data, vendedor, totais oficiais, itens confirmados, modalidade, data solicitada, pagamento pendente, proxima acao e origem ERP. Custo, margem, markup, credito detalhado, banco, fornecedor, notas internas e segredos nao sao retornados.

## Erros principais

- `site_cpa_order_customer_invalid` e `site_cpa_order_scope_forbidden`;
- `site_cpa_order_item_invalid` e `site_cpa_order_quote_required`;
- `site_cpa_order_price_changed` e `site_cpa_order_stock_changed`;
- `site_cpa_order_stock_unavailable`;
- `site_cpa_order_address_invalid` e `site_cpa_order_work_invalid`;
- `site_cpa_order_payment_condition_invalid` e `site_cpa_order_credit_blocked`;
- `site_cpa_order_idempotency_conflict` e `site_cpa_order_unavailable`.

`siteHealth` informa `CUSTOMER_RESOLVE: ready`, `CATALOG_READ: ready` e `ORDER_CREATE: ready`.

## Pendencias deliberadas

- pagamento real, provider e webhook;
- frete final integrado;
- credito avancado e negociacao;
- cancelamento e edicao pos-pedido;
- consulta/status como operacoes independentes.

Proximo lote somente com autorizacao expressa: ERP-SITE-05 - Orcamento e Negociacao.

---

# 24. EXECUCAO ERP-SITE-05 - ORCAMENTO E NEGOCIACAO

As operacoes `siteOrcamentoCreate`, `siteOrcamentoGet`, `siteNegociacaoGet` e `siteNegociacaoResponder` foram integradas ao gateway S2S `v1`. O contrato reutiliza `Pedido` com `tipo = Orçamento`, itens incorporados, Cliente, catalogo/preco, vendedor, enderecos, `SolicitacaoAprovacao`, `Oportunidade`, referencias de obra/projeto/centro de custo, ledger e auditoria existentes.

## Criacao e proposta

- origens aceitas: `MATERIAL_LIST`, `CART`, `MANUAL_QUOTE`, `ARMACAO`, `REPURCHASE` e `AI_QUOTE_AGENT`;
- `externalQuoteId`, usuario externo e Cliente aprovado sao obrigatorios e idempotentes por Empresa;
- itens de catalogo sao revalidados por ID, escopo, atividade, especificacao, unidade, minimo, multiplo e preco oficial;
- itens customizados nao recebem Produto ficticio nem preco inventado e seguem como `SELLER_REVIEW_REQUIRED`;
- total, desconto, frete, vendedor e condicao enviados pelo Site nao sao autoridade;
- a proposta nasce na versao 1 com snapshot em `proposta_historico`; eventos do cliente nao sobrescrevem a versao comercial;
- a validade padrao de sete dias reutiliza o comportamento atual de orcamento do ERP;
- nenhum estoque e reservado, nenhum pagamento e confirmado e nenhuma Ordem de Producao e criada.
- cada Orçamento garante uma unica `Oportunidade` CRM no mesmo escopo; retry reusa o vinculo e conflito de Cliente falha fechado.

Propostas completas para retirada, com preco e vendedor oficiais, ficam em `CUSTOMER_REVIEW`. Item customizado, preco ausente, vendedor nao atribuido ou entrega com frete ainda nao calculado mantem o orcamento em `UNDER_REVIEW`, sem aceite direto.

## Consulta e ownership

`siteOrcamentoGet` retorna a proposta minimizada. `siteNegociacaoGet` acrescenta somente a timeline publica. Ambas exigem `erpCustomerId`, `externalUserId`, vinculo empresarial aprovado e o mesmo Grupo/Empresa do contrato. Custo, margem, fornecedor, credito detalhado, notas internas e segredos nao saem do ERP.

## Resposta e concorrencia

`siteNegociacaoResponder` aceita `REQUEST_BETTER_PRICE`, `REQUEST_CHANGE`, `COUNTER_PROPOSAL`, `ACCEPT` e `REJECT`. Toda resposta exige `externalResponseId` e `expectedProposalVersion`.

- pedidos de alteracao criam `SolicitacaoAprovacao` pendente e evento de timeline, sem aplicar preco, desconto ou condicao pedidos pelo cliente;
- repeticao do mesmo `externalResponseId` e idempotente;
- versao divergente retorna conflito com a versao atual;
- proposta expirada, encerrada, customizada ou com frete pendente nao pode ser aceita;
- o aceite chama `sitePedidoCreate`, que revalida catalogo, preco, estoque, Cliente, referencias e condicao antes de criar um unico Pedido;
- preco/estoque alterado bloqueia a conversao; o Pedido aceito continua aguardando aprovacao e pagamento real.

## Resposta, erros e capabilities

A resposta inclui IDs ERP/externo, numero, estado, versao, validade, Cliente, vendedor, itens, totais permitidos, frete, condicao, entrega, vinculo do Pedido e datas. A timeline informa apenas evento, ator, versao, mensagem publica e data.

Erros estaveis cobrem entrada, origem, Cliente, item, endereco, escopo, condicao, idempotencia, expiracao, versao concorrente, proposta nao aceitavel, conversao bloqueada, dependencia e auditoria indisponiveis.

`siteHealth` informa `CUSTOMER_RESOLVE`, `CATALOG_READ`, `ORDER_CREATE`, `QUOTE_CREATE` e `NEGOTIATION` como `ready`.

## Pendencias deliberadas

- provider, pagamento real e webhook permanecem no ERP-SITE-06;
- frete final exige o fluxo logistico oficial antes do aceite;
- item customizado exige revisao e precificacao humana no ERP;
- a referencia de armacao e preservada, mas producao somente sera liberada no ERP-SITE-10;
- Site CPA permanece sem alteracoes.

Proximo lote somente com autorizacao expressa: ERP-SITE-06 - Pagamento.

---

# 25. EXECUCAO ERP-SITE-06 - PAGAMENTO

As operacoes `sitePagamentoCreate`, `sitePagamentoStatus` e `sitePagamentoCancel` foram integradas ao gateway S2S `v1`. O webhook assinado usa o mesmo `legacyIntegrationsMirror`, identificado pelo header `x-site-cpa-payment-webhook: v1`; nenhum endpoint ou modulo financeiro paralelo foi criado.

## Origem, valor e ownership

A cobranca exige `erpOrderId`, `erpCustomerId`, `externalUserId`, `externalPaymentId` e metodo. O ERP revalida vinculo empresarial aprovado, papel externo permitido, Pedido `SITE_CPA`, Grupo, Empresa e `ContaReceber` oficial vinculada.

- o valor nasce exclusivamente do saldo aberto do titulo;
- `amount`, `paid`, `approved`, `settled`, status e identificadores enviados como autoridade pelo Site sao rejeitados;
- titulo ausente nao gera cobranca avulsa e retorna `BLOCKED_PENDING_RECEIVABLE`;
- titulo liquidado, Pedido cancelado, ownership cruzado e parcela ambigua falham fechados;
- `returnUrl` aceita somente rota interna e nunca confirma pagamento.

## Tentativa e idempotencia

`IntegracaoEvento` registra a tentativa com `paymentAttemptId`, Pedido, Cliente, titulo, provedor, metodo, valor, status, identificador externo e datas. `externalPaymentId`, hash canonico, ledger S2S e evento do provider protegem duplo clique, retry e payload conflitante.

A mesma tentativa preserva historico. Falha ou expiracao exige novo `externalPaymentId`; timeout permanece `PROCESSING` e nunca e transformado automaticamente em sucesso ou falha.

## Provedores e segredos

O adaptador pequeno reutiliza `ConfiguracaoGatewayPagamento`/`GatewayPagamento` e os provedores ja existentes:

- Asaas: criacao e consulta de PIX/Boleto e cancelamento de cobranca cancelavel;
- Juno: criacao e consulta de Boleto; cancelamento permanece bloqueado enquanto nao houver contrato oficial seguro;
- CARD e PAYMENT_LINK ficam inativos ate existir checkout hospedado/tokenizado real.

Chave de API e segredo de webhook nao sao lidos dos registros. Eles devem existir no secret manager/ambiente, preferencialmente por Empresa:

- `SITE_CPA_PAYMENT_API_KEY_<EMPRESA>`;
- `SITE_CPA_PAYMENT_WEBHOOK_SECRET_<EMPRESA>`;
- `SITE_CPA_PAYMENT_CUSTOMER_ID_<EMPRESA>`.

O fluxo antigo de `emitirBoleto`, que pode gerar documento simulado, nao e chamado pelo contrato S2S. Provider ausente retorna `site_cpa_payment_provider_unavailable`, sem cobranca falsa.

## Status, webhook e conciliacao

Estados canonicos: `PENDING`, `PROCESSING`, `APPROVED`, `PARTIALLY_PAID`, `PAID`, `FAILED`, `CANCELLED`, `EXPIRED`, `REFUNDED`, `CHARGEBACK` e `UNDER_REVIEW`. Status desconhecido nunca vira aprovado.

O webhook valida Empresa, provedor, raw body, HMAC-SHA256, timestamp, event ID, replay, rate limit por Empresa, tentativa, transacao, tenant e valor. Evento repetido ja concluido responde idempotente antes do rate limit e sem nova baixa.

Pagamento confirmado atualiza o `ContaReceber` existente e somente os campos financeiros do Pedido. Parcial aplica apenas o incremento confirmado e preserva saldo. Excesso, valor ausente ou divergencia seguem para `MANUAL_REVIEW`; nenhuma producao, entrega ou faturamento e liberado automaticamente.

## Resposta e privacidade

As respostas retornam apenas tentativa, Pedido, metodo, valor oficial, status, valor pago, vencimento/expiracao, conciliacao, proxima acao e dados publicos de PIX/Boleto. Segredos, tokens, credenciais bancarias, PAN, CVV, headers internos, custo, margem e notas internas nao sao expostos.

## Capability e pendencias

`siteHealth` preserva as capabilities anteriores e calcula `PAYMENT` como `ready`, `blocked` ou `degraded`. `ready` exige cadastro ativo, provedor suportado, metodo real, segredos no ambiente e resolucao de cliente no provedor. Na instalacao sem credenciais provisionadas, o estado correto e `blocked`.

PRONTO: contrato create/status/cancel, saldo oficial, tentativa persistente, idempotencia, adapter Asaas/Juno, webhook HMAC, replay protection, conciliacao, parcial e baixa oficial no titulo existente.

BLOCKED: metodos sem provider real, CARD/PAYMENT_LINK sem hosted checkout, cancelamento Juno, refund operacional e automacao avancada de chargeback. O Site CPA permanece sem alteracoes.

Proximo lote somente com autorizacao expressa: ERP-SITE-07 - Portal Financeiro e Fiscal.

---

# 26. EXECUCAO ERP-SITE-07 - PORTAL FINANCEIRO E FISCAL

O Portal existente passou a ter contratos oficiais de leitura no gateway S2S `v1`. Nenhum portal, endpoint, entidade financeira ou repositorio de documentos paralelo foi criado.

## Operacoes

- `sitePortalPedidos`: lista paginada de Pedidos visiveis no portal;
- `sitePortalPedidoGet`: detalhe seguro do Pedido e itens oficiais;
- `sitePortalNfe`: resumo paginado de NF-e, inclusive cancelada;
- `sitePortalBoletos`: cobrancas reais ja existentes, sem geracao simulada;
- `sitePortalDuplicatas`: titulos oficiais abertos, parciais, pagos, vencidos ou cancelados conforme visibilidade existente;
- `sitePortalPagamentos`: tentativas oficiais do ERP-SITE-06;
- `sitePortalDocumento`: DANFE, XML ou boleto por URL assinada curta.

Todas as respostas usam `source = ERP`, snapshot temporal, paginacao maxima de 100 registros e `Cache-Control: no-store` no gateway.

## RBAC, ownership e multiempresa

`ADMIN_EMPRESA` acessa pedidos, fiscal e financeiro. `FINANCEIRO` acessa os mesmos contratos de leitura. `COMPRADOR` e `CONSULTA` acessam pedidos e fiscal, mas nao titulos, boletos, linha digitavel ou pagamentos.

O papel e lido exclusivamente do vinculo empresarial aprovado do ERP-SITE-02. Cliente, usuario externo, Grupo, Empresa, Pedido, NF-e, titulo, pagamento, documento e obra autorizada sao revalidados no backend. IDs adulterados, usuario pendente/revogado e leitura cruzada falham fechados.

## Pedidos, fiscal e financeiro

Pedidos retornam status externo estavel, itens e totais oficiais sem custo, margem, comissao, credito ou anotacoes internas. NF-e retorna status externo, chave mascarada e apenas a disponibilidade de DANFE/XML, nunca caminho interno ou URL permanente.

Titulos reutilizam `ContaReceber`; os estados externos sao `OPEN`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `CANCELLED` e `UNDER_REVIEW`. Pagamentos reutilizam a tentativa persistida pelo ERP-SITE-06 e omitem payload, token, transacao interna e segredo do provider.

`sitePortalBoletos` nunca chama o fallback simulado de `emitirBoleto`. Segunda via permanece bloqueada quando nao existir cobranca real consultavel no ERP/provedor.

## Documentos

`sitePortalDocumento` nao aceita URL, path ou `fileUri` enviados pelo Site. O ERP localiza o recurso pelo ID, confirma ownership e obra, aceita somente URI privada sem traversal e arquivos PDF/XML oficiais, e usa `CreateFileSignedUrl` com TTL de 300 segundos.

URL permanente, URL publica gravada no registro, HTML arbitrario, path traversal, storage ausente e assinatura indisponivel retornam `site_cpa_portal_document_unavailable`. A auditoria registra o recurso e o usuario sem guardar URI privada, URL assinada ou conteudo.

## Capabilities e pendencias

`siteHealth` agora informa `PORTAL`, `PORTAL_FINANCIAL`, `PORTAL_FISCAL` e `PORTAL_DOCUMENT`. O estado geral e `ready` somente quando Pedido, Fiscal, Financeiro, ledger de pagamentos e assinatura de documentos estao disponiveis; disponibilidade parcial resulta em `degraded` e ausencia total em `blocked`.

PRONTO: pedidos, detalhe, NF-e resumida, boletos existentes, duplicatas, pagamentos, filtros de obra, RBAC, ownership, paginacao e download assinado quando o storage real estiver disponivel.

BLOCKED: segunda via que dependa de provider nao integrado, documento sem URI privada/storage assinado, devolucao, envio automatico por e-mail e recursos fiscais inexistentes no ERP atual. O Site CPA permanece sem alteracoes.

Proximo lote somente com autorizacao expressa: ERP-SITE-08 - Entrega e Logistica.

---

# 27. EXECUCAO ERP-SITE-08 - ENTREGA E LOGISTICA

A logistica existente passou a ter contratos oficiais de leitura no gateway S2S `v1`. Foram reutilizados `Entrega`, `Pedido`, historico de status, ocorrencias, entrega parcial, rota, romaneio e comprovante; nenhuma entidade, tela ou rota HTTP paralela foi criada.

## Operacoes

- `siteEntregaList`: lista paginada de entregas oficiais do Cliente;
- `siteEntregaGet`: detalhe seguro, itens e quantidades oficiais;
- `siteEntregaTimeline`: eventos persistidos em ordem cronologica;
- `siteEntregaComprovantes`: provas privadas por URL assinada curta.

Filtros aceitos: status externo, periodo maximo de 366 dias quando informado, obra autorizada, numero do Pedido, `deliveryId`, `erpOrderId`, pagina e `pageSize` de no maximo 100. O gateway permanece `no-store`, autenticado, assinado, limitado e protegido contra replay pelo ERP-SITE-01.

## Ownership, RBAC e multiempresa

Toda Entrega precisa pertencer ao Grupo/Empresa do contrato e apontar para um Pedido real, visivel no portal e pertencente ao mesmo Cliente. O `deliveryId`, `erpOrderId`, Cliente, usuario externo e obra sao revalidados no backend; vinculo ausente ou leitura cruzada falham fechados.

`ADMIN_EMPRESA`, `COMPRADOR` e `CONSULTA` podem acompanhar logistica. `FINANCEIRO` nao recebe acesso logístico automaticamente. O papel vem somente do vinculo empresarial aprovado do ERP-SITE-02; usuario revogado, pendente ou Cliente inativo perde acesso.

## Status, itens e timeline

Os estados externos sao `PENDING`, `SEPARATING`, `READY`, `SCHEDULED`, `ROUTED`, `OUT_FOR_DELIVERY`, `PARTIAL`, `DELIVERED`, `PICKUP_READY`, `PICKED_UP`, `RESCHEDULED`, `OCCURRENCE` e `CANCELLED`.

Um Pedido pode ter varias Entregas. Quantidades pedida, planejada, entregue e restante sao publicadas somente quando os campos oficiais permitem o calculo; entrega parcial nunca e promovida a entregue. Retirada nao publica endereco, rota, motorista ou veiculo.

A timeline usa apenas `historico_status`, ocorrencias persistidas e reagendamento real. Observacao interna, usuario interno, geolocalizacao e evento sintetico nao sao retornados. Ocorrencias sao reduzidas a categorias externas estaveis e somente campos explicitamente publicos podem aparecer como mensagem.

## Privacidade e comprovantes

Endereco e minimizado para logradouro parcial, bairro, cidade e UF. Rota retorna apenas atribuicao/estado, nunca identificador, sequencia de outros clientes ou coordenadas. Nome do motorista e abreviado; telefone pessoal e omitido.

Comprovantes aceitos: assinatura, foto de entrega, foto oficial de ocorrencia e romaneio assinado quando houver URI privada valida. URL publica, base64, path enviado pelo Site, traversal e arquivo solto nao sao aceitos. O download usa `CreateFileSignedUrl` com TTL de 300 segundos; documento do recebedor e mascarado e URI/storage path nunca sai na resposta.

## Capability e pendencias

`siteHealth` informa `DELIVERY`: `ready` quando Pedido, Entrega e assinador privado estao consultaveis; `degraded` quando a leitura logistica funciona sem assinatura de comprovantes; `blocked` quando Pedido ou Entrega nao pode ser consultado.

PRONTO: lista, detalhe, multiplas entregas, status, itens, parcial, retirada, timeline, ocorrencias publicas, filtro por obra, RBAC, ownership e comprovante assinado quando houver storage privado.

BLOCKED: GPS ao vivo, alteracao de endereco, reagendamento por mutation, comprovante sem URI privada, tracking ficticio e roteirizador externo indisponivel. O Site CPA permanece sem alteracoes.

Proximo lote somente com autorizacao expressa: ERP-SITE-09 - Chat e CRM.

---

# 28. EXECUCAO ERP-SITE-09 - CHAT E CRM

O Atendimento omnicanal existente passou a receber o canal `SITE_CPA` pelo gateway S2S `v1`. Nenhuma inbox, entidade de conversa, CRM ou endpoint paralelo foi criado.

## Operacoes e lifecycle

- `siteChatStart`: cria ou reutiliza conversa aberta compativel;
- `siteChatMessage`: envia mensagem do Cliente com idempotencia por `externalMessageId`;
- `siteChatPoll`: retorna somente mensagens posteriores ao cursor;
- `siteChatHistory`: retorna historico publico paginado;
- `siteChatClose`: encerra sem excluir o historico;
- `siteChatReopen`: reabre conforme o estado existente do Atendimento.

Os estados internos sao projetados como `OPEN`, `WAITING_AGENT`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `TRANSFERRED` ou `CLOSED`. Polling seguro foi mantido; websocket/realtime nao foi simulado.

## Contexto, assignment e CRM

Toda operacao revalida o vinculo empresarial aprovado do ERP-SITE-02, o papel, Cliente, usuario externo, Grupo e Empresa. `conversationId` e IDs enviados pelo Site nunca bastam para conceder acesso.

`siteChatStart` pode vincular Pedido, Orcamento, obra e Projeto somente apos ownership no mesmo escopo. A obra precisa existir entre os enderecos oficiais do Cliente e, quando houver allowlist no vinculo, tambem estar autorizada. O contexto fica na `ConversaOmnicanal` para uso do Hub/CRM, sem criar Oportunidade a cada mensagem.

O vendedor oficial ativo do Cliente e usado como atendente inicial. Sem vendedor valido, a conversa permanece na fila existente com `WAITING_QUEUE`; nenhum responsavel e inventado. Transferencia continua sendo operacao interna do ERP e o Site ve apenas o estado publico.

## Mensagens, privacidade e limites

O autor das mensagens recebidas e definido no servidor como Cliente. HTML executavel, `javascript:`, campos de autor/status/escopo e mensagens vazias ou acima de 4.000 caracteres sao recusados. O gateway e o ledger preservam replay/rate limit, e `externalMessageId` impede duplo envio com conflito para conteudo divergente.

Historico e polling omitem `interno`, notas privadas, e-mail/telefone interno, IDs desnecessarios, score CRM, comissao, fila interna e payload de IA. Nome publico do atendente e limitado a display name. Nenhum conteudo integral de mensagem entra na auditoria.

Paginacao do historico aceita ate 100 mensagens; polling retorna ate 50 por chamada. O gateway continua com `Cache-Control: no-store` e limite/rate limit persistentes do ERP-SITE-01.

## Anexos, capability e erros

O recebimento de anexos permanece fail-closed. Embora o ERP possua upload no Hub, o fluxo atual nao comprova URI privada e scanner de malware no contrato S2S. PDF/JPG/PNG passam por validacao preliminar de tipo, quantidade e tamanho, mas retornam `site_cpa_chat_attachment_unavailable` sem gravacao. URL publica, executavel, HTML, SVG inseguro e arquivo excessivo sao recusados.

`siteHealth` informa `CHAT: degraded` quando conversa e mensagem estao operacionais, pois anexos seguros e realtime nao estao disponiveis; informa `blocked` se qualquer entidade principal nao puder ser consultada. Capabilities anteriores permanecem inalteradas.

Erros estaveis cobrem Cliente/papel, ownership, contexto, conversa inexistente/fechada, mensagem, cursor, anexo, idempotencia, dependencia e auditoria. Status HTTP distinguem validacao, proibicao, inexistencia, conflito e indisponibilidade.

PRONTO: start/reuso, message, poll, history, close/reopen, assignment, fila/CRM, ownership, RBAC dos quatro papeis empresariais, sanitizacao, idempotencia, privacidade e auditoria.

BLOCKED: anexos ate existir storage privado com scanner, realtime inexistente, WhatsApp, chat anonimo/Lead e recursos internos nao comprovados pelo CRM atual. O Site CPA permanece sem alteracoes.

Proximo lote somente com autorizacao expressa: ERP-SITE-10 - Armacao e Producao.
---

# 29. EXECUCAO ERP-SITE-10 - ARMACAO E PRODUCAO

O gateway S2S `v1` passou a receber pacotes tecnicos de armacao no `Projeto` existente. O Site nao cria Produto, Pedido, Ordem de Producao nem aprovacao tecnica paralelos. O pacote confirmado pode ser encaminhado ao Comercial pelo `siteOrcamentoCreate` existente, sempre como item customizado sujeito a revisao humana.

## Operacoes e contrato

- `siteArmacaoCreate`: cria pacote tecnico idempotente por `externalArmacaoId`, Cliente, usuario e hash canonico;
- `siteArmacaoGet`: consulta o pacote do proprio Cliente;
- `siteArmacaoUpdate`: cria nova revisao mediante `expectedVersion`, sem sobrescrever o historico;
- `siteArmacaoConfirm`: registra apenas a confirmacao do Cliente;
- `siteArmacaoEnviarParaComercial`: cria ou reutiliza Orcamento `ARMACAO`, referenciando pacote e revisao.

A entrada aceita fontes `MANUAL`, `PROJECT_READER`, `SELLER_ASSISTED` e `QUOTE_CONVERSION`; IDs oficiais de Cliente, usuario, obra, Projeto pai, Pedido, Orcamento e Centro de Custo; pecas estruturadas; variaveis resolvidas; conflitos; evidencias; e metadados seguros do arquivo. URL, path, base64, conteudo bruto, script e formula executavel sao recusados.

Tipos de peca: `VIGA`, `COLUNA`, `ESTACA`, `BLOCO` e `SAPATA`. Dimensoes em mm, cm ou m sao normalizadas para milimetros. Dobras usam `NONE`, `START`, `END` ou `BOTH`. Armaduras preservam diametro, quantidade, comprimento, posicao e Produto oficial opcional. O ERP recalcula estribos por `floor(comprimento / espacamento) + 1` e rejeita contagem divergente.

## Revisao, ownership e seguranca

O `Projeto` guarda snapshot atual e historico imutavel de ate 50 revisoes, com limite de 100 pecas. `expectedVersion` impede sobrescrita concorrente. Pacotes com variaveis nao resolvidas, conflitos, evidencia ausente ou confianca abaixo de 0,8 permanecem `NEEDS_REVIEW`.

`ADMIN_EMPRESA` e `COMPRADOR` podem criar, alterar, confirmar e enviar ao Comercial. `CONSULTA` pode apenas ler. `FINANCEIRO` nao recebe acesso tecnico. Cliente, usuario, Grupo, Empresa, obra, Produto de armadura e todas as referencias sao revalidados no backend; a credencial `SITE_CPA` nao concede acesso irrestrito.

Campos de aprovacao tecnica, liberacao de producao, OP e aprovacao do vendedor recebidos do Site sao bloqueados por mass assignment. A resposta sempre declara `technicalApproval = PENDING_INTERNAL_REVIEW`, `productionReleased = false` e `productionOrderId = null`.

## Comercial, documentos e capabilities

O envio comercial exige confirmacao do Cliente, mas nao exige nem concede aprovacao tecnica. Um unico item comercial referencia o pacote/revisao completos no `Projeto`, permitindo ate 100 pecas sem exceder o limite do Orcamento. Preco, desconto, prazo e decisao comercial continuam sob o ERP-SITE-05 e o vendedor.

Metadados de documento exigem `sourceFileId`, SHA-256, tamanho limitado e ficam `PENDING_SECURE_STORAGE_REVIEW`. Como storage privado e scanner S2S ainda nao estao comprovados, `WORK` e `PRODUCTION_INTAKE` ficam `degraded`; indisponibilidade de `Projeto` ou `Pedido` os torna `blocked`. `PRODUCTION_RELEASE` permanece sempre `blocked`.

Erros estaveis cobrem payload, unidade, peca, estribo, variavel, documento, Cliente, papel, ownership, versao, idempotencia, confirmacao, Produto, Comercial, dependencia e auditoria. Auditoria registra operacao, correlacao, Cliente, Grupo, Empresa, versao, quantidade de pecas e duracao sem guardar pacote tecnico integral.

PRONTO: create/get/update/confirm/send-to-commercial, pacote tecnico estruturado, conversao de unidades, estribos server-side, revisoes imutaveis, idempotencia, RBAC, ownership, multiempresa, auditoria e Orcamento real sem OP.

BLOCKED: aprovacao tecnica pelo Site, liberacao de producao, criacao automatica de OP, corte/dobra/armado automaticos, arquivo sem storage privado e scanner, Produto inexistente, formula executavel e decisao autonoma de IA.

Proximo lote somente com autorizacao expressa: ERP-SITE-11 - Obras e Centros de Custo.

---

# 30. EXECUCAO ERP-SITE-11 - OBRAS, PROJETOS E CENTROS DE CUSTO

O gateway S2S `v1` passou a expor a estrutura organizacional oficial do Cliente sem criar entidade de Obra paralela. Obra continua representada pelos enderecos ativos do tipo `OBRA` em `Cliente`; Projeto e Centro de Custo reutilizam as entidades `Projeto` e `CentroCusto` existentes.

## Operacoes e contrato

- `siteObraList` e `siteObraGet`: lista e detalhe das obras autorizadas;
- `siteProjetoList` e `siteProjetoGet`: projetos, subprojetos, etapa, pavimento e area;
- `siteCentroCustoList` e `siteCentroCustoGet`: referencias gerenciais permitidas, sem valores financeiros internos.

Listas aceitam busca segura por nome/codigo, status, ativo, obra, Projeto, pai, pagina de ate 100 itens e ordenacao allowlisted. Respostas retornam somente IDs/codigos oficiais, labels, status, hierarquia, seletividade, contagens e endereco resumido. Custos, orcamentos internos, margem, responsavel privado, notas e metadados de aprovacao nao sao publicados.

## Work Context, ownership e RBAC

O helper central `resolveWorkContext` resolve Cliente -> Obra -> Projeto -> Centro de Custo e bloqueia combinacoes incompatíveis. Projeto precisa pertencer explicitamente ao Cliente; Centro de Custo precisa possuir Cliente ou vinculo verificavel com Obra/Projeto. Centro generico sem ownership nao e exposto ao Site.

`ADMIN_EMPRESA`, `COMPRADOR`, `FINANCEIRO` e `CONSULTA` possuem somente leitura. ADMIN sem politica explicita segue a regra administrativa existente; allowlist explicita sempre o restringe. Os demais papeis exigem `allWorks: true` ou `allowedWorkIds`; ausencia de politica falha fechada. O Site nao pode enviar nem alterar a allowlist.

Obra/projeto ativo e selecionavel. Inativo, concluido ou cancelado permanece consultavel quando autorizado, mas retorna `selectable: false` e motivo publico. Projeto independente e aceito somente para vinculo com todas as obras. Parent project precisa pertencer ao mesmo Cliente e, quando informado, a mesma Obra.

## Integracao, capabilities e pendencias

Pedido, Orcamento e Armacao passaram a usar o helper central para validar `obraId`, `projectId` e `costCenterId`, preservando seus codigos de erro publicos. Portal, Entrega e Chat continuam usando os IDs/allowlists oficiais e agora recebem referencias resolvidas pelas seis operacoes. `siteClienteResolve` informa `customerWorks: true`.

`siteHealth` informa `WORK`, `WORK_PROJECTS` e `WORK_COST_CENTER` conforme a disponibilidade real de Projeto e CentroCusto. Auditoria registra operacao, correlacao, Cliente, IDs solicitados, contagem, duracao e resultado sem entidades completas.

PRONTO: list/get de Obra, Projeto e Centro de Custo; paginacao; busca; hierarquia; selectable; ownership; IDOR; RBAC; allowlist; auditoria e integracao com Pedido, Orcamento e Armacao.

BLOCKED: criacao/edicao de mestre pelo Site, alteracao de `allowedWorkIds`, centro sem ownership, orcamento financeiro da obra, analytics avancado, storage e alteracao de geometria.

Proximo lote somente com autorizacao expressa: ERP-SITE-12 - Copiloto e Oportunidades.


---

# 31. EXECUCAO ERP-SITE-12 - COPILOTO COMERCIAL E OPORTUNIDADES

O CRM existente passou a expor leitura segura de Oportunidades e contexto comercial pelo gateway S2S v1. Nao foi criado CRM, banco 360 ou modelo paralelo.

## Operacoes

- `siteOportunidadeList`: lista paginada das Oportunidades do Cliente no escopo;
- `siteOportunidadeGet`: detalhe publico e minimizado;
- `siteOportunidadeContext`: agrega em tempo de leitura Cliente, vendedor, obras, Orcamentos, Pedidos, Armacao, Chat, Entregas e Financeiro resumido permitido;
- `siteOportunidadeSignal`: registra intencoes explicitas allowlisted e idempotentes.

Os sinais aceitos sao `CLIENT_REQUESTED_CONTACT`, `BETTER_PRICE_REQUESTED` e `TALK_TO_SELLER`. IDs de Orcamento, Pedido, Conversa e Projeto sao revalidados por Cliente, Grupo e Empresa. O Site nao envia status, score, prioridade, vendedor, preco, desconto, credito ou acao executada.

## Copiloto governado

O contexto gera apenas sinais determinísticos baseados em registros reais e recomendacoes com `SUGGESTION_ONLY`, justificativa, confianca e confirmacao humana obrigatoria. Nenhuma sugestao altera preco, desconto, condicao, credito, pagamento, entrega, producao, pedido, mensagem, cadastro ou Oportunidade. Conteudo do Cliente e tratado como dado, sem eval, SQL ou execucao de comandos.

`OPPORTUNITY_READ` e `OPPORTUNITY_SIGNAL` ficam `ready` quando suas dependencias reais respondem. `COMMERCIAL_COPILOT` fica `degraded`: o motor estruturado e operacional, mas IA generativa segura e validada nao e anunciada como disponivel.

PRONTO: list/get, ownership, RBAC, paginacao, contexto 360 composto, sinais comerciais reais, deduplicacao, recomendacoes explicaveis, privacidade, auditoria e capabilities honestas.

BLOCKED: decisao autonoma, envio automatico de mensagem, alteracao comercial/financeira/fiscal, fechamento de Oportunidade e IA generativa sem provider e schema governados. O Site CPA permanece sem alteracoes.

ERP-SITE-01 a ERP-SITE-12 concluidos no ERP. Proxima etapa: homologacao integrada e, somente mediante autorizacao, adaptacao incremental do Site CPA.


---

# 32. ERP-SITE-HML-01 - HOMOLOGACAO CONSOLIDADA

ERP-SITE-01 a ERP-SITE-12 foram homologados em conjunto. A matriz completa, inventario das 43 operations, capabilities, evidencias, blockers externos e dataset estao em `docs/ERP_SITE_HML_01.md`.

Decisao: `ERP_READY_FOR_SITE_E2E`. Isso nao equivale a go-live. Providers ausentes continuam `blocked` ou `degraded` e nenhum segredo/dado real foi utilizado.

Um P1 foi corrigido: capabilities centrais deixaram de ser constantes e agora dependem de sondagem real. O health passa a informar estado geral, timestamp e dependencias minimizadas. Nao ha P0 ou P1 de codigo aberto.

Proximo passo somente com autorizacao expressa: preparar ambiente/dataset de homologacao e integrar o Site CPA contrato por contrato. Nao existe ERP-SITE-13.

---

# 33. GO-LIVE-HML-01 (Opcao A) - PREPARACAO ERP PARA E2E EXTERNO

Lote exclusivo de preparacao no ERP (sem Site CPA, sem segredos, sem URL inventada). Artefatos: `.env.site-cpa.hml.example`, `tests/helpers/siteCpaHmlDataset.js`, `tests/helpers/siteCpaHmlHarness.js`, `tests/site-cpa-go-live-hml-01.test.js`, `docs/GO_LIVE_HML_01_ERP.md`.

Decisao: `ERP_HML_PREPARED_FOR_EXTERNAL_E2E` com `EXTERNAL_E2E_STATUS=BLOCKED_CONFIGURATION`. Nao declara `ERP_E2E_READY` nem `GO_LIVE_READY`. Reutiliza contratos ERP-SITE-01..12 e health fail-closed; payment/storage/AI permanecem blocked/degraded honestos.

Opcao B (conexao real Site CPA + credenciais HML) somente com autorizacao expressa. Nao existe ERP-SITE-13.

---

# 34. PROVISIONAMENTO-HML-01 - FASE 1 (DESCOBERTA + NUCLEO)

Descoberta do runtime Base44/`legacyIntegrationsMirror`, matriz canônica `SITE_CPA_*`, endpoint formato SDK e checklist humano em `docs/PROVISIONAMENTO_HML_01.md`.

Decisao Fase 1: `HML_CORE_BLOCKED_CONFIGURATION`. Fases 2–7 documentadas e nao executadas. Site CPA nao alterado.
