# Status do Projeto ERP Zuccaro

Atualizado em: 2026-05-13

## Origem e modo de trabalho

Este projeto esta rodando localmente neste computador, a partir da pasta:

`D:\ERP Zuccaro\erp-integra-portatil-20260508-061538\erp-integra-portatil-20260508-061538`

URL local:

`http://localhost:5173/`

## Checkpoint para continuar em outro computador

Este arquivo e o ponto principal de continuidade do projeto. Ao abrir este ERP em outro computador ou em uma nova conversa no Codex, comece lendo:

1. `STATUS_DO_PROJETO.md`
2. `PLANO_MELHORIA_ERP_ZUCCARO.md`
3. `COMO_LEVAR_PARA_OUTRO_COMPUTADOR.md`

Estado atual em 2026-05-13:

- Projeto em modo local, sem gravar no Base44 nem no GitHub.
- Projeto de trabalho atual: `D:\ERP Zuccaro\erp-integra-portatil-20260508-061538\erp-integra-portatil-20260508-061538`.
- URL local padrao: `http://localhost:5173/`.
- Script rapido para abrir no HD externo: `abrir-erp-hd.bat`.
- Build validado apos o ultimo lote: `npm run build` passou.
- Tela validada apos o ultimo lote: `http://localhost:5173/cadastros` respondeu `200`.
- Ultimo foco trabalhado: `Cadastros Gerais > Pessoas & Parceiros`.
- Proximo foco recomendado: continuar em `Cadastros Gerais > Produtos & Servicos`, revisando formularios, listas auxiliares, contexto grupo/empresa, RBAC, auditoria e validacoes.

Regra de continuidade:

- Nao criar modulo novo se ja existir modulo/tela/componente com proposito igual ou similar.
- Melhorar sempre o componente existente.
- Nao apagar funcionalidade existente.
- Toda alteracao deve respeitar multiempresa, RBAC, seguranca, auditoria, responsividade, `w-full` e `h-full`.

O projeto esta em modo local:

```env
VITE_LOCAL_ONLY=true
VITE_BASE44_APP_ID=local-erp-integra
VITE_BASE44_BACKEND_URL=http://localhost:5173/local
VITE_BASE44_API_KEY=
```

Os snapshots locais encontrados sao:

- `public/base44-local-snapshot.json`
- `public/base44-local-core-snapshot.json`

O snapshot contem:

- 1 grupo empresarial: `GRUPO CPA`
- 2 empresas: `CPA FERRO E ACO` e `3Z LTDA`
- Cadastros Gerais e entidades de apoio, incluindo registros de produtos, financeiro, centro de custo, formas de pagamento, marca, estoque e outros.

## Correcoes ja feitas neste computador

1. O projeto foi aberto localmente pelo Vite em `http://localhost:5173/`.
2. Foi confirmado que o snapshot correto contem `GRUPO CPA`, `CPA FERRO E ACO` e `3Z LTDA`.
3. Foi corrigida a duplicacao entre `GRUPO CPA LOCAL` e `GRUPO CPA`.
4. Quando houver dados reais importados do Base44, o sistema remove os placeholders locais:
   - `GRUPO CPA LOCAL`
   - `3Z LTDA LOCAL`
   - `CPA FERRO E ACO LOCAL`
5. Arquivo alterado:
   - `src/api/localBase44Client.js`
6. Validacao executada:
   - `vite build` passou.
7. Foi iniciado o plano geral de melhoria pelo pilar de Gestão de Acessos/RBAC.
8. O hook existente `usePermissions` foi reforçado para interpretar permissões granulares por chave completa, como:
   - `Sistema.Controle de Acesso.editar`
   - `Cadastros.Organizacional.criar`
   - `Financeiro.Caixa.baixa-manual`
9. Controles base existentes passaram a usar o mesmo resolvedor de permissão:
   - `Button`
   - `Switch`
   - `Checkbox`
   - `Input`
   - `Select`
   - `RadioGroup`
   - `Textarea`
   - `Toggle`
   - `TabsTrigger`
   - `DataTable`
10. A API local (`localBase44Client.js`) passou a reforçar:
   - sanitização com `sanitizeOnWrite`;
   - validação de permissão local em `create`, `update` e `delete`;
   - auditoria de bloqueio quando usuário sem permissão tenta gravar;
   - preservação do fluxo para usuário admin.
11. Validacao executada apos RBAC/sanitizacao/API local:
   - `vite build` passou.

Para forcar recarregamento do banco local do navegador:

`http://localhost:5173/?reset-local=1`

## Regra-mae obrigatoria

Estas regras sao obrigatorias e inviolaveis para todas as alteracoes no ERP Zuccaro.

### 1. Proibicao absoluta de criacao nova

E proibido criar modulos, telas, funcionalidades, componentes ou arquivos novos quando ja existir modulo, tela, funcionalidade ou componente com o mesmo proposito, nome igual ou similar.

Qualquer necessidade deve ser atendida por melhoria no que ja existe.

### 2. Melhorar sempre o existente

Toda alteracao, melhoria, otimizacao ou correcao deve ser feita no modulo, tela, arquivo ou funcionalidade ja existente no projeto.

### 3. Refatoracao obrigatoria quando o arquivo estiver grande

Quando modulo, tela, arquivo ou componente ficar grande demais, especialmente acima de 400 a 600 linhas, ou quando a legibilidade ficar ruim, deve ser refatorado em arquivos, funcoes, hooks, componentes ou submodulos menores e reutilizaveis.

A refatoracao deve manter toda a logica e comportamento original.

### 4. Nunca apagar funcionalidades

Nunca apagar, remover ou desativar funcionalidade, botao, aba, campo, fluxo ou codigo existente sem confirmacao.

Pode reorganizar, conectar, melhorar, tornar mais seguro, mais legivel e mais performatico.

### 5. Antes de incluir ou excluir, perguntar

Antes de incluir algo novo ou excluir algo existente, perguntar primeiro.

Duplicidades devem ser verificadas com cuidado. Quando houver duplicidade, a prioridade e consolidar no componente/fluxo existente, preservando comportamento e dados.

### 6. Multiempresa absoluta

Todos os dados, consultas, criacoes, atualizacoes e relatorios devem ter contexto explicito de:

- grupo
- empresa

Todos os registros devem carregar e respeitar `groupId`/`grupo_id` e `empresaId`/`empresa_id` quando aplicavel.

Nenhuma operacao relevante pode acontecer sem contexto de grupo/empresa.

### 7. Regra de ramificacao grupo/empresa

Tudo que for feito no `GRUPO CPA` deve refletir nas empresas cadastradas do grupo, quando fizer sentido para a entidade.

Tudo que for feito em cada empresa (`CPA FERRO E ACO` ou `3Z LTDA`) deve alimentar a visao consolidada do `GRUPO CPA`.

Quando o cadastro for feito no grupo, ainda assim deve ser especificada a empresa quando o processo exigir empresa operacional.

Quando houver faturamento no grupo, a emissao da nota fiscal deve acontecer somente pela empresa responsavel pela operacao.

### 8. RBAC granular obrigatorio

Toda tela, aba, botao, acao, campo editavel e endpoint deve ter controle de permissao granular.

O RBAC deve existir em dois niveis:

- frontend: esconder, bloquear ou desabilitar visualmente
- backend/local API: bloquear definitivamente a acao nao permitida

As permissoes devem seguir modulo, submodulo, aba e acao.

Exemplos:

- `comercial.pedido.aprovar`
- `financeiro.caixa.baixa-manual`
- `cadastros.empresa.editar`
- `administracao.acessos.permissoes.alterar`

### 9. Seguranca obrigatoria

Toda escrita deve reforcar:

- sanitizacao de entradas
- validacao de dados
- protecao contra injecao e XSS
- validacao dupla em acoes sensiveis
- uso de `sanitizeOnWrite.ts` ou equivalente quando existir

### 10. Auditoria completa

Toda acao relevante deve gerar log auditavel:

- criar
- editar
- aprovar
- excluir
- emitir
- baixar
- alterar permissao
- alterar configuracao sensivel

O log deve conter:

- antes/depois
- usuario
- timestamp
- grupo
- empresa
- modulo
- entidade

Integrar ou reforcar com:

- `auditEntityEvents.ts`
- `securityAlerts.ts`

