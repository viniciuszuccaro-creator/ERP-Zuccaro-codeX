## Frontend Dashboard: rodada 5 da revisao Bugbot no PR #601 (2026-11-28)

- **Objetivo:** corrigir a regressao de datas em meia-noite UTC introduzida pela rodada 4 (Bugbot `8d6dcb8f`).
- **Causa:** datas `date` do SQL chegam como `YYYY-MM-DDT00:00:00Z`. A conversao local as deslocava para o dia anterior em UTC-3, e os limites `YYYY-MM-DD` as excluiam do periodo. A rodada 4 propagou o mesmo problema aos quatro relatorios.
- **Corrigido:**
  - `dashboardKpiPolicy.js`: `parseSqlUtcMidnightDate` trata `YYYY-MM-DDT00:00:00(.000)Z` como dia de calendario; usado em `toComparableLocalIsoDate`, em `isDashboardReceivableOverdue` e na semana do Dashboard. Instantes reais continuam no dia local.
  - Novo export `isDateInCalendarRange(raw, dataInicio, dataFim)` no mesmo modulo, usado por `RelatorioVendas`, `RelatorioEstoque`, `RelatorioDRE` e `RelatorioProducao` em vez de `new Date(...)` com limites locais. Os relatorios e o Dashboard passam a usar a mesma regra.
- **Limite conhecido:** um `created_date` gravado exatamente em `00:00:00.000Z` cai no dia UTC, nao no local. Aceito por ser raro; registrado para revisao se o contrato de dados mudar.
- **Testes:** `tests/dashboard-overhaul-contracts.test.js` ganha casos para meia-noite UTC no primeiro dia da janela, vencimento de meia-noite UTC, instante real local e a semana do Dashboard.
- **Validacao:** `npm test` 3079/3079 em `TZ=America/Sao_Paulo`; teste direcionado tambem em `TZ=UTC`; build, typecheck, `audit:baseline`, `git diff --check` e lint (0 erros, 2 warnings preexistentes).
- **Proximo passo:** aguardar nova revisao do PR #601.

## Frontend Dashboard: rodada 4 da revisao Bugbot no PR #601 (2026-11-28)

- **Objetivo:** corrigir divergencias entre o Dashboard e os drill-downs de Relatorios (intervalo da semana e contador de aprovacoes).
- **Corrigido:**
  - Intervalo de datas: `RelatorioVendas`, `RelatorioEstoque`, `RelatorioDRE` e `RelatorioProducao` passam a iniciar o filtro em `new Date(filtros.data_inicio + 'T00:00:00')` (meia-noite local, como o fim `T23:59:59`). Antes, `new Date('YYYY-MM-DD')` era meia-noite UTC e incluia registros das 21:00 do dia anterior em UTC-3. Isso afetava todos os periodos, nao apenas a semana.
  - Aguardando Aprovacao: chip, lista e drill-down usam o mesmo predicado do periodo (`pedidosPeriodo` com `status === 'Aguardando Aprovação'`). A lista exibe no maximo 8 itens e mostra "Exibindo X de Y no periodo" quando Y > 8.
  - Decisao registrada: o predicado de aprovacao passa a ser somente por `status`. O antigo `status_aprovacao === 'pendente'` saiu da previa do Dashboard para bater com a contagem do drill-down. Se o negocio exigir os dois criterios, a mudanca precisa ser decidida antes de reintroduzir o campo.
- **Estruturas reutilizadas:** `pedidosPeriodo` do hook de KPIs existente, `dashboardKpiPolicy` e os relatorios existentes. Nenhum arquivo novo.
- **Multiempresa/RBAC/auditoria:** sem mudanca de escopo. Listas continuam vindas de `filterInContext` (groupId/empresaId).
- **Helper de pin:** `tests/helpers/restoreDashboardCadastroCounts.js` espelha o novo bloco de aprovacao e a linha de "Exibindo X de Y".
- **Testes:** novos casos em `tests/dashboard-overhaul-contracts.test.js` para `T00:00:00` nos quatro relatorios e para o predicado unico de aprovacao no Dashboard.
- **Validacao:** `npm run typecheck`, `npm run build`, `npm run audit:baseline`, `git diff --check`, testes direcionados em `TZ=America/Sao_Paulo` e `npm test` (3076/3076). `npm run lint` sem erros (2 warnings preexistentes).
- **Pendencias:** mesmas da rodada anterior (contraprova React montada dos KPIs, endpoint oficial de agregados do Codex, verificacao de sessao/queryKey e revogacao em `CadastroEntitySelect`). Datas somente-data em `data_pedido` (ex.: `2026-11-20`) continuam sendo interpretadas como UTC pelo `new Date(...)` dos dois lados; isso e consistente entre Dashboard e relatorios, mas merece revisao de contrato de dados.
- **Proximo passo:** aguardar nova revisao do PR #601.

## Frontend Dashboard e Cadastros Gerais: correcoes da revisao Bugbot/Codex no PR #601 (2026-11-28)

- **Objetivo:** corrigir os achados de revisao automatica do PR #601 sobre KPIs do Dashboard e seletor de cadastro.
- **Corrigido:**
  - Aguardando Aprovacao: contador do KPI e do chip agora usa a contagem do periodo (`status === 'Aguardando Aprovação'`), alinhada ao drill-down; deixou de ser limitada a 8 itens.
  - Semana: `filtrarPorPeriodoDashboard('semana')` usa o intervalo de calendario de `resolveDashboardPeriodRange` (mesmo do drill-down), e nao mais janela rolante de 7x24h.
  - Relatorio financeiro: filtro de status so se aplica a contas a pagar quando o KPI e `contas_pagar`; contas a receber mantem o filtro.
  - Subtitulos de Vendas, Fluxo de Caixa e Inadimplencia passam por `formatDisplayByState`; nao exibem "0 pedidos", "Negativo" ou "R$ 0,00 vencido" em estados `carregando`/`erro`/`sem_acesso`.
  - `amostraLimitada` (listas no teto de 9999) passa do hook de KPIs ao view-model, sinalizando dados parciais.
  - `CadastroEntitySelect`: com ID salvo, a resolucao e somente por ID; rotulo homonimo fora da pagina de 200 registros nao substitui o ID.
  - Entregas Pendentes (card secundario do Dashboard): `drillDown` alinhado a `createPageUrl("Expedicao")` com `kpi: 'entregas_pendentes'` (mesmo destino da faixa superior, sem desviar para `/Relatorios?tab=producao`).
  - Vencimentos `YYYY-MM-DD` em `isDashboardReceivableOverdue` e janela de `filterFinancialReportItems`: comparacao por data de calendario local (`toIsoDate`), eliminando adiantamento de inadimplencia em UTC-3 (21:00 da vespera) e falso atraso no proprio dia de vencimento.
  - Coerencia entre receber e pagar em `filterFinancialReportItems` e `RelatorioFinanceiro`: `inadimplencia` nao mistura contas a pagar do periodo no saldo/fluxo (`pagar` vazio); `fluxo_caixa`, `contas_receber` e `contas_pagar` aplicam o mesmo escopo pendente em ambos os lados, com banner e botao "Filtrar por período".
- **Estruturas reutilizadas:** `computeDashboardDerivedKpis`, `resolveDashboardPeriodRange`, `isDashboardReceivableOverdue`, `filterFinancialReportItems`, `formatDisplayByState`, `RelatorioFinanceiro`, `CadastroEntitySelect` existentes. Nenhum arquivo novo.
- **Multiempresa/RBAC/auditoria:** sem mudanca de escopo; contadores continuam derivados de listas ja filtradas por `filterInContext` (groupId/empresaId).
- **Testes:** novos casos em `tests/dashboard-overhaul-contracts.test.js` (semana calendario, status de pagar, contagem de aprovacao acima de 8, vencimento `YYYY-MM-DD` local em UTC-3, coerencia receber/pagar nos KPIs financeiros, alinhamento de entregas para Expedicao) e `tests/cadastros-ux-keyboard.test.js` (ID salvo sem fallback por rotulo). `tests/helpers/restoreDashboardCadastroCounts.js` espelha as edicoes do Dashboard para manter o pin de fronteira.
- **Validacao:** `npm run typecheck`, `npm run build`, `npm run audit:baseline`, `git diff --check`, testes direcionados em `TZ=America/Sao_Paulo` e `npm test` (3074/3074). `npm run lint` sem erros (2 warnings preexistentes em `PedidoTabsContainer.jsx` e `EntregasListagem.jsx`).
- **Pendencias (nao cobertas aqui):** contraprova com componente React montado para os KPIs corrigidos; leitura de query params `kpi`/`periodo` dentro do launchpad `Expedicao.jsx` (fora do escopo deste lote); integracao com endpoint oficial de agregados do periodo (backend Codex); verificacao de sessao/queryKey e revogacao no `CadastroEntitySelect`.
- **Proximo passo:** revisar PR #601 com os novos commits e, se aprovado, decidir a integracao dos agregados oficiais com o Codex.

