## CPA3: ordem candidata dos ajustes de Obras (2026-11-26)

- Exports verificados: 3.096 eventos em 2.243 pares Cliente/Item. Nos 501 pares com mais de um evento (1.354 eventos), data/hora brutas e sequencia crescente concordaram, sem empates. No recorte com obra unica, sao 228 pares com eventos multiplos, tambem em concordancia.
- As 431 transicoes consecutivas do mesmo tipo nao encadearam literalmente conteudo atual/anterior (113 no recorte de obra unica). Isso nao prova erro nem semantica de campo; nao interpretar como cadeia confiavel ou usar SEQUENCIA como chave de obra. Recibo privado 6a552b1e.
- Proximo: conferir como o ERP legado define tipo/conteudo e vincula a Empresa no leitor nativo. Zero ajustes aptos; sem reextracao, ativacao, carga ou alteracao na HML/operacional.

## CPA3: ajustes de Obras e CI do checkpoint de Fornecedores (2026-11-26)

- Confronto privado dos exports conferidos: 35.309 Obras e 3.096 ajustes. Por Cliente/Item, 1.536 pares unicos, dos quais 1.328 em obras com cliente na revisao e 208 sem esse vinculo; 1.560 sem par. Nenhuma correspondencia pela chave completa com SEQUENCIA. Datas/horas brutas nao comprovam semantica do evento nem empresa. Zero apto para escrita. Recibo privado 24cd697f, sem reextracao.
- CI 45835051779 do ccccd248 verde nos quatro jobs. Fornecedores d92c451c/4905483e ainda aguarda aceite do escopo Grupo sem Empresa de origem e autorizacao especifica de gravacao.
- Proximo para Obras: provar o significado de ITEMLOCALENTREGA/SEQUENCIA e a Empresa responsavel no leitor nativo; reutilizar as 1.328 candidatas para o recorte inicial. Sem SQL de escrita na HML, carga ou alteracao operacional.

## CPA3: carga e reversao integral com checkpoint original (2026-11-26)

- Do backup pos-Marcas c33c96f4, nova base descartavel e delta privado conferido. Papel restrito e runtime com checkpoint transacional: primeiro commit interrompido, retomada com um reuso e 788 insercoes em 40,1 s, 789 IDs distintos e 789 checkpoints auditados.
- Reversao via SHA e revisao do create original: 789 inativacoes e 789 auditorias em 18,2 s, 17.472 clientes e seis Marcas preservados. Recibo privado 070e367d, base descartada e container desligado. Nenhum dado na HML alterado.
- CI 45833981406 do f7a8391a verde; CI 45835051779 do checkpoint ccccd248 em andamento na conferencia. Manifesto 4905483e permanece revisao: falta aceite explicito de 789 compartilhados sem Empresa de origem e autorizacao especifica de escrita.

## CPA3: checkpoint transacional da reversao de Fornecedores (2026-11-26)

- Criacao grava SHA-256 da imagem retornada e revisao na auditoria da mesma transacao; nao inclui campos brutos adicionais. Reversao exige um unico evento create do mesmo Grupo/ID, lote, origem, revisao e SHA. Um hash novo calculado depois de edicao nao autoriza inativacao, mesmo se a revisao nao mudou. Sem checkpoint, recusa; nao retropreencher auditoria.
- 21 testes focados, typecheck e build do servidor aprovados. PostgreSQL isolado com papel restrito e dados sinteticos: dois checkpoints, edicao posterior preservada, reversao original auditada uma vez, replay recusado. Recibo privado 667c296c. A HML ja possui as ACL de leitura de auditoria necessarias; nenhuma alteracao aplicada.
- Proximo gate: aceite explicito dos 789 compartilhados, manifesto final e autorizacao especifica de carga. Nenhum deploy, carga, mudanca de perfil ou alteracao operacional.

## CPA3: reversao em escala de Fornecedores (2026-11-26)

