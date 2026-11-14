# Operação DEV: GitHub, Codex, Cursor e VPS

## Acesso HTTPS da HML na VPS (2026-11-14)

Abrir https://hml-erp.cpaferroeaco.com.br/ com a conta Auth existente.
Nao e erp-dev, nem porta15173 do Codespace. Nao precisa ligar computador ou
Codespace para servir. Runtime inicial d054e2b3, CI6969/6970SUCCESS;
`/.well-known/erp-version.json` identifica API/web sem dados de clientes.
Pagina/ready200 e clientes401 sem sessao comprovados externamente com TLSvalido.
Aceite autenticado ainda pendente: nao chamar login visivel de dados homologados.

DNS A somente hml-erp ->2.25.222.180/TTL300. Caddy encaminha somente esse host
para127.0.0.1:13081; PG/API nao publicam portas. Config anterior preservada
privadamente em /root/erp-private/hml-recovery-20261114/Caddyfile.before-hml-https.private.
Antes de reverter, conferir hashes/deltas posteriores no HANDOFF; validar Caddy
antes de reload. Nunca restaurar zona inteira ou reiniciar operacional por isso.
Nao executar carga/seed/migration ao abrir/retomar a HML.
Nao ha SLA24h prometido; backupautomatico/retencao e aceite em outro computador
sao gates proprios ainda abertos. Backup atual/restore/copiaexterna ja conferidos.

## Empacotamento e preflight da mesma HML recuperada

`scripts/vps/package-hml-runtime.mjs <diretorio-novo-fora-do-checkout>` compila
API e web no executor de desenvolvimento existente. Exige checkout limpo,
branch codex publicada e HEAD remoto identico; nao instalar/buildar na VPS.
`--validation` identifica WIP explicitamente e NAO libera ativacao. O pacote
inclui apenas runtime/dependencias lockadas/assets e manifesto SHA256; nao leva
PGdata, dados, .env, provider ou credenciais. Conferir manifesto e CI do SHA
antes de usar. Nunca relabelar um pacote de validacao como publicado.

Entrada API: `node /app/api/hml-bootstrap.mjs /run/hml-config.json /app/api`.
Configuracao privada regular, dono da UID da API, modo0400/0600, mountRO.
Usa API/Auth canonicos e socket `/run/hml-pg`; database/schema HML, role,
schemaOID, system_identifier, perfil/identidade/Grupo e search_path precisam
coincidir com o destino comprovado. Recusa superuser/BYPASSRLS/memberships
perigosos, pools diferentes e fallback operacional antes de READY.
Somente duas rotas de saida Auth do provedor existente sao permitidas pelo
bootstrap (user GET/token POST, sem redirects); nao fornecer segredos de
cobranca/mensagens/emissao. Nenhuma carga/seed/migration/restore no inicio.

Topologia aprovada: PG privado networknone e socket, API/web em rede HML
separada, proxy web loopback e HTTPS dedicado. Nao conectar ao network/volume
operacional. Limites PG1GiB/0,40CPU, API512MiB/0,30CPU, web128MiB/0,05CPU;
revalidar >=20GiB livres. O PG antigo de recuperacao permanece parado para
reversao e NUNCA concorre com o novo sobre o mesmo pgdata-restored.

Ensaio do bootstrap em14/11: PG real/health200/ready200/clientes401 sem sessao,
sem rede/portas. Nao comprova login externo, RBAC HTTP ou navegador. Recursos
de ensaio parados; HTTPS/DNS, aceite e backupautomatico seguem gates separados.
Nao chamar manutencao administrativa de principal leitor restrito.

## HML recuperada - gate de fonte/restore encerrado (2026-11-14)

Este checkpoint supera SOMENTE o BLOCKED de recuperacao do bloco anterior.
Copia fria final atual do Codespace recuperada foraGitHub e comparada a fonte;
VPS tem backup/extracao e PGdata de ensaio separados em
/root/erp-private/hml-recovery-20261114, fontes intocadas. Estado e recibos no
HANDOFF; nao extrair arquivo sobre / nem sobre volumes existentes.
Restauracao verificada por valores/IDs/relacoes e6613auditorias;1600mestres,
4200contatos,1500inativos,217locaisINATIVOS(100fiscais/117entregas),1Grupo/2empresas.
Backup logico atual restaurado em outra base isolada com16tabelas iguais;
parada/inicio do proprio apoio preservou16tabelas. Copia externa privada/SHA
confirmados no desktop. Nao repetir carga/ativacao; bancooperacional preservado.

Container erp-hml-pg-recovery-20261114 PARADO ao fim por ociosidade;PGdata em
pgdata-restored persistente, redeNONE/zeroportas,1GiB/0,40CPU. Nao substituir
containerSupabase,nao apontar APIoperacional para esse volume,nao iniciar recursos
antigos como recuperacao. A base hml344_recovery_verify_20261114 e so ensaio,
nao outro lote/cadastro/candidata. Nenhuma API/web/URLHML nova ativa ainda.
Manutencao SQL usou admin APENAS nesse PG separado; nao prova loginAPIrestrito.

Final:27,41GiBdisponiveis,acima de20GiB;web/APIoperacionais200 e mesmos
containers/StartedAt. Sem DNS/firewall/proxy,grants ou permissoes operacionais.
Custos: janelaGitHub encerrada em<30min e orcamentoCodespaces devolvido0;
nao usar isso como autorizacao continua. Faturamento final ainda pendente.

Proximo pacote: imagens API/web compativeis produzidas FORAVPS a partir do
codigo revisado; adaptar bootstrap existente com destino/schema explicitos e
preflight fisico,Authreal,loginAPI naoBYPASS/RBAC e efeitos externosOFF. So depois
ativar hostnameHTTPS dedicado,health/restart/logs e aceite de outro computador.
Backupautomatico/retencao/copiaexterna recorrente ainda NAO implementados.

## HML persistente na VPS - pacote condicionado aprovado (2026-11-14)

Autorizacao do proprietario: HML leve na mesma srv1982741, com API/web proprias,
PostgreSQL separado, banco/credenciais/volume/rede exclusivos; aplicacao sem
superusuario/BYPASSRLS, banco sem porta publica, HTTPS autenticado. Nao substituir
nem reiniciar operacional. Sem builds, testes pesados ou extracaoSQLlegada no host.
Limites iniciais: API512MiB/0,30CPU; PG1GiB/0,40CPU; web128MiB/0,05CPU.
Preservar20GiB livres. Nenhuma dessas configuracoes foi aplicada nesta retomada.

Preflight somente leitura14/11 10:12-10:15UTC: KVM2/2vCPU/8GB/100GBcontratados;
filesystemext4 total102888095744/disponivel32706727936bytes,69%usado,inodes6%;
free7,8GiBtotal/5,9GiBavailable,swap0. HistoricoProvider15/10-14/11:
717amostras horarias,CPUmedia12,42/P9513,08/max49,84%; RAMmax3,16GB.
Sar13/11: idlemedio87,41%,iowait0,02%,steal1,84%; SDAawaitmedio0,46ms.
Media horaria/diaria nao limita picos curtos nem prova carga futura.

13containers ativos/15parados,25imagens10,24GB; API512MiB/0,5CPU e web128MiB/
0,25CPU existentes; PG/Supabase sem limiteCPU/RAM explicito. PGdata persistente
em/root/supabase/docker/volumes/db/data,116MiB na leitura. Nao reutilizar esse
volume para HML. /root/erp-private51GiB,centralizacao48GiB preservados.
Caddy/Docker ativos,webHTTPS200/APIhealthHTTPS200; listenersAPI/web loopback,
proxy443 existente. PortasSupabase5432/6543/8000 escutam wildcard: observacao
local nao comprova exposicao externa/firewall, nem autoriza amplia-la.
Bancos lidos emBEGIN READ ONLY/ROLLBACK: postgres16MB,_supabase7811kB e tres
restores historicos13-15MB; nenhum schemahml no postgres dessa leitura.
Nao e inventario de schemas de todos os bancos ou prova de ausencia global.

Provider: backups semanais12/11 20:20 e05/11 11:38,65,34/65,33GB; horario como
exibido, sem converter timezone nao informado. Tempo de restauracao1h48 e
estimativa do painel, nao ensaio nosso. Nao contem automaticamente o Codespace.

Fila executavel do MESMO pacote:
1. Recuperar estado final HML+recibos privados, provar cobertura dos217locais,
   1600clientes/1500inativos/4200contatos/extensoes e auditorias por identidade e
   valor. BLOCKED ate fonte atual externa comprovada; nao usar dump13/10 nem
   backup anterior217 como estado completo. Nao alterar cobranca sem decisao.
2. Fixar SHA API/web compativel e imagens construidas foraVPS; medir imagens+
   dados+WAL+backup/logs, conservando20GiB; parar expansao se ultrapassar.
3. Restore somente em PG/volume separados, roles proprias naoBYPASS, sem
   credenciais operacionais na APIHML. Conferir schema/search_path/preflight
   fisico, Auth real existente/perfilHML e negativas crossGrupo/Empresa.
4. Antes/depois de restore/ativacao medir saude operacional,CPU/RAM/disco/I/O;
   interromper SOMENTE novaHML por degradacao, nunca desligar o real.
5. HTTPS dedicado/reversivel no proxy existente, configuracao validada; qualquer
   ampliacao de acesso exige confirmacao de escopo no momento aplicavel. Sem
   tunel/devserver, sem portasPGpublicas; restartpolicy/healthchecks/logretention.
   Confirmar nomes e efeitos externos bloqueados antes do acesso funcional.
6. BackupHML automatizado com retencao/copia externa privada,hash e restore
   ensaiado; nao usar restoreVPSinteira como retorno da HML. Login/Grupo/Empresa,
   dados/edicao/reabertura e acesso de outro computador sao aceites separados.

Status: PREPARACAO, nenhum recurso HML novo ativo; nao ha URLHTTPS servida.
Unica decisao potencial de custo: recuperarCodespace antes da renovacao ou
aguardar franquia; precos/retencao e limites registrados no HANDOFF. Nao ampliar
plano/armazenamento nem apagar legado, containers parados ou backups por inferencia.

## CURSOR — HML Grupo UI + Fornecedor HTTP port (2026-11-06 America/Sao_Paulo)

Branch `cursor/hml-grupo-erro-fornecedor-392b`. UI reconcilia visão Grupo com
`profileEmpresaId` null (sem promover admin). Contagens auxiliares isoladas.
Fornecedor HTTP port de `6b81004fc`, flag `ENABLE_FORNECEDOR_HTTP` default OFF.
Sem deploy/VPS/merge. SHA do tip para Codex validar seletor/nomes na HML.

<!-- Historico preservado da frente342 5d1fa0fc; o checkpoint inicial prevalece. -->
## Promocao do Cliente - pacote ainda nao executavel (2026-11-11)

Definicao comercial encerrada pelo dono: ENDERECOmestre -> finalidadeFISCAL;
ClientesObras -> ENTREGA com identidade por local; cobranca excluida da migracao
ativa, sem apagar fonte ou registros existentes. Esta definicao nao autoriza DDL,
permissoes, carga ou deploy operacional. Campos obrigatorios nao comprovados
seguem pendentes; nao usar pais/numero/latitude/longitude padrao para passar.
Reutilizar ClienteLocal/coordenadas e verificar o mecanismo privado de upload
para vincular mapa ao mesmo local, sem criar armazenamento paralelo;
link de mapa, anexo de arquivo e roteirizacao sao capacidades/provas distintas.

Codigo87fe18bb CI6915/6916SUCCESS; indiceCliente-only provado emPostgreSQL real,
suite3PASS/0FAIL/0SKIP. Prova de teste nao autoriza DDL ou carga naVPS.

Destino SQL comprovado no recibo de16:52Z: srv1982741/postgres/public; API e
manutencao usam o MESMO postgres NOSUPER/BYPASSRLS. Nao leitor restrito;0policies
nas9relacoes selecionadas comRLS/FORCE nao comprovam isolamento desse login.
Reutilizado catalogo privado existente; nao declarar nova consulta operacional.
Delta minimo identificado: cliente_contatos.sql, cliente_master_extras.sql e
indice Cliente(group_id,source_system,codigo_legado). Novo candidato
server/schema-candidates/cliente_legacy_identity.sql extrai somente a definicao
canonica043, sem SQL de produtos/opportunities/auth e sem journal. Nome existente
obriga revisar definicao; duplicidade obriga reconciliar. NAO aplicar por numero.
Arquivo separado necessario para revisar/executar apenas esse delta, sem criar
importador ou migrador paralelo. Nenhum desses candidatos aplicado naVPS.

Gates finitos e responsaveis:
- Codex: conteudo/joins restantes e selecao definitiva com rejeicoes;1600HML
  continuam parciais.1500ensaios ficam inativos, nao sao carga operacional liberada.
- Codex/revisao: principal real daAPI e policies/grants minimos por contrato;
  nao trocar role nem reaproveitar BYPASSRLS como isolamento, sem novo gate.
- Cursor/composicao: parAPI/web mesmoSHA revisado, builds efetivos e aceite15173;
  candidato4015d9a7e37 nao incorpora automaticamente o backend482fd666 ou este delta.
- Executor autorizado: capacidadefilesystem atual, conflitos globais da selecao,
  backupfresco do destino/recuperacao/retorno; metricaProvider nao substitui df.
- Proprietario: decisao operacional agrupada SOMENTE quando os itens anteriores
  estiverem comprovados; janela/parada/versao/lotes/efeitos/reversao identificados.

Plano: lotes canonicos<=1000 apos benchmark do conteudo completo; checkpoints
transacionais e CAS, no-op/replay, rejeicoes isoladas e reconciliacao de cada
campo/relacao, nao apenas contagem. Nenhum commit de teste marca carga concluida.
Reversao logica do proprio lote/permissoes/configuracao, preservando historico e
alteracoes manuais posteriores; sem sobrescrever banco inteiro ouDROP automatico.
Enquanto versao/principal/selecao nao fecharem, pacoteVPS NOT_READY: nao pedir
liberacao generica de producao nem atribuir umSHA/digest a imagem sem prova.

## HML5extensoes concluida (2026-11-11)

Codigo482fd666 CI6909/6910SUCCESS; SQL candidato aplicado SOMENTE em
hml344_restore_20261104/hml344_cpa_20261104 pela autorizacao agrupada.
1316clientes/1317valores,1600snapshots reconciliados,4200contatos e1500inativos
preservados. APP parada, nenhum aceite de interface inferido.
Procedimento existente reutilizado: identidadecluster/database/schema/OIDs por
conexao; manifest/runtime/executor pinados; backup; lock exclusivo do operador;
DDL+recibo na mesma transacao; baseline/CASnovos; ClienteService canonico;
replay individual; reconciliacao integral; amostra reversao/reaplicacao.
Artefatos privados em scale-validation-efbde32d/master-execution-482fd666:
run/commands/result, fonte e recibos imutaveis. Nao publicar seus conteudos.
Retomada exige ler recibos/lock e confirmar processo antes de executar qualquer
comando; jamais apagar lease de outro escritor ou gerar novos operationIds.
Reversao usa os comandos/operationIds e fingerprints revisados no fluxo existente;
alteracao manual posterior bloqueia o registro, nao e sobrescrita. SemDROP
automatico das colunas. Principal continua administrativo, nao leitor restrito.
Nenhuma autorizacaoVPS, novosgrants, carga operacional ou deploy e inferida.
Checkpointposlote: replay integral com hash de linhas/auditorias iguais;
backupCUSTOM3099029bytes comSHA/lista verificados no mesmo cluster. Novo arquivo
nao restaurado; prova anterior de recuperacao continua separada. Recibo privado
checkpoint-after.private.json, sem dados identificaveis no GitHub.

## Delta de enriquecimento e destino efetivo (2026-11-11)

Codigo58c927e0 fechado na CI6897/6898SUCCESS, incluindoPG restrito de extensoes.
Populacao original confrontada sem carga:4437fora doCSV sao4276Ativo/
159Potencial/2Inativo pelos rotulos literais nativos, nao por frequencia/nome.
4414sem documento estruturalmente valido;23com documento valido fora do export,
mas22envolvidos em repeticao (8documentos distintos).0documentos desses23 estao
no export; fila preservada para enriquecimento completo/duplicidades/target.
Nao converter23 em aptos, nem4437 em inativos. Filtro causalCSV nao provado.
Recibos privados population-status-20261111, leitorSQL copiado parado nofinally;
zero originais/VPS/mestres alterados. Nao repetir esta consulta sem delta.

Cliente existente:5extensoes opcionais no contrato backend e no ciclo canonico
de enriquecimento. SQL candidato cliente_master_extras.sql fora do migrador;
NAO aplicar por bootstrap/CI. Preflight privado1600:1316clientes/1317valores
candidatos, sem escrita. Contatos4200 e1500inativos conservados. Exigir aprovacao
agrupadaHML/revisao/backup/freshCAS antes de espelhar colunas e enriquecer.
Omissao preserva; vazio explicitoNULL e comando consciente; importacao nao apaga
nem sobrescreve valor manual. Recibos antigos nao podem ser reescritos ou aceitos
por ignorar colunasNULL novas. Alteracao de schema bloqueiaCAS antigo; reversao
nova usa seus snapshots completos e conserva os historicos.

CatalogoVPS lido via sessao existente emREADONLY/ROLLBACK: postgres/public,
login efetivo APIpostgres=manutencao, BYPASSRLStrue/NOSUPER.9tabelas comRLS/FORCE,
165colunas/76constraints/46indices/0policies. Falta contatos+5extensoes e unique
Cliente(group_id,source_system,codigo_legado);043 existente tem a fatiaCliente,
nao aplicar SQL de produtos ou todas migrations por conveniencia. Fornecedor
nao presente. Compatibilidade por campos/constraints/indices, nunca journal.
Catalogo completo privado em operational-gates-344-20261026/schema-contract-
20261111.private.json; nomes/IDs/dados de clientes nao foram publicados.

