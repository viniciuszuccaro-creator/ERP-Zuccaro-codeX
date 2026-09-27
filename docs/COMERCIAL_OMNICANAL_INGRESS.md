# Comercial 360 — entrada de vendas assinadas

## Lote 1 — receptor e recibo atômico

Base: main `f37b8a650e4362b12b972af704063eac35c01350`.
Branch: `codex/comercial-omnicanal-ingress`.
Programa: Ondas 15–19, contratos independentes de entrada de site, app, chatbot e marketplace.
Estado: implementado e testado no backend; CI aguardando publicação. Merge e implantação não realizados.

Inventário GitHub #45–#60: Cursor ocupa `app.ts`, `router.ts`, serviços/repositories/types
de Pedido/Orçamento, migrations 025–031 e STATUS_DO_PROJETO.md. Codex não altera esses
arquivos. Coordenação publicada na #50. Este documento registra o status deste lote
em lugar do STATUS compartilhado, conforme a restrição explícita do proprietário.

Não havia receptor HTTP de vendas assinadas no backend. Os auxiliares em
`server/src/integrations` implementam exclusivamente o transporte: delegam aos
serviços e repositórios canônicos, à autorização existente e à tabela
`integration_events` das migrations 001/018. Não criam tabela de pedido/carrinho,
cliente, preço, estoque, canal ou hub paralelo. O bootstrap `index.ts` monta o
receptor antes da API existente, cuja interface permanece intacta.

## Contrato

POST `/api/v1/integracoes/vendas`, application/json, no máximo 128 KiB e 100 itens.
Envelope estrito: `version:1`, `tipo:Pedido|Orcamento`, `idempotencyKey`, `documento`.
O documento segue o create canônico, mas seus itens não aceitam preço ou desconto.
Quantidade deve ser positiva. Não aceita tenant/ator, totais, estado, aprovação,
origem, anexos, campanha, produção ou conversão arbitrária. Preços/totais são
resolvidos pelo serviço comercial do servidor. Referências passam por suas
validações de cliente, condição, produto, unidade e empresa.

Cabeçalhos: `x-channel-id`, `x-channel-timestamp` (segundos Unix),
`x-channel-nonce` (16–128 caracteres ASCII), `x-channel-signature` (hex SHA256).
Assinar os bytes JSON exatos com HMAC-SHA256:
`clientId + '.' + timestamp + '.' + nonce + '.' + bodyBytes`.
Client ID e metadados de assinatura também estão assinados. Janela máxima ±5 minutos.
TLS e sincronização dos relógios são requisitos da ativação futura.

Configuração somente no servidor: `ERP_OMNICHANNEL_ENABLED=true` e
`ERP_OMNICHANNEL_IDENTITIES` como array JSON de identidades com `id`, `channel`
(SITE/APP/CHATBOT/MARKETPLACE), `groupId`, `empresaId`, `actorId`, `secret`.
Secret com ao menos 32 caracteres, gerado/armazenado no gestor de segredos.
Sem essa configuração, rota não montada. Ativação exige PostgreSQL; não usa memória.
Nenhum segredo ou dado real é incluído neste documento.

Identidade do registro vem da configuração assinante do servidor. Headers de
tenant/actor e campos do corpo não substituem essa identidade. Ator ativo deve
possuir `Integracoes.vendas.importar` e `Comercial.pedido.criar` ou
`Comercial.orcamento.criar`, sem wildcard global, inclusive nos retries.

201 devolve `{data:{id,tipo},replayed:false}`. Retry equivalente retorna 200 e
o mesmo recibo. Chave é particionada por Grupo/Empresa/identidade/canal/tipo.
Payload divergente: 409 CHANNEL_IDEMPOTENCY_CONFLICT. Nonce reutilizado em outra
venda: 409 CHANNEL_NONCE_REUSED. Guardar apenas hash e referência canônica nos
eventos; nenhuma cópia da venda, segredo ou PII externa no recibo/auditoria.
O canal deve manter a chave ao tentar novamente e usar nonce novo por transporte.

AsyncLocalStorage compartilha a transação de recibo com os repositories já
existentes. Locks PostgreSQL por nonce/chave serializam a deduplicação. Documento,
histórico, auditoria comercial, recibo e auditoria da integração confirmam juntos.
Qualquer falha desfaz tudo. Não confirmar venda por timeout ou falha de auditoria.
Não há envio de rede, pagamento, NF, estoque ou produção neste adaptador.