- Clone descartavel, papel SQL restrito e servico canonico: 789 identidades conciliadas com 4905483e. Dos 788 ativos no inicio, 787 inativados em 18,3 s com 787 auditorias; um conflito de revisao preservou a edicao posterior. Um ja inativo ficou intocado. Repeticao recusada, codigo/identidade preservados, sequencia 1066, 17.472 clientes e seis Marcas intactos. Recibo privado 64331e5a; copia de teste descartada e leitor desligado.
- Para a carga real, capturar fingerprint e revisao da imagem confirmada por registro, inclusive retomada comprovada, antes de permitir reversao. Nao gerar o fingerprint a partir de leitura tardia de registro alterado. CI 45833981406 do f7a8391a em andamento na conferencia.
- Sem aceite do escopo compartilhado, sem importacao, ACL ou deploy na HML e sem mudanca operacional.

## CPA3: RBAC ensaiado em PostgreSQL e correcoes da CI da grade (2026-11-26)

- Clone isolado: consulta, janela temporaria de importacao e reversao executadas em transacao. Replay manteve tres auditorias; CAS recusou mudanca concorrente. Reversao preservou visualizar. Rollback restaurou perfil e removeu as auditorias do ensaio. Recibo privado 79e2a53b. Nenhum SQL na HML.
- CI 45831695821 e 45832062505: frontend falhou em dois contratos historicos do V24. Chave legada preservada e modo Fornecedor usa sufixo de sessao. Gate legado mantido; supressao das escritas fica nos checkers do modo leitura. Os dois testes passaram em reexecucao, assim como Chrome montado e 80 testes focados Linux.
- O aceite do escopo compartilhado dos 789 ainda nao foi dado. Sem ativar flag, publicar na HML ou importar dados.

## CPA3: RBAC separado para Fornecedores (2026-11-26)

- Preflight somente leitura confirmou o perfil titular ja pinado na configuracao privada da HML: um perfil ativo de Grupo, vinculo Auth exato, duas Empresas ativas e nenhuma acao Fornecedor. Nenhum perfil foi modificado.
- Preparador canonico de perfil produz planos distintos: visualizar; ou criar/importar/inativar temporariamente para carga e reversao. Exige aprovacao especifica, identidade fisica e CAS, audita e reverte apenas o delta correspondente, preservando autorizacoes anteriores. Seis testes focados aprovados. Nenhuma execucao SQL.
- Pacote d92c451c ainda em revisao. Falta aceite explicito do escopo compartilhado sem Empresa por linha e autorizacoes especificas antes de liberar a leitura HML ou gravar o manifesto.

## CPA3: pacote de revisao para 789 Fornecedores (2026-11-26)

- Pacote privado de revisao d92c451c: manifesto 4905483e ainda nao executavel. Schema Linux 6680471c equivale ao 40490a3b do manifesto em CRLF; import policy 8435fab3 e leitura ef09aea4. Policies separadas ensaiadas com o papel restrito: 789 no Grupo, CPA e 3Z, zero fora do Grupo, zero UPDATE na Empresa. DELETE e UPDATE de codigo negados. Rollback conferido.
- HML em leitura: 17.472 clientes, seis Marcas, tabela Fornecedores ausente. O papel existente ja tem ACL para auditoria e sequencia, mas nenhum perfil ativo de Grupo tem acoes de Fornecedor. Nao alterar perfis sem gate. Backup pos-Marcas c33c96f4 restaurado e SHA conferido no HD; revalidar antes de qualquer escrita.
- Origem EXETPS no escopo de Grupo, sem Empresa de origem por linha. Preservar 271 historicos e 25 casos do recorte EMP01-03 fora da carga. Proximo: confirmar aceite desse escopo e perfil nominativo, finalizar manifesto executavel e revalidar backup/destino. Nenhuma carga, deploy ou mudanca operacional.

## CPA3: policy candidata de consulta de Fornecedores (2026-11-26)

- SQL candidato separado das migrations: fornecedor_company_read.sql. Exige schema pinado e RLS forcada, concede apenas policy SELECT ao papel indicado, sem grants. No clone, Grupo, CPA e 3Z leram 789; empresa desconhecida e outro Grupo leram zero. Contexto Empresa nao atualizou nem bloqueou linhas. ACL intacta; rollback removeu a policy.
- Manifesto 4905483e: 789 ativos com procedencia EXETPS.dbo.Fornecedores; 790 linhas no staging de um Grupo, nenhuma com Empresa de origem registrada. Nao inferir Empresa por coincidencia de codigo. HML revalidada em leitura: 6 Marcas, 17.472 clientes, tabela fornecedores ainda ausente.
- Proximo: fechar revisao de procedencia e pacote de carga antes de autorizacao HML. Sem aplicar schema, alterar ACL, importar ou publicar.

