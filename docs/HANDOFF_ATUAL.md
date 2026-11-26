## CPA3: acesso contabil HML e leitura fiscal TIDDF (2026-11-26)

HML a305a143: identidade do banco/schema e papel pinado revalidados somente leitura. plano_contas ausente e papel da API sem SELECT em centros_custo, inclusive coluna id (42501). Proximo: revisar grants por coluna, RLS e parametrizacao real CPA/3Z no clone antes de preparar publicacao.

TIDDF: 7.340.032 bytes transferidos do HD para VPS privada; dois hashes iguais. Leitor isolado READ_ONLY encontrou zero linhas nas tres tabelas de XML fiscal/transporte. Leitor encerrado; sem lotes, deploy ou alteracao operacional. Sem arquivos da tarefa no disco interno.

## CPA3: contrato contabil isolado e Auditoria verificada (2026-11-26)

a470accb r2: nenhum plano_contas em schema do clone. Fixture sintetica com duas Empresas, RLS forcada e FK composta recusou vinculo cruzado; delta Contas a Receber aplicou e reverteu sem titulos. Nao comprova parametrizacao real; sem deploy nem escrita HML.

Auditoria transferida ao canal privado: 336.964.519 bytes, SHA do pacote e dos dois membros conferidos. Leitura isolada: 12.623.711 eventos; filtro de nomes por OBRA encontrou apenas duas tabelas de corte/dobra, sem ClientesObras. Nao inferir titularidade. Leitor desligado; nenhuma carga, exclusao ou escrita no disco interno.

## CPA3: backup de 26/11 restaurado e arvore EXETPS conferida (2026-11-26)

Candidata a470accb r2, CI 45680437810: API do pacote exato conectou ao clone remoto por socket privado com papel restrito e somente leitura; health/ready 200. Backup agendado de 26/11 restaurado e copia externa conferida por SHA. Quatro scripts comerciais passaram e foram revertidos; 17.472 clientes e 16.087 locais preservados. Delta financeiro recusou pela ausencia de plano_contas. Sem homologacao de venda, deploy ou promocao.

Arvore original EXETPS: 1.839 arquivos, 2.438.903.826 bytes, todos equivalentes por caminho, tamanho e SHA; zero reenvios. EMP01-03: 164 fornecedores distintos, 139 no manifesto e 25 em quarentena. EMP01/03 tem 3.300 chaves de titulo sobrepostas sem igualdade nos campos comparados; nao fundir bases. Sem carga ou escrita local interna.