PromocaoVPS continua BLOQUEADA para escrita: resolver principal/policies/grants
minimos, conflitos da selecao efetiva, parAPI/web revisado, backup atual/retorno
e janela antes de uma decisao operacional unica.100NEW antigo nao prova destino
atual vazio nem ausencia de conflitosglobais para1600/17471. Plano/binding/query
anteriores preservados, sem novo inventario/carga/consulta repetida nesta etapa.

## Escala privada de cadastros - ensaios500/1000 reais (2026-11-11)

Codigo efbde32d/CI6859/6860 e servicos existentes, sem endpoint/importador paralelo.
staging-checkpoint exporta prepararPersistenciaClientesLegado/persistirLoteClientesLegado/
reverterLoteClientesLegado. FonteCSV e JSON privados sao conferidos integralmente,
selecao nativa e transformacoes derivadas pelo seletor existente; manifeste RUN,
lote, ator/Grupo, alvofisico e hashes ANTES da escrita. OID+clusterIdentifier nao
nulo, banco/schema/principal e perfil/Auth devem bater; nenhum NULL de socket
prova igualdade. Sem fallback para operacional nem grants/seed/migrador automatico.

RecibosDB RUN/lote e CRUD/auditoria no mesmo DbClient ALS/COMMIT; replay consulta
o banco depois de perda do recibo externo. Nunca limpar lock desconhecido, repetir
escrita apos resposta ambigua ou sobrescrever postimagem mudada manualmente.
Reversao via inativacao canonica apenas dos inseridos proprios e inalterados.

500 e1000 reais foram inseridos/confrontados/reexecutados/revertidos no MESMO
HML privado existente;100 originais preservados em todas as etapas. Agora1600
registros,1500inativos de ensaio auditados. Nao reimportar nem reativar esses testes.
Temporariamente API/webSTOPPED: dadospersistentes nao significam URL servida.
0VPS alterada, nenhum efeitoexterno,0DDL/grants/novasroles. Campos ainda pendentes
e contatos/enderecos nao carregados ficam explicitos; nao chamar cadastro completo.

Antes de qualquer novo lote: consultar combined-trials e receipts privados no
scale-validation-efbde32d; revalidar fonte/alvo/capacidade/reservas e backup atual.
Os novos backupsCUSTOM tem hash/listagem verificados; restore anterior reutilizado,
nao restaurar apenas para repetir prova intacta nem afirmar restore destes arquivos.
Manifestos/dumps/raw156/credenciais ficam fora do GitHub/CI/builds. A CI usa somente
sinteticos; HML real foi ensaiada separadamente. VPS requer preflightSQL/schema/
principal/backup atuais, revisao/integracao e autorizacao especifica de escrita/deploy.

## Leitura de locais na HML - alteracao autorizada (2026-11-11)

Somente Cadastros.cliente_local=['visualizar'] adicionado ao perfil existente,
por autorizacao especifica; roleuser/GrupoCPA/empresaNULL preservados. Nenhum
grant SQL, Authuser novo, admin, DDL ou capacidade de escrever enderecos.
Sem endpointwriteProfiles nesse BFF: artefato administrativo privado reutiliza
profiles/audit_logs/executor existente; nao e novo controle de acesso.
Backup/CAS/replay/auditoria/reversao ensaiados; fontes344/6797920338 e6798163177.
Aplicacao privada auditada. Sessao nova/browser confirmaram mestreGET200 e
locaisGET200(antes403) na mesma amostra;0locais nesse clienteHML, semAdd/Save.
Nao usar resposta vazia como ausencia global nem como importacao das117Obras.
Reversao em local-read-gate-20261111 exige CAS e auditoria; nao executar SQL
arquivado sem conferir bytes/pins/plano, nem repetir commit de resposta ambigua.

## Recuperacao revisada e parada normal (2026-11-11)

Codigo eba68f2f/CI6819/6820SUCCESS. Iniciar HML ERP continua wrapper do mesmo
controlador; pin privado atualizado para codigo revisado, sem policy de execucao
ou instalacao alterada. Start/status/replay positivos; porta15173PRIVATE.
O bootstrap usa helper de shutdown por SHA256, fecha Vite/HTTP concorrentemente,
drena SOMENTE sockets aceitos por api/web proprios e registra fases sem dados.
Falha/timeout nunca vira clean; deadline emergencial continua preservado.

Estado emergencial nao autoriza apagar lock nem escrever STOPPED manualmente.
Modo `--via-gh recover` e EXPLICITO e separado de start. Exige conservacao100
pos-parada fresca READ ONLY/ROLLBACK igual a baseline APROVADA, hashes de todos
os artefatos, PID ausente e socket/porta recusando conexao; plano0600 preparado
pelo procedimento privado apos inspecao. Preserva state/lock/socket/recibos em
recovery-* e usa in-progress para impedir start parcial. Nao inicia/importa dados.
Se faltar prova, parar e conferir; nao criar recibo ficticio nem reutilizar stale.
Reversao conserva bootstrap/config anteriores em lifecycle-backup-20261111;
arquivos de recovery e dados persistentes nao devem ser limpos.

Ensaio real: recuperar->start->stop com HTTP proprio aberto->checkpoint100/100
igual/0writes->retomar, com parada1255ms. Negativa recover durante HML viva passou.
API/web freeze8650; bootstrap de14e28f, patch sanitizado344/6797170363. Janela atual
ate2026-11-11T13:54:08Z; login Auth real/GrupoCPA/listagem100 confirmados.
Mesma amostra PJ: GET200/CNPJ14 igual banco->HTTP->campo e3contatos, semSave.
Locais403 e acesso negado, nao vazio. Isto nao comprova todos os campos100
nem disponibilidade24h. Nao tornar porta publica para resolver autenticacao.

## Retomada comprovada por SSH oficial - HML15173 (2026-11-11)

Mesmo Codespace, sem rebuild. GitHub CLI oficial portatil aprovado/autenticado
no desktop, GH_CONFIG_DIR privado (nao publicar hosts.yml/token). Exigir alvo
potential-xylophone-5gj7r9v9qqg637vxp, owner/repositorio e estadoAvailable antes
de agir. Codigo checkout b5cb34e1/.vscode preservado; snapshot servido8650fd4d,
API e web mesma versao revisada/CI6785/6786. Nao sincronizar destruindo WIP.

1. Medir via gh codespace ssh: df-h/df-i, docker system df, du conhecidos.
   Nesta execucao: disco92%,inodes26%;7caches antigos Copilot liberaram1.65GB.
   Retidas2versoes recentes; sem referencias em processos; registry/manifests
   conferidos. Depois do snapshot:87%,4276002816bytes livres. Nao repetir a limpeza
   desses caminhos ja removidos nem inferir que outras pastas sao descartaveis.
2. Apoio atual vem de container-recovery-verified.private.json.newContainerId.
   Nao usar nomes/IDs aposentados nem docker prune: system df falha pelo antigo
   container6c7e, preservado. Atual d02f iniciou/isolamento networknone/zeroportas.
3. Se15173 ausente no gh codespace ports, registrar pelo comando suportado:

```sh
gh codespace ports forward 15173:15173 -c potential-xylophone-5gj7r9v9qqg637vxp
# Apos listar15173, encerrar SOMENTE este helper. Nesta prova o registro persistiu.
gh codespace ports visibility 15173:private -c potential-xylophone-5gj7r9v9qqg637vxp
gh codespace ports -c potential-xylophone-5gj7r9v9qqg637vxp --json sourcePort,visibility,browseUrl
```

`visibility` antes de registrar retornou404; nao repetir esse passo isoladamente.
CLI remoto nao esta autenticado. Nao copiar OAuth desktop para o Codespace:
usar CLI desktop para tunel e SSH para invocar bootstrap privado existente.
O controlador0ee98b5b continua validado, mas seu uso direto no remoto exige
adaptacao a essa separacao; botao/autostart NAO entregues como prontos.

Bootstrap implantado em hml344-cpa-20261104/api-bootstrap.private.mjs com backup
anterior before-8650-20261111.private.mjs; nova fonte sanitizada344/6794991729,
SHA256 d6cca771a328431ee015f8a1071099cbc42e2a5ad0a3d2400c81300756fe3516.
Config hml-launch.private.json0600 contem reviewedSha/bootstrapSha256/pins.
Para invocar pelo canal SSH, carregar SOMENTE os quatro pins permitidos dessa
config e ERP344_REVIEWED_CI_SHA, mais CODESPACE_NAME do alvo previamente conferido,
antes do comando node --import .../tsx/dist/loader.mjs api-bootstrap.private.mjs
--hml-current. Sem essas variaveis o guard bloqueia: nao remover a validacao.
O guard compara namespace/fisico/baseline integral ANTES de READY e autentica
com provider real; sem fallback/seed/importacao/migration/restore/grants.

URL EXTERNA PRIVATE testada com login real do dono:
https://potential-xylophone-5gj7r9v9qqg637vxp-15173.app.github.dev/cadastros
Janela atual ate2026-11-11T11:54:08Z(08h54Brasilia).100clientes visiveis,
paginas20+20distintas e formulario/3contatos na amostra;0Save.100/331/20IE
conservados no preflight, cadastro completo nao aprovado. Ao fim verificar
lifecycle APP_STOPPED_RECORDS_PRESERVED; nao parar PG enquanto janela estiver
ativa. O operador iniciou PG antes do bootstrap: parar apoio ocioso exige
conferir locks/processos, sem supor que o bootstrap o fechara automaticamente.
Artefatos/recibos detalhados privados; sem promessa de24h ou alteracao na VPS.

## Iniciar HML pelo desktop autenticado (2026-11-11)

Validado em22ccb386, CI6807/6808SUCCESS: usar o MESMO controlador com
`--via-gh start`, `--via-gh status` ou `--via-gh diagnose`. GitHubCLI oficial
ja autenticado no desktop; ERP344_GH_EXECUTABLE aponta seu executavel aprovado
e GH_CONFIG_DIR seu diretorio privado. Nunca copiar esse config/token ao remoto.
O controlador envia somente codigo publico e prova curta do tunel privado via
SSH oficial; exige owner/repositorio/maquina/Available e preserva pins/lease.
Codespace parado exige abrir o MESMO ambiente pelo canal oficial, sem rebuild.

Atalho privado desktop `Iniciar HML ERP` chama o wrapper fino Iniciar-HML.ps1
existente em ERP-Integracao-Privada, que confere SHA256 do controlador publicado.
Nao altera execution policy, nao instala dependencias, nao duplica bootstrap.
Manual de recuperacao: executar esse wrapper com -Modo status -SemPausa
-SemAbrir; -Modo start inicia somente se necessario. Ao atualizar o controlador,
conferir/revisar seu hash antes de atualizar o pin privado do wrapper.

Ensaio start/replay/status produziu HML_STARTED/HML_ALREADY_RUNNING sem carga.
Janela atual pid32692 ate2026-11-11T12:40:56Z; API/web8650fd4d, dados reais FINAL100.
Sessao do dono e acesso externo precisam verificacao propria; timeout do Chrome
neste ultimo ensaio NAO e prova de indisponibilidade do servidor nem aceite UI.
Janela anterior terminou com100antes/depois/fingerprint igual e0writes.

## Historico - controlador fino antes da recuperacao (2026-11-11)

`scripts/legado/hml-control.mjs` coordena SOMENTE o bootstrap privado existente.
Nao e outro ERP/importador. Nao executa seed, carga, migracao, restore, limpeza,
Docker prune ou remapeamento. Ainda NAO instalado/testado na HML remota.
Controle local falha antes das abas (kernel assets, os error3); capacidade,
cota, processos remotos e HTTP externo continuam DESCONHECIDOS neste lote.
Nao atribuir o aviso a disco/computacao/cota sem painel e medidas atuais.

Depois de disponibilizar o codigo validado pelo canal suportado, sem sobrescrever
checkout/WIP de outro executor:

```sh
node scripts/legado/hml-control.mjs diagnose
node scripts/legado/hml-control.mjs status
node scripts/legado/hml-control.mjs start
```

`diagnose` mede df-h/df-i/Docker system df/du dos tres diretorios conhecidos,
independentemente; indisponivel nao vira zero. Nao consulta cobranca nem remove
itens. Antes de remover cache/build, conferir propriedade, referencia, reserva,
reconstrutibilidade e espaco antes/depois. Nada foi removido neste lote.

`start` exige mesmo Codespace e configuracao privada0600 existente/preparada em
`/home/codespace/erp-legado-privado-20261023/hml344-cpa-20261104/hml-launch.private.json`:
somente reviewedSha(40hex), bootstrapSha256(64hex) e objeto pins com as quatro
chaves ERP344_IE_GATE_SHA256, ERP344_POST_IE_BASELINE_SHA256,
ERP344_IE_COMPLETION_SHA256, ERP344_PHYSICAL_BASELINE_SHA256. Usar os hashes
dos recibos aprovados e dos bytes do bootstrap REVISADO, nunca placeholders,
credenciais, pin antigo ou hash calculado de arquivo nao revisado.
O candidato local antigo api-bootstrap-next ainda aponta fc1: NAO serve como
autorizacao de retomada. Atualizar/revisar pelo procedimento existente primeiro.

Trava atomica propria contra dois starters; nunca apaga writer.lock nem lease
antiga. Reaproveita processo saudavel somente com PID/cmdline/expiracao, marcador
API/web do SHA aprovado, origem FINAL100, Auth real e health/ready/401 anonimo.
Se parado e sem reserva, invoca exatamente api-bootstrap.private.mjs --hml-current;
esse bootstrap continua dono do banco, preflight fisico, baseline e janela20min.
Logs novos ficam privados0600; erro nao dispara nova tentativa automatica.

Retomada verificada12/11: runtime privado ce5f1cfb/CI6933/6934SUCCESS,
API/web mesmo SHA. Novo baseline de conservacao62a56d06 conserva o IE20 antigo
e liga fonte/commands/checkpoint pos-extensoes por hashes; nao reescreve recibos.
READ ONLY/ROLLBACK confirmou1600mestres/4200contatos/1500inativos e auditorias;
100originais conservam demais campos, extras conferidos no plano fonte.
Bootstrap atual compara a linha completa nova; nao ignora extras/CAS.
Antes de trocar, backup privado dos bytes de bootstrap e launch; para retorno,
parar somente a HML pelo fluxo existente e restaurar esses DOIS arquivos juntos.
Nao usar o baseline antigo contra dados enriquecidos nem anunciarREADY ignorando
falha. Voltar configuracao antiga nao equivale a autorizar escrita/reversao de dados.
Guardas reais1positivo/5negativos, syntax e pins passaram antes da ativacao.
Controller atual iniciou com health/ready200 e cliente anonimo401;15173PRIVATE.
Externo anonimo302 para github.dev; browser autenticado ainda depende de aceite.
Falha local kernel assets/oserror3 impede controleUI, nao comprova Codespace fechado.
Nao reinstalar/reiniciar servicos por essa falha. Retomar via controlador/gh suportado.

Encaminhamento usa gh codespace ports visibility15173:private e verifica a porta,
HTTPS e hostname retornados. Falta de registro/gh/autenticacao BLOQUEIA antes de
iniciar dados reais; usar registro suportado no painel Portas, nunca publico.
Referencia: https://cli.github.com/manual/gh_codespace_ports_visibility
Saude localhost/registro privado NAO comprovam acesso externo ou sessao: abrir
a URL completa existente, conferir marcador, login/perfil/Grupo/Empresas e
mesmos100/331/20IE antes de entregar. Em11/11 10:38Z, HTTP externo SEM sessao
retornou404 em /cadastros e /__erp_hml, sem redirecionamento. Nao comprova
causa ou estado interno; URL ainda nao entregue como funcional.

Autostart/task ao abrir a pasta ainda NAO configurados: .vscode remoto e reservas
nao foram conferidos. Nao sobrescrever WIP para oferecer um botao. Apos aceite
do controlador remoto, ligar a acao existente ao comando acima, sem rebuild e
sem prolongar janela/custo. Disponibilidade continua na VPS permanece proposta
condicionada a capacidade/isolamento/backup e autorizacao, nao implantacao.

## Delta vigente - IE20 HML finalizada e port rico sob revisao (2026-11-10)

- Mesma100/331contatos preservados; IE20 preenchida pelo lifecycle canonico
  enrichLegacyStateRegistration, com CAS/lock/RBAC e auditoria transacional.
  Apply/replay/reverse/final_apply/final_replay PASS;60auditorias novas e replays
  sem escrita. Nao repetir importacao/enriquecimento de contatos ou DDL.
- Retomada privada em ie20-address-20261110 sob /workspaces/.erp-private-344:
  execution-closed, baseline-chain, conservation-baseline-after-ie20,
  ie20-journal/completion e final-backup-after-ie20, todos private.json.
  Backup345276bytes do schema HML SHA256/TOC; nao novo restore desse arquivo.
  Fingerprints antigos de contatos permanecem historicos, nao replayar apos IE.
- Apoio PG e leitor SQL parados, reserva liberada; nao iniciar containers antigos.
  Catalogo dirigido6tabelas/252colunas recuperado do diagnostico exato do parser
  sem repetir consulta. FK omitida permanece desconhecida; nenhuma escrita de
  endereco. Provar joins e finalidade antes de transformar a mesma100.
- Antes15173, corrigir/revisar CAS e preservacao do port591/bd7f2f06 e servir
  API/web do mesmo SHA revisado com Auth real/preflight fisico. Pareceres
  6778237293/6778347806 nao sao prova de navegador. Nao usar fallback operacional,
  ampliar grants ou chamar sessao administrativa residual de leitor estrito.
- Central360 ocupa Pedidos pela decisao10/11; implementacao visual e composicao
  continuam com Cursor. CI/documentacao nao liberam merge, deploy ou carga real.

## Delta vigente - recuperacao do apoio e contatos HML concluida (2026-11-10)