## CPA3: grade oficial de Fornecedores em leitura (2026-11-26)

- Visualizador existente com opt-in VITE_ERP_HTTP_FORNECEDOR_READ, desligado por padrao. Lista e detalhe oficiais por contexto autenticado, busca e paginacao por hasMore. Sem reutilizar total local, permissao de escrita ou formulario legado. Troca de contexto invalida detalhes e linhas do escopo anterior.
- Chrome montado com dados sinteticos: busca por codigo, segunda pagina, detalhe, troca CPA/3Z e botoes de escrita indisponiveis. Cadastros continua sem consultas de registros antes do clique. Testes de contratos e historico preservados.
- Nenhuma flag ativada, carga ou publicacao na HML. Proximo gate: CI do SHA, policy SELECT definitiva, procedencia do manifesto e autorizacao especifica antes de qualquer escrita.

## CPA3: cliente HTTP de leitura de Fornecedores (2026-11-26)

- CI 45829007262 verde nos quatro jobs para 49887066. HML nao publicada.
- Cliente reutiliza o transporte HTTP canonico para listar e consultar Fornecedor, sem operacoes de escrita ou fallback local. Envia Bearer e mantem o contexto de inicio; resposta obsoleta e descartada. Comparacao historica reconhece apenas os tres trechos novos, sem substituir hashes de referencia.
- 57 testes HTTP e de contratos historicos passaram no Linux. Proximo: ligar a grade existente em modo somente leitura e testar pagina, detalhe e troca de contexto no navegador antes do gate de HML. Manifesto 4905483e nao aplicado.

## CPA3: consulta HTTP compartilhada de Fornecedores (2026-11-26)

- Validacao final por etapas: Linux privado com npm ci, auditoria, lint, typecheck e build de web/API. Raiz: 3.031 passaram; dez falhas de historico passaram apos recuperar refs e cinco de navegador passaram no Chrome do Windows com perfil no HD. Servidor: 601 resultados sem falhas antes do limite do executor; recorte sobreposto final com 68 aprovados, tres pulados e zero falhas. Sem execucao unica verde neste executor; sem pular testes ou desativar sandbox.
- Retomada das validacoes: suite do servidor 635 aprovados, 45 pulados e sete falhas na primeira passada. Refs Comercial recuperadas; composicao passou isolada. Zod 3.25.76 recuperado do cache verificado; os seis arquivos que nao carregavam passaram em reexecucao focada (28 testes). Sem execucao integral verde: npm ci da raiz nao concluiu no HD externo. WIP preservado, sem commit, push ou deploy.
- Rota existente de detalhe e consulta paginada de Fornecedores usam o mesmo repositorio. Busca literal por codigo/nome, ordenacao estavel e resposta de lista sem dados de contato. RBAC visualizar aceita contexto autorizado de Empresa; importar e reverter continuam restritos ao Grupo. A consulta de detalhe nao bloqueia a linha; a reversao conserva o bloqueio e o CAS.
- Testes focados: 20 passaram, incluindo as duas Empresas, outro Grupo, busca e paginacao, escrita negada, auditoria e reversao. Auth sintetico/PGlite; nao equivale a navegador ou ACL instalada. Servidor: typecheck e build aprovados.
- HTTP no PostgreSQL restaurado: tres modulos compilados sobre a candidata a470accb r2, Auth sintetico, papel restrito e policy SELECT temporaria. Grupo, CPA e 3Z consultaram o mesmo ID; outro Grupo e importacao pela Empresa receberam 403. Policy retirada e clone desligado.
- EXETPS original reconferido na VPS por dois hashes, sem nova copia; cerca de 39,78 GB livres. Sem carga de Fornecedores ou publicacao da candidata. Proximo: ligar a tela sem sobrepor o caminho de escrita e fechar a procedencia do manifesto 4905483e para aprovacao. CC011 segue fora.