## Frontend Dashboard e Cadastros Gerais em branch separada (2026-11-28)

- **Branch de entrega frontend:** `cursor/frontend-dashboard-cadastros-3cfd` (a partir de `codex/casa-fechamento-hml-20261114`), sem alterar sessão/API/paginação conduzidas pelo Codex (`src/api/*`, `VisualizadorUniversalEntidadeV24.jsx`, `server/*`) e sem deploy na HML (HML mantida em `a305a143`).
- **Dashboard Executivo retomado e substituído na rota `/Dashboard` (referência `erp-integra-novo`):** cabeçalho compacto (`DashboardHeader`), faixa multiempresa com troca rápida Grupo/CPA/3Z (`DashboardMultiempresaBanner`), barra de alertas operacionais (`DashboardAlertsBar`), strip de 8 KPIs (`DashboardKPIStrip`), ações rápidas (`DashboardAcoesRapidas`) e view-model fail-closed (`dashboardViewModel.js`). Corrigido bug real onde `initialData: []` + `staleTime: 120000` impedia o fetch inicial dos KPIs operacionais; `ticketMedio` calcula apenas sobre pedidos válidos (sem cancelados). Todos os indicadores abrem `/Relatorios` com filtros sincronizados (`tab`, `periodo`, `data_inicio`, `data_fim`, `status`, `group_id`, `empresa_id`, `scopeType`) refletidos em `FiltrosPeriodoEmpresa` e nos 4 relatórios (`Vendas`, `Financeiro`, `Estoque`, `Produção`).
- **Contratos e pendência de backend (Codex):** contagens canônicas usam `countEntities` + `buildContextFilter`; indicadores operacionais suportam `normalizeDashboardAggregateContract` (pronto para o endpoint/função oficial de agregados do período do Codex — ainda pendente no backend; validado com payload sintético apenas em teste de interface). Estados explícitos diferenciados: `sem_contexto`, `sem_acesso`, `carregando`, `erro`, `zero_confirmado` e `ok`.
- **Cadastros Gerais UX + seletores oficiais:** busca acento-insensível (`cadastrosSearchFilter.js`), atalho `/` + limpar (`Esc`), auto-expansão sem rede pelo catálogo estático dos 6 blocos, navegação por teclado (`Enter`/`Space`/setas/`Home`/`End`), barra compacta de escopo multiempresa e retry de erros — preservando abertura com seleção vazia e carregamento somente após clique. Novo seletor reutilizável `CadastroEntitySelect.jsx` adotado em `ColaboradorForm.jsx` gravando `cargo_id`, `departamento_id` e `turno_id` oficiais. Proposta de consolidação de módulos equivalentes documentada no PR para decisão antes de qualquer remoção.
- **Validação concluída (zero dados reais):** `npm run typecheck`, `npm run build`, `npm run lint`, `npm run audit:baseline`, `git diff --check` e suíte completa `npm test` (3.065/3.065 após `npm --prefix server ci`), incluindo `tests/dashboard-mounted-states.test.js` no Chrome real (Grupo, troca CPA → 3Z, zero confirmado, perfil restrito, erro, agregado sintético e drill-down) + 4 capturas sanitizadas no PR.
- **Pronto para integração pelo Codex:** pacote frontend completo na branch `cursor/frontend-dashboard-cadastros-3cfd` pronto para revisão/merge na próxima versão geral da VPS de teste; pendente no backend apenas o endpoint oficial de agregados operacionais do período para trocar o selo `"Derivado de listagem"` por `"Agregados oficiais"`.

## Estado atual e próxima ação (2026-11-27)

- **Cadastros integrado passou no clone:** `0110cd9e`, [CI Ubuntu](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/46050866174) e [build web](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/46050972547) verdes; SHA-256 da web conferido no D: e na VM. Chrome com login sintético: Clientes na CPA e 3Z (15.972, duas páginas, busca por código e nome, total filtrado 1 e próxima desativada); Produtos carregou CPA → 3Z, 273 e duas páginas na 3Z. Grupo sem chamadas de Clientes/Produtos até escolher entidade; Novo Cliente em Ações Rápidas abriu sem salvar. Permissões temporárias revertidas e PostgreSQL isolado parado.
- **Próxima ação: integração de entrega e proteção da HML.** O SHA acima está na branch exclusiva de CI, sem promoção. Integrar pelo fluxo de entrega, rodar CI do SHA final e conferir pacote completo API/web, backup fresco restaurado, cópia externa, retorno e condições de leitura de Produtos já aprovadas antes de publicar. HML segue em `a305a143`. Cache frio/quente em condições controladas e confirmação com login real ainda pendentes.

- **Aceite integrado bloqueado, HML em `a305a143`.** Candidata `b9043336`: [CI verde](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/46049055528), [web Ubuntu](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/46049168454) conferida no D: e na VM. Chrome autenticado no clone: zero consultas iniciais de Clientes/Produtos; na 3Z, abrir Clientes mostrou erro. A captura registrou somente duas respostas HTTP 200 de contagem (15.972), sem GET de listagem paginada. Permissões temporárias revertidas e PostgreSQL do clone desligado.
- **Próxima ação:** capturar código de erro sanitizado antes do envio da lista com a fachada HTTP real, reproduzir em regressão e corrigir sem aumentar acesso. Não promover `b9043336`; a CI não substitui a prova do navegador.

- **Causa do total de Clientes identificada:** `GET /api/v1/clientes` devolve a página, mas `httpApiClient.filter` e a ponte `entityListSorted` preservam só o array. O rodapé usa a contagem geral de `useEntityCounts`. Próximo lote: levar total filtrado e hasMore da mesma resposta à grade HTTP de Clientes, mantendo a contagem geral separada e o contrato de array dos demais consumidores. Testar busca, zero, erro e troca de contexto. Sem alteração de acesso, escrita ou deploy.

- **Clientes no Chrome isolado:** predicado da política de leitura e RLS forçada conferidos contra a HML; somente SELECT de Clientes reproduzido temporariamente no clone. Grupo, CPA e 3Z mostraram 15.972 clientes e duas páginas. Busca por código e nome passou no Grupo; na 3Z, após busca por código, a grade mostrou 1 registro, mas manteve 15.972 como total. Primeira abertura CPA/3Z ~3,4/~3,2 s, reabertura 3Z ~0,8 s (tempos de interface, não benchmark controlado de cache). Revogação e parada do banco comprovadas.
- **Próxima ação:** separar total filtrado de total geral no rodapé de Clientes e validar busca por nome em CPA/3Z antes de fechar o aceite. Sem novas permissões ou deploy; HML mantida em `a305a143`.

- **Ações Rápidas passou no clone:** menu Novo → Novo Cliente abriu Dados Gerais, sem salvar. Clientes habilitou depois da hidratação, mas a lista retornou HTTP 500 `INTERNAL_ERROR`; PostgreSQL do clone registrou `42501` na tabela `clientes`. Retorno de permissões temporárias e parada do banco isolado confirmados.
- **Próxima ação:** reconciliar somente no clone a ACL atual da HML antes de retestar Clientes e medir cache. Em transação somente leitura, a HML `a305a143` confirmou SELECT em clientes, grupos_produto, marcas, setores_atividade e unidades_medida, com RLS forçada; Produtos permanece sem SELECT após rollback. Comparar também políticas e acesso de escopo, sem ampliar o papel da HML. Nenhum deploy ou escrita na HML.