### 11. Nao quebrar o existente

Nenhuma alteracao pode:

- quebrar telas existentes
- interromper o fluxo atual
- prejudicar layout responsivo
- remover etapas de negocio
- mudar comportamento sem necessidade clara

### 12. Layout obrigatorio

Todas as telas, paginas, modais e containers principais devem usar:

- `w-full`
- `h-full`
- responsividade para celular, tablet e desktop
- CSS com `flex`, `grid` ou `resizable` quando aplicavel

Abas devem permanecer fixas, salvo necessidade aprovada.

### 13. Integracao ao fluxo atual

Toda melhoria deve preservar a sequencia logica do sistema.

Exemplo de fluxo que nao pode ser quebrado:

pedido criar -> ajustar estoque -> mudar status -> emitir NF -> enviar WhatsApp

## Frente de trabalho principal

O trabalho que estava sendo feito envolve melhorar e ramificar o sistema inteiro, com prioridade para:

1. Configuracoes Gerais do Sistema
2. Seguranca
3. RBAC e Gestao de Acessos
4. Administracao do Sistema
5. Ramificacao grupo/empresa
6. Cadastros Gerais como fonte dos dados necessarios para relatorios
7. Revisao de duplicidades
8. Melhorias em todos os setores
9. Fazer funcionar toggles, botoes, caixas de selecao, abas, formularios e acoes
10. Auditoria, validacao e seguranca das acoes sensiveis

## Proxima etapa recomendada

Comecar por `Administracao do Sistema > Gestao de Acessos` e `Configuracoes Gerais`, porque elas sustentam:

- RBAC
- seguranca
- multiempresa
- auditoria
- permissao por grupo e empresa
- funcionamento correto dos setores

Checklist inicial:

1. Mapear arquivos existentes de Administracao do Sistema.
2. Mapear arquivos existentes de Gestao de Acessos.
3. Mapear configuracoes gerais e toggles existentes.
4. Verificar quais botoes/toggles/checkboxes nao persistem ou nao executam acao real.
5. Verificar duplicidades antes de qualquer inclusao/exclusao.
6. Corrigir sempre no componente existente.
7. Confirmar com o usuario antes de criar ou excluir qualquer coisa.

## Progresso executado nesta maquina

### Base local e snapshot

- Confirmado que o projeto esta rodando localmente nesta maquina, a partir da pasta/HD local.
- Confirmado que o app usa snapshot local do Base44 em `public/base44-local-core-snapshot.json`.
- Corrigida a topologia local para manter somente `GRUPO CPA` e as empresas reais importadas do snapshot, evitando duplicidade com `GRUPO CPA LOCAL`.

### RBAC, seguranca e auditoria

- Reforcado `usePermissions` para aceitar chaves granulares completas, como `Sistema.Configuracoes.editar`.
- Reforcados componentes base de UI para respeitar `data-permission` em botoes, switches, inputs, selects, tabs, textareas, toggles, checkbox/radio e DataTable.
- Reforcado `localBase44Client` para sanitizar dados no salvamento, validar permissao antes de criar/editar/excluir e registrar bloqueios de permissao em `AuditLog`.

### Configuracoes Gerais

- Confirmado que `ConfigGlobal` e o painel existente usado por `Administracao do Sistema > Configuracoes Gerais`.
- Reforcadas permissoes de toggles, campos fiscais e botao de atualizacao usando chaves granulares por categoria.
- Mantida a persistencia existente por grupo/empresa via `useToggleConfig`, sem criar tela, modulo ou fluxo duplicado.
- Build validado com sucesso apos as alteracoes.

### Gestao de Acessos

- Confirmado que a entrada existente da gestao de acessos e `src/components/administracao-sistema/gestao-acessos/GestaoAcessosIndex.jsx`.
- Confirmado que a central existente de perfis RBAC e `src/components/sistema/CentralPerfisAcesso.jsx`.
- Reforcados os controles de edicao de perfis para obedecer ao estado de permissao do perfil aberto.
- Reforcados botoes de tudo/nada, modulo, secao e checkboxes de permissoes para exigir permissao granular de criar/editar perfil.
- Corrigida a persistencia de exclusao de `PerfilAcesso` no modo local: exclusoes agora gravam uma marca local e o importador do snapshot nao recria perfis removidos de proposito.
- Ajustada a confirmacao de exclusao de perfil para lembrar a Regra-Mae e indicar acao sensivel auditada.
- Build validado com sucesso apos as alteracoes.

### Gestao de Usuarios e empresas vinculadas

- Confirmado que a aba existente de usuarios e `src/components/administracao-sistema/gestao-acessos/UsuariosTab.jsx`.
- Confirmado que o formulario existente de configuracao de usuario e `src/components/sistema/GestaoUsuariosAvancada.jsx`.
- Reforcados campos de cargo, departamento, telefone, 2FA, perfil de acesso, empresas vinculadas e restricoes adicionais com permissao granular `Sistema.Controle de Acesso.editar`.
- Impedido o toggle de empresas vinculadas quando nao houver contexto de grupo/empresa ou quando o operador nao tiver permissao de edicao.
- Mantido o salvamento existente com `group_id`, `empresa_id`, `perfil_acesso_id`, `perfil_acesso_nome`, empresas vinculadas e auditoria em `AuditLog`.
- Build validado com sucesso apos as alteracoes.

### Seguranca e Governanca

- Confirmada a entrada existente de seguranca em `src/components/administracao-sistema/seguranca-governanca/SegurancaGovernancaIndex.jsx`.
- Ajustado o acesso da area de seguranca para aceitar administradores ou permissao granular `Sistema.Seguranca.visualizar`.
- Abas existentes de Politicas, Monitoramento/Manutencao e Compliance IA receberam `data-permission` para rastreio visual/RBAC.
- O wrapper `SegurancaDashboard` deixou de enviar dados zerados e passou a carregar usuarios, perfis e auditoria do contexto grupo/empresa.
- O dashboard de seguranca agora calcula cobertura de usuarios com perfil, conflitos por auditoria e atividades recentes com base em dados reais.
- `ConfiguracaoSeguranca` ganhou validacao minima antes de salvar politicas sensiveis: JWT, MFA, senha e brute force.
- Salvamento de configuracao de seguranca agora exige confirmacao da Regra-Mae e continua auditando a acao sensivel.
- Build validado com sucesso apos as alteracoes.

### Auditoria completa e eventos criticos

- Confirmada a entrada existente de auditoria em `src/components/administracao-sistema/auditoria-logs/AuditoriaLogsIndex.jsx`.
- Reforcado RBAC da area de auditoria para administradores ou permissoes granulares `Sistema.Auditoria.visualizar` / `Sistema.Logs.visualizar`.
- `AuditTrailPanel` passou a consultar dados somente quando houver permissao de auditoria e recebeu `data-permission` nos filtros e botoes existentes.
- `LogsAuditoria` ganhou filtro de eventos sensiveis/criticos e destaque visual para eventos como exclusao, perfil de acesso, seguranca, RBAC, bloqueio, liquidacao e nota fiscal.
- `GlobalAuditLog` passou a respeitar permissao granular e contexto grupo/empresa antes de carregar logs.
- Mantida a Regra-Mae: nenhuma tela ou modulo novo foi criado, apenas reforco nas telas e componentes ja existentes.
- Build validado com sucesso apos as alteracoes.

### Cadastros Gerais

- Confirmado que a pagina existente de Cadastros Gerais e `src/pages/Cadastros.jsx`.
- Confirmado que a tabela central existente de cadastros e `src/components/cadastros/CadastrosTableUniversal.jsx`.
- Reforcadas permissoes granulares por entidade nas acoes de buscar, visualizar, editar e excluir.
- Ajustada a confirmacao de exclusao para lembrar a Regra-Mae antes da acao sensivel.
- Mantidos os filtros multiempresa existentes via `filterInContext`.
- Build validado com sucesso apos as alteracoes.

### Cadastros Gerais - blocos e visualizador central