## CPA3: leitura compartilhada de Fornecedores ensaiada no clone (2026-11-26)

- O zero do ensaio anterior veio da policy de importacao restrita a contexto de Grupo. Separadamente, a API get de Fornecedor tambem recusa contexto de Empresa na autorizacao do servico; a tela nao consome essa rota HTTP. Nao confundir o teste SQL com aceite na API ou no navegador.
- Em transacao no clone pos-Marcas, policy candidata somente SELECT por Grupo e Empresa ativa do Grupo: 789 visiveis na CPA e na 3Z, zero para contexto de outro Grupo e zero UPDATE em contexto de Empresa. Rollback confirmou ausencia da policy; clone desligado. Proximo: separar autorizacao de get/lista da de importacao/reversao, validar acesso autenticado e ligar a interface existente antes de fechar o pacote HML.
- Recibos do EXETPS original e das seis Marcas reaproveitados, sem nova transferencia ou carga; HML API/web a305a143. Manifesto 4905483e ainda em revisao, procedencia complementar pendente. EMP05 ainda sem leitura funcional; CC011 permanece fora. Sem deploy nem alteracao operacional.

## CPA3: EXETPS original centralizado e Fornecedores ensaiados (2026-11-26)

- SFTP retomavel do HD para a VPS privada: MDF/LDF do EXETPS original, 1.022.492.672 bytes, tamanhos e dois SHA-256 iguais. Snapshot anterior preservado em caminho separado, com hashes distintos. Nenhuma exclusao; 39.776.870.400 bytes livres apos a copia.
- Backup pos-Marcas hml-20261126T121355Z-0c2bcc8d, 47.790.080 bytes, SHA c33c96f4. Rotina de restauracao aprovada, copia externa conferida no HD e restauracao independente com ACLs: seis Marcas e 17.472 clientes.
- Clone isolado e papel restrito: manifesto de revisao 4905483e pelo servico canonico. Interrupcao depois do primeiro commit; retomada reutilizou um e inseriu 788 em 28,3 s. Conferidos 789 codigos literais e estados, 789 auditorias de criacao, sequencia 1066, zero leitura sob contexto de Empresa e reversao amostral com recusa de repeticao por revisao. Clone desligado. Escopo de importacao autorizado somente no clone.
- Proximo gate: registrar procedencia por fonte e Empresa quando comprovada, manter separados os 271 historicos e os 25 do recorte EMP01-03, fechar manifesto executavel e pedir autorizacao especifica. EMP05 ainda precisa de executor funcional para comprovar o centro da CPA; nao usar CC011. HML a305a143, sem escrita de Fornecedores, deploy ou mudanca operacional.

## CPA3: delta de Fornecedores e fonte contabil conferidos (2026-11-26)

- Clone restaurado anterior as Marcas: 17.472 clientes, sem rede nem porta publicada. O schema canônico de Fornecedor 40490a3b corresponde ao hash do manifesto 4905483e. O ensaio estrutural passou com RLS forçada, papel restrito, sem DELETE e sem UPDATE de codigo, com UPDATE de estado para reversao. Rollback removeu a tabela e o papel de ensaio. Ainda falta um ensaio integrado do lote real com ACL efetiva, auditoria e retomada apos commit; nao houve carga.
- EMP05: cópia de trabalho conferida byte a byte antes do leitor isolado. SQL Server abortou antes do attach com AppLoader/LSA 0xc0070102. Nenhuma conclusão sobre o centro da CPA. A próxima leitura deve correlacionar CentroCustosPedidos e NotaFiscalSaidasRateioCentroCusto em executor SQL isolado funcional. CC011 continua fora.
- PLANOCON.TPS da raiz EXETPS e da EMP05 já existem na VPS e coincidem com o HD por SHA-256. Nenhuma transferencia ou exclusao neste recorte. Cerca de 41,65 GB livres na VPS. API e web da HML permanecem em a305a143. Tar a470accb r2 conferido (06d13aab); publicacao depende dos gates de schema, acesso e parametrizacao contabil.

## CPA3: Marcas conciliadas e financeiro ensaiado no clone (2026-11-26)