- Gate do proprietario executado SOMENTE na HML existente. Apoio PG recuperado
  com imagem pinada restaurada do arquivo privado existente, mesmos dados/binds,
  Config/HostConfig, rede none/zero portas; antigo RWLayer defeituoso PARADO
  conservado. Normalizacao Docker OomKillDisable null->false nao amplia acesso.
  Pin fisico pg_control frio/SQL e baseline integral100 conferidos antes de DDL.
- Coluna canonica clientes.contatos JSONB nullable/CHECK array<=200 aplicada no
  schema hml344_cpa_20261104 apos backup/revisao; nenhum grant, role, default ou
  backfill. Nao executar migrador geral nem repetir esse ALTER. Runtime do lote
  29726d3d/CI6692SUCCESS, distinto do snapshot anterior da interface abaixo.
- Canonico apply/replay/reverse/final_apply/final_replay PASS:100clientes
  conservados,331canais finais,1canal em quarentena,300auditorias. Backup final
  812040bytes SHA256/TOC; nao se alega novo restore desse dump. Copia fria anterior
  349552640bytes SHA256/tar-compare tambem preservada. Originais/operacional intactos.
- Retomada: ler enrichment-20261110/execution-closed.private.json,
  container-recovery-verified.private.json, final-backup-verified.private.json e
  contact-worker-29726d3d/completion.private.json sob /workspaces/.erp-private-344.
  Usar o nome logico do apoio ativo indicado no recibo; NAO iniciar o container
  antigo preservado nem reimportar100. Dados persistentes continuam no mesmo
  pgdata/socket. Apoio final PARADO ocioso, sem listener15173 e reserva liberada.
- Antes de servir: coordenar snapshot API/web revisado com Cursor e reconfirmar
  bootstrap, mesma identidade fisica/namespace/Auth real e CAS de contatos ricos.
  Nao alterar guard fisico, usar fallback ou servir codigo antigo como prova do
  campo novo. Sem URL funcional anunciada neste lote. Prova fonte->API->interface
  e enderecos completos continuam pendentes, nao sao substituidos pelo PG.

## Estado vigente - HML15173 remapeada para volume persistente (2026-11-09)

URL privada existente:
https://potential-xylophone-5gj7r9v9qqg637vxp-15173.app.github.dev/cadastros

API/web2e2ccfebe6273c2e856f0a8881599f9c1d1fcb40, Auth real existente, banco
hml344_restore_20261104/schemahml344_cpa_20261104, mesma FINAL100/IDs. Nao e
deploy VPS, importacao nova ou aceite de todos os campos. Copia antiga permanece
PARADA; dados/socket ativos estao noext4/workspaces/.erp-private-344/pgdata e/socket.
O remapeamento aprovado esta CONCLUIDO, nao repetir --apply nem reativar o antigo.

### Procedimento ativo e limites

- Bootstrap privado existente usa hml-storage-binding.private.json0600, schema
  estrito/UID/root0700/semSymlink e descriptor identico. Resolve uma identidade
  unica para preflight, conexao e cleanup; guard canonico de isolamento nao foi
  enfraquecido. API/Data/Auth no mesmo namespace/pool, NOSUPER/NOBYPASS.
- Codigo sanitizado344/6689846342, SHA256
  ef65c4926273711c3b8bf76be42bafdc4b656092641c995c9757b73dbe69088e.
  Com binding, modo app sem --hml-current e BLOQUEADO. Usar somente:

```sh
node --import /workspaces/ERP-Zuccaro-codeX/server/node_modules/tsx/dist/loader.mjs \
  /home/codespace/erp-legado-privado-20261023/hml344-cpa-20261104/api-bootstrap.private.mjs \
  --hml-current
```

- Antes: conferir processos/locks/pins e estado; nunca apagar lock para iniciar.
  HTTP externo `/__erp_hml`, porta15173 Private e API/web mesmoSHA devem conferir.
  Identidade,100IDs e fingerprint integral sao validados ANTES do listener.
  Janela20min com expiresAt; parar somente PID/cmdline proprios porSIGTERM.
  A janela observada PID36147 terminava15:48:01.423Z(12h48Brasilia), nao prazo
  permanente. Nova janela exige conferir estado, nao nova carga.
- Depois: lifecycle APP_STOPPED_RECORDS_PRESERVED, mesmo100/fingerprint e PG
  devolvido ao estado inicial. Stop/start PG/API noext4 passou. Sessao pode exigir
  login, mas nesta ultima retomada GETsession200 foi aceito sem copiar token;
  nao instruir relogin indiscriminado. Ao cabecalho selecionarGrupo mas conteudo
  pedir contexto, reaplicar o proprioGrupo no seletor canonico, sem mudar RBAC.
- Navegador:100total,2paginas20+20distintas/0overlap e buscaHTTP200/1resultado
  esperado comprovados; busca limpa ao fim. Detalhes/edicao sem Save mostraram
  lacunas CNPJ/nomePJ na amostra2e. Nao salvar para experimentar ou preencher
  campo ausente por palpite. Cadastro completo continua gate separado.

### Conservacao e recuperacao privada

PG original e15c2c2d23d0 parado; substituto94c7cf0723b1 conserva imagemID LOCAL
fixada, nao digest de registry inventado. Config efetiva comparada, sem portas,
networknone, rootreadonly; somente label de correlacao nova. Checkpoint frio
355694592bytes foi extraido com traversal/links/special/duplicados bloqueados,
SHA256 por arquivo e clusteridentity iguais; banco/API confirmaram os mesmos100.
Isso e recuperacao fria efetiva, distinta do restore logico135978bytes anterior.

Noext4, fora do checkout,0700/0600:
- checkpoint-20261109T143855Z/{postgres-data.tar,hml-control.tar,manifest.private.json};
- pgdata/socket ativos, postgres-private.env/isolation-private.json privados;
- postgres-image.private.tar e hml-control-ext4.private.tar:2TAR/175587328bytes,
  SHA256/estrutura conferidos em recovery-manifest.private.json;
- bootstrap/binding e recibos hml-storage-proof/storage-relocation preservados.

Nao publicar esses arquivos, carregar imagem com dados ou sobrepor configuracao
privada existente. Imagem arquivada e somente a imagem vendor existente, nao
commit do container com clientes. Rebuild completo do Codespace NAO foi testado.
Se perder somente caches/controle, preservar pgdata e manifestos: conferir hashes,
restaurar APENAS controle privado nos caminhos originais apos confronto, recuperar
imagem fixa do arquivo quando necessario e runtime do SHA oficial pelo procedimento
do bootstrap. Conferir mesma identidade/mounts antes de iniciar; nao pg_init/seed.
Exclusao do Codespace nao e coberta como disponibilidade garantida desse volume.

Helper de manutencao apenas para leitura/recovery coordenada:344/6743376734,
SHA256f30ef492299e87f884e1cd9eed86282defdc62e7df08c15746c0b1ce102899ea.
Qualquer falha retinha writer.lock/REQUIRES_INSPECTION; foi comprovada falha por
passwordnaofornecida, resolvida dentro da configuracao existente do container,
sem segredoemargv/trust/grants. --resume-after-inspection foi executado e terminou;
nao repetir.14binding/6TAR/7main-resume sinteticos e revisao estaticafavoravel sao
provas distintas do cluster/100 reais. Retorno ao antigo exige parar/verificar
novo porID e retirar binding de forma reversivel; apos escrita aceita no novo,
reconciliar primeiro, nunca perder dados trocando automaticamente para snapshot.

Importadores historicos ainda precisam resolver o binding ativo; ficam suspensos,
nao apontar ao socket antigo. Proximos dados: planoIE20 CAS/auditoria/replay/
reversao e auxiliares por chaves nativas, sem nova coorte. Fonte/cadastro completo,
fornecedores/produtos e Base44 continuam pela matriz existente. Gates VPS intactos.

## Historico - HML15173, armazenamento e retomada (2026-11-09)

URL privada existente:
https://potential-xylophone-5gj7r9v9qqg637vxp-15173.app.github.dev/

API e frontend:2e2ccfebe6273c2e856f0a8881599f9c1d1fcb40. Namespace privado
existente hml344_restore_20261104/hml344_cpa_20261104; Auth real existente,
pool compartilhado Auth/Data, search_path HML,pg_catalog,pg_temp e preflight
fisico NOSUPER/NOBYPASS antes de READY. Isso nao qualifica o principal como
leitor estrito. Clientes sao da MESMA FINAL100; demais entidades nao homologadas.
Proprietario confirmou100; nao declarar todos os campos conferidos por contagem.

### Armazenamento comprovado e limites

PG privado e15c2c2d23d0, imagem fixada/rede none/0portas, data e socket por bind
privado0700. `findmnt -T` mostrouoverlay/ na origem/home: sobreviver a stop/start
nao prova conservacao contra rebuild. /workspaces eext4, cerca10GB disponiveis
antes do checkpoint. Nao excluir/recriar Codespace ou container para testar.

Checkpoint privado frio em/workspaces/.erp-private-344/checkpoint-20261109T143855Z,
fora do checkout/build: postgres-data.tar + hml-control.tar,355694592bytes,
manifest.private.json com SHA256 reconferidos e `tar -tf` completo sem erro.
Diretorios0700/arquivos0600; controle contem configuracao privada existente,
receipts e FINAL, nao Git/node_modules. Nunca anexar esses arquivos ao GitHub.
Esse checkpoint ainda NAO foi restaurado; nao atribuir a ele a prova anterior
de backup/restauracao logica135978bytes/15tabelas. Remapeamento do PG vivo para
oext4 exige aprovacao especifica e revisao antes de substituir o container;
atual container/dados originais preservados. Backup no volume nao torna o bind
ativooverlay automaticamente duravel nem garante conservacao apos exclusao.

### Retomada reproduzivel da mesma aplicacao

1. Conferir processos/reservas e o estado privado, sem imprimir conteudo de Auth,
   senha ou token. Nao remover writer.lock/api.sock para forcar partida. Sem
   escritor, confirmar isolamento do container e manifesto/FINAL nos pins atuais.
2. Usar o bootstrap EXISTENTE privado abaixo, SHA256
   d072b55ce9114b9d9f72342b372eb75f5cf25870bdd4a2b1a011e1f19b4b67dc.
   Codigo sanitizado esta em344/6689846342; conferir hash antes de executar.
   Nao usar o modo normal historico API50/webb888, nem misturar versoes.

```sh
node --import /workspaces/ERP-Zuccaro-codeX/server/node_modules/tsx/dist/loader.mjs \
  /home/codespace/erp-legado-privado-20261023/hml344-cpa-20261104/api-bootstrap.private.mjs \
  --hml-current
```

3. O bootstrap confere fonte/recibos e100identidades/fingerprint antes de READY;
   usa archives API/web do mesmo SHA e dependencias existentes, nao o WIP do
   checkout. Deve falhar se pins/lockfiles/arquivos divergirem. Nao sincronizar
   checkout alheio para contornar. Reconstruir runtime perdido somente do SHA
   oficial com procedimento revisado, nunca de seed ou nova selecao da coorte.
4. Conferir15173 Private no painel Portas e marcador `/__erp_hml` externo, nao
   apenas localhost. GET sessao sem login401 e POST corpo vazio422 foram
   comprovados; isso NAO e login real. Proprietario entra pela propria aba.
   Sessao requer novo login apos reiniciar API; nao copiar bearer entre ambientes.
5. Janela atual do bootstrap:20minutos, com expiresAt privado e parada automatica.
   Para parar antes, conferir PID e cmdline EXATOS do bootstrap proprio no estado
   privado, enviar SIGTERM somente a ele e aguardar lifecycle
   APP_STOPPED_RECORDS_PRESERVED. Nao matar PG/servicos/terminal de outro executor.
   O bootstrap restitui PG ao estado inicial e libera apenas locks/socket proprios.
6. Comparar lifecycle anterior/depois e nova partida:100linhas/100identidades e
   fingerprint de todos os campos iguais. Ensaio5393->13177 passou, sem seed,
   importacao ou restore. A API voltouHTTP200; novo login e campos UI sao provas
   separadas. Disponibilidade e temporaria, nao24h/agendamento permanente.

### Cadastro completo e enriquecimento

#### Contrato de contatos e leitura auxiliar - 2026-11-10

Nao confundir representacao com armazenamento: o proprietario confirmou o
campo de contato existente no ERP novo. CadastroClienteCompleto e o gerenciador
ja consomem contatos[]; clienteHttpPayload limita o transporte escalar e recusa
perdas de multiplicidade/metadata. A leitura atual dos metadados da HML mostrou
email/telefone/celular no mestre, sem contatos ou outro nome contato no schema.
Persistir esse MESMO contrato nao autoriza criar outro cadastro. A resposta do
proprietario sobre o campo existente NAO aprova DDL; candidata continua retida.
Codigo29726d3d/CI6692SUCCESS nao equivale a schema aplicado ou dados enriquecidos.

Decisao de representacao: canais ricos continuam em `Cliente.contatos`, ja
consumido por GerenciarContatosCliente/Form. ContatoB2B continua pessoa comercial,
cargo e preferencias; nao substituir/mesclar pessoas por nome, nem copiar suas
preferencias para um canal. Referencia opcional `contato_b2b_id` exige resolucao
exata do vinculo Cliente/Grupo antes de persistir, nunca validacao pela primeira
pagina de um seletor. Sem ContatoClienteV2 ou novo cadastro.

`clienteContatoSchema` e `clienteContatosReplaceSchema`, no arquivo de tipos
canonico existente, definem o formato usado pelo GET/PATCH do mestre. Tipos
Telefone/Celular/WhatsApp/E-mail permanecem distintos; nome/cargo/ramal/observacao,
IDs/codigos/procedencia/status preservados; contato so com metadata e representavel.
Sem valor/preferencia/status default; desconhecido nao e descartado. Extras ou
preferencias B2B no canal sao rejeitados explicitamente, nao removidos. Um principal
global preserva o contrato atual do editor; conflitos exigem revisao, nao democao
automatica. Exemplo somente sintetico:

```json
{"expectedVersion":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","contatos":[{"id":"synthetic-native-001","tipo":"Telefone","valor":"00112233","ramal":"0007","nome":"SINTETICO","principal":true,"legacy_id":"00001","source_system":"SYNTHETIC"}]}
```

Omissao de contatos nao remove; lista vazia e remocao explicita, dependente de
baseline completo/CAS e autorizacao. Limite200 rejeita excesso, sem truncar.
O GET devolve contatos_version somente se o armazenamento existir; ausencia da
coluna nao equivale a lista vazia. PATCH de contatos exige expectedVersion,
rowlock, contexto capturado e nova autorizacao dentro da transacao; auditoria
usa o mesmo executor. POST de mestre continua sem contatos ricos. Referencia
B2B ainda e bloqueada sem resolucao canonica, sem FK ou cadastro paralelo.
Delta candidato de armazenamento e coluna nullable
`clientes.contatos jsonb`, sem default[] (NULL conserva desconhecido), com CHECK
de array e limite; SQL/role/grants/HML NAO aplicados. Reutilizar rowlock,
sanitizeClienteAudit, RBAC Cliente e contexto do servico; nao escrever JSONB
diretamente. A candidata nao integra o migrador automatico; antes de aplica-la
exigir identidade/schema/principal, backup, revisao e gate especifico da HML.
O enriquecimento usa ClienteService.enrichLegacyContacts e os receipts existentes
do lifecycle legado: sourceProof NDJSON com hashes, fingerprint integral, lock,
editar+importar e auditoria atomica. Apply apenas acrescenta IDs novos depois do
baseline integral inalterado; nao apaga, reordena nem reescreve contatos manuais.
Repeticao do mesmo comando reutiliza receipt sem nova escrita; reverse exige
snapshot atual identico ao after original e restaura inclusive NULL. Comando
novo sem acrescimos deve ser classificado no-op pelo orquestrador, nao enviado
como novo apply. Revogacao concorrente real no instante do commit nao e provada
por guard sintetico que lanca erro; manter esse alcance separado.

O mapper puro no arquivo existente mapear-registro-sintetico.mjs exige baseline
completo, identidade nativa tipada e validador canonico. CODIGOCLIENTE corresponde
ao codigo_legado pelo contrato de extracao privado aprovado; CodigoSistemaAntigo
nao substitui essa chave. Provar PKs, documento e valores completos da mesma100
contra o exemplar congelado antes de usar o mapper. Nao alegar FK inexistente.
Preserva PK+campo na identidade do canal, nao mescla valores iguais de linhas
diferentes; conflitos com valor/manual vao para quarentena sem sobrescrita.
TELEFCLIENTE nao prova celular/WhatsApp. Campos invalidos nao apagam irmaos validos;
mais de200 canais bloqueiam somente o cliente, sem truncar. Endereco sem numero,
pais ou finalidade comprovados nao deve passar pelo contrato completo de Locais
com defaults; preservar proposta e motivo privados para revisao.

Documentos CPF/CNPJ/inscricoes sao do mestre; documentos adicionais
e anexos exigem metadados/storage privado existentes, nao cabem em contatos.

Leitura SQL: captura administrativa de09:59:10Z confirma instancia parada,
master/mastlog/ERRORLOG em C: e nenhum caminho usuario nos logs encontrados;
NAO comprova catalogo atual. Preparacao privada `-PrepareCatalogCopy` copia
somente master/mastlog para pasta privada nova em C:, com espaco/ACL existentes,
SHA256 e conservacao de origem, sem iniciar motor ou alterar permissoes. Script
  privado tem sintaxe validada. Recibo posterior confirmado:2arquivos/8650752bytes,
  hashes conferidos; NAO repetir a copia. Partida Windows bloqueada. Alternativa
  revisada no mesmo Codespace: imagem oficial SQL2025 com master limpo, somente
  copia de trabalho em container sem rede/portas/mounts dos originais; aceite
  EULA explicito RECEBIDO. Extracao posterior concluida no mesmo Codespace:
 5arquivos/53412linhas/35281985bytes conferidos, leitor encerrado e referencia
  privada conservada; recibo RAW no HANDOFF vigente. Sem enriquecer HML ainda.
  O executavel exigiu somente NET_BIND_SERVICE no bounding set, mantendo
  dropALL/NoNewPrivs/none/zero portas; nao adicionar outras capabilities.
  Fixar digest, reconferir capacidade e filelist
  completo antes de attach; sem rebuild/reparo. Attach modifica apenas a copia;
  READ_ONLY/PK/FK precedem extracao. RAW nao e cadastro enriquecido/homologado.