- Reforcados os blocos existentes de Pessoas, Produtos, Financeiro, Logistica, Organizacional e Tecnologia para abrir cards somente com permissao por entidade.
- Alinhados cards e botoes de abertura com `data-permission` e `data-action` no padrao `Cadastros.Entidade.acao`.
- Mantidas as telas e forms existentes, sem criar modulo novo e sem excluir funcionalidade.
- Reforcado `VisualizadorUniversalEntidadeV24` com `data-action` para buscar, limpar busca, ordenar, alterar paginacao, recarregar, criar, excluir selecionados e navegar paginas.
- Atualizadas as confirmacoes de exclusao unitaria e em massa para lembrar a Regra-Mae e indicar acao sensivel auditada.
- Build validado com sucesso apos as alteracoes.

### Comercial

- Confirmado que a pagina existente do modulo Comercial e `src/pages/Comercial.jsx`.
- Reforcada a checagem de RBAC para aceitar tanto `visualizar` quanto o legado `ver`, evitando divergencia entre tela, abas e cards.
- Reforcado o launchpad do Comercial para propagar `data-permission` e `data-action` nos cards existentes.
- Reforcada a abertura de modulos comerciais com bloqueio visual por permissao antes de abrir janela.
- Auditoria de abertura de area comercial agora inclui `empresa_id` e `group_id`.
- Mantidos os filtros multiempresa existentes via `filterInContext`, `createInContext` e `updateInContext`.
- Build validado com sucesso apos as alteracoes.

### Dashboard executivo e relatorios iniciais

- Confirmada a pagina existente do dashboard principal em `src/pages/Dashboard.jsx`.
- Reforcado o contexto grupo/empresa nas consultas do Command Center, usando `filterInContext` tambem para `AuditLog`.
- Adicionada validacao de contexto/permissao para metricas de RH, Sistema, Fiscal e Financeiro antes de carregar indicadores.
- Acoes sensiveis de navegacao do dashboard agora geram auditoria: troca de aba, troca de periodo, auto-refresh e abertura de modulo pelo dashboard.
- `DashboardHeader` recebeu `data-permission` e `data-action` nos controles de periodo e atualizacao automatica.
- `QuickAccessModulesGrid` recebeu `data-permission` e `data-action` nos cards de acesso rapido existentes.
- Widgets financeiro e estoque critico passaram a respeitar permissao do modulo antes de aparecer.
- Mantida a Regra-Mae: nenhuma tela, modulo ou componente novo foi criado; apenas reforco nos existentes.
- Build validado com sucesso apos as alteracoes.

### Relatorios gerenciais e exportacoes

- Confirmada a pagina existente de relatorios em `src/pages/Relatorios.jsx`.
- Reforcado carregamento de dados dos relatorios para depender de contexto grupo/empresa ativo e permissao de visualizacao.
- Consultas principais de clientes, pedidos, produtos, contas a receber e contas a pagar agora incluem grupo/empresa na chave de cache.
- Exportacao CSV passou a exigir permissao granular `Relatorios.exportar`; tentativa sem permissao gera bloqueio visual e auditoria.
- Alteracao de aba, selecao de relatorio, filtros globais, exportacao e agendamento de envio agora geram `AuditLog` com grupo/empresa.
- Abas principais receberam `data-permission` por area: Comercial, Financeiro, Estoque, Producao, Relatorios e Exportacao.
- `RelatoriosFiltrosGlobais`, `RelatorioCard` e `SelectedOperationalReport` receberam `data-permission` e `data-action` nos controles existentes.
- Agendamento de relatorios agora exige permissao de edicao e bloqueia o botao de agendar quando o perfil nao permitir.
- Mantida a Regra-Mae: nenhuma tela, modulo ou componente novo foi criado; apenas reforco nos existentes.
- Build validado com sucesso apos as alteracoes.

### Financeiro e operacoes sensiveis

- Confirmada a pagina existente do modulo Financeiro em `src/pages/Financeiro.jsx`.
- Reforcada permissao de visualizacao do Financeiro para aceitar `ver` e `visualizar`, mantendo compatibilidade com perfis antigos.
- Abertura de modulos financeiros agora valida contexto grupo/empresa e permissao granular antes de abrir janela.
- Tentativa de abertura sem contexto/permissao gera `AuditLog` de seguranca com `group_id`, `grupo_id` e `empresa_id`.
- Auditoria de abertura de secao financeira passou a registrar grupo e empresa.
- `ModulosGridFinanceiro` passou a propagar `data-permission` e `data-action` para os cards existentes.
- `VendasMulticanal` deixou de buscar pedidos e pagamentos fora do contexto e passou a usar `filtrarPorContexto` com chaves de cache por grupo/empresa.
- Sincronizacao de pagamento multicanal agora exige contexto e permissao de edicao/baixa financeira; bloqueios e sincronizacoes geram auditoria.
- Filtros, busca, visualizacao e botao de sincronizar pagamento em `VendasMulticanal` receberam `data-permission` e `data-action`.
- Mantida a Regra-Mae: nenhuma tela, modulo ou componente novo foi criado; apenas reforco nos existentes.
- Build validado com sucesso apos as alteracoes.

### Fiscal, NF-e e regra empresa faturadora

- Confirmada a pagina existente do modulo Fiscal em `src/pages/Fiscal.jsx`.
- Consultas de `NotaFiscal` agora usam chave de cache com empresa, grupo e contexto visual.
- Carregamento de notas fiscais passou a exigir contexto grupo/empresa e permissao de visualizacao fiscal.
- Abertura de secoes fiscais agora valida contexto e permissao granular antes de abrir janela.
- Abertura e bloqueio de secoes fiscais agora geram `AuditLog` com `group_id`, `grupo_id` e `empresa_id`.
- O botao existente `Nova NF-e` agora exige permissao fiscal de criar/emitir e empresa selecionada.
- Se o usuario estiver no grupo sem empresa faturadora, a tentativa de NF-e e bloqueada e auditada, reforcando a regra de que emissao fiscal sai pela empresa.
- `ModulosGridFiscal` passou a propagar `data-permission` e `data-action` para os cards existentes.
- Mantida a Regra-Mae: nenhuma tela, modulo ou componente novo foi criado; apenas reforco nos existentes.
- Build validado com sucesso apos as alteracoes.

### Administracao do Sistema - Gestao de Acessos

- Seguido o primeiro foco do plano de melhoria: reforco do modulo existente de Gestao de Acessos, sem criar modulo novo.
- `usePermissions` passou a reconhecer mais aliases de Controle de Acesso, Perfis e Permissoes, melhorando compatibilidade entre perfis antigos e novos.
- Removidos trechos inalcançaveis do resolvedor de permissoes, mantendo a mesma API publica do hook.
- `GestaoAcessosIndex` recebeu `w-full h-full`, areas internas redimensionaveis e `data-permission` nas abas existentes.
- `UsuariosTab` passou a bloquear convite/configuracao quando nao houver contexto grupo/empresa ou permissao adequada, com aviso visual no escopo invalido.
- `GestaoUsuariosAvancada` reforcou validacao de contexto antes de salvar e marcou perfil, 2FA, empresas vinculadas e restricoes como acoes sensiveis.
- `CentralPerfisAcesso` recebeu aviso de contexto, busca com permissao declarada e campos sensiveis mais rastreaveis.
- `PermissoesGranularesModal` recebeu `data-permission` e `data-sensitive` nos switches e no salvar.
- Build validado com sucesso e tela `administracaosistema?tab=acessos` abriu no navegador interno sem erro de console.

### Cadastros Gerais - auditoria e contexto no visualizador central

- Seguido o plano de melhoria na Fase 6/7 usando o componente existente `VisualizadorUniversalEntidadeV24`.
- Adicionada auditoria para tentativas de criar/editar cadastro sem contexto grupo/empresa ou sem permissao.
- A abertura de formulario de criacao/edicao agora registra evento de visualizacao com entidade, grupo e empresa.
- O visualizador central passou a mostrar aviso quando nao houver grupo/empresa selecionado, evitando operacao fora do escopo multiempresa.
- Mantida a Regra-Mae: nenhum modulo/tela duplicado foi criado e nenhuma funcionalidade existente foi removida.
- Build validado com sucesso apos as alteracoes.

### Cadastros Gerais - Pessoas & Parceiros