- HML a305a143, sem deploy: seis Marcas compartilhadas do manifesto 1da950d9 e delta 0e836b05, com seis checkpoints, seis reusos e seis vinculos auditados. Os 17.472 clientes mestres permaneceram preservados. Backup anterior restaurado em clone e copia externa conferida.
- Candidata a470accb r2: rotas HTTP autenticadas, papel restrito, sem fallback para public. Dois pedidos de teste ja no estado de retirada pronta: faturamento, saldo 100, baixa parcial para 60, quitacao em zero, replay sem nova baixa e recusa 422 de centro de outra Empresa. Sem emissao ou cobranca. Nao e aceite por navegador nem jornada desde Orcamento.
- 3Z usou CC001 real e conta 3.1.01 sintetica no clone. CPA usou CC-SINT-CPA e a mesma conta sintetica. Na origem, 3.1.01 e analitica ativa do Grupo, sem Empresa. CC011 pertence a CPA mas nao tem uso comprovado para venda. Nao vincular. Plano de Contas ainda ausente na HML; falta comprovar centro da CPA e aprovar a parametrizacao contabil.
- Fornecedores: manifesto nao executavel 4905483e, 789/789 confirmados por codigo nativo e documento no export SQL de 1.061 linhas, sem intersecao com o arquivo historico de 271 em quarentena. O recorte EMP01-03 continua separado: 139 presentes no manifesto e 25 em quarentena. Os dois exports conferem por SHA entre HD e VPS, sem retransmissao. Tabela ausente na HML; proximo passo: ensaiar o delta restrito por Grupo e fechar os gates de procedencia, backup e autorizacao. Nenhuma escrita de Fornecedores.

## CPA3: revisao dirigida de Produtos e Precos (2026-11-26)

Origem Base44 para destino: 273/273 codigos literais conciliados; legacy_id guarda codigo de negocio, nao ID Base44. EXETPS: 22.888 clientes com tabela existente, seis referencias sem cabecalho e um sem codigo positivo. EMP03: 2.652 itens com tabela/material/empresa nativos, 2.386 unidades coincidentes e 104 precos coincidentes. Historico nao autoriza tabela corrente.

Recorte privado de revisao: 84 candidatos por codigo, descricao e unidade; sete com evidencia historica e Empresa conciliada por documento. Dez pares Produto/Tabela positivos em quatro tabelas, 38 itens historicos. Pacote a0e47745 nao executavel. Pendente validar identidade do Produto, regra vigente por Empresa e conversao nativa de datas. Zero preco aprovado ou gravado; sem deploy, mudanca operacional ou arquivo da tarefa no disco interno.

## CPA3: inventario de pares SQL e leitura TEMP (2026-11-26)

Primeira copia MDFSQL no HD: 18 arquivos, nove pares, 18.663.342.080 bytes. EMP01-05, Auditoria, TIDDF e TEMP tem copias ou pacotes privados verificados na VPS. EXETPS original: dois hashes iguais ao recibo de arquivamento no HD; snapshot da VPS tem mesmo tamanho e hashes distintos, manter separado. Nenhuma retransmissao nesta conferencia.

TEMP: pacote de 87.300.231 bytes transferido previamente por SFTP retomavel; pacote e membros conferidos. Leitor READ_ONLY: historico de fornecedor/financeiro, retornos bancarios, exclusoes de duplicatas e staging XML vazios; leitor parado. Seis XMLs nao classificados ficam em pasta de instalador, sem evidencia fiscal. Centros reais 13/13 conciliados por Empresa, codigo, descricao e estado; 26 contas sem Empresa e nenhum centro com conta padrao. Aguardam conta/centro aprovados e gate separado das seis Marcas. Sem escrita HML, deploy, alteracao operacional ou arquivo no disco interno.

## CPA3: consulta de Centros de Custo ensaiada com privilégio mínimo (2026-11-26)

Clone restaurado de 26/11: papel efetivo da API sem SELECT inicial. SELECT(id, descricao, group_id, empresa_id) e policy de leitura por Grupo/Empresa reproduziram a consulta do Financeiro: 13 Centros em duas Empresas, sem leitura fora de escopo nem privilégio de escrita. Rollback retirou o grant e a policy candidata. Plano de Contas real ainda depende de parametrização validada por Empresa. HML segue sem deploy ou grants novos.

