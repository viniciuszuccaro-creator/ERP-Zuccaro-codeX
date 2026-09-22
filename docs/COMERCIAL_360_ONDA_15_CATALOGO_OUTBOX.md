# Comercial 360 - Contrato da Onda 15: Catalogo e Outbox

## Decisao

Produto permanece o mestre de catalogo e `integration_events` permanece a unica base de outbox. Site CPA, Portal, App, Chatbot e marketplaces sao canais consumidores; nenhum deles cria um segundo Produto, preco, saldo, Orcamento ou Pedido.

## Baseline reutilizado

- `produtos`, unidades, TabelaPreco, ClienteEmpresa, Orcamento e Pedido sao os donos canonicos dos dados comerciais.
- `integration_events`, criada nas migrations 001/002, ja possui Grupo, Empresa, origem, tipo, idempotencia, payload, estado, erro, timestamps e RLS + FORCE.
- Gateway Site CPA, contratos HML, policies de marketplace, `ValidarPedidosExternos` e operacao local continuam como adapters/fallbacks durante a transicao.
- A configuracao de integracao existente continua sendo a fonte de habilitacao por Empresa; credenciais nunca entram no payload, frontend, log ou Git.

## Projecao de catalogo

O catalogo publicado e uma projecao versionada e reconstruivel do Produto/PIM, DAM, TabelaPreco e disponibilidade autorizada. O canal recebe somente campos allowlisted:

- identificadores estaveis de Produto/variante/SKU e versao;
- nome e descricao aprovados para o canal;
- atributos tecnicos, unidade, embalagem, multiplos e politica de fracionamento;
- midias publicadas por referencia permanente, nunca URL assinada persistida;
- preco vigente e disponibilidade vindos das APIs proprietarias;
- estado `RASCUNHO`, `AGUARDANDO_APROVACAO`, `PUBLICADO`, `SUSPENSO` ou `ERRO` por canal.

Publicacao nao copia custo, margem, documento fiscal, observacao interna, segredo ou PII. Alteracao de preco/saldo nao muta Produto e possui evento/versionamento proprio.

## Outbox transacional

Toda mutacao que exige propagacao grava o evento na mesma transacao do agregado. Entrega externa acontece depois do commit.

Antes de ativar worker, `integration_events` deve receber migration aditiva, sem modificar 001/002, para representar no minimo: versao do schema, agregado/id, request/correlation ID, contador e limite de tentativas, proxima tentativa, lock/lease, publicado em, dead-letter em e checksum do payload. A unicidade deve incluir tenant + consumidor/operacao + chave idempotente, preservando compatibilidade com eventos existentes.

Estados previstos: `PENDING`, `PROCESSING`, `PUBLISHED`, `RETRY`, `DEAD_LETTER` e `CANCELLED`. Erro armazenado e sanitizado e limitado; payload e envelope nunca incluem credencial ou URL temporaria.

## Entrega, replay e reconciliacao

- Claim concorrente usa lock seguro e lease; dois workers nao publicam simultaneamente o mesmo evento.
- Retry usa backoff com jitter e limite. Falha permanente vai para dead-letter e exige permissao para reprocessar.
- Reprocessamento preserva `eventId`, idempotency key e versao; consumidor deve responder de forma convergente.
- Webhooks de entrada exigem assinatura/HMAC, timestamp, nonce, protecao contra replay, tamanho, rate limit, allowlist e resolucao server-side de Grupo/Empresa.
- Reconciliacao compara versao/hash e produz divergencias: ausente no canal, obsoleto, rejeitado, excedente ou consistente.
- Correcao automatica so republica projecao aprovada; conflito comercial, SKU desconhecido ou payload divergente vai para revisao humana.

## Ownership por canal

| Fluxo | Dono | Canal pode fazer | Canal nao pode fazer |
| --- | --- | --- | --- |
| Catalogo/midia | Produto/PIM/DAM | exibir projecao aprovada | editar mestre diretamente |
| Preco | TabelaPreco | consultar preco autorizado | definir custo/margem |
| Disponibilidade | Estoque | consultar promessa publicada | gravar saldo/reserva |
| Orcamento/Pedido | Comercial | criar via API idempotente | persistir agregado paralelo |
| Pagamento | Financeiro/provider aprovado | enviar referencia/status assinado | baixar titulo diretamente |
| Fiscal | Fiscal | consultar documento autorizado | emitir/cancelar NF |

## RBAC e auditoria

Permissoes distintas para visualizar configuracao, publicar, suspender, reconciliar, reprocessar, descartar dead-letter e administrar credenciais. Backend e fail-closed por Grupo/Empresa e canal habilitado.

Auditar configuracao sem segredo, solicitacao de publicacao, evento/outcome, tentativa, erro sanitizado, reconciliacao, divergencia, replay, dead-letter e acao humana. A auditoria usa IDs, hashes, contagens e antes/depois resumidos; nao replica payload integral.

## Compatibilidade e cutover

Policies/telas existentes continuam operando como fallback ate que adapter canonico, monitoramento, reconciliacao e E2E estejam aprovados. O cutover e por canal e Empresa, com feature flag e rollback para pausa de publicacao, nunca dual-write silencioso. Pedidos simulados continuam impedidos de entrar no agregado oficial.

## Primeiro checkpoint de implementacao

1. Implementar repository/service de outbox sobre `integration_events`, com tenant, executor compartilhado e payload allowlisted.
2. Criar migration aditiva somente apos reconferir `origin/main`; nao alterar migrations existentes.
3. Emitir inicialmente evento sintetico de Produto aprovado e testar rollback atomico sem chamar rede.
4. Adicionar worker controlado com publisher fake, retry/dead-letter e metricas; provider real permanece bloqueado.
5. Ligar um adapter de catalogo apenas depois da Onda 1 PIM/DAM e da reconciliacao estarem verdes.

## Aceite

Uma fonte de verdade; outbox atomica; nenhuma chamada externa dentro da transacao; replay idempotente; concorrencia segura; dead-letter/reconciliacao observaveis; RBAC/tenant/auditoria; nenhum segredo, PII ou dado real; providers e publicacao externa continuam bloqueados ate gate especifico.