- Seguido o plano de melhoria no bloco existente `Pessoas & Parceiros`, sem criar telas ou entidades duplicadas.
- `ContatoB2BForm` passou a carregar clientes pelo `filterInContext`, respeitando grupo/empresa em vez de listar todos os clientes.
- `ContatoB2BForm` bloqueia salvamento sem contexto grupo/empresa e marcou cliente, campos principais, switch de contato principal e salvar com `data-permission`, `data-action` e `data-sensitive` quando aplicavel.
- `SegmentoClienteForm` recebeu rastreio RBAC/auditoria visual nos campos, select, switch e botao de salvar.
- `RegiaoAtendimentoForm` passou a carregar colaboradores e transportadoras por contexto grupo/empresa e bloqueia salvar sem contexto.
- Abas e acoes sensiveis de `RegiaoAtendimentoForm` receberam marcadores de permissao/acao.
- Build validado com sucesso apos as alteracoes.

### Cadastros Gerais - Produtos & Servicos

- Seguido o plano de melhoria no bloco existente `Produtos & Servicos`, sem criar telas, modulos ou entidades duplicadas.
- Corrigido o uso de `contextoAtual` inexistente nos formularios de Servico, GrupoProduto, Marca, SetorAtividade, UnidadeMedida, KitProduto e CatalogoWeb.
- Esses formularios agora usam o `contexto` real do `useContextoVisual` para gravar `empresa_id` quando o usuario estiver em uma empresa.
- Mantido o `group_id` para consolidacao no grupo, respeitando multiempresa e o fluxo atual.
- Reforcados os controles existentes desses formularios com `data-action` em campos, selects, switches e botoes sensiveis.
- Mantidos `data-permission` e `data-sensitive` existentes, deixando os controles mais rastreaveis para RBAC, auditoria e testes.
- Build validado com sucesso apos as alteracoes.
- `ProdutoFormV22_Completo` tambem foi reforcado no proprio formulario existente, sem criar tela nova.
- No produto completo foram marcadas acoes de IA, descricao, classificacao tripla, codigo/SKU, codigo de barras, tipo de item, upload/geracao de imagem, bitola, unidade principal, unidades secundarias, e-commerce, SEO, status, excluir e salvar.
- Controles sensiveis do produto passaram a ter `data-permission`, `data-action` e `data-sensitive`, e varios switches/botoes agora respeitam contexto e permissao antes de alterar dados.
- `TabelaPrecoFormCompleto` tambem foi reforcado no modulo existente de Produtos & Servicos.
- Na tabela de preco foram marcadas acoes de configuracao, vigencia, compartilhar com grupo, status, inclusao individual/lote, filtros de lote, adicionar/remover produtos, motor de calculo, sugestao IA, excluir e salvar.
- Verificado que nao restou `contextoAtual` nesses formularios revisados.
- Build validado com sucesso apos as alteracoes.
- Componentes internos do produto completo tambem foram reforcados: `PrecosSection`, `PesoDimensoesSection`, `FiscalContabilSection` e `EstoqueAvancadoSection`.
- Esses componentes agora validam contexto grupo/empresa por `useContextoVisual` antes de permitir alteracoes sensiveis.
- Campos de preco, margem minima, peso, dimensoes, fiscal, tributacao, contabilizacao, estoque minimo/maximo, lote, validade, almoxarifado e localizacao receberam bloqueio por permissao/contexto.
- Controles internos receberam `data-permission`, `data-action` e `data-sensitive` conforme a area: Produto, Fiscal e Estoque.
- `BotaoBuscaAutomatica` foi ajustado para repassar atributos extras ao botao interno, permitindo auditoria/RBAC visual sem quebrar usos existentes.
- Build validado com sucesso apos as alteracoes.
- Proximo passo sugerido: repetir o mesmo padrao nos demais blocos de `Cadastros Gerais`: Financeiro & Fiscal, Logistica/Frota/Almoxarifado, Organizacional e Tecnologia.

### Sincronizacao GitHub - novo repositorio CodeX

- Repositorio novo informado pelo usuario: `viniciuszuccaro-creator/ERP-Zuccaro-codeX`.
- Remoto antigo preservado como `old-origin`: `https://github.com/viniciuszuccaro-creator/erp-integra.git`.
- Remoto principal `origin` apontado para: `https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX.git`.
- Documentos existentes de transporte para outro computador atualizados com instrucao de `git clone`.
- Objetivo: permitir continuar o ERP Zuccaro em outros computadores mantendo `STATUS_DO_PROJETO.md` e `PLANO_MELHORIA_ERP_ZUCCARO.md` como guia de continuidade.

### Cadastros Gerais - Financeiro & Fiscal

- Seguido o plano de melhoria no bloco existente `Financeiro & Fiscal`, sem criar telas, modulos ou entidades duplicadas.
- `Bloco3Financeiro` passou a exigir contexto grupo/empresa antes de abrir cadastros financeiros e fiscais.
- Abertura e bloqueio de entidades do bloco agora geram auditoria com usuario, modulo, entidade, grupo e empresa.
- Cards e botoes do bloco receberam `data-context-required` alem de `data-permission` e `data-action`.
- `TipoDespesaForm` passou a carregar Plano de Contas e Centro de Resultado por `filterInContext`, evitando listar dados fora do grupo/empresa.
- `TipoDespesaForm` agora bloqueia salvamento sem contexto e grava `group_id`/`empresa_id` no payload conforme o escopo ativo.
- Campos, selects, switches de aprovacao, recorrencia, status e salvar em `TipoDespesaForm` receberam marcadores de RBAC/auditoria e bloqueio por permissao.
- `MoedaIndiceForm` passou a bloquear salvamento sem contexto e incluir `group_id`/`empresa_id` no payload.
- Campos de codigo, nome, tipo, cotacao, status e salvar em `MoedaIndiceForm` receberam marcadores de permissao, acao e sensibilidade.
- `TabelaFiscalForm` corrigiu o uso de contexto para gravar `empresa_id` quando o usuario estiver operando em uma empresa.
- Build validado com sucesso apos as alteracoes.
- Proximo passo sugerido: continuar `Cadastros Gerais` no bloco `Logistica, Frotas & Almoxarifado`, reforcando formularios de veiculos, motoristas, rotas, almoxarifados e locais de estoque.

### Cadastros Gerais - Logistica, Frotas & Almoxarifado

- Seguido o plano de melhoria no bloco existente `Logistica, Frotas & Almoxarifado`, sem criar telas, modulos ou entidades duplicadas.
- `Bloco4Logistica` passou a exigir contexto grupo/empresa antes de abrir cadastros logisticos, frota e almoxarifado.
- Abertura e bloqueio de entidades do bloco agora geram `AuditLog` com usuario, modulo, entidade, grupo e empresa.
- Cards e botoes do bloco receberam `data-context-required`, mantendo `data-permission` e `data-action` existentes.
- O botao existente `App` do motorista agora tambem respeita contexto e permissao antes de abrir.
- `VeiculoForm`, `MotoristaForm`, `LocalEstoqueForm`, `RotaPadraoForm` e `TipoFreteForm` passaram a usar o `contexto` real do `useContextoVisual` para gravar `empresa_id` quando o usuario estiver em uma empresa.
- Mantido o `group_id` em todos os payloads desses formularios, reforcando a regra de consolidacao no grupo.
- Build validado com sucesso apos as alteracoes.
- Proximo passo sugerido: continuar `Cadastros Gerais` no bloco `Estrutura Organizacional`, reforcando Empresa, Filial, Departamento, Cargo, Turno, Centro de Operacao e Centro de Resultado.

### Cadastros Gerais - Estrutura Organizacional

- Seguido o plano de melhoria no bloco existente `Estrutura Organizacional`, sem criar telas, modulos ou entidades duplicadas.
- `Bloco5Organizacional` passou a exigir contexto grupo/empresa antes de abrir cadastros organizacionais, exceto `GrupoEmpresarial`, que permanece no escopo proprio de grupo.
- Abertura e bloqueio de entidades do bloco agora geram `AuditLog` com usuario, modulo, entidade, grupo e empresa.
- Cards e botoes do bloco receberam `data-context-required`, mantendo `data-permission` e `data-action` para rastreio de RBAC, auditoria e testes.
- `DepartamentoForm`, `CargoForm` e `TurnoForm` agora validam contexto grupo/empresa antes de salvar.
- Esses formularios passaram a validar permissao de criar/editar/excluir conforme a acao atual.
- Payloads de departamento, cargo e turno agora reforcam `group_id` e gravam `empresa_id` quando o usuario estiver operando em uma empresa.
- Campos, selects, switches, selecao de dias, status, excluir e salvar receberam marcadores `data-permission`, `data-action` e `data-sensitive`.
- Build validado com sucesso apos as alteracoes.
- Proximo passo sugerido: continuar `Cadastros Gerais` no bloco `Tecnologia, IA & Parametros`, reforcando APIs, webhooks, chatbot, jobs, gateways e configuracoes de NF-e.