Retorno: instancia continua parada, originais intactos, copias conservadas.

Nao iniciar somente com T3608 e chamar isso de isolamento: a documentacao Microsoft
explica que acesso pode iniciar outros bancos e criar tempdb. Antes de abrir a
copia, revisar isolamento de TODOS os caminhos de sistema, protocolos e execucao
de startup procedures; copiar os arquivos de usuario necessarios somente para
trabalho privado separado do HD, nunca abrir o original. Gate de partida nao
foi exercido. Fonte: https://learn.microsoft.com/en-us/sql/t-sql/database-console-commands/dbcc-traceon-trace-flags-transact-sql?view=sql-server-ver17#tf3608


Matriz privada28campos distingue backup original ainda nao lido por registro,
FINAL extraido, payload, banco, API e formulario; desconhecido permaneceNULL,
nao zero/ausente. Fonte/resumo nao substituem auxiliares. Catalogo documentado
identifica5tabelas de contatos/telefones; conteudo e chaves nativas ainda devem
ser conferidos pelo canal autorizado, sem inferir joins por nomes semelhantes.

IE:20presentes noFINAL,20aceitas por clienteUpdateSchema,0persistidas; omissao
do mapper corrigida em5ef66b55, mas banco nao enriquecido. Plano privado
ie20-enrichment-plan-v2-20261109.private.json prepara20patches vinculados a
ID/codigo/procedencia/snapshot,0escritas. Aplicar somente apos CAS canonico sob
lock, auditoria transacional, idempotencia/reversao ensaiadas e revisao. Preservar
baseline original e criar versao de conservacao auditada apos enriquecimento;
nao sobrescrever fingerprints para esconder alteracao nem reimportar100.

Locais/documentos/contatos ricos precisam contrato HTTP canonico; campos omitidos
nao podem apagar valores. UI Grupo ainda bloqueia Abrir Clientes no2e servido,
coordenado com Cursor; nao resolver promovendo admin ou ampliando tenant.
Base44/produtos/fornecedores seguem matrizes existentes, sem equivalencias por nome
ou fiscal/saldos atribuidos a empresa por palpite. Deploy/carga operacional continuam
dependentes de versao revisada, destino, backup, reconciliacao, retorno e aprovacao.

## Historico - conservar a mesma HML e validar o delta (2026-11-09)

O banco privado existente conserva a mesmaFINAL100:100ativos/100identidades
conferidos por Grupo/lote/codigos emREADONLY/ROLLBACK. Nao recarregar/restaurar
para retomar. PostgreSQL usa bindprivado persistente, networknone/0ports;
STOPPED significa processo parado, nao exclusao do armazenamento. Recibos
hml100-result/recovery e client-persistence-20261109 ficam0600 no diretorio
hml344-cpa-20261104 ja documentado. Conferir identidade/pins/estado e locks
antes de iniciar; nao usar outro banco/schema ou fallbackpublic.

Bootstrap privado existente recebeu modo --history-only (artefato de codigo
344/6689846342, SHA256f7477a00938754d776c6ceb1273811cabc0f86ad4207c20af6202e04278ebf93).
Verifica FINALbytes/recibo, identidade fisica/NOSUPER/NOBYPASS, consulta exata
com100chaves eLIMIT101, comparaidentidades/campos, fazROLLBACK e devolvePGao
estadoinicial. Cinco casos sinteticos e execucao real100/100PASS. Nao inicia
API/web. Se recibo ja existe, conferir/reutilizar; nao repetir o comando apenas
para gerar outra prova. API50/webb888 no modo normal sao HISTORICOS: nao
iniciar esse par para alegar que591 nova foi homologada.

Retomada da aplicacao exige checkpoint anterior encerrado, nenhum outro
escritor/processo no runtime e parAPI+webMESMOSHA revisado. Porta5173 atual e
harness SINTETICO5788, Public; nao eHMLCPA e nao deve receber dadosreais.
Usar janelaPrivate existente/coordenada, sem parar processo alheio ou criar
recurso pago. Conferir preflightfisico/search_path/Authreal e fonte por API e
formulario, depois parar/iniciar somenteapp e comparar os mesmos registros.
Essa prova de retomadaAPP e distinta da conservacaoPG ja comprovada.

IE20fonte/0payload/0banco identifica lacuna do mapper, naoautoriza alterar os
clientes carregados. Correcao de planejamento preserva campos escalares
canonicos validos; enriquecer mesma100 somente com snapshotantes/CAS, revisao,
auditoria, reexecucao e reversao. Enderecos/contatos auxiliares exigem fonte e
adaptercanonico; nao inventar numero,pais,WhatsApp,finalidade ou relacao fiscal.

## Historico - sessao real aceita; UI Grupo pendente (2026-11-06)

Login real HML conferido pelo navegador apos acao do proprietario: auth/session
200, perfiluser/empresa_idNULL, Grupo e2empresas aprovadas; clientes200 com
meta.total100. Nenhum token/nome/documento no recibo publico. Prova privada
auth-browser-20261106.private.json0600; API50b/webb888, nao composicao401 atual.
Bootstrap c32ef95a com HMR no listener privado5173 e encerramento com browser
conectado PASS; lock/socket liberados e PG restituido parado antes da nova
janela20min. Nao e servico permanente ou deploy ERP.

Bloqueio UI reproduzido: guardasadmin-only de erpHttpSession.js impedem selecionar
o proprio Grupo com permissao explicita; mesmas guardas no4015d9a7e37. Decisao
ja aprovada nao autoriza promoveruser ou ampliargrants; corrigir contrato UI,
coordenado6690425383, antes de declarar nomes/listagem/edicao homologados.
Nao repetir importacao100, backup/restore ou criar IdP/Authuser para contornar.

## Historico - Auth configurado e bootstrap privado ensaiado (2026-11-06)

As rotas GET/auth/v1/user e POST/auth/v1/token ja foram aplicadas no HTTPS
existente conforme gate especifico e recibos no HANDOFF. O bloqueio historico
de roteamento abaixo NAO e vigente. Provedor self-hosted srv1982741, GoTrue
v2.189.0 e gateway existente; anon conferida em memoria contra API e gateway.
Somente config anon existente foi transferida pelo SSH dedicado para
/home/codespace/erp-legado-privado-20261023/hml344-cpa-20261104/auth-provider.private.json
em0600, diretorio0700; nao publicar conteudo, copiar bearer ou gerar chaves.

Bootstrap privado pin6f1cc7d4: API50b60e46/webb888b2c0, namespace HML existente,
preflight fisico/pool unico/NOSUPER/NOBYPASS PASS. Web e proveniencia200,
sem sessao401, arquivo privado403. SIGTERM real corrigido e comprovado com
lock/socket liberados e PG restituido parado; janela limitada reaberta, porta
5173 PRIVATE conferida na interface. Nao e homologacao Auth/cliente/browser.
Permissoes residuais da role continuam documentadas; nao e leitor estrito.
Sem carga100, DDL/grants, deploy ERP ou novas credenciais nesta etapa.

## Historico - shell e roteamento observados, Auth HML nao homologado (2026-11-06)

Mesmo hPanel/VPS srv1982741, Console da Web autenticado e shell real conferidos.
Inspecao somente leitura caddy adapt, emitindo apenas host/upstream: API DEV
aponta127.0.0.1:3080 e web DEV127.0.0.1:3081. Host HTTPS declarado pelo Auth nao
consta nesse adapt. Sondas locais --resolve host:443:127.0.0.1, sem -k ou token:
host Auth HTTP000/curl35 (alerta TLS); API DEV /auth/v1/health401/TLS_VERIFY0;
web no mesmo caminho200/TLS_VERIFY0, sem alegar que SPA200 seja health Auth.
Health interno Auth200 anterior e separado. Nao atribuir timeout externo a uma
causa unica; estas provas locais identificam uma incompatibilidade de roteamento.
Nao houve restart, proxy/firewall/porta/grant/role/DDL ou mudanca de credencial.

Canal minimo ainda necessario: endpoint HTTPS REAL do provedor existente,
alcancavel pela API HML e com TLS valido. Nao usar endpoint web200, copiar bearer,
desligar TLS ou expor Kong por inferencia. Qualquer alteracao de rota/exposicao
exige alvo, impacto, prazo e reversao aprovados antes da aplicacao; preparar com
o procedimento existente, sem substituir o par operacional ou criar novo IdP.

Decisao do proprietario06/11: perfil de Grupo (empresa_id NULL) pode acessar a
visao do proprio Grupo pela permissao explicita da entidade/acao sem ser admin.
Reconciliar resolveSessionEntityGuard existente com o guard de dominio; manter
negativas de outro Grupo/perfil empresarial/permissao ausente/revogacao/sessao
antiga. Nao autoriza novos grants ou mudancas VPS. Implementacao local no guard
canonico e testes HTTP existentes: antes2FAIL, depois12PASS0FAIL0SKIP focados;
backend560PASS0FAIL38SKIP. Fronteiras Auth/DB sinteticas, sem afirmar login HML.
Proposta historica abaixo deixa de ser decisao pendente; codigo publicado na342
em2f588154/CI6448 SUCCESS ainda depende de incorporacao, nao implantado na VPS.
Lote posterior no cliente existente: URLs Auth/Data explicitamente identicas
reutilizam um unico cliente/pool, com preflight de roles e banco/schema mantido.
URLs distintas sobre socket continuam rejeitadas quando endereco/porta saoNULL;
NULL=NULL nao comprova destino. f51376fa/CI6450 SUCCESS validado depois no PG HML
privado REAL: descriptor existente guardado antes do start, namespace/banco/role
esperados, NOSUPER/NOBYPASS login/execucao, mesmo cliente/pool por URL identica,
metadados em READ ONLY/ROLLBACK e0writes de negocio. Container devolvido a parado,
lock liberado, recibo detalhado0600 fora do Git;344/6684265740 sanitizado.
Arquivo executado igual ao blob4e10224a97ec10a584c89e1a9d4295e675999a5c.
Isto fecha o preflight SQL nesse destino, NAO autentica sessao/HTTP nem libera API.
HML100, backup/restauracao e historicos preservados; sem API HML READY/URL real.

### Proposta minima revisavel de canal Auth - NAO AUTORIZADA/APLICADA

Gateway Auth EXISTENTE em127.0.0.1:8000 retorna401 para GET/auth/v1/user sem
credencial; nao basta para provar sessao. Caddy2.11.4, arquivo atual253bytes,
modo640 root:caddy, SHA256246c2111061f092b597fa368018ca91f54f4ff5261115105d36a55f51bd3386c.
Proposta: no host HTTPS API DEV ja existente, encaminhar SOMENTE GET/auth/v1/user
e POST/auth/v1/token ao gateway existente, preservando paths/query e validacao
apikey/Bearer pelo Kong/Auth; demais paths continuam no upstream API3080.
Esses dois contratos atendem verificacao e login/renovacao do provedor existente;
nao expor signup/admin, Studio, banco, porta nova ou segredo no proxy.

E uma nova superficie publica de autenticacao no mesmo443: exige aprovacao
especifica e revisao de limites/rate-limit/provedor antes de aplicar. Nao executar
por inferencia da permissao granular de Grupo nem da autorizacao HML isolada.
Janela proposta5min, sem substituir API/web; precondicoes: bytes atuais conferidos,
copia privada reversivel, candidato caddy validate aprovado, ausencia de segredo,
API/web anteriores saudaveis e procedimento de reload existente confirmado.
Abortar por TLS invalido, rota inesperada, falha do login/provedor, ampliacao de
paths ou regressao API/web. Reversao: restaurar bytes/proprietario/modo anteriores,
validar/recarregar config pelo procedimento aprovado, conferir fingerprint e
health anteriores; nenhum dado/role/grant/schema muda. Preparacao, nao deploy.
Depois usar essa origem HTTPS no processo HML privado, nunca AuthDB operacional.

## Historico - console HTML acessivel, backend desconectado (2026-11-05)

Uma nova abertura pelo botao Console da Web do MESMO hPanel carregou o console
esperado, mas exibiu 'Conexao com o servidor perdida'. Sem prompt, nenhum comando
VPS enviado. Isto muda ERR_CONNECTION_RESET para perda de conexao no console;
nao comprova shell recuperado, listeners, firewall interno ou Auth HML funcional.
Nao reiniciar VPS/Auth/PG, alterar senha/chave, abrir porta ou tunel por tentativa.

Diagnostico sanitizado pronto para o canal existente hPanel -> Fale com um agente:
"VPS srv1982741. O Console da Web abre a pagina, mas mostra Conexao com o servidor
perdida, sem prompt. No ensaio privado anterior do Codespace, DNS de Auth e DEV
resolveu ao mesmo IPv4; TCP443 expirou antes de TLS e SSH22 expirou antes de
autenticar. A API da conta retornou firewall_list total0; o firewall interno e os
listeners ainda nao foram inspecionados. Solicito diagnostico somente leitura da
conectividade/console e caminhos existentes. Nao autorizo restart, reinstalacao,
reset de credencial, regra de firewall, exposicao ou mudanca de plano. Qual canal
administrativo existente permite recuperar a inspecao sem alterar a operacao?"
Mensagem PREPARADA, nao enviada ao suporte nem recebimento alegado. Nao incluir
URL de sessao, token, chave, .env, clientes ou dump. Se precisar de logs privados,
verificar seu conteudo/destino antes de anexar. Ao recuperar o shell, conferir
hostname, ss443/8000 e firewall/proxy em leitura antes de qualquer proposta.

## Historico - bloqueio anterior ao TLS (2026-11-05)

Chrome e Codespace retomados pelo controle suportado; checkout/WIP preservados.
DNS Auth e DEV resolvem ao mesmo IPv4, Auth tambem tem AAAA; proxy ausente.
Sondas IPv4 SEM credencial, TLS nao desligado: ambos HTTP000/curl28, resolucao
<1ms e sem conexao TCP/TLS; timeout5s. SSH dedicado por config verified existente
tambem expira TCP6s/255, ANTES da autenticacao. Nao reprovisionar conta/chave.
Console da Web existente retorna ERR_CONNECTION_RESET; API Hostinger autenticada
retornou firewall_list total0. Nao concluir que UFW/nftables ou filtros internos
estao ausentes; listeners e causa ainda desconhecidos. Nenhuma mudanca aplicada.

Retomada minima: recuperar Console da Web do MESMO VPS no hPanel. Se o erro
persistir tambem ao proprietario, pedir suporte de conectividade/console com os
resultados acima; nao autorizar restart, reset de credencial, regra ou exposicao.
Com canal recuperado, inspecionar ss443/8000, proxy e firewall interno em leitura,
antes de propor qualquer configuracao. Nao repetir curl/SSH identicos sem delta.
Health Auth interno200 anterior continua prova separada; nao e sessao API HML.
Sem READY ou URL real homologada, sem fallback ao operacional e sem novo IdP.

## Historico - canal Chrome recuperado; Auth externo ainda sem prova (2026-11-05)

Controle suportado Chrome Pessoa1 comprovou URL e terminal do MESMO Codespace.
Nao reinstalar, reiniciar ou recriar ambiente para esse bloqueio encerrado.
Checkout b5cb34e1/.vscode novo preservado; candidato b888 continua no snapshot
privado existente. Recibo HML100/reconciliacao confirmado, sem repetir operacoes.

Diagnostico somente leitura no console administrativo existente: API DEV usa
supabase_user e endpoint Auth interno, anon configurada, service key nao lida.
GET /auth/v1/health pelo endpoint configurado respondeu200, corpo nao lido.
O host da configuracao e alias de rede, nao nome de container comprovado:
docker inspect pelo alias falhou; isso NAO prova Auth parado (health200).
Nao usar essa tentativa como motivo para criar/reiniciar gateway.

URL HTTPS externa declarada pelo Auth testada do Codespace, sem credencial,
sem -k e sem alterar proxy/rede: HTTP000/curl28, timeout de conexao5s.
Limite comprovado: esse canal externo nao conectou naquele ensaio; causa e
alcance global inconclusivos. Nao atribuir a cota, firewall ou Auth sem evidencia.
Proximo: conferir roteamento/allowlist do endpoint existente; nova exposicao ou
tunel exige proposta/gate especifico (alvo exato, menor acesso, prazo e reversao).
Nenhum token ou chave deve ser copiado do DEV para contornar esse resultado.

Guard de Grupo e preflight socket abaixo permanecem pendentes independentes.
Nao promover user, comparar NULL como identidade fisica ou usar AuthDB operacional.
Sem API HML READY, sessao HML ou browser com clientes reais comprovados nesta rodada.

## Historico - controle por URL e contrato de Grupo HML (2026-11-05)

O gate isolado abaixo permanece executado; nao repetir carga, replay ou restore.
Retomada de3420891a340/CI5897 e401b888 sem consulta/escrita remota. Em05/11 o
controle nativo voltou a listar janelas; kernel assets deixou de ser o bloqueio.
A observacao do Chrome foi interrompida pela ferramenta por URL nao verificavel
com seguranca. Nao contornar por outro mecanismo de Computer Use nesta execucao.
Selecionar a aba Codespace JA existente e deixar barra URL visivel para verificacao
suportada; nao repetir restart/rebuild/install de Codex/Chrome/Codespace/PG.
Estado remoto atual nao foi reobservado, nem carga100/backups repetidos.

Contraprova4checks do guard real (blob igual em342/401): user com permissoes
explicitas permite Empresa autorizada mas nega visao Grupo; admin com mesma
arvore permite Grupo, estrangeira negada. Perfil HML permanece user, sem nova
concessao; nao apresentar binding SQL anterior como sessao/visao Grupo homologada.
Antes de promover role ou alterar politica, preparar impacto em todos os
consumidores e obter decisao especifica; nao usar admin como atalho para acesso.