Busca ampliada no HD: 181 arquivos XML em pastas pertinentes; 175 tinham raiz não fiscal, seis não passaram pela leitura estrutural. Nenhuma fonte fiscal confirmada ou arquivo transferido neste recorte. Sem carga, alteração operacional ou arquivo da tarefa no disco interno.

## CPA3: acesso contabil HML e leitura fiscal TIDDF (2026-11-26)

HML a305a143: identidade do banco/schema e papel pinado revalidados somente leitura. plano_contas ausente e papel da API sem SELECT em centros_custo, inclusive coluna id (42501). Proximo: revisar grants por coluna, RLS e parametrizacao real CPA/3Z no clone antes de preparar publicacao.

TIDDF: 7.340.032 bytes transferidos do HD para VPS privada; dois hashes iguais. Leitor isolado READ_ONLY encontrou zero linhas nas tres tabelas de XML fiscal/transporte. Leitor encerrado; sem lotes, deploy ou alteracao operacional. Sem arquivos da tarefa no disco interno.

## CPA3: contrato contabil isolado e Auditoria verificada (2026-11-26)

a470accb r2: nenhum plano_contas em schema do clone. Fixture sintetica com duas Empresas, RLS forcada e FK composta recusou vinculo cruzado; delta Contas a Receber aplicou e reverteu sem titulos. Nao comprova parametrizacao real; sem deploy nem escrita HML.

Auditoria transferida ao canal privado: 336.964.519 bytes, SHA do pacote e dos dois membros conferidos. Leitura isolada: 12.623.711 eventos; filtro de nomes por OBRA encontrou apenas duas tabelas de corte/dobra, sem ClientesObras. Nao inferir titularidade. Leitor desligado; nenhuma carga, exclusao ou escrita no disco interno.

## CPA3: backup de 26/11 restaurado e arvore EXETPS conferida (2026-11-26)

Candidata a470accb r2, CI 45680437810: API do pacote exato conectou ao clone remoto por socket privado com papel restrito e somente leitura; health/ready 200. Backup agendado de 26/11 restaurado e copia externa conferida por SHA. Quatro scripts comerciais passaram e foram revertidos; 17.472 clientes e 16.087 locais preservados. Delta financeiro recusou pela ausencia de plano_contas. Sem homologacao de venda, deploy ou promocao.

Arvore original EXETPS: 1.839 arquivos, 2.438.903.826 bytes, todos equivalentes por caminho, tamanho e SHA; zero reenvios. EMP01-03: 164 fornecedores distintos, 139 no manifesto e 25 em quarentena. EMP01/03 tem 3.300 chaves de titulo sobrepostas sem igualdade nos campos comparados; nao fundir bases. Sem carga ou escrita local interna.

## CPA3: catalogo nativo e continuidade dos ajustes de Obras (2026-11-26)

- O catalogo arquivado confirma 10 colunas de ajustes em Auditoria, EMP01, EMP03, EMP05 e EXETPS, sem campo explicito de empresa/filial. O catalogo mestre de Obras da EXETPS tem 59 colunas, tambem sem esse campo. Nome de base nao prova propriedade da obra.
- Nos 8 tipos observados, 0 de 431 transicoes adjacentes do mesmo tipo coincidem literalmente; 238 coincidem ao remover apenas espacos finais. As 193 restantes nao foram conciliadas por essa normalizacao. Nao inferir tipo, ordem comercial ou empresa desses resultados.
- Recibo privado `obra-adjustment-native-catalog-20261126.private.json`, SHA-256 `c88f90d218f19bbcc5071822ac7159c1dada83c47e03fe15a9601885688449ce`. Nenhuma gravacao de Obras, ajustes ou mudanca na HML/operacional.

## CPA3: fontes comerciais candidatas para vincular Obras (2026-11-26)