### Cadastros Gerais - Tecnologia, IA & Parametros

- Seguido o plano de melhoria no bloco existente `Tecnologia, IA & Parametros`, sem criar telas, modulos ou entidades duplicadas.
- `Bloco6Tecnologia` passou a exigir contexto grupo/empresa antes de abrir APIs, webhooks, chatbot, jobs, gateways, NF-e e notificacoes.
- Abertura e bloqueio de entidades do bloco agora geram `AuditLog` com usuario, modulo, entidade, grupo e empresa.
- Cards e botoes do bloco receberam `data-context-required`, mantendo `data-permission` e `data-action` para rastreio de RBAC, auditoria e testes.
- `ApiExternaForm`, `WebhookForm`, `JobAgendadoForm`, `ChatbotCanalForm`, `ChatbotIntentForm` e `GatewayPagamentoForm` passaram a validar contexto e permissao antes de salvar.
- Payloads desses cadastros agora reforcam `group_id` e gravam `empresa_id` quando o usuario estiver operando em uma empresa.
- Campos sensiveis de APIs e webhooks, incluindo URL, API key, API secret, evento gatilho e ativacao, receberam marcadores de permissao, acao e sensibilidade.
- `ChatbotIntentForm` passou a bloquear inclusao/remocao de frases de treinamento quando o perfil nao pode editar.
- `GatewayPagamentoForm` passou a carregar empresas por `filterInContext`, evitando listar empresas fora do grupo/empresa atual.
- Build validado com sucesso apos as alteracoes.
- Proximo passo sugerido: reforcar `EventoNotificacaoForm` e os parametros operacionais fora do bloco principal, depois voltar para `AdministracaoSistema` e revisar funcionalidades de toggles/botoes globais.

### Abertura local do projeto no Codex

- Confirmado que o remoto principal `origin` esta apontando para `https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX.git`.
- Confirmado que o projeto esta registrado como confiavel no Codex em `d:\erp zuccaro\erp-integra-portatil-20260508-061538\erp-integra-portatil-20260508-061538`.
- Identificado que, ao fechar o Codex, o servidor local do Vite para de rodar; por isso o navegador mostra que nao foi possivel acessar `localhost:5173`.
- Criado o iniciador `start-erp-dev.cmd` na raiz do projeto para subir o ERP local com `npm run dev -- --host 0.0.0.0`.
- Servidor local iniciado fora do sandbox e validado com resposta HTTP `200 OK` em `http://localhost:5173/`.
- Proximo passo operacional: quando abrir o Codex em outro computador, clonar/abrir este repositorio e executar `start-erp-dev.cmd` ou `npm run dev -- --host 0.0.0.0` para disponibilizar o sistema no navegador.

### Parametros Operacionais - Tecnologia e Fluxos Criticos

- Seguido o plano de melhoria nos formularios existentes de eventos/notificacoes e parametros operacionais, sem criar telas, modulos ou entidades duplicadas.
- `EventoNotificacaoForm` passou a validar contexto grupo/empresa e permissao antes de salvar.
- Eventos/notificacoes agora gravam `nome`, `group_id` e `empresa_id` conforme o contexto ativo.
- Campos de nome, tipo, descricao, template, prioridade, status e salvar receberam marcadores de permissao, acao e sensibilidade.
- `ParametroCaixaDiarioForm`, `ParametroConciliacaoBancariaForm`, `ParametroPortalClienteForm`, `ParametroRecebimentoNFeForm` e `ParametroRoteirizacaoForm` passaram a validar contexto e permissao antes de salvar.
- Esses parametros agora reforcam `group_id` e gravam `empresa_id` quando o usuario estiver em uma empresa.
- Toggles e campos criticos de caixa, conciliacao bancaria, portal do cliente e roteirizacao receberam bloqueio por permissao/contexto e marcadores `data-permission`, `data-action` e `data-sensitive`.
- Build validado com sucesso apos as alteracoes.
- Proximo passo sugerido: voltar para `AdministracaoSistema`, especialmente aba `integracoes`, revisando toggles/botoes globais e garantindo que cada acao tenha contexto, RBAC e auditoria.

### Administracao do Sistema - Integracoes

- Seguido o plano de melhoria na aba existente `administracaosistema?tab=integracoes`, sem criar tela ou modulo duplicado.
- `CentralIntegracoes` passou a validar contexto grupo/empresa e permissoes antes de ativar/desativar integracoes.
- Toggles de integracao agora bloqueiam sem contexto ou sem permissao e registram auditoria de bloqueio.
- Abertura de configuracoes de integracao agora valida permissao de visualizacao e registra auditoria.
- Botoes de toggle/configurar receberam `data-permission`, `data-context-required` e `data-sensitive`.
- `IntegracoesIndex` passou a auditar bloqueios ao criar estrutura base, testar webhooks e copiar URL sensivel.
- Abas internas de integracoes receberam marcadores de permissao e contexto para RBAC/auditoria visual.
- O botao de copiar URL de webhook agora exige contexto e permissao de edicao por tratar URL operacional sensivel.
- Build validado com sucesso apos as alteracoes.
- Proximo passo sugerido: continuar na aba `integracoes` reforcando componentes de teste especificos (`TesteNFe`, `TesteBoletos`, `TesteGoogleMaps`, `TesteTransportadoras`, `ConfigWhatsAppBusiness` e marketplaces).

### Administracao do Sistema - Testes de Integracoes e Marketplaces

- Seguido o plano de melhoria nos componentes existentes da aba `integracoes`, sem criar telas, modulos ou componentes duplicados.
- `TesteNFe`, `TesteBoletos`, `TesteGoogleMaps` e `TesteTransportadoras` passaram a exigir contexto grupo/empresa e permissao antes de executar testes.
- Esses testes agora registram auditoria de sucesso, erro, bloqueio por permissao e bloqueio por ausencia de contexto.
- Campos, botoes de execucao, copia de PIX, visualizacao de XML/DANFE/PDF e abertura de Maps receberam marcadores `data-permission`, `data-action`, `data-context-required` e `data-sensitive` quando aplicavel.
- `ConfigWhatsAppBusiness` passou a carregar e salvar a configuracao por escopo multiempresa, atualizando registro existente quando houver e gravando `group_id`/`empresa_id`.
- Toggles, numero, token, teste de envio e salvar do WhatsApp Business agora bloqueiam por contexto/RBAC e registram auditoria.
- `SincronizacaoMarketplacesAtiva` passou a consultar pedidos externos via `filterInContext`, evitando leitura fora do grupo/empresa atual.
- Importacao de marketplace agora valida contexto/RBAC, carimba cliente, pedido e pedido externo com `group_id`/`empresa_id`, e audita a importacao.
- Busca simulada de novos pedidos de marketplace agora exige contexto/permissao, grava escopo multiempresa e audita a sincronizacao.
- Build validado com sucesso apos as alteracoes.
- Proximo passo sugerido: continuar em `AdministracaoSistema` nas ramificacoes de seguranca/RBAC/gestao de acessos, verificando toggles e botoes de liberacao por grupo, empresa e setor.

### Administracao do Sistema - RBAC e Gestao de Acessos