## Segurança do banco e gates

O contrato SQL `server/src/integrations/ingressRls.sql` prepara RLS + FORCE RLS à tabela existente, com `erp.group_id` e
`erp.empresa_id` locais à transação. Privilégios não são concedidos a PUBLIC.
Policies SQL não substituem RBAC. Papéis superuser/BYPASSRLS seguem sendo um risco
operacional: o precheck futuro deve comprovar least privilege e grants explícitos.
Não é migration automática: a futura migration canônica depende da atualização coordenada do teste runtime01 (ocupado pelo Cursor), que fixa 024 como último arquivo. Startup recusa ativação sem RLS/FORCE e política comprovados. Rever produtores/consumidores existentes antes de aplicar o hardening; eles precisarão
de contexto explícito quando não usarem papel privilegiado. Não aplicar na VPS
nem afirmar compatibilidade operacional sem esse gate. Rollback do app: desativar
ingress/voltar imagem anterior, preservando eventos e documentos; schema tem gate próprio.

Origem é comprovada no evento de integração. A main atual ainda não possui as
extensões das PRs #50/#53 nos documentos; não foram recriadas aqui. Após integrações
dessas bases, ligar metadados documentais por mudança coordenada e revalidar o fluxo.
Esta entrega não fecha as Ondas 15–19, não habilita canais reais e não constitui go-live.

## Validação e sequência

Testes `omnichannel-ingress.test.ts`: HTTP dos quatro canais e Orçamento com services
e repositories reais em PostgreSQL PGlite, preço sintético; retry, divergência,
nonce, timestamp, assinatura, mass assignment, RBAC/ator revogado, referência
cross-group, rollback na falha de auditoria e RLS por papel não privilegiado.
PGlite não comprova concorrência multiconexão de PostgreSQL; esse é o próximo lote.
Nenhum teste acessa HD, banco DEV, rede de canal ou VPS.

Próximo lote na mesma frente: recibos consultáveis e concorrência real em PostgreSQL
efêmero, preservando os arquivos do Cursor. SHA/PR/CI final serão registrados na PR.


Validação local do lote: backend completo 234 PASS / 0 FAIL / 15 SKIP (249 testes); focados 5/5 PASS; runtime01 + ingresso 17 PASS / 2 SKIP. Auditoria baseline, lint, typecheck/build do backend e build frontend passaram. Suite raiz: 681 PASS / 5 FAIL por limitações locais de esbuild no sandbox, python3 ausente no Git Bash e caminhos Windows em fixtures Bash; nenhum desses arquivos foi alterado. Typecheck global tem erros existentes de frontend/Base44 fora deste lote. CI Linux ainda pendente; não declarar aprovação até o HEAD passar.

## Lote 2 — consulta de recibo e concorrência

Branch: codex/comercial-omnicanal-recibos, base PR #68 (beff57136fe09a71cba1fecdea086b28650b5a9b), cuja CI #975 passou. Não depende de arquivos em revisão pelo Cursor.

POST /api/v1/integracoes/vendas/recibos exige a mesma assinatura sobre bytes e metadados. Corpo estrito: version:1, operation:receipt, tipo:Pedido|Orcamento, idempotencyKey. O discriminador operation impede reaproveitar a assinatura de criação como consulta e vice-versa. A chave original é resolvida na mesma partição de identidade/canal/Grupo/Empresa/tipo; não aceita IDs arbitrários de documento ou tenant externo. Exige Integracoes.vendas.visualizar e Comercial.pedido.visualizar ou Comercial.orcamento.visualizar, sem wildcard global, e ator ativo. Consulta bem-sucedida gera audit read na mesma transação. Falha na auditoria não devolve referência.

Resposta 200 contém apenas data:{id,tipo}; comprova recebimento anterior, não estado atual de pagamento/estoque/entrega. Sem recibo próprio retorna 404 CHANNEL_RECEIPT_NOT_FOUND, inclusive em outra identidade do mesmo canal, empresa ou Grupo. A consulta é uma leitura e não consome nonce de criação; replay de leitura permanece sujeito a assinatura vigente e autorização atual. O canal não precisa reenviar a venda para recuperar o recibo após um timeout.

