## Retomada imediata (2026-11-27)

- **Versão atual `a305a143`:** retorno conjunto e reversão da leitura Produtos confirmados. Em `3f06be54`, expansão da categoria sem consultas e login anônimo confirmados; o botão inicial de Produtos estava desabilitado. Prova posterior em `a305a143` mostrou habilitação depois da hidratação. Na próxima troca, testar a mesma janela com espera explícita pelo contexto, sem tratar loading como negação. Sem escrita de cadastros ou operacional.

- **Nova troca:** `3f06be54` serve API e web; somente SELECT/policy de Produtos no schema da HML. Backup fresco `398b3d0b` restaurado e copiado ao HD com ACK. No Chrome anonimo do proprietario, recarregar Cadastros e validar buscas, paginacao e contexto; a sessao anterior em janela anonima abriu, mas ainda nao e aceite deste SHA. Manter retorno conjunto de API/web e ACL; sem carga ou operacional.

- **Retorno confirmado:** `a305a143` serve API/web. Backup `d94729e5` restaurado (26 tabelas), cópia externa e ACK verificados. Tar `3f06be54` conferido no D: e na área privada da HML, 2.239 arquivos. Primeira troca falhou no entrypoint padrão do Nginx; a segunda serviu o SHA, mas o Chrome bloqueou o login por cota de armazenamento. Retorno dos dois containers e reversão da leitura Produtos confirmados. Não repetir deploy sem preparar o teste de login e revalidar o backup; não limpar o perfil atual sem autorização. Sem carga ou operacional.

- **Acompanhar agora:** [CI 46029813435](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/46029813435) do `d8d3c38fff0d4bf78607e23d812cb36b19867336`. Corrigido o binding do fixture de PerfilAcesso, mantendo permissões e verificações de auditoria; 108 testes focados verdes. Não integrar ou publicar com CI parcial. HML segue `a305a143`; manter o WIP de Dashboard e Fornecedores separado.

- **Retomada pelo GitHub:** acompanhar [CI 46028600217](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/46028600217) do SHA `a5306262c7e165f7b09072db2f61a351f227f1b3`, branch `codex/validacao-ubuntu-cadastros-20261127`. A autorização do proprietário para esse canal é somente validação, sem merge/deploy/escrita, válida até revogação explícita. Não publicar a partir da branch de validação. Depois de todos os checks, preparar a entrega integrada sob a autorização contínua da HML e conferir a CI do SHA a servir. Nenhum deploy nem SELECT novo executado.

- **Retomada do executor:** VM privada desligada; WIP e log `cadastros-corrigida-tcg.log` preservados no disco de trabalho do D:. A sonda q35/WHPX com IRQ chip de kernel desligado iniciou Linux sem disco; a partida com o disco de trabalho foi bloqueada pelo executor. Usar um canal autorizado para iniciar a VM acelerada ou outro Linux privado com Chrome protegido. Não repetir a suíte em TCG como evidência de aceite.

- **Versão servida:** `a305a143` na HML. Retomar a suíte Linux corrigida `erp-cadastros-corrigida` na VM privada do D:. O teste de abertura no Chrome protegido voltou a exceder o prazo; não usar os resultados parciais como gate. Manter WIP de Dashboard separado.
- **Próxima ação:** concluir os checks e a CI do SHA de Cadastros; verificar backup/restauração, cópia externa e retorno. Reutilizar a aprovação do SELECT/policy de Produtos e a autorização de API/web juntas na HML, sem Financeiro/histórico ou mudanças no operacional. Validar com login e registrar link, versão e roteiro.
- **Depois de Cadastros:** implementar e comprovar a publicação automática pelo CI na branch de entrega, conforme `PLANO_GO_LIVE.md` (`59ecc16d`). Não confundir decisão registrada com execução comprovada. VPS final só com aceite do proprietário; cargas e acessos não são parte do deploy automático.
- **Frentes independentes:** preservar a correção do ticket médio no WIP do Dashboard; conciliar indicadores com relatórios no mesmo escopo antes de publicar. Fornecedores `4905483e` ainda exige aceite do escopo compartilhado e escrita específica. Obras e Preços continuam pela comprovação de vínculos; reutilizar os 273 Produtos já conciliados e excluir Clientes dos novos exports Base44. Comercial exige conta e centro aprovados por empresa; não presumir CC011.

## CPA3: gate de publicacao de Cadastros (2026-11-27)

- Retomada da validacao: guardar logs da suite anterior, que rodou sem a correcao das comparacoes historicas. Usar o WIP completo de Cadastros, incluindo a projecao exata de Catalogo e a prova de resposta atrasada; manter o WIP de Dashboard separado. 79 testes focados e prova Chrome Windows passaram. Chrome na VM com sandbox padrao instalou, mas os tres testes iniciais expiraram. Validar em executor Linux capaz de cumprir os limites atuais, sem alterar as protecoes nem contar o teste Windows como CI. HML segue em a305a143; nenhuma aplicacao do grant.

- Aprovacao do proprietario registrada para o delta SELECT/policy de Produtos ja ensaiado, exclusivamente na HML e sem escrita. Reutilizar a aprovacao do mesmo escopo; identificar papel e schema efetivos, conferir os SQLs de aplicacao e retorno e aguardar CI do SHA exato e backup restauravel com copia externa antes de aplicar. API/web juntas; sem cargas, Financeiro/historico ou alteracao operacional.

- Proxima candidata inclui consulta sob demanda no layout e modo de leitura `catalogo=true` na grade de Produtos, sem ativacao operacional. Passaram teste montado, cliente HTTP, PostgreSQL sintetico e prova HTTP no backup restaurado para Grupo/CPA/3Z. O acesso de Produtos exige gate separado: SELECT e uma policy na tabela do schema HML, sem escrita ou fallback public. Aplicacao e reversao ensaiadas no clone; nenhuma permissao atual foi alterada. Checks finais e CI do SHA exato continuam pendentes.