- Seguido o plano de melhoria nos componentes existentes de `Gestao de Acessos` e `Seguranca/Governanca`, sem criar telas ou modulos duplicados.
- `CentralPerfisAcesso` recebeu escopo explicito no perfil: somente grupo, somente empresas, grupo e empresas, ou empresas e setores.
- Perfis RBAC agora gravam `escopo_acesso`, `nivel_acesso_contexto`, `acesso_grupo`, `acesso_empresas`, `departamentos_permitidos`, `group_id` e `empresa_id` conforme o contexto ativo.
- Edicao de perfil agora registra auditoria com `dados_anteriores` e `dados_novos`, reforcando rastreabilidade antes/depois.
- `GestaoUsuariosAvancada` recebeu controle de liberacao por grupo, empresas, grupo+empresas e setores no proprio fluxo existente de configuracao de usuario.
- Vínculos de empresas agora ficam bloqueados quando o usuario estiver marcado como acesso somente grupo.
- Restricoes adicionais de usuario agora aceitam setores permitidos e centros de custo permitidos, mantendo o escopo limitado ao grupo/empresa atual.
- Alteracao de usuario agora grava os flags de escopo (`acesso_grupo`, `acesso_empresas`) junto do perfil, empresas vinculadas e restricoes.
- `UsuariosTab` passou a auditar bloqueios de convite sem permissao ou sem contexto, e recebeu marcadores de contexto nos filtros, convite e configuracao.
- `SoDChecker` passou a auditar bloqueios/erros de analise e persistencia de conflitos, alem de marcar acoes sensiveis com contexto obrigatorio.
- `SegurancaGovernancaIndex` passou a auditar navegacao entre abas de seguranca e marcou as abas com contexto obrigatorio.
- Build validado com sucesso apos as alteracoes.
- Proximo passo sugerido: continuar a revisao em `ConfiguracaoSeguranca`, monitoramento de acesso em tempo real e componentes de compliance/governanca para reforcar toggles, politicas e auditoria operacional.

### Administracao do Sistema - Seguranca, Governanca e Compliance

- Seguido o plano de melhoria nos componentes existentes de seguranca, governanca e compliance, sem criar telas, modulos ou componentes duplicados.
- `ConfiguracaoSeguranca` passou a registrar auditoria de bloqueio por ausencia de contexto e bloqueio por permissao antes de salvar politicas sensiveis.
- Salvamento de configuracoes de seguranca agora registra auditoria com dados anteriores e novos dados, usuario, grupo e empresa.
- Abas internas e botao salvar de seguranca receberam marcadores de RBAC/contexto para JWT, sessoes, MFA, senhas e politicas.
- `PainelGovernanca` passou a carregar `AuditoriaGlobal`, `AuditoriaAcesso` e `GovernancaEmpresa` pelo escopo ativo de grupo/empresa.
- `PainelGovernanca` agora bloqueia visualizacao sem permissao e marca abas de logs, acessos e riscos com contexto obrigatorio.
- `IAGovernancaCompliance` passou a filtrar usuarios e perfis pelo escopo ativo, respeitando grupo, empresa e empresas vinculadas ao usuario.
- Analise de IA de governanca agora bloqueia sem contexto ou sem permissao, registra auditoria operacional e carimba atualizacoes de perfil com `group_id` e `empresa_id`.
- Botao de analise de IA recebeu marcadores de acao sensivel, permissao e contexto obrigatorio.
- Build validado com sucesso apos as alteracoes.
- Proximo passo sugerido: continuar em `MonitorAcessoRealtime` e `MonitoramentoManutencaoIndex`, reforcando acoes em tempo real, manutencoes, exportacoes e trilhas de auditoria global.

### Administracao do Sistema - Monitoramento e Auditoria Global

- Seguido o plano de melhoria nos componentes existentes de monitoramento, manutencao e logs, sem criar telas ou modulos duplicados.
- `MonitorAcessoRealtime` passou a exigir contexto grupo/empresa e permissao antes de consultar usuarios e eventos de auditoria em tempo real.
- Indicadores sensiveis do monitor de acesso receberam marcadores de acao, contexto e sensibilidade para RBAC/auditoria visual.
- `MonitoramentoManutencaoIndex` passou a registrar na auditoria o contexto e a permissao ao navegar entre abas de monitoramento, backup, acesso em tempo real e governanca.
- Container principal de monitoramento recebeu marcadores de permissao e contexto obrigatorio.
- `LogsAuditoria` passou a exigir permissao granular de exportacao antes de gerar CSV dos logs filtrados.
- Exportacao CSV de auditoria agora registra `AuditLog` com quantidade exportada, filtros usados, usuario, grupo e empresa.
- Lista de logs recebeu marcador de contexto obrigatorio para reforcar isolamento multiempresa.
- Build validado com sucesso apos as alteracoes.
- Proximo passo sugerido: continuar nos formularios `ConfiguracaoBackup` e `ConfiguracaoMonitoramento`, adicionando auditoria de bloqueios sem contexto/permissao e dados anteriores nas alteracoes.
### Abertura via GitHub no computador atual

- Repositorio correto confirmado e clonado localmente em `C:\Users\cpaba\ERP-Zuccaro-codeX-local\ERP-Zuccaro-codeX`.
- Remoto local confirmado como `https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX.git`, branch `main`.
- Mantida a regra operacional do usuario: nao alterar GitHub sem pedido explicito; as alteracoes desta sessao ficaram somente no clone local.
- Observado aviso do Windows no clone: os arquivos `src/pages/PortalCliente.jsx` e `src/pages/portalcliente.jsx` colidem em sistema de arquivos que nao diferencia maiusculas/minusculas. Nada foi excluido; risco registrado para revisao futura antes de qualquer alteracao.

### Administracao do Sistema - Monitoramento, Acesso em Tempo Real e Manutencao

- Seguido o proximo passo salvo no plano/status: continuar em `MonitorAcessoRealtime` e `MonitoramentoManutencaoIndex`, sem criar telas, modulos ou componentes duplicados.
- `MonitorAcessoRealtime` passou a exigir permissao granular de visualizacao e contexto grupo/empresa antes de consultar usuarios e auditoria recente.
- Bloqueios do monitor por ausencia de contexto ou permissao agora geram `AuditLog` com usuario, grupo, empresa, tipo de auditoria de seguranca e sucesso falso.
- O wrapper do monitor recebeu `data-permission` e `data-context-required`, reforcando rastreio de RBAC/auditoria visual.
- `MonitoramentoManutencaoIndex` passou a calcular permissao por aba: Monitoramento, Backup, Acesso em Tempo Real e Governanca.
- Abas de monitoramento receberam marcadores `data-permission`, `data-action` e `data-context-required`, alem de bloqueio visual quando faltar contexto ou permissao.
- A troca de aba agora registra auditoria com `group_id`, `grupo_id`, `empresa_id`, tipo de auditoria e sucesso.
- Build ficou pendente neste computador porque o clone novo nao tem `node_modules` e o Windows nao possui `npm`, `pnpm` ou `yarn` disponivel no PATH. E necessario instalar Node.js LTS com NPM ou disponibilizar dependencias antes de rodar `npm ci` e `npm run build`.

### Ambiente local e sincronizacao obrigatoria com GitHub

- Usuario confirmou nova regra operacional: tudo que for feito neste computador deve ser salvo tambem no GitHub para aparecer no outro PC.
- Tentada instalacao MSI oficial do Node.js LTS, mas o Windows bloqueou por falta de privilegio administrativo para `C:\Program Files`.
- Instalado Node.js LTS oficial em modo portatil do usuario: `C:\Users\cpaba\tools\node-v24.15.0-win-x64`.
- Validado Node.js `v24.15.0` e NPM `11.12.1`.
- Dependencias do ERP instaladas com `npm ci` no clone local.
- `npm ci` encontrou vulnerabilidades no pacote travado do projeto, mas nao foi executado `npm audit fix` para evitar alteracoes amplas automaticas sem revisao pela Regra-Mae.
- Build de producao validado com sucesso via `npm run build` fora do sandbox.
- Warnings restantes do build sao tecnicos/preexistentes: CSS `data-[state=checked]...button`, browserslist/baseline antigos, imports dinamicos/estaticos e chunks grandes.

### Correcao de abertura local no Codex

- Corrigido o erro visual `Erro ao iniciar o ERP local` ao abrir `http://localhost:5173/`.
- Causa identificada: o servidor estava iniciando em modo remoto e o frontend tentava chamar endpoints Base44 que retornavam 404 no ambiente local.
- O iniciador existente `start-erp-dev.cmd` foi ajustado para usar Node.js portatil local, definir `VITE_LOCAL_ONLY=true` e iniciar o Vite apenas em `127.0.0.1`.
- Servidor antigo preso na porta 5173 foi encerrado e o ERP foi reiniciado limpo em modo local.
- Validado no navegador automatizado: a mensagem de erro sumiu e o Dashboard do ERP carregou em `http://localhost:5173/?reset-local=1`.
- Mantida a Regra-Mae: nenhum modulo/tela/componente novo foi criado; apenas corrigido o iniciador existente.