Fixture reutilizada entre suites PGlite e PostgreSQL com serviços comerciais reais e preço sintético. CI omnicanal-postgres usa banco exclusivo erp_omnichannel_test com schemas aleatórios privados, nenhum DROP/alteração de schema public, sem DATABASE_URL como fallback. Guard valida localhost, usuário/database exclusivos e rejeita query/hash antes de conectar. Testes multiconexão provam oito entregas equivalentes, oito conflitantes, nonce simultâneo e rollback concorrente de auditoria, com contagem final de documento/itens/histórico/evento/audit.

Validação local: focados 10 PASS / 0 FAIL / 2 SKIP (PostgreSQL efêmero ausente); backend completo 239 PASS / 0 FAIL / 17 SKIP; typecheck/build backend, lint e diff --check passaram. Frontend não alterado; limitações globais Windows/typecheck registradas no Lote 1 permanecem. CI deste HEAD e prova multiconexão ainda pendentes. Não mesclado/implantado. Gates de ativação e dependências #50/#53 descritos acima permanecem.
## Lote 3 — cliente de transporte dos servidores de canais

Branch codex/comercial-omnicanal-client, base PR #69 (7f5615b118a8f4a30fcbcd821cc5914183eef77f). #68 CI #975 SUCCESS; #69 CI #977 e omnicanal-postgres #2 SUCCESS. Logs PG comprovam 3 PASS / 0 FAIL / 0 SKIP. Todos continuam não mesclados/implantados.

ChannelSalesClient reutiliza os schemas e HMAC do receptor para create e receipt. Exclusivo para servidores/BFFs de site, app, chatbot e marketplace: não importar no navegador/app público nem entregar secret ao usuário final. Endpoint e identidade são configuração confiável de servidor, nunca input de cliente; HTTPS obrigatório, sem credenciais/query/hash na URL ou redirects. HTTP só permitido explicitamente em localhost para testes isolados.

O canal deve persistir sua idempotencyKey antes do envio e reaproveitá-la no mesmo pedido após falha. Cliente serializa uma vez e mantém payload/chave em até 3 tentativas, com nonce/assinatura novos, timeout por tentativa (10 s padrão, máximo 30 s) e backoff limitado. Falha de rede/5xx é entrega ambígua, não prova de não gravação; retries preservam a deduplicação no servidor. 4xx, inclusive conflito e 429, não têm retry automático. Nunca gerar nova chave para contornar rejeição ou timeout. Endpoint de recibo continua exigindo permissões de leitura.

Respostas validadas estritamente (UUID, tipo e formato); resposta 2xx inválida não gera retry automático. Não loga bodies, segredos ou mensagens arbitrárias do provider. Erros são ChannelTransportError com código local/status, sem payload externo. Consumidor distingue rejeição HTTP de indisponibilidade, preserva a chave e consulta recibo quando permitido. Não implementa pagamento, frete, preço, decisão comercial, agendamento ou credenciais reais de provider.

Testes usam receptor/services/repos PostgreSQL PGlite reais: quatro canais com criação e consulta; resposta perdida após commit, seguido de retry que retorna um único documento/evento; configuração insegura, teto de tentativas, rejeições definitivas e respostas inválidas. Nenhuma chamada externa. CI do novo HEAD pendente; sem merge/deploy. Próxima integração operacional depende dos gates RLS/produtores/least privilege e das bases documentais #50/#53; estas permanecem em branches do Cursor e não serão recriadas nesta frente.
Validação local Lote 3: backend completo 242 PASS / 0 FAIL / 17 SKIP (259 testes); cliente focado 3/3 PASS; typecheck/build backend, lint e diff --check PASS. Frontend não alterado; CI Linux pendente.

## Lote 4 — consumidor controlado do outbox Produto (Onda 15)

Branch codex/comercial-catalogo-outbox, base #70. Inventário atualizado GitHub #45–#67, main ainda f37b8a650e4362b12b972af704063eac35c01350; arquivos Cursor preservados. Reutiliza produtor PostgresProdutoRepository.appendPublicationEvent e integration_events 001/018. Não há migration ou fila paralela. A 002 já habilita RLS/FORCE sem policies permissivas; falta policy company-scoped coordenada do contrato ingressRls.sql. Gate exige essa policy também no consumidor; não afirma ausência das flags RLS existentes.