- Aceite autenticado de `c2dcf435`: Grupo CPA -> CPA -> 3Z -> Grupo CPA passou na interface; Clientes paginou e buscou por codigo e nome. Produtos exibiu zero no Grupo. Em recarga limpa sem entidade aberta, CDP registrou GET `/api/v1/clientes` com `limit=500`, antes de qualquer clique. Aceite negativo: API e web voltaram a `a305a143`, com meta, HTML, readiness e rota de login verificados. Nao republicar este SHA. Rastrear disparador no layout e adicionar regressao montando a rota completa. Sem escrita de dados ou operacional.

- Autorizacao explicita do proprietario em 2026-11-27: publicar API e web juntas do SHA `c2dcf43536e12e1abbad1db379056d00af49944c` somente na VPS de teste. Reaproveitar nas retomadas do mesmo pacote, destino e escopo. Tar `runtime-cadastros-c2dcf435.tar` verificado no HD externo; SHA registrado no STATUS. Ensaio de retorno sem banco passou. Revalidar backup, versao servida e retorno antes da troca. Manter Financeiro/historico desligados, sem escrita de dados, DDL ou grants.
- Aceite apos autorizacao: login, Grupo CPA/CPA/3Z, nenhuma listagem antes do clique, busca e paginacao em Clientes/Produtos. Se falhar, retornar API e web juntas para `a305a143`. Nao tocar no operacional.

## CPA3: retomada da adaptacao do Dashboard (2026-11-26)

- Workspace remoto privado `dashboard-integracao.7url9e`: comparar `reference/src/pages/Dashboard.jsx` e seus hooks com `erp/src/pages/Dashboard.jsx`. Manter mesma rota/menu, contexto, permissoes e recursos existentes. Primeiro verificar paridade de Clientes/Produtos com o total canonico de Cadastros; nunca usar tamanho de pagina como total. Depois validar pedidos, alertas e titulos com periodos identicos aos relatorios, duas empresas mesmo Grupo e um contexto externo. Nao copiar fontes dependentes do Base44 diretamente para runtime.
- Gate de Cadastros permanece separado. A publicacao do Dashboard exige pacote completo posterior e aceite proprio. Base44: excluir Clientes do export, paginar cada entidade e conciliar com os 273 Produtos ja gravados. Fornecedores e historico continuam em aprovacoes separadas.

## CPA3: gate de publicacao de Cadastros Gerais (2026-11-26)

- Decisao unica para `a470accb` r2: publicar API e web juntas somente na HML, Financeiro e historico desligados, sem DDL, grants, cargas ou operacional. Antes da troca, backup fresco restaurado, SHA da copia externa e reconferencia do retorno `a305a143`. Se falhar, restaurar as duas imagens/configuracao anteriores e conferir meta, assets, health e login, sem restaurar o banco para um rollback de runtime.
- Aceite autenticado apos troca: abrir Cadastros Gerais sem entidade e sem consultas de registros; medir abertura, busca literal por codigo/nome, duas paginas e reabertura em Clientes e Produtos; repetir ao alternar CPA/3Z, sem salvar. Nao marcar aceite usando HTTP 200, teste sintetico ou versao anterior.
- Pular os quatro conjuntos do diferencial de 84.925 bytes ja conferidos. Base44: consultar dados do app por meio de export autorizado (schema nao e export); nenhum vinculo ClienteEmpresa inferido. Fornecedores 789 continua com gate proprio (aceite compartilhado e autorizacao); nao misturar com o deploy de Cadastros.

## CPA3: pacote de revisao do historico de baixas (2026-11-26)

- Ensaio integral da revisao com cast `text[]` concluido no clone `c33c96f4`. Prova privada local: `integral-proof.log` na area do clone WSL. Nao repetir sem alteracao material. Checks Linux completos aprovados (3.050/3.050). A decisao HML ainda exige CI do SHA exato e revisao do executor especifico, backup fresco restaurado e ACK; ensaio nao altera RBAC HTTP nem constitui autorizacao.

- Prova da consulta de identidade de `c469a045` concluida no backup externo `c33c96f4` restaurado: ambos os logins restritos leram a identidade fisica com as ACLs do dump. Ainda falta executar o fluxo integral dessa revisao no clone e conferir CI remota; nao repetir a carga na HML.

- O executor do clone agora exige pin independente e verifica a identidade antes de cada lote. Proxima prova: rodar esta revisao no backup restaurado com a ACL efetiva, confirmando a leitura de `pg_control_system()` pelo papel restrito; nao aplicar grant na HML. Suite Linux: 3.050/3.050 usando conta comum, Chrome com sandbox ativo.

- Prova de destino em leitura: `supplier-provenance-emp03/supplier-history-target-pin.private.json`, SHA-256 `d752d80541123c0fa54fdb0708d2ff9f2d4a38252d6d05db78d44337c2057427`. A candidata deve falhar antes de qualquer escrita se a identidade divergir, revalidando no inicio de cada transacao. O recibo nao substitui CI, revisao, backup restaurado ou autorizacao de escrita.

- `supplier-provenance-emp03/supplier-history-review-packet.private.json` SHA-256 `ba29c9c8f63138d5a64de20008d9fbe5f9fe3f887e630f1fd36b2d00ab6d653e`. Usar as oito provas fixadas, sem repetir o ensaio. Separar DDL/ACL, carga historica e ativacao HTTP; manter o executor atual restrito ao clone. Antes de deliberar escrita: CI, revisao do executor com identidade fisica pinada, backup fresco restaurado e ACK. Excluir os 107 pendentes.