- O catalogo das EMP01–EMP05 identifica `PropostaComercial` com cliente, pedido e item de obra, e `PedidoVenda` / `NotaFiscalSaidas` com cliente, pedido e dois campos candidatos de obra. Na EMP05, `PropostaComercial.EMPRESA` e char. O mestre EXETPS usa cliente, item e sequencia; nao foi demonstrada equivalencia entre esses campos.
- A busca nominal no acervo privado nao encontrou exports CSV/NDJSON das tabelas comerciais consultadas. O pacote de Auditoria contem MDF/LDF, nao exports. As tabelas de corte/dobra no catalogo das EMP ligam por numero de pedido, nao diretamente por cliente e obra.
- Nenhum vinculo novo foi comprovado e nenhuma carga foi gravada. Vinculo de uma venda com determinada empresa nao prova, por si so, a titularidade da obra.

## CPA3: leitura isolada das fontes de Obras na EMP05 (2026-11-26)

- Par EMP05 conferido em duas copias privadas; anexo efetuado somente em terceira copia, no leitor sem rede/portas, limitado a 3 GiB e 0,65 vCPU. O erro 3415 cessou ao permitir escrita do motor somente nos dois arquivos descartaveis. As consultas rodaram com a base em READ_ONLY e o leitor foi parado.
- `PropostaComercial`, `PedidoVenda` e `NotaFiscalSaidas`: zero linhas nessa copia. Recibo privado `obra-emp05.jDrb6O/coverage.private.txt`, SHA-256 `aefacced5b4ffddc3b3bbbfafdf6774e0a931e57281a89fe3cdf7858ae2e942f`.
- Nenhuma chave comercial exportada, nenhum vinculo novo nem escrita na HML ou no operacional. Proximo recorte: EMP03, sem repetir EMP05.

## CPA3: cruzamento comercial de Obras na EMP03 (2026-11-26)

- EMP03 anexada em copia isolada, sem rede ou portas, limitada a 3 GiB e 0,65 vCPU. Consulta em READ_ONLY; leitor encerrado sem OOM. Folga observada: 36 GiB antes e 28 GiB apos. Par e arquivo de origem com hashes privados; hash do arquivo reconferido apos a leitura.
- Propostas: 0 linhas. Pedidos: 250 linhas, 242 com cliente e OBRA positivos. Notas de saida: 231.601 linhas, 226.059 com cliente e OBRA positivos. CODIGOOBRA nao forneceu candidatos positivos com cliente nas duas tabelas.
- Cruzamento por cliente e OBRA contra cliente e ITEM: 33.070 pares unicos e 654 ausentes nas notas; 118 unicos e 2 ausentes nos pedidos. Os conjuntos podem se sobrepor e nao devem ser somados. A correspondencia nao comprova titularidade nem habilita entrega.
- Extrato minimo: 33.844 linhas, 525.690 bytes, SHA-256 `75987cb3422c7ce7181d7cbdb870353809f88c4b190efa6ed899e4b33b7308e2`. Recibo comparativo privado: SHA-256 `f9cde2f3a581b3a5fee27f32dfe4d9c785402337298bab20a7242096ceb48c54`. Nenhuma gravacao na HML ou no operacional.

## CPA3: conciliacao arquivada das Obras da EMP03 (2026-11-26)

- Uniao de notas e pedidos: 33.083 pares unicos no mestre, 105 presentes em ambas as fontes e 656 sem par no mestre. Comparacao por chave completa com a fila privada arquivada: 26.839 encontrados e 6.244 sem entrada. Dos encontrados, 24.600 apontavam para cliente ativo e 2.239 para nao ativo; sao contagens de obras, nao de clientes.
- Na fila, 26.728 locais seguem em revisao e 111 entregas existentes exigem conciliacao. Nenhuma consulta viva a HML, prova de empresa proprietaria, ativacao ou gravacao.

## CPA3: cobertura viva de clientes das Obras da EMP03 (2026-11-26)

- Consulta READ ONLY na HML pelo papel efetivo restrito, sem superusuario nem BYPASSRLS, filtrada pelo Grupo. Entre as 6.244 Obras fora da fila arquivada, uma conciliou com cliente mestre ativo; as outras 6.243 referenciam 4.224 codigos, todos presentes em legacy_client_review por chave nativa. Presenca na fila nao distingue revisao de historico nem autoriza uso como mestre. Nenhuma escrita ou ativacao.

## CPA3: estados dos clientes e completude da Obra candidata (2026-11-26)