CatalogOutbox opera apenas source ERP/event_type produto.publicado/aggregate Produto em Grupo/Empresa explícitos, com ator ativo e Integracoes.catalogo.publicar, sem wildcard global. Claim limitado (1–100) usa FOR UPDATE SKIP LOCKED, ordem estável, prazo de 5–300 s e incrementa attempts. Lease é versão attempts + locked_until; confirmação exige ambos e prazo vigente. Falha de auditoria desfaz claim/resultado. Claim esgotado ou chave ausente vira dead-letter auditado, sem envenenar a fila. Retry possui backoff exponencial limitado a 300 s, max_attempts existente; estados não são inferidos por timeout.

Reprocessamento exige Integracoes.catalogo-reprocessamento.editar e orçamento explícito de 1–10 tentativas adicionais a partir de attempts atual; não zera geração nem troca chave/eventId. Auditoria preserva antes/depois de estado, tentativas, orçamento e código sanitizado. Summary usa Integracoes.catalogo.visualizar, conta estados permitidos e audita leitura, sem payload. Campos de erro só aceitam código allowlisted, nunca erro/body/segredo do provider.

CatalogOutboxWorker roda somente runOnce com publisher injetado. Não monta timer/worker no bootstrap, não possui credenciais ou provider padrão. Claim unitário evita expirar leases à espera de outros itens. Envia só sinal Produto allowlisted, não ficha/preço/estoque/DAM; valida referência do agregado e produto ainda ativo/PUBLICADO com código vigente pelo repository existente antes do envio. Contrato do publisher exige ACK com eventId e key, idempotência externa pelo mesmo eventId/key, respeito ao AbortSignal e reconciliação própria; timeout 10 s é resultado ambíguo e resposta atrasada não muda lease vencido. A aprovação pode mudar depois da consulta; adapter real ainda deve revalidar projeção/versão do mestre ao aplicar sinal. published significa ACK do sinal de integração, não homologação de catálogo/canal/mídia.

Testes sintéticos: filtragem tenant/evento, allowlist, ACK, retry/dead-letter/reprocessamento, revogação, fonte inativa, lease expirado/atrasado e rollback de auditoria. PostgreSQL real dedicado prova produtor original idempotente e 4 consumidores concorrentes reivindicando 8 eventos sem sobreposição. Workflow PG existente ampliado, nenhum schema public é apagado; pgcrypto necessário ao produtor original no banco CI efêmero. CI deste HEAD pendente, não mesclado/implantado. Próximo checkpoint: reconciliação de sinais/projeções por canal, mantendo bloqueadas credenciais/publicação reais e migration policy até coordenação/gate.

Validação local Lote 4: backend completo 247 PASS / 0 FAIL / 18 SKIP (265 testes); outbox focado 5/5 PASS; lint, typecheck/build backend e diff --check PASS. Prova PostgreSQL outbox e CI Linux aguardam publicação. Jitter de retry é infraestrutura, limitado e sem alterar regras comerciais.

## Lote 5 — reconciliação auditável dos sinais de catálogo

Branch codex/comercial-catalogo-reconciliacao, base PR #71 (8fae1bb329b973b7722b62b14ee3eadae6122098), CI runtime #984 e PostgreSQL #7 SUCCESS; PG 4 PASS / 0 FAIL / 0 SKIP. Cadeia anterior permanece aberta, não mesclada/implantada.

CatalogReconciliation compara somente ACKs dos sinais publicados por eventId/key, por observer configurado no servidor. Não reconcilia a projeção completa de produto, mídia, preço ou estoque, não instala timer/provider e não aplica correção externa. Cada página exige Grupo/Empresa explícitos, ator ativo e Integracoes.catalogo-reconciliacao.editar sem wildcard; retorna counts com scope PAGE, nunca KPI global. Cursor ordenado por created_at/id preserva microssegundos do PostgreSQL. Limite máximo 100; timeout de probe 5 s com AbortSignal.

Observações CONSISTENT/MISSING/CONFLICT/UNAVAILABLE são persistidas no integration_events existente como catalogo.reconciliado. Só metadados e hash do recibo estrito são armazenados; nenhum erro/body privado do provider. Chave inclui tenant/observer/scan/source/attempt. Mesmo scan e resultado converge; resultado divergente exige scan novo e retorna conflito. Fonte deve continuar published, com mesma chave/attempt, sob lock compartilhado. Auditoria create e observação são atômicas; falha DB/audit propaga, não é mascarada como indisponibilidade do canal. Não muda status do evento original ou cadastro Produto.