## CPA3: prontidao do historico de baixas de Fornecedores (2026-11-26)

- Recibo privado `supplier-provenance-emp03/supplier-history-readiness.private.json`, SHA-256 `8ddedc96f553bdbfb9a32f4d07816c828713749ff5f6039f33927420230e89f9`. Nao repetir conciliacao. Para gate futuro, separar tabela/policies/grants, autorizacao da rota e carga do historico. Manter 107 fora, sem baixa ou saldo; nao incluir na publicacao limitada de Cadastros.

## CPA3: diferencial dos pacotes de Auditoria e EMP01/03 (2026-11-26)

- Reusar `obra-auditoria-20261126`, `supplier-provenance-emp01` e `supplier-provenance-emp03` na area privada da VPS. Recortes EMP03 de 12.514 baixas historicas e 12.621 titulos estao identicos no HD/VPS. Nao gerar saldo/pagamento, nao repetir transporte e manter gate do historico financeiro separado da publicacao de Cadastros.

## CPA3: confirmacoes externas dos backups registradas (2026-11-26)

- Backups 063032Z-ab581e69, 113126Z-1b3a3219 e 121355Z-0c2bcc8d com ACK registrado e arquivos preservados no HD e VPS. Essa verificacao fecha a confirmacao externa desses tres, nao o gate de backup fresco para publicar. Nao repetir ACK ou sync sem novo artefato; manter a retencao configurada.

## CPA3: reconciliacao de copias externas e retencao (2026-11-26)

- Para os tres backups de 26/11, preferir ACK individual pelo mecanismo canonico depois de revalidar copia/identidade e efeito de retencao; nao rodar sync completo para mero ACK. O prune da VPS so considera copias fora da janela com ACK valido. Nao remover backups, volumes ou reversoes nesta etapa; gate de publicacao HML separado.

## CPA3: integridade integral da candidata e do retorno (2026-11-26)

- Reusar `runtime-promotion-full-integrity-20261126.private.json`, SHA-256 `5ea4d67de84c133bb892975d4903ec84287865b007ac6946ece886f8fc892e73`. Nao repetir a conferencia sem mudanca de artefato. Proxima acao HML sob gate: renovar backup/restore/copia externa, publicar API/web juntas e validar navegador com acesso autenticado; reverter ambas se falhar.

## CPA3: backup agendado e copias externas conferidas (2026-11-26)

- Backups conferidos no HD em ARQUIVO_HML_VPS_2026-11-26. Ultimo agendado ab581e69 encerrou com sucesso; historico de falha nao descreve a execucao atual. O log do agendador marca externalVerified=false; nao confundir com a conferencia SHA feita no HD. Antes de qualquer publicacao, ainda renovar a protecao conforme gate e confirmar autorizacao especifica.

## CPA3: escopo candidato de publicacao sem mudanca de banco (2026-11-26)

- Para gate HML de Cadastros: candidata a470accb r2 (06d13aab), retorno a305a143 com imagens pinadas; backup fresco restaurado e copia externa conferida. Manter identidade fisica, Auth e RBAC; nao ligar financeiro/historico, carregar dados ou executar migrations. Aceitar somente se API/web no SHA, login/contexto CPA/3Z, nenhuma listagem antes do clique, pagina seguinte e reabertura somente leitura funcionarem; reverter ambos se falhar. Fornecedores fica fora do pacote.

## CPA3: versao servida e candidata integrada verificadas (2026-11-26)

- Recibo privado `runtime-promotion-readonly-20261126.private.json` SHA-256 `e4a290997de76a2d13e50ebbff9ecde10885f887c861de9147829278218fd08e`. a470accb r2 tem rotas financeiras/historicas com gates de schema e ACL separados e nao inclui os commits posteriores de Fornecedores. Nao promover automaticamente. Proxima decisao: pacote de versao geral com escopo de HML declarado, backup fresco e reversao; mesmo SHA API/web, aceite autenticado sem carga.

## CPA3: evidencia transacional de unidade dos materiais (2026-11-26)

- Recibo privado `obra-emp03.ZaaNbi/price-material-transactional-unit-evidence.private.txt` SHA-256 `2ada5c33f352eaffd1adc625d1ad9350bc4b3b65e770fc72d1473dd2916df2de`. Nao usar peso ou contagem de nota como fator: a unidade comercial de destino nao aparece nesse recorte. Manter 27 eventos sem conversao ate fonte especifica e priorizar outro dominio autorizado. Nenhuma escrita.

## CPA3: unidade e fator nativo dos materiais de Precos (2026-11-26)

- Recibo privado `erp344-reader-20261125T165731Z/price-history-material-factor.private.txt`, SHA-256 `f5d8d7fdcf8b2d1310b271ba6f44a039187b5f2df296ade0f1628a22b2b0ff01`. Nao repetir o cadastro nem usar fator 1/peso cadastral. Se houver documento comercial com o mesmo material e quantidades nas duas unidades, validar regra, precisao e coerencia por empresa. Manter os oito candidatos literais separados.

## CPA3: terceiro diferencial e conversao de unidades (2026-11-26)

- Recibo privado `erp344-reader-20261125T165731Z/price-history-unit-conversion-coverage.private.json`, SHA-256 `3fd6cc7733f11cfb0f366b85de9789162a8d262be9dd8b08807406cbe058c426`. Para os 27, exigir fator nativo especifico do produto/material e unidade comercial, nao assumir fator 1. Pular os seis conjuntos LEGADO-CLASS/FIELD/FIRST/MATERIAL/PRIORITY conferidos. Manter gate de 789 Fornecedores separado.

## CPA3: gates tecnicos dos 789 Fornecedores conferidos (2026-11-26)