Proposta minima REVISAVEL, nao aplicada: preservar role=user e a arvore explicita
Cadastros.cliente (visualizar/editar conforme a acao), sem wildcard ou chave de
Grupo inventada. O RbacGuard de dominio ja resolve perfil/Grupo/empresa/acao sem
exigir admin; o guard de sessao para visao Grupo acrescenta a exigencia admin.
A decisao especifica e se um perfil autenticado de Grupo (empresa_id NULL), com
a permissao canonica explicita da entidade, deve poder acessar essa mesma visao
sem admin. Se aprovada, reconciliar guard e seletores existentes, nao criar
guard paralelo: negar outro Grupo, perfil empresarial em Grupo, permissao ausente,
revogada e callback de sessao antiga; validar frontend e endpoint reais juntos.
Isso nao autoriza nova concessao/perfil, ampliar a arvore ou alterar policies.

Ao retomar bootstrap, manter API/Auth/Data no mesmo namespace/pool canonico.
AUTH_DATABASE_URL ausente reutiliza db como authDb; se configurar pools separados
sobre Unix socket, o preflight atual rejeita endereco NULL. Nao resolver por
NULL=NULL ou retirar a guarda. Preflight fisico deve conferir recibo do destino,
schema, role, referencias e search_path HML,pg_catalog,pg_temp antes de READY.
Canal de provedor Auth real ainda nao configurado/conferido nesta retomada;
nao copiar bearer, inventar IdP ou apontar AuthDB ao operacional.
Nenhuma URL com dados reais disponivel por esta rodada. Provas de helpers/callbacks
das488/489 sao separadas desse gate; pareceres e SHAs no HANDOFF existente.

## Historico - gate isolado HML CPA executado; API/web pendentes (2026-11-04)

A autorizacao posterior do proprietario foi aplicada SOMENTE no PG privado
existente, apos backup integral, restauracao, ensaio e revisao independente.
Nao aplicar o procedimento historico abaixo na VPS.342a8398383/CI5858 SUCCESS;
fonte de runtime imutavel401b888, sem alterar candidata ou checkout Codespace.

Destino exato privado e recuperacao constam em hml344-cpa-20261104/
schema-applied.private.json e hml100-recovery.private.json, sob o root privado
ja documentado no HANDOFF. Namespace separado na copia restaurada do PG privado,
nao novo projeto ERP e nao substituicao da API DEV/operacao. Grupo CPA/2empresas
espelhados dos dados/IDs comprovados, perfil ligado ao Auth existente verificado
apos login200/no-store; nenhum Auth/segredo novo. Perfil user reduzido, sem
permissao exportar ou vincular empresa/fiscal por inferencia.

Envelope executado: SQLs canonicos001/003/004/009/010/011/014,15tabelas com RLS
FORCE, bootstrap limitado aos IDs aprovados antes de contexto, dados vinculados
ao Grupo e app.group_id.014 resolve condicao_pagamento_id; condicoes vazias sem
grants de escrita. Funcoes novas invoker/path fixado; PUBLIC revogado APENAS no
namespace novo.045-049 permanecem privadas/fora migrador. Nao marcar SQL
operacional como aplicado nem alterar journals antigos por causa deste ensaio.

Role existente testada por LOGIN real: sem super/BYPASS/create-role/create-db;
negativas de admin/profile/schema/auditoria, ator/Grupo e importacao empresarial.
PUBLIC TEMP/lo_create preexistentes preservados e declarados como risco residual;
essa e role de importacao privada, nao prova de leitor SQL estrito. Exportacao
row_security=off permanece bloqueada/incompativel, sem workaround BYPASSRLS.

MESMA FINAL100/bytes e cohort pin:100inseridos/100reconciliados/0rejeitados;
replay100reutilizados/0novos, comparacao integral preservada. Auditoria final
100create+100possible_duplicate por conferencia canonica. Reversao logica100
ensaiada com auditoria e ROLLBACK, mantendo100ativos HML para futura conferencia;
historicos anteriores inativos intocados.0enderecos ou vinculos inventados.
Cinco emails preservados;100enderecos incompletos/4CEP_FORMAT nao homologam
entrega/cobranca/fiscal dependentes. Nenhuma escrita no banco operacional.

Recuperacao: dump anterior integral7798535bytes restaurado; novo dump do namespace
135978bytes restaurado em outro DB logico da mesma instancia,15tabelas iguais por
contagem/fingerprint. SHA256/TOC/recibos privados0600/pai0700, manifest24arquivos
8461411bytes antes do proprio manifesto.15checks schema +8login +7retomada/
negativas/restore finais aprovados; falhas de driver preservadas, nao produto
alterado para esconder assercao. Container parado networknone/0portas.

Retomada sem nova carga: conferir manifest/result/recovery, identidade do
container e pg_isready; usar somente DB/schema apontados no recibo. Configurar
AuthDB e DataDB canonicos no MESMO namespace com search_path explicito
HML,pg_catalog,pg_temp e verificar alvo fisico antes de READY. Canal de Auth REAL
existente ainda precisa ser conferido no runtime HML; login DEV nao prova login
HML. Nao copiar bearer nem usar provedor sintetico para liberar dados reais.
API/browser reais ainda NAO disponibilizados/homologados; falta ciclo de sessao,
contexto, RBAC, listagem/reabertura e acesso externo privado pelo proprietario.
Retorno: parar apenas API/web HML, preservar namespace/recibos; reversao de lote
somente com CAS/auditoria canonicos, nunca DROP, reativacao antiga ou overwrite.
Merge, deploy, grants/DDL operacionais e carga real operacional seguem gates.

## Historico - precheck de codigos fechado; binding HML pendente (2026-11-04)

MESMA FINAL100/pins: consulta nova por100codigos exatos no GrupoCPA completo,
incluindo empresas/inativos,100livres/0conflitos; UNIQUE(group_id,codigo) efetiva.
READ ONLY/REPEATABLE READ/ROLLBACK, destino/sessao conferidos, sem escrita. Nao
e reserva de codigo ou prova de outro Grupo; recheck no lote permanece obrigatorio.
Principal administrativo com BYPASSRLS nao pode ser descrito como leitor restrito.

No PG privado persistente ja existente: Grupo CPA nao existe; seis policies do
principal do piloto limitam-se ao grupo anterior. Sem super/BYPASS/createdb/createrole,
mas privilegios herdados/PUBLIC/Auth efetivos ainda precisam de prova. As colunas
de clientes comportam15campos do payload mestre, nao todo o schema de HML.
Nenhum novo namespace, perfil, grant, policy ou Grupo foi criado nesta rodada.

Confirmação especifica solicitada para namespace HML separado nesse PG isolado,
nome proposto hml344_cpa_20261104 (ainda inexistente), sem mover tabelas atuais;
espelho dos IDs/dados CPA/duas empresas e perfil de identidade Auth ja existente
previamente conferida, grants/policies minimos somente nesse escopo, apos backup,
ensaio e revisao. Preservar PUBLIC e roles anteriores; qualquer ajuste fora desse
escopo exige gate correspondente. Sem novo usuario Auth/segredo ou alteracao na
VPS operacional. Confirmacao pendente nao pode ser registrada como autorizacao.
Efeito proposto apos os gates: carregar somente a MESMA100 pelo importador/ledger
canonicos nesse namespace; copiar referencias comprovadas, nao fixtures renomeadas.
Retorno: parar apenas runtime HML, revogar apenas concessoes novas e reverter lote
por fluxo logico/auditoria; preservar namespace/recibos para reconciliacao, sem DROP
ou reativacao de historicos. Backup do PG privado anterior ao patch fica privado.

Auxiliares:100enderecos incompletos (96sem conflito adicional,4CEP_FORMAT), faltam
nome do local/numero/pais/finalidades; cinco emails canonicos sustentados diretamente
pela fonte. Nao inventar complementos nem declarar cadastro completo. HML deve
exibir motivos/operacoes bloqueadas pelo fluxo de revisao existente.

DEV efetivo: SPA asset /assets/index-BZF22CJa.js, API erp-api-dev/version
0.1.0-runtime-01/ERP_ENVdev, DB confrontado em recibo privado. Imagens locais sem
label Gitrevision; SHA servido nao comprovado, nao equiparar a b888. Grupo CPA e
duas empresas existentes nao renomeados; razao social/fantasia/prefixo distintos,
terceira linha intacta. Codespace e seu harness permanecem sinteticos/separados.
Detalhes/identidades/pins/SQL e resultados permanecem privados conforme HANDOFF.

## Historico - previa privada acessivel; gate HML real separado (2026-11-04)

401b888b2c0: acesso externo/login sintetico e SHA de /__erp_preview comprovados
nesta retomada; URL5173 Private, sem torná-la publica ou criar recurso. Janela
04/11 16:55:45Z--17:55:45Z, timeout3600/handlers stop existentes. Roteiro e provas
no HANDOFF; nao anunciar disponibilidade apos a janela sem nova verificacao.
Nova concorrencia UI-create/HTTP/PG aprovada no alcance401/6636933464, sem alterar
codigo. Previa contem somente dados sinteticos, NAO os100 clientes reais.

Pacote concreto para HML real, PREPARADO/NAO EXECUTADO:
- Registros: MESMA FINAL100/pins,100 mestres ativos da fonte; historicos17471 e
  os100 revertidos no grupo sintetico permanecem intactos/inativos. Nao reativar,
  sobrescrever, fundir ou selecionar outra coorte para apresentar dados na tela.
- Destino: armazenamento PG privado persistente ja inspecionado e isolado por
  networknone/sem portas; NAO banco efetivo da API operacional ou PG tmpfs da previa.
  Antes de gravar, fixar namespace/grupo de homologacao e binding CPA explicito
  aos IDs aprovados, sem afirmar que grupo sintetico anterior equivale ao CPA.
- Prechecks faltantes: conflitos dos100 codigos contra TODO o escopo relevante
  autorizado e documentos/identidades concorrentes; schema/journals efetivos e
  auxiliares/vinculos por campo. Consulta administrativa anterior nao prova isso.
  Consultas fixas restritas/READ ONLY/ROLLBACK, sem ampliar ACL global/BYPASSRLS.
- Principal: Auth/RBAC canonicamente vinculados ao grupo de HML, nao administrador
  da consulta anterior; comprovar negativas cross-tenant e efeitos externos OFF.
  Preservar o guard sintetico do harness: nao apontar sua config atual a dados reais.
- Efeito proposto: somente novos mestres compartilhados do Grupo, procedencia,
  codigos e IDs de origem preservados; empresa_id NULL, sem vinculo fiscal,
  cobranca, mensagem, saldo ou estoque. Auxiliar ausente continua pendente.
- Backup/reversao: snapshot recuperavel do destino privado ANTES de escrita,
  integridade/restore conforme recibos existentes e delta; lote/importador/ledger
  canonicos com CAS/idempotencia/auditoria e reversao logica, sem apagar historico.
  Nao usar backup de workspace/origem como backup desse destino de HML.
- Liberacao: autorizar somente a aplicacao do binding e lote identificado depois
  dessas provas; esta preparacao nao autoriza load operacional/DDL/grants/deploy.
  Sem efeito no destino atual e sem nova decisao generica solicitada nesta rodada.

Gate de uso finito: HML/binding/auxiliares -> schema/principal/backup -> lote
autorizado e reconciliacao -> cadeia real de PRs -> deploy aprovado -> aceite.
Fornecedores/produtos mantem mapas/contratos existentes e pendencias individuais;
historicos para consulta nao geram efeitos financeiros/fiscais/estoque por inferencia.
Recuperacao ERP novo permanece separada, procedimento Base44 existente abaixo.

## Historico - consulta100 executada; previa suspensa (2026-11-04)

Mesma401 b888b2c0 foi acessada pela URL privada5173, com login de fixture e banner
sintetico; HTTP local200 e registroPrivate do CLI conferidos. Posteriormente o
Codespace passou a Stopped/?autoStart=false sem comando deste executor; motivo
ainda nao comprovado. Nao anunciar URL disponivel agora nem criar outro ambiente.
Na retomada coordenada, manter snapshot/guards/recibos e ler resultado privado
unit-negative-20261104-v5 antes de nova execucao. Checkout b5cb/??.vscode preservado.

Console administrativo existente voltou a funcionar. Banco efetivo da API foi
confrontado ao container por endereco normalizado/porta/database; Grupo CPA e
duas empresas aprovadas conferidos pelos IDs privados anteriores. Consulta FIXA
do modulo pilot-functional-load-plan.mjs, gerada do FINAL100/pins existentes e
SHA de transporte conferido:100 linhas, READ ONLY/REPEATABLE READ, limites/
timeouts/search_path canonicos e ROLLBACK. Classificacao canonicab888:100NEW,
0COMPATIBLE/0DUPLICATE/0DIVERGENT/0BLOCKED. Nao repetir leitura intacta.
Escopo documento/identidade nativa; colisoes de codigo fora da coorte e auxiliares
continuam pendentes. Postgres administrativo tem BYPASSRLS, NAO leitor restrito
ou permissao homologada de carga. Sem ACL/role/policy/DDL/escrita de negocio.
Binding/plano/resultado/classificado/bundle permanecem privados no diretorio
operational-gates-344-20261026 existente, root0600/pai0700/nosymlink verificados.
Recibo publico agregado344/6635287552; nao publicar registros ou manifesto detalhado.

Primeira carga proposta: MESMOS100 mestres do Grupo CPA, preservando origem,
codigos/IDs/status/vinculos; autorizados operacionalmente0. Usar destino privado
isolado comprovado para ensaio, nao esta previa sintetica ou banco operacional.
current-pilot.json e guardas existentes sao o ponto de inspecao; nao executar
piloto antigo com nova selecao/grupo sintetico como se fosse FINAL100/CPA.
Schema/journals/principal minimo/backup atual/restore/reversao e liberacao especifica
continuam gates. Proposta PUBLIC historica abaixo permanece SUSPENSA, nao aplicar.

## Historico - previa privada da mesma401 disponivel (2026-11-02)

SHA servido b888b2c00eaf571820e0594b96afd45837dc689a; snapshot imutável git archive,
sem trocar branch ou tocar .vscode do checkout b5cb34e1. Porta5173 Private e
listener/HTTP/Chrome comprovados. URL privada autenticada pelo GitHub:
https://potential-xylophone-5gj7r9v9qqg637vxp-5173.app.github.dev/Comercial
Login somente da fixture: entry.synthetic@example.test / synthetic-entry-only.
Banner identifica dados sintéticos; API da fixture canônica e PG17 tmpfs/network
none. NÃO é Supabase operacional nem importação de clientes reais. Configuração
Vite do projeto e test-server canônico via harness privado, não npm dev alegado.

Staging de execução existente: /home/codespace/erp-legado-privado-20261023/
preview401-20261102-ofyvmdh6; checkpoint/recibos privados, original intacto. Dono
do runtime é este executor, foreground Terminal1, TTL6h. Não encerrar processos
alheios. Checkout remoto não sincronizado. Manter durante validação; ao ficar
ocioso encerrar somente runtime/container próprios e parar o Codespace existente.
Não criar outro recurso nem habilitar billing; budget0/Usage blocked preservado.

Ciclo orçamento→Pedido persistiu no PG isolado e reabriu campos em nova sessão;
401/403/teto200 e contagens sem mudança nas leituras. Matriz completa pendente
está no HANDOFF. Contagens Cadastros limitadas por SELECT setores_atividade na
fixture; não fazer grants nem interpretar desconhecido como registro ausente.

WebConsole Hostinger atual: centralização e recovered/receipts/objects disponíveis,
root0700/nosymlink; continuidade histórica2836arquivos/48359509373bytes lida sem
inventário/transferência. Não confundir recibo antigo com rehash atual. Relatório
privado resume-20261102/source-compatibility-b888.private.json comprova100fontes
compatíveis e0duplicidades internas; nenhuma consulta/carga operacional. Próximo
gate: destino/principal/sessão/Grupo comprovados para consulta fixa READONLY/ROLLBACK.
Base44 exige reconexão do proprietário (avisará); não repetir login/listagem.

## Resultado da retomada dos dois originais (2026-11-02)

Budget0/Usage blocked e período novembro conferidos antes de retomar SOMENTE o
Codespace existente; nenhuma cobrança habilitada. Terminal funcional, HEADb5cb34e1
na branch342,??.vscode/ preservado e nenhum pull/reset. App-server da extensão
fora do checkout não é codex exec. Os dois caminhos abaixo existem, owner1000,
sem symlink; FINAL348850 bytes0600 e harness9953 bytes0644 com ancestrais0700.
outputSha256 do FINAL confrontado exatamente com source-cohort-100-summary.private.log,
PASS. Hash atual do harness calculado e bytes preservados; pin HISTÓRICO do arquivo
não encontrado na busca única dos recibos pertinentes, não presumir equivalência.

Cópias novas exclusivas e checkpoint em resume-20261102 sob a base privada,
diretório0700/arquivos0600, origem=destino conferidos sem expor registros ou pins
vinculáveis. Fontes originais intactas. Trava própria mkdir exclusivo liberada
em finally; leituras de destino0/escritas negócio0/carga0. Recibo344/6580544004.
Não repetir inventário/transferência ou nova seleção. Fonte ausente/franquia
não comprovada deixaram de ser os bloqueios atuais.

O harness ORIGINAL fixa branch codex/consolidacao-infra-20261017 e recibos de
identity-preview-20261028. A candidata aceita dirigida é401/57479b67, outra branch.
Não remover guards nem rodar snapshot antigo como prova dela. Coordenação direta
401/6580502544: preparar execução por snapshot imutável da MESMA401 com sourceSha
e recibos novos exclusivos, preservando o original; obter eventual pin histórico.
Só então comprovar cadeia browser→API→PostgreSQL com fixture sintética, rede none,
porta Private e teardown próprios. Montagem React acima de WindowManager passou,
mas não substitui esse ciclo. SQL operacional continua dependente de principal,
sessão, destino/Grupo e autorização atuais, além do pin da fonte recuperada.

