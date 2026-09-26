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