- Separar a decisao de escopo compartilhado dos 789 sem empresa proprietaria da autorizacao do manifesto/delta. Contrato do backend: visualizar para consulta; importar+criar no Grupo para aplicacao; inativar no Grupo para reversao. Usar perfil e janela minimos apenas se autorizados, sem wildcard. Pacote revisado e CI conferidos; revalidar destino, backup/restore externo e folga no gate de escrita.

## CPA3: segundo diferencial HD/VPS e gate de Fornecedores (2026-11-26)

- Nao repetir os seis conjuntos LEGADO-ALLOWED-*, MATERIAIS-FORA-REVENDA e UNIDADES-*. Proxima decisao de Fornecedores: confirmar 789 como cadastro compartilhado pelo Grupo CPA para empresas autorizadas, sem presumir empresa proprietaria. Depois fechar papel, policies/flag, backup atualizado e pedir autorizacao do manifesto/delta exatos; nenhum gate implicito. Continuar inventario diferencial apenas para insumos ainda necessarios.

## CPA3: Cadastros sob demanda em Chrome isolado (2026-11-26)

- Reusar `tests/cadastros-abertura-mounted.test.js` com `CADASTROS_COMPARE_BASE=a305a143`. A prova sintetica e positiva para carregamento sob demanda; falta capturar navegador autenticado, paginacao e tempos reais. Nao pedir dados de login no chat nem repetir comparativo sem mudanca do SHA. Manter autorizacoes de atualizacao HML separadas.

## CPA3: contrato de leitura candidato dos oito ajustes de Precos (2026-11-26)

- Recibo privado `erp344-reader-20261125T165731Z/price-history-8-read-contract.private.json` SHA-256 `adaccaf56c8be8ef238f8b43bb362a00d3a4cce07e5e7114704c803bc385a1e9`. Prototipo com registros de referencia isolados, nao ACL da API nem consolidacao do Grupo. Para promover, definir origem/escopo e testar ACL efetiva em clone restaurado; sem ativar tabela ou preco. Avancar frente independente de Cadastros se o gate de historico nao estiver resolvido.

## CPA3: oito ajustes de Precos e migration 013 no clone (2026-11-26)

- Pacote historico `erp344-reader-20261125T165731Z/price-history-8-candidate.private.ndjson` SHA-256 `0e1f390e5a5b04f6c64e2cd08ae240971f97cb3920b6fd0d96a1e408d3e91f72`. Recibo 013 em `price013-rehearsal.BbcS3m/proof.private.txt` SHA db663141. Nao usar tabelas operacionais nem auditoria original como destino. Verificar contratos genericos de historico antes do delta minimo; ACL/escopo, uso da empresa historica e gate continuam separados.

## CPA3: vinculos de Produtos e unidades no clone restaurado (2026-11-26)

- Recibo privado `price-history-context.vlR416/context.private.json`, SHA-256 `f8043780817067c0516ceb8c9a47210c3b53e95cd0654024aa894ae529459273`. Avaliar oito candidatos historicos pelo contrato definitivo; para os 27, buscar unidade historica e fator de conversao comprovado. Usar preflight dos 360 com SHA fixado, nao CSV antigo sem IDs da selecao. Nao usar empresa do Grupo como autorizacao, nem ativar preco.

## CPA3: cobertura de Produto e Empresa do historico de precos (2026-11-26)

- Recibo `erp344-reader-20261125T165731Z/price-history-context-coverage.private.json` SHA-256 `b5ef918b0b48e093fcc15af8487ddd6c2fb6d14a72d431b5d4f35a47d79fe77d`. Priorizar os 35 eventos no clone restaurado para cruzar IDs originais, unidade e empresa historica. Nao ampliar grants na HML, nao inferir regra vigente de uso passado, nao repetir ensaio de staging. Validar destino canonico antes de qualquer gate.

## CPA3: ensaio em escala do historico de precos (2026-11-26)

- Recibo privado `erp344-reader-20261125T165731Z/price-history-pg-rehearsal.private.json`, SHA-256 `c91b5725d48133301750a689fd6c07e186cd7ac656a999c0a10e4c58c36e43e5`. Prova de staging descartavel, nao contrato canonico nem ACL da fonte de ensaio. Ainda comprovar produto, unidade, escopo e destino do historico; nenhum preco vigente, deploy, escrita ou gate concedido.

## CPA3: manifesto candidato de historico de precos (2026-11-26)

- Reusar `erp344-reader-20261125T165731Z/price-history-candidate.private.ndjson`, SHA-256 `1b2975a3f4e6745995eb2a5484934ea657dafa4f07b5d0b1f46c2abdd554e5f6`. Testar em clone com checkpoints e reversao apenas como historico; confirmar semantica nativa, escopo e destino canonico. Nao ativar preco nem apagar os eventos excluidos; fonte integral continua preservada.

## CPA3: historico de precos extraido na VPS privada (2026-11-26)

- Reusar `erp344-reader-20261125T165731Z/price-adjustment-export.private.ndjson`, SHA-256 `ff82826a94ab3c16b039a30dc392a8c952cd19d577f1b36ae7cd992d4e86ea9c`. Conferir cadeia e semantica dos dois tipos, conciliar historico por chave composta e manter os 394 em revisao. O pareamento do item no legado nao comprova Produto/empresa na HML. Nao repetir extracao.

## CPA3: primeira conferencia diferencial HD e VPS (2026-11-26)