Validação local: focados 3 PASS / 0 FAIL; backend completo 250 PASS / 0 FAIL / 19 SKIP (269 testes); lint e typecheck/build backend PASS. Suite PostgreSQL real isolada adiciona paginação com microssegundos e oito gravações concorrentes do mesmo scan; CI deste novo HEAD ainda pendente. Não acessou VPS/HD nem alterou arquivos das PRs Cursor. Policy company-scoped, produtor least privilege, aprovação da projeção produto_canais (hoje RASCUNHO) e providers reais continuam gates próprios.
## Lote 6 — monitoramento operacional do outbox existente

Branch codex/comercial-catalogo-observabilidade, base #72 cf7859dcb1c42414eb47d808eb4a7722337264ca (runtime #986 e PostgreSQL #8 SUCCESS; PG 5 PASS/0 FAIL/0 SKIP). CatalogOutbox.health amplia o diagnóstico existente sem fila, dashboard ou entidade paralela. Exige Integracoes.catalogo.visualizar, ator ativo, Grupo/Empresa e policy RLS canônica. Limite de atraso é explícito e limitado a 1–604800 segundos; não define SLO comercial por conta própria.

Snapshot conta backlog, atraso, leases vencidos, dead-letter e status desconhecido, com idade da entrada mais antiga. Para cada sinal publicado, preserva última observação por observer e geração de attempts; sucesso de um canal não mascara divergência de outro. consistent/divergent/unavailable contam pares sinal/observer; unreconciled conta sinais sem observação da geração atual. scope COMPANY não equivale a Grupo inteiro. Não retorna payload/error/key/credencial, não aplica correção nem emite alerta externo automático. Leitura e audit read são transacionais; falha de auditoria bloqueia resposta.

Testes sintéticos 2/2 PASS em PGlite com isolamento entre empresas/eventos, duas observações de canais diferentes, versão antiga, threshold, RBAC e falha de audit. Typecheck/build backend PASS; regressão integral fica na CI Linux deste HEAD. Frontend permanece intacto. Publicação/homologação real e gates descritos nos lotes anteriores continuam pendentes.
## Lote 7 — prova FORCE RLS no PostgreSQL isolado

Branch codex/comercial-omnicanal-rls-postgres, base #73. Workflow PostgreSQL ampliado com papel aleatório NOLOGIN/NOSUPERUSER/NOBYPASSRLS, grants exclusivos ao schema de fixture e integration_events. Prova escopo ausente, outra Empresa, claim SKIP LOCKED, mudança de tenant em UPDATE, INSERT cross-group e ausência de vazamento do contexto entre transações. Usa somente erp_omnichannel_test local e schemas/roles aleatórios; cleanup revoga grants e remove exclusivamente o papel gerado. Sem migration, VPS, banco DEV, dados reais ou mudanças nas branches Cursor.

Typecheck backend PASS; execução local SKIP porque PostgreSQL efêmero não está disponível, portanto ainda não é evidência de aprovação. Gate de conclusão deste lote é CI PostgreSQL com zero skips e CI geral verde do mesmo HEAD. A policy continua sendo contrato aplicado somente à fixture, não uma migration DEV nem prova de role operacional da VPS. Configuração confiável do contexto é responsabilidade da API; GUC não autentica usuário por si só.
## Lote 8 — rotação das chaves de canal sem duplicar vendas

Branch codex/comercial-omnicanal-rotacao-chave, base #74 d17b331869f203b4481cf663f365b25cdf32e0fe (runtime #990 e PostgreSQL #11 SUCCESS, PG 6 PASS/0 FAIL/0 SKIP). Contrato existente de identidade ganha previousKey opcional com secret, validFrom e validUntil configurados somente no servidor. Janela deve ser positiva, explícita e no máximo 24 h; não existe período padrão ou renovação automática. O verificador aceita a chave anterior somente quando instante atual E timestamp assinado estão dentro dessa janela, com fim exclusivo. Chave principal continua sujeita ao timestamp de 5 min e assinatura exata de corpo/client/nonce.

Rotação não troca identidade/Grupo/Empresa/ator nem chave de idempotência do pedido; nonce e permissões atuais continuam obrigatórios. Cliente BFF continua assinando exclusivamente com secret principal e não recebe previousKey. Operador deve distribuir a chave principal por canal seguro, reservar uma janela definida, trocar configuração com procedimento controlado e remover previousKey após término; estas ações não foram executadas. Revogação urgente deve retirar a chave anterior, sem usar overlap. Nenhuma chave real no código, logs, docs ou GitHub.