## Roteiro preservado — recuperação dos originais (2026-10-31)

Preparacao, NAO franquia liberada ou tarefa agendada. Em01/11 conferir na conta
GitHub a franquia efetiva e orcamento zero antes de iniciar SOMENTE o Codespace
potential-xylophone-5gj7r9v9qqg637vxp. Nao habilitar cobranca, alterar budget,
criar outro ou presumir liberacao pela data. Se continuar bloqueado, registrar
a mensagem e parar essa frente sem repetir buscas/inventarios ou usar VPS como
laboratorio. Desenvolvimento/revisao continuam no checkout desktop existente.

1. No Codespace retomado, conferir cwd/origin sanitizado/branch/HEAD/status/
   processos/trava contra GitHub atual; preservar qualquer WIP desconhecido.
   Nao resetar nem atualizar sobre outro escritor. Nao confundir sourceSha
   do harness original com HEAD candidato atual.
2. Recuperar APENAS os dois caminhos privados ja documentados sob
   /home/codespace/erp-legado-privado-20261023:
   - decision-20261026/source-cohort-100-6ba10732.private.json (arquivo FINAL);
   - decision-20261026/resume-20261028/browser-harness.mjs (harness ORIGINAL).
   stat/lstat desses paths exatos e ancestrais: dono, modo, ausencia de symlink,
   tamanho/data; nenhum novo inventario do backup/HD. Ausencia ou arquivo diverso
   bloqueiam essa recuperacao, nao autorizam gerador/recibo/reselecao.
3. Antes de exportar bytes, conferir origem/versao e pins privados existentes.
   Comparar SHA256 do arquivo FINAL com outputSha256 contemporaneo; cohortSha256
   (selecao) e stagingArtifactSha256 (entrada) NAO substituem esse pin. Se faltar
   esse confronto, manter desconhecido/bloqueado, sem reconstruir a coorte.
   Harness exige seu proprio sourceSha/tamanho/hash e guardas, nao hash de recibo.
4. Usar somente canal autenticado existente para copiar esses bytes e pins para
   diretorio privado aprovado FORA Git/build/preview/CI. Conferir SHA256 e bytes
   origem=destino e ACL efetiva local (NTFS nao comprova owner/mode POSIX).
   Nao sobrescrever exemplar divergente nem publicar registros/pins vinculaveis.
   Fonte original preservada; recibo publico somente agregado/sanitizado.
5. Harness recuperado e validado segue o comando existente nesta secao operacional,
   sem retirar guardas de Codespace/origin/branch/SHA. Antes de executar, comprovar
   Node22, ausencia de dono alheio5173 e recursos sinteticos isolados. Conferir
   /__erp_fixture (sourceSha,synthetic,operationalDatabase=false), /__erp_preview
   (SHA candidato executado), encaminhamento Private e sessao somente sintetica.
   Provar cliente->preco/condicao->orcamento salvar/reabrir/editar->Pedido/historico,
   concorrencia/contexto/permissao/gravação unica/auditoria/rollback; teardown
   somente dos recursos proprios. Montagem React isolada nao substitui esse ciclo.
6. Coorte recuperada nao autoriza carga. Consulta fixa ja existente somente com
   destino/ator/Grupo/empresas e leitura especificamente comprovados: ate100,
   colunas allowlist, REPEATABLE READ READ ONLY, timeouts vigentes e ROLLBACK;
   saida privada e reconciliacao sem escolher duplicata ou promover historico.
   Clientes/fornecedores/produtos preservam nomes/codigos/IDs/status/vinculos/
   procedencia; titulos/saldos/fiscal dependem de prova, sem Empresa por palpite.
   Gates schema/privilégios/backup/restore/carga/deploy permanecem separados.

## Orientacao vigente de continuidade e reconciliacao (2026-10-29)

Consulta fixa preparada no modulo scripts/legado/pilot-functional-load-plan.mjs,
sem conectar ou executar automaticamente. Exige SHA dos bytes e da coorte,
identidade do destino e Grupo/empresas aprovados. Ate100 identidades por documento
validado OU par nativo;20 colunas declaradas e contagens de referencias restritas,
sem LIMIT1/SELECT amplo. Resultado ambiguo/procedencia divergente permanece bloqueado.
READ ONLY/REPEATABLE READ, search_path pg_catalog, limites de tempo e ROLLBACK.

Alternativas: A) executor administrativo existente com SELECT fixo, revisado e
autorizado, saida privada0600/hash e somente contagens publicas; sem delegar LOGIN
ou SQL arbitrario. O principal permanece privilegiado, nao e leitor homologado.
B) confronto isolado somente com identidade e atualidade comprovadas; restore
historico nao comprova destino atual. C) novo leitor com mudancas globais PUBLIC
permanece suspenso; nao aplicar por inercia autorizacoes condicionais anteriores.

Evidencia historica reutilizada (28/10): conexao SQL existente real, metadados em transacao somente
leitura e rollback; Grupo aprovado1/empresas2, zero linhas de clientes consultadas.
Protecao e capacidade do diretorio privado conferidas, sem novos arquivos na VPS.
Artefato congelado100 nao localizado na busca limitada; recuperar apenas esse
artefato/pins, nao repetir backup/transferencia/inventario completo. A execucao da
consulta de negocio continua pendente da fonte e do escopo autorizado concreto.

Desenvolvimento temporario no clone desktop independente existente, sem usar raiz
antiga/HD; GitHub canonico e Codespace unico reservado a validacao integrada quando
houver franquia. Nunca presumir que arquivos/chaves privados do Codespace existem
na estacao. Preservar ambos antes de sincronizar, um escritor por checkout.
Detalhes e lista unica no STATUS/HANDOFF; sem outro manual/plano operacional.

A proposta PUBLIC abaixo e HISTORICA/SUSPENSA pela decisao posterior do dono, nao
uma fila para aplicar grants. Nenhuma ACL/role/policy foi alterada no DEV. Preferir
para decisao consulta/exportacao FIXA no console administrativo existente: sem
delegacao SQL arbitraria ou novo LOGIN, somente CPA/empresas/coorte100 fixados em
recibos privados, colunas allowlisted, sem LIMIT1 em documento ambiguo, transacao
REPEATABLE READ READ ONLY, timeouts, ROLLBACK e saida0600/hash privada. Privilegio do
executor nao e prova de isolamento; escopo do SQL e ausencia de escrita exigem
ensaio/revisao. Leitura de negocio exige fonte, canal e escopo autorizado comprovados;
nao presumir essas condicoes pela publicacao do codigo ou pelo recibo de preparacao.
Nao herdar permissao de metadados como autorizacao de exportar clientes.

Copia isolada e alternativa somente com identidade/schema/frescor comprovados e
extracao minima; nao repetir restore inteiro por conveniencia. Novo LOGIN no alvo
nao e a opcao minima diante de PUBLIC e bancos adicionais. Sem alterar PUBLIC/API,
HBA/rede, conceder sudo/docker ou executar carga para contornar indisponibilidade.
As autorizações especificas SSH anteriores permanecem, sem copiar chave pessoal.

### Gate vigente do executor: publicacao funcional encerrada (2026-10-29)

Os dois checks POSIX estao encerrados:12PASS/0FAIL/0SKIP, inclusive overlay conferido.
O transporte e o fechamento do snapshot WIP13 tambem terminaram: recibo421/6505560893,
arvore266b1ebf,9/9checks sob dependencias do lock; raiz2419PASS e backend565PASS/0FAIL/
26SKIP. Codigo funcional publicado na342 em87db6618cb3d6198ecdc185cc59d8ca48eeafa83,
CI5265SUCCESS. Os26skips nao sao aprovacao PostgreSQL/browser ou liberacao operacional.
Nao repetir WSL, transporte, preparacao do bundle ou diagnostico antigo de dependencias.

A restricao GitHub/npm pertencia ao primeiro executor Linux; nao contorna-la nem
apresenta-la como capacidade de outro executor. A validacao completa usou o executor
permitido, com deps proprias descartaveis, sem alterar locks, fontes, seguranca ou VPS.
Recibos/hashes e limites no STATUS/HANDOFF; nova composicao exige seu proprio SHA/CI.
Nao executar migrador geral, usar dados reais ou escrever checkout alheio. Nao
confundir demo writes0, callbacks/PGlite, HTTP/PostgreSQL e prova no navegador.

Para o ensaio integrado, verificar capacidade nativa PostgreSQL/Chrome e harness
existentes antes de concluir a partir de NO_DOCKER/porta fechada. Nao iniciar servico
operacional, criar usuario Auth DEV, senha persistente, grants ou acesso VPS para testar.
O harness privado documentado abaixo conserva guardas de ambiente/origin/SHA; nao
afrouxa-las ou criar implementacao paralela para contornar arquivo indisponivel.
Os procedimentos de instalacao abaixo sao HISTORICOS, nao a fila desta etapa.
Artefatos/dados privados continuam fora de Git/build; somente codigo sanitizado foi
publicado. Nao copiar historico Git, chaves ou credenciais indiscriminadamente.

### Historico do gate desktop antes da prova Linux, sem mudar a VPS

RETIFICACAO VIGENTE29/10: mapeamento Get-Partition -> Get-Disk comprovou C no disco0
NVMe ADATA interno/de boot e D no disco1 JMicron USB externo. A orientacao anterior
de instalar WSL em D foi RETIRADA; capacidade livre nao comprova disco interno.
Nao instalar distribuicao/componentes em D nem usar o backup como destino. Os
artefatos sinteticos ja existentes em ERP-Validacao-Temporaria foram somente
conferidos por hash nesta retomada; nao mover/apagar nem alterar o backup.
C tem ~854MB livres nesta leitura, insuficiente para iniciar preparacao segura.
Executor continua sem elevacao e nenhum Linux instalado; nenhuma instalacao,
limpeza, elevacao ou reinicio foi tentado.
Com as capacidades efetivamente disponiveis, o caminho sem instalacao e retomar
o MESMO Codespace quando a franquia permitir e conferir o bloqueio de gasto antes
de iniciar. Para antecipar localmente, usar exclusivamente o procedimento humano
condicionado abaixo. Nao usar VPS operacional, D externo ou outro ambiente ERP.

Atualizacao posterior29/10 - pacote minimo pronto, NAO executado em Linux:
- WIP preservado em patch privado,14 arquivos pendentes apos commit documental.
- Checks exatos: tests/legado-filesystem-precheck.test.js, teste "private staging
  precheck uses real synthetic filesystem metadata only" (seis asserts Python de
  capacidade/host/escopo/symlink/modes/ausenciaGit); e
  tests/legado-review-workflow.test.js, teste "recibos existentes geram revisao
  privada sem reexecutar piloto; linha inconsistente fica isolada" (getuid/owner/
  mode700 e arquivos600 reais, sem mock de identidade).
- Preflight atual: WSL/Store ausentes, Docker/Podman nao disponiveis e executor sem
  administrador; C~3.6GB/D~239GB disponiveis. HypervisorPresent=true; indicadores
  WMI de firmware/SLAT falsos nao bastam para exigir alteracao de BIOS. Nao mudar
  BIOS/politicas/elevacao por tentativa. Nenhum runtime Linux comprovado.
- Bundle de TESTE sintetico fora do checkout,48 arquivos fonte/dependencias e
  manifesto,71487bytes comprimidos. SHA256
  0c6173abd166519b11f1a269f9b0edad4fdd8a4c8b2101d1fcfb407e919c125b.
  Arquivo posix-checks-wip-30b1b619-20261029.tar.gz no diretorio temporario de
  validacao local.49 entradas verificadas por tamanho/SHA contra manifesto e
  fontes; nenhum arquivo extra/dado real/chave/.env/node_modules.11JS passaram
  node --check, NAO contam como teste POSIX aprovado. Mesmas assertions do WIP.
  Nao exige npm install/rede/banco; SQLs automaticos sao somente evidencia de
  leitura do teste, nao executar migrador. Nao e novo clone/ERP/implementacao.

Intervencao humana unica: TI/proprietario disponibilizar WSL no SSD INTERNO, primeiro
garantindo capacidade suficiente em C por procedimento aprovado (sem apagar/mover
backup ou limpeza destrutiva), depois abrir PowerShell como administrador e preservar
sessoes/aplicacoes antes de reinicio. Comandos abaixo NAO devem ser executados com
o espaco atual. Procedimento Microsoft, sem contratar recursos:

```powershell
wsl --install --no-distribution
# Reinicio somente em janela segura pelo proprietario, caso exigido.
wsl --install --distribution Ubuntu --location C:\WSL\ERP-Checks --no-launch
```

Se o bootstrap instalado nao aceitar --location, parar e consultar --help/versao;
nao cair para instalacao automatica em outro volume. Configuracao do usuario
Linux e eventual credencial ocorrem localmente, nunca no chat/Git. Nao foram
executados instalacao, elevacao, reinicio, alteracao de configuracao ou cobranca.
Alternativa continua o MESMO Codespace quando a franquia permitir, nao outro.

Com Node>=22/Python3 reais ja disponiveis no Linux, conferir SHA do bundle ANTES
de extrair. Executar em filesystem Linux nativo, nao pasta montada NTFS:

```bash
umask 077
checkdir=$(mktemp -d "$HOME/erp-posix-30b1.XXXXXX")
mkdir "$checkdir/repo" "$checkdir/tmp"
# BUNDLE aponta ao arquivo privado cuja soma acima foi conferida.
tar -xzf "$BUNDLE" -C "$checkdir/repo" --no-same-owner
cd "$checkdir/repo"
TMPDIR="$checkdir/tmp" TEST_PYTHON_EXECUTABLE="$(command -v python3)" \
  node --test --test-concurrency=1 tests/legado-filesystem-precheck.test.js tests/legado-review-workflow.test.js
```

Registrar versoes, UID, filesystem, hashes e resumo PASS/FAIL/SKIP real. Nao chamar
esse gate de aprovado antes da execucao. Depois fechar validacoes proporcionais da
secao16 do AGENTS sobre snapshot completo do MESMO WIP; dois testes isolados nao
dispensam fechamento nem autorizam carga/deploy. Um escritor no checkout canonico.

Delta posterior no WIP do classificador: contadores inconsistentes agora rejeitados,
sem mudar SQL/identidades/escopo. Bundle acima e imutavel e ANTERIOR ao delta; nao
reescrever/reempacotar seu exemplar nem atribuir sua prova ao WIP posterior.
Overlay privado identifica modulo antigo SHA65900aac8f750bf8970267859d918c2c047ef4476f3600d35fa9036c857b78e3
e novo SHAaa34f125e505dd2a9c7045a7ece029dc1d4badc092d3e8c3b938787fb9c671f7;
reconstrucao em memoria bateu exatamente com fonte atual, nenhuma execucaoLinux.
Aplicacao so em extracao descartavel, preservando pins/delta e registrando etapa
separada; novo teste SQL com as cinco negativas nao integra o bundle minimo e
exige snapshot completo atual no fechamento. Nao encurtar a validacao por inferencia.

Rastreio privado restrito encontrou gerador/recibo de preparacao26/10, nao arquivo
final nem outputSha256 contemporaneo. stagingArtifactSha256 (input), cohortSha256
(selecao) e outputSha256 (arquivo final) sao tres pins diferentes. Gerador contendo
o comando nao prova execucao/exemplar; nao executar de novo para substituir o
congelado por outra selecao ou apresentar backup23/10 como sua recuperacao.

Atualizacao29/10: WIP inicial conferiu o mesmo SHA256 do patch privado anterior,
sem sincronizar o checkout. Codespace unico recusou retomada com a mensagem
"You are out of monthly free usage or have exceeded your budget for Codespaces";
nenhum aumento de orcamento ou novo ambiente. WSL --list --quiet exit1 confirma
WSL ausente; executor Windows sem elevacao administrativa. C~706MB livres e D~239GB;
isso nao libera instalar no C, apagar arquivos ou usar a VPS para desenvolvimento.
Para antecipar os checks antes da renovacao da franquia, intervencao local minima:
administrador preparar WSL conforme https://learn.microsoft.com/windows/wsl/install,
preservando sessoes/trabalho antes do reinicio exigido. A referencia oficial
https://learn.microsoft.com/windows/wsl/basic-commands suporta --location para
escolher diretorio somente apos provar volume interno/capacidade. A indicacao
anterior de D foi retirada pelo mapeamento fisico posterior acima: D e USB externo.
Nao foi executada instalacao/elevacao/reinicio. Apos disponibilizar Linux, conferir
Node/Python e executar os dois testes reais em filesystem Linux com owner/mode/
symlinks reais; montar NTFS ou simular getuid nao substitui essa prova. Usar snapshot
de teste sanitizado com hashes do WIP, nao criar outra frente de implementacao.

Artefato de selecao100: busca exata adicional somente em ERP-Integracao-Privada
desktop retornou zero. Copia centralizada23/10 antecede a selecao26/10; nao declarar
que contem essa selecao posterior nem recria-la a partir do backup. Fonte registrada
continua o arquivo privado decision-20261026/source-cohort-100-6ba10732.private.json
do Codespace existente. Retomada bloqueada impede conferir/exportar esse arquivo;
nenhum dado real recuperado nesta tentativa. Quando retomar pelo canal suportado,
exportar SOMENTE esse arquivo fora do Git, conferir coorte congelada e registrar SHA
dos bytes na origem e no destino privado; nao tratar o SHA da coorte como SHA do
arquivo. Nao repetir transferencia integral ou considerar destino vazio.