- Pular os quatro conjuntos ja conciliados: 03_EXPORT_STAGING e os diretorios LEGADO-SQL-EXTRACT-20261009T145158Z, MATERIAIS-CLASSES-20261009T160500Z e MATERIAIS-DEPENDENCIAS-20261009T155000Z sob 03_STAGING. Ampliar o diferencial para os artefatos necessarios ainda nao cobertos. Prosseguir com gate de Fornecedores e extrato historico de Precos; validar Cadastros sob demanda em navegador, sem confundir os testes focados com a HML.

## CPA3: retomada integrada e primeira versao geral (2026-11-26)

- Executar a secao de 26/11 em PLANO_GO_LIVE.md. Agora: inventario diferencial da primeira copia do HD e indices privados da VPS; transferir somente faltantes verificados. Em paralelo, reproduzir Cadastros na candidata e na HML sem listagem antes do clique; aproveitar os testes existentes. Obras permanece sem vinculo comprovado; preparar historico de Precos e fechar gate dos Fornecedores sem reaplicar lotes ja conciliados.

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

## CPA3: proxima prova nativa de Obras (2026-11-26)

- A normalizacao de espacos finais recuperou 238 de 431 transicoes do mesmo tipo; nao prova a semantica dos 8 tipos nem resolve as 193 divergencias restantes.
- Buscar export nativo ou dicionario de `TIPOALTERACAO` e vinculo oficial de Obra com Empresa ou Grupo. So depois revalidar as chaves candidatas e ensaiar o conjunto apto em clone. Nao usar nome da base, ordem da lista ou proximidade textual como prova.
- Usar o recibo privado do STATUS; nao repetir o leitor malsucedido ou publicar dados de origem.

## CPA3: prova por proposta, pedido e nota (2026-11-26)

- No leitor isolado, priorizar as colunas de chave de `PropostaComercial` (empresa, cliente, item de obra, pedido), `PedidoVenda` e `NotaFiscalSaidas` (cliente, pedido, obra e codigo de obra). Examinar tipos, nulidade, cardinalidade e chaves nativas antes de exportar; mapear o identificador de empresa por fonte oficial, nao pelo nome da base.
- Cruzar separadamente cada campo candidato com a chave mestre de Obras, sem coercao que descarte precisao. Isolar ambiguidades, itens sem sequencia comprovada e obras usadas por mais de uma empresa. Uso comercial e propriedade do cadastro sao provas distintas.

## CPA3: retomar as chaves comerciais na EMP03 (2026-11-26)

- Pular a copia EMP05 ja aferida: as tres fontes candidatas estavam vazias. Validar o pacote privado `supplier-provenance-emp03/emp03.tar.gz`, capacidade e integridade; restaurar apenas em leitor isolado e medir as tres tabelas antes de exportar chaves.

## CPA3: retomar os pares comerciais de Obras da EMP03 (2026-11-26)

- Reusar `keys.private.psv` e `comparison.private.json` no diretorio privado `obra-emp03.ZaaNbi` sob a area de recuperacao. Nao reabrir EMP03 apenas para repetir estas contagens.
- Cruzar os pares unicos com o indice existente de clientes destino e a chave mestre completa. Provar a identidade comercial da empresa por identificador nativo e verificar uso cruzado em outras EMP. Manter separados uso em nota/pedido, titularidade da obra e aptidao de entrega. Nao autorizar escrita por correspondencia numerica.

## CPA3: retomar a conciliacao das Obras da EMP03 (2026-11-26)

- Reusar `review-crosscheck.private.json` em `obra-emp03.ZaaNbi`, SHA-256 `1bcb0f56cda6124982a26adb78379fb99b442428e6075605d624d44223c905b9`. Nao repetir a extracao da EMP03.
- Conferir as 6.244 chaves ausentes contra um indice atual por cliente e chave nativa; nao presumir cliente ausente nem reaplicar entregas existentes. Provar empresa por identificador oficial e distinguir titularidade de uso comercial antes do ensaio.

## CPA3: cobertura viva de clientes das Obras da EMP03 (2026-11-26)

- Reusar os recibos privados live-client-coverage e live-review-coverage em obra-emp03.ZaaNbi (SHA-256 do ultimo: 137602f3ce2ea00ff1becc2ab5036ed66e94d6d9cd0c73a726161c1b6617c8aa). Priorizar a validacao da empresa e dos campos de entrega da obra com mestre ativo. Nas 6.243 restantes, classificar revisao versus historico e manter o gate de cadastro mestre. Nao reextrair EMP03.

## CPA3: estados dos clientes e completude da Obra candidata (2026-11-26)

- Recibo privado `obra-emp03.ZaaNbi/live-review-states.private.json`, SHA-256 `6b3be5f3c186eba0fc65769808dcd7a8088b8ada29b4dbd4b90df8d1a2f57764`. Reusar a chave privada da candidata para procurar numero e pais em fonte nativa e provar titularidade ou regra de Grupo. Manter as 6.033 em revisao e as 210 historicas fora da carga operacional; nao repetir a consulta nem promover clientes da fila.

## CPA3: verificacao de local da Obra candidata (2026-11-26)

- Recibo privado `obra-emp03.ZaaNbi/candidate-location-check.private.json` SHA-256 `ed5135f76e8a7958e94f618d19bef956d2c63616223fda84f0f1ba42ad0485ac`. Buscar comprovante nativo de entrega ou regra oficial de escopo. O mapa Base44 conferido liga empresas Base44/HML e nao prova o escopo da Obra TID. Nao promover pelo texto do logradouro ou pelo uso comercial.

## CPA3: uso comercial de Obras por empresa na EMP03 (2026-11-26)

- Recibo privado `obra-emp03.ZaaNbi/commercial-company-coverage-v2.private.txt`, SHA-256 `6301456499da41dbe863e3900f5d06391306cd584a631624478fd0a6b3a95f18`. Aguardar a prontidao da base ObraEvidence, nao apenas do servidor, se precisar reabrir. Buscar cadastro/regra nativa de titularidade ou de compartilhamento; nao atribuir pelo primeiro pedido, pela nota ou pelo nome da base.