- Leitura restrita da HML: das 6.244 Obras fora da fila arquivada, 6.033 apontam para 4.188 clientes em revisao; 210 para 36 clientes apenas historicos; uma para mestre ativo. A candidata tem logradouro, cidade, bairro, UF, CEP e referencia presentes, sem validacao de formato, numero, pais ou empresa. Nenhuma escrita ou ativacao.

## CPA3: verificacao de local da Obra candidata (2026-11-26)

- Consulta restrita e READ ONLY na HML confirmou um mestre ativo para a Obra candidata, sem empresa no cadastro e sem locais visiveis (ativos ou inativos). Na origem, CEP em formato de oito digitos, nenhum ajuste pela chave cliente/item no recorte e presenca em nota e pedido da EMP03. Numero, pais e titularidade seguem nao comprovados; nenhuma escrita.

## CPA3: uso comercial de Obras por empresa na EMP03 (2026-11-26)

- EMP03 isolada em READ_ONLY: 33.739 pares cliente/obra em pedidos e notas; 30.861 com um codigo positivo de empresa, 2.861 com dois, 13 com tres e quatro sem codigo positivo. A candidata com mestre ativo tem 332 notas e sete pedidos, com dois codigos distintos em cada fonte e na uniao. Zero eventos de ControleEntregasPedidos por numero dos pedidos candidatos. Uso comercial nao prova titularidade. Leitor parado, nenhuma gravacao.

## CPA3: chave nativa e escopo fisico de Obras (2026-11-26)

- Catalogo da copia EXETPS em READ_ONLY confirmou PK (CODIGOCLIENTE, ITEM) e indice unico separado em SEQUENCIA. Zero colunas explicitas de empresa/filial/grupo, FKs declaradas, triggers, dependencias SQL catalogadas ou predicados RLS nesta tabela. Isso comprova identidade relacional, nao regra de visibilidade no aplicativo. Leitor isolado parado; nenhuma escrita.

## CPA3: chave do ajuste e cobertura por cliente e item (2026-11-26)

- No catalogo SQL da EXETPS, a PK de ClientesObrasHistoricoAjustes e SEQUENCIA; ha tambem indice unico em (CODIGOCLIENTE, ITEMLOCALENTREGA, SEQUENCIA), sem FK declarada. Pelo par cliente/item, 1.536 eventos encontram 1.214 Obras; 1.560 eventos de 1.029 pares nao encontram o item, embora todos tenham cliente presente no mestre de Obras. Nao forcar vinculo por cliente ou pela sequencia da Obra. Nenhuma escrita.

## CPA3: snapshots e continuidade dos ajustes vinculados (2026-11-26)

- Os pares EXETPS 22881160 e 8f786607 diferem por SHA-256, mas os exports verificados de Obras e ajustes sao identicos entre as duas fontes. Nenhum dos 1.029 pares ausentes foi recuperado. No recorte vinculado (1.536 eventos), as 113 transicoes consecutivas do mesmo tipo coincidem ao remover apenas espacos finais. Foram observados oito tipos; semantica, escopo e autorizacao continuam pendentes.

## CPA3: campos candidatos dos ajustes de Obras (2026-11-26)

- Ultimo evento por Obra/tipo em 1.423 combinacoes vinculadas: texto coincide apos remover espacos finais com ENDERECO (861/861), REFERENCIA (341/341), BAIRRO (96/96), SITUACAO (90/90) e CONTATO (2/2). Duas linhas tinham outro campo tambem coincidente. CEPCLIENTE coincide por digitos (15/15). Dois tipos sem correspondencia (17 e 1). Sao hipoteses, nao dicionario oficial; nenhum numero, pais ou empresa provados.

## CPA3: ajustes compostos de cidade/UF e regiao (2026-11-26)

- Dos dois tipos restantes, um reproduz CIDADE + separador + CODIGOUF em 17/17 ultimos eventos vinculados. O outro tem uma amostra: codigo coincide com ClientesObras.CODIGOREGIAOENTREGA e codigo/rotulo coincidem tanto em ClienteRegiaoEntrega quanto em ClienteRegiao. Isso sustenta candidato a regiao, sem distinguir o cadastro sem prova adicional. Leitor isolado e somente leitura; nenhuma carga.