- **Produtos passou no navegador do clone** com login sintético e web do SHA `1c804a15` ([build Ubuntu](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/46045236632)). Grupo → CPA → 3Z → Grupo; duas páginas e 273 registros na CPA e 3Z. A troca mostrou contexto pendente, voltou à página 1 e teve HTTP 200 nas duas páginas da 3Z. Na 3Z, busca por código e descrição (~0,8 s) e reabertura passaram. Captura até a abertura da rota: zero chamadas de listagem de Clientes/Produtos. O ensaio foi encerrado com reversão das permissões temporárias e parada do banco isolado.
- **Próxima ação:** completar aceite de Clientes e Ações Rápidas, medir caches e distinguir negativas de tabelas auxiliares (`42501` no clone restrito) da consulta de Produtos. Não ampliar grants. Fazer integração e conferir CI do SHA final antes de revalidar backup, retorno e publicação autorizada. HML continua em `a305a143`; não houve merge nem deploy da branch de validação.

- **Produtos: CI e API no clone aprovadas; navegador pendente.** O SHA `1c804a15` passou nos quatro jobs da [CI Ubuntu](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/46042339091) e no ensaio HTTP com PostgreSQL 16 restaurado e papel restrito na VM privada do D:. Grupo e as duas empresas: 273 produtos, duas páginas distintas, busca por código e descrição. Primeira página 409–536 ms; busca por descrição 324–557 ms. Escopo alheio rejeitado; permissões temporárias revertidas e banco do ensaio desligado.
- **Em serviço: `a305a143`, sem publicação nova.** Próximo passo: usar o checkout isolado `produtos-contexto-1c804a15` na VM e abrir a aplicação com login sintético pelo Chrome protegido no Windows, via túnel local. Capturar troca CPA/3Z e rede antes e depois do clique. O ensaio HTTP não reproduziu nem explicou o defeito da interface em HML. A branch de validação permanece sem merge.

- **Triagem posterior (somente leitura):** logs do proxy preservado de `3f06be54` registram seis `200` em Produtos, um `499` na segunda página (cliente encerrou a requisição) e nenhum `403` ou `5xx` nessa rota. Houve 218 respostas `200` de sessão. Os logs não identificam a empresa de cada resposta; não comprovam erro de ACL nem aceite da 3Z. Próximo teste no clone: correlacionar troca de contexto, revalidação de sessão, requisição e renderização até estabilizar, sem ampliar acesso. HML mantida em `a305a143`.

- **Em serviço: `a305a143`.** O aceite autenticado de `3f06be54` mostrou Produtos com 273 registros e duas páginas na CPA e no Grupo CPA. Na 3Z, o contexto mudou, mas a contagem e a grade ficaram indisponíveis mesmo após reabrir. Retorno conjunto de API/web e verificação da ACL anterior concluídos. Backup fresco `hml-20261127T171525Z-4eb7dd48` restaurado e cópia externa conferida. Sem cargas ou alteração operacional.
- **Próxima ação:** reproduzir a falha na 3Z no clone, capturar status e código sanitizado da API e conferir contexto e leitura efetiva; não ampliar permissões. Antes da próxima troca, completar a captura de rede desde a abertura da rota e o aceite de busca e paginação em Clientes e Produtos. Deploy automático ainda sem prova de entrega.

- **Em serviço após novo retorno:** `a305a143`, API/web no mesmo SHA e readiness 200. Em `3f06be54`, a janela anônima autenticou e Clientes abriu na CPA com 15.972 registros. Expandir Produtos não disparou listagem, mas o botão Abrir ainda estava desabilitado na observação imediata. Retorno de runtime e SELECT/policy confirmado. Na versão anterior, o botão abriu para interação após hidratar o contexto. Isso não comprova regressão sustentada na candidata.
- **Próximo aceite:** preparar a janela autenticada e medir hidratação antes de declarar perda de contexto. Revalidar backup antes da troca; aguardar estabilização do bloco, verificar lista de Produtos na CPA, no Grupo e na 3Z e registrar busca/pagina sem salvar. Não mudar RBAC com base no estado inicial.

- **Em serviço agora:** API/web `3f06be54` na HML com leitura restrita de Produtos, sem escrita. Proprietario confirmou login em janela anonima na versao anterior; nova troca executada apos backup `398b3d0b` restaurado em 26 tabelas, copia externa e ACK. Readiness e protecao anonima passaram; aceite autenticado da nova versao segue pendente. Testar Cadastros em Grupo/CPA/3Z, Clientes e Produtos, sem salvar. Retorno `a305a143` preservado.

- **Em serviço:** API e web da HML voltaram juntas a `a305a143`, com readiness HTTP 200 e consulta anônima protegida. A API e a web de `3f06be54` chegaram a servir juntas após corrigir o entrypoint do Nginx, mas o aceite foi bloqueado pelo erro de cota ao gravar a sessão no Chrome existente. Reversão do SELECT/policy de Produtos conferida. Não houve carga, acesso ao operacional ou limpeza do navegador.
- **Próxima ação:** reproduzir login em um perfil limpo ou diagnosticar a cota do perfil autorizado sem olhar tokens nem apagar dados. Não presumir regressão da candidata até comparar as versões. Só retomar a troca depois do gate de backup e da preparação da prova autenticada. [CI verde](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/46031839533) e [pacote Ubuntu](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/46033811599) de `3f06be54` preservados.

- **Cadastros, validação corrigida:** `d8d3c38f`, [CI Ubuntu 46029813435](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/46029813435). A CI anterior falhou somente no fixture de perfil que avaliava a expressão real sem `produtoHttp`. Corrigido o contexto sintético; 64 testes de contrato e 44 regressões focadas passaram. Sem mudança de runtime neste fix. Aguardar suíte, lint, tipos e build do SHA corrigido. Em serviço: HML `a305a143`, sem ajuste de acesso novo.

- **Cadastros em CI Ubuntu:** autorização específica para validação em branch separada, sem merge, deploy ou escrita na HML, permanece válida até ordem do proprietário. Candidata `a5306262c7e165f7b09072db2f61a351f227f1b3`, [CI 46028600217](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/actions/runs/46028600217): A1 e Expedição/Comercial verdes; frontend e backend pendentes na conferência. HML continua em `a305a143`; conferir o resultado de todos os jobs antes da integração e do gate de publicação.
- **Pré-publicação:** SHA do backup de referência no HD, pacote de retorno e SQLs de aplicação/reversão de Produtos reconferidos. Isso não substitui verificar frescor e restauração antes da intervenção. Dashboard: links de vendas/ticket para o relatório com período, 17 testes focados, ainda em WIP separado sem fonte agregada homologada.

- **Bloqueio atual de Cadastros:** a VM privada está desligada, com disco de trabalho preservado. Chrome protegido em TCG não renderizou nem página mínima em 75 s; a execução já negativa teve log arquivado antes do desligamento. A sonda q35/WHPX sem disco iniciou Linux em menos de 2 s, mas o executor bloqueou por política a partida com o disco de trabalho. Retomar por um executor autorizado e capaz, sem abrir o WSL instalado em C: nem alterar o sandbox.
- **Dashboard:** 16 testes focados passaram, incluindo ticket médio sem cancelamentos ou pedidos fora do período. Os pedidos ainda vêm de listagem limitada sem prova de completude; falta agregação oficial e comparação com o relatório. WIP separado, sem publicação.

- **Em serviço:** HML API/web em `a305a143`. Candidata de Cadastros em WIP; nenhum SELECT/policy novo aplicado. A suíte corrigida na VM Linux registrou timeout no teste de abertura no Chrome protegido; cinco comparações históricas passaram em teste focado. Não publicar sem checks completos e CI do SHA exato.
- **Próxima ação:** terminar a coleta da suíte atual, resolver o gate de navegador sem desativar o sandbox e validar o SHA de código. Em seguida, revalidar o backup restaurável, a cópia externa e o retorno; aplicar somente a leitura de Produtos já autorizada e publicar API/web juntas na HML.
- **Publicação automática:** diretriz canônica no `PLANO_GO_LIVE.md` desde `59ecc16d`. Ainda não implantada nem comprovada. Após Cadastros, integrar ao CI existente e provar uma execução em HML. VPS final somente após aceite; cargas e acessos seguem gates separados.
- **Confirmação da rodada:** `d0e15fe6` publicado, WIP preservado. Pode testar a versão anterior no endereço atual da HML; não anunciar a nova grade nem o aceite de zero consultas antes do clique até a publicação comprovada. A suíte corrigida continua coletando regressões; o timeout de abertura no Chrome Linux já impede o aceite dessa execução.