## CPA3: chave nativa e escopo fisico de Obras (2026-11-26)

- Recibo privado `erp344-reader-20261125T165731Z/obra-native-scope-metadata.private.txt`, SHA-256 `9fcb08d0697ec51b9203c37e009b1dbbb1569f0e15c682e5cc122df73b89de2a`. Reavaliar os ajustes pela PK cliente/item; comparar SEQUENCIA separadamente, sem tomar ausencia de match triplo como falta da Obra ou usar a sequencia do evento como ID da Obra. A regra de Grupo deve ser comprovada no aplicativo ou em documentacao oficial.

## CPA3: chave do ajuste e cobertura por cliente e item (2026-11-26)

- Recibos privados `obra-adjustment-native-key.private.txt` (3731b35a) e `obra-adjustment-pk-coverage.private.json` (a8e724b8) no pacote `erp344-reader-20261125T165731Z`. Priorizar os 1.536 vinculados para validar ordem e tipos; procurar os 1.029 pares ausentes em snapshots anteriores. Preservar a sequencia nativa do evento, distinta da sequencia da Obra. Nao aplicar sem prova de escopo e gate.

## CPA3: snapshots e continuidade dos ajustes vinculados (2026-11-26)

- Recibo privado `erp344-reader-20261125T165731Z/obra-adjustment-historical-coverage.private.json`, SHA-256 `060825f0fce33c6cdb164b9788ec2636cfc3910ab8d3f822d2ae8f94531e6d40`. Nao repetir a extracao dos dois pares EXETPS ja contrastados. Buscar snapshot de cobertura diferente ou export de itens historicos para os 1.029 pares; para os vinculados, buscar dicionario oficial dos oito tipos antes do ensaio.

## CPA3: campos candidatos dos ajustes de Obras (2026-11-26)

- Recibos privados no pacote `erp344-reader-20261125T165731Z`: `obra-adjustment-field-hypotheses.private.json` (157c1147) e `obra-adjustment-field-numeric-check.private.json` (f432d54d). Confirmar os seis tipos candidatos com amostra nativa ou regra oficial e isolar os dois sem mapa. Preservar a representacao original e nao aplicar historico como mudanca cadastral. Nenhuma escrita.

## CPA3: ajustes compostos de cidade/UF e regiao (2026-11-26)

- Recibos privados `obra-adjustment-city-uf.private.json` (fbee459b) e `obra-adjustment-region-candidate.private.txt` (a170d804) no pacote `erp344-reader-20261125T165731Z`. Sete tipos tem correspondencia forte de campo; o oitavo possui evidencia unica e duplicidade de cadastro. Nao converter regiao automaticamente. Manter semantica oficial, escopo de Grupo/Empresa e gate de escrita separados.

## CPA3: manifesto candidato do historico de Obras (2026-11-26)

- Reusar `obra-adjustment-history-rehearsal.private.ndjson` (2a9c9d8f) e recibos privados no pacote `erp344-reader-20261125T165731Z`; recibo de replay offline 4a5d3feb. A migration 012 contem Obras, vinculos de empresa e locais, sem destino especifico para este historico no recorte conferido. Verificar staging canonico antes de propor delta minimo. Ensaiar somente em clone, sem reescrever cadastro ou forjar auditoria operacional.

## CPA3: ensaio PostgreSQL do historico de Obras (2026-11-26)

- Recibo privado `obra-adjustment-history-pg-staging.private.json`, SHA-256 `c7e2a2d3f482aeb68c5e83869e63bd4e203b80abbb4bed83f81c655ac9a82136`. Staging descartavel valida mecanismo SQL, nao o importador canonico, a reversao de lotes confirmados, nem ACL da fonte (insumo exclusivo do ensaio). `staging-persistence.mjs` atual e especifico de Cliente. Proximo: avaliar contrato canonico de historico/ledger com escopo comprovado, sem usar auditoria como destino de eventos antigos.

## CPA3: reversao pos-commit do historico de Obras (2026-11-26)

- Recibo privado `obra-adjustment-history-pg-reversal.private.json`, SHA-256 `89bf0e22af7116a6bb3459fed10530c7bcc6fa0db43cdfa975fca4233b9a0c66`. `legacy_client_review` e `legacy_supplier_settlement_history` sao especificos de outros dominios; reusar o padrao, nao as tabelas. Prova SQL descartavel, nao contrato canonico. Falta comprovar escopo de Obras e validar destino/minimo delta em clone restaurado antes de qualquer gate.

## CPA3: migration canonica de Obras em backup restaurado (2026-11-26)

- Recibos privados em obra012-rehearsal.gT9epo (baseline 9f2647d1, migration 16639b6f, rollback 00214e5c). Para repetir, usar volume descartavel em disco; tmpfs de 640 MiB falhou em audit_logs. Usar somente roles NOLOGIN derivadas dos nomes do backup quando restaurar sem ACLs. Proximo: ensaiar ACL minima e vinculos ClienteEmpresa/ClienteLocal no clone; definir e validar destino historico sem usar auditoria como fonte.

## CPA3: ACL e integridade dos vinculos canonicos de Obras (2026-11-26)

- Recibo privado `obra012-acl.D2Fz1h/acl.private.txt`, SHA-256 `a1f108211a93eb0aca5159ad63cfb7b825a2f19471e63076372dfdd707798a74`. Papel generico nao herda RLS de clientes; usar identidade nominal da aplicacao NOLOGIN no clone. Policies do ensaio cobrem Grupo, nao validam empresa/perfil/app completos. Buscar fonte oficial para ClienteEmpresa e escopo de Obras antes de incluir vinculos reais ou historico. Nao fabricar vinculos/ativar locais.