### Correcao do snapshot real do GitHub no modo local

- Usuario identificou que, ao abrir o ERP local, ainda apareciam placeholders como `3Z LTDA LOCAL` e faltavam `GRUPO CPA`, `CPA FERRO E ACO`, `3Z LTDA` e registros de Cadastros Gerais.
- Confirmado que o repositorio do GitHub possui os snapshots reais em `public/base44-local-core-snapshot.json` e `public/base44-local-snapshot.json`.
- Confirmado que o snapshot compacto contem `GRUPO CPA`, as empresas `3Z LTDA` e `CPA FERRO E ACO`, alem de registros de Cadastros Gerais como Produto, GrupoProduto, Marca, UnidadeMedida, SetorAtividade, SegmentoCliente e outros.
- Causa corrigida: o ERP renderizava primeiro com `seedRecords()` local e so depois importava o snapshot em segundo plano, permitindo a tela abrir com dados `LOCAL` antes da importacao real.
- `src/main.jsx` foi ajustado para, em `VITE_LOCAL_ONLY=true`, hidratar o snapshot local antes de montar o React/ERP.
- `?reset-local=1` agora limpa o banco local e for�a a importacao do snapshot real antes da renderizacao inicial.
- Mantida a Regra-Mae: nenhum modulo/tela/componente novo foi criado; foi corrigido apenas o bootstrap existente.
- Build validado com sucesso apos a alteracao.

### Estoque e Almoxarifado - Fase 8

- Seguido o plano de melhoria no modulo existente `src/pages/Estoque.jsx`, sem criar telas, modulos ou componentes duplicados.
- Confirmado que as consultas principais de produtos, movimentacoes, solicitacoes e ordens de compra ja usam contexto grupo/empresa via `filtrarPorContexto`/`getFiltroContexto`.
- A abertura de secoes do Estoque agora usa a auditoria central `auditEstoqueAction`, registrando `group_id`, `grupo_id`, `empresa_id`, usuario, tipo de auditoria e sucesso.
- Tentativas de abrir secoes sem contexto grupo/empresa ou sem permissao continuam bloqueadas e auditadas como seguranca.
- O botao existente `Transferir entre Empresas` agora registra auditoria sensivel ao abrir e auditoria de bloqueio quando faltar contexto/permissao.
- O wrapper principal de Estoque recebeu `w-full h-full`, `data-permission="Estoque.visualizar"` e `data-context-required="true"`.
- O botao de exportacao de estoque de aco manteve bloqueio por contexto/RBAC e recebeu acao padronizada `Estoque.exportar_aco_pdf`.
- `ModulosGridEstoque` passou a propagar `data-permission` e `data-action` para os cards existentes do launchpad.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida e nenhuma tela nova foi criada; apenas reforco no fluxo existente.
- Build validado com sucesso apos as alteracoes.
- Proximo passo sugerido: continuar Fase 8 no setor `Logistica`, revisando abertura de modulos, acoes sensiveis, contexto grupo/empresa, RBAC e auditoria.

### Expedicao e Logistica - Fase 8

- Seguido o proximo passo salvo no status do projeto: continuar Fase 8 no setor `Logistica`, usando os modulos existentes de `Expedicao` sem criar telas, componentes ou funcionalidades duplicadas.
- `src/pages/Expedicao.jsx` passou a aceitar permissoes pela chave exibida do modulo e tambem pela chave tecnica `Expedicao`, mantendo compatibilidade com RBAC existente.
- A abertura de secoes de Expedicao agora registra auditoria padronizada com usuario, `group_id`, `grupo_id`, `empresa_id`, contexto ativo, secao e sucesso.
- Tentativas de abrir secoes sem contexto grupo/empresa ou sem permissao continuam bloqueadas e agora ficam auditadas como seguranca.
- O comando existente `Nova Entrega` passou a validar contexto e permissao granular antes da acao, auditando bloqueios e acionamentos permitidos.
- O wrapper principal de Expedicao recebeu `w-full h-full`, `data-permission="Expedicao.visualizar"` e `data-context-required="true"`.
- `ModulosGridExpedicao` passou a propagar `data-permission` e `data-action` para os cards existentes do launchpad.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida, nenhuma tela nova foi criada e o fluxo atual de janelas foi preservado.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 no setor `Producao`, revisando abertura de modulos, ordens, apontamentos, contexto grupo/empresa, RBAC, auditoria e integracao com Estoque/Expedicao.

### Producao - Fase 8

- Seguido o proximo passo salvo no status: continuar Fase 8 no setor `Producao`, usando a pagina e o launchpad existentes, sem criar telas, modulos ou componentes duplicados.
- `src/pages/Producao.jsx` passou a aceitar permissoes pela chave exibida do modulo e tambem pela chave tecnica `Producao`, mantendo compatibilidade com RBAC existente.
- Consultas principais de ordens de producao continuam filtradas por contexto grupo/empresa via `filtrarPorContexto` e `getFiltroContexto`.
- A abertura de secoes de Producao agora usa auditoria padronizada com usuario, `group_id`, `grupo_id`, `empresa_id`, contexto ativo, secao e sucesso.
- Tentativas de abrir secoes sem contexto grupo/empresa ou sem permissao continuam bloqueadas e agora ficam auditadas como seguranca.
- O comando existente `Nova OP` passou a auditar bloqueios por falta de empresa operacional e por permissao negada, alem da abertura permitida do formulario.
- Janelas abertas pelo launchpad de Producao agora recebem `empresaId` e `groupId`, reforcando a ramificacao operacional dos fluxos internos.
- O wrapper principal de Producao recebeu `w-full h-full`, `data-permission="Producao.visualizar"` e `data-context-required="true"`.
- `ModulosGridProducao` passou a marcar o grid existente com `data-permission="Producao.visualizar"` e contexto obrigatorio.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida, nenhuma tela nova foi criada e o fluxo atual de janelas foi preservado.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nos componentes internos de Producao, principalmente `FormularioOrdemProducao`, `KanbanProducaoInteligente` e `ApontamentoProducao`, revisando criacao/edicao/status, integracao com Estoque/Expedicao, RBAC e auditoria antes/depois.

### Producao - Fase 8 Apontamentos