## CPA3: candidata de Cadastros pronta para decisao (2026-11-27)

- Validacao da candidata apos 13e33979: Chrome 158 instalado na VM privada do D: com sandbox padrao. Tres provas de navegador da VM canceladas por timeout; prova focada no Chrome Windows passou, inclusive resposta CPA tardia descartada apos trocar para 3Z. Na suite integrada, quatro comparacoes historicas tambem falharam pelo delta de Catalogo. Projecao exata corrigida no WIP, preservando as verificacoes ancestrais; 79 testes focados passaram. Ainda falta reexecutar a suite no snapshot corrigido e confirmar CI do SHA de codigo. Sem SELECT, publicacao ou carga.

- Proprietario aprovou o delta ensaiado de leitura de Produtos somente na HML: SELECT e uma policy para o papel da API, restritos ao Grupo e Empresas autorizadas, sem escrita. Aplicar somente apos CI do SHA exato, revalidacao de destino, backup restauravel com copia externa e retorno. Nenhuma aplicacao registrada nesta aprovacao.

- Produtos: catalogo HML confirmado em leitura com o principal da API: RLS forcada, zero policies, sem SELECT e sem BYPASSRLS. Backup restaurado: 273 ativos do Grupo. Ensaio HTTP isolado com Auth sintetico e papel restrito: 273 no Grupo e nas duas Empresas, duas paginas distintas e busca por codigo, empresa incompatível negada. Delta SELECT/policy aplicado e revertido no clone, sem alterar HML. Codigo de Cadastros ainda em validacao, sem publicacao.

- Aceite posterior: troca CPA/3Z, busca e paginacao de Clientes passaram na interface autenticada. A captura de rede encontrou GET de Clientes com limite 500 na abertura sem entidade. Reversao conjunta executada; HML voltou a `a305a143`, conferida pela API, HTML e readiness. Bloqueada republicacao de `c2dcf435` ate corrigir o disparador global e provar a rota completa.

- Publicada na VPS de teste sob a autorizacao registrada. API e web servem `c2dcf43536e12e1abbad1db379056d00af49944c`; readiness e rota de login HTTP 200, sessao anonima 401. Primeira tentativa voltou automaticamente a `a305a143` por falha de inicializacao do Nginx; segunda passou com as mesmas capacidades do Nginx anterior. Retorno preservado. Aceite autenticado CPA/3Z pendente. Sem DDL, grants, cargas ou operacional.

- API/web `c2dcf43536e12e1abbad1db379056d00af49944c`, CI 45882138846 verde. Tar de 20.336.640 bytes, SHA-256 `bb6c26a6884547f3ab5d31d192b3bd6424aca542c9260f249d947d7ce9e723cf`, 2.239 arquivos conferidos contra o manifesto; copia no HD externo verificada.
- Backup de referencia conferido no HD e restaurado em PostgreSQL isolado, com 26 tabelas. Ensaio API/web sem banco: `a305a143 -> c2dcf435 -> a305a143` passou. HML permanece em `a305a143`. Publicacao e aceite autenticado pendentes; sem DDL, grants, cargas ou operacional.

## CPA3: Dashboard Base44 e fila de entregas (2026-11-26)

- Checkout remoto isolado do ERP `ce45d710` e referencia ERP Integra `b0586b8`, sem reutilizar ou sobrescrever WIP remoto de Fornecedores. Testes focados do Dashboard e do escopo Comercial: 18/18. Inventariados Header, faixa de KPI, alertas, resumo e hooks. A referencia tambem usa amostras limitadas; nao copiar essas amostras como totais.
- Primeiro recorte do Dashboard na rota existente: adaptar composicao e reaproveitar filtros/atalhos; Clientes e Produtos usam o contrato de contagem de Cadastros com escopo e permissoes. Indicadores operacionais exigem fonte agregada por Empresa e periodo; ausencia ou proibicao nao e zero. Excluir Clientes de novos exports Base44 e preservar os 273 Produtos conciliados. Sem deploy, carga ou alteracao do Dashboard servido.

## CPA3: entrega geral de Cadastros em HML (2026-11-26)

- Preflight somente leitura: `/cadastros` responde HTTP 200; meta da API e HTML conferido contra recibo mantem `a305a143`. Candidata completa `a470accb` r2, CI 45680437810 SUCCESS, tar SHA-256 `06d13aabfdf4b013af7145c4ded892a7a67b027a66d2d053b26f73d87705a627`. Backup de referencia `c33c96f4` restaurado no WSL, 17.472 clientes e copia externa conferida. VPS com 28 GiB livres. Sem autorizacao especifica de troca, deploy nao executado; renovar backup/ACK antes da janela.
- Diferencial HD/VPS: oito arquivos (84.925 bytes) de dependencias de classes, pendencias da primeira revisao, qualificacao de duplicatas e campos prioritarios ja coincidem por SHA-256. Nenhuma retransmissao. Base44 ERP Integra acessivel por conector: cinco schemas consultados presentes (Fornecedor, Produto, GrupoProduto, Empresa e SetorAtividade); ClienteEmpresa nao retornado. Schema nao comprova registros nem vinculos; nenhum export novo ou escrita.

## CPA3: reversao respeitada na consulta historica (2026-11-26)

- Policy de auditoria restaurada do backup c33c96f4: com papel nominal da aplicacao reproduzido NOLOGIN/NOBYPASSRLS e INSERT ja observado na HML, a RLS ficou ativa e aceitou quatro sondas (create/inactivate nas duas Empresas), sem policy nova. Rollback deixou zero eventos da sonda. Recibo privado bd631ae3; nao prova RBAC HTTP vivo nem autoriza escrita.

- Preflight HML com papel restrito em READ ONLY: ja existe chave unica valida em empresas(id,group_id), suficiente para FK do historico sem novo indice. A tabela historica segue ausente; INSERT de auditoria existe com RLS ativa, sem ensaio de escrita na policy efetiva. Recibo privado c86aba11. CI de e11919bc ainda sem execucao retornada pelo GitHub.

- Teste HTTP sintetico em PGlite usa middleware Supabase com provedor simulado, PostgresRbacGuard e RLS forcada com papel sem BYPASS. Token invalido 401, curinga sem acao explicita e outra Empresa 403; duas paginas validas excluem arquivado e outra Empresa. Tres testes focados e typecheck do teste passaram. Nao e login real ou validacao na HML.

- Executor canonico no clone restaurado c33c96f4, duas Empresas, papel restrito e repositorio oficial de auditoria: 12.514 baixas em 14 transacoes, interrupcao apos 1.000 e retomada com 11.514 insercoes; replay zero. Reversao arquivou 12.514, replay zero e 28 auditorias transacionais. Recibo privado ab6dc299; 7,828 s no ensaio, nao estimativa da HML. RBAC HTTP nao testado; sem escrita viva.

- Executor canonico validou manifesto 813bb03d para as duas Empresas em container sem rede e somente leitura. Com identidade fisica HML simulada, quatro recusas (apply/reverse por Empresa) antes de autorização, escrita ou auditoria. Recibo privado 33d8a3ff. Nao substitui prova transacional no clone restaurado.

- SQL candidato do historico (39950d55) ensaiado em PostgreSQL descartavel com dois casos sinteticos. Leitor sem escrita nem acesso ao snapshot bruto; papel de carga sem DELETE ou UPDATE de valores, somente arquivamento no escopo. RLS recusou INSERT cruzado; replay de arquivamento zero e outra Empresa preservada. Recibo privado f34d78c4. Sem grants ou escrita na HML.

- Prova SQL adicional em PostgreSQL isolado com as 12.514 chaves do manifesto 813bb03d: dois eventos arquivados preservados e fora da paginacao, 12.359 + 153 visiveis nos contextos corretos, zero em empresa cruzada. Recibo privado 0af6302f. Nao e prova HTTP na HML; nenhuma escrita ou liberacao.

