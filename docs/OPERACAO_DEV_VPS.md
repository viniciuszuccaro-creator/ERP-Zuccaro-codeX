# Operação DEV: GitHub, Codex, Cursor e VPS

## Roteiro vigente - recuperar dois artefatos no ciclo informado de01/11 (2026-10-31)

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