Testes focados receptor/cliente/rotação 11 PASS/0 FAIL/0 SKIP; rotação 3/3 após reforço de revogação RBAC. Typecheck/build backend PASS. CI integral do novo HEAD pendente. Frontend, migrations, VPS, HD e branches Cursor preservados; sem merge/deploy.
## Lote 9 — triagem de falhas e leases vencidos

Branch codex/comercial-catalogo-triagem, base #75 56ef59351e6cec1e00ae54eb89a658c42176e0e5. Inventário GitHub de arquivos #45–#67 confirmou zero sobreposição nos três arquivos deste lote. Reutiliza CatalogOutbox, integration_events e permissão Integracoes.catalogo.visualizar; não cria fila, entidade, dashboard ou endpoint paralelo.

failures lista somente sinais ERP/produto.publicado/Produto no Grupo/Empresa explícitos, com status retry/dead_letter ou processing com lease ausente/vencido. Retorna id, status, tentativas/orçamento e datas técnicas, para preparar diagnóstico/reprocessamento pelo operador autorizado. Nunca retorna payload, chave idempotente, referência Produto ou mensagem livre de provider. Código de falha usa enum explícito dos produtores/worker existentes; código legado/desconhecido vira OUTBOX_ERROR_REDACTED mesmo se composto apenas de maiúsculas.

Paginação de 1–100 registros ordenada por created_at/id, preservando microssegundos; leitura auditada na mesma transação. Falha de audit bloqueia resposta; revogação atual bloqueia leitura. Consulta não reivindica lease, altera status nem executa retry. Fila é viva: estados podem mudar entre páginas, cursor não é snapshot de homologação. Reprocessamento continua exclusivo do método existente, só dead-letter e Integracoes.catalogo-reprocessamento.editar com orçamento explícito. Lease vencido não significa venda/publicação comprovadamente falhou.

Focados saúde/outbox/reconciliação 12 PASS/0 FAIL/0 SKIP; lint e typecheck/build backend PASS. Regressão backend completa: 257 PASS/0 FAIL/20 SKIP (277 testes; PostgreSQL efêmero não configurado localmente). Audit baseline PASS; CI Linux/PG deste HEAD pendente de publicação. Frontend não alterado; limitações Windows/typecheck global do Lote 1 permanecem, não foram mascaradas. Nenhuma migration, UI HTTP ou worker ativados; sem VPS/HD/merge/deploy e sem editar branches Cursor. Policy coordenada, projeção aprovada, providers e revisão independente permanecem gates próprios.
# Prova PostgreSQL da triagem

## Divergências atuais de ACK

`CatalogOutbox.divergences` reutiliza a fila e as observações existentes: lista somente MISSING/CONFLICT/UNAVAILABLE da última observação de cada observador na tentativa atual de um sinal publicado. Uma observação CONSISTENT posterior elimina a falha anterior desse observador da consulta, preservando o histórico e divergências de outros observadores. A tentativa nova invalida observações antigas. Leitura exige Grupo/Empresa e `Integracoes.catalogo.visualizar`, com audit read atômico; não retorna payload, chave, hash ou mensagem do provider. Identificador de observador legado fora do contrato é mascarado. Paginação usa microssegundos e UUID; a fila é viva, sem promessa de snapshot entre páginas. Nenhuma correção/publicação é aplicada, não há novo endpoint/UI/provider/migration. Base #77; revisão independente, ativação/RLS e homologação continuam pendentes. Testes sintéticos incluem prova PostgreSQL obrigatória na CI.

O lote `codex/comercial-omnicanal-triagem-postgres`, baseado na #76, amplia a suite efêmera existente: cursor com microssegundos e empate de timestamp, isolamento de Empresa e tipo de evento, exclusão de lease ainda vigente, erros livres mascarados, fila intacta, revogação de leitura e rollback do audit real após falha injetada. A iteração é limitada para falhar sem travar em regressão de cursor. Sem URL isolada, o teste local é marcado como skip; o workflow PostgreSQL fornece a URL obrigatória e deve comprovar zero skips. Nenhuma migration/ativação/provider/VPS é introduzida. Publicação e revisão independente continuam gates separados.