- A rota de baixas historicas agora exclui eventos arquivados antes da paginacao, preservando RBAC e filtro de Empresa. Teste HTTP com PGlite e dados sinteticos verifica duas paginas, excluindo evento arquivado e evento de outra Empresa. Tres testes focados, typecheck e build do backend passaram; lint da base em worktree isolado retornou zero erros e dois avisos fora do lote. Sem publicar, alterar HML ou confirmar pagamento.

## CPA3: pacote de revisao do historico de baixas (2026-11-26)

- Ensaio integral no clone WSL: conversao de `name[]` para `text[]` tornou o search_path legivel pelo driver pg sem relaxar a trava. Manifesto `813bb03d`: 12.514 inseridos e arquivados pela reversao, duas Empresas, 28 auditorias, retomada apos commit, replay zero e pin adulterado recusado. Ensaio usou papel/ator da policy restaurada e ACL candidata apenas no clone. Linux: 3.050/3.050, audit:baseline, lint, typecheck e build aprovados. Sem escrita na HML.

- Recorte PostgreSQL de `c469a045`: backup externo `c33c96f4` revalidado por SHA-256 e restaurado no WSL sem rede, com ACLs do dump, 17.472 clientes e roles locais sem credenciais do servidor. Consulta exata da trava passou em transacao somente leitura com os dois logins restritos, inclusive `pg_control_system()`, sem grant novo. Instancia encerrada; manifesto nao reaplicado e HML intacta.

- Executor de ensaio revalida cluster, OIDs, schema/search_path e papel efetivo/login a cada transacao antes de autorizar, bloquear ou gravar. Consulta verificada no PostgreSQL 16 descartavel, com papel restrito; teste de divergencia preservou o primeiro checkpoint e impediu o segundo lote. Linux: 3.050/3.050 com Chrome sob conta comum, audit:baseline, lint, typecheck e build aprovados. As seis falhas de interface como root nao ocorreram com o sandbox ativo. Pendente ensaio desta revisao no backup restaurado; sem alteracao na HML.

- Identidade fisica da HML conferida em transacao somente leitura pelo papel restrito: banco, schema, OIDs, identificador do cluster e search_path. Recibo privado SHA-256 `d752d80541123c0fa54fdb0708d2ff9f2d4a38252d6d05db78d44337c2057427`. Nenhuma escrita no banco; executor ainda restrito ao clone.

- Pacote privado de revisao do historico 813bb03d: oito referencias conferidas, incluindo backup/ACK, ACL, executor no clone e auditoria restaurada. Delta proposto: uma tabela com FK existente, RLS e acesso restrito por Empresa, sem DELETE ou alteracao de payload. Pacote nao executavel, SHA ba29c9c8. CI exata e executor HML revisado continuam pendentes.

## CPA3: prontidao do historico de baixas de Fornecedores (2026-11-26)

- Recorte financeiro 813bb03d revalidado byte a byte por fonte EMP03 e por igualdade de eventos com o subconjunto de 45fb2bb6. 12.514 baixas sem comprovante (12.360 + 154 por Empresa), chaves nativas unicas; 107 pendentes fora do lote. HML restrita: relacao historica ausente e zero perfis ativos com visualizar explicito no caminho Financeiro.historico_baixas_fornecedores. Nenhum pagamento, saldo ou escrita.

## CPA3: diferencial dos pacotes de Auditoria e EMP01/03 (2026-11-26)

- Quarto diferencial HD/VPS: cinco arquivos (1983142833 bytes), incluindo Auditoria, EMP01, EMP03 e os dois pacotes de titulos, iguais por tamanho/SHA-256. O indice SHA do par MDF/LDF EMP03 no HD coincide com o recibo da extracao na VPS. Zero retransmissao, leitura SQL nova, carga ou deploy.

## CPA3: confirmacoes externas dos backups registradas (2026-11-26)

- Confirmados individualmente os tres ACKs de 26/11 pelo comando canonico, apos SHA-256 dos arquivos e manifestos no HD/VPS e restoreVerified. Retencao configurada keep=7; inventario antes/depois com sete arquivos, agora 7/7 ACKs consistentes. Zero retransmissao ou exclusao; nao executados sync, prune, backup novo ou deploy.

## CPA3: reconciliacao de copias externas e retencao (2026-11-26)

- Retencao HML em leitura: sete backups gerenciados, quatro com recibo externo e tres sem recibo. Os tres de 26/11 ja tem arquivos no HD conferidos por SHA-256, inclusive o intermediario f1712435 e seu manifesto. O sincronizador confirma cada copia apos verificacao e tambem pode remover copias locais antigas. Nenhum ACK, sync, prune ou deploy executado nesta rodada.

## CPA3: integridade integral da candidata e do retorno (2026-11-26)

- Integridade por tamanho e SHA-256: a470accb r2, 2.239 arquivos de runtime e 39 pins adicionais, sem membro inesperado; retorno a305a143, 2.222 arquivos. Recibo privado 5ea4d67d. Nenhuma publicacao ou escrita. A integridade nao substitui backup fresco, teste apos troca ou autorizacao.

## CPA3: backup agendado e copias externas conferidas (2026-11-26)

- Agendador HML 26/11 03:30 BRT: journal BACKUP_RESTORE_VERIFIED, 26 tabelas, 47.779.840 bytes. SHA 1370f7e6 coincide na VPS e HD. Backup posterior restaurado 09:13 BRT c33c96f4 (47.790.080 bytes) tambem conferido nos dois lados. A copia externa foi verificada separadamente, nao pelo servico. 28 GiB livres. Nenhum deploy, novo backup ou escrita nesta verificacao.

## CPA3: escopo candidato de publicacao sem mudanca de banco (2026-11-26)

- Candidata a470accb r2: bootstrap empacotado exige flag explicita para PedidoFinanceiro e nao conecta a opcao de historico de baixas. Configuracao atual lida sem segredos: ambas desativadas. Escopo candidato sem DDL/grants/carga: API/web juntos para Cadastros sob demanda; financeiro e historico desligados. Nao e aceite autenticado nem autorizacao de publicacao.

## CPA3: versao servida e candidata integrada verificadas (2026-11-26)

- HML servida a305a143 confirmada na API e no HTML + dois assets de entrada byte a byte com pacote privado. Candidata a470accb r2 (tar 06d13aab), CI 45680437810 com quatro jobs SUCCESS, inclui 8b3ae461 e nao tem diff posterior nos dois arquivos de abertura sob demanda. Imagens correntes registradas para reversao. Nenhum deploy.

## CPA3: evidencia transacional de unidade dos materiais (2026-11-26)

- EMP03 isolada READ_ONLY, recorte dos materiais com unidade divergente: 14 linhas de compra (quatro materiais), zero com conversao habilitada e duas quantidades positivas; zero linhas em itens de venda. Notas: 387 linhas no cruzamento com cabecalho (cinco materiais), 115 com quantidade/peso positivos, 371 na unidade de origem e zero na unidade de destino ou com quantidade de conferencia positiva. Um codigo de empresa no cruzamento. Nenhuma conversao comprovada.

## CPA3: unidade e fator nativo dos materiais de Precos (2026-11-26)

- EXETPS isolada READ_ONLY: oito pares pendentes com cadastro nativo exato e unidade de origem igual ao historico. Zero fatores positivos em CadastroMateriaisConversoes e zero siglas de conversao iguais ao destino. Dois pares tem peso bruto/liquido, nenhum peso de barra/metro positivo; peso cadastral nao prova base do preco. Os 27 eventos seguem sem conversao, nenhuma escrita.

## CPA3: terceiro diferencial e conversao de unidades (2026-11-26)

- Terceiro diferencial HD/VPS: 12 arquivos, 149555 bytes, iguais por tamanho e SHA-256 nos seis conjuntos de dependencias/revisao/duplicidade. Acumulado 38 arquivos/39335330 bytes, zero retransmissao. HML em READ ONLY: 14 unidades ativas visiveis; nos 27 eventos pendentes os oito pares usam grandezas distintas frente ao Produto Base44, sem conversao generica. Os oito literais anteriores permanecem candidatos. Nenhuma escrita.

## CPA3: gates tecnicos dos 789 Fornecedores conferidos (2026-11-26)

