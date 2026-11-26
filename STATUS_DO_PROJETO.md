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