Em28/10 o clone desktop foi atualizado por fast-forward para b5cb34e1, preservando
o Codespace bloqueado. Python3 real do bundle local foi comprovado; forneca o seu
caminho absoluto em TEST_PYTHON_EXECUTABLE somente no processo de teste, nao em
codigo/config global. WindowsStore python/python3 nao comprovam runtime instalado.
As contraprovas literais exigem checkout LF conforme .gitattributes; nao mudar os
18hashes historicos ou o remainder para aceitar alteracoes fora de escopo.
Parser de mounts Docker interpreta paths POSIX independentemente do SO do agente.

Owner/mode/symlinks POSIX da revisao privada NAO foram homologados em NTFS: nao
simular getuid, remover assertions ou copiar dados reais para testes. WSL --list
comprovou que nao esta instalado; C tem ~0.2GB livres, insuficiente para preparar
uma distribuicao. Nao instalar/apagar/mover backups por inferencia. Opcao local
gratuita exige espaco e preparacao WSL aprovada (procedimento Microsoft:
https://learn.microsoft.com/windows/wsl/install), admin/reinicio e setup humano
quando necessario; nao cria outro clone/ERP ou libera credenciais. Alternativa e
retomar o Codespace unico apos franquia, conciliando/preservando primeiro o WIP.
Sem runtime POSIX, manter BLOQUEADO o fechamento deste lote; VPS nao e substituto
automatico de desenvolvimento e nenhuma role/DDL/carga acompanha essa decisao.

### Atualizacao de validacao condicional (2026-10-28)

Assinaturas confirmadas no catalogo DEV com PUBLIC EXECUTE: lo_creat(integer),
lo_create(oid), lo_from_bytea(oid,bytea), lo_open(oid,integer),
lo_put(oid,bigint,bytea), lo_truncate(integer,integer),
lo_truncate64(integer,bigint), lo_unlink(oid), lowrite(integer,bytea).
Nao executar contraprova mutante no DEV; a reproducao foi apenas sintetica/rollback.
Complemento: PUBLIC nao tem CREATE no schema public, mas CONNECT e efetivo em seis
bancos. Uma role sem memberships continua recebendo PUBLIC; revogar somente da
role nao basta. Nenhuma alteracao PUBLIC ou acesso a registros desses bancos foi feito.
Extensao candidata, fora da autorizacao atual: snapshot ACL/matriz efetiva das31roles,
substituir somente PUBLIC EXECUTE das nove assinaturas por concessoes equivalentes
as roles existentes e excluir o novo leitor; restringir CONNECT fora do destino
aprovado sem reduzir capacidades atuais. Exige avaliar futuras roles/memberships,
grantors/opcoes e outras vias antes de definir o patch final e pedir sua aplicacao.
Sem CASCADE, DROP OWNED, mudanca HBA/rede, senha administrativa ou grants por inferencia.
Ensaio com SET SESSION AUTHORIZATION e ACL simulada nao substitui LOGIN autenticado.

A autorizacao posterior cobre leitor temporario por ate 1h e as cinco policies,
SOMENTE apos ensaio/revisao. O ensaio detectou PUBLIC EXECUTE capaz de criar/escrever
large objects, reproduzido apenas no PG sintetico e revertido. Catalogo DEV confirmou
nove assinaturas com PUBLIC EXECUTE; nenhuma funcao de mutacao executada no DEV.
O patch abaixo esta BLOQUEADO: nao aplicar nem declarar o principal somente leitor.
Extensao ACL separada exige snapshot original (inclusive NULL, grantors/grant options),
matriz efetiva das 31 roles, preservacao/reversao e inventario de outras vias de escrita
/bancos/EXECUTE. REVOKE individual nao nega PUBLIC. Alterar PUBLIC e conceder grants
diretos para preservar roles existentes altera semantica futura e exige nova decisao.
Nenhuma alteracao PUBLIC/role API/DB/negocio foi feita. Detalhes no STATUS/HANDOFF;
recibos e comandos sinteticos privados preservados. Auth LOGIN real continua sem prova.

## Gate SQL de reconciliacao100 - proposta NAO APLICADA (2026-10-28)

SSH dedicado ja comprovado; nao reprovisionar. Inspecao administrativa de catalogos
confirmou API DEV com conexao interna ao mesmo PostgreSQL; nenhum cliente lido.
31 roles/10 LOGIN, 6 LOGIN sem super/BYPASSRLS e todas sem SELECT em clientes.
A role read_only global tem BYPASSRLS: recusada. RLS/FORCE das quatro tabelas
necessarias estao ativos, mas sem policies. groups tambem tem RLS/FORCE.
A consulta administrativa a pg_hba_file_rules foi negada: nao ampliar privilegios.
O canal local para um NOVO principal ainda exige prova; nao alterar HBA/rede por tentativa.

### Decisao unica proposta

Autorizar SOMENTE a preparacao/revisao e, em janela especifica, criacao temporaria
do leitor abaixo e de suas policies SELECT dedicadas, apos ensaio isolado e pins
privados de destino, CPA, empresas e coorte. NAO e autorizacao vigente para executar.
Nao mudar a role API, roles existentes, memberships, policies existentes ou PUBLIC.
Sem migrations gerais, porta PG publica, sudo/docker delegado ou carga.

Contrato exato do patch candidato (psql; variaveis SEM valores reais no Git):
- reader_expiry: timestamp absoluto de janela maxima de 1h aprovada; nao herdar o prazo SSH.
- cpa_group_id, company_ids e cohort_docs: valores do binding e manifesto privado
  existentes, conferidos e hasheados; exatamente 100 documentos normalizados distintos.
- Nenhum segredo em argv/historico/Git/log. Se autenticacao local existente exigir
  segredo, credencial efemera exclusivamente em arquivo privado 0600 do executor
  administrativo; nao copiar para a conta SSH. Nao gerar antes da aprovacao.


a) Role e privilegios candidatos, dentro de uma transacao administrativa:


definicao: CREATE ROLE erp_legado_reconcile_344_ro LOGIN NOSUPERUSER NOBYPASSRLS
NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 1
VALID UNTIL :'reader_expiry';
GRANT CONNECT ON DATABASE postgres TO erp_legado_reconcile_344_ro;
GRANT USAGE ON SCHEMA public TO erp_legado_reconcile_344_ro;
GRANT SELECT (id,group_id,empresa_id,codigo,tipo,documento,documento_normalizado,
nome,razao_social,nome_fantasia,nome_social,inscricao_estadual,inscricao_municipal,
telefone_principal,email,telefone,celular,status,origem,codigo_legado,legacy_id,
legacy_code,source_system,migration_batch,observacoes,ativo,created_at,updated_at)
ON public.clientes TO erp_legado_reconcile_344_ro;
GRANT SELECT (id,group_id,cliente_id,empresa_id,ativo,situacao_comercial,
habilitado_operacao,bloqueado,motivo_bloqueio,origem,legacy_id,legacy_code,
source_system,migration_batch,created_at,updated_at)
ON public.cliente_empresas TO erp_legado_reconcile_344_ro;
GRANT SELECT (id,group_id,cliente_id,nome,cep,logradouro,numero,complemento,
bairro,cidade,uf,pais,endereco_incompleto,endereco_fingerprint,ativo,origem,
legacy_id,legacy_code,source_system,migration_batch,created_at,updated_at)
ON public.cliente_locais TO erp_legado_reconcile_344_ro;
GRANT SELECT (id,group_id,razao_social,nome_fantasia,status)
ON public.empresas TO erp_legado_reconcile_344_ro;
GRANT SELECT (id,nome_do_grupo,razao_social_grupo,status)
ON public.groups TO erp_legado_reconcile_344_ro;

b) Policies candidatas: cinco policies FOR SELECT TO erp_legado_reconcile_344_ro,
com nomes exclusivos reconcile344_ro_<tabela>. Predicados fixados no DDL, NAO em
GUC que o leitor possa adulterar:
- clientes: group_id = :'cpa_group_id'::uuid AND
  documento_normalizado = ANY(:'cohort_docs'::text[]).
- cliente_empresas: group_id = CPA AND empresa_id = ANY(company_ids::uuid[])
  AND cliente_id IN (SELECT id FROM public.clientes).
- cliente_locais: group_id = CPA AND cliente_id IN (SELECT id FROM public.clientes).
- empresas: group_id = CPA AND id = ANY(company_ids::uuid[]).
- groups: id = CPA.
Nao filtrar ativo: preservar historicos e detectar referencias inativas; isto nao
libera escrita ou operacao comercial. Nao conceder SELECT em profiles ou outras tabelas.
As referencias CPA/company_ids acima representam literais privados validados,
nao nomes comerciais inferidos. O gerador deve recusar placeholders/contagem divergente.

c) Antes de COMMIT/liberacao, abortar se houver membership/SET ROLE alcancavel,
SUPER/BYPASSRLS/ownership, CREATE de schema, DML/sequence ou EXECUTE mutante relevante
herdado de PUBLIC. As quatro funcoes SECURITY DEFINER de schemas nao-sistema
observadas nao tinham USAGE/EXECUTE PUBLIC; refazer apenas se ACL/DDL mudar.
Nao tentar corrigir grant PUBLIC global por conveniencia: apresentar impacto separado.
Ensaio isolado deve provar negativas cross-Grupo/empresa/coorte, DML/DDL/funcoes,
revogacao, falha intermediaria e identidade current_user=session_user=leitor.

d) Canal escolhido: console administrativo existente -> docker exec no DB existente
-> psql -X -v ON_ERROR_STOP=1 -U erp_legado_reconcile_344_ro -d postgres,
SEM SET ROLE de administrador. Falha de autenticacao local bloqueia, nao autoriza
mudar HBA. Execucao restrita ao SQL revisado, saida detalhada privada 0600.
Validar sessao da aplicacao e binding CPA pelo fluxo autorizado; nao impersonar usuario.
Consulta de documentos limitada a coorte, REPEATABLE READ READ ONLY, timeout e ROLLBACK.
So contagens/categorias sanitizadas no Git. Ausencia de leitura NAO significa destino vazio.

e) Reversao exata: bloquear LOGIN, encerrar somente sessoes desse leitor, revogar
seus SELECT/USAGE/CONNECT, remover somente as cinco policies reconcile344_ro_*
e a role dedicada apos confirmar dependencias. Nao usar DROP OWNED ou remover
policies/grants anteriores. Confirmar roles/policies preexistentes inalteradas.
Nenhuma autorizacao de importacao operacional, deploy ou mudanca da API acompanha o gate.

## Prioridade e separacao vigentes (2026-10-26)

A entrada em uso segue PLANO_GO_LIVE.md; lista unica no topo de
STATUS_DO_PROJETO.md. VPS recebe somente versao especificamente aprovada;
Codespace existente concentra evolucao/testes, GitHub o codigo/historico e
armazenamento privado os dados/backups. Os dados da VPS DEV descritos abaixo
nao comprovam producao homologada. Preparar nao autoriza executar o fluxo de
promocao, alterar permissoes/schema, importar ou substituir o par atual.


## Fontes de verdade

- GitHub `viniciuszuccaro-creator/ERP-Zuccaro-codeX`: código e histórico Git.
- VPS DEV: estado operacional do ambiente em Docker.
- PostgreSQL DEV: migrations e dados sintéticos reais.
- PR e CI: revisão e gates de código; não substituem os gates PostgreSQL reais.

## Ferramentas e precheck

Codex e Cursor são intercambiáveis. Cada workspace é descartável e deve nascer
ou sincronizar do repositório canônico. Antes de editar, confirmar repositório,
branch, HEAD e `git status`; depois ler este documento, `HANDOFF_ATUAL.md` e
os documentos do runtime relacionado.

Se GitHub, workspace, VPS ou handoff divergirem, parar e diagnosticar. Não
resetar, fazer force-push, reaplicar migration, recriar container ou corrigir
silenciosamente.

## Fluxo normal

```text
branch → implementação/testes → push → PR draft → CI/review/hardening
→ precheck VPS → backup → migration autorizada → PostgreSQL real/E2E
→ pre-merge → merge → build da main → canário da main → promoção 3080
→ restart gate → pós-promoção → fechamento
```

Merge não é promoção. Migration não é promoção. CI local não substitui
PostgreSQL real. Frontend não substitui segurança. Documentação não é
autorização operacional.

## VPS DEV

- Hostname Hostinger: `srv1982741`.
- Domínios: `https://erp-dev.cpaferroeaco.com.br/` (SPA + same-origin `/api`) · `api-erp-dev` quando aplicável.
- Raiz: `/opt/erp-zuccaro`.
- Compose: `docker-compose.erp.yml` · env na VPS: `.env.erp.dev` (nunca no Git).
- PostgreSQL Docker: `supabase-db`.
- API oficial: `erp-api-dev` · bind `127.0.0.1:3080`.
- SPA oficial: `erp-web-dev` · bind `127.0.0.1:3081`.
- Rede Docker observada em operação: `supabase_default` (revalidar no precheck; não presumir se divergir).
- Backups: `/opt/erp-zuccaro/backups` (arquivos reais só na VPS; no Git só path/bytes/sha256 sanitizados em `docs/vps/evidence/`).

A rede Docker deve ser consultada na configuração existente durante uma tarefa
VPS autorizada; não deve ser presumida. Não documentar senhas, tokens, arquivos
de ambiente, cookies, dados de clientes, chave privada SSH nem IP público desnecessário.

## Acesso operacional Cursor / Codex (canônico)

### Codespace Codex — acesso dedicado aprovado, prazo vigente

Aprovado pelo proprietário em28/10/2026: provisionar somente usuário novo `erp-codex-ro`, sem sudo/docker, senha bloqueada, chave dedicada com `restrict,expiry-time="20261227T235900Z"`. Chave válida até27/12/2026 às20:59 America/Sao_Paulo; conta expira28/12/2026; revogar antecipadamente ao concluir a frente. Isto substitui os prazos30/10 e31/10 dos blocos históricos. Não autoriza privilégios administrativos ao Codex, alteração de chaves atuais, sshd/firewall, carga, DDL, grants ou deploy. Conta existente exige inspeção de procedência/configuração, nunca sobrescrita.

Chave local exclusiva já preparada, não gerar outra: diretório privado0700 `/home/codespace/erp-legado-privado-20261023/access-codex-readonly-20261028`; `id_ed25519`0600 permanece somente local. Fingerprint CLIENTE público: `SHA256:D+z9tzBoEVkhLfmUwWOunGGUpC05vPLm2m3vYMPTELI`. Não é identidade HOST. Nenhum envio de credenciais ao chat/GitHub; nesta etapa usar arquivo privado existente, sem exigir Runtime Secrets nem upload de secrets. Os nomes ERP_CODEX_VPS_* dos registros históricos não indicam valores efetivamente disponíveis.

#### Procedimento administrativo humano único — bloco e recepção atômica

Prazo conferido com autorização original: chave20261227T235900Z (27/12/2026 20:59 Brasília), conta28/12. Script original privado `server-provisioning.PROPOSED.sh`, diretório `/home/codespace/erp-legado-privado-20261023/access-codex-readonly-20261028`. A versão anterior está preservada em server-provisioning.before-public-receipt.sh; mesma chave/usuário/alcance aprovados. Extensão apenas para validar endpoint/porta e emitir recibo público. Conta existente continua condição de inspeção/aborto, sem sobrescrever; mostra id, status, expiração, ownership/permissões e fingerprints públicos quando acessíveis. Procedência que esses metadados não comprovem permanece pendente de revisão, não presumida.