- Pacote privado d92c451c: quatro arquivos conferidos em SHA256SUMS; backup de referencia c33c96f4 conferido, nao substitui backup fresco antes da escrita. GitHub Actions 45835051779: quatro jobs SUCCESS. HML em READ ONLY: no caminho exato Cadastros.fornecedor, zero perfis ativos de Grupo com visualizar/importar/criar/inativar, sem wildcard no backend. Nenhum grant, perfil, DDL, carga ou deploy aplicado.

## CPA3: segundo diferencial HD/VPS e gate de Fornecedores (2026-11-26)

- Segundo diferencial HD/VPS: 13 arquivos, 20.000.320 bytes, iguais por tamanho e SHA-256 em seis conjuntos (campos autorizados, extracao SQL, quarentena materiais e unidades). Acumulado das duas conferencias: 26 arquivos, 39.185.775 bytes. Nenhuma retransmissao. Manifesto 4905483e intacto, 789 payloads, nao executavel. Leitura HML: 17.472 Clientes e tabela fornecedores ausente; 28 GiB livres na VPS.

## CPA3: Cadastros sob demanda em Chrome isolado (2026-11-26)

- Chrome local com tela React montada e transporte sintetico: referencia a305a143 efetuou uma contagem antes do clique; candidata efetuou zero contagens e zero listagens ao carregar ou expandir categoria, e abriu uma janela com uma lista e uma contagem ao clicar em Clientes. Cinco testes focados e dois cenarios comparativos passaram. Chrome da HML parou no login, sem medicao autenticada. Sem alteracao de runtime ou deploy.

## CPA3: contrato de leitura candidato dos oito ajustes de Precos (2026-11-26)

- Pacote 0e1f390e ensaiado em prototipo PostgreSQL descartavel de historico: 8/8 payloads conciliados, uma empresa no recorte, leitura zero sem policy/contexto ou em outra Empresa/Grupo. Leitor sem UPDATE; chave duplicada e FK de escopo incorreto recusadas. Sem destino generico confirmado no codigo; nao usar fila de clientes, baixas ou tabelas operacionais como destino. Nenhuma escrita HML.

## CPA3: oito ajustes de Precos e migration 013 no clone (2026-11-26)

- Oito eventos de dois pares isolados em pacote privado 0e1f390e, sem autorizacao de escrita. Migration 013 (blob be30f0fa) em clone c33c96f4: tres tabelas operacionais com RLS forcada, zero policies, zero registros e nenhum destino historico de precos. Rollback removeu as tres tabelas e preservou 17.472 Clientes e 273 Produtos. Nenhuma escrita na HML.

## CPA3: vinculos de Produtos e unidades no clone restaurado (2026-11-26)

- Clone restaurado c33c96f4, somente leitura: 17.472 clientes e 273 Produtos. Preflight a9b6c44e fixado no manifesto dos 273: os 35 eventos/10 pares encontram Produto unico por codigo literal e procedencia Base44. Empresa historica pertence ao Grupo nos 35, mas nao e empresa proprietaria do Produto em nenhum. Unidade principal coincide em oito eventos/dois pares; outros 27 sem equivalencia comprovada. Nenhuma autorizacao comercial ou escrita.

## CPA3: cobertura de Produto e Empresa do historico de precos (2026-11-26)

- Manifesto de 19.232 eventos: cruzamento por classe/material/tabela com evidencias privadas anteriores encontrou 35 eventos em 10 pares com candidato a Produto/unidade/empresa historica, 823 em 291 pares com candidato a Produto apenas e 18.374 em 3.168 pares sem candidato. Leitura restrita do catalogo da HML: produtos existe, sem SELECT para o papel consultado; sem tabela de precos ou historico no catalogo do schema. Nenhum apto operacional, nenhuma escrita.

## CPA3: ensaio em escala do historico de precos (2026-11-26)

- Manifesto 1b2975a3 ensaiado em PostgreSQL descartavel sem rede/porta: 19.232 payloads conferidos, 20 checkpoints (19x1.000 + 232), falha simulada do segundo lote sem estado parcial, retomada e replay sem duplicatas. Reversao de 999 com recibos, uma edicao posterior e 18.232 eventos de outros lotes preservados; repeticao zero. RLS no destino e DELETE/edicao de payload recusados. Janela medida 13,718 s, nao estimativa de HML.

## CPA3: manifesto candidato de historico de precos (2026-11-26)

- Historico de precos: cruzamento com material inteiro validado sem colisoes reproduziu 48.472/394 do leitor. Tipo numerico: 42.523 de 44.261 transicoes encadeadas e ultimo valor igual a PRECOTABELA em 4.504/4.563 pares vinculados. Manifesto candidato 1b2975a3: 19.232 eventos de 3.469 pares; fora 28.731 por cadeia, 492 por valor final, 394 sem item e 17 na cadeia com tipo/formato nao explicado. Nenhuma escrita.

## CPA3: historico de precos extraido na VPS privada (2026-11-26)

- EXETPS isolada READ_ONLY: export privado de 48.866 ajustes, 12.992.904 bytes, SHA ff82826a. PK nativa (CODIGOTABELA,CODIGOMATERIAL,SEQUENCIA), 51 valores de sequencia e dois tipos. 48.472 eventos em 4.563 pares com item atual; 394 em 41 pares sem item atual. Todos os cabecalhos encontrados. Sem carga ou uso como preco vigente.

## CPA3: primeira conferencia diferencial HD e VPS (2026-11-26)

- Recorte diferencial HD/VPS: 13 arquivos, 19.185.455 bytes, iguais por tamanho e SHA-256. Inclui exports de Clientes/Fornecedores/Produtos, extracao SQL inicial, classes e dependencias de materiais com manifestos. Zero transferencia nesse recorte; nao equivale a inventario integral. VPS com 28 GiB livres na afericao. Cadastros: 28 testes focados de contagens e reabertura passaram; sem prova nova de navegador, carga ou deploy.

## CPA3: retomada integrada e primeira versao geral (2026-11-26)

- Checkpoint remoto a9af58f4 confirmado. HML API configurada em a305a143; imagem web sem rotulo de revisao, par exato a conferir antes da promocao. Leitura restrita: 17.472 clientes (15.972 ativos), 16.087 locais (zero ativos). Obras e Fornecedores ausentes; sem tabelas fisicas de pedidos/orcamentos/contas_receber/plano_contas sob esses nomes no schema conferido. Nao confundir ensaio em clone com funcionalidade servida. VPS: 28 GiB livres; arquivo do HD visivel no D:. Nenhuma transferencia, carga ou deploy nesta auditoria.

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

## CPA3: manifesto candidato do historico de Obras (2026-11-26)

- Manifesto privado 2a9c9d8f: 1.535 eventos candidatos em 1.214 Obras, 1.432.860 bytes. Preserva representacao original, chave da Obra e identidade do evento. Exclui 1.560 sem Obra e um de regiao ambigua. Teste offline: 500 iniciais + 1.035 retomados, repeticao zero e conflito recusado. Nao e ensaio PostgreSQL, prova de escopo ou autorizacao de escrita.

## CPA3: ensaio PostgreSQL do historico de Obras (2026-11-26)

- Manifesto 2a9c9d8f ensaiado em PostgreSQL descartavel sem rede ou volume compartilhado. Quatro checkpoints (500/500/500/35); segundo lote revertido antes do commit e retomado, zero duplicatas no replay, 1.535 payloads conferidos por igualdade JSONB. Role sem BYPASSRLS teve leitura cruzada vazia, insert cruzado e update negados no destino de ensaio. 2,988 s na janela medida, sem estimar HML. Nenhuma escrita HML/operacional.

## CPA3: reversao pos-commit do historico de Obras (2026-11-26)

- Manifesto 2a9c9d8f: ensaio PostgreSQL descartavel de reversao pos-commit por escopo/lote e igualdade com o estado gravado. Arquivou 499/500 com 499 recibos na mesma transacao, preservou uma edicao posterior, 1.035 eventos do outro lote e uma sentinela de outro escopo. Rollback nao deixou estado parcial; repeticao zero; DELETE e UPDATE de conteudo negados. Nenhuma escrita na HML ou operacional.

## CPA3: migration canonica de Obras em backup restaurado (2026-11-26)

