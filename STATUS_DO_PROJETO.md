### Integracoes - Boleto Backend com Contexto e Auditoria Segura
- Continuei o proximo passo salvo: revisar `emitirBoleto` para aplicar payload seguro e contexto estrito em configuracao, updates e auditoria financeira.
- `emitirBoleto` agora resolve `groupId` pela empresa do titulo antes do guard financeiro e bloqueia titulo sem `empresa_id` ou sem grupo resolvido.
- A consulta de `ConfiguracaoSistema` para boletos/pagamentos passou a exigir categoria `Integracoes`, chave da empresa e `empresa_id`.
- Auditorias de Asaas, Juno e boleto simulado foram centralizadas em helper existente no proprio arquivo, registrando somente metadados minimos.
- O `AuditLog` financeiro nao grava PIX copia/cola, linha digitavel completa, dados do cliente ou payload externo integral; registra apenas flags, provedor, tipo e ID externo.
- Mantida a Regra-Mae: melhoria feita na funcao financeira existente, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar `paymentStatusManager` para reduzir payload de auditoria em baixas/conciliacao e garantir `group_id` em todos os logs financeiros.
### Integracoes - NF-e Backend com Contexto e Auditoria Segura
- Continuei o proximo passo salvo: revisar funcoes backend de integracao financeira/fiscal com chamadas externas para padronizar payload seguro, RBAC e propagacao Grupo/Empresa.
- `nfeActions` agora aceita aliases de contexto (`empresa_id`, `group_id`, `grupo_id`) e resolve `groupId` pela empresa antes do guard fiscal.
- A busca de configuracao NF-e passou a exigir `empresa_id`, evitando usar configuracao de outra empresa com a mesma chave.
- Emissao, consulta de status, cancelamento e carta de correcao agora registram auditoria resumida com empresa, grupo, acao, nota/pedido, status, numero, serie, protocolo e flags de DANFE/XML.
- O `AuditLog` fiscal nao grava o objeto completo da NF-e nem retorno externo integral do provedor, reduzindo exposicao de dados fiscais sensiveis.
- Mantida a Regra-Mae: melhoria feita na funcao fiscal existente, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar `emitirBoleto` para aplicar payload seguro e contexto estrito em configuracao, updates e auditoria financeira.
### Integracoes - Backend WhatsApp e Email com Escopo/Auditoria
- Continuei o proximo passo salvo: revisar funcoes backend `whatsappSend` e `sendEmailProvider` para garantir contexto Grupo/Empresa e auditoria tambem no servidor.
- `whatsappSend` agora completa `groupId` a partir da empresa antes do guard e usa auditoria sanitizada com numero mascarado, tipo de envio, flags de midia e retorno resumido.
- O envio simulado, envio de texto e envio de midia deixam de gravar mensagem completa ou numero completo no `AuditLog` do backend.
- `sendEmailProvider` agora aceita aliases `empresa_id`, `group_id` e `grupo_id`, resolve `groupId` pela empresa quando necessario e aplica RBAC de visualizar para status e criar para envio.
- O helper backend de auditoria passa a persistir `group_id`, permitindo rastrear logs sensiveis por Grupo/Empresa.
- As auditorias de email no backend passam a registrar somente metadados: destinatario, assunto, tipo de conteudo, quantidade de anexos e retorno resumido, sem corpo ou base64.
- Mantida a Regra-Mae: melhoria feita nas funcoes e helper existentes, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar funcoes backend de integracao financeira/fiscal com chamadas externas para padronizar payload seguro, RBAC e propagacao Grupo/Empresa.

### Integracoes - Auditoria de Envios WhatsApp e Email
- Continuei o proximo passo salvo: revisar helpers de envio WhatsApp/Email para auditar disparos com retorno minimo e contexto Grupo/Empresa.
- `enviarWhatsApp` agora registra `AuditLog` com empresa, grupo, tipo de envio, destino mascarado, tamanho da mensagem e retorno resumido.
- `enviarEmail` agora registra `AuditLog` com empresa, grupo, destinatario, assunto, tipo de conteudo, tamanho da mensagem e retorno resumido.
- Os logs evitam gravar corpo completo do email, mensagem completa, arquivo/base64 ou payload externo integral.
- Notificacoes automaticas existentes passam a encaminhar `groupId` quando o documento trouxer `group_id`/`grupo_id`.
- Mantida a Regra-Mae: melhoria feita nos helpers existentes, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar funcoes backend `whatsappSend` e `sendEmailProvider` para garantir RBAC/contexto/auditoria tambem no servidor.
### Integracoes - Auditoria de Consulta e Cancelamento de Cobrancas
- Continuei o proximo passo salvo: revisar cancelamento/consulta de cobrancas para registrar auditoria de integracao com empresa/grupo e retorno minimo.
- `consultarStatusPagamento` agora registra `AuditLog` com acao de consulta, empresa, grupo da configuracao, cobranca e retorno resumido.
- `cancelarCobranca` agora registra `AuditLog` com acao de cancelamento, empresa, grupo da configuracao, cobranca e retorno resumido.
- A auditoria evita payload externo completo e e tolerante a falhas, preservando o fluxo operacional de cobranca.
- Mantida a Regra-Mae: melhoria feita no helper existente de Boletos/PIX, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar os helpers de envio WhatsApp/Email para auditar disparos com retorno minimo e contexto Grupo/Empresa.
### Integracoes - LogCobranca com Payload Seguro
- Continuei o proximo passo salvo: revisar logs de cobranca para reduzir payload sensivel e incluir `group_id` quando disponivel.
- No helper existente de Boletos/PIX, `LogCobranca.create` deixa de gravar a conta completa e passa a registrar somente campos necessarios para auditoria: IDs, empresa, grupo, tipo, valor, vencimento e descricao.
- `LogCobranca.update` deixa de guardar o retorno completo da integracao e passa a salvar um resumo sem QR Code/base64 e sem payload externo integral.
- O log de cobranca agora inclui `group_id` quando a conta trouxer `group_id` ou `grupo_id`, reforcando rastreabilidade Grupo/Empresa.
- Mantida a Regra-Mae: melhoria feita no fluxo existente de Boletos/PIX, sem criar modulo, tela ou remover comportamento operacional.
- Proximo passo sugerido: revisar cancelamento/consulta de cobrancas para registrar auditoria de integracao com empresa/grupo e retorno minimo.
### Integracoes - Auditoria do Vinculo Asaas
- Continuei o proximo passo salvo: revisar updates sensiveis de integracao com retorno externo e alteracao local.
- No helper existente de Boletos/PIX, a gravacao de `cliente_asaas_id` no cadastro de Cliente agora registra auditoria de integracao com antes/depois, usuario, timestamp, empresa e grupo.
- A auditoria e tolerante a falhas: se o log falhar, o fluxo principal de cobranca nao e interrompido, mas o erro fica registrado no console para diagnostico.
- O payload auditado evita registrar o retorno externo completo e guarda somente dados necessarios do vinculo, conta e status.
- Mantida a Regra-Mae: melhoria no helper existente, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar logs de cobranca para reduzir payload sensivel e incluir group_id quando disponivel.
### Integracoes - Clientes com Escopo de Empresa
- Continuei o proximo passo salvo: revisar leituras diretas de clientes nas integracoes antes de chamadas externas.
- A politica multiempresa existente ganhou `recordMatchesEmpresaScope`, reutilizando normalizacao de identificadores para aceitar `empresa_id`, `empresa_dona_id`, campos operacionais de empresa e compartilhamento explicito por `empresas_compartilhadas_ids`.
- Boletos/PIX agora busca cliente primeiro por `id + empresa_id`, depois por `id + empresa_dona_id`, e bloqueia uso de cliente que nao pertence a empresa da conta.
- WhatsApp de boleto aplica a mesma validacao antes de montar a mensagem e enviar para contato do cliente.
- Emails automaticos de pedido aprovado, boleto gerado e NF-e emitida deixam de usar cliente por ID solto e exigem compatibilidade com a empresa do documento.
- Teste nativo cobre cliente direto, dono, compartilhado e bloqueio de empresa divergente.
- Mantida a Regra-Mae: melhoria feita em helpers existentes, sem criar tela, modulo, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar updates sensiveis de integracao para incluir auditoria antes/depois quando houver retorno externo e alteracao local.
### Integracoes - Configuracoes com Empresa Obrigatoria
- Continuei a revisao de chamadas diretas a `ConfiguracaoSistema.filter/create/update` com risco de consulta global sem contexto.
- Helpers existentes de NF-e, Boletos/PIX, WhatsApp e Email agora normalizam `empresaId`, bloqueiam empresa vazia e filtram configuracao por `empresa_id` alem da chave/categoria.
- `normalizeIdentifier` passou a ser exportado da politica multiempresa existente para reutilizacao sem duplicar sanitizacao de IDs.
- A busca de configuracao `integracoes_<empresaId>` e `email_<empresaId>` permanece no fluxo atual, mas deixa de aceitar dados de outra empresa por chave solta.
- Teste nativo cobre o normalizador de identificadores usado nesses fluxos sensiveis.
- Mantida a Regra-Mae: melhoria feita nos helpers existentes, sem criar modulo/tela/componente e sem remover funcionalidade.
- Proximo passo sugerido: revisar leituras diretas de clientes nas integracoes para garantir que cliente e conta pertencem ao mesmo grupo/empresa antes de chamadas externas.
### Multiempresa - ConfiguracaoSistema Local com Escopo Obrigatorio
- Continuei o proximo passo salvo em persistencia sensivel no `localBase44Client.js`.
- `upsertConfig` local deixou de aceitar escopo vazio ou aliases em branco para `ConfiguracaoSistema`, bloqueando criacao/edicao global acidental.
- O escopo recebido agora passa por `validateMultiempresaContext` e `toEntityScope`, normalizando `group_id`/`empresa_id` antes de consultar ou salvar.
- Grupo continua salvando com `group_id`; Empresa exige `group_id` e `empresa_id`, preservando a regra Grupo/Empresa sem criar fluxo paralelo.
- Teste existente de politica multiempresa cobre tambem escopo de grupo normalizado com espacos antes de persistencia.
- Mantida a Regra-Mae: melhoria feita no cliente local e helper existentes, sem criar tela, modulo, botao ou funcionalidade duplicada.
- Proximo passo sugerido: revisar chamadas diretas a `ConfiguracaoSistema.filter/create/update` que ainda podem depender de consulta global sem contexto.
### Multiempresa - IDs Canonicos em Testes e Persistencia Sensivel
- Continuei o checkpoint salvo de testes de isolamento multiempresa e persistencia sensivel.
- `contextoMultiempresaPolicy.js` agora normaliza `groupId`/`empresaId` por trim e trata aliases vazios como contexto ausente, evitando validar strings em branco.
- `toEntityScope` passa a falhar fechado quando o escopo Empresa vier sem empresa real, reforcando consultas e escritas com contexto explicito.
- Testes nativos cobrem IDs com espacos, aliases vazios e bloqueio de escopo invalido antes de persistir ou chamar guard.
- Mantida a Regra-Mae: melhoria feita no helper multiempresa existente e nos testes existentes, sem criar tela, modulo ou fluxo paralelo.
- Proximo passo sugerido: aplicar o mesmo rigor nos fluxos sensiveis de `localBase44Client.js` e guards backend com maior risco de escopo global.
### Setup Local e Portal Cliente - Caminho Fixo no Codex
- Troquei a configuracao local do Codex para usar `C:\Users\cpaba\ERP Zuccaro` como pasta fixa do projeto ERP Zuccaro, mantendo backup dos arquivos de estado antes da alteracao.
- Confirmei que o clone local esta ligado ao GitHub `viniciuszuccaro-creator/ERP-Zuccaro-codeX.git` e atualizado com `origin/main` antes da melhoria.
- Corrigi a duplicidade de rota `PortalCliente.jsx`/`portalcliente.jsx` no controle Git, mantendo `PortalCliente.jsx` como rota oficial e preservando o redirecionamento existente para Dashboard.
- `pages.config.js` deixou de importar e registrar a rota duplicada `portalcliente`, evitando conflito em Windows sem alterar a rota principal `PortalCliente`.
- Mantida a Regra-Mae: melhoria feita em arquivos existentes, com exclusao apenas da duplicidade identica que prejudicava clone/abertura em outros computadores.
- Proximo passo sugerido: instalar dependencias no clone fixo, validar build e seguir para testes de isolamento multiempresa e persistencia sensivel.
### Relatorios Operacionais - Contexto Estrito e Exportacoes Seguras
- Revisei os relatorios existentes de Logistica, Producao e Estoque sem criar nova tela, modulo ou fluxo.
- O modo Grupo exige groupId e consolida o grupo; o modo Empresa exige groupId e empresaId e nao mistura registros de outras empresas.
- O filtro de Estoque deixou de aceitar qualquer item do mesmo grupo na visao Empresa e agora admite somente a empresa ativa ou cadastros explicitamente compartilhados pelo Grupo.
- Os CSVs de Logistica e Producao neutralizam formulas e removem quebras de linha; Producao agora confirma a exportacao e inclui Grupo/Empresa no arquivo.
- Chaves e marcadores de contexto foram alinhados a Grupo/Empresa, mantendo RBAC, auditoria e confirmacoes existentes.
- Textos com codificacao quebrada em Relatorios de Producao foram normalizados sem alterar status ou valores gravados.
- Mantida a Regra-Mae: nenhuma funcionalidade, aba, botao, grafico ou formato existente foi removido.
- Proximo passo sugerido: revisar testes automatizados de isolamento multiempresa e fluxos de persistencia mais sensiveis.
### Dashboards em Tempo Real - Contexto Estrito e RBAC
- Revisei DashboardTempoReal, DashboardEntregasRealtime e DashboardProducaoRealtime sem criar nova tela, modulo ou fluxo.
- O modo Grupo agora exige groupId; o modo Empresa exige groupId e empresaId, com mensagem especifica quando o contexto estiver incompleto.
- Os dashboards bloqueiam consultas sem permissao de visualizacao e usam chaves de consulta com contexto, Grupo e Empresa.
- Os hooks useRealtimeKPIs, useRealtimePedidos e useRealtimeEntregas deixaram de consultar listas globais quando nao houver contexto e agora recebem habilitacao explicita.
- Entregas e Producao receberam polling controlado com cache contextual, sem atualizacao em segundo plano.
- Mantida a Regra-Mae: melhoria nos dashboards e hooks existentes, sem remover cards, graficos, botoes ou comportamento autorizado.
- Proximo passo sugerido: finalizar os relatorios operacionais de Logistica, Producao e Estoque com contexto estrito, RBAC, auditoria, sanitizacao e textos corrigidos.
### Administracao do Sistema - Fase 12 Central RBAC com Dados de Cards Extraidos
- Continuei a refatoracao obrigatoria de `CentralPerfisAcesso.jsx`, sem criar nova tela, modulo ou fluxo.
- `rbacScopeUtils.js` agora centraliza `buildPerfilCardInfo` para calcular permissoes totais, usuarios vinculados, status ativo e nome de exibicao dos cards de perfil.
- `CentralPerfisAcesso.jsx` preserva a renderizacao dos mesmos cards, botoes, badges e confirmacao de exclusao, mas deixou de calcular esses dados diretamente no JSX.
- A protecao contra exclusao de perfil em uso continua usando os mesmos usuarios vinculados e a mesma mensagem de bloqueio.
- Mantida a Regra-Mae: melhoria feita somente na central e utilitario existentes, sem remover funcionalidade, botao, aba ou comportamento.
- Proximo passo sugerido: revisar os dashboards em tempo real para reforcar contexto Grupo/Empresa, RBAC e isolamento das consultas.
### Administracao do Sistema - Fase 12 Central RBAC com Estatisticas Extraidas
- Continuei a refatoracao obrigatoria de `CentralPerfisAcesso.jsx`, sem criar nova tela, modulo ou fluxo.
- `rbacScopeUtils.js` agora centraliza `buildPerfilStats` e `filterPerfisByBusca`.
- `CentralPerfisAcesso.jsx` preserva o mesmo painel de total de perfis, cobertura e busca, mas deixou de calcular estatisticas e filtro diretamente no componente.
- O filtro de busca continua usando `nome_perfil` e a cobertura continua considerando usuarios com `perfil_acesso_id`.
- Mantida a Regra-Mae: melhoria feita somente na central e utilitario existentes, sem remover funcionalidade, botao, aba ou comportamento.
- Proximo passo sugerido: revisar outra aba de Gestao de Acessos ou continuar reduzindo a central RBAC separando renderizacao de cards quando for seguro.
### Administracao do Sistema - Fase 12 Central RBAC com Formulario Normalizado
- Continuei a refatoracao obrigatoria de `CentralPerfisAcesso.jsx`, sem criar nova tela, modulo ou fluxo.
- `rbacScopeUtils.js` agora centraliza `PERFIL_FORM_DEFAULT`, `normalizeSetoresPerfil` e `buildPerfilFormState`.
- `CentralPerfisAcesso.jsx` passou a usar o formulario padrao compartilhado no estado inicial/reset e normaliza setores por helper antes de gravar no estado.
- A abertura de edicao de perfil agora monta o estado do formulario por helper puro, preservando nome, descricao, nivel, escopo, setores, permissoes e status ativo.
- Mantida a Regra-Mae: melhoria feita somente na central e utilitario existentes, sem remover funcionalidade, botao, aba ou comportamento.
- Proximo passo sugerido: continuar reduzindo `CentralPerfisAcesso.jsx` separando estatisticas/filtro de perfis ou revisar outra aba de Gestao de Acessos quando for seguro.
### Administracao do Sistema - Fase 12 Central RBAC com Selecao de Permissoes Extraida
- Continuei a refatoracao obrigatoria de `CentralPerfisAcesso.jsx`, sem criar nova tela, modulo ou fluxo.
- `rbacScopeUtils.js` agora centraliza `togglePermissaoState`, `toggleSecaoPermissoesState`, `toggleModuloPermissoesState` e `toggleGlobalPermissoesState`.
- `CentralPerfisAcesso.jsx` preserva as mesmas verificacoes de permissao, mensagens e botoes, mas deixou de montar manualmente as estruturas de permissoes dentro do componente.
- A selecao individual, por secao, por modulo e global continua usando `ACOES` e `ESTRUTURA_SISTEMA` existentes, mantendo RBAC granular.
- Mantida a Regra-Mae: melhoria feita somente na central e utilitario existentes, sem remover funcionalidade, botao, aba ou comportamento.
- Proximo passo sugerido: continuar reduzindo a `CentralPerfisAcesso.jsx` separando normalizacao de setores/formulario ou revisando outra aba de Gestao de Acessos quando for seguro.
### Administracao do Sistema - Fase 12 Central RBAC com Payload de Formulario Extraido
- Continuei a refatoracao obrigatoria de `CentralPerfisAcesso.jsx`, sem criar nova tela, modulo ou fluxo.
- `rbacScopeUtils.js` agora centraliza `countPermissoesTotal`, `countPermissoesModulo` e `buildPerfilFormSubmitPayload`.
- `CentralPerfisAcesso.jsx` passou a usar helpers puros para contagem de permissoes e montagem do payload do formulario antes de salvar.
- O submit preserva `nivel_acesso_contexto`, `acesso_grupo`, `acesso_empresas`, departamentos e IDs de Grupo/Empresa no mesmo fluxo existente.
- Mantida a Regra-Mae: melhoria feita somente na central e utilitario existentes, sem remover funcionalidade, botao, aba ou comportamento.
- Proximo passo sugerido: continuar reduzindo a `CentralPerfisAcesso.jsx` separando controles de selecao de permissoes quando for seguro.
### Administracao do Sistema - Fase 12 Central RBAC com Bloqueios Extraidos
- Continuei a refatoracao obrigatoria de `CentralPerfisAcesso.jsx`, sem criar nova tela, modulo ou fluxo.
- `rbacScopeUtils.js` agora centraliza `buildPerfilSaveBlock` e `buildPerfilDeleteBlock` para validar contexto multiempresa e permissao granular antes de salvar/excluir perfis.
- `CentralPerfisAcesso.jsx` preserva as mesmas chamadas de auditoria, `createInContext`, `updateInContext` e `deleteInContext`, mas deixou de duplicar os objetos de bloqueio dentro das mutations.
- Bloqueios por falta de Grupo/Empresa e por falta de permissao continuam auditados com motivo, perfil, acao e sucesso falso.
- Mantida a Regra-Mae: melhoria feita somente na central e utilitario existentes, sem remover funcionalidade, botao, aba ou fluxo.
- Proximo passo sugerido: continuar reduzindo a `CentralPerfisAcesso.jsx` separando payload do formulario ou controles de permissao quando for seguro.
### Administracao do Sistema - Fase 12 Central RBAC com Auditoria Extraida
- Continuei a refatoracao obrigatoria de `CentralPerfisAcesso.jsx`, sem criar nova tela, modulo ou fluxo.
- `rbacScopeUtils.js` agora centraliza tambem `buildPerfilAuditPayload`, mantendo usuario, timestamp, grupo, empresa, contexto e dados auditaveis em helper puro.
- `CentralPerfisAcesso.jsx` preserva a chamada a `createInContext('AuditLog')`, mas deixou de montar manualmente o objeto completo da auditoria.
- Auditorias de bloqueio, fallback, criacao, edicao e exclusao de perfis continuam usando o mesmo fluxo e a mesma entidade `AuditLog`.
- Mantida a Regra-Mae: refatoracao feita somente na central e utilitario existentes, sem remover funcionalidade ou duplicar componente.
- Proximo passo sugerido: continuar separando validacoes de salvamento/exclusao da `CentralPerfisAcesso.jsx` quando for seguro.

### Administracao do Sistema - Fase 12 Central RBAC com Payload Extraido
- Continuei a refatoracao obrigatoria de `CentralPerfisAcesso.jsx`, sem criar nova tela, modulo ou fluxo.
- `rbacScopeUtils.js` agora tambem centraliza `buildRbacContextData` e `buildPerfilRbacPayload`.
- `CentralPerfisAcesso.jsx` deixou de manter helper local duplicado de contexto RBAC e passou a importar o payload auditavel do utilitario existente.
- Salvamento de perfil preserva o mesmo fluxo de criacao/edicao, mas monta `contexto_valido`, `group_id`, `grupo_id`, `empresa_id` e `empresas_grupo_ids` por helper reutilizavel.
- Auditoria de perfil preserva usuario, timestamp, grupo/empresa e permissao base, agora com helper de contexto compartilhado.
- Mantida a Regra-Mae: refatoracao feita somente na central e utilitario existentes, sem remover funcionalidade ou duplicar componente.
- Proximo passo sugerido: continuar separando helpers de auditoria/salvamento da `CentralPerfisAcesso.jsx` quando for seguro ou voltar aos cadastros restantes se a prioridade mudar.

### Administracao do Sistema - Fase 12 Central RBAC com Helpers de Escopo
- Continuei a refatoracao obrigatoria de `CentralPerfisAcesso.jsx`, sem criar nova tela, modulo ou fluxo.
- Extraidos helpers puros de escopo para `src/components/sistema/central-perfis-acesso/rbacScopeUtils.js`.
- `normalizeEmpresaIds`, `perfilNoEscopo` e `usuarioNoEscopo` agora ficam reutilizaveis e isolados da UI, preservando a regra multiempresa Grupo/Empresa.
- `CentralPerfisAcesso.jsx` passou a importar os helpers e manteve o mesmo comportamento de consulta, fallback filtrado, auditoria, salvamento e exclusao.
- O componente principal reduziu de 568 para 549 linhas, mantendo `w-full/h-full`, botoes, abas e fluxo atual.
- Mantida a Regra-Mae: refatoracao feita sobre a central existente, sem remover funcionalidade ou duplicar componente.
- Proximo passo sugerido: continuar separando helpers de auditoria/salvamento da `CentralPerfisAcesso.jsx` quando for seguro.

### Administracao do Sistema - Fase 12 Central de Perfis RBAC Refatorada
- Continuei o proximo passo salvo da Regra-Mae: refatorar `CentralPerfisAcesso.jsx` por estar grande, sem criar nova tela, modulo ou fluxo.
- Extraida a configuracao estatica de modulos, acoes e classes de cor para `src/components/sistema/central-perfis-acesso/rbacPerfilConfig.jsx`.
- `CentralPerfisAcesso.jsx` deixou de carregar o mapa completo de estrutura RBAC dentro do componente e passou a importar `ESTRUTURA_SISTEMA`, `ACOES` e `COR_CLASS`.
- Removido import antigo nao usado de tooltip junto da limpeza de imports, preservando todos os botoes, abas, permissoes e fluxo de salvamento/exclusao.
- O componente principal reduziu de 599 para 568 linhas e a configuracao ficou isolada em arquivo pequeno de 66 linhas.
- Mantida a Regra-Mae: refatoracao feita apenas sobre a central existente, sem duplicar funcionalidade e sem remover recursos.
- Proximo passo sugerido: continuar refatorando `CentralPerfisAcesso.jsx` separando helpers de escopo/auditoria quando for seguro.

### Administracao do Sistema - Fase 12 Central de Perfis RBAC com Auditoria
- Continuei o proximo passo salvo em Gestao de Acessos, sem criar tela, modulo, componente ou arquivo novo.
- `CentralPerfisAcesso.jsx` agora exige escopo multiempresa completo: no Grupo exige `groupId`; na Empresa exige `groupId` e `empresaId`.
- Consulta fallback de `PerfilAcesso` deixou de retornar lista global sem filtro e agora filtra por `group_id`, `empresa_id` e empresas vinculadas ao grupo.
- Salvamento de perfil RBAC passou a bloquear falta de contexto/permissao, carimbar `contexto_valido`, `group_id`, `grupo_id`, `empresa_id` e `empresas_grupo_ids` quando aplicavel.
- Criacao, edicao, exclusao e bloqueios de perfil RBAC agora geram auditoria com usuario, timestamp, Grupo/Empresa, motivo e totais relevantes.
- Botao de editar perfil tambem respeita contexto valido e recebeu marcador `data-context-required`.
- Mantida a Regra-Mae: melhoria feita somente na central existente de perfis, sem duplicar modulo, tela ou componente.
- Proximo passo sugerido: revisar o componente grande `CentralPerfisAcesso.jsx` para separar funcoes internas quando for seguro, preservando comportamento atual.

### Administracao do Sistema - Fase 12 Relatorio RBAC com Escopo Estrito
- Continuei o proximo passo salvo em Gestao de Acessos, sem criar tela, modulo, componente ou arquivo novo.
- `RelatorioPermissoes.jsx` agora exige escopo multiempresa completo: no Grupo exige `groupId`; na Empresa exige `groupId` e `empresaId`.
- Exportacoes JSON/TXT passam a registrar `contexto_valido`, `group_id`, `empresa_id`, total e IDs das empresas do grupo.
- O JSON exportado agora inclui identificadores de perfis/usuarios, vinculos de Grupo/Empresa e empresas vinculadas, reforcando rastreabilidade RBAC.
- O TXT exportado passou a mostrar GroupId/EmpresaId por perfil e usuario, alem do resumo de empresas do grupo.
- Bloqueio de exportacao sem contexto usa mensagem especifica para Grupo ou Empresa e fica auditado com motivo padronizado.
- Mantida a Regra-Mae: melhoria feita somente no componente existente de relatorio RBAC, sem remover botoes ou criar fluxo paralelo.
- Proximo passo sugerido: continuar em Gestao de Acessos revisando `CentralPerfisAcesso` para propagacao efetiva de perfis entre Grupo e Empresas.

### Administracao do Sistema - Fase 12 SoD com Escopo e Propagacao Auditavel
- Continuei o proximo passo de Gestao de Acessos/RBAC, sem criar tela, modulo, componente ou arquivo novo.
- `SoDChecker.jsx` agora diferencia a exigencia de contexto: no Grupo exige `groupId`; na Empresa exige `groupId` e `empresaId`.
- A chamada da analise SoD passou a carregar `empresas_grupo_ids` quando executada no Grupo, preservando rastreabilidade para propagacao Grupo-Empresas.
- Persistencia de conflitos SoD agora grava contexto, `group_id`, `empresa_id`, empresas do grupo, data da ultima analise e indicador de propagacao auditavel.
- Auditoria SoD passou a incluir `contexto_valido` e lista de empresas do grupo, reforcando seguranca, RBAC e multiempresa.
- `SoDResults.jsx` corrigiu texto de severidade com encoding quebrado, mantendo o componente existente.
- Mantida a Regra-Mae: melhoria feita somente no fluxo SoD existente, sem remover botoes, abas ou funcionalidades.
- Proximo passo sugerido: continuar em Gestao de Acessos revisando `RelatorioPermissoes` para garantir filtros e auditoria por Grupo/Empresa.

### Administracao do Sistema - Fase 12 Gestao de Acessos com Escopo Estrito
- Continuei o proximo passo salvo em Administracao do Sistema, sem criar tela, modulo, componente ou arquivo novo.
- `UsuariosTab.jsx` agora exige escopo multiempresa completo: no Grupo exige `groupId`; na Empresa exige `groupId` e `empresaId`.
- Convites de usuario passam a auditar `contexto_valido`, motivo padronizado de bloqueio, falhas de convite e e-mail invalido com sucesso/falha explicito.
- `GestaoUsuariosAvancada.jsx` passou a bloquear alteracao de acesso quando a empresa nao estiver vinculada a um grupo ativo, alinhando salvamento de RBAC com a Regra-Mae multiempresa.
- Auditoria de alteracao/bloqueio de usuario agora inclui `contexto_valido`, reforcando rastreabilidade de Grupo/Empresa.
- Mantida a Regra-Mae: melhoria feita somente nos componentes existentes de Gestao de Acessos, sem duplicar fluxo e sem remover funcionalidade.
- Proximo passo sugerido: continuar em Gestao de Acessos revisando propagacao efetiva de perfis entre Grupo e Empresas e relatorios RBAC.

### Administracao do Sistema - Fase 12 Ferramentas com Auditoria Robusta
- Voltei ao proximo passo salvo apos Cadastros Gerais, sem criar tela, modulo, componente ou arquivo novo.
- `AdminTabs.jsx` manteve a aba existente de Ferramentas e reforcou permissoes granulares `Sistema.Ferramentas.criar/executar/editar`, preservando compatibilidade com permissoes antigas de Configuracoes.
- Execucoes de seed, dry-run e aplicacao de backfill agora auditam contexto multiempresa completo, payload sanitizado, sucesso/falha e erro quando a funcao falhar.
- Bloqueios por falta de contexto ou permissao e cancelamento manual do backfill agora ficam registrados em auditoria com `groupId`, `empresaId`, grupo/empresa e motivo.
- Botoes da aba Ferramentas receberam `data-permission` e `data-context-required` especificos, reforcando RBAC visual e rastreabilidade.
- Mantida a Regra-Mae: melhoria feita no componente existente, sem duplicar aba, modulo ou fluxo, e sem remover funcionalidades.
- Proximo passo sugerido: continuar em Administracao do Sistema revisando Gestao de Acessos/RBAC e propagacao Grupo-Empresas.

### Cadastros Gerais - Fase 11 Produto Completo com Wrapper Seguro
- Segui o proximo passo salvo apos Representante Completo, sem criar tela, modulo, componente ou arquivo novo.
- `ProdutoFormCompleto.jsx` deixou de repassar `formData` direto e passou a validar contexto grupo/empresa e permissao de criar/editar antes do callback `onSubmit`.
- O wrapper completo agora sanitiza descricao, codigo, grupo, unidades, fatores de conversao, medidas, NCM/CEST, status e contexto antes de enviar o payload.
- Importacoes por NF-e/lote agora passam por sanitizacao e bloqueiam execucao sem contexto ou sem permissao de criar produto.
- `ProdutoFormHeader.jsx` recebeu bloqueio visual/RBAC nos botoes de importacao, mantendo o componente existente e sem duplicar fluxo.
- Historico do produto no wrapper completo agora usa o registro normalizado (`dadosIniciais.id`), preservando abertura pelo Visualizador Universal.
- Mantida a Regra-Mae: melhoria feita somente nos componentes existentes, reforcando multiempresa, RBAC e seguranca.
- Proximo passo sugerido: procurar novos pontos com `onSubmit(formData)` em Cadastros Gerais e, se nao houver, voltar para Administracao do Sistema.

### Cadastros Gerais - Fase 11 Representante Completo com Contexto
- Segui o proximo passo salvo apos Cliente Completo, sem criar tela, modulo, componente ou arquivo novo.
- `RepresentanteFormCompleto.jsx` passou a aceitar aliases do Visualizador Universal (`item`, `data`, `initialData` e `defaultValues`), preservando edicao de registros existentes.
- Salvamento deixou de enviar estado cru e passou a montar payload sanitizado antes do `createInContext`, `updateInContext` e callback `onSubmit`.
- Dados pessoais/juridicos, contato, endereco, regioes de atendimento, comissao, dados bancarios, contrato, status e observacoes passam por sanitizacao/conversao antes do envio.
- Exclusao e alteracao de status agora exigem contexto grupo/empresa e respeitam RBAC granular antes da acao.
- Mantida a Regra-Mae: melhoria feita somente no formulario existente, reforcando multiempresa, RBAC e seguranca sem duplicar fluxo.
- Proximo passo sugerido: revisar `ProdutoFormCompleto.jsx`, que ainda repassa `formData` direto no wrapper de submit.

### Cadastros Gerais - Fase 11 Cliente Completo com Contexto
- Segui o proximo passo salvo apos Fornecedor Completo, sem criar tela, modulo, componente ou arquivo novo.
- `CadastroClienteCompleto.jsx` passou a aceitar aliases do Visualizador Universal (`item`, `data`, `initialData` e `defaultValues`), preservando edicao de registros existentes.
- Salvamento deixou de enviar `formData` cru e passou a montar payload sanitizado antes do `createInContext`, `updateInContext` e callback `onSubmit`.
- Nome, documentos fiscais, endereco principal, contatos, locais de entrega, condicao comercial, configuracao fiscal, observacoes e documentos passam por sanitizacao/conversao antes do envio.
- Acoes de salvar, excluir e alterar status agora exigem contexto grupo/empresa e respeitam RBAC granular de criar, editar e excluir.
- Mantida a Regra-Mae: melhoria feita somente no formulario existente, reforcando multiempresa, RBAC, seguranca e auditoria indireta do fluxo atual.
- Proximo passo sugerido: continuar buscando formularios restantes em Cadastros Gerais que ainda enviam `formData` cru ou nao bloqueiam acoes sem contexto.

### Cadastros Gerais - Fase 11 Fornecedor Completo com Sanitizacao
- Segui o proximo passo salvo apos Empresa Completa, sem criar tela, modulo, componente ou arquivo novo.
- `CadastroFornecedorCompleto.jsx` deixou de repassar `formData` cru no callback e passou a usar payload sanitizado.
- O formulario completo de fornecedor agora aceita aliases do Visualizador Universal (`item`, `data`, `initialData` e `defaultValues`), preservando edicao de registros existentes.
- Salvamento reforca contexto grupo/empresa, reaplica `group_id`, `empresa_id` e `empresa_dona_id` no payload existente.
- Nome, razao social, CNPJ, IE, RNTRC, contato, endereco, categoria, prazos, status e avaliacoes passam por sanitizacao/conversao antes do envio.
- Alternancia de status agora bloqueia perfis sem permissao de editar e respeita contexto visual.
- Mantida a Regra-Mae: melhoria feita somente no formulario existente, sem duplicar fluxo, tela ou arquivo.
- Proximo passo sugerido: continuar em `CadastroClienteCompleto.jsx`.

### Cadastros Gerais - Fase 11 Empresa Completa com Contexto
- Segui o proximo passo salvo apos regioes de atendimento, sem criar tela, modulo, componente ou arquivo novo.
- `EmpresaFormCompleto.jsx` deixou de enviar `formData` cru e passou a montar payload sanitizado antes do `onSubmit`.
- O formulario completo de empresa agora aceita aliases do Visualizador Universal (`item`, `data`, `initialData` e `defaultValues`), preservando edicao de registros existentes.
- Salvamento agora valida permissao de criar/editar, exige contexto grupo/empresa e carimba `group_id` e `empresa_id`.
- Razao social, fantasia, CNPJ, IE, endereco, certificado, configuracao fiscal e webhooks passam por sanitizacao/conversao antes do envio.
- Exclusao e alternancia de status respeitam permissao e contexto antes da acao.
- Mantida a Regra-Mae: melhoria feita somente no formulario existente, sem duplicar fluxo, tela ou arquivo.
- Proximo passo sugerido: continuar em `CadastroClienteCompleto.jsx` e `CadastroFornecedorCompleto.jsx`.

### Cadastros Gerais - Fase 11 Regioes de Atendimento com Contexto
- Segui o proximo passo salvo apos auxiliares de produto, sem criar tela, modulo, componente ou arquivo novo.
- `RegiaoAtendimentoForm.jsx` deixou de enviar `formData` cru e passou a montar payload sanitizado antes do `onSubmit`.
- O formulario passou a aceitar aliases do Visualizador Universal (`item`, `data`, `initialData` e `defaultValues`), preservando edicao de registros existentes.
- Salvamento agora valida permissao de criar/editar, exige contexto grupo/empresa e carimba `group_id` e `empresa_id`.
- Estados, cidades/CEPs, logistica, comercial, observacoes, vendedores e transportadoras passam por sanitizacao/conversao antes do envio.
- Exclusao e alternancia de status respeitam permissao granular antes da acao.
- Mantida a Regra-Mae: melhoria feita somente no formulario existente, sem duplicar fluxo, tela ou arquivo.
- Proximo passo sugerido: continuar em `EmpresaFormCompleto.jsx`, `CadastroClienteCompleto.jsx` e `CadastroFornecedorCompleto.jsx`.

### Cadastros Gerais - Fase 11 Auxiliares de Produto Sanitizados
- Segui o proximo passo salvo apos o formulario principal de produtos, sem criar tela, modulo, componente ou arquivo novo.
- `PrecosSection.jsx` e `PesoDimensoesSection.jsx` passaram a converter numeros com helper seguro antes de atualizar o estado do produto.
- `FiscalContabilSection.jsx` passou a sanitizar codigos fiscais/contabeis e converter aliquotas com helper seguro antes de atualizar o estado.
- Foram preservados os controles de contexto e RBAC visual ja existentes nos auxiliares de produto.
- Mantida a Regra-Mae: melhoria feita somente nos componentes existentes de produto, sem duplicar fluxo, tela ou arquivo.
- Proximo passo sugerido: voltar aos formularios restantes listados em `onSubmit(formData)`, priorizando `CadastroClienteCompleto.jsx`, `CadastroFornecedorCompleto.jsx`, `EmpresaFormCompleto.jsx` e `RegiaoAtendimentoForm.jsx`.

### Cadastros Gerais - Fase 11 Produtos com Contexto e Sanitizacao
- Segui o proximo passo salvo apos grupos/empresas/contatos, sem criar tela, modulo, componente ou arquivo novo.
- `ProdutoForm.jsx` deixou de enviar `formData` cru e passou a montar payload sanitizado antes do `onSubmit`.
- O formulario principal de produtos agora aceita aliases do Visualizador Universal quando aplicavel (`item`, `data`, `initialData` e `defaultValues`), preservando edicao de registros existentes.
- Salvamento agora valida permissao de criar/editar, exige contexto grupo/empresa e carimba `group_id` e `empresa_id` no fluxo existente.
- Campos de descricao, codigo, grupo, unidade, fatores de conversao, pesos/dimensoes, fiscal e status passam por sanitizacao/conversao antes do envio.
- `ProdutoFormCompleto.jsx` passou a repassar o registro normalizado para o formulario principal, abas de conversao/e-commerce e historico, evitando perda de dados ao abrir pelo Visualizador Universal.
- Mantida a Regra-Mae: melhoria feita somente nos formularios existentes de produto, sem duplicar fluxo, tela ou arquivo.
- Proximo passo sugerido: continuar revisando produtos em componentes auxiliares e depois voltar para demais itens ainda listados em `onSubmit(formData)`.

### Cadastros Gerais - Fase 11 Grupos Empresas e Contatos com Contexto
- Segui o proximo passo salvo apos formularios comerciais/financeiros, sem criar tela, modulo, componente ou arquivo novo.
- `ContatoB2BForm.jsx`, `EmpresaForm.jsx` e `GrupoEmpresarialForm.jsx` deixaram de enviar `formData` cru e passaram a montar payload sanitizado antes do salvamento.
- Os tres formularios passaram a aceitar aliases do Visualizador Universal quando aplicavel (`item`, `data`, `initialData` e `defaultValues`), preservando edicao de registros existentes.
- Salvamento agora valida permissao de criar/editar, exige contexto grupo/empresa quando necessario e carimba `group_id` e/ou `empresa_id` no fluxo existente.
- Grupo Empresarial preserva compatibilidade com campos legados `nome_do_grupo`/`cnpj_opcional`, filtra empresas pelo grupo atual e reforca vinculacao de empresas com RBAC visual.
- Empresa passa a sanitizar dados fiscais e certificado digital antes do `onSubmit`, mantendo alerta de vencimento do certificado.
- Campos, selects, switches, checkboxes e botoes receberam reforco visual de RBAC com `data-permission`, `data-action` e `data-sensitive`.
- Mantida a Regra-Mae: melhoria feita somente nos formularios existentes, sem duplicar fluxo, tela ou arquivo.
- Proximo passo sugerido: continuar nos formularios de produtos que ainda aparecem na busca por `onSubmit(formData)`, priorizando `ProdutoForm.jsx` e `ProdutoFormCompleto.jsx`.

### Cadastros Gerais - Fase 11 Formularios Comerciais/Financeiros com Contexto
- Segui o proximo passo salvo apos Boletos e WhatsApp, sem criar tela, modulo, componente ou arquivo novo.
- `SegmentoClienteForm.jsx`, `FilialForm.jsx` e `FormaPagamentoForm.jsx` deixaram de enviar `formData` cru e passaram a montar payload sanitizado antes do salvamento.
- Os tres formularios passaram a aceitar aliases do Visualizador Universal quando aplicavel (`item`, `data`, `initialData` e `defaultValues`), preservando edicao de registros existentes.
- Salvamento agora exige contexto grupo/empresa, valida permissao de criar/editar e carimba `group_id` e `empresa_id` no fluxo existente.
- Filial filtra matrizes pelo grupo atual quando existe contexto, reduzindo mistura de empresas fora do grupo.
- Campos, selects, switches e botoes receberam reforco visual de RBAC com `data-permission`, `data-action` e `data-sensitive`.
- Mantida a Regra-Mae: melhoria feita somente nos formularios existentes, sem duplicar fluxo, tela ou arquivo.
- Proximo passo sugerido: continuar nos formularios restantes que ainda aparecem na busca por `onSubmit(formData)`, priorizando `ContatoB2BForm.jsx`, `EmpresaForm.jsx`, `GrupoEmpresarialForm.jsx` e produtos.

### Cadastros Gerais - Fase 11 Boletos e WhatsApp com Contexto e RBAC
- Segui o proximo passo salvo apos integracoes, sem criar tela, modulo, componente ou arquivo novo.
- `ConfiguracaoBoletosForm.jsx` passou a aceitar aliases do Visualizador Universal (`item`, `data`, `initialData` e `defaultValues`), evitando perda de dados em edicao.
- `ConfiguracaoWhatsAppForm.jsx` passou a aceitar os mesmos aliases e preserva o fluxo atual de criacao/edicao.
- Os dois formularios agora exigem contexto grupo/empresa antes de salvar e carimbam `group_id` e `empresa_id` no payload enviado ao fluxo existente.
- Provedor, URLs, tokens, wallet, instancia, telefone, percentuais, prazos, templates e observacoes passam por sanitizacao/conversao antes do `onSubmit`.
- Campos, switches e botoes receberam reforco visual de RBAC com `data-permission`, `data-action` e `data-sensitive`, bloqueando edicao quando o perfil nao pode criar/editar.
- Mantida a Regra-Mae: melhoria feita somente nos formularios existentes de Boletos e WhatsApp, sem duplicar fluxo, tela ou arquivo.
- Proximo passo sugerido: continuar procurando formularios simples restantes em Cadastros Gerais que ainda enviam `formData` cru ou nao bloqueiam salvamento sem contexto.

### Cadastros Gerais - Fase 11 Integracoes com Contexto e Seguranca
- Segui o proximo passo salvo apos formularios operacionais, sem criar tela, modulo, componente ou arquivo novo.
- `ConfiguracaoIntegracaoForm.jsx` passou a aceitar aliases do Visualizador Universal (`item`, `data`, `initialData` e `defaultValues`), evitando perda de dados em edicao.
- Salvamento agora exige contexto grupo/empresa, valida permissao de criar/editar e carimba `group_id` e `empresa_id` no payload existente.
- Marketplace, nome, tipo, descricao, URL, token/API key, timeout, retry e observacoes passam por sanitizacao/conversao antes do `onSubmit`.
- Campos sensiveis receberam RBAC visual com `data-permission`, `data-action` e `data-sensitive`, preservando o formulario atual.
- Mantida a Regra-Mae: melhoria feita somente no formulario existente, sem duplicar fluxo, tela ou arquivo.
- Proximo passo sugerido: continuar em `ConfiguracaoBoletosForm.jsx` e `ConfiguracaoWhatsAppForm.jsx`, que ainda precisam do mesmo padrao.

### Cadastros Gerais - Fase 11 Formularios Operacionais com Contexto e RBAC
- Segui o proximo passo salvo apos os formularios sensiveis, sem criar tela, modulo, componente ou arquivo novo.
- `CentroOperacaoForm.jsx`, `CentroResultadoForm.jsx` e `TabelaPrecoForm.jsx` passaram a aceitar aliases do Visualizador Universal (`item`, `data`, `initialData` e `defaultValues`), evitando perda de dados ao editar registros existentes.
- Os tres formularios agora bloqueiam salvamento sem contexto grupo/empresa e carimbam `group_id` e `empresa_id` no payload enviado ao fluxo existente.
- Entradas de nomes, codigos, descricoes, datas, endereco e geolocalizacao passaram por sanitizacao local antes do `onSubmit`.
- Campos, seletores, switches e botoes receberam reforco de RBAC visual com `data-permission`, `data-action` e `data-sensitive`, mantendo layout e componentes existentes.
- Mantida a Regra-Mae: melhoria feita somente nos formularios existentes, sem duplicar fluxo, tela ou arquivo.
- Proximo passo sugerido: continuar revisando formularios simples restantes em Cadastros Gerais, especialmente integracoes/boletos/WhatsApp que ainda enviam `formData` cru.

### Cadastros Gerais - Fase 11 Formularios Sensiveis com Contexto e Sanitizacao
- Segui o proximo passo salvo apos o Visualizador Universal, sem criar tela, modulo, componente ou arquivo novo.
- `RepresentanteForm.jsx`, `UsuarioForm.jsx` e `CadastroFiscalForm.jsx` passaram a aceitar os aliases do visualizador universal (`item`, `data`, `initialData` e `defaultValues`), evitando perda de dados ao abrir registros existentes.
- Os tres formularios agora validam contexto grupo/empresa antes de salvar e carimbam `group_id` e `empresa_id` no payload enviado ao fluxo existente.
- Entradas de texto, documentos, telefones, e-mails, codigos fiscais e percentuais passaram por sanitizacao local antes do `onSubmit`, reduzindo risco de XSS/injecao em cadastros sensiveis.
- Botoes, campos e seletores receberam reforco visual de RBAC com `data-permission`, `data-action` e `data-sensitive`, alem de bloqueio quando o perfil nao pode criar/editar.
- Mantida a Regra-Mae: melhoria feita somente nos formularios existentes e integrada ao Visualizador Universal, preservando fluxo, layout e componentes atuais.
- Proximo passo sugerido: continuar revisando formularios simples restantes de Cadastros Gerais que ainda enviam `formData` cru ou nao bloqueiam salvamento sem contexto.

### Cadastros Gerais - Fase 11 Visualizador Universal com Auditoria de Acoes
- Segui o proximo passo salvo apos o bloco Tecnologia, sem criar tela, modulo, componente ou arquivo novo.
- `VisualizadorUniversalEntidadeV24.jsx` passou a padronizar o pacote de auditoria com contexto multiempresa, permissoes RBAC, entidade, titulo e total conhecido.
- Criacao, edicao, exclusao pelo formulario, exclusao pela grade e exclusao em lote agora registram auditoria com antes/depois quando disponivel, usuario, groupId, empresaId e acao sensivel.
- Bloqueios e falhas de salvar/excluir passaram a gerar `AuditLog` com motivo, permissao esperada e erro retornado, reforcando a Regra-Mae antes de qualquer acao sensivel.
- Checkboxes e botoes de exclusao agora tambem ficam bloqueados quando nao houver contexto grupo/empresa valido, mantendo o comportamento visual existente.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando RBAC, seguranca, auditoria e multiempresa, sem duplicar fluxo.
- Proximo passo sugerido: revisar os formularios sensiveis mais usados em Cadastros Gerais para garantir que todos enviem dados limpos e contexto explicito ao visualizador universal.

### Cadastros Gerais - Fase 11 Bloco Tecnologia com Auditoria Detalhada
- Segui o proximo passo salvo apos `Bloco5Organizacional`, sem criar tela, modulo, componente ou arquivo novo.
- `Bloco6Tecnologia.jsx` passou a auditar abertura de APIs Externas, Canais Chatbot, Intents, Gateways de Pagamento, Jobs Agendados, Webhooks, Configuracoes NF-e e Eventos/Notificacoes com contexto multiempresa detalhado.
- Bloqueios por falta de contexto ou permissao agora registram motivo padronizado, `groupId`, `empresaId`, nome do grupo/empresa, titulo, permissao de Cadastros, permissao alternativa Sistema e total conhecido da entidade.
- Filtro aplicado no bloco Tecnologia, IA & Parametros agora gera auditoria com termo sanitizado, total de itens do bloco, total filtrado e entidades filtradas.
- O fluxo visual, cards, botoes, janelas flutuantes e visualizadores existentes foram preservados.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando RBAC, seguranca, auditoria e multiempresa, sem criar duplicidade.
- Proximo passo sugerido: concluir a varredura de Cadastros Gerais revisando `VisualizadorUniversalEntidadeV24` e formularios mais sensiveis para padronizar salvar/editar/excluir com auditoria antes/depois e contexto obrigatorio.
### Cadastros Gerais - Fase 11 Bloco Organizacional com Auditoria Detalhada
- Segui o proximo passo salvo apos `Bloco4Logistica`, sem criar tela, modulo, componente ou arquivo novo.
- `Bloco5Organizacional.jsx` passou a auditar abertura de Grupos Empresariais, Empresas, Departamentos, Cargos, Turnos e Perfis de Acesso com contexto multiempresa detalhado.
- Bloqueios por falta de contexto ou permissao agora registram motivo padronizado, `groupId`, `empresaId`, nome do grupo/empresa, titulo, permissao de Cadastros, permissao alternativa Sistema e total conhecido da entidade.
- A excecao existente de `GrupoEmpresarial` poder abrir sem empresa selecionada foi preservada e documentada na auditoria como contexto exigido `grupo`.
- Filtro aplicado no bloco Estrutura Organizacional agora gera auditoria com termo sanitizado, total de itens do bloco, total filtrado e entidades filtradas.
- O fluxo visual, cards, botoes, janelas flutuantes e visualizadores existentes foram preservados.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando RBAC, seguranca, auditoria e multiempresa, sem criar duplicidade.
- Proximo passo sugerido: continuar em Cadastros Gerais revisando `Bloco6Tecnologia`, mantendo o mesmo padrao de auditoria/contexto nos itens internos.
### Cadastros Gerais - Fase 11 Bloco Logistica com Auditoria Detalhada
- Segui o proximo passo salvo apos `Bloco3Financeiro`, sem criar tela, modulo, componente ou arquivo novo.
- `Bloco4Logistica.jsx` passou a auditar abertura de Veiculos, Motoristas, Tipos de Frete, Locais de Estoque, Rotas Padrao e Modelos de Documento com contexto multiempresa detalhado.
- Bloqueios por falta de contexto ou permissao agora registram motivo padronizado, `groupId`, `empresaId`, nome do grupo/empresa, titulo, permissao de Cadastros, permissao alternativa Expedicao e total conhecido da entidade.
- Filtro aplicado no bloco Logistica, Frotas & Almoxarifado agora gera auditoria com termo sanitizado, total de itens do bloco, total filtrado e entidades filtradas.
- O botao existente `App Motorista` agora tambem audita visualizacao e bloqueios, preservando a mesma janela flutuante do app.
- O fluxo visual, cards, botoes, janelas flutuantes e visualizadores existentes foram preservados.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando RBAC, seguranca, auditoria e multiempresa, sem criar duplicidade.
- Proximo passo sugerido: continuar em Cadastros Gerais revisando `Bloco5Organizacional`, mantendo o mesmo padrao de auditoria/contexto nos itens internos.
### Cadastros Gerais - Fase 11 Bloco Financeiro/Fiscal com Auditoria Detalhada
- Segui o proximo passo salvo como `Bloco3Fiscal`; no projeto existente o arquivo correto e `Bloco3Financeiro.jsx`, sem criar tela, modulo, componente ou arquivo novo.
- `Bloco3Financeiro.jsx` passou a auditar abertura de Bancos, Formas de Pagamento, Plano de Contas, Centros, Tipos de Despesa, Moedas, Operadores, Despesas Recorrentes, Tabelas Fiscais e Condicoes Comerciais com contexto multiempresa detalhado.
- Bloqueios por falta de contexto ou permissao agora registram motivo padronizado, `groupId`, `empresaId`, nome do grupo/empresa, titulo, permissao de Cadastros, permissao alternativa Financeiro e total conhecido da entidade.
- Filtro aplicado no bloco Financeiro & Fiscal agora gera auditoria com termo sanitizado, total de itens do bloco, total filtrado e entidades filtradas.
- O fluxo visual, cards, botoes, janelas flutuantes e visualizadores existentes foram preservados.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando RBAC, seguranca, auditoria e multiempresa, sem criar duplicidade.
- Proximo passo sugerido: continuar em Cadastros Gerais revisando `Bloco4Logistica`, mantendo o mesmo padrao de auditoria/contexto nos itens internos.
### Cadastros Gerais - Fase 11 Bloco Produtos com Auditoria Detalhada
- Segui o proximo passo salvo apos `Bloco1Pessoas`, sem criar tela, modulo, componente ou arquivo novo.
- `Bloco2Produtos.jsx` passou a auditar abertura de Produtos, Servicos, Setores, Grupos, Marcas, Tabelas, Kits, Catalogo Web e Unidades com contexto multiempresa detalhado.
- Bloqueios por falta de contexto ou permissao agora registram motivo padronizado, `groupId`, `empresaId`, nome do grupo/empresa, titulo, permissao e total conhecido da entidade.
- Filtro aplicado no bloco Produtos & Servicos agora gera auditoria com termo sanitizado, total de itens do bloco, total filtrado e entidades filtradas.
- O fluxo visual, cards, botoes, janelas flutuantes e visualizadores existentes foram preservados.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando RBAC, seguranca, auditoria e multiempresa, sem criar duplicidade.
- Proximo passo sugerido: continuar em Cadastros Gerais revisando `Bloco3Fiscal`, mantendo o mesmo padrao de auditoria/contexto nos itens internos.
### Cadastros Gerais - Fase 11 Bloco Pessoas com Auditoria Detalhada
- Segui o proximo passo salvo apos busca e blocos em Cadastros, sem criar tela, modulo, componente ou arquivo novo.
- `Bloco1Pessoas.jsx` passou a auditar abertura de cadastros com contexto multiempresa, permissao granular, titulo, campos principais e total conhecido da entidade.
- Bloqueios por falta de contexto ou permissao agora registram motivo padronizado, `groupId`, `empresaId`, nome do grupo/empresa e entidade afetada.
- Filtro aplicado no bloco Pessoas & Parceiros agora gera auditoria com termo sanitizado, total de itens do bloco, total filtrado e entidades filtradas.
- O fluxo visual, cards, botoes, janelas flutuantes e formulários existentes foram preservados.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando RBAC, seguranca, auditoria e multiempresa, sem criar duplicidade.
- Proximo passo sugerido: continuar em Cadastros Gerais revisando `Bloco2Produtos`, mantendo o mesmo padrao de auditoria/contexto nos itens internos.

### Cadastros Gerais - Fase 11 Busca e Blocos com Auditoria Contextual
- Segui o proximo passo salvo apos auditoria de contexto em Cadastros, sem criar tela, modulo, componente ou arquivo novo.
- `Cadastros.jsx` passou a auditar abertura/fechamento dos blocos com nome do bloco, permissao granular, totais exibidos, blocos abertos e contexto multiempresa.
- Busca universal passou a sanitizar o termo auditado, limitar tamanho e registrar totais por bloco, total geral, blocos abertos e se o contexto obrigatorio estava atendido.
- Cards principais de Cadastros e a Busca Universal receberam `data-context-required="group-or-company"`, reforcando rastreio de contexto.
- O fluxo visual, accordions, contadores, busca e abas existentes foram preservados.
- Mantida a Regra-Mae: melhoria feita na pagina existente, reforcando RBAC, seguranca, auditoria e multiempresa, sem criar duplicidade.
- Proximo passo sugerido: continuar em Cadastros Gerais revisando os blocos `Bloco1Pessoas` a `Bloco6Tecnologia` para padronizar auditoria/contexto nos itens internos.

### Cadastros Gerais - Fase 11 Auditoria de Contexto e Bloqueios
- Segui o proximo passo salvo apos Administracao do Sistema, iniciando Cadastros Gerais sem criar tela, modulo, componente ou arquivo novo.
- `Cadastros.jsx` passou a incluir pacote padronizado de contexto em todas as auditorias da tela: contexto ativo, `groupId`, `empresaId`, nomes de grupo/empresa e permissoes relevantes.
- Acesso bloqueado a Cadastros Gerais por falta de permissao agora gera `AuditLog` de seguranca.
- Abertura de Cadastros sem grupo/empresa selecionado agora gera alerta auditado, preservando o aviso visual existente.
- Bloqueio da aba Apps, Portais & Ambientes Externos passou a registrar motivo `permissao_negada` e tipo de auditoria de seguranca.
- Trocas de aba passam a registrar se o contexto multiempresa obrigatorio estava atendido.
- Mantida a Regra-Mae: melhoria feita na pagina existente, reforcando RBAC, seguranca, auditoria e multiempresa, sem criar duplicidade.
- Proximo passo sugerido: continuar em Cadastros Gerais revisando busca universal, contadores e blocos para auditar consultas/filtros e reforcar `data-context-required`.

### Administracao do Sistema - Fase 10 Limpeza de Auditoria Legada em Acessos
- Segui o proximo passo salvo apos auditoria de consultas em Gestao de Acessos, sem criar tela, modulo, componente ou arquivo novo.
- `GestaoAcessosIndex.jsx` teve removido o trecho legado inacessivel que ficava apos `return` dentro de `handleTabChange`.
- A auditoria nova de troca de abas foi preservada, mantendo contexto ativo, `groupId`, `empresaId`, aba anterior e aba solicitada.
- A remocao reduz codigo morto e risco de manutencao confusa sem alterar fluxo visual, abas, consultas, RBAC ou layout.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando organizacao, seguranca, auditoria e multiempresa, sem criar duplicidade.
- Proximo passo sugerido: seguir para Cadastros Gerais com foco em relatorios, contexto multiempresa, RBAC granular e auditoria de acoes bloqueadas.

### Administracao do Sistema - Fase 10 Gestao de Acessos com Auditoria de Consultas
- Segui o proximo passo salvo apos SoD, sem criar tela, modulo, componente ou arquivo novo.
- `GestaoAcessosIndex.jsx` passou a auditar acesso bloqueado por falta de permissao de visualizacao.
- Trocas de aba agora registram contexto ativo, `groupId`, `empresaId`, aba anterior, aba solicitada e alerta quando o contexto esta incompleto.
- Fallback direto de perfis RBAC agora fica auditado com total bruto e total filtrado no escopo, preservando a protecao multiempresa existente.
- Consulta de usuarios agora registra alerta quando encontra usuarios sem marcador multiempresa explicito, mantendo o fluxo atual para revisao gradual.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando RBAC, seguranca, auditoria e multiempresa, sem criar duplicidade.
- Proximo passo sugerido: continuar em Administracao do Sistema removendo o trecho legado inacessivel de auditoria antiga em `GestaoAcessosIndex` apos validacao visual, ou seguir para Cadastros Gerais com foco em relatorios e contexto.

### Administracao do Sistema - Fase 10 SoD com Auditoria de Bloqueios e Erros
- Segui o proximo passo salvo apos relatorios RBAC, sem criar tela, modulo, componente ou arquivo novo.
- `SoDChecker.jsx` agora audita abertura bloqueada por falta de permissao de edicao.
- Tentativas de executar analise SoD ou persistir conflitos sem permissao/contexto agora registram `AuditLog` com `groupId`, `empresaId`, contexto, permissao exigida e motivo.
- Falhas na analise e na persistencia de conflitos passam a ser auditadas como eventos sem sucesso, preservando o erro retornado.
- Auditorias de execucao e persistencia agora incluem pacote padronizado de contexto multiempresa e status de permissao.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando RBAC, seguranca, auditoria e multiempresa, sem criar duplicidade.
- Proximo passo sugerido: continuar em `GestaoAcessosIndex`, revisando auditoria das consultas/fallbacks de perfis e usuarios e bloqueios de troca de aba por escopo.

### Administracao do Sistema - Fase 10 Relatorios RBAC com Contexto e Auditoria
- Segui o proximo passo salvo apos auditoria de bloqueios RBAC, sem criar tela, modulo, componente ou arquivo novo.
- `RelatorioPermissoes.jsx` agora audita tambem tentativas bloqueadas de exportacao por falta de contexto ou permissao.
- Exportacoes JSON e TXT passam a carregar marcadores de contexto (`groupId`, `empresaId` e contexto ativo), reforcando Multiempresa Absoluta.
- Os botoes de exportacao receberam marcadores granulares de RBAC, contexto obrigatorio e acao sensivel.
- O card principal do relatorio foi alinhado ao layout obrigatorio com `w-full h-full`.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando RBAC, seguranca, auditoria e multiempresa, sem criar duplicidade.
- Proximo passo sugerido: continuar em Administracao do Sistema revisando `SoDChecker` e `GestaoAcessosIndex` para auditar bloqueios de execucao, escopo e persistencia.

### Administracao do Sistema - Fase 10 Auditoria de Bloqueios RBAC de Usuario
- Segui o proximo passo salvo apos sanitizacao de campos RBAC, sem criar tela, modulo, componente ou arquivo novo.
- `GestaoUsuariosAvancada.jsx` passou a auditar tentativas bloqueadas de alterar empresas vinculadas sem contexto/permissao.
- Tentativas de vincular empresa quando o usuario esta em escopo `grupo` tambem passam a gerar `AuditLog` de seguranca.
- Salvamento bloqueado por falta de contexto ou falta de permissao agora fica auditado com usuario executor, usuario alvo, `groupId`, `empresaId`, contexto ativo e motivo.
- O comportamento visual atual foi preservado: os toasts continuam aparecendo e os controles continuam desabilitados quando necessario.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando RBAC, seguranca, auditoria e multiempresa, sem criar duplicidade.
- Proximo passo sugerido: continuar em Administracao do Sistema, revisando `GestaoAcessosIndex`, `SoDChecker` e relatorios de permissoes para cobrir auditoria/contexto em consultas e persistencias.

### Administracao do Sistema - Fase 10 Sanitizacao de Campos RBAC de Usuario
- Segui o proximo passo salvo apos propagacao Grupo/Empresas em usuarios, sem criar tela, modulo, componente ou arquivo novo.
- `GestaoUsuariosAvancada.jsx` passou a sanitizar `cargo`, `departamento`, `telefone`, setores permitidos e centros de custo antes de salvar.
- O limite de aprovacao agora e normalizado para numero seguro, sem valor negativo e com teto operacional.
- A sanitizacao tambem foi aplicada nos handlers de entrada, reduzindo risco de gravar texto malicioso ou lixo operacional no cadastro de usuario.
- A auditoria antes/depois existente passa a registrar os dados ja normalizados no payload final.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando seguranca, RBAC, auditoria, multiempresa e fluxo atual, sem criar duplicidade.
- Proximo passo sugerido: revisar bloqueios dos toggles e checkboxes em `GestaoUsuariosAvancada`, auditando tentativas bloqueadas por falta de permissao/contexto.

### Administracao do Sistema - Fase 10 Propagacao Grupo/Empresas em Usuarios
- Segui o proximo passo salvo apos convites de usuario, sem criar tela, modulo, componente ou arquivo novo.
- `GestaoUsuariosAvancada.jsx` agora resolve empresas vinculadas de forma efetiva antes de salvar o usuario.
- Quando o escopo for `grupo_empresa` no contexto de Grupo e nenhuma empresa estiver marcada manualmente, o usuario passa a receber todas as empresas disponiveis do grupo.
- Quando o escopo for `empresa`, `setores` ou `grupo_empresa` no contexto de empresa e nenhuma empresa estiver marcada, a empresa atual e preservada como vinculo efetivo quando disponivel.
- O payload salvo recebeu `propagacao_grupo_empresas` e `origem_contexto`, e a auditoria antes/depois passou a registrar esses marcadores.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca, auditoria e propagacao Grupo/Empresas, sem criar duplicidade.
- Proximo passo sugerido: continuar em `GestaoUsuariosAvancada`, revisando sanitizacao dos campos de cargo/departamento/setores/centros de custo e auditoria de bloqueios nos toggles.

### Administracao do Sistema - Fase 10 Convites de Usuario com Sanitizacao e Auditoria
- Segui o proximo passo salvo apos auditoria antes/depois de usuarios, sem criar tela, modulo, componente ou arquivo novo.
- `UsuariosTab.jsx` passou a sanitizar e validar o e-mail antes de chamar `base44.users.inviteUser`.
- Convites com e-mail invalido agora sao bloqueados antes da API e auditados com contexto, `groupId`, `empresaId` e empresas do grupo quando o escopo ativo e Grupo.
- Falhas retornadas pela API de convite agora tambem ficam registradas em `AuditLog`, preservando e-mail sanitizado, erro e escopo ativo.
- Os bloqueios por permissao e por falta de contexto passaram a reutilizar o pacote padronizado de contexto multiempresa.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: continuar em `GestaoUsuariosAvancada`, revisando propagacao real de Grupo/Empresas e melhorias de auditoria nos controles de setores/centros de custo.

### Administracao do Sistema - Fase 10 Usuarios com Auditoria Antes/Depois
- Segui o proximo passo salvo apos o fallback multiempresa de perfis, sem criar tela, modulo, componente ou arquivo novo.
- `GestaoUsuariosAvancada.jsx` passou a registrar `AuditLog` contextual quando altera perfil RBAC, escopo de acesso, empresas vinculadas, restricoes adicionais, 2FA, cargo e departamento do usuario.
- A auditoria grava dados anteriores e dados novos, usuario executor, usuario alvo, `groupId`, `empresaId` e contexto ativo.
- O fluxo existente de `updateInContext("User")`, validacao de contexto, permissoes, empresas vinculadas, setores e centros de custo foi preservado.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: continuar em `GestaoUsuariosAvancada` e `UsuariosTab`, revisando bloqueios/convites para sanitizacao de e-mail, auditoria de falhas e propagacao Grupo/Empresas.

### Administracao do Sistema - Fase 10 Gestao de Acessos com Fallback Multiempresa
- Segui o proximo passo salvo apos `AdminTabs`, focando Gestao de Acessos e Usuarios sem criar tela, modulo, componente ou arquivo novo.
- `GestaoAcessosIndex.jsx` agora filtra pelo escopo ativo quando precisa usar fallback direto de `PerfilAcesso.list`, evitando expor perfis de outro grupo/empresa quando `filterInContext` nao retorna dados.
- `UsuariosTab.jsx` recebeu a mesma protecao de escopo no fallback de perfis, considerando `group_id`, `grupo_id`, `empresa_id`, `empresa_atual_id` e empresas vinculadas.
- Registros sem marcador de escopo deixam de passar no fallback direto, reforcando a regra de Multiempresa Absoluta.
- O fluxo visual, abas, convites, configuracao de usuarios, SoD, relatorios e auditorias existentes foram preservados.
- Mantida a Regra-Mae: melhoria feita nos componentes existentes, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: continuar em `UsuariosTab` e `GestaoUsuariosAvancada`, priorizando liberacao por Grupo, Empresas e Setores com auditoria antes/depois.

### Administracao do Sistema - Fase 10 Abas com RBAC e Auditoria Contextual
- Segui o proximo passo salvo apos a auditoria de acesso da pagina, sem criar tela, modulo, componente ou arquivo novo.
- `src/components/administracao-sistema/AdminTabs.jsx` passou a auditar trocas de aba com `createInContext("AuditLog")`, registrando usuario, `groupId`, `empresaId`, aba anterior, aba solicitada, sucesso e tentativa bloqueada.
- O handler de abas agora valida a aba solicitada contra as abas permitidas antes de atualizar estado e URL, reforcando RBAC sem alterar o fluxo autorizado.
- Os triggers de abas receberam `data-permission` granular para facilitar rastreio e padronizacao de permissoes em tela, abas, botoes e acoes.
- O container da aba Gestao de Acessos foi alinhado ao layout obrigatorio com `w-full h-full`.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: continuar em Administracao do Sistema revisando `GestaoAcessosIndex` e `UsuariosTab`, priorizando liberacao por Grupo, Empresas e Setores com auditoria/contexto.

### Administracao do Sistema - Fase 10 Acesso com Auditoria Contextual
- Segui o proximo passo salvo apos `Comercial.jsx`, iniciando o bloco de Administracao do Sistema sem criar tela, modulo, componente ou arquivo novo.
- `src/pages/AdministracaoSistema.jsx` passou a auditar a abertura da tela com `createInContext("AuditLog")`, preservando usuario, `groupId`, `empresaId`, aba solicitada, aba inicial resolvida e permissao `Sistema.visualizar`.
- O redirecionamento de usuarios sem perfil admin para o Portal do Cliente tambem passa a ser registrado como evento de seguranca, mantendo o fluxo atual sem bloquear o usuario.
- A tela continua protegida por `ProtectedSection module="Sistema" action="visualizar"` e mantendo o layout `w-full h-full`.
- Mantida a Regra-Mae: melhoria feita no arquivo existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: continuar em Administracao do Sistema nas abas e acoes internas, priorizando ferramentas, acessos/RBAC e integracoes que ainda tiverem botao sem efeito, auditoria direta ou falta de contexto.

### Comercial - Fase 9 Pagina Comercial com Auditoria Contextual
- Segui o proximo passo salvo apos `PedidoTabsContainer`, sem criar tela, modulo, componente ou arquivo novo.
- `src/pages/Comercial.jsx` deixou de gravar `AuditLog` diretamente pelo cliente `base44` na abertura dos modulos do Comercial.
- A auditoria da pagina Comercial agora usa `createInContext("AuditLog")`, preservando usuario, `groupId`, `empresaId`, modulo aberto, sectionKey, sucesso e bloqueio por permissao.
- Tentativas bloqueadas por permissao em `handleModuleClick` agora tambem ficam auditadas como seguranca.
- Removi apenas `getFiltroContexto` da desestruturacao do contexto visual porque nao era usado na pagina.
- Mantive subscriptions realtime, abertura de janelas, criacao/edicao de pedidos, filtros contextuais, ProtectedSection e layout `w-full h-full` existentes.
- Mantida a Regra-Mae: melhoria feita no arquivo existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: iniciar novo bloco do plano em Administracao do Sistema ou Cadastros Gerais, priorizando acoes diretas sem contexto/auditoria.

### Comercial - Fase 9 Abas do Pedido com Auditoria e Contexto
- Segui o proximo passo salvo apos `PedidoFormCompleto`, sem criar tela, modulo, componente ou arquivo novo.
- `PedidoTabsContainer` deixou de gravar `AuditLog` diretamente pelo cliente `base44` nos fluxos de liberacao de edicao por vendedor, solicitacao ao gerente e liberacao local por gerente.
- A auditoria das abas do pedido agora usa `useUser` e `createInContext("AuditLog")`, preservando usuario, `groupId`, `empresaId`, pedido, numero do pedido, status, motivo, sucesso e falha.
- As consultas de cliente e contas a receber em atraso passaram a usar `filterInContext`, reforcando multiempresa na verificacao de conformidade financeira.
- Mantive `base44.functions.invoke` para `iaFinanceAnomalyScan` e `solicitacoesAprovacao`, porque esses fluxos backend existentes continuam sendo necessarios.
- Botoes, bloqueios visuais, abas, ProtectedSection, lazy loading e comportamento autorizado foram preservados.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: continuar a varredura Comercial em `src/pages/Comercial.jsx`.

### Comercial - Fase 9 Pedido Completo com Auditoria Contextual
- Segui o proximo passo salvo apos `NotasFiscaisTab`, sem criar tela, modulo, componente ou arquivo novo.
- `PedidoFormCompleto` deixou de gravar `AuditLog` diretamente pelo cliente `base44` no fluxo de solicitacao de aprovacao.
- A auditoria do formulario completo agora usa `useUser` e `createInContext("AuditLog")`, preservando usuario, `groupId`, `empresaId`, pedido, numero do pedido, solicitacao de aprovacao, sucesso e falha.
- Mantive `base44.functions.invoke` para `solicitacoesAprovacao` e `applyOrderStockMovements`, porque esses fluxos backend existentes continuam sendo necessarios.
- O formulario, abas, validacoes, footer de acoes, automacao de fechamento, rascunho e envio para faturamento foram preservados.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: continuar a varredura Comercial nos pontos restantes: `PedidoTabsContainer` e `src/pages/Comercial.jsx`.

### Comercial/Fiscal - Fase 9 NF-e com Auditoria e Log Fiscal Contextual
- Segui o proximo passo salvo apos `FechamentoFinanceiroTab`, sem criar tela, modulo, componente ou arquivo novo.
- `NotasFiscaisTab` deixou de importar e usar `base44` diretamente para gravar `AuditLog` e `LogFiscal`.
- A auditoria fiscal/comercial agora usa `useUser` e `createInContext('AuditLog')`, preservando usuario, `groupId`, `empresaId`, nota, numero, bloqueios, envio, cancelamento, edicao, exportacao, DANFE e visualizacao.
- Os logs fiscais de envio e cancelamento passaram a ser gravados via `createInContext('LogFiscal')`, reforcando carimbo multiempresa e sanitizacao do helper contextual existente.
- Mantive os fluxos existentes de emissao simulada, cancelamento, atualizacao de NF-e, DANFE, modal, tabela, filtros, botoes e RBAC visual.
- Removi apenas o import direto de `base44` que ficou desnecessario nesse arquivo, sem alterar layout, campos, permissao ou comportamento autorizado.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: continuar a varredura Comercial nos pontos restantes com auditoria direta: `PedidoFormCompleto`, `PedidoTabsContainer` e `src/pages/Comercial.jsx`.

### Comercial - Fase 9 Fechamento Financeiro com Auditoria Contextual
- Segui o proximo passo salvo apos `PedidosEntregaTab`, sem criar tela, modulo, componente ou arquivo novo.
- `FechamentoFinanceiroTab` deixou de gravar `AuditLog` diretamente pelo cliente `base44` e passou a usar `createInContext('AuditLog')` no helper existente `auditFechamento`.
- A auditoria do fechamento financeiro agora usa `useUser`, preserva usuario, `groupId`, `empresaId`, pedido, entidade, escopo de NF-e, sucesso/bloqueio e motivo operacional.
- A abertura autorizada do modal de NF-e agora tambem fica auditada, alem dos bloqueios por empresa faturadora, contexto ou permissao fiscal.
- O container raiz recebeu `w-full h-full`, reforcando a regra obrigatoria de layout sem alterar o fluxo visual.
- Removi apenas o import direto de `base44` que ficou desnecessario nesse arquivo, sem alterar campos, calculos, descontos, formas de pagamento, observacoes, modal ou emissao de NF-e.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: continuar a varredura Comercial nos pontos restantes com auditoria direta: `NotasFiscaisTab`, `PedidoFormCompleto`, `PedidoTabsContainer` e `src/pages/Comercial.jsx`.

### Comercial - Fase 9 Pedidos Entrega com Auditoria Contextual
- Segui o proximo passo salvo apos `PedidosTab`, sem criar tela, modulo, componente ou arquivo novo.
- `PedidosEntregaTab` deixou de gravar `AuditLog` diretamente pelo cliente `base44` e passou a usar `createInContext("AuditLog")` no helper existente `auditEntrega`.
- A auditoria de pedidos para entrega agora preserva usuario, `groupId`, `empresaId`, pedido, entrega, motivo, antes/depois, bloqueios, dialogos, romaneio, status e confirmacoes.
- Removi apenas o import direto de `base44` que ficou desnecessario nesse arquivo, sem alterar botoes, paineis, roteirizacao, romaneio, ocorrencias, comprovante ou movimentacao de estoque.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: continuar a varredura Comercial nos pontos restantes com auditoria direta: `FechamentoFinanceiroTab`, `NotasFiscaisTab`, `PedidoFormCompleto`, `PedidoTabsContainer` e `src/pages/Comercial.jsx`.
### Comercial - Fase 9 Pedidos com Auditoria Contextual
- Segui o proximo passo salvo apos `ValidarPedidosExternos`, sem criar tela, modulo, componente ou arquivo novo.
- `PedidosTab` deixou de gravar `AuditLog` diretamente pelo cliente `base44` e passou a usar `createInContext("AuditLog")` no helper existente `auditPedido`.
- A auditoria de pedidos agora registra usuario via `useUser`, `groupId`, `empresaId`, numero do pedido, status anterior, status de aprovacao anterior, bloqueios, exclusao, visualizacao, impressao, exportacao, edicao, fechamento, criacao e notificacoes.
- Mantive `base44.functions.invoke` para WhatsApp/e-mail porque essas integracoes existentes continuam sendo usadas; somente a gravacao de auditoria foi contextualizada.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: continuar a varredura Comercial nos pontos restantes com auditoria direta: `PedidosEntregaTab`, `FechamentoFinanceiroTab`, `NotasFiscaisTab`, `PedidoFormCompleto`, `PedidoTabsContainer` e `src/pages/Comercial.jsx`.
### Comercial - Fase 9 Pedidos Externos com Auditoria Contextual
- Segui o proximo passo salvo apos `ComissoesTab`, revisando gravacoes diretas de auditoria no Comercial sem criar tela, modulo, componente ou arquivo novo.
- `ValidarPedidosExternos` deixou de gravar `AuditLog` diretamente pelo cliente `base44` e passou a usar `createInContext("AuditLog")` no helper existente `auditPedidoExterno`.
- A auditoria de pedidos externos agora registra usuario via `useUser`, `groupId`, `empresaId`, numero externo, status anterior, bloqueios, consulta, validacao, exclusao e importacao.
- Removi apenas o import direto de `base44` que ficou desnecessario nesse arquivo, sem alterar botoes, filtros, importacao, validacao ou exclusao.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: continuar a varredura Comercial nos pontos restantes com auditoria direta: `PedidosTab`, `PedidosEntregaTab`, `FechamentoFinanceiroTab`, `NotasFiscaisTab`, `PedidoFormCompleto`, `PedidoTabsContainer` e `src/pages/Comercial.jsx`.
### Comercial - Fase 9 Comissoes com Auditoria Contextual
- Segui o proximo passo salvo apos `AutomacaoFluxoPedido`, sem criar tela, modulo, componente ou arquivo novo.
- `ComissoesTab` deixou de usar `base44.auth.me()` e `base44.entities.AuditLog.create` diretamente no helper `auditComissao`.
- A auditoria de comissoes agora usa `useUser` e `createInContext('AuditLog')`, preservando usuario, `groupId`, `empresaId`, bloqueios, aprovacoes, recusas, pagamentos, impressao, visualizacao e exportacao.
- Removi apenas o import direto de `base44` que ficou desnecessario nesse arquivo, sem alterar botoes, filtros, relatorios ou fluxo financeiro de pagamento.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: revisar o Comercial em busca de outras gravacoes diretas de auditoria ou iniciar novo bloco do plano em Administracao do Sistema, conforme status salvo e prioridade.
### Comercial - Fase 9 Automacao de Pedido com Auditoria Contextual
- Segui o proximo passo salvo apos `CentralAprovacoesManager`, sem criar tela, modulo, componente ou arquivo novo.
- `AutomacaoFluxoPedido` deixou de gravar `AuditLog` diretamente pelo cliente `base44` e passou a usar `createInContext('AuditLog')` no helper existente `auditFluxoPedido`.
- A auditoria do fechamento automatico agora fica alinhada ao contexto visual multiempresa, preservando `groupId`, `empresaId`, usuario, bloqueios, falhas, inicio e conclusao do fluxo.
- Removi apenas o import direto de `base44` que ficou desnecessario nesse arquivo, sem alterar etapas, botoes, logs visuais ou automacao do pedido.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: continuar o alinhamento da auditoria direta restante em `ComissoesTab`, usando `createInContext` quando seguro.
### Comercial - Fase 9 Central de Aprovacoes com Auditoria Contextual
- Segui o proximo passo salvo apos `AprovacaoDescontos`, sem criar tela, modulo, componente ou arquivo novo.
- `CentralAprovacoesManager` deixou de gravar `AuditLog` diretamente pelo cliente `base44` e passou a usar `createInContext("AuditLog")` no helper existente `auditAprovacao`.
- A auditoria da central agora fica alinhada ao fluxo multiempresa do contexto visual, preservando `groupId`, `empresaId`, usuario, status anterior, status novo, bloqueios e abertura da automacao.
- Removi apenas o import direto de `base44` que ficou desnecessario nesse arquivo, sem remover funcionalidade, botoes, abas ou fluxo visual.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem criar duplicidade.
- Proximo passo sugerido: continuar o alinhamento das auditorias diretas restantes em `AutomacaoFluxoPedido` e depois `ComissoesTab`, usando `createInContext` quando seguro.
### Comercial - Fase 9 Aprovacao de Descontos Simples Auditada
- Segui o proximo passo salvo apos `AprovacaoDescontosManager`, sem criar tela, modulo, componente ou arquivo novo.
- `AprovacaoDescontos` legacy simples recebeu auditoria contextual propria em `AuditLog` via `createInContext` para selecao de pedido, decisao aprovada/rejeitada e bloqueios por contexto/permissao.
- A decisao de desconto agora registra status novo, percentual aprovado, comentarios, usuario, `groupId` e `empresaId`, mantendo a compatibilidade com a Central de Aprovacoes.
- O fluxo passou a tolerar pedido ausente sem quebrar a tela e evita acesso direto a `user.id` quando o usuario ainda nao estiver carregado.
- Botoes sensiveis de aprovar integral, aprovar parcial e rejeitar receberam `data-context-required`, mantendo `data-permission`, `data-action` e `data-sensitive`.
- O aviso de componente deprecated, layout `w-full h-full` e fluxo visual existente foram preservados.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria, sem remover funcionalidade.
- Proximo passo sugerido: alinhar auditorias diretas restantes em `CentralAprovacoesManager`, `AutomacaoFluxoPedido` e `ComissoesTab` para usar helpers contextuais quando seguro.
### Comercial - Fase 9 Aprovacao de Descontos Legacy Auditada
- Segui o proximo passo salvo apos `CentralAprovacoesManager`, sem criar tela, modulo, componente ou arquivo novo.
- `AprovacaoDescontosManager` recebeu auditoria contextual propria em `AuditLog` via `createInContext` para abertura de analise, aprovacao, negacao e bloqueios por contexto/permissao.
- O fluxo legacy de aprovacao agora preserva `valor_total`, margem e desconto existentes quando o modal antigo nao envia todos os campos, evitando sobrescrever valores com zero.
- Botoes sensiveis do dialog e da tabela receberam `data-context-required`, mantendo `data-permission`, `data-action` e `data-sensitive`.
- O aviso de componente deprecated e a compatibilidade com `CentralAprovacoesManager` foram preservados.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca, auditoria e layout `w-full h-full`, sem remover funcionalidade.
- Proximo passo sugerido: continuar no Comercial revisando `AprovacaoDescontos` legacy simples ou alinhar auditorias diretas restantes em `AutomacaoFluxoPedido`, `CentralAprovacoesManager` e `ComissoesTab` para helpers contextuais quando seguro.
### Comercial - Fase 9 Central de Aprovacoes com Auditoria
- Segui o proximo passo salvo em `AutomacaoFluxoPedido`, sem criar tela, modulo, componente ou arquivo novo.
- `CentralAprovacoesManager` recebeu auditoria contextual propria em `AuditLog` para analise, aprovacao, negacao, bloqueios e abertura da automacao de fechamento.
- Bloqueios por falta de contexto `groupId/empresaId` ou permissao comercial agora sao registrados com motivo `contexto_obrigatorio` ou `permissao_negada`.
- A aprovacao registra desconto percentual, desconto em valor, valor final, margem media, status novo e se o fechamento automatico foi solicitado.
- A negacao registra comentario/motivo, pedido, status anterior e novo status de aprovacao.
- Os botoes existentes `Analisar` e `Aprovar + Fechar` passaram a registrar abertura da analise e receberam `data-context-required`, mantendo `data-permission`, `data-action` e `data-sensitive`.
- A abertura da automacao apos aprovacao com fechamento tambem passou a ser auditada antes de abrir `AutomacaoFluxoPedido`.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca, auditoria e layout `w-full h-full`, sem remover funcionalidade.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar no Comercial revisando `AprovacaoDescontosManager` ou `AprovacaoDescontos`, alinhando auditoria e RBAC com a Central de Aprovacoes.

### Comercial - Fase 9 Automacao de Pedido com Auditoria
- Segui o proximo passo salvo apos pedidos externos, sem criar tela, modulo, componente ou arquivo novo.
- `AutomacaoFluxoPedido` recebeu auditoria contextual propria em `AuditLog` para inicio, bloqueio, conclusao e falha do fechamento automatico.
- Bloqueios por falta de contexto `groupId/empresaId` ou permissao comercial agora ficam auditados com motivo `contexto_obrigatorio` ou `permissao_negada`.
- A conclusao do fluxo registra numero do pedido, status anterior, status novo esperado e resultados retornados pelo fechamento automatico.
- Falhas do fluxo centralizado e da baixa de estoque passaram a registrar auditoria operacional/seguranca antes do feedback visual.
- Foi mantida a regra de permissao ja existente do componente, aceitando `marcarProntoFaturar`, `aprovar` ou `editar`, para nao bloquear perfis validos por uma acao unica.
- O botao principal preserva `data-permission`, `data-action`, `data-context-required` e `data-sensitive`, mantendo rastreabilidade visual sem quebrar o fluxo atual.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca, auditoria e layout `w-full h-full`, sem remover funcionalidade.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em `CentralAprovacoesManager`, reforcando auditoria contextual de aprovacao/negacao e abertura de automacao.

### Comercial - Fase 9 Pedidos Externos com RBAC e Auditoria
- Segui o proximo passo salvo apos `ComissoesTab`, sem criar tela, modulo, componente ou arquivo novo.
- `ValidarPedidosExternos` passou a carregar pedidos externos via `filterInContext`, reforcando consulta por `groupId/empresaId`.
- A tela recebeu contexto obrigatorio e permissao visual `Comercial.PedidoExterno.visualizar`, com aviso quando faltar grupo/empresa ou acesso.
- As acoes existentes `Atualizar`, `Importar`, `Validar` e `Excluir` passaram por validacao de contexto, RBAC, `ProtectedAction`, `data-action`, `data-permission`, `data-context-required` e `data-sensitive` quando aplicavel.
- Importacao de pedido externo agora cria `Pedido` com `createInContext` e atualiza o `PedidoExterno` com `updateInContext`, preservando a propagacao multiempresa.
- Validacao e exclusao de pedido externo passaram a usar `updateInContext` e `deleteInContext`, com bloqueio seguro quando faltar permissao.
- Tentativas bloqueadas e acoes concluidas agora registram auditoria contextual em `AuditLog`, incluindo motivo, status anterior e pedido gerado quando houver importacao.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca, auditoria e layout `w-full h-full`, sem remover funcionalidade.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar no Comercial revisando outras telas de fluxo externo/automacao, como `AutomacaoFluxoPedido` ou `CentralAprovacoesManager`, para fechar RBAC/auditoria em acoes sensiveis.

### Comercial - Fase 9 Relatorio de Comissoes com Exportacao Segura
- Segui o proximo passo salvo em `ComissoesTab`, sem criar tela, modulo, componente ou arquivo novo.
- O relatorio por vendedor passou a ter permissao visual granular `Comercial.Comissao.relatorio`, mantendo a tabela existente e exibindo bloqueio visual quando faltar acesso.
- A exportacao CSV do relatorio foi adicionada ao cabecalho existente com `ProtectedAction`, contexto obrigatorio e permissao `Comercial.Comissao.exportar`.
- A exportacao passa pelo helper seguro `exportarRelatorioVendedorSeguro`, validando `groupId/empresaId`, RBAC e existencia de dados antes de gerar o arquivo.
- Tentativas bloqueadas e exportacoes concluidas passam a registrar auditoria contextual em `AuditLog`.
- Os dados do relatorio por vendedor foram preservados; apenas foi reforcado o fluxo de acesso, auditoria e exportacao.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca, auditoria e layout sem remover funcionalidade.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: seguir para outra tela comercial com acoes diretas semelhantes, revisando exportacoes, impressao, criacao e status com RBAC/auditoria contextual.

### Comercial - Fase 9 Comissoes com RBAC e Auditoria
- Segui o proximo passo salvo para `ComissoesTab`, sem criar tela, modulo, componente ou arquivo novo.
- `ComissoesTab` passou a usar contexto visual com `groupId/empresaId`, helper contextual e auditoria propria em `AuditLog`.
- O calculo de comissoes deixou de abrir a janela diretamente e passou por `abrirCalculoComissoesSeguro`, validando contexto, permissao `Comercial.Comissao.calcular` e auditoria de abertura/conclusao/cancelamento.
- Impressao e detalhes passaram por helpers seguros, com bloqueio por contexto/RBAC e auditoria de sucesso/bloqueio.
- Aprovacao, recusa e geracao de pagamento passaram a validar permissao granular antes da acao e registrar auditoria operacional/seguranca.
- Atualizacao de comissao e criacao de `ContaPagar` agora usam wrappers contextuais (`updateInContext`/`createInContext`) com `groupId/empresaId`.
- Os botoes sensiveis receberam `data-action`, `data-permission`, `data-context-required` e `data-sensitive`, mantendo o fluxo visual atual.
- O container raiz recebeu `w-full h-full`, reforcando a regra obrigatoria de layout sem mudar a tela.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca, auditoria e layout obrigatorio sem remover funcionalidade.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em `ComissoesTab` revisando permissao visual por relatorio de vendedor e possivel exportacao/relatorio, depois seguir para outra tela comercial com acoes diretas.

### Fiscal/Comercial - Fase 9 Edicao Visual de NF-e com RBAC
- Segui o proximo passo salvo em `NotasFiscaisTab`, sem criar tela, modulo, componente ou arquivo novo.
- O helper existente `handleEdit`, que ainda nao tinha caminho visual na tabela, passou a validar contexto `groupId/empresaId` e permissao `Fiscal.NotaFiscal.editar` antes de abrir o formulario.
- A tabela de NF-e ganhou a acao visual `Editar` protegida por `ProtectedAction`, mantendo o formulario existente e sem alterar o fluxo de criacao/atualizacao.
- A abertura da edicao agora registra auditoria contextual; tentativas bloqueadas por falta de contexto ou RBAC tambem ficam auditadas.
- O fechamento do modal de detalhes passou por `fecharDetalhesSeguro`, registrando auditoria antes de limpar a visualizacao.
- O container raiz de `NotasFiscaisTab` recebeu `w-full h-full`, reforcando a regra obrigatoria de layout sem mudar a estrutura visual.
- Os botoes, tabela, modal e cancelamento de NF-e foram preservados; apenas foram fechados caminhos visuais sem RBAC/auditoria.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca, auditoria e layout obrigatorio sem remover funcionalidade.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: seguir para `ComissoesTab` e aplicar o mesmo pente fino em acoes de calculo, aprovacao, exportacao e logs comerciais.

### Fiscal/Comercial - Fase 9 Envio de NF-e com RBAC e Log Fiscal
- Segui o proximo passo salvo em `NotasFiscaisTab`, sem criar tela, modulo, componente ou arquivo novo.
- O botao externo `Nova NF-e` deixou de chamar `onCreateNFe` diretamente e passou pelo helper seguro `criarNFeExternaSeguro`.
- A abertura do fluxo externo de criacao de NF-e agora valida empresa faturadora, contexto `groupId/empresaId`, permissao `Fiscal.NotaFiscal.criar` e auditoria de bloqueio/sucesso.
- O botao `Enviar NF-e`, que existia na listagem de notas pendentes, foi conectado ao fluxo existente de emissao simulada via `mockEmitirNFe`.
- O envio agora valida `Fiscal.NotaFiscal.enviar`, contexto multiempresa, status `Pendente`, confirmacao do usuario, atualizacao contextual da nota, historico da NF-e e `LogFiscal`.
- Tentativas bloqueadas ou canceladas pelo usuario passam a ser auditadas com motivo, nota, numero, grupo e empresa.
- Os botoes, tabela, modal e fluxo fiscal existente foram preservados; a melhoria apenas fez funcionar e proteger o caminho ja presente.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca, auditoria e log fiscal sem remover funcionalidade.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em `NotasFiscaisTab` revisando edicao visual, cancelamento e detalhes/modal para consolidar RBAC visual completo antes de seguir para `ComissoesTab`.

### Fiscal/Comercial - Fase 9 Consulta e DANFE com RBAC
- Segui o proximo passo salvo saindo de `PedidosTab` para `NotasFiscaisTab`, sem criar tela, modulo, componente ou arquivo novo.
- Exportacao CSV de NF-e selecionadas passou pelo helper seguro `exportarNotasSeguro`, com contexto `groupId/empresaId`, permissao `Fiscal.NotaFiscal.exportar` e auditoria de bloqueio/cancelamento/sucesso.
- Visualizacao de detalhes passou por `visualizarNotaSeguro`, validando `Fiscal.NotaFiscal.visualizar` e auditando abertura/bloqueio.
- Impressao da DANFE passou por `imprimirDanfeSeguro`, validando `Fiscal.NotaFiscal.imprimir`, contexto e auditoria contextual.
- Download da DANFE passou por `baixarDanfeSeguro`, validando `Fiscal.NotaFiscal.baixar_pdf`, sanitizando a URL e auditando bloqueio/sucesso.
- Os botoes, modal de detalhes e fluxo fiscal foram preservados; apenas foram fechados caminhos diretos sem RBAC/auditoria.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria sem remover funcionalidade.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em `NotasFiscaisTab` revisando criacao externa `onCreateNFe`, envio de NF-e pendente e cancelamento/log fiscal para fechar RBAC/auditoria visual.

### Comercial - Fase 9 Menu Contextual de Pedidos com RBAC Visual
- Segui o proximo passo salvo para consolidar `PedidosTab`, sem criar tela, modulo, componente ou arquivo novo.
- O menu de contexto da tabela passou a montar somente acoes permitidas pelo contexto `groupId/empresaId` e permissao granular aplicavel.
- Visualizar, imprimir, gerar NF-e, criar entrega, gerar OP, excluir e analisar aprovacao agora so aparecem no menu quando o usuario tiver acesso ao fluxo.
- Os helpers seguros existentes continuam protegendo as acoes, mas o usuario sem acesso deixa de ver atalhos indevidos no menu contextual.
- Mantida a Regra-Mae: nenhum comando foi removido para usuarios autorizados; apenas foi reforcado RBAC visual no componente existente.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: seguir para outra tela comercial com chamadas diretas semelhantes, priorizando `NotasFiscaisTab` ou `ComissoesTab`.

### Comercial - Fase 9 Criacao de Pedido com Contexto e RBAC
- Segui o proximo passo salvo para `PedidosTab`, sem criar tela, modulo, componente ou arquivo novo.
- O botao `Novo Pedido` deixou de chamar `onCreatePedido` diretamente e passou pelo helper seguro `criarPedidoSeguro`.
- A criacao de pedido agora valida contexto `groupId/empresaId` e permissao granular `Comercial.Pedido.criar` antes de abrir o formulario existente.
- Tentativas bloqueadas por falta de contexto ou RBAC passam a registrar auditoria de seguranca com motivo.
- A abertura autorizada do formulario de novo pedido passa a registrar auditoria operacional contextual.
- O fluxo visual, o botao e o formulario existente foram preservados; apenas foi fechado o caminho sem auditoria/contexto.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria sem remover funcionalidade.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar revisando `PedidosTab` para consolidar menus/atalhos restantes e depois seguir para outra tela comercial com chamadas diretas semelhantes.

### Comercial - Fase 9 Fechamento de Pedido e Atalhos de Aprovacao
- Segui o proximo passo salvo para `PedidosTab`, sem criar tela, modulo, componente ou arquivo novo.
- O botao `Fechar Pedido` passou a validar contexto `groupId/empresaId` e permissao granular `Comercial.Pedido.fechar` antes de abrir a automacao existente.
- A automacao de fechamento agora registra auditoria contextual ao iniciar, bloquear e concluir o fechamento, incluindo status do pedido e invalidacao dos caches ja existentes.
- O atalho `Gerenciar Aprovacoes` do alerta de pendencias deixou de abrir a central diretamente e passou pelo helper seguro com `Comercial.Pedido.aprovar`.
- Os botoes, janela de automacao, Central de Aprovacoes e fluxo de usuario foram preservados; apenas foram fechados caminhos sem RBAC/auditoria.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria sem remover funcionalidade.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em `PedidosTab` revisando criacao de pedido (`onCreatePedido`) e demais atalhos superiores para contexto/RBAC antes de seguir para outras telas comerciais.

### Comercial - Fase 9 Notificacoes e Aprovacao de Pedido
- Segui o proximo passo salvo para `PedidosTab`, sem criar tela, modulo, componente ou arquivo novo.
- As notificacoes de aprovacao por WhatsApp e Email passaram a validar contexto `groupId/empresaId` e permissao granular `Comercial.Pedido.notificar`.
- Notificacoes agora auditam bloqueio, sucesso e falha com canal, total e ids dos pedidos envolvidos.
- A edicao de pedido passou a usar helper seguro com `Comercial.Pedido.editar`, contexto obrigatorio e bloqueio quando houver aprovacao pendente sem permissao de aprovacao.
- A mudanca de status para `Pronto para Faturar` passou a validar `Comercial.Pedido.marcarProntoFaturar`, usar `updateInContext` e auditar status anterior/novo.
- A abertura da Central de Aprovacoes em botoes e menu passou a validar `Comercial.Pedido.aprovar`, registrar auditoria e bloquear tentativas sem contexto/RBAC.
- Os botoes, menus, notificacoes e fluxo visual foram preservados; apenas foram fechados caminhos diretos sem auditoria contextual.
- Mantida a Regra-Mae: melhoria feita no componente existente, reforcando multiempresa, RBAC, seguranca e auditoria sem remover funcionalidade.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em `PedidosTab` revisando o botao `Fechar Pedido`/automacao e demais acoes de fluxo para permissao granular, contexto e auditoria antes de seguir para outras telas comerciais.

### Comercial - Fase 9 Consulta de Pedido com RBAC e Auditoria
- Segui o proximo passo salvo para `PedidosTab`, sem criar tela, modulo, componente ou arquivo novo.
- As acoes existentes de visualizar, imprimir e exportar CSV passaram a usar helpers seguros no proprio fluxo da tela.
- Visualizacao agora valida contexto `groupId/empresaId` e permissao granular `Comercial.Pedido.visualizar`, auditando sucesso e bloqueio.
- Impressao agora valida `Comercial.Pedido.imprimir`, respeita contexto multiempresa e registra auditoria antes de chamar a impressao existente.
- Exportacao CSV dos pedidos selecionados agora valida `Comercial.Pedido.exportar`, desabilita o botao quando faltar contexto/permissao e registra auditoria contextual.
- Os menus e botoes foram preservados; apenas foi removido o caminho direto/paralelo de auditoria e exportacao dentro do clique.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; a melhoria reforcou RBAC, multiempresa, seguranca e auditoria nas acoes existentes de consulta de pedidos.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em `PedidosTab` revisando notificacoes de aprovacao por WhatsApp/Email, edicao e mudanca de status para auditoria contextual/RBAC granular.

### Comercial - Fase 9 Acoes Sensíveis de Pedido
- Segui o proximo passo salvo para acoes sensiveis em `PedidosTab`, sem criar tela, modulo, componente ou arquivo novo.
- As acoes de gerar NF-e, criar entrega e gerar OP passaram a usar um helper unico (`executarAcaoSensivelPedido`) com contexto, RBAC e auditoria contextual.
- Os botoes e itens de menu dessas acoes foram preservados, mas agora bloqueiam quando faltar `groupId/empresaId` ou permissao granular aplicavel.
- NF-e valida `Comercial.Pedido.gerarNFe` com fallback para permissao fiscal de criacao de `NotaFiscal`.
- Entrega valida `Comercial.Pedido.criarEntrega` com fallback para permissao de criacao em Expedicao.
- OP valida `Comercial.Pedido.gerarOP` com fallback para permissao de criacao em Producao.
- Tentativas bloqueadas passam a registrar auditoria de seguranca com motivo, pedido, `groupId`, `grupoId` e `empresaId`; acoes autorizadas tambem ficam auditadas com contexto completo.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas foi eliminado caminho paralelo de auditoria direta em acoes sensiveis existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em `PedidosTab` revisando impressao, visualizacao, exportacao e notificacoes de aprovacao para auditoria contextual/RBAC granular.

### Comercial - Fase 9 Exclusao de Pedido Contextual
- Segui o proximo passo salvo para operacoes sensiveis em `PedidosTab`, sem criar tela, modulo, componente ou arquivo novo.
- A exclusao de pedidos deixou de usar `base44.entities.Pedido.delete(id)` direto e passou a chamar `deleteInContext("Pedido", pedido.id)`.
- `PedidosTab` passou a validar contexto `groupId/empresaId` e permissao granular `Comercial.Pedido.excluir` antes de excluir.
- Tentativas bloqueadas por falta de contexto ou RBAC agora registram auditoria de seguranca com `groupId`, `grupoId`, `empresaId`, motivo e dados do pedido.
- Exclusoes autorizadas registram auditoria antes da remocao e depois do sucesso, mantendo dados anteriores para rastreabilidade.
- O botao e o menu de exclusao foram preservados; ambos agora passam pelo mesmo helper seguro e o botao fica desabilitado quando faltar contexto/permissao.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; a melhoria reforcou multiempresa, RBAC, seguranca e auditoria no fluxo existente de pedidos.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em `PedidosTab` revisando acoes sensiveis de NF-e, entrega, OP, impressao/exportacao e notificacoes para auditar com contexto completo e bloqueio granular quando aplicavel.

### Comercial - Fase 9 Listagens com RBAC de Visualizacao
- Segui o proximo passo salvo para `NotasFiscaisTab` e `PedidosTab`, sem criar tela, modulo, componente ou arquivo novo.
- `NotasFiscaisTab` passou a calcular contexto `groupId/empresaId` e permissao granular `Fiscal.NotaFiscal.visualizar` antes da consulta backend.
- A listagem backend de notas fiscais agora envia `enabled: contextoValido && canViewNota` ao `useEntityListSorted`, preservando criacao, edicao, cancelamento, exportacao, DANFE e fluxo fiscal existente.
- `PedidosTab` passou a calcular contexto pelo `empresaId` recebido ou pelo contexto visual atual, alem de validar `Comercial.Pedido.visualizar` antes da listagem backend.
- A listagem backend de pedidos agora envia `enabled: contextoValido && canViewPedido` ao `useEntityListSorted`, mantendo paginacao, ordenacao, filtros, aprovacao, impressao, automacao e fallback por props externas.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; a melhoria reforcou multiempresa, RBAC e seguranca nas listagens existentes do Comercial/Fiscal.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar revisando outras consultas diretas em `NotasFiscaisTab`/`PedidosTab` para migrar auditoria e operacoes sensiveis para contexto/RBAC quando houver helper existente.

### Financeiro - Fase 9 Listagens com RBAC de Visualizacao
- Segui o proximo passo salvo para listagens que usam `useEntityListSorted` fora de Compras, sem criar tela, modulo, componente ou arquivo novo.
- `ContasReceberTab` passou a calcular contexto `groupId/empresaId` e permissao `Financeiro.ContaReceber.visualizar` antes da consulta backend.
- A listagem backend de contas a receber agora envia `enabled: contextoValido && podeVisualizarReceber` ao `useEntityListSorted`, impedindo busca sem Grupo/Empresa ou sem RBAC granular.
- `ContasPagarTab` recebeu a mesma protecao com `Financeiro.ContaPagar.visualizar`, preservando paginacao, ordenacao, filtros, baixa, caixa, aprovacao, boleto e formularios existentes.
- O fluxo padrao continua preservado quando as props externas `contas` ja vierem preenchidas, mantendo compatibilidade com chamadas atuais.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; a melhoria reforcou multiempresa, RBAC e seguranca nas listagens existentes do Financeiro.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Comercial revisando `NotasFiscaisTab` e `PedidosTab` para aplicar `enabled` por contexto/permissao antes das listagens backend.

### Compras - Fase 9 Listagens com Enabled Externo
- Segui o proximo passo salvo para `FornecedoresTabOptimized`, `useEntityListSorted` e listagens de Compras, sem criar tela, modulo, componente ou arquivo novo.
- `useEntityListSorted` passou a aceitar `options.enabled`, combinando permissao externa com o bloqueio de contexto ja existente no hook.
- O comportamento padrao foi preservado: callers que nao passarem `enabled` continuam usando o bloqueio atual por `groupId/empresaId/$or`.
- `OrdensCompraTab` passou a calcular permissao granular de visualizacao (`Compras.OrdemCompra.visualizar`) antes da listagem backend e envia `enabled: contextoValido && canViewOC` ao `useEntityListSorted`.
- `FornecedoresTabOptimized` foi revisado e ja permanecia com `enabled: contextoValido && canViewFornecedor` nas consultas principais, sem necessidade de alterar o fluxo.
- Foram preservados cache em memoria, IDB, dedupe, throttle, backoff 429, paginacao, ordenacao e fallback de dados do hook.
- Mantida a Regra-Mae: nenhum componente, botao, consulta ou fluxo foi removido; apenas foi adicionada uma trava opcional para reforcar RBAC/contexto em listagens existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar revisando listagens que usam `useEntityListSorted` fora de Compras para passar `enabled` granular quando o componente ja possuir contexto/permissao disponivel.

### Compras - Fase 9 Solicitacoes com RBAC e Auditoria
- Segui o proximo passo salvo para `SolicitacoesCompraTab` e `SolicitacaoCompraForm`, sem criar tela, modulo, componente ou arquivo novo.
- `SolicitacoesCompraTab` deixou de buscar usuario por `base44.auth.me()` direto e passou a usar o `useUser` existente, mantendo `base44` apenas para a integracao de IA ja existente.
- A consulta de produtos para solicitacoes passou a depender de contexto valido e permissao de criacao.
- A criacao de solicitacao passou a bloquear tambem dentro da mutation quando faltar Grupo/Empresa ou RBAC, com auditoria contextual de bloqueio e sucesso.
- Aprovacao, rejeicao, geracao de OC e sugestao por IA passaram a registrar auditoria de sucesso; a IA tambem passou a bloquear por contexto/permissao dentro da propria action.
- `SolicitacaoCompraForm` passou a validar contexto/permissao, auditar bloqueio de envio, limitar a consulta de produtos e desabilitar campos/confirmacao quando o usuario nao puder criar.
- A lista passou a usar `solList` como fonte segura para contagem e exportacao, evitando quebra quando a prop externa vier vazia/indefinida.
- Foram preservados formulario em janela, dialog legado, sugestao IA, aprovacao, rejeicao, geracao de OC, selecao/exportacao, paginacao e layout `w-full h-full`.
- Mantida a Regra-Mae: nenhuma tela, botao, campo, dialog ou fluxo foi removido; apenas RBAC, multiempresa, seguranca e auditoria foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Compras revisando `FornecedoresTabOptimized`/`useEntityListSorted` e demais listagens para garantir `enabled` por contexto/permissao quando aplicavel.

### Compras - Fase 9 Recebimento OC com RBAC
- Segui o proximo passo salvo para `RecebimentoOCForm` e pontos de recebimento em `OrdensCompraTab`, sem criar tela, modulo, componente ou arquivo novo.
- `RecebimentoOCForm` passou a calcular `groupId/grupoId/empresaId`, validar contexto e permissao de recebimento, e bloquear envio quando faltar Grupo/Empresa ou RBAC.
- O formulario de recebimento passou a auditar bloqueios via `createInContext("AuditLog")`, mantendo a auditoria contextual no mesmo fluxo de Ordem de Compra.
- Campos de data, NF de entrada, observacoes, botao de confirmar e container em modo janela receberam marcadores de permissao, contexto e sensibilidade.
- `OrdensCompraTab` passou a auditar tentativa bloqueada de abrir recebimento e abertura autorizada do formulario antes de chamar a janela existente.
- Foram preservados recebimento de OC, confirmacao, atualizacao de estoque/produto, estatisticas do fornecedor, abertura de avaliacao e layout `w-full h-full`.
- Mantida a Regra-Mae: nenhuma acao, botao, dialog, campo ou fluxo foi removido; apenas RBAC, multiempresa, seguranca e auditoria foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Compras revisando `SolicitacoesCompraTab` e `SolicitacaoCompraForm` para reforcar permissao granular, contexto e auditoria antes/depois nas solicitacoes.

### Compras - Fase 9 Importacao NF-e Contextual
- Segui o proximo passo salvo para `ImportacaoNFeRecebimento`, sem criar tela, modulo, componente ou arquivo novo.
- `ImportacaoNFeRecebimento` deixou de auditar por `base44.entities.AuditLog.create` direto e passou a usar `createInContext("AuditLog")`, mantendo groupId/grupoId/empresaId no registro.
- O fluxo de processar XML, confirmar recebimento, criar `ImportacaoXMLNFe`, criar `MovimentacaoEstoque`, atualizar produto e invalidar queries foi preservado.
- A selecao de XML ganhou bloqueio de seguranca para arquivos acima de 10 MB, com auditoria contextual do bloqueio antes de limpar o input.
- Foram preservados card de upload, progresso, resultado da NF-e, avisos, tabela de itens, confirmacao de recebimento, RBAC por permissao e marcadores de contexto ja existentes.
- Mantida a Regra-Mae: a melhoria ficou no arquivo existente, reforcou seguranca, auditoria, multiempresa e controle de permissao sem remover funcionalidade.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Compras revisando `RecebimentoOCForm` e pontos de recebimento dentro de `OrdensCompraTab` para reforcar marcadores RBAC/contexto e auditoria antes/depois.

### Compras - Fase 9 Compra Rapida sem Auth Direto
- Segui o proximo passo salvo para `SolicitarCompraRapidoModal` e `CotacoesTab`, sem criar tela, modulo, componente ou arquivo novo.
- `SolicitarCompraRapidoModal` deixou de buscar usuario por `base44.auth.me()` direto e passou a reaproveitar o `useUser` existente no projeto, igual a outros fluxos de Compras, Estoque e Financeiro.
- O modal manteve a criacao contextual via `createInContext("SolicitacaoCompra")`, auditoria via `createInContext("AuditLog")`, validacao de `groupId/empresaId` e bloqueio por permissao antes de criar solicitacao.
- Foram removidos apenas codigo morto e sem uso: `useEffect` no modal de compra rapida e estado de cotacao selecionada em `CotacoesTab`, sem retirar botao, aba, tabela, dialog, card, campo ou fluxo do usuario.
- `CotacoesTab` foi revisado e permanece sem import direto de `base44`, preservando consultas contextuais de fornecedores/produtos, criacao de cotacao, comparativo, geracao de OC, auditoria, RBAC e layout atual.
- Mantida a Regra-Mae: a melhoria ficou nos arquivos existentes, reforcou seguranca/manutencao/RBAC/multiempresa e nao criou caminho paralelo.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Compras revisando `OrdensCompraTab`, `ImportacaoNFeRecebimento` e recebimentos para reduzir acessos diretos de `base44` onde houver alternativa contextual existente.

### Compras - Fase 9 Fornecedores Otimizados Contextuais
- Segui o proximo passo salvo para `FornecedoresTabOptimized`, sem criar tela, modulo, componente ou arquivo novo.
- `FornecedoresTabOptimized` passou a calcular `groupId/empresaId/contexto` e validar contexto antes de listar, contar, buscar, filtrar, criar ou editar fornecedores.
- A contagem via `useCountEntities` e a listagem paginada por `entityListSorted` agora ficam habilitadas somente com contexto valido e permissao de visualizacao.
- As acoes de criar e editar passaram por wrappers existentes no componente, com bloqueio por contexto/permissao e auditoria contextual via `createInContext("AuditLog")`.
- Container, aviso de bloqueio, card de resumo, busca, filtro de status, criar fornecedor, item de fornecedor, editar fornecedor e paginacao receberam marcadores RBAC/contexto/sensibilidade.
- Foram preservados paginacao server-side, contagem otimizada, filtros locais, cards de estatistica, lista paginada, callbacks `onCreate/onEdit`, status visual, nota media e layout `w-full h-full`.
- Mantida a Regra-Mae: nenhum botao, card, filtro, chamada de listagem, paginacao, fornecedor ou callback foi removido; apenas contexto, RBAC, auditoria e rastreabilidade foram reforcados no arquivo existente.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Compras revisando pontos restantes de `SolicitarCompraRapidoModal`, `CotacoesTab` e chamadas de fornecedor/cotacao para reduzir imports diretos restantes de `base44` apenas onde forem realmente necessarios.

### Compras - Fase 9 Formularios Auxiliares de Cotacao e Fornecedor
- Segui o proximo passo salvo para `CotacaoForm` e `AvaliacaoFornecedorForm`, sem criar tela, modulo, componente ou arquivo novo.
- `CotacaoForm` removeu import sem uso de `base44` e passou a calcular `groupId/grupoId/empresaId` pelo contexto visual e pela cotacao existente.
- As consultas de produtos e fornecedores em `CotacaoForm` passaram a depender de `groupId/empresaId/contexto` e de permissao de criacao, evitando carregamento fora do Grupo/Empresa atual.
- `CotacaoForm` passou a auditar envio e bloqueio por contexto/permissao via `createInContext("AuditLog")`, preservando o `onSubmit` recebido do fluxo pai.
- Campos, seletores, fornecedores, itens, observacoes, adicionar/remover item, confirmacao e modo janela de `CotacaoForm` receberam marcadores RBAC/contexto/sensibilidade.
- `AvaliacaoFornecedorForm` passou a carimbar `groupId/grupoId/empresaId`, `ordem_compra_id`, `fornecedor_id` e `nota_media` no payload enviado ao fluxo pai.
- `AvaliacaoFornecedorForm` passou a auditar envio e bloqueio por contexto/permissao e recebeu marcadores RBAC/contexto/sensibilidade nas estrelas, comentario, confirmacao e modo janela.
- Foram preservados validacao Zod/RHF da cotacao, field array de itens, selecao de fornecedores, calculo da nota media, layout `w-full h-full`, window mode, callbacks externos e textos do fluxo atual.
- Mantida a Regra-Mae: nenhum formulario, campo, botao, estrela, fornecedor, produto, item ou callback foi removido; apenas auditoria contextual, RBAC visual/acao, multiempresa e rastreabilidade foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Compras revisando `FornecedoresTabOptimized` e pontos restantes de fornecedor/cotacao para garantir que nao haja fluxo alternativo sem contexto, RBAC e auditoria.

### Compras - Fase 9 Fornecedores Contextuais
- Segui o proximo passo salvo para `FornecedoresTab` e `DetalhesFornecedor`, sem criar tela, modulo, componente ou arquivo novo.
- `FornecedoresTab` foi limpo de imports, estados, filtros e helpers antigos que nao eram usados no fluxo atual do `VisualizadorUniversalEntidade`, reduzindo ruido tecnico sem remover funcionalidade.
- `FornecedoresTab` recebeu marcadores de permissao, contexto, grupo e empresa no wrapper principal e no modo janela.
- `DetalhesFornecedor` deixou de auditar por `base44.entities.AuditLog.create` direto e passou a usar `createInContext("AuditLog")`.
- `DetalhesFornecedor` passou a auditar sucesso e falha de atualizacao do fornecedor, mantendo tambem os logs especificos de documento adicionado/removido/bloqueado/cancelado.
- Abas, fechar detalhes, editar condicoes, upload de documentos, tipo, nome do arquivo, validade, observacao, adicionar, download, remover documento e editar dados bancarios receberam marcadores RBAC/contexto/sensibilidade.
- Foram preservados visualizador universal de fornecedores, cadastro completo, queries contextuais de OC/NF/contas a pagar, historico, condicoes comerciais, documentos, pagamentos, dialogs, toasts e layout `w-full h-full`.
- Mantida a Regra-Mae: nenhum fornecedor, aba, tabela, dialog, documento, consulta, botao ou fluxo de compra/pagamento foi removido; apenas manutencao, auditoria contextual, RBAC visual/acao, multiempresa e rastreabilidade foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Compras revisando `CotacaoForm` e `AvaliacaoFornecedorForm` para reforcar auditoria/contexto nos formularios auxiliares ligados a fornecedores e cotacoes.

### Compras - Fase 9 Cotacoes e Compra Rapida Contextuais
- Segui o proximo passo salvo para `CotacoesTab` e `SolicitarCompraRapidoModal`, sem criar tela, modulo, componente ou arquivo novo.
- `CotacoesTab` deixou de auditar cotacoes por `base44.entities.AuditLog.create` direto e passou a usar `createInContext("AuditLog")`.
- O dialog legado de cotacao recebeu marcadores de permissao, acao, contexto obrigatorio e sensibilidade nos campos de descricao, data limite, itens, quantidade, unidade, observacoes, fornecedores, cancelamento e confirmacao.
- A lista/comparativo de cotacoes recebeu marcadores de permissao, acao e contexto nos botoes de abrir janela, criar vazio, ver propostas, solicitar esclarecimentos e gerar ordem de compra.
- `SolicitarCompraRapidoModal` reforcou carimbo `groupId/grupoId/empresaId`, auditoria contextual e marcadores RBAC/contexto/sensibilidade nos controles de compra rapida por estoque baixo.
- Foram preservados cotacoes mock locais, comparativo de propostas, geracao de OC por cotacao, sugestao de compra rapida por estoque baixo, usuario logado, query invalidation, toasts, dialogs e layout responsivo.
- Mantida a Regra-Mae: nenhum botao, campo, modal, cotacao, proposta, solicitacao rapida ou fluxo de geracao de OC foi removido; apenas auditoria contextual, RBAC visual/acao, multiempresa e rastreabilidade foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Compras revisando `FornecedoresTab` e `DetalhesFornecedor` para reforcar contexto, RBAC e auditoria nos dados de fornecedor usados por cotacoes e OCs.

### Compras - Fase 9 Formularios de OC e Solicitacao Contextuais
- Segui o proximo passo salvo para `OrdemCompraForm` e `SolicitacaoCompraForm`, sem criar tela, modulo, componente ou arquivo novo.
- `OrdemCompraForm` manteve `FormWrapper`, `filterInContext` e `carimbarContexto`, com queries de fornecedores/produtos vinculadas ao `groupId/empresaId`.
- `OrdemCompraForm` recebeu marcadores de permissao, acao, contexto obrigatorio e sensibilidade no formulario, cards, numero, fornecedor, datas, prazo, condicao de pagamento, observacoes, produto, quantidade, unidade, valor unitario, adicionar/remover item, total financeiro e confirmacao.
- `SolicitacaoCompraForm` manteve `FormWrapper`, `filterInContext` e `carimbarContexto`, com query de produtos vinculada ao `groupId/empresaId`.
- `SolicitacaoCompraForm` recebeu marcadores de permissao, acao, contexto obrigatorio e sensibilidade no formulario, card, numero, data, produto, quantidade, prioridade, data de necessidade, justificativa, observacoes e confirmacao.
- Imports sem uso de `base44` foram removidos dos dois formularios, reduzindo ruido tecnico sem alterar comportamento.
- Foram preservados validacao Zod/RHF, preenchimento automatico de fornecedor/produto/unidade, calculo de total da OC, inclusao/remocao de itens, carimbo multiempresa, abertura em janela e layout `w-full h-full`.
- Mantida a Regra-Mae: nenhum botao, campo, formulario, janela, validacao, consulta contextual, item de compra ou fluxo de solicitacao/OC foi removido; apenas RBAC visual/acao, contexto, rastreabilidade e manutencao foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Compras revisando `CotacoesTab` e `SolicitarCompraRapidoModal` para reforcar auditoria/contexto nos fluxos que geram solicitacao ou ordem de compra.

### Compras - Fase 9 OCs e Solicitacoes Contextuais
- Segui o proximo passo salvo para `OrdensCompraTab` e `SolicitacoesCompraTab`, usando os arquivos existentes em `src/components/compras`, sem criar tela, modulo, componente ou arquivo novo.
- `OrdensCompraTab` deixou de auditar ordens de compra por `base44.entities.AuditLog.create` direto e passou a usar `createInContext("AuditLog")`.
- O dialog legado preservado de OC recebeu marcadores de permissao, acao, contexto obrigatorio e sensibilidade nos campos de numero, fornecedor, datas, valor, prazo, condicao/forma de pagamento, observacoes, cancelamento e confirmacao.
- `SolicitacoesCompraTab` passou a consultar produtos por `filterInContext("Produto")`, inclusive na sugestao por IA, evitando leitura global fora do Grupo/Empresa atual.
- `SolicitacoesCompraTab` reforcou carimbo multiempresa com `groupId/grupoId/empresaId` em solicitacoes e OCs geradas.
- Acoes de criar, aprovar, rejeitar, gerar OC e sugerir compras por IA receberam bloqueio por contexto/permissao e marcadores RBAC/contexto/sensibilidade.
- Foram preservados cabecalho de OCs, tabela compacta, exportacao CSV, dialogs legados ocultos, geracao de OC por solicitacao, sugestao IA, aprovar/rejeitar, impressao, recebimento, avaliacao de fornecedor, paginacao e ordenacao.
- Mantida a Regra-Mae: nenhum botao, campo, dialog, tabela, fluxo de compra, OC, solicitacao ou integracao com recebimento foi removido; apenas auditoria contextual, RBAC visual/acao, multiempresa e seguranca operacional foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Compras revisando `OrdemCompraForm` e `SolicitacaoCompraForm` para completar marcadores RBAC/contexto internos dos formularios de janela.

### Estoque - Fase 9 Formularios de Janela Contextuais
- Segui o proximo passo salvo para `RecebimentoForm` e `RequisicaoAlmoxarifadoForm`, sem criar tela, modulo, componente ou arquivo novo.
- `RecebimentoForm` manteve `FormWrapper`, `filterInContext` e `carimbarContexto`, com reforco de marcadores de permissao, acao, contexto obrigatorio e sensibilidade no formulario, cards, ordem de compra, data, NF, transportadora, conferente, itens, quantidade recebida, observacoes e confirmacao.
- `RequisicaoAlmoxarifadoForm` manteve `FormWrapper`, `filterInContext` e `carimbarContexto`, com reforco de marcadores de permissao, acao, contexto obrigatorio e sensibilidade no formulario, card, numero, data, produto, quantidade, setor, solicitante, centro de custo, finalidade, observacoes e confirmacao.
- Imports sem uso de `base44` foram removidos dos dois formularios e imports sem uso de icones foram removidos de `RecebimentoForm`, reduzindo ruido tecnico sem alterar o fluxo.
- Foram preservados abertura em janela, validacao Zod, filtro contextual de ordens/produtos, preenchimento automatico de itens por OC, unidade de medida, divergencia de recebimento, carimbo multiempresa e layout `w-full h-full`.
- Mantida a Regra-Mae: nenhum botao, campo, formulario, janela, validacao, consulta ou fluxo operacional foi removido; apenas RBAC visual/acao, contexto, rastreabilidade e manutencao foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar no Estoque revisando `OrdensCompraTab` e `SolicitacoesCompraTab` para reforcar RBAC/contexto e auditoria nos fluxos de compra integrados ao recebimento.

### Estoque - Fase 9 Recebimentos e Requisicoes Contextuais
- Segui o proximo passo salvo para `RecebimentoTab` e `RequisicoesAlmoxarifadoTab`, sem criar tela, modulo, componente ou arquivo novo.
- `RecebimentoTab` passou a registrar auditoria contextual via `createInContext("AuditLog")` ao concluir recebimento, com grupo, empresa, dados novos, quantidade de itens, timestamp e sucesso.
- `RecebimentoTab` recebeu `w-full h-full` e marcadores de permissao, acao, contexto obrigatorio e sensibilidade na busca, abertura do formulario, dialog legado preservado, campos de numero/data/OC/fornecedor/NF/responsavel, itens, quantidades, status, observacoes, confirmacao e visualizacao.
- `RequisicoesAlmoxarifadoTab` passou a registrar auditoria contextual via `createInContext("AuditLog")` ao concluir requisicao de almoxarifado.
- `RequisicoesAlmoxarifadoTab` agora valida todos os itens e estoque disponivel antes de criar movimentacoes, reduzindo risco de baixa parcial quando algum item deixaria estoque negativo.
- `RequisicoesAlmoxarifadoTab` recebeu `w-full h-full` e marcadores de permissao, acao, contexto obrigatorio e sensibilidade na busca, abertura do formulario, dialog legado preservado, campos de numero/data/solicitante/setor/finalidade, itens, quantidade, unidade, observacoes e confirmacao.
- Foram preservados janelas existentes, dialogs legados ocultos, criacao via `createInContext`, atualizacao de estoque via `updateInContext`, invalidacao de queries, toasts, filtros, tabelas e layout responsivo.
- Mantida a Regra-Mae: nenhum botao, campo, dialog, tabela, fluxo de recebimento, requisicao ou movimentacao foi removido; apenas auditoria contextual, RBAC visual/acao, multiempresa e seguranca operacional foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar no Estoque revisando os formularios abertos por janela (`RecebimentoForm` e `RequisicaoAlmoxarifadoForm`) para completar marcadores RBAC/contexto internos sem criar novas telas.

### Estoque - Fase 9 Produtos e Transferencias Contextuais
- Segui o proximo passo salvo para `ProdutosTab` e `TransferenciaEntreEmpresasForm`, sem criar tela, modulo, componente ou arquivo novo.
- `ProdutosTab` deixou de auditar criacao de produto por `base44.entities.AuditLog.create` direto e passou a usar `createInContext("AuditLog")`, preservando a criacao por `createInContext("Produto")`.
- `ProdutosTab` recebeu marcadores de permissao, acao e contexto no container, filtro de estoque baixo, dashboard de producao, conversao em massa, importador de planilha e abertura de novo produto.
- `TransferenciaEntreEmpresasForm` deixou de auditar por `base44.entities.AuditLog.create` direto e passou a usar `createInContext("AuditLog")`.
- O formulario de transferencia recebeu marcadores de permissao, acao, contexto obrigatorio e sensibilidade nos seletores de empresas/produto, quantidade, unidade, motivo, gerar financeiro interno, observacoes e confirmacao.
- Foram preservados contadores de produtos, filtros, janelas existentes, criacao contextual de produto, transferencia entre empresas, movimentacoes de origem/destino, financeiro interno, confirmacao, toasts e invalidacao de queries.
- Mantida a Regra-Mae: nenhum botao, formulario, campo, janela, importador, conversao, produto ou transferencia foi removido; apenas auditoria contextual, RBAC visual/acao, multiempresa e rastreabilidade foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar no Estoque revisando `RecebimentoTab` e `RequisicoesAlmoxarifadoTab` para completar marcadores RBAC/contexto em dialogs, campos e botoes de criacao.

### Estoque - Fase 9 Lotes, Validade e Controle Operacional Contextual
- Segui o proximo passo salvo para historico/lotes/validade e controles operacionais de Estoque, sem criar tela, modulo, componente ou arquivo novo.
- `ControleEstoqueCompleto` deixou de auditar por `base44.entities.AuditLog.create` direto e passou a usar `createInContext("AuditLog")`, preservando usuario, modulo, entidade, sucesso e carimbos multiempresa.
- `ControleEstoqueCompleto` recebeu `w-full h-full` e marcadores de permissao/contexto no container, abas de reservas/lotes/inventario/ABC, bloqueio de lote vencido e contagem rotativa.
- `ControleLotesValidade` recebeu `w-full h-full` e marcadores de permissao, acao e contexto nos cards de alerta, busca e filtro de validade.
- Foram preservados bloqueio de lote vencido, alertas de lote vencido/proximo ao vencimento, reservas, inventario rotativo, curva ABC, filtros por contexto, `createInContext`/`updateInContext`, toasts e tabelas atuais.
- Mantida a Regra-Mae: nenhum card, aba, botao, filtro, tabela, lote, inventario ou relatorio operacional foi removido; apenas auditoria contextual, RBAC visual/acao, multiempresa e rastreabilidade foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar no Estoque revisando `ProdutosTab`, `RecebimentoTab`, `RequisicoesAlmoxarifadoTab` e `TransferenciaEntreEmpresasForm` para remover auditorias diretas restantes e completar marcadores RBAC/contexto.

### Estoque - Fase 9 Formularios Auxiliares Contextuais
- Segui o proximo passo salvo para `MovimentacaoForm` e `InventarioContagem`, sem criar tela, modulo, componente ou arquivo novo.
- `MovimentacaoForm` recebeu marcadores de permissao, acao e contexto obrigatorio no formulario, seletores, campos de quantidade/data/documento/responsavel/observacoes e botao de registro.
- `InventarioContagem` recebeu marcadores de permissao, acao, contexto obrigatorio e sensibilidade nas acoes de adicionar/remover item e nos campos de descricao, unidade, saldo, contagem e ajuste calculado.
- Foi removido import sem uso de `base44` em `MovimentacaoForm`, reduzindo ruido tecnico sem alterar comportamento.
- Foram preservados carimbo contextual via `FormWrapper`, validacao por `movimentacaoSchema`, carregamento contextual de produtos, calculo de ajuste, sanitizacao de texto, confirmacao de remocao e layout `w-full h-full`.
- Mantida a Regra-Mae: nenhuma janela, formulario, campo, botao, contagem ou fluxo de estoque foi removido; apenas RBAC visual/acao, multiempresa e rastreabilidade foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar no Estoque revisando componentes de historico/lotes/validade e relatorios operacionais para remover auditorias diretas restantes e completar marcadores RBAC/contexto.

### Estoque - Fase 9 Movimentacoes, Inventario e Relatorios Contextuais
- Segui o proximo passo salvo para `MovimentacoesTab`, `InventarioForm` e `RelatoriosEstoque`, sem criar tela, modulo, componente ou arquivo novo.
- `MovimentacoesTab`, `InventarioForm` e `RelatoriosEstoque` deixaram de registrar auditoria direta por `base44.entities.AuditLog.create` e passaram a usar `createInContext("AuditLog")`.
- A busca, abertura de formulario, campos sensiveis, registro de movimentacao, salvamento/aprovacao de inventario e abas/exportacoes de relatorios receberam marcadores de permissao, acao e contexto obrigatorio.
- Os containers principais de movimentacoes e relatorios receberam reforco de `w-full h-full`, preservando o layout responsivo e o fluxo visual atual.
- Foram preservados criacao de movimentacao por janela, atualizacao contextual de estoque do produto, inventario com contagem, aprovacao, exportacoes ABC/giro/parados, filtros por contexto e protecao de campos financeiros.
- Mantida a Regra-Mae: nenhuma movimentacao, campo, botao, aba, exportacao, inventario ou relatorio foi removido; apenas auditoria, RBAC visual/acao, multiempresa e rastreabilidade foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar no Estoque revisando formularios auxiliares (`MovimentacaoForm`, `InventarioContagem`) para completar marcadores RBAC/contexto em todos os inputs e acoes internas.

### Cadastros/Estoque - Fase 9 NF-e de Produtos com Auditoria Contextual
- Segui o proximo passo salvo para `ImportacaoProdutoNFe` e `ImportarProdutosNFe`, sem criar tela, modulo, componente ou arquivo novo.
- Os dois importadores de produto por NF-e deixaram de auditar por `base44.entities.AuditLog.create` direto e passaram a usar `createInContext("AuditLog")`.
- A leitura/processamento da NF-e agora registra auditoria contextual de sucesso e erro antes da etapa de criacao de produtos.
- Os controles sensiveis receberam marcadores de permissao, acao e contexto obrigatorio: selecao de arquivo, abertura do seletor, processamento, selecao de itens, cancelamento e criacao de produtos.
- Os containers principais receberam `w-full h-full` e marcadores de contexto/permissao, preservando o fluxo visual atual.
- Foram preservados upload XML/PDF, IA/OCR, deteccao de duplicidade, selecao de itens, confirmacao, criacao por `createInContext("Produto")`, toasts, callbacks e fechamento do modal.
- Mantida a Regra-Mae: nenhuma importacao, botao, campo, modal ou funcionalidade foi removida; apenas contexto, RBAC visual/acao, auditoria e rastreabilidade foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: revisar pontos de Estoque que ainda auditam movimentacoes/inventario diretamente, priorizando `MovimentacoesTab`, `InventarioForm` e `RelatoriosEstoque`.

### Projeto/Codex - Abertura Local IPv4 Estabilizada
- Corrigida a abertura local do ERP para voltar a responder no endereco antigo `http://localhost:5173/`.
- O script existente `start-erp-dev.cmd` deixou de depender do `npm.cmd` para manter a janela viva e passou a iniciar o Vite diretamente pelo `node.exe`.
- O host foi estabilizado em `127.0.0.1`, mantendo o projeto restrito ao computador local e tambem respondendo por `http://localhost:5173/`.
- Validado que `http://127.0.0.1:5173/` e `http://localhost:5173/` responderam `200 OK` apos iniciar o servidor local pelo `cmd /k` com `node.exe`.
- Mantida a Regra-Mae: melhoria feita no script existente de abertura local, sem criar novo fluxo, modulo, tela ou funcionalidade.
- Observacao: o controle automatico da aba interna do Codex falhou nesta sessao por problema do plugin/browser, mas o servidor local ficou ativo e o endereco correto para recarregar e `http://localhost:5173/`.
- Proximo passo sugerido: continuar o plano em `ImportacaoProdutoNFe` e `ImportarProdutosNFe` para reforcar marcadores RBAC/contexto e auditorias restantes sem criar novas telas.

### Cadastros/Estoque - Fase 9 Importacao de Produtos Contextual
- Segui o proximo passo salvo para importadores e acoes de produto, sem criar tela, modulo, componente ou arquivo novo.
- `BotoesImportacaoProduto` passou a validar Grupo/Empresa e permissao antes de abrir a importacao via NF-e, com toast de bloqueio e auditoria contextual via `createInContext("AuditLog")`.
- O botao existente `Importar via NF-e` recebeu marcadores de contexto, permissao e acao para RBAC granular.
- `ImportadorProdutosPlanilha` deixou de auditar importacao por `base44.entities.AuditLog.create` direto e passou a usar `createInContext("AuditLog")`.
- Os controles sensiveis do importador de planilha receberam marcadores de permissao/acao: selecao de grupo/empresa, arquivo, sugestao NCM por IA, aplicar sugestoes, importar para empresas do grupo, cancelar e executar importacao.
- Foram preservados upload, parse, preview, duplicidades, validacoes, criacao/atualizacao via helpers contextuais, importacao por grupo/empresa, IA de NCM, toasts e fechamento do modal.
- Mantida a Regra-Mae: nenhuma importacao, botao, fluxo, modal ou funcionalidade foi removida; apenas contexto, RBAC visual/acao, auditoria e rastreabilidade foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: revisar `ImportacaoProdutoNFe` e `ImportarProdutosNFe` para reforcar marcadores RBAC/contexto e auditorias restantes sem criar novas telas.

### Cadastros Gerais - Fase 9 Visualizador de Produtos Contextual
- Segui o proximo passo do visualizador especializado de produtos, sem criar tela, modulo, componente ou arquivo novo.
- `VisualizadorProdutos` passou a registrar auditoria contextual via `createInContext("AuditLog")` para inicio, conclusao e falha da atualizacao de setor em massa.
- A acao sensivel de atualizar setor em massa recebeu marcadores de permissao, acao e contexto obrigatorio.
- O container do visualizador passou a declarar contexto/permissao e imports sem uso foram removidos para reduzir ruido tecnico.
- Foram preservados o `VisualizadorUniversalEntidadeV24`, filtros de setor via `filterInContext`, atualizacao de produtos via `updateInContext`, modal, toast, invalidacao de cache e fluxo visual atual.
- Mantida a Regra-Mae: nenhuma funcionalidade, botao, modal, visualizador ou fluxo foi removido; apenas auditoria, contexto, RBAC visual e manutencao do arquivo existente foram reforcados.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: revisar importadores/acoes de produto usados em Cadastros e Estoque para reforcar auditoria/contexto sem criar novas telas.

### Cadastros Gerais - Fase 9 Visualizador Universal com Auditoria Contextual
- Segui o proximo passo dos visualizadores abertos pelos blocos de Cadastros Gerais, sem criar tela, modulo, componente ou arquivo novo.
- `VisualizadorUniversalEntidadeV24` deixou de registrar eventos de auditoria por `base44.entities.AuditLog.create` direto e passou a usar `createInContext("AuditLog")`.
- As auditorias de bloqueio por contexto, bloqueio por permissao, abertura de formulario de criacao e abertura de formulario de edicao agora reforcam `group_id`, `grupo_id`, `empresa_id` e `sucesso`.
- Foram preservados filtros multiempresa, paginacao, busca, ordenacao, selecao em massa, criacao, edicao, exclusao, formularios e invalidacao de contagens.
- Mantida a Regra-Mae: nenhuma funcionalidade, botao, coluna, acao, visualizador ou fluxo foi removido; apenas auditoria contextual e rastreabilidade foram reforcadas no arquivo existente.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: revisar `VisualizadorProdutos` e acoes em massa/importacao para reforcar auditoria/contexto sem criar novas telas.

### Cadastros Gerais - Fase 9 Pessoas e Produtos com Contexto/RBAC
- Segui o proximo passo dos blocos iniciais de Cadastros Gerais, sem criar tela, modulo, componente ou arquivo novo.
- `Bloco1Pessoas` passou a exigir Grupo/Empresa ativo antes de abrir clientes, fornecedores, transportadoras, colaboradores, representantes, contatos B2B, segmentos e regioes.
- `Bloco2Produtos` passou a exigir Grupo/Empresa ativo antes de abrir produtos, servicos, setores, grupos, marcas, tabelas, kits, catalogo web e unidades de medida.
- Os bloqueios por ausencia de contexto e por permissao agora exibem toast e tentam registrar auditoria contextual via `createInContext("AuditLog")`.
- Cards, botoes, visualizador especializado de produtos, visualizador universal, formularios e busca dos blocos foram preservados.
- Mantida a Regra-Mae: nenhuma funcionalidade, botao, card, formulario, visualizador ou fluxo foi removido; apenas contexto multiempresa, RBAC visual/acao e auditoria foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: revisar `VisualizadorUniversalEntidadeV24` e `VisualizadorProdutos` para reforcar filtros/contexto/RBAC nas listagens abertas pelos blocos.

### Cadastros Gerais - Fase 9 Blocos com Auditoria Contextual
- Segui o proximo passo dos blocos de Cadastros Gerais, sem criar tela, modulo, componente ou arquivo novo.
- `Bloco3Financeiro`, `Bloco4Logistica`, `Bloco5Organizacional` e `Bloco6Tecnologia` deixaram de auditar por `base44.entities.AuditLog.create` direto e passaram a usar `createInContext("AuditLog")`.
- Os bloqueios por ausencia de Grupo/Empresa, bloqueios por permissao, toasts, cards, botoes, app de motorista e abertura de janelas foram preservados.
- As auditorias dos blocos financeiro/fiscal, logistica/frota/almoxarifado, estrutura organizacional e tecnologia/IA agora reforcam carimbo multiempresa e rastreabilidade pelo helper contextual existente.
- Mantida a Regra-Mae: nenhuma funcionalidade, botao, card, formulario, visualizador ou fluxo foi removido; apenas seguranca, auditoria e multiempresa foram reforcados nos arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Cadastros Gerais revisando `Bloco1Pessoas`, `Bloco2Produtos` e visualizadores universais para reforcar RBAC/contexto sem criar novas telas.

### Cadastros Gerais - Fase 9 Auditoria Contextual da Tela Principal
- Segui o proximo passo salvo para Cadastros Gerais, sem criar tela, modulo, componente ou arquivo novo.
- `pages/Cadastros.jsx` deixou de registrar auditoria por chamada direta em `base44.entities.AuditLog.create` e passou a usar `createInContext("AuditLog")`.
- A auditoria de troca de abas, bloqueio de Apps Externos, abertura de blocos e busca universal agora reforca carimbo multiempresa com `group_id`, `grupo_id` e `empresa_id` pelo helper contextual existente.
- A tela principal recebeu marcadores de contexto/permissao no container e no aviso sem Grupo/Empresa, alem de manter `w-full h-full` no fluxo de abas.
- Mantida a Regra-Mae: nenhuma aba, bloco, card, busca, permissao visual ou fluxo de usuario foi removido; apenas seguranca, RBAC, auditoria e layout contextual foram reforcados no arquivo existente.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Cadastros Gerais revisando os blocos `Bloco1Pessoas` a `Bloco6Tecnologia` para reforcar filtros/contexto/RBAC sem criar novas telas.

### Administracao do Sistema - Fase 8 Central de Configuracoes Contextual
- Segui o proximo passo de configuracoes, sem criar tela, modulo, componente ou arquivo novo.
- `ConfigCenter` recebeu reforco de layout `w-full h-full`, rolagem interna e marcadores de contexto/permissao no container principal e no botao de atualizacao.
- O estado sem Grupo/Empresa selecionado passou a declarar contexto obrigatorio.
- Imports e variaveis sem uso foram removidos, reduzindo ruido tecnico sem alterar abas, toggles, carregamento de configuracoes ou fluxo de IA/backup/seguranca.
- Mantida a Regra-Mae: nenhuma funcionalidade, aba, toggle, botao ou fluxo foi removido; apenas layout, contexto e manutencao do arquivo existente foram reforcados.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: voltar para Cadastros Gerais ramificados, revisando filtros/contexto/RBAC sem criar novas telas.

### Administracao do Sistema - Fase 8 Notificacoes Contextuais
- Segui o proximo passo de notificacoes/motor de alertas, sem criar tela, modulo, componente ou arquivo novo.
- `MotorNotificacoes` passou a centralizar criacao de notificacoes em helper contextual local, carimbando `empresa_id`, `group_id`, `grupo_id` e `data_hora` a partir dos dados processados.
- `NotificacoesAutomaticas` passou a centralizar criacao de notificacoes em helper contextual local, preservando todos os fluxos de pedido aprovado, entrega em transporte, entrega concluida, cobranca vencendo e OP atribuida.
- As regras, canais de envio, WhatsApp, email, links, prioridades, destinatarios e entidades relacionadas foram preservados.
- Mantida a Regra-Mae: nenhuma funcionalidade, metodo publico, botao ou fluxo foi removido; apenas contexto multiempresa e rastreabilidade foram reforcados em arquivos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Administracao do Sistema revisando componentes restantes de notificacoes/configuracoes e depois voltar para Cadastros Gerais ramificados.

### Administracao do Sistema - Fase 8 Performance APM Contextual
- Segui o proximo passo de monitoramento/seguranca, sem criar tela, modulo, componente ou arquivo novo.
- `DashboardPerformance` deixou de consultar `LogPerformance` e `AlertaPerformance` por chamadas diretas `base44.entities.*.filter` e passou a usar `filterInContext`.
- O dashboard de performance passou a bloquear visualizacao sem contexto Grupo/Empresa, mantendo o fluxo atual de filtros, KPIs, abas, listas de queries/APIs lentas, erros e alertas.
- O layout do dashboard recebeu `w-full h-full`, rolagem interna e grid responsivo para KPIs, reforcando a regra de responsividade sem alterar a experiencia existente.
- Mantida a Regra-Mae: nenhuma funcionalidade, botao, aba, card ou filtro foi removido; apenas contexto multiempresa, isolamento de dados e responsividade foram reforcados.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Administracao do Sistema revisando notificacoes/motor de alertas e depois voltar para Cadastros Gerais ramificados.

### Administracao do Sistema - Fase 8 Dashboards e Monitores Contextuais
- Segui o proximo passo salvo em Administracao do Sistema, sem criar tela, modulo, componente ou arquivo novo.
- `SegurancaDashboard` passou a exigir contexto valido antes de carregar dados e a registrar visualizacao/bloqueio RBAC em `AuditLog` via `createInContext`.
- A listagem de usuarios do dashboard de seguranca passou a tentar `filterInContext('User')` antes do fallback existente, mantendo o filtro local de escopo multiempresa.
- `MonitorSistemaRealtime` passou a exibir bloqueio contextual quando nao houver Grupo ou Empresa selecionado e manteve layout `w-full h-full`.
- `MonitorPerformance` passou a tratar ausencia de contexto, ganhou layout `w-full h-full`, grid responsivo e classes Tailwind estaticas para status do sistema, evitando perda visual no build.
- Mantida a Regra-Mae: dashboards, cards, graficos, metricas, filtros e fluxos existentes foram preservados; apenas contexto, auditoria, responsividade e robustez visual foram reforcados.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Administracao do Sistema revisando componentes restantes de monitoramento/seguranca e depois voltar para Cadastros Gerais ramificados.

### Projeto/Codex - Sincronizacao GitHub e Abertura Local Corrigida
- Verificado que este computador estava 21 commits atras da `main` do GitHub; sincronizado por fast-forward para `ec128e55`.
- Confirmado repositorio correto: `https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX.git`, branch principal `main`.
- Corrigido o script existente `start-erp-dev.cmd` para usar fallback absoluto em `C:\Program Files\nodejs\npm.cmd` quando o Node local portatil nao existir.
- Mantida a Regra-Mae: melhoria feita no script existente de abertura local, sem criar novo fluxo, modulo, tela ou funcionalidade.
- Validado que `http://127.0.0.1:5173/` respondeu `200 OK` apos iniciar pelo script corrigido.
- Observacao: o controle automatico do Browser interno do Codex falhou nesta sessao por problema do plugin/browser, mas o servidor local ficou ativo e a aba pode ser recarregada no endereco local.
- Proximo passo sugerido: continuar o plano em Administracao do Sistema revisando `DashboardSeguranca`, `MonitorSistemaRealtime`, `MonitorPerformance` e componentes relacionados.

### Administracao do Sistema - Fase 8 Relatorios Contextuais
- Segui o proximo passo salvo em Administracao do Sistema, sem criar tela, modulo, componente ou arquivo novo.
- `GeradorRelatorios` deixou de auditar bloqueio RBAC e exportacao por `base44.entities.AuditLog.create` direto e passou a usar `createInContext('AuditLog')`.
- As exportacoes Excel, filtros por `filterInContext`, permissoes, cards, botoes e mensagens visuais foram preservados.
- Mantida a Regra-Mae: melhoria no componente existente, sem exclusao de botao, campo, aba ou funcionalidade.
- Proximo passo sugerido: continuar em Administracao do Sistema revisando `DashboardSeguranca`, `MonitorSistemaRealtime`, `MonitorPerformance` e componentes relacionados para contextualizar auditorias/listagens restantes sem alterar fluxo visual.
### Administracao do Sistema - Fase 8 Manutencao e Notificacoes Contextuais
- Segui o proximo passo salvo em Administracao do Sistema, sem criar tela, modulo, componente ou arquivo novo.
- `ConfiguracaoNotificacoes` deixou de salvar `ConfiguracaoSistema` e auditar regras por chamadas diretas, usando `createInContext`, `updateInContext` e auditoria contextual com `registro_id` do resultado.
- `HistoricoBackups` deixou de atualizar restauracoes/expiracao de `BackupAutomatico` e auditar por chamadas diretas, mantendo restauracao simulada, expiracao, modal e toasts existentes.
- `GerenciadorSessoes` deixou de revogar/encerrar `SessaoUsuario` e auditar por chamadas diretas, preservando encerramento individual, encerramento em massa e filtros por usuario/contexto.
- As leituras existentes foram mantidas porque ja filtram por usuario, grupo e/ou empresa no carregamento atual.
- Mantida a Regra-Mae: melhoria nos componentes existentes, sem exclusao de botao, campo, aba ou funcionalidade.
- Proximo passo sugerido: continuar em Administracao do Sistema revisando `GeradorRelatorios`, `DashboardSeguranca` e componentes de monitoramento para contextualizar auditorias diretas restantes sem alterar fluxo visual.
### Administracao do Sistema - Fase 8 Configuracoes Operacionais Contextuais
- Segui o proximo passo salvo em Gestao de Acessos/Admin, sem criar tela, modulo, componente ou arquivo novo.
- `ConfiguracaoBackup`, `ConfiguracaoMonitoramento` e `ConfiguracaoSeguranca` deixaram de criar/editar configuracoes e auditorias por chamadas diretas quando havia helper contextual seguro.
- Backup manual em `BackupAutomatico` passou a usar `createInContext` e `updateInContext`, mantendo inicio, conclusao simulada, toast, invalidacao de cache e fluxo visual existente.
- As leituras/filtros existentes foram preservados para nao quebrar carregamento das configuracoes e espelhos de seguranca.
- Mantida a Regra-Mae: melhoria nos componentes existentes, sem exclusao de botao, campo, aba ou funcionalidade.
- Proximo passo sugerido: continuar em Administracao do Sistema revisando componentes de configuracao e manutencao restantes para remover chamadas diretas sensiveis quando houver helper contextual seguro.
### Administracao do Sistema - Fase 8 Monitor e Validadores UI Contextuais
- Segui o proximo passo salvo em Gestao de Acessos/Admin, sem criar tela, modulo, componente ou arquivo novo.
- `MonitorAcessoRealtime`, `ValidadorElementosInterativos` e `ValidadorLayoutResponsivo` deixaram de auditar por `base44.entities.AuditLog.create` direto e passaram a usar `createInContext('AuditLog')`.
- A listagem de usuarios em `MonitorAcessoRealtime` foi preservada porque ainda passa pelo filtro local de escopo multiempresa existente.
- Monitoramento em tempo real, varredura de elementos interativos, varredura de layout responsivo, botoes e fluxos visuais foram mantidos.
- Mantida a Regra-Mae: melhoria nos componentes existentes, sem exclusao de botao, campo, aba ou funcionalidade.
- Proximo passo sugerido: continuar em Gestao de Acessos/Admin revisando `ConfiguracaoBackup`, `ConfiguracaoMonitoramento` e `ConfiguracaoSeguranca` para contextualizar auditorias diretas restantes.
### Administracao do Sistema - Fase 8 Validadores RBAC Contextuais
- Segui o proximo passo salvo em Gestao de Acessos/Admin, sem criar tela, modulo, componente ou arquivo novo.
- `ValidadorAcessoCompleto`, `MatrizPermissoesVisual` e `RelatorioPermissoes` deixaram de auditar por `base44.entities.AuditLog.create` direto e passaram a usar `createInContext('AuditLog')`.
- A listagem de usuarios em `ValidadorAcessoCompleto` foi preservada porque ainda passa pelo filtro local de escopo multiempresa existente.
- Exportacao de matriz CSV, relatorio JSON/TXT, validacao completa, botoes e fluxos visuais foram mantidos.
- Mantida a Regra-Mae: melhoria nos componentes existentes, sem exclusao de botao, campo, aba ou funcionalidade.
- Proximo passo sugerido: continuar em Gestao de Acessos revisando `MonitorAcessoRealtime`, `ValidadorElementosInterativos` e validadores de layout para contextualizar auditorias restantes sem quebrar validacoes.
### Administracao do Sistema - Fase 8 Acessos Avancados Contextuais
- Segui o proximo passo salvo em Gestao de Acessos/Admin, sem criar tela, modulo, componente ou arquivo novo.
- `GerenciamentoAcessosCompleto` deixou de criar, editar e excluir `PerfilAcesso` por chamadas diretas e passou a usar `createInContext`, `updateInContext` e `deleteInContext`.
- A configuracao `PermissaoEmpresaModulo` e a atualizacao de `User` no modo avancado tambem passaram a usar helpers contextuais.
- A auditoria local `registrarAuditoriaAcesso` deixou de usar `base44.entities.AuditLog.create` direto e passou a usar `createInContext('AuditLog')`.
- As listagens de usuarios, filtros por escopo, dashboards, abas, modais e fluxos do modo avancado foram preservados.
- Mantida a Regra-Mae: melhoria no componente existente, sem exclusao de botao, campo, aba ou funcionalidade.
- Proximo passo sugerido: continuar em Gestao de Acessos revisando `ValidadorAcessoCompleto`, `MatrizPermissoesVisual` e `RelatorioPermissoes` para contextualizar auditorias diretas restantes.
### Administracao do Sistema - Fase 8 Usuarios Avancados Contextual
- Segui o proximo passo salvo em Gestao de Acessos/Admin, sem criar tela, modulo, componente ou arquivo novo.
- `GestaoUsuariosAvancada` deixou de atualizar `User` por chamada direta e passou a usar `updateInContext('User')`.
- A auditoria manual duplicada de alteracao de usuario foi removida porque `updateInContext` ja registra antes/depois, usuario, grupo e empresa quando disponivel.
- O modal de gestao de usuario, perfil vinculado, empresas vinculadas, restricoes, dois fatores, cargo, departamento e telefone foram preservados.
- Mantida a Regra-Mae: melhoria no componente existente, sem exclusao de botao, campo, aba ou funcionalidade.
- Proximo passo sugerido: continuar em Gestao de Acessos revisando `GerenciamentoAcessosCompleto` para trocar salvamento/exclusao de perfis e auditorias diretas por helpers contextuais, com cuidado para nao quebrar modo avancado.
### Administracao do Sistema - Fase 8 Central de Perfis Contextual
- Segui o proximo passo salvo em Gestao de Acessos/Admin, sem criar tela, modulo, componente ou arquivo novo.
- `CentralPerfisAcesso` deixou de criar, editar e excluir `PerfilAcesso` por chamadas diretas e passou a usar `createInContext`, `updateInContext` e `deleteInContext`.
- Auditorias manuais duplicadas de criacao, edicao e exclusao de perfil foram removidas porque os helpers contextuais ja registram antes/depois, grupo, empresa e usuario quando disponivel.
- As listagens existentes de usuarios e o fallback de perfis foram preservados para nao quebrar compatibilidade do RBAC atual.
- Botoes, busca, modal, confirmacao Regra-Mae, permissoes granulares e fluxo visual foram mantidos.
- Mantida a Regra-Mae: melhoria no componente existente, sem exclusao de botao, campo, aba ou funcionalidade.
- Proximo passo sugerido: continuar em Gestao de Acessos revisando `GerenciamentoAcessosCompleto`, `GestaoUsuariosAvancada` e validadores para trocar acoes sensiveis diretas por helpers contextuais quando seguro.
### Administracao do Sistema - Fase 8 Gestao de Acessos Contextual
- Segui o proximo passo salvo em Gestao de Acessos, sem criar tela, modulo, componente ou arquivo novo.
- `GestaoAcessosIndex` deixou de auditar troca de abas por `base44.entities.AuditLog.create` direto e passou a usar `createInContext('AuditLog')`.
- `UsuariosTab` deixou de auditar bloqueios e convites por chamada direta e passou a centralizar a auditoria em `auditarUsuario` com `createInContext('AuditLog')`.
- O convite real por `base44.users.inviteUser`, as listagens existentes e os filtros por escopo foram preservados para nao quebrar o fluxo atual.
- A aba RBAC, busca, filtros, botoes e modal de configuracao de usuarios foram mantidos.
- Mantida a Regra-Mae: melhoria nos componentes existentes, sem exclusao de botao, campo, aba ou funcionalidade.
- Proximo passo sugerido: continuar a varredura em Gestao de Acessos e Admin para reduzir fallback/listagens diretas restantes quando houver helper contextual seguro, sem afetar convite ou usuario real.
### Administracao do Sistema - Fase 8 SoD Contextual
- Segui o proximo passo salvo em Gestao de Acessos, sem criar tela, modulo, componente ou arquivo novo.
- `SoDChecker` preservou a funcao existente `sodValidator` para analise de segregacao de funcoes.
- Auditorias de analise, bloqueio, erro e persistencia SoD deixaram de usar `base44.entities.AuditLog.create` direto e passaram a usar `createInContext('AuditLog')`.
- Persistencia de conflitos em `PerfilAcesso` deixou de usar `base44.entities.PerfilAcesso.update` direto e passou a usar `updateInContext('PerfilAcesso')`, preservando `group_id` e `empresa_id`.
- Botoes, resultados, bloqueios por contexto/permissao e fluxo visual foram preservados.
- Mantida a Regra-Mae: melhoria no componente existente, sem exclusao de botao, campo, aba ou funcionalidade.
- Proximo passo sugerido: continuar em Gestao de Acessos revisando `GestaoAcessosIndex` e `UsuariosTab` para reduzir auditorias/listagens diretas restantes sem quebrar o fluxo atual.
### Administracao do Sistema - Fase 8 Seguranca e Monitoramento Contextuais
- Segui o proximo passo salvo em Administracao do Sistema, sem criar tela, modulo, componente ou arquivo novo.
- `SegurancaGovernancaIndex` deixou de registrar visualizacao de abas por `base44.entities.AuditLog.create` direto e passou a usar `createInContext('AuditLog')`.
- `MonitoramentoManutencaoIndex` deixou de registrar auditoria de abas/bloqueios por chamada direta e passou a usar `createInContext('AuditLog')`.
- As auditorias contextuais agora preservam grupo/empresa, usuario, sucesso/falha e tratam erro assíncrono sem quebrar a navegacao.
- As abas, permissoes visuais, `ProtectedSection`, banners de contexto/heranca e componentes existentes foram preservados.
- Mantida a Regra-Mae: melhoria nos componentes existentes, sem exclusao de botao, campo, aba ou funcionalidade.
- Proximo passo sugerido: continuar em Gestao de Acessos (`GestaoAcessosIndex`, `UsuariosTab`, `SoDChecker`) para trocar listagens/auditorias/updates diretos por helpers contextuais quando aplicavel.
### Administracao do Sistema - Fase 8 IA/Otimizacao Contextual
- Segui a varredura salva em Administracao do Sistema, sem criar tela, modulo, componente ou arquivo novo.
- `IAOtimizacaoIndex` deixou de criar `IAConfig` por `base44.entities.IAConfig.create` direto e passou a usar `createInContext('IAConfig')`.
- Auditoria de visualizacao de abas e criacao de configuracoes padrao de IA passou a usar `createInContext('AuditLog')`, preservando grupo/empresa e usuario.
- A subscription existente de `ConfiguracaoSistema` foi preservada porque apenas observa atualizacoes em tempo real e nao grava dados.
- O botao `Criar Padroes` manteve o fluxo visual atual e recebeu marcador de contexto obrigatorio.
- Foram corrigidos pequenos textos/acento quebrados no mesmo painel, sem alterar fluxo, layout ou funcionalidade.
- Mantida a Regra-Mae: melhoria no componente existente, sem exclusao de botao, campo, aba ou funcionalidade.
- Proximo passo sugerido: continuar a varredura em Administracao do Sistema priorizando `SegurancaGovernancaIndex`, `MonitoramentoManutencaoIndex` e Gestao de Acessos para remover auditorias/listagens diretas sensiveis.
### Administracao do Sistema - Fase 8 Versionamento e Conflitos Contextuais
- Segui o proximo passo salvo em Configuracoes Gerais, sem criar tela, modulo, componente ou arquivo novo.
- `VersionamentoConfigPanel` deixou de restaurar `ConfiguracaoSistema` por `base44.entities.ConfiguracaoSistema.update` direto e passou a usar `updateInContext`.
- Auditoria de restauracao de configuracao passou a usar `createInContext('AuditLog')`, preservando usuario, grupo, empresa e antes/depois.
- `ConflitosRevisaoPanel` deixou de auditar e aplicar merge por chamadas diretas de entidade; auditoria usa `createInContext('AuditLog')` e aplicacao usa `updateInContext`.
- O nome dinamico da entidade no merge agora e validado antes de executar pre-visualizacao/aplicacao, reduzindo risco em acao sensivel.
- Botoes de restaurar, pre-visualizar merge e aplicar merge mantiveram o fluxo visual atual e receberam marcadores de contexto obrigatorio.
- Mantida a Regra-Mae: melhoria nos componentes existentes, sem exclusao de botao, campo, aba ou funcionalidade.
- Proximo passo sugerido: fazer nova varredura em Configuracoes Gerais/Admin para localizar chamadas diretas restantes em acoes sensiveis e depois seguir para RBAC granular dos botoes internos.
### Administracao do Sistema - Fase 8 Heranca de Configuracoes Contextual
- Segui a nova varredura do plano e avancei em Configuracoes Gerais, sem criar tela, modulo, componente ou arquivo novo.
- `HerancaOverridesPanel` deixou de usar `base44.entities.ConfiguracaoSistema.*` e `base44.entities.AuditLog.create` direto.
- Leituras de configuracoes de grupo/empresa passaram a usar `filterInContext`; criacao, atualizacao e remocao de overrides passaram a usar `createInContext`, `updateInContext` e `deleteInContext`.
- Auditoria de overrides passou a ser registrada por `createInContext('AuditLog')`, preservando `groupId`, `empresaId`, usuario e antes/depois.
- Botoes de criar/remover override mantiveram o fluxo atual e receberam `data-context-required`, reforcando RBAC/contexto sem remover funcionalidade.
- Mantida a Regra-Mae: melhoria no componente existente, sem exclusao de tela, campo, aba ou acao.
- Proximo passo sugerido: continuar em Configuracoes Gerais revisando `VersionamentoConfigPanel` e `ConflitosRevisaoPanel`, que ainda possuem restauracao/merge sensiveis com chamadas diretas.
### Administracao do Sistema - Fase 8 IA e WhatsApp em Contexto
- Segui o proximo passo salvo na aba Integracoes, sem criar tela, modulo, componente ou arquivo novo.
- `IALeituraProjeto` manteve as integracoes reais `UploadFile` e `InvokeLLM`, mas agora bloqueia processamento sem grupo/empresa ou permissao e audita leitura real/simulada sem gravar conteudo sensivel completo.
- `IAPrevisaoLogistica` deixou de importar Base44 sem uso, passou a exigir contexto/permissao para gerar previsoes e aplicar sugestoes, e registra auditoria contextual.
- `TesteWhatsApp` deixou de importar Base44 sem uso, passou a validar telefone, bloquear envio/templates sem contexto ou permissao e auditar envio simulado com metadados seguros.
- Botoes, campos, templates, tabelas e fluxos visuais foram preservados; apenas RBAC, contexto multiempresa e auditoria foram reforcados.
- Mantida a Regra-Mae: melhoria nos componentes existentes, sem exclusao de funcionalidade.
- Proximo passo sugerido: fazer nova varredura de `src/components/integracoes` e seguir para pontos de Integracoes/Administracao que ainda tenham chamadas diretas ou acoes sensiveis sem contexto/RBAC.
### Administracao do Sistema - Fase 8 Marketplaces Contextuais
- Segui o proximo passo salvo na aba Integracoes, sem criar tela, modulo, componente ou arquivo novo.
- `SincronizacaoMarketplacesAtiva` deixou de criar clientes, pedidos, pedidos externos e auditorias por chamadas diretas `base44.entities.*`.
- Importacao e sincronizacao de pedidos marketplace agora usam `createInContext`, `updateInContext` e `filterInContext`, preservando `groupId`/`empresaId` e sanitizacao local.
- `SincronizacaoMarketplaces` passou a listar pedidos externos por contexto, bloquear toggles/sincronizacao sem grupo/empresa ou permissao e auditar bloqueios/acoes sensiveis.
- O fluxo visual, botoes, tabelas e comportamento de importacao/sincronizacao foram preservados; apenas contexto, RBAC e auditoria foram reforcados.
- Mantida a Regra-Mae: melhoria nos componentes existentes, sem exclusao de funcionalidade.
- Proximo passo sugerido: revisar os filhos restantes de Integracoes com chamadas diretas (`IALeituraProjeto`, `IAPrevisaoLogistica` e `TesteWhatsApp`), priorizando contexto/RBAC/auditoria antes de mudancas visuais.

### Administracao do Sistema - Fase 8 Integracoes Configuraveis em Contexto
- Segui o proximo passo salvo nos filhos de Integracoes, sem criar tela, modulo, componente ou arquivo novo.
- `ConfigWhatsAppBusiness`, `CentralIntegracoes` e `StatusIntegracoes` deixaram de usar chamadas diretas `base44.entities.*` para auditoria, leitura e gravacao de configuracoes.
- Auditorias passaram a usar `createInContext('AuditLog')` e configuracoes passaram a usar `filterInContext`, `createInContext` e `updateInContext`, preservando escopo de grupo/empresa e sanitizacao local.
- O fluxo visual de testes/status/configuracao de integracoes foi preservado; botoes, forms e janelas existentes continuam no mesmo caminho.
- Mantida a Regra-Mae: apenas melhoria nos componentes existentes, reforcando multiempresa, RBAC ja existente e auditoria contextual.
- Proximo passo sugerido: continuar em `SincronizacaoMarketplacesAtiva` e depois revisar os filhos restantes de Integracoes com chamadas diretas (`IALeituraProjeto`, `IAPrevisaoLogistica`, `SincronizacaoMarketplaces`, `TesteWhatsApp`), priorizando contexto/RBAC antes de qualquer mudanca visual.

### Administracao do Sistema - Fase 8 Testes de Integracoes Contextuais
- Segui o proximo passo salvo em Administracao do Sistema: revisar componentes filhos da aba Integracoes sem criar tela, modulo, componente ou arquivo novo.
- `TesteNFe`, `TesteBoletos`, `TesteGoogleMaps` e `TesteTransportadoras` deixaram de registrar auditoria por `base44.entities.AuditLog.create` direto.
- As auditorias dos testes passaram a usar `createInContext('AuditLog')` via `useContextoVisual`, preservando `groupId`, `empresaId` e sanitizacao do padrao local.
- Imports `base44` sem uso foram removidos desses quatro componentes.
- Mantida a Regra-Mae: os testes, botoes, campos e fluxo visual continuam existindo; apenas auditoria contextual e limpeza de dependencias foram reforcadas.
- Proximo passo sugerido: continuar nos filhos de Integracoes, priorizando `ConfigWhatsAppBusiness`, `CentralIntegracoes`, `StatusIntegracoes` e `SincronizacaoMarketplacesAtiva` para trocar chamadas diretas restantes por helpers de contexto.

### INSTRUCAO PERMANENTE - Abrir Projeto no Codex
- Sempre que abrir este projeto no Codex, usar a copia local do GitHub em `C:\Users\cpaba\ERP-Zuccaro-codeX-local\ERP-Zuccaro-codeX`.
- Antes de continuar qualquer melhoria, executar `git pull`, ler este `STATUS_DO_PROJETO.md` e seguir a Regra-Mae.
- Para abrir o ERP no navegador interno do Codex, iniciar o servidor local pela pasta acima e acessar `http://localhost:5173/` ou `http://127.0.0.1:5173/`.
- O HD externo nao deve ser alterado, e o GitHub so deve receber alteracoes quando o usuario pedir ou quando for necessario salvar o plano/status combinado.
- Sempre registrar no `STATUS_DO_PROJETO.md` o que foi feito e o proximo passo para outro computador conseguir continuar.

### Projeto/Codex - Abertura Automatica Local
- Seguido o pedido de deixar o projeto abrir automaticamente no ambiente local, sem criar modulo, tela ou funcionalidade nova.
- `start-erp-dev.cmd` foi melhorado para iniciar o ERP Zuccaro em `http://127.0.0.1:5173/`, usando Node local quando existir ou `npm.cmd` instalado no Windows como fallback.
- `abrir-erp-hd.bat` foi integrado ao script principal `start-erp-dev.cmd`, evitando dois fluxos diferentes para iniciar o servidor.
- Objetivo tecnico: quando o Codex abrir com a aba em `localhost:5173`, o servidor local ja deve estar disponivel se a tarefa automatica do Windows estiver ativa.
- Observacao: o Codex/in-app browser pode nao permitir navegacao automatica por script externo; a automacao garante o servidor rodando, e a aba pode ser recarregada no endereco local.
- Validado: `http://127.0.0.1:5173/` respondeu na porta local.
- A tarefa agendada do Windows foi tentada, mas o Windows retornou `Acesso negado`; como alternativa sem admin, foi criado o atalho `ERP Zuccaro Codex AutoStart.lnk` na pasta Inicializar do usuario.
- Ao entrar no Windows, o atalho chama `start-erp-dev.cmd` minimizado para manter o servidor local disponivel para o Codex.
- Validado e salvo no GitHub em `main` e `codex/sincronizar-projeto`.

### Administracao do Sistema - Fase 8 Aba Ferramentas Administrativas
- Verificada a aba `Ferramentas`: ela possui utilidade real para seed leve e backfill multiempresa, entao nao foi excluida.
- A rota da Administracao do Sistema passou a aceitar `tab=ferramenta` no singular, alem de `tab=ferramentas`, `tools`, `tool`, `seed` e aliases de utilitarios.
- `AdminFerramentas` passou a reforcar RBAC granular em seed, dry-run e aplicacao de backfill, mantendo os botoes existentes e bloqueando acoes sem permissao.
- Auditoria das ferramentas administrativas deixou de usar `base44.entities.AuditLog.create` direto e passou a usar `createInContext('AuditLog')`, preservando `groupId`, `grupoId` e `empresaId`.
- Bloqueios por falta de contexto/permissao agora tambem sao auditados, com metadados sanitizados.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; a aba existente foi corrigida e reforcada em seguranca, auditoria, RBAC e multiempresa.
- Build validado com sucesso via `npm run build`; rota `http://localhost:5173/administracaosistema?tab=ferramenta` respondeu `200 OK`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Administracao do Sistema revisando componentes filhos de integracoes e seguranca.

### Administracao do Sistema - Fase 8 Integracoes e Auditoria
- Seguido o plano de melhoria no componente existente `IntegracoesIndex`, sem criar tela, modulo, componente ou arquivo novo.
- Auditorias da aba de integracoes deixaram de usar `base44.entities.AuditLog.create` direto e passaram a usar `createInContext('AuditLog')`, preservando `groupId`, `grupoId` e `empresaId`.
- Metadados simples de auditoria de integracoes agora sao sanitizados antes do registro, reduzindo risco de conteudo inseguro em logs.
- Visualizacao/troca de abas de integracoes passou a registrar escopo contextual e tratar falha de auditoria sem quebrar a navegacao.
- Mantida a Regra-Mae: botoes de criar estrutura base, copiar URL e testar webhooks continuam no fluxo atual; apenas contexto, seguranca e rastreabilidade foram reforcados.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Administracao do Sistema, revisando componentes filhos de integracoes (`TesteNFe`, `TesteBoletos`, `ConfigWhatsAppBusiness`, transportadoras, maps e marketplaces`) para RBAC, contexto e auditoria.

### Atendimento/Chatbot - Fase 8 Hub de Atendimento e Anexos
- Seguido o plano de melhoria no componente existente `HubAtendimento`, sem criar tela, modulo, componente ou arquivo novo.
- Envio de anexos pelo atendente passou a validar limite de 10MB antes do upload, alinhando o Hub ao padrao ja aplicado nos widgets do Chatbot.
- Mensagens com anexo passaram a gravar tipo, tamanho em KB e nome sanitizado do arquivo para rastreabilidade operacional.
- Upload de anexo no Hub passou a registrar auditoria contextual com `createInContext('AuditLog')`, preservando `groupId`, `empresaId`, usuario, conversa e metadados sem expor conteudo do arquivo.
- O seletor de arquivo agora bloqueia anexos grandes antes do envio e limpa o anexo/input apos envio bem-sucedido.
- Mantida a Regra-Mae: fluxo atual de envio de mensagem/anexo do atendente foi preservado; apenas seguranca, contexto multiempresa, auditoria e usabilidade foram reforcados.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar em Administracao do Sistema, revisando toggles/botoes globais e permissoes de integracoes/seguranca.

### Atendimento/Chatbot - Fase 8 IA, InvokeLLM e Auditoria Contextual
- Seguido o plano de melhoria nos componentes existentes `IntentEngine`, `SugestoesIA`, `IAConversacional` e `TranscricaoAudio`, sem criar tela, modulo, componente ou arquivo novo.
- Chamadas `InvokeLLM` passaram a usar mensagem/contexto sanitizados, com `groupId` e `empresaId` explicitos nos prompts quando aplicavel.
- `IntentEngine` deixou de reenviar a propria deteccao de intent quando a IA falha, evitando repeticao de fallback e mantendo a analise local ja calculada.
- `SugestoesIA`, `IAConversacional` e `TranscricaoAudio` passaram a registrar auditoria contextual com `createInContext('AuditLog')` sem salvar conteudo completo sensivel no log.
- Mantida a Regra-Mae: fluxos atuais de sugestoes, analise conversacional, transcricao e fallback de intent foram preservados; apenas seguranca, contexto multiempresa e auditoria foram reforcados.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: fechar revisao final de Atendimento/Chatbot procurando chamadas diretas restantes de Base44/IA e, se limpo, seguir para Administracao do Sistema.

### Atendimento/Chatbot - Fase 8 Auditoria, Exportacao e Fluxos Auxiliares
- Seguido o plano de melhoria nos componentes existentes `ExportarConversas`, `RelatoriosAtendimento`, `GerarBoletoChat` e `TransferirConversa`, sem criar tela, modulo, componente ou arquivo novo.
- Auditorias de exportacao, relatorios, boleto no chat e transferencia deixaram de usar `base44.entities.AuditLog.create` direto e passaram a usar `createInContext('AuditLog')`.
- `ExportarConversas` passou a usar o usuario do contexto da aplicacao (`useUser`) para auditoria, evitando chamada direta `base44.auth.me()` no fluxo de exportacao.
- Imports Base44 sem uso foram removidos dos componentes em que a auditoria direta deixou de existir.
- Mantida a Regra-Mae: fluxos atuais de exportar CSV/JSON, exportar relatorio, gerar boleto pelo chat e transferir conversa foram preservados; apenas carimbo multiempresa e auditoria contextual foram reforcados.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: revisar os pontos restantes de `InvokeLLM`/IntentEngine e fechar Atendimento/Chatbot antes de seguir para Administracao do Sistema.

### Atendimento/Chatbot - Fase 8 Widgets do Chatbot
- Seguido o plano de melhoria nos componentes existentes `ChatbotWidget` e `ChatbotWidgetAvancado`, sem criar tela, modulo, componente ou arquivo novo.
- Upload de anexos passou a validar limite de 10MB antes de chamar `UploadFile`, reduzindo risco de envio pesado e falha silenciosa.
- `ChatbotWidget` simples passou a mostrar feedback por toast ao anexar arquivo, bloquear arquivo grande e exibir erro de envio ao usuario.
- Auditoria operacional dos widgets deixou de usar `base44.entities.AuditLog.create` direto e passou a usar `createInContext('AuditLog')`, mantendo carimbo grupo/empresa e fluxo de auditoria contextual.
- Mantida a Regra-Mae: fluxo de abertura, envio de mensagem, transbordo, resposta do bot e avaliacao do widget avancado foi preservado; apenas seguranca, validacao e rastreabilidade foram reforcadas.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: revisar os pontos restantes de auditoria/exportacao/relatorios do Chatbot e depois seguir para Administracao do Sistema quando Atendimento estiver fechado.

### Atendimento/Chatbot - Fase 8 Webhooks e WhatsApp
- Seguido o plano de melhoria nos componentes existentes `WebhooksTester` e `IntegracaoWhatsApp`, sem criar tela, modulo, componente ou arquivo novo.
- `WebhooksTester` removeu import Base44 inutilizado e passou a exigir contexto grupo/empresa e permissao de integracoes antes de executar teste de webhook.
- Teste de webhook agora valida tamanho do payload, parse JSON e retorna `group_id`/`empresa_id` no resultado simulado para rastreabilidade multiempresa.
- `IntegracaoWhatsApp` passou a usar contexto visual e RBAC de integracoes, mantendo a tela existente e habilitando campos/teste somente para perfis autorizados.
- Botao `Testar Conexao`, que estava travado por `disabled={testando || true}`, agora funciona conforme contexto/permissao e valida preenchimento de token, Phone Number ID e Business Account ID.
- Campos sensiveis e botoes receberam `data-sensitive`, `data-action`, `data-permission` e `data-context-required` quando aplicavel.
- Mantida a Regra-Mae: nenhum fluxo foi removido; a integracao continua sinalizando dependencia de Backend Functions, mas agora com bloqueios e retorno funcional.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: revisar os pontos restantes de `InvokeLLM`/uploads/auditoria nos componentes auxiliares do Chatbot e seguir para Administracao do Sistema quando Atendimento estiver fechado.

### Atendimento/Chatbot - Fase 8 Hub de Atendimento Central
- Seguido o plano de melhoria na tela existente `HubAtendimento`, sem criar tela, modulo, componente ou arquivo novo.
- `HubAtendimento` deixou de listar conversas, mensagens e metricas por chamadas diretas `base44.entities.*` e passou a usar `filterInContext` com chave por grupo/empresa.
- A lista de conversas agora respeita o contexto do grupo/empresa antes de aplicar a regra de atendente atribuido ou conversa sem atribuicao; quem tem permissao de ver todas continua enxergando a fila contextual completa.
- Envio de mensagem, assumir conversa e resolver conversa passaram a usar `createInContext`/`updateInContext`, reforcando sanitizacao, carimbo multiempresa e auditoria antes/depois.
- Upload/anexo no atendimento foi mantido no fluxo atual, mas passou a ser bloqueado sem contexto valido ou permissao de anexo/edicao.
- Botoes sensiveis de assumir, transferir, resolver, anexar e enviar receberam bloqueio por RBAC/contexto e marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- Mantida a Regra-Mae: fluxo visual do Hub Omnicanal foi preservado; apenas consultas, gravacoes, permissao e rastreabilidade foram reforcadas.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nos componentes restantes com `base44` direto/legado, priorizando `WebhooksTester`, `IntegracaoWhatsApp`, revisao final de `InvokeLLM` e pontos auxiliares de atendimento.

### Atendimento/Chatbot - Fase 8 Historico, IA Auxiliar e Transcricao
- Seguido o plano de melhoria nos componentes existentes `HistoricoClienteChat`, `SugestoesIA`, `IAConversacional` e `TranscricaoAudio`, sem criar tela, modulo, componente ou arquivo novo.
- `HistoricoClienteChat` deixou de usar `Cliente.get`, `Pedido.filter` e `ConversaOmnicanal.filter` diretos e passou a consultar cliente, pedidos e conversas anteriores por `filterInContext`.
- Historico do cliente agora usa chave por grupo/empresa e exige permissao de atendimento/clientes antes de carregar dados sensiveis.
- `SugestoesIA` e `IAConversacional` passaram a executar `InvokeLLM` somente com contexto grupo/empresa e permissao de atendimento/integracoes.
- `TranscricaoAudio` passou a bloquear gravacao, upload e transcricao por IA sem contexto e RBAC de atendimento.
- Cards e acoes sensiveis receberam `w-full`, `h-full`, `data-permission`, `data-context-required`, `data-action` e `data-sensitive` quando aplicavel.
- Mantida a Regra-Mae: fluxos atuais de historico, sugestoes de IA, analise conversacional e transcricao foram preservados; apenas contexto, RBAC e rastreabilidade foram reforcados.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em Atendimento/Chatbot nos componentes restantes com `base44` direto, priorizando `ConfiguracaoAvancada`, `IntegracaoWhatsApp`, `WebhooksTester`, `DashboardAtendente`/componentes legados e revisao final de chamadas `InvokeLLM`.

### Atendimento/Chatbot - Fase 8 Notificacoes, Roteamento, Avaliacao e Tags
- Seguido o plano de melhoria nos componentes existentes `NotificacoesCanal`, `RoteamentoInteligente`, `AvaliacaoAtendimento` e `TagsCategorizacao`, sem criar tela, modulo, componente ou arquivo novo.
- `NotificacoesCanal` deixou de buscar/atualizar `ConfiguracaoCanal` diretamente e passou a usar `filterInContext` e `updateInContext`, bloqueando toggles e salvamento sem contexto/permissao.
- `RoteamentoInteligente` deixou de listar usuarios/conversas globalmente e passou a carregar equipe e estatisticas por grupo/empresa; regras e atribuicao de conversa agora usam `updateInContext`.
- `AvaliacaoAtendimento` passou a atualizar conversa e criar mensagem interna por `updateInContext`/`createInContext`, exigindo contexto e permissao antes de finalizar atendimento.
- `TagsCategorizacao` passou a atualizar tags da conversa por `updateInContext`, com bloqueio de edicao, adicao e remocao sem contexto/RBAC.
- Acoes sensiveis receberam `data-action`, `data-permission`, `data-context-required` e `data-sensitive` quando alteram dados.
- Mantida a Regra-Mae: fluxos atuais de notificacao, roteamento, CSAT/NPS e tags foram preservados; apenas contexto, RBAC e rastreabilidade foram reforcados.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em Atendimento/Chatbot nos componentes auxiliares restantes `HistoricoClienteChat`, `SugestoesIA`, `IAConversacional`, `TranscricaoAudio` e pontos com `InvokeLLM`/consultas diretas.

### Atendimento/Chatbot - Fase 8 Configuracao, Templates e Automacoes
- Seguido o plano de melhoria nos componentes existentes `ConfiguracaoCanais`, `BaseConhecimento`, `AutomacaoFluxos`, `TemplatesMensagens` e `GerenciadorTemplates`, sem criar tela, modulo, componente ou arquivo novo.
- `ConfiguracaoCanais` deixou de consultar/criar/atualizar `ConfiguracaoCanal` diretamente e passou a usar `filterInContext`, `createInContext` e `updateInContext` com chave por grupo/empresa.
- Formularios de configuracao basica, horarios, IA e SLA passaram a bloquear salvamentos/toggles sem contexto ou permissao de integracoes/atendimento.
- `BaseConhecimento` passou a carregar, criar e atualizar base por configuracao contextual, preservando o canal `Portal` existente como fallback.
- `AutomacaoFluxos` passou a salvar automacoes via `updateInContext`, bloqueando toggle/salvamento sem contexto, canal ou permissao.
- `TemplatesMensagens` e `GerenciadorTemplates` passaram a listar, criar, atualizar e excluir templates somente dentro do contexto grupo/empresa, sem uso de `ConfiguracaoCanal.get/list/filter/create/update` direto.
- Acoes sensiveis receberam `data-action`, `data-permission`, `data-context-required` e `data-sensitive` quando alteram dados.
- Mantida a Regra-Mae: os fluxos atuais de configuracao, base de conhecimento, templates e automacoes foram preservados; apenas contexto, RBAC e rastreabilidade foram reforcados.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em Atendimento/Chatbot nos componentes restantes `NotificacoesCanal`, `RoteamentoInteligente`, `AvaliacaoAtendimento`, `TagsCategorizacao` e historicos/IA auxiliares que ainda usam chamadas diretas.

### Atendimento/Chatbot - Fase 8 Analytics, SLA e Painel do Atendente
- Seguido o plano de melhoria nos componentes existentes `AnalyticsAtendimento`, `MonitorSLA` e `DashboardAtendente`, sem criar tela, modulo, componente ou arquivo novo.
- `AnalyticsAtendimento` deixou de consultar conversas/mensagens diretamente por empresa ou de forma global e passou a usar `filterInContext` com chave por grupo/empresa.
- `MonitorSLA` deixou de usar `ConversaOmnicanal.list()` global e passou a carregar conversas por contexto, com bloqueio por RBAC e aviso quando faltar grupo/empresa.
- `DashboardAtendente` passou a calcular metricas individuais somente dentro do contexto grupo/empresa e com permissao de atendimento/dashboard.
- Containers principais receberam `w-full`, `h-full`, `data-permission` e `data-context-required`, mantendo responsividade e controle visual de acesso.
- Mantida a Regra-Mae: fluxos atuais de analytics, SLA e painel do atendente foram preservados; apenas consultas, bloqueios e contexto foram reforcados.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em Atendimento/Chatbot nos componentes restantes de configuracao/automacao/base de conhecimento/templates que ainda gravam `ConfiguracaoCanal` diretamente.

### Atendimento/Chatbot - Fase 8 IntentEngine em Contexto
- Seguido o plano de melhoria no `IntentEngine`, sem criar tela, modulo, componente ou arquivo novo.
- Adicionados helpers internos para normalizar `groupId`/`empresaId`, montar filtros contextuais e carimbar payloads criados pelo motor de intents.
- Intents dinamicas (`ChatbotIntent`) passaram a consultar por contexto grupo/empresa.
- Consultas automaticas de pedidos, entregas e boletos passaram a usar filtros com `group_id`/`empresa_id`.
- Criacao automatica de pedido e boleto agora exige contexto valido, carimba `group_id`/`grupo_id`/`empresa_id` e registra auditoria com dados novos.
- Emissao de boleto via funcao backend preservada, mas a atualizacao do `ContaReceber` passou a manter contexto multiempresa.
- `ChatbotWidget` e `ChatbotWidgetAvancado` passaram a enviar `groupId` e `empresaId` ao `IntentEngine`.
- Mantida a Regra-Mae: o motor atual foi reforcado sem duplicar fluxo e sem remover intents existentes.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em Atendimento/Chatbot nos componentes restantes com chamadas diretas de atendimento, priorizando relatorios, analytics e automacoes.

### Administracao do Sistema - Fase 8 Aba Ferramentas
- Corrigida a aba existente `Ferramentas` em `AdminTabs`, sem excluir a funcionalidade porque ela tem utilidade administrativa para seed leve e backfill multiempresa.
- A aba `ferramentas` agora entra na lista de abas validas para usuario admin; antes o resolvedor de aba ativa ignorava esse valor e voltava para a primeira aba visivel.
- Container principal de ferramentas recebeu `w-full`, `h-full`, `data-permission` e `data-context-required`.
- Mantida a Regra-Mae: nenhuma tela, modulo, componente ou arquivo novo foi criado; apenas corrigida a aba existente e preservadas as operacoes administrativas.
- Tentativa de verificacao pelo navegador embutido falhou por instabilidade do runtime local; validacao sera feita por build Vite e checagens de diff.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.

### Atendimento/Chatbot - Fase 8 Pedidos, Entregas e Boletos no Chat
- Seguido o plano de melhoria nos componentes existentes `CriarPedidoChat`, `ConsultarEntregaChat` e revisao de `GerarBoletoChat`, sem criar tela, modulo, componente ou arquivo novo.
- `ConsultarEntregaChat` deixou de consultar `Entrega` diretamente e passou a usar `filterInContext`, com chave por grupo/empresa, RBAC de Expedicao/Atendimento/Comercial e bloqueio visual sem contexto/permissao.
- Links de rastreamento de entrega agora sao validados antes de abrir e a acao recebeu `data-permission`, `data-context-required` e `data-action`.
- `CriarPedidoChat` deixou de buscar cliente/produtos/pedidos globalmente e passou a usar `filterInContext`, `createInContext` e `updateInContext`.
- Criacao de pedido pelo chat agora exige empresa do grupo, permissao Comercial/Atendimento, confirmacao do usuario, carimbo `group_id`/`grupo_id`/`empresa_id` e vinculo contextual na conversa.
- Acoes sensiveis de busca, adicionar/remover produto, alterar quantidade e criar pedido receberam bloqueio sem contexto/RBAC e marcadores `data-permission`, `data-context-required`, `data-action` e `data-sensitive`.
- `GerarBoletoChat` foi revisado e ja permanecia no padrao contextual, com chamada direta apenas para `AuditLog.create` de auditoria.
- Mantida a Regra-Mae: fluxos atuais de pedido, entrega e boleto foram preservados; apenas consultas, gravacoes, bloqueios e seguranca existentes foram reforcados.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em Atendimento/Chatbot no `IntentEngine`, migrando intents dinamicas, consultas de pedidos/entregas/boletos e criacoes automaticas para contexto, RBAC e auditoria.

### Atendimento/Chatbot - Fase 8 Widgets Omnicanal
- Seguido o plano de melhoria nos widgets existentes `ChatbotWidget` e `ChatbotWidgetAvancado`, sem criar tela, modulo, componente ou arquivo novo.
- Configuracao de canal, conversa existente, mensagens e dados do cliente passaram a usar `filterInContext` com chave por grupo/empresa.
- Criacao de conversa, mensagens, interacoes retrocompativeis, notificacoes de transbordo e atualizacoes de conversa passaram a usar `createInContext` e `updateInContext`.
- Transbordo para atendente e avaliacao/CSAT agora respeitam contexto grupo/empresa antes de alterar dados.
- Auditoria dos widgets passou a registrar `group_id`, `empresa_id` e `tipo_auditoria` operacional.
- Acoes sensiveis de envio, sugestoes, anexo e avaliacao receberam bloqueio sem contexto/RBAC e marcadores `data-permission`, `data-context-required` e `data-action`.
- Mantida a Regra-Mae: os widgets e fluxos atuais foram preservados; apenas consultas, gravacoes, bloqueios e auditoria existentes foram reforcados.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em Atendimento/Chatbot nos componentes auxiliares com chamadas diretas restantes, priorizando `IntentEngine`, `GerarBoletoChat`, `CriarPedidoChat` e `ConsultarEntregaChat`.

### Atendimento/Chatbot - Fase 8 Multicanal e Transferencia
- Seguido o plano de melhoria em componentes existentes de Atendimento/Chatbot, sem criar tela, modulo, componente ou arquivo novo.
- `ChatbotMulticanal` deixou de consultar/alterar `ConfiguracaoCanal` e `ConversaOmnicanal` diretamente e passou a usar `filterInContext`, `createInContext` e `updateInContext`.
- Toggles de canais, botao de atualizar e acao de configurar agora respeitam contexto grupo/empresa e RBAC de Integracoes/Atendimento.
- `TransferirConversa` deixou de listar usuarios globalmente e de atualizar conversa/mensagem/notificacao por chamada direta, passando a usar helpers de contexto multiempresa.
- Transferencia de conversa agora bloqueia sem contexto/permissao, carimba `group_id`/`grupo_id`/`empresa_id` e registra auditoria operacional com antes/depois.
- Componentes receberam `w-full`, `h-full`, `data-permission`, `data-context-required` e `data-action` nas acoes sensiveis.
- Mantida a Regra-Mae: fluxos compartilhados de atendimento foram preservados; somente consultas, gravacoes, bloqueios e auditoria existentes foram reforcados.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de proxy Base44, browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em Atendimento/Chatbot nos widgets `ChatbotWidget` e `ChatbotWidgetAvancado`, revisando criacao/atualizacao de conversas, mensagens, intents e notificacoes com contexto, RBAC e auditoria.

### Atendimento/Chatbot - Fase 8 Dashboard, Fila e Exportacoes
- Seguido o plano de melhoria em componentes existentes de Atendimento/Chatbot, sem criar tela, modulo, componente ou arquivo novo.
- `ChatbotDashboard` deixou de listar `ConversaOmnicanal`, `MensagemOmnicanal` e `ChatbotInteracao` globalmente e passou a usar `filterInContext` com chave por grupo/empresa.
- `ChatbotFilaEspera` deixou de buscar conversas aguardando e usuarios de forma global/direta e passou a respeitar contexto grupo/empresa e RBAC de atendimento.
- `ExportarConversas` deixou de exportar conversas por filtro direto de empresa e passou a carregar dados via `filterInContext`, bloquear exportacao sem contexto/RBAC e auditar sucesso ou bloqueio em `AuditLog`.
- Componentes receberam `w-full`, `h-full`, `data-permission`, `data-context-required`, `data-sensitive` nas exportacoes e avisos visuais quando faltar contexto ou permissao.
- Mantida a Regra-Mae: fluxos compartilhados de IA/CRM/Atendimento foram preservados; somente consultas, bloqueios e exportacoes existentes foram reforcados.
- Proximo passo sugerido: continuar Fase 8 em Atendimento/Chatbot nos widgets `ChatbotWidget`, `ChatbotWidgetAvancado`, `ChatbotMulticanal` e `TransferirConversa`, revisando criacao/atualizacao de conversas, mensagens e notificacoes com contexto, RBAC e auditoria.

### Sistema - Fase 8 Atalhos Iniciais e Layout Global
- Seguido pedido do plano de melhoria no layout global existente `src/Layout.jsx`, sem criar tela, modulo, componente ou arquivo novo.
- Removidos do inicio/cabecalho do sistema os atalhos visuais `IA Estoque`, `IA Financeiro` e `Funil/KPIs`.
- Removidas as funcoes locais `handleIAEstoque` e `handleIAFinanceiro`, que eram usadas exclusivamente pelos botoes removidos no cabecalho.
- Verificado que `Funil/KPIs` apontava para o modulo compartilhado `Comercial`; o modulo e seus componentes foram preservados para nao quebrar pedidos, clientes, aprovacoes, funil e demais fluxos existentes.
- Verificado que a funcao `iaFinanceAnomalyScan` ainda e usada no Dashboard e em fluxos de pedido; por isso os diretorios/servicos compartilhados de IA foram preservados.
- Mantida a Regra-Mae: melhoria feita no existente, sem apagar fluxo essencial, sem duplicar modulo e sem danificar o sistema.
- Proximo passo sugerido: validar build, abrir o sistema em `http://127.0.0.1:5173/` e continuar o plano no `useFluxoPedido` conforme o ponto anterior salvo.

### Comercial - Fase 8 Faturamento, OP e Cancelamento em Contexto
- Segui o proximo passo salvo no hook central `useFluxoPedido`: migrar `faturarPedidoCompleto`, `concluirOPCompleto`, `cancelarPedidoCompleto` e auxiliares de faturamento/cancelamento.
- Faturamento completo agora normaliza contexto multiempresa antes de baixar estoque, criar entrega e atualizar pedido faturado.
- Baixas de estoque do faturamento, consumo de material da OP e liberacao de reserva no cancelamento passaram a usar `filterScoped`, `createScoped` e `updateScoped`.
- Conclusao de OP agora atualiza `OrdemProducao` e pedido vinculado com auditoria completa, dados antes/depois, `group_id` e `empresa_id`.
- Cancelamento de pedido agora busca reservas/contas por contexto, cancela contas a receber com auditoria e libera limite de credito usando o mesmo contexto do pedido.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas melhoria no hook central existente.
- Proximo passo sugerido: continuar no mesmo `useFluxoPedido`, revisando chamadas restantes do fechamento automatico e corrigindo textos/comentarios com codificacao quebrada sem alterar comportamento.

### Comercial - Fase 8 Aprovacao do Pedido em Contexto
- Segui o proximo passo salvo no hook central `useFluxoPedido`: migrar fluxos restantes com chamadas diretas, priorizando aprovacao completa do pedido.
- `aprovarPedidoCompleto` agora normaliza contexto multiempresa antes de validar credito, baixar estoque, gerar OP, gerar contas a receber, atualizar limite de credito, atualizar pedido e registrar historico do cliente.
- Validacao de credito, baixa de estoque da aprovacao, geracao de OP, geracao de conta a receber e atualizacao de limite do cliente passaram a usar `filterScoped`, `createScoped` e `updateScoped`.
- Auditorias do fluxo de aprovacao agora carregam `group_id`, `empresa_id` e dados antes/depois quando ha atualizacao.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas melhoria no hook central existente.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar no mesmo `useFluxoPedido`, migrando `faturarPedidoCompleto`, `concluirOPCompleto`, `cancelarPedidoCompleto` e auxiliares de faturamento/cancelamento que ainda possuem chamadas diretas para `Entrega`, `Pedido`, `Produto`, `MovimentacaoEstoque` e `ContaReceber`.

### Comercial - Fase 8 Hook Central de Fechamento
- Segui o proximo passo salvo: revisar o hook central `useFluxoPedido`, priorizando `executarFechamentoCompleto`, `validarEstoqueCompleto` e `obterEstatisticasAutomacao`.
- O fechamento completo passou a normalizar contexto de operacao com `group_id` e `empresa_id`, usando fallback do contexto salvo no navegador quando chamado por widgets.
- Criacao de `ContaReceber`, criacao de `Entrega` e atualizacao de `Pedido` dentro do fechamento automatico passaram por helpers internos de contexto, sem criar tela, modulo ou arquivo novo.
- Auditoria do fechamento agora registra `group_id`, `empresa_id`, dados antes/depois do pedido e dados novos de financeiro/logistica.
- Validacao de estoque e estatisticas de automacao passaram a consultar pedidos/produtos por contexto em vez de listar globalmente.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Mantida a Regra-Mae: apenas melhoria no hook existente, preservando o fluxo atual de fechamento.
- Proximo passo sugerido: continuar no mesmo `useFluxoPedido`, migrando os fluxos restantes de aprovar/faturar/concluir/cancelar pedido que ainda possuem chamadas diretas para `Pedido`, `ContaReceber`, `Entrega` e `Produto`.


### Comercial - Fase 8 Sugestões e Itens de Produto
- Segui o próximo passo salvo do plano em Comercial: `SugestoesProdutos`, `TabelaPrecoItensModal` e `AdicionarItemRevendaModal`.
- `SugestoesProdutos` deixou de consultar pedidos/produtos globalmente e passou a usar `filterInContext` com `groupId`/`empresaId` na chave da query, alerta de contexto/permissão e botão protegido por RBAC.
- `TabelaPrecoItensModal` passou a listar itens/produtos por contexto, criar/editar/excluir via `createInContext`/`updateInContext`/`deleteInContext`, mantendo confirmação da Regra-Mãe antes de remover item.
- `AdicionarItemRevendaModal` passou a carregar produtos de revenda por contexto, bloquear busca/seleção/adição sem permissão e preservar o fluxo atual de cálculo de margem, estoque e aprovação.
- Todos os pontos alterados receberam marcadores `data-context-required`, `data-permission`, `data-action` e `data-sensitive` onde a ação altera dado.
- Próximo passo: revisar `Top10ProdutosCliente` e os demais componentes auxiliares do pedido comercial que ainda possam usar consultas globais de produto/cliente.


### Comercial - Fase 8 Top 10 Produtos do Cliente
- Segui o proximo passo salvo: revisar `Top10ProdutosCliente`, que ainda usava `Pedido.filter` e `Produto.list` globais.
- Historico de pedidos e produtos disponiveis passaram a usar `filterInContext` com chave por `groupId`, `empresaId` e contexto visual.
- Sugestoes com IA agora exigem contexto de grupo/empresa e permissao comercial antes de enviar historico/produtos ao LLM.
- Selecionar produto sugerido e buscar sugestoes de IA receberam bloqueio visual por RBAC e marcadores `data-permission`, `data-action`, `data-sensitive` e `data-context-required`.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas melhoria no componente existente.
- Proximo passo: continuar a varredura nos auxiliares comerciais com consultas diretas, priorizando `AnalisePedidoAprovacao`, `DetalhesCliente`, `HistoricoProdutosCliente` e aprovadores de pedido.

### Comercial - Fase 8 Analise e Detalhes de Cliente
- Segui o proximo passo salvo: revisar `AnalisePedidoAprovacao` e `DetalhesCliente`, que ainda buscavam `Produto`/`Pedido` direto pelo `base44`.
- `AnalisePedidoAprovacao` passou a consultar produtos via `filterInContext`, com chave por pedido, grupo, empresa e contexto visual.
- Ajustes de desconto, fechamento automatico, aprovar e negar agora ficam bloqueados sem contexto/permissao e receberam marcadores `data-permission`, `data-action`, `data-sensitive` e `data-context-required`.
- `DetalhesCliente` passou a buscar pedidos do cliente por `filterInContext`, com alerta quando faltar contexto ou permissao.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas melhoria nos componentes existentes.
- Proximo passo: continuar nos historicos comerciais (`HistoricoProdutosCliente`, `HistoricoComprasCliente`, `HistoricoOrigemCliente`) e aprovadores de pedido restantes.

### Comercial - Fase 8 Historicos do Cliente
- Segui o proximo passo salvo: revisar `HistoricoProdutosCliente`, `HistoricoComprasCliente` e `HistoricoOrigemCliente`.
- Os tres historicos deixaram de consultar `Pedido` diretamente pelo `base44` e passaram a usar `filterInContext`, com chave por cliente, grupo, empresa e contexto visual.
- Os historicos agora exigem contexto de grupo/empresa e permissao RBAC para visualizar pedidos/clientes antes de carregar dados.
- O botao existente de adicionar produto pelo historico de compras passou a respeitar permissao comercial de criacao/edicao de pedido e recebeu `data-permission`/`data-action`.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas melhoria nos componentes existentes.
- Proximo passo: continuar nos aprovadores comerciais restantes (`AprovacaoDescontos`, `AprovacaoDescontosManager`, `CentralAprovacoesManager`) e fluxos de fechamento que ainda usam chamadas diretas.

### Comercial - Fase 8 Central de Aprovacoes em Contexto
- Segui o proximo passo salvo: revisar `CentralAprovacoesManager`, componente atual recomendado para aprovacoes comerciais.
- A central deixou de listar, buscar e atualizar `Pedido` diretamente pelo `base44` e passou a usar `filterInContext`/`updateInContext`.
- Consultas agora dependem de contexto grupo/empresa e permissao RBAC para visualizar/aprovar pedidos.
- Aprovacao, negacao e aprovacao com fechamento automatico agora bloqueiam sem contexto/permissao antes de alterar pedido.
- Botoes sensiveis receberam `data-permission`, `data-action`, `data-sensitive` e o wrapper recebeu `data-context-required`.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas melhoria no componente existente.
- Proximo passo: continuar nos componentes legacy `AprovacaoDescontosManager` e `AprovacaoDescontos`, preservando compatibilidade sem duplicar fluxo.

### Comercial - Fase 8 Aprovadores Legacy em Contexto
- Segui o proximo passo salvo: revisar `AprovacaoDescontosManager` e `AprovacaoDescontos`, mantendo compatibilidade sem criar fluxo novo.
- Os componentes legacy deixaram de listar e atualizar `Pedido` diretamente pelo `base44` e passaram a usar `filterInContext`/`updateInContext`.
- As consultas agora dependem de contexto grupo/empresa e permissao RBAC para visualizar/aprovar pedidos.
- Aprovacoes, aprovacoes parciais e negacoes bloqueiam sem contexto/permissao antes de alterar pedido.
- Botoes sensiveis receberam `data-permission`, `data-action`, `data-sensitive` e os wrappers receberam `data-context-required`.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas melhoria nos componentes existentes.
- Proximo passo: continuar nos fluxos de fechamento comercial que ainda usam chamadas diretas ou sem marcadores RBAC/contexto.

### Comercial - Fase 8 Fechamento Automatico em Contexto
- Segui o proximo passo salvo: revisar fluxos de fechamento comercial, priorizando `AutomacaoFluxoPedido`.
- O fechamento automatico deixou de executar atualizacoes/criacoes diretas em `Pedido`, `Produto`, `MovimentacaoEstoque`, `ContaReceber` e `Entrega` dentro do componente e passou a usar helpers de contexto.
- A acao de executar fluxo completo agora exige contexto grupo/empresa e permissao RBAC granular para marcar pedido pronto para faturar/aprovar/editar.
- O wrapper e o botao principal receberam `data-context-required`, `data-permission`, `data-action` e `data-sensitive`.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas melhoria no componente existente.
- Proximo passo: revisar o hook central `useFluxoPedido` e dashboards/widgets de fechamento que ainda usam chamadas diretas globais.

# Status do Projeto ERP Zuccaro

### Comercial - Fase 8 Seletores de Produto

- Seguido o próximo passo salvo no status: revisar seletores comerciais de produto que ainda usavam `Produto.list()` global.
- `SelecionarProdutoModal` e `SelecionarProdutoForm` deixaram de usar `base44.entities.Produto.list()` e passaram a buscar produtos via `filterInContext`.
- Consultas receberam query keys por grupo/empresa/contexto, limite de carregamento e `enabled` condicionado a contexto e permissão RBAC.
- Busca e botão de adicionar produto agora ficam bloqueados quando faltar contexto de grupo/empresa ou permissão para selecionar produtos no fluxo comercial.
- Os wrappers receberam `w-full`, `h-full`, `data-permission` e `data-context-required`, mantendo responsividade sem criar tela nova.
- Textos visíveis dos seletores foram ajustados para português correto com acentuação preservada.
- Mantida a Regra-Mãe: nenhuma tela, módulo, arquivo ou fluxo novo foi criado; apenas melhoria nos componentes existentes.
- Próximo passo sugerido: continuar seletores comerciais restantes, priorizando `SugestoesProdutos`, `TabelaPrecoItensModal` e `AdicionarItemRevendaModal`.
### Cadastros - Fase 8 Multi-Tabelas de Preço

- Seguido o próximo passo salvo no status: revisar `MultiTabelasEditor`, que ainda buscava produtos globalmente e atualizava itens de tabela diretamente.
- `MultiTabelasEditor` deixou de usar `base44.entities.Produto.list()` e passou a buscar produtos via `filterInContext`.
- Itens de tabela de preço passaram a ser carregados com `filterInContext` e atualizados com `updateInContext`, mantendo contexto grupo/empresa.
- Recalculo multi-tabela agora exige contexto de grupo/empresa, permissão RBAC de edição e confirmação do usuário antes de alterar preços em massa.
- Fluxos de bloqueio, cancelamento, erro, sucesso e sugestão por IA passaram a gerar auditoria com `group_id`, `empresa_id` e resumo antes/depois.
- Controles sensíveis receberam bloqueio visual e marcadores `data-action`, `data-permission`, `data-sensitive` e `data-context-required`.
- Mantida a Regra-Mãe: nenhuma tela, módulo, arquivo ou fluxo novo foi criado; apenas melhoria no componente existente.
- Próximo passo sugerido: continuar seletores comerciais de produto que ainda usam `Produto.list/filter`, priorizando `SelecionarProdutoModal`, `SelecionarProdutoForm`, `SugestoesProdutos` e `TabelaPrecoItensModal`.
### Cadastros - Fase 8 Dashboard Estruturantes

- Seguido o próximo passo salvo no status: revisar `DashboardEstruturantes`, que ainda listava cadastros estruturantes e produtos globalmente.
- `DashboardEstruturantes` deixou de usar `.list()` global em `SetorAtividade`, `GrupoProduto`, `Marca`, `LocalEstoque`, `TabelaFiscal` e `Produto`.
- Consultas passaram a usar `filterInContext`, com query keys por grupo/empresa e execução condicionada a contexto e permissão RBAC.
- O wrapper principal recebeu `w-full`, `h-full`, `data-permission` e `data-context-required`.
- A tela exibe alerta visual quando faltar contexto de grupo/empresa ou permissão para visualizar cadastros.
- Mantida a Regra-Mãe: nenhuma tela, módulo, arquivo ou fluxo novo foi criado; apenas melhoria no componente existente.
- Próximo passo sugerido: continuar varredura em `MultiTabelasEditor` e seletores comerciais de produto que ainda usam `Produto.list/filter` global.
### Cadastros - Fase 8 Dashboard Produtos Produção

- Seguido o próximo passo salvo no status: continuar varredura em dashboards e seletores de produto que ainda usam `Produto.list/filter` global.
- `DashboardProdutosProducao` deixou de usar `base44.entities.Produto.list` e passou a consultar produtos via `filterInContext` com filtro de matéria-prima de produção.
- Consulta de ordens de produção do dashboard também passou para `filterInContext`, mantendo o cruzamento de uso por produto dentro do contexto grupo/empresa.
- Dashboard agora exige contexto de grupo/empresa e permissão RBAC para visualizar produto antes de carregar dados.
- Botão de conversão de produtos recebeu bloqueio visual por contexto/permissão e marcadores `data-permission`, `data-action` e `data-sensitive`.
- Mantida a Regra-Mãe: nenhuma tela, módulo, arquivo ou fluxo novo foi criado; apenas melhoria no componente existente.
- Próximo passo sugerido: continuar varredura nos seletores e dashboards restantes que ainda usam `Produto.list/filter`, priorizando `DashboardEstruturantes`, `MultiTabelasEditor` e seletores comerciais de produto.

### Cadastros - Fase 8 Conversão Produção em Massa

- Seguido o próximo ponto salvo no status: continuar varredura em Cadastro Gerais/Estoque por chamadas diretas de `Produto.create/update/delete/filter/list`.
- `ConversaoProducaoMassa` deixou de usar `base44.entities.Produto.update` diretamente e passou a usar `updateInContext`.
- Conversão em massa agora exige contexto de grupo/empresa e permissão RBAC para editar produtos antes de IA, seleção e gravação.
- A conversão em lote passou a pedir confirmação explícita antes de alterar produtos e registra auditoria de bloqueio, negação, cancelamento, erro e sucesso.
- Payload de atualização preserva `empresa_id`, `group_id` e `grupo_id` do produto/contexto para manter a ramificação multiempresa.
- Botões e checkboxes sensíveis receberam bloqueio visual e marcadores `data-permission`, `data-action` e `data-sensitive` quando aplicável.
- Mantida a Regra-Mãe: nenhuma tela, módulo, arquivo ou fluxo novo foi criado; apenas melhoria no componente existente.
- Próximo passo sugerido: continuar varredura em Cadastro Gerais/Estoque por chamadas diretas restantes de `Produto.create/update/delete/filter/list`, priorizando dashboards e seletores de produto que ainda usam `Produto.list/filter` global.

### Cadastros - Fase 8 Importação Produto NF-e/PDF

- Seguido o próximo ponto salvo no status: revisar `ImportacaoProdutoNFe`, que ainda filtrava e criava produto diretamente pelo `base44.entities.Produto`.
- Verificação de duplicidade passou a usar `filterInContext`, respeitando contexto de grupo/empresa.
- Importação de produtos passou a usar `createInContext`, com `group_id`, `grupo_id` e `empresa_id` no payload.
- Processamento e importação agora exigem contexto de grupo/empresa e permissão RBAC para criar produto.
- Dados extraídos da NF-e/PDF passam por sanitização simples, limite de tamanho e conversão numérica antes da gravação.
- Importação em massa passou a pedir confirmação do usuário e gerar auditoria de bloqueio, cancelamento, erro e sucesso.
- Botões sensíveis receberam alerta de contexto/permissão e marcadores `data-permission`, `data-action` e `data-sensitive`.
- Mantida a Regra-Mãe: nenhuma tela, módulo, arquivo ou fluxo novo foi criado; apenas melhoria no componente existente.
- Próximo passo sugerido: continuar varredura em Cadastro Gerais/Estoque por chamadas diretas de `Produto.create/update/delete/filter/list` e corrigir no fluxo existente.


### Cadastros - Fase 8 Importar Produtos NF-e XML

- Seguido o próximo ponto salvo no status: revisar `ImportarProdutosNFe`, que ainda criava produtos diretamente no `base44.entities.Produto.create`.
- Consulta de duplicidade de produtos passou a usar `filterInContext`, respeitando grupo/empresa selecionados.
- Criação de produtos a partir do XML passou a usar `createInContext`, com `group_id`, `grupo_id` e `empresa_id` no payload.
- Upload e criação agora exigem contexto de grupo/empresa e permissão RBAC para criar produto.
- Campos extraídos da NF-e passam por sanitização simples, limite de tamanho e conversão numérica antes da gravação.
- Criação em massa passou a pedir confirmação do usuário e gerar auditoria de bloqueio, cancelamento, erro e sucesso.
- A ação sensível recebeu alerta visual quando faltar contexto/permissão e marcadores `data-permission`, `data-action` e `data-sensitive`.
- Mantida a Regra-Mãe: nenhuma tela, módulo, arquivo ou fluxo novo foi criado; apenas melhoria no componente existente.
- Próximo passo sugerido: revisar `ImportacaoProdutoNFe`, que ainda tem criação direta de produto por NF-e/PDF.

### Cadastros - Fase 8 Importar Produtos em Lote

- Seguido o próximo ponto do plano: continuar nos importadores de produtos de Cadastro Gerais, priorizando `ImportarProdutosLote`.
- Criação de produto em lote deixou de usar `base44.entities.Produto.create` diretamente e passou a usar `createInContext`.
- Importação agora exige contexto de grupo/empresa e permissão RBAC de criação de produto antes de enviar arquivo ou criar registros.
- Campos importados passam por sanitização simples, limite de tamanho e conversão numérica padronizada antes da gravação.
- Criação em massa passou a pedir confirmação do usuário com a quantidade de produtos e gera auditoria de bloqueio, cancelamento, erro e sucesso.
- Produtos importados recebem `group_id`, `grupo_id` e `empresa_id` conforme o contexto selecionado.
- O importador recebeu alerta visual de contexto/permissão e marcadores `data-permission`, `data-action` e `data-sensitive` na ação sensível.
- Mantida a Regra-Mãe: nenhuma tela, módulo, arquivo ou fluxo novo foi criado; apenas melhoria no componente existente.
- Próximo passo sugerido: revisar `ImportarProdutosNFe` ou `ImportacaoProdutoNFe`, que ainda criam produto diretamente em Cadastro Gerais.


### Cadastros/Estoque - Fase 8 Historico do Produto em Contexto

- Seguido o proximo ponto do plano: revisar atualizacoes diretas de produto em Cadastro Gerais, priorizando `HistoricoProduto`.
- Consultas de movimentacoes, pedidos e ordens de producao deixaram de listar dados globalmente e passaram a usar `filterInContext`.
- Conversao de produto para materia-prima de producao deixou de usar `base44.entities.Produto.update` direto e passou a usar `updateInContext`.
- A conversao agora exige contexto de grupo/empresa, permissao RBAC de edicao de produto e confirmacao do usuario antes de alterar o cadastro.
- Bloqueios, cancelamento, erro e sucesso da conversao geram auditoria com `group_id`, `grupo_id`, `empresa_id`, antes/depois e id do produto.
- O botao sensivel passou a ser desabilitado sem contexto/permissao e recebeu marcadores `data-permission`, `data-action` e `data-sensitive`.
- Mantida a Regra-Mae: nenhuma tela, modulo, arquivo ou fluxo novo foi criado; apenas melhoria no componente existente.
- Proximo passo sugerido: continuar nos importadores de produtos de Cadastro Gerais que ainda criam produto diretamente.

### Cadastros - Fase 8 Intents do Chatbot em Contexto

- Seguido o proximo ponto do plano em Cadastro Gerais: revisar `ChatbotIntentsForm`, que ainda gravava `ChatbotIntent` diretamente pelo `base44`.
- O adapter antigo foi mantido, mas criacao, edicao e migracao de intents passaram a usar `createInContext`, `updateInContext` e `filterInContext`.
- Salvamento agora valida contexto de grupo/empresa e permissao RBAC antes de persistir a intent.
- Dados textuais da intent passam por sanitizacao simples e limite de tamanho antes da gravacao.
- Desativacao de intent ativa passou a pedir confirmacao, pois pode afetar atendimentos automaticos.
- Bloqueios, cancelamento de desativacao, erros e sucesso passaram a gerar auditoria com `group_id`, `grupo_id`, `empresa_id`, antes/depois e nome da intent.
- Mantida a Regra-Mae: nenhuma tela, modulo, arquivo ou fluxo novo foi criado; apenas melhoria no componente existente.
- Proximo passo sugerido: continuar nos importadores de produtos de Cadastro Gerais ou em atualizacoes diretas de produto ainda existentes.

### Estoque - Fase 8 Contagem de Inventario

- Seguido o proximo passo salvo no status: revisar `InventarioContagem` dentro do fluxo existente de inventario, sem criar tela, modulo ou arquivo novo.
- Corrigido o calculo de ajuste para usar o item ja atualizado, evitando diferenca atrasada ao alterar saldo do sistema ou contagem fisica.
- Campos de texto da contagem passaram por sanitizacao simples contra caracteres de tag e limite de tamanho antes de atualizar o estado local.
- Remocao de item da contagem agora pede confirmacao do usuario, respeitando a Regra-Mae antes de retirar informacao do inventario.
- Botoes da contagem receberam `type="button"` para evitar submissao acidental do formulario principal.
- A grade recebeu `w-full`, `h-full`, rolagem horizontal controlada, estado vazio e marcador `data-permission` para facilitar RBAC visual.
- Mantida a integracao com `InventarioForm`: a persistencia e a auditoria completa continuam no salvamento/aprovacao do inventario.
- Proximo passo sugerido: continuar em outros pontos de estoque/cadastros que ainda alterem dados sensiveis sem contexto, confirmacao ou auditoria completa.

### Estoque - Fase 8 Inventario em Contexto

- Seguido o proximo passo salvo no status: continuar em `InventarioForm`, reforcando cadastro/aprovacao de inventario sem criar tela, modulo ou arquivo novo.
- Criacao e edicao de inventario deixaram de usar `base44.entities.Inventario.create/update` diretamente e passaram a usar `createInContext` e `updateInContext`.
- Salvamento agora exige contexto de grupo/empresa e permissao RBAC antes de persistir qualquer contagem.
- Aprovacao agora valida contexto, permissao granular e existencia de inventario salvo antes de aplicar o status sensivel.
- Status sensiveis como aprovado/concluido/cancelado passaram a pedir confirmacao do usuario antes da alteracao.
- Bloqueios, cancelamentos, erros, criacao e edicao geram auditoria com `group_id`, `grupo_id`, `empresa_id`, antes/depois, status e total de itens.
- A tela recebeu marcadores `data-permission`, `data-context-required`, `data-context-mode` e alerta visual quando faltar contexto/permissao.
- Mantida a Regra-Mae: apenas melhoria no componente existente, sem duplicar fluxo e sem excluir funcionalidade.
- Proximo passo sugerido: revisar `InventarioContagem` e outros pontos de estoque/cadastros que ainda alterem dados sensiveis sem contexto, confirmacao ou auditoria completa.

### Interface - Remocao Autorizada de Documentacao e Modo Escuro

- Alteracao feita com autorizacao explicita do usuario para excluir a entrada `Documentacao` da barra lateral esquerda e todo o conteudo diretamente associado a ela.
- Removidos a rota/importacao `Documentacao`, a pagina `src/pages/Documentacao.jsx` e a pasta `src/components/docs`.
- `PageNotFound` deixou de reconhecer `Documentacao` como pagina valida para redirecionamento.
- Removido o recurso de `Modo Escuro` do `Layout`: estado, atalho `Ctrl+M`, injecao de estilos e botao do rodape da barra lateral.
- Removida a opcao `Escuro` das preferencias de aparencia do usuario e removido `Ctrl+M` do painel de atalhos.
- Mantida a Regra-Mae: a exclusao foi feita somente porque o usuario autorizou explicitamente nesta conversa; nenhum outro modulo operacional foi removido.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar o plano de melhoria em `InventarioForm` ou revisar outros pontos de Cadastro Gerais com duplicidade/fluxo sensivel.

### Estoque/Cadastros - Fase 8 Importador de Produtos em Contexto

- Seguido o proximo passo salvo no status: continuar no proprio `ImportadorProdutosPlanilha`, substituindo operacoes diretas de `Produto`, `UnidadeMedida`, `GrupoProduto` e `SetorAtividade` por helpers de contexto.
- Listagens de `GrupoProduto`, `SetorAtividade`, `UnidadeMedida` e verificacoes de `Produto` passaram a usar `filterInContext`.
- Criacoes de `UnidadeMedida`, `GrupoProduto`, `SetorAtividade` e `Produto` passaram a usar `createInContext`.
- Atualizacoes e substituicoes de `Produto` passaram a usar `updateInContext` e `deleteInContext`, preservando `empresa_id` e `group_id` do item importado.
- Mantidos os fluxos existentes de preview, duplicidade, atualizar, pular e substituir; nenhuma tela, modulo, funcionalidade ou arquivo novo foi criado.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: seguir para `InventarioForm` ou revisar outros importadores de Cadastro Gerais que ainda tenham chamadas diretas e fluxo sensivel.

### Estoque/Cadastros - Fase 8 Importador de Produtos

- Seguido o proximo passo salvo no status: continuar Fase 8 em `ImportadorProdutosPlanilha`, priorizando importacoes/atualizacoes/exclusoes de produto com fluxo sensivel e perguntas obrigatorias antes de excluir/substituir.
- `ImportadorProdutosPlanilha` agora valida permissao RBAC antes de processar e importar planilha de produtos.
- Importacao passou a exigir confirmacao explicita com resumo de arquivo, destino, produtos alvo, duplicados a atualizar, duplicados a substituir/excluir e recriar, e duplicados a pular.
- Cancelamento, bloqueio, sucesso e erro da importacao agora geram auditoria com `group_id`, `grupo_id`, `empresa_id`, contexto, arquivo e contagens.
- Tela recebeu `w-full`, `h-full`, `data-permission`, `data-context-required`, `data-context-mode`, alerta visual e botoes/campo de arquivo desabilitados sem contexto/permissao.
- Mantida a Regra-Mae: nenhum modulo, tela, componente ou arquivo novo foi criado; apenas melhoria no componente existente.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar no proprio `ImportadorProdutosPlanilha`, substituindo operacoes diretas de `Produto`, `UnidadeMedida`, `GrupoProduto` e `SetorAtividade` por helpers de contexto, ou seguir para `InventarioForm`.

### Compras/Estoque - Fase 8 Ordens de Compra

- Seguido o proximo passo salvo no status: continuar em `OrdensCompraTab`, reforcando recebimento de OC, atualizacao de produto e auditorias minimas ainda restantes.
- `OrdensCompraTab` passou a validar contexto grupo/empresa e RBAC granular antes de criar, aprovar, enviar, receber e avaliar ordem de compra.
- Recebimento de OC deixou de buscar e atualizar `Produto` diretamente pelo `base44.entities.Produto.filter/update` e passou a usar `filterInContext` e `updateInContext`.
- Aprovacao, envio ao fornecedor e recebimento passaram a pedir confirmacao do usuario antes de alterar status ou movimentar estoque.
- Auditorias antigas minimas foram substituidas por auditoria com acao especifica, usuario, group_id, grupo_id, empresa_id, dados da OC e registro de bloqueio/cancelamento/sucesso.
- Avaliacao de fornecedor deixou de atualizar a OC diretamente e passou a usar `updateInContext`.
- A tela recebeu `w-full`, `h-full`, `data-permission`, `data-context-required` e alerta visual quando faltar contexto.
- Mantida a Regra-Mae: nenhum modulo, tela, componente ou arquivo novo foi criado; apenas melhoria no componente existente.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `ImportadorProdutosPlanilha` ou `InventarioForm`, priorizando importacoes/atualizacoes/exclusoes de produto com fluxo sensivel e perguntas obrigatorias antes de excluir/substituir.
### Fiscal/Compras/Estoque - Fase 8 Importar XML NF-e

- Seguido o proximo passo salvo no status: continuar Fase 8 procurando criacoes diretas restantes em compras/fiscal/estoque, priorizando `ImportarXMLNFe`, `OrdensCompraTab` e recebimentos/movimentacoes com auditoria minima.
- `ImportarXMLNFe` deixou de listar produtos e fornecedores globalmente e passou a usar `filterInContext` por grupo/empresa.
- Criacao de fornecedor, produto, ordem de compra, movimentacao de estoque, conta a pagar e registro de importacao XML passou a usar `createInContext`.
- Atualizacao de produto no recebimento por XML deixou de usar update direto e passou a usar `updateInContext`.
- Importacao XML agora exige contexto grupo/empresa e permissao RBAC de Fiscal/ImportarXMLNFe, Fiscal/Notas Fiscais, Compras/ImportacaoNFe ou Estoque/Movimentacoes.
- Confirmacao da importacao passou a pedir confirmacao do usuario antes de executar impactos em compras, estoque e financeiro, com auditoria de sucesso, bloqueio e cancelamento.
- A tela recebeu `w-full`, `h-full`, `data-permission`, `data-context-required`, alerta visual e controles desabilitados quando faltar contexto ou permissao.
- Mantida a Regra-Mae: nenhum modulo, tela, componente ou arquivo novo foi criado; apenas melhoria no componente existente.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `OrdensCompraTab`, reforcando recebimento de OC, atualizacao de produto e auditorias minimas ainda restantes.
### Compras/Estoque - Fase 8 Importacao NF-e Recebimento

- Seguido o proximo passo salvo no status: continuar em `ImportacaoNFeRecebimento`, substituindo importacao/movimentacoes/atualizacao de produto diretas por contexto, confirmacao e auditoria completa.
- `ImportacaoNFeRecebimento` deixou de criar `ImportacaoXMLNFe` e `MovimentacaoEstoque` diretamente pelo `base44.entities.*.create` e passou a usar `createInContext`.
- Atualizacao de estoque do produto deixou de usar `Produto.filter/update` global e passou a usar `filterInContext` e `updateInContext`.
- Processamento e confirmacao de recebimento agora exigem contexto grupo/empresa e permissao RBAC em Compras/ImportacaoNFe, Compras/Recebimento ou Estoque/Movimentacoes.
- Confirmacao de recebimento passou a pedir confirmacao do usuario antes de atualizar estoque, com auditoria de sucesso, bloqueio e cancelamento.
- A tela recebeu `w-full`, `h-full`, `data-permission`, `data-context-required`, alerta visual quando faltar contexto/permissao e botoes/campo de arquivo desabilitados quando a acao nao for permitida.
- Textos visiveis quebrados por codificacao no fluxo de NF-e foram limpos dentro do componente alterado.
- Mantida a Regra-Mae: nenhum modulo, tela, componente ou arquivo novo foi criado; apenas melhoria no componente existente.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 procurando criacoes diretas restantes em compras/fiscal/estoque, priorizando `ImportarXMLNFe`, `OrdensCompraTab` e recebimentos/movimentacoes que ainda tenham auditoria minima.
### Estoque - Fase 8 Transferencia Entre Empresas

- Seguido o proximo passo salvo no status: continuar Fase 8 em `ImportacaoNFeRecebimento` e `TransferenciaEntreEmpresasForm`, priorizando criacoes diretas de estoque/transferencia sem `createInContext` ou auditoria completa.
- `TransferenciaEntreEmpresasForm` deixou de criar transferencia e movimentacoes de estoque diretamente pelo `base44.entities.*.create` e passou a usar `createInContext`.
- Transferencia agora exige contexto grupo/empresa, permissao RBAC de criacao em Estoque/Transferencias, confirmacao do usuario e auditoria de bloqueio, cancelamento e sucesso.
- A tela recebeu `w-full`, `h-full`, `data-permission`, `data-context-required` e botao sensivel desabilitado sem contexto/permissao.
- Mantida a Regra-Mae: nenhum modulo, tela, componente ou arquivo novo foi criado; apenas melhoria no componente existente.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `ImportacaoNFeRecebimento`, substituindo importacao/movimentacoes/atualizacao de produto diretas por contexto, confirmacao e auditoria completa.
### Compras - Fase 8 Cotacoes em Contexto

- Seguido o proximo passo salvo no status: continuar em `CotacoesTab`, substituindo listagens/criacao global por contexto e auditando geracao de ordem de compra a partir de cotacao.
- `CotacoesTab` deixou de listar fornecedores e produtos globalmente e passou a usar `filterInContext` com chave por grupo/empresa.
- Criacao de cotacao agora valida contexto grupo/empresa, permissao RBAC de criacao, carimba `group_id`, `grupo_id` e `empresa_id` e gera auditoria de sucesso ou bloqueio.
- Geracao de ordem de compra a partir de proposta agora usa `createInContext`, exige contexto/permissao, pede confirmacao antes de criar a OC e audita sucesso, bloqueio ou cancelamento.
- A tela recebeu `w-full`, `h-full`, marcadores `data-permission`, `data-context-required`, alerta visual quando faltar contexto/permissao e botoes desabilitados para acoes sensiveis sem permissao.
- Mantida a Regra-Mae: nenhum modulo, tela, componente ou arquivo novo foi criado; apenas melhoria no componente existente.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `ImportacaoNFeRecebimento` e `TransferenciaEntreEmpresasForm`, priorizando criacoes diretas de estoque/transferencia sem `createInContext` ou auditoria completa.
### Compras - Fase 8 Detalhes do Fornecedor

- Seguido o proximo passo do plano: reforcar pontos de estoque/compras com dados sensiveis sem contexto explicito, confirmacao ou auditoria.
- `DetalhesFornecedor` deixou de consultar ordens de compra, NF-e de entrada e contas a pagar diretamente pelo `base44` global e passou a usar `filterInContext` com chave por grupo/empresa.
- Atualizacao de documentos do fornecedor passou a usar `updateInContext` com campo `empresa_dona_id`, preservando carimbo multiempresa e auditoria padrao da camada de contexto.
- Inclusao e remocao de documentos agora exigem contexto grupo/empresa, permissao RBAC de edicao em Compras/Fornecedores e geram auditoria especifica de sucesso, bloqueio ou cancelamento.
- Remocao de documento passou a pedir confirmacao do usuario antes de alterar o cadastro, respeitando a Regra-Mae antes de excluir/retirar qualquer informacao.
- A tela recebeu `w-full`, `h-full`, marcadores `data-permission`, `data-context-required` e alerta visual quando faltar contexto ou permissao.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `CotacoesTab`, substituindo listagens/criacao global por contexto e auditando geracao de ordem de compra a partir de cotacao.
### Estoque - Fase 8 Relatorios com Exportacao Auditada

- Seguido o proximo passo do plano de melhoria dentro do modulo Estoque, mantendo a Regra-Mae e melhorando o componente existente `RelatoriosEstoque`.
- As abas Curva ABC, Giro de Estoque e Itens Parados receberam exportacao CSV/JSON pelo `ExportButton` compartilhado, sem criar tela, modulo ou arquivo novo.
- Exportacoes agora exigem contexto de grupo/empresa, permissao RBAC granular `Estoque.Relatorios.exportar`, confirmacao do usuario e registro em `AuditLog` de sucesso, cancelamento ou bloqueio.
- Dados exportados passam a levar `group_id`, `grupo_id` e `empresa_id`, reforcando multiempresa e rastreabilidade dos relatorios.
- A tela manteve alerta visual quando faltar contexto ou permissao, preservou os fluxos atuais e corrigiu textos/acento no trecho de relatorios do estoque.
- Build validado com sucesso via Vite; permanecem apenas warnings tecnicos preexistentes de browserslist/baseline, CSS, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nos pontos de estoque/compras que ainda salvam ou exportam dados sensiveis sem confirmacao, auditoria ou contexto explicito.
### Dashboard - Fase 8 BI Operacional e Painel 3D

- Seguido o proximo passo salvo no status: procurar relatorios/exportacoes diretas remanescentes em `src/components`, priorizando modulos fiscal, compras, CRM e dashboards legados.
- `DashboardOperacionalBI` deixou de usar fallbacks globais para `Pedido`, `OrdemProducao`, `Entrega`, `ContaReceber`, `Produto` e `Cliente`, passando a usar `filterInContext` com chave por grupo/empresa.
- `PainelOperacoes3D` deixou de listar `OrdemProducao`, `Entrega` e `PosicaoVeiculo` globalmente e passou a respeitar o contexto grupo/empresa.
- `WidgetCanaisOrigem` deixou de consultar `Pedido` diretamente e passou a carregar dados por contexto, mantendo filtro por empresa quando recebido.
- `GamificacaoOperacoes` deixou de listar `Pedido`, `OrdemProducao` e `Entrega` globalmente e passou a usar consultas contextualizadas.
- Os componentes receberam bloqueio por contexto/RBAC, `enabled` seguro nas queries, `w-full`, `h-full`, `data-permission`, `data-context-required` e alerta visual quando faltar grupo/empresa ou permissao.
- Mantida a Regra-Mae: nenhum modulo, tela, componente ou arquivo novo foi criado; apenas melhoria nos componentes existentes.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em CRM/Atendimento e Compras ainda globais, priorizando `AnalyticsAtendimento`, `ChatbotDashboard`, `ChatbotFilaEspera`, `DashboardAtendente`, `ExportarConversas`, `CotacoesTab`, `DetalhesFornecedor` e modulos fiscais restantes.

### Financeiro/Logistica/Producao - Fase 8 Relatorios Restantes

- Seguido o proximo passo salvo no status: revisar `RelatoriosLogistica`, `DashboardLogistico`, `RelatorioFinanceiro`, `RelatoriosProducao` e pontos com exportacao direta sem `ExportMenu` auditado.
- `RelatoriosLogistica`, `DashboardLogistico`, `RelatoriosProducao` e `src/components/relatorios/RelatorioFinanceiro.jsx` foram revisados e ja estavam reforcados com contexto grupo/empresa, RBAC e auditoria; mantidos sem alteracoes nesta rodada.
- `src/components/financeiro/RelatorioFinanceiro.jsx` deixou de consultar `ContaReceber` e `ContaPagar` globalmente e passou a usar `filterInContext` com chave por grupo/empresa.
- O relatorio financeiro analitico antigo passou a validar contexto grupo/empresa, permissao RBAC de visualizacao e filtro local por periodo/cliente sobre dados contextualizados.
- Container principal recebeu `w-full`, `h-full`, `data-permission`, `data-context-required` e alerta visual quando faltar contexto ou permissao.
- Mantida a Regra-Mae: nenhum modulo, tela, componente ou arquivo novo foi criado; apenas melhoria no componente existente.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 procurando relatorios/exportacoes diretas remanescentes em `src/components` com `rg "base44.entities.*.(list|filter)"`, priorizando modulos fiscal, compras, CRM e dashboards legados.

### Gerencial - Fase 8 Central de Relatorios, Atendimento e SPED

- Seguido o proximo passo salvo no status: continuar em `GeradorRelatorios`, `AgendamentoRelatorios`, `RelatoriosAtendimento`, `ExportacaoSPED` e `RelatorioFinanceiroLogistica`.
- `GeradorRelatorios` passou a validar RBAC de visualizacao/exportacao, bloquear exportacoes sem permissao e auditar sucesso ou bloqueio com usuario, grupo e empresa.
- `AgendamentoRelatorios` deixou de salvar configuracao globalmente e passou a usar `filterInContext`, `createInContext` e `updateInContext`, preservando `group_id`, `grupo_id` e `empresa_id`.
- Salvamento de agendamento agora exige contexto grupo/empresa, permissao RBAC de edicao e auditoria de bloqueio quando faltar permissao ou contexto.
- `RelatoriosAtendimento` deixou de consultar conversas por empresa fixa/global e passou a usar `filterInContext`, mantendo filtro por periodo no resultado contextualizado.
- Exportacao CSV de atendimento agora exige contexto grupo/empresa, permissao RBAC e auditoria de sucesso ou bloqueio.
- `ExportacaoSPED` deixou de buscar NF-e e criar SPED de forma direta/global; agora usa `filterInContext` para notas e `createInContext` para o SPED gerado.
- Geracao SPED agora carimba grupo/empresa, exige permissao fiscal, audita bloqueios e registra auditoria fiscal da geracao.
- `RelatorioFinanceiroLogistica` foi revisado nesta rodada e ja estava reforcado com contexto, RBAC e auditoria; mantido sem alteracoes.
- Mantida a Regra-Mae: nenhum modulo, tela, componente ou arquivo novo foi criado; apenas melhoria nos componentes existentes.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em relatorios/logistica/fiscal ainda restantes, priorizando `RelatoriosLogistica`, `DashboardLogistico`, `RelatorioFinanceiro`, `RelatoriosProducao` e pontos com exportacao direta sem `ExportMenu` auditado.

### Gerencial - Fase 8 Origem, Regiao, Canais e Formas

- Seguido o proximo passo salvo no status: continuar em `RelatorioVendasPorRegiao`, `RelatorioPedidosPorOrigem`, `DashboardCanaisOrigem`, `DashboardFormasPagamento` e `RelatoriosEstoque`.
- `RelatorioVendasPorRegiao` deixou de consultar regioes, pedidos, clientes e colaboradores globalmente e passou a usar `filterInContext` por grupo/empresa.
- Exportacao CSV de vendas por regiao agora exige contexto grupo/empresa, permissao RBAC de exportacao e grava auditoria de sucesso ou bloqueio.
- `RelatorioPedidosPorOrigem` passou a consultar pedidos e clientes por contexto, manter filtro por empresa quando recebido por prop e auditar exportacao CSV.
- `DashboardCanaisOrigem` passou a consultar parametros de origem e pedidos por contexto, validar RBAC de visualizacao/exportacao e bloquear exportacao quando faltar permissao ou contexto.
- `ExportButton` compartilhado passou a aceitar `disabled`, `onBeforeExport` e atributos de controle, preservando comportamento existente para telas que nao passam esses parametros.
- `DashboardFormasPagamento` deixou de listar formas de pagamento, pedidos, contas a receber e movimentos de caixa globalmente e passou a usar `filterInContext`.
- `RelatoriosEstoque` corrigiu a filtragem multiempresa usando `grupoAtual`/`empresaAtual`, removeu o uso incorreto de `contexto?.group_id` e passou a calcular giro usando `movimentacoesFiltradas`.
- Relatorios e dashboards receberam marcadores `data-permission`, `data-context-required` e avisos visuais quando faltar contexto grupo/empresa ou permissao.
- Mantida a Regra-Mae: nenhum modulo, tela ou arquivo novo foi criado; apenas melhoria nos componentes existentes e no botao compartilhado ja existente.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `GeradorRelatorios`, `AgendamentoRelatorios`, `RelatoriosAtendimento`, `ExportacaoSPED`, `RelatorioFinanceiroLogistica` e demais relatorios ainda globais.

### Gerencial - Fase 8 Relatorios de Vendas, Estoque e Rentabilidade

- Seguido o proximo passo salvo no status: continuar em `RelatorioVendas`, `RelatorioEstoque`, `RelatorioProducao`, `RentabilidadeProduto` e `RentabilidadeCliente`.
- `RelatorioVendas` passou a validar contexto grupo/empresa, RBAC de visualizacao/exportacao e auditoria de exportacoes CSV ou bloqueios.
- `RelatorioEstoque` passou a validar contexto grupo/empresa, RBAC de visualizacao/exportacao e auditoria de exportacoes de movimentacoes e valor por grupo.
- `RentabilidadeProduto` deixou de listar `Produto` e `Pedido` globalmente e passou a usar `filterInContext`, mantendo filtro por empresa quando recebido por prop.
- `RentabilidadeCliente` deixou de listar `Cliente`, `Pedido` e `ContaReceber` globalmente e passou a usar `filterInContext`, mantendo o filtro por empresa recebido por prop.
- Exportacoes via `ExportMenu` em rentabilidade por produto/cliente foram vinculadas ao modulo/secao corretos para RBAC e auditoria do componente compartilhado.
- Relatorios passaram a exibir alerta visual quando faltar contexto grupo/empresa ou permissao de acesso.
- `RelatorioProducao` foi revisado e ja estava reforcado com contexto, RBAC e auditoria; mantido sem alteracoes nesta rodada.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos componentes existentes.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nos relatorios restantes e dashboards gerenciais por regiao/origem/canais, priorizando `RelatorioVendasPorRegiao`, `RelatorioPedidosPorOrigem`, `DashboardCanaisOrigem`, `DashboardFormasPagamento` e `RelatoriosEstoque`.

### Financeiro - Fase 8 Relatorios DRE, Indicadores e Inadimplencia

- Seguido o proximo passo salvo no status: continuar em `RelatorioFinanceiro`, `RelatorioDRE`, `DREComparativo` e `DashboardInadimplencia`.
- `RelatorioFinanceiro` passou a consultar contas a receber/pagar com chave por grupo/empresa, validar RBAC de visualizacao/exportacao e auditar exportacoes CSV ou bloqueios.
- `RelatorioDRE` passou a consultar pedidos/contas a pagar por contexto grupo/empresa, validar permissao de DRE e auditar exportacoes de DRE resumida, DRE mensal e despesas por categoria.
- `DREComparativo` deixou de buscar dados financeiros globais e passou a usar `filterInContext` para `ContaReceber`, `ContaPagar` e `Pedido`, mantendo filtro por empresa quando recebido por prop.
- `DashboardInadimplencia` deixou de listar contas/clientes globalmente e passou a respeitar `filterInContext`, grupo/empresa e permissao de visualizacao.
- Exportacoes via `ExportMenu` em DRE comparativo e inadimplencia foram vinculadas aos modulos/secoes corretos para RBAC e auditoria ja existentes no componente compartilhado.
- Relatorios passaram a exibir alerta visual quando faltar contexto grupo/empresa ou permissao de acesso.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos componentes existentes.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nos demais relatorios e indicadores financeiros/gerenciais, priorizando `RelatorioVendas`, `RelatorioEstoque`, `RelatorioProducao`, `RentabilidadeProduto` e `RentabilidadeCliente` para contexto grupo/empresa, RBAC, exportacoes auditadas e consistencia de calculos.

### Financeiro - Fase 8 Relatorios e Fluxos Bancarios Auxiliares

- Seguido o proximo passo salvo no status: revisar `FluxoCaixaProjetado`, `ExtratoBancarioResumo`, `MovimentosDiarios` e `CartoesACompensar`.
- `FluxoCaixaProjetado` passou a consultar contas a receber/pagar por `filterInContext`, com chave por grupo/empresa e bloqueio por RBAC de visualizacao/exportacao.
- `ExtratoBancarioResumo` passou a validar contexto grupo/empresa e permissao antes de listar extratos, exibir aviso visual de bloqueio e exportar CSV com auditoria.
- `MovimentosDiarios` passou a filtrar caixa/pedidos por grupo/empresa, validar permissao de visualizacao/impressao e auditar impressao ou bloqueio.
- `CartoesACompensar` deixou de usar listagem/atualizacao global de `MovimentoCartao` e passou a usar `filterInContext`/`updateInContext`.
- Compensacao de cartao agora exige contexto, permissao RBAC, confirmacao explicita e auditoria com dados anteriores/novos, preservando `group_id`, `grupo_id` e `empresa_id`.
- Botoes sensiveis de exportacao, impressao e conciliacao receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- Mantida a Regra-Mae: nenhuma tela, modulo ou funcionalidade foi removida; as melhorias foram feitas nos componentes existentes.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `RelatorioFinanceiro`, `RelatorioDRE`, `DREComparativo`, `DashboardInadimplencia` e demais relatorios financeiros, reforcando contexto grupo/empresa, RBAC, exportacoes auditadas, rateio e consistencia dos indicadores.

Atualizado em: 2026-05-28

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
- `?reset-local=1` agora limpa o banco local e forca a importacao do snapshot real antes da renderizacao inicial.
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

### Producao - Fase 8 Relatorios e Estoque

- Seguido o plano de melhoria nos componentes existentes `RelatorioProducao`, `RelatoriosProducao` e `SeletorProdutosProducao`, sem criar telas, modulos, componentes ou arquivos duplicados.
- `RelatorioProducao` passou a exigir contexto grupo/empresa e permissao de visualizacao antes de consultar ordens e apontamentos.
- Consultas de relatorio de producao agora usam chave por contexto (`grupo` ou `empresa`) e `filterInContext`, mantendo os indicadores dentro do escopo autorizado.
- Exportacoes CSV de producao mensal e top produtos agora exigem permissao granular de exportacao e geram `AuditLog` com usuario, `group_id`, `grupo_id`, `empresa_id`, filtros e quantidade de linhas.
- Tentativas de exportar relatorio de producao sem contexto/RBAC agora sao bloqueadas e auditadas como seguranca.
- `RelatoriosProducao` passou a validar contexto/RBAC antes da exibicao e a filtrar defensivamente a lista recebida por `group_id` e `empresa_id`.
- `SeletorProdutosProducao` deixou de usar listagem global de `Produto` e passou a consultar materia-prima de producao via `filterInContext`, reforcando a integracao com Estoque no escopo correto.
- Selecionar produto para OP agora valida contexto/RBAC e gera auditoria de selecao ou bloqueio com dados do produto e quantidade necessaria.
- Filtros e selecao de produtos de producao receberam marcadores `data-permission`, `data-action`, `data-context-required` e `data-sensitive`.
- Wrappers principais preservam `w-full h-full`, reforcando o layout obrigatorio.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida, nenhuma tela nova foi criada e os fluxos atuais de relatorio/produtos foram preservados.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em fluxos comerciais que enviam itens para Producao (`EnviarProducaoParaItens`, `EditarItemProducaoModal` e botoes do Comercial), revisando propagacao para grupo/empresa, permissoes, auditoria e integracao com OP/Estoque.

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
### Expedicao - Fase 8 Separacao e Conferencia

- Seguido o proximo passo salvo no status: continuar integracao de Producao com Expedicao/Estoque, com foco no fluxo existente `SeparacaoConferencia`.
- Antes de editar, foi verificado que varias leituras do PowerShell mostram acentos quebrados, mas os arquivos em disco estao em UTF-8 correto; nas novas alteracoes foram usadas chaves tecnicas/ASCII para nao introduzir texto corrompido.
- `SeparacaoConferencia` deixou de buscar entregas via `Entrega.list()` global e passou a usar `filterInContext`, mantendo a consulta dentro do contexto grupo/empresa.
- Conclusao de separacao/conferencia agora valida contexto grupo/empresa e RBAC antes da mutation e tambem dentro da mutation.
- Tentativas bloqueadas por falta de contexto ou permissao agora geram `AuditLog` de seguranca com usuario, `group_id`, `grupo_id`, `empresa_id` e motivo.
- Criacao de `SeparacaoConferencia` passou a usar `createInContext`, reforcando `group_id`, `grupo_id` e `empresa_id`.
- Atualizacoes de `Entrega` e `Pedido` apos conferencia sem divergencia passaram a usar `updateInContext`, mantendo contexto e historico de status da entrega.
- Auditoria operacional da conclusao passou a registrar antes/depois, sucesso, usuario e contexto multiempresa.
- Campos de quantidade/observacao e botao de concluir conferencia receberam bloqueio visual por contexto/RBAC e marcadores `data-permission`, `data-action`, `data-context-required` e `data-sensitive`.
- Mantida a Regra-Mae: nenhuma tela, modulo, arquivo ou funcionalidade nova foi criada; apenas reforco do fluxo existente.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `DetalhesEntregaView`, `FormularioEntrega` e `RomaneioForm`, revisando mudancas de status, criacao/edicao de entrega, romaneio e auditoria antes/depois.
### Expedicao - Fase 8 Detalhes da Entrega e Ortografia

- Seguido o proximo passo salvo no status: continuar Fase 8 em `DetalhesEntregaView`, revisando mudancas de status, confirmacao de entrega, RBAC, contexto e auditoria.
- Foi revisada a secao visivel `Expedicao e Logistica` e seus componentes de launchpad; nao foi encontrado mojibake real nos arquivos de Expedição, apenas exibicao quebrada do terminal PowerShell ao ler UTF-8.
- `DetalhesEntregaView` passou a ter handler local para mudanca de status quando a janela for aberta sem `onStatusChange`, corrigindo botoes que podiam nao salvar alteracoes.
- Mudancas de status agora exigem contexto grupo/empresa e permissao de edicao de Entrega antes de atualizar.
- Alteracao para `Entrega Frustrada` agora pede confirmacao antes de salvar a mudanca.
- Status alterado pela tela de detalhes agora atualiza `Entrega` via `updateInContext`, reforcando `group_id`, `grupo_id`, `empresa_id` e historico de status.
- Confirmacao de entrega com assinatura digital agora tambem reforca `group_id`, `grupo_id` e `empresa_id` no payload.
- Mudancas de status, bloqueios e confirmacao com assinatura agora geram `AuditLog` com usuario, contexto multiempresa, antes/depois e sucesso/bloqueio.
- Botoes sensiveis receberam marcadores tecnicos `data-permission`, `data-context-required` e `data-sensitive`.
- Mantida a Regra-Mae: nenhuma tela, modulo, arquivo ou funcionalidade nova foi criada; apenas reforco do fluxo existente.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `FormularioEntrega` e `RomaneioForm`, revisando criacao/edicao de entrega, romaneio, saida para entrega e auditoria antes/depois.
### Expedicao - Fase 8 Romaneio de Entrega

- Seguido o proximo passo salvo no status: continuar Fase 8 em `RomaneioForm`, revisando romaneio, saida para entrega, RBAC, contexto e auditoria antes/depois.
- `RomaneioForm` deixou de buscar entregas via `Entrega.list()` global e passou a usar `filterInContext`, mantendo a lista dentro do contexto grupo/empresa.
- Geracao de romaneio agora exige contexto grupo/empresa e permissao antes de consultar, selecionar e salvar.
- Criacao de `Romaneio` passou a usar `createInContext`, reforcando `group_id`, `grupo_id` e `empresa_id`.
- Atualizacao das entregas para `Saiu para Entrega` passou a usar `updateInContext`, preservando historico de status com usuario e contexto.
- Antes de incluir um romaneio, o sistema agora pede confirmacao explicita, respeitando a Regra-Mae para inclusao de registros.
- Checklist de saida passou a bloquear a geracao enquanto documentos, veiculo, carga e combustivel nao estiverem confirmados.
- Bloqueios por contexto, permissao, checklist incompleto, entrega fora de contexto e cancelamento de confirmacao agora geram `AuditLog`.
- Geracao bem-sucedida do romaneio agora gera `AuditLog` operacional com antes/depois, entregas vinculadas, usuario, `group_id`, `grupo_id` e `empresa_id`.
- Checkboxes de selecao e botao de gerar receberam marcadores `data-permission`, `data-context-required`, `data-action` e `data-sensitive` conforme a acao.
- Foi validado que `RomaneioForm` ficou sem mojibake real apos as alteracoes, evitando novos erros ortograficos na secao Expedicao e Logistica.
- Mantida a Regra-Mae: nenhuma tela, modulo, arquivo ou funcionalidade nova foi criada; apenas reforco do fluxo existente.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `FormularioEntrega`, revisando criacao/edicao de entrega, previsao/geolocalizacao, RBAC, contexto e auditoria antes/depois.

### Expedicao - Fase 8 Formulario de Entrega

- Seguido o proximo passo salvo no status: continuar Fase 8 em `FormularioEntrega`, revisando criacao/edicao de entrega, previsao/geolocalizacao, RBAC, contexto e auditoria antes/depois.
- `FormularioEntrega` passou a usar chaves tecnicas de permissao `Expedicao.Entrega.criar/editar`, evitando dependencia de acento para RBAC.
- Criacao e edicao de entrega agora reforcam `group_id`, `grupo_id` e `empresa_id` antes de chamar `createInContext` e `updateInContext`.
- Antes de criar uma nova entrega, o sistema agora pede confirmacao explicita, respeitando a Regra-Mae para inclusao de registros.
- Bloqueios por falta de contexto, empresa, cliente ou permissao agora geram `AuditLog` de seguranca com usuario, grupo e empresa.
- Calculo de previsao por IA e geolocalizacao agora exigem contexto grupo/empresa e permissao do formulario antes de executar.
- Prompts enviados para IA agora recebem sanitizacao simples dos campos de endereco/frete para reduzir risco de entrada indevida.
- Sucesso e erro em previsao por IA e geolocalizacao agora geram auditoria operacional/seguranca com contexto multiempresa.
- Botoes de previsao, geolocalizacao e salvar receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- `FormWrapper` existente passou a encaminhar atributos extras para o `<form>`, permitindo que os marcadores `data-*` realmente cheguem ao DOM sem criar componente novo.
- Foi validado que `FormularioEntrega`, `FormWrapper` e `STATUS_DO_PROJETO.md` ficaram sem mojibake real apos as alteracoes.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em listagens e relatorios de Expedicao/Logistica, revisando filtros por grupo/empresa, exportacoes, acoes em lote, RBAC e auditoria.

### Expedicao - Fase 8 Listagens e Relatorios

- Seguido o proximo passo salvo no status: continuar Fase 8 em listagens e relatorios de Expedicao/Logistica, revisando filtros por grupo/empresa, exportacoes, acoes em lote, RBAC e auditoria.
- `EntregasListagem` passou a reforcar filtro local por contexto grupo/empresa, preservando a visao consolidada quando o usuario estiver no grupo.
- Exportacao CSV de entregas selecionadas agora funciona no botao existente e exporta apenas registros filtrados e selecionados dentro do contexto atual.
- Exportacao CSV da listagem agora exige contexto grupo/empresa e permissao `Expedicao.Entrega.exportar` ou equivalente.
- Bloqueios e exportacao bem-sucedida da listagem agora geram `AuditLog` com usuario, `group_id`, `grupo_id`, `empresa_id`, filtros e quantidade exportada.
- Marcadores de RBAC/contexto da listagem foram padronizados para chaves tecnicas sem acento, como `Expedicao.Entrega.visualizar/editar/exportar`.
- `RelatoriosLogistica` passou a filtrar romaneios por empresa/grupo antes de calcular desempenho por motorista.
- Grafico de entregas por cidade deixou de usar dados fixos de exemplo e passou a usar as entregas reais filtradas por periodo e contexto.
- Relatorio de Logistica ganhou exportacao CSV de resumo, com bloqueio por contexto/RBAC e auditoria operacional/seguranca.
- Botoes de exportacao receberam `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- Foi validado que `EntregasListagem`, `RelatoriosLogistica` e `STATUS_DO_PROJETO.md` ficaram sem mojibake real apos as alteracoes.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `RoteirizacaoMapa`, `RoteirizacaoInteligente` e painel logistico, revisando geracao/otimizacao de rotas, contexto grupo/empresa, permissoes e auditoria.

### Expedicao - Fase 8 Rotas e Roteirizacao IA

- Seguido o proximo passo salvo no status: continuar Fase 8 em `RoteirizacaoMapa`, `RoteirizacaoInteligente` e painel logistico, revisando geracao/otimizacao de rotas, contexto grupo/empresa, permissoes e auditoria.
- `RoteirizacaoMapa` passou a filtrar entregas por contexto grupo/empresa antes de permitir selecao e otimizacao.
- Otimizacao de rota agora exige contexto grupo/empresa e permissao tecnica `Expedicao.Rotas.editar/criar` ou `Expedicao.Roteirizacao.editar`.
- Falhas de otimizacao por falta de contexto, permissao ou coordenadas agora geram `AuditLog` de seguranca.
- Otimizacao bem-sucedida agora gera `AuditLog` operacional com quantidade de entregas, distancia e tempo estimado.
- Criacao de rota e romaneio no mapa passou a usar `createInContext`, reforcando `group_id`, `grupo_id` e `empresa_id`.
- Atualizacao das entregas vinculadas a rota/romaneio passou a usar `updateInContext` com contexto multiempresa.
- Antes de criar rota e romaneio, o sistema agora pede confirmacao explicita, respeitando a Regra-Mae para inclusao de registros.
- Sucesso, erro e cancelamento da geracao de rota/romaneio agora ficam auditados.
- `RoteirizacaoInteligente` deixou de buscar `Entrega`, `Motorista`, `Veiculo` e `RoteirizacaoInteligente` por `.list()` global e passou a usar `filterInContext`.
- Geracao de rota por IA agora exige contexto grupo/empresa, permissao, confirmacao explicita e cria o registro por `createInContext`.
- Bloqueios, erros e sucesso da roteirizacao IA agora geram auditoria com usuario, `group_id`, `grupo_id` e `empresa_id`.
- Botoes sensiveis de otimizar rota, gerar romaneio e gerar rota com IA receberam `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- Foi validado que `RoteirizacaoMapa`, `RoteirizacaoInteligente` e `STATUS_DO_PROJETO.md` ficaram sem mojibake real apos as alteracoes.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 no `DashboardLogistico` e seus componentes do painel logistico, revisando salvamento de regras, simulacao/otimizacao, relatorios, contexto grupo/empresa, permissoes e auditoria.

### Expedicao - Fase 8 Painel Logistico

- Seguido o proximo passo salvo no status: continuar Fase 8 no `DashboardLogistico` e seus componentes do painel logistico, revisando salvamento de regras, simulacao/otimizacao, relatorios, contexto grupo/empresa, permissoes e auditoria.
- `DashboardLogistico` passou a exigir contexto grupo/empresa e permissao tecnica antes de carregar entregas, regras, relatorios e acoes sensiveis.
- Chave de regras do painel logistico agora e escopada por empresa ou grupo, evitando configuracao global sem contexto multiempresa.
- Salvamento das regras passou a usar `createInContext` e `updateInContext`, reforcando `group_id`, `grupo_id` e `empresa_id`.
- Abertura de relatorio, salvamento de regras e bloqueios por contexto/permissao agora geram `AuditLog` com usuario, grupo, empresa, resultado e detalhes.
- `ControlsBar` passou a bloquear e auditar simulacao de cenarios quando faltar contexto ou permissao.
- `RouteOptimizerPanel` passou a bloquear e auditar otimizacao de rotas por falta de contexto/permissao, alem de auditar sucesso e erro da IA.
- `PerformanceReportDialog` passou a bloquear e auditar exportacao CSV quando faltar contexto ou permissao, e auditar exportacao bem-sucedida.
- Botoes sensiveis de salvar regras, simular cenario, otimizar rota, abrir relatorio e exportar CSV receberam `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- Foi validado que `DashboardLogistico` e componentes do painel logistico ficaram sem mojibake real apos as alteracoes.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `DriverChat`, `OcorrenciasPanel`, `ComprovanteDigital` e `LogisticaReversa`, revisando comunicacao, ocorrencias, comprovantes, reversa, contexto grupo/empresa, permissoes e auditoria.

### Expedicao - Fase 8 Comunicacao, Ocorrencias e Reversa

- Seguido o proximo passo salvo no status: continuar Fase 8 em `DriverChat`, `OcorrenciasPanel`, `ComprovanteDigital` e `LogisticaReversa`, revisando comunicacao, ocorrencias, comprovantes, reversa, contexto grupo/empresa, permissoes e auditoria.
- `DriverChat` passou a exigir contexto grupo/empresa e permissao antes de enviar mensagens para a entrega.
- Mensagens ao motorista agora sao sanitizadas, pedem confirmacao explicita antes de incluir registro e sao gravadas via `updateInContext`.
- Bloqueios, cancelamentos, erros e sucesso da comunicacao agora geram `AuditLog` com usuario, grupo, empresa e entrega.
- `OcorrenciasPanel` passou a exigir contexto e permissao para upload de evidencia e criacao de ocorrencias.
- Ocorrencias agora sao sanitizadas, pedem confirmacao antes da inclusao e sao salvas via `updateInContext` com `group_id`, `grupo_id` e `empresa_id`.
- Upload de evidencia e criacao de ocorrencia agora geram auditoria operacional/seguranca.
- `ComprovanteDigital` passou a usar `updateInContext` para confirmar entrega, reforcando contexto multiempresa no comprovante e no historico de status.
- Confirmacao de entrega agora exige permissao, contexto e confirmacao explicita antes de marcar como `Entregue`.
- Arquivo do comprovante, GPS, bloqueios, erros e sucesso da confirmacao agora geram `AuditLog`.
- `LogisticaReversa` deixou de atualizar entrega, contas a receber, estoque e notificacao por chamadas diretas globais e passou a usar `filterInContext`, `updateInContext` e `createInContext`.
- Processamento de devolucao agora exige contexto, permissao e confirmacao explicita antes de alterar entrega, financeiro e estoque.
- Logistica reversa agora registra historico da entrega e auditoria completa de sucesso, bloqueio, cancelamento e erro.
- Corrigidos textos com mojibake real e erros ortograficos nos quatro componentes da secao Expedicao e Logistica.
- Botoes e inputs sensiveis receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em componentes restantes da Expedicao, priorizando `ConfiguracaoExpedicao`, `SeparacaoConferencia`, `DashboardEntregasRealtime` e fluxos de status/acoes em lote, revisando contexto grupo/empresa, RBAC, auditoria e textos.

### Expedicao - Fase 8 Configuracoes, Dashboard e Conferencia

- Seguido o proximo passo salvo no status: continuar Fase 8 em `ConfiguracaoExpedicao`, `SeparacaoConferencia`, `DashboardEntregasRealtime` e fluxos de status/acoes em lote.
- `ConfiguracaoExpedicao` deixou de consultar/salvar configuracao global por chamada direta e passou a usar `filterInContext`, `createInContext` e `updateInContext` com `group_id`, `grupo_id` e `empresa_id`.
- As configuracoes de transportadora, WhatsApp, e-mail, regras gerais e Google Maps agora sao recarregadas do registro salvo no contexto atual.
- Salvamento de configuracoes agora exige contexto grupo/empresa, permissao RBAC, sanitizacao basica, confirmacao explicita e auditoria de sucesso, bloqueio, cancelamento e erro.
- Toggles da aba Geral deixaram de ser apenas visuais e passaram a persistir em `configuracoes_gerais`.
- `DashboardEntregasRealtime` passou a carregar entregas e rotas por `filterInContext`, com query keys por grupo/empresa e bloqueio visual quando faltar contexto ou permissao.
- Metricas do dashboard agora sao calculadas por `useMemo`, usando apenas dados filtrados do contexto atual.
- `SeparacaoConferencia` passou a gravar `HistoricoCliente` via `createInContext`, reforcando carimbo multiempresa.
- Conclusao de separacao/conferencia agora pede confirmacao explicita antes de criar registros e alterar status.
- Corrigidos textos com mojibake real e ajustes ortograficos em configuracoes, dashboard em tempo real e separacao/conferencia.
- Botoes sensiveis receberam ou mantiveram marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `SeparacaoConferenciaIA`, `EnvioMensagemAutomatica`, `MapaRastreamentoRealTime`, `RastreamentoPublico` e componentes financeiros da logistica, revisando contexto grupo/empresa, RBAC, auditoria, textos e acoes sensiveis.

### Expedicao - Fase 8 Comunicacao Automatica e Financeiro Logistico

- Seguido o proximo passo salvo no status: continuar Fase 8 em `EnvioMensagemAutomatica` e componentes financeiros da logistica, revisando contexto grupo/empresa, RBAC, auditoria, textos e acoes sensiveis.
- `EnvioMensagemAutomatica` passou a exigir entrega valida, contexto grupo/empresa e permissao RBAC antes de registrar envio de WhatsApp.
- Templates e mensagens livres agora sao sanitizados antes do envio e antes de gravar historico.
- Envio de mensagem agora pede confirmacao explicita antes de alterar a entrega e criar historico, respeitando a Regra-Mae para inclusao/alteracao de registros.
- Atualizacao da entrega e criacao de `HistoricoCliente` passaram a usar `updateInContext` e `createInContext`, reforcando `group_id`, `grupo_id` e `empresa_id`.
- Bloqueios por falta de contexto, falta de permissao, telefone ausente, cancelamento, erro e sucesso do envio agora geram `AuditLog`.
- `LogisticaFinanceiroPanel` passou a carregar configuracoes, entregas, contas a receber e contas a pagar por contexto grupo/empresa.
- Geracao de contas a receber e contas a pagar agora exige contexto, permissao RBAC, configuracao financeira, confirmacao explicita e auditoria.
- Conciliacao de titulos a receber e a pagar agora exige contexto, permissao RBAC, confirmacao explicita e auditoria.
- Criacao e conciliacao de titulos passaram a usar `createInContext` e `updateInContext`, mantendo carimbo multiempresa nos registros financeiros.
- Corrigidos textos com mojibake real e ajustes ortograficos em comunicacao automatica e financeiro logistico.
- Botoes sensiveis receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `MapaRastreamentoRealTime`, `RastreamentoPublico` e `SeparacaoConferenciaIA`, revisando contexto grupo/empresa, RBAC/auditoria onde aplicavel, seguranca, textos e acoes sensiveis.

### Expedicao - Fase 8 Rastreamento e Separacao IA

- Seguido o proximo passo salvo no status: continuar Fase 8 em `MapaRastreamentoRealTime`, `RastreamentoPublico` e `SeparacaoConferenciaIA`.
- `MapaRastreamentoRealTime` deixou de consultar entrega e posicoes por chamadas globais e passou a usar `filterInContext` com chaves por grupo/empresa.
- Visualizacao do mapa em tempo real agora exige contexto grupo/empresa e permissao RBAC de rastreamento, entregas ou painel logistico.
- Marcadores, destino, veiculo e overlay do mapa tiveram textos corrigidos e exibicao protegida contra dados incompletos de latitude/longitude.
- `RastreamentoPublico` teve textos com mojibake corrigidos, remocao de simbolos corrompidos e sanitizacao basica dos campos exibidos ao cliente.
- Rastreamento publico passou a montar uma resposta reduzida para exibicao, evitando carregar dados internos desnecessarios na tela publica.
- `SeparacaoConferenciaIA` deixou de buscar `Pedido`, `Produto` e `Colaborador` por `.list()` global e passou a usar `filterInContext`.
- Scanner, validacao por IA, otimizacao de rota e finalizacao agora exigem contexto grupo/empresa e permissao RBAC.
- Prompts enviados para IA agora usam textos sanitizados e dados numericos controlados para reduzir risco de entrada indevida.
- Finalizacao da separacao IA agora pede confirmacao explicita antes de criar registro e atualizar pedido.
- Finalizacao passou a criar `SeparacaoConferencia` via `createInContext` e atualizar `Pedido` via `updateInContext`, mantendo `group_id`, `grupo_id` e `empresa_id`.
- Auditoria foi adicionada para validacao IA, otimizacao de rota, codigos nao encontrados, itens fora do pedido, bloqueios, cancelamentos, erros e finalizacao.
- Botoes sensiveis receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em componentes restantes da Expedicao e Logistica, priorizando `LogisticaEntregaTab`, `PedidosEntregaTab`, `RelatoriosLogistica`, `RelatorioFinanceiroLogistica` e integracoes entre pedido, entrega, financeiro e fiscal.

### Comercial e Expedicao - Fase 8 Integracao Pedido, Entrega e Estoque

- Seguido o proximo passo salvo no status: continuar em `LogisticaEntregaTab`, `PedidosEntregaTab`, relatorios e integracoes entre pedido, entrega, financeiro e fiscal.
- `LogisticaEntregaTab` teve textos corrompidos corrigidos e passou a usar `w-full h-full` no container principal.
- Criacao e remocao de etapas de entrega/faturamento parcial agora exigem permissao visual e confirmacao explicita antes de alterar o pedido em memoria.
- Campos de entrega passaram a sanitizar textos e o link do Google Maps recebeu validacao basica para reduzir entrada indevida.
- Acoes sensiveis da aba de logistica do pedido receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- `PedidosEntregaTab` deixou de buscar pedidos, entregas e regioes por chamadas globais e passou a usar `filterInContext` por grupo/empresa.
- Alteracao de status de pedido agora exige contexto grupo/empresa, permissao RBAC, confirmacao explicita, `updateInContext` e auditoria operacional/seguranca.
- Quando existir entrega vinculada, a mudanca de status tambem sincroniza a entidade `Entrega` no mesmo contexto multiempresa.
- Confirmacao de entrega com baixa de estoque agora exige permissao de entrega e estoque, confirmacao explicita, usa `filterInContext`, `createInContext` e `updateInContext`, e audita bloqueios/estoque insuficiente.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `RelatoriosLogistica`, `RelatorioFinanceiroLogistica`, `NotificadorAutomaticoEntrega`, `ComprovanteEntregaDigital` e `RegistroOcorrenciaLogistica`, revisando contexto grupo/empresa, RBAC, auditoria, textos e integracoes financeiro/fiscal.

### Expedicao - Fase 8 Notificacoes, Ocorrencias e Financeiro Logistico

- Seguido o proximo passo salvo no status: continuar em `RelatorioFinanceiroLogistica`, `NotificadorAutomaticoEntrega` e `RegistroOcorrenciaLogistica`.
- `NotificadorAutomaticoEntrega` teve textos corrompidos corrigidos e passou a exigir contexto grupo/empresa e permissao RBAC antes de enviar/registrar notificacao.
- Mensagens de notificacao agora sao sanitizadas, usam confirmacao explicita e registram auditoria de sucesso, bloqueio, cancelamento e erro.
- Quando existe entrega vinculada, a notificacao e gravada via `updateInContext`; quando nao existe, gera historico do cliente via `createInContext`.
- `RegistroOcorrenciaLogistica` teve textos corrompidos corrigidos e passou a exigir contexto grupo/empresa, permissao RBAC e confirmacao antes de registrar ocorrencia.
- Ocorrencias agora sao sanitizadas, gravadas via `updateInContext` ou `createInContext`, e auditadas com usuario, grupo, empresa, pedido e entrega.
- Upload de foto de ocorrencia passou a gerar auditoria de sucesso/erro.
- `RelatorioFinanceiroLogistica` passou a bloquear sem contexto/permissao, enviar filtros com `group_id` e `empresa_id`, e auditar consultas/aplicacao de filtros.
- Botoes sensiveis receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive` quando aplicavel.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `ComprovanteEntregaDigital` e `RelatoriosLogistica`, revisando baixa de estoque, comprovante, relatorios operacionais, contexto grupo/empresa, RBAC, auditoria e textos.

### Expedicao - Fase 8 Comprovante e Relatorios Logisticos

- Seguido o proximo passo salvo no status: continuar Fase 8 em `ComprovanteEntregaDigital` e `RelatoriosLogistica`.
- `ComprovanteEntregaDigital` deixou de usar chamadas globais criticas de `Produto`, `MovimentacaoEstoque`, `Entrega` e `Pedido` e passou a operar com `filterInContext`, `createInContext` e `updateInContext`.
- Confirmacao de entrega com baixa de estoque agora exige contexto grupo/empresa, permissao RBAC, foto do comprovante, nome do recebedor e confirmacao explicita antes de alterar registros.
- Dados do recebedor, observacoes, produto, unidade e numero de pedido passaram por sanitizacao antes de gravar ou auditar.
- Baixa de estoque agora valida produto existente e saldo suficiente, grava `MovimentacaoEstoque` com `group_id`, `grupo_id` e `empresa_id`, atualiza produto no contexto e audita bloqueios, erros e sucesso.
- Criacao/atualizacao de entrega e atualizacao do pedido agora preservam `group_id`, `grupo_id` e `empresa_id`, historico de status e comprovante digital.
- Upload de foto, captura de GPS e confirmacao de entrega receberam auditoria operacional/seguranca e marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive` quando aplicavel.
- `RelatoriosLogistica` teve textos corrompidos/acentuacao inconsistente corrigidos, alerta visual quando faltar contexto/permissao e exportacao CSV com confirmacao explicita e auditoria de cancelamento.
- Layout dos filtros, abas e KPIs do relatorio foi ajustado para melhor responsividade sem criar telas, modulos ou arquivos novos.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Verificacao de mojibake real e escapes literais executada sem apontamentos nos arquivos alterados.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nos componentes restantes de Expedicao/Logistica, priorizando `ComprovanteDigital`, `DetalhesEntregaView`, `EntregasListagem` e paineis logisticos, revisando contexto grupo/empresa, RBAC, auditoria, textos e acoes sensiveis.

### Expedicao - Fase 8 Detalhes e Listagem de Entregas

- Seguido o proximo passo salvo no status: continuar Fase 8 em `ComprovanteDigital`, `DetalhesEntregaView`, `EntregasListagem` e paineis logisticos.
- `DetalhesEntregaView` teve textos corrompidos corrigidos em abas, campos, status, timeline, notificacoes e acoes de entrega.
- Alteracao de status da entrega agora exige contexto grupo/empresa, permissao RBAC e confirmacao explicita para qualquer status sensivel, nao apenas entrega frustrada.
- Quando a mudanca de status for delegada ao fluxo externo, a tela agora registra auditoria antes de chamar o fluxo recebido por propriedade.
- Confirmacao com assinatura digital agora exige confirmacao explicita, sanitiza nome/documento do recebedor, preserva `group_id`, `grupo_id` e `empresa_id`, e audita cancelamento/sucesso/erro.
- `DetalhesEntregaView` passou a exibir alerta visual quando faltar contexto ou permissao para acoes sensiveis.
- `EntregasListagem` teve textos corrompidos corrigidos em busca, status, colunas, botoes e titulos de janelas.
- Exportacao CSV de entregas selecionadas agora exige confirmacao explicita e audita cancelamento, bloqueios e sucesso.
- Abertura de detalhes e edicao de entrega agora registra auditoria operacional com entrega e numero do pedido.
- `EntregasListagem` passou a exibir alerta visual quando faltar contexto/permissao para visualizar entregas e manteve marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive` nas acoes sensiveis.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos fluxos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nos paineis logisticos restantes, priorizando `DashboardLogistico`, `DashboardEntregasRealtime`, `OcorrenciasPanel`, `DriverChat` e demais componentes de painel, revisando contexto grupo/empresa, RBAC, auditoria, textos e acoes sensiveis.

### Expedicao - Fase 8 Paineis Logisticos

- Seguido o proximo passo salvo no status: continuar Fase 8 nos paineis logisticos restantes, priorizando `DashboardLogistico`, `DashboardEntregasRealtime`, `OcorrenciasPanel` e `DriverChat`.
- `DashboardLogistico` teve textos corrompidos corrigidos em titulo, relatorio, distancia, duracao, nao alocados e ocorrencias.
- Salvamento de regras do painel logistico agora exige confirmacao explicita, contexto grupo/empresa, permissao RBAC e auditoria de cancelamento/sucesso/erro.
- `DashboardLogistico` passou a exibir alerta visual quando faltar contexto/permissao para visualizar o painel.
- `DashboardEntregasRealtime` teve textos corrigidos em tempo medio, ultimos 7 dias, atencao e operacao dentro dos padroes, mantendo bloqueio por contexto/permissao.
- `OcorrenciasPanel` teve textos corrigidos, passou a validar upload de imagem com limite de 8MB, auditar rejeicao de arquivo invalido e exibir bloqueio visual quando faltar contexto/permissao.
- `DriverChat` teve textos corrigidos e passou a exibir bloqueio visual quando faltar contexto/permissao para enviar mensagens.
- Botao de envio do `DriverChat` recebeu marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos fluxos existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nos subcomponentes do painel logistico, priorizando `ControlsBar`, `RouteOptimizerPanel`, `PerformanceReportDialog`, `AlertsPanel`, `BottlenecksPanel`, `QueuePanels` e `MapView`, revisando contexto grupo/empresa, RBAC, auditoria, textos e acoes sensiveis.

### Expedicao - Fase 8 Subpaineis Logisticos

- Seguido o proximo passo salvo no status: continuar Fase 8 nos subcomponentes do painel logistico, priorizando `ControlsBar`, `RouteOptimizerPanel`, `PerformanceReportDialog`, `AlertsPanel`, `BottlenecksPanel`, `QueuePanels` e `MapView`.
- `ControlsBar` recebeu reforco de contexto/permissao no container principal, confirmacao explicita antes de executar simulacao logistica e validacao numerica para parametros do simulador.
- Salvamento de regras pelo `ControlsBar` passou a auditar bloqueio por contexto/permissao antes de delegar a gravacao ao fluxo existente.
- `RouteOptimizerPanel` passou a auditar bloqueios por falta de contexto, permissao, empresa ou entregas validas, exigir confirmacao antes de otimizar rota e sanitizar entradas numericas de capacidade/paradas.
- `RouteOptimizerPanel` passou a exibir alerta visual quando faltar contexto/permissao e a auditar selecao de entrega sugerida na rota.
- `PerformanceReportDialog` passou a bloquear exportacao sem linhas, exigir confirmacao antes de gerar CSV e auditar cancelamento/bloqueio/exportacao.
- `AlertsPanel`, `BottlenecksPanel`, `QueuePanels` e `MapView` receberam marcadores de contexto/permissao e auditoria opcional nas selecoes de entregas exibidas nos paineis.
- Paineis de alertas, gargalos e filas passaram a exibir aviso visual quando faltar contexto grupo/empresa ou permissao para visualizacao.
- Corrigidos textos corrompidos e inconsistencias de exibicao nos subpaineis logisticos sem criar tela, modulo ou arquivo novo.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; as melhorias foram aplicadas nos componentes existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em componentes auxiliares de Expedicao/Logistica ainda nao revisados, priorizando `LiveMap`, `TimelineEntrega`, componentes de configuracao/logistica financeira e integracoes finais entre entrega, estoque, financeiro e fiscal.

### Expedicao - Fase 8 Auxiliares Logistica Financeira e Mapa Vivo

- Seguido o proximo passo salvo no status: continuar Fase 8 em componentes auxiliares de Expedicao/Logistica, priorizando `LiveMap`, componentes de configuracao/logistica financeira e integracoes finais entre entrega, estoque, financeiro e fiscal.
- `LiveMap` deixou de buscar entrega por chamada global direta e passou a usar `filterInContext`, respeitando contexto grupo/empresa antes de carregar destino da entrega.
- `LiveMap` passou a aceitar `contextoValido`, `canView` e `onAudit`, exibindo bloqueio visual quando faltar contexto/permissao e auditando bloqueios/erro de ETA.
- `ConfigFinanceiroLogistica` foi reforcado com contexto grupo/empresa, RBAC, sanitizacao de entradas, confirmacao explicita antes de salvar e auditoria de bloqueio/cancelamento/sucesso/erro.
- Salvamento da configuracao financeira logistica passou a usar `createInContext` e `updateInContext`, preservando `group_id`, `grupo_id` e `empresa_id`.
- `LogisticaFinanceiroPanel` passou a repassar `groupId` e auditoria para a configuracao financeira logistica.
- Conciliacao de recebimentos e despesas logisticas agora audita cancelamento quando o usuario nao confirma a operacao.
- Botoes de conciliacao receberam `data-permission`, `data-context-required` e `data-sensitive`.
- Corrigidos textos e acentuacao inconsistente nos componentes alterados, mantendo comportamento e fluxo existentes.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos componentes existentes.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em componentes restantes de Expedicao/Logistica ainda nao revisados, priorizando `TimelineEntregaVisual`, `ConfiguracaoExpedicao`, `FormularioEntrega`, `EnvioMensagemAutomatica`, `LogisticaReversa` e integracoes finais com fiscal/estoque/financeiro.

### Expedicao - Fase 8 Timeline e Configuracoes de Expedicao

- Seguido o proximo passo salvo no status: continuar Fase 8 em componentes restantes de Expedicao/Logistica, priorizando `TimelineEntregaVisual`, `ConfiguracaoExpedicao`, `FormularioEntrega`, `EnvioMensagemAutomatica`, `LogisticaReversa` e integracoes finais.
- `TimelineEntregaVisual` foi reforcada sem criar componente novo: recebeu contexto/permissao visual, sanitizacao de textos exibidos, validacao segura do link de mapa e auditoria opcional ao abrir mapa.
- `TimelineEntregaVisual` teve textos corrompidos corrigidos e passou a evitar renderizacao sem pedido, contexto ou permissao.
- `ConfiguracaoExpedicao` recebeu aviso visual quando faltar contexto/permissao de visualizacao.
- Campos de configuracao de transportadora, WhatsApp, e-mail e geral passaram a atualizar estado por helpers sanitizados antes de salvar.
- Mantido o fluxo existente de confirmacao explicita, RBAC, `createInContext`/`updateInContext` e auditoria de salvar/cancelar/erro nas configuracoes de expedicao.
- Mantida a Regra-Mae: nenhuma tela, modulo ou arquivo novo foi criado; apenas reforco dos componentes existentes.
- `npm run build` retornou `Acesso negado` no atalho do Vite neste ambiente, entao o build foi validado com sucesso via `node node_modules/vite/bin/vite.js build`.
- Permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `FormularioEntrega`, `EnvioMensagemAutomatica`, `LogisticaReversa` e fluxos finais de estoque/financeiro/fiscal, revisando contexto grupo/empresa, RBAC, auditoria, sanitizacao e acoes sensiveis.

### Expedicao - Fase 8 Formulario, Mensagens e Logistica Reversa

- Seguido o proximo passo salvo no status: continuar Fase 8 em `FormularioEntrega`, `EnvioMensagemAutomatica`, `LogisticaReversa` e fluxos finais de estoque/financeiro/fiscal.
- `FormularioEntrega` recebeu sanitizacao recursiva do payload antes de criar/editar entrega, incluindo bloqueio de marcadores perigosos como `javascript:` em textos.
- Criacao e edicao de entrega agora exigem confirmacao explicita, com auditoria quando o usuario cancela a operacao.
- `FormularioEntrega` passou a exibir aviso visual quando faltar contexto grupo/empresa ou permissao RBAC para salvar entregas.
- `EnvioMensagemAutomatica` passou a exibir aviso visual quando faltar contexto/permissao para enviar WhatsApp e os templates receberam marcadores de permissao, contexto obrigatorio e acao sensivel.
- `LogisticaReversa` passou a exibir aviso visual quando faltar contexto/permissao para processar devolucao e o botao cancelar recebeu marcador de acao/contexto.
- Mantidos os fluxos existentes de entrega, mensagem e devolucao; nenhuma tela, modulo, componente ou arquivo novo foi criado.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build` porque o atalho `npm run build` pode retornar `Acesso negado` no Vite neste ambiente.
- Permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nas integracoes finais de Expedicao com estoque, financeiro e fiscal, validando que status de entrega, baixa/retorno de estoque, cobranca/faturamento e emissao fiscal respeitem grupo/empresa, RBAC, auditoria, confirmacao e Regra-Mae.
### Expedicao - Fase 8 Integracao PDV, Entrega e Fiscal

- Seguido o proximo passo salvo no status: continuar Fase 8 nas integracoes finais de Expedicao com estoque, financeiro e fiscal.
- `CaixaPDVCompleto` foi reforcado sem criar tela, modulo, componente ou arquivo novo.
- Venda PDV agora valida contexto grupo/empresa e permissao antes de finalizar operacao sensivel.
- Finalizacao de venda agora exige confirmacao explicita e audita bloqueio, cancelamento e sucesso.
- Criacao automatica de entrega pelo PDV agora exige empresa, cliente e permissao de expedicao antes de liberar o fluxo.
- Emissao de NF-e pelo PDV agora exige empresa faturadora, cliente e permissao fiscal antes de liberar o fluxo.
- Geracao de boleto/conta a receber pelo PDV agora exige permissao financeira para criacao de contas a receber.
- Payloads gerados pelo PDV passaram a preservar `group_id`, `grupo_id` e `empresa_id` nos fluxos de caixa, pedido, entrega, conta a receber e NF-e.
- Campos textuais de cliente/endereco usados nos fluxos automaticos do PDV passaram por sanitizacao simples contra marcadores HTML e `javascript:`.
- Liquidacoes de recebimentos/pagamentos no PDV agora exigem confirmacao explicita, auditam bloqueio/cancelamento/sucesso e receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive` nos botoes sensiveis.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 revisando os fluxos comerciais que disparam entrega, NF-e, cobranca e fechamento financeiro, priorizando `GerarNFeModal`, `NotasFiscaisTab`, `FechamentoFinanceiroTab` e `PedidosEntregaTab`.

### Comercial/Fiscal - Fase 8 Notas Fiscais

- Seguido o proximo passo salvo no status: continuar Fase 8 nos fluxos comerciais que disparam entrega, NF-e, cobranca e fechamento financeiro, iniciando por `NotasFiscaisTab`.
- `NotasFiscaisTab` foi reforcada sem criar tela, modulo, componente ou arquivo novo.
- Criacao, edicao e cancelamento de NF-e agora validam contexto grupo/empresa, empresa faturadora obrigatoria e permissao RBAC antes de executar a acao sensivel.
- Payloads de Nota Fiscal passaram a preservar `group_id`, `grupo_id`, `empresa_id` e `empresa_faturamento_id` nos fluxos de criacao, edicao e cancelamento.
- Salvamento e cancelamento de NF-e agora exigem confirmacao explicita antes da acao, auditando cancelamento pelo usuario, bloqueio por contexto/permissao e sucesso operacional.
- Motivo de cancelamento e campos textuais principais da NF-e passaram por sanitizacao antes de gravar ou enviar ao simulador fiscal.
- Log fiscal do cancelamento passou a registrar tambem contexto de grupo e empresa.
- Botoes sensiveis de criar, salvar, exportar e cancelar NF-e receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive` quando aplicavel.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `GerarNFeModal`, `FechamentoFinanceiroTab` e `PedidosEntregaTab`, conectando os mesmos pilares de contexto grupo/empresa, RBAC, auditoria, sanitizacao, confirmacao e Regra-Mae nos fluxos de emissao, cobranca, entrega e fechamento financeiro.
### Comercial/Fiscal - Fase 8 Emissao no Fechamento Financeiro

- Seguido o proximo passo salvo no status: continuar Fase 8 em `GerarNFeModal` e `FechamentoFinanceiroTab`.
- `FechamentoFinanceiroTab` foi reforcado sem criar tela, modulo, componente ou arquivo novo.
- Botao de emissao de NF-e no fechamento financeiro agora valida contexto grupo/empresa, empresa faturadora obrigatoria e permissao fiscal antes de abrir o modal.
- `FechamentoFinanceiroTab` passou a auditar bloqueio de abertura e emissao de NF-e com `group_id`, `grupo_id`, `empresa_id`, usuario, timestamp e pedido relacionado.
- Campos financeiros/fiscais sensiveis do fechamento receberam sanitizacao ou normalizacao antes de atualizar o estado do pedido, incluindo desconto, parcelas, intervalo, observacoes, CFOP e natureza da operacao.
- `GerarNFeModal` passou a receber contexto, permissao, empresa faturadora e auditoria do fluxo pai, mantendo o componente existente.
- Emissao pelo modal agora bloqueia falta de contexto/permissao/empresa, exige confirmacao explicita, sanitiza dados fiscais e preserva `group_id`, `grupo_id`, `empresa_id` e `empresa_faturamento_id` no payload.
- Botao sensivel de emissao recebeu marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `PedidosEntregaTab`, conectando pedido, entrega, cobranca e emissao fiscal com os mesmos pilares de contexto grupo/empresa, RBAC, auditoria, sanitizacao, confirmacao e Regra-Mae.
### Comercial/Expedicao - Fase 8 Pedidos para Entrega

- Seguido o proximo passo salvo no status: continuar Fase 8 em `PedidosEntregaTab`, conectando pedido, entrega, cobranca e emissao fiscal com contexto grupo/empresa, RBAC, auditoria, sanitizacao, confirmacao e Regra-Mae.
- `PedidosEntregaTab` foi reforcado sem criar tela, modulo, componente ou arquivo novo.
- Abertura de paineis logisticos, analytics, roteirizacao e romaneio agora passa por helper central com validacao de contexto grupo/empresa, permissao e auditoria.
- Criacao de romaneio com pedidos filtrados agora exige confirmacao explicita e audita bloqueio/cancelamento/abertura.
- Busca por pedido/cliente passou a sanitizar entrada antes de filtrar.
- Abertura de notificacao, comprovante e ocorrencia passou por helper auditado, respeitando permissao e contexto antes de abrir os fluxos filhos.
- Status de pedido/entrega e baixa automatica de estoque preservam `group_id`, `grupo_id` e `empresa_id` por helper de contexto.
- Baixa de estoque manteve confirmacao obrigatoria, auditoria de estoque insuficiente e sanitizacao da descricao do produto na movimentacao.
- Links externos de mapa agora so aparecem quando usam URL segura `http` ou `https`.
- `TimelineEntregaVisual` passou a receber contexto, permissao e auditoria a partir de `PedidosEntregaTab`.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros apos ajuste de espaco final.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em componentes filhos chamados por `PedidosEntregaTab`, priorizando `NotificadorAutomaticoEntrega`, `ComprovanteEntregaDigital`, `RegistroOcorrenciaLogistica` e `IntegracaoRomaneio`, reforcando contexto, RBAC, auditoria, sanitizacao e confirmacao nas acoes internas.
### Expedicao - Fase 8 Filhos de Pedidos para Entrega

- Seguido o proximo passo salvo no status: continuar Fase 8 em `NotificadorAutomaticoEntrega`, `ComprovanteEntregaDigital`, `RegistroOcorrenciaLogistica` e `IntegracaoRomaneio`.
- `IntegracaoRomaneio` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Romaneio passou a usar `filterInContext`, `createInContext` e `updateInContext` para pedidos, motoristas, veiculos, romaneio, entregas e status do pedido.
- Criacao de romaneio agora exige contexto grupo/empresa, permissao RBAC, motorista/veiculo/placa/pedidos obrigatorios e confirmacao explicita antes de gravar.
- Romaneio, entregas criadas e pedidos atualizados preservam `group_id`, `grupo_id` e `empresa_id`, com historico de status no pedido.
- Criacao de romaneio passou a auditar bloqueio, cancelamento e sucesso com usuario, timestamp, grupo, empresa e quantidade de entregas.
- Campos de motorista, veiculo, placa, cliente e pedido no romaneio passaram por sanitizacao antes de exibir ou gravar.
- `NotificadorAutomaticoEntrega` passou a sanitizar mensagem personalizada e e-mail usado no envio.
- `ComprovanteEntregaDigital` passou a sanitizar campos digitados e validar abertura de foto por URL segura.
- `RegistroOcorrenciaLogistica` passou a bloquear upload sem contexto/permissao, validar imagem de ate 8MB, sanitizar descricao/resolucao e proteger abertura de foto.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nas integracoes finais de Expedicao/Comercial com financeiro e fiscal, priorizando componentes que geram cobranca, link de pagamento, boleto, contas a receber e atualizacao de status apos entrega/faturamento.
### Financeiro/CRM - Fase 8 Link de Pagamento e Boleto no Chat

- Seguido o proximo passo salvo no status: continuar Fase 8 nas integracoes finais de Expedicao/Comercial com financeiro e fiscal, priorizando cobranca, link de pagamento, boleto e contas a receber.
- `GerarLinkPagamentoModal` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Geracao de link de pagamento agora exige contexto de grupo/empresa, empresa selecionada e permissao RBAC financeira antes de executar.
- Link de pagamento agora exige confirmacao explicita, sanitiza campos do cliente, valida URL segura, preserva `group_id`, `grupo_id` e `empresa_id` em `PagamentoOmnichannel` e `ContaReceber`, e audita bloqueio, cancelamento e sucesso.
- `GerarBoletoChat` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Consulta de titulos no chat passou a usar `filterInContext`, respeitando grupo/empresa e permissao antes de listar contas a receber.
- Geracao de 2a via de boleto pelo chat agora exige contexto grupo/empresa, permissao RBAC, confirmacao explicita, sanitizacao da linha digitavel/textos, validacao de URL segura e auditoria de bloqueio/cancelamento/sucesso.
- Atualizacoes em `ContaReceber` e `ConversaOmnicanal` passaram a usar `updateInContext`, mantendo `group_id`, `grupo_id` e `empresa_id` no fluxo de envio de boleto ao cliente.
- Botoes sensiveis receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `GerarCobrancaModal` e `GeradorLinkPagamento`, reforcando PIX, boleto, ordem de liquidacao e logs de cobranca com os mesmos pilares de contexto grupo/empresa, RBAC, auditoria, sanitizacao, confirmacao e Regra-Mae.
### Financeiro - Fase 8 Cobranca PIX, Boleto e Ordem de Liquidacao

- Seguido o proximo passo salvo no status: continuar Fase 8 em `GerarCobrancaModal` e `GeradorLinkPagamento`.
- `GerarCobrancaModal` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Geracao de PIX e boleto agora exige contexto grupo/empresa, empresa selecionada, permissao RBAC financeira, valor valido e confirmacao explicita antes de gravar.
- PIX e boleto agora preservam `group_id`, `grupo_id` e `empresa_id` em `LogCobranca` e `ContaReceber`, com sanitizacao de textos/linha digitavel e validacao de URL segura para PDF/fatura.
- `GerarCobrancaModal` passou a auditar bloqueio por contexto, permissao ou valor invalido, cancelamento pelo usuario e sucesso da geracao de PIX/boleto.
- Botoes sensiveis de PIX, boleto e abertura de PDF receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- `GeradorLinkPagamento` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Criacao de `PagamentoOmnichannel`, atualizacao de `ContaReceber` e criacao de `CaixaOrdemLiquidacao` passaram a usar `createInContext`/`updateInContext`, preservando contexto multiempresa.
- Link de pagamento agora exige permissao RBAC, contexto grupo/empresa, empresa selecionada, valor valido, gateway permitido, validade limitada e confirmacao explicita antes de gerar ordem de liquidacao.
- Link gerado e copia para area de transferencia passaram por validacao de URL segura; dados de cliente/titulo foram sanitizados antes de gravar e exibir.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nas telas de contas a receber/pagar e liquidacao, priorizando `ContasReceberTab`, `ContasPagarTab`, `LiquidarReceberPagar` e `CaixaCentralLiquidacao` para reforcar baixa, cancelamento, conciliacao, auditoria e rateio por grupo/empresa.

### Financeiro - Fase 8 Contas, Baixas e Liquidacao

- Seguido o proximo passo salvo no status: continuar Fase 8 em `ContasReceberTab`, `ContasPagarTab`, `LiquidarReceberPagar` e `CaixaCentralLiquidacao`.
- `ContasReceberTab` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Baixa de contas a receber agora valida contexto grupo/empresa antes de abrir ou confirmar a baixa, exige confirmacao explicita e audita cancelamento/baixa com usuario, timestamp, `group_id`, `grupo_id`, `empresa_id`, dados anteriores e novos.
- Envio de contas a receber para o Caixa agora exige contexto, titulos selecionados e confirmacao explicita, criando ordem por `createInContext` e preservando grupo/empresa.
- `ContasPagarTab` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Baixa/pagamento de contas a pagar agora valida contexto grupo/empresa, exige confirmacao explicita, usa `contasList` como fonte consistente e preserva `group_id`, `grupo_id` e `empresa_id` em `ContaPagar` e `CaixaMovimento`.
- Envio de contas a pagar para o Caixa agora exige contexto, titulos selecionados e confirmacao explicita, criando ordem por `createInContext` e preservando grupo/empresa.
- Botoes sensiveis de confirmacao de baixa em receber/pagar receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- `LiquidarReceberPagar` agora audita envio/cancelamento de titulos para a ordem de liquidacao, exige confirmacao explicita em envios individuais e em lote, e grava usuario/contexto nas ordens criadas.
- `CaixaCentralLiquidacao` passou a filtrar consultas por `groupId`/`empresaId`, bloquear carregamento sem contexto/permissao e exibir alerta visual quando faltar contexto ou acesso.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; as melhorias foram aplicadas nos componentes existentes.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `OrdensLiquidacaoPendentes`, `HistoricoLiquidacoes`, `ConciliacaoBancariaTab` e `GestaoRemessaRetorno`, reforcando processamento/cancelamento/conciliacao/retorno bancario com contexto grupo/empresa, RBAC, auditoria antes/depois, confirmacao e Regra-Mae.

### Financeiro - Fase 8 Ordens, Conciliacao e CNAB

- Seguido o proximo passo salvo no status: continuar Fase 8 em `OrdensLiquidacaoPendentes`, `HistoricoLiquidacoes`, `ConciliacaoBancariaTab` e `GestaoRemessaRetorno`.
- `OrdensLiquidacaoPendentes` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Liquidacao e cancelamento de ordens agora exigem contexto grupo/empresa, permissao RBAC, confirmacao explicita e auditoria de sucesso/cancelamento com dados anteriores e novos.
- Baixa dos titulos vinculados pela ordem agora preserva `group_id`, `grupo_id` e `empresa_id` em `ContaReceber`, `ContaPagar` e `CaixaOrdemLiquidacao`.
- Botoes sensiveis de liquidar/cancelar/confirmar receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- `HistoricoLiquidacoes` passou a usar contexto por grupo/empresa, validar permissao de visualizacao e exibir alerta quando faltar contexto ou acesso.
- `ConciliacaoBancariaTab` passou a auditar geracao/cancelamento de conciliacao com IA, gravando usuario, grupo, empresa e periodo, alem de exigir confirmacao explicita antes da geracao.
- `GestaoRemessaRetorno` passou a auditar geracao de remessa, processamento de retorno e cancelamentos pelo usuario.
- Arquivos de retorno CNAB agora passam por validacao de tamanho limite de 5MB e bloqueio de conteudo inseguro antes de processar.
- Remessa, retorno e baixas automaticas preservam `group_id`, `grupo_id` e `empresa_id`, registrando usuario de criacao/processamento.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco dos componentes existentes.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `npm run build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nos relatórios financeiros e fluxos bancarios auxiliares, priorizando `FluxoCaixaProjetado`, `ExtratoBancarioResumo`, `MovimentosDiarios`, `CartoesACompensar` e `OrdensLiquidacaoPendentes` para revisar rateio, conciliacao final, auditoria antes/depois e exportacoes.

### Financeiro - Fase 8 Caixa Central e Envio para Liquidacao

- Seguido o proximo passo salvo no status: continuar Fase 8 nas telas de contas a receber/pagar e liquidacao, iniciando por `LiquidarReceberPagar` e `CaixaCentralLiquidacao`.
- `LiquidarReceberPagar` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Envio de contas a receber e contas a pagar para o Caixa agora exige contexto grupo/empresa, empresa selecionada, permissao RBAC financeira, titulos selecionados, valor valido e confirmacao explicita antes de criar ordens.
- Criacao de `CaixaOrdemLiquidacao` passou a preservar `group_id`, `grupo_id` e `empresa_id` em cada ordem e tambem nos titulos vinculados.
- Campos de cliente, fornecedor, numero de documento e descricao passaram por sanitizacao antes de exibir ou gravar nas ordens.
- Envio individual e em lote para o Caixa passou a auditar bloqueio por contexto/permissao/valor, cancelamento pelo usuario e sucesso com quantidade, total e ids dos titulos.
- Botoes sensiveis de envio ao Caixa receberam marcadores `data-action`, `data-permission`, `data-context-required` e `data-sensitive`.
- `CaixaCentralLiquidacao` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Consultas de pendencias do Caixa agora usam chave por contexto e so executam com contexto e permissao de visualizacao financeira.
- Abertura de modulos do Caixa passou a validar empresa selecionada e permissao, auditando bloqueio e abertura de modulos sensiveis como liquidacao, ordens, cartoes e conciliacao.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em `ContasReceberTab` e `ContasPagarTab`, reforcando baixa direta, baixa multipla, envio para Caixa, aprovacao de pagamento, exportacao e auditoria com contexto grupo/empresa.
### Financeiro - Fase 8 Contas a Receber/Pagar: baixa, envio ao Caixa e exportacao

- Seguido o proximo passo salvo no status: continuar Fase 8 em `ContasReceberTab` e `ContasPagarTab`.
- `ContasReceberTab` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Baixa direta e baixa multipla de contas a receber agora tambem validam contexto grupo/empresa e permissao RBAC dentro das mutations, sanitizam campos gravados e auditam sucesso/cancelamento/erro com usuario, `group_id`, `grupo_id` e `empresa_id`.
- Envio de contas a receber para o Caixa passou a validar permissao, contexto, quantidade, valor total e confirmacao dentro da operacao sensivel, preservando grupo/empresa nos titulos vinculados da ordem.
- Exportacao de contas a receber agora exige contexto, permissao e confirmacao, inclui `group_id`/`grupo_id`/`empresa_id` no CSV e registra auditoria contextualizada.
- Abertura de boleto em contas a receber passou a validar URL segura antes de abrir em nova aba.
- `ContasPagarTab` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Baixa direta e pagamento multiplo de contas a pagar agora tambem validam contexto e permissao dentro das mutations, tratam titulo inexistente antes de gravar movimento no Caixa, sanitizam campos e preservam `group_id`, `grupo_id` e `empresa_id` em `ContaPagar` e `CaixaMovimento`.
- Envio de contas a pagar para o Caixa passou a validar permissao, contexto, quantidade, valor total e confirmacao dentro da operacao sensivel, preservando grupo/empresa nos titulos vinculados da ordem.
- Aprovacao de pagamento em contas a pagar agora exige contexto, permissao e confirmacao, preserva contexto multiempresa e registra auditoria antes/depois.
- Exportacao de contas a pagar agora exige contexto, permissao e confirmacao, inclui `group_id`/`grupo_id`/`empresa_id` no CSV e registra auditoria contextualizada.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nos relatorios financeiros e fluxos bancarios auxiliares, priorizando `FluxoCaixaProjetado`, `ExtratoBancarioResumo`, `MovimentosDiarios`, `CartoesACompensar` e revisao final de exportacoes/auditoria por grupo/empresa.

### Financeiro - Fase 8 Relatorios e Fluxos Bancarios Auxiliares

- Seguido o proximo passo salvo no status: continuar Fase 8 em `FluxoCaixaProjetado`, `ExtratoBancarioResumo`, `MovimentosDiarios`, `CartoesACompensar` e revisao final de exportacoes/auditoria por grupo/empresa.
- `ExportMenu` foi reforcado no componente existente, sem criar exportador paralelo: agora respeita `disabled`, `columns`, contexto grupo/empresa, RBAC, confirmacao antes de exportar, sanitizacao de CSV/PDF e auditoria contextualizada.
- `FluxoCaixaProjetado` passou a auditar exportacao, cancelamento e bloqueio por falta de contexto/permissao, usando `group_id`, `grupo_id`, `empresa_id`, usuario e quantidade exportada.
- Exportacao do fluxo de caixa projetado agora usa as colunas configuradas, inclui contexto grupo/empresa nos dados e exige confirmacao explicita antes de CSV/PDF.
- `ExtratoBancarioResumo` passou a validar periodo antes da exportacao, exigir confirmacao explicita, auditar bloqueio/cancelamento/sucesso e incluir `group_id`, `grupo_id` e `empresa_id` no CSV.
- `MovimentosDiarios` passou a exigir confirmacao antes de imprimir, auditando cancelamento e impressao com contexto, operador, data e quantidade de movimentos.
- `CartoesACompensar` passou a bloquear compensacao sem valor liquido valido, confirmar compensacao com NSU/valor e gravar usuario/data de conciliacao mantendo `group_id`, `grupo_id` e `empresa_id`.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco dos componentes existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em relatorios gerenciais financeiros e dashboards de inadimplencia/rentabilidade, priorizando `DashboardInadimplencia`, `RelatorioFinanceiro`, `RelatorioDRE`, `RentabilidadeCliente` e `RentabilidadeProduto` para exportacoes, auditoria, contexto grupo/empresa e RBAC granular.

### Financeiro - Fase 8 Relatorios Gerenciais Financeiros

- Seguido o proximo passo salvo no status: continuar Fase 8 em relatorios gerenciais financeiros e dashboards de inadimplencia/rentabilidade.
- `DashboardInadimplencia` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Exportacao de inadimplencia passou a incluir contexto `group_id`, `grupo_id` e `empresa_id` nos dados exportados, usando o `ExportMenu` reforcado com RBAC, contexto e confirmacao.
- `RentabilidadeCliente` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Exportacao de rentabilidade por cliente passou a incluir periodo e contexto grupo/empresa nos dados exportados.
- `RentabilidadeProduto` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Exportacao de rentabilidade por produto passou a incluir periodo, ordenacao e contexto grupo/empresa nos dados exportados, mantendo bloqueio visual por contexto/permissao.
- `RelatorioFinanceiro` passou a exigir confirmacao antes de exportar CSV, auditar cancelamento/bloqueio/sucesso e carimbar `group_id`, `grupo_id` e `empresa_id` em cada linha exportada.
- `RelatorioDRE` passou a exigir confirmacao antes de exportar CSV, auditar cancelamento/bloqueio/sucesso e carimbar `group_id`, `grupo_id` e `empresa_id` em cada linha exportada.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco dos componentes existentes.
- `git diff --check` executado sem erros.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em relatorios comerciais/operacionais que ainda usam exportacao manual, priorizando `RelatorioVendas`, `RelatorioPedidosPorOrigem`, `RelatorioVendasPorRegiao`, `DREComparativo` e `RelatorioProducao` para confirmacao, auditoria, contexto grupo/empresa e RBAC granular.

### Financeiro/Comercial/Producao - Fase 8 Relatorios Comerciais e Operacionais

- Seguido o proximo passo salvo no status: continuar Fase 8 em relatorios comerciais/operacionais com exportacoes manuais.
- `RelatorioVendas` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Exportacoes de vendas mensais e top clientes agora exigem contexto grupo/empresa, permissao RBAC, confirmacao explicita, auditoria de bloqueio/cancelamento/sucesso e incluem `group_id`, `grupo_id` e `empresa_id` nas linhas exportadas.
- `RelatorioPedidosPorOrigem` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Exportacao de pedidos por origem agora exige contexto/permissao, confirma quantidade de origens e pedidos antes do CSV, audita cancelamento/bloqueio/sucesso e inclui contexto multiempresa no arquivo.
- `RelatorioVendasPorRegiao` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Exportacao de vendas por regiao agora confirma antes de gerar CSV, audita cancelamento/bloqueio/sucesso e carimba `group_id`, `grupo_id` e `empresa_id` em cada linha.
- `RelatorioProducao` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Exportacoes de producao mensal e top produtos agora exigem contexto/permissao, confirmacao explicita, auditoria contextualizada e exportam contexto grupo/empresa junto aos dados.
- `DREComparativo` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Exportacao via `ExportMenu` agora recebe contexto grupo/empresa nas linhas exportadas, bloqueio visual por contexto/permissao de exportacao e marcadores de permissao/contexto no container principal.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco dos fluxos de exportacao existentes.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 em relatorios e dashboards comerciais/producao ainda pendentes, priorizando `DashboardRepresentantes`, `RelatorioEstoque`, `RelatorioPersonalizado`, `AgendamentoRelatorios` e `SelectedOperationalReport` para contexto grupo/empresa, RBAC granular, confirmacoes, auditoria e sanitizacao de exportacoes.

### Relatorios - Fase 8 Dashboards Pendentes, Estoque e Agendamentos

- Seguido o proximo passo salvo no status: continuar Fase 8 em `DashboardRepresentantes`, `RelatorioEstoque`, `RelatorioPersonalizado`, `AgendamentoRelatorios` e `SelectedOperationalReport`.
- `DashboardRepresentantes` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Consultas de representantes, clientes e pedidos agora usam `filterInContext`, so executam com contexto grupo/empresa e permissao de visualizacao, e a exportacao exige RBAC, confirmacao, auditoria e carimba `group_id`, `grupo_id` e `empresa_id`.
- `RelatorioEstoque` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Exportacoes de movimentacoes mensais e estoque por grupo agora confirmam antes do CSV, auditam bloqueio/cancelamento/sucesso e incluem contexto grupo/empresa nas linhas exportadas.
- `RelatorioPersonalizado` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Relatorio personalizado agora consulta via `filterInContext`, respeita contexto/RBAC para gerar e exportar, sanitiza celulas CSV, confirma exportacoes CSV/Excel, audita bloqueio/cancelamento/sucesso e inclui contexto multiempresa no arquivo.
- `AgendamentoRelatorios` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Salvamento de agendamento agora sanitiza destinatarios, exige confirmacao, audita cancelamento/sucesso, preserva `group_id`, `grupo_id` e `empresa_id` e exibe erro quando contexto/permissao/destinatario impedem salvar.
- `SelectedOperationalReport` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Exportacao operacional selecionada agora valida contexto e permissao, confirma quantidade antes de exportar, audita bloqueio/cancelamento/sucesso e envia dados ao exportador ja carimbados com grupo/empresa.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco dos fluxos existentes.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nos relatorios especificos por area ainda pendentes, priorizando `DashboardCanaisOrigem`, `RelatoriosLogistica`, `RelatoriosProducao`, `RelatoriosEstoque` e dashboards realtime para contexto grupo/empresa, RBAC granular, confirmacoes e auditoria.

### Abertura Local - Correcao Modo Local Automatico

- Corrigida a abertura local do ERP no projeto do GitHub `ERP-Zuccaro-codeX-local`.
- Diagnostico confirmou que o servidor respondia, mas o frontend tentava chamar Base44 remoto em `null/api/apps/null/entities/User/me`, causando `Erro ao iniciar o ERP local`.
- `src/api/base44Client.js` foi reforcado no existente para entrar automaticamente em modo local quando nao houver `appId` e `serverUrl` remotos configurados, alem de respeitar `VITE_LOCAL_ONLY=true`.
- Validado em navegador headless local: `http://localhost:5173/` carregou o Dashboard sem a tela `Erro ao iniciar o ERP local`.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco do fluxo existente de inicializacao local.
- Proximo passo sugerido: continuar Fase 8 nos relatorios especificos por area ainda pendentes, priorizando `DashboardCanaisOrigem`, `RelatoriosLogistica`, `RelatoriosProducao`, `RelatoriosEstoque` e dashboards realtime para contexto grupo/empresa, RBAC granular, confirmacoes e auditoria.

### Cadastros Gerais - Restauracao Pessoas & Parceiros Local

- Corrigida a hidratacao local do snapshot apos a abertura automatica em modo local.
- Diagnostico confirmou que o snapshot do projeto possuia 8 registros em `Pessoas & Parceiros`, mas o banco local do navegador estava com zero porque a importacao ainda exigia `VITE_LOCAL_ONLY=true`.
- `src/api/localBase44Client.js` foi ajustado no fluxo existente para permitir a importacao do snapshot quando o ERP ja estiver operando em modo local automatico.
- Validado no navegador local em `http://localhost:5173/cadastros?tab=cadastros`: total de `Pessoas & Parceiros` voltou para 8, com Cliente 1, Colaborador 2, Representante 1, SegmentoCliente 3 e RegiaoAtendimento 1.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas restaurado o carregamento dos dados existentes do snapshot.
- Proximo passo sugerido: continuar Fase 8 nos relatorios especificos por area ainda pendentes, priorizando `DashboardCanaisOrigem`, `RelatoriosLogistica`, `RelatoriosProducao`, `RelatoriosEstoque` e dashboards realtime para contexto grupo/empresa, RBAC granular, confirmacoes e auditoria.

### Relatorios - Fase 8 Canais de Origem e Exportador Universal

- Seguido o proximo passo salvo no status: continuar Fase 8 em relatorios especificos por area ainda pendentes.
- `DashboardCanaisOrigem` foi reforcado no componente existente, sem criar tela, modulo, componente ou arquivo novo.
- Exportacao de performance por canal agora exige contexto grupo/empresa e permissao RBAC, pede confirmacao explicita para CSV/JSON, audita bloqueio/cancelamento/sucesso e inclui `group_id`, `grupo_id` e `empresa_id` nos dados exportados.
- `ExportButton` existente foi reforcado para sanitizar valores exportados em CSV/JSON, removendo quebras de linha e protegendo celulas iniciadas por `=`, `+`, `-` ou `@` contra formula injection.
- Mantida a Regra-Mae: nenhuma funcionalidade foi removida; apenas reforco dos fluxos de exportacao existentes.
- `git diff --check` executado sem erros; apenas aviso esperado de CRLF no Windows.
- Build validado com sucesso via `node node_modules/vite/bin/vite.js build`; permanecem apenas warnings tecnicos preexistentes de CSS, browserslist/baseline, imports dinamicos/estaticos e chunks grandes.
- Proximo passo sugerido: continuar Fase 8 nos dashboards realtime e relatorios de logistica/producao/estoque, priorizando a revisao final de `DashboardTempoReal`, `DashboardEntregasRealtime`, `DashboardProducaoRealtime`, `RelatoriosLogistica`, `RelatoriosProducao` e `RelatoriosEstoque` para auditoria de visualizacao/exportacao, RBAC granular e contexto multiempresa.
### Plano Mestre - Lote 1: Baseline Reproduzivel e Testes Iniciais
- Trabalho executado somente no clone interno `C:\Users\cpaba\ERP-Zuccaro-codeX-local\ERP-Zuccaro-codeX`; o projeto do HD externo nao foi alterado.
- Adicionado `npm run audit:baseline`, que inventaria paginas, componentes, funcoes, schemas locais, arquivos grandes, marcadores de codificacao, candidatos legados e controles interativos.
- Linha de base em 2026-08-30: 46 paginas, 1.237 componentes, 70 funcoes Base44, 1.405 arquivos-fonte, 88 arquivos acima de 600 linhas e 423 arquivos com marcadores de codificacao quebrada.
- O inventario encontrou 3.704 controles interativos, 1.325 marcadores `data-action`, 1.501 marcadores `data-permission` e 291 candidatos legados que exigem revisao antes de qualquer exclusao.
- Configurado `npm test` com o test runner nativo do Node, sem instalar bibliotecas novas.
- Criados 5 testes para o inventario, isolamento de perfis RBAC, bloqueio de exclusao sem contexto/permissao e estatisticas dos cards.
- Validacao inicial: 5 testes executados, 5 aprovados e nenhuma falha.
- `git diff --check` aprovado e build de producao aprovado com 3.784 modulos transformados.
- Baseline de qualidade preexistente: lint global falha com 581 erros e 20 avisos; typecheck global falha com 14.003 diagnosticos.
- As falhas de lint concentram arquivos de documentacao gravados como `.jsx`, blocos vazios e alguns erros reais de sintaxe/variaveis; nenhuma regra foi desativada para ocultar a divida.
- O build mantem avisos preexistentes de CSS, imports mistos e bundle principal grande; esses itens entram na fila de estabilizacao sem remocao automatica.
- Nenhuma funcionalidade, tela, botao, entidade ou dado foi excluido.
- Proximo passo obrigatorio: corrigir o comportamento fail-open do `entityGuard` e dos wrappers do `Layout.jsx`, com testes para mutacoes e funcoes sensiveis.

### Plano Mestre - Lote 2: RBAC Fail-Closed em Operacoes Sensiveis
- Centralizada a decisao pura de permissoes do backend em `entityGuardPolicy`, reutilizando a funcao existente `entityGuard` sem criar tela ou modulo paralelo.
- A permissao `visualizar` nao autoriza mais `editar`, `excluir`, `aprovar`, `executar` ou qualquer outra mutacao.
- Usuario nao administrador sem perfil de acesso agora recebe bloqueio; falha ao carregar o perfil retorna indisponibilidade segura em vez de acesso liberado.
- O `AuditLog` permanece imutavel para criacao, edicao e exclusao via guard; administradores continuam autorizados a gerir perfis de acesso.
- O wrapper global em `Layout.jsx` exige resposta `allowed: true`; mutacoes e funcoes sensiveis sao bloqueadas quando o guard estiver indisponivel.
- Leituras simples mantem tolerancia a indisponibilidade transitoria para evitar derrubar a navegacao, sem liberar escrita.
- Adicionados 4 testes de aliases, acao exata, modulo/secao e separacao entre leitura e mutacao.
- Suite total apos o lote: 9 testes executados, 9 aprovados e nenhuma falha.
- Nenhuma permissao foi concedida automaticamente, nenhuma tela foi removida e nenhum dado foi alterado.
- Proximo passo obrigatorio: padronizar e testar o contrato canonico `groupId`, `empresaId` e `scopeType` no frontend e backend.

### Plano Mestre - Lote 3: Contrato Canonico Multiempresa
- Criado o helper interno `contextoMultiempresaPolicy` para normalizar aliases e expor o contrato unico `{ groupId, empresaId, scopeType }` no frontend.
- O contexto Grupo exige `groupId`; o contexto Empresa exige simultaneamente `groupId` e `empresaId`.
- `useContextoVisual` agora entrega `contextoCanonico`, `contextoValido` e `erroContexto`, preservando os helpers e telas existentes.
- Consultas globais via wrappers de `list` e `filter` retornam vazio quando o contexto estiver incompleto, sem misturar dados entre empresas.
- Gravacoes e verificacoes RBAC sao bloqueadas antes da operacao quando faltar Grupo ou Empresa obrigatoria.
- O `Layout.jsx` injeta `scope_type`, `group_id` e `empresa_id` nas chamadas protegidas, inclusive chamadas diretas ao `entityGuard` feitas por componentes existentes.
- O backend `entityGuard` normaliza os mesmos aliases e rejeita contexto incompleto antes de avaliar administrador ou perfil.
- Adicionados 5 testes de contrato e isolamento; suite total apos o lote: 14 testes executados, 14 aprovados e nenhuma falha.
- `git diff --check`, verificacoes de sintaxe e build completo aprovados; servidor local do clone interno respondeu HTTP 200.
- Permanecem avisos preexistentes de CSS, imports mistos, Browserslist e bundle grande, sem ampliacao neste lote.
- Nenhuma tela, funcionalidade ou dado foi removido; o projeto do HD externo nao foi alterado.
- Proximo passo obrigatorio: ampliar os testes de isolamento e endurecer as funcoes backend que ainda chamam o guard sem propagar o contexto canonico.

### Plano Mestre - Lote 4: Guard Obrigatorio em Funcoes Criticas
- Centralizada em `guardCallPolicy` a chamada backend ao `entityGuard`, a conclusao de `group_id` a partir da Empresa e a exigencia de resposta explicita `allowed: true`.
- A politica de conflitos multiempresa agora valida o payload antes do guard e nao continua quando houver negacao ou indisponibilidade.
- `nfeActions` exige Empresa fiscal, completa o Grupo e valida permissao antes de emitir, cancelar, consultar ou corrigir NF-e.
- `piiEncryptor` carrega o registro, extrai seu contexto e bloqueia criptografia ou descriptografia quando o guard nao autorizar.
- `paymentStatusManager` passou a enviar o contexto canonico nas baixas e conciliacoes financeiras e deixou de ignorar falhas do guard.
- Adicionados 4 testes para aliases, conclusao do Grupo pela Empresa, bloqueio por contexto ausente, negacao, indisponibilidade e autorizacao explicita.
- Suite total apos o lote: 18 testes executados, 18 aprovados e nenhuma falha.
- Sintaxe das quatro funcoes e do helper validada; `git diff --check` aprovado e build completo aprovado com 3.785 modulos.
- Permanecem para o proximo lote as chamadas em eventos fiscais, roteirizacao, boleto, IA financeira e integracoes legadas, alem da validacao de pertencimento do registro ao contexto informado.
- Nenhuma tela, fluxo ou dado foi removido; o projeto do HD externo nao foi alterado.
- Proximo passo obrigatorio: aplicar o helper estrito nas chamadas backend restantes e testar que IDs de outra Empresa/Grupo sejam recusados.

### Plano Mestre - Lote 5: Cobertura Total das Chamadas ao Guard
- Todas as chamadas backend ao `entityGuard` agora passam exclusivamente por `guardCallPolicy`; nenhuma funcao operacional mantem chamada direta ou tratamento permissivo.
- Reforcados os fluxos existentes de boleto, IA financeira, integracoes legadas, autorizacao fiscal, pedido pronto para faturar e otimizacao de rota.
- Chamadas de usuario exigem permissao explicita; automacoes internas podem manter seu fluxo autenticado, mas nunca executam consulta financeira global sem `group_id`.
- `paymentStatusManager` compara Grupo e Empresa do registro com o contexto solicitado antes de efetuar baixa, aprovacao, cancelamento ou conciliacao.
- Um registro da 3Z LTDA e recusado quando processado no contexto da CPA Ferro e Aco; outro Grupo e registro sem `group_id` tambem sao recusados.
- Adicionado teste de pertencimento multiempresa; suite total apos o lote: 19 testes executados, 19 aprovados e nenhuma falha.
- Busca estatica confirmou zero chamadas diretas restantes ao `entityGuard` fora do helper central.
- Sintaxe das oito funcoes validada, `git diff --check` aprovado e build completo aprovado com 3.785 modulos.
- Avisos preexistentes de CSS, Browserslist, imports mistos e bundle grande permanecem registrados para estabilizacao posterior.
- Nenhuma tela, funcionalidade ou dado foi removido; o projeto do HD externo nao foi alterado.
- Proximo passo obrigatorio: corrigir a divida de lint/typecheck por lotes pequenos, iniciando por erros reais de sintaxe e variaveis na fundacao, sem alterar arquivos-documentacao em massa.

### Plano Mestre - Lote 6: Validacao Operacional Confiavel

- Trabalho executado somente no clone interno `C:\Users\cpaba\ERP-Zuccaro-codeX-local\ERP-Zuccaro-codeX`; o projeto do HD externo nao foi acessado nem alterado.
- Documentos historicos foram preservados com seus nomes e conteudos originais.
- O ESLint agora separa dinamicamente arquivos `.md.jsx`, conteudo Markdown e os artefatos JSON conhecidos da validacao operacional.
- O `audit:baseline` continua inventariando esses arquivos e passou a detectar se algum deles for importado por codigo executavel.
- Inventario atual: 1.411 arquivos-fonte, 1.238 componentes, 312 artefatos historicos e zero importacoes desses artefatos pelo runtime.
- Corrigidos filtro indefinido do RH, nomes dos componentes de portal que usam hooks, blocos `case`, JSX do mapa logistico, propriedades de estilo invalidas, escapes desnecessarios e textos quebrados na Gestao de Acessos.
- `import.meta.env` passou a receber os tipos oficiais de `vite/client`, mantendo `checkJs` ativo.
- Lint operacional caiu de 580 para 248 erros; 246 sao catches vazios reservados ao Lote 8 e 2 pertencem ao guard desativado do botao compartilhado, tambem reservado ao Lote 8. Permanecem 20 avisos de diretivas antigas.
- Typecheck permanece aberto sem ocultacao: TS2322 8.111, TS2559 3.173, TS2339 1.759 e TS2741 555 sao as maiores familias para o Lote 7.
- Validacao: 20 testes executados e aprovados, `git diff --check` aprovado e build completo aprovado com 3.785 modulos transformados.
- O build preserva avisos preexistentes de CSS, Browserslist, imports mistos e bundle principal grande.
- Nenhuma tela, funcionalidade, documento ou dado foi removido.
- Proximo passo obrigatorio: executar o Lote 7, tipando por JSDoc os componentes compartilhados existentes e o contrato dinamico Base44, com prioridade para TS2322, TS2559, TS2339 e TS2741.

### Plano Mestre - Lote 7: Contratos dos Componentes Compartilhados

- Tipados por JSDoc os componentes existentes de Button, Input, Tabs, Select, Dialog, Card, Form, Tooltip, Badge, Label, Alert, Textarea, Checkbox, Switch, Popover, Table e Dropdown Menu.
- Os contratos reutilizam tipos nativos do React e das primitivas Radix; propriedades opcionais permanecem opcionais conforme o comportamento atual.
- O ponto publico `base44` passou a usar o contrato oficial `Base44Client` do SDK para entidades dinamicas, funcoes, autenticacao e integracoes, sem criar `any` global no ERP.
- O usuario local recebeu os campos obrigatorios do contrato oficial de autenticacao, preservando os campos customizados de Grupo e Empresa.
- O cache compartilhado do guard no `window` recebeu contrato explicito, sem alterar TTL ou comportamento neste lote.
- Typecheck caiu de 14.003 para 1.788 diagnosticos, reducao aproximada de 87%; TS2322 caiu de 8.111 para 166, TS2559 de 3.173 para 30 e TS2741 de 555 para 63.
- TS2339 permanece como maior familia, agora concentrada em componentes de dominio, primitivas secundarias e objetos locais que exigem contratos especificos.
- Validacao: 20 testes aprovados, lint sem regressao (248 erros e 20 avisos ja registrados), `git diff --check` e build completo com 3.785 modulos.
- Nenhuma tela, funcionalidade, dado ou permissao foi removido; o projeto do HD externo nao foi acessado.
- Proximo passo obrigatorio: executar o Lote 8, ativando o guard backend fail-closed do Button e classificando catches vazios por criticidade antes de corrigir o restante do typecheck no Lote 9.

### Plano Mestre - Lote 8A: Guard Fail-Closed e Erros Criticos

- O `Button` compartilhado deixou de executar a acao enquanto o guard ainda responde; somente `allowed: true` libera o handler sensivel.
- Negacao, indisponibilidade ou contexto incompleto agora bloqueiam o clique e exibem mensagem ao usuario.
- A permissao estavel `modulo.recurso.acao` e transformada em payload com `group_id`, `empresa_id` e `scope_type` canonicos.
- `Button`, `ProtectedAction` e `ProtectedSection` passaram a compartilhar cache e requisicoes em voo no formato unico `Promise<boolean>`, evitando mistura de respostas.
- Os wrappers `ProtectedAction` e `ProtectedSection` deixaram de aceitar permissao local como decisao final e falham fechados se o backend estiver indisponivel.
- Falhas de auditoria em contexto multiempresa, backup, encerramento de sessoes e App Motorista agora sao informadas no console; falha ao preparar assinatura bloqueia a confirmacao da entrega e informa o motorista.
- Falhas opcionais de `localStorage` no contexto foram justificadas no codigo porque o estado em memoria permanece ativo.
- `audit:baseline` passou a contar catches vazios operacionais por arquivo: foram encontrados 436 no frontend e backend; 217 ainda estao no escopo atual do ESLint.
- Adicionados 4 testes para contexto do guard sensivel, negacao/indisponibilidade e compartilhamento do cache. Suite total: 24 testes aprovados.
- Lint operacional caiu de 248 para 217 erros, todos `no-empty`; permanecem 20 avisos de diretivas antigas.
- `git diff --check` aprovado e build completo aprovado com 3.786 modulos transformados.
- Nenhuma tela, acao ou dado foi removido; o projeto do HD externo nao foi acessado.
- Proximo passo obrigatorio: Lote 8B, revisar catches vazios das funcoes backend por risco, comecando por `solicitacoesAprovacao`, `iaFinanceAnomalyScan`, `legacyIntegrationsMirror`, eventos de pedido/NF-e, pagamentos, fiscal e roteirizacao; depois iniciar o Lote 9.

### Plano Mestre - Lote 8B: Falhas Backend Rastreaveis

- As funcoes existentes `solicitacoesAprovacao`, `iaFinanceAnomalyScan`, `legacyIntegrationsMirror`, `onNotaFiscalAuthorized`, `onPedidoCreated` e `paymentStatusManager` deixaram de ignorar falhas auxiliares.
- A central de aprovacoes registra falhas de auditoria, politica, notificacao, escalonamento de nivel e aplicacao da decisao ao pedido com os identificadores disponiveis.
- Eventos de pedido e NF-e, pagamentos e integracoes legadas registram a operacao, Grupo, Empresa e documento relacionados, sem interromper notificacoes de melhor esforco.
- A analise financeira continua quando uma fonte secundaria falhar, mas agora devolve warnings no resultado e registra cada etapa incompleta; assim, resultado parcial nao e apresentado como analise integral.
- O inventario de catches vazios operacionais caiu de 436 para 352, reducao de 84 ocorrencias neste lote. As seis funcoes tratadas ficaram com zero catches vazios.
- Validacao: sintaxe das funcoes alteradas aprovada, 24 testes aprovados, `git diff --check` aprovado e build completo aprovado com 3.786 modulos.
- Lint permanece com 217 erros `no-empty` no frontend e 20 avisos; typecheck permanece com 1.788 diagnosticos. Essa divida ja esta delimitada para o Lote 9 e nao foi ocultada nem desabilitada.
- Permanecem os avisos preexistentes de seletor CSS, dados Browserslist, imports mistos e bundle principal grande.
- Nenhuma tela, funcionalidade ou dado foi removido; o projeto do HD externo nao foi acessado.
- O sublote final tambem eliminou 22 catches vazios de `fleetMaintenance`, `fiscalValidation`, `nfeActions` e `optimizeDeliveryRoute`, encerrando o inventario do Lote 8B em 330 ocorrencias.
- Sintaxe das quatro funcoes aprovada, 24 testes aprovados, `git diff --check` aprovado e build completo aprovado com 3.786 modulos.
- Proximo passo obrigatorio: iniciar o Lote 9 pelo `Layout.jsx` e pelo seletor CSS invalido, mantendo a reducao do lint e typecheck em lotes verificaveis.

### Plano Mestre - Lote 9A: Layout e CSS Operacionais

- O seletor global de botao passou a usar correspondencia por token de classe, preservando o estilo primario e evitando a combinacao invalida com variantes Tailwind.
- O build deixou de emitir o aviso CSS Unexpected button.
- Falhas de propagacao do Grupo, invalidacao de consultas, auditoria de entidades, criptografia de dados pessoais e wrappers globais do Layout agora sao rastreaveis.
- A sanitizacao de parametros de funcoes backend deixou de continuar silenciosamente quando falhar; a chamada e bloqueada antes de chegar ao backend.
- Falha ao injetar contexto tambem bloqueia funcoes sensiveis, preservando o comportamento fail-closed.
- Lint operacional caiu de 217 para 200 erros; permanecem 20 avisos. O inventario de catches vazios caiu de 330 para 313.
- Validacao: 24 testes aprovados, `git diff --check` aprovado e build completo aprovado com 3.786 modulos.
- Permanecem os avisos preexistentes de Browserslist, imports mistos e bundle principal grande.
- Nenhuma tela, funcionalidade ou dado foi removido; o projeto do HD externo nao foi acessado.
- Proximo passo obrigatorio: concluir os catches opcionais de PWA, cache e telemetria do `Layout.jsx`, depois seguir pelos arquivos com maior concentracao de erros de lint.

### Plano Mestre - Lote 9B: PWA, Cache e Telemetria

- O `Layout.jsx` encerrou o sublote com zero catches vazios.
- Falhas auxiliares do React Query, PWA, Service Worker, cache offline, captura global de erros, navegacao, prefetch e telemetria agora sao registradas sem interromper a interface.
- O comportamento offline e as atualizacoes do PWA foram preservados; nenhuma funcionalidade foi removida.
- Lint operacional caiu de 200 para 160 erros; permanecem 20 avisos. O inventario global de catches vazios caiu de 313 para 273.
- Validacao: 24 testes aprovados, `git diff --check` aprovado e build completo aprovado com 3.786 modulos.
- Proximo passo obrigatorio: seguir pelos arquivos com maior concentracao de erros, iniciando por `AprovacaoComAssinatura.jsx`, `localBase44Client.js` e `uiAudit.jsx`, e retomar a reducao do typecheck por contratos de dominio.

### Plano Mestre - Lote 9C: Assinatura, Cliente Local e Auditoria UI

- `AprovacaoComAssinatura.jsx`, `localBase44Client.js` e `uiAudit.jsx` ficaram com zero catches vazios e passaram no ESLint direcionado.
- O fluxo de assinatura registra falhas de alcada, auditoria, notificacoes, fidelidade, cache e navegacao com os identificadores do orcamento, pedido ou cliente.
- O cliente Base44 local deixou de continuar com sanitizacao alternativa quando `sanitizeOnWrite` falhar; a gravacao agora falha fechada.
- Falhas de banco local, usuario, auditoria, listeners, snapshot, analytics e contexto deixaram de ser silenciosas.
- A auditoria de UI passou a capturar tambem rejeicoes assincronas na persistencia de acoes e problemas.
- Inventario global de catches vazios caiu de 273 para 241. Lint global encerrou com 139 erros e o typecheck caiu de 1.788 para 1.778 diagnosticos.
- Validacao: 24 testes aprovados, ESLint direcionado aprovado, `git diff --check` aprovado e build completo aprovado com 3.786 modulos em 46,10 segundos.
- Permanecem os avisos preexistentes de Browserslist, imports mistos e bundle principal grande.
- Nenhuma tela, funcionalidade ou dado foi removido; o projeto do HD externo nao foi acessado.
- Proximo passo obrigatorio: continuar pelos arquivos com maior numero de catches vazios no inventario e corrigir contratos de dominio TS2339/TS2741 em lotes separados.

### Plano Mestre - Lote 9D: Guard, Consolidacao e WhatsApp

- O guard backend compartilhado ficou sem catches vazios e teve removido um fechamento de bloco excedente.
- Falha ao validar segregacao de funcoes (SoD) agora bloqueia a operacao com status 503, em vez de permitir silenciosamente.
- Falha ao completar `group_id` a partir da Empresa tambem retorna indisponibilidade segura, sem devolver dados sem contexto.
- `groupConsolidation` exige Grupo ou Empresa para todos os usuarios, inclusive administradores, e aceita os aliases canonicos no nivel superior ou dentro de `filtros`.
- `whatsappSend` passou a validar RBAC backend em chamadas de usuario, preservando automacoes autenticadas pelo token interno, e bloqueia envio sem numero resolvido.
- As tres funcoes ficaram com zero catches vazios; o inventario global caiu de 241 para 227 ocorrencias.
- Validacao: sintaxe das funcoes aprovada, 24 testes aprovados, `git diff --check` aprovado e build completo aprovado com 3.786 modulos em 42,56 segundos.
- Lint frontend permanece com 139 erros e typecheck com 1.778 diagnosticos, sem regressao neste sublote backend.
- Nenhuma tela, funcionalidade ou dado foi removido; o projeto do HD externo nao foi acessado.
- Proximo passo obrigatorio: tratar `IntentEngine.jsx`, importador de produtos, portal de chamados e os contratos TS2339/TS2741 de maior propagacao.

### Plano Mestre - Lote 9E: Intents, Importacao de Produtos e Chamados

- O trabalho foi executado somente no clone interno `C:\Users\cpaba\ERP-Zuccaro-codeX-local\ERP-Zuccaro-codeX`; o projeto do HD externo nao foi acessado nem alterado.
- `IntentEngine.jsx` registra falhas ao carregar intents dinamicas, usar IA, consultar cadastros auxiliares, emitir boleto e persistir auditorias, preservando os fallbacks existentes.
- `ImportadorProdutosPlanilha.jsx` registra falhas de codificacao e dos extratores alternativos sem interromper a leitura por outro formato.
- A criacao automatica de unidades de medida agora e ignorada quando a consulta das unidades existentes falha, evitando duplicidades; o preview permanece disponivel e informa o usuario.
- `ChamadosCliente.jsx` exige `group_id` e `empresa_id` para consultar e criar chamados, sanitiza o payload e grava o mesmo contexto nas auditorias.
- Falhas de abertura, gamificacao, auditoria e atualizacao de cache do Portal deixaram de ser silenciosas e apresentam mensagem quando a operacao principal falhar.
- Os tres componentes ficaram com zero catches vazios e passaram no ESLint direcionado sem erros ou avisos.
- O inventario global caiu de 227 para 210 catches vazios. O lint global caiu de 139 para 122 erros e zero avisos; o typecheck permaneceu em 1.778 diagnosticos, sem regressao.
- Validacao: 24 testes aprovados, `git diff --check` aprovado e build completo aprovado com 3.786 modulos em 15,32 segundos.
- Permanecem avisos preexistentes de dados Browserslist desatualizados, imports mistos e bundle principal grande.
- Nenhuma tela, botao, funcionalidade ou dado foi removido.
- Proximo passo obrigatorio: tratar as excecoes silenciosas das paginas `Comercial.jsx` e `Dashboard.jsx` e das funcoes backend com maior concentracao, depois continuar os contratos TS2339/TS2741 em lote separado.

### Plano Mestre - Lote 9F: Comercial e Dashboard Contextuais

- O trabalho foi executado somente no clone interno C:\Users\cpaba\ERP-Zuccaro-codeX-local\ERP-Zuccaro-codeX; o projeto do HD externo nao foi acessado nem alterado.
- Comercial e Dashboard agora consideram valido o modo Grupo somente com groupId e o modo Empresa somente com groupId e empresaId.
- Todas as consultas e invalidacoes alteradas usam chaves com scopeType, Grupo e Empresa, impedindo reaproveitamento de cache entre CPA Ferro e Aco, 3Z LTDA e a visao consolidada.
- Assinaturas realtime do Dashboard so sao abertas para entidades cujo setor o usuario pode visualizar; Comercial aplica a mesma regra para Pedidos, Comissoes e Notas Fiscais.
- Auditorias sem contexto nao geram registro global. Falhas de cache, auditoria, armazenamento local e encerramento das assinaturas deixaram de ser silenciosas.
- As duas paginas ficaram com zero catches vazios e passaram no ESLint direcionado sem erros ou avisos.
- O inventario global caiu de 210 para 200 catches vazios. O lint global caiu de 122 para 112 erros e zero avisos; o typecheck permaneceu em 1.778 diagnosticos.
- Validacao: 24 testes aprovados, git diff --check aprovado e build completo aprovado com 3.786 modulos em 16,05 segundos.
- Permanecem avisos preexistentes de dados Browserslist desatualizados, imports mistos e bundle principal grande.
- Nenhuma tela, grafico, card, aba, filtro, atualizacao automatica, funcionalidade ou dado foi removido.
- Proximo passo obrigatorio: executar o Lote 9G em syncGroupCompany e upsertConfig, com testes de isolamento, retentativa e autorizacao backend.