## CPA3: fontes nativas de ClienteEmpresa (2026-11-26)

- Recibo privado `erp344-reader-20261125T165731Z/cliente-empresa-native-coverage.private.txt`, SHA-256 `cbbefcb66f163d0e1590899a79e9ea9fe8aa3df3ef4c99ce453a828aa99e2c95`. Nao inferir ClienteEmpresa por CODIGOGRUPO nem parametros de credito. Procurar export especifico de vinculos ou regra nativa de acesso; propostas, notas, cheques e conta corrente demonstram contexto de operacao e nao substituem o cadastro. Reusar ClienteEmpresaOperations quando houver fonte e gate.

## CPA3: cobertura Base44 de vinculos ClienteEmpresa (2026-11-26)

- Recibo privado `obra-emp03.ZaaNbi/base44-client-link-coverage.private.json`, SHA-256 `e616c376db51abcf81c6cca343d6d92e5f0205210ecefef86cc680af992a637c`. Pacotes Base44 conferidos nao contem export ClienteEmpresa. Nao usar campos divergentes nem extrapolar a visibilidade de um registro. Para destravar, falta export nativo ou regra oficial de ClienteEmpresa e de Obra; manter a fila e evitar consultas ja encerradas.

## CPA3: vigencia candidata e chaves dos precos do legado (2026-11-26)

- Recibo privado `erp344-reader-20261118T170353Z/catalog-native-r2/price-validity-clarion-candidate.private.json`, SHA-256 `2c4731a2bd6543478af54209a9452ffd2dfeb1471a785efb52ae3121f3efdd55`. Confirmar DATAINICIAL/DATAFINAL em tela/export nativo antes de converter; verificar tabela por Empresa e o mapa de Produto/unidade. Zero/nulo de promocao permanece sem vigencia. Sobreposicao entre tabelas nao prova colisao na chave do destino.

## CPA3: fontes nativas independentes de vigencia de Precos (2026-11-26)

- Recibos privados `price-native-date-evidence.private.txt` (64887cca, pacote EXETPS) e `price-commercial-date-evidence.private.txt` (bd99cb7a, obra-emp03.ZaaNbi). Nao repetir esses comparativos. Buscar tela/relatorio do legado com datas de cabecalho e regra atual por empresa. Avaliar 48.866 ajustes de itens como historico separado, sem presumir vigente.

## CPA3: aceite autenticado de Cadastros r2 (2026-11-26)

- HML serve `a470accb` r2. Na mesma aba apos login com a conta existente: CPA e 3Z, menu Cadastros sem entidade aberta, inspecionar requisicoes antes do clique, abrir Clientes e Produtos, buscar codigo/nome, paginar e reabrir. Nao salvar. Se falhar a publicacao, parar runtime novo e reativar os dois containers preservados `-rollback-a305a143-r2`, conferir meta, HTML, readiness e login. Nao restaurar o banco para rollback de runtime.
- Provas privadas na janela `cadastros-r2.nP2EvD`; backup fresco tambem no HD externo com ACK. Dashboard segue no checkout remoto `dashboard-integracao.7url9e`, separado da HML servida.

## CPA3: retorno a305a143 e bloqueio de contexto

- A HML voltou a `a305a143` apos aceite negativo; nao republicar a470accb r2 antes de explicar o bloqueio tambem reproduzido na versao anterior. Revisar resposta de validacao de empresa na sessao real, sem expor token nem ampliar permissao. Depois repetir CPA/3Z, Clientes/Produtos e prova de rede. O r2 esta parado e preservado; banco e backup nao foram restaurados sobre a HML.
- Dashboard separado em `dashboard-integracao.7url9e`: cabecalho e validacao da contagem em WIP; 18 testes focados remotos passaram. Proximo recorte: contagem oficial e estado indisponivel na interface.

## CPA3: retomar validacao da correcao de cota

- Correcoes de sessao e Dashboard devem permanecer em lotes separados. `dashboard-integracao.7url9e` guarda o WIP remoto e logs privados; Chrome da VPS depende de bibliotecas privadas e recusa iniciar como root com sandbox. WSL existente esta no C: (nao usar para esta rodada). Revalidar em executor privado com Chrome protegido e dependencias do servidor, fechar suite, CI e candidata completa; nova publicacao exige autorizacao associada ao pacote exato.

## CPA3: sessao validada com Chrome protegido

- Runner privado remoto `/var/tmp/erp-chrome-private.0xUBFx`: Chrome com sandbox e usuario sem privilegios, log `full.log` com 3.051/3.051. Este pacote precisa de CI exata e build canonico fora da VPS compartilhada; `package-hml-runtime.mjs` bloqueia esse host. Imagem oficial Ubuntu verificada no D:, sem iniciar WSL nem mudar configuracao global de swap. Sem deploy.

## CPA3: Dashboard com totais de Clientes e Produtos

- Lote separado de Cadastros: reaproveita contagem oficial, filtro por contexto, rota, atalhos e protecao existente. Depois da CI exata, testar comparacao com Cadastros em Grupo/CPA/3Z e acesso negado. Indicadores de operacoes e pacote completo ficam pendentes. Nenhum deploy; HML a305a143 e pacote de sessao c2dcf435 continuam independentes.

## CPA3: proxima publicacao de Cadastros (2026-11-27)

- Empacotar `c2dcf435` na branch `codex/cadastros-hml-c2dcf435` em executor privado; CI 45882138846 verde. VM do D: aguarda inicio autorizado. Backup agendado `hml-20261127T063010Z-5a0c4d7b` ja tem copia externa e ACK; nao repetir transferencia. Revalidar estado e backup antes da janela de deploy. HML continua `a305a143`.