- HML em leitura restrita: obras, obra_empresas e obra_locais ausentes. Backup pos-Marcas c33c96f4 restaurado em clone isolado (17.472 clientes; 412.802.071 bytes no banco), sem reaplicar ACLs e com roles de referencia NOLOGIN. Migration canonica 012 (blob 38f685ab) criou as tres tabelas com RLS forcada. Rollback removeu o delta e conservou a contagem. Nenhuma escrita na HML, nenhum ensaio de ACL efetiva ou carga historica nesta rodada.

## CPA3: ACL e integridade dos vinculos canonicos de Obras (2026-11-26)

- Clone restaurado c33c96f4 com papel da aplicacao reproduzido NOLOGIN/NOBYPASSRLS. A 012 nao concede acesso por padrao. ACL candidata apenas no clone: sem ClienteEmpresa, vinculo recusado; local de outro cliente recusado. Com ClienteEmpresa sintetico, Obra e vinculos visiveis no Grupo, local vinculado inativo; outro Grupo viu 0/0/0. Rollback removeu o delta, mantendo 17.472 clientes. Na HML em leitura restrita: zero ClienteEmpresa e 16.087 ClienteLocal visiveis, nenhum ativo. Nenhuma escrita HML.

## CPA3: fontes nativas de ClienteEmpresa (2026-11-26)

- EXETPS isolada em READ_ONLY: 22.895 clientes, 1.181 com CODIGOGRUPO positivo e todos conciliados com GrupoClientes (23 grupos de clientes, nao empresas). PlanoMensalidadeClientes vazio; DivisaoCreditoClientes tem uma linha sem codigo de empresa positivo e nao tem chave de cliente. Nenhuma das fontes comprova ClienteEmpresa. Nenhuma escrita.

## CPA3: cobertura Base44 de vinculos ClienteEmpresa (2026-11-26)

- Referencia Base44 b0586b8c e schema do ERP Integra confirmam Cliente.empresa_id, empresa_dona_id e empresas_compartilhadas_ids, sem entidade ClienteEmpresa/Obra retornada. Consulta autorizada dos campos minimos: um cliente visivel, campos de titularidade divergentes, dois IDs compartilhados e sem coincidencia numerica com a Obra candidata. Nao prova vinculo TID. Nenhuma alteracao Base44/HML.

## CPA3: vigencia candidata e chaves dos precos do legado (2026-11-26)

- Exports de Precos verificados pelos recibos: seis cabecalhos, 5.162 itens, zero chaves (tabela,material) duplicadas e zero cabecalhos ausentes. Conversao candidata Clarion (dias desde 1800-12-28): 2024-08-26 a 2030-12-01, zero intervalos invalidos. 1.027 materiais com sobreposicao entre tabelas distintas; nao colapsar tabelas. 4.464 precos positivos; promocao nula em 4.502 e zero em 660, sem vigencia presumida. Nenhum preco aprovado ou gravado.

## CPA3: fontes nativas independentes de vigencia de Precos (2026-11-26)

- EXETPS em READ_ONLY: tres ajustes de cabecalho, nenhum com data DD/MM/AAAA para confirmar vigencia; parametros de tabela vazios; 48.866 ajustes de itens identificados. EMP03 isolada: nenhuma linha com chave fiscal numerica de 44 digitos e data de emissao no intervalo testado; nenhuma nota com CODIGOTABELAPRECOS positivo. Nenhuma confirmacao nativa de data ou empresa; zero escrita.

## CPA3: Cadastros Gerais publicado na HML (2026-11-26)

- API e web `a470accb92a7e70d51f20c461f663c3012d006f6` r2 publicadas juntas em `https://hml-erp.cpaferroeaco.com.br/cadastros`. Meta publica, HTML byte a byte, readiness e tela de login conferidos. Financeiro/historico desligados; sem migration, grants, carga nem operacional. Aceite autenticado CPA/3Z pendente de sessao.
- Backup fresco `hml-20261126T174922Z-3f31aceb` (47.790.080 bytes), 26 tabelas, restauracao independente sem rede com 17.472 clientes e ACK externo por SHA-256 `2fd5fe00dd6597d22ecd0dc3c1c977376483514cde31abef5503bdab8d62b606`. API/web `a305a143` preservadas paradas para retorno.
- Dashboard: cabecalho existente compacto e responsivo, com filtro de periodo bloqueado sem permissao, em WIP separado na VPS. 18 testes focados remotos passaram; nao empacotado nem publicado.

## CPA3: aceite de Cadastros r2 bloqueado e retorno verificado

- Sessao real abriu Cadastros sem janela de entidade; expandir Pessoas nao abriu lista, mas Abrir de Clientes ficou desabilitado e os seletores de CPA e 3Z dispararam alerta. Nao foi possivel medir trafego de listagem, busca ou paginacao autenticada. Retorno previsto de API/web para `a305a143` efetuado e confirmado por meta, HTML e readiness. Sessao continuou autenticada no Grupo; troca 3Z tambem alertou no retorno. Causa ainda nao comprovada; sem mudar perfil, banco ou operacional.
- Dashboard em WIP remoto: contagem ausente, vazia ou booleana nao e mais aceita como zero oficial; zero numerico continua valido. 18 testes focados passaram. Sem pacote ou deploy desse WIP.

## CPA3: cota do navegador e candidata de Cadastros

- API e web em `a305a143` confirmadas novamente. O alerta autenticado identifica `QuotaExceededError` em `erp_runtime_scope`. WIP usa token existente como fallback sem limpar dados, conserva a sessao em falha e nao muda o RBAC. 38 testes focados passaram, incluindo contexto nos headers HTTP e recusa de Empresa nao autorizada. Audit, lint, typecheck e build passaram no checkout remoto; suite completa nao verde no executor VPS. Sem commit de codigo, candidata ou deploy.
- Dashboard em andamento separado: indicador de Produtos deixa de usar amostra como total e distingue sem acesso, carregando, indisponivel e zero oficial. Ainda sem aceite de navegador ou pacote.

## CPA3: validacao completa da correcao de sessao

- Correcao da cota isolada em checkout de `8714588b`: Chrome nao-root iniciou com sandbox no perfil AppArmor existente, sem mudar a politica do host. Suite Linux 3.051/3.051; audit, lint, typecheck, build e diff check passaram. Dashboard fora do lote. HML permanece `a305a143`; nao houve publicacao.

## CPA3: contagens oficiais no Dashboard

- Dashboard na rota existente: cabecalho compacto e Clientes/Produtos Cadastrados usam o filtro canonico de Cadastros, cache por contexto e empresas do Grupo, sem total inferido da pagina. Zero confirmado, carregamento, indisponibilidade e falta de acesso sao estados distintos. Nao e total de ativos nem aceite em HML. Audit, lint, typecheck e build passaram; suite protegida 3.050/3.051 antes da correcao exclusiva de teste. Os 35 testes focados passaram depois que as duas verificacoes passaram a reaproveitar o mesmo conjunto exato de trechos permitidos, sem trocar o hash historico.

## CPA3: prova de contexto das contagens do Dashboard

- Teste de integracao extrai as duas consultas reais do Dashboard e usa o bridge canonico HTTP com fonte sintetica. Grupo, CPA e 3Z enviam o filtro de Cadastros; visao Grupo inclui a lista de empresas no cache; sem acesso nao consulta. Contagem HTTP nao usa pagina nem fallback local. 17 testes focados, lint direcionado e diff check aprovados. Sem alteracao de runtime ou deploy; aceite com login real pendente.

## CPA3: backup externo de 27/11 e branch de Cadastros

- HML `a305a143`: API e HTML conferidos; 26 GiB livres. Backup agendado `hml-20261127T063010Z-5a0c4d7b`, restauracao comprovada no recibo, 47.790.080 bytes, copiado diretamente ao HD externo e confirmado por SHA-256 `48235eb23284d00b1175cfc0e7c2033947dd2abde3b9f134cb9f454d481e6475`; ACK canonico registrado. Sem prune, deploy ou operacional.
- Branch exclusiva `codex/cadastros-hml-c2dcf435`: CI 45882138846 SUCCESS para `c2dcf435`; VM no D: ainda nao iniciada, nenhum pacote gerado.

## CPA3: prova sintetica do consolidado de precos (2026-11-27)

