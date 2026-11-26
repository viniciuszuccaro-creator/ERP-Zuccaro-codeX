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