- Antes de continuar novas melhorias, foi identificado que a `main` do GitHub tinha commits novos vindos de outro computador.
- A branch local foi integrada com `origin/main`, conflitos foram resolvidos em `STATUS_DO_PROJETO.md`, `MonitoramentoManutencaoIndex` e `MonitorAcessoRealtime`, e o build foi validado com sucesso.
- `ApontamentoProducao` passou a exigir contexto grupo/empresa e permissao antes de registrar apontamento.
- Bloqueios de apontamento sem contexto ou sem permissao agora geram auditoria de seguranca com `group_id`, `grupo_id`, `empresa_id`, usuario e dados tentados.
- Registros de apontamento, refugo e baixa de estoque agora reforcam `group_id`/`empresa_id` e usam o identificador real da OP.
- Auditoria da OP atualizada passou a gravar `dados_anteriores` e `dados_novos`, reforcando rastreabilidade antes/depois.
- Botao de registrar apontamento recebeu marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`, alem de bloqueio visual por contexto/RBAC.
- Mantida a Regra-Mae: nenhuma tela, modulo ou componente novo foi criado; apenas reforco do fluxo existente.
- Proximo passo sugerido: continuar em `FormularioOrdemProducao` e `KanbanProducaoInteligente`, revisando IA, mudanca de status, abertura de OP, RBAC, contexto e auditoria antes/depois.

### Producao - Fase 8 OP e Kanban

- Seguido o plano de melhoria nos componentes existentes `FormularioOrdemProducao` e `KanbanProducaoInteligente`, sem criar telas, modulos ou componentes duplicados.
- `FormularioOrdemProducao` passou a aceitar tambem as permissoes tecnicas `Producao`, mantendo compatibilidade com os nomes exibidos `Producao/Produção`.
- Salvamento de OP agora audita bloqueios sem contexto, sem empresa, sem permissao de criacao e sem permissao de edicao.
- Criacao e edicao de OP agora reforcam `group_id`, `grupo_id` e `empresa_id`, e registram auditoria com `dados_anteriores` e `dados_novos`.
- Uso da IA no formulario de OP agora exige contexto/RBAC, audita bloqueios, sucesso e erro operacional.
- Container, botao de IA e botao salvar OP receberam marcadores de contexto, permissao e acao sensivel.
- `KanbanProducaoInteligente` passou a aceitar permissoes tecnicas `Producao` para visualizar, criar e editar OP.
- Movimentacao de OP entre colunas agora valida contexto/RBAC antes da alteracao, reforca escopo multiempresa e audita antes/depois.
- Abertura de OP e abertura de nova OP pelo Kanban agora registram auditoria, incluindo bloqueios sem empresa operacional ou permissao.
- Filtro de empresa e botao `Nova OP` receberam marcadores de contexto, permissao e acao sensivel.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nos componentes internos de Producao ligados a engenharia, documentos, configuracoes e dashboards, mantendo integracao com Estoque/Expedicao.

### Producao - Fase 8 Configuracoes e Dashboard

- Seguido o plano de melhoria nos componentes existentes `ConfiguracaoProducao` e `DashboardProducaoRealtime`, sem criar telas, modulos, componentes ou arquivos duplicados.
- `ConfiguracaoProducao` passou a usar contexto grupo/empresa para buscar e salvar configuracoes, reforcando `empresa_id`, `group_id` e `grupo_id` em criacao, edicao, bloqueio e desbloqueio.
- Produtos usados nas configuracoes de producao agora sao consultados pelo fluxo contextual existente `filterInContext`, evitando listagem global fora do escopo multiempresa.
- Salvamento de configuracoes agora valida contexto, empresa operacional, RBAC granular e bloqueio administrativo antes da gravacao.
- Bloqueios de configuracao sem contexto, sem empresa, sem permissao ou sem liberacao administrativa agora geram `AuditLog` de seguranca.
- Criacao, edicao, bloqueio e desbloqueio de configuracoes agora geram `AuditLog` operacional com usuario, `group_id`, `grupo_id`, `empresa_id`, `dados_anteriores` e `dados_novos`.
- Botoes sensiveis de bloquear, desbloquear e salvar configuracoes receberam marcadores de permissao/contexto para reforco visual e rastreabilidade.
- `DashboardProducaoRealtime` passou a exigir contexto grupo/empresa e RBAC de visualizacao antes de carregar ordens e apontamentos.
- Consultas do dashboard de producao agora usam chave por contexto e `filterInContext`, mantendo os KPIs dentro do grupo/empresa autorizado.
- Wrapper do dashboard recebeu marcadores `data-permission` e `data-context-required`, preservando `w-full h-full`.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida, nenhuma tela nova foi criada e o fluxo atual de Producao foi preservado.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `DocumentosProducao`, `FormularioArmadoCompleto` e `FormularioBlocoCompleto`, revisando documentos, engenharia, etiquetas/exportacoes, RBAC, contexto e auditoria antes/depois.

### Producao - Fase 8 Engenharia e Documentos

- Seguido o plano de melhoria nos componentes existentes `DocumentosProducao`, `FormularioArmadoCompleto` e `FormularioBlocoCompleto`, sem criar telas, modulos, componentes ou arquivos duplicados.
- `DocumentosProducao` passou a exigir contexto grupo/empresa e permissao de documentos/exportacao antes de imprimir ou acionar PDF.
- Impressao e exportacao de documentos de producao agora geram `AuditLog` com usuario, `group_id`, `grupo_id`, `empresa_id`, pedido e quantidade de itens.
- Tentativas de imprimir ou gerar PDF sem contexto/RBAC agora sao bloqueadas e auditadas como seguranca.
- `FormularioArmadoCompleto` passou a buscar `ConfiguracaoProducao` pelo fluxo contextual `filterInContext`, evitando configuracao global fora do escopo multiempresa.
- Adicao de item armado agora exige contexto grupo/empresa e permissao de engenharia/armado antes de enviar o item ao pedido.
- Itens armados calculados agora recebem `empresa_id`, `group_id` e `grupo_id`, com auditoria de criacao/edicao e bloqueios.
- `FormularioBlocoCompleto` passou a buscar configuracao de producao por contexto e a validar RBAC/contexto antes de adicionar bloco ao pedido.
- Blocos calculados agora recebem `empresa_id`, `group_id` e `grupo_id`, com auditoria de criacao/edicao e bloqueios.
- Botoes de calcular, salvar, imprimir e exportar receberam marcadores `data-action`, `data-permission`, `data-context-required` e/ou `data-sensitive` conforme a sensibilidade.
- Wrappers principais preservam `w-full h-full`, reforcando o layout obrigatorio.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida, nenhuma tela nova foi criada e os fluxos atuais de producao/engenharia foram preservados.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em relatorios/exportacoes de Producao e integracoes com Estoque/Expedicao, revisando origem dos dados, filtros por grupo/empresa, permissoes e auditoria de exportacao.

### Producao - Fase 8 Relatorios, Exportacoes e Estoque

- Seguido o proximo passo salvo no status: continuar Fase 8 em relatorios/exportacoes de Producao e integracoes com Estoque/Expedicao, sem criar telas, modulos ou arquivos duplicados.
- `RelatoriosProducao` passou a validar contexto grupo/empresa e RBAC antes de exibir relatorios.
- Relatorios de Producao agora possuem exportacao CSV e impressao no componente existente, com bloqueio por contexto/permissao quando necessario.
- Exportacao CSV e impressao de relatorios agora geram `AuditLog` com usuario, `group_id`, `grupo_id`, `empresa_id`, periodo filtrado, quantidade de OPs e sucesso/bloqueio.
- Wrapper, abas e botoes de relatorio receberam marcadores `data-permission`, `data-action`, `data-context-required` e `data-sensitive` conforme a acao.
- `SeletorProdutosProducao` deixou de consultar `Produto.list()` global e passou a usar `filterInContext`, mantendo a materia-prima de producao dentro do escopo de grupo/empresa autorizado.
- Filtros e consulta do seletor de produtos agora exigem contexto ativo e permissao de visualizacao de Produtos/Producao, reforcando a integracao com Estoque.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida e nenhum modulo novo foi criado; apenas reforco nos componentes existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `OtimizadorCorte` e `EtiquetaCNC`, revisando salvar pontas no Estoque, impressao/PDF de etiquetas, contexto grupo/empresa, permissoes e auditoria.
### Producao - Fase 8 Otimizador e Etiquetas

- Seguido o proximo passo salvo no status: continuar Fase 8 em `OtimizadorCorte` e `EtiquetaCNC`, sem criar telas, modulos, componentes ou arquivos duplicados.
- `OtimizadorCorte` passou a exigir contexto grupo/empresa e RBAC antes de calcular otimizacao de corte.
- Calculo bloqueado por falta de contexto ou permissao agora gera `AuditLog` de seguranca com usuario, `group_id`, `grupo_id`, `empresa_id` e motivo do bloqueio.
- Calculo autorizado agora gera `AuditLog` operacional com as estatisticas da otimizacao.
- Salvamento de pontas reaproveitaveis no Estoque agora exige permissao, contexto grupo/empresa e confirmacao explicita antes de incluir registros, respeitando a Regra-Mae.
- Pontas reaproveitaveis agora geram `MovimentacaoEstoque` com `group_id`, `grupo_id`, `empresa_id`, origem `producao_otimizador_corte`, quantidade em kg e responsavel.
- Salvamento, cancelamento, erro e bloqueio de pontas no Estoque agora ficam auditados.
- `EtiquetaCNC` passou a validar contexto grupo/empresa e RBAC antes de imprimir ou solicitar PDF.
- Impressao e solicitacao de PDF de etiqueta agora geram `AuditLog` operacional; tentativas sem contexto/permissao geram auditoria de seguranca.
- Botoes sensiveis de calcular, salvar pontas, imprimir etiqueta e PDF receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive` quando aplicavel.
- Wrappers principais preservam/reforcam `w-full h-full` e marcadores de contexto/permissao.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida e nenhum modulo novo foi criado; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nas integracoes de Producao com Expedicao/Estoque, revisando passagem de status, separacao/conferencia, documentos e auditoria antes/depois.