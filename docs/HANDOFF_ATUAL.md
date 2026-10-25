## #344 — Grupo CPA: vínculos e permissões localizados; sessão ainda requerida (2026-10-25)

Retomada6400924274, basea31d83fd, mesmo Codespace/branch Codex, checkout
local=remoto e limpo, sem escritor concorrente; trava e checkpoint próprios.
O proprietário informou Grupo CPA e empresas CPA Ferro e Aço/3Z LTDA.
IDs atuais localizados e preservados SOMENTE nos artefatos privados.

Consulta de identidade limitada por referência existente do provisionador,
nome exato de Grupo e das duas empresas, em READ ONLY/REPEATABLE READ e
ROLLBACK. Encontrados Auth único confirmado, perfil ativo vinculado ao Auth
e ao Grupo com empresa_id nulo, Grupo único ativo e ambas empresas ativas.
TenantGuard implantado confirmou os vínculos; RbacGuard implantado confirmou
visualizar clientes e importar explicitamente, com wildcard global desabilitado.
A implementação implantada foi conferida: consulta perfil ativo/escopo e árvore
de permissões, sem autorização inferida de nome/admin/BYPASSRLS. Nenhum grant,
identidade ou vínculo foi criado/alterado; esses checks são diagnóstico de
metadados e NÃO uma identidade autenticada de requisição.

Na origem ERP existente do Chrome, o restore terminou em Entrar no ERP.
Falta sessão/principal de usuário reutilizável e revalidável pelo Supabase
e middleware canônico antes de qualquer consulta de clientes. O cadastro
Auth/perfil/permissões comprovado não substitui Bearer verificado. Solicitado
apenas login nessa aba com a conta existente, sem senha/token/UUID no chat.
Não executar POST de login/reset/bootstrap ou extrair refresh tokens como
atalho; nenhuma consulta ampla de clientes para depois filtrar.

Coorte segue retida:0clientes lidos,0novas linhas selecionadas,0escritas
operacionais/audit de negócio. Pronto para prosseguir, após sessão válida,
com guards atuais, Grupo compartilhado e consultas pontuais canônicas<=100/200.
sugerirVinculo permanece excluído por escrever audit no match. Recibo privado
de autorização SHA4d0a03ad163964352fcc5a36ba4d446b60aae9db550a794be32b22d89598b991.
Deltas independentes conferidos:3516d80c0ce/3528fd16622/353e20deaa9 sem
novo fix funcional/liberação na fila; não repetir contraprovas nem editar Cursor.
Gates de carga/schema/backup/restore/deploy permanecem íntegros.

## #344 — fila A/B/C: canal recuperado, gates reais e revisão cruzada (2026-10-25)

Base8e68484b; pacote funcional D publicado0c18d995 na342, checkout limpo.
Mesmo Codespace e uma trava própria; reserva344/6399054875. Sem repetir
CONT02/03/pilotos aprovados. Mesma automação nativa reativada somente após
provar executor disponível/exclusividade; checkpoint fora do checkout.

A: metadados SSH conferidos sem ler chaves ou repetir tentativas recusadas.
Web Console Hostinger já autenticada abriu o host esperado; pg Pool dentro
da API usou a conexão efetiva, READ ONLY/REPEATABLE READ, limites e ROLLBACK.
Alias/container de banco correspondem; versão, schema, role, imagem/pacote,
journals, volumes/capacidade e artefatos de migration capturados privados.
SQL canônico pinado SHA77665a45c6b9a91e3905870ddf825f5613646ed288522c459aceab0eb031ef3e
coincide com o checkout. Recibo de catálogos SHA0ab848008065a77744610ed7486d7ed57655ee736e6fdd8d9ab4e9be47c14395.
26 entradas no journal não comprovam compatibilidade da primeira carga.
Coleta repetida após erro local de serialização do recibo; ambas somente
leitura/rollback. Nenhum dado de cliente selecionado, grant/key/schema ou
configuração operacional alterados. SHA de origem da imagem não informado
pelo label; não atribuir o HEAD GitHub ao código implantado.

| Gate | Prova executada/preparada | Falta / ação concreta autorizável |
|---|---|---|
| Destino/schema | Conexão efetiva e catálogos privados executados | Reconciliar nomes/bytes/artefatos aplicados043–049; não inferir migrations ausentes como aplicadas |
| Escopo/duplicidade | Reutilizado plano<=100/200;0clientes lidos/selecionados | Referência privada de ator/perfil, principal existente e crosswalk Grupo/Empresa antes das consultas canônicas |
| Privilégio/atomicidade | Divergência real de privilégios/policies registrada privada; CONT02/03 preservados | Provar menor privilégio/RBAC e ensaio equivalente em cópia representativa explicitamente autorizada; sem mudar grants |
| Backup/restore/reversão | Comandos e pins anteriores preservados, guardas bloqueantes | Aprovar destino/role/janela/retenção/alvo isolado; depois produzir dump e restaurar ESSE artefato; nenhum executado agora |
| Liberação | Só leitura e preparo autorizados | Após gates, aprovação de destino/coorte/hash/campos/ator/janela; carga segue NÃO autorizada |

B: gates privados atualizados por evidência existente/faltante/ação/autorização,
sem sobrescrever pacote anterior. sugerirVinculo segue excluído pois escreve
audit no match. Decisão mínima de principal/ator/Grupo/Empresa solicitada
privadamente ao proprietário; sem pedir credenciais ou autorização genérica.

C: Cursor atualizou350706c9e5a/3512847be1f/352b5e5d995 para base8e68484b.
Candidata existente353987ba207 reconhecida, sem composição paralela:
32blobs não documentais idênticos; documentos da base sem exclusões.
350é ancestral; testes dos tips351/352 estão com blobs iguais, mas os tips
não são ancestrais da candidata (incorporação por outros commits); não
afirmar ancestralidade integral. CI4548/4549 SUCCESS desse SHA não é aprovação.

P1 da351 reproduzido no componente real/harness: mesmo ID, draft sujo e
updated_date novo sobrescrevem edição sem confirmação (1FAIL0SKIP).
Publicado351/6399259991 e353/6399260175; somente Cursor corrige sua branch.
350:2PASS focados;352:5PASS focados com limites apontados352/6399282846
(teste salvar/principal não salva e teste de mutationFn usa cópia; serviço
não é HTTP). Candidata retida para corrigir/revisar novo SHA. Recibos de
blobs/ancestralidade353/6399323997 e6399332328; novos gates não liberados.

Próximas ações concretas: tratar delta/achado por SHA; incorporar Pedido D
na candidata sob revisão; conferência privada somente com escopo provado.
UI/cadastros/proposta permanecem reservados Cursor; próximo checkpoint
Onda5 origem/canal/externalID depende da migration aditiva/gates/reserva
canônicos. Não inventar módulo ou liberar schema para manter recorrência.
Sem carga, backup/restore operacional, merge/deploy, flags/providers/canais.
Automação separada Legado permanece PAUSED; estado final da mesma fila
Codex será registrado no recibo de fechamento conforme houver item executável.

## #344 / Comercial360 — Pedido exige motivo de cancelamento (2026-10-25)

Pacote D autorizado pelo proprietário, reserva344/6399158275, base8e68484b.
Contrato Onda5 já exige motivo; UI canônica já o coleta, mas PedidoService.cancel
aceitava undefined. Contraprova no teste existente falhou no código anterior
(Missing expected rejection); correção remove apenas a exceção para ausência.
Mantidos o mesmo serviço/repositório/transação, estado, RBAC/tenant, auditoria
e histórico; nenhuma UI, migration, permissão ou branch Cursor alterada.

Negativos de motivo ausente/null/vazio/espaços/curto/tipo inválido/>500
preservam Pedido, histórico e audit; positivo preserva ID/número/itens;
HTTP cobre422,403,404, cancelamento válido e repetição409. Foco15PASS0FAIL.
Checks locais: audit:baseline, root2280PASS, lint, typecheck, build,
server535PASS0FAIL25SKIP, server:typecheck, server:build e diff-check exit0.
Os25SKIP são reportados pelo runner local (fixtures PostgreSQL/psql sem
configuração); não contar como prova PostgreSQL executada. CI por SHA será
registrada no recibo GitHub após push. Resultado atual de typecheck não
reescreve o baseline histórico nem é correção atribuída a este pacote.

Mesmo Codespace/branch Codex e trava exclusiva própria; sem dados reais,
carga, merge ou deploy. SHA final/testes/CI no recibo344/342; após publicar
seguir fila A/B/C, inclusive achado cruzado351/6399259991, sem encerrar só
porque este commit terminou.

## CURSOR — #351 merge consolidação `8e68484b` (2026-10-25)

| Item | Valor |
|---|---|
| base merge | `codex/consolidacao-infra-20261017` tip **`8e68484b`** |
| conflitos | STATUS/HANDOFF — Cursor+#344 preservados |
| fora | branch Codex intocada · sem force-push · sem merge/deploy |
| nota | descrições CLEAN anteriores ficaram desatualizadas após avanço da base |

## #344 — fila finita: gates preparados, acesso operacional bloqueado (2026-10-24)

Ordem do proprietário assumida em344/6390698000, base3eccd369, mesmo
Codespace retomado após inatividade; HEAD local=remoto, checkout limpo,
AGENTS inalterado por hash, sem escritor concorrente. Processos internos
VSCode classificados; app-server1093 fora checkout. Trava exclusiva própria
e checkpoint privado; nenhuma branch/reserva Cursor350/347 editada.
A MESMA automação ERP — fila Codex #344 foi reativada a cada15min com
F1–F5 finitos, checkpoint e recusa de sobreposição; não foi criada outra.

### Resultados executados e limites

F1: canal SSH existente da estação validou hostkey estrita, mas o servidor
recusou ambas identidades existentes (ED25519/RSA, exit255). Nenhuma chave
lida em saída/criada/copida, nenhuma permissão alterada. Codespace sem
config/agente/Runtime Secrets; sem canal autenticado provado. Host/API/DB
documentados são candidatos, não identidade efetiva atual comprovada.
Nenhuma query operacional executada; não inferir banco vazio/inexistente.

F2: metadados/permissões dos artefatos privados existentes conferidos e
agregados de planos preservados reutilizados. Sem nova seleção, leitura de
registros de destino ou repetição de piloto: acesso e escopo ainda faltam.
Plano limitado a100 clientes e200 consultas pontuais, com normalizador,
findByDocumento/findByLegacyIdentity e RBAC/tenant canônicos. Atenção concreta:
ClienteService.sugerirVinculo grava auditoria possible_duplicate no match,
então não é chamado na conferência estritamente READ ONLY. Repositório de
leitura não dispensa validação de ator/permissão/Grupo/Empresa nem RLS.

F3: pacote privado first-load-gates-20261024 fora checkout/Git/build/CI,
owner700/files600, manifesto de integridade e pins dos scripts existentes.
Artefatos: captura readonly limitada/sem overwrite, SQL canônico copiado sem
alteração, plano privado da coorte, comandos backup/restore e contrato de
reversão por snapshot/lote/serviço/auditoria. Backup/restore têm exit77
incondicional: preparados, NÃO executados/autorizados. Não executar CLI de
piloto para reverter operacional; ele também carrega dados/cria grants.
Guardas exigem identidade/dump/hash/bytes/role explícitos, sem defaults
históricos; restore isolado possui alterações internas de schema/permissão
e filtragem do stream, a revisar/autorização própria antes de qualquer uso.

| Gate | Prova disponível | Falta verificável / próxima ação | Autorização/capacidade |
|---|---|---|---|
| Destino/schema | SQL metadata/pins e tentativas de canal registradas | Captura da conexão efetiva da API, volume/versão/role/schema/journals; reconciliar nomes completos/bytes045–049 | Leitura já autorizada; falta executor/canal existente autenticado |
| Escopo/duplicidade | Planos privados preservados e consultas canônicas identificadas | Crosswalk exato + coorte<=100 vinculada ao destino + reconciliação privada da mesma coorte | Acesso e escopo de leitura comprovados antes de selecionar/consultar |
| Privilégio/atomicidade | CI isolada e parecer independente CONT02/03 | RBAC/policies reais e teste equivalente autorizado em cópia representativa | Leitura metadata atual; escrita/concorrência somente em alvo isolado autorizado |
| Backup/restore/reversão | Scripts existentes pinados e contrato de reversão preparado | Backup do destino exato, restore DESSE artefato e reversão protegida por lote | Janela/capacidade/retenção/role/alvo isolado e autorização específica ainda faltam |
| Liberação | Ordem atual autoriza leitura/preparação | Aprovação específica de identidade/coorte/hash/campos/ator/janela após quatro gates | Carga operacional continua NÃO autorizada |

Validação proporcional: bash-n3/3 e guards3/3 PASS (captura sem destino
exit64; backup/restore exit77), integridade/permissões/pins conferidos;
0 consultas operacionais,0 escritas operacionais,0 novas linhas selecionadas.
Nenhum ensaio aprovado ou suíte runtime inalterada repetido manualmente.
Mudança publicável somente nestes hunks HANDOFF/STATUS; CI do novo SHA
registrada no fechamento GitHub, sem presumir resultado antes da execução.

F4: parecer independente Cursor342/6390672952 recebido: CONT02 aprovado
com reprodução11PASS; CONT03 aprovado com ressalva de ambiente (PG apoiado
na CI, não reexecutado no Cloud VM). Nenhum achado reproduzível solicitado;
pacotes preservados. Pedido direto350/6390672003 e recibo342/6390698159,
sem proprietário retransmitir. Aprovação do código não libera carga/merge.

F5 — decisão mínima concreta: disponibilizar um executor/canal JÁ autorizado
que autentique no host documentado e capture a identidade efetiva da API
com principal de leitura existente; recibo detalhado permanece privado.
Nenhuma chave/senha no chat, novo grant/role/schema ou autorização de carga
necessária para decidir esse vínculo de leitura. Questão apresentada ao
proprietário após preparar os artefatos; F1 bloqueada por autenticação, F2
por essa dependência/escopo, F3/F4 concluídos no alcance autorizado. Após
publicação/CI/liberação, pausar mesma recorrência se a capacidade continuar
ausente, registrando o motivo, não por fila vazia nem aprovação visual.
Sem backup/restore/carga operacional, migration, merge, deploy, ativação de
flags/providers/canais. Automação separada Legado permanece PAUSED.

## CURSOR — #351 merge consolidação `3eccd369` (2026-10-24)

| Item | Valor |
|---|---|
| ambiente | Cursor Cloud `/workspace` |
| base merge | consolidação tip **`3eccd369`** |
| branch | `cursor/cadastros-reabrir-updated-392b` · PR #351 |
| tip anterior | `4c1d6ce6` · API CONFLICTING/DIRTY |
| conflitos | STATUS/HANDOFF — ambos lados preservados |
| fora | branch Codex intocada · sem force-push · sem merge/deploy |

## #344 CONT-03 — revisão sintética na suíte PostgreSQL real (2026-10-24)

Continuidade do heartbeat nativo 2026-10-24T18:57:07.971Z. CONT-02 concluída
em 4e02bc73715ca535762f6ceae258ec5b3ca32ab6, CI4522/4523 SUCCESS, checkout
limpo e reservas/trava liberadas: recibos344/6388410555 e342/6388418096.
O pacote manual bf1854fb não foi contado como prova automática. A mesma
automação foi habilitada a cada15min após essa prova, condicionada à
disponibilidade do desktop/navegador/Codespace, sem autonomia permanente.

CONT-03/tarefa6388273674, reserva6388452431, base local=remota4e02bc73.
Mesmo Codespace/branch Codex; origem sanitizada, status/processos conferidos,
app-server1601 fora do checkout, trava exclusiva própria. Nenhuma branch
ou reserva Cursor350/Comercial360347 editada.

A mesma suíte cliente-legacy-name agora executa PGlite e realCrmFixture,
com createPoolDbClient e contexto de tenant por transação. A adaptação
anterior baseada apenas em sessão falhou no PostgreSQL sob RLS
(snapshot nulo; PGlite11 PASS, PostgreSQL1 FAIL). O contexto canônico
resolve a fixture sem ampliar políticas da aplicação nem alterar serviço.
LOGIN efêmero restrito, NOSUPERUSER/NOBYPASSRLS; sem contexto enxerga0clientes.
A prova identifica UPDATE do cliente e INSERT de auditoria na mesma
conexão/transação; replay sem escrita, releitura, reversão e reviewProof
persistido. Os dez subtestes anteriores foram preservados. Negativos
adicionais exercitam REVOKE SELECT/UPDATE/INSERT e trigger SQL de auditoria,
com rollback integral. O runner PostgreSQL existente exige esta variante
com DATABASE_URL isolada e rejeita qualquer skip; fora dele a variante real
sem URL é explicitamente skip, nunca prova de persistência.

Fixture local: imagem postgres16 já presente, container efêmero próprio
com porta somente127.0.0.1, banco sintético e senha não publicada. Nenhum
VPS/destino operacional/dado real acessado; cinco gates de carga continuam.
Checks/SHA/CI e liberação final devem ser conferidos no recibo GitHub
por SHA; solicitação de revisão e CI não constituem aprovação ou merge.
Sem carga/piloto real/transferência/deploy/migration operacional/flags/canais.
A automação separada do Legado permanece PAUSED.

Validação local desta candidata: audit-baseline, raiz2280 PASS/0FAIL/0SKIP,
lint/typecheck/build e server:typecheck/build exit0. Foco23 PASS/0FAIL/0SKIP
(11PGlite+12PostgreSQL), inclusive ambas escritas observadas na mesma
transação. Runner existente:18suítes/108testes/0FAIL/0SKIP após o MESMO
bootstrap migrate+seed sintético da CI. Primeira tentativa sem esse preparo
falhou em R11 por audit_logs ausente; log preservado, não baseline relaxada.
Backend padrão completo não repetido localmente; CI da candidata pendente
no momento deste commit, sem alegar verde antes da confirmação por SHA.
Nenhum próximo item independente novo consta nos deltas344; após CI e
liberação, deixar revisão cruzada por SHA pronta e pausar recorrência se
a fila continuar sem item executável. Não fabricar pacote ou só monitorar.

## #344 CONT-02 - ensaio automatico executando tarefa real (2026-10-24)

Origem REAL: heartbeat nativo revis-o-e-acesso-erp-45-e-46 recebido em
2026-10-24T18:57:07.971Z, apos o turno manual ser liberado. Nao contar o pacote
manual bf1854fb como prova automatica. HANDOFF/deltas e tarefa6387973425 foram
lidos; aceite/reserva automatica6388240061. Mesmo Codespace/branch/checkout,
base local=remota bf1854fb, status inicialmente limpo, origin sanitizado e
AGENTS inalterado por hash. App-server1601 fora do checkout sem execWriter;
trava exclusiva /tmp/erp-codex-344-writer.lock criada com token proprio.

Defeito reproduzido por teste ANTES do fix: Missing expected exception para
entrada applied=true com commandHash recalculado e outra operacao valida.
collectAssistedReviewProposal agora exige applied=false,
operationalAuthorized=false e status PENDING_CANONICAL_REVALIDATION tambem
em CADA entrada anterior do journal. Todos hashes anteriores, duplicidade de
operationId e conflito de comando continuam verificados sem relaxamento.
Nenhuma escrita mestre, permissao, grant, rota, migration ou carga adicionada.

Foco journal11 PASS/0 FAIL/0 SKIP cobre estados adulterados/ausentes com hash
integro, hash quebrado, operacao duplicada/conflitante, replay identico e
clonagem sem mutar o journal do chamador. Geral raiz2280 PASS/0 FAIL/0 SKIP.
Backend focado canonico11 PASS/0 FAIL/0 SKIP; audit baseline/lint/typechecks/
builds raiz e server/diff-check exit0. Comandos de fechamento AGENTS executados;
backend completo inalterado nao repetido localmente: evidencia anterior533PASS/
24SKIP da base e distinta, nao foi declarada nova execucao. Nova CI executa a
composicao final e precisa ser conferida pelo SHA publicado. PGlite/local nao
substituem prova PostgreSQL especifica nem gates operacionais.

Publicacao/CI/liberacao final da trava propria e reservas serao registradas
na344/342 por SHA. Prova automatica completa exige tambem push confirmado,
CI verde, checkout limpo e propria trava removida. Periodicidade15min SOMENTE
pode ser habilitada depois disso; configuracao/Markdown nao bastam. Continuar
condicionado a desktop/navegador/Codespace disponiveis, sem prometer autonomia
permanente ou criar scheduler/daemon/recurso pago/clone/chave alternativo.

Proximo pacote independente ja ASSUMIDO: CONT-03, comentario6388273674.
Pendencia comprovada: cliente-legacy-name.test.ts usa apenas localCrmFixture;
runner PostgreSQL obrigatorio nao inclui essa suite. Reutilizar a MESMA suite
e realCrmFixture existente para provar revisao sintetica no PostgreSQL real
isolado, LOGIN restrito/RLS, auditoria/releitura/replay/reversao e negativos,
com runner exigindo essa variante sem skips. Paths previstos: suite existente,
server/scripts/runPostgresTests.mjs e hunks HANDOFF/STATUS; helper compartilhado
somente com dependencia demonstrada e reserva adicional. Ainda sem edicao
nesses paths: CONT-02 conserva exclusividade ate o fechamento. Nao confundir
PG geral verde com essa prova especifica ou com destino operacional liberado.

Codex=legado344/revisao assistida/preparacao da carga. Cursor=PR350/recuperacao
ERP/Comercial360347. Revisao cruzada por SHA diretamente no GitHub, sem o
proprietario copiar contexto, nenhum agente editando branch do outro. Dados
privados/originais/IDs/codigos/vinculos e cinco gates preservados. Sem novo
piloto real, transferencia, VPS, carga operacional, merge, deploy, migration
operacional ou ativacao de flags/providers/canais. Legado separadoPAUSED.

## #344 - revisao sintetica ligada ao servico canonico (2026-10-24)

Responsavel Codex, pacote GitHub6387904051/6387938627; base dc14ed98 na mesma
branch/checkout/Codespace. O Codespace parou durante a retomada e foi retomado
no MESMO ID; HEAD/status reconferidos, sem escritor concorrente. Codex app-server
identificado fora do checkout, sem execWriter/lock Git. Nenhum novo clone,
Codespace, plano, chave ou recurso pago; nenhum dado real lido/aplicado.

applySyntheticInactiveNameReview no modelo existente recebe o envelope de
rascunho exportado, nunca um alvo ou autorizacao fornecido por ele. Exige
cliente/fonte SYNTHETIC e binding ISOLATED_SYNTHETIC, campo nome, identidade,
origem/prova/fingerprint exatos e RBAC importar+editar. O autorizador externo
ao rascunho deve confirmar hashes da proposta, binding e registro, ator/Grupo
e referencia UUID explicita. Inputs sao capturados antes dos awaits. Nao ha
autorizador operacional instalado nem aprovacao humana real fabricada.

O caminho chama ClienteService.correctInactiveLegacyName existente: schema,
CAS, RBAC/rechecagem, update e auditoria na mesma transacao. ReviewProof estrito
opcional acrescenta hashes/referencia/justificativa/evidencias ao recibo; recibos
anteriores continuam aceitos. Reversao recupera essa prova do recibo persistido,
sem aceita-la novamente do comando de reversao. Reexport no executor de revisao
existente; sem modulo/endpoint/importador/migration/permissao paralelos.

Fixture PGlite sintetica cobre rascunho->autorizacao->persistencia->releitura
SQL->replay->reversao com prova auditada preservada. Nega envelope adulterado,
alvo nao confiavel, origem nao sintetica, empresa/grupo incorretos, fonte/prova
alterada, evidencia ausente, autorizacao divergente/ausente, nome fora do schema;
falha de auditoria reverte e replay com outra autorizacao conflita. Mantem
ID/codigos/inatividade/vinculos/outros campos. UI privada permanece bloqueada:
nao e liberacao de revisoes reais ou prova operacional PostgreSQL.

Checks locais: foco11 PASS/0 FAIL/0 SKIP; raiz2279 PASS/0 FAIL/0 SKIP;
backend557 total,533 PASS/0 FAIL/24 SKIP. Audit baseline/lint/typecheck/build
raiz e server/diff-check exit0. Comandos padrao AGENTS executados, recibo de
fechamento no GitHub por SHA; CI nova deve ser conferida, nunca substituida por
CI anterior. Skips locais nao comprovam PostgreSQL real. Nenhuma carga,
transferencia, piloto real, VPS, merge, deploy ou migration operacional.

Fila continua: Codex assume CONT-02, comentario6387973425 da344. Defeito
reproduzido sem escrita mestre: journal aceita entrada applied=true com hash
recalculado ao adicionar outra operacao valida. Proximo delta exclusivo:
collectAssistedReviewProposal e tests/legado-review-workflow.test.js, preservando
todos hashes/replay/duplicidades. Reserva deste pacote liberada apos push;
proxima reserva exige HEAD/status/processos novamente, sem editar Cursor.
Cursor permanece responsavel PR350/ERP/Comercial360347 e revisao cruzada por SHA.

Retomada automatica: heartbeat local existente e configuracao de disparo unico
COUNT=1 suportados pelo app, ainda PAUSED enquanto este escritor fecha o lote.
O ciclo automatico receber tarefa->implementar->testar->publicar AINDA NAO foi
comprovado. Somente ensaio unico de CONT-02 pode ser armado apos liberar escritor;
recorrencia periodica nao deve ser habilitada antes dessa prova. O canal depende
do desktop/navegador/Codespace disponiveis; nao declarar autonomia permanente por
Markdown ou por CI de execucao manual. Sem acionamento funcional, manter proxima
tarefa pronta no GitHub e informar a limitacao. Cinco gates operacionais e
agendamento separado LegadoPAUSED preservados; historico abaixo onde divergente.

## #344 - captura estavel da correcao canonica (2026-10-24)

Retomada no MESMO Codespace/checkout e branch da PR342; base
4ab7a61b8ea63d55dfd18431740723a6bae1456f, inicialmente limpo e sem escritor
Node/Codex/Cursor concorrente encontrado. Origin canonico conferido. Nenhum
clone de desenvolvimento neste PC, Codespace novo ou acesso VPS alegado.

Defeito reproduzido em fixture SQL sintetica: o comando era lido depois do
primeiro await de autorizacao; uma referencia compartilhada podia trocar nome
e evidencia antes da persistencia. O servico existente agora captura os campos
primitivos do contexto e o resultado do schema estrito ANTES desse await.
Erro de validacao continua retornado depois do RBAC inicial; rechecagens dentro
da transacao, CAS, auditoria, replay e reversao existentes foram preservados.
Sem endpoint, permissao, migration, reativacao ou importador adicional.

Contraprova anterior FAIL (valor nao revisado persistido); apos correcao, foco
10 PASS/0 FAIL/0 SKIP. Tres casos adicionais provam comando/prova capturados,
tenant/ator estaveis apesar de mutacao externa, e revogacao antes do commit
com rollback de cadastro E auditoria. Releitura SQL, replay e reversao tambem
exercitados; ID/codigo/inatividade/procedencia/outros campos preservados.
Trata-se de PGlite sintetico, NAO de prova operacional PostgreSQL.

Fechamento local: raiz2279 PASS/0 FAIL/0 SKIP; backend556 total,
532 PASS/0 FAIL/24 SKIP. Audit baseline, lint, typecheck/build raiz e server,
e diff-check exit0. Comandos: npm run audit:baseline; npm test; npm run lint;
npm run typecheck; npm run build; npm --prefix server test;
npm --prefix server run typecheck; npm --prefix server run build;
git diff --check. Skips locais por DATABASE_URL ausente nao homologam banco.
CI do novo SHA deve ser conferida separadamente na PR342.

Cursor350 atual2d1f289f incorporou a base4ab7a61b, sem delta comercial extra
sobre8ba3b5bf; CI4505/run40111304731 SUCCESS. Branch/arquivos Cursor intactos;
aprovacao visual e integracao nao concedidas. Previa5173 nao foi iniciada
nesta retomada. GitHub e terminal web do Codespace comprovados; VPS nao testada.

Backup/pilotos/revisao privada anteriores da344 NAO repetidos. Proxima entrega:
ligar propostas autorizadas ao caminho canonico, primeiro isolado, sem inferir
campos nem promover recibos revertidos. Os cinco gates abaixo continuam abertos.
Este lote corrige o defeito do servico; nao declara essa ligacao completa,
carga operacional, merge, deploy, migration ou homologacao. Reservas deste
lote sao liberadas apos commit/push; revisao independente permanece pendente.

## CURSOR — #351 PlanoContas + CI verde (2026-10-24)

| Item | Valor |
|---|---|
| tip CI | **`01bd2e35`** MERGEABLE CLEAN |
| lote | PlanoContasForm `prevUpdatedRef` |
| fila | forms `prevIdRef` restantes esgotados fora coorte ID-only/Marca |
| próxima | recovery erp-integra (#349 fonte / Contratos equivalência) sem auth permissiva |

## CURSOR — fila contínua (2026-10-24)

| Item | Valor |
|---|---|
| executor | Cursor Cloud `/workspace` · **sem** Codespace montado |
| consolidação | tip **`4ab7a61b`** (branch Codex; não editar) |
| #350/#347 | tip **`2d1f289f`** · MERGEABLE CLEAN · CI 6/6 · candidata integrável · visual owner pendente |
| #351 cadastros | tip **`6e71e8b2`** CI verde + lote Moeda/Operador/CentroCusto em curso |
| reserva alheia | #344 Legado · MarcaForm · `scripts/legado` · branch `codex/consolidacao-infra-20261017` |
| retomada | CI subscriptions ativas nas branches Cursor; **sem** timer de polling de PR; autonomia permanente **não** declarada |
| próxima | restantes forms `prevIdRef` · #349 só com fonte privada comprovada · sem alegar URL Codespace |

## CURSOR — #351 merge consolidação `4ab7a61b` (2026-10-24)

| Item | Valor |
|---|---|
| base merge | tip **`4ab7a61b`** |
| tip anterior | `19404da3` · CI SUCCESS · conflito docs |
| conflitos | STATUS/HANDOFF — ambos lados |
| #350 | `2d1f289f` MERGEABLE CLEAN · CI 6/6 · runner Cursor (não Codespace) |
| fora | MarcaForm · branch Codex intocada |
| próxima | Banco/Cargo/Departamento `prevUpdatedRef` |

## CURSOR — #351 mestres produto reabrir (2026-10-24)

| Item | Valor |
|---|---|
| tip CI verde | **`42bde90d`** · 6/6 SUCCESS (harness Região + hashes FormaPagamento) |
| tip publicado | **`af79c8d3`** · mestres produto · HEAD docs `19404da3` |
| lote | UnidadeMedidaForm · GrupoProdutoForm · SetorAtividadeForm |
| mudança | `prevUpdatedRef` + `idChanged\|updatedChanged` · submit bloqueia `isSubmitting` |
| código/ID | `CadastroCodigoRegistroField` já presente (preservado) |
| fora | MarcaForm (reserva #344) · sem auth permissiva · sem tela duplicada |
| #350/#347 | CI SUCCESS → tip merge `2d1f289f` · sem alegar prévia Codespace |
| próxima | demais forms só `prevIdRef` (Banco/Cargo/…) |

## CURSOR — #351 CI verde + FormaPagamento/Região (2026-10-24)

| Item | Valor |
|---|---|
| tip anterior | **`4e90d897`** · CI 6/6 SUCCESS · mergeable clean |
| lote | FormaPagamentoForm(+Completo) + RegiaoAtendimentoForm · `prevUpdatedRef` |
| fora | MarcaForm (reserva) · #344 Legado |
| testes | `cadastros-reopen-representante-updated` ampliado |

## CURSOR — Representante reabrir+código (2026-10-24)

| Item | Valor |
|---|---|
| base | consolidação tip **`0b8bafa7`** |
| branch | `cursor/cadastros-reabrir-updated-392b` |
| pacote | RepresentanteForm + RepresentanteFormCompleto (ERP novo; fora #344) |
| causa | só `prevIdRef` — save/reabrir com mesmo id não reidratava `updated_date` |
| mudança | `prevUpdatedRef` + `idChanged\|updatedChanged` · código/ID via `CadastroCodigoRegistroField` no form simples |
| #347/#350 | CI verde `1784dbf6`/`8ba3b5bf` em PR separada · não misturada neste PR |
| testes | `cadastros-reopen-representante-updated` |
| próxima | outros forms só com prevIdRef (FormaPagamentoForm, etc.) |

## Continuidade atual #344 - revisao assistida e preparacao (2026-10-24)

Validacao local: suite completa 2278 PASS / 0 FAIL / 0 SKIP; audit/lint/typecheck/build/diff-check exit 0. Depois, o reforco de integridade do journal e um teste estatico adicional do roteiro SQL passaram no foco final: 11 PASS / 0 FAIL / 0 SKIP (inclui wrapper de seis testes Python sinteticos). A suite completa local citada e anterior a esse pequeno delta final; CI do SHA final executa a composicao final, sem alegar contagem local inexistente.
Smoke Chromium sintetico: 5 PASS / 0 FAIL / 0 SKIP: quatro situacoes, original preservado na sugestao de formato, rascunho sem aplicacao com operationId estavel no replay, filtros por situacao/motivo e viewport 390 sem overflow da pagina. Capturas sinteticas e recibos privados. Comando: `node scripts/legado/pilot-functional-review-smoke.mjs /caminho/playwright/index.mjs /tmp/review-smoke`. Playwright 1.56.1 e bibliotecas gratuitas foram preparados temporariamente fora das dependencias/lockfiles do projeto; nenhum servico pago, credencial ou permissao operacional criado.
O navegador headless acessou somente a previa sintetica loopback; encaminhamento web nao foi usado como prova. Nenhum dado privado foi servido. Aviso preexistente de chunks grandes no build permanece. Backend/PG do lote anterior inalterados: nao repetidos localmente.

Este checkpoint prevalece sobre os cabecalhos historicos abaixo. Mesma branch/clone/Codespace; um escritor. Base deste lote: `0b8bafa7` (CI4482/4483 SUCCESS). Nenhum piloto aprovado, transferencia, carga ou ensaio PostgreSQL foi repetido neste pacote.

O fluxo existente `scripts/legado/pilot-functional-review.mjs` agora exporta `prepareAssistedReviewPackage` e `writeSyntheticAssistedReview`. Os auxiliares separam modelo, apresentacao e plano para nao ampliar o executor existente; reutilizam `projectAssistedLegacyReview`, fingerprints e a allowlist canonica de segredos. Nao ha novo modulo ERP, endpoint, rota operacional ou importador paralelo.

- Revisao privada: 40009 apontamentos; 20456 historicos e 19553 revisoes de endereco; 0 promovidos a uso operacional, 0 acessos ao banco, 0 cargas. Recibos/fontes anteriores intactos. Campos originais e procedencia ficam somente no pacote privado, com hashes e permissoes restritas; valores sensiveis nao entram no HTML quando a permissao nao foi comprovada. Falha individual vai para quarentena, sem interromper os independentes.
- Situacoes textuais, motivos por campo, operacoes bloqueadas, filtros e paginacao da projecao completa. CEP e UF oferecem somente sugestao deterministica de apresentacao. Numero, pais, finalidade, unidade, identidade e vinculo nao sao inferidos. Normalizacao nao equivale a validacao canonica.
- A previa publicavel e gerada exclusivamente com quatro fixtures sinteticas; fonte privada e recusada nesse modo. Rascunho baixado e nao confiavel, sem gravacao mestre ou liberacao. A preparacao autorizada de proposta exige contexto exato, importar+editar, rechecagem, fingerprint, justificativa e evidencia para mudanca de significado. Captura dos inputs antes de await e replay com integridade do journal de propostas; isso nao comprova persistencia/auditoria PostgreSQL nem substitui o servico canonico.
- O retrato real e somente leitura: nenhuma sessao/permissao de revisor foi fabricada. Aplicacao manual e liberacao posterior continuam dependentes do servico canonico, revalidacao, RBAC atual e auditoria transacional. Nao confundir a interface privada com fluxo operacional homologado.

### Preparacao operacional: cinco gates restantes

1. Identidade e esquema do destino: banco/role/schema, volume PostgreSQL, versao/contratos e journals. `scripts/legado/target-metadata-readonly.sql` e roteiro preparado, NAO executado no operacional. O executor usa nome completo e ordenacao lexicografica; journal por nome nao comprova bytes do SQL aplicado. Inventario privado 045-049 e seus artefatos aplicados ainda exigem reconciliacao; nao renumerados nem copiados para execucao automatica.
2. Escopo e duplicidades: crosswalk Grupo/Empresa autorizado e reconciliacao no destino da coorte exata; zero duplicados isolados nao comprova ausencia no operacional.
3. Menor privilegio e atomicidade: role sem BYPASSRLS, RBAC real, servico+auditoria+mapa na mesma transacao e concorrencia da primeira inclusao no destino/copia representativa autorizada. Provas isoladas anteriores permanecem validas somente para seu escopo.
4. Backup/restauracao e reversao: backup do DESTINO e restauracao comprovada desse artefato, mais reversao por lote protegendo edicoes externas. Recuperar workspace ou staging do legado nao substitui restaurar o banco de destino.
5. Liberacao operacional especifica: aprovacao da coorte, campos, identidade do destino e janela. Nenhuma autorizacao geral ou ensaio isolado libera carga real.

Primeira carga PROPOSTA: ate 100 clientes ativos, identidades canonicas validadas, mestre de Grupo com visibilidade explicitamente autorizada; sem reativacao, sobrescrita, fusao automatica, estoque/saldo ou documento fiscal. A coorte efetiva operacional ainda tem zero liberados: lotes revertidos nao sao promovidos. Produtos dependem tambem de unidades/classes/referencias comprovadas, sem conversoes ou unificacao PC/UN; enderecos incompletos bloqueiam somente operacoes dependentes quando seguro. O plano permanece `PREPARED_NOT_AUTHORIZED_OPERATIONAL_LOAD`.

Precheck autorizado executado somente no filesystem privado do staging VPS: host esperado, diretorio 0700 fora da aplicacao, 32533684224 bytes livres no momento da leitura; zero conteudo lido/alterado, banco ou servico acessado. Nao e prova de espaco no volume PostgreSQL. Recibo detalhado privado; sem transferencia ou novo inventario integral.

### Cursor PR350 por SHA

Revisao atualizada em `8ba3b5bfbfcd2c626c58c86c81db7d27bd7c58b5` e tip merge Cursor `2d1f289f` sobre consolidacao `4ab7a61b`: a correcao substitui o acesso aos campos ilustrativos de `masters` por `proposalMasters`, mantendo a origem sintetica DEV; TS2339 resolvidos. Seis checks SUCCESS no tip merge. Aprovacao visual e merge continuam separados. Runner Cursor ≠ Codespace.

Validacao deste lote e SHA final: conferir o recibo de fechamento e CI do commit publicado. Backend/ledger sem alteracao reutilizam provas anteriores (529 PASS/24 SKIP no backend e PG sintetico 6 PASS/0 SKIP); skips nao sao persistencia comprovada. Logs/diffs/hashes de publicacao ficam privados. Dados reais, HTML privado, manifests detalhados, .env, certificados, chaves e backups nao integram o Git.

Retomada privada: `current-assisted-review.json` aponta para o pacote preservado fora do checkout; verificar `integrity-private.json` antes de usar. O gerador cria outro diretorio privado, nunca sobrescreve recibos anteriores. Para previa sintetica, chamar `writeSyntheticAssistedReview` com arquivo novo fora do repositorio. Nao executar o modo antigo `--review` ou um piloto para apenas abrir esta revisao.

Proxima entrega: aplicar revisoes autorizadas pelo caminho canonico somente apos RBAC/revalidacao/auditoria demonstrados; reunir as provas dos cinco gates e apresentar coorte operacional concreta para aprovacao. Carga operacional, merge, deploy e migrations continuam nao autorizados.

## Continuidade atual #344 - produtos e ledger (2026-10-24)

Estado atual prevalece sobre os checkpoints historicos abaixo. Mesmo Codespace, clone e branch de consolidacao; nenhum acesso operacional, merge ou deploy.

Validacao local composta: raiz 2267 PASS / 0 FAIL / 0 SKIP; backend 553 total, 529 PASS / 0 FAIL / 24 SKIP. Os skips nao comprovam PostgreSQL; prova focada real separada do ledger: 6 PASS / 0 FAIL / 0 SKIP. Auditoria baseline, lint, typecheck raiz/backend, build raiz/backend e diff-check exit 0; aviso de chunks grandes no build permanece. Comandos: `npm run audit:baseline`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm --prefix server test`, `npm --prefix server run typecheck`, `npm --prefix server run build`, `git diff --check`.
A ultima guarda adicional conserva ambas as grafias de quarentena de produto (`quarantine_reason`/`quarantine_reasons`); teste focado novo deve ser somado somente no resultado efetivamente executado. A composicao final sera novamente conferida pela CI do SHA publicado, sem promover skips a aprovacao.
Demonstracao privada: 18458 apontamentos de clientes, 790 fornecedores e 1208 produtos classificados como historico devido a inatividade de origem ou reversao comprovada; 19553 apontamentos auxiliares de endereco aguardam revisao. Situacoes validado/pendencia nao critica tem zero exemplos reais ativos neste retrato, sem fabricar liberacoes. Os quatro estados foram exercitados com fixtures sinteticas. A projecao nao e uma interface operacional homologada.

- Produtos: executor existente ampliado por auxiliar `pilot-functional-products.mjs` e comando `pilot-functional.mjs --products`. Reutiliza importador, servicos, repositorios, RBAC, auditoria e reserva canonica de codigo; nao cria importador paralelo.
- Ensaio PostgreSQL isolado: origem 1208, identidade nativa comprovada 1208, liberados/gravados/reconciliados 1184, reutilizados na reexecucao 1184, novos na reexecucao 0, rejeitados 0, reversoes logicas 1184, ativos restantes 0. Os 24 inativos foram preservados fora da carga.
- Sete unidades canonicas no escopo isolado, sem conversoes: KG/Kg quilograma, PC peca, CX caixa, m2 metro quadrado (grafia original preservada no mapa privado), UN unidade, LTS litro, MT metro linear. PC/UN distintos; unidade de teste excluida; nenhum fator ou conteudo de caixa inferido. Nenhum estoque/saldo criado.
- Primeira tentativa parou na reserva de codigo por falta de EXECUTE no papel efemero. Corrigido somente no executor isolado, com a assinatura exata ja usada pela fixture canonica. Recibo anterior preservado privadamente; segunda execucao exit 0, papel desabilitado e container parado ao final.
- Enderecos: `criarTransacaoEnderecoPilotoPostgres` reutiliza `persistirEnderecoClienteGrupoLegado` e `ClienteLocalService`; uma conexao/transacao para endereco, auditoria e ledger. Lock do cliente mestre antes da primeira consulta ao mapa; RBAC sem wildcard e rechecagem antes do commit; executor expira fora da transacao.
- PostgreSQL real com fixture sintetica: 6 PASS / 0 FAIL / 0 SKIP, cobrindo atomicidade, replay, falha de auditoria/mapa, negacao tardia, contexto indevido, campos ausentes/conflitantes, concorrencia entre duas conexoes, reversao e protecao contra edicao externa. A primeira fixture colidia por repetir o mesmo endereco; corrigida com numeros sinteticos distintos sem relaxar deduplicacao.
- Dados reais de endereco permanecem pendentes por campos sem fonte e conflitos; testar o ledger nao comprova completude cadastral nem autoriza preencher numero/pais por suposicao. Nenhuma carga real de enderecos executada.
- Correcao individual: proprietario confirmou o ID completo documentado privadamente, condicionado a procedencia. Conferidos ID do apontamento original, indice/fonte/hash/parser, snapshot integral, codigo canonico, codigo legado, origem e lote; distincao dos codigos e divergencia da mascara inicial explicadas no recibo privado antes de aplicar. Somente residuo do nome removido no banco isolado; 3 mutacoes auditadas, replay reutilizado, reversao comprovada e reaplicacao final. ID/codigos/status inativo/vinculos/procedencia/outros clientes preservados. Tentativas tecnicas anteriores preservadas, sem carga operacional.
- Evidencias detalhadas, manifestos, mapas, autorizacoes e logs do ensaio permanecem fora do checkout. Originais/HD/captura/worktrees preservados; agendamento Legado continua pausado e rotas operacionais inativas.
- Revisao assistida: projecao no `pilot-functional-policy.mjs`, sem modulo/rota paralelo. Quatro situacoes textuais, filtros na demonstracao privada, motivos por campo e operacoes afetadas bloqueadas; 5 testes sinteticos PASS. Indicadores nao concedem permissao, reativacao ou liberacao operacional. Historico revertido e clientes nao ativos permanecem somente consulta/conciliacao. Incerto nao gera cobranca, baixa, saldo ou emissao.
- Publicacao deste lote nao libera carga operacional, migrations operacionais, VPS ou emissao fiscal. Proximo: revisao assistida das evidencias faltantes, sem preenchimento ficticio; manter gates de destino, backup, reconciliacao e reversao antes de qualquer carga real.


## #344 - invariantes historicas e evolucao autorizada reconciliadas (2026-10-24)

A CI4476/4477 aprovou backend e composicao de c90d629e, mas a raiz revelou
uma segunda dependencia: publication-baseline-contracts exigia os bytes do
teste bulk anterior. Falha reproduzida antes da alteracao. O hash historico e
o manifesto NAO foram atualizados ou relaxados. A normalizacao agora subtrai
SOMENTE o bloco literal autorizado, exige ocorrencia unica e conserva o hash
anterior de todo o restante. Contraprovas rejeitam delegacao alterada, repetida
e mudanca na verificacao integral dos membros anteriores. Focados: 22 PASS.

Backend completo local da correcao anterior: 552 total, 529 PASS, 0 FAIL,
23 SKIP; tambem aprovado na CI4477. Suites inalteradas nao foram repetidas
localmente neste ajuste somente de teste. Raiz completa foi repetida porque
a falha comprovada exigiu validar a composicao. Resultado do fechamento:
tests 2262; pass 2262; fail 0; skipped 0

Runtime/permissoes/rotas/migrations permanecem inalterados neste lote.
Unidades confirmadas pelo proprietario, sem conversoes, PC/UN distintos e
unidade de teste excluida; mapa/piloto privados seguem em lote funcional.
Correcao individual de cliente continua sem autorizacao especifica.
Agendamento pausado, originais preservados, sem carga operacional/deploy/merge.
As entradas anteriores sao historicas onde divergirem deste fechamento.

## #344 - correcao da invariancia da CI4474/4475 (2026-10-24)

A falha do backend em 36e123c8 foi reproduzida no Codespace: o teste de
consolidacao enumerava apenas export/restoreBulkSnapshot e rejeitava a adicao
autorizada de correctInactiveLegacyName. Nao foi falha ambiental. O teste
preserva a igualdade integral de TODOS os membros anteriores e exige a lista
exata dos tres adicionais, o import canonico e o corpo exato da nova delegacao.
Os testes comportamentais de escopo, permissao, CAS, auditoria, replay e reversao
do novo metodo permanecem obrigatorios. Nenhum handler antigo foi modificado,
nenhuma assertion retirada, nenhuma permissao/rota/migration ativada.

Reproducao anterior: 1 FAIL. Fechamento e recibos completos em ci-fix-results.json
no mesmo job privado apontado por current-completeness.json. CI do novo SHA deve
ser conferida antes de declarar verde. Frontend/composicao de 36e123c8 passaram;
essas provas inalteradas foram reutilizadas localmente, sem repetir suas suites.

O proprietario confirmou posteriormente os significados das sete unidades,
SEM fatores de conversao. PC/UN permanecem distintos; caixa nao implica conteudo,
peso ou quantidade; unidade de teste excluida. Aplicacao ao mapa privado e piloto
de produtos seguem depois desta correcao. Isso nao autoriza a correcao individual
do cliente divergente: essa linha continua em quarentena ate decisao especifica.
Dados, definicoes detalhadas e recibos reais permanecem privados, fora do Git.

Historico anterior abaixo; nao interpretar CI pendente/verde antiga como prova
do novo commit. Agendamento Legado pausado, originais preservados.

## #344 - regras de produto, correcao preparada e completude privada (2026-10-23)

ESTADO ATUAL: pacote independente concluido; carga de produtos e correcao real
continuam retidas pelos gates abaixo. Base 1789c1a9ff82264c91b47da4cbe8ba1780eb0b7e,
CI4472/4473 SUCCESS confirmado pelo proprietario. Mesmo Codespace e branch
codex/consolidacao-infra-20261017, escritor unico. Provas anteriores, originais,
captura/worktrees e staging preservados. Nenhuma transferencia ou carga anterior
foi repetida. As secoes seguintes sao historicas onde divergem deste estado.

### Produtos: resolvido versus indispensavel

1208 identidades nativas e respectivas classes/unidades foram comprovadas por
join exato aos materiais preservados. A natureza `TIPOMATERIAL` desses 1208
resolve pelo enum/aliases existentes de `produtoTipoPolicy`, sem default nem
comparacao de nomes. Isso NAO transforma a classe nativa em um GrupoProduto por
palpite: o projetor preserva o codigo em `grupo_legado`; o FK `grupo_produto_id`
nao comprovado fica separado como pendencia de completude.

Restou UMA familia indispensavel para liberar produtos: equivalencia semantica,
identidade e escopo de 7 codigos nativos de unidade utilizados nesta coorte.
O catalogo historico de referencia, recuperado pelo hash ja registrado no
manifesto, contem 4 definicoes com IDs/grandezas. Ele nao prova o estado atual
de um destino operacional. Sigla identica e apenas candidato. O Grupo sintetico
do ensaio ainda nao possui unidades mestres comprovadas. Nao foram criados
fatores, unidades ou vinculos por conveniencia.

Decisao privada agrupada por unidade, com quantidades afetadas e catalogo de
referencia: `DECISOES_344_PRIVADAS.html`. Nao solicitar produto por produto.
Resultado: 1208 classificacoes comprovadas, ZERO produtos liberados/gravados.
Por isso nao houve carga, reexecucao ou reversao REAL de produtos neste lote;
nao apresentar o teste sintetico do projetor como piloto PostgreSQL. Apos as
unidades serem comprovadas, reutilizar o cadastro generico de UnidadeMedida,
ProdutoService e importador existentes, nao criar persistencia paralela.

### Uma correcao de nome inativo, ainda nao aplicada

Preparada no ClienteService por auxiliar `clienteLegacyNameCorrection`:
Grupo explicito, ator autenticado, permissoes existentes editar E importar,
sem wildcard, sem empresa e sem reativacao. Somente nome de Pessoa Fisica
importada inativa; ID/codigo/status/procedencia e demais campos preservados.
Snapshot SQL integral bloqueado, CAS por fingerprint, operacao idempotente,
auditoria na mesma transacao e rechecagem de permissao. Reversao utiliza o
recibo persistido da operacao original, nao um nome anterior fornecido pelo
chamador; edicao externa bloqueia em vez de ser sobrescrita.

Fixture sintetica testa autorizacao/escopo, entrada adulterada, CAS, rollback
da auditoria, replay, reversao e preservacao integral. O plano REAL privado
foi preparado apos reler a linha no CSV com hash conferido e parser corrigido.
Hashes na API documentam evidencia, nao autenticam uma fonte por si mesmos:
o executor deve revalidar o plano/fonte antes de qualquer aplicacao autorizada.
Nenhuma rota nova, grant ou permissao operacional foi criada. O update/get
padrao de cliente inativo continua bloqueado. A linha REAL permanece em
quarentena, `PREPARED_NOT_AUTHORIZED_REAL_CORRECTION`, aguardando autorizacao
especifica para aplicar e conservar o mesmo ID/codigo/status.

### Enderecos e leitura canonica

19553 apontamentos de endereco classificados por disponibilidade, ausencias e
conflitos: 18762 de clientes e 791 de fornecedores, em 26 grupos. Todos ainda
carecem de campos obrigatorios comprovados (numero, pais, rotulo/finalidade);
231 apontamentos possuem conflitos de formato: 229 CEP e 2 UF. Sao contagens
de enderecos/apontamentos, NAO de pessoas distintas, e diferem da metrica antiga
de auxiliares mistos de contato/endereco. Nada foi preenchido por suposicao.

18555 apontamentos possuem plano de vinculo ao ID mestre do lote anterior,
conferido por identidade legada; 998 pertencem a mestres nao carregados e
permanecem preservados. ZERO novos enderecos/vinculos foram gravados. Os 987
clientes nao ativos continuam fora da carga, sem reativacao implicita.
Cadastro principal reconciliado NAO significa cadastro completo.

Leitura PostgreSQL REAL pelo caminho canonico: ClienteService.list com filtro
explicito de inativos, duas paginas distintas e total 17471; FornecedorService.get
em duas amostras. Get padrao de cliente inativo retorna 404 como contratado.
Demonstracao JSON/HTML privada preparada, sem servidor/porta/link publico.
Sessao administrativa somente leitura; leituras canonicas existentes adquirem
locks e usam transacoes que os permitem, mas nenhum metodo de mutacao foi
invocado. Nao chamar todo o banco de read-only. Container novamente parado.

### Candidato operacional: preparado, NAO autorizado

Pacote privado identifica campos cobertos, entidades/coorte, rejeicoes,
dependencias, escopo de mestre de Grupo, reconciliacao e plano de vinculos.
Continuam nao comprovados: identidade do destino operacional; backup desse
destino e ensaio de restauracao; schema/journals e colisoes de migrations;
RBAC de menor privilegio; crosswalk Grupo/Empresa; duplicidades no destino;
unidades/completude; autorizacao especifica de correcao e de carga.
Adaptador PostgreSQL de mapa/ledger de enderecos na mesma transacao e prova de
primeira corrida concorrente continuam gates proprios; nao sao substituidos
pela fixture de nome ou pelos journals de arquivo do ensaio.

Recuperar workspace ou o banco isolado NAO comprova restauracao do banco
operacional. Reversao operacional deve limitar-se a registros criados pelo
proprio lote, preservar preexistentes reutilizados e exigir CAS/auditoria;
o harness de ensaio nao e um executor operacional. Nenhum saldo/estoque/titulo,
emissao fiscal, merge, deploy ou migration operacional foi executado.

### Validacao e retomada

`npm test -- --test-reporter=tap tests/legado-completude.test.js` cobre as novas
regras e o modo auxiliar sem mutacoes. Testes do server incluem a fixture nova
de nome inativo e a regressao existente de identidade legada. PGlite/memoria
nao sao prova de mutacao em servidor PostgreSQL. DATABASE_URL foi removida do
ambiente dos testes: a variante PostgreSQL real desse teste de regressao nao
foi acionada, nao deve ser contabilizada como aprovada. Resultados finais e
checks obrigatorios constam no status do lote; suites inalteradas reutilizam a
CI4472/4473, sem alegar nova execucao integral local.
Fechamento focado: 11 PASS/0 FAIL/0 SKIP pelo npm test direcionado e 13
PASS/0 FAIL/0 SKIP no server (7 da correcao e 6 de identidade/regressao).
Audit, lint, typecheck e builds da raiz/server, mais diff-check, executados no
lote. Lint conserva 1 warning anterior de diretiva desnecessaria, sem supressao
nova. A primeira falha da fixture foi corrigida alinhando o cliente sintetico
ao mestre de Grupo, sem conceder acesso adicional a dados de Empresa.

O modo `--review` foi extraido em auxiliar do MESMO `pilot-functional.mjs` para
manter o executor pequeno; nenhum segundo importador/ambiente foi criado.
Retomada privada: `current-completeness.json` no staging homologado aponta o
job; `receipt-index-private.json` identifica os recibos vigentes, demonstracao,
decisoes agrupadas e candidato. Abrir o HTML apenas como arquivo privado;
nao servir em porta publica, anexar ao GitHub/CI ou copiar dados para build.
O agendamento Legado permanece pausado e os gates/custos anteriores preservados.

## #344 - ensaio funcional ampliado, com gates de produto e auxiliares abertos (2026-10-23)

Estado atual: PARCIAL por entidade, exclusivamente em PostgreSQL 16 isolado.
Esta secao substitui as contagens atuais do piloto de 25 abaixo; os recibos
anteriores continuam historicos validos e nao foram repetidos ou alterados.
Base de codigo: 505a76ed06bf956a076f0e9577f8018ade1fa4b8, mesma branch
codex/consolidacao-infra-20261017 e mesmo Codespace. Sem merge ou operacao.

| Entidade | Origem/processados | Gravados | Reuso na carga/reexecucao | Rejeitados/bloqueados | Reconciliados | Pendentes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Clientes | 18458 | 17471 | 0 / 17471 | 987 nao ativos preservados | 17470 | 1 divergencia de nome; auxiliares separados |
| Fornecedores | 790 | 790 | 0 / 790 | 0 | 790 | 1 auxiliar de cobranca |
| Produtos | 1208 | 0 | 0 / nao executada | 0 rejeicoes de carga; carga nao liberada | 0 | 1208 por mapeamento de destino |

Reexecucao dos lotes carregados: zero novos registros. Reversao logica de 17471
clientes e 790 fornecedores, por 74 lotes/checkpoints, sem exclusao fisica,
sem novos vinculos empresariais e sem movimentacao financeira/fiscal/estoque.
IDs, codigos literais e procedencia mantidos. O grupo/ator sao sinteticos de
ensaio: isso NAO comprova o crosswalk operacional de Grupo/Empresa nem a
ausencia de duplicidade em qualquer banco operacional.

O limite anterior de 25 era uma escolha explicita do executor (`slice(0,25)`),
nao um limite formal do contrato. A ampliacao autorizada utilizou lotes de 250,
journal privado retomavel e verificacao real de espaco no filesystem privado.
Os 987 clientes nao ativos nao foram reativados ou carregados. O namespace do
piloto original de 25 foi conferido por hash, preservado integralmente.

### Implementacao e causa corrigida

Nao existia persistencia SQL de Fornecedor para o importador. Foram reutilizados
os campos do cadastro existente, validadores de documento, reserva canonica de
codigo, DbClient, RBAC e auditoria. `FornecedorService` e repositorio PostgreSQL
implementam mestre de Grupo, importacao estrita, locks deterministas,
idempotencia com comparacao integral, auditoria transacional inclusive no reuso,
rollback e reversao com lote/revisao/fingerprint. Nenhum consumidor ou dono do
salvamento da UI foi substituido; nenhuma rota foi montada. Dados bancarios e
campos fiscais nao pertencentes ao contrato sao rejeitados, nao inferidos.

SQL permanece em `server/schema-candidates/fornecedor_master.sql`, FORA de
`server/migrations`, sem numero, grants ou policies operacionais. Foi executado
somente no destino de teste comprovado. Historico/journals dos destinos,
identificacao/dependencias e menor privilegio operacional continuam gates;
nenhuma migration aplicada foi alterada/renumerada.

O Sniffer de CSV sobre apenas o cabecalho desativava `doublequote`, deslocando
JSON com aspas escapadas. Corrigido parser com escape explicito e rejeicao de
largura divergente; contraprova sintetica preserva cobertura. Entrada, fontes,
pins e resultados anteriores foram preservados privadamente antes da retomada.
Um nome de cliente ja carregado/revertido difere da projecao corrigida. Esta
linha foi registrada como NAO reconciliada, sem sobrescrita ou reativacao:
o servico atual nao edita cliente inativo. Decisao necessaria: fluxo autorizado
de correcao auditada de cadastro inativo importado, preservando o mesmo ID,
ou manter essa linha em quarentena. Nao houve relaxamento desse contrato.

### Produtos, enderecos e continuidade privada

Os 1208 produtos foram ligados por identidade nativa exata a uma extracao
verificada de materiais, recuperando classe/unidade sem similaridade de nome.
Lista privada objetiva: 73 grupos de decisao, 37 propostas de classe e 17
propostas de unidade. Nenhuma equivalencia de destino possui comprovacao
suficiente de escopo/semantica: zero aprovacoes automaticas, zero fatores de
conversao inventados. Confirmar destinos, dimensoes e semantica por grupo antes
da carga; nao confundir classificacao legada com regra fiscal.

Clientes possuem 17480 apontamentos auxiliares (nao clientes distintos), com
enderecos/contatos a revisar. Numero e pais do endereco canonico nao foram
comprovados; nao foram preenchidos por palpite. Fornecedores preservam endereco
plano do contrato existente e tem 1 auxiliar de cobranca pendente. Portanto
cadastro completo, enderecos e dependencias auxiliares NAO estao homologados.

Dados, identidades, caminhos de fontes, manifestos detalhados e relatorios
continuam privados fora do checkout/Git/build/CI. Retomada localiza o job pelo
ponteiro privado `current-functional.json` no staging ja autorizado; preservar
input, journal, state, pins e recibos antes de qualquer alteracao. Alteracao de
fonte/codigo exige comparacao e transicao explicita de hashes, nao nova carga
cega. O banco isolado fica parado com os arquivos preservados. Nao repetir o
piloto original, transferir o backup novamente ou acessar banco operacional.

### Validacao desta composicao

Recuperacao REAL apos parar/reiniciar o mesmo cluster: identidade do PostgreSQL
conferida, snapshots canonicos integrais de 17471 clientes e 790 fornecedores
iguais aos recibos de reversao, piloto anterior intacto. Auditoria persistente:
17471 create + 17471 possible_duplicate + 17471 soft_delete de Cliente;
790 create + 790 possible_duplicate + 790 soft_delete de Fornecedor.
Container novamente parado, banco e relatorios privados preservados. A primeira
checagem auxiliar de leitura usou formato de timestamp diferente do DTO;
corrigida para usar os repositorios canonicos, sem mudar dados ou produto.

Testes focados: 18 PASS / 0 FAIL / 0 SKIP de politica/parser/isolamento; 7 PASS /
0 FAIL / 0 SKIP no fixture sintetico PGlite de Fornecedor. PGlite nao e prova
de persistencia em servidor PostgreSQL; os lotes reais acima sao prova separada.
Reutilizados os 2242 PASS e CI4470/4471 SUCCESS de 505a76ed para superficie
inalterada; isso NAO e uma nova execucao integral local da composicao atual.
Comandos focados: `node --test tests/legado-piloto-funcional.test.js
tests/legado-piloto-isolado.test.js` e `node --import
./server/node_modules/tsx/dist/loader.mjs --test server/tests/fornecedor-import.test.ts`.
Recibos privados distinguem falhas iniciais do harness, correcoes e resultados
finais; nenhuma permissao de empresa foi ampliada para corrigir o fixture.
Fechamento: `npm run audit:baseline`, `npm run lint`, `npm run typecheck`,
`npm run build`, `npm --prefix server run typecheck`, `npm --prefix server run build`
e `git diff --check`: PASS, exit 0. Lint mantem 1 aviso anterior de diretiva
eslint-disable desnecessaria; sem nova supressao ou mudanca de baseline.
Avisos de tamanho de chunks do build nao foram tratados como falhas.

Regra-Mae, Comercial 360, originais/captura/worktrees, rotas inativas,
agendamento Legado pausado e bloqueio de custos permanecem. Publicar codigo nao
autoriza merge, deploy, carga operacional ou acesso ao HD por outros ambientes.

## #344 - piloto isolado de clientes executado; demais entidades em quarentena (2026-10-23)

Estado atual: autorizacao expressa posterior permite SOMENTE o piloto isolado.
PREPARED_NOT_AUTHORIZED nos cabecalhos antigos e historico para esse ensaio;
importacao operacional, emissao fiscal e movimentacao financeira continuam NAO
autorizadas. A centralizacao/retomada comprovada em 3bfa4de4 foi reutilizada,
sem nova transferencia, inventario integral ou leitura do backup original.

### Execucao e contagens

Base de codigo: 3bfa4de4ddc3b99266c17b2cf92fe7000f9f2f81, branch
codex/consolidacao-infra-20261017, no Codespace unico existente. O auxiliar
scripts/legado/pilot-isolated.mjs NAO e outro importador: prepara o ensaio e
reutiliza os mapeadores, persistirClienteGrupoLegado, ClienteService,
PostgresClienteRepository, RbacGuard, TenantGuard e auditoria existentes.
O corpo do importador e os servicos de negocio nao foram substituidos.

Coorte preparada verificada, nao total do backup historico:

| Entidade | Origem staging | Elegiveis neste ensaio | Importados | Quarentena | Reconciliados |
| --- | ---: | ---: | ---: | ---: | ---: |
| Clientes | 18458 | 17471 | 25 | 987 | 25 |
| Fornecedores | 790 | 0 (gate) | 0 | 790 | 0 |
| Produtos | 1208 | 0 (gate) | 0 | 1208 | 0 |

Clientes: zero duplicados identificados na coorte; 17446 elegiveis adiados pelo
limite deliberado de 25. Os 987 registros nao ativos ficaram em quarentena para
evitar reativacao implicita. Fornecedores/produtos foram retidos por gates, nao
declarados invalidos individualmente; ausencia de duplicidade nessas entidades
NAO foi comprovada. Persistencia canonica de fornecedor falta; produtos exigem
mapas aprovados de classe/unidade e identidades de UnidadeMedida verificadas.
Nao se inventou endpoint, correspondencia, classe, unidade ou empresa fiscal.

25 clientes gravados por servico/repositorio/auditoria reais em PostgreSQL 16.
Validacao canonica de campos obrigatorios e documentos, deduplicacao por origem
e documento, preservacao literal do codigo interno preparado SEPARADA do codigo
legado, legacy_id, source_system e lote. Nenhum cliente_empresa criado.
Reconciliacao dos 25 snapshots canonicos PASS; nao e comprovacao de migracao de
todos os enderecos, relacionamentos auxiliares ou historico comercial/financeiro.
Esses campos e suas fontes permanecem privados/preservados para lotes futuros.

Reexecucao: 25 reutilizados, zero novos, estado das linhas identico. Auditoria
preservada: 25 create, 25 possible_duplicate do caminho de reuso e 25 soft_delete.
Reversao: 25 inativados pelo metodo canonico, ativo=false/status=Inativo;
zero exclusoes fisicas, zero ativos restantes, IDs/codigos/procedencia e demais
campos conservados. Duas negativas de RBAC/contexto PASS, sem ampliar permissoes.

### Isolamento, protecao e limites da prova

Cluster Docker PostgreSQL 16 dedicado, imagem local por digest/pull=never,
network=none, sem portas publicadas, rootfs somente leitura e sem privilegio;
somente dois binds na pasta privada do lote. Antes de aplicar schema/gravar:
identidade database/role/system_identifier, socket sem endereco de rede e zero
tabelas publicas comprovados. Somente migrations publicadas foram aplicadas NO
CLUSTER ISOLADO; nenhuma migration privada 045/046/047/048/049 ou operacional.

Grupo e ator sao namespaces SINTETICOS de teste, nao correspondencia comprovada
de grupo/empresa operacional. Grupo fonte foi preservado no input privado;
documentos fiscais, saldos e titulos nao receberam empresa por inferencia.
Papel de dados NOSUPERUSER/NOBYPASSRLS, sem wildcard, com permissoes minimas.
O schema publicado nao fornece as policies de dados necessarias a esse papel:
policies exclusivas do teste limitam Grupo/ator sinteticos e contexto de Grupo.
Nao sao migrations publicadas, grants operacionais nem homologacao do menor
privilegio dos destinos reais. Esse gate operacional permanece aberto.

Container parado depois do ensaio e banco privado preservado. Reabertura do
MESMO cluster/banco comprovou 25 linhas inativas e auditoria conservada; voltou
a ser parado. Nenhum container do piloto ficou em execucao. Isso e recuperacao
do banco de teste, nao restore do banco/backup operacional ou do SQL legado.

Dados/SQL privados, selecao, quarentena, snapshots, relatorios detalhados,
credenciais EFEMERAS do cluster e hashes vinculaveis a registros permanecem
somente na area privada fora do checkout/build/CI. Recibo de retomada local:
current-pilot.json; dentro do lote: result-private.json, result-sanitized.json,
database-recovery-private.json e receipt-hashes-private.json. Nao publicar esses
arquivos. HD, captura, worktrees e banco operacional permaneceram intactos;
agendamento Legado pausado, sem novo ambiente pago ou ampliacao de acesso.

### Ocorrencias corrigidas no executor do ensaio

Tentativas anteriores e seus recibos foram preservados privadamente. Corrigidos:
prontidao prematura do servidor temporario do entrypoint PostgreSQL; suposicao
incorreta de igualdade entre codigo interno preparado e codigo legado; setup
de policies restritas exclusivo do cluster de teste; expectativa da reversao
ajustada ao contrato existente ativo/status. Nenhuma protecao de produto foi
retirada para obter PASS. A primeira conferencia de reabertura esperava somente
50 auditorias e falhou: o total real e 75, incluindo as 25 do reuso, comprovadas
por acao na segunda conferencia somente leitura, sem nova carga.

### Retomada e proximo lote

Comandos executados no Codespace: node --check scripts/legado/pilot-isolated.mjs;
node scripts/legado/pilot-isolated.mjs --prepare; tsx do server executando o mesmo
auxiliar com a raiz privada indicada em current-pilot.json. O auxiliar recusa
checkout/HEAD divergente e destino fora da raiz privada, cria lock e verifica
SHA-256 das tres fontes contra o manifesto autenticado. Nao repetir a carga
automaticamente no novo HEAD: revisar a base aprovada e preservar o recibo antes.

Proximo lote: completar/reutilizar persistencia canonica de fornecedor; revisar
e aprovar mapas classe/unidade e correspondencias de unidades para produtos;
resolver crosswalk Grupo/Empresa antes de qualquer destino operacional. Depois,
pilotos isolados separados por dependencia, mesma reconciliacao/reexecucao/
reversao. #344 permanece PARCIAL: clientes comprovados, nao tres entidades
homologadas. Publicar este codigo nao autoriza importacao operacional ou deploy.

### Validacao do lote

Codespace Linux/Node 24.21.0: focados 14 PASS/0 FAIL/0 SKIP; suite completa
npm test -- --test-reporter=tap tests/**/*.test.js: 2242 PASS/0 FAIL/0 SKIP.
npm run audit:baseline, npm run lint, npm run typecheck e npm run build: exit0.
Typecheck sem diagnosticos. URLs/variaveis de banco operacional removidas do
ambiente dos checks. Testes da suite usam dados sinteticos; a prova PostgreSQL
real com staging privado e um recibo separado, nao fixture apresentada como carga.
Sem novas dependencias, alteracao de baseline, supressoes ou remocao de testes.
SHA-256 do auxiliar: d25cd58930a48c1a9d1850545eed8f1c0615b01031b471d9bf75294821e9c6f9.
SHA-256 do teste: 788b5b757e59939e4db70568aa0a957ef2d55639d92cc8228181893d2ca46116.

## #344 - centralizacao privada concluida; staging utilizavel no Codespace (2026-10-23)

Este recibo substitui o estado de envio em andamento e o bloqueio de upload
registrados abaixo. Os cabecalhos anteriores sao historicos, nao o estado atual.

### Transferencia, integridade e recuperacao integral

Cinco lotes concluidos: 2836 arquivos / 48359509373 bytes logicos de origem.
Contagens por lote: staging 913/287977635; codigo/proveniencia 5/64739;
original 1857/21102245906; bases SQL de trabalho 21/26964656868;
quarentena 40/4564225. Instaladores continuam preservados somente na origem,
fora deste conjunto de migracao. Backup operacional do ERP novo nao foi
confundido com backup legado nem importado.

Todos os arquivos passaram por tamanho/SHA-256 na transferencia e na
recuperacao. Cinquenta objetos comprimidos/cifrados totalizam 3072559784 bytes;
334 referencias de arquivos reutilizam conteudo comprovadamente igual.
Esses bytes fisicos NAO sao o tamanho logico nem uma medida de migracao de dados.
Foi materializado o conjunto INTEGRAL em pasta privada de recuperacao na VPS,
com nova abertura e SHA-256 de todos os 2836 arquivos, nao apenas uma amostra.
Recibo agregado final: 2026-10-23T17:29:38Z; zero violacoes de protecao e
32543379456 bytes livres apos a recuperacao. Metadados finais das fontes:
zero alteracoes de tamanho, mtime e identidade; HD original apenas lido.

Destino permanece /root/erp-private/centralizacao-legado-20261023, fora
aplicacao/repositorio/build/publicacao. Objects, receipts e recovered separados;
pastas root700, arquivos root600. Os arquivos recuperados sao uma copia de
trabalho PRIVADA em claro sob essas permissoes; nao se afirma criptografia de
disco. Objetos arquivados usam AES-256-GCM, com chaves de dados em pasta separada
no MESMO host. Administrador/provedor desse host nao esta excluido da ameaca.
Nenhuma chave SSH pessoal foi copiada. Manifestos detalhados e chaves ficam
privados; nenhuma linha de dados reais ou hash vinculavel a registro foi publicada.

O worker de envio e o espelho de checkpoint encerraram apos concluir os cinco
lotes. Nao existe envio pendente nem necessidade de manter o HD conectado para
recuperar esses lotes na VPS. Preservar mesmo assim HD, captura e worktrees.
Helper de recuperacao integral privado restore-private.py reutiliza o leitor
e os manifests existentes; nao e outro importador. SHA-256 do SCRIPT:
4f03c7863c556982c58fcda837b6159ab4b844dba74ffac55a357cca238a3260.
Provas sinteticas: rejeicao de caminhos invalidos, escrita/abertura idempotente
e bloqueio de conteudo divergente PASS. Nenhum motor de banco foi iniciado.

### Acesso comprovado do executor Codespace: escopo exato

O proprietario habilitou o upload permitido da extensao Chrome. Seis artefatos
privados foram enviados pelo Explorer ao Codespace EXISTENTE, fora do checkout;
nao houve novo ambiente, token, permissao VPS ou copia de chave SSH pessoal.
O helper codespace-recovery.mjs recuperou a copia oriunda da VPS e verificou
913 arquivos / 287977635 bytes por tamanho e SHA-256 no proprio Codespace.
Owner UID1000, diretorios700/arquivos600; zero violacoes de protecao observadas.
Checkout permaneceu limpo no SHA650bc463ab039e2e2639a1e500b51f94113be826,
branch codex/consolidacao-infra-20261017, antes desta atualizacao documental.

Copia de trabalho: /home/codespace/erp-legado-privado-20261023/recovered.
Recibo privado: /home/codespace/erp-legado-privado-20261023/recovery-receipt.json.
Executar somente rotinas de leitura/reconciliacao autorizadas, sem incluir essa
pasta no Git, build, CI, preview ou contexto amplo de agentes. O staging do
Codespace e copia de trabalho; VPS e HD preservado continuam fontes de recuperacao.
Nao se afirma que os 48.36GB brutos foram copiados ao Codespace nem que ele
possui acesso SSH direto a VPS. Recuperacao de arquivos nao e restore/teste de
banco SQL, nem valida identidades, regras fiscais ou persistencia do ERP.

Primeira tentativa de leitura durante upload incompleto foi bloqueada por
integridade (PRIMARY_CIPHER_INVALID), sem extracao; apos concluir o upload,
verificacao integral PASS. Nao se contornou a protecao. Dados/chaves nao foram
colados no terminal, registrados em relatorios publicos ou enviados ao Git.

### Continuidade e gates

Sem importacao operacional, migrations, deploy, merge ou novas cobrancas.
Agendamento Continuar legado ERP Zuccaro continua PAUSED.
Proximo pacote: reconciliar procedencia, identidade canonica, empresa/grupo,
IDs e vinculos do piloto no staging isolado usando o importador existente.
Piloto permanece PREPARED_NOT_AUTHORIZED: transferir e recuperar arquivos NAO
autoriza executar carga. Pendencias de homologacao de banco continuam separadas.

Publicacao exclusivamente documental e sanitizada; runtime do ERP inalterado.
Nao repetir suites de aplicacao inalteradas nem tratar CI de docs como prova de
importacao. Recibos detalhados, manifests, checkpoints e comandos de recuperacao
continuam privados no destino e na estacao autorizada.

## HISTORICO #344 - centralizacao privada EM EXECUCAO, staging recuperado (2026-10-23)

Esta execucao NAO foi somente diagnostico. O coordenador ERP ZUCCARO -
CODEX/CURSOR usa SSH/SFTP ja configurados na estacao com HD; nenhum segredo
exposto, chave SSH copiada, login repetido ou permissao de conta ampliada.
Codigo do ERP continua no Codespace unico; nenhuma frente de implementacao
paralela foi aberta. Original, worktrees e captura de codigo intocados.

### Conjunto e resultados efetivamente comprovados

Conjunto selecionado: copia original, bases SQL de trabalho, extracoes/staging,
mapeamentos/manifests/checkpoints, relatorios privados, quarentena preservada
sem executar binarios e snapshot do importador com proveniencia. Alvo2836arquivos,
48359509373bytes de origem. Instaladores5arquivos/1475316551bytes ficaram fora
do conjunto de migracao, preservados no HD. A validacao historica do original
registrava1857arquivos/21102245906bytes; contagem/tamanho atuais coincidem.
Isso nao substitui a nova verificacao SHA256 da copia remota.

CONCLUIDO e recuperado na VPS: staging913arquivos/287977635bytes, incluindo
extracoes, relatorios e mapeamentos existentes; snapshot de codigo5arquivos/
64739bytes. Total918arquivos/288042374bytes verificados por tamanho e SHA256.
Onze arquivos foram reutilizados das copias privadas preexistentes, sem
duplicacao. Fonte/copia SQL antiga, staging parcial e backup operacional do ERP
novo permanecem categorias distintas; nao se inferiu equivalencia por nome.

Verificacao remota leu os arquivos recuperados do arquivo cifrado e comparou
TODOS os hashes do lote, conferiu referencias reutilizadas e materializou uma
amostra privada de recuperacao. Nao abriu registros em chat/log nem executou
importador, SQL, binario legado ou operacao de negocio. Proveniencia do
importador: baseef4b14f2c8aa94ceed07a867905b50ef378c7e38, fontes pendentes
preservadas com diff e hashes; referencia publicada antes deste lotef38202d5.
Nao e clone independente de uma worktree nem nova versao do ERP.

Original1857arquivos/21102245906bytes: hashes de origem computados; envio ainda
EM EXECUCAO. Checkpoint13:49 BRT:10blocos cifrados/671088990bytes ja conferidos
no destino,290referencias reutilizaveis identificadas. Esses bytes sao de
blocos comprimidos/cifrados, NAO equivalem a backup original concluido.
Bases SQL21arquivos/26964656868bytes e quarentena40arquivos/4564225bytes seguem
na fila sequencial. Conclusao somente com manifest final e recuperacao integral
de cada lote, nunca pelo inicio do processo. Consultar checkpoints PRIVADOS
para progresso posterior; esta secao e recibo datado, nao monitor ao vivo.

### Destino, protecao e retomada

Destino: /root/erp-private/centralizacao-legado-20261023, fora aplicacao,
repositorio, build e diretorios publicos; root:root700. Chaves DE DADOS por lote
em diretorio separado root700/arquivos600, nao chaves SSH pessoais. AES256GCM
com nonce por objeto e autenticacao; transporte SSH com hostkey estrita.
Chave e cifrado estao no mesmo host sob controle root: nao se afirma HSM,
criptografia de disco ou protecao contra administrador/provedor desse host.
Recuperacao com essas chaves foi comprovada no staging. Sem cobranca nova.

Capacidade inicial83992358912bytes livres; alvo bruto48.36GB, compressao e reuso
diminuem ocupacao. Manter folga durante a fila; nunca apagar backups existentes
para abrir espaco. Nenhuma copia integral foi duplicada por conveniencia.

Processo Windows em segundo plano, oculto, com checkpoints atomicos e lock de
um worker, sem agendamento novo. Blocos64MiB; SFTP put inicial e reput apenas
quando parcial existe, seguido de tamanho/SHA256 antes da promocao do objeto.
Teste sintetico de retomada32KiB->128KiB e SHA256 PASS; AESGCM roundtrip,
rejeicao de adulteracao e replay deterministico PASS. Primeira tentativa reput
sem arquivo remoto falhou, corrigida sem descartar fonte/checkpoint. Reuso
tambem referencia lotes anteriores verificados, evitando reenviar bytes iguais.

Checkpoint detalhado local e espelho CIFRADO na VPS registram objetos/ordem/
referencias. Retomar SOMENTE o helper privado existente transfer-private.mjs
--all na estacao habilitada; lock recusa worker simultaneo. Nao matar processos
de terceiros nem iniciar outro pipeline. Sem HD a recuperacao dos lotes ja
verificados ocorre no host privado; a copia integral pendente ainda depende da
continuidade desse job. Agendamento Continuar legado ERP Zuccaro continua PAUSED.

Ferramentas auxiliares PRIVADAS, nao outro importador, preservadas na estacao e
no destino; inventarios/mapeamentos/fontes canonicas reutilizados:
- transfer-private.mjs SHA256c9e58be6d894615bdb423b8873d092e0f9f02810c868fde95e6257e92974b806
- remote-recovery.py SHA256065b87dae6e17699c4bd3cc4fdc608f47caee261a72e5af40b048f1e05a3c3df
- checkpoint-mirror.mjs SHA256718b8ec2a56bf3c97ca0bc49e57ef84eab730f1cd5f46bdaf1d5ba88962da12f
- codespace-recovery.mjs SHA2560409face2669dc1220b52e36f349bfe6adcf8a03963812ac043cb2041d554968
Manifestos detalhados, hashes vinculaveis a dados, nomes reais e chaves ficam
PRIVADOS. Os hashes acima sao somente dos scripts auxiliares, nao dos dados.

### Acesso do proximo executor: bloqueio concreto, nao presumido

A recuperacao na VPS foi executada e comprovada por este coordenador usando o
canal SSH existente. Isso NAO comprova acesso do Codespace aos dados.
Codespace possui pasta privada fora checkout/build, ownerUID1000/modo700 e
16807477248bytes livres no preparo. Lote cifrado foi obtido DE VOLTA da VPS,
com hash conferido, para provar a origem da futura copia de trabalho.

Upload pelo Explorer web, dentro da pasta privada inbound, falhou ANTES de
enviar arquivos: extensao Chrome exige Allow access to file URLs. Nenhuma
permissao ampliada ou contorno executado; inbound permaneceu vazio.
Intervencao: titular pode fazer upload manual dos artefatos indicados no recibo
privado para a pasta inbound, ou habilitar conscientemente essa opcao em
chrome://extensions > ChatGPT > Detalhes. Chave exclusiva de DADOS do lote,
nao chave SSH pessoal; nunca colar seu valor no chat. Depois executar o helper
de recuperacao no terminal, conferir913arquivos/tamanho/SHA e manter600/700.
Ate essa prova, Codespace/Cursor NAO declarados habilitados para dados reais.

VPS transferindo normalmente: nao houve motivo para duplicar o conjunto no
Drive. Buscas anteriores metadata-only sem pasta pertinente nao comprovam
capacidade/ACL de destino Drive. Sem links publicos ou upload para GitHub/CI.

Proxima etapa: concluir/verificar original e bases de trabalho; resolver o
upload controlado e comprovar recuperacao no executor seguinte. Depois validar
origem/IDs/vinculos e reconciliacao do lote piloto isolado pelo importador
canonico, sem deduzir empresa por palpite. Piloto PREPARED_NOT_AUTHORIZED,
sem banco operacional, migrations, merge, deploy ou mudanca fiscal.
Lote Git somente documental: diff-check/allowlist/sanitizacao, sem repetir
suites de aplicacao cujo runtime nao mudou. CI deste SHA registrada na344.

### Historico preservado: precheck e entregas anteriores

## Coordenacao local retomada e precheck privado #344 (2026-10-23)

Por decisao posterior do proprietario, o chat existente ERP ZUCCARO -
CODEX/CURSOR volta a coordenar. Isso substitui a atribuicao anterior ao chat
Nuvem; nao altera o Codespace unico nem cria escritor concorrente. Codigo e
testes continuam em /workspaces/ERP-Zuccaro-codeX, no Codespace
potential-xylophone-5gj7r9v9qqg637vxp, branch codex/consolidacao-infra-20261017.
Base local/remota conferida7615691a3e78e5536d24f17d5f0c9b41bab8c94e, PR342
sobre334, checkout limpo antes do lote. Terminal WEB autenticado e operante.
A UI da extensao Codex informa que nao iniciou; isso nao bloqueia esse terminal.
Publicar uma issue nao encaminha automaticamente instrucao ao agente.

### Escritor, preservacao e escopo

Ultimo recibo347 fecha o pacote e libera reserva. Frente Nuvem estava idle.
Precheck local ao Codespace nao encontrou index.lock, processo codex exec ou
descritor de escrita aberto no checkout; apenas app-server fora dele.
Sao observacoes pontuais, nao exclusao tecnica de acesso futuro. Nao encerrar
esse servidor nem processos de terceiros. Reserva desta execucao registrada na
issue344: SOMENTE HANDOFF e STATUS, um escritor por vez, parar se HEAD/status
mudarem inesperadamente. Base dos dois documentos, diff e hashes preservados
fora do checkout antes da edicao. Nenhum dirty anterior para descartar.

### Copias privadas: metadados primeiro, sem transferencia

A estacao voltou a comprovar SSH com autenticacao e hostkey existentes; nenhuma
chave ou segredo lido, copiado ou trocado. O original no HD esta presente e recebeu
apenas leitura de metadados: oito diretorios imediatos. Captura privada de
preservacao existente e seu manifesto tambem localizados. Essa captura preserva
codigo/Git/worktrees: NAO equivale a backup integral dos dados do ERP antigo.
Nao foi reexecutada varredura/hash do original nem aberto seu conteudo.

Na VPS, df do filesystem mostrou83992498176bytes disponiveis naquele instante,
compartilhados com servicos existentes, nao reserva de capacidade. Area privada
existente root:root700 ocupa3098460160bytes. Quatro candidatos historicos
inspecionados por metadados:142635008/23195648/8192/589824bytes alocados;
6/12/1/4arquivos ate profundidade2, respectivamente. Ha um candidato de
manifesto no segundo e um formato de backup no quarto. Tamanho/nome/extensao
nao provam origem, completude ou equivalencia. Backups operacionais separados
ocupam69455872bytes e nao devem ser confundidos com copia do ERP antigo.
Caminhos reais e eventuais nomes vinculaveis permanecem privados.

Destinos propostos de staging ainda ausentes. Nenhuma pasta criada, permissao
alterada, transferencia, duplicacao, extracao ou importacao. Reutilizar primeiro
os inventarios/manifestos existentes; falta vincular manifesto de origem e de
cada candidato com cobertura/versao e igualdade verificadas, sem presumir que
todos sao dados reais ou todos sao fixtures. Criptografia, recuperacao, retencao,
ACL e folga de capacidade continuam gates antes de transferir. Original intocado.

Conector Drive respondeu com sucesso a buscas de PASTAS por BACKUP ERP ANTIGO,
ERP Zuccaro e legado, metadata-only, sem resultados pertinentes. Isso comprova
a disponibilidade da busca, NAO acesso a uma pasta de backup, capacidade livre,
privacidade/ACL, ausencia de outros arquivos ou integridade. Nenhum download,
upload, link publico, compartilhamento ou pasta Git no Drive. Sem identificador
de pasta pertinente, nao ampliar a busca a documentos pessoais sem necessidade.

### Continuidade e validacao

345 Produto,346 sessao de Orcamento,348 leitura/relatorios seguros e347 proposta
navegavel permanecem publicados; nao refazer nem atribuir novos testes a eles.
Aprovacao visual de347 ainda necessaria antes de adocao ampla. Layout azul-claro,
codigos sequenciais backend/IDs/importados, RBAC/multiempresa/auditoria e
proveniencia comercial-financeira separada de regras fiscais preservados.
344/349 recuperacao real seguem separadas, nao comprovadas por esta inspecao.
Proximo passo344: reconciliar evidencias privadas existentes de origem/candidatos
antes de calcular faltantes; nao copiar um backup inteiro por conveniencia.

Lote somente documental: diff-check, allowlist dos dois arquivos e revisao de
sanitizacao; nenhuma suite runtime inalterada repetida. Resultado de commit/CI
sera registrado na issue344, sem inferir CI nova dos recibos anteriores. Nenhum
codigo funcional alterado. Custos bloqueados, agendamento Legado PAUSED,
Codespace unico, sem merge/deploy/migration operacional/carga real.

### Historico preservado: proposta347 e pacotes anteriores

## #347 — proposta Comercial navegável e defeito de diálogo corrigido (2026-10-23)

Executor único potential-xylophone-5gj7r9v9qqg637vxp, mesma branch PR342 sobre334,
base0409d3f721634218950876cf7389c79be0478647 local/remoto e checkout limpo no aceite347.
Esse SHA348 tem ambas CIs SUCCESS:39969540650/39969548181; resultado registrado na348.
Produto/SEO/conversões/IDs e persistência Comercial preservados.

Proposta DEV opt-in implementada no Comercial/OrcamentosTab EXISTENTES:
`/Comercial?proposta=comercial360` → Orçamentos → Novo orçamento. Editar cliente,
produto/quantidade/preço, condição/tabela e observação; alternar Cliente e histórico,
Produtos e disponibilidade, Resumo e pagamento e retornar. O estado é o MESMO
rascunho do editor. Azul-claro, painéis lado a lado no desktop/empilhados e roláveis
no tablet, rodapé acessível. Não é reprodução fiel comprovada de screenshot histórico:
é proposta para APROVAÇÃO VISUAL, sem alterar amplamente o layout padrão.

Reuso: seletores/pickers, cálculo decimal, campos e callbacks atuais; nenhum
ComercialV2 ou persistência paralela. OrcamentoProposalAside é extração somente
apresentacional para a nova composição, sem equivalente composto existente;
comercialProposalFixture fornece objetos claramente SINTÉTICOS em memória, fora
do store/cache operacional. Sem reserva de IDs/códigos, autenticação alternativa,
consulta de negócio, gravação, conversão, estoque ou cobrança da proposta. Guards
negam save/cancel/convert também pelo callback. Fluxo normal continua usando
servidor/snapshots/permissões anteriores; modo só é exposto pelo Comercial em DEV.
Histórico/disponibilidade/preços da proposta são ilustrativos, não registros recuperados.

Defeito funcional comprovado no navegador: WindowModal(~100 milhões) interceptava
clique no DialogContent(z50), tornando o editor inacessível. Dialog existente recebe
overlayStyle OPCIONAL; Orçamento em windowMode aplica camada ao diálogo/overlay
acima da janela e abaixo dos Selects, sem mudar defaults dos demais consumidores.
Depois, cliques reais em seletores/painéis funcionaram, sem force-click.

Prévia PRIVATE confirmada pelo CLI Codespaces, porta5173; Vite rejeitava Host
encaminhado(403), agora allowlist EXATA do hostname derivado de CODESPACE_NAME,
sem wildcard/liberação pública. `/__erp_preview` DEV informa somente SHA, branch e
dirty boolean com no-store; erro Git sanitizado503. Nenhum nome de arquivo/segredo.
URL: https://potential-xylophone-5gj7r9v9qqg637vxp-5173.app.github.dev/Comercial?proposta=comercial360
Requer autenticação GitHub do Codespace. Processo DEV iniciado por este executor
permanece para revisão; nenhum processo de terceiro interrompido. Custo adicional
zero, sem outro ambiente. Tooling de navegador/bibliotecas somente em /tmp, sem
alterar dependências do projeto, pacotes/permissões do SO ou conectores.

Browser real, contexto NOVO e conexões externas bloqueadas:1440×1000/1024×900;
cliente/produto/condição/tabela, quantidade2×10=20, observação e troca/retorno de
painéis preservados, save desabilitado,0 requisições de escrita,0 conexões externas,
0 erros JS, diálogo dentro do viewport. Script reproduzível existente no lote:
`node scripts/comercial360-preview-smoke.mjs /caminho/playwright/index.mjs /tmp/evidencias`.
Capturas e evidência sanitizada em docs/evidence/comercial360-proposta-*-20261023.
Não leu sessão, storage ou registros de navegador existente; não é homologação operacional.

Foco26 PASS/0 FAIL/0 SKIP, exit0. Suíte geral FINAL2232 PASS/0 FAIL/0 SKIP,
exit0 comprovado também por arquivo de saída e processo isolado. Audit:baseline,
lint, typecheck, build e diff-check exit0; um warning de lint anterior.
SHA/CI desta publicação registrados na347, proveniência viva no endpoint DEV. Primeiro processo geral contou2232 PASS,
mas retornou143; não foi aceito como check verde. Repetição isolada final exit0.
Asserção estática de dependências exige agora também proposalMode, sem retirar
Grupo/Empresa/ator/sessão; troca de modo invalida callbacks e cache. Sem baseline
ou regra de validação relaxada. Status/limites anteriores348 seguem no histórico.

Pendente humano: aprovação visual expressa antes de adoção ampla. Recuperação de
registros ERP NOVO e legado ERP ANTIGO344 continuam SEPARADAS e NÃO EXECUTADAS.
Vínculo seguro faltante já identificado, sem repetir tentativa: canal SSH/SFTP deste
runtime com identidade previamente autorizada e destinos/fontes privados documentados
(Runtime Secrets ERP_DEV_VPS_SSH_PRIVATE_KEY/ERP_DEV_VPS_SSH_USER ou agente existente).
Não gerar chave, pedir segredo no chat, abrir dump/banco/backups ou inventar dados.
Sem fonte/identidade/procedência não há reconciliação real em staging, transferência
ou importação. Demais capacidades amplas do ERP não foram declaradas recuperadas.
PAUSED e gates de implantação/carga mantidos. Retomar itens concretos independentes
quando houver escopo/acesso liberado; nenhum escritor concorrente criado.

## #348 — contrato de leitura e recuperação dos relatórios (2026-10-23)

Codespace único potential-xylophone-5gj7r9v9qqg637vxp, base fa720fea,
branch codex/consolidacao-infra-20261017 / PR342 sobre334. Alterações anteriores
preservadas; Produto e Orçamento346 não modificados. ACEITO348 registrado.

Causa: catálogo simples/bulk/by-ID/contagem aceitavam leitura privilegiada sem
RBAC e pertença comprovados. Contraprova no handler fa720fea: filtro vazio sem
permissão e empresa de terceiro responderam200, uma consulta cada. Agora os
três handlers reutilizam entityGuardPolicy e evaluateMfaScopeAccess, com perfil
e vínculos autenticados, predicado obrigatório AND, pré-autorização do lote,
projeção recursiva, rejeição de filtros sensíveis e ordenação autorizada. Não há
fallback global/legado sem dono. Catálogos compartilhados exigem vínculo explícito.

Extração necessária: não havia autorizador backend comum aos três leitores.
entityReadPolicy concentra essa política; csv.js compartilha o serializador
seguro já consumido por exportUtils. useSecureReport concentra contrato/schema,
cache por ator/sessão/escopo/permissões, revogação e descarte de respostas tardias;
não cria endpoint, entidade ou relatório paralelo. Duas anotações de tipos na
policy MFA existente preservam integralmente seu runtime.

Relatorios.jsx reintegra DashboardRepresentantes e RelatorioPersonalizado,
sem remover abas. Restauração inicial evita consultas legadas na nova aba.
Representantes entrega agregado completo limitado: >=500 registros em qualquer
fonte bloqueia409, nunca total parcial; comissão é estimativa pelos fatores
existentes e exige grant próprio. Personalizado pagina50, informa cobertura de
página/total desconhecido, agrupa apenas a página e exporta TODO o filtro até5000;
excesso bloqueia sem arquivo parcial. Excel permanece CSV compatível, identificado.
Exportação reautoriza ator/fontes/campos, neutraliza fórmulas, audita somente
metadados e bloqueia download se a auditoria falhar. Lock local evita duplo clique;
não é transação/snapshot temporal nem idempotência persistente do provedor.

Validação: foco final56 PASS/0 FAIL/0 SKIP (29 casos348 +27 contratos de fronteira).
Suíte geral2225 PASS/0 FAIL/0 SKIP, exit0; endurecimento final de inferência por
filtro/ordenação também comprovado no foco56. Primeira geral2223 PASS/1 FAIL:
hash histórico congelava toda Relatorios. Hash ORIGINAL mantido; somente hunks
exatos348 são invertidos para comparar restante, com negativas contra hunk
faltante/duplicado e alteração externa. Nenhum baseline/hash/config relaxado.
Audit:baseline, lint, typecheck, build e diff-check exit0; lint conserva warning
anterior EntregasListagem170. Typecheck semântico adicional da policy backend exit0.
Uma execução intermediária de lint terminou143; repetição final exit0. Erros de
tipagem detectados nas projeções primitivas foram corrigidos antes do fechamento.

Limite operacional explícito: contrato testado nos handlers e componentes REAIS
com SDK fixture sintética, sem rede/dados reais. Requer runtime remoto com esses
handlers; HTTP/local não possuem adaptador equivalente e exibem indisponibilidade,
sem fallback. Sem deploy/migration, recuperação de registros ou homologação visual
inferida. Outros relatórios legados não foram rehomologados por este lote.
Publicação corresponde ao commit desta seção; SHA remoto/CI serão registrados
na issue348. Próximo autorizado347: proposta privada nos componentes existentes,
com gate de aprovação visual antes de alteração ampla. Legado344 sem canal privado
já documentado; nenhum novo inventário, transferência ou importação. PAUSED mantido.

## #346 — ações de Orçamento vinculadas à sessão (2026-10-23)

Nova ordem346→348→347 recebida/ACEITO na issue346 pelo Codespace único
potential-xylophone-5gj7r9v9qqg637vxp, branch PR342, base312295c1 após FF
exclusivamente documental com checkout limpo. Produto04f644a1 não alterado.
Reserva: OrcamentosTab.jsx e teste comportamental existente + continuidade.

Defeito reproduzido: ações abertas não capturavam token, e consultas não incluíam
ator/sessão. Cinco cenários adicionados: antes8 PASS/4 FAIL (revogação total já
bloqueava); depois12 PASS/0 FAIL/0 SKIP. Editar/cancelar/converter capturados em
sessão anterior não chamam transporte; resposta tardia não fecha nem anuncia
sucesso. renderedScope passa a capturar sessão; geração opaca em memória separa
cache por sessão/remount, sem credenciais em queryKey; ator incluído nos mestres
e listagem. Troca de sessão invalida ações/formulários como troca de tenant.

Reutilizados gate de Orçamento e cliente HTTP existentes; serviços mantêm preço
servidor/snapshot, vínculo ClienteEmpresa, conversão idempotente, persistência,
auditoria e reabertura. Testes reais dos dois serviços Orçamento/Pedido (fixtures
sintéticas) aprovados:2 arquivos PASS, exit0; não confundir essa contagem com
casos internos. Layout, IDs e fluxos downstream preservados, sem novos serviços,
fatores, estoque/pagamento/fiscal simulados ou mudança backend neste pacote.
Interface implementada/testada no harness real; não é deploy/homologação visual.

Audit/lint/typecheck/build exit0; lint conserva um warning preexistente de
EntregasListagem170. Suíte completa final2197 PASS/0 FAIL/0 SKIP, exit0, pelo mecanismo suportado de
concessão Codex (EPERM conhecido), sem mudança de baseline/testes/SO para verde.
Primeira execução2196 PASS/1 FAIL: asserção estática exigia dependências antigas.
Expectativa fortalecida para incluir sessão, preservando cobertura tenant/ator;
policy9 PASS e repetição completa final aprovada, sem relaxar baseline/config.
Diff-check/sanitização PASS; SHA é o commit desta seção.
CI do SHA e retorno346 antes de passar à implementação348; nenhum writer extra.
Rollback por revert revisado. Dados reais privados, gates operacionais e PAUSED
mantidos. Próximo:348 agora autorizada a corrigir contrato (não repetir diagnóstico),
depois347 com preview privado e gate visual para redesign amplo.

## Ordem atual: ciclo comercial, contrato seguro e proposta privada (2026-10-23)

Base confirmada PR342:04f644a11ae360dcf9010697b87d0ec424f76698, branch codex/consolidacao-infra-20261017 sobre codex/comercial-composicao-20261017 (#334), aberta DRAFT. CI4454/run39955762072 e4455/run39955769075 completed/success. Recibo issue345#issuecomment-6365293796 confirma mesmo Codespace, HEAD local/remoto04f644a1 e checkout limpo naquele instante;2192 PASS/0 FAIL/0 SKIP, demais checks exit0. Produto345 CONCLUIDO, reserva liberada, nao refazer. Nao e inspecao direta atual do Codespace pela coordenacao nem prova de deploy/previa.

Proprietario autorizou sequencia de pacotes coesos346 ->348 ->347, ou itens independentes se dependencia tecnica concreta bloquear um deles. Corpos das TRES issues existentes atualizados com ordem completa/aceite/reservas, sem novo plano ou escritor. Execucao continua reservada ao MESMO agente no Codespace unico, um escritor; Cursor remoto nao comprovado. Antes de editar: novo ACEITO com host/SHA/status e paths exatos, preservar dirty/new/diff, reconciliar sem reset/force/stash silencioso. Dados reais/credenciais fora Git/checkout/build/log/CI, custo adicional zero.

346: cliente->preco->Orcamento->Pedido->reabertura, reproduzir lacunas e corrigir componentes/servicos canonicos. Fixtures de persistencia/snapshots/conversoes/duplo envio/falha de gravacao/permissoes/troca Grupo-Empresa/revogacao; nenhuma operacao financeira/fiscal real. Preservar IDs/auditoria/dono da persistencia e layout.

348: diagnostico35f1892b ja feito, nao repetir como unica entrega. Implementacao coesa do contrato canonico compartilhado de leitura AGORA explicitamente autorizada: tornar persistentes os dois cenarios (ator sem permissao com filtro vazio, empresa de terceiro), testar negacao com zero consultas privilegiadas/exports e positivos autorizados. Validar ator, acao e pertença Grupo/Empresa SERVER-SIDE antes asServiceRole; filtro/frontend nao autoriza. Mapear consumers single/bulk/catalogos, reutilizar guards/policies e nao criar caminho paralelo. Projecao de campos sensiveis, paginacao/completude/exportacao e auditoria fail-closed; limite500 nao e total. CSV/Excel contra formulas; cache por ator/sessao/escopo. Somente depois do contrato seguro comprovado, remontar relatorios atuais com testes comportamentais. Gate pendente nao permite expor abas inseguras; registrar dependencia especifica e seguir pacote independente.

347: continuar comparacao/prioridades ja mapeadas (sem repetir inventario), preparar previa privada autenticada no Codespace e entregar URL/SHA servido/roteiro navegavel Comercial integrado com rascunho preservado. Reusar processo seguro sem interromper terceiros, nao inventar backend seguro/preview. Redesign amplo depende aprovacao visual expressa do proprietario; outras frentes independentes continuam. Cadastros ERP novo e legado344 SEPARADOS, fontes e canais privados reais, nenhuma carga/recuperacao sem procedencia/reconciliacao. Legado sem canal atual/inventario privado, transferencias e gates operacionais nao executados; agendamentoPAUSED.

Recebimento: aceites345/348 anteriores comprovam tarefas anteriores, nao esta nova ordem. Nenhum novo aceite346/348/347 foi presumido. Esta conversa permanece sem Browser/ponte autenticada; tarefas prontas no GitHub NAO acionam automaticamente o agente. Necessaria retomada do executor existente para ler a ordem atual e publicar novo ACEITO/resultado. Coordenacao nao editou codigo no sandbox, nao iniciou testes runtime/servicos, nao instalou ferramentas ou repetiu login403.

Fechamento por pacote: testes proporcionais + checks Regra-Mae, evidencias anteriores so quando codigo correspondente nao mudou; commit coeso/push mesma branch, SHA remoto e CI exata, HANDOFF/STATUS/programa existentes e retorno na issue. Nao esperar proximo entre etapas autorizadas, nao confundir aprovado/publicado/testado no Codespace/implantado. Este registro e somente documental, diff-check/sanitizacao requeridos; CI desse commit documental e distinta da base04f644a1.

## #345 — prévia de conversões acompanha rascunho (2026-10-23)

Executor único Codespace potential-xylophone-5gj7r9v9qqg637vxp, branch PR342,
base35f1892b; ACEITO345 após gate348 bloqueado, sem writer paralelo. Causa
reproduzida em seis testes comportamentais: ProdutoForm mantém rascunho, mas
ProdutoFormCompleto enviava dadosIniciais à aba Conversões. Antes:11 PASS/6 FAIL;
após correção foco17 PASS/0 FAIL/0 SKIP, incluindo handlers reais do formulário,
calculadora/prévia, unidades e troca de aba (sem rede/IA/timers operacionais).

Reuso: callback opcional onConversionDraft informa somente fatores/unidades/
peso teórico ao wrapper, em useCadastroRecordState já existente e escopado por
registro/versão/Grupo/Empresa/ator. Callback antigo, revogação e envio pendente
não atualizam a projeção. Não há merge dessa projeção no payload; o formulário
continua dono do rascunho geral e V24 dono do salvamento/auditoria. SEO/slug
mantêm patch próprio e um único envio. Cancelar não grava; salvar/reabrir mantém
fatores, IDs e vínculos. Conversor990e6c9a intacto, sem fator inventado.

ProdutoForm grande recebeu só callback/efeito de projeção; inicializador,
handlers, validação, permissões e payload preservados. Extração ampla seria
ruidosa e fora desta dependência; nenhum novo componente/hook/entidade criado.
Testes reaproveitam harness comportamental de SEO, agora também executando o
formulário geral e a aba reais. Não são homologação visual nem banco operacional.
Rollback: revert revisado do lote. Dados reais, auth/backend, deploy/migrations,
recuperação de registros e agendamento PAUSED inalterados.

Validação final345: suíte completa2192 PASS/0 FAIL/0 SKIP, exit0 (383443ms),
incluindo os seis casos novos; foco17 PASS/0 FAIL/0 SKIP e quatro arquivos
Produto/SEO/conversões/PIM/tipo aprovados. Audit/lint/typecheck/build exit0;
lint mantém um warning preexistente em EntregasListagem.jsx:170; build com
avisos usuais de chunks. Diff-check/sanitização PASS. Concessão Codex suportada
nos subprocessos já diagnosticados, sem alterar SO/testes/baseline para obter verde.
Mudança de código justifica nova suíte completa; checks anteriores não foram
apresentados como validação deste delta. Código/teste da prévia renderizada
foi executado nesta suíte final (seis casos encontrados no log completo).
SHA é o commit que introduz esta seção; push/CI exata conferidos na issue345
antes da entrega. Nenhum resultado CI da base foi atribuído ao novo commit.
Próximo gate: fechar345;348 permanece BLOCKED pelo contrato backend de relatórios.
346/347 preservados na fila, sem reserva de escrita ou redesign amplo.

## #348 — gate de Relatórios bloqueado; sequência #345 liberada (2026-10-23)

Executor único Codespace potential-xylophone-5gj7r9v9qqg637vxp, base3f972e4c,
branch PR342. AGENTS/Regra-Mãe/HANDOFF/fila lidos; FF de três commits somente
MD com checkout limpo. Nenhum pacote anterior aberto. ACEITO registrado na348.
Busca de consumidores confirmou DashboardRepresentantes apenas importado sem
montagem e RelatorioPersonalizado sem consumidor; sem caminho equivalente.

Gate ANTES de expor falhou em prova comportamental sintética do handler REAL
base44/functions/entityListSorted/entry.ts, transpilado sem rede com SDK fixture:
ator sem permissões de relatório, com filtro vazio ou empresa de terceiro,
recebe HTTP200 e consulta asServiceRole. Dois cenários confirmados, comando
Node exit0 (diagnóstico de ausência de negação, NÃO teste de segurança aprovado).
listOne não autoriza o ator por empresa/ação; Representante é SIMPLE_CATALOG.
Não executar contra serviço remoto nem dados reais. Backend HTTP não oferece
contrato específico de relatório com projeção/agregação/exportação autorizadas.
Os componentes também usam fallback de permissão geral, cache sem ator/sessão,
leitura limitada (backend máximo500) como total, custo/crédito/comissão e CSV sem
neutralização de fórmulas; captura de auditoria não bloqueia exportação na falha.

BLOCKED348 pelo contrato real de autorização/consulta/exportação segura, conforme
item4 da issue: não basta remontar abas nem copiar a referência insegura.
Nenhuma aba exposta, recurso removido ou registro recuperado. Próxima dependência:
evoluir camada canônica de leitura/exportação com autorização de ator, Grupo/
Empresa, projeção por campo e completude comprovável antes de ativar capacidades.
Esse gate envolve contrato compartilhado e não é contornado por filtros frontend.
Sem alteração runtime neste diagnóstico; diff-check/sanitização são os checks do
lote documental, suites2186 já aprovadas não repetidas. Código348 não concluído.
Liberada reserva dos componentes Relatórios; prosseguir345 no mesmo checkout,
sem escritor paralelo, dados reais, deploy, migration ou ativação operacional.

## Comparacao ERP inteiro com referencia indicada pelo proprietario (2026-10-23)

Referencia erp-integra-novo main37c6f7d39e60736cbb862d122de9be23c06db8f6 conferida; candidata c9f1c71c31526dd1d9795627f2fbc5cd985793ff, CI4448/4449 SUCCESS. Comparacao completa dos inventarios de codigo:953 versus1426 arquivos;99 blobs iguais,456 paths alterados,398 exclusivos referencia,871 exclusivos candidata; paginas25 versus46. Leitura60 arquivos, incluindo todas as25 entradas referencia e22 homonimas candidata. Nao equivale a auditoria de cada botao/fluxo nem a prova de funcionamento. Matriz de25 entradas e classes/prioridades integradas ao programa existente, issue347 ampliada, sem novo plano.

Achado concreto: abas Representantes/Personalizado montadas na referencia, ausentes na pagina Relatorios atual apesar de componentes canonicos preservados. Issue348 publicada para recuperar com testes negativos/positivos RBAC/tenant/query/export/auditoria e reuso, sem nova entidade. Codigo nao editado no sandbox; AGUARDANDO ACEITE do mesmo agente Codespace, sem recebido automatico. Os3 paths exclusivos de paginas (Documentacao/EmpresaOnboarding/OAuthConsent) exigem equivalente/historico antes de alegar perda/restaurar.

Preservar melhorias atuais/Auth/RBAC/auditoria/tenant/persistencia/IDs/reservas backend; nao copiar admin local/fallback da referencia. Verificacao numeracao de TODOS cadastros permanece tarefa de cobertura, nao declarada aprovada por mapa frontend. Referencia local-imports tem3 arquivos17185563bytes por metadados; conteudo NAO ABERTO, origem/exposicao/completude nao classificadas. Fontes Base44/snapshot/localStorage/export sao candidatas, nao registros comprovados. Nenhuma recuperacao de dado real; ERP novo e legado344 separados. Dados reais/manifestos privados fora Git/log/CI; gates operacionais intactos.

Layout ERP inteiro e proposta azul-clara na347 exigem historico e aprovacao visual antes de mudanca ampla. Recebimento dos pacotes so por aceite explicito; sem Browser/ponte desta conversa. Nenhum teste runtime repetido por lote documental. Trabalho privado local preservado antes de publicar somente textos sanitizados.

## Tres frentes coordenadas e entrega por pacotes coesos (2026-10-23)

Ordem expressa do proprietario: esta conversa centraliza instrucoes; GitHub fonte oficial; mesmo Codespace codigo/testes; VPS separada para ERP/staging. Regra-Mae e programa existentes reutilizados, sem novo manual/ambiente. Base consolidada a08bf4c931ea89003d62eb6e0ef64d98bd2d6c69, PR342 aberta draft sobre334; CI4446/4447 completed/success conferidas. Conversoes990e6c9a permanece com CI4442/4443 success e2186/0/0 no recibo Codespace. Sem implantacao VPS alegada.

Estado remoto real do Codespace: ultimo recibo disponivel na343 confirma5dc5d6d9 e checkout limpo; ausencia de nova prova impede afirmar a08bf4c9 sincronizado ou nenhuma alteracao posterior. Antes de sincronizar, executor deve preservar dirty/new/diff e conferir remoto. Nao reset/force/stash silencioso. Previa privada ainda NAO COMPROVADA: sem URL/visibilidade privada/teste de acesso nem processo atual inspecionado; aba Ports ou editor aberto nao comprova aplicacao servida. Nao iniciar servidor no sandbox como substituto.

Frente1 (issue344 existente): operador proposto e estacao original com HD/SSH ja comprovados; falta aceite/acesso atual, sem tarefa disparada daqui. Reutilizar inventarios, mapeamentos e extracoes, verificar primeiro copias privadas na VPS e compara-las por abrangencia/manifestos privados; nao transferir backup completo redundante. Clientes/fornecedores/produtos primeiro; depois historicos/estoque/financeiro por dependencias. Compartilhar Grupo somente conforme modelo, nunca atribuir fiscal/saldo/titulo sem origem. Piloto isolado solicitado, condicionado a protecoes/integridade/recuperacao/acesso e isolamento comprovados; carga operacional continua sob gates proprios de backup destino/idempotencia/reversao/reconciliacao. Sem fonte/destino/canal, nenhuma execucao real. PAUSED mantido.

Frente2 (issue346): pacote funcional integrado cliente->preco efetivo->Orcamento->Pedido/reabertura, incluindo rastreabilidade de disponibilidade/reserva e referencias a producao/entrega/financeiro conforme contratos existentes. Executor proposto: mesmo Codex no Codespace, AGUARDANDO ACEITE. Propor reserva exata de Comercial/Central/navegacao/formularios existentes antes de editar; nao tocar Produto reservado345. Confrontar implementado/testado/visivel/implantado por consumidor do ciclo, corrigir lacuna reproduzida, sem reimplementar fluxo existente. Issue345 de rascunho/conversoes continua primeira tarefa localizada ja publicada, sem aceite novo no momento desta consulta. Nenhum pacote de codigo EM EXECUCAO comprovado.

Frente3 (issue347): proposta navegavel reutilizando Comercial.jsx/CentralCliente360Panel/ModuleLayout/ModuleTabs/ResizablePanel e forms existentes; cliente/historico/produtos/precos/disponibilidade/itens/totais/pagamento/acoes proximos, detalhes em abas/paineis com rascunho preservado. Pesquisar historico azul-claro antes de substituir; referencia visual ausente vira lacuna, nao desenho inventado. Recuperacao de registros auxiliares exige fonte confiavel/IDs, nao dados ficticios. Executor proposto: mesmo Codex, AGUARDANDO ACEITE; paths compartilhados com346 executam sequencialmente, nunca dois escritores no checkout. Cursor remoto nao comprovado: revisao por SHA somente, sem reserva de escrita.

Primeira acao do executor ao retomar fila: conferir host/SHA/status, comentar aceite/reservas, inspecionar processos/portas sem interromper terceiros e disponibilizar preview por encaminhamento PRIVATE autenticado do Codespace. Reusar servidor seguro existente; sem credenciais/dados operacionais/porta publica, sem parar processo alheio. Registrar SHA servido, acesso privado confirmado e limites de backend. Sem canal autenticado desta conversa ao executor, a coordenacao nao pode executar essa acao nem comprovar recebimento por simples issue. Nao repetir instalacoes/login403 por tentativa.

Proposta visual depende APROVACAO EXPRESSA do proprietario antes de alteracao ampla; enquanto isso avancam pacotes independentes autorizados sem conflito. Cada pacote: testes proporcionais/checks Regra-Mae, reaproveitar evidencias inalteradas, commit revisavel/push mesma branch, confirmar SHA/CI e retorno na issue. Instrucao publicada nao e acionamento automatico. Fila343 teve leitura/retorno comprovados, nao prova completa de implementacao iniciada pela issue. Issues345/346/347 aguardam recibo. Nenhuma transferencia/importacao/deploy, recurso pago ou mudanca de cobranca realizada nesta coordenacao.

## Entregas consolidadas e proximo pacote Onda1 (2026-10-23)

Conversoes Produto: publicado990e6c9a57aad0833fa1866a458488e5d4ab241c com seis arquivos; CI4442/run39941451623 e4443/run39941460941 completed/success conferidas pela coordenacao. HEAD documental posterior5dc5d6d9d3332120bf42cc0b7f49ba9fecb94e34: CI4444/run39941573717 e4445/run39941581179 completed/success. PR342 permanece aberta DRAFT, branch codex/consolidacao-infra-20261017 sobre codex/comercial-composicao-20261017, nao main. Publicacao nao e deploy VPS.

Codespace: recibos do executor em issue343#issuecomment-6363225662 e#issuecomment-6363243901 confirmam incorporacao FF documental, HEAD local/remoto5dc5d6d9 e checkout limpo naquele instante; reserva dos seis arquivos encerrada. Historico inclui preservacao em patch/stash relatada pelo executor, sem descarte; nao autoriza repetir stash silencioso. Nao houve nova inspecao direta do filesystem remoto pela coordenacao. Tests2186/0/0 sao evidencia daquele executor; nenhuma suite inalterada repetida aqui.

Fluxo GitHub: leitura/ACEITO/retorno do executor comprovados na343, encerrada apos evidencias finais. O commit funcional antecedeu a leitura da issue, portanto ciclo completo instrucao->nova implementacao->publicacao ainda nao demonstrado. Nao existe acionamento automatico comprovado; issue/Markdown/push nao e comando ao agente. Ferramentas desta conversa sem Browser/ponte autenticada. Proxima execucao depende do aceite visivel do mesmo agente na fila ativa.

Proximo pacote coeso: issue345 https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/issues/345 — previa de conversoes coerente com rascunho de Produto. Evidencia estatica: ProdutoFormCompleto passa dadosIniciais a aba, enquanto ProdutoForm conserva rascunho proprio. Gate obrigatorio: reproduzir o risco de previa obsoleta com handlers/componentes reais antes de corrigir; se nao reproduzir, nao implementar por suposicao. Reusar calculadora/estado e unico proprietario da persistencia, preservar SEO/gerais/layout/IDs/tenant/RBAC/auditoria. Escopo, reserva proposta, teste pre/pós-fix e aceite constam na issue. Estado AGUARDANDO ACEITE; nenhum escritor novo iniciado no sandbox ou Cursor. Codex no Codespace unico e executor proposto, reserva efetiva somente apos aceite/status.

Legado344: recebido/BLOQUEADO pelo executor: bindings SSH/SSH_AUTH_SOCK/config/identidades convencionais ausentes no Codespace. Inventario privado NOT RUN; existencia/abrangencia/integridade de copias VPS continuam desconhecidas, nao ausentes por inferencia. Nenhuma transferencia, copia publica, importacao operacional ou migrations045-049. PAUSED mantido; custo adicional zero, sem mudanca billing.

## Fluxo unico decidido pelo proprietario e fila GitHub (2026-10-23)

Nuvem ERP-Zuccaro-codeX centraliza instrucoes e decisoes nesta mesma conversa; GitHub e fonte oficial; Codespace potential-xylophone-5gj7r9v9qqg637vxp concentra codigo/testes; VPS Hostinger permanece separada para operacao e staging privado. Sem novo Codespace/clone independente/custo adicional, sem mudanca de cobranca.

Publicado agora: lote Conversoes Produto 990e6c9a57aad0833fa1866a458488e5d4ab241c, seis arquivos, descendente de a42cd686. Testado no Codespace segundo recibo do executor incorporado nesse commit: 2186 PASS/0 FAIL/0 SKIP, demais checks aprovados; nao execucao do sandbox coordenador, nao E2E visual nem implantacao VPS. CIs4442/4443 estavam in_progress na consulta, resultado final ainda necessario.

Responsabilidades/reservas: agente Codex ja conectado ao Codespace e unico escritor funcional. Reserva dos seis arquivos de Conversoes conforme issue343 ate aceite/fechamento explicito. Coordenacao apenas fila/continuidade sanitizada, sem editar codigo no sandbox. Antes de sincronizar, preservar dirty/new/diff e reconciliar secoes documentais; nunca sobrescrever trabalho. Cursor remoto nao comprovado, sem pacote de escrita atribuido; revisao cruzada somente por SHA ate comprovacao e reserva explicita.

Fila publicada: issue343 https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/issues/343 para fechar o lote e comprovar recebimento/retorno; issue344 https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/issues/344 para inventariar copias privadas existentes ANTES de transferir. Escopo, dependencias, aceite e gates constam nas issues, sem novo manual. Proximo pacote funcional: executor confirma lacuna real da Onda1/programa apos fechamento, reserva arquivos e publica escopo antes de editar; nao reconstruir SEO/conversoes concluidos nem inventar defeito sem reproducao.

Acionamento/retorno: workflow erp-runtime-ci.yml reage a push/pull_request para validar; nao possui consumidor de issues que inicie agente no Codespace. Ferramentas desta conversa continuam sem Browser/ponte autenticada. Issue/Markdown nao inicia execucao. Falta UMA instrucao inicial ao agente existente para ler/aceitar343 e consultar a fila entre lotes enquanto sua sessao estiver ativa. Nao equivale a agendamento/daemon nem garante retomada apos encerramento. Prova ponta a ponta ainda PARCIAL: instrucao GitHub publicada; aceite do executor e retorno na issue ausentes no momento do registro. A publicacao990e antecedeu a issue, logo nao prova causalidade.

Legado: issue344 bloqueada por canal atual ao filesystem privado/inventario HD, nao por falta de autorizacao. Reutilizar copias integras ou transferir somente faltantes apos gates; originais preservados, nenhum dado real/manifesto privado/chave em GitHub/CI/logs/checkout/builds. Nenhuma nova transferencia, deploy, migration045-049 ou importacao operacional realizada nesta coordenacao. Scheduler nao acessivel; decisao PAUSED mantida, sem reativacao.

## Comercial360 — conversões de Produto no Codespace (2026-10-22)

Executor único comprovado: `potential-xylophone-5gj7r9v9qqg637vxp`, checkout
`/workspaces/ERP-Zuccaro-codeX`, Node `v24.21.0`. Base local/remota
`4456137ffe2404baf9e10f6aceaa423972cf13a0`, árvore limpa antes da edição;
fetch da branch `codex/consolidacao-infra-20261017` sem avanço. PR342 draft
sobre a branch do PR334, ambos abertos. CI da base: runs39819591739 e39819600422,
frontend/backend/composição SUCCESS. SEO/slug publicado em5ab608e6 preservado;
seus testes executados novamente, sem reimplementação.

Próxima falha concreta reproduzida no componente existente `AbaConversoesProduto`:
TON→PÇ devolvia zero, fatores decimais em texto causavam TypeError e fatores
ausentes impediam abrir a aba. Reutilizado `CalculadoraUnidades.converterUnidade`,
já consumidor das vendas, removendo a fórmula local incompleta. Normalização
somente para exibição; equivalência sem fator válido mostra “Não disponível”.
Nenhum novo serviço/cadastro/escritor; fatores continuam no Produto persistido,
pelo salvamento/auditoria existentes. Sem mudança de tenant/RBAC/backend/HTTP.
Teste auxiliar novo necessário porque não havia teste comportamental desta aba:
`tests/produto-conversoes-preview.test.js`, fixtures sintéticas, reabertura e
imutabilidade. Três regressões FAIL antes / PASS depois; SEO/slug/PIM PASS.
Não é E2E visual ou homologação operacional. Rollback: revert revisado do lote.

Validação no mesmo runtime: audit:baseline exit0 já observado e reutilizado;
typecheck exit0; build exit0 (avisos de chunks); lint final exit0, 0 erros e
1 warning preexistente em EntregasListagem.jsx:170. Primeiro lint restrito foi
terminado143, sem alteração de regra. Suíte completa final:2186 PASS/0 FAIL/0 SKIP, exit0 (434044ms).
Prova Node spawnSync→git: no sandbox erro EPERM apesar de status0 e SHA correto;
fora dele, pela concessão oficial Codex require_escalated, exit0/sem erro.
Sandbox anuncia NoNewPrivs1/Seccomp2; syscall exata não exposta pela ferramenta,
não se atribui causa a uma syscall específica. Sem alteração de testes, SO ou
validações. Primeira suíte restrita:185 arquivos PASS/21 FAIL por restrições;
não equivale a contagem de casos. Uma repetição completa com concessão suportada.
Revisão final: TON→PÇ, KG↔MT, KG↔PÇ, TON→KG, decimais legados,
fatores ausentes/inválidos, reabertura e imutabilidade cobertos; sem novo fator,
nenhuma alteração da persistência ou do pacote SEO/slug. git diff --check exit0
e sanitização das adições PASS. Somente os seis arquivos deste lote publicados
pela mesma branch; SHA é o commit que introduz esta seção. CI nova pendente de
consulta após push; resultado será conferido no GitHub antes da entrega.

Fechamento em23/10: recebida ordem para concluir este lote antes das tarefas
GitHub. Remoto avançou apenas HANDOFF em a42cd686; ancestralidade confirmada,
FF documental seguro após preservar seis arquivos em stash e patch SHA256
42f911025b9b949e9bd69be7a0c04f2a30d332b3a4535f0344d3b0839cac1ced.
Reaplicação --index recusou somente o topo sobreposto, sem modificar a árvore;
cinco arquivos restaurados do patch e HANDOFF reconciliado por prefixos, ambas
as seções/histórico preservados. Stash mantido. Código/testes idênticos aos
validados; suites não repetidas por alteração exclusivamente documental.

VPS: runtime sem bindings `ERP_DEV_VPS_SSH_PRIVATE_KEY`/`ERP_DEV_VPS_SSH_USER`,
sem SSH_AUTH_SOCK, config SSH ou identidade convencional. Falta vincular ao MESMO
runtime o canal/identidade já autorizados por mecanismo seguro de secrets ou
agente encaminhado e destino/host confiável documentado; não reenviar chave no
chat, gerar identidade ou substituir authorized_keys. Inventário privado NOT RUN;
nenhuma conclusão sobre existência/ausência da cópia legada na VPS. Não houve
transferência, abertura de backup/banco/PII, instalação, merge, deploy, migration
operacional, cobrança ou novo Codespace. Agendamento permanece PAUSED.
Próximo gate: concluir este lote e validar CI do SHA publicado; não iniciar outro pacote;
legado depende do canal recuperado e dos seis gates privados antes de transferência.

## Coordenacao principal e solicitacao de canal remoto suportado (2026-10-23)

Decisao expressa do proprietario: ESTA MESMA conversa Nuvem ERP-Zuccaro-codeX permanece principal, com historico acessivel de qualquer computador. Codespace e ambiente de codigo/testes; GitHub e fonte oficial. Nao substituir por conversas locais independentes nem exigir encaminhamento manual recorrente. Orientacoes anteriores que recomendavam trocar o chat principal ficam superadas.

Limite comprovado nesta sessao: ferramentas expostas nao incluem Browser, ponte para a sessao Codex no VS Code ou endpoint autenticado do Codespace. O executor /workspace nao e /workspaces/ERP-Zuccaro-codeX. CLI com opcoes remotas nao comprova vinculo entre sessoes. A prova remota trazida pelo proprietario confirma o agente no Codespace, nao controle por este chat. Nao repetir OAuth/403, instalacoes ou reinicios sem mudanca comprovada de capacidade.

Publicacao pendente: proprietario encaminhou relato do lote Conversoes Produto com seis arquivos preservados e 2186 PASS/0 FAIL/0 SKIP, audit/lint/types/build/diff-check aprovados mediante concessao suportada naquele executor. Isso e relato recebido, nao execucao deste sandbox. Remoto conferido antes deste lote documental: 4456137ffe2404baf9e10f6aceaa423972cf13a0 com CI success; ainda sem commit do lote funcional. Nao reconstruir alteracoes ausentes nem iniciar outro escritor. Falta acesso autenticado ao checkout com trabalho aberto para concluir sua publicacao.

### Solicitacao objetiva ao suporte da plataforma (preparada, nao enviada)

Precisamos manter esta mesma conversa cloud, com historico e acesso entre computadores, como ponto unico de instrucoes, e vincular sua execucao ao Codespace EXISTENTE potential-xylophone-5gj7r9v9qqg637vxp, repo viniciuszuccaro-creator/ERP-Zuccaro-codeX, checkout /workspaces/ERP-Zuccaro-codeX. VS Code e Codex remoto ja executaram prova sintetica nesse recurso; esta sessao cloud nao expoe Browser nem ponte autenticada para aquele agente.

Informem se existe mecanismo OFICIAL para anexar este chat ao executor existente ou encaminhar tarefas/resultados de modo autenticado, preservando identidade/historico da conversa. Solicitamos procedimento e capacidades necessarias, incluindo autenticacao segura, escopo, revogacao, retomada entre computadores e limites de custo. Nao queremos novo chat/Codespace, terminal publico, API paga, transferencia de chaves pessoais ou instalacoes por tentativa. Se nao suportado, confirmem explicitamente essa limitacao do produto. Validacao exigida: solicitacao neste chat -> marcador sintetico criado/lido/removido fora do checkout no Codespace -> resultado retornado automaticamente a esta mesma conversa.

A solicitacao nao foi enviada: ferramenta de suporte ausente nesta sessao. Nenhum segredo deve acompanhar o chamado. Nenhum desenvolvimento concorrente, transferencia de legado, merge/deploy/migration ou alteracao de cobranca foi iniciado. Agendamento legado continua pausado conforme decisao vigente; estado do scheduler nao consultado.

## Recibo de execucao via terminal web do Codespace (2026-10-22)

Executor: ChatGPT Work, navegador autenticado do proprietario, terminal integrado web; nao e conexao direta Codex/Cursor.
Host: potential-xylophone-5gj7r9v9qqg637vxp; checkout /workspaces/ERP-Zuccaro-codeX; branch codex/consolidacao-infra-20261017.
Checkout inicialmente limpo em d425138ff9121d47c0a7ca8db49e6701630b5d29. Origin sanitizado github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX. Fetch e fast-forward para 9a53f66341cac865f55b5c7ad2a7c0aa0e5b8dbd concluidos sem reset/force; status limpo apos sincronizacao.
Marcador sintetico fora do checkout criado, lido e removido com verificacao de ausencia: PASS.
Testes nesta versao: node --test tests/produto-completo-ecommerce.test.js tests/produto-pim-ui.test.js tests/produto-http-policy.test.js; exit0, sem falhas/skips. Node observado v24.9.0, distinto do Node22 da homologacao anterior; nao atribuir esta execucao ao Node22. Log sintetico fora do checkout em /workspaces/erp-produto-web-20261022.log. Git diff --check PASS. Nenhum codigo funcional alterado.
Estacao Windows/HD e alias SSH nao disponiveis no terminal deste executor. Nenhuma transferencia real, precheck de fonte ou acesso VPS alegado. Gate impeditivo do legado: executor com acesso a origem privada e canal SSH/SFTP, seguido de validacao das protecoes existentes.
Acesso pelo terminal web comprovado; conexao direta do chat Nuvem/Codex/Cursor permanece separada. Autorizacao nao transfere cookies, chaves ou ferramentas entre chats. Agendamento mantido pausado. Sem merge/deploy/migration/carga.

## Pos-login: autenticacao concluida e limite Codespaces (2026-10-22)

Base52b5f7f7cb43aeb3e7c6e50c9809a14f1d57efe5, PR342 draft sobre334; API
confirmou CIs4434/run39807525230 e4435/run39807532238 completed/success no SHA.
Sandbox continua /workspace/ERP-Zuccaro-codeX, nao Codespace. O erro bwrap do
turno anterior nao ocorreu com a concessao atual somente de rede; nao repetir a
concessao por arquivo config.toml que causou o erro interno, nem desligar sandbox.

Proprietario concluiu login OFICIAL GitHub CLI pelo navegador. CLI confirmou
viniciuszuccaro-creator e exit0; sessao isolada fora checkout, diretorio0700 e
arquivo0600. CLI informou armazenamento em arquivo texto, nao keychain; nenhum
valor foi lido/exibido/copied para Git, logs ou chats. Nao usar o rascunho de
publicacao do ambiente para presumir backup/retencao dessas credenciais temporarias.
Autenticacao do Git/proxy original preservada; GH_TOKEN nao selecionado no
subprocesso dedicado, sem alterar proxy/TLS/NO_PROXY ou Git config do repositorio.

Diagnostico novo: GET /user funciona como User viniciuszuccaro-creator; GET do
repositorio publico funciona. GET /user/codespaces/NOME e GET /repos/OWNER/REPO/
codespaces retornam HTTP403 Resource not accessible by integration. gh auth status
reporta escopos none, sem codespace confirmado, apesar da solicitacao do fluxo.
Requisicao urllib padrao a /user SEM credencial fornecida tambem retorna200 e a
conta proprietaria: autenticacao automatica do caminho/proxy comprovada. Isso nao
prova onde ocorre substituicao do OAuth; nao afirmar que consentimento novo
removeu a restricao nem repetir login/refresh sem mudanca de capacidade. O dominio
api.github.com AGORA e alcancavel: a restricao atual e de autorizacao efetiva,
nao o antigo Forbidden de rede. Nenhum header ou token foi extraido para contorno.

Canal deste executor para Codespace BLOQUEADO antes de shell. Nao houve SSH,
marcador remoto, sync/testes remotos, preview, canal VPS ou transferencia real.
Nao habilitar chave/tunnel/API paga nem fabricar prova a partir de API/URL/editor.
A alternativa concreta e o canal autorizado no executor original/local ou IDE
remoto, fora desta rota cloud restrita, sem criar outro Codespace/clone/frente.

Recuperacao VPS existente: OPERACAO_DEV_VPS documenta secrets Runtime Cursor
ERP_DEV_VPS_SSH_PRIVATE_KEY/ERP_DEV_VPS_SSH_USER e SSH/Web Console. Historico no
programa/HANDOFF comprova somente leituras anteriores por WebConsole. Instrucao
do proprietario registra alias erp-zuccaro-vps na estacao original com HD; nao e
configuracao herdada. Neste executor bindings ausentes, sem SSH config/agente e
sem ferramentas VPS. Nenhuma consulta/mensagem ao chat ERP ZUCCARO - CODEX/CURSOR
e exposta; metadados locais sessions/index/daemon tambem ausentes. Nao alegar
leitura do chat, HD, inventario privado ou chave; nao repetir provisionamento.

Solicitacao UNICA preparada para a frente existente, sem envio automatico:

> No executor original que ja tinha acesso, recupere o canal autorizado VPS/SFTP
> erp-zuccaro-vps ou Web Console e o acesso ao MESMO Codespace
> potential-xylophone-5gj7r9v9qqg637vxp. Esta frente atual nao editara codigo em
> paralelo. Primeiro devolva somente recibo sanitizado do executor/host/ferramenta,
> acesso VPS somente leitura e prova pelo agente no Codespace (pwd/origin
> sanitizado/branch/SHA/status e marcador sintetico fora checkout criado/lido/
> removido). Indique o mecanismo seguro ja existente de reutilizacao do canal e
> a referencia do inventario/precheck privado do HD, sem valores de credenciais,
> dados reais ou reinicio de setup. Nao substituir authorized_keys, criar clone/
> recurso/chave, nem transferir antes de comprovar os seis gates privados.

Depois do recibo: um escritor, preservar dirty antes de sync do SHA publicado,
CodeSpace testar exatamente essa versao; reusar inventarios/mapeadores existentes
na estacao com HD RO e provar capacidade/destino/ACL/criptografia-recuperacao/
integridade-retomada/retencao antes do primeiro byte real. Sem carga operacional.
Cursor/preview privados dependem da conexao comprovada; nenhum link nao testado
foi anunciado. Agendamento nao reativado, nenhuma nova tarefa/frente foi criada.

Validacao deste registro: somente docs, diff-check/sanitizacao/continuidade; suites
runtime inalteradas nao repetidas. OAuth e comandos de consulta encerrados, sem
servico de teste iniciado. Marcadores anteriores preservados. CI nova deste push
so e resultado quando retornar; nao atribuir4435 ao SHA documental seguinte.

## Conexao Codespace/VPS - fechamento de capacidade (2026-10-22)

Base conferida67c002a4a3717658a4e6e75ee1589e138d663da3; branch consolidada/PR342
draft sobre334. CIs4432/run39800779724 e4433/run39800790073 AGORA SUCCESS, lidas
nesta retomada; supera o status geral In progress anotado no fechamento anterior.
Runtime5ab608e6 e raiz2183/0/0 permanecem provas anteriores, nao suites repetidas.

Unico escritor desta inspecao: sandbox /workspace/ERP-Zuccaro-codeX, NAO Codespace.
Handoff dirty271724bytes/hash preservado integralmente em arquivo privado antes
sem descarte; sufixo de registros unicos mantido byte a byte e fora do indice.
Novas conclusoes sanitizadas reconciliadas aqui e no roteiro EXISTENTE
[ABRIR_NO_OUTRO_COMPUTADOR.md](../ABRIR_NO_OUTRO_COMPUTADOR.md#conexao-do-agente-resultado-da-inspecao-e-acao-interativa-2026-10-22).
Nao foi substituido o handoff inteiro por outro host/branch nem lido chat externo.

Diagnostico terminal desta sessao: gh/ssh presentes, API Codespaces Forbidden em
api.github.com foraallowlist ativa; nenhuma prova de shell remoto. Nao ha chaves
publicas/config SSH/agente herdados e home/MCP config em filesystem ro. Help gh
informa geracao automatica de chave ausente; nao executar esse efeito como teste
cego. Codex --remote ws/wss/unix exige app-server existente e nao converte esta
tarefa cloud em Codespace; nao iniciado daemon/pareamento/tunnel. Binarios GUI
VS Code/Cursor e ferramentas de scheduler/VPS ausentes. Autorizacao ja existe;
nao ha pedido generico de permissao nem alegacao de acesso por URL/titulo.

Caminho principal suportado: no computador do proprietario VS Code desktop ->
Remote Explorer -> GitHub Codespaces -> Sign in to GitHub -> plug do MESMO recurso
potential-xylophone-5gj7r9v9qqg637vxp; Codex no IDE remoto -> Sign in with ChatGPT.
Acao interativa no cliente e indispensavel; este executor nao clica/login nele.
Roteiro publicado contem probe guardado de identidade/repositorio/branch/SHA e
write/read/delete sintetico FORA checkout. Sintaxe validada e guard negativo
comprovado aqui antes de qualquer escrita; positivo remoto NOT RUN. Sync e teste
focado do SHA final somente apos essa prova/preservacao de dirty, sem main/reset.

Cursor: suporte Codex IDE documentado no README OpenAI nao equivale a conexao
Codespaces. Cliente Cursor nao disponivel; Remote-SSH/gh --config e candidato a
validar no cliente com a mesma prova e um escritor. Nao declarar compatibilidade
real/instalacao de extensao Microsoft verificada. Alternativa VS Code concreta.

Rascunho do ambiente SALVO oficialmente: unico customdomain api.github.com,
presets mantidos, membership do checkout existente/SHA exato e start_skill seguro
sem autoDocker/migrations/seeds/servidores. install_script/segredos/cobranca nao
alterados. Antes constava main historica/start automatico; reconciliado somente
no rascunho. requires_publish=true: NAO aplicado/publicado/reconectado/restaurado.
Revisar/salvar/publicar ocorre na plataforma; publicacao cria snapshot/reconecta,
nao foi acionada por este lote. Preservacao local nao prova backup externo. Nao
usar reset/restore para destravar rede. IDE nao depende dessa publicacao antiga.

Hostinger: skills consultadas, mas nenhuma ferramenta VPS_* efetiva. Registro
MCP aqui bloqueado pelo filesystem ro; nao alterar privilegios nem improvisar
API/credencial. Cliente host precisa expor conector e seu OAuth Allow. Alternativa
precheck pelo console/SSH JA configurado na estacao autorizada. Nenhuma consulta
nova de capacidade, criacao de diretorio/ACL, criptografia ou transferencia VPS
foi executada. HD/SSH da estacao nao sao automaticamente acessiveis aqui.

Agendamento recebido como PAUSED. Nao existe ferramenta/diretorio de automacao
nesta sessao para ler/editar o prompt REAL: nao se declara scheduler atualizado.
Prompt substituto e precheck de retomada publicados NO documento legado existente;
nao criada nova automacao. Retomar so apos executor real e reserva unica, gates
privados e budget zero comprovados. Manualmente avancaram os itens acessiveis:
Git/CI, preservacao, diagnostico, rascunho e procedimentos/teste negativo do probe.

Validacao doc-only: diff-check, sanitizacao, links/rastreabilidade e diff somente
MD; codigo/dependencias/runtime inalterados, nenhuma suite antiga repetida.
Nenhum novo servico/teste remoto/recurso pago, dados reais, banco operacional,
merge/deploy ou045-049 executados. Resultado do novo push/CI somente apos retorno.

## Preparacao privada legado e fechamento deste lote (2026-10-22)

Runtime publicado por este lote: `5ab608e6dadb8ddc054747f45ede24f7ecafcca9` (commit anterior deste mesmo push).
Raiz2183/0/0 e checks locais PASS, conforme secao seguinte; este commit altera
somente documentacao e preserva a arvore src/server/locks. CI do HEAD final ainda
PENDENTE ate retorno real. Branch/PR342 sobre334 continuam, sem merge/deploy.

Atualizados os documentos EXISTENTES de descoberta e mapa legado com precedencia
da autorizacao posterior e seis gates: origem/capacidade, destino isolado, menor
privilegio, criptografia/recuperacao, integridade/retomada e retencao. Nenhum manual
paralelo, novo importador ou correspondencia por palpite. Precheck recebido nao
foi apresentado como consulta atual ou reserva de espaco. Origem/SSH da estacao
nao acessiveis aqui; transferencia BLOQUEADA ate evidencia atual dos seis gates
por executor autorizado com acesso existente. Nenhum arquivo real acessado.

Validacao doc-only: diff-check, sanitizacao, rastreabilidade e diff somenteMD;
suites runtime inalteradas nao repetidas. Agendamento PAUSED e piloto
PREPARED_NOT_AUTHORIZED,045-049 intactas. Conexao de agente ao Codespace segue
pendente: nao ha shell remoto comprovado para testar o SHA final nesse host.
Codigo e CI publicados nao equivalem a aceite operacional ou teste no Codespace.

## Continuidade Comercial360 - Produto SEO/slug (2026-10-22)

Execucao declarada: sandbox existente `/workspace/ERP-Zuccaro-codeX`, NAO
Codespace; base66b88c2b/PR342 draft sobre334, unico escritor deste lote. Remoto
HEAD66b88c2b e CI4431/run39795353934 SUCCESS conferidos nesta retomada. Handoff
publicado lido; dirty integral/diff/manifesto preservados fora do checkout antes
sem descarte. Evidencias locais brutas continuam privadas e nao entram no indice.

Duas causas: callback vazio da aba E-Commerce e classificacao incorreta de
ProdutoFormCompleto/ProdutoForm como self-managed no V24, que lhes passava apenas
fechar janela em vez de persistir. Corrigidos no fluxo existente. Produto V22
continua self-managed. O V24 permanece unico escritor/auditor dos formularios
callback; nenhuma gravacao foi adicionada a aba ou ao ProdutoFormCompleto.

Reutiliza useCadastroRecordState para patch transitório; apenas campos alterados
sao unidos ao payload dos Dados Gerais. Dados Gerais ficam montados/ocultos ao
trocar abas. Registro/versao/Grupo/Empresa/ator invalidam rascunho e callbacks
antigos; acesso revogado bloqueia envio capturado, envio pendente bloqueia duplo
clique. Falha comunica erro e conserva rascunho; cancelar nao grava. IDs/codigos/
vinculos/campos legados e layout preservados. Sem chamadas IA, publicacao externa,
ativacao Produto HTTP, migrations ou alteracao backend. Slug do master HTTP nao
foi inventado: este pacote e do formulario callback legado explicitamente citado.

V24 recebeu somente correcao cirurgica de ownership (dois nomes); nao se expandiu
refatoracao de arquivo grande, preservando todos os handlers/gates existentes.
Teste historico integral continua intacto e seu hash nao mudou: helper de resto
reverte UMA hunk exata/contada desta correcao para comparar os demais contratos.
Novos testes executam os handlers reais de input, wrapper e escritor/auditoria
V24 com portas sinteticas; nao sao E2E visual, banco operacional ou Codespace.

Validacao final neste sandbox: raiz2183PASS/0FAIL/0SKIP; foco37PASS/0FAIL/
0SKIP (11 casos novos de Produto e26 de preservacao), audit/lint/typecheck/build/
diff-check PASS. Primeira rodada intermediaria2180/2179PASS/1FAIL/0SKIP apontou
contrato historico de hash; teste original e hash foram preservados, helper de
resto exato/contado reconciliado e final completo repetido apos estabilizar codigo.
Sem alterar baseline/config/supressoes nem remover assercoes. Avisos preexistentes
de build (browsers/chunks) mantidos. CI nova ainda PENDENTE deste push. Receita Node22:
`npm run audit:baseline`; `npm test`; `npm run lint`; `npm run typecheck`;
`npm run build`; `git diff --check`, sequenciais, com dependencias existentes.
Backend/PG inalterados nao repetidos localmente; CI do SHA publicado e prova
separada. Concessao oficial de rede por turno obtida; nao alterou proxy/TLS ou
allowlist salva. Execucao no Codespace continua NAO comprovada por este executor.

Fluxo seguinte: confirmar SHA remoto/CI; no MESMO Codespace preservar dirty,
comparar refs e fazer FF somente seguro, validar EXATAMENTE esse SHA e parar
apos uso. Nao criar outro ambiente ou executar escritor concorrente. Rollback
por revert revisado deste lote; sem reset/force ou mexer em dados reais.

Legado: preparacao continua nos scripts/mapa existentes, sem transferencia.
HD/alias SSH da estacao nao acessiveis/comprovados neste executor; destino/ACL/
criptografia-recuperacao/retencao e tamanho+folga atuais continuam gates externos.
Agendamento PAUSED; piloto PREPARED_NOT_AUTHORIZED;045-049 foraexecucaoautomatica.

## Estado atual: coordenacao, decisoes preservadas e proximo lote (2026-10-22)

Coordenacao definitiva: chat existente **Nuvem ERP-Zuccaro-codeX**, por decisao
expressa do proprietario recebida neste chat. A troca do centro de conversa nao
exige converter o executor cloud em Codespace. Desenvolvimento/testes pertencem
ao UNICO Codespace existente; um escritor por checkout, sem frente local/Cursor
concorrente. Nao criar outro chat, ERP, Codespace ou recurso. Registros datados
abaixo sao historicos quando divergirem destas decisoes atuais.

Referencia documental deste lote: branch `codex/consolidacao-infra-20261017`,
base `d425138ff9121d47c0a7ca8db49e6701630b5d29`, PR342 draft sobre
`codex/comercial-composicao-20261017` (#334), nunca main antiga. Nao reiniciar o
programa nem iniciar Gate2 por sugestao superada. Prioridade: ambiente unico ->
Comercial360 integrado -> migracao legada coordenada. Fonte de execucao:
[programa existente](PROGRAMA_COMERCIAL_360_OMNICANAL_EXECUCAO_AUTONOMA.md),
[consolidacao](CONSOLIDACAO_INFRA_ETAPA1.md), [AGENTS](../AGENTS.md) e
[acesso](../ABRIR_NO_OUTRO_COMPUTADOR.md).

### Decisoes do proprietario que devem sobreviver aos lotes

| Decisao/requisito | Preservacao e limite de evidencia |
| --- | --- |
| Layout azul-claro APROVADO | Aprovacao informada pelo proprietario; preservar funcionalidades, recuperacao de registros e submodulos ausentes. Referencias historicas: `docs/vps/evidence/ref-visual-azul-aprovado-proprietario-20261009.txt` e `ref-visual-azul-financeiro-20261009.txt`. Essas referencias nao comprovam inventario visual completo do estado atual. Desenho aprovado e inventario de telas/submodulos ainda devem ser vinculados antes de mudancas amplas; nao inventar substituto. |
| Codigos NUMERICOS SEQUENCIAIS em TODOS os cadastros | Requisito transversal, nao afirmacao de cobertura ja concluida. Reserva concorrente no backend, nunca count+1 na UI. Conservar codigo importado, ID, vinculos e historico; colisao preserva origem e mapeamento, sem renumeracao silenciosa. AGENTS/Regra-Mae permanecem aplicaveis. |
| Comercial360 como experiencia unica | Integrar modulos donos dos dados, sem central/cadastro/importador paralelo. DESENHO APROVADO antes de mudancas amplas; layout aprovado, contexto multiempresa, RBAC e auditoria preservados. |
| Programa completo | Site, app, marketplaces, chatbots, telefonia, logistica, corte/dobra, CAD, fabricacao e montagem continuam previstos nas ondas existentes; este checkpoint nao elimina essas frentes nem as declara concluidas. |
| Historico legado comercial/financeiro | Preservar procedencia, IDs e vinculos; fatos historicos separados das regras fiscais atuais. Extrato e evidencia para conciliacao, nao origem automatica de titulos/baixas. Sugestoes IA, inclusive NCM/RNTRC, nao sao fonte oficial nem validacao fiscal/registro oficial; revisao manual obrigatoria. |
| Custos, autorizacoes e agentes | Codex/Cursor compartilham referencia e reservas; somente um escritor autorizado. Sem novas tarefas Cursor por este registro. Franquia/budget Codespaces e Actions sao controles separados; sem compra, API paga, recarga ou elevacao de gasto. Codigo/CI nao autorizam merge, deploy, migration operacional ou importacao real. |

### Autorizacao posterior de legado: substitui restricoes historicas mais estreitas

O proprietario autorizou **copia/transferencia privada controlada** para destino
VPS existente protegido, staging isolado e acesso a lotes minimos por
Codespace/Cursor sob protecoes comprovadas, sempre FORA do checkout e do Git.
O original permanece intocado/somente leitura. Esta e uma decisao relatada pelo
proprietario, nao prova de transferencia executada ou destino pronto.

Antes de qualquer transferencia: medir fonte e folga; confirmar destino privado
fora de publico/build/operacao; ACL de menor privilegio; criptografia e recuperacao;
integridade origem/destino; retomada autenticada e retencao. HD, SSH, relatorios
privados e precheck de outra estacao nao ficam acessiveis automaticamente aqui.
Nenhuma correspondencia de identidade por palpite. Reutilizar
`scripts/legado/consumir-lote-staging.mjs`, `persistencia-endereco-legado.mjs` e
[mapa canonico](LEGADO_MAPEAMENTO_CANONICO_RASCUNHO.md). Dados reais, mapas de
IDs/PII, backups, certificados, chaves, segredos e .env permanecem fora de
GitHub/CI/logs/chats. Piloto PREPARED_NOT_AUTHORIZED; agendamento Legado PAUSED.
As migrations privadas045bulk/046stage/047A1/048contas/049financeiro seguem fora
execucao automatica ate resolver identidade, dependencias e journals dos destinos.

### Pacote planejado no checkpoint66b88c2b (historico)

Primeiro lote de codigo: salvamento e reabertura de `descricao_seo` e `slug_site`
preenchidos MANUALMENTE na aba E-Commerce existente de ProdutoFormCompleto.
Gap lido na base documental: setter vazio no wrapper; o consumidor ja usa esse
setter. Reutilizar estado/onSubmit e o proprietario atual da persistencia; uma
unica gravacao. Preservar IDs, campos legados, cancelamento, layout, contexto,
RBAC e auditoria. Nao gerar IA paga, publicar canal ou ativar Produto HTTP.
Conversoes e leitura/calculo; nao inventar editor por haver prop sem uso.
Representante/TabelaPreco mantem salvamento legado e reabertura consolidada sem
dupla gravacao. Entregas resolvem cliente_empresas -> clientes; identidade avulsa
nao comprovada bloqueia e referencias historicas permanecem. Baixa em lote exige
permissao propria; estas regras nao sao escopo de alteracao deste lote documental.

Codespace unico: `potential-xylophone-5gj7r9v9qqg637vxp`, checkout
`/workspaces/ERP-Zuccaro-codeX`. VSCode desktop -> extensao GitHub Codespaces ->
Remote Explorer -> GitHub Codespaces -> login existente -> conectar ao MESMO
recurso (icone de conexao, nao Create). Codex oficial no IDE remoto com a conta;
nao presumir suporte da extensao no Cursor. Antes de afirmar execucao la, o agente
confere pwd/origin sanitizado/branch/SHA/status e escreve/le/remove um marcador
sintetico temporario proprio. Nao remover marcadores anteriores de preservacao.

O executor deste lote documental continua em `/workspace/ERP-Zuccaro-codeX`,
NAO no Codespace. Seu dirty/evidencias brutas foram preservados privadamente
antes do sync e nao entram neste commit. A API de metadados nao e shell; acesso
remoto por este executor ainda nao comprovado. Sem canal remoto, o fluxo e
sequencial: designar UM executor/checkout existente autorizado -> conferir SHA e
preservar dirty -> sincronizar sem descarte -> implementar/testar -> publicar na
mesma branch/PR -> confirmar remoto -> Codespace preservar/comparar/FF seguro ->
testar o SHA EXATO publicado e parar apos uso. Nao editar simultaneamente sandbox
e Codespace; coordenacao neste chat continua mesmo com esse bloqueio de canal.

### Fontes, lacunas e validacao deste registro

Fontes: instrucoes explicitas do proprietario recebidas neste chat, documentos
da base acima, leitura Git do remoto e codigo dos consumidores citados. Nao se
alega leitura de chats, relatorios privados ou arquivos de outros computadores
inacessiveis. Decisao recebida nao equivale a implementacao ou aceite operacional.
As provas Codespace no SHA6f0f0298 e CI4429 sao historicas conforme registro
anterior; nao foram executadas novamente aqui. A1 ownership do sandbox antigo
nao e regressao de codigo no Codespace. Auth real, menor privilegio, trust/CRL,
schema/UsageGuard, reconciliacao e rollback continuam gates independentes.

Lote SOMENTE DOCUMENTAL: diff-check, comparacao de caminhos, rastreabilidade e
revisao de sanitizacao; nenhuma suite runtime inalterada repetida localmente.
CI do push autorizado usa o workflow existente/runners padrao/budget zero; seu
resultado deve ser confirmado para o SHA publicado, sem reutilizar CI anterior.

## Historico: orientacao anterior de coordenacao e Codespace (2026-10-22)

Esta orientacao substitui a proposta anterior de iniciar Gate2. Coordenador
permanece o MESMO chat `ERP ZUCCARO - CODEX/CURSOR`; nenhum chat novo criado,
nenhum desenvolvimento delegado ao chat antigo da nuvem. Uma unica frente.

### Identidade e candidata

O ambiente chamado `Nuvem ERP-Zuccaro-codeX` e uma tarefa Linux gerenciada
Codex/OpenAI, nao GitHub Codespaces. Seu handoff dirty foi preservado/reconciliado
antes do FF documental para1ab49e9e; permanece inalterado nesta nova execucao.
Nao transferir ou sobrescrever seus registros para provar continuidade.

Codespace criado com autorizacao condicional, depois de verificar conta,
franquia e controle especifico de gasto: `potential-xylophone-5gj7r9v9qqg637vxp`.
URL: https://potential-xylophone-5gj7r9v9qqg637vxp.github.dev/
Repositorio viniciuszuccaro-creator/ERP-Zuccaro-codeX; branch
codex/consolidacao-infra-20261017; checkout /workspaces/ERP-Zuccaro-codeX.
SHA inicial/testado6f0f0298f8180c45a195987e7f5efef65a298f25, CI4427 SUCCESS.
Nenhum Codespace existia antes: criado somente um,2cores, imagem padrao/US East.
Checkout inicialmente limpo; preservacao/manifesto e marcador sintetico fora
do checkout precederam instalacao/testes. Node22.23.4, UID1000; / e /tmp UID0.
O gate de ownership A1 passou SEM alterar o carregador nem elevar permissoes.

### Evidencias novas neste Codespace

| Check | Resultado |
| --- | --- |
| npm ci raiz e server | exit0 em ambos; lockfiles preservados |
| A1 focado | 7 PASS / 0 FAIL / 0 SKIP |
| Audit/lint/typecheck/build raiz | PASS; avisos anteriores conservados |
| Raiz completa | 2172 PASS / 0 FAIL / 0 SKIP; exit0 |
| Backend typecheck/build | PASS |
| Backend completo sem banco | 538 testes:515 PASS / 0 FAIL / 23 SKIP; exit0 |
| PostgreSQL sintetico | 85 PASS / 0 FAIL / 0 SKIP em17suites; composicao de provas abaixo |
| Stop/start e outro acesso ao mesmo Codespace | PASS;36artefatos, marcador183bytes e arquivo nao commitado conferidos por hash |
| A1 apos restart | 7 PASS / 0 FAIL / 0 SKIP; execucao comprovada na nova conexao |

Primeira prova PG85:67PASS/18FAIL/0SKIP, por bootstrap incompleto deste ensaio
(schema_migrations e tabelas de seed ausentes). Mantidos log e resultados.
Corrigido SOMENTE o preparo efemero, reproduzindo npm run migrate +
scripts/seed-dev-synthetic.sql existentes do CI no novo container erp_test,
loopback127.0.0.1:55432. Nao e migration de ambiente operacional nem promocao de
SQL privado045-049. Dez suites aprovadas reaproveitadas; sete arquivos falhos
repetidos apos bootstrap: R11_STOCK/R08B/R07BPRICE/R08C/R09/R10C/R10. Resultado
reconciliado85/0/0, NAO uma nova execucao integral das17suites. Containers
sinteticos encerrados/removidos, sem volumes de dados reais ou grants externos.

Retomada real: parada confirmada pelo painel GitHub, conexao original fechada,
mesmo Codespace iniciado pela NOVA conexao web. SHA/branch e status do arquivo
nao commitado iguais;36entradas de SHA256SUMS conferidas, incluindo logs,
manifestos e copia do probe. Marcador183bytes conservado sem regravar; probe no
checkout removido somente apos comparar hash e preservar copia fora dele.
Checkout limpo apos a prova; Node22.23.4 e ownership confiavel conservados.
Instalacao, execucao e persistencia do AMBIENTE DE DESENVOLVIMENTO homologadas.
O erro transitorio de leitura CDP durante o startup nao alterou arquivos; o mesmo
cliente de retomada ficou disponivel sem reset/rebuild/recriacao.

Os resultados acima pertencem ao SHA inicial, nao ao main antigo nem ao runtime
OpenAI anterior. Skips nao sao aprovacao. PostgreSQL usa somente container
descartavel/loopback e fixtures; nenhum banco operacional ou backup real.
Detalhes privados em HOMOLOGACAO_CODESPACES_20261022.json fora do checkout;
logs/manifestos sinteticos privados no volume persistente do Codespace.

### Custos e acesso de outros computadores

Leitura autenticada confirmou GitHub Free, nenhum Codespace anterior/nenhum uso
reportado no mes antes da criacao e orcamento Codespaces US$0/Usage blocked.
Isso foi verificado no PRODUTO Codespaces, nao inferido de Actions. Nenhum budget,
pagamento ou recurso pago foi habilitado; sem prebuilds. Relatorio de uso pode
ter atraso. Franquia Free documentada:120core-horas/15GB-mes; em2cores ate60h
de execucao, menos outros consumos. Nao prometer disponibilidade ilimitada.
Fonte: https://docs.github.com/en/billing/concepts/product-billing/github-codespaces

Abrir o mesmo URL/mesma conta, nao criar outro Codespace. Procedimento simples
em ABRIR_NO_OUTRO_COMPUTADOR.md. Parar ao encerrar; storage permanece enquanto
existe. Nao apagar/recriar para retomar. Preservar dirty/novos fora do checkout
antes de sincronizar; conferir branch/SHA e so aceitar FF previamente comparado.
O teste de outra conexao web nao comprova acesso fisico do computador de casa,
nem restaura banco/backup operacional. A prova de retomada exigida para esse
workspace foi obtida; desenvolvimento passa para esse Codespace unico. O clone
independente local fica preservado/standby, sem outra frente de codigo. Este
chat continua como coordenador; abrir VS Code nao muda automaticamente o host
de execucao local deste chat nem ativa outro agente/Copilot. Nenhuma chamada de
IA paga foi configurada para os testes ou para a continuidade.

### Canal privado do legado e proxima frente

O Codespace NAO ganha acesso ao HD. Extracao futura ocorre na estacao autorizada
com a fonte original preservada/somente leitura, nunca por tunel ou mount aberto.
Reutilizar scripts/legado/consumir-lote-staging.mjs, persistencia-endereco-legado.mjs
e docs/LEGADO_MAPEAMENTO_CANONICO_RASCUNHO.md, sem importador ou cadastro paralelo.

Canal preparado por separacao de artefatos: origem privada -> staging isolado
privado na estacao -> revisao de reconciliacao -> somente codigo, contratos de
mapeamento e relatorio agregado/sintetico sanitizado no GitHub -> Codespace.
Lotes reais, mapa antigo->novo com IDs/PII, hashes da fonte, backups e rejeicoes
nominais ficam em armazenamento privado controlado pelo proprietario, fora do
Git e fora do Codespace. Nao existe upload/tunel/credencial persistente novo.
Este preparo NAO executa extracao, leitura do backup, carga ou importacao.

Antes de eventual envio de lote real a outro destino, exigir destino privado
existente autorizado, ACL/retencao, verificacao de integridade e autorizacao
explicita. Importacao posterior exige staging, identidade Grupo/Empresa,
reconciliacao, journals/dependencias, RBAC/auditoria/rollback e gate proprio;
piloto permanece PREPARED_NOT_AUTHORIZED. Dados nao migram com o codigo.

Continuar Comercial360 no Codespace homologado pelo programa existente,
preservando contratos/proprietarios da persistencia e contexto multiempresa.
Nao iniciar Gate2 por apontamento historico. Originais/captura/cinco worktrees
intactos; agendamento Legado PAUSED; rotas operacionais inativas. Publicacao nao
autoriza merge, VPS, migrations operacionais, integracao bancaria ou carga real.

## Historico: intervencao de plataforma e proposta Gate2 superada (2026-10-22)

Base deste lote: 1ab49e9e05dde4005b6eadb3b992fdd20e502d3e, conferida
no clone independente e no remoto. Runtime inalterado; nao repetir suas suites.
O gate ambiental nao autoriza alterar o carregador A1 nem o criterio dos testes.

Preservacao administrativa da nuvem CONCLUIDA antes da sincronizacao: copia
integral/base/diff/manifesto/SHA256SUMS fora do checkout, com integridade conferida.
Handoff inicial226493bytes, SHA256:
04abafefe3ec5d1637cfcd9529a59d6fde83795e3dc1eb15b074dfa7876a584a.
Quatro secoes locais foram conservadas byte a byte junto ao documento publicado.
HEAD avancou por fast-forward de d6d6e98b para1ab49e9e (somente tres documentos).
Estado final: somente docs/HANDOFF_ATUAL.md dirty, indice limpo, diff-checkPASS;
marcador453bytes/hash anterior confirmado. Localizacao da copia no relatorio
privado. Essa copia ainda esta NA VM, nao comprova backup externo/restauracao.
Nenhum teste foi repetido nesse SHA documental; provas de runtime continuam
atribuidas ao d6d6e98b, nao transferidas ao novo SHA por presuncao.

### Solicitacao preparada ao suporte (nao enviada)

Assunto: runtime gerenciado Codex rejeitado por carregador seguro de chave local.

Solicitamos configuracao SUPORTADA de ownership/namespace no ambiente existente,
sem elevar privilegios ou enfraquecer a aplicacao. Prova exclusivamente sintetica:
Linux, processo UID/GID1000:1000; ancestral / UID/GID65534:65534 modo0755;
/tmp UID/GID65534:65534 modo1777. O carregador percorre todos os ancestrais
por descritores sem seguir symlinks e aceita apenas UID0 ou UID do processo.
Escrita de grupo/outros so e aceita em ancestral sticky pertencente a UID0.
Diretorio final privado e chave sintetica de32bytes/0400 nao corrigem a raiz
incompativel. Dois testes positivos de leitura/rotacao falham; negativos continuam
protegendo o contrato. Nao enviamos chave, certificado, senha, .env ou logs brutos.

Perguntas objetivas: qual configuracao suportada atende esse contrato em TODA a
cadeia, sem chown/chmod da raiz pelo usuario? Como preservar e recuperar o MESMO
workspace dirty em sessao independente, sem reset/cache/recriacao? Qual versao do
ambiente sera usada e como verificar o ajuste sem perder o estado atual?
IDs privados do ambiente/tarefa somente no chamado privado, se solicitados.

Encaminhar ao atendimento privado em https://help.openai.com pelo widget de
suporte, pedindo encaminhamento ao runtime gerenciado Codex. Como canal de
diagnostico documentado no app, abrir o menu / no compositor e usar o fluxo de
feedback para a equipe; revisar o material antes de consentir compartilhar a
sessao. Nao anexar
automaticamente a sessao inteira nem logs nao sanitizados. O relato acima esta
preparado, NAO foi submetido em nome do proprietario.
Fonte: https://learn.chatgpt.com/docs/reference/troubleshooting#feedback-and-logs

### Recuperacao suportada versus prova ainda pendente

A documentacao orienta reabrir a MESMA tarefa para continuar entre dispositivos;
uma NOVA tarefa parte do setup publicado e nao herda necessariamente seu dirty.
O estado salvo da VM e recuperavel, por padrao, por ate sete dias desde iniciar
um turno ou retomar a tarefa. Isso nao e backup permanente nem prova de restore.
Fonte: https://learn.chatgpt.com/docs/environments/cloud-environments#run-and-return-to-a-task

Procedimento: preservar handoff/diff/arquivos novos e manifesto com hashes fora
do checkout antes de qualquer sincronizacao; manter tambem copia privada fora
da VM antes de testar sua recuperacao. Encerrar o turno, abrir a mesma tarefa
existente por outra sessao web/mobile autorizada, conferir identidade do ambiente,
branch/SHA/status e hashes preservados sem regravar o marcador. Uma nova tarefa,
fork ou ambiente com mesmo nome nao comprova recuperacao do original. Se a UI
nao oferecer a retomada, solicitar o procedimento ao suporte; nao usar Reset
cache ou recriar o ambiente. Sem acesso a sessao independente neste executor,
a prova continua pendente, mesmo com conservacao ja demonstrada entre turnos.

### Controle de cobranca a confirmar pelo proprietario

Na conta que fornece este ambiente, abrir https://chatgpt.com/codex/settings/usage
e conferir se COMPRA/RECARGA AUTOMATICA de creditos esta DESATIVADA e se qualquer
limite de gasto extra/excedente aplicavel e um bloqueio efetivo de valor ZERO.
Em workspace administrado, pedir ao administrador a politica de Billing aplicavel
ao ambiente. Saldo zero, franquia restante e alerta de gasto nao provam esse
bloqueio; No limit nao significa zero. Registrar apenas resultado/data/escopo,
sem dados financeiros pessoais. Se o controle nao aparecer, o suporte deve
confirmar se existe cobranca automatica alem do plano e qual politica a impede.
Nao ativar recarga, comprar creditos, vincular API paga ou contratar recursos.
Budget zero de Actions continua sendo prova APENAS de Actions.

### Trabalho independente: Gate0 de rastreabilidade

O resumo inicial do PLANO_GO_LIVE.md tinha todos os P0/P1/P2 marcados como
concluidos, sem distinguir implementacao historica de homologacao operacional.
Foi acrescentada precedencia explicita das evidencias atuais: esses marcadores
nao autorizam operacao. Nenhuma funcionalidade foi retirada ou reclassificada
como defeituosa sem prova. Proximo trabalho de codigo independente segue o Gate2
ja registrado no PLANO_MELHORIA_ERP_ZUCCARO.md: revisar criacao/edicao de perfis
e vinculos existentes, por consumidor/backend, sem promover rotas privadas.
Esta correcao documental nao afirma que essa revisao ja foi executada.

## Historico: homologacao parcial do executor cloud (2026-10-22)

Este registro sanitizado prevalece sobre os relatos anteriores de nuvem ainda em
main/work. Reutiliza as execucoes ja registradas; nenhuma suite foi repetida para
esta atualizacao exclusivamente documental. A PR342 permanece draft sobre334.
Nao declarar transicao exclusiva concluida.

### Candidata efetivamente executada

Repositorio: viniciuszuccaro-creator/ERP-Zuccaro-codeX.
Chat existente: Nuvem ERP-Zuccaro-codeX, ambiente gerenciado Codex/OpenAI,
Linux x86_64/Debian13, checkout /workspace/ERP-Zuccaro-codeX.
Branch: codex/consolidacao-infra-20261017.
SHA executado: d6d6e98b4bb92f0f5098eb53b0e7b9ff8b4ea264.
Antes da sincronizacao: work/baba91a6b0d5d626edd607b8cd3522927e1904ab, limpo.
Depois: candidata exata; apenas docs/HANDOFF_ATUAL.md modificado na nuvem.
Esse trabalho remoto nao commitado permanece preservado; nao foi sobrescrito.
Um eventual novo SHA desta publicacao documental NAO foi executado na nuvem.

Provas obtidas no SHA acima, com Node22.23.3 e dados exclusivamente sinteticos:

| Verificacao | Resultado e escopo |
| --- | --- |
| Raiz completa | 2172 PASS / 0 FAIL / 0 SKIP |
| Audit, lint, typecheck global, build | PASS; aviso de lint anterior mantido |
| Backend typecheck/build | PASS |
| Backend completo final, com concessao de rede | 538 testes: 513 PASS / 2 FAIL / 23 SKIP; exit1 |
| HTTP focados apos concessao por turno | 7 PASS / 0 FAIL / 0 SKIP |
| A1 focado | 5 PASS / 2 FAIL; positivos de leitura e rotacao de chave |
| PostgreSQL sintetico local | 85 PASS / 0 FAIL / 0 SKIP em17suites |
| Composicao PGlite / PostgreSQL dedicada | 1 PASS em cada, sem skips |
| Diff-check do handoff remoto | PASS |

Nao somar suites sobrepostas nem contar skips como aprovacao. PG85 e raiz2172
sao da primeira execucao; nao foram repetidos nas retomadas sem mudanca.
Primeiro backend512/3/23 incluiu falta de refs historicas: composicao passou
apos fetch dos SHAs fixados pelo CI. Uma retomada sem concessao de loopback
reportou52arquivos PASS/43FAIL/0SKIP (95arquivos, NAO538assercoes), com listenEPERM.
Isso nao e a contagem final. Probe e HTTP passaram com a concessao autorizada;
o backend final513/2/23 deixou apenas as duas falhas A1. Nenhum teste removido,
hash esperado alterado, permissao ampliada ou validacao de seguranca relaxada.
CI4423 no GitHub foi verde neste SHA; nao equivale a aprovar este runtime da nuvem.

### Persistencia: o que foi realmente demonstrado

Arquivo temporario sintetico fora do checkout:
/workspace/erp-cloud-persistence-probe-20261022.json
453bytes, criado2026-10-22T09:37:16.977466Z, SHA256:
17e4a13ce53cbbc4a6446821b546c5967bbd82c78a9cd85e8981f4ee37741c5a.
Conteudo nao publicado. O agente encerrou um turno e retomou no mesmo chat e
ambiente; tamanho/hash/data foram conservados sem regravar o marcador, inclusive
nas retomadas seguintes. Um identificador distinto de sessao do executor nao foi
exposto. Portanto: conservacao entre turnos retomados COMPROVADA; encerramento
e restauracao de uma sessao/workspace independente NAO comprovados. Nenhum reset,
invalidacao de cache ou reprovisionamento foi executado para simular essa prova.

### Definicao precisa do gate A1

Gate de seguranca do filesystem em server/src/services/a1FileProtectionKeys.ts,
nao falta de certificado real, senha ou autenticacao do usuario. O servico abre
cada ancestral por descritor, rejeita symlinks e exige ownership UID0 ou UID do
processo; rejeita escrita de grupo/outros exceto sticky confiavel de UID0.
Diretorio final pertence ao processo, sem acesso de grupo/outros; chave exige
arquivo regular de32bytes, UID do processo, modo0400 e um unico hardlink, com
metadados estaveis durante leitura. Somente fixtures sinteticas foram usadas.

Observado no sandbox: processo1000:1000; raiz/65534:65534,0755;
/tmp65534:65534,1777. A raiz ja e rejeitada antes de acessar a chave. Por isso
falham os positivos de leitura valida e rotacao, com bloqueio seguro. Criar so
um subdiretorio privado nao resolve o ancestral/ rejeitado.

Impacto: nao impede toda edicao, compilacao ou teste dos demais modulos. Impede
executar/validar o carregador seguro A1 neste runtime e obter suite totalmente
verde, logo bloqueia a homologacao COMPLETA/exclusiva exigida para a nuvem.
Nao comprova defeito criptografico nem autoriza enfraquecer a politica.

Acao concreta: solicitar ao administrador/suporte da plataforma um runtime
SUPORTADO no ambiente existente em que toda a cadeia de ancestrais seja confiavel
segundo a regra acima (raiz UID0 ou UID executor e modos compativeis). Nao fazer
chown/chmod da raiz, aceitar UID65534 genericamente, elevar privilegios ou criar
outro servico pago como contorno. Nao ha seletor de imagem/usuario/mapeamento UID
exposto pelas ferramentas atuais. Apos ajuste suportado, registrar os metadados
e repetir apenas tests/a1-file-protection-keys.test.ts; depois o backend completo
se os positivos passarem. Cofre operacional, trust/CRL, Auth/RBAC/UsageGuard real
e migrations privadas045-049 continuam gates SEPARADOS, nao resolvidos por isso.

### Workspace de desenvolvimento NAO e banco operacional

Restaurar workspace significa recuperar checkout/branch/SHA, alteracoes locais,
handoff, ferramentas/dependencias e o marcador sintetico entre sessoes. Git
recupera codigo commitado; nao garante arquivos novos, dirty, cache ou banco.
Install/start ainda sao rascunho revisao1 associado a main: nao presumir que
sejam uma configuracao publicada da candidata nem executar setup antigo cegamente.

Restaurar PostgreSQL sintetico para testes e outro procedimento descartavel:
PG85 nao comprova backup/restore do ERP real. Restauracao de banco/backup
operacional envolve dados, identidades, journals, chaves, auditoria e rollback;
exige autorizacao/plano/provas proprias. Nada disso foi executado aqui. Nao copiar
backup privado ou certificados para provar persistencia de workspace.

### Procedimento e intervencoes necessarias

1. Rede: solicitar request_permissions da plataforma com scope turn antes dos
   comandos que necessitam GitHub/loopback; e ferramenta da plataforma, NAO um
   comando shell. github.com HTTPS443 ja era permitido. Git fetch de leitura pode
   precisar GET e POST/git-upload-pack. Conservar proxy/TLS/credenciais/allowlist;
   nao liberar internet irrestrita. Se o mecanismo nao aparecer, pedir habilitacao
   da concessao minima ao administrador; nao contornar restricoes. O probe
   127.0.0.1:0 abriu/fechou socket e passou quando a concessao estava ativa.
2. Conferir a candidata e o marcador, sem mudar arquivos:

```sh
cd /workspace/ERP-Zuccaro-codeX
git branch --show-current
git rev-parse HEAD
git status --short
sha256sum /workspace/erp-cloud-persistence-probe-20261022.json
wc -c /workspace/erp-cloud-persistence-probe-20261022.json
stat -c '%u:%g %a %n' / /tmp
```

3. Somente apos ajuste ambiental A1, em processo de testes sem DATABASE_URL,
   credenciais operacionais ou integracoes externas, reutilizar Node22 existente:

```sh
export PATH=/workspace/.erp-tools:/workspace/.erp-tools/node_modules/node/bin:$PATH
cd /workspace/ERP-Zuccaro-codeX/server
node --import tsx --test tests/a1-file-protection-keys.test.ts
# Backend completo somente depois do gate focado passar:
npm test
```

4. Persistencia: preservar primeiro o handoff dirty fora de qualquer operacao que
   possa substituir o checkout. Pedir ao administrador a identificacao da versao
   publicada do ambiente e uma retomada NAO destrutiva de outra sessao do MESMO
   ambiente. Nao clicar Reset cache, nao recriar ambiente ou descartar dirty.
   Registrar sessao/versao antes/depois quando expostas, repetir apenas os comandos
   de identidade/hash acima e comparar SHA,453bytes/hash do marcador e handoff.
   Ferramentas de publicacao/restauracao nao estao expostas aqui; na ausencia dessa
   capacidade, registrar gate aberto em vez de alegar restauracao comprovada.
5. Custos: conferir na mesma conta https://chatgpt.com/codex/settings/usage,
   creditos/recarga e controles de gasto efetivamente exibidos. Nomes e estado do
   controle de recarga nao foram observados: nao inventar submenus. Em workspace
   com cobranca administrada, o proprietario deve conferir Billing e o limite de
   excedente aplicavel. Alertas nao equivalem a bloqueio. As ferramentas leem
   franquia/saldo, mas nao recarga/budget do ambiente; a UI falhou antes de abrir.
   Login atual ChatGPT comprovado, sem criar APIkey. Isso nao prova ausencia de
   toda configuracao paga na conta. Nao comprar, ativar recarga ou vincular API.
   Bloqueio de gastos de Actions NAO comprova custos Codex/cloud.

### Alternativa sem nova infraestrutura ou desenvolvimento concorrente

Enquanto esses gates estiverem abertos, manter UMA frente de desenvolvimento no
clone independente ERP-Integracao-Privada/comparacao-20261017 ja existente na
maquina do proprietario, branch codex/consolidacao-infra-20261017. Nao usar a raiz
antiga do HD, mover originais ou copiar uma worktree como repositorio independente.
Reutilizar o hardware atual e o CI ubuntu-latest ja existente; novas execucoes
somente quando necessarias, dentro da franquia Actions confirmada com budget zero.
Se a franquia acabar, aguardar: nao comprar capacidade. Nao contratar Codespace,
VPS, API ou novo ambiente. A nuvem fica sem edicao concorrente; preservar seu
handoff dirty e o marcador, sincronizando somente codigo aprovado quando liberada.

Essa alternativa nao exige nova contratacao, mas NAO e prova de homologacao da
nuvem nem garante gratuidade ilimitada da assinatura/CI. A publicacao da PR342
preserva o codigo para retomada; documentacao posterior nao altera silenciosamente
o SHA testado na nuvem. Agendamento Legado PAUSED, originais/backups intactos.
Nenhum merge, deploy, importacao operacional ou permissao de faturamento emitida.

### Historico preservado - consolidacao etapa86 (2026-10-21)

Codigo publicado em0b68332d6781f726ec5bb4e5354deef899c0731b, PR draft342 sobre334.
CI4419 SUCCESS em frontend/backend/composicao. Frontend2172PASS; backend515PASS/
23SKIP separados de85testesPG PASS sem skips. Typechecks0/audit/lint/buildPASS.
Nenhum merge/main, carga, VPS ou ativacao de rotas. Continuar pela mesma branch.
Nuvem ERP-Zuccaro-codeX inspecionada somente leitura: Linux real, checkout antigo
work/baba91a6, consolidacao ausente; proxy bloqueia GitHub e Docker sem permissao.
Restauracao/testes no SHA atual/custos nao comprovados; nao transicionar ainda.
CI do fechamento documental a81b14f8/4421 SUCCESS. Detalhes e
limites em CONSOLIDACAO_INFRA_ETAPA1.md. Originais intactos/agendamentoPAUSED.

Mesma branch, commit85 d312fbcd no remoto e PR draft342 empilhada na334.
CI4417 comprovou composicao, mas falhou testes frontend/backend. Correcoes de
dependencias cruzadas e canonicalizacao LF/CRLF das provas: root2172PASS/0FAIL/
0SKIP, typecheck0 e audit/lint/build/diffPASS. Novo CI confirmado acima.
Consultar CONSOLIDACAO_INFRA_ETAPA1.md etapa86; nao tratar CI anterior como verde.
Originais preservados, agendamentoPAUSED, nenhum merge ou acesso operacional.

## CODEX - Consolidacao etapa85 (2026-10-21)

Retomada: branch codex/consolidacao-infra-20261017 no clone independente existente.
Fonte de continuidade: CONSOLIDACAO_INFRA_ETAPA1.md, topo etapa85.
Root2170PASS/0FAIL/0SKIP; typecheck0; backend503PASS/35SKIP nao operacionais.
Preparacao de publicacao sanitizada sobre334; verificar SHA remoto e CI novos.
Sem merge/main, migrations privadas, carga ou implantacao. Captura/worktrees
originais intactas, agendamentoPAUSED. Historico de exports requer acao separada.
Registros anteriores abaixo nao representam estado atual de publicacao.

## CODEX - Consolidacao infraestrutura etapa 1 (2026-10-17)

Trabalho local na branch codex/consolidacao-infra-20261017 sobre334 e36231b3.
Consultar CONSOLIDACAO_INFRA_ETAPA1.md para proveniencia, validacao e limites.
Nao integrado em main, sem publicacao ou liberacao operacional. Journal de destino
nao comprovado:045 e demais migrations privadas nao renumeradas nem executadas.
Preservar residual Cursor, SQL/runner e protecoes remotas; agendamento pausado.

## CODEX COMERCIAL 360 — idempotência persistente do Pedido direto (2026-10-13)

- Branch `codex/comercial-pedido-idempotencia-20261013` empilhada na #327 `14be3f96`, reserva `server/src/services/pedidoService.ts`, repositórios/tipos de Pedido, migration nova após 043, testes de serviço/HTTP/PostgreSQL, payload UI existente de Pedido, STATUS/HANDOFF. Reutilizar contrato da Oportunidade (chave/fingerprint/lock) somente para criação direta; não editar Expedição, branch Cursor ou Legado. Testar mesmo key/payload, key adulterada, tenant/ator/RBAC, concorrência PostgreSQL e retry depois de resposta perdida antes de declarar proteção. Migration em código/CI isolada; sem banco operacional/VPS.

## CODEX COMERCIAL 360 — Pedido detalhe/histórico e troca de contexto (2026-10-13)

- Reserva independente na branch `codex/comercial-pedido-detalhe-escopo-20261013`, base #326 `5ff621cc`: `src/components/comercial/PedidoCanonicoPanel.jsx`, policy e teste de Pedido UI, STATUS/HANDOFF. Corrigir somente resposta tardia de leitura detalhe/histórico após troca Grupo/Empresa/ator ou seleção de outro Pedido, reutilizando HTTP/RBAC existente. Não tocar backend, Expedição, branch Cursor ou entradas Legado; CI/revisão do SHA final antes de integração.
- Segundo incremento: mesma sessão/ator com token rotacionado deve invalidar leitura anterior; teste falhou antes da correção e passou após exigir identidade de token no gate local. Token não vai para log, doc ou GitHub. PR #327 deve ser revisada novamente no novo HEAD; não atribuir CI/revisão do commit inicial ao seguinte.
- Parecer Codex de `89f3d474` identificou mutações tardias sobrescrevendo seleção posterior. Reserva permanece no painel/policy/teste: save/status/cancel capturam ticket original; refresh do histórico não gera ticket novo; lista do tenant inicial é invalidada e a UI atual não é repintada após troca. Teste sintético A→B e avisos de resultado possivelmente persistido sem repetição cega. Exigir CI/revisão do próximo SHA.
- Parecer Codex de `75a2a960` identificou `busy` preso após rotação do token e falso desbloqueio A→B→A. `createPedidoMutationGate` separado do ticket de leitura guarda pendência por Grupo/Empresa/ator até o `finally`; painel deriva `busy` do escopo atual e impede duplicar ação ainda em voo. Teste comportamental A→B→A + rotação foi vermelho antes do fix e verde depois. CI/revisão somente do novo SHA.
- Após `0b1e2889`, teste mostrou que duplo clique podia invalidar ticket da primeira mutação antes de ser recusado. Aquisição em save/status/cancel agora é mutação→detalhe; falha de contexto libera mutação sem enviar HTTP. Teste de ordem passou; revisão/CI do commit anterior são obsoletas.
- Parecer Codex de `0b1e2889` identificou remount da janela minimizada (`WindowRenderer` retorna `null`). Gate agora é singleton do módulo de Pedido e notifica janelas montadas; reserva pendente sobrevive ao remount na sessão JS. Teste comportamental preserva A em voo durante desmontagem e bloqueia novo envio; backend idempotência cross-tab/reload permanece pendência explícita, sem afirmar garantia inexistente.

## CODEX COMERCIAL 360 — Central 360, valor desconhecido (2026-10-13)

- Parecer Codex no `cfc8019e` da #326 identificou fallback CRM legado convertendo ausência em zero. Reserva ampliada ao adaptador já existente `centralCliente360CrmLegado.js` e seu teste focado; cenário sintético com cliente de outra empresa excluído, ausente/vazio/inválido e zero real foi reproduzido antes do fix e passou depois. CI anterior SUCCESS não substitui CI/revisão do novo HEAD. Sem tocar branch Cursor, Legado ou fontes de dados reais.
- Reserva independente da branch `codex/comercial-central-valor-indisponivel-20261013`, base #325 `834a50b3`: `src/components/comercial/CentralCliente360Panel.jsx`, helper de formatação específico se necessário e teste direto. Cursor branch `cursor/cadastros-recuperacao-c360-contrato-392b` permanece `6908f74e` documental/sem edição por esta frente. Escopo somente exibição de valores monetários ausentes/inválidos, sem criar fonte ou KPI paralelo; distinguir desconhecido de zero confirmado. Não tocar entradas Legado reservadas, Pedido/Orçamento backend, Expedição ou branch Cursor. CI/revisão do HEAD final exigidas.

## CODEX COMERCIAL 360 — snapshot preço→Orçamento→Pedido (2026-10-13)

- Branch `codex/comercial-preco-snapshot-revogacao-20261013` baseada na #324 `b0865363`; reserva de `server/src/services/{orcamento,pedido}Service.ts` e `server/tests/runtime-onda2-preco-snapshot.test.ts`, sem editar a branch Cursor ou Legado. Entrada do cliente com `tabela_preco_id` divergente da tabela efetiva é rejeitada na transação; itens com origens diferentes também falham fechados. Fluxo sintético real `TabelaPrecoService`→Orçamento→Pedido cobre unidade principal trocada, falha sem nova venda, reautorização/retry e snapshots antigos intactos. Unidade secundária para venda não foi ativada: conversão de quantidade/estoque ainda precisa de contrato. Revisão/CI só contam no HEAD final desta branch; sem merge/deploy/importação.
- Revisão Codex do commit `3fb54caf` apontou P2 válido: override de tabela em `convert()` e update do Pedido convertido. Incremento seguinte bloqueia tabela divergente e campos de snapshot de item (produto/unidade/descrição/preço) alterados, mantém quantidade sujeita às alçadas existentes e testa retry/reabertura. Não atribuir o parecer antigo ao novo HEAD; CI/revisão novas obrigatórias.
- Revisão Codex do commit `4940aed0` apontou P2 adicional: troca de ClienteEmpresa em Pedido convertido preservava preço/tabela do Orçamento de outro cliente. Bloqueio de `cliente_empresa_id` imutável no update convertido, com teste pré-fix e retry de quantidade. Não afirmar aprovação deste incremento até CI/revisão do próximo SHA.

## CODEX COMERCIAL 360 — revogação de unidade em preço (2026-10-13)

- Após #323 `2de492d7` (CI push/PR SUCCESS e revisão Codex sem achado relevante, **não** Cursor), branch empilhada `codex/comercial-preco-unidade-revogacao-20261013` corrige leitura de item de preço quando Produto perde sua unidade principal/secundária. PostgreSQL e in-memory exigem vínculo vigente; teste sintético prova revogação, bloqueio de edição sem mutação e retry. Escopo: TabelaPreco repositories, teste R07B, STATUS/HANDOFF; não tocar Pedido/Orçamento/Expedição, UI Cursor ou Legado. CI/revisão exigem SHA desta branch, não o de #323.
- Incremento de concorrência: `resolvePrice` SQL aplica `FOR SHARE OF p` durante a captura do preço, como o check de inclusão/edição já faz; teste de duas conexões no `test:postgres` exige conflito com `FOR UPDATE` do Produto enquanto o snapshot ainda está na transação. Sem prova PostgreSQL local por falta de `DATABASE_URL`; não declarar CI/homologação até o SHA final.

## CODEX COMERCIAL 360 — contrato de preço cross-company (2026-10-13)

- Branch própria `codex/comercial-preco-produto-escopo-20261013`, base `#321` `037985cd`/`#319` `5568e3a9`; #104 fica congelada `87101b4d`. HEAD remoto Cursor verificado `6908f74e` em `cursor/cadastros-recuperacao-c360-contrato-392b` (checkpoint documental). Não pressupor porte automático entre as candidatas.
- Lote proprietário: `server/src/services/tabelaPrecoService.ts`, `server/src/repositories/{inMemory,postgres}TabelaPrecoRepository.ts`, `server/tests/runtime07b.test.ts`, STATUS e este HANDOFF. Cursor mantém UI Cadastros/Estoque/Expedição e sua branch; outras frentes mantêm Pedido/Orçamento/Expedição, painel C360, catálogo/outbox, Marca e Legado. Nenhum arquivo privado, segredo ou dado real entra no GitHub.
- Regressão comprovada em PGlite: Empresa A2 podia adicionar Produto exclusivo da A à sua Tabela de Preço. Correção usa escopo ativo na validação Produto/Unidade, aceita mestre compartilhado (`empresa_id NULL`) e rejeita empresa irmã. Não cria API/migration/módulo paralelo; `resolvePrice` já filtrava leitura. Backend 372 PASS/0 FAIL/18 SKIP condicionais, typecheck/build PASS; frontend baseline/lint/build PASS, suíte Windows falha em guardas Bash/VPS anteriores e typecheck raiz conserva passivo global. Não declarar CI, revisão independente, integração, implantação ou homologação antes das evidências do HEAD final.
- Próximo gate: testes completos aplicáveis, commit/push/PR, CI exata e revisão independente quando disponível. Não usar a pausa de créditos do Cursor como aprovação tácita.
- Fluxo de retentativa no mesmo lote: validação Produto/Unidade da criação ocorre dentro da transação e restauração de item inativo a repete. Se o Produto compartilhado ficar exclusivo da empresa irmã, o item continua inativo; após voltar a compartilhado, restauração autorizada funciona. Sem migration ou importação. CI/revisão precisam referir o último SHA, não apenas o primeiro commit da PR.
- Correção posterior à revisão independente de `ad5df3e1`: Produto é lido com `FOR SHARE OF p` no PostgreSQL até commit da mutação do preço, bloqueando `FOR UPDATE` concorrente; edição de item revalida o escopo antes da atualização. PGlite cobre rejeição e retry, e `server/scripts/runPostgresTests.mjs` inclui teste de duas transações para o lock. O teste PostgreSQL local é condicional por ausência de `DATABASE_URL`; exigir CI no SHA final antes de integrar. Não atribuir esta revisão ao Cursor, que segue sem créditos.

## POLICY CRM COMPARTILHADA — pacote 040 (2026-10-10)

Fonte única: `server/src/domain/crmOportunidadePolicy.js`. O arquivo `src/components/lib/crmOportunidadePolicy.js` permanece wrapper. A API empacota essa fonte porque o contexto Docker continua `server/` (`COPY src` → `dist/domain`). Não alargar o contexto para a raiz: `docker build ./server` é o contrato do compose, do gate-f, do canário e do incidente. Codex importa o módulo; não edita a policy nem a UI. Schema, repositório e RLS da 040 seguem no workspace Codex, sem corte do store e sem dual-write.

## REVISÃO CODEX AUTÔNOMO (2026-10-10)

Cursor monitora agentes/PRs Codex sem re-portar #254/#264.

| PR / agente | Achado | Ação Cursor |
|---|---|---|
| [#265](https://github.com/viniciuszuccaro-creator/erp-zuccaro-codex/pull/265) tip `910e4ec9` | Produto+Orçamento sobre #261; MERGEABLE | Produto já em `db89aa45`; **Orçamento porte** neste ciclo |
| [#263](https://github.com/viniciuszuccaro-creator/erp-zuccaro-codex/pull/263) | vs main · ancestral do Orçamento em #265 | absorvido via porte seletivo na #261 |
| [#266](https://github.com/viniciuszuccaro-creator/erp-zuccaro-codex/pull/266) tip `001e6c85` | Legado mestres+retry · agente RUNNING | **não** merge Cursor — #211 |
| #254 | ancestral OPEN | não re-portar |
| Agentes | Legado RUNNING | timer contínuo |

## RECONCILIAÇÃO PÓS-#264 (2026-10-10)

Consulta GitHub + lote Cursor CRM. **Não** re-portar #254/#264. **Não** atribuir homolog de `f22d1151` ao HEAD novo.

| Item | Valor |
|---|---|
| `origin/main` | **`baba91a6`** (merge #257) · **não** contém o HEAD da #261 |
| #261 | OPEN draft · branch `cursor/cadastros-recuperacao-c360-contrato-392b` · tip CRM legado C360 · mergeable vs main · **não** incorporada na main |
| #264 | **MERGED** na candidata #261 (não na main) · tip `d9403665` · merge **`861513cd`** · ancestral confirmado |
| #254 | tip `20a2c2fb` · ancestral confirmado · não re-portar |
| SHA implantado | **`9f084ed0`** · `index-C-lbE7zK.js` · ≡ PR HEAD (Orçamento+#265) |
| homolog deste SHA | owner login tipado fail_count=0 · **somente** `9f084ed0` |
| usuário restrito | **BLOCKED** reconfirmado: Environment sem `ERP_DEV_LOGIN_RESTRICTED_*` |
| CRM | C360 adaptador **opção B** (store Oportunidade legado) · HTTP canônico server **pendente Codex** · sem CRM paralelo · `useContextoVisual` reservado |
| próxima funcional | secret restrito · contrato HTTP Codex Oportunidade se A · merge owner #261→main · azul residual |

## CONTINUIDADE CASA — Cursor ↔ Codex (2026-10-10)

Troca de máquina. **Não depender** de alterações locais da empresa — só GitHub + este HANDOFF.

| Item | Valor |
|---|---|
| repositório canônico | `viniciuszuccaro-creator/ERP-Zuccaro-codeX` (clone também via `erp-zuccaro-codex`) |
| branch Cursor | `cursor/cadastros-recuperacao-c360-contrato-392b` |
| **main** | `baba91a6` — **#261 ainda não mesclada em main** |
| **#264** | MERGED **na #261** (não em main) · tip `d9403665` · merge `861513cd` |
| **PR HEAD #261** | **`9f084ed0`** · CI SUCCESS · MERGEABLE → `main` |
| **SHA implantado erp-dev** | **`9f084ed0`** · asset `index-C-lbE7zK.js` · ≡ PR HEAD |
| rollback | `pre-spa-login-20261010-172341` |
| backup | `pre-gate-e-20261010-144428.sql` (SPA-only tip; só VPS) |
| #254 Codex | tip `20a2c2fb` — ancestral confirmado; **não** re-portar |
| homologado tip implantado | login tipado fail_count=0 (owner) em **`9f084ed0`** (não reusar SHAs anteriores) |
| usuário restrito | **BLOCKED** — falta `ERP_DEV_LOGIN_RESTRICTED_*` no Environment |
| CRM | C360 adaptador **opção B** (legado Oportunidade); HTTP canônico **pendente Codex** (sem paralelo) |
| **recuperado / importado** | **NÃO** legado · SYNTH≠recuperado · #211 Codex Legado |
| arquivos reservados Codex | sessão/contexto/outbox (`erpHttpSession`, `useContextoGrupoEmpresa`, `useContextoVisual`) · schema CRM HTTP novo |
| ManagePR | URL lowercase `…/erp-zuccaro-codex/pull/261` |
| evidência | `deploy-261-tip-9f084ed0-orcamento-20261010.txt` · `deploy-261-tip-db89aa45-porte-265-20261010.txt` · `reconciliacao-261-pos-264-main-20261010.txt` |
| chat coordenação | [ERP ZUCCARO - CODEX/CURSOR](https://cursor.com/agents/bc-d973626e-1060-4071-a25a-6a549769392b) |

### Ao abrir no PC de casa
1. `git fetch origin cursor/cadastros-recuperacao-c360-contrato-392b` → checkout → **`9f084ed0`** (ou tip docs posterior).
2. Confirmar VPS: `MERGE_SHA8=9f084ed0` / `index-C-lbE7zK.js` — não atribuir homolog antiga a este tip.
3. Ler este bloco + STATUS topo; **não** sobrescrever seções Codex sem merge consciente.
4. Credenciais/SFTP/VPS: secrets do Environment (não via Git).

### Próxima ação Cursor (independente enquanto merge owner)
1. ~~CI + redeploy tip CRM+azul+#265+Orçamento~~ **feito** `9f084ed0` / `index-C-lbE7zK.js` · homolog owner fail_count=0.
2. Secret usuário restrito → homolog fail-closed FE+BE.
3. Inventário residual (POD/Separação keep-both; Painel seletivo).
4. Merge owner #261→main; fechar #254 como supersedido/ancestral.
5. Codex: decidir CRM HTTP (A schema) se for além do adaptador B; Legado #211.

### Pendências / parcial (não concluído)
- Homolog usuário restrito.
- CRM HTTP canônico (server) — adaptador B cobre leitura C360; funis ainda no store legado.
- #261 **não** incorporada em `main` (só #264→#261).
- Legado staging→ops: **não importado**.
- CI do tip ≠ prova de merge em `main`.
## CODEX LEGADO — ownership e gate de origem (2026-10-10)

| Frente | Arquivos / responsável | Estado |
|---|---|---|
| Comercial 360 | Tarefa própria em outra conta/chat; nenhum arquivo Comercial editado neste checkout | Encaminhamento direto ainda sem ID acessível; não criar tarefa duplicada |
| Cursor #261/#264 | Branches Cursor intocadas; `861513cd` é descendente da main `baba91a6`, não integrado à main | Integração anterior preservada como base deste checkout Codex |
| Codex Legado | `scripts/legado/mapear-registro-sintetico.mjs`, `consumir-lote-staging.mjs`, testes e documentação de mapeamento | Branch Codex isolada; mestres de Grupo, classificação Produto, conflito/idempotência |
| Cursor Legado #211 | Verificador, proveniência, vínculo jurídico e staging isolado | Reutilizar na etapa real; não copiar mapper nem editar branch Cursor |

O HD foi detectado no host, mas a leitura de `04_REPORTS` foi negada pelo
sistema de arquivos. Nenhuma leitura de conteúdo, carga real, importação
operacional, migration ou alteração do backup ocorreu. `importAuthorized=false`.
Próximo gate: acesso somente leitura à pasta dos relatórios, procedência
verificada, destino isolado identificado e backup recuperável antes do piloto
real; evidência pública somente agregada e sanitizada.

## ORIENTAÇÃO COORDENADA — Auditoria global / C360 / Legado (2026-10-10)

Substitui a orientação anterior. Imagens = exemplos; escopo = **todo o sistema**.
Chat principal: [ERP ZUCCARO - CODEX/CURSOR](https://cursor.com/agents/bc-d973626e-1060-4071-a25a-6a549769392b).

| Papel | Quem | Branch/ambiente | Não editar |
|---|---|---|---|
| Coordenação + UI/recuperação funcional | **Cursor** | `#261` `cursor/cadastros-recuperacao-c360-contrato-392b` · erp-dev | sessão/contexto/outbox Codex |
| Contratos/sequências C360 | **Codex Comercial 360** | tarefa própria | Visualizador em lote Cursor sem coordenação |
| Migração/recuperação real | **Codex Legado** | staging VPS privado | não misturar SYNTH como recuperado |

### CURSOR — mandato ativo
1. Inventariar módulos/submódulos/entidades (matriz global).
2. Recuperar melhorias da azul-clara seletivamente (sem restaurar versão inteira).
3. Código numérico + ID técnico em listas/detalhes/forms.
4. Corrigir abertura dupla, carga incompleta, campos sumindo, busca, paginação, permissões.
5. Confrontar UI/API × legado privado; SYNTH ≠ recuperado.
6. Consolidar #261, CI, implantar e homologar SHA VPS.

### Primeira ação efetiva Cursor
Corrigido Visualizador: gate `Organizacional` no `data-permission`; fallback sem `codigo` em campos descritivos; `GrupoEmpresarial` inclui `id===groupId` no filtro.
**Implantado** erp-dev tip **`ea213906`** · `index-Dqf6E74p.js` · evidências `orientacao-coordenada-auditoria-global-20261010.txt` · `deploy-261-tip-ea213906-*`.

### Segunda ação efetiva Cursor — Fiscal RBAC
Causa: cards/botões usavam `Fiscal.Notas Fiscais.*` enquanto owner tree é `Fiscal.nfe|tabelas_fiscais|sped|obrigacoes`.
Correção: `sectionKey` canônico no launchpad + aliases UI→owner em `usePermissions`/`localBase44Client` + `NotasFiscaisTab` consulta `Fiscal.nfe` + teste focado owner.
Fail-closed preservado (gate por seção).
**Implantado** erp-dev tip **`7f00e392`** · `index-BAZjmDZB.js` · backup `pre-gate-e-20261010-104907.sql` · rollback `pre-spa-login-20261010-104908` · evidência `deploy-261-tip-7f00e392-fiscal-rbac-20261010.txt`.
**Homologado browser** (session inject API→localStorage): Fiscal/Financeiro/Comercial PASS · 0 badges.

### Terceira ação — #254 contexto + Cadastros RBAC residual
- Revisado #254 HEAD `860114ca` (race refresh/espelho/grade).
- Port seletivo em #261 **sem** remover piloto HTTP `entityListSorted`/`countEntities` nem Organizacional/Marcas do Visualizador.
- Cadastros: aliases ContatoB2B/Segmento/Região→pessoas; Depto/Cargo/Turno→organizacional; PerfilAcesso→`Sistema.acessos`.
- Inventário: `docs/evidence/inventario-global-modulos-20261010.txt`.
- Login xdotool continua quebrado; homolog usa API session + inject.

### Quarta ação — #254 tip `b11843c8` (corridas login/empresa) no #261
- Fonte: PR #254 branch `codex/cadastros-http-context-race-20261009` tip **`b11843c8`**.
- Portado no mesmo arquivo #261: `loginErpHttpSession.shouldAccept` + evento contexto no login; Auth `loginVersion`/`bootstrapComplete`/revalidate background; `assertCadastroFormScopeCurrent` + `getScopedCadastroPlaceholder` + `formScopeRef`.
- **Não** revertido: piloto HTTP, Organizacional `data-permission`, fallback sem codigo/sigla, `classify`/`merge` edit load, `grupoSelfOr`.
- CI tip **`95ee6179` SUCCESS**. Redeploy VPS pendente (ainda `7fe1067b` no erp-dev).
- #254 Codex: tip já incorporado em #261 — fechar/merge coordenado sem segunda cópia dos arquivos.

### Quinta ação — launchpads sectionKey (Compras/Estoque/Expedição/Financeiro)
- Mesmo padrão Fiscal.nfe: `sectionKey` canônico + aliases em `usePermissions`/`localBase44Client`.
- DetalhesCliente: `uniqueKey` por id (anti janela dupla).
- Evidência: `docs/evidence/inventario-launchpad-sectionkey-20261010.txt`.

### Sexta ação — tip `4c0c167a` implantado erp-dev
- CI SUCCESS · SPA `index-DFgiLWLi.js` · backup `pre-gate-e-20261010-122408.sql` · rollback `pre-spa-login-20261010-122409`.
- Bundle público confirma sectionKeys + shouldAccept + DetalhesCliente uniqueKey.
- P0 codigo: Cliente/Produto/TabelaPreco via `reserveEntityCodigo` (preserve incoming + high-water).
- Evidência: `docs/vps/evidence/deploy-261-tip-4c0c167a-integrado-20261010.txt`.
- **Supersedido** pela sétima ação (`7e515fbc`).

### Sétima ação — tip `7e515fbc` + homolog login tipado + Onda 5 Pedido UX
- Port #254 `f0844fa5` + Pedido Onda 5 + FormaPagamento codigo/ID.
- **Supersedido** pela oitava ação (`3108b9f2`). Evidência tip antigo: `deploy-261-tip-7e515fbc-homolog-login-20261010.txt`.

### Oitava ação — tip `3108b9f2` (#254 HEAD `4a1ecf4c` + azul global + consolidação)
- **Supersedido** pela nona ação (`0d458ab9`). Evidência tip antigo: `deploy-261-tip-3108b9f2-integrado-20261010.txt`.

### Nona ação — tip `0d458ab9` (Clientes API×UI + V23→V24)
- **Supersedido** pela décima ação (`bdeec58c`). Evidência: `deploy-261-tip-0d458ab9-clientes-v24-20261010.txt`.

### Décima ação — tip `bdeec58c` (salvar minify-safe)
- Crash salvar: `Function.name` some no bundle → self-managed falso → `onSuccess`→`handlePersistSubmit`→ErrorBoundary.
- Fix: `FormComponent.isSelfManagedCadastro = true` (+ displayName) em Cliente/Fornecedor/Representante/Produto V22.
- Freeze scope só quando sessão HTTP ≡ render (visão consolidada Grupo ok).
- **Implantado** erp-dev tip **`bdeec58c`** · asset `index-5EmU7-cb.js` · backup `pre-gate-e-20261010-134527.sql` · rollback `pre-spa-login-20261010-134528`.
- **Homologado neste SHA** fail_count=0: login · Clientes V24 n=5 · abrir/campo/salvar/reabrir · trocar Grupo · launchpads.
- Residual: usuário restrito · Legado #211 · ManagePR casing repo.
- Evidência: `deploy-261-tip-bdeec58c-salvar-minify-20261010.txt`.

### Décima primeira ação — integração #264 + #254 final `20a2c2fb` em #261
| Pacote | Valor |
|---|---|
| responsável | **Cursor** (merge na candidata #261) · Codex porte #254→#264 |
| HEAD referência #254 | **`20a2c2fb`** (ancestral de #261 pós-merge) |
| HEAD #264 Codex | **`d9403665`** · CI SUCCESS · base #261 `d31b9bbe`/`a004044b` |
| **PR HEAD #261** | tip branch · merge código **`861513cd`** · docs **`c9f845a8`+** |
| código incorporado | `useProdutoHttpEditLoad` · actorId/token no form scope/edit policy · cliente consolidado · **preservado** `isSelfManagedCadastro` minify-safe |
| **SHA implantado** | supersedido pela 13ª ação (**`00edfb2b`**) |
| sem cópia divergente | Cursor **não** re-portou #254 enquanto Codex fechava #264; merge preservou ambos os conjuntos |
| testes | produto-http-edit-load + edicao-load + pim-ui 40/40 |
| próxima | supersedido pela 13ª ação |

### Décima segunda ação — Contratos/C360 independente
- Contratos: ID técnico em `ContratoForm` + `ContratoDialogs` (≠ número).
- Central 360: código + ID técnico; orçamentos/pedidos com status e id (fonte canônica).
- ManagePR: URL lowercase `erp-zuccaro-codex` (PR #261).

### Décima terceira ação — tip `00edfb2b` implantado + homolog
| Pacote | Valor |
|---|---|
| **PR HEAD / implantado** | **`00edfb2b`** · asset `index-ChwPPG6e.js` |
| incorporado | #254 `20a2c2fb` · #264 `d9403665` · minify-safe · Contratos/C360 |
| CI | erp-runtime-ci **SUCCESS** (4) |
| backup | `pre-gate-e-20261010-142336.sql` sha256 `501c0400…ba5f` |
| rollback | `pre-spa-login-20261010-142346` |
| **homologado** | login tipado fail_count=0 (não inject) |
| evidência | `deploy-261-tip-00edfb2b-integrado-20261010.txt` |
| ≠ implantado antigo | `bdeec58c` supersedido neste redeploy |
| próxima | 14ª ação (ID técnico) · merge owner · #211 |

### Décima quarta ação — tip `6e397596` ID técnico implantado
- `CadastroCodigoRegistroField` + `entityId` · 22 forms · ClienteCompleto · Produto V22 · C360 fontes canônicas.
- **Implantado** erp-dev **`6e397596`** · `index-BE23NqEC.js` · backup `pre-gate-e-20261010-143842.sql` · rollback `pre-spa-login-20261010-143842`.
- **Homologado** login tipado fail_count=0 neste SHA.
- Usuário restrito: **BLOCKED** (`homolog-usuario-restrito-blocked-20261010.txt`).
- Evidência: `deploy-261-tip-6e397596-id-tecnico-20261010.txt`.

### Décima quinta ação — tip `f22d1151` Fornecedor/Representante implantado
- `CadastroFornecedorCompleto` + `RepresentanteFormCompleto` com `CadastroCodigoRegistroField`.
- **Implantado** **`f22d1151`** · `index-KP6RdCBA.js` · backup `pre-gate-e-20261010-144428.sql` · rollback `pre-spa-login-20261010-144429`.
- **Homologado** login tipado fail_count=0 neste SHA.
- Evidência: `deploy-261-tip-f22d1151-fornecedor-rep-20261010.txt`.
- Residual: secret usuário restrito · merge owner · Legado #211.

### Codex Comercial 360 / Legado
Receber contexto por este HANDOFF; executar nos ambientes próprios; confirmar encaminhamento com ação efetiva (não só ack).
Contratos CPA/compartilhados e recuperação real: Legado (#211); Cursor prepara UI/consumo sem SYNTH.
#254 tip **`20a2c2fb`** + #264 tip **`d9403665`** em #261 tip implantado **`00edfb2b`** — merge owner; não abrir segundo porte.

## CURSOR — #261 tip `d6952b9d` implantado (2026-10-10)

| Item | Valor |
|---|---|
| responsável | Cursor |
| candidata | [#261](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/261) · `#258⊂#259⊂#260⊂#261` |
| tip | **`279f26fc`** · asset `index-D_uICNJK.js` (runtime forms em `d6952b9d`+) |
| delta | forms MASTER_CODE `codigo-registro` · HTTP `order_by` (Bugbot) · lint hasId |
| **implantado** | erp-dev · mig 038+039 · backup `pre-gate-e-20261010-100519.sql` · rollback `pre-spa-login-20261010-100519` |
| **homologado API** | CPA create/reopen/convert/dup409/cross404 PASS |
| **recuperado** | NÃO legado (#211) · auxiliares codigo API OK |
| UI | BLOCKED #254 Codex |
| ≠ | sessão/contexto/outbox Codex |
| evidências | `deploy-261-tip-d6952b9d-*` · `homolog-261-tip-d6952b9d-c360-*` |
| próxima | CI tip → merge owner; #254; #211 |

## CURSOR — #261 candidata integração + homolog API (2026-10-10)

| Item | Valor |
|---|---|
| tip | supersedido por **`d6952b9d`** acima |

## CURSOR — #261 tip `bd2fa504` implantado (2026-10-09T20:50Z)

| Item | Valor |
|---|---|
| tip | supersedido pelo bloco candidata 2026-10-10 acima |

## CURSOR — Cadastros recuperação + C360 contrato 039 (2026-10-09)

| Item | Valor |
|---|---|
| responsável | Cursor |
| tip | supersedido por **`bd2fa504`** implantado acima |

## CURSOR — #260 tip `18113337` implantado + homolog (2026-10-09T19:52Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch / PR | `cursor/comercial360-fluxo-cliente-orc-pedido-392b` · [#260](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/260) |
| tip | **`18113337`** |
| CI | **SUCCESS** · MERGEABLE |
| **implantado** | erp-dev · `index-wiWHreg3.js` · backup `pre-gate-e-20261009-194341.sql` · rollback `pre-spa-login-20261009-194342` |
| **homologado** | Orçamento busca+gap PASS · Pedido busca/tabela PASS · 3Z PASS |
| **importado** | **NÃO** |
| #259 | tip `55fcac4f` · MERGEABLE · merge owner |
| #258 | ancestor de #259 |
| #254 / #211 | Codex |
| evidências | `deploy-260-*` · `browser-260-*` |
| próxima | supersedido pelo lote recuperação+039 |

## CURSOR — Comercial 360 picker + #259 closeout (2026-10-09T19:40Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| #259 | tip **`55fcac4f`** implantado · CI SUCCESS · MERGEABLE · Setor/UM/Grupo edit+codigo **PASS** |
| #258 | ancestor OPEN — merge #259 cobre |
| Comercial 360 | supersedido pelo tip **`18113337`** implantado |
| **importado** | **NÃO** (#211 staging) |
| registros | matriz `registros-recuperacao-matriz-20261009.txt` · Fornecedor schema ausente · SYNTH≠legado |
| Financeiro menus | inventário `financeiro-menus-nav-20261009.txt` · sem módulo paralelo |
| #254 / #211 / outbox | **reservado Codex** — Cursor não edita sessão/contexto/outbox |
| mig | VPS 001–024+**038**; Codex 025–037 intocados |
| próxima | merge #259/#260 após owner |

## CURSOR — #259 tip `55fcac4f` implantado + homolog (2026-10-09T18:55Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch / PR | `cursor/cadastros-codigo-abrir-unico-392b` · [#259](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/259) |
| tip | **`55fcac4f`** |
| CI | **SUCCESS** |
| **implantado** | erp-dev · `index-DlbCJL3w.js` · mig **038** · backup `pre-gate-e-20261009-183944.sql` |
| **homologado** | Grupo/Marca Abrir=1 + edit+codigo PASS · Setor/UM supersedido closeout 19:35Z |
| **importado** | **NÃO** |
| #258 | ancestor — merge #259 cobre #258 |
| #254 / #211 | Codex |
| evidências | `deploy-259-*` · `browser-259-*` · inventário completo |
| próxima | merge #259 após owner; fechar #258 |

## CURSOR — Cadastros código + Abrir único tip `c2e32750` (2026-10-09)

| Item | Valor |
|---|---|
| tip | **`c2e32750`** (pré-fix CI) |
| mudança | Abrir único; código auxiliares; edit merge |
| **implantado** | **NÃO** |

## CURSOR — #258 badge Clientes HTTP tip `d9a72802` (2026-10-09T16:07Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch / PR | `cursor/homolog-254-cadfin-360-legado-392b` · [#258](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/258) |
| tip | **`e94f39b2`** (CI) · runtime implantado **`d9a72802`** |
| CI | erp-runtime-ci **SUCCESS** (`e94f39b2`) |
| **implantado** | **`d9a72802`** erp-dev · asset `index-okyVzZdT.js` · rollback `pre-spa-login-20261009-155123` |
| mudança | `countEntities` batch → piloto HTTP; filtro contagem = multiempresa Visualizador |
| **homologado** | hub badge Clientes=5 · V24 badge=5 · rows=5 · API n=5 (tip = d9a72802) |
| ops DB | clientes=6 · produtos=4 · empresas=3 · auxiliares OK · `fornecedores` tabela ausente |
| registros | preservados ops; volume legado só staging; sem reseed |
| #254 Codex | **reservado** |
| #211 | staging 20456 · authorized=0 · **importado=NÃO** · consumidor testes PASS |
| fases | implementado=sim · integrado=PR · implantado=sim · homologado=badge/lista · importado=não |
| próxima ação | CI tip `d9a72802` → merge #258 após owner; Codex #254/#211 contrato+crosswalk |

Evidências: `deploy-258-count-badge-d9a72802-20261009.txt`, `browser-258-count-badge-d9a72802-20261009.txt`, `registros-sumidos-fonte-api-ui-20261009.txt`, `legado-211-ensaio-consumidor-20261009.txt`.

## CURSOR — #258 ciclo edição Cliente PASS tip `02d59aa6` (2026-10-09T15:22Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch / PR | `cursor/homolog-254-cadfin-360-legado-392b` · [#258](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/258) |
| tip | **`02d59aa6`** |
| **implantado** | **`02d59aa6`** erp-dev · asset `index-BD0zl8Pi.js` · CLIENTE_360=true · rollback `pre-spa-login-20261009-151957` |
| mudança | RBAC Salvar=`editar`/`criar`; `toClienteMasterHttpPayload` allowlist; lista HTTP + consumidor (tips anteriores) |
| validado browser | Cadastros layout+busca PASS · lista n=5 PASS · **Cliente abrir→salvar→reabrir PASS (PATCH 200)** · Empresa PASS · Central360 PASS · Financeiro PASS |
| #254 Codex | **reservado** — Cursor não edita sessão |
| #211 | staging privado; **importado=NÃO** |
| fases | staging=contagens · reconciliado=consumidor · importado=não · **validado_nav=sim (ciclo completo)** |
| próxima ação | CI tip → merge #258 → main; Codex #254 rebase; Legado ensaio isolado |

Evidências: `deploy-258-cliente-cycle-02d59aa6-20261009.txt`, `browser-258-cliente-cycle-02d59aa6-20261009.txt`.

## CURSOR — #258 lista HTTP Cadastros + edição + consumidor (2026-10-09T14:45Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch / PR | `cursor/homolog-254-cadfin-360-legado-392b` · [#258](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/258) |
| tip | **`7418243f`** (+ `data-action` editar Visualizador pendente no tip seguinte) |
| **implantado** | **`7418243f`** erp-dev · asset `index-Bc213K00.js` · CLIENTE_360=true · rollback `pre-spa-login-20261009-143634` |
| mudança | `entityListSorted`→piloto HTTP (Cliente com flag); consumidor `consumir-lote-staging.mjs`; merge/classify edição |
| validado browser | Cadastros layout+busca PASS · Clientes lista n=5 PASS · edição abrir preenchido PASS · Empresa ciclo PASS · Central360 PASS |
| #254 Codex | **reservado** — Cursor não edita sessão |
| #211 | staging privado; **importado=NÃO**; consumidor testado (não mapper paralelo) |
| fases | staging=contagens · reconciliado=testes consumidor · importado=não · validado_nav=sim (lista/abrir) |
| próxima ação | CI tip · merge #258 → main; Codex #254 rebase; Legado ensaio isolado |

Evidências: `deploy-258-http-list-7418243f-20261009.txt`, `browser-258-cadfin-edit-7418243f-20261009.txt`.

## CURSOR — homolog #254 + CadFin/360 + consumidor legado (2026-10-09T12:10Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch | `cursor/homolog-254-cadfin-360-legado-392b` |
| #254 | parecer **APROVAR COM RESSALVAS** tip `fd1778f6` · arquivos **reservados Codex** (`erpHttpSession` / `useContextoGrupoEmpresa` / `useContextoVisual`) — Cursor **não** edita |
| mudança Cursor | `cadastroEditLoadPolicy` merge/classify (edição sem esvaziar); mapper legado +`fornecedor`; evidências sanitizadas |
| homolog tip implantado | `baba91a6` · login/CPA/contexto/Cadastros azul/edição Empresa/Financeiro CR≠Régua PASS · API×DB (clientes/produtos) ≠ lista V24 vazia |
| #211 Legado | checksum+CNPJs já OK nos comentários · stage VPS `legacy-stage-20261009T115402Z` · staging 20456 / quarentena 4722 · **importado=NÃO** |
| preservado | auxiliares ERP novo; visual azul; sem reseed; sem PII no GitHub |
| testes | cadastro edit load + legado mapear = **28/28** |
| próxima ação | Codex rebase #254 (STATUS) → merge → deploy; Legado vincular `target_empresa_id` + gate importação |

Evidências: `parecer-254-fd1778f6-20261009.txt`, `browser-homolog-254-cadfin-360-baba91a6-20261009.txt`, `legado-211-stage-consumo-20261009.txt`.

## CURSOR — padrão azul Comercial + auxiliares (2026-10-09T11:40Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch | `cursor/comercial-azul-padrao-visual-392b` |
| mudança | hub Comercial tiles → blue uniforme; V24 fallback Nome→descricao/nome_grupo; colunas auxiliares codigo-first |
| preservado | todos os módulos Comercial; auxiliares existentes; Financeiro CR≠Régua |
| testes | `comercial-azul-padrao-visual` + inventário + clientes-tab |
| #255 | já MERGED/validado `99ee35b0` |
| #254 Codex | não tocado |
| ref | `ref-visual-azul-aprovado-proprietario-20261009.txt` + artifacts `ref-visual-aprovado/*` |
| próxima ação | CI → merge → rebuild tip → browser Comercial azul + Cadastros auxiliares |

## CURSOR — #255 MERGED main `99ee35b0` + ajuste proprietário (2026-10-09T11:05Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| #255 | **MERGED** `99ee35b0` · implantado erp-dev · rollback `pre-spa-login-20261009-110013` |
| validado | Central360 PASS · Cadastros+azul PASS · Financeiro+CR≠Régua PASS |
| regras | AGENTS.md §14.1 — exemplos/sintéticos ≠ carga operacional/legado; sem reseed por lista vazia |
| visual | ref `ref-visual-azul-financeiro-20261009.txt` · testes regressão cores no inventário Financeiro |
| Codex #254 | **reservado Codex** — `erpHttpSession` / `useContextoGrupoEmpresa` / `useContextoVisual` · Cursor **não** edita |
| Codex Legado | staging privado + backup original; conflitos/lacunas; dados reais **fora** do GitHub |
| próxima ação | Codex concluir #254 (sessão/troca empresa); Cursor não reseed; legado prepara ETL staging |

Evidências: `deploy-255-main-99ee35b0-20261009.txt`, `browser-255-main-99ee35b0-20261009.txt`.

## CURSOR — DetalhesCliente→Central360 entry tip `b2ce9611` (2026-10-09T10:36Z)

| Item | Valor |
|---|---|
| responsável | Cursor |
| branch / PR | `cursor/comercial-detalhes-cliente-360-entry-392b` · [#255](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/255) |
| tip | **`b2ce9611`** |
| CI | **PASS** (erp-runtime-ci) |
| parecer | APROVAR COM RESSALVAS → `parecer-detalhes-cliente-360-entry-20261009.txt` |
| implantado | **`b2ce9611`** erp-dev · asset `index-DbVDch1Q.js` · CLIENTE_360=true |
| rollback | `pre-spa-login-20261009-101703` |
| validado browser | login/CPA · v24 · cliente-novo · **cliente-detalhes-360→Central360 PASS** · Carregar mais UI NO_BUTTON_MAYBE_EOF · API limit/offset PASS |
| #251/#252 | MERGED em main `d6cca4c2` (ancestrais); tip entry ainda **não** em main |
| próxima ação | **merge #255 → main** → rebuild spa-login no tip main → revalidar browser com evidência nova do SHA de merge |

≠ Codex outbox/legado. Evidências: `deploy-360-entry-b2ce9611-20261009.txt`, `browser-360-entry-b2ce9611-20261009.txt`.

## CURSOR — #251+#252 em main `d6cca4c2` (2026-10-09T10:10Z)

| Pacote | integrado | implantado | validado |
|---|---|---|---|
| #251 | `96287638` | superseded por d6cca4c2 | Empresas/Financeiro/API 360 PASS |
| #252 | **`d6cca4c2`** MERGED | **`d6cca4c2`** erp-dev | Novo Cliente Cadastros+Ações PASS |
| #248/#249/#250 | MERGED via #251 | — | ancestrais OK |

Rollback: `pre-spa-login-20261009-100721`. Flag CLIENTE_360=true.
Evidências novas: `deploy-252-main-d6cca4c2-20261009.txt`, `browser-252-main-d6cca4c2-20261009.txt`, `deploy-251-main-96287638-20261009.txt`, `browser-251-main-96287638-20261009.txt`.

### Próxima entrega (reservada Cursor)
`cursor/comercial-detalhes-cliente-360-entry-392b` — wire `DetalhesCliente`+Central360 a partir do Visualizador/Comercial. ≠ Codex outbox.

## CURSOR — #251 MERGED+implantado `96287638` (2026-10-09T10:06Z)

| Fase | Estado |
|---|---|
| implementado | #248+#249+#250 no merge-tree |
| revisado | APROVAR COM RESSALVAS |
| **integrado** | **`96287638` MERGED #251 → main** |
| **implantado** | **`96287638`** erp-dev · flag CLIENTE_360=true · rollback `pre-spa-login-20261009-095826` |
| **validado** | Playwright Empresas/Financeiro/sugestão PASS · API paginação/isolamento PASS · Central360 UI DetalhesCliente FAIL_NAV |
| #248/#249/#250 | **MERGED** (ancestrais em main) |
| #252 | rebase `d766e5df` · parecer APROVAR COM RESSALVAS · CI a correr |

Evidências: `deploy-251-main-96287638-20261009.txt`, `browser-251-main-96287638-20261009.txt`.
Próximo: merge/deploy #252; abrir consumidor DetalhesCliente se UI 360 for P0.

## CURSOR — #252 rebase pós-#251 (2026-10-09T10:03Z)

Branch `cursor/comercial-clientes-tab-v24-392b` · rebase `origin/main` `96287638` (#251 MERGED).
| Fase | Estado |
|---|---|
| implementado | ClientesTab V24 + Ações Rápidas fail-closed + `cliente-novo` |
| revisado | **APROVAR COM RESSALVAS** (rebase obrigatório — feito) |
| overlap #251 | só STATUS/HANDOFF (runtime NONE) |
| CI | a correr pós-push |
| implantado | não |
| validado | testes focados + browser a seguir |

≠ Codex outbox/legado.

## CURSOR — #251 parecer publicado + fechamento (2026-10-09T09:55Z)

| Item | Valor |
|---|---|
| tip branch | `6ed9e7dc` |
| runtime | `dd13fb5f` |
| parecer | **APROVAR COM RESSALVAS** → `docs/vps/evidence/parecer-251-dd13fb5f-20261009.txt` |
| CI | PASS |
| overlap #252 | só STATUS/HANDOFF (runtime disjunto) |
| merge main | em curso |
| PR body GitHub | tentativa update; se BLOCKED, este handoff é canônico |

## CURSOR — #251 CLIENTE_360 ON + validação (2026-10-09T09:43Z)

| Item | Valor |
|---|---|
| código implantado | **`dd13fb5f`** |
| flag | `VITE_ERP_HTTP_CLIENTE_360=true` (após prova Auth supabase_user) |
| spa_asset | `index-B0gNWKWR.js` |
| browser Central360 | **PASS** (visível) |
| carregar mais UI | NO_BUTTON_MAYBE_EOF nesta vista; API limit/offset já PASS |
| sugestão UI Novo | BLOCKED_NAV no path Cadastros headless → lote indep. [#252](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/252) |
| branch tip docs | `3e0d61dd`+ |
| merge main | **não** |
| PRs redundantes #248/#249/#250 | manter abertas até merge #251; inventário no handoff anterior |

Evidências: `deploy-251-c360-flag-on-dd13fb5f-20261009.txt`, `browser-251-c360-flag-on-dd13fb5f-20261009.txt`.

## CURSOR — #251 continuidade (2026-10-09T09:39Z)

| Fase | SHA / estado |
|---|---|
| branch tip | `8ad3cdbd` |
| **implantado** | **`dd13fb5f`** erp-dev (asset `index-CMrmwZdE.js`) |
| CI | PASS tip `8ad3cdbd` + `dd13fb5f` |
| revisado | **APROVAR COM RESSALVAS** (parecer SHA final `dd13fb5f`; docs `8ad3cdbd` sem runtime) |
| integrado | PR #251 aberta; **não** merged em main |
| validado tip implantado | Playwright revalidação 2026-10-09: Empresas/Financeiro PASS; sugestão UI BLOCKED_NAV; 360 UI oculta (flag off) |
| Auth prova CLIENTE_360 | `/api/v1/meta` → `auth.mode=supabase_user` · `browserLogin=true` · `central360ReadModel=true` · env=dev **PASS** |
| PR body update | **BLOCKED** ManagePullRequest (repo rename) + `gh pr edit` (integration sem write) — corpo canônico neste handoff |

### Inventário incorporado (#248/#249/#250 → #251)
| Origem | Arquivos runtime |
|---|---|
| #249 | `Empresas.jsx`, `EmpresaSwitcher.jsx`, `input.jsx`, `localBase44Client.js`, `erpHttpSession.js`, `useContextoVisual.jsx`, `LaunchpadCard.jsx`, `ModulosGridFinanceiro.jsx`, `CaixaCentralLiquidacao.jsx`, `WindowModal.jsx`, `authSessionService.ts` + testes |
| #248 | `clienteSugestaoVinculoUi.js`, `CadastroClienteCompleto.jsx`, `httpApiClient.js` (sugestaoVinculo) + teste UI |
| #250 | `CentralCliente360Panel.jsx`, `centralCliente360Pagination.js`, `httpApiClient.js` (offsets), Dockerfile/compose flag, runtime test paginação |

Antes de fechar #248/#249/#250: merge #251 → main e confirmar ancestrais no tip merged.

### Lote indep. reservado (≠ #251)
Branch `cursor/comercial-clientes-tab-v24-392b` — `ClientesTab.jsx` → Visualizador V24 (Cadastros); `AcoesRapidasGlobal.jsx` data-action; **não** edita arquivos do #251.

≠ Codex outbox/legado/#236.

## CURSOR — pacote #251 implantado+validado `dd13fb5f` (2026-10-08T21:01Z)

| Fase | Estado |
|---|---|
| implementado | merge-tree #248 `bdf54b86` + #249 `4ab97760` + #250 `49e677ce` |
| revisado | **APROVAR COM RESSALVAS** |
| integrado | PR [#251](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/251) tip `dd13fb5f` (não merged em main) |
| **implantado** | **`dd13fb5f`** erp-dev (antes `54b9f9d0`) |
| **validado** | Playwright Empresas/Financeiro PASS · API paginação/sugestão/isolamento PASS |
| flag CLIENTE_360 | `false` — UI 360 oculta; API central-360 testada |
| rollback | `pre-spa-login-20261008-204827` · backup `pre-gate-e-20261008-204826.sql` |

Evidências: `docs/vps/evidence/deploy-251-integra-dd13fb5f-20261008.txt`, `browser-251-integra-dd13fb5f-20261008.txt`.
Pendência: UI Novo Cliente sugestão (BLOCKED_NAV headless); merge em main após aprovação humana.

## CURSOR — parecer integração #251 (2026-10-08T20:45Z)

| Item | Valor |
|---|---|
| branch | `cursor/cliente360-cadfin-integra-392b` |
| tip | `100cf997` |
| PR | [#251](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/251) |
| parecer | **APROVAR COM RESSALVAS** (revisão independente) |
| CI | em andamento |
| implantado | **não** |
| validado | **não** |
| flag CLIENTE_360 | `false` no deploy |

Ressalvas baixas: reset paginação via useEffect (sem vazamento cross-tenant); EmpresaSwitcher fallback HTTP sem groupId; Empresas FE sem usePermissions (pré-existente). Sem auto-mescla. Deploy DEV seguro após CI verde com flag off.

## CURSOR — pacote integração #248+#249+#250 (2026-10-08T20:55Z)

Branch `cursor/cliente360-cadfin-integra-392b` · base main `6ff6b0f2`.
Merge-tree: #249 `4ab97760` + #248 `bdf54b86` + #250 `49e677ce` (reset escopo + flag CLIENTE_360).

| Fase | Estado |
|---|---|
| implementado | HEADs das 3 PRs no branch de integração |
| revisado | pendente |
| integrado | merge-tree neste branch; **não** merged em main |
| implantado | **não** — erp-dev tip anterior `54b9f9d0` ≠ pacote |
| validado VPS | **não** |

Flag `VITE_ERP_HTTP_CLIENTE_360` default `false`. ≠ Codex outbox/legado.

## CURSOR — Onda 3 sugestão UI race-guard (#248)

Arquivos: `clienteSugestaoVinculoUi.js`, `CadastroClienteCompleto.jsx`, `httpApiClient.js` sugestaoVinculo.
Race: `buildClienteSugestaoVinculoRaceKey` + `shouldApplyClienteSugestaoVinculoBanner` descartam resposta atrasada.
Sem mescla automática. HEAD `bdf54b86`.

## CURSOR — #248 validado API/bundle + #249 restaurado (2026-10-08T20:17Z)

| frente | integrado | implantado | validado |
|---|---|---|---|
| [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) Empresas/Financeiro | tip `54b9f9d0` / save `1e691933` | **`54b9f9d0`** erp-dev (atual) | browser PASS save/seletor/CNPJ/Caixa |
| [#248](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/248) sugestão UI | `bdf54b86` CI PASS | temporário `bdf54b86` → restaurado | API ausente+401+mescla proibida+bundle PASS; UI Novo janela BLOCKED_NAV headless |

Evidências: `browser-249-empresas-save-1e691933-20261008.txt`, `browser-248-sugestao-bdf54b86-20261008.txt`, `deploy-249-restored-54b9f9d0-20261008.txt`.

Lote independente reservado: Central 360 paginação por bloco → branch `cursor/comercial360-onda3-central360-pagina-392b`. ≠ Codex outbox/legado.

## CURSOR — #249 validado browser `1e691933` (2026-10-08T20:08Z)

| fase | estado |
|---|---|
| integrado | PR [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) tip docs `b297b50d` / código save `1e691933` |
| implantado | **`1e691933`** erp-dev |
| validado | **PASS** switcher Grupo×Empresa · lista · save/reopen fantasia · CNPJ origem · Caixa open |

Evidência: `docs/vps/evidence/browser-249-empresas-save-1e691933-20261008.txt`. ≠ #248 / Codex.

## CURSOR — implantado #249 `1e691933` (2026-10-08T20:04Z)

| fase | estado |
|---|---|
| integrado | PR [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) tip `1e691933` · CI no tip |
| implantado | **`1e691933`** erp-dev · rollback `pre-spa-login-20261008-200329` · backup `pre-gate-e-20261008-200329.sql` |
| validado browser | **PASS** (ver bloco abaixo) |

Causa save: RHF perdia digitação (`Input` spread após onChange) + remirror sessão sobrescrevia `nome_fantasia`. Testes focados 5/5. ≠ Codex outbox/legado. ≠ #248.

## CURSOR — CI verde #248/#249 (2026-10-08T17:33Z)

| PR | Tip CI | frontend/backend |
|---|---|---|
| [#248](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/248) sugestão UI | `bdf54b86` | **PASS** |
| [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) SPA/Financeiro/Empresas | tip branch incl. `9c19da80` | **PASS** |
| implantado erp-dev | `b81bc1cd` | — |

Aguarda review/merge. Persistência save Empresa segue BLOCKED.

## CURSOR — tip implantado `b81bc1cd` (2026-10-08T17:30Z)

| Pacote | Tip | PR | Estado |
|---|---|---|---|
| SPA UI + Financeiro + Empresas | **`b81bc1cd`** implantado erp-dev | [#249](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249) | Caixa/CR/CP/Conciliação/Lote/Cartões PASS; Empresas lista PASS; save Empresa BLOCKED local |
| Onda 3 sugestão UI + race | `bdf54b86` | [#248](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/248) | testes 5/5; aguarda CI/merge |
| Legado destino | tip `fff3abc8` · main `6ff6b0f2` | — | contratos #113/#246/#245; sem reprocessar backup |
| rollback | `pre-spa-login-20261008-173140` | — | |

Evidências: `docs/vps/evidence/browser-financeiro-pos-caixa-9b2c9b63-20261008.txt`, `browser-financeiro-caixa-08da3b8e-20261008.txt`, `browser-empresas-lista-empresa-2e50ee33-20261008.txt`.

## CURSOR — Empresas save regime + carimbar group_id (2026-10-08T17:25Z)

| Item | Estado |
|---|---|
| tip | tip local pós-regime/carimbar (base `2e50ee33` implantado) |
| lista escopo empresa | PASS edits=2 |
| save falhava | regime_tributario vazio no edit + carimbar `group_id`←empresaId |
| fix | defaults REGIMES/TIPOS no handleEdit; carimbar não estampa group_id como campo empresa; payload preserva group_id |
| testes | empresas-dialog-edit + contexto-multiempresa-policy PASS |

## CURSOR — Empresas lista no escopo empresa (2026-10-08T17:22Z)

Causa: `filterInContext('Empresa', …, 'group_id')` + `getFiltroContexto('group_id')` sobrescrevia `group_id` com UUID da empresa → lista vazia sem Editar.
Fix: `MASTER_GROUP_SET` em `useContextoVisual` (leitura só por groupId canônico) + `queryKey` `empresas-cadastro` com `groupIdCadastro`.
Testes: empresas-dialog-edit + contexto-multiempresa-policy **17/17**.
Branch `cursor/spa-ui-empresas-financeiro-clicks-392b` · PR **#249**. ≠ Codex #209 / outbox.

## CURSOR — paralelo SPA UI + Onda 3 sugestão UI (2026-10-08T17:06Z)

| Pacote | Branch | SHA tip | Estado |
|---|---|---|---|
| SPA UI + Caixa Button | `cursor/spa-ui-empresas-financeiro-clicks-392b` | `9b2c9b63` | **implantado** erp-dev · PR **#249** |
| Onda 3 sugestão vínculo UI | `cursor/comercial360-onda3-sugestao-ui-392b` | `ce99d428` | implementado; PR **#248** draft |

PR sugestão UI: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/248  
PR SPA UI / Financeiro: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/249

### Legado / destino erp-dev (contratos; sem reprocessar backup)
| Campo | Valor |
|---|---|
| **implantado tip** | **`9b2c9b63`** |
| main integrado | `6ff6b0f2` (#247) · contém #113/#246/#245 |
| contratos no destino | #231 snapshots · #226 Cadastros · #225/#246 Financeiro · #113 sugestão API · #203/#237 outbox · #239 troca empresa · #242 acesso VPS |
| snapshots públicos | ausentes |
| escrita títulos reais | proibida neste lote (só sintético/isolado) |
| rollback | `pre-spa-login-20261008-170810` |

Evidência: `docs/vps/evidence/browser-financeiro-caixa-08da3b8e-20261008.txt` · `docs/vps/evidence/browser-financeiro-pos-caixa-9b2c9b63-20261008.txt`.

## CURSOR — SPA UI empresas/financeiro implantado `677b1ab1` (2026-10-08)

| Fase | Estado |
|---|---|
| implementado | `11fd3510` |
| integrado | PR pendente (`cursor/spa-ui-empresas-financeiro-clicks-392b` → main) |
| **implantado** | `11fd3510` |
| auth `empresas[].cnpj` | **PASS** |
| /Empresas lista CNPJ | **PASS** |
| Financeiro cores CR≠Régua | **PASS** |
| seletor/Editar/close browser | PARTIAL (overlays Chrome) |
| rollback | `pre-spa-login-20261008-161558` |

Evidência: `docs/vps/evidence/browser-spa-ui-677b1ab1-20261008.txt`. ≠ outbox/legado.

## CURSOR — validação login API pós-secrets (2026-10-08)

| Fase | Estado |
|---|---|
| implantado | `68c311cc` (superseded por `677b1ab1` acima) |
| login API | **PASS** 200 (secrets Environment) |
| CPA/3Z IDs | CPA=`cccccccc-…` · 3Z=`c2c2c2c2-…` (mesmo group) |
| isolamento pedidos | **PASS** CPA 0 ≠ 3Z 3 |
| sugestao-vinculo #113 | **PASS** 200 + mescla proibida |
| browser UI Cadastros/Financeiro | ver seção `677b1ab1` |

Evidência: `docs/vps/evidence/browser-api-login-68c311cc-20261008.txt`.

## CURSOR — #113 Onda 3 sugestão vínculo (2026-10-08T15:09Z)

| Fase | SHA |
|---|---|
| implementado | `502122bc` |
| **integrado** | `68c311cc` MERGED #113 |
| **implantado** | `68c311cc` VPS |
| validado rota | `GET .../sugestao-vinculo` → **401** sem token (não 404) |
| validado CPA/3Z browser | BLOCKED `ERP_DEV_LOGIN_*` |

Evidência: `docs/vps/evidence/deploy-113-main-68c311cc-20261008.txt`. Rollback `pre-spa-login-20261008-150832`.
Contém também #246 Financeiro UX + #245 nginx 404-all.

## CURSOR — #246 integrado+implantado `64301fdb` (2026-10-08T15:01Z)

| Fase | SHA |
|---|---|
| implementado | `3faa46ff` |
| **integrado** | `64301fdb` MERGED #246 |
| **implantado** | `64301fdb` VPS rebuild |
| validado health/snapshots | sim |
| validado CPA/3Z browser | BLOCKED `ERP_DEV_LOGIN_*` |

Evidência: `docs/vps/evidence/deploy-246-main-64301fdb-20261008.txt`. Rollback `pre-spa-login-20261008-150055`.

## CURSOR — fases #245 reconciliadas (2026-10-08T14:52Z)

| Fase | SHA | Nota |
|---|---|---|
| implementado | `542be525` | nginx regex 404 |
| **integrado** | `dd6c211d` | MERGED #245 → main |
| **implantado** | `dd6c211d` | VPS rebuild pós-merge |
| validado health/snapshots | sim | 404 `base44-local-*.json` |
| validado CPA/3Z browser | **não** | secrets login ausentes |

Evidência: `docs/vps/evidence/reconcile-245-main-vps-dd6c211d-20261008.txt`.
Rollback: `pre-spa-login-20261008-145118`.

## CURSOR — #246 Financeiro scope + stale cancel (2026-10-08)

| Fase | Estado |
|---|---|
| implementado | `cancelFinanceiroQueriesOnScopeSwitch` + reset CR/CP/Caixa/Cartões/Conciliação/Lote |
| integrado | PR #246 (rebase main `dd6c211d`) — CI a correr |
| implantado | **não** (aguardar merge) |
| validado VPS browser | BLOCKED `ERP_DEV_LOGIN_EMAIL` + `ERP_DEV_LOGIN_PASSWORD` |

Testes focados empresa-switch **7/7**. ≠ outbox/legado/#245.

## CURSOR — estado vivo pós-validação (2026-10-08T14:25Z)

| Item | Valor |
|---|---|
| **implantado erp-dev** | **`542be525`** (branch #245 nginx 404-all; detached) |
| Anterior | `85049afd` (#243) — superseded |
| health/ready/web | **200** · RUNTIME-08B · supabase_user |
| Snapshots `base44-local-*.json` | **404** application/json (clientes/produtos/empresas/snapshot/core) |
| Browser CPA/3Z | **BLOCKED** — Environment sem `ERP_DEV_LOGIN_*` (pedido ao usuário) |
| Lote UX | `cursor/cadastros-financeiro-empresa-ux-392b` (rebase main; PR) |
| Legado destino | runtime **`542be525`**; contratos #231/#226/#225/#203/#237/#239/#242/#243/#245; **não** duplicar mapper; **não** vínculos sem prova |

> Seções abaixo com `implantado=9a277011` / `NONE` são **históricas**.

## CURSOR — Cadastros ↔ Financeiro ↔ empresa UX (2026-10-08)

Branch `cursor/cadastros-financeiro-empresa-ux-392b` · SHA `ec27b9f7` (base main). Gap: Financeiro sem scope `grupo:empresa` no queryKey/uniqueKey; CR/CP com seleção residual na troca; sem alerta sem contexto. Fix: `buildMultiempresaQueryScopeKey` + `buildFinanceiroTitulosScopeSwitchReset` em launchpad + tabs. Testes **47/47**. PR create **BLOCKED** (integration) — abrir: https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/new/cursor/cadastros-financeiro-empresa-ux-392b. ≠ outbox/legado. **Sem deploy VPS.**

## CURSOR — implantado erp-dev `542be525` (2026-10-08T14:24Z)

| Item | Valor |
|---|---|
| **implantado** | **`542be525`** · PR [#245](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/245) |
| Anterior | `85049afd` (#243) — superseded |
| Smoke | health/ready/web **200** · RUNTIME-08B · supabase_user |
| Snapshots `base44-local-*.json` | **404** JSON (clientes/produtos/empresas/snapshot/core) via HTTPS público |
| Rollback tags | `pre-spa-login-20261008-142359` (api+web) |
| Evidência | `docs/vps/evidence/deploy-542be525-snapshot-404-all-20261008.txt` |
| Browser CPA/3Z | **BLOCKED** sem `ERP_DEV_LOGIN_EMAIL`/`PASSWORD` |
| Legado destino | runtime **`542be525`**; sem mapper paralelo; sem vínculos sem prova |

> `implantado=9a277011` / `NONE` abaixo = histórico.

## CURSOR — validação pós-deploy + gap snapshots (2026-10-08)

| Item | Valor |
|---|---|
| **implantado erp-dev** | `85049afd` (main #243+#244) · web/api rebuilt ~14:12Z |
| health/ready :3080/:3081 | **200** ok/ready |
| HTTPS público | SPA 200; `/api/health`/`ready` 401 AUTH_REQUIRED (edge) |
| Snapshots canônicos | `/base44-local-snapshot.json` + `core` → **404** |
| Gap encontrado | `/base44-local-clientes|produtos|empresas.json` → **200 HTML SPA** (não JSON) |
| Correção | branch `cursor/spa-snapshot-paths-404-all-392b` (regex 404 todos `base44-local-*.json`) |
| Browser CPA/3Z | **BLOCKED** sem `ERP_DEV_LOGIN_EMAIL`/`PASSWORD` no Environment |
| Lote UX indep | `cursor/cadastros-financeiro-empresa-ux-392b` SHA `ec27b9f7` (PR a abrir) |
| Legado destino | erp-dev **85049afd**; sem vínculos empresariais sem prova; mapper não duplicar |

> Histórico abaixo com `implantado=NONE` / `9a277011` é **superseded** por esta seção.


## COORDENAÇÃO CURSOR → LEGADO — implantado=`9a277011` (2026-10-08 pós-deploy)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)
Agente Legado: [Legado: versão implantada](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9)
PR: [#211](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/211)

| Campo | Valor |
|---|---|
| **Versão efetivamente implantada em erp-dev** | **`9a277011`** (não mais NONE) |
| Imagens | `erp-api-dev` / `erp-web-dev` rebuild **2026-10-08T13:34Z** |
| Smoke VPS | health/ready/web **200** · `auth.mode=supabase_user` · meta **ERP-RUNTIME-08B** |
| Snapshots JSON públicos | **AUSENTES** (SPA HTML fallback ~1958B; 0 arquivos no nginx) |
| Contratos no destino | #231 snapshots · #226 Cadastros Organizacional · #225 Financeiro · #203/#237 outbox · #239 troca empresa · #242 acesso VPS canônico |
| Main GitHub tip | pode estar à frente só em docs (ex. `f6ec95bc`); **runtime VPS = `9a277011`** |
| Flags Legado | `importAuthorized=false` · sintético ≠ importação · **não** alterar vínculos empresariais · mapper #48 intocado |
| Checksum 153440Z | **UNVERIFIED** neste Cloud |
| Contagens REAIS backup | **0** processadas neste agente |

**HUMAN_NEXT (Legado — PC com HD):** somente verifier host-local — sem re-export/CADESP/transferência; sem tratar teste sintético como importação:
```bash
bash scripts/legado/executar-verifier-host-local.sh
# ou: --reports-dir "[caminho-privado] ERP ANTIGO - CODEX/04_REPORTS"
```
Colar só `PASTE_TO_GIT_HOST_*` + JSON do verifier.

**#211:** `gh pr edit` costuma falhar neste token — Cursor/humano: título `legado: erp-dev implantado=9a277011 — verifier host-local`; corpo = tabela acima + flags + HUMAN_NEXT verifier.

### Histórico — versão implantada=NONE (pré-deploy, obsoleto)
Antes do rebuild 13:34Z a VPS ainda estava em NONE (SPA last-mod 2026-09-27; snapshots HTTP 200; deploy BLOCKED SSH/MCP). Superseded pela seção acima.

## CURSOR — validação pós-deploy `9a277011` (2026-10-08)

| Item | Resultado |
|---|---|
| Versão VPS | **`9a277011`** implantada |
| health/ready/web | **200** |
| HTTPS meta | RUNTIME-08B · supabase_user |
| Snapshots JSON | **ausentes** (HTML fallback 1958B; 0 arquivos) |
| Browser CPA/3Z | em andamento (agente) |
| Defeito tratado | nginx passa a **404** nos paths legados (não mascarar com SPA) |
| Parecer Codex | #236 `6581cfec` — APROVAR runbook (sem rewrite) |
| Evidência | `docs/vps/evidence/validacao-pos-deploy-9a277011-20261008.txt` |


## ACESSO VPS CANÔNICO (Cursor + Codex) — 2026-10-08

Contrato operacional: `docs/OPERACAO_DEV_VPS.md` § «Acesso operacional Cursor / Codex».

| Item | Valor no Git | Segredo |
|---|---|---|
| Host | `srv1982741` · erp-dev.cpaferroeaco.com.br | IP não versionar |
| Path | `/opt/erp-zuccaro` | `.env.erp.dev` só na VPS |
| SSH user | tipicamente `root` | nome do secret: `ERP_DEV_VPS_SSH_USER` |
| SSH key | pubkey + fingerprint no OPERACAO_DEV_VPS | privada: `ERP_DEV_VPS_SSH_PRIVATE_KEY` (Environment Secret) |
| authorized_keys | deve conter `erp-zuccaro-vps` na VPS viva | hPanel sozinho não basta |

**Regra:** após qualquer deploy/backup/rollback VPS → atualizar este HANDOFF + `docs/vps/evidence/` + push. Trocar de PC não exige reenviar chave no chat se o Environment Cursor mantiver os secrets.

## CURSOR — deploy erp-dev main `9a277011` (2026-10-08T13:35Z)

| Fase | Estado |
|---|---|
| integrado | sim (main `9a277011`) |
| **implantado** | **sim** — SPA/API rebuild em srv1982741 |
| validado VPS (browser CPA/3Z) | **pendente** hard refresh + login real |
| snapshots públicos JSON | **ausentes** (fallback HTML SPA; não os dumps) |

- Backup: `pre-gate-e-20261008-133238.sql` · 845186 B · sha256 `1f1b55b2…` · evidence `docs/vps/evidence/pre-gate-e-backup-latest.txt`
- Rollback: `erp-zuccaro-erp-api:pre-spa-login-20261008-133314` / `…-web:…`
- Evidência: `docs/vps/evidence/deploy-main-9a277011-20261008.txt`
- Contém: #231 #226 #225 #203 #237 #239

**HUMAN_NEXT browser:** abrir https://erp-dev.cpaferroeaco.com.br/ com hard refresh → login → CPA/3Z → Cadastros Empresas → Financeiro.

## CURSOR — UX troca de empresa fail-closed (2026-10-08)

Agente: [Comercial UX empresa-switch](bc-5656ace2-6ada-57dc-87dd-81e7868ccc0c)
PR: [#239](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/239) · tip pós-rebase main (#240)

- Gap: troca de grupo/empresa fechava form sem zerar seleção em massa / isSaving / formKey.
- Fix: `buildCadastroScopeSwitchReset` + effect `scopeKey` no VisualizadorUniversal.
- Testes: `cadastros-empresa-edicao-load` **15/15** · CI SUCCESS.
- ≠ outbox #237 / legado.

## HISTÓRICO — Legado versão implantada=NONE (obsoleto) (2026-10-08)

**Versão efetivamente implantada em erp-dev: NONE.** Main tem #231/#226/#225/#203/#237 no código; SPA last-mod 2026-09-27; snapshots HTTP 200; deploy BLOCKED (SSH/MCP). Legado: só verifier no PC com HD.

## CURSOR — pacote frentes paralelas (2026-10-08)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)

| Fase | Main (#231…#237) | Deploy erp-dev | Legado |
|---|---|---|---|
| integrado | **sim** | código em main | scripts |
| implantado | **não** | **BLOCKED** SSH/MCP | não |
| validado VPS | **não** | snapshots HTTP 200 | N/A |

## CODEX Comercial — follow-up #226/#203 (2026-10-07T20:50Z)

Agente: [Comercial Cadastros Empresas](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a)

| Item | Estado |
|---|---|
| #226 ⊇ #227/#228/#229 | **SIM** · visual≡save Organizacional · merge `6dfd39d2` |
| #203 outbox | **MERGED** `2403586e` (tip `91675712`) · CI SUCCESS |
| #227/#228/#229 | **arquivar** (conteúdo em #226); close negado à integration — HUMAN close |
| Main | `2403586e` (#231+#226+#225+#233+#234+#203) |
| Deploy erp-dev | ainda BLOCKED VPS MCP |

## LEGADO — follow-up verifier (2026-10-07T20:50Z)

Agente: [Legado evidência ERP novo](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9)

| Campo | Valor |
|---|---|
| Estado | **BLOCKED** — execução real não avançou |
| Checksum | **UNVERIFIED** (`FOUND_EXPORT=NONE`) |
| Tentativa Cloud | `executar-verifier-host-local.sh` exit 4 `LEGACY_HOST_REPORTS_DIR_NOT_FOUND` |
| Host com backup | PC proprietário `[caminho privado preservado fora do Git]` (não este Cloud) |
| Workers | 0 · sem `usePrivateWorker` |
| Contagens reais | **0** processadas |
| Sintético (≠ efetivo) | staging 8→4/1/1/2 · vínculos 3/4 |
| PR | [#211](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/211) tip remoto `66f0520f` |

**HUMAN_NEXT (único bloqueio):** no PC com o HD → `bash scripts/legado/executar-verifier-host-local.sh` → colar saída sanitizada · ou `cursor worker start` nesse PC.

Dados reais / credenciais: fora do GitHub.

## TRÊS PACOTES — integrado em main (2026-10-07T20:45Z)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)
Main tip: `e2c51d84` (#231 + #226 + #225).

| Fase | #231 snapshots | #226 Cadastros | #225 Financeiro | Legado | erp-dev |
|---|---|---|---|---|---|
| implementado | sim | sim | sim | scripts/verifier | — |
| revisado | sim | sim | parcial (fluxo real local) | UNVERIFIED cloud | — |
| integrado | **MERGED** `c0efab11` | **MERGED** `6dfd39d2` | **MERGED** `e2c51d84` | — | código em main |
| implantado | **não** | **não** | **não** | não | **BLOCKED** VPS MCP timeout; workers 0; sem SSH neste Cloud |
| validado VPS | **não** — assets ainda HTTP 200 (~13.8MB / ~1.0MB) | **não** | **não** | N/A | RUNTIME-08B pré-promoção |
| dados reais | — | — | — | **0** (BLOCKED host HD) | — |

**Pendência concreta de implantar:** Hostinger VPS MCP `vps_virtual-machines_list` timeout (−32001); self-hosted workers = 0; sem chave SSH no ambiente Cloud. Autorização válida ≠ conexão efetiva.

**Arquivar (não mergear):** #227, #228, #229. Lote indep. Comercial: #203. Auth local #230 ≠ Auth VPS.

| Frente | Responsável | Próxima ação |
|---|---|---|
| CODEX Comercial | [bc-55d5261f](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a) | #203 outbox; confirmar arquive 227/8/9 |
| CURSOR | este chat | desbloquear VPS (MCP/SSH/worker) → backup → build/promover main `e2c51d84` → validar CPA/3Z + financeiro + snapshots 404 |
| CODEX Legado | [bc-4427c136](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9) | **BLOCKED** exit4 HD ausente; HUMAN_NEXT no PC com D: |

## TRÊS PACOTES ATÉ CONCLUSÃO — atualização (2026-10-07T20:40Z)

Chat: [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)

| Frente | Responsável | 1ª ação | Estado |
|---|---|---|---|
| CODEX Comercial | [Comercial Cadastros Empresas](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a) | #226⊇#227/8/9 + #203 | **#226 MERGED** `6dfd39d2`; arquivar 227/8/9; #203 indep. |
| CURSOR | este chat | merge #231→#226→#225; deploy; validar erp-dev | **#231+#226 em main**; #225 rebase; deploy **BLOCKED** VPS MCP timeout |
| CODEX Legado | [Legado evidência ERP novo](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9) | executor PC com HD | workers 0; HD não no Cloud |

### Fases

| Fase | #231 | #226 | #225 | Legado | erp-dev |
|---|---|---|---|---|---|
| implementado | sim | sim | sim | scripts | — |
| revisado | sim | sim | parcial | UNVERIFIED | — |
| integrado | **sim** | **sim** | tip | — | parcial |
| implantado | não | não | não | não | MCP timeout |
| validado VPS | não | não | não | N/A | snapshots ainda 200 |
| dados reais | — | — | — | pendente host | — |

## CODEX — candidata #226 ⊇ #227/#228/#229 (2026-10-07)

Matriz: `docs/MATRIZ_226_CONTEM_227_228_229.md`. **#226 MERGED**. PRs a arquivar: #227, #228, #229.

## CURSOR — Financeiro #225 (2026-10-07)

- Rebase sobre main (#231+#226). Launchpad grant plano + fluxo ContaReceber A/B.
- Próximo: merge #225 → deploy → validar CPA/3Z e financeiro na VPS.

## CURSOR — 3 frentes + Financeiro launchpad (2026-10-06)

| Frente | Responsável | Arquivos quentes | Não tocar |
|---|---|---|---|
| Cadastros/Empresas | Comercial #226 **MERGED** | — | — |
| Legado | [Legado](bc-4427c136-a373-5bb6-83b8-ffa135fdb2d9) | verifier HD | CADESP |
| Financeiro | Cursor #225 | Financeiro.jsx, financeiroLaunchpadAccess.js | Cadastros tip |

## Checkpoint Onda 15 - limpeza outbox na troca de Empresa (2026-10-06)
- Branch `cursor/comercial360-onda15-outbox-claim-392b`: `ProdutoRelationsDamSection` zera variantes/equivalentes/mídia/métricas/dead-letter quando `empresaId`/produto/view faltam — fail-closed entre tenants.
- Teste estrutural em `tests/produto-pim-ui.test.js`. Sem publisher externo.
- Coordenação pacotes paralelos: Comercial = candidata/#219/#221 + ledger; Legado = export/CADESP/staging; Cursor = revisão #221 + outbox/DAM nesta branch. Não editar router/STATUS da candidata daqui.

## Checkpoint Onda 15 - PG concorrencia + consumidor prepared (2026-10-04)
- Branch `cursor/comercial360-onda15-outbox-claim-392b`: alem de claim/lease/projecao, E2E PG cobre claim concorrente, lease/executor antigo, retry→DL, isolamento A/A2/B e rollback; consumidor prepared fail-closed para external.
- Meta `outboxConsumerPrepared`. Env: `ERP_OUTBOX_CONSUMER_MODE` / fake outcome / channel flags (sem segredo).
- Divisao Cursor vs Comercial: ver secao de coordenacao na branch #202 (`docs/HANDOFF_ATUAL.md`); Comercial nao edita midia/outbox deste pacote.
- Bloqueado: publisher real, cron VPS, Auth, tip-port.

## Checkpoint Onda 15 - claim/lease + projecao allowlisted (2026-10-02)
- Branch `cursor/comercial360-onda15-outbox-claim-392b`: claim/confirm/fail/reprocess/discard/list/metrics + UI prepared; projecao allowlisted no emit e no FakeCatalogPublisher (rejeita custo/margem/ncm/URL).
- Rotas: GET outbox (+produtoId) + outbox/metrics; POST claim/process/confirm/fail/reprocess/discard.
- Bloqueado externo: publisher real, Storage/Auth/VPS, reconciliacao de canal.

## Resposta Codex ao contrato Cursor do canario - PR #34 secao 4 (2026-09-24)
- Fonte: PR #33 branch codex/comercial-360 em bfdfe834; PR #34 branch cursor/vps-hml-gate-c-legado-392b em e40a8a61. Main ainda ca417160. O Gate C foi marcado aprovado pelo Cursor com evidencias sanitizadas; isso NAO autoriza D/E/F, migration ou Auth novo.
- 1. EXPECTED_RUNTIME=ERP-RUNTIME-08B. `server/src/api/router.ts` fixa esse valor em `/api/v1/meta`. O default `COMERCIAL-360-V1` de `scripts/deploy/comercial360-canary.sh` esta incorreto para este candidato; antes do Gate D passar EXPECTED_RUNTIME explicitamente e ajustar o default em checkpoint validado. Revalidar meta na imagem da MAIN, nao confiar em branch.
- 2. `auth.mode=supabase_user` e requisito de aceitaçao, nao fato do DEV. `server/src/config/env.ts` permite configurar ERP_AUTH_MODE=supabase_user e exige SUPABASE_URL+SUPABASE_ANON_KEY; producao usa este modo por padrao e rejeita dev_headers. `requestContext.ts` valida Bearer no Supabase Auth e resolve `profiles.auth_user_id` ativo e escopado. O canario deve iniciar com configuracao local segura e o smoke deve verificar `/meta` + requisiçao autenticada real. Nao exibir env, token ou chave.
- 3. Gate E: aplicar somente migrations faltantes 016-024 da MAIN ja revisada, em ordem numerica pelo migrator canonico, numa janela autorizada com backup NOVO e rollback preparado. Dividir o controle em 016-017 (Orcamento/Pedido) e 018-024 (Produto/PIM/DAM/canais), conferindo contagens e invariantes apos cada fatia; falha interrompe e bloqueia Gate D. Nao usar API de todo o Comercial 360 sobre esquema parcial; `test:postgres` real (>0, 0 fail/skip) ao final, sem reaplicar 001-015. Nenhuma fatia esta autorizada ou aplicada agora.
- 4. Tag futura `erp-zuccaro-erp-api:comercial360-main-<MERGE_SHA8>` construida somente do SHA efetivamente mesclado na MAIN. Registrar MERGE_SHA, image ID/digest obtidos do build/inspect e prova do canario usando a mesma imagem; nao reutilizar SHA da branch. Digest/tag finais INDETERMINADOS ate merge e build; nao alegar imagem imutavel existente.
- 5. `auth.users=0` e dois profiles ativos sem `auth_user_id` tornam smoke Bearer impossivel hoje. Em gate Auth separado e autorizado, provisionar identidade de teste exclusivamente sintética no Supabase Auth self-hosted, vincular seu UUID a profile ERP sintetico ativo no Grupo/Empresa sinteticos autorizados, com permissoes minimas Orcamento/Pedido. Validar scope positivo e RBAC/tenant negativos. Token, senha, email e chaves somente no ambiente seguro; nenhum valor no Git/log/handoff. Depois revogar sessao/desabilitar identidade de teste conforme procedimento auditavel. Nao reutilizar automaticamente os dois profiles existentes sem provar que sao sinteticos.
- Coordenacao: Cursor revisa este contrato e as verificacoes Gate D/E na PR #34; Codex revisa requisitos da PR #33. Ordem sugerida: fechar/revisar PR #34 documental-operacional primeiro; revisar PR #33 e seu default de runtime; so entao decidir merges por revisao humana e atualizar SHA da MAIN. PR #33 segue draft, sem merge; 3080 continua R07B.
- Frente independente Cliente 360 esta somente no workspace local, sem push e sem CI deste codigo; testes focados passaram, suite completa e build local sofreram OOM. Nao apresentar o endpoint como disponivel no remoto ou na VPS.

## Contrato Cursor/deploy - preco por ClienteEmpresa (2026-09-24)
- API read-only: GET /api/v1/tabelas-preco/preco-cliente?clienteEmpresaId=<uuid>&produtoId=<uuid>&unidadeMedidaId=<uuid>&businessDate=YYYY-MM-DD. Resposta {data: ResolvedPrice|null}; 422 para query/campo invalido, 403 para RBAC negado/ator ausente, 404 seguro para vinculo ClienteEmpresa fora do tenant. Nao enviar tabelaPrecoId, groupId ou empresaId na query; estes ultimos vem do contexto autenticado.
- Backend: TabelaPrecoService consulta ClienteRepository.getEmpresaLinkById no mesmo Grupo/Empresa e usa tabela_preco_id configurada no vinculo, com fallback para tabela padrao autorizada. Produto especifico de outra Empresa nao resolve; mestre compartilhado do Grupo pode resolver. RBAC exige Cadastros.tabela_preco.visualizar e Cadastros.cliente_empresa.visualizar.
- Nenhuma migration ou variavel nova. Frontend HTTP de TabelaPreco permanece nao ativado como piloto; nao ligar na 3080 R07B. Orcamento/Pedido e seus snapshots de itens nao foram alterados. Futuro consumo exige preco efetivo no servidor, regra comercial de alçada/desconto e teste de nao retroatividade antes de habilitar a captura em vendas.
- PR #33 continua draft. Migrations 023/024 somente codigo/CI; gate DEV real segue separado da CI efemera. Nenhuma aplicacao de migration, seed, Auth novo, canario ou promocao neste checkpoint.

## Contrato Cursor/deploy - resolucao de preco (2026-09-24)
- Onda 2: TabelaPrecoService.resolvePrice permanece contrato interno, sem rota nova, flag HTTP, migration ou configuracao. Requer contexto autenticado groupId/empresaId, TenantGuard e RBAC Cadastros.tabela_preco.visualizar; input estrito aceita produtoId, unidadeMedidaId, businessDate opcional YYYY-MM-DD real e clienteEmpresaTabelaId opcional. Nunca aceitar tenant/ator do payload.
- Repositories PostgreSQL e in-memory resolvem somente Produto ativo do Grupo, compartilhado (empresa_id NULL) ou proprietario da Empresa em contexto, e Unidade ativa do Grupo. Tabela e item continuam sujeitos a vinculo empresarial, vigencia e estado. ID de tabela especifica nao deve ser exposto como escolha livre ao frontend antes de validar o vinculo ClienteEmpresa.
- Orcamento/Pedido nao foram alterados. Ao integrar, escolher tabela autorizada pelo ClienteEmpresa/canal, calcular no servidor e persistir snapshot imutavel do preco por item; nao recalcular vendas historicas a partir da tabela atual. Requer teste tenant A/B, fallback, vigencia, concorrencia e RBAC antes de habilitar HTTP.
- Migrations 023/024 estao somente no codigo/CI; nenhuma aplicada na VPS. Gate C ainda exige restauracao isolada, backup novo e precheck de porta/canario. Preservar API 3080 R07B e PR #33 draft.

## Contrato Cursor/deploy - Produto por canal (2026-09-24)
- PR #33 segue draft, branch codex/comercial-360. A migration aditiva 024_produto_canais_rascunho.sql e o CRUD canonico de Produto/canais estao no codigo/CI; nao aplicar na VPS sem gate aprovado, novo backup, teste de restauracao e precheck da porta isolada. A migration 023 tambem nao foi aplicada na VPS.
- API: GET/POST /api/v1/produtos/:id/canais, PATCH/DELETE /api/v1/produtos/:id/canais/:canalId. POST aceita somente canal, sku?, nome?, descricao?; PATCH aceita somente subconjunto nao vazio de sku, nome, descricao. Canal exige slug minusculo; status permanece RASCUNHO. DELETE e inativacao logica. Respostas 201/200, erros 400/403/404/409.
- Contratos: escopo vem exclusivamente do contexto autenticado Grupo/Empresa; Produto deve estar ativo e pertencer a Empresa, RBAC Cadastros.produto.visualizar/editar, auditoria na mesma transacao. Nao enviar groupId, empresaId, actorId, status ou preco no body. SKU e unico por Grupo/Empresa/canal, inclusive soft-deleted. CRUD nao aciona catalogo, outbox de publicacao, preco, estoque, fiscal ou integracao externa.
- Configuracao: nenhuma variavel nova. Produto HTTP continua opt-in/desligado na 3080; sem Auth real homologado, nao ativar VITE_ERP_HTTP_PRODUTO nem associar IDs legados. StoragePort/scanner/publicacao permanecem gates separados.
- Testes: service/in-memory, HTTP e PostgreSQL sintetico na suite existente. CI do novo HEAD deve confirmar backend/frontend e E2E PostgreSQL sem fail/skip antes de handoff operacional.
- Proximo deploy autorizado deve inventariar migrations reais, aplicar somente faltantes da MAIN aprovada, validar RLS/FORCE e smoke autenticado no canario isolado; 3080 so muda em gate de promocao explicito.

## Checkpoint vigente - Comercial 360 / Gate C (2026-09-23)
- Branch `codex/comercial-360`, PR #33 draft e sem merge; ultimo HEAD funcional antes deste checkpoint documental `c3df0c3ca0f95a4c27e21de7b91cb002fb154f53`. CI `35919084889` frontend/backend SUCCESS, incluindo PostgreSQL efemero. A CI nao homologa o DEV real.
- Migrations 001-022 existem no repositorio/CI; a evidencia agregada fornecida pelo usuario da VPS mostrou somente 001-015 aplicadas uma vez. Nao executar 016-022, seed, Auth novo, scanner, Produto HTTP ou canario sem gate especifico.
- API oficial 3080 permanece R07B/`dev_headers` conforme capturas fornecidas; backup SQL de 21/09 tem tamanho, hash e marcador de dump completo, mas nao teve restauracao comprovada. Imagem/container de rollback R07B preservados; 3086 estava livre no momento da consulta, sem autorizar implantacao.
- Gate C PARCIAL: comparar em leitura somente a conexao efetiva da API com uma conexao direta ao `supabase-db` por identidade do servidor/migrations, sem imprimir URL ou credenciais; confirmar restaurabilidade e backup atualizado no gate autorizado. Comparar apenas IP nao e prova suficiente.
- Orientacoes R08 abaixo sao historicas. Nao usar a secao antiga "Passo historico R08B" como ordem de execucao atual. Preservar PR draft, main e 3080 ate gate separado.
## Checkpoint vigente - Gate C, evidencia Web Console (2026-09-24)
- Captura do usuario mostrou `conexao_api_vs_supabase_db=MATCH` ao comparar `current_database()` e identificador do cluster PostgreSQL da API e do `supabase-db`. A divergencia anterior de IP era inconclusiva e nao deve ser usada para negar este resultado.
- Backup SQL de 21/09: 486969 bytes, SHA-256 calculado, marcador de dump completo; restaurabilidade ainda nao testada. Rollback R07B: container preservado/exited e imagem presente. Porta 3086 livre no instante da consulta; 3080 preservada.
- PR #33 permanece draft e sem merge. HEAD anterior `38bb311709673e87fd00c00e9a81d0c660c0bf6b`, CI `35985748032` SUCCESS; migrations 001-024 no codigo/CI, somente 001-015 evidenciadas na VPS. Gate C nao autoriza canario/migration: falta restauracao isolada, backup novo pre-implantacao e precheck imediatamente antes do uso. Auth novo, scanner real e Produto HTTP nao homologados.
- As secoes de 23/09 abaixo sao historicas e nao substituem este checkpoint.

## Gate C - precheck Web Console adicional (2026-09-23)
- Backup SQL de 21/09/2026 encontrado com 486969 bytes, SHA-256 calculado e marcador de dump completo; restauracao nao testada e backup atualizado ainda pendente para o gate autorizado.
- API oficial `erp-api-dev` running na imagem R07B; container de rollback R07B exited e imagem preservada. Porta 3086 sem listener nem container ativo no instante da consulta; 3080 preservada.
- Gate C segue parcial ate comparacao read-only da conexao efetiva da API com `supabase-db`. Nao iniciar canario, Auth novo, migration ou promocao com base apenas nesse precheck.

## Gate C - Web Console complementar (2026-09-23)
- Evidencia fornecida pelo usuario: API oficial 3080 na imagem R07B, health/ready 200; Auth/DB healthy; API e DB na rede `supabase_default`. Conexao da API reportou banco `postgres` e 15 migrations.
- Comparacao de IP retornou `api_usa_supabase_db=NO`; resultado e inconclusivo para identidade fisica por possivel proxy/IPv6/traducao. Nao declarar banco divergente nem Gate C aprovado ate comparar conexao efetiva e conexao direta ao DB.
- Backups de 20/09 e containers antigos de rollback aparecem preservados, sem verificacao de integridade/restaurabilidade. Porta 3086 nao apareceu em `ss` entre os filtros; 3080 segue oficial. Nao houve escrita VPS ou ativacao.

## Gate C prioritario - checkpoint de 2026-09-23
- PR #33 draft/mergeable no HEAD `750a4ab14854e184d6fb2fc8afef7f6e2094b277`; CI `35910005796` frontend/backend e PostgreSQL efemero SUCCESS. A CI do commit funcional `52167840` (`35909747751`) tambem passou.
- Evidencia VPS nao avancou nesta sessao: Web Console falhou antes de abrir (`helper_unknown_error: apply deny-read ACLs`) e nao ha ferramenta VPS interna disponivel. Banco efetivo da API, rede, backup e rollback continuam sem precheck atual; nao inferir Gate C aprovado.
- O bloco unico de leitura sanitizada foi entregue ao usuario. Nao executar Auth, scanner, Produto HTTP, migration ou promocao na 3080 ate gates separados.

## Gate C DEV - evidencia SQL agregada (2026-09-23)
- Web Console informada pelo usuario: `schema_migrations` possui `id`/`applied_at`; 001-015 cada 1x, 016-022 ausentes nas 15 linhas. `auth.users=0`, `profiles=2`, `groups=2`, `empresas=3`; ambos os perfis ativos estao sem Auth. Sem vinculos de grupo/empresa invalidos nas contagens.
- Nome do banco da API e `current_database()` nao visiveis na captura; identidade do banco da API ainda pendente. Gate C nao aprovado para Auth/canario: API oficial 3080 permanece 07B/`dev_headers`.
- Nenhuma escrita VPS realizada. Continuar somente leitura para banco/rede/backup/rollback; identidade sintetica e perfil requerem gate autorizado separado.

## Gate DEV parcial - 2026-09-23
- Web Console, conforme evidencia informada pelo usuario: API oficial `erp-api-dev` em 3080, imagem `runtime07b-main-ca0bc5f3`; health/ready 200; meta `ERP-RUNTIME-07B`, `auth.mode=dev_headers`.
- MCP Hostinger confirmou VPS `srv1982741` running e Supabase Auth/DB/Storage healthy. Nao ha evidencia SQL de migrations nem dos vinculos de profiles nesta sessao.
- Gate C ainda nao aprovado. PR #33 segue draft; codigo Auth novo nao foi implantado/homologado. Nenhuma acao de escrita na VPS, 3080 preservada.
- Consultas agregadas e gates condicionais constam em `COMERCIAL_360_V1_DEPLOY.md`.


## Checkpoint Comercial 360 - 2026-09-23 (PR #33 draft)
- Branch `codex/comercial-360`; referencia comprovada antes deste checkpoint: `865e23d29ed72d6b00180fc52a4bde572f85c864`; CI `35873286965` verde com PostgreSQL efemero. A `main` e a VPS nao foram alteradas aqui.
- Migrations 001-021 existem no repositorio. Orcamento/Pedido iniciais e Produto/PIM/DAM/Auth estao preparados em codigo; Produto HTTP desligado e midias em QUARENTENA. Nenhuma aplicacao real das migrations 016-021 foi comprovada.
- Gate C DEV ainda sem auditoria VPS verificavel nesta sessao: MCP Hostinger nao expos ferramentas VPS e Web Console falhou antes de abrir. Nao assumir estado atual da API 3080, Auth, PostgreSQL ou buckets a partir do historico abaixo.
- Proximo gate: auditoria somente leitura via Web Console/Hostinger VPS, saida sanitizada; depois homologacao controlada de Auth/perfis. Sem SSH, migration, seed, restart, bucket, ClamAV na VPS, promocao ou merge neste checkpoint.

# ERP ZUCCARO — Handoff atual

## Atualizacao Comercial 360 V1 - 2026-09-21

- Branch de trabalho: `codex/comercial-360`; PR aberta: `#33`; nao mesclada.
- Checkpoint funcional do frontend: `0040e994a8d4c3c3cdd417cc9502fa332c6b3567`; preparação de deploy validada: `3c96bb677aef9c5498842005a6a4a2dd3bc36de3`.
- CI final comprovada antes do fechamento documental: workflow PR `35667460162`, frontend/backend `SUCCESS`; migrate, seed sintetico e PostgreSQL E2E passaram.
- Orçamento e Pedido usam backend HTTP canonico, tenant Grupo/Empresa, RBAC fail-closed e auditoria transacional. Migrations novas 016/017 foram validadas somente no PostgreSQL efemero da CI.
- Preparacao de deploy: `COMERCIAL_360_V1_DEPLOY.md` e `scripts/deploy/comercial360-{canary,smoke,rollback}.sh`. Os scripts nao foram executados; rollback e dry-run por padrao.
- VPS permanece intocada por esta versao: API oficial 3080, migrations aplicadas, imagens, containers e backups continuam no estado operacional descrito abaixo. Proximo gate exige merge e autorizacao VPS separados.
Atualizado em 2026-09-20 após o diagnóstico definitivo do gate do ERP-RUNTIME-08.

## Referências

- Repositório: `viniciuszuccaro-creator/ERP-Zuccaro-codeX`.
- SHA funcional 07B: `ca0bc5f3529b9071fe80e58dae6aa966a9d6c740`.
- Um commit documental posterior, quando existir, deve ser registrado separado
  desse SHA funcional.

## DEV

- VPS: `/opt/erp-zuccaro`.
- API oficial 3080: `ERP-RUNTIME-07B`.
- Imagem: `erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3`.
- PostgreSQL: migrations 001–015 aplicadas exatamente uma vez. As migrations 014 e
  015 são imutáveis e não devem ser reaplicadas manualmente.
- `013_tabelas_preco.sql` permanece aplicada uma vez.

O pós-promoção 07B foi aprovado. A API oficial, banco e VPS não são alterados
por esta documentação.

## Último runtime e agregados canônicos

O ERP-RUNTIME-07B está fechado. Os agregados relevantes são Produto, Cliente,
ClienteEmpresa, ClienteLocal, Obra, TabelaPreco, TabelaPrecoEmpresa e
TabelaPrecoItem.

TabelaPreco tem origem por Empresa, autorização N:N, padrão por Empresa e
referência específica nullable em ClienteEmpresa. A resolução é específica,
depois padrão, depois sem preço. Itens usam Produto + Unidade, valores
`NUMERIC(18,6)`, vigência no cabeçalho, soft delete, RLS, RBAC e auditoria.

## Frontend e rollback

`TabelaPreco.frontendHttp=false`; esse cutover não ocorreu.

Os rollbacks 06B e 06A estão preservados e não devem ser apagados.

## Diagnóstico do gate R08

As constraint triggers reais da 015 estão `DEFERRABLE INITIALLY DEFERRED` e a
barreira rejeita, no `COMMIT`, condição ativa sem parcelas, total de 99%, remoção
da única parcela e reativação sem parcelas. Os testes locais também comprovam o
rollback após cada falha.

O gate que registrou `INVALID_INSERT_EXIT=0` usava `docker exec` sem `-i`. Sem
stdin interativo, o heredoc do Bash não é encaminhado ao `psql`; o processo pode
encerrar com sucesso sem executar o `BEGIN`/`INSERT`/`COMMIT`. A causa é, portanto,
o harness, não aceitação persistida da condição inválida. Com `ON_ERROR_STOP=1`,
um erro SQL em execução não interativa precisa resultar em status não zero.

## Hotfix de metadata R08B

O container temporário do R08B iniciou normalmente. O gate aguardava
`ERP-RUNTIME-08B`, mas `/api/v1/meta` respondia literalmente
`ERP-RUNTIME-07B`; o timeout do gate provocou o cleanup com `SIGTERM`. Não
houve crash nem OOM. O hotfix da branch altera somente a identidade de metadata
para `ERP-RUNTIME-08B` e declara `CondicaoPagamento` como preparado no backend,
mantendo `frontendHttp=false` e fora do piloto HTTP.

## Diagnóstico RBAC e E2E R08B

O `403` do smoke de Condição de Pagamento é causado por seed RBAC incompleto,
não por falha do canário: o actor usado no gate,
`a4a4a4a4-aaaa-4aaa-8aaa-a4a4a4a4a4a4`, pertence ao Grupo A e pode operar as
Empresas A/A2, mas não possuía `Cadastros.condicao_pagamento.visualizar`.
LIST e GET exigem essa mesma ação; as demais ações são `criar`, `editar`,
`inativar`, `restaurar`, `vincular-empresa`, `gerenciar-parcelas` e
`definir-padrao`. O seed idempotente foi corrigido somente para os dois actors
sintéticos A/B, com essas ações explícitas e sem wildcard.

A imagem runtime contém somente artefatos de produção, portanto `npm test`
dentro dela encontrar zero testes é esperado e não prova E2E. O mecanismo
canônico do próximo gate é `npm run test:postgres` no worktree exato do PR,
com dependências de teste efêmeras e `DATABASE_URL` fornecida apenas no
ambiente do gate. O runner falha sem `DATABASE_URL` ou se executar zero testes.

O primeiro E2E PostgreSQL real executou um teste e chegou ao banco. LIST/GET
autorizados passaram, e RBAC/cross-group permaneceram bloqueados. A falha
`SQLSTATE 23514` veio exclusivamente do payload de teste: ele enviava
`E2E-...` para `codigo`, enquanto a constraint exige seis dígitos. A constraint
funcionou corretamente. O hotfix reserva, dentro da transação rollbackável, um
código numérico livre entre `900000` e `999999`; API e schema já eram coerentes.

## Passo historico R08B (nao executar como proximo gate)

Registro de 20/09, superado pelo checkpoint vigente acima. No Gate VPS autorizado, repetir somente o E2E PostgreSQL real e concluir o
canário. O seed RBAC já foi aplicado e não deve ser reaplicado por este hotfix;
não reaplicar migrations. A API oficial 3080 continua R07B. Não
criar migration 016, não promover a API R08 e não fazer merge neste gate.

## CODEX — contencao dos snapshots publicos (2026-10-07)

- O proprietario autorizou retirar da versao atual os dois snapshots reais do ERP novo servidos por `public/` e preparar a limpeza do historico. O repositorio e publico; remover arquivos na HEAD nao elimina blobs de commits anteriores, caches, clones nem artefatos ja implantados.
- Branch `codex/remove-public-erp-snapshots`, baseada na main atual: remove os dois assets reais, desliga hidratacao automatica por URL publica, exige arquivo privado escolhido pelo usuario para recuperar somente em localhost e adiciona guardas contra reintroducao. Copias originais privadas foram preservadas fora desta worktree.
- A limpeza do historico NAO foi executada: inventariar refs/PRs afetados, congelar pushes, preparar copia recuperavel e janela coordenada; reescrita/force-push exigem decisao operacional separada antes de executar. Nao publicar dados, IDs, hashes ou credenciais no PR.
- Implantacao na VPS tambem e separada: antes de trocar imagem/build, conferir gates, backup, rollback e eliminar assets antigos da distribuicao/CDN. Nao presumir que merge remove arquivos ja servidos.
- Runbook separado: `docs/LIMPEZA_HISTORICA_SNAPSHOTS_PUBLICOS.md`. CI tip SUCCESS. Coordenacao Cadastros #226 tip `7bfd3f93` (port #229 completo).

## CODEX — divisao atual autorizada (2026-10-10)

O proprietario autorizou executar Comercial 360 neste chat em workspace/branch
separados, mantendo Cursor revisor. Retomar #265 sobre base atual #261,
preservando #264. Legado segue em `legado-piloto-20261010`, branch #266;
Comercial tera workspace proprio. Nao editar branches Cursor.
Complemento #266 revalida origem/Grupo, contrato e classificacao antes de retry;
25 testes focados PASS. Fonte `04_REPORTS` segue negada pelo SO mesmo com
permissoes amplas da sessao; piloto real/importacao ainda nao executados.

Checkpoint base: db89aa45 incorporada; runtime legado idêntico ao 661f3ef3 testado, revisao/CI do merge requeridas. Comercial ja executa aqui em workspace separado com autorizacao do proprietario.

Checkpoint posterior: 03_STAGING legivel; 04_REPORTS permanece negada. Somente
dry-run privado de transformacao (20 Clientes/20 Fornecedores mapeados;
20 Produtos em quarentena), sem carga/persistencia. Recuperados/importados 0.
Aliases SQL incorporados ao mapper existente, 27 focados PASS. Origem/destino,
classe/unidade e vinculo juridico exigem revisao/validacao antes do piloto real.
Dados e arquivos privados nao acompanham commit; evidencias somente agregadas.

Checkpoint corretivo da revisao Cursor 6100174767: operacao exige codigo legado
juridico e empresa identica ao crosswalk; opcoes nao substituem empresa de origem.
Produto grava tipo_item canonico (chave/rotulo explicitos normalizados sem default).
Duplicata em quarentena recebe auditoria. 30 focados PASS, lint/audit/build/diff PASS.
Suite Windows completa com Git Bash foi interrompida apos travar no teste
vps-gate-precheck; nenhum teste removido/skip. CI Linux final e revisao exigidas.
## CODEX — catálogo classe/unidade e continuidade (2026-10-11)
Workspace legado separado, responsável Codex, branch codex/legado-catalogo-classe-unidade-20261011 sobre a PR #266, HEAD cb3af26e. Reutiliza mapper e policy existentes: catálogo agregado de classe/unidade preserva códigos, diferencia pares ambíguos, reconcilia contagens, exige mapa explícito/tipo canônico e unidade ativa no mesmo Grupo. Não libera uso empresarial de Produto nem interpreta catálogo como importação. 32 testes focados PASS/0FAIL/0SKIP; lint/auditbaseline/build PASS. Testes de inventário Bash foram executados e falharam antes do script: NtCreateDirectoryObject/BaseNamedObjects/msys 0xC0000022; teste e asserts preservados, validação Linux CI obrigatória. Item inventário local BLOCKED somente por ambiente, não escondido como skip.
Fonte04_REPORTS: Get-ChildItem e Get-Acl retornam UnauthorizedAccessException; caminho original preservado. Nenhum dado real recuperado, nenhum piloto/importação operacional nesta rodada. Próximo: adapter/importador persistido canônico no destino isolado, procedência/idempotência/reversão, preservando Grupo/empresa fiscal; resolver fonte somente por acesso autorizado ou cópia equivalente comprovada.
Comercial em workspace próprio: #280 HEAD0a54be4a42b603e32717c4bf7db956388a5c9911 CI3738/run38137626838 SUCCESS frontend/backend; PostgreSQL real Marca2PASS/0FAIL/0SKIP e TENANT_CONTEXT4PASS/0FAIL/0SKIP, backend345/0/18 semURL. HTTP persistente/Auth/RBAC/rollback/concorrência implementados; Cursor solicitado6108793026, seloCI6108818394, revisão final pendente. Sem merge/implantação/grants operacionais; continuação do legado iniciou durante revisão, não apenas monitoramento.
## CODEX — piloto Cliente persistido em ambiente isolado (2026-10-11)
Responsável Codex, workspace legado, branch codex/legado-piloto-cliente-persistido-20261011 sobre catálogo #281. Adapter no consumidor existente chama ClienteService canônico, exige Grupo, procedência/lote/tipo explícitos e RBAC importar. Não implementa repositório/SQL paralelo, não concede empresa por default. Retry só reutiliza identidade/conteúdo/procedência equivalentes; divergência exige reconciliação sem sobrescrita.
Prova PGlite persistida com migrations canônicas e audit Postgres: carga no Grupo, código numérico separado do legado, consulta, repetição sem duplicar, edição/reabertura conservando campos/IDs, reversão por inativação preservando rastro, usuário restrito bloqueado e falha audit revertendo registro/sequência. 15 runtime04 PASS/0FAIL/0SKIP; 32 mapper/consumidor PASS; backend306PASS/0FAIL/18PGskips semURL, typecheck/build/lint/auditbaseline PASS. Lock de dependências idêntico ao workspace Comercial, reutilizadas cópias locais; junction negada, nenhuma credencial/config alterada.
Esta prova usa dados sintéticos e proprietário fixture do motor local, não homologa papel operacional, importação real ou PostgreSQL externo. Recuperados/importados reais continuam zero. Fonte04_REPORTS bloqueada por ACL; carga real exige procedência/equivalência/destino/backup/reversão comprovados. Próximo: completar piloto de Produto com catálogo/mapeamentos explícitos, adapter idempotente concorrente e PostgreSQL real isolado antes qualquer carga operacional.
Catálogo #281 HEAD2e8ef5bd: CI3750/run38137945017 SUCCESS; Cursor6108875441 confirmou36testesLinuxincluindo inventárioBash, sem alterações. Comercial#280 HEAD612c2055: CI3756/run38138199300 SUCCESS; revisão final do ajuste de filtros solicitada6108871480. Versão anterior0a54be4a revisada6108833920/CI3738/PG2zeroSkip. Sem merge/deploy/grants/migration/dados reais.
## CODEX — retry concorrente e PostgreSQL isolado do piloto Cliente (2026-10-11)
Responsável Codex; continuação do pacote #282, sem novo módulo. Consumidor resolve somente conflito DUPLICATE_DOCUMENT por leitura do vencedor equivalente, incluindo tipo, sem repetir escrita. Identidade inativa exige LEGACY_RECONCILIATION_REQUIRED e não é restaurada automaticamente. Prova comportamental adiciona duas importações concorrentes, identidade única e um único criador, divergência de tipo/lote e inativo preservado. Mesmo fluxo persistente executa em PostgreSQL real pelo runner obrigatório LEGACY_CLIENT, somente localhost/erp_test e schema isolado descartável; destino externo é rejeitado antes da conexão. Auth/RBAC nesta fixture continuam em memória e proprietário SQL: não homologa RLS/papel operacional.
Validação local: runtime04 16PASS/0FAIL/0SKIP, mapper/consumidor32PASS; backend307PASS/0FAIL/18skips preexistentes sem DATABASE_URL; typecheck/build/lint/auditbaseline/diff PASS. CI do novo SHA e parecer final obrigatórios. #280 HEAD612c2055 CI3756 SUCCESS, Cursor6108890985 sem bloqueio de código; #281 HEAD2e8ef5bd CI3750 SUCCESS/Cursor6108875441.
Bloqueio reproduzível do item identidade legado: codigo_legado repetido com documento diferente ainda não tem unicidade persistente canônica, conforme Cursor6108903880; não liberar carga real nem copiar contrato incompleto para Produto. Coordenação #2616108941232 solicita contrato canônico de mapa/procedência Produto (tipos/repositório atuais não possuem campos legado) e divisão de arquivos antes da extensão. Próximo pacote: identidade persistente por Grupo/fonte/código e reconciliação, preservando documentos e IDs; depois piloto Produto. Fonte04_REPORTS continua UnauthorizedAccessException em leitura e ACL; original preservado, recuperados/importados reais zero. Nenhum merge/DEV/grant/importação.

## CODEX — inventário único e equivalência privada de cópia (2026-10-11)
Responsável Codex, branch codex/legado-inventario-equivalencia-20261011 sobre #282 HEADd972179a. Extraído somente o motor Python inline do inventário Bash existente para inventario-backup-erp-antigo.mjs: Bash conserva descoberta, markers, classificações, agregados e relatório; Node permite mesma implementação em Windows. Não há segundo inventário/módulo. Corrigida leitura indevida antes da classificação: candidatos de credencial nunca são abertos/hasheados; sha256 nulo impede equivalência plena. ACL/arquivo alterado/symlink/arquivo especial falham fechados, sem manifesto completo parcial. Relatórios fora do original e criados sem sobrescrever, inclusive verificação de diretório canônico.
Comparação disponível via node scripts/legado/inventario-backup-erp-antigo.mjs --compare manifest-origem.json manifest-copia.json. Manifesta versão2, caminho relativo hasheado+bytes+SHA256: nomes iguais/contagem igual não substituem equivalência; alteração, falta, extra, segredo ou manifesto inválido bloqueiam. Não comprova significado/referências nem autoriza carga. Manifestos reais permanecem privados, nunca no GitHub. Diretamente em Windows, BACKUP_DIR/REPORT privados podem usar o mesmo motor Node sem Bash; não contorna ACL.
6 testes sintéticos PASS/0FAIL/0SKIP, lint/auditbaseline/build/diff PASS. Quatro testes Bash existentes preservados e exigidos na CI Linux; limitação MSYS local já reproduzida, nenhum skip artificial. #282 HEADd972179a CI3768/run38139225275 SUCCESS, PG LEGACY_CLIENT17/0/0; Cursor6109000425 confirmou correções. #280612c e #2812e8 continuam código revisado/CI verde, não integrados/implantados.
Próximos itens: contrato canônico de unicidade por Grupo/fonte/código legado (mesmo código com documento diferente continua bloqueio de importação) e extensão coordenada de procedência Produto; aplicar comparação somente a cópia privada cuja origem possa ser inventariada. Fonte04_REPORTS ACL negada, recuperados/importados reais zero. Nenhuma migration/DEV/segredo/dado privado neste pacote.

## CODEX — fechamento de resíduos do inventário #283 (2026-10-11)
Cursor6109059651 revisou HEAD6d9f8823/CI3773 SUCCESS, 10testesLinux/905frontendzeroSkip, sem bloqueio; resíduos tratados: hard links agora bloqueiam antes de hash, inclusive alias de candidato secreto; preservado marker NOTEblocked_secret_candidate, extensão final vazia vira sem_extensao e tamanho divergente de segredo conta changed e blocked sem abrir conteúdo. Novo teste exige hard link real, sem mock/skip. Windows negou fs.link EPERM tanto TMP quanto workspace autorizado: 7PASS/1falha de infraestrutura/0SKIP; asserts preservados, CI Linux final obrigatória. Lint/auditbaseline/diff PASS. Nenhuma leitura real além diagnósticoEPERM, fonte/backup original inalterados, recuperados/importados zero. Próximo independente já implementado: impedir escolha da primeira variante quando identidade de staging diverge dentro do lote; unicidade persistente entre lotes segue dependência canônica coordenada #2616109077892.

## CODEX — identidade divergente de staging sem escolher primeira variante (2026-10-11)
Responsável Codex, branch codex/legado-conflito-identidade-lote-20261011 sobre #283. Consumidor existente bloqueia todas as variantes da chave quando o mapper detecta conteúdo/documento/classe divergentes; fingerprint anterior não libera uma raiz contestada. Referências anteriores duplicadas com fingerprints diferentes também não escolhem a última referência. Reusos dependentes seguem em quarentena, sem sobrescrever ou mudar fonte; identidades independentes continuam comprovadas. Preservado teste Produto: prova positiva de classe/unidade/retry separada da prova negativa de lote divergente, sem eliminar asserts nem testes.
35mapper/consumidorPASS/0FAIL/0SKIP; pilotoCliente16PASS/0FAIL/0SKIP, lint/auditbaseline/diff PASS. Não substitui unicidade persistente entre lotes, não importa dados. Próximo contrato liberado pelo Cursor #2616109078451: identidade (group_id,source_system,codigo_legado) nos serviços/repos canônicos Cliente/Produto, migration043 somente sobre base038–042, índices parciais fail-closed, sem alterar001–042/ProdutoEmpresa/fiscal. Fornecedor sem módulo canônico server permanece quarentena, sem duplicação. Próximo pacote Codex inicia composição em branch própria após publicação deste lote; nenhuma carga/migrationDEV/deploy liberada. Fonte04_REPORTS segueEPERM; recuperação/importação realzero.


## CODEX — pacote CRM HTTP 040 (2026-10-10)

Workspace/branch próprios `comercial360-crm-http-20261010` / `codex/crm-http-canonico-20261010`.
Base c125c4db, descendente da candidata Cursor #261; main conferida baba91a6 ainda sem #261.
Numeração/ownership 040 reservados em6100290423; policy única extraída pelo Cursor em c125c4db,
importada do domínio server e reexportada pelo wrapper frontend. UI/store/C360 permanecem intactos.
Implementado: Oportunidade HTTP create/get/list/patch/inativar/restaurar, busca por ID legado,
vínculo de Orçamento existente (sem documento paralelo), códigos via reserveEntityCodigo,
idempotência, CAS/versionamento, histórico e auditoria no executor compartilhado.
Campos existentes preservados: descrição, responsável textual (não identidade de autorização),
previsão, próxima ação, interesse em produtos e orçamento informado pelo cliente. PATCH omitido/
undefined não limpa campos; null explícito limpa somente campo autorizado. Decimais como strings.
IDs legados e referências de Interacao/documentos não viram UUID fictício; legacy_store_id TEXT
é único por Grupo/Empresa. Sem backfill/importação/dual-write ou corte automático.
040: RLS/FORCE company-scoped, FKs compostas, sem grants PUBLIC. Grants das provas são fixtures,
não homologação DEV. ENABLE_CRM_HTTP=false por padrão; habilitação/corte exigem revisão, CI,
migration/grants/runtime homologados, backup/reconciliação/rollback e mapa de IDs/códigos.
10 testes locais focados PASS (inclui PGlite com papel NOSUPERUSER/NOBYPASSRLS).
Suite PostgreSQL real adicionada ao runner obrigatório com gate de banco isolado, sem skip flag;
prova concorrência/retry/CAS/rollback de auditoria/RLS e Cliente→Orçamento server-priced→CRM.
Migrations aplicadas/025–037/026 e branches Cursor não alterados. Nenhum deploy/VPS/canal neste lote.
Revisão do HEAD final e CI ainda requeridas. Não declarar CRM/onda implantados por esta preparação.

CRM 040 — evidencia de fechamento do runtime 0481e940: CI push3585/run38078234619 e
PR3586/run38078299051 SUCCESS frontend/backend. Runner nativo PostgreSQL R40CRM:
2 PASS/0 FAIL/0 SKIP, papel NOSUPERUSER/NOBYPASSRLS/NOLOGIN em schema isolado.
Backend local completo 317 PASS/0 FAIL/18 skips existentes sem URL; R40 real nao
adiciona skip e foi executado obrigatoriamente na CI. Evidencia sanitizada em
`docs/evidence/crm-http-040-pg-ci-20261010.txt`. Codigo permanece desligado por
padrao e sem cutover/deploy/migration operacional. Revisao final ainda requerida.
### CRM 040 — correção das ressalvas da revisão 6101234545
- A sequência de Grupo avança em INSERT/alteração de código mediante trigger SECURITY INVOKER, na mesma transação. Não lê oportunidades de outra empresa, não adiciona BYPASSRLS nem grants operacionais. A reserva existente permanece canônica; importações devem manter triggers habilitados e reconciliação/backup.
- Vínculo Orçamento preserva a referência anterior em legacy_orcamento_id, somente pelo serviço/contrato persistente; cliente HTTP não pode fabricar esse campo. Replay mantém referência e versão.
- Provas ampliadas: código fora da reserva na empresa A seguido de criação na A2; referência textual → vínculo UUID → replay. Runner PostgreSQL real obrigatório mantido, sem remoção de testes/skip.
- Flag, UI/store, migration DEV, importação e canais continuam desligados/pendentes. Novo HEAD requer revisão independente e CI próprias.

### Codex — CRM → Pedido canônico (2026-10-10)
Base #267 e3194fb1, branch codex/crm-pedido-integrado-20261010; coordenação de arquivos liberada por Cursor em6101860020. Reutiliza montagem/repositórios/serviços atuais, executor terceiro argumento e lock opcional quarto/default false. Sem UI/store/C360/policy paralela.
Vínculo de Pedido existente valida ClienteEmpresa, estado ativo EM_ABERTO, tenant/RBAC/audit, CAS e replay. Avança CRM já vinculado a Orçamento somente se Pedido aponta exatamente ao mesmo Orçamento; Ganho manual não permite contornar fechamento. Mantém orçamento e referências legadas separadas; não cria/edita documento, preço, produção ou estoque no endpoint CRM.
Migration040 continua candidata não aplicada; inclui legacy_pedido_id readonly HTTP. Nenhuma025–039 alterada, 026 permanece fail-closed. CI real R40 ampliada Cliente→Orçamento→Pedido pelos serviços atuais, preço snapshotado, replay concorrente e cancelamento sob lock; prova local SQL de auditoria/rollback/escopo. Fixture não homologa grants DEV.
ENABLE_CRM_HTTP permanece OFF. Merge/deploy/importação/corte dependem de revisão/CI/backup/reconciliação/runtime e grants. Sem carga de dados reais ou ativação de canais neste lote.

Decisão do proprietário: Pedido exclusivo por oportunidade e orçamento de origem obrigatório quando presente (2026-10-10). Implementação: oportunidade aberta não pode capturar Pedido vindo de Orçamento; avanço somente pela oportunidade vinculada ao mesmo orçamento. Lock canônico serializa disputa; consulta scoped e índice único de convertido_em_id impedem dupla associação inclusive após inativação. Não renumera referências legadas, não remove registros. Provas memória/PGlite/HTTP 11PASS; R40 real amplia disputa simultânea e rejeição SQL do segundo vínculo. CI/revisão novas exigidas, flag OFF.

### Codex — preflight estrutural CRM somente leitura
Branch codex/crm-preflight-operacional-20261010, base de conteúdo #2685a38a94e/local15c33065 (tree53fee243 igual). inspectCrmPreflight e crm:preflight reutilizam cliente DB atual; exigem destino explícito privado, transação READ ONLY no comando, não imprimem URL/nome/IDs/erros brutos. Verificam schema/ledger040, RLS/FORCE/policy única PUBLIC tenant exata, colunas legadas, trigger invoker ativo, índice exclusivo Pedido, grants mínimos e ausência de DML PUBLIC. Sem GRANT/ALTER/INSERT/cópia do store.
ready é apenas estrutural; activationAuthorized=false sempre. Não substitui backup, reconciliação/mapa legado, grants/RBAC operacionais completos, revisão, teste real e aprovação do corte. Flag/UI/store/C360 inalterados; nenhuma migration, implantação, importação ou canal executado. Provas PGlite adversariais e R40 PostgreSQL real no runner existente. Fixture registra ledger sintético de040 após aplicação no schema isolado; não cria evidência DEV.

CRM preflight agora cobre os dois estágios do handoff6102513877: CRM_PREFLIGHT_STAGE=before_migration confirma039 no ledger, ausência de040/objetos chamados oportunidades e recusa ledger posterior; after_migration (default) mantém verificação estrutural completa. Stage inválido é recusado antes da conexão. Nenhuma escrita ou ativação; quatro testes focados PASS/0FAIL/0SKIP. R40 real verifica que banco já com040 não passa pelo gate anterior. Antes de usar no DEV permanecem revisão/CI/destino privado e login Hostinger; não alterar dados enquanto isso.

Reprodução própria de falso positivo no preflight269: trocar trigger código por AFTER UPDATE mantinha gate verde. Corrigido para exigir nome, função invoker no schema esperado, BEFORE ROW INSERT+UPDATE, colunas codigo/group_id, sem WHEN ou argumentos e ativo. Provas PGlite e R40 real alteram só o schema sintético e restauram o trigger canônico; nenhum objeto DEV alterado. Quatro focados PASS; CI e revisão novas exigidas antes de uso operacional.

### Codex — Produto Grupo→Empresa→Orçamento/Pedido (migration041)
Ownership e numeração liberados por Cursor6102648260. Branch codex/produtos-grupo-empresa-20261010, base de conteúdo2698d806/local5a4bc9b4 com árvore igual. Reutiliza ProdutoRepository/ProdutoService e facade backend existentes; nenhuma implementação paralela ou edição de UI/store/facades reservadas.
041 cria apenas vínculo operacional explícito, com IDs/FKs Grupo+Empresa, RLS/FORCE, REVOKE PUBLIC, CAS/versionamento e auditoria. Sem backfill/default de habilitação. getById mantém filtro de empresa; getForOperation usa executor da venda, aceita mestre somente com vínculo ativo/habilitado e empresa Ativa, mantém locks compartilhados até commit. Produtos já pertencentes à empresa preservam comportamento anterior. Habilitação não modifica preço/estoque/master nem documentos gravados.
API GET/PUT empresa-operacao exige contexto empresa/RBAC explícito, nega wildcard/campos de tenant fabricados e valida payload. Flags ENABLE_PRODUTO_EMPRESA/CRM seguem OFF por default; dados apenas sintéticos. 326 backend PASS/0FAIL/18DB skips preexistentes sem URL; typecheck/build/lint/audit PASS. R41 preparado no runner PG obrigatório (execução CI pendente) para provar fluxo pelos serviços Cliente→Orçamento→Pedido, preço servidor/snapshot, replay, isolamento no papel sem bypass e revogação concorrente aguardando commit da venda.
Nenhuma001–040 alterada, 025–037/026 preservadas; 041 candidata não aplicada. Sem deploy/importação/ativação/canais/grants DEV. Gates/revisão/CI/backup/rollback/reconciliação operacionais ainda exigidos. Leitura inicial do console confirmou somente containers esperados; isso não equivale a identidade completa/homologação do banco.

Composição041: CI3617/3618 de362e6aed falhou em R41 com TENANT_FK_MISMATCH: produto outside scope. A validação de serviço havia sido ampliada, mas guards SQL016/017 ainda exigiam empresa_id no master. Corrigido somente na041 candidata: funções canônicas existentes preservam checks pai/unidade/produto próprio, adicionam ramo explícito master Grupo ativo + vínculo empresa ativo/habilitado + empresa Ativa, com FOR SHARE. Sem alterar001–040/026, ampliar policy, GRANT ou revalidar/regravar históricos. Reprodução PGlite via repositórios Orçamento/Pedido passou antes/depois de habilitação e bloqueou revogação/unidade incompatível. Nova CI/revisão do HEAD exigidas; falha anterior não ocultada, nenhum teste removido/skip adicionado.

### R41 — fluxo inteiro no papel restrito
Revisão Cursor6103117150 confirma composição041 no HEAD473608, mas teste de venda ainda usava conexão administrativa. Corrigido o harness R41: createApp recebe exclusivamente executor de dados com SET LOCAL ROLE NOSUPERUSER/NOBYPASSRLS e GUCs sintéticas por transação; afirma papel em toda query/transação do serviço. Setup e inspeção final permanecem administrativos, separados da venda. Grants/policies adicionais só no schema/role descartáveis da fixture, nunca DEV. Mantidos concorrência de revogação, preço servidor e preservação de snapshots, sem skip/remoção. Typecheck e 2focados PASS; PostgreSQL real/CI do novo HEAD pendentes. Nenhuma migration/grant/flag/implantação/importação operacional.

R41 amplia a mesma prova real restrita: falha sintética no INSERT de auditoria de Orçamento é injetada depois da persistência de cabeçalho/itens, e a transação deve devolver contagens de documentos/itens/audits exatamente ao baseline. Após retirar o trigger descartável, o mesmo fluxo deve criar/converter normalmente. Sem policy/grant/migration/código operacional novo. Typecheck/diff PASS; CI do novo HEAD requerida. UI Produto/facade continuam reservadas; coordenação6103195052 solicita divisão para ligar os contratos às telas existentes com provas de sessão/empresa/CAS/respostas tardias. Sem implantação/importação/ativação.

### Produto operacional — seleção canônica dos mestres habilitados
Lacuna reproduzível no pacote270: getForOperation autoriza mestre vinculado na venda, mas listagem cadastral da empresa o omite. Lote próprio codex/produtos-lista-operacional-20261010, baseado no conteúdo2700ea56046 (tree12c31319), evolui GET /api/v1/produtos?operacao=true sem módulo/facade paralelos. Reutiliza listPage/count/search/paginação; visão explícita exige empresa, flag ENABLE_PRODUTO_EMPRESA e RBAC visualizar sem wildcard, GUCs e executor. Só mestres ativos com vínculo alvo ativo/habilitado e empresa Ativa; produtos próprios ativos preservados. Cadastro sem operacao e getById permanecem restritos. Não oferece saldo físico, preço de canal nem habilitação implícita.
HTTP/PGlite focados2PASS, typecheck/build/diffPASS; R41 real ampliado para busca/código/total/página vazia/cross-company/revogação no papel restrito. Full backend/CI pendentes; nenhum skip removido/criado. UI/facade reservadas seguem intactas, coordenação2616103195052. Sem migrations, grants operacionais, backfill, implantação/importação/flags/canais. Rollback mantém visão padrão anterior; não altera vínculos/dados/snapshots.

Seleção operacional agora inclui detalhe por ID no mesmo GET existente: /produtos/:id?operacao=true usa getForOperation/executor/locks/RBAC sem wildcard, empresa/flag obrigatórias, 404 antes de habilitação/em outra empresa/após revogação; no-store. GET cadastral sem opção continua restrito, não amplia PATCH/edição nem estoque físico. Parse operacao reutilizado entre lista/detalhe, valores inválidos422. HTTP/PGlite2PASS/typecheck/diffPASS; R41 obrigatório amplia prova de detalhe no papel restrito junto com venda/lista/rollback. Novo HEAD/CI/revisão exigidos; UI reservada e DEV intactos.

### UI Produto — vínculo operacional empresarial no formulário existente
Ownership Cursor2616103195676 liberou somente ProdutoFormV22_Completo, extração sob produto/, GET/PUT empresa-operacao na facade preparada e testes existentes. Código Codex em branch própria, base2713260696e/tree78d46a8f. Não houve corte CRM/C360/store/seletores/Auth/policies nem ativação de Produto em HTTP_PILOT_ENTITIES/entities.Produto.
Formulário atual ganhou seção de mestre Grupo→empresa selecionada, com permissão visualizar/vincular-empresa separadas da edição do mestre. Reutiliza useCadastroFormScopeGuard/getHttpProdutoApi; flag Produto existente continua OFF. Grupo sem empresa não consulta/grava. GET404 específico admite vínculo inexistente/version0; PUT usa CAS/flags, sem dados de tenant no body. 409/503/ACK inválido bloqueiam gravação até consulta explícita, sem retry automático. Duplo envio, resposta tardia de empresa/sessão e callback de rascunho antigo não substituem estado atual; AbortSignal não é promessa de rollback de servidor.
Extração de seção/hook se justifica porque formulário existente excede600 linhas; nenhum módulo/rota paralelo. 89focadosPASS/0FAIL/0SKIP (facade, carga Produto, guards e sessão reais via harness existente), build/lint/diffPASS. Frontendtypecheck baseline1658 erros conhecidos, novas extrações sem diagnósticos; não dizer typecheckglobalverde. CI/revisão do SHA novo pendentes. Nenhuma migration/grant/VPS/flag/provider/importação/dado real alterado. Rollback retira seção/metodos aditivos, preserva cadastros/vínculos e API. Experiência DEV ainda requer bases/041/role, revisão/CI/backup/rollback e homologação.

### CRM preflight — falsos positivos de policy e ACL de coluna
Dois defeitos reproduzidos no gate próprio: GRANT SELECT(codigo)/UPDATE(status) TO PUBLIC sem grant de tabela passava; policy apenas RESTRICTIVE com mesmo predicado também passava. Ambos testes ficaram vermelhos antes da correção. inspectCrmPreflight agora exige polpermissive=true e inspeciona ACL de coluna além da tabela, sem escrever em DB. 5focadosPASS/0FAIL/0SKIP, backendtypecheck/build/diffPASS; R40 real ampliado no schema isolado com adulteração/restauração das duas condições. Sem remoção/skip de teste. CI/revisão do novo SHA exigidas.
Mudança restrita ao preflight e testes próprios, sem client/app/Auth/guard/policy/migration/grants operacionais. Restantes gates continuam: corpo de função/outros triggers/session_user/ledger/fonteSHA/cluster/grants/runtime não homologados; ready estrutural não autoriza ativação. UI272f2fda9c1 revisada6103389497/CIsverdes, semmerge/deploy. Ownershipruntime2616103431766 confirma arquivos livres para proposta; desenho coeso/revisão ainda necessários, não retirar BYPASSRLS às cegas. Nenhuma importação/dadosreais/VPS/flags/canais.

### Executor comercial — preço e referências na transação da venda
Ownership/proposta2616103480734 confirma lote próprio a partir2738d1d7242. Branch codex/comercial-executor-preco-20261010; mainbaba confirmado. Teste vermelho antes da correção comprovou SALE_PRICE_ESCAPED_EXECUTOR: TenantGuard do preço consultava pool mesmo recebendo transação.
TenantGuard/ProdutoRelationGuard e portas resolveSalePrice agora aceitam executor final opcional. TabelaPrecoService encaminha-o ao tenant, ClienteEmpresa e resolvePrice; Orçamento/Pedido encaminham o executor do callback ao preço e à unidade. Callback inicializa GUC com scope já validado por prepare antes de consultas. Getters PG genéricos respeitam terceiro argumento compatível (WHERE/mapeamentos/defaultpool preservados); não cria módulo/client/montagem paralela.
Prova local no papel restrito impede qualquer fallback ao pool, valida unidade/relação, vê habilitado_operacao=false ainda não commitado e rollback restaura vínculo. Fixture inicial de bloqueio foi ajustada para usar habilitação, mantendo intacto chk_cliente_empresas_bloqueio e migrations. Backend final328PASS/0FAIL/18DBskips existentes semURL, typecheck/build/diffPASS. R41 real ampliado bloqueia no pool queries de cliente_empresas/tabelas/itens/unidades; cria Pedido direto e Orçamento→Pedido com preço servidor, rollback auditoria/revogação/snapshots preservados. Fixture não injeta GUC no início de withTransaction: callback real da venda deve fazê-lo. CI/revisão do novoHEAD pendentes, sem skip/remover testes.
prepare/RBAC anterior à transação, Auth/policies/CRM/store/C360/client.ts/App/role bridge/custos configurados permanecem separados e não homologados por este lote. Sem grants/migrations/flag/VPS/importação/provedores/canais/dados reais. Não equivale a NOSUPERUSER/NOBYPASSRLS do login DEV. Rollback de código reintroduz leituras fora do executor; preservar snapshots e gates fechados. Reservas026/025–037 e IDs/códigos inalterados.


## CODEX — contexto transacional de tenant no runtime (2026-10-11)
Ownership2616103944107 e contrato2616104051728; base2743ec26ad8/tree0ec3fc05, mainbaba91a6 confirmado. Branch própria codex/runtime-contexto-tenant-20261011, client.ts/createApp existentes reutilizados, sem montagem/serviço paralelo.
Opt-in tenantContextEnabled defaultfalse, fronteira somente após Auth verificado e scopeMiddleware; headers de dev/public/session não instalam contexto. Auth/bootstrap continuam pool sem GUC. AsyncLocalStorage por DbClient/tenant congelado, query scoped em transação curta; withTransaction scoped única conexão/reuso aninhado/rollback-only inclusive erro capturado. Tenant diferente/vida HTTP encerrada/executor expirado rejeitados; ROLLBACK que falha descarta conexão. Sem contexto mantém pool.query e transações independentes anteriores.
5focados PASS; backend final/checks registrados na PR; runner PostgreSQL obrigatório ampliado com papel descartável NOSUPERUSER/NOBYPASSRLS, concorrência A/B/rollback/ausência GUC residual, sem remover R40/R41 ou aceitar skip. PostgreSQL real pendente CI deste HEAD. Config/Auth/policies/services/CRM/store/C360/migrations/grants operacionais intactos. Sem merge/implantação/roleDEV/flags/importação/providers/canais; não homologa bootstrap Auth com role restrito nem destino/grants operacionais. Próximo: reviewCursor SHA final, provar CI real e completar autorização operacional antes corte.


### CODEX — compatibilidade SAVEPOINT sem contexto (#275)
CI3652/run38101935170 expôs regressão real em R10C/R10: wrapper marcava rollback-only em erro SQL também fora do opt-in, impedindo ROLLBACK TO SAVEPOINT dos testes existentes. Corrigido somente executor: marca em erro SQL apenas no contexto tenant; bootstrap/default preserva recuperação SAVEPOINT. Não removeu/alterou R10, nem aceitou skip. Novo teste comportamental focused6PASS/0FAIL/0SKIP; PG tenant anterior2PASS/0FAIL/0SKIP, R40/R41 verdes na run falha mas não CI integral aprovada. Novo SHA/CI exigidos. Sem merge/DEV/role/grant/migration/flags.


## CODEX — bootstrap Auth separado do executor de dados (2026-10-11)
Ownership2616104480326, branch própria codex/runtime-auth-dados-20261011, base275f6fa8a8a/tree7ffb8998; mainbaba91a6 confirmado. Reutiliza createDbClient/createApp/index e somente dependency/3 encaminhamentos Auth na montagem existente; não extrai/reimplementa handlers reservados nem cria serviço/policy paralelo.
authDb opcional query-only, defaultdb compatível, segue exclusivamente middlewareAuth e GET/POSTauth/session. Repos/guards/readiness/dados continuam db. AUTH_DATABASE_URL opcional para conexão explícita separada; ENABLE_TENANT_CONTEXT defaultfalse exige splitAuth/supabase_user. Startup split verifica flags efetivas e session_user NOSUPERUSER/NOBYPASSRLS do dataDb e fingerprint database/schema/server address/port concordante, antes listen; falha sanitizada fecha ambas. Sem split preserva papel/default anteriores; shutdown encerra ambas.
4focados comportamentais PASS: config sem segredo/publicview, default/mismatch/roles/cleanup, headerfabricado401/bootstrapfora/dadosreadiness, GET/POSTsessão/enriquecimento somenteauthDb. ProvaPGreal no runner anterior ampliada com loginrole descartável NOBYPASS/NOSUPER e duasconexões/destino/rejeiçãoadmin; CI novoSHA obrigatória. GrantsAuth mínimos/RLSoperacionais/fingerprintcompleto/backupreal/credenciais externas ainda gates, não homologados pelo fixture. Não define nomes/credenciais/grants operacionais, não configuraDEV/retiraBYPASS/migra/ativa flags/providers/canais/importa. Próximo: reviewCursor SHAfinal/CI e homologação operacional separada.


## CODEX — Auth bootstrap RLS por identidade verificada (2026-10-11)
Ownership2616104786892 reservou042 e liberou intervenções pósprovider em requestContext/authSession/client. Branch codex/auth-bootstrap-rls-20261011 a partir2769dedeafb/tree2a2643b5, mainbaba confirmado. 001–041 imutáveis; 025–037 preservadas na outra linha, sem backfill/GRANT/role operacional.
042 adiciona somente policies SELECT por app.auth_user_id, profilesativosdoAuth, groups autorizados e empresas Ativas dentroprofileGrupo/filial; não usa true, não concede privilégios. Fixtures mínimos compartilhados só entre testes, reutilizando queries/serviços/montagem existentes; não cria serviço Auth paralelo.
withAuthIdentity no clienteAuth separado: UUIDvalidado pósprovider, transaçãoREADONLY/set_configtrue, semGUCGrupo nemtenantData. GET/POSTsessão e middleware preservam filtrosSQL/contrato e usamcontexto obrigatório apenas comAuthURLsplit; defaultúnico compatível. Startup split agora exigeAuthcurrent+sessionrole tambémNOSUPER/NOBYPASS, ambasconexões/destino básico conferidos. Papel/grantsreais externos não inventados nemaplicados.
Provas locais PGlite0422x/semgrantnega/owner2empresas/filial1/estrangeiro0/inativaomitida/updateAuthnega; contextoREADONLY/UUID/sem misturaData, suítessessãocompatíveis. PGreal obrigatório amplia runner com doisloginsrestritos, grantsSELECTcolunafixture, login/restore/provider/headerfake/filial/outrogrupo/inativa/RBACfailclosed/readonly/GUCresidual, R40/R41 preservados. Não equivale a grants/RLSoperacionais completos de vendas/auditoria; fixturescomerciais separados permanecem gates de homologaçãoDEV. CI/reviewSHAfinalobrigatórios antes qualquerintegration. Sem merge/migrationDEV/grant/role/flag/deploy/importação/providers/canais.

Validação deste lote: 12focados (042/contexto/split) preservados; full359testes/341PASS/0FAIL/18DBskips preexistentes semURL com --test-concurrency=4, typecheck/build/lint/audit/diffPASS. Primeira execução encontrou assert última migration041, atualizado adicionando042 e preservando ordem/assert041. Segunda npmtest padrão encerrou processo runtime05 sem diagnóstico; runtime05 isolado3/0/0 e suíte integral concorrência4 passou, sem alterar teste/script/skip. CI padrão no SHA final e PGreal obrigatórios, não afirmar aprovação do corte por prova local.


### CODEX — prova RBAC canônica na #277
CI3664/run38107896861 falhou na última assert nova: MarcaService.list legado verifica escopo e retorna200, não chama RBAC. Corrigida prova sem remover casos: Marca200 passa a controle positivo de Auth; Orçamento canônico exige403/PERMISSION_DENIED com mesmas identidade/empresa e permissões ausentes. Runtime/migration042 intactos. 12focadosPASS/0FAIL/0SKIP, typecheck/build/diffPASS; novoPG/CI/SHA/reviewobrigatórios. Lacuna granular da listagem Marca é baseline verificada e permanece para coordenação própria, não declarada resolvida por042 nem alterada neste lote. Sem merge/deploy/grants/flags.


## CODEX — RBAC granular de Marca (2026-10-11)
Instrução direta do proprietário substitui espera por parecer para implementar; branch própria codex/marca-rbac-20261011, base2778bc4fef2/tree39030847, mainbaba91a6 confirmado. Coordenação2616107615388; sem editar branch Cursor/TenantCrud genérico. MarcaService existente agora prepara tenant e exige Cadastros/marca visualizar/criar/editar/inativar com wildcard global negado, guard obrigatório na montagem e default ausente fechado. Mesmo repo/IDs/CRUD/soft-delete/auditoria; perfil owner já contém essas ações, nenhum grant aplicado.
Harness antigo passa a fornecer perfis explícitos por ação sem remover asserts de payload/CRUD/audit/isolamento/Auth. Novo teste bloqueia cinco operações sem permissões e com wildcard, filial no Grupo/outro tenant, sem persistência/auditoria indevida. Prova PG Auth existente mantém negativos e agora exige Marca403/PERMISSION_DENIED, Orçamento403 preservado. Focados13PASS/0FAIL/2skipsPGpreexistentes semURL; typecheckPASS; suíte integral/build/CI e reviewSHAfinal exigidos. Sem migration/grant/role/flag/DEV/merge/importação/canais. Próximo: composição real de papéis/Auth/dados/RBAC e autorização operacional, mantendo bloqueio de deploy somente correspondente; legado em ambiente separado.

Validação final local Marca: backend342PASS/0FAIL/18skipsPGpreexistentes(360), concorrência4; typecheck/buildPASS. CI padrão/PG obrigatório e revisão final ainda pendentes.


### Marca — alvo empresarial do payload
Review2786107672506 confirmou o corte e apontou ressalva reproduzível: empresa_id do body redirecionava escrita após RBAC apenas no contexto. Corrigido: contexto Empresa não muda alvo nem promove mestre Grupo; contexto Grupo revalida tenant e permissão no alvo. Preserva criação compartilhada Grupo/empresa_idNULL, IDs/campos/audit; teste troca mesmaGrupo/null sem escrita/audit adicional. 14focadosPASS/0FAIL/2PGskips preexistentes, typecheck/buildPASS; novoHEAD/CI/review exigidos. CI3670 verde aplica somente b30e32ea anterior. Sem merge/grant/migration/DEV/canais.



## CODEX — Marca persistência atômica (2026-10-11)
Responsável Codex, workspace Comercial separado, branch codex/marca-persistencia-atomica-20261011 baseada279a0ee2f19; coordenação2616108289838. Reutiliza MarcaService/PostgresMarcaRepository/marcaTypes/app/audit/sequence existentes; TenantCrud/migrations/branchesCursor intactos. create/update/softDelete com db.withTransaction, GUCs locais e executor compartilhado por tenant/RBAC/sequence/registro/audit; memória preservada semdb. Teste detectou INSERT/UPDATE foraexecutor (deadlockPGlite), corrigidos antes entrega. Prova persistente PGlitePASS1/0/0: falhaaudit reverte registro+sequência+edição, preserva campos/inativação. RunnerPG obrigatório inclui mesma prova em schema isolado/papel restrito; CI deve confirmar, fixture nãohomologaDEV. Auth/RBAC real composição279confirmadaCursor6108070467/CI3710, reposmemória apenasnaquelaprova. Novopacote semdeploy/migration/grants/flags/canais/importação. Próximo: integraçãoHTTPpersistente/concorrência/isolation e papeloperacional/destino/backup/reversão; legado separado,04_REPORTS ACLnegada e03_EXPORT_STAGINGconteúdonegadoconfirmados, nãoimportado.


### Marca — fechamento da prova persistente e HTTP
PR280 ampliada no workspace Comercial: list/get compartilham executor e contexto RLS com as permissões; leitura de escrita usa FOR UPDATE para proteger snapshot/auditoria e preservar campos concorrentes. Teste persistente cobre rollback de inativação/auditoria, reabertura com mesmo ID/código/campos, contagem de auditoria e edições concorrentes de campos diferentes. Aplicação HTTP canônica usa repos persistentes, provider sintético verificado, Auth separado SELECT-only NOSUPERUSER/NOBYPASSRLS e usuário visualizar sem editar; criação/consulta/edição/inativação/reabertura, token inválido e troca empresarial negada. Fixture usa SET LOCAL ROLE; prova de LOGIN real/identidade de startup permanece em TENANT_CONTEXT. PGlite local passa, mesma prova obrigatória no runner PostgreSQL real; CI/revisão do novo SHA exigidas. Nenhum grant operacional, merge, migration ou implantação.
Próximo responsável Codex: conferir PG real e parecer exato, corrigir achados; avançar importador/piloto legado separado enquanto revisão. 04_REPORTS permanece BLOCKED: Get-ChildItem e Get-Acl retornam UnauthorizedAccessException em 2026-10-11; original intacto, nenhuma recuperação/importação real declarada.

## CODEX — Identidade canônica do legado sobre Comercial 038–042 (2026-10-11)
Responsável Codex, workspace legado separado, branch codex/legado-identidade-canonica-20261011. Recebimento e primeira ação comprovados: Cursor2616109078451 liberou contrato/arquivos; composição local integra pais PR284 c13238605976b26b1635a1384fc1d8087812ec20 e PR280 612c2055aa9e1371ac902a8957205023655759fa, sem main/branch Cursor. Main baba91a6b0d5d626edd607b8cd3522927e1904ab revalidada. Preserva integração264 e migrations001–042; somente043 aditiva nova.
Cliente e Produto usam identidade (group_id,source_system,codigo_legado), índices únicos parciais, código numérico interno separado e metadados originais. Serviços/repositórios canônicos existentes: leitura por chave antes criar, permissão importar explícita sem wildcard, mestre Grupo, procedência imutável, divergência documento/chave ou identidade ambígua exige reconciliação. Memória preservada com mesma unicidade. Produto adiciona apenas metadados nulos, sem backfill, habilitação ProdutoEmpresa, classificação histórica, saldo ou grant. Fornecedor continua sem contrato persistente canônico; não criar módulo paralelo.
Provas sintéticas: identidade/retry Cliente, documento diferente com mesma chave, chave diferente com mesmo documento, concorrência Cliente e Produto, isolamento entre Grupos, papel SQL NOSUPERUSER/NOBYPASSRLS com policies somente fixture, RBAC importar negado, empresa não ganha uso automático, edição preserva código/procedência, falha de auditoria Produto reverte registro+sequência, migration idempotente e histórico duplicado preservado/DDL bloqueado. PGlite é prova local; runner LEGACY_IDENTITY exige PostgreSQL real isolado no CI e zero skip. Auth LOGIN real permanece prova da composição279; fixture não homologa privilégios/grants/destino VPS.
PR283 4f1e8e0/CI3779 SUCCESS/review6109194757 e PR284 c1323860/CI3782 SUCCESS/review6109219552 sem bloqueio de código. Fonte04_REPORTS continua EPERM por leitura .NET e Node autorizadas; original preservado. Nenhuma recuperação/importação real, merge main, migration DEV ou deploy neste lote. Rollback de código mantém colunas/metadados aditivos; não excluir dados para reverter.
Próximo pacote executável: adaptador persistente Produto no consumidor existente, classe/unidade comprovadas, consulta/edição/reabertura/reconciliação/idempotência/reversão em destino sintético isolado. Revisão do SHA final bloqueia apenas integração/implantação. Fonte privada e fornecedor bloqueiam somente os respectivos itens; históricos sem empresa continuam separados dos saldos.

Validação local final identidade043: backend348PASS/0FAIL/18skipsPGpreexistentes, typecheck/build/rootbuild/lint/auditbaseline/diffPASS; mapper+consumer35PASS/0FAIL/0SKIP. Asserts de ordem das migrations estendidos041→042→043 sem remover cobertura. Código ainda candidato, CI PG real e parecer do SHA publicado obrigatórios.

### Identidade043 — correção do parecer2856109470368
Fonte/código vazios ou somente espaços agora falham nos schemas canônicos de create/update antes de RBAC de importação, reserva, INSERT ou auditoria. null/ausente continuam compatíveis para cadastro não importado; códigos originais preenchidos preservados. Teste usa CPF sintético válido para provar o campo correto, não uma falha incidental de documento. PG/PGlite cobre Grupo/Empresa; memória cobre ausência de escrita/audit, unicidade create/update, consulta por chave e identidade ambígua. 34focadosPASS/0FAIL/0SKIP, typecheckPASS; CI3788 SUCCESS pertence somente407b04fe anterior, novo SHA/CI/revisão exigidos. Próximo piloto Produto preservado em branch própria durante correção.
## CODEX — Produto legado: piloto persistido e ciclo completo (2026-10-11)
Responsável Codex, workspace legado separado, branch codex/legado-produto-piloto-persistente-20261011 sobre PR285 HEAD1be11f748408288186e5c48a7a97916bbc1a8d5a/tree25a9231358a5e4e865eaf9c32977f0321d3749b0. Base285 CI3794/run38143891259 SUCCESS; LEGACY_IDENTITY3PASS/0FAIL/0SKIP PostgreSQL real+PGlite+memória, Cursor6109602523 confirmou fechamento das chaves brancas. Ownership/primeiraação2616109479716, sem editar branch Cursor.
Reutiliza consumidor legado, mapper/catálogo classe/unidade, ProdutoService/repos canônicos e UnidadeMedidaService existente. Adaptador exige mestre Grupo, importar e visualizar unidade explícitos, mapa revisado e unidade viva ativa no mesmo Grupo; mantém código original/ID legado/fonte/lote, código numérico interno e não habilita ProdutoEmpresa. Retry equivalente reaproveita ID; divergência, inativo, unidade inválida ou mapping fabricado exigem reconciliação, sem writeretry de falha audit.
Relação de unidade importada revalidada sob FOR SHARE e mesmo executor da criação/edição/audit; alteração empresarial continua isolada. Privilégio fixture mínimo SELECT + UPDATE(updated_at) somente para lock; teste comprova ausência UPDATE amplo/de nome. Nenhum grant operacional. PATCH existente permite reabertura exclusivamente ativo:true sobre inativo com editar+restaurar sem wildcard; campos preservados. PATCH ativo:false exige inativar; auditoria restore/soft_delete corresponde à transição. Sem endpoint/módulo/TenantCrud/migration nova.
36focados e35mapper/consumer PASS/0FAIL/0SKIP; backend completo351PASS/0FAIL/18skipsPGpreexistentes(369), typecheck/build/lint/audit/diffPASS. Provas: carga/consulta/edit/reabertura/reversão, idempotência/concorrência, mapa explícito, unidade inativa e snapshot obsoleto, RBAC/tenant HTTP, rollback de criação+sequência/inativação/restauração quando audit falha, procedência preservada, origem intocada e sem vínculos empresariais automáticos. RunnerLEGACY_PRODUCT obrigatório PostgreSQL real isolado com zero skip; CI/revisão do SHA publicado ainda exigidos, não reutilizar selo285.
Implementado/testado sintético; não integrado em main, implantado, homologado na VPS, recuperado ou importado real. Fonte04_REPORTS EPERM permanece somente seu bloqueio. Reversão por inativação mantém ID/código/referências/metadados; rollback de código não remove colunas/dados.
Próximo pacote executável: atomicidade de edição/inativação/restauração de Cliente existente, fechando ressalva285 de audit após escrita, mantendo executor/lock/RBAC e memória; provas de falha audit/concorrência/isolamento. Autorização contínua não libera merge/deploy sem gates/review/CI/backup/reversão.


Revisão Cursor do HEAD 32dd1355: mapa vivo, FOR SHARE, retry sem nova escrita e rollback de audit confirmados. Correção no ProdutoService: mestre importado não muda para empresa_id; reabertura exige editar+restaurar sem curinga global. ClienteService mantém o mesmo guarda antigo e segue no pacote separado. Sem DEV, grant operacional, endpoint ou migration.


## CODEX — Cliente: ciclo persistente atômico (2026-10-11)
Responsável Codex, workspace legado separado, branch codex/legado-cliente-lifecycle-atomico-20261011. Recebimento e primeira ação: contrato/arquivos liberados por Cursor2616109648417; base28632dd1355109fc18494cb13b648ce4e26755f224d, correção Cursor169b8e9174544ac8159cd0289b54153315e81fd3 preservada na composição sem sobrescrever a branch dele. PR286 CI3796/run38144210227 SUCCESS, LEGACY_PRODUCT2PASS/0FAIL/0SKIP no PostgreSQL real isolado do HEAD32dd; selo não cobre automaticamente a correção169b.
ClienteService e repositórios existentes compartilham executor, lock FOR UPDATE, mutação e auditoria na edição/inativação/restauração; falha audit reverte registro, campos e estado. Memória serializa transações e mantém rollback sem apagar operação concorrente bem-sucedida. Contratos opcionais compatíveis, endpoints e TenantCrud preservados. RBAC revalidado após preparo e dentro da transação; mestre importado permanece no Grupo mesmo com empresa válida. Auditoria negativa de documento duplicado continua fora da mutação e persiste após rejeição. Identidade/procedência/código/IDs e campos não editados preservados.
23focados PASS/0FAIL/0SKIP após composição da correção Cursor; backend anterior354PASS/0FAIL/18skipsPGpreexistentes, nova suíte completa em validação após delta. TypecheckPASS; build/lint/audit/diff obrigatórios antes publicação. Provas SQL isoladas no runner LEGACY_IDENTITY obrigatório incluem concorrência de campos, rollback audit em todas transições, isolamento/RBAC, lock sem executor rejeitado e nenhuma query de mutação fora do executor. CI/revisão do HEAD final ainda exigidos.
Implementado/testado sintético; não integrado em main, implantado, homologado na VPS, recuperado/importado real. Fonte04_REPORTS EPERM e Fornecedor sem contrato persistente canônico bloqueiam somente seus itens; nenhum dado privado publicado. Próximo pacote independente: reconciliação do piloto persistido Cliente/Produto por identidade, IDs/código/metadados e estado, sem considerar contagens equivalência, com relatórios sanitizados e testes de retry/reversão/divergência. Gates de merge/migration/VPS e backup/reversão mantidos.

Validação final após composição169b: backend355PASS/0FAIL/18skipsPGpreexistentes(373), 23focadosPASS/0FAIL/0SKIP, typecheck/build/lint/audit/diffPASS. Não remover skips locais nem aceitar skip na suíte PostgreSQL obrigatória de CI; publicação/revisão no SHA final pendentes.


## CODEX — Reconciliação do piloto persistido por conteúdo (2026-10-11)
Responsável Codex, branch codex/legado-reconciliacao-persistida-20261011, base PR287 HEADef4b14f2c8aa94ceed07a867905b50ef378c7e38/treeb9eacef0fe4cc65498f4a5de5bd86f989b225db6. Primeira ação: implementação no consumidor existente, ownership2616109905476; mainbaba91a6b0d5d626edd607b8cd3522927e1904ab revalidada. PR287CI3806/run38145720927SUCCESS frontend/backend; PostgreSQL real LEGACY_IDENTITY6PASS/0FAIL/0SKIP e LEGACY_PRODUCT3PASS/0FAIL/0SKIP. Revisão2876109845963 em andamento, não é autorização de integração.
Snapshot privado de Cliente/Produto preserva identidade, ID/código numérico, conteúdo canônico e ativo/inativo; reconciliação usa serviços canônicos existentes, Group-only e visualizar explícito sem wildcard. Chave duplicada/ID repetido/snapshot inválido bloqueiam antes leitura; erros de permissão não viram ausência. Identidade ambígua fica divergência explícita. Relatório público contém somente índice/entidade/resultado/campos e totais, nenhum valor/ID/nome/documento/fonte/lote; nunca autoriza importação por equivalência/contagem. Leituras por registro não são snapshot global, declarado no contrato. Campos opcionais ausentes e null são semanticamente equivalentes, compatível memória/PostgreSQL.
Provas em fixtures existentes: carga/consulta/idempotência/reabertura/reversão, alteração de campo com contagem igual, estado inativo, isolamento/identidade, RBAC, ambiguidades/ausências/entrada adulterada, origem imutável e relatório sem PII. LEGACY_IDENTITY/PRODUCT no runner real isolado permanecem obrigatórios sem skip. Não altera serviços/repos/TenantCrud/router/schema, não cria módulo paralelo. CI/revisão exigidos no SHA publicado.
Implementado/testado sintético; nenhuma recuperação/importação real, merge main, implantação ou homologação VPS. Fonte04_REPORTS EPERM permanece bloqueada; Fornecedor/históricos/saldos aguardam contratos/fonte/mapa comprovados. Próximo item liberado após revisão da composição: preparar preflight canônico de destino/privilégios/backup/reversão para piloto real privado; gates de acesso/dados não são liberados por testes de CI. Frente Comercial preservada, sem editar branches Cursor.

Validação final: backend356PASS/0FAIL/18skipsPGlocaispreexistentes(374), reconciliação6focadosPASS/0FAIL/0SKIP, typecheck/build/lint/audit/diffPASS. Cursor2876109845963/6109891677 aceitou HEADef4b14f2 com CI3806 e provas reais isoladas6/3/17 sem skip; revisão deste novo lote e CI próprio obrigatórias.


## CODEX — Preflight operacional: identidade do LOGIN (2026-10-11)
Responsável Codex, workspace Comercial separado, branch codex/runtime-preflight-login-20261011. Base PR280HEAD612c2055aa9e1371ac902a8957205023655759fa/tree82e8a17ad3d5fa2d3a9e3206e372cce2fad8530b, local4dfaf086; mainbaba91a6 preservada. Coordenação de arquivos2616109939369/6109949623 e primeira ação comprovada: teste vermelho reproduziu sessão privilegiada escondida por SET ROLE restrito que passava current_user isolado. Sem editar branch Cursor/serviços/TenantCrud/Auth handlers.
Preflight CRM existente consulta session_user/current_user e flags dos dois papéis sem devolver nomes/IDs. Gate requireRestrictedLogin explícito, obrigatório no CLI operacional, exige login efetivo igual à sessão e ambos NOSUPERUSER/NOBYPASSRLS. Falha identidade aborta antes de catálogo. Modo estrutural existente sem opção continua compatível e não homologa LOGIN. Nunca autoriza ativação: CLI mantém activationAuthorized=false e transação read-only. Nenhuma migration/grant/policy/credencial operacional.
Provas: teste vermelho→verde6focadosPGlite0FAIL0SKIP; fixture PostgreSQL real existente TENANT_CONTEXT ampliada com LOGIN real restrito e rejeição de sessão admin+SETROLE restrito. Não retira provas nem aceita skip na CI. Suite/checks locais em conclusão; CI/revisão do SHA final obrigatórias, não reutilizar aprovação280. Cluster/fonte/backup recuperável/grants/RLS/fluxo funcional VPS continuam gates separados; zero leitura de dados reais.
Frente Legado independente: #287 ef4b14f2 aceita Cursor6109845963/6109891677, CI3806SUCCESS, SQL real6/3/17 sem skip; #288 a25b4a27 reconciliação conteúdo/estado com CI3808SUCCESS, SQL real7/3 sem skip, revisão pendente. Fonte04_REPORTS EPERM e contratos/fonte fiscal faltantes bloqueiam somente recuperação/importação real. Nenhum merge main/deploy/carga nesta execução.
Próximo item: incorporar parecer exato da288 e deste preflight, preparar composição/inventário canônico e backup/reversão sob gates; não homologar VPS por CI. Pacote Código Marca/identidade/Cliente/Produto/reconciliação implementado em branches próprias, IDs/registros/azul/isolamento preservados.

Validação preflight local346PASS/0FAIL/18skipsPGpreexistentes,6focadosPASS/0FAIL/0SKIP/typecheck/build/lint/audit/diffPASS; CI3814 do289 em andamento.


## CODEX — Composição Comercial + piloto legado (2026-10-11)
Responsável Codex, workspace Comercial, branch codex/comercial-legado-composicao-validada-20261011. Primeira ação comprovada: merge de branches próprias preflight LOGIN b79d0d2d/remote289a88b70b8 e reconciliação36ca6cc1/remote288a25b4a27. Ambos ancestrais mantidos, não reintroduz integração254/261 antiga, não altera mainbaba91a6/branchesCursor. Conflitos somente STATUS/HANDOFF resolvidos preservando ambas frentes e capacidades; código compôs sem conflito.
Pacote reúne Marca atômica/RBAC granular, CRM canônico, Produto compartilhado, preço transacional, Auth/tenant 038–042, identidade043 e pilotos Cliente/Produto com reconciliação. Migrations001–042 imutáveis;043 candidata aditiva, nunca aplicada naDEV. Produto mestre não libera uso empresarial/estoque; grupo e empresa fiscal preservados. Fonte04_REPORTS EPERM bloqueia recuperação real, histórico sem empresa não vira saldo. Código/registro/ID/vínculo/audit e azul existentes preservados.
Prova integrada local/CI obrigatória no conjunto, sem remover testes/aceitar skips no PG real. Revisões285/287 jáaceitas;288/289 aguardam parecerexato, revisão desta composição também obrigatória. Sem merge main, implantação, grant, dados reais, providers/canais. Antes aplicação: destino e papel mínimos reais, backup recuperável, reversão, usuário proprietário/restrito e gates históricos026/estoque/fonte. CI não homologaVPS.

Validação integrada local: backend357PASS/0FAIL/18skipsPGpreexistentes(375), mapper/consumidor35PASS/0FAIL/0SKIP, typecheck/build/lint/audit/diffPASS. #288 a25b4a27 aceita Cursor6109927582 eCI3808SUCCESS, PGreal7/3sem skip. #289 a88b70b8 CI3814/run38146755162SUCCESS frontend/backend, parecer6109980852 ainda pendente. Apenas043 difere de migrations001–042 da base280; nenhuma aplicadaVPS. Próxima ação: revisar/validar CI do SHA composto e só então preparar gates de destino/backup/reversão com fonte privada comprovada. Nenhuma autorização por contagem nem remoção de capacidades.


## CODEX — Central Cliente 360 / CRM canônico (2026-10-11)
Responsável: Codex, workspace Comercial separado, branch codex/cliente360-crm-canonico-20261011. Base composição #290 HEAD e5b7bd7bb51c6c7486e48328fb5d35bbd4bd5e2a (CI3816/run38147017927 SUCCESS), main baba91a6 preservada; ownership anunciado a Cursor em #261 comentário6110035519. Não há confirmação de recebimento específica deste delta ainda; revisão independente do SHA final obrigatória.
Pacote implementado: Central existente recebe OportunidadeService canônico já montado pelo app quando ENABLE_CRM_HTTP=true; consulta somente oportunidades ativas do ClienteEmpresa da empresa atual, pelo serviço/RBAC/repositório existentes. Flag desligada mantém skipped/CRM_CANONICAL_HTTP_PENDING. 403 e falha parcial mantêm forbidden/unavailable/meta null, sem fallback para store legado. Projeção explícita exclui contatos, notas livres, atores e chaves de replay. crm_limit/crm_offset atravessam router/facade; painel azul existente mostra código numérico separado do ID técnico, etapa/status/valor e carregar mais. Paginação reinicia por cliente/grupo/empresa/ator/sessão; queryKey/AbortSignal/sem placeholder impedem reutilização tardia entre contextos.
Extração auxiliar clienteCentral360CrmProjection necessária à refatoração do agregador grande; não havia projeção CRM equivalente segura. Reutiliza OportunidadeService/list e o painel atual; nenhum módulo, endpoint, persistência ou TenantCrud paralelo. Serviços/policies CRM e Auth do Cursor não editados; app apenas injeta dependência existente.
Validação local: 6 testes HTTP backend e 26 frontend PASS/0FAIL/0SKIP; suite backend358PASS/0FAIL/18skips PG preexistentes antes da adição do teste persistido; teste persistido compartilhado PGlite2PASS/0FAIL/0SKIP; typecheck/build backend, build SPA/lint/audit/diff PASS. Mesmo contrato persistido executa também no R40 PostgreSQL real isolado obrigatório da CI, com repositório CRM sob NOSUPERUSER/NOBYPASSRLS, paginação/projeção/RBAC negado; fixture SET ROLE não homologa LOGIN operacional. CI do novo SHA e revisão pendentes até publicação/resultado.
Próximo pacote autorizado: prova de respostas tardias/revogação de contexto nos formulários próprios CRM, conforme inventário dos consumidores existentes; continuar em branch própria após este lote, sem alterar serviços CRM do Cursor. Legado: fonte04_REPORTS EPERM bloqueia apenas recuperação real; contratos/importador/pilotos/reconciliação sintéticos #288 já entregues. Nenhum merge main, implantação, grants, migração DEV, provider/canal, recuperação/importação real. Antes operacional: revisão exata, CI, identidade/privilégios do destino, backup recuperável, reversão e gates históricos026/estoque.


## CODEX — Central CRM legado: cancelamento e sessão (2026-10-11)
Responsável Codex; branch codex/central360-respostas-tardias-20261011, base #291 HEAD9c6fdfe9956c9faa791b333cfe0e651e213c1556/tree7d4293a58bdfa2e15696937841666bb93264366c. Ownership anunciado #261/6110162246; nenhuma branch/serviço/policy/Auth do Cursor editada.
Achado: adaptador legado preservado da Central não distinguia ator/sessão na queryKey e ignorava cancelamento da leitura; cenário reproduzido por resposta diferida e QueryClient/QueryObserver reais. Correção no helper/painel existentes: chave por cliente/grupo/empresa/ator/fingerprint não secreto da sessão/permissão; ausência de contexto/permissão bloqueia; AbortSignal rejeita leitura cancelada antes/depois do store, sem projetar/cachear retorno antigo; sem placeholder. Abrir CRM também valida contexto após import assíncrono, chave da janela por contexto e invalidação ao desmontar. Fallback somente skipped com código exato CRM_CANONICAL_HTTP_PENDING; desconhecido/forbidden/unavailable não muda fonte.
Testes comportamentais:20PASS/0FAIL/0SKIP, seis trocas de identidade/permissão com resposta tardia, cancelamento antes/depois da fonte, nova consulta válida, paginação/HTTP/sessão e compatibilidade; lint/build SPA/audit/diff obrigatórios. Backend não alterado neste delta; provas backend/PG do pacote291 seguem obrigatórias em CI próprio. Documentação adiciona à fila existente sem novas regras/módulos/DDL. CI/revisão do SHA deste lote pendentes após publicação; #291 revisão/CI ainda em execução no instante da preparação.
Pacote seguinte: aplicar somente achados reproduzíveis das revisões289/290/291 e deste lote; preparação operacional depende de revisão composta, privilégio LOGIN/destino reais, backup recuperável/reversão e fonte privada comprovada. Legado04_REPORTS EPERM bloqueia recuperação real, Fornecedor/históricos aguardam contrato/fonte, nenhuma autorização por contagem. Nenhum merge main, implantação, grant/migraçãoDEV, provider/canal, recuperação/importação real. Estes gates não são liberados por CI sintética.


Fechamento factual: #291 HEAD9c6fdfe9956c9faa791b333cfe0e651e213c1556 CI3822/run38148084260 SUCCESS frontend/backend; logs114495556142 comprovam R40CRM3PASS/0FAIL/0SKIP, LEGACY_CLIENT17/0/0, IDENTITY7/0/0, PRODUCT3/0/0, TENANT_CONTEXT4/0/0 e MARCA_ATOMICITY2/0/0. Cursor291 comentário6110157133 recusou iniciar revisão por spend limit/usage-based billing. Bloqueio externo somente de revisão/integração; não implica autorização de merge/DEV. Lote respostas tardias20/0/0, lint/buildSPA/audit/diffPASS, backendinalterado. Responsável Codex; próxima ação operacional depende de restaurar disponibilidade do revisor independente e parecer dos SHAs exatos; fila de implementação preservada nos documentos.


Prova comportamental adicional do mesmo lote: HTTP Central com QueryClient/QueryObserver reais e transporte que deliberadamente ignora AbortSignal; retorno tardio após troca de grupo/empresa/ator/token não reaparece no observer/cache. Focados21PASS/0FAIL/0SKIP, lint/diffPASS. CI3824/run38148438733SUCCESS corresponde ao SHA0200ce75 anterior; novo teste exige CI/revisão no HEAD atualizado, não reutilizar selo antigo. Código runtime não mudou neste complemento. PR292 aberta/draft, base291 preservada.


## CODEX — Formulários CRM: submissão única e contexto (2026-10-11)
Responsável Codex, workspace Comercial separado; branch codex/crm-form-submissao-segura-20261011. Base #292 HEAD5b7dc32a8e8927f198e707c9232544ae49acbe7f/tree dd90ca061dd538067126611c5cd044d58cf90918, CI3830/run38149098403 SUCCESS. Main baba91a6 preservada, branches/serviços/policies Cursor intocados. Ownership anunciado #261/6114125191 e6114150202; confirmação de recebimento ainda não observada, revisão independente exata continua obrigatória.
Pacote executável Onda3: OportunidadeForm, InteracaoForm e CampanhaForm existentes não aguardavam onSubmit. Agora aguardam gravação, bloqueiam submissões simultâneas com gate único compartilhado, mostram erro e preservam campos/IDs/extensões do payload validado/carimbado de FormWrapper. Snapshot inclui campos aninhados; conversões anteriores de duração/orçamento mantidas. Reuso useCadastroFormScopeGuard valida grupo/empresa/ator/sessão antes de escrever e após retorno. Mudança após escrita informa resultado possivelmente concluído e exige consultar registro; não desfaz nem repete automaticamente. UI azul preservada; FormWrapper/TenantCrud/contratos/backend/armazenamento não alterados. Trava de interface não substitui idempotência, RBAC ou transação backend.
Helper crmFormSubmission.js é extração necessária para compartilhar/testar a mesma coordenação assíncrona nos três consumidores; busca não encontrou equivalente viável. Nenhum novo módulo/entidade/persistência ou helper duplicado por formulário. Testes6PASS/0FAIL/0SKIP incluem render dos componentes React reais com fronteiras UI/contexto substituídas e seus handlers reais (não homologação browser), callback único pendente, payload completo, guard stale, erro/retry explícito, snapshots e contexto durante retorno. Com regressões Central:27PASS/0FAIL/0SKIP; lint/buildSPA/audit/diff PASS. Backend inalterado; CI completa do SHA publicado permanece obrigatória, sem dispensar PG real ou retirar testes.
Próxima atividade independente na fila: inventariar callbacks de edição/conversão em OportunidadesLista e seus consumidores, coordenar ownership antes de mudar; manter fonte/contratos canônicos, não liberar conversão/grants/providers. Revisão Cursor bloqueada por billing nas291/292, impede integração/DEV, não implementação. Legado04_REPORTS EPERM bloqueia fonte real somente; pilotos/reconciliação288 mantidos, recuperação/importação real0. Nenhum merge main, migration/grant/VPS/canal ou dado privado publicado. Para integração/implantação: parecerHEADexato, CI, identidade/privilégios mínimos do destino, backup recuperável/reversão e gates026/estoque/fonte.


## CODEX — Callbacks CRM: permissão atual na gravação (2026-10-11)
Responsável Codex, workspace Comercial; branch codex/crm-callback-permissoes-20261011. Continuação iniciada após publicação #293 HEAD90a82a9913e258744ee9253a63b6b349d41407ea/tree418fc7192ac6779175b1631a8ddd5b24a02a3c2a; CI3905/run38178019135 em execução no instante da preparação. Ownership #261/6114199235 anunciado, sem editar serviços/policies/branches Cursor. Main baba91a6 mantida.
Inventário encontrou callback de edição da janela OportunidadesLista sem conferir permissão ao salvar. Reutiliza hookusePermissions atual por ref; criação/edição conferem mesma permissão de seus botões antes de chamada persistente e após retorno. Revogação antes gera0writes; depois informa resultado possivelmente concluído, sem toast de sucesso indevido/retry/compensação automática. Payload/ID/referências/azul/consumidores existentes preservados. Backend RBAC continua obrigatório; nenhuma decisão de autorização delegada ao browser.
Dois testes novos executam componente React e useMutation/QueryClient reais, com contexto/UI/storage substituídos: janela aberta, permissão revogada antes/depois, gravação válida, payload/ID preservados, tentativa posterior bloqueada. Com formulários e Central29PASS/0FAIL/0SKIP; lint/buildSPA/audit/diff PASS. Nenhuma alteração backend/DDL/flag/VPS/dado real.
Item conversão legado inventariado: cria documento e depois atualiza oportunidade em chamadas separadas. Não foi reescrito nem declarado atômico/homologado neste lote; depende contrato/executor canônico e composição CRM→Orçamento/Pedido sob revisão. Próximo pacote: integrar consumidores da conversão ao fluxo canônico existente após inventário/ownership, sem segundo documento/store/executor ou inferir orçamento de origem. Espera de revisão bloqueia integração/implantação somente. Cursor billing em291/292 continua impeditivo externo; fonte04_REPORTS EPERM bloqueia recuperação real. STATUS/HANDOFF registram implementação e próximos gates; código não implantado, dados reais não recuperados/importados.


## CODEX — Fachada CRM HTTP preparada (2026-10-11)
Responsável Codex; branch codex/crm-facade-http-preparada-20261011, workspace Comercial separado. Base #294 HEAD0e5b7795a3b1b8588f01b05063df64a6101e1102/tree79192a87e280ba078fbfb68a705495070c2c5e51, CI3907/run38178244370 SUCCESS; #29390a82a99 CI3905/run38178019135 SUCCESS. Ownership #261/6114233613 anunciado, serviços/repositórios/rotas/policies/branches Cursor intactos, main baba91a6 preservada.
Inventário: oportunidadeRoutes/OportunidadeService canônicos já existentes, fachada HttpApiClient sem superfície CRM. Implementado api.oportunidades na mesma fachada: list/get/getByLegacy/create/update/deactivate/restore/linkOrcamento/linkPedido; nove rotas existentes, paginação/meta intactos, IDs codificados, tenant/Bearer/AbortSignal, expected_version/idempotency_key do chamador mantidos. HTTP_PILOT_ENTITIES/flags/entities não alterados; nenhuma troca de fonte das telas, fallback ou retry automático. Link usa documento existente pelo serviço canônico, não cria outro executor/persistência/conversão.
Provas:52testesfrontendPASS/0FAIL/0SKIP; testeHTTPbackend existente ampliado1PASS/0FAIL/0SKIP com fachada real→servidorloopback sintético: default503, CRUD/list/replay/ciclo/CAS409/empresa404/RBAC403; vínculoOrçamento sem permissão retorna403 sem expandirfixture, referênciaPedidoinexistente404. Teste dev_headers/memória não homologa Auth/LOGIN/VPS. Typecheck/buildbackend, lint/buildSPA/audit/diffPASS. Nenhum teste retirado; CI completa própria/PGreal e revisãoSHAfinal obrigatórios.
Próximo pacote: consumidor da conversão canônica com contrato completo de documento/itens/empresa fiscal/orçamento de origem, preservando vínculo único Pedido→Oportunidade aprovado. Conversão legado ainda tem duas chamadas e não é declarada atômica; não resolver via dual-write frontend, nova fonte ou criação automática sem executor canônico. A fila Onda3 continua após fechamento deste pacote de formulários+callbacks+fachada; gates impedem integração/DEV enquanto Cursorbilling sem parecerexato. Legado04_REPORTS EPERM bloqueia recuperação real somente; pilotos/reconciliação288 mantidos, importação/recuperação real0. Nenhum merge main/DDL/VPS/grant/provider/canal ativado.


## CODEX — Conversão CRM / Orçamento vinculado → Pedido atômica (2026-10-11)
Responsável Codex, workspace Comercial separado, branch codex/crm-conversao-pedido-atomica-20261011. Base #295 HEAD21fa73651036a6c461474462720fea41efce88e7/tree08b7f54f9076b8ba5f4c4eb6c4f70e76a745c5ad, CI3909SUCCESS. Ownership proposto #261/6114359099; recebimento específico ainda não confirmado. Não edita branches Cursor, migrations ou políticas de domínio. Main baba91a6 preservada.
Pacote implementado no agregado/rotas/fachada existentes: POST /api/v1/oportunidades/:id/converter-orcamento-pedido exige expected_version, orcamento_id original e parâmetros da conversão de Pedido existente. Oportunidade deve estar ativa, Ganho e vinculada exatamente ao Orçamento informado. Lock de oportunidade/Orçamento/Pedido, ClienteEmpresa ativo/autorizado, perfil e permissões CRM.aprovar/Comercial.pedido.converter-pedido+visualizar/Orçamento.visualizar revalidados. Produto mestre compartilhado continua exigindo disponibilidade empresarial viva; não altera isolamento nem infere REVENDA, fiscal, produção ou saldo.
PedidoService.convert reutilizado com executor opcional, mantendo contratos anteriores. Código/registro/itens/histórico/auditorias e leitura da auditoria do criador usam o executor da transação CRM. Orçamento é lido FOR UPDATE, ativo/EM_ABERTO, preço/item/identidade de origem preservados; Pedido pertence a uma única oportunidade pelo vínculo canônico existente. Receipt de hash de solicitação normalizada fica nos metadados do histórico já existente, sem schema/migration ou nova tabela: retry idêntico retorna mesmo Pedido, divergente409. IDs técnicos, código, referência textual legacy_pedido_id e orçamento original preservados. Erro23505 de auditoria não é confundido com índice único de conversão. Nenhum retry/compensação automática no frontend.
Porta transacional disponível somente com executor SQL real; em memória nova operação falha503 antes de escrever. CRUD/link/convert anteriores em memória permanecem compatíveis, não simulam atomicidade entre repositórios independentes. Fachada preparada envia comando único; nenhuma flag, pilot entity, fonte de tela ou fluxo legado trocado. Novo método/rota são composição necessária: inventário não encontrou operação existente que convertesse e vinculasse CRM na mesma transação; não cria módulo, executor, Pedido ou store paralelo.
Provas: backend360PASS/0FAIL/18skipsPG locais preexistentes(378), focados11/0/0 e53frontend/0/0; typecheck/buildbackend, lint/buildSPA/audit/diffPASS. Contrato compartilhado em R40 usa PGlite e PostgreSQL real obrigatório na CI: seis concorrentes/um Pedido, retry/divergência, preços, IDs/legado/origem, falha na auditoria após criação com rollback de Pedido/itens/histórico/audit/numeração e retry, 23505 distinto, produto sem vínculo habilitado, empresa/RBAC, usuário restrito a uma empresa, Orçamento cancelado e, no PG real, cancelamento concorrente com lock. Fachada→HTTP→serviços→SQL com papel NOSUPERUSER/NOBYPASSRLS e detector que rejeita SQL escapando do executor; fixtures/grants locais, dev_headers e SET ROLE não homologam LOGIN/Auth/VPS. Provas PG real sem skip e revisão do SHA exato pendentes de publicação/CI.
Próximo item independente: consumidor de conversão na tela existente, com seleção/dados obrigatórios explícitos e guard de respostas tardias; reusar endpoint e formulários canônicos, sem duas gravações frontend nem fallback para converter em outra fonte. Revisão Cursor bloqueada por billing não autoriza integração/DEV. Legado04_REPORTS EPERM bloqueia recuperação real apenas; pilotos/reconciliação preservados, recuperação/importação real0. Nenhum merge main, deployment, grant/migration operacional, provider/canal ou dado privado publicado. Gates destino/LOGIN mínimo, backup recuperável, reversão e026/estoque permanecem.


## CODEX — Consumidor da conversão canônica na tela existente (2026-10-11)
Responsável Codex, workspace Comercial separado, branch codex/crm-conversao-consumidor-20261011. Base #296 HEAD38ebdac4d19f4dd53689e89b2193fd27cb8dc1ba/tree6c69121eb363e6ce90c699817846c9011be403a0, CI3919/run38180860420 SUCCESS frontend/backend; logs114592924853 confirmam R40CRM4/0/0 em PostgreSQL real isolado. Ownership #261/6114782360 anunciado, recebimento não presumido. Backend produtivo/migrations/policies/branches Cursor intocados neste delta; main baba91a6 mantida.
Pacote UI completo: CentralCliente360Panel existente abre ConverterOportunidade existente para registro HTTP canônico com Orçamento vinculado, versão e permissões pertinentes. Antes de abrir confirma quatro permissões pelo guard HTTP da sessão; contexto/ator/token verificados antes/após espera e escrita. Helpers compartilhados crmFormSubmission concentram comando/recibo/orquestração extraídos do painel grande, sem componente/executor/store paralelo. Comando único API38ebdac4; sem criar Pedido e depois gravar oportunidade no frontend. Número/código separados do ID técnico e preço snapshot preservado.
Modal canônico exige operação Retirada/Entrega, data/hora solicitadas; Entrega exige Local do cliente, Obra opcional, somente opções dos blocos autorizados. Orçamento/versão derivados do registro, não do input arbitrário; não transmite itens/preços/totais/tenant/ator no corpo. Aguarda Promise e bloqueia submissões simultâneas; campos mantidos em erro. Resposta incompleta/divergente/tenant errado fica não confirmada e exige consulta, sem sucesso ou retry automático. Troca de contexto oculta dados antigos e bloqueia comando; sessão estática antiga não permite ler/renderizar painel. Grupo mantém empresa de destino explícita/proveniente do contexto canônico, sem exigir seleção global de empresa nem inferir fiscal; filial não herda permissão Grupo. Backend continua autoridade de autorização.
Legado preservado com as opções anteriores Orçamento/Pedido; callback agora retorna mutateAsync para modal aguardar, sem nova fonte/fallback ou declaração falsa de atomicidade das duas chamadas antigas. Nova UI aparece apenas no bloco CRM HTTP já habilitado, não altera flags/pilotos/canais. Fechar/reabrir modal captura contexto atual; origem técnica e código mantidos.
Provas locais:60frontendPASS/0FAIL/0SKIP, incluindo sete novos testes de componentes React reais/handlers reais com fronteiras contexto/UI/transport substituídas: comandos/versão/origem, recibo inválido, janela/uma escrita, negação, resposta tardia, sessão/empresa/ator e Grupo com empresa-alvo explícita. Não é homologação browser/usuário real. R40 contrato persistido ampliado para Entrega+Local+Obra e local cross-group negado:3PGlitePASS/0FAIL/0SKIP; mesmo contrato obrigatório no PG real da CI própria, grants novos somente em schema/role de fixture, sem grant operacional. Typecheckbackend/lint/buildSPA/audit/diffPASS.
Próximo pacote: composição final código+consumidor e preparação dos gates de implantação com alvo/privilégios mínimos/backup recuperável/reversão, mantendo prova real de proprietário e usuário restrito na DEV somente após revisão exata. Revisão Cursor ainda bloqueada por billing, CI não autoriza merge/DEV ou ativação. Legado04_REPORTS EPERM permanece na fonte real, pilotos/reconciliação preservados e recuperação/importação real0. Nenhum merge main, deploy/migration/grant operacional, provider/canal ou dados privados publicados.

## CODEX — Preflight CRM: flags de privilégio explícitas (2026-10-11)
Base local cde69747 / remoto #297 1be96223d49750d282202fe1888c12c6bcd14fcd; main conferida baba91a6b0d5d626edd607b8cd3522927e1904ab. Responsável Codex, workspace Comercial separado. Defeito reproduzível: restrictedRole aceitava flags ausentes/null/zero por coerção booleana. Corrigido no preflight existente para exigir rolsuper=false e rolbypassrls=false explicitamente. Teste negativo de quatro respostas ambíguas mais regressões existentes: 7 PASS/0 FAIL/0 SKIP. Sem alteração de contratos, grants, migrations, dados ou VPS. Implementação local; publicação/CI/revisão ainda pendentes. Próximo: concluir checks e publicar lote, depois ampliar preparação da composição CRM/Pedido usando dependências reais; integração permanece bloqueada por revisão independente indisponível (billing Cursor).

Complemento do mesmo pacote #298: a sequência entity_code_sequences agora exige RLS habilitada/forçada e entra na checagem PUBLIC de tabela e colunas junto à oportunidade. Antes, grants públicos ou NO FORCE na sequência podiam manter ready=true. Oito testes focados PASS/0FAIL/0SKIP; contrato PG real R40 ampliado com falhas provocadas e recuperação dos gates. Não modifica policies/grants operacionais: alterações de teste somente em fixture isolada. Próximo: CI do HEAD atualizado, revisão independente e preparação das dependências de conversão; nenhum ready equivale a autorização de ativação.

## CODEX — Preflight CRM/Pedido: persistência central (2026-10-11)
Responsável Codex; branch codex/crm-pedido-preflight-persistencia-20261011, workspace Comercial separado. Main conferida baba91a6b0d5d626edd607b8cd3522927e1904ab. Base #299 HEAD6801a0f8c66fb268417f626ba7d0d23c7715a40c CI3939SUCCESS; #298 HEAD2a11238dbdbacb5500efa5c9c2628b8aeb68417d CI3937SUCCESS. Ambos preservados, sem merge/DEV; Cursor reporta bot desabilitado6115199925.
Implementação no preflight/CLI existentes, sem módulo novo: requirePedidoPersistence opt-in inspeciona somente catálogos de pedidos/pedido_itens/pedido_historico/audit_logs/orcamentos/orcamento_itens. Exige tabela real, RLS/FORCE, grants da operação (histórico append-only não exige SELECT/UPDATE/DELETE), policy permissiva aplicável por comando/papel e ausência de ACL PUBLIC em tabela/coluna. UPDATE(updated_at) de Orçamento exigido para lock; não concede privilégios. CLI CRM_PREFLIGHT_PEDIDO_PERSISTENCE=true valida opção e stage antes de conectar; mantém LOGIN restrito, destino explícito, transação READ ONLY, saída sem nomes/IDs/credenciais e activationAuthorized=false.
Limite explícito: scope=crm_pedido_persistence_only e unverifiedGates de referências/policies semânticas, Auth/RBAC, isolamento comportamental, backup/restauração e fluxo funcional. Policies aplicáveis não provam seu predicado correto. O gate complementar não homologa conversão nem estoque/produção/provider/canal. Configuração ausente conserva contrato anterior schema_only; inválida ou before_migration com persistência bloqueia pré-conexão.
Testes: catálogo somente SELECT, grants ausentes, papel da policy errado/ausente, RLS não forçada, PUBLIC em coluna, tabela ausente/view, configuração ambígua e compatibilidade. Mesmo contrato R40 ampliado em PGlite e PostgreSQL real obrigatório com falhas provocadas de auditoria/RLS/PUBLIC e restauração dos gates; não reduz testes nem aceita skip na prova real. Próximo: CI/revisão SHA final e prova das referências/policies comportamentais com Auth no destino isolado; backup/restauração e integração/DEV mantêm gates existentes. Legado04_REPORTS EPERM afeta somente fonte real; nenhuma recuperação/importação operacional realizada.
Fechamento local deste pacote: focados10PASS/0FAIL/0SKIP, contrato R40 persistido3PASS/0FAIL/0SKIP; suíte backend364PASS/0FAIL/18skipsPG locais preexistentes(382). Typecheck/buildbackend, lint/audit/diffPASS. PostgreSQL real obrigatório será comprovado na CI do SHA remoto final, sem reutilizar CI da base.

## CODEX — CRM/Pedido com LOGIN real isolado (2026-10-11)
Responsável Codex, branch codex/crm-pedido-login-isolado-20261011 no workspace Comercial. Base pacote #300 HEADa62ab7bb1344bbdc45b86f26ea5472479d93874d, sem merge; main baba91a6 preservada. Implementação exclusivamente em fixtures/testes existentes: realCrmFixture aceita restrictedLogin opcional e conserva modo SET ROLE padrão. Modo novo abre pool com papel LOGIN NOSUPERUSER/NOBYPASSRLS criado somente no PostgreSQL isolado allowlisted localhost/erp_test; credencial sintética aleatória efêmera não é retornada/logada/persistida. Cleanup fecha pools e remove apenas schema/papel da fixture.
O mesmo contrato proveAtomicCrmPedido é reutilizado: identidade session_user=current_user com flags falsas, preflight de persistência com requireRestrictedLogin=true, concorrência/retry, rollback de auditoria, preços/IDs/origem, empresa/RBAC, cancelamento concorrente e Entrega/Local/Obra. Teste real adicional registrado apenas quando o runner obrigatório fornece DATABASE_URL; nenhum skip introduzido; runner exige total positivo/zero skip. Prova local PGlite3/0/0 e typecheckPASS não são prova de LOGIN real: resultado novo depende da CI PostgreSQL final.
Não altera serviços, repositórios, migrations, auth provider, grants/policies operacionais nem branch Cursor. LOGIN SQL real isolado não homologa Supabase Auth/usuário real/VPS; fixture não equivale a autorização/grants de destino. Próximo: validar CI do SHA final/revisão independente e avançar proof de Auth integrado/referências e backup/restauração em destino isolado, respeitando gates. Bot Cursor permanece desabilitado, sem presumir parecer. Sem importação/recuperação operacional do legado.

## CODEX — Auth HTTP composto ao CRM/Pedido isolado (2026-10-11)
Responsável Codex; branch codex/crm-pedido-auth-http-isolado-20261011, workspace Comercial separado. Main baba91a6 conferida; base #301 HEADc2e6b839630e0304d26351d8977db63d55de6d33 CI3947SUCCESS/R40CRM5PASS/0FAIL/0SKIP; #300 a62ab7bb CI3945SUCCESS preservada. Ownership261/6115371595 anunciado, recebimento não presumido; nenhum arquivo runtime/branch Cursor alterado.
Fixture/teste R40 existentes compõem createRuntimeDbClients, createPoolDbClient, middleware supabase_user, Auth bootstrap042 e serviços canônicos CRM/Pedido. Pools Auth/data distintos usam LOGIN SQL real NOSUPERUSER/NOBYPASSRLS e identidade de banco/schema/host/porta verificada pelo código de startup existente. Search path da conexão LOGIN fica limitado ao schema efêmero, sem mudar defaults da fixture SET ROLE. Auth recebe somente grants de colunas de bootstrap existentes; sem INSERT de Pedido e sem leitura de profiles sem identidade. Provedor Auth HTTP local sintético verifica Bearer e retorna identidades sintéticas, não homologação do Supabase real.
Mesmo fluxo atômico compartilhado, sem retirar testes: proprietário converte/repetição/Entrega; usuário de filial pode visualizar, mas não aprovar/converter nem selecionar outra empresa/Grupo; externo403, token inválido/ausente401, ator fabricado403, proprietário em empresa diferente404. Created_by corresponde ao profile verificado, não ao Auth user id; recusas não alteram Pedido/itens/histórico/versão da oportunidade. Contextos tenant/Auth não permanecem em conexão reciclada. Executor/rollback/retry/snapshots e policies de referências continuam exercitados no contrato R40 completo.
Credenciais/papéis/schema/provedor são sintéticos efêmeros e não retornados/logados/persistidos; cleanup fecha pools/provider e remove somente grants/papel exclusivos da fixture e schema isolado allowlisted. Implementação local; prova nova exige PostgreSQL real na CI do SHA final, zero skip. Auth HTTP sintético integrado não equivale a Supabase/usuário real/VPS, nem dá autorização de merge/DDL/deploy. Próximo: validar CI/revisão independente, backup/restauração/reversão e prova funcional no destino autorizado conforme gates. Bot de revisão desabilitado não é contornado; legado04_REPORTS EPERM permanece somente na fonte real, sem importação operacional.

## CODEX — Backup/restauração sintética CRM/Pedido (2026-10-11)
Responsável Codex, branch codex/crm-pedido-backup-restauracao-20261011, workspace Comercial separado. Base #302 HEAD45dd8735f42c1a96b62ff9f6138a1488165ff6a4 corrigiu consulta de teste TEXT/UUID preservando contrato legado, CI final ainda pendente; #301 CI3947SUCCESS preservada. Ownership261/6115465699 anunciado; Cursor/branches alheias intactos.
Implementação em fixture e R40 existentes: pg_dump custom privado temporário somente do schema aleatório recém-criado pelo teste em PostgreSQL localhost/erp_test allowlisted. Confere identidade real banco/schema/usuário antes de qualquer descarte. Calcula hash do archive, recusa cópia truncada antes de DROP e prova snapshot intacto; valida listagem, restaura archive original com pg_restore --single-transaction/--exit-on-error e compara conteúdo integral, IDs/vínculos, preços/itens/histórico/audit/perfis/masters compartilhados, sequências, constraints, RLS/FORCE, policies e ACL de tabela/coluna. Não reconstrói por contagem nem reaplica migrations.
Snapshot das linhas usa JSONB textual para não perder precisão decimal no JavaScript; evidência compara hashes sem expor linhas. Pós-restauração preflight com LOGIN real restrito/persistência deve passar; retry da conversão mantém Pedido e não altera qualquer snapshot. Arquivo/credenciais privados, sem argv com senha ou stderr privado; limpeza somente no diretório temporário criado pelo teste, com caminho absoluto validado. Schema e papéis exclusivos da fixture descartados pelo cleanup existente.
Prova nova depende de ferramentas PostgreSQL e PostgreSQL real obrigatório na CI do SHA final, sem retirar testes/aceitar skip. Não toca backups originais, BACKUP ERP ANTIGO - CODEX, fonte04_REPORTS ou qualquer dado/portas/VPS. Backup de fixture administrada não homologa privilégios de backup operacional, Supabase real, destino DEV, restore de dados reais ou importação. Próximo: fechar CI/revisão e preparar prova de backup recuperável privado no destino autorizado conforme gates, preservando origem e rollback. Bot de revisão desabilitado não autoriza integração.

## CODEX — Operação nova após restauração sintética (2026-10-11)
Responsável Codex; branch codex/crm-pos-restauracao-operacao-20261011 no workspace Comercial. Main baba91a6 conferida; base #303 HEAD83a07de0682340abe96fe58b8386a338a63b58ce CI3963SUCCESS/R40CRM7/0/0, #3020cc8e718 CI3961SUCCESS/R40CRM6/0/0. Atualiza estado anterior pendente: Auth/restore candidatos comprovados em PostgreSQL real, não aprovados/integrados/implantados no destino.
Reutiliza fixture e serviços existentes: callback opcional depois de validar archive/conteúdo/replay imutáveis, mantendo contrato anterior. Após restore, novo Orçamento sintético de preparação, Oportunidade e conversão via LOGIN SQL restrito devem continuar high-water de código/Pedido/identidade do histórico. Seis solicitações concorrentes geram um Pedido/uma auditoria, snapshots/preço/orçamento de origem preservados; outra empresa não lê oportunidade; vínculo e Pedido antigos permanecem. Não infere saldo/REVENDA, recria master data ou aplica migration.
Teste R40 de restauração existente ampliado, sem retirada/skip. Callback mutável fica depois da reconciliação e prova de replay que exige snapshot inalterado, não reduz aquele critério. Prova nova exige CI PostgreSQL real do SHA final; local PGlite/typecheck não bastam. Backups originais e dados privados não tocados. Próximo: CI/revisão da composição, e gates privados do destino; revisar referências/policies e recuperação real somente com acesso efetivo/backup/autorização aplicáveis. Bot Cursor desabilitado permanece bloqueio de integração, não aprovação presumida.
Complemento do mesmo pacote: falha intermediária de auditoria após restore deve reverter Pedido/itens/histórico/audit/versão e preservar high-water de número. Remove-se apenas trigger sintético do teste e a mesma solicitação é repetida concorrentemente seis vezes: um Pedido/uma auditoria/número seguinte, sem duplicar documentos antigos. Não exige rollback da identidade técnica do histórico, cujo contrato admite gaps; continuidade é comprovada acima do valor preservado no archive.

## CODEX — Candidata Comercial integrada com dependências delimitadas (2026-10-12)
Responsável Codex no workspace Comercial separado autorizado. Branch nova codex/comercial-candidata-integrada-20261012 sobre Comercial #3045e693bac35bf9406962898df6b944b0a89d72d34/local00a305ec; mainbaba91a6 revalidada, #264ancestral comprovada. Ownership261/6124992851. Branches originais313/315/316 e Cursor preservadas, sem rebase/reset/merge.
Inventário304→312: R40/helpersCRM não mudaram; mudanças Legado305–312 são extração/mapas/reconciliação/pilotoProduto/guardunidade e preflightcompartilhado. Não necessárias para este fluxo Comercial, ficam nas branches originais; não copiar migrations/Legado/rules/unidade ou retirar suas capacidades. Candidata aplica exatamente cinco arquivos comerciais finais: PedidoService/OrcamentoService/runtime09service/runtime08cservice/R40 das313/315/316. Documentos acrescentam evidência sem importar histórico de lotes independentes. Base304 jácontém dependências históricas explicitadas (CRM HTTP040, vínculo ProdutoEmpresa041, identidade legado043 e anteriores); esta seleção não finge remover toda dependência histórica da stack, integração com main exige revisão da base real.
Critérios: autorização TX/préwrite/contexto imutável, preço servidor, snapshots e origem, edição/conversão única, histórico/status/cancelamentos, concorrência/retry, rollbackaudit/seq, Auth restrito, isolamento, backupcustomrestore+novaoperação.25focadosPASS/0FAIL/0SKIP e typecheckbackendPASS; CI/PGreal e checksfechamento na PR, sem skips artificiais. Mesmo conteúdo dos cincoarquivos aprovado apenas por testes; Cursor ainda não emitiu parecer313/315/316, não inventar achados nemaprovação.
Homologação preparada pelo runbook existente: confirmar banco/schema/cluster e papéisAuth/data mínimos; backupfrescocustom+hash+restoreisolado; checkout/canário fullSHA/digests; gates/revisão/CI; rollbackpara mesmasimagens e restauração seletiva autorizada; proprietário e restrito no fluxo real. Nenhuma promoção/migration/provider/canal/dado real autorizado pelo sucesso CI. Destinoidentidade/config atual não verificados nesta execução, gatereadonly independente antesAPPLY; não pedir permissão genérica jáconcedida.
Próximaação: revisãoSHAexato da candidata e gatesoperacionais comprovados, preservar UI/frontend/policy reservadosCursor. Enquanto revisão, próximo item funcional depende inventário atual do programa, não gerar defeitos hipotéticos. Implementado/composição preparada e testada, não mesclado/implantado/homologadoDEV. Recuperação/importação operacional0, fontes/backupsprivadosintactos.

## CODEX — Preflight do ciclo completo Orçamento/Pedido (2026-10-12)
Codex branch codex/comercial-preflight-orcamento-20261012 sobre candidata31725b9093aeb04a510df5379632e4a7d54394a697e, ownership261/6125124013, executado durante CI/revisão317. Lacuna comprovada: gatePedido existente não cobriaINSERT/UPDATEOrçamento nemINSERT/DELETEitens necessários à criação/edição/cancelamento, somenteSELECT/lockpara conversão.
Reutiliza consulta existente inspectPedidoPersistence com parâmetro optinfullFlow, sem helper/module paralelo/TenantCrud. requireOrcamentoPersistence verifica6tabelas do fluxo, permissõescore atuais, políticas por comandoSELECT/INSERT/UPDATE/DELETE ondeexigidos, RLS/FORCE/ACL PUBLIC de tabela/coluna. Históricoappendonly não exigeUPDATE/DELETE. Default/schemaonly/gatePedido continuamcompatíveis. CLI CRM_PREFLIGHT_ORCAMENTO_PERSISTENCE=true, estágioapósmigration somente, flagsestritas antesconectar, leituraemTXREADONLY; scopecrm_orcamento_pedido_persistence_only/activationAuthorizedfalse e gatesAuth/referências/backup/fluxo explícitos não homologados.
13focadospreflight+R40 PASS/0FAIL/0SKIP, testeextraCLIinvalid1PASS e typecheck/buildbackendPASS. PGrealR40 ampliado antes/despoisrestore LOGIN: gatepronto→REVOKEINSERTOrçamento bloqueia→restoregrant→REVOKEDELETEitens bloqueia→restorepronto; grants apenasfixture sintética. Suítes/regressão completas CI obrigatóriaSHAfinal. Não concedepermissão/grantDEV/nãohomologaAuth/destino/VPS.
Próximo: revisão candidata317 e delta preflight, identificação atualdestino/Auth/data e backuprecuperável/rollback antescanário; dadosreaisoriginaisintactos, fontesLegado não aprovadas. Implementado/testado/publicado não mesclado/implantado/homologado. EvidênciaSHA/PR/CI final na PR.

## CODEX — Central 360 e reconciliação das ondas existentes (2026-10-12)
Codex workspace Comercial autorizado, branch codex/comercial-central-contexto-20261012 sobre3187af8475184917cf4b9b678c83085568b76b6c2b1. Ownership261/6125690626. OutrochatComercial não identificado na listagem atual; execução neste workspace jáautorizada, nenhum encaminhamento/recebimento presumido. UI CentralCliente360Panel/store/policies pertencem à coordenaçãoCursor e não alterados; solicitação decoordenação registrada.
Onda3/24: teste reproduziu404 da requisição inicial ao alterar Grupo/Empresa/ator/paginação duranteawait vínculoClienteEmpresa. Central360Service.get captura contexto e opções antes da primeira espera; continua consultando serviços canônicos e RBAC real, preserva blocos/metadados/PII/paginação, não caches permissões. Teste antesfixFAIL e após7HTTP/memóriaPASS/0FAIL/0SKIP; R40persistido3PASS, matrizmutaçãotardia de Grupo/empresa/ator/requestId/limit mantémempresa/vínculo/2CRM/páginaoriginal. Backend370PASS/0FAIL/18PGlocal, typecheck/build/lintPASS; PGrealCI obrigatórioHEADfinal. Mudança cirúrgica sem módulo paralelo ou remoçãodecampo.
Mapeamento da ordem A–E ao programa existente (não renumera ondas): A→24/26 candidata317+deltagate318 e base304 explícitas; B→2/4/5 cicloCliente/quote/edit/convert/Pedido/status/cancel jáprovado315–318; C→7/20 contratos/código existentes207/036/037, não inventar porta nova; D→3/23 readmodelcanônico/Central; E→9–19 Engenharia/Produção/PIM/canais proprietários existentes. Referência integrada31725b9093 CI4154SUCCESS,3187af847 CI4167SUCCESS;316originalpreservada, deltasLegado305–312 separados, #264ancestralpreservada. Reviews316/317/318 semparecer novo, CursorHEADfinal continua gate.
Destino autorizado pelo mecanismo alternativo WebConsole: consoleacessível/shellidle, checkout6a4b304f087804ab1fb56ade5f4f4c30a5624c41, trackedDirty0/untracked1 preservado, API3080ready200/SPA3081HTTP200 comprovadossomenteleitura. Corrige bloqueio anterior: ausênciaMCPHostinger nãoé ausênciaautorização nem impedeWebConsole. Nãoexpôsenv/credenciais/conteúdoarquivo privado, não atualizoucheckout/promoveucontainer. ClusterDB/Auth/data/papéis/labels/digests/backupfrescorecuperável ainda não verificados, precheck parcial nãohomologaVPS.
C inventário207506a5d3: portasPedido/estoque jápersistentes executorcompartilhado/poritem/audit/idempotência/compensação, migration037não cria saldoabertura, baselineausente/insuficiente bloqueia. Contrato de unidade/fonte saldo ainda operacional não comprovado; 026histórico failclosed. Não integrar stack207silenciosamente ouativar. E: scanner/canal/providerrealnão homologado/credenciaisnão disponíveis; códigoexistenteStorage/outbox/Produção mantido, semsimulaçãofuncionamento externo. InventárioWorkspace antigoExpedição apresentouGitdubiousownership (contas distintas); nãoalterarACL/safe.directoryglobal, usarisolado se próximo pacote.
Próximas ações liberadas: precisãoquantitativa no contratoExpedição existente emworkspace isolado se defeitoreproduzido; revisão/mínimopriv/destino+backup/rollback antescanário; coordenaçãoUI entregas/financeirocanônicos e legadoseparado. SHA/PR/CI final na PR. Implementação/teste publicado nãointegrado/implantado/homologado/importado, dadosreais/backupsoriginaisintactos.

## CODEX — Projeção canônica PIM/catálogo validada (2026-10-12)
Codex Onda1/15/24, branch codex/comercial-catalogo-projecao-estrita-20261012 sobre3195568e3a9e49f7dd75d866b0f0f1165ff8a4373a7 CI4200SUCCESS. Ownership261/6126361176. Reutiliza assertSafeCatalogProjection/buildProdutoCatalogProjection/claimlease/process/retry/deadletter/reprocesso/recibo existentes. ProdutoService/ProdutoTypes/UI/branchesCursorintactos; não novo módulo/provider/endpoint.
Falhasreproduzidas antesfix: objeto dentro descricaoComercial escapava para payload apesar de signedUrl/tenant/secret proibidos; Boolean('false') virava true. Validator agora exige registro e aplica schemascanônicos ProdutoCreate dos campos projetados, sem coagir boolean/número/objetos/arrays, com limites/UUID/finito/positivo/nãonegativo/textos próprios. Erro sanitizado menciona só chavepermitida; valoresprivados não são emitidos. Camposunknown continuamstrip/forwardcompat, schemaVersion'1'/nulo/ausente/defaultslegados mantidos. CampoWorkflow/schemaVersion não aceitam objetos; autorização/publicaçãoéoutrogate e não relaxada.
17focosPASS/0FAIL/0SKIP, matrizobjetoemcampo permitido/array/stringfalse/multiplozeroNaNnegativo/schema inválido/defaults/unknownstrip. Fluxo completoProduto→revisão→aprovação→PUBLICADO interno→outboxenvenenada→retrysemrecibo→deadletter→correção→reprocessoautorizado→recibo único→duploprocessonãoduplica. ApenasFakeCatalogPublisher dafixturesemrede; não afirma publicação externa. Backend372PASS/0FAIL/18PGlocal/typecheck/build/lint/buildfrontend/diffPASS. PGrealR10 existente ampliado com payloadJSONBmalformado persistido, claim/rejeição/faildeadletter/correção/reprocesso/confirm/idempotência; CI finalobrigatória, nenhumaSkip removida/retorno falsointroduzido.
OndaE conjuntoimplementado validação/catalog outbox dos contratos existentes; providerreal continuaCATALOG_EXTERNAL_PUBLISHER_BLOCKEDmesmo canalflagcredencialtrue, scanner/CAD/produção/engines semcontrato persistente/homologação continuam pendentes, não simulados. OndaD319validada, OndaC320precisãoquantitativaembranchisolada207 comnovoHEADcompatibilidade/CIfinal emexecução. OndaA317+318referências preservadas, formalreviews316–319consultadas vazias; parecerindependente não presumido. OndaBfluxocanônico/rollback/mínimoprivPG játestado em317/318, nãohomologaVPS.
DestinoalternativoWebConsole comprovoureadonlyAPI/SPA200,checkout6a4b304f087804ab1fb56ade5f4f4c30a5624c41 e1untracked/0tracked preservados; imagemAPIsha256:63d0d8f7375a1980dc37a5c7923f74b33145ef8d9630e154671495b52438bd23,fullrevisionlabelnão confirmado. Cluster/Auth/papéis/digests/backup atualfaltamprova, nenhumVPSwrite. AusênciaMCPnãoéfaltadeautorização. Dadosreais/backupsoriginaisintactos/importação0,026failclosed/unidade/saldobaseline nãoinferidos.
Próximaação: reviewHEADfinal desta capacidade e composição dasbranches aprovadas319/320/esta semperderoriginais; conferirSQLmínimopriv/destino ebackupreversãoantescanário; UI financeira/entregaCentral coordenaçãoCursor261/6125690626 pendente. SHA/PR/CI final naPR. Pacoteimplementado/testado/publicado ≠ integrado/implantado/homologado/recuperado/importado operacionalmente.

Fechamento operacional somente leitura 2026-10-12: evidência sanitizada docs/vps/evidence/comercial360-precheck-leitura-20261012.txt.319CI4200/320HEADb160CI4210+PG189/321código d553CI4212SUCCESS, métricas/assertsnaPR. API/SPA200/checkout6a4 e1untrackedpreservados; labelFullSHA/cluster/Auth/digests/backup atuais não comprovados. GET com Bearer inválido sintético sem marcador confirmado e shellfinalnão confirmado; não afirmar401/idle, não enviarcomandos atéfreshprecheck. NenhumaAPI/SPA/DB/grant/migration alterada. Próximaação revisões+revalidarconsoleidle/identidade/config/backupreversão, compor320semimportarstack207ouperder264. Pacotesfuncionais319/320/321 implementados/testados/publicados, programa/ondas não homologados ouconcluídos globalmente.
## CODEX — Central 360 → Pedido canônico e candidata de composição (2026-10-13)

- Reserva `codex/comercial-central-pedido-detalhe-20261013`: `CentralCliente360Panel.jsx`, `PedidoCanonicoPanel.jsx`, helper/teste de navegação, STATUS/HANDOFF. Base #328 `eaa11d2b`; não editar Cursor, Expedição nem Legado. Abrir Pedido por ID técnico via janela existente, com RBAC/contexto e leitura canônica. Não confundir número visível com UUID.
- Composição #328 + Expedição #320 não é fast-forward: merge-tree read-only apontou 38 conflitos, sobretudo router/app/RBAC, Pedido/Orçamento, painel e testes. #320 tip `b16011b6` CI runtime/omnicanal PG SUCCESS; #328 tip `eaa11d2b` CI runtime SUCCESS e Codex review sem achados. Esses gates individuais não homologam a composição. Migrations 025–031/033–037 da #320 e 038–044 da #328 exigem inventário completo e aplicação em banco isolado antes do código; 032 não consta dessa candidata. 036/037 criam Entrega e ledger de Expedição sem saldo de abertura; não inventar saldo nem ligar porta de estoque sem reconciliação da fonte aprovada.
- Próximo gate da candidata: resolução manual dos conflitos em branch própria; manifesto de imagens/auth/privilegios; prova de backup recuperável e reversão; migrations isoladas 001–044 na ordem canônica; teste de fluxo com reserva parcial, falha no item seguinte, compensação e bloqueio de efeitos posteriores; preço de servidor, unidade/decimal/snapshots, retry e auditoria. Sem aplicar migration na VPS/operacional, sem merge da #104 congelada e sem afirmar review Cursor.
- Extensão UI da #329: Central → Orçamento usa o mesmo helper de validação de bloco/UUID/permissão/contexto e `OrcamentosTab` já existente com `initialSelectedId`; resposta de detalhe com token rotacionado não repinta a janela. Não editar Cadastro/Legado/Cursor; consulta e mutações seguem BFF canônico.

## Composição isolada #331 + Expedição #332/#333 — 2026-10-17

Branch `codex/comercial-composicao-20261017`, base #331 `b3a683bba1bdd8dc3870ce4ba4eeb87430b3e561`. Proveniência e critérios em `docs/COMPOSICAO_COMERCIAL_EXPEDICAO_20261017.md`. Port funcional seletivo da #333 `1ba4c4d25ef35d554f2a446f1c07294b574296ec`, que inclui #332 `bf6c0068288d152d88451ff52d6234d39940143e`; não é merge integral das bases históricas. Originais preservadas, sem edição na branch Cursor. Implementado em candidata; integração, implantação e homologação pendentes. Migration 026 histórica não alterada/ativada.

Percurso sintético persistido Cliente → Orçamento editado → conversão concorrente única → Pedido editado/status → separação → romaneio/despacho → parcial → devolução, mais Pedido direto/replay/cancelamento. Testa preço servidor, snapshot, tenant/RBAC, revogação dentro da transação, falha de auditoria/rollback e saldo sintético. Corrigidos data serializada, executor da autorização, quantidades entregues por item e catálogo explícito Expedição. Backend geral: 410 pass/23 skips por ausência local de PostgreSQL externo; suites PostgreSQL obrigatórias e sem skip na CI. Foco backend 25/25, rechecagem 16/16, frontend Expedição 59/59, compatibilidade histórica migrations 1/1 PGlite. CI do novo SHA e parecer Cursor ainda necessários.

Limites abertos: typecheck global frontend (base #331 1660 diagnósticos; primeira composição 1741, exige reconciliação, não declarar verde); suíte root Windows sem Bash teve 53 falhas/1014 e nova execução com Git Bash ficou presa no precheck VPS, interrompida sem alterar testes. Exigir CI Linux. Nenhum banco operacional, VPS, provider, importação real ou backup foi modificado. Retomada: fechar diagnósticos do delta, CI PostgreSQL/Linux e parecer Cursor do SHA final; manter portas operacionais reservadas até gates canônicos.

### Reconciliação do delta e primeira CI

CI runtime #4392 (`1f7bc45d`): frontend Linux 1014/1014, lint/build/audit aprovados; composição histórica de migrations PGlite/PostgreSQL aprovada. Backend typecheck/test/build/migrate aprovados; novo percurso Comercial executou 2/2 no runner PostgreSQL. Suíte adicional R11 detectou fixture ainda dependente de `pedido_itens.tipo_comercial_snapshot` histórico, ausente na referência #331; removida somente essa dependência dos dois INSERTs sintéticos, mantendo todas as asserções e sem adicionar coluna comercial paralela. Novo SHA exige nova CI.

Delta frontend: corrigida colisão real do ícone `Map` com o Map nativo da roteirização; contratos JSDoc de filtros HTTP, assinatura, formulário e policy extraída foram reconciliados sem `ts-ignore`, `nocheck`, redução de regras ou alteração de expectativas. Regressão focal ampliada: 99/99; lint sem erros, build aprovado. A comparação completa de typecheck permanece registrada localmente: baseline 1660, primeiro port 1741; o próximo resultado deve ser distinguido do baseline, sem declarar typecheck global verde. Não há parecer Cursor aprovando o novo SHA, integração ou implantação.

### Resultado final do typecheck comparado (2026-10-17)

No código `84640c6c`, a execução completa de `npm run typecheck` retornou 1642 diagnósticos, contra 1660 na #331 limpa com as mesmas dependências. Comparação por caminho/código/mensagem, ignorando somente deslocamento de linha e caminho do worktree e preservando multiplicidade: nenhum diagnóstico acrescentado; 18 eliminados. Não significa typecheck global aprovado. Nenhuma regra, teste, baseline, `ts-ignore` ou `nocheck` foi alterado. Foco interface/azul/sessão: 99/99. CI #4394 iniciada para esse código; consultar a PR #334 para CI do HEAD final e parecer Cursor. Pacote implementado/publicado para revisão, sem merge, deploy ou homologação; retomada é tratar achados reais do SHA final, concluir CI PostgreSQL e depois gates operacionais já documentados.

### Rechecagem após lock — defeito reproduzido e corrigido

A jornada ampliada revoga a permissão no executor logo após a leitura bloqueante da Entrega. Contra o código publicado anterior, falhou com `Missing expected rejection`: o registro parcial era aceito. Na correção, tenant/RBAC são rechecados depois do lock de Entrega em separação, registro, devolução e patch; criação revalida depois da leitura bloqueante de Pedido e antes do INSERT. Romaneio preserva rechecagem após carregar/travar entregas. A mesma jornada passou localmente com 403, estado anterior preservado e rollback da revogação sintética. Typecheck backend aprovado. Exigir nova CI/revisão desse último delta; não atribuir a ele a CI de SHAs anteriores.
