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