- PostgreSQL embutido descartavel: oito verificacoes com RLS forcada e papel somente leitura. Grupo consolida empresas permitidas sem duplicar; CPA e 3Z veem seus eventos; outra Empresa, outro Grupo e contextos incompletos nao leem; UPDATE negado. Eventos arquivados excluidos e decimal preservado. Dados inteiramente sinteticos: nao equivale a ACL da API, permissao de acesso real ou aplicacao dos oito eventos legados. Sem escrita na HML.

## CPA3: export por cursor do Base44 (2026-11-27)

- ERP Integra, contagens visiveis pelo acesso atual: Fornecedor 4, Produto 871, GrupoProduto 91, SetorAtividade 11, Empresa 2, UnidadeMedida 14, Marca 6, CentroCusto 14. Clientes nao consultados. Export direto de Fornecedor em duas paginas, quatro IDs e codigos distintos, campos de identidade/estado/escopo, 1.333 bytes na VPS privada, SHA `d95a84bc96ce6f050b426cb37eac991fff40a2dc0f4b18c6c35faaf06442313b`. Zero coincidencias literais com codigo/codigo_legado no manifesto dos 789; isso nao prova identidade nem autoriza fusao. Sem alteracao no Base44 ou HML.

## CPA3: Produtos Base44 conciliados por ID (2026-11-27)

- Exportacao direta: 871 Produtos visiveis em 35 paginas por cursor, contagens inicial/final iguais, 871 IDs unicos. VPS privada: 277.945 bytes, SHA-256 `0afb458057b4b952f3d3d9edecca20db7e4d672e6657e8949b15b3da746d96b9`. Manifesto ja aplicado `8cfcc611`: 273/273 IDs encontrados, codigos literais intactos, estado atual Base44 Ativo nos 273 (nao comparar com a classificacao candidate do preflight).
- Restam 598 fora do manifesto anterior (597 ativos e um inativo): zero colisao literal com os 273 e zero codigo ausente. Em 221, os campos de Empresa, GrupoProduto, Setor e unidade principal estao presentes; ainda comprovar os vinculos no destino. Em 323 falta atribuicao de Empresa e em 54 falta tanto GrupoProduto quanto Setor (contagens podem se sobrepor). Sem carga ou alteracao de dados. Recibo v2 `5dd282dceb96bddb1c7f29f844ad320a25824ae4c09c2be5623427b3a2ae84c2`.

## CPA3: referencias dos 221 Produtos do Base44 (2026-11-27)

- Export direto: 91 GruposProduto, 11 Setores, duas Empresas e 14 Unidades, IDs unicos e contagem inicial/final igual. Arquivo privado 16.427 bytes, SHA `885ddab0975ee7844821b81fa503c3afa41e0bb2ab5d5d3091e0e7ca06ff2b38`. Dos 221 Produtos, todos com Empresa mapeada no mesmo Grupo e unidade literal ativa; zero IDs de GrupoProduto e de Setor encontrados no export atual. Faltam 55 IDs distintos de GrupoProduto e nove de Setor. Nenhum apto para carga. Recibo `755b445e`.
- Cruzamento por 273 Produtos ja gravados, preservando ID, codigo literal e Empresa: 92 referencias de Setor com candidato unico, 129 sem candidato; zero candidatos de GrupoProduto. 87 dos 221 constavam no preflight anterior. Candidato observado nao comprova vinculo nativo, nem reativa cadastros. Recibo `0bbb6c21`; sem escrita.

## CPA3: cobertura dos IDs historicos de Setor (2026-11-27)

- Lixeira Base44 consultada somente por ID: zero dos 55 GruposProduto e dos nove Setores ausentes retornaram. No acervo, o CSV recuperado de GrupoProduto (91 linhas) nao coincide com os IDs procurados. O mapa historico dos 11 Setores localiza a referencia nativa nos 221 Produtos; 151 conferem Grupo e Empresa na origem, 70 permanecem sem essa conciliacao. Nenhum Produto passa os dois vinculos; sem escrita. Recibo privado `bdccb739dda4949f7475dc8af58be32f326dc53f8e96f0b9fb056142529d2a11`.

## CPA3: snapshot nativo de maio para GrupoProduto (2026-11-27)

- Dois exports somente leitura do mesmo app Base44 recuperados no acervo privado: 138/221 Produtos encontram o ID historico de GrupoProduto no mesmo Grupo de origem e os 221 encontram Setor. Entre os 138, 87 tambem conferem Empresa e Grupo no mapa de Setor, e 43 tem ambas as referencias ativas na evidencia consultada. Nenhum dos IDs historicos GrupoProduto e ID original do pacote de Grupos conciliado: 138 codigos literais unicos sao apenas candidatos a crosswalk. Nao usar codigo sozinho para liberar carga. Recibos privados `c45c7e9f` e `0861e09f`. Sem escrita.

## CPA3: recorte de 43 Produtos bloqueado por Grupo inativo (2026-11-27)

- Os 43 candidatos possuem codigo literal unico, nome/natureza exatos e Empresa/Grupo coerentes no cruzamento historico. Os cinco GruposProduto candidatos correspondentes estao inativos tanto no pacote conciliado como no export atual (43/43 Produtos). Zero apto sob o contrato ativo; manter os 51 Grupos inativos preservados. Recibo privado `9c18bfcc0dcc46028db1adf83f4586a2a444ea75eb90c505db5b26ca8f0b0f01`. Nao houve carga, reclassificacao ou reativacao.

## CPA3: Centros de Custo e conta 3.1.01 no Base44 (2026-11-27)

- 14 Centros exportados em duas paginas; os 13 do manifesto `57d3cbbb` correspondem ao export anterior por ID, codigo literal, Empresa, estado e pai (13/13 em cada). O 14o ja estava na origem e segue sem Empresa/pai. Recibo `d6c5b3cd`; nao reaplicar nem inventar vinculo.
- Consulta dirigida confirmou uma conta `3.1.01` analitica e ativa, sem Empresa proprietaria no Base44. CC001 e CC011 tem Empresa, mas nao tem conta padrao e nao vinculam a conta por esse campo. Nao comprova uso na venda da CPA; CC011 permanece fora. Recibo privado `6dc16eeb`. Sem alteracao na HML/operacional.

## CPA3: Plano de Contas Base44 conferido (2026-11-27)

- 26 contas visiveis em duas paginas, mesmas 26 identidades do export anterior e 21/21 do preflight. Codigos contabeis e sequenciais internos preservados separadamente, 26/26; escopo, estado/tipo e pai tambem 26/26. 12 analiticas ativas, nenhuma conta com Empresa proprietaria, quatro pais distintos ausentes da origem visivel/lixeira/snapshots de maio e zero ciclo encontrado. Nao criar pais nem vincular conta por Empresa. Recibo privado v2 `ae00ae41bdb5bc9dd9419fa6e5ff19a9dfae9b8bcf2bd553ea97435d588b6e16`; sem carga.

## CPA3: ensaio da arvore de 21 contas (2026-11-27)

- PostgreSQL embutido descartavel, export e preflight fixados por SHA: 21/21 contas conciliadas por ID, escopo, pai, dois codigos e estado; nove analiticas ativas. Replay zero; FK recusou pai inexistente e restricao recusou Empresa artificial. Somente tabela de revisao, sem restauracao integral ou plano operacional. Recibo `645e1eb2f3b279de25f36d5ddc71ec55d62e7f6fe8bef4843927dce7d81a2fc5`. Sem alteracao na HML.

## CPA3: cobertura contabil dos titulos Base44 (2026-11-27)

- A consulta ao catalogo SQL da copia isolada EMP05, em modo somente leitura, encontrou zero linhas em `CentroCustosPedidos` e `NotaFiscalSaidasRateioCentroCusto`. Leitor desligado e estado `exited` conferido. Resultado restrito a esse snapshot; nao comprova o uso de CC011. Sem escrita na HML ou no operacional.

- Consulta dirigida pelo Grupo e Empresa dos Centros CC011/CC001: 2 e 4 titulos visiveis, respectivamente; zero vinculo preenchido com Pedido, Centro de Custo ou Plano de Contas. Campos existem em ContaReceber, mas esse recorte nao comprova uso comercial nem substitui o rateio nativo. Recibo privado `8b03688fd1e7720266942db101b0e1ded3ef9ded4b7cb5b02a5e89be36e65347`. Sem carga ou alteracao.