## CPA3: proximo gate de historico de precos (2026-11-27)

- Reusar prova sintetica de consolidacao por lista autorizada. Na candidata, a lista precisa vir da autorizacao no servidor por requisicao, nunca do navegador; repetir o contrato com ACL efetiva no clone e reconciliar os oito eventos legados separadamente. Precos vigentes e HML intocados.

## CPA3: proximo export do ERP Integra (2026-11-27)

- Conector Base44 confirmou count e v2/list com cursor. Recorte privado `base44-export-20261127/fornecedor-identity.private.json`: 4/4 visiveis, duas paginas, nao repetir. Proximo: projetar IDs, codigo/unidade/grupo/setor/empresa e estado dos Produtos; paginar e reconciliar com os 273 sem duplicar. Excluir Clientes e manter os 789 do legado separados. Totais visiveis nao provam cobertura fora do acesso atual.

## CPA3: continuar catalogo Base44 por vinculo (2026-11-27)

- Consultar `base44-export-20261127/produto-identity.private.json` e `produto-reconciliation-v2.private.json`. Nao reexportar os 871 nem repetir os 273. Priorizar os 221 com referencias presentes: reconciliar entidades relacionadas por ID original e codigo, Empresa autorizada e unidade canonica; separar 323 sem atribuicao de Empresa sem presumir vinculo. Contagens de pendencias nao sao mutuamente exclusivas. Sem escrita antes de clone, manifesto e aprovacao especifica. Clientes fora do export.

## CPA3: lacuna de GrupoProduto e Setor no Base44 (2026-11-27)

- Nao repetir a exportacao dos 871 ou das quatro entidades referenciadas. Provas privadas em `base44-export-20261127`: `product-references.private.json`, `produto-221-reference-gates.private.json`, `produto-221-crosswalk-coverage.private.json`. Proximo: recuperar export historico/mapa oficial dos 55 IDs de GrupoProduto e nove de Setor ausentes; validar os 92 candidatos de Setor e os 87 Produtos do preflight anterior sem inferir por nome/codigo. Nenhum dos 221 apto a carga nesta prova.

## CPA3: nao repetir busca de Setores e Grupos na lixeira (2026-11-27)

- `base44-export-20261127/produto-221-historical-ids.private.json` fixa os 151 Produtos com Setor historico, Grupo e Empresa coincidentes na origem. Manter outros 70 em revisao de escopo. Proximo: buscar outro snapshot nativo para os 55 IDs GrupoProduto; o CSV de recuperacao e a lixeira ja foram conferidos. Validar estado e ACL no clone apos o vinculo de Grupo; nenhuma escrita autorizada por esta prova.

## CPA3: retomar crosswalk historico dos Grupos (2026-11-27)

- `base44-export-20261127/produto-221-native-may-snapshots.private.json` e `produto-221-native-may-target-coverage.private.json`: priorizar os 43 com Grupo e Setor historicos ativos e escopo Setor comprovado. Validar em clone o mapa ID historico -> ID conciliado de Grupo com Grupo/Empresa, estado e procedencia; codigo literal unico sozinho nao aprova identidade. 83 dos 221 ainda sem ID Grupo historico no acervo consultado. Nao repetir export nem gravar na HML.

## CPA3: recorte de 43 Produtos em revisao (2026-11-27)

- `base44-export-20261127/produto-43-group-comparison.private.json`: os cinco GruposProduto do destino candidato estao inativos na origem atual e no pacote aplicado. Nao repetir o ensaio do mesmo recorte ou propor ativacao automatica; exigir fonte de uma classificacao ativa correta ou regra explicita para preservacao historica separada. Prosseguir por recortes independentes.

## CPA3: preservar os 13 Centros conciliados (2026-11-27)

- Recibos em `base44-export-20261127`: `centro-custo-reconciliation.private.json`, `conta-3-1-01-centros-source-proof.private.json`. Nao repetir importacao; o 14o nao tem Empresa comprovada. Para a venda da CPA, buscar documento/rateio nativo, nao usar CC011 por disponibilidade nominal nem a conta de Grupo como regra autonoma de Empresa.

## CPA3: proximo passo do Plano de Contas (2026-11-27)

- Export e conciliacao em `base44-export-20261127/plano-de-contas-identity.private.json` e `plano-de-contas-reconciliation-v2.private.json`. Nao repetir export nem misturar `codigo` sequencial com `codigo_conta` contabil. Reusar os 21 do preflight para ensaio de arvore fechada conforme contrato; preservar quatro pais ausentes em revisao e exigir parametrizacao comprovada antes de usar contas de Grupo em venda por Empresa. CC011 continua fora.

## CPA3: preservar arvore historica sem parametrizar empresa (2026-11-27)

- `base44-export-20261127/plano-21-tree-rehearsal.private.json` confirma arvore fechada, reexecucao idempotente e bloqueios no staging. Nao repetir como se validasse o financeiro real: a API de Pedido exige plano da Empresa responsavel. Proximo: confirmar documento/rateio nativo e parametrizacao por Empresa antes de ensaiar a venda real; CC011 permanece fora.

## CPA3: prova pendente para centro da venda da CPA (2026-11-27)

- Nao repetir os seis titulos visiveis do Base44: `base44-export-20261127/receivables-center-and-plan-coverage.private.json` confirma ausencia dos tres vinculos no recorte. A copia isolada EMP05 tambem retornou zero linhas nas duas tabelas de rateio. Nao repetir nesse snapshot nem o ensaio tecnico da CPA ja registrado. Buscar export ou parametrizacao nativa que vincule a venda ao centro e a Empresa por ID. CC011 segue fora.