1. No editor do Codespace, Ctrl+P → colar `/home/codespace/erp-legado-privado-20261023/access-codex-readonly-20261028/web-console-approved.block.sh` → Enter. Ctrl+A/Ctrl+C copia o BLOCO completo. Este arquivo envolve o script aprovado num heredoc para colagem segura; não é outro provisionador. Não copiar id_ed25519. Não executar esse bloco no Codespace.
2. [hPanel](https://hpanel.hostinger.com) → VPS → srv1982741 → Terminal do navegador, usando autenticação administrativa somente nesse console confiável. Conferir servidor/endereço no painel. Na barra lateral, Clipboard permite colar o bloco completo (inicia sh << e termina ERP_CODEX_APPROVED_CONSOLE). Informar no próprio console o endereço SSH DIRETO confirmado no painel (sem usuário/URL) e a porta efetiva. O script confirma listener sshd/systemd nessa porta, sem mudar sshd/firewall. Não presume domínio web como endpoint SSH nem porta22. Guia: [Hostinger](https://www.hostinger.com/br/support/7978544-como-usar-o-terminal-do-navegador/).
3. Resultado esperado: id somente grupo dedicado, senha L, expiração28/12, fingerprint CLIENTE D+z9tzBoEVkhLfmUwWOunGGUpC05vPLm2m3vYMPTELI, fingerprint HOST separado e PROVISIONED. STOP significa parar e devolver somente motivo sanitizado, sem repetir criação. Script não lê dados de negócio, env, backups ou credenciais. Se falhar depois da criação, expira/bloqueia somente conta nova.
4. O console imprime BEGIN_ERP_PUBLIC_HOST_RECEIPT, um JSON e END_ERP_PUBLIC_HOST_RECEIPT. Copiar SOMENTE o JSON, incluindo chaves, diretamente dessa sessão confiável. No Codespace Ctrl+N → colar → Salvar como `/home/codespace/erp-legado-privado-20261023/access-codex-readonly-20261028/host-console-receipt.incoming.json`. Isso transfere somente host público, porta, chave HOST pública e fingerprint; nada de chave privada/senha/token no chat. Canal efetivamente disponível: editor do Codespace e clipboard da Web Console. Cliente sftp existe mas nenhuma sessão SFTP autenticada foi comprovada; FileZilla não encontrado no executor e computador do proprietário inacessível. Não propor SFTP como primeira prova SSH circular nem presumir FileZilla.
5. Avisar apenas “recibo salvo” ou motivo STOP. Codex executa o receptor privado existente neste lote: `python3 /home/codespace/erp-legado-privado-20261023/access-codex-readonly-20261028/accept-host-console.py --from-authenticated-console`. Flag registra a procedência humana, não cria confiança por si. Receptor recusa server/alias/endpoint/porta inválidos, chave CLIENTE tratada como HOST, fingerprint divergente, permissões inseguras e vínculo existente diferente. Diretório0700/arquivos0600, temporários no mesmo filesystem, fsync/rename atômico por arquivo e configuração publicada por último. Instala `known_hosts.verified` e `ssh_config.verified`; não substitui vínculos existentes divergentes nem altera ~/.ssh/config. Comprovação de origem depende da captura no console confiável, não do hash sozinho.
6. Alias fixo `erp-dev-vps-canonical` nas duas pontas: campo known_hosts e HostKeyAlias. Com HostKeyAlias explícito OpenSSH usa esse alias LITERAL, mesmo em porta não padrão; Port seleciona a conexão separadamente. Não acrescentar automaticamente [alias]:porta. Implementação primária: [OpenSSH get_hostfile_hostname_ipaddr](https://github.com/openssh/openssh-portable/blob/master/sshconnect.c). Receptor verifica ssh -G com endpoint/porta/HostKeyAlias/UserKnownHostsFile efetivos. HostKeyAlgorithms=ssh-ed25519; StrictHostKeyChecking=yes; GlobalKnownHostsFile=/dev/null; sem KnownHostsCommand, DNS trust, proxy, multiplexação, senha ou agent forwarding. Comparar fingerprint calculado com o exibido no console confiável. Conectar somente com `ssh -F /home/codespace/erp-legado-privado-20261023/access-codex-readonly-20261028/ssh_config.verified erp-codex-ro-dev` depois dessas validações. Não usar ssh-keyscan/accept-new para estabelecer confiança.
7. Codex assume autenticação dedicada, hostname/versão, grupos e restrições/expiração, política sudo e recibos sanitizados, sem dados de negócio até comprovar principal SQL EXISTENTE estritamente leitor, ACL/RLS/memberships, sessão e Grupo CPA em contexto explícito. READ ONLY+ROLLBACK são adicionais; shell/restrict não são sandbox. Se sudo -n -l exigir senha, isso sozinho não prova ausência de sudo: preservar inspeção administrativa/root do provisionamento ou marcar inconclusivo. Não adicionar sudo/docker, abrir env ou criar grants para contornar acesso.
8. Reversão no console administrativo: executar `revoke-dedicated-access.sh` do mesmo diretório privado ao concluir ou antes do prazo. Expira/bloqueia só a conta dedicada, remove só sua chave e encerra processos do seu UID não0; preserva home/logs/evidências e demais contas/chaves. Prazo não encerra sozinho sessões abertas. Nenhuma delegação administrativa nova para automatizar reversão.

Provas locais: script e bloco sh -n PASS; receptor9checks PASS (porta22/2222, alias, permissões, repetição, recusa de vínculo alterado, fingerprint/servidor/endpoint/porta inválidos e chave cliente como HOST). Recibo host-receiver-tests.private.json. Prova anterior do provisionador4simulações reutilizada para seus ramos inalterados, não cobre listener/entradaTTY novos nem prova execução remota. Nenhum arquivo verified instalado ou conexão SSH antes do recibo confiável. Helpers privados novos são necessários à recepção/validação atômica ausente no script anterior; reutilizam diretório, chave, provisionador e configuração existentes, sem importer/módulo paralelo.

### Recuperação ERP novo — reconectar Base44 existente

No MESMO cliente/conta proprietária e workspace: Plugins → Installed → Base44 → abrir detalhes/conexão e concluir a ação de reconectar/autenticar oferecida para a conexão expirada. Não instalar outro plugin, excluir a integração ou criar app. Plugins instalados são acessíveis pela linha Installed ([documentação oficial](https://learn.chatgpt.com/docs/plugins)); a localização/nome exato do botão OAuth depende do cliente. Se não houver ação de reconexão, registrar essa limitação da interface em vez de inventar comando ou solicitar senha/token. A ferramenta disponível não expõe ação de reautenticação programática.

Após conclusão, avisar somente que a conexão foi renovada. Executor lista apps autorizados uma vez e valida nome/URL/ID, conta/tenant, procedência e data da fonte pré-perda antes de ler registros. Não escolher primeiro app/seed por semelhança. O app original ainda não está identificado de forma confiável; .env local sem referência Base44 não prova identidade. Consulta UNAUTHORIZED anterior não foi repetida. Recuperar registros exige comparação privada no mesmo escopo; não usar entidades Git/fixtures/coorte legado como substituto.

### Prévia privada sintética — iniciar, verificar e retomar

Reutilizar harness privado existente `decision-20261026/resume-20261028/browser-harness.mjs` sob `/home/codespace/erp-legado-privado-20261023`. Não é deploy nem banco operacional. Executar somente após conferir checkout/branch/HEAD/status/processos e inexistência de outro dono da5173. Em terminal próprio, cwd canônico, Node22:

```bash
ERP_PREVIEW_EXPECTED_SHA="$(git rev-parse HEAD)" PATH=/usr/local/share/nvm/versions/node/v22.23.4/bin:$PATH node /home/codespace/erp-legado-privado-20261023/decision-20261026/resume-20261028/browser-harness.mjs
```

Harness recusa Codespace/origin/branch/SHA divergentes e diff de runtime antes de criar recursos; diretório de recibos identity-preview-20261028 deve permanecer0700. Verificar listener real, encaminhamento5173 Private e HTTP local `/__erp_fixture` (sourceSha, synthetic, operationalDatabase=false), `/__erp_preview` (HEAD atual), aviso sintético antes/depois do login. Login exclusivamente fixture: entry.synthetic@example.test / synthetic-entry-only. URL HTTPS externa termina em `-5173.app.github.dev/Comercial`; usar localhost para teste local, preservando redirecionamento HTTPS de127.0.0.1. Não publicar logs completos ou credenciais reais.

Parar com Ctrl-C SOMENTE no terminal do harness próprio; cleanup usa seu container/labels/socket. Não matar processos genéricos nem tocar recursos alheios. Retomada repete verificações de identidade/exclusividade e comando: cria novo banco efêmero sintético, não recupera dados operacionais. Duração máxima6h/Codespace ativo; sem promessa24h ou mudança de suspensão/custos. Promoção para DEV diário exige gate existente de versão/imagens, autenticação/roles, backup/rollback, aprovação/deploy; não está autorizada por esta prévia.

Objetivo: qualquer agente ou PC novo consiga operar a VPS **sem** reenviar
credenciais no chat. Segredos ficam no ambiente Cursor (Runtime Secrets) ou no
Hostinger; o GitHub guarda só o contrato e os nomes.

### Secrets do ambiente Cursor (valores FORA do Git)

| Nome | Obrigatório | Conteúdo |
|---|---|---|
| `ERP_DEV_VPS_SSH_PRIVATE_KEY` | sim | chave **privada** OpenSSH completa (`-----BEGIN OPENSSH PRIVATE KEY-----` … `-----END-----`), ou corpo base64 OpenSSH que o agente reconstrói com headers |
| `ERP_DEV_VPS_SSH_USER` | recomendado | usuário SSH (em produção DEV: `root`) |

- Configurar em: Cursor → Environment → Secrets (Runtime Secret) · Apply to this environment.
- **Proibido** commitar a chave privada, colar no chat, PR, HANDOFF ou evidence.
- Trocar de computador: os secrets do Environment continuam; não é preciso reenviar no chat se o Environment for o mesmo.

### Recuperacao do canal existente (precedencia em22/10/2026)

Reutilizar primeiro o executor/alias/Runtime Secrets ja autorizado. A ausencia
no sandbox atual nao autoriza reprovisionar a VPS, gerar outra identidade ou
substituir authorized_keys. O bloco de provisionamento inicial abaixo e historico:
NUNCA executar seu `cat > authorized_keys` como rotina de recuperacao, pois pode
sobrescrever acessos existentes. Conferir recibo/metadados e canal original antes
de qualquer mudanca; chave privada somente pelo mecanismo de segredos, nunca chat.

### Chave pública autorizada na VPS (pode ir no Git)

Comentário: `erp-zuccaro-vps` · tipo ED25519  
Fingerprint: `SHA256:o2kp7MNg3H8D5ArHT34/BrI35J23/y9e8MIsdMqYwMA`

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAII8ouskwnfnbFg/qCD376xnYlxMwGTjR4OtphP8Vw2nm erp-zuccaro-vps
```

A chave no hPanel **não** injeta sozinha em VPS já criada. Tem de existir em
`/root/.ssh/authorized_keys` na instância viva (Web Console se SSH falhar):

```bash
mkdir -p /root/.ssh && chmod 700 /root/.ssh
cat > /root/.ssh/authorized_keys <<'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAII8ouskwnfnbFg/qCD376xnYlxMwGTjR4OtphP8Vw2nm erp-zuccaro-vps
EOF
chmod 600 /root/.ssh/authorized_keys
```

Conferir: `wnfnbFg` (F maiúsculo) · `YlxMw` (letra L) · `R4Otph` (letra O).

### Como o agente conecta

1. Resolver host: `getent hosts erp-dev.cpaferroeaco.com.br` (não gravar IP no Git).
2. Montar `~/.ssh/erp_dev_vps` a partir de `ERP_DEV_VPS_SSH_PRIVATE_KEY` (chmod 600).
3. `ssh -i ~/.ssh/erp_dev_vps -o BatchMode=yes -o IdentitiesOnly=yes "$ERP_DEV_VPS_SSH_USER@<host>" …`
4. Hostinger VPS MCP: útil para inventário; se timeout, SSH/Web Console são o caminho operacional.

### Rebuild SPA/API da main (já autorizado quando o lote pedir deploy)

```bash
cd /opt/erp-zuccaro
bash scripts/vps/create-pre-gate-e-backup.sh
git fetch origin main
CONFIRM_SPA_LOGIN_REBUILD=YES ERP_DOCKER_NETWORK=supabase_default GIT_REF=origin/main \
  bash scripts/vps/spa-login-rebuild-api-web.sh
```

Rollback (tags gravadas em `/opt/erp-zuccaro/.spa-login-rollback-tags`):

```bash
CONFIRM_SPA_LOGIN_ROLLBACK=YES ERP_DOCKER_NETWORK=supabase_default \
  ROLLBACK_TAG_FILE=/opt/erp-zuccaro/.spa-login-rollback-tags \
  bash scripts/vps/spa-login-rollback-api-web.sh
```

### Obrigatório após qualquer operação VPS (sempre)

1. Atualizar `docs/HANDOFF_ATUAL.md` + `STATUS_DO_PROJETO.md` com: SHA implantado, backup path/sha256, tags de rollback, o que falta validar no browser.
2. Evidência sanitizada em `docs/vps/evidence/` (sem dump, sem `.env`, sem chave).
3. Commit/push/PR — não deixar só no disco do agente.
4. Nunca gravar no Git: chave privada, senha, `.env.erp.dev`, dump SQL, tokens.

## Backup e rollback

Antes de migration, promoção ou gate destrutivo: executar backup/checkpoint
autorizado e guardar em `/opt/erp-zuccaro/backups`. Quando o gate exigir,
registrar caminho e hash. Nunca remover backups automaticamente.

Preservar ao menos o rollback imediato do runtime anterior durante a
estabilização. Rollback de API e rollback de schema são decisões independentes;
não reverter schema automaticamente se a API anterior continuar compatível.

## Migrations

Migrations históricas são imutáveis. Uma migration nova deve ser aditiva,
passar por precheck e backup, ser registrada em `schema_migrations` e ser
validada no PostgreSQL real antes da promoção. Usar transação e
`ON_ERROR_STOP` quando aplicável. Nunca reaplicar manualmente uma migration já
registrada sem diagnóstico.

## Segurança obrigatória

Todas as operações observam multiempresa, com `group_id` como tenant raiz e
Empresa no contexto aplicável. RLS + FORCE, RBAC fail-closed, bloqueio de
IDOR/cross-group/cross-company, allowlist contra mass assignment e auditoria
atômica são barreiras de backend e banco. A auditoria minimiza PII.

## Portas temporárias

A porta 3080 é oficial. Canários e testes usam porta temporária somente após
precheck de disponibilidade e devem ser parados ao final do gate. Nunca assumir
que uma porta, inclusive 3086, está livre.

## Incidente ou divergência

Registrar a evidência, interromper a mudança e decidir o próximo passo com
autorização. Não promover, apagar, resetar ou reiniciar para ocultar a
divergência.


## Gate proprietário: auditoria e promoção do candidato revisado

### Primeira senha na conta existente

Se o proprietário nunca definiu/recebeu senha, não usar BOOTSTRAP ou criar outro Auth. Após revisão Cursor/CI/merge, o modo `OWNER_ACCESS_MODE=PASSWORD` do mesmo script exige checkout limpo no APPROVED_SHA, banco/rede/tenant reais, decisões anteriores e `CONFIRM_OWNER_PASSWORD_RESET=YES`. Faz AUDIT/preflight/backup sem mudar API/SPA. O proprietário assume o Web Console antes da entrada: digita e confirma senha de 12–200 caracteres em prompt sem eco. Agente não lê, escolhe nem envia a senha.

O GET administrativo deve corresponder ao Auth existente confirmado. A senha segue por stdin até o Auth; nunca em argumento/env/arquivo/chat/log. Intenção e resultado são auditados sem credenciais. Não há retry automático nem rollback de Auth: timeout ou falha de auditoria após PUT deixam estado possivelmente alterado, exigem inspeção privada e eventual nova redefinição pelo proprietário. Não restaurar dump operacional ou senha antiga desconhecida para esconder falha. Preservar backups; confirmar login real e permissões depois. A chave administrativa continua somente no container, jamais no navegador.

PASSWORD exige perfil ativo admin com empresa_id NULL, vínculo Auth/Grupo válido, permissões completas do arquivo canônico owner-admin-permissoes.json e ausência de wildcard. Perfil rebaixado, vinculado a uma Empresa ou com permissões incompletas bloqueia antes de GET/PUT. Resposta PUT 2xx ilegível ou identidade divergente também é ambígua: registrar unconfirmed quando o banco está disponível, interromper sem retry e inspecionar antes de nova tentativa.

`deploy-owner-access-incidente.sh` tem modo AUDIT sem escrita. Informar OWNER_EMAIL explicitamente; não enviar senha em chat, env, argumento ou arquivo. Conferir Auth/perfil, grupo e ambas empresas pela conexão efetiva da API antes de selecionar IDs. Não inventar UUID, renomear seed nem duplicar conta. Reaproveitamento dos registros existentes foi autorizado pelo proprietário; `APPROVE_EXISTING_TENANT_MAPPING=YES` registra essa decisão no gate.

APPLY exige IDs válidos distintos, banco/rede reais, APPROVED_SHA completo igual ao checkout limpo, CONFIRM_OWNER_ACCESS_DEPLOY e CONFIRM_OWNER_GROUP_ADMIN. Somente depois de revisão do Cursor, CI e integração controlada; nenhum operador deve concorrer no Web Console. O procedimento faz backup custom + validação de arquivo, canário API/SPA, grant auditado e promoção das mesmas imagens. BOOTSTRAP é separado e exige CONFIRM_OWNER_TENANT_CREATE; criação Auth externa pode permanecer após falha posterior, exigindo nova auditoria antes de retry. Não executar BOOTSTRAP para o proprietário já existente.

Evidência mínima após promoção: SHA da label + image ID de API e SPA iguais aos canários; ready API/BFF; rejeição de cabeçalhos fabricados; logout completo e login com conta real, escolha de cada empresa, Comercial e Configurações. CI verde ou login sintético não encerram o incidente. Rollback preserva dados; usar restore seletivo de perfil explicitamente autorizado e auditável se necessário, não replay cego de dump. Preservar backups e rollback 06A.

## Acesso proprietário — falha operacional pg_read_file (2026-09-27)

- #96 mesclada na main 56dae6966ae39a11eac3064ca7bb0d67553e7765 após parecer Cursor sobre 23252cc e CI; CI PUSH main #1135/run36326407270 SUCCESS frontend/backend.
- VPS atualizada para esse SHA; AUDIT, identidade efetiva do banco, backup custom e canário API/SPA aprovados. APPLY abortou no provisionamento: `permission denied for function pg_read_file`, transação revertida, nenhuma promoção. Oficiais preservados; canário antigo exclusivamente localhost3086 parado reversivelmente com container/imagem preservados. Backups privados preservados.
- Correção candidata em branch própria: JSON por COPY do cliente psql tanto na concessão quanto no restore seletivo, sem conceder leitura de arquivos do servidor nem elevar o usuário PostgreSQL. Preserva locks, validação de tenant, auditoria, transação e decisões do proprietário. Teste PostgreSQL CI com NOSUPERUSER/NOBYPASSRLS verifica leitura negada e COPY bem-sucedido, inclusive aspas/barra/acentos e comando real do restore.
- Ainda requer CI do novo HEAD e revisão independente Cursor antes de merge/APPLY. Não declarar acesso/deploy concluído. Login real, duas empresas e Comercial/Configurações continuam pendentes; canais OFF. Nenhuma migration ou dado real publicado.
## Estado vigente das rotas Auth - 2026-11-06

Proposta anterior aprovada especificamente e executada: somente GET/auth/v1/user
e POST/auth/v1/token para gateway8000 no HTTPS API existente. Restricao inclui
URI original literal, evitando alias por case/escape/normalizacao. Demais rotas
preservadas. validate/reload PASS,4positivos/12negativos, TLS valido, health/web
preservados. Caddy ativo, protecao temporaria de rollback encerrada. Backup e
executor/recibos privados: /root/erp-private/auth-hml-route-344-20261106.
Pins/resultado detalhados no topo do HANDOFF existente. Nao reexecutar apply:
ele rejeita recibo anterior e config diferente do baseline. Reversao exige
procedimento privado validado, nunca sobrescrita cega de config posterior.
Encaminhamento nao comprova sessao real/API HML READY ou navegador. Nao autoriza
novos endpoints, grants, carga operacional ou deploy ERP. Cabecalhos anteriores
que dizem rota aguardando aprovacao sao historicos, superados por este recibo.
