### P0.24 / Acesso mestre local - perfil wildcard reidratado
- Objetivo: restaurar acesso mestre do Administrador Local para homologacao (sem criar ControlesV2).
- Diagnostico: sessao local perdia `role=admin`/perfil; UI em "Usuário"; `ProtectedSection` bloqueava todos os modulos; `*` do perfil so era preenchido se ausente.
- Causa raiz: `normalizeLocalUser` permitia `role: user` no id mestre; perfil admin nao era forçado a cada load.
- Arquivos alterados: `localBase44Client.js`, `tests/entity-guard-policy.test.js`, `STATUS`.
- Reutilizado: `GRANULAR_PERMISSION_ACTIONS`, `local_perfil_admin`, `entityGuard` local.
- Alteracoes: `isMasterLocalUser` + `buildMasterLocalPermissions`; mestre sempre admin + `local_perfil_admin` + `*`; usuario comum com perfil restrito permanece fail-closed.
- Multiempresa/RBAC: sem bypass por role no frontend; mestre via perfil wildcard existente.
- Pendencia: Go-Live humano Gates 18-20; criar usuario comum depois do teste mestre.
- Validacoes: `node --test tests/entity-guard-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: HUMAN_ONLY Gates 18-20 (com ERP acessivel para piloto).
### P0.23 / Fiscal-Comercial residual - NF mock e Pedidos audit fail-closed
- Objetivo: fechar mock emitir/cancelar como SEFAZ real e audit vazio em PedidosTab (sem FiscalV2/ComercialV2).
- Diagnostico: `NotasFiscaisTab` gravava Autorizada/Cancelada apos mock sem stamp; cancel sempre `mockCancelarNFe`; audit warn-only; PedidosTab `catch (_) {}`; contexto OR.
- Causa raiz: residual P0.9 nao distinguiu homologacao carimbada de producao no cancel/update.
- Arquivos alterados: `notaFiscalEmissaoPolicy.js`, `NotasFiscaisTab.jsx`, `PedidosTab.jsx`, `tests/nota-fiscal-emissao-policy.test.js`, `STATUS`.
- Reutilizado: `assertEmissaoNFe`, `cancelarNFe`, padrao stamp simulacao (marketplace/NF recebimento).
- Alteracoes: `assertCancelamentoNFe` + `stampNotaFiscalSimulacao`; mock so com `permiteSimulacao`; producao usa `cancelarNFe`/`emitirNFe`; audit rethrow; contexto grupo+empresa.
- Multiempresa/RBAC: Fiscal emitir/cancelar e Comercial Pedido preservados.
- Pendencia: Go-Live humano Gates 18-20.
- Validacoes: `node --test tests/nota-fiscal-emissao-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: HUMAN_ONLY Gates 18-20.
### P0.22 / Compras residual - Solicitacao/Cotacao/Fornecedor fail-closed
- Objetivo: fechar OR fail-open e audit warn-only nas telas irmas de Compras (sem ComprasV2).
- Diagnostico: Solicitacao/Cotacao/Avaliacao/Fornecedores ainda com `groupId||empresaId` e audit sem rethrow apos P0.21.
- Causa raiz: lote OC/launcher nao cobriu o restante do modulo Compras.
- Arquivos alterados: `SolicitacaoCompraForm.jsx`, `CotacaoForm.jsx`, `CotacoesTab.jsx`, `AvaliacaoFornecedorForm.jsx`, `FornecedoresTabOptimized.jsx`, `DetalhesFornecedor.jsx`, testes, `STATUS`.
- Reutilizado: padrao P0.21 (group + grupo|empresa; audit throw).
- Alteracoes: contexto fail-closed; auditoria obrigatoria; `group-and-company`.
- Multiempresa/RBAC: permissoes Compras existentes preservadas.
- Pendencia: NotasFiscaisTab mock emitir/cancelar; PedidosTab audit vazio; Go-Live humano Gates 18-20.
- Validacoes: `node --test tests/migracao-erp-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: residual Fiscal/Comercial mock/audit ou HUMAN_ONLY Gates 18-20.
### P0.21 / Compras residual - OC e launcher NF-e fail-closed
- Objetivo: fechar OR fail-open e audit silencioso em OC/recebimento/launcher (sem ComprasV2).
- Diagnostico: `OrdensCompraTab` e `RecebimentoOCForm` com grupo-OR-empresa; audit OC so warn; `BotoesImportacaoProduto` com `catch (_)`.
- Causa raiz: telas irmas fora do contrato dos importadores Gate 18.
- Arquivos alterados: `OrdensCompraTab.jsx`, `RecebimentoOCForm.jsx`, `BotoesImportacaoProduto.jsx`, `tests/migracao-erp-policy.test.js`, `PLANO_GO_LIVE.md`.
- Reutilizado: padrao `ImportacaoProdutoNFe` (group + grupo|empresa), audit rethrow.
- Alteracoes: contexto fail-closed; auditoria obrigatoria; launcher alinhado ao filho NF-e.
- Multiempresa/RBAC: Compras OC criar/aprovar/enviar/receber; Cadastros Produto importar.
- Pendencia: Go-Live humano Gates 18-20.
- Validacoes: `node --test tests/migracao-erp-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: HUMAN_ONLY Gates 18-20.
### P1.10 / Marketplace residual - sync simulado nao importavel
- Objetivo: fechar residual fail-open nas syncs Marketplace (sem MarketplaceV2).
- Diagnostico: audit com warn; simulacao gravava PedidoExterno importavel; Cliente sem provenance.
- Causa raiz: preview local tratado como pedido real apos P1.9.
- Arquivos alterados: `marketplacePedidoPolicy.js`, `SincronizacaoMarketplacesAtiva.jsx`, `SincronizacaoMarketplaces.jsx`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `stampMarketplacePedido`, canal ativo, ValidarPedidosExternos.
- Alteracoes: `stampPedidoExternoSimulacao`; import bloqueia simulado; audit rethrow; Cliente com origem marketplace.
- Multiempresa/RBAC: group+empresa ja exigidos; Integracoes criar/editar/executar.
- Pendencia: OAuth/API real marketplace; Go-Live humano Gates 18-20.
- Validacoes: `node --test tests/marketplace-pedido-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: HUMAN_ONLY Gates 18-20.
### P0.20 / Gate 18 residual - ImportacaoNFeRecebimento fail-closed
- Objetivo: impedir recebimento mock gravar estoque e fechar OR/audit fail-open (sem RecebimentoV2).
- Diagnostico: contexto grupo-OR-empresa; audit com warn; preview mock confirmava MovimentacaoEstoque com IDs ficticios.
- Causa raiz: tela de preview IA ainda tratava simulacao como recebimento real.
- Arquivos alterados: `ImportacaoNFeRecebimento.jsx`, `tests/migracao-erp-policy.test.js`, `PLANO_GO_LIVE.md`.
- Reutilizado: `createInContext`/`filterInContext`, padrao audit dos importadores NF-e.
- Alteracoes: exige group+empresa; audit rethrow; `simulacao` bloqueia confirm; produto deve existir no contexto.
- Multiempresa/RBAC: Compras/Estoque criar conforme permissao existente.
- Pendencia: parser XML real nesta tela (ou redirecionar ao Fiscal); Go-Live humano Gates 18-20.
- Validacoes: `node --test tests/migracao-erp-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: HUMAN_ONLY Gates 18-20.
### P0.19 / Gate 18 residual - ImportarXMLNFe fail-closed
- Objetivo: alinhar importacao fiscal XML NF-e ao contrato de migracao (sem MigracaoV2).
- Diagnostico: `ImportarXMLNFe` criava Produto/Fornecedor sem stamp; OR fail-open; audit via entity global com warn silencioso.
- Causa raiz: fluxo fiscal de compras ficou fora dos lotes P0.15/P0.18 de Cadastros.
- Arquivos alterados: `ImportarXMLNFe.jsx`, `tests/migracao-erp-policy.test.js`, `PLANO_GO_LIVE.md`.
- Reutilizado: `stampMigracaoRecord`, `assertReconciliacaoMigracao`, `createInContext`.
- Alteracoes: exige group+empresa; stamp nfe_xml em Fornecedor/Produto; reconciliacao; audit rethrow.
- Multiempresa/RBAC: Fiscal/Compras/Estoque criar conforme permissao existente.
- Pendencia: PAD/historicos humanos; ImportacaoNFeRecebimento micro residual; Gates 19-20 humanos.
- Validacoes: `node --test tests/migracao-erp-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: residual `ImportacaoNFeRecebimento` ou HUMAN_ONLY Gates 18-20.
### P0.18 / Gate 18 residual - ImportacaoProdutoNFe fail-closed
- Objetivo: alinhar o importador automatico NF-e gemelo ao contrato de migracao (sem MigracaoV2).
- Diagnostico: `ImportacaoProdutoNFe` ainda tinha OR fail-open, `catch (_)` em audit e create sem legado/lote/reconciliacao.
- Causa raiz: P0.15 fechou so `ImportarProdutosNFe`; o gemelo em Cadastros ficou fora.
- Arquivos alterados: `ImportacaoProdutoNFe.jsx`, `tests/migracao-erp-policy.test.js`, `PLANO_GO_LIVE.md`.
- Reutilizado: `stampMigracaoRecord`, `assertReconciliacaoMigracao`, padrao `ImportarProdutosNFe`.
- Alteracoes: contexto grupo+empresa; audit rethrow; stamp nfe_xml + reconciliacao; InvokeLLM com escopo.
- Multiempresa/RBAC: exige groupId e (grupo ou empresa); Cadastros/Estoque Produto criar.
- Pendencia: PAD/historicos em massa e rodada humana (Gate 18); 10 cenarios (Gate 19); virada Gate 20.
- Validacoes: `node --test tests/migracao-erp-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: HUMAN_ONLY Gates 18-20.
### P0.17 / Gate 20 residual - ConfiguracaoBackup load scoped
- Objetivo: fechar residual de leitura da config de backup/virada no escopo (sem BackupV2).
- Diagnostico: UI ainda usava `filter` + `configs[0]` apos o helper `resolveConfigBackupInScope` existir no client.
- Causa raiz: load path nao reutilizava o contrato fail-closed de escopo.
- Arquivos alterados: `ConfiguracaoBackup.jsx`, `tests/virada-producao-policy.test.js`, `PLANO_GO_LIVE.md`.
- Reutilizado: `resolveConfigBackupInScope`, `filterInContext`.
- Alteracoes: carga via contexto + resolve por group/empresa; sem fallback `[0]`.
- Multiempresa/RBAC: exige groupId; empresa no escopo empresa.
- Pendencia: Go-Live humano Gates 18-20 (PAD, 10 cenarios, virada operacional).
- Validacoes: `node --test tests/virada-producao-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: HUMAN_ONLY Gates 18-20.
### P0.16 / Gate 19-20 residual - piloto/virada fail-closed
- Objetivo: fechar residual de codigo no piloto e na virada (sem GoLiveV2).
- Diagnostico: cenario string auto-ok; StatusControleAcesso com OR e `rows[0]`; snapshot/restore fail-open sem ID; ConfiguracaoBackup `[0]` global; checklist so por toggle.
- Causa raiz: guards Gate 19/20 ainda fail-open apos persistencia inicial.
- Arquivos alterados: `pilotoOperacaoPolicy.js`, `viradaProducaoPolicy.js`, `StatusControleAcesso.jsx`, `ConfiguracaoBackup.jsx`, `localBase44Client.js`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: allowlist `CENARIOS_PILOTO`, `VIRADA_CHECKLIST`, `assertChecklistVirada`, client local.
- Alteracoes: string nao homologa; escopo obrigatorio; snapshot/restore fail-closed; config por escopo; assinatura `virada_confirmado_por`.
- Multiempresa/RBAC: exige groupId; empresa quando no escopo empresa; backup/virada no Sistema.Backup.
- Pendencia: 10 cenarios reais (Gate 19); backups/congelar/deltas/reconciliacao/contingencia humanos (Gate 20).
- Validacoes: `node --test tests/piloto-operacao-policy.test.js tests/virada-producao-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: Go-Live humano Gates 18-20 (PAD/arquivo, 10 cenarios, virada operacional).
### P0.15 / Gate 18 residual - NF-e import + backup audit fail-closed
- Objetivo: fechar residual Gate 18 no `ImportarProdutosNFe` e auditoria do `ConfiguracaoBackup` (sem MigracaoV2).
- Diagnostico: NF-e criava Produto sem legado/lote/reconciliacao; audit engolido; contexto grupo-OR-empresa; backup engolia falha de AuditLog.
- Causa raiz: importador NF-e fora do contrato `migracaoErpPolicy`; catch silencioso no backup.
- Arquivos alterados: `ImportarProdutosNFe.jsx`, `migracaoErpPolicy.js`, `ConfiguracaoBackup.jsx`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `stampMigracaoRecord`, `assertReconciliacaoMigracao`, padrao Lote/Planilha.
- Alteracoes: NF-e com `nfe_xml`, legado, lote, reconciliacao e auditoria obrigatoria; backup relanca erro de audit.
- Multiempresa/RBAC: exige grupo (+empresa no escopo empresa); Cadastros/Estoque Produto criar.
- Pendencia: PAD/historicos em massa e rodada humana (Gate 18); 10 cenarios reais (Gate 19); virada Gate 20.
- Validacoes: `node --test tests/migracao-erp-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: Gate 19/20 homologacao e virada humanas (codigo P0-P2/Gates 16-18 residuais fechados).
### P2.8 - Gate 17 residual: AGENT_FUNCTION_MAP sem elevacao asServiceRole
- Objetivo: fechar residual Gate 17 nas funcoes mapeadas de agente (heranca de permissao do usuario).
- Diagnostico: `iaFinanceAnomalyScan`, `iaChurnAnalyzer`, `productPriceOptimizer`, `optimizerOrchestrator`, `permissionOptimizer` ainda liam/gravavam via `asServiceRole`; `sodValidator` atualizava PerfilAcesso sozinho.
- Causa raiz: agentes/automacoes com privilegio acima do usuario autenticado.
- Arquivos alterados: entries das funcoes mapeadas, `sodValidator/entry.ts`, `tests/agente-autorizacao-policy.test.js`, `PLANO_GO_LIVE.md`.
- Reutilizado: `assertPermission`, `confirmado`, `AGENT_FUNCTION_MAP`, IAGovernanca para gravar SoD.
- Alteracoes: client autenticado nas funcoes de agente; SoD entity hook em modo sugestao.
- Multiempresa/RBAC: guards existentes preservados; escrita critica continua exigindo confirmacao.
- Pendencia: demais funcoes infra com asServiceRole (backup/webhook/seed) fora do mapa de agentes; Go-Live humano Gates 18-20.
- Validacoes: `node --test tests/agente-autorizacao-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: Gate 18-20 (virada/homologacao humana).
### P2.7 - Gate 16/17 residual: Fiscal, Governanca SoD e scorer sem elevacao
- Objetivo: fechar residual Motor Fiscal + IAGovernanca + `oportunidadeScorer` (sem IAV2/AgenteV2).
- Diagnostico: MotorFiscal lia Pedido/Empresa/Produto global e toast de aprovacao; Governanca gravava `PerfilAcesso` e LogsIA Automatico; scorer usava `asServiceRole`.
- Causa raiz: IA/agente fora do contrato de sugestao + heranca de permissao do usuario.
- Arquivos alterados: `iaTransversalPolicy.js`, `MotorFiscalInteligente.jsx`, `IAGovernancaCompliance.jsx`, `oportunidadeScorer/entry.ts`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `assertIaUiContext`, `requireIaHumanConfirm`, `stampIaLogSugestao`, `filterInContext`/`updateInContext`.
- Alteracoes: fiscal so sugere; SoD em memoria + gravacao com confirm; scorer no cliente autenticado.
- Multiempresa/RBAC: contexto grupo/empresa; Fiscal.visualizar; Sistema.Seguranca.editar.
- Pendencia: demais funcoes com asServiceRole se restarem; Go-Live humano Gates 18-20.
- Validacoes: `node --test tests/ia-transversal-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: Gate 18-20 (virada/homologacao humana) ou residual asServiceRole em outras funcoes.
### P2.6 - Gate 16 residual: upsell/recomendacao/PriceBrain/KYC fail-closed
- Objetivo: fechar residual Gate 16 nas telas IA comerciais irmas (sem IAV2).
- Diagnostico: Upsell/Motor/PriceBrain liam Pedido global; desconto/preco sem confirm; KYC/IAPriceBrain com OR fail-open e LogsIA Automático; Top10 sem assertIaUiContext.
- Causa raiz: telas irmas fora do contrato `assertIaUiContext` / `requireIaHumanConfirm`.
- Arquivos alterados: `iaTransversalPolicy.js`, `IAUpsellPrecificacao.jsx`, `MotorRecomendacao.jsx`, `PriceBrain.jsx`, `IAKYCValidacao.jsx`, `IAPriceBrain.jsx`, `Top10ProdutosCliente.jsx`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: policy Gate 16, `filterInContext`/`createInContext`, padrao Churn CRM.
- Alteracoes: builders upsell/recomendacao; leituras no contexto; InvokeLLM com group/empresa; LogsIA como Sugestao; confirm humano em desconto/preco/add item.
- Multiempresa/RBAC: escopo empresa exige empresa; grupo so no `scopeType=grupo`.
- Pendencia: Motor Fiscal + IAGovernanca (PerfilAcesso); Gate 17 asServiceRole; Go-Live humano Gates 18-20.
- Validacoes: `node --test tests/ia-transversal-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: residual Gate 16/17 (Governanca/Fiscal) ou virada Gate 18-20.
### P1.9 - Marketplaces: canal fail-closed, import SKU e webhook honesto
- Objetivo: fechar residual Gate 15 / P1 Marketplaces nas syncs e Validar existentes (sem MarketplaceV2).
- Diagnostico: `isMarketplaceAtivo` liberava sem config; Validar com grupo-OR-empresa, audit engolido e import sem itens/SKU; cancel hardcoded; webhook `ok` sem pedido/itens e stamp generico `Marketplace`; config sem empresa.
- Causa raiz: guards de canal/import/webhook ainda fail-open apos o lote de sync/SKU.
- Arquivos alterados: `marketplacePedidoPolicy.js`, `ValidarPedidosExternos.jsx`, `SincronizacaoMarketplaces*.jsx`, `ConfiguracaoIntegracaoForm.jsx`, `legacyIntegrationsMirror/entry.ts`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: stamp/idempotencia, simulacao estavel, `buildErpPedidoFromExterno`, `applyStatusExternoMarketplace`.
- Alteracoes: canal ativo fail-closed; import exige itens+SKU; cancel/devolucao via policy; webhook stamp provedor + itens + `nada_processado`; config exige empresa; toasts de sync como simulacao local.
- Multiempresa/RBAC: Validar exige grupo+empresa; permissoes granulares PedidoExterno/Pedido.
- Pendencia: OAuth/NF/recebivel reais das APIs; checklist P1 Marketplaces marcado (API real segue pendente).
- Validacoes: `node --test tests/marketplace-pedido-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: P1 checklist encerrado — seguir P2/IA ou residual Go-Live conforme STATUS.
### P1.8 - Site proprio: checkout fail-closed, pagamento honesto e canal Site
- Objetivo: fechar residual Gate 14 / P1 Integracao total do site no `OrcamentoSite` existente (sem SiteV2).
- Diagnostico: checkout sem contato; ContaReceber com status `gerado` sem link; auditoria engolida; lead/IA sem empresa; CatalogoWeb em grupo sem `empresa_id`; widget Site so via CRM.
- Causa raiz: guards de contato/pagamento/contexto incompletos apos o lote de catalogo/estoque.
- Arquivos alterados: `siteOrigemPolicy.js`, `OrcamentoSite.jsx`, `OrcamentoAutomaticoIA.jsx`, `CatalogoWebForm.jsx`, `ChatbotWidget.jsx`, `contextoMultiempresaPolicy.js`, `tests/site-origem-policy.test.js`, `PLANO_GO_LIVE.md`.
- Reutilizado: catalogo/preco/estoque do lote site anterior, portal, chatbot canal Site, ContaReceber/Pedido.
- Alteracoes: `assertSiteContato` no checkout; pagamento `pendente_configuracao`/`aguardando_*`; AuditLog via `createInContext`; lead+IA com empresa/grupo; CatalogoWeb exige empresa; Site canal exige ConfiguracaoCanal; Oportunidade exige empresa no write.
- Multiempresa/RBAC: operacoes do site com empresa da filial; canal Site visitante so com config ativa + empresa.
- Pendencia: PSP/gateway real; visitante anonimo fora da sessao ERP; Marketplaces (proximo P1 checklist).
- Validacoes: `node --test tests/site-origem-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: Marketplaces.

### P1.7 - Chatbot omnichannel: canal/empresa fail-closed e roteamento vivo
- Objetivo: fechar residual P1 Chatbot omnichannel no Hub/Chatbot existentes (Gate 12).
- Diagnostico: canal sem config liberava; ChatbotAtendimento/interacoes sem empresa; sessao widget sem empresaId; escalate engolia erro; IntentEngine lia ERP sem contexto; regras de roteamento nao hidratavam nem rodavam no ingest.
- Causa raiz: omnichannel com guards fail-open e roteamento desconectado do ingest.
- Arquivos alterados: `atendimentoConversaPolicy.js`, `contextoMultiempresaPolicy.js`, `localBase44Client.js`, `ChatbotAtendimento.jsx`, `ChatbotWidget.jsx`, `ChatbotWidgetAvancado.jsx`, `RoteamentoInteligente.jsx`, `WebhooksTester.jsx`, `IntentEngine.jsx`, `HubAtendimento.jsx`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: Hub assume/transfer/close, `ingestCanalExterno`, fila, widgets existentes.
- Alteracoes: canal fail-closed; interacao exige empresa; escalate/audit obrigatorios; sessao+empresa; roteamento apply no webhook; IntentEngine com hasContext nas leituras.
- Multiempresa/RBAC: ChatbotInteracao/ConfiguracaoCanal exigem empresa; escopo CRM.Atendimento.
- Pendencia: Meta/WhatsApp real; SLA KPI real no Hub; Site proprio (proximo P1).
- Validacoes: `node --test tests/atendimento-conversa-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: Site proprio integrado.

### P1.6 - Portal Cliente: shell de abas + write/NFe fail-closed
- Objetivo: fechar residual P1 Portal do Cliente completo no portal existente (Gate 13 funcoes alcançaveis).
- Diagnostico: `PortalCliente` so montava Dashboard; `PortalTabsNav` orfao; links `?tab=` mortos; NF so por `cliente_id`; ContaReceber update sem assert portal; DANFE sem policy; config UI-only/spinner infinito.
- Causa raiz: shell desconectado dos modulos ja existentes e escopo financeiro/fiscal incompleto.
- Arquivos alterados: `PortalCliente.jsx`, `portal.jsx`, `portalClientePolicy.js`, `localBase44Client.js`, `DocumentosCliente.jsx`, `ConfiguracoesPortal.jsx`, `DashboardCliente.jsx`, `ExternalAppsHub.jsx`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `PortalTabsNav`, `PortalHeader`, Pedidos/Docs/Chamados/Orcamentos/etc. existentes, policy de sessao/PIX.
- Alteracoes: shell com `?tab=`; escopo NFe alias; assert write titulo; DANFE assertado; preferencias/LGPD persistidas+audit; preview adminMode.
- Multiempresa/RBAC: isolamento por `portal_usuario_id`; URL cliente_id so em adminMode.
- Pendencia: PSP/boleto real; magic-link UI; Chatbot (proximo P1).
- Validacoes: `node --test tests/portal-cliente-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: Chatbot/Hub de atendimento.

### P1.5 - App Motorista: offline/sync, stamp ID e assert vivo
- Objetivo: fechar residual P1 App Motorista completo no app existente (ERP → atribuicao → offline → sync → prova).
- Diagnostico: chegada bypassava fila; sync sem `updateInContext`; Romaneio so gravava nome; `assertEntregaMotoristaOnUpdate` morto; match so por nome/user.id; entradas sem RBAC; prova exigia foto online.
- Causa raiz: atribuicao e sync desconectados do fluxo fail-closed do motorista.
- Arquivos alterados: `appMotoristaPolicy.js`, `AppEntregasMotorista.jsx`, `localBase44Client.js`, `expedicaoEntregaPolicy.js`, `RomaneioForm.jsx`, `MotoristaForm.jsx`, `EntregasMobile.jsx`, `ExternalAppsHub.jsx`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: fila offline, build*Patch, `filterInContext`/`updateInContext`, Bloco4 entry.
- Alteracoes: vinculo usuario/colaborador/email; stamp `motorista_id`+`sequencia_rota` no romaneio; chegada/sync via fila+contexto; assert motorista no client; auditoria das acoes; prova com foto|assinatura|doc; RBAC nas entradas.
- Multiempresa/RBAC: fila com group/empresa; app exige grupo+empresa; chegada=alçada entregar.
- Pendencia: PWA/IndexedDB media; turn-by-turn Maps; Portal Cliente (proximo P1).
- Validacoes: `node --test tests/app-motorista-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: Portal Cliente.

### P1.4 - Roteirizador avancado: stamp Entrega + IA fail-closed
- Objetivo: fechar residual P1 Roteirizador avancado no fluxo existente (ERP → rota IA → motorista/sequencia nas Entregas → App Motorista).
- Diagnostico: IA criava so `RoteirizacaoInteligente` sem stamp em Entrega; create IA sem motorista/veiculo/grupo; UI auto-escolhia `motoristas[0]`/`veiculos[0]`; `MapaRoteirizacaoIA` usava `Pedido.list()`; catch silencioso no LLM/auditoria.
- Causa raiz: atribuicao de rota desconectada do App Motorista e guards incompletos na IA.
- Arquivos alterados: `roteirizacaoPolicy.js`, `RoteirizacaoInteligente.jsx`, `MapaRoteirizacaoIA.jsx`, `localBase44Client.js`, `tests/roteirizacao-policy.test.js`, `PLANO_GO_LIVE.md`.
- Reutilizado: `otimizarRotaAvancada`, mapa/romaneio que ja stampava Entrega, `createInContext`/`updateInContext`.
- Alteracoes: `assertRoteirizacaoInteligenteOnCreate` exige grupo+motorista+veiculo; `stampEntregaAtribuicaoRota`; UI com selecao explicita; stamp pos-create; mapa IA com `filterInContext`+RBAC+fallback auditado; escopo Rota/Roteirizacao no client.
- Multiempresa/RBAC: contexto groupId+empresaId; permissoes Expedicao.Rotas/Roteirizacao.
- Pendencia: Google Maps/trafego real; App Motorista offline/sync completo (proximo P1).
- Validacoes: `node --test tests/roteirizacao-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: App Motorista completo.

### P1.3 - CRM: update fail-closed, escopo e funis contextuais
- Objetivo: fechar residual P1 CRM completo no modulo existente (policy de update viva + RBAC CRM).
- Diagnostico: `assertOportunidadeOnUpdate` importado e nao chamado; entidades CRM caíam em Cadastros; funis IA/Avancado usavam `entities.update`; CRM.jsx engolia erro de listagem; conversao so com `editar`.
- Causa raiz: persistencia de etapa/conversao fora da policy e escopo errado.
- Arquivos alterados: `crmOportunidadePolicy.js`, `localBase44Client.js`, `entityGuardPolicy`, `CRM.jsx`, `FunilComercialInteligente`, `FunilVendasAvancado`, `OportunidadesLista`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: create CRM, `buildDocumentoFromOportunidade`, Funil Visual com `updateInContext`.
- Alteracoes: update com alcada mover_etapa/converter; bloqueio de opp fechada; escopo CRM; funis via `updateInContext`; listagens fail-closed.
- Multiempresa/RBAC: conversao exige empresa; permissoes CRM granulares no client.
- Pendencia: scoring/ROI de campanha com LLM (STATUS anterior).
- Validacoes: `node --test tests/crm-oportunidade-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: Roteirizador avancado.

### P1.2 - Compras: ContaPagar no recebimento e alcada OC
- Objetivo: fechar residual P1 Compras avancadas (AP automatica + RBAC receber/aprovar) no fluxo existente.
- Diagnostico: recebimento atualizava estoque sem ContaPagar; OC update so exigia `editar`; UI OR liberava receber via Estoque/criar; RecebimentoOCForm engolia falha de auditoria.
- Causa raiz: financeiro desconectado do recebimento e alçada fraca no client.
- Arquivos alterados: `comprasOrdemPolicy.js`, `localBase44Client.js`, `OrdensCompraTab.jsx`, `RecebimentoOCForm.jsx`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `assertRecebimentoOc`, stamp de movimento, `assertTituloOnCreate`/ContaPagar, telas de OC existentes.
- Alteracoes: stamp+find ContaPagar por OC; create idempotente no receber; OC update com receber/aprovar/enviar; escopo Compras no client.
- Multiempresa/RBAC: CP herda empresa/grupo da OC; receber so `Compras.OrdemCompra.receber`.
- Pendencia: avaliacao de fornecedor ponta a ponta com auditoria/RBAC rigorosos.
- Validacoes: `node --test tests/compras-ordem-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: CRM completo.

### P0.14 - Migracao piloto: reconciliacao fail-closed
- Objetivo: cumprir residual P0 Migracao piloto no importador existente, sem MigracaoV2.
- Diagnostico: planilha gravava `confirmado:true` sem staging; lote aceitava contexto so com empresa; sem codigo legado; reconciliacao nao bloqueava divergencia; auditoria engolia erro.
- Causa raiz: confirmacao tratada como toast, fora de `assertReconciliacaoMigracao`.
- Arquivos alterados: `migracaoErpPolicy.js`, `ImportarProdutosLote.jsx`, `ImportadorProdutosPlanilha.jsx`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: stamp/lote migracao, janela congelada, createInContext Produto.
- Alteracoes: legado+grupo obrigatorios; staging→confirm→reconciliar; falhas de lote/planilha nao concluem como sucesso; auditoria obrigatoria.
- Multiempresa/RBAC: migracao exige `group_id`; reuso por legado na mesma empresa.
- Pendencia: PAD/agente; historicos amplos; execucao humana com export real do ERP antigo.
- Validacoes: `node --test tests/migracao-erp-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo: P0 checklist fechado no codigo; seguir P1 operacional ou Gate 20 virada com evidencia humana.

### P0.13 - Testes e homologacao: cenarios piloto persistidos
- Objetivo: cumprir residual P0 Testes/homologacao no piloto existente, sem TestesV2.
- Diagnostico: `piloto_cenarios` so era lido na virada; StatusControleAcesso mostrava so papeis; admin virava piloto no hydrate; nfeActions aceitava flag sem papel.
- Causa raiz: homologacao Gate 19 sem caminho de persistencia no UI existente.
- Arquivos alterados: `pilotoOperacaoPolicy.js`, `localBase44Client.js`, `StatusControleAcesso.jsx`, `nfeActions/entry.ts`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: GestaoUsuariosAvancada, upsertConfig, assertViradaProducao, GerenciamentoAcessosCompleto.
- Alteracoes: allowlist+save dos 10 cenarios; homologacao = papeis+cenarios; NF com papel piloto; sem auto-piloto no snapshot.
- Multiempresa/RBAC: cenarios por grupo/empresa; edicao exige Configuracoes/Acessos; auditoria obrigatoria.
- Pendencia: execucao humana dos 10 cenarios em ambiente piloto; Migração piloto (proximo P0).
- Validacoes: `node --test tests/piloto-operacao-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Migração piloto validada.

### P0.12 - Backup e rollback: snapshot real e restore fail-closed
- Objetivo: cumprir residual P0 Backup/rollback no backup existente, sem BackupV2.
- Diagnostico: Gate 20 gravava hash/resumo sem payload; HistoricoBackups simulava restore; status `Concluido` vs `Concluído` escondia acoes; autoBackup sem group_id e catch silencioso; update reestampava backup.
- Causa raiz: rollback tratado como toast, sem snapshot restauravel.
- Arquivos alterados: `viradaProducaoPolicy.js`, `localBase44Client.js`, `HistoricoBackups.jsx`, `autoBackup/entry.ts`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `BackupAutomatico`, `mergeSnapshotRecords`, ConfiguracaoBackup/Monitoramento existentes.
- Alteracoes: snapshot por entidade no create; `restore()` aplica merge; expire/restaurar com RBAC; autoBackup exige grupo e grava controle+auditoria; update preserva integridade.
- Multiempresa/RBAC: snapshot filtrado por grupo/empresa; restore/expirar com `restaurar`/`excluir`.
- Pendencia: backup criptografado do legado operacional; reconciliacao pos-virada (Gate 20 residual).
- Validacoes: `node --test tests/virada-producao-policy.test.js tests/piloto-operacao-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Testes e homologacao (checklist) / Migração piloto.

### P0.11 - Gate 11 Expedicao residual: entrega, prova e escopo
- Objetivo: cumprir residual do Gate 11 / P0 Expedicao sem ExpedicaoV2.
- Diagnostico: Entrega caia em Cadastros/`editar`; update sem alçada por status; delete sem policy; Entregue sem prova; Separacao concluia com `editar`; baixa de estoque na confirmação atualizava Produto fora do movimento.
- Causa raiz: transicao de entrega sem policy e alçada fraca de entregar/conferir.
- Arquivos alterados: `expedicaoEntregaPolicy.js`, `localBase44Client.js`, `entityGuardPolicy`, `PedidosEntregaTab`, `DetalhesEntregaView`, `SeparacaoConferencia`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `assertEntregaOnCreate`, Romaneio/Separacao/App Motorista existentes.
- Alteracoes: update/delete fail-closed; escopo Expedicao; entregar/conferir/expedir/ocorrencia granulares; prova antes de Entregue; estoque so via MovimentacaoEstoque.
- Multiempresa/RBAC: entrega exige empresa; confirmar entrega nao usa so `editar`; delete bloqueado apos finalizacao.
- Pendencia: roteirizador avancado; App Motorista offline/sync (P1).
- Validacoes: `node --test tests/expedicao-entrega-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 12 Chatbot/Hub (ou Backup/rollback conforme checklist P0 residual).

### P0.10 - Gate 10 Producao residual: OP status, alcada e estoque unico
- Objetivo: cumprir residual do Gate 10 / P0 Producao sem ProducaoV2.
- Diagnostico: OrdemProducao caia em Cadastros/`editar`; sem `assertOpOnUpdate/Delete`; apontar/conferir com `editar`; Kanban listava global; consumo de OP atualizava Produto fora da policy; PedidosTab com encoding quebrado em Produção.
- Causa raiz: transicao de status de OP sem policy e alçada fraca de apontar/aprovar.
- Arquivos alterados: `ordemProducaoPolicy.js`, `localBase44Client.js`, `ApontamentoProducao`, `FormularioOrdemProducao`, `KanbanProducao`, `KanbanProducaoInteligente`, `GerarOPModal`, `PedidosTab`, `useFluxoPedido`, `entityGuardPolicy`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `assertOpOnCreate`, `assertApontamento`, `concluirOPCompleto`, Kanban/Form existentes.
- Alteracoes: update/delete fail-closed; escopo Producao; apontar/aprovar sem `editar`; Kanban com contexto; baixa de material so via MovimentacaoEstoque.
- Multiempresa/RBAC: OP exige empresa; liberacao para expedicao exige aprovar; Kanban exige grupo+empresa.
- Pendencia: etiqueta/lote/rastreio item a item; ApontamentoProducaoAvancado residual; carta/CC-e fiscal fora deste gate.
- Validacoes: `node --test tests/ordem-producao-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 11 Expedicao essencial.

### P0.9 - Gate 9 Fiscal residual: emit/cancel, escopo e producao
- Objetivo: cumprir residual do Gate 9 / P0 Fiscal sem FiscalV2.
- Diagnostico: NotaFiscal caia em Cadastros/`editar`; EventosNFe cancelava sem RBAC; `nfeActions` aceitava `autoriza_emissao_producao` do client e secao `NF-e`; config NF-e salvava so com grupo; UI emitia com `criar`.
- Causa raiz: transicao de status fiscal sem policy e alçada fraca de emitir/cancelar.
- Arquivos alterados: `notaFiscalEmissaoPolicy.js`, `localBase44Client.js`, `nfeActions`, `EventosNFe`, `ConfiguracaoNFeForm`, `NotasFiscaisTab`, `FechamentoFinanceiroTab`, `PedidosTab`, `CaixaPDVCompleto`, `integracaoNFe`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `assertEmissaoNFe`, `nfeActions`, NotasFiscaisTab e cancelarNFe existentes.
- Alteracoes: `assertNotaFiscalOnUpdate`; escopo Fiscal; producao so por config servidor; cancel persiste; emit UI exige emitir/enviar.
- Multiempresa/RBAC: NF so com empresa; cancelar/emitir granulares; config exige empresa emitente.
- Pendencia: validacao tributaria item a item (NCM/CST/totalizadores); e2e SEFAZ homologacao real; `fiscalValidation` com auth.me.
- Validacoes: `node --test tests/nota-fiscal-emissao-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 10 Producao essencial.

### P0.8 - Gate 8 Financeiro residual: baixa, caixa e conciliacao
- Objetivo: cumprir residual do Gate 8 / P0 Financeiro sem FinanceiroV2.
- Diagnostico: ContaReceber/ContaPagar caíam no escopo Cadastros; caixa/PDV liquidavam com `canEdit`; conciliacao em lote sem `conciliar`; `valor_recebido`/`valor_pago` nao congelavam; `paymentStatusManager` usava `editar` e cancelava titulo liquidado.
- Causa raiz: alçada de baixa/conciliação fraca e bypass de service-role fora da titulo policy.
- Arquivos alterados: `financeiroTituloPolicy.js`, `localBase44Client.js`, `entityGuardPolicy`, `OrdensLiquidacaoPendentes`, `CaixaPDVCompleto`, `LiquidarReceberPagar`, `CaixaCentralLiquidacao`, `ConciliacaoEmLote`, `ConciliacaoBancariaTab`, `LiquidacaoEmLote`, `ContasReceberTab`, `ContasPagarTab`, `paymentStatusManager`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `assertTituloOnUpdate`, CR/CP tabs, caixa central e conciliação existentes.
- Alteracoes: escopo Financeiro no client; settlement com receber/pagar/baixar/liquidar; freeze de valores liquidados; conciliacao exige `conciliar`; paymentStatusManager com RBAC e idempotencia.
- Multiempresa/RBAC: titulo exige empresa; baixa manual nao usa `editar`; cancel apos baixa bloqueado.
- Pendencia: ExtratoBancario listagem sem empresa em ConciliacaoBancaria; rateio multiempresa UI; webhook de pagamento com chave de idempotencia explicita.
- Validacoes: `node --test tests/financeiro-titulo-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 9 Fiscal (emissao homologacao).

### P0.7 - Gate 7 Estoque residual: tipo, alcada e transferencia
- Objetivo: cumprir residual do Gate 7 / P0 Estoque sem EstoqueV2.
- Diagnostico: MovimentacoesTab perdia `tipo_movimento` (saida virava entrada); inventário aprovava com `editar`; `applyInventoryAdjustments` usava `editar` e `isApprovedStatus` fail-open; transferencia usava tipo ambiguo e OR de criar; config de saldo negativo era global.
- Causa raiz: wiring UI/backend fora da policy e alçada fraca.
- Arquivos alterados: `estoqueMovimentoPolicy.js`, `localBase44Client.js`, `MovimentacoesTab.jsx`, `InventarioForm.jsx`, `TransferenciaEntreEmpresasForm.jsx`, `ControleEstoqueCompleto.jsx`, `applyInventoryAdjustments`, `validationUtils`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `assertMovimentacaoEstoque`, `applyLocalEstoqueMovimento`, handler de inventário existente.
- Alteracoes: tipo obrigatorio; inventário so `aprovar` + invoke de ajustes; transferencia saida/entrada com falha reportada; RBAC Estoque no client local; config negativa por escopo.
- Multiempresa/RBAC: movimento exige empresa; inventário/ajuste com alçada; transferencia sem criar global.
- Pendencia: saldo por local; estoque fisico multiempresa por produto; KPIs de movimentacao limit 50.
- Validacoes: `node --test tests/estoque-movimento-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 8 Financeiro (baixa, conciliação, CR/CP).

### P0.6 - Gate 6 Comercial residual: estoque unico, credito e aprovacao
- Objetivo: cumprir residual do Gate 6 / P0 Comercial sem ComercialV2.
- Diagnostico: saida de estoque na aprovacao/save/fechamento e de novo no faturamento; Central aprovava com `editar`; credito liberava cliente ausente e limite zero; `applyOrderStockMovements` fazia saida com clamp.
- Causa raiz: baixa fisica cedo demais e fail-open de credito/RBAC fora do fluxo canonico reserva→NF.
- Arquivos alterados: `pedidoFaturamentoPolicy.js`, `useFluxoPedido.jsx`, `PedidoFormCompleto.jsx`, `CentralAprovacoesManager.jsx`, `applyOrderStockMovements/entry.ts`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `orderReservationUtils`, teto de faturamento, Central/fluxo existentes.
- Alteracoes: aprovacao/fechamento so reservam; saida idempotente no faturamento; credito fail-closed; Central so `aprovar` + valida credito; backend de estoque em modo reserva.
- Multiempresa/RBAC: empresa obrigatoria no faturar; estoque exige `Comercial.Pedido.aprovar`.
- Pendencia: baixa parcial por etapa; alçada de margem/desconto por perfil; harmonizar `onNotaFiscalAuthorized`.
- Validacoes: `node --test tests/pedido-faturamento-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 7 Estoque (saldo, reserva, transferencia, inventário).

### P0.5 - Gate 5 Cadastros residual: escopo, codigo e duplicidade
- Objetivo: cumprir residual do Gate 5 / P0 Cadastros Gerais sem CadastrosV2.
- Diagnostico: Visualizador listava mestres do grupo inteiro na visao empresa (`$or` com `group_id`); SIMPLE_CATALOG contava/listava sem escopo; create mestre aceitava sem `group_id`; Produto nao rejeitava codigo duplicado e falhava aberto na checagem.
- Causa raiz: filtro manual fora de `buildMultiempresaReadFilter` e policy mestre fail-open.
- Arquivos alterados: `VisualizadorUniversalEntidadeV24.jsx`, `localCadastroMasterPolicy.js`, `localBase44Client.js`, `ProdutoFormV22_Completo.jsx`, `useEntityCounts.jsx`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `buildMultiempresaReadFilter`, reserva sequencial, `applyMasterCadastroOnCreate`.
- Alteracoes: listagem/save com escopo canonico; contagens respeitam grupo/empresa; produto reserva codigo e rejeita duplicado; create mestre exige `group_id`.
- Multiempresa/RBAC: empresa nao mistura mestres de outras; sem contexto bloqueia listar/salvar.
- Pendencia: enxugar lista SIMPLE_CATALOG; `DetalhesCadastro` KPIs; forms auxiliares com `entity.list()`; inativar/restaurar universal.
- Validacoes: `node --test tests/cadastro-master-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 6 Comercial (pedido → estoque → aprovacao → faturamento).

### P0.4 - Gate 4 Auditoria residual: catches silenciosos e escopo
- Objetivo: cumprir residual do Gate 4 / P0 Auditoria de `PLANO_GO_LIVE.md` sem AuditV2.
- Diagnostico: convite/export/estoque/config/CNPJ/portal/WhatsApp engoliam falha de AuditLog; `securityAlerts` aceitava orphan sem group_id e e-mail global; painéis financeiros e prefetch do Layout liam AuditLog sem contexto; `auditEntityEvents` marcava skip como ok.
- Causa raiz: auditoria tratada como opcional e leituras fora do contrato multiempresa.
- Arquivos alterados: `adminInviteUser`, `exportEstoqueAco`, `applyOrderStockMovements`, `upsertConfig`, `ConsultarCNPJ`, `portalToken`, `onEntityWhatsappNotify`, `securityAlerts`, `auditEntityEvents`, `Layout.jsx`, `AuditoriaLiquidacoes.jsx`, `AuditoriaFormasPagamento.jsx`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `filterInContext`, `AuditLog`, padrao de report via `console.error` / `reportLayoutFailure`.
- Alteracoes: catches reportam; export/convite falham se auditoria critica falhar; group_id nos writes do Layout; UIs financeiras com escopo+RBAC; securityAlerts fail-closed e admins do grupo.
- Multiempresa/RBAC: leituras e alertas so no grupo; email so a admins vinculados.
- Pendencia: matriz pagina-a-pagina de acoes criticas; `orderFlowAuditor` global; limpeza `isAdmin||` residual.
- Validacoes: `node --test tests/sanitize-audit-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 5 Cadastros Gerais (base mestre / paginação / códigos).

### P0.3 - Gate 3 Multiempresa residual: switcher e contexto fail-closed
- Objetivo: fechar vazamento residual do Gate 3 / P0 Multiempresa sem MultiempresaV2.
- Diagnostico: `EmpresaSwitcher` listava Grupo/Empresa global para admin/API-key; `getCurrentContext` inventava `local_grupo_cpa`; `expandLocalContextFilter` e `entity.list` abriam escopo; `filtrarPorContexto` devolvia lista crua; `PerfilAcesso` aceitava group null/`grupo_001`; leitura so por `empresaId`; rateio com `group_id: null`.
- Causa raiz: atalhos admin e fallbacks fail-open fora do contrato `{ groupId, empresaId, scopeType }`.
- Arquivos alterados: `EmpresaSwitcher.jsx`, `localBase44Client.js`, `contextoMultiempresaPolicy.js`, `useContextoVisual.jsx`, `useContextoGrupoEmpresa.jsx`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `buildMultiempresaReadFilter`, vinculos do usuario, hooks de contexto existentes.
- Alteracoes: switcher so por vinculos; sem group inventado; `list` via `filter`+expand; `$or/$and` compostos com escopo; filtros e UI fail-closed; rateio preserva grupo.
- Multiempresa/RBAC: leitura sem grupo/empresa bloqueia; admin nao bypassa listagem cross-grupo.
- Pendencia: consumidores remanescentes de `entity.list` sem contexto na UI; Gate 4 auditoria.
- Validacoes: `node --test tests/contexto-multiempresa-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 4 Auditoria (cobertura residual / securityAlerts).

### P0.2 - Gate 2 RBAC residual: admin bypass e fail-open de loading
- Objetivo: cumprir residual do Gate 2 / P0 RBAC de `PLANO_GO_LIVE.md` no guard e nas UIs existentes, sem PermissionV2.
- Diagnostico: `backendHasPermission` liberava `role===admin`; `solicitacoesAprovacao` bypassava perfil; AcoesRapidas falhava aberto no loading; aprovacoes comerciais usavam admin/gerente; `usePermissoesEmpresa` bypassava; entityGuard local fazia fallback de secao para modulo; botao sensivel lia so localStorage.
- Causa raiz: atalhos de role e loading fail-open fora da matriz `PerfilAcesso`.
- Arquivos alterados: `guard/entry.ts`, `solicitacoesAprovacao/entry.ts`, `AcoesRapidasGlobal.jsx`, `CentralAprovacoesManager.jsx`, `AprovacaoDescontos*.jsx`, `usePermissoesEmpresa.jsx`, `localBase44Client.js`, `sensitiveActionGuardPolicy.js`, `button.jsx`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `PerfilAcesso`, `hasPermission`, `entityGuard`, `buildSensitiveGuardRequest`.
- Alteracoes: permissao so por perfil (+ wildcard `*`); emitir granular; UI fail-closed; aprovacao por chave Comercial/Pedido; secao obrigatoria no local; contexto explicito no botao sensivel.
- Multiempresa/RBAC: fail-closed sem perfil/loading; escopo preferencial sobre localStorage.
- Pendencia: limpar `isAdmin()||hasPermission` em telas admin remanescentes; Gate 3 vazamento de escopo no switcher.
- Validacoes: `node --test tests/rbac-gate2-residual.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 3 Multiempresa (vazamento residual / consolidacao).

### P0.1 - Seguranca/autenticacao: sessao local, logout e API-key fail-closed
- Objetivo: retomar P0 Gate 1 de `PLANO_GO_LIVE.md` fechando fail-open restante no auth existente (sem loginV2).
- Diagnostico: `me`/`isAuthenticated` locais ignoravam `SessaoUsuario`; logout era noop; modo API-key remoto autenticava admin sintetico com `isAuthenticated => true`; `ProtectedRoute` pedia `authChecked`/`checkUserAuth` ausentes no AuthContext.
- Causa raiz: contrato de sessao/logout incompleto e bypass interativo por API key.
- Arquivos alterados: `localAuthSessionPolicy.js`, `localBase44Client.js`, `base44Client.js`, `AuthContext.jsx`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: `evaluateLocalUserSession`, `SessaoUsuario`, `GerenciadorSessoes`, App autenticado existente.
- Alteracoes: estado `logged_in` + bind/revoga sessao; logout/redirect reais; API key sem token nao autentica UI; AuthContext exporta `authChecked`/`checkUserAuth`.
- Multiempresa/RBAC: continua exigindo grupo/empresa no perfil; sessao carrega group/empresa do usuario.
- Pendencia: MFA no login; recuperacao de senha; Gate 2 RBAC residual; marcar demais itens P0 do checklist apos homologacao.
- Validacoes: `node --test tests/local-auth-session-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 2 RBAC granular (matriz frontend + backend residual).

### P2.5 - Automacoes avancadas: fail-closed, flag NF-e e UIs reativadas
- Objetivo: cumprir P2 Automacoes avancadas de `PLANO_GO_LIVE.md` nas automacoes existentes, sem hub AutomationV2/scheduler novo.
- Diagnostico: `onPedidoReadyToInvoice` emitia NF-e ignorando `emitir_automatico`; `paymentStatusManager` podia varrer todas as empresas; `ReguaCobrancaIA`/`ConfiguracaoNotificacoes`/`HistoricoBackups` orfaos; regua com intervalo silencioso mutando CR.
- Causa raiz: automacao critica sem opt-in de config, escopo multiempresa falho e UIs desconectadas do fluxo.
- Arquivos alterados: `automacaoAvancadaPolicy.js` (extracao), `onPedidoReadyToInvoice/entry.ts`, `paymentStatusManager/entry.ts`, `ConfiguracaoNFeForm.jsx`, `ReguaCobrancaIA.jsx`, `Financeiro.jsx`, `MonitoramentoManutencaoIndex.jsx`, `ConfiguracaoNotificacoes.jsx`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: ConfiguracaoNFe, launchpad Financeiro, Monitoramento/Backup, NotificacoesAutomaticas pattern de sugestao/confirm.
- Alteracoes: NF auto so com flag; lembretes com token+group/empresa; regua com RBAC/confirm sem timer; notificacoes e historico de backup montados; toggle NF com confirm.
- Multiempresa/RBAC: fail-closed sem contexto; cobranca nunca global; abas com permissao.
- Pendencia: runner real de JobAgendado/AgendamentoRelatorios; PAD migracao; unificar dialog duplicado de agendamento em Relatorios.
- Validacoes: `node --test tests/automacao-avancada-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo: P2 checklist encerrado neste nucleo; retomar P0 bloqueadores de go-live conforme `PLANO_GO_LIVE.md` / `AGENTS.md` secao 19.

### P2.4 - Deteccao de anomalias: sugestao, contexto e RBAC
- Objetivo: cumprir P2 Deteccao de anomalias de `PLANO_GO_LIVE.md` nos detectores existentes, sem modulo AnomaliasV2.
- Diagnostico: `IADetectorAnomalias` orfao do launchpad; scan financeiro alertava WhatsApp sem confirm; Dashboard/pedido com contrato fraco de `anomaly`; `securityAlerts` sem group_id fail-closed e catch silencioso; mock local generico.
- Causa raiz: contrato de sugestao/confirmacao parcial fora das funcoes e UIs irmas.
- Arquivos alterados: `iaTransversalPolicy.js`, `iaFinanceAnomalyScan/entry.ts`, `securityAlerts/entry.ts`, `IADetectorAnomalias.jsx`, `Financeiro.jsx`, `Dashboard.jsx`, `PedidoTabsContainer.jsx`, `localBase44Client.js`, testes, `PLANO_GO_LIVE.md`.
- Reutilizado: detector financeiro, scan Deno, alertas de seguranca, Dashboard e pedido ja existentes.
- Alteracoes: helpers `assertAnomalyScanContext`/`stampAnomalyScanResult`/`buildSecurityAnomalySuggestions`; notify/WhatsApp so com confirm; securityAlerts com grupo+RBAC+modo sugestao; tile no Financeiro; Dashboard/pedido consomem `anomaly`/`details`; mocks carimbados.
- Multiempresa/RBAC: scans e UI fail-closed sem grupo/empresa; Auditoria/Controle de Acesso no backend de seguranca.
- Pendencia: unificar heuristica UI vs ML do scan; diagnostico de equipamentos/RH ponto; Automações avançadas (ultimo P2).
- Validacoes: `node --test tests/ia-transversal-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P2: Automacoes avancadas (melhorar automacoes existentes, sem hub paralelo).

### P2.3 - Previsoes: reposicao, recompra, caixa e atraso com contexto
- Objetivo: cumprir P2 Previsoes de `PLANO_GO_LIVE.md` nas telas de previsao existentes, sem hub PrevisoesV2.
- Diagnostico: `IAReposicao` criava SC sem confirmacao; `IAVendasPreditivas` usava localStorage e LogsIA Automatico; caixa aceitava so grupo OU empresa; formulario de entrega aplicava data da IA sozinho; logistica 100% mock.
- Causa raiz: regras de previsao fora da policy compartilhada e apply silencioso em mutacoes.
- Arquivos alterados: `iaTransversalPolicy.js`, `IAReposicao.jsx`, `IAVendasPreditivas.jsx`, `FluxoCaixaProjetado.jsx`, `FormularioEntrega.jsx`, `IAPrevisaoLogistica.jsx`, `iaPrevisaoLogisticaData.js`, testes.
- Reutilizado: `assertIaUiContext`/`requireIaHumanConfirm`, `filterInContext`/`createInContext`, InvokeLLM carimbado.
- Alteracoes: helpers de reposicao/recompra/caixa; SC so com confirm; recompra com RBAC e audit contextual; caixa fail-closed; data de entrega so apos confirm; logistica hibrida com amostra do escopo.
- Multiempresa/RBAC: queryKeys com usuario+grupo+empresa; sem contexto ou permissao bloqueia.
- Pendencia: ML logistico real; campanha de recompra; previsao de material de producao dedicada.
- Validacoes: `node --test tests/ia-transversal-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P2: Deteccao de anomalias (alinhar demais detectores ao contrato de sugestao).

### P2.2 - Agentes especializados: heranca RBAC e confirmacao nos mapeados
- Objetivo: cumprir P2 Agentes especializados de `PLANO_GO_LIVE.md` (Gate 17+) nos agentes/funcoes ja existentes, sem criar 12 telas novas.
- Diagnostico: `permissionOptimizer` era admin-only e gravava perfis sem `confirmado`; `oportunidadeScorer` sem usuario/RBAC; scan financeiro persistia flags sozinho; `PrecosSection` carimbava `confirmado: true` sem confirm humano; otimizador aceitava `simulate` como bypass.
- Causa raiz: contrato Gate 17 na policy local nao era revalidado nas funcoes Deno restantes nem na UI de preco.
- Arquivos alterados: `agenteAutorizacaoPolicy.js`, `permissionOptimizer/entry.ts`, `oportunidadeScorer/entry.ts`, `iaFinanceAnomalyScan/entry.ts`, `productPriceOptimizer/entry.ts`, `PrecosSection.jsx`, testes.
- Reutilizado: catalogo de 12 agentes, `assertMappedAgentFunction`, `assertPermission`/`getUserAndPerfil`, InvokeLLM carimbado.
- Alteracoes: otimizador de permissao e scorer com usuario+RBAC+sugestao/confirmacao; flags de ContaPagar so com `confirmado`; UI de preco com `requireAgentHumanConfirm`; churn analyzer alinhado ao agente atendimento.
- Multiempresa/RBAC: falha fechada sem usuario; heranca do perfil; auditoria de analise vs edicao.
- Pendencia: reduzir `asServiceRole` residual; carimbar `agente` em mais InvokeLLM; provedor LLM real.
- Validacoes: `node --test tests/agente-autorizacao-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P2: Previsoes (melhorar previsoes existentes com dados reais/contexto).

### P2.1 - IA transversal: sugestao com contexto nos modulos irmaos
- Objetivo: cumprir P2 IA transversal de `PLANO_GO_LIVE.md` na IA existente (Gate 16+), sem criar IAV2 nem hub paralelo.
- Diagnostico: CRM churn criava oportunidades sozinho; conciliacao aplicava sem confirmacao/contexto; anomalias sem RBAC/queryKey contextual; previsao logistica sem rotulo de simulacao; previsao de entrega sem groupId no InvokeLLM.
- Causa raiz: contrato de sugestao/confirmacao ficava so em parte das telas (`IAChurnMonitoramento` / InvokeLLM), fora dos irmaos de modulo.
- Arquivos alterados: `iaTransversalPolicy.js`, `IAChurnDetection.jsx`, `ConciliacaoAutomaticaIA.jsx`, `IADetectorAnomalias.jsx`, `IAPrevisaoEntrega.jsx`, `IAPrevisaoLogistica.jsx`, `iaPrevisaoLogisticaData.js`, testes.
- Reutilizado: policy Gate 16, `useContextoVisual`, `createInContext`/`filterInContext`/`updateInContext`, InvokeLLM carimbado.
- Alteracoes: helpers CRM/financeiro/conciliacao; gravacao so com `requireIaHumanConfirm`; fail-closed de contexto/RBAC; simulacao logistica marcada; previsao de entrega com grupo/empresa.
- Multiempresa/RBAC: consultas e auditoria no escopo; sem grupo/empresa ou permissao bloqueia.
- Pendencia: provedor LLM real; ML logistico real no lugar da simulacao; demais telas IA (upsell, recompra, leads) ainda a alinhar.
- Validacoes: `node --test tests/ia-transversal-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P2: Agentes especializados (reforcar heranca RBAC/confirmacao nos agentes restantes).

### P1.9 - Dashboards avancados: KPIs confiaveis, contexto e drill-down
- Objetivo: cumprir P1 Dashboards avancados de `PLANO_GO_LIVE.md` nos dashboards existentes, sem DashboardV2.
- Diagnostico: totais pela primeira pagina/lista capped; queryKeys sem usuario+grupo+empresa; BI com serie de vendas mock; PainelMetricasRealtime global; meta fixa 20/50000.
- Causa raiz: regras de KPI/contexto/drill-down fora de policy compartilhada.
- Arquivos alterados: `dashboardKpiPolicy.js` (extracao), `Dashboard.jsx`, `useDashboardDerivedData.jsx`, `useRealtimeData.jsx`, `DashboardOperacionalBI.jsx`, `PainelMetricasRealtime.jsx`, testes.
- Reutilizado: Dashboard, BI operacional, hooks realtime e painel logistico ja existentes.
- Alteracoes: count preferido a lista; queryKey canonica; drill-down com kpi/periodo/grupo/empresa; vendas mensais reais; realtime fail-closed; painel com escopo/RBAC e meta derivada.
- Multiempresa/RBAC: fail-closed sem grupo/empresa ou permissao de visualizacao.
- Pendencia: agregacao server-side dedicada em volumes muito altos; OAuth/API marketplace e PSP do site seguem abertos.
- Validacoes: `node --test tests/dashboard-kpi-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem: P1 encerrado; iniciar P2 — IA transversal (melhorar IA existente, sem modulo paralelo).

### P1.8 - Marketplaces: sync ativo, SKU e conciliacao local
- Objetivo: cumprir P1 Marketplaces de `PLANO_GO_LIVE.md` na sincronizacao existente, sem modulo paralelo.
- Diagnostico: Gate 15 cobria id externo/idempotencia; sync da config era noop; Ativa ignorava canais inativos; Validar importava sem itens/`buildErpPedidoFromExterno`; sem SKU, cancelamento nem resumo de taxas.
- Causa raiz: operacao de sync/status fora de `marketplacePedidoPolicy`.
- Arquivos alterados: `marketplacePedidoPolicy.js`, `marketplaceSimulationData.js`, `SincronizacaoMarketplacesAtiva.jsx`, `SincronizacaoMarketplaces.jsx`, `ValidarPedidosExternos.jsx`, testes.
- Reutilizado: PedidoExterno, ConfiguracaoIntegracaoMarketplace, simulacao e telas de sync/validacao ja existentes.
- Alteracoes: sync so em canal ativo; SKU→produto; cancelamento/devolucao idempotentes; conciliacao local de comissao/taxa; Validar alinhado a Em Revisao + import completo.
- Multiempresa: create/update no contexto; reuse por empresa+id externo.
- Pendencia: OAuth/NF/recebivel reais das APIs; Dashboards avancados e o proximo P1.
- Validacoes: `node --test tests/marketplace-pedido-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: Dashboards avancados.

### P1.7 - Integracao total do site: catalogo, estoque e status
- Objetivo: cumprir P1 Integracao total do site de `PLANO_GO_LIVE.md` no site existente (`OrcamentoSite`), sem criar outro site.
- Diagnostico: Gate 14 cobria origem `site`; CatalogoWeb/exibir_site ficava orfao; estoque_minimo_online nao bloqueava; checkout sem status/pagamento estavel; OrcamentoAutomaticoIA desconectado da pagina.
- Causa raiz: regras de catalogo/disponibilidade/status fora de `siteOrigemPolicy`.
- Arquivos alterados: `siteOrigemPolicy.js`, `OrcamentoSite.jsx`, `AbaEcommerceProduto.jsx`, `CatalogoWebForm.jsx`, testes.
- Reutilizado: tabela de preco, CatalogoWeb, portal, chatbot canal Site e orcamento IA ja existentes.
- Alteracoes: sync `exibir_no_site`/`exibir_site`; filtro com CatalogoWeb; preco/disponibilidade fail-closed; match de cliente; placeholder de pagamento e resumo de status; IA montada no catalogo.
- Multiempresa: checkout continua exigindo empresa da filial.
- Pendencia: gateway/PSP real e OAuth do visitante anonimo; Marketplaces e o proximo P1.
- Validacoes: `node --test tests/site-origem-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: Marketplaces.

### P1.6 - Chatbot omnichannel: ciclo de vida, canal e fila
- Objetivo: cumprir P1 Chatbot omnichannel de `PLANO_GO_LIVE.md` no Hub/chatbot existentes, sem terceiro centro de atendimento.
- Diagnostico: Gate 12 cobria ingresso; assumir/transferir/fechar e escala ficavam ad-hoc; canal inativo ainda ingeria; fila so listava `Aguardando` sem Assumir; transbordo do chatbot so criava Notificacao.
- Causa raiz: ciclo de vida omnicanal fora de `atendimentoConversaPolicy`.
- Arquivos alterados: `atendimentoConversaPolicy.js`, `HubAtendimento.jsx`, `TransferirConversa.jsx`, `ChatbotFilaEspera.jsx`, `WebhooksTester.jsx`, `ChatbotAtendimento.jsx`, testes.
- Reutilizado: `ConversaOmnicanal`, `MensagemOmnicanal`, Hub, fila, webhook tester e chatbot ja existentes.
- Alteracoes: canal ativo fail-closed na ingestao; assumir/transferir/fechar idempotentes; fila unificada com prioridade e Assumir; transbordo grava conversa `Aguardando` no Hub; webhook local sem exigir URL externa.
- Multiempresa: operacoes exigem empresa; updates preservam contexto.
- Pendencia: Instagram/Messenger/Telegram reais e roteamento automatico por regra ainda dependem do provedor externo; Integracao total do site e o proximo P1.
- Validacoes: `node --test tests/atendimento-conversa-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: Integracao total do site.

### P1.5 - Portal do Cliente completo: PIX e segunda via operacional
- Objetivo: cumprir P1 Portal do Cliente completo de `PLANO_GO_LIVE.md` no portal existente, sem portal paralelo.
- Diagnostico: Gate 13 cobria sessao/isolamento; boletos ainda invocavam `emitirBoleto` quebrado; sem PIX copia-cola nem 2ª via idempotente; documentos e saldo sem carimbo unico de escopo.
- Causa raiz: financeiro do portal fora de `portalClientePolicy`.
- Arquivos alterados: `portalClientePolicy.js`, `BoletosList.jsx`, `DocumentosCliente.jsx`, `DashboardCliente.jsx`, testes.
- Reutilizado: portal, ContaReceber, NF e estados de sessao ja existentes.
- Alteracoes: assert de titulo/NF do cliente; filtro e saldo do portal; PIX copia-cola e linha digitavel locais estaveis; 2ª via idempotente em ContaReceber; links de documento escopados; dashboard com saldo e BoletosList.
- Multiempresa: leituras e updates seguem `cliente_id` do vinculo; admin preview continua separado.
- Pendencia: PSP/banco real para PIX/boleto registrado; Chatbot omnichannel e o proximo P1.
- Validacoes: `node --test tests/portal-cliente-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: Chatbot omnichannel.

### P1.4 - App Motorista completo: fila offline, chegada e parcial
- Objetivo: cumprir P1 App Motorista completo de `PLANO_GO_LIVE.md` no app existente (`AppEntregasMotorista`), sem app paralelo.
- Diagnostico: app so listava Saiu/Em Transito; sem proxima parada por sequencia; sem chegada/parcial; offline so SMS; confirmacao/ocorrencia/reversa sem idempotencia nem fila de sync.
- Causa raiz: acoes do motorista fora de um carimbo unico com fila offline.
- Arquivos alterados: `appMotoristaPolicy.js` (extracao), `expedicaoEntregaPolicy.js`, `AppEntregasMotorista.jsx`, testes.
- Reutilizado: app mobile, prova de entrega, GPS e tela `EntregasMobile` ja existentes.
- Alteracoes: filtro/ordem por atribuicao e `sequencia_rota`; proxima parada; chegada; entrega parcial; ocorrencia/reversa validadas; fila offline idempotente com sync ao voltar online.
- Multiempresa: continua via `filterInContext`; update da entrega preserva empresa.
- Pendencia: navegacao turn-by-turn e upload offline de midia ainda dependem de PWA/storage de arquivos; Portal do Cliente completo e o proximo P1.
- Validacoes: `node --test tests/app-motorista-policy.test.js tests/expedicao-entrega-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: Portal do Cliente completo.

### P1.3 - Roteirizador avancado: prioridade, capacidade e rota persistida
- Objetivo: cumprir P1 Roteirizador avancado de `PLANO_GO_LIVE.md` no fluxo existente (`RoteirizacaoMapa` / `RoteirizacaoInteligente`), sem modulo de rotas paralelo.
- Diagnostico: otimizacao usava so nearest-neighbor local; ignorava peso/volume/capacidade/janela/prioridade; `Rota` nao tinha codigo/idempotencia no ponto unico; IA nao tinha fallback local.
- Causa raiz: regras de roteirizacao espalhadas na tela, fora de um carimbo unico de persistencia.
- Arquivos alterados: `roteirizacaoPolicy.js` (extracao), `localCadastroMasterPolicy.js`, `contextoMultiempresaPolicy.js`, `localBase44Client.js`, `RoteirizacaoMapa.jsx`, `RoteirizacaoInteligente.jsx`, testes.
- Reutilizado: mapa de roteirizacao, romaneio, veiculos com `capacidade_kg`/`capacidade_m3` e parametros ja existentes.
- Alteracoes: codigo `ROT-`; rota exige empresa/motorista/veiculo; otimizacao por faixa de prioridade + NN; alerta de capacidade; ajuste manual de sequencia; gravacao idempotente; IA com fallback local.
- Multiempresa: `Rota` e `RoteirizacaoInteligente` exigem empresa operacional.
- Pendencia: geocodificacao/Google Maps reais e trafego ao vivo ainda dependem da API externa; App Motorista completo e o proximo P1.
- Validacoes: `node --test tests/roteirizacao-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: App Motorista completo.

### P1.2 - CRM completo: oportunidades, interacoes e campanhas operacionais
- Objetivo: cumprir P1 CRM completo de `PLANO_GO_LIVE.md` no modulo CRM existente, sem funil/portal/CRM paralelo.
- Diagnostico: listagens de Oportunidades/Interacoes/Campanhas estavam como placeholder; funis avancados liam `Oportunidade.list()` sem contexto; drag do Funil Visual nao persistia; nao havia codigo/idempotencia/conversao no ponto unico de gravacao.
- Causa raiz: persistencia e listagens fora de um carimbo unico de CRM no cliente local.
- Arquivos alterados: `crmOportunidadePolicy.js` (extracao), `localCadastroMasterPolicy.js`, `localBase44Client.js`, `CRM.jsx`, `OportunidadesLista.jsx`, `InteracoesLista.jsx`, `CampanhasLista.jsx`, `FunilComercialInteligente.jsx`, `FunilVendasAvancado.jsx`, testes.
- Reutilizado: `OportunidadeForm`, `InteracaoForm`, `CampanhaForm`, `ConverterOportunidade`, funis e KPIs ja existentes.
- Alteracoes: codigos `OPP-`/`INT-`/`CAMP-`; oportunidade/interacao/campanha exigem grupo ou empresa; lead aberto e idempotente; etapa sincroniza `etapa`/`etapa_funil`; conversao gera orcamento/pedido e fecha como Ganho; listagens reais no launchpad; funis leem no contexto.
- Multiempresa: CRM operacional carimba grupo/empresa; campanha usa `empresa_dona_id`; conversao exige empresa.
- Pendencia: scoring/IA real dos funis e campanhas ainda dependem do provedor LLM; avaliacao de ROI de campanha ponta a ponta pode evoluir no mesmo modulo.
- Validacoes: `node --test tests/crm-oportunidade-policy.test.js`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: Roteirizador avancado.

### P1.1 - Compras avancadas: SC/COT/OC reservados e recebimento idempotente
- Objetivo: cumprir P1 Compras avancadas de `PLANO_GO_LIVE.md` no fluxo existente (solicitacao → cotacao → OC → recebimento → estoque), sem modulo paralelo.
- Diagnostico: SC/COT/OC usavam `Date.now`/`count+1`; cotacao ficava so em mock de tela; retry de OC pela solicitacao criava duplicata; recebimento nao carimbava empresa na movimentacao.
- Causa raiz: numeracao e idempotencia fora do ponto unico de persistencia.
- Arquivos alterados: `comprasOrdemPolicy.js` (extracao), `localCadastroMasterPolicy.js`, `localBase44Client.js`, `OrdemCompraForm.jsx`, `OrdensCompraTab.jsx`, `SolicitacaoCompraForm.jsx`, `SolicitacoesCompraTab.jsx`, `CotacaoForm.jsx`, `CotacoesTab.jsx`, testes.
- Reutilizado: sequencia mestre, `MovimentacaoEstoque` e telas de compras ja existentes.
- Alteracoes: `OC-`/`SC-`/`COT-` reservados na gravacao; OC exige empresa e reusa a mesma solicitacao/cotacao; cotacao persiste no contexto; recebimento idempotente e movimento com grupo/empresa.
- Multiempresa: OC operacional exige empresa; cotacao/solicitacao exigem grupo ou empresa.
- Pendencia: Contas a Pagar automatica no recebimento e avaliacao de fornecedor ponta a ponta ainda podem evoluir no mesmo modulo.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P1: CRM completo.

### Gate 20 - Virada: backup real, janela congelada e checklist
- Objetivo: cumprir o Gate 20 de `PLANO_GO_LIVE.md` no backup e na configuracao existentes, sem criar tela de virada.
- Diagnostico: backup manual usava `Date.now`/`Math.random` e concluia de mentira; virada nao exigia backup, freeze nem reconciliacao.
- Causa raiz: cutover tratado como toggle, fora do backup e da janela de migracao.
- Arquivos alterados: `viradaProducaoPolicy.js` (extracao), `pilotoOperacaoPolicy.js`, `localBase44Client.js`, `ConfiguracaoBackup.jsx`, `ConfigCenter.jsx`, testes.
- Reutilizado: `BackupAutomatico`, central de configuracoes e trava `modo_operacao` do Gate 19.
- Alteracoes: backup do ERP novo grava resumo e hash; numero `BKP-` sequencial; janela congelada bloqueia migracao; virada exige checklist, backup legado confirmado e zero P0.
- Multiempresa: backup e sequencia no grupo; empresa opcional no escopo.
- Pendencia: backup criptografado real do legado, monitoramento de filas/incidentes no primeiro dia/semana e reconciliacao operacional apos a virada.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gates P0 encerrados neste lote; seguir pendencias operacionais da virada ou P1 autorizado.

### Gate 19 - Piloto: usuarios designados e virada bloqueada
- Objetivo: cumprir o Gate 19 de `PLANO_GO_LIVE.md` no controle de acesso e na NF existentes, sem criar tela de piloto.
- Diagnostico: qualquer usuario autorizado podia emitir NF de producao; nao havia papeis piloto nem trava de virada.
- Causa raiz: operacao controlada misturada com perfil admin, sem designacao nem criterio de saida.
- Arquivos alterados: `pilotoOperacaoPolicy.js` (extracao), `localBase44Client.js`, `notaFiscalEmissaoPolicy.js`, `nfeActions/entry.ts`, `NotasFiscaisTab.jsx`, `GestaoUsuariosAvancada.jsx`, `GerenciamentoAcessosCompleto.jsx`, `StatusControleAcesso.jsx`, testes.
- Reutilizado: gestao avancada de usuario, aba de NF e configuracao `modo_operacao`.
- Alteracoes: 6 papeis piloto no cadastro de usuario; NF de producao no modo piloto exige usuario piloto; virada para producao so com cobertura, cenarios e sem P0.
- Multiempresa: modo e usuarios continuam no grupo; NF segue exigindo empresa emitente.
- Pendencia: executar os 10 cenarios com usuarios reais e reconciliar financeiro/fiscal/estoque antes da virada.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 20 Virada para producao.

### Gate 18 - Migracao do ERP antigo: staging, legado e lote idempotente
- Objetivo: cumprir o Gate 18 de `PLANO_GO_LIVE.md` na importacao CSV/planilha ja existente, sem criar outro modulo de migracao.
- Diagnostico: lote e planilha gravavam direto, sem lote estavel, sem codigo legado obrigatorio e sem recusar senha/retry.
- Causa raiz: persistencia de importacao fora de um carimbo unico de migracao.
- Arquivos alterados: `migracaoErpPolicy.js` (extracao), `localCadastroMasterPolicy.js`, `localBase44Client.js`, `ImportarProdutosLote.jsx`, `ImportadorProdutosPlanilha.jsx`, testes.
- Reutilizado: importadores de produto, sequencia de cadastro mestre e snapshot local.
- Alteracoes: CSV/planilha passam por staging e so gravam apos confirmacao; codigo legado e lote estavel; retry reusa o registro; usuario importado nao traz senha; snapshot de User/Colaborador remove segredo.
- Multiempresa: migracao exige grupo e reusa so na mesma empresa.
- Pendencia: PAD/agente visual, pedidos/financeiro/fiscal historicos e reconciliacao piloto com arquivo real do ERP antigo.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 19 Piloto.

### Gate 17 - Agentes: herdam permissao do usuario e confirmam acao critica
- Objetivo: cumprir o Gate 17 de `PLANO_GO_LIVE.md` nos agentes ja existentes (funcoes de IA/otimizacao), sem criar 12 telas novas.
- Diagnostico: otimizador de preco e orquestrador rodavam sem usuario ou so com `role === admin`; invoke local nao revalidava heranca.
- Causa raiz: agente tratado como automacao privilegiada, fora do usuario invocador.
- Arquivos alterados: `agenteAutorizacaoPolicy.js` (extracao), `localBase44Client.js`, `PrecosSection.jsx`, `Dashboard.jsx`, `PedidoTabsContainer.jsx`, `IAConversacional.jsx`, `productPriceOptimizer/entry.ts`, `optimizerOrchestrator/entry.ts`, testes.
- Reutilizado: funcoes `iaFinanceAnomalyScan`, `productPriceOptimizer`, `optimizerOrchestrator` e InvokeLLM ja existentes.
- Alteracoes: catalogo dos 12 agentes mapeados a modulo/secao do usuario; acao critica exige `confirmado`; sem usuario o otimizador recusa; orquestrador deixa de ser atalho de admin e restringe empresas do grupo.
- Multiempresa: orquestracao filtra empresas do grupo do usuario.
- Pendencia: leitura `asServiceRole` residual nas funcoes Deno e provedor real de LLM.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 18 Migracao do ERP antigo.

### Gate 16 - IA transversal: sugere, nao executa sozinha
- Objetivo: cumprir o Gate 16 de `PLANO_GO_LIVE.md` na IA existente, sem criar outra camada de agentes.
- Diagnostico: `InvokeLLM` local nao exigia grupo; churn gravava cliente e oportunidade sem confirmacao (`resultado: Automatico`).
- Causa raiz: invocacao de IA e persistencia sensivel misturadas, fora de um carimbo unico de sugestao.
- Arquivos alterados: `iaTransversalPolicy.js` (extracao), `localBase44Client.js`, `IAChurnMonitoramento.jsx`, `IAPriceBrain.jsx`, `IntentEngine.jsx`, testes.
- Reutilizado: telas de churn, precificacao, chatbot e `AuditLog`/`LogsIA` ja existentes.
- Alteracoes: invoke exige grupo, recusa executar/baixa/NF/estoque/preco, sanitiza prompt e marca `sugestao`; churn so grava apos confirmacao.
- Multiempresa: IA carimba `group_id`/`empresa_id` da sessao ou do payload.
- Pendencia: provedor real de LLM, campanhas de recompra e conciliacao/liquidacao ainda nao sao acoes confirmadas item a item em todos os modulos.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 17 Agentes.

### Gate 15 - Marketplaces: origem e identificador externo no pedido
- Objetivo: cumprir o Gate 15 de `PLANO_GO_LIVE.md` na sincronizacao existente, sem criar outro modulo de marketplace.
- Diagnostico: busca simulada usava `Date.now`/`random`; importacao inventava numero e recusava retry; pedido comercial externo nao gravava marketplace nem id externo.
- Causa raiz: carimbo de origem e idempotencia fora do ponto unico de persistencia.
- Arquivos alterados: `marketplacePedidoPolicy.js` (extracao), `localBase44Client.js`, `SincronizacaoMarketplacesAtiva.jsx`, `marketplaceSimulationData.js`, `ValidarPedidosExternos.jsx`, testes.
- Reutilizado: `PedidoExterno`, `ConfiguracaoIntegracaoMarketplace`, importacao ativa e validacao comercial.
- Alteracoes: pedido e pedido externo exigem marketplace e id externo; retry reusa o mesmo registro; numero interno continua `PED-`; simulacao com ids estaveis.
- Multiempresa: reuse so na mesma empresa.
- Pendencia: OAuth/catalogo/estoque/preco reais, NF, conciliacao, cancelamento e devolucao ainda dependem das APIs dos marketplaces.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 16 IA transversal.

### Gate 14 - Site proprio: origem site em lead, orcamento e pedido
- Objetivo: cumprir o Gate 14 de `PLANO_GO_LIVE.md` no site existente (`OrcamentoSite` / `OrcamentoAutomaticoIA`), sem criar outro site.
- Diagnostico: checkout gravava `E-commerce` e abortava sem gateway; formulario de IA usava `Site Base44` sem `createInContext`; nao havia lead.
- Causa raiz: origem e persistencia do site fora do carimbo canonico e da empresa.
- Arquivos alterados: `siteOrigemPolicy.js` (extracao), `localBase44Client.js`, `contextoMultiempresaPolicy.js`, `useOrigemPedido.jsx`, `OrcamentoSite.jsx`, `OrcamentoAutomaticoIA.jsx`, testes.
- Reutilizado: catalogo `exibir_no_site`, tabela de preco, `Pedido` tipo orcamento, `Oportunidade` como lead, `ChatbotWidget` e rota do portal.
- Alteracoes: origem `site` na gravacao; lead no checkout e no orcamento IA; orcamento persiste sem gateway; IA exige empresa e casa cliente por e-mail/CPF; catalogo liga chatbot canal `Site` e o portal.
- Multiempresa: `OrcamentoSite` exige empresa; checkout e IA usam `createInContext`.
- Pendencia: pagamento real e match de visitante anonimo ainda dependem do gateway e de cadastro do cliente.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 15 Marketplaces.

### Gate 13 - Portal do Cliente: estados explicitos e isolamento
- Objetivo: cumprir o Gate 13 de `PLANO_GO_LIVE.md` no portal existente, sem criar outro portal.
- Diagnostico: `PortalCliente` redirecionava para o Dashboard; sem vinculo o dashboard girava spinner para sempre; `cliente_id` na URL/prop era aceito no modo cliente.
- Causa raiz: pagina do portal esvaziada e vinculo tratado como carregamento eterno.
- Arquivos alterados: `portalClientePolicy.js` (extracao), `localBase44Client.js`, `PortalCliente.jsx`, `portal.jsx`, `DashboardCliente.jsx`, `DashboardClienteInterativo.jsx`, testes.
- Reutilizado: `DashboardCliente` e consultas por `portal_usuario_id` ja existentes (pedidos, saldo, NF, boletos, entrega, orcamento, chamados, historico).
- Alteracoes: rota do portal volta a abrir o dashboard; estados autenticando/vinculando/pronto/sem vinculo/sem permissao/timeout/erro; ID de outro cliente e recusado na leitura.
- Multiempresa: pedidos/NF/titulos/entregas do portal ficam no cliente vinculado ao usuario.
- Pendencia: PIX e segunda via real ainda dependem do provedor financeiro/fiscal do Gate 8/9.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 14 Site proprio.

### Gate 12 - Chatbot: canal externo entra no Hub e humano assume
- Objetivo: cumprir o Gate 12 de `PLANO_GO_LIVE.md` no Hub e no chatbot existentes, sem terceiro centro de atendimento.
- Diagnostico: webhook so simulava JSON; sessao do widget nascia com `Date.now()`; transbordo sem equipe nao ia para a fila; Hub filtrava so `Em Progresso`.
- Causa raiz: ingestao de canal e identidade da conversa fora do ponto unico de persistencia.
- Arquivos alterados: `atendimentoConversaPolicy.js` (extracao), `localBase44Client.js`, `contextoMultiempresaPolicy.js`, `WebhooksTester.jsx`, `HubAtendimento.jsx`, `ChatbotWidget.jsx`, `ChatbotWidgetAvancado.jsx`, `ChatbotAtendimento.jsx`, testes.
- Reutilizado: `ConversaOmnicanal`, `MensagemOmnicanal`, Hub, widget e testador de webhook ja existentes.
- Alteracoes: conversa exige empresa e reusa canal+sessao/telefone; webhook grava conversa `Aguardando`; cliente e ligado por telefone/e-mail; transbordo vai para o Hub mesmo sem equipe; atendente assume com auditoria.
- Multiempresa: conversa e mensagem operacionais exigem empresa.
- Pendencia: Instagram/Messenger reais e fila SLA por canal ainda dependem do provedor externo.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 13 Portal do Cliente.

### Gate 11 - Expedicao: romaneio, motorista e prova de entrega
- Objetivo: cumprir o Gate 11 de `PLANO_GO_LIVE.md` no fluxo existente (separacao → romaneio → app motorista → comprovante), sem modulo paralelo.
- Diagnostico: SEP/ROM/ENT usavam `Date.now()`; romaneio nao gravava motorista na entrega; app listava todas as entregas; status `Entregue` podia gravar sem prova.
- Causa raiz: numeracao e comprovante fora do ponto unico de persistencia, e atribuicao do motorista so no formulario.
- Arquivos alterados: `expedicaoEntregaPolicy.js` (extracao), `localCadastroMasterPolicy.js`, `localBase44Client.js`, `contextoMultiempresaPolicy.js`, `useFluxoPedido.jsx`, `RomaneioForm.jsx`, `RoteirizacaoMapa.jsx`, `SeparacaoConferencia.jsx`, `SeparacaoConferenciaIA.jsx`, `AppEntregasMotorista.jsx`, testes.
- Reutilizado: telas de romaneio, separacao, roteirizador e app do motorista ja existentes.
- Alteracoes: `ENT-`/`ROM-`/`SEP-` reservados na gravacao; retry reusa entrega/romaneio; romaneio exige empresa, motorista e veiculo/placa; entrega `Entregue` exige comprovante; app filtra por contexto e atribuicao.
- Multiempresa: entrega, romaneio e separacao exigem empresa; app nao usa `Entrega.list()`.
- Pendencia: geocodificacao real, fila offline e vinculo formal motorista x usuario de login.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 12 Chatbot e Hub de Atendimento.

### Gate 10 - Producao: OP numerada, apontamento e conferencia
- Objetivo: cumprir o Gate 10 de `PLANO_GO_LIVE.md` no fluxo existente (pedido → OP → apontamento → conferencia → pedido pronto), sem modulo de producao paralelo.
- Diagnostico: numero da OP usava `Date.now()`; retry do mesmo pedido gerava outra OP; formulario recusava numero vazio; apontamento gravava so no JSON da OP e nao chamava `concluirOPCompleto`; baixa de estoque no 100% atualizava produto de novo.
- Causa raiz: numeracao e conferencia fora do ponto unico de persistencia.
- Arquivos alterados: `ordemProducaoPolicy.js` (extracao de `useFluxoPedido.jsx`), `localCadastroMasterPolicy.js`, `localBase44Client.js`, `useFluxoPedido.jsx`, `GerarOPModal.jsx`, `FormularioOrdemProducao.jsx`, `ApontamentoProducao.jsx`, `contextoMultiempresaPolicy.js`, testes.
- Reutilizado: OP, apontamento, `concluirOPCompleto` e reserva de codigo mestre.
- Alteracoes: `OP-000001` reservado na gravacao; retry reusa OP do pedido; apontamento exige empresa, persiste entidade e entra em conferencia em 100%; botao existente "Conferir e liberar" finaliza a OP; pedido segue `Pronto para Faturar`.
- Multiempresa: OP e apontamento exigem empresa de producao.
- Pendencia: etiqueta/lote/rastreio por peca e saldo por deposito ficam para lotes seguintes; Gate 11 trata romaneio/motorista.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 11 Expedicao.

### Gate 9 - Fiscal: homologacao simula, producao exige autorizacao
- Objetivo: cumprir o Gate 9 de `PLANO_GO_LIVE.md` na emissao existente, sem tela fiscal paralela.
- Diagnostico: enviar NF-e sempre chamava mock e autorizava ate em producao; `nfeActions` simulava quando o provedor faltava; numero da nota era aleatorio; NF autorizada podia ser apagada.
- Causa raiz: simulacao usada como emissao real, sem empresa/serie/autorizacao no ponto de envio.
- Arquivos alterados: `notaFiscalEmissaoPolicy.js` (extracao), `localBase44Client.js`, `nfeActions/entry.ts`, `NotasFiscaisTab.jsx`, `MockIntegracoes.jsx`, `FechamentoFinanceiroTab.jsx`, `ConfiguracaoNFeForm.jsx`, `EmpresaFormCompleto.jsx`, `EmpresaForm.jsx`, `TesteNFe.jsx`, testes.
- Reutilizado: aba de notas, mock de homologacao, `emitirNFe`, cadastro fiscal da empresa.
- Alteracoes: numero reservado por empresa+serie; homologacao continua simulada; producao exige flag explicita e provedor; falha marca `Rejeitada`; exclusao de NF autorizada/cancelada bloqueada; CFOP gravado no fechamento.
- Multiempresa: NF so com empresa emitente.
- Pendencia: tributos (NCM/CST/totalizadores) ainda nao sao validados item a item no SEFAZ real.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 10 Producao.

### Gate 8 - Financeiro: baixa, estorno e vinculo do titulo
- Objetivo: cumprir o Gate 8 de `PLANO_GO_LIVE.md` nos titulos existentes, sem tela financeira paralela.
- Diagnostico: liquidacao em lote gravava direto na entidade sem permissao nem idempotencia; titulo liquidado podia ter valor/pedido alterados; exclusao fisica nao distinguia liquidado; parcelas do pedido podiam nascer duplicadas no fechamento.
- Causa raiz: regras de titulo so no frontend, fora do `create`/`update`/`delete` local.
- Arquivos alterados: `financeiroTituloPolicy.js` (extracao, `localBase44Client.js` ja passa de 1400 linhas), `localBase44Client.js`, `useFluxoPedido.jsx`, `ContasReceberTab.jsx`, `ContasPagarTab.jsx`, `LiquidacaoEmLote.jsx`, testes.
- Reutilizado: `ContaReceber`/`ContaPagar`, baixa manual das abas, geracao de CR no fluxo do pedido.
- Alteracoes: nao exclui liquidado/estornado; estorno conserva valor, empresa e pedido; baixa exige `receber`/`pagar`; empresa do titulo nao troca; retry de parcela/baixa e idempotente.
- Multiempresa: grupo nao altera a empresa dona do titulo.
- Pendencia: conciliarcao bancaria e caixa PDV ainda podem liquidar por outros caminhos visuais; rateio multiempresa permanece na tela existente.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 9 Fiscal.

### Gate 7 - Estoque: saldo, origem e historico
- Objetivo: cumprir o Gate 7 de `PLANO_GO_LIVE.md` na persistencia existente, sem tela de estoque paralela.
- Diagnostico: a aba de movimentacao gravava a NF/movimento e so depois conferia saldo; retry e exclusao apagavam historico; saida podia ir a negativo; produto de uma empresa aceitava movimento de outra.
- Causa raiz: saldo e trilha tratados no frontend, fora do ponto unico de gravacao.
- Arquivos alterados: `estoqueMovimentoPolicy.js` (extracao, `localBase44Client.js` ja passa de 1400 linhas), `localBase44Client.js`, `MovimentacoesTab.jsx`, `MovimentacaoForm.jsx`, `movimentacaoSchema.jsx`, `RecebimentoTab.jsx`, `OrdensCompraTab.jsx`, `entityGuardPolicy/entry.ts`, testes.
- Reutilizado: `MovimentacaoEstoque`, `Produto.estoque_atual`, `createInContext` e a tela de movimentacao ja existente.
- Alteracoes: gravacao aplica saldo, recusa negativo sem politica, recusa empresa divergente, idempotencia por origem/documento, bloqueio de exclusao de movimento/auditoria; ajuste exige alçada (`aprovar`); recebimento deixa de somar estoque duas vezes.
- Multiempresa: movimento operacional exige empresa; produto com empresa dona nao aceita movimento de outra.
- Pendencia: saldo ainda e um campo no produto mestre, nao por local; transferencia entre empresas nao decompõe estoque por deposito.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 8 Financeiro.

### Gate 6 - Comercial: faturamento parcial e teto do pedido
- Objetivo: cumprir o Gate 6 de `PLANO_GO_LIVE.md` no fluxo existente (pedido → NF), sem tela comercial paralela.
- Diagnostico: emitir NF-e no fechamento so fazia `console.log`; `faturarPedidoCompleto` marcava `Faturado` no valor cheio sem saldo; numero do pedido nascia com `Date.now()`.
- Causa raiz: faturamento sem persistencia nem confronto com NFs ja emitidas do mesmo pedido.
- Arquivos alterados: `pedidoFaturamentoPolicy.js` (extracao de `useFluxoPedido.jsx`, acima de 900 linhas), `useFluxoPedido.jsx`, `FechamentoFinanceiroTab.jsx`, `GerarNFeModal.jsx`, `NotasFiscaisTab.jsx`, `PedidoForm.jsx`, `DetalhesPedidoHeader.jsx`, `WizardPedidoLateral.jsx`, `WizardEtapa1Cliente.jsx`, `localCadastroMasterPolicy.js`, `localBase44Client.js`, testes.
- Reutilizado: modal de escopo pedido/etapa, `createInContext('NotaFiscal')`, reserva de codigo mestre, fluxo de estoque/entrega ja existente.
- Alteracoes: NF gravada com empresa faturadora; valor acima do saldo e recusado; status `Faturado Parcial` ou `Faturado`; baixa de estoque so no faturamento do pedido inteiro; `PED-000001` reservado na gravacao.
- Multiempresa: NF operacional exige empresa; grupo nao emite.
- Pendencia: baixa de estoque por etapa/item ainda nao recorta quantidade; financeiro titular permanece no fluxo de aprovacao existente (Gate 8).
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 7 Estoque.

### Gate 5 - Cadastros mestres com codigo reservado no backend
- Objetivo: cumprir o Gate 5 de `PLANO_GO_LIVE.md` no cadastro existente, sem tela ou cadastro paralelo.
- Diagnostico: o formulario de produto gerava SKU com `ultimoCodigo + 1` na primeira pagina da lista; o `create` local aceitava documento repetido no mesmo grupo; importacao com codigo conflitante podia sobrescrever.
- Causa raiz: numeracao no frontend e ausencia de reserva/duplicidade no ponto unico de persistencia.
- Arquivos alterados: `localCadastroMasterPolicy.js` (extracao, `localBase44Client.js` ja passa de 1400 linhas), `localBase44Client.js`, `ProdutoFormV22_Completo.jsx`, `useEntityCounts.jsx`, testes.
- Reutilizado: `ConfiguracaoSistema` como contador por entidade+grupo, `create` local, formulario de produto ja existente.
- Alteracoes: codigo interno reservado na gravacao; conflito de importacao preserva `codigo_origem`/`codigo_legado`; CPF/CNPJ duplicado no grupo e bloqueado; contagem deixa de falhar em silencio.
- Pendencia: demais formularios de cadastro ainda aceitam codigo digitado sem reserva propria; inativar/restaurar universal permanece no visualizador existente.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 6 Comercial.

### Gate 4 - Auditoria operacional sem falha silenciosa
- Objetivo: cumprir o Gate 4 de `PLANO_GO_LIVE.md`: acoes criticas rastreaveis e erros visiveis, sem criar tela ou modulo novo.
- Diagnostico: liquidacao, cobranca, link de pagamento e configuracao de seguranca gravavam `AuditLog` dentro de `catch {}`; mutacao local persistia token/segredo no log; conformidade de credito do pedido falhava aberto; `auditEntityEvents` devolvia `err.message`.
- Causa raiz: auditoria tratada como opcional e payload bruto reutilizado como trilha.
- Arquivos alterados: `sanitizeOnWrite.jsx`, `uiAudit.jsx`, `localBase44Client.js`, fluxos financeiros de caixa/cobranca, `ConfiguracaoSeguranca.jsx`, `PedidoTabsContainer.jsx`, `ImportarXMLNFe.jsx`, `IntegracoesIndex.jsx`, `auditEntityEvents`, `auditHelpers`, testes.
- Reutilizado: `AuditLog`, `uiAudit` e o sanitizador de escrita ja existentes.
- Alteracoes: `persistOperationalAudit` registra usuario, modulo, acao, grupo/empresa e correlacao; falha de auditoria vai para log tecnico; payloads redigem token/senha/certificado; credito do pedido falha fechado se a consulta quebrar.
- Pendencia: ainda existem `catch {}` de persistencia visual (aba, localStorage) fora deste recorte operacional.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 5 Cadastros Gerais.

### Gate 3 - Multiempresa sem vazamento entre empresas
- Objetivo: cumprir o Gate 3 de `PLANO_GO_LIVE.md` no codigo existente, com grupo consolidando e empresa operando.
- Diagnostico: a leitura com empresa ativa usava `$or` com `group_id`, devolvendo todos os registros do grupo; cadastros relaxados zeravam o filtro; o seletor de contexto carregava qualquer grupo/empresa via `list()` e atalho de admin; operacao fiscal/comercial podia nascer no grupo sem empresa emitente.
- Causa raiz: consolidacao do grupo misturada na visao da empresa, e troca de contexto sem validar vinculo e dono do grupo.
- Arquivos alterados: `contextoMultiempresaPolicy.js`, `localBase44Client.js`, `useContextoVisual.jsx`, `useContextoGrupoEmpresa.jsx`, `tests/contexto-multiempresa-policy.test.js`.
- Reutilizado: `filterInContext`, `carimbarContexto`, `stampRecordContext` e o seletor de grupo/empresa ja existente, sem tela ou modulo novo.
- Alteracoes: leitura de empresa exige grupo e empresa juntos (`$and`); consolidado do grupo permanece `$or` nas empresas autorizadas; troca de contexto recusa empresa de outro grupo; NF/pedido/financeiro/estoque operacional exigem empresa na gravacao.
- Multiempresa: zero mistura na visao da empresa; grupo continua vendo a operacao das empresas do mesmo grupo.
- Pendencia: Gate 4 auditoria/seguranca/erros; `entity.list()` ainda nao e o caminho principal das telas.
- Validacoes: `node --test`, `git diff --check` e `npm run build`.
- Proximo passo da ordem P0: Gate 4 auditoria, seguranca e erros.

### Governanca - Commit e push obrigatorios no AGENTS.md
- Inclui a secao 16.1 no `AGENTS.md`: todo lote validado deve ter commit e `git push origin HEAD`, sem deixar so local.
- A ordem P0/P1/P2 passa a ser seguida em sequencia; "proxima ordem" e o proximo Gate aberto em `PLANO_GO_LIVE.md`.
- A regra permanente do Cursor foi alinhada para o mesmo fluxo de entrega.
- Proximo passo da ordem P0: Gate 3 multiempresa.


- Objetivo: seguir a ordem do `AGENTS.md` apos o Gate 1, no Gate 2 de `PLANO_GO_LIVE.md`.
- Diagnostico: `entityGuard`, `usePermissions` e o cliente local liberavam qualquer acao quando `role === 'admin'`; `executar`, `emitir` e `importar` eram colapsados em editar/criar; lookup de empresa no guard engolia erro.
- Causa raiz: atalho de papel no lugar da matriz de perfil, e aliases perigosos.
- Arquivos alterados: `entityGuardPolicy`, `entityGuard`, `guardCallPolicy`, `usePermissions.jsx`, `localBase44Client.js`, testes existentes.
- Reutilizado: `PerfilAcesso` local `local_perfil_admin` com wildcard `*` das acoes granulares, sem tela ou modulo novo.
- Multiempresa/RBAC: papel admin nao autoriza sozinho; perfil sem permissao falha fechado; wildcard so no perfil administrador local.
- Pendencia: atalhos `isAdmin()` em algumas telas ainda existem e entram no proximo recorte de RBAC visual; `solicitacoesAprovacao` ainda tem atalho de admin.
- Validacoes: `node --test` 51/51, `git diff --check` e `npm run build` passaram.
- Proximo passo da ordem P0: Gate 3 multiempresa (vazamento entre empresas / consolidacao do grupo).


- Objetivo: iniciar a ordem do `AGENTS.md` (P0.1 seguranca / Gate 1 de `PLANO_GO_LIVE.md`) sem criar tela, modulo ou fluxo paralelo.
- Diagnostico: `AuthContext` no modo local autenticava sempre; `auth.me` e `isAuthenticated` do cliente local liberavam usuario inativo, desativado, sem grupo/empresa e sessao revogada; `App.jsx` renderizava rotas internas mesmo sem autenticacao; `GerenciadorSessoes` consultava sessao direto e usava `localStorage` como fallback de grupo.
- Causa raiz: confianca no frontend/localStorage e autenticacao incondicional no modo local.
- Arquivos alterados: `src/api/localAuthSessionPolicy.js` (extracao da regra, porque `localBase44Client.js` ja ultrapassa 1400 linhas), `src/api/localBase44Client.js`, `src/lib/AuthContext.jsx`, `src/App.jsx`, `src/components/UserNotRegisteredError.jsx`, `src/components/sistema/GerenciadorSessoes.jsx`, `tests/local-auth-session-policy.test.js`.
- Componentes reutilizados: `UserNotRegisteredError`, `filterInContext`, `GerenciadorSessoes`.
- Alteracoes: avaliacao canonica de sessao/usuario; `auth.me` falha fechado; rotas internas so com `isAuthenticated`; bloqueio visual para inativo, desativado, sem grupo e sem empresa; sessoes filtradas no contexto e sem fallback de `localStorage`.
- Multiempresa: perfil sem grupo e perfil operacional sem empresa nao entram no ERP.
- RBAC/seguranca/auditoria: autenticacao deixa de ser sempre verdadeira; consultas de sessao passam por `filterInContext`; auditoria de encerramento existente foi preservada.
- Validacoes: `node --test` 47/47, `git diff --check`, `npm run build` e `audit:baseline` executados neste lote.
- Proximo passo da ordem P0: Gate 2 RBAC granular (matriz frontend + backend), depois multiempresa, auditoria e Cadastros Gerais.


- Continuei o plano salvo a partir do commit `0775f4f7`, fortalecendo os componentes existentes `IALeituraProjeto` e `IAPrevisaoLogistica`.
- A leitura de projetos agora exige Grupo valido e RBAC `Sistema.Integracoes.executar` para selecionar modo, carregar arquivo e processar com IA.
- Arquivos vazios, maiores que 10 MB ou fora dos formatos permitidos sao rejeitados; a resposta de upload sem URL e a resposta de IA fora do contrato falham de forma controlada.
- O retorno da IA e normalizado, limitado a 500 elementos, com textos truncados e numeros/confianca saneados antes de entrar no estado visual.
- Auditorias registram somente tipo/tamanho do arquivo, modo, totais, confianca e tipo tecnico de erro; nome do arquivo, URL temporaria e mensagem bruta nao sao persistidos.
- A previsao logistica passou a exigir Grupo+Empresa e permissao de execucao tanto para gerar previsoes quanto para aplicar sugestoes.
- Os botoes de sugestao agora registram a aplicacao no resultado atual, mudam para `Aplicada` e ficam bloqueados contra repeticao; o estado e limpo ao trocar Grupo/Empresa ou gerar nova previsao.
- Auditorias de aplicacao guardam apenas tipo e indice da sugestao, sem titulo, descricao ou acao livre; falhas exibem mensagem generica.
- Grades, cabecalhos, regioes e indicadores foram ajustados para celular, tablet e desktop, mantendo `w-full h-full` nos containers principais.
- Pela refatoracao obrigatoria da Regra-Mae, os componentes principais cairam de 519 para 336 linhas e de 408 para 352 linhas; esquema, simulacoes e resultado tabular foram extraidos para auxiliares internos, sem criar tela, rota, modulo ou nova funcionalidade.
- O teste de baseline existente foi ampliado para impedir regressao de escopo, RBAC por execucao, saneamento da resposta, auditoria segura, estado dos botoes e layout.
- Validacoes concluidas: teste direcionado (1/1), `npm test` (41/41), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- Commit funcional publicado na `main`: `d158ce0c` (`Protege fluxos de IA das integracoes`).
- O baseline permaneceu em 179 capturas operacionais silenciosas e passou a registrar 1515 controles com marcador de permissao.
- Proximo passo sugerido: revisar os componentes existentes `BancosOpenBankingWIP` e `MockIntegracoes`, confirmando utilidade real, contexto Grupo/Empresa, RBAC por acao e ausencia de controles apenas visuais.
### Integracoes - Teste WhatsApp e Toggles de Marketplaces Persistentes
- Continuei o plano salvo a partir do commit `6bac57ce`, fortalecendo os componentes existentes `TesteWhatsApp` e `SincronizacaoMarketplaces`.
- O teste WhatsApp passou a exigir Grupo valido e RBAC `Sistema.Integracoes.executar` nos campos, templates e envio, sem reutilizar permissao de edicao.
- Telefone e resultado sao limpos ao trocar Grupo/Empresa; telefone e mensagem possuem limites e os templates se adaptam a celular, tablet e desktop.
- A leitura do status aceita a chave persistida `ativo` e preserva compatibilidade com a chave legada `ativa`.
- Auditorias do teste registram somente indicadores, tamanho da mensagem, configuracao e tipo tecnico de erro; telefone e erro bruto nao sao persistidos.
- Os toggles de Mercado Livre, Shopee e Amazon deixaram de ser somente visuais e agora criam ou atualizam `ConfiguracaoIntegracaoMarketplace` no Grupo+Empresa selecionado.
- Cada toggle resolve a operacao real e exige RBAC granular de criar ou editar; a sincronizacao manual exige executar e a listagem exige visualizar.
- Auditorias dos toggles usam a entidade correta, registro, operacao e estado antes/depois, sem token ou payload completo; falhas mostram mensagem generica.
- Configuracoes e pedidos sao consultados somente com Grupo+Empresa, e o estado visual e reconstruido da persistencia ao trocar contexto.
- Classes de cor passaram a ser estaticas para geracao correta pelo Tailwind; cards, acoes e tabela receberam ajustes responsivos e `w-full h-full`.
- O teste de baseline existente foi ampliado para impedir regressao de escopo, persistencia, RBAC por acao, auditoria segura e layout.
- Validacoes concluidas: teste direcionado (1/1), `npm test` (40/40), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- Commit funcional publicado na `main`: `886173bc` (`Persiste toggles e protege teste WhatsApp`).
- O baseline permaneceu em 179 capturas operacionais silenciosas; controles com marcador de permissao aumentaram de 1507 para 1512.
- Proximo passo sugerido: revisar os filhos existentes `IALeituraProjeto` e `IAPrevisaoLogistica`, reforcando Grupo/Empresa, RBAC por acao e auditorias sem payload tecnico sensivel.

### Integracoes - WhatsApp Business e Marketplaces com Escopo Estrito
- Continuei o plano salvo a partir do commit `b41abb4e`, fortalecendo as configuracoes existentes de WhatsApp Business e a sincronizacao ativa de marketplaces.
- WhatsApp passou a exigir Grupo valido, separar RBAC de criar, editar e executar e limpar o estado local ao trocar o contexto, evitando exibicao de configuracao anterior.
- Telefone, token e dias de antecedencia agora sao normalizados e limitados antes da persistencia; numero, token, payload completo e erros brutos nao entram na auditoria.
- Auditorias de salvar e testar registram somente operacao, indicadores de configuracao, quantidade de eventos e tipo tecnico de falha.
- Marketplaces agora exige Grupo+Empresa para consultar, buscar e importar pedidos operacionais, com permissao de visualizar, executar e criar+editar conforme cada acao.
- Importacao rejeita pedido fora do Grupo/Empresa, estado nao importavel, pedido ja vinculado, pedido ERP duplicado, documento invalido, lista de itens vazia e cliente vinculado fora do escopo.
- A classificacao de CPF/Pessoa Fisica e CNPJ/Pessoa Juridica foi corrigida apos normalizacao do documento.
- O campo duplicado `json_completo` deixou de persistir outra copia dos dados pessoais do pedido simulado; o fluxo operacional e os campos utilizados foram preservados.
- Sincronizacao usa `try/finally`, registra falha resumida e sempre libera o estado de carregamento; links externos usam identificador codificado, `noopener,noreferrer` e validacao de escopo/RBAC.
- Layouts principais foram alinhados a `w-full h-full`, acoes do WhatsApp ficaram responsivas e a tabela de marketplace preserva rolagem horizontal.
- Pela refatoracao obrigatoria da Regra-Mae, os componentes principais cairam para 370 e 323 linhas; eventos, tabela e dados simulados foram extraidos para tres auxiliares pequenos, sem criar tela, rota, modulo ou funcionalidade.
- O teste de baseline existente foi ampliado para impedir regressao de contexto, RBAC, duplicidade, auditoria segura, abertura externa e persistencia minima.
- Validacoes concluidas: teste direcionado (1/1), `npm test` (39/39), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- Commit funcional publicado na `main`: `185c62c8` (`Protege WhatsApp e marketplaces por contexto`).
- O baseline permaneceu em 179 capturas operacionais silenciosas e 1507 controles com marcador de permissao; a reducao de controles brutos reflete a consolidacao dos toggles repetidos.
- Proximo passo sugerido: revisar os componentes existentes `TesteWhatsApp` e `SincronizacaoMarketplaces`, aplicando o mesmo contexto estrito, RBAC por execucao, persistencia real dos toggles e auditoria sem telefone ou erro bruto.

### Integracoes - Testes Tecnicos com Escopo e Acoes Funcionais
- Continuei o plano salvo a partir do commit `d67da533`, fortalecendo os quatro testes tecnicos existentes de NF-e, boletos, transportadoras e Google Maps.
- Todos os testes agora exigem `group_id`; quando o escopo selecionado for Empresa, o `empresa_id` continua obrigatorio e vinculado ao Grupo.
- A execucao deixou de reutilizar permissao de edicao e passou a exigir `Sistema.Integracoes.executar`; a visualizacao de XML, DANFE e boleto exige permissao granular de visualizar.
- Os botoes existentes Ver XML, Ver DANFE e Ver Boleto PDF passaram a funcionar com validacao de URL HTTPS, isolamento da janela aberta e auditoria resumida.
- A copia do PIX passou a aguardar o clipboard, tratar falhas e registrar somente o tipo da operacao.
- Auditorias de bloqueio e erro agora sao marcadas como malsucedidas e registram apenas indicadores, tipo de erro e contexto Grupo/Empresa.
- Numero de pedido, cliente, CEP, enderecos, coordenadas e mensagens brutas de excecao deixaram de ser persistidos nas auditorias.
- Campos livres receberam limites de tamanho e grades de boleto e transportadora foram ajustadas para celular, tablet e desktop.
- Os containers principais dos quatro componentes foram alinhados a `w-full h-full`, preservando o uso em janela e o fluxo visual atual.
- O teste de baseline existente foi ampliado para impedir regressao de contexto, RBAC por execucao, auditoria segura e funcionamento dos botoes de documentos.
- Validacoes concluidas: teste direcionado (1/1), `npm test` (38/38), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- Commit funcional publicado na `main`: `4f56b169` (`Protege testes tecnicos de integracoes`).
- O baseline permaneceu em 179 capturas operacionais silenciosas; controles com marcador de permissao aumentaram de 1506 para 1507.
- Mantida a Regra-Mae: somente componentes, teste e status existentes foram melhorados; nenhuma tela, funcionalidade, rota, modulo ou arquivo de projeto foi criado ou removido.
- Proximo passo sugerido: revisar as configuracoes existentes de WhatsApp Business e sincronizacao de marketplaces, reforcando contexto Grupo/Empresa, RBAC por acao, persistencia minima e auditoria sem credenciais.

### Integracoes - Status Seguro, RBAC e Verificadores Multiempresa
- Continuei o plano salvo a partir do commit `b212afa0`, fortalecendo o painel existente `StatusIntegracoes` e seus tres verificadores.
- Consultas e persistencia de configuracoes agora exigem e transportam `group_id` e `empresa_id` no contexto de empresa; o contexto de Grupo permanece restrito ao `group_id`.
- Os botoes Verificar e Configurar passaram a exigir contexto valido e RBAC granular de executar, criar ou editar.
- A operacao real de criar/editar e conferida novamente no envio do formulario, impedindo que uma permissao seja usada no lugar da outra.
- Atualizacoes deixaram de reenviar o registro completo e persistem somente a chave, categoria, contexto e configuracao alterada.
- Verificacoes e salvamentos agora geram auditoria resumida com integracao, operacao e indicadores, sem credenciais ou payloads completos; erros brutos ficam fora da interface.
- Estados retornados sao reduzidos a configurado/conectado/provedor e QR Code validado; tokens e configuracoes completas nao permanecem no estado visual.
- O estado das tres integracoes e limpo ao trocar Grupo/Empresa, evitando exibir resultado do contexto anterior.
- O verificador de WhatsApp deixou de chamar a acao backend `status`, que nao existia e exigia destinatario; agora valida a configuracao no mesmo escopo, sem enviar mensagem.
- Os verificadores de NF-e, Boletos e WhatsApp passaram a exigir Grupo+Empresa; geracao, consulta e cancelamento de cobrancas foram alinhados ao novo contrato.
- Pela Regra-Mae, o helper interno de botoes foi extraido para `IntegrationConfigButtons.jsx`: o painel caiu de 516 para 386 linhas e o helper ficou com 134 linhas, sem duplicar funcionalidade.
- O teste de baseline existente foi ampliado para impedir regressao de escopo, RBAC, persistencia minima, estado seguro e chamada WhatsApp inexistente.
- Validacoes concluidas: teste direcionado (1/1), `npm test` (37/37), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- O baseline permaneceu em 179 capturas silenciosas; controles com marcador de permissao aumentaram de 1503 para 1506.
- Proximo passo sugerido: revisar os componentes existentes `TesteNFe`, `TesteBoletos`, `TesteTransportadoras` e `TesteGoogleMaps`, aplicando contexto completo, RBAC por acao e auditoria sem credenciais.

### Integracoes - Contexto Explicito e Auditoria Resumida
- Continuei o plano salvo a partir do commit `1e9c8cf1`, fortalecendo o fluxo existente da Administracao de Integracoes.
- A consulta de `ConfiguracaoSistema` agora envia `group_id` e `empresa_id` explicitamente, alem de manter o filtro pelo escopo selecionado.
- O contexto de empresa passou a exigir e transportar os dois identificadores; consultas ficam desabilitadas quando o `group_id` nao puder ser resolvido.
- O sanitizador de auditoria passou a redigir valores associados a token, senha, segredo, API key, certificado e URL de webhook.
- A troca de abas reutiliza o helper central de auditoria e deixou de ocultar falhas assincronas.
- A criacao da estrutura base e os testes de webhook Asaas/NF-e registram somente operacao, provedor, evento e indicadores, sem copiar os payloads completos.
- A copia do endereco de webhook registra apenas o recurso acessado; a URL completa deixou de ser persistida inclusive nas tentativas bloqueadas.
- Falhas de consulta, criacao, simulacao e copia agora geram diagnostico tecnico e auditoria resumida, enquanto a interface mostra mensagens genericas sem excecao bruta.
- O teste de baseline existente foi ampliado para impedir regressao do contexto, da redacao, das capturas silenciosas e das auditorias resumidas.
- Validacoes concluidas: teste direcionado (1/1), `npm test` (36/36), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- O baseline de capturas operacionais silenciosas caiu de 180 para 179.
- Mantida a Regra-Mae: somente componente, teste e status existentes foram melhorados; nenhuma tela, funcionalidade, rota, modulo ou arquivo de projeto foi criado ou removido.
- Proximo passo sugerido: revisar `StatusIntegracoes` e os componentes existentes de teste tecnico, garantindo escopo Grupo/Empresa, RBAC por acao e auditoria sem credenciais.

### Integracoes - Toggles Persistentes com RBAC por Operacao
- Continuei o plano salvo a partir do commit `fa351485`, corrigindo os toggles existentes da Central de Integracoes.
- Os cards de NFe, Boletos e WhatsApp agora exibem estado inativo ate que a configuracao persistida confirme a ativacao.
- A permissao exigida passa a acompanhar a operacao real: `Sistema.Integracoes.criar` para a primeira configuracao e `Sistema.Integracoes.editar` para configuracoes existentes.
- O bloqueio visual e o marcador `data-permission` dos toggles foram alinhados a mesma decisao de autorizacao.
- Atualizacoes deixaram de reenviar o registro completo existente e persistem somente o payload minimo de contexto e ativacao.
- Falhas de ativacao/desativacao agora geram auditoria resumida com Grupo/Empresa e estado solicitado, sem expor mensagem bruta ao usuario.
- O teste de baseline existente foi ampliado para impedir regressao do estado persistido, do RBAC por operacao, da atualizacao minima e da auditoria de falha.
- Validacoes concluidas: teste direcionado (1/1), `npm test` (35/35), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- O baseline de capturas operacionais silenciosas permaneceu em 180.
- Mantida a Regra-Mae: somente componente, teste e status existentes foram melhorados; nenhuma tela, funcionalidade, rota, modulo ou arquivo de projeto foi criado ou removido.
- Proximo passo sugerido: revisar o fluxo existente de configuracao detalhada em `IntegracoesIndex`, eliminando capturas silenciosas, explicitando contexto Grupo/Empresa e resumindo auditorias sem segredos.

### Multiempresa - Contexto Explicito nos Chamadores Genericos
- Continuei o plano salvo a partir do commit `08072655`, preparando os fluxos existentes de `getEntityRecord` e `entityListSorted` para validacao backend estrita.
- O alerta fiscal do `Layout` agora envia explicitamente `group_id` e `empresa_id` ao consultar `ConfiguracaoSistema`.
- A barra de status da Administracao tambem envia Grupo/Empresa e deixou de ocultar silenciosamente falhas da consulta.
- O hook central `useEntityListSorted` passou a enviar o contexto canonico junto do filtro em todas as listagens que o utilizam.
- O Visualizador Universal envia Grupo/Empresa tanto na listagem normal quanto na busca paginada usada pela exclusao em lote.
- Os filtros e chaves de cache existentes foram preservados, mantendo separacao visual entre Grupo e Empresa e o comportamento atual das telas.
- O teste de baseline existente foi ampliado para impedir que esses quatro chamadores voltem a depender apenas de filtros implicitos.
- Validacoes concluidas: teste direcionado (1/1), `npm test` (34/34), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- O baseline de capturas operacionais silenciosas permaneceu em 180; uma captura da barra administrativa foi substituida por diagnostico, mas a classificacao agregada nao mudou por outras ocorrencias do arquivo.
- Mantida a Regra-Mae: somente chamadores, teste e status existentes foram melhorados; nenhuma tela, funcionalidade, rota, modulo ou arquivo de projeto foi criado ou removido.
- Proximo passo sugerido: endurecer `getEntityRecord` e depois `entityListSorted` no backend, com lista fechada de entidades, validacao Grupo/Empresa, RBAC e retorno filtrado por escopo. Essa alteracao de autorizacao exige confirmacao explicita do usuario.
### Administracao - Ferramentas com RBAC Granular e Fluxo Seguro
- Continuei o plano salvo a partir do commit `4d7044ab`, alinhando a aba Ferramentas e os backends existentes `seedData` e `backfillGroupEmpresa`.
- A aba agora aparece para administradores ou perfis com `Sistema.Ferramentas.visualizar`, preservando o controle granular de acesso.
- Usuarios autenticados deixaram de depender do papel global de administrador e passam a ser autorizados pelo `entityGuard`; automacoes sem usuario continuam exigindo `DEPLOY_AUDIT_TOKEN`.
- O seed foi alinhado a permissao `Sistema.Ferramentas.editar` no frontend e backend.
- No contexto de Grupo, o seed existente passa a usar o modo multiempresa e replica os dados para todas as empresas validas do grupo; no contexto de Empresa, permanece restrito a empresa selecionada.
- As permissoes alternativas de Configuracoes foram removidas da decisao dos botoes para impedir liberacao indireta de operacoes sensiveis.
- A aplicacao do backfill agora so e liberada apos dry-run bem-sucedido no mesmo Grupo/Empresa e volta a ser bloqueada depois da aplicacao.
- Auditorias e mensagens de sucesso passaram a usar totais resumidos, sem copiar payloads ou listas completas retornadas pelas funcoes.
- Mensagens brutas de excecao deixaram de ser persistidas na auditoria frontend, e a captura silenciosa da sincronizacao da URL foi substituida por registro tecnico.
- O teste de baseline existente foi ampliado para proteger visibilidade, acoes RBAC, propagacao de Grupo, pre-requisito de dry-run e auditoria resumida.
- Validacoes concluidas: `node --check`, teste direcionado (1/1), `npm test` (33/33), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- O baseline de capturas operacionais silenciosas caiu de 181 para 180.
- Mantida a Regra-Mae: somente tela, funcoes, teste e status existentes foram melhorados; nenhuma funcionalidade, rota, modulo ou arquivo de projeto foi criado ou removido.
- Proximo passo sugerido: revisar endpoints genericos existentes que usam service role, com prioridade para `getEntityRecord` e `entityListSorted`, garantindo lista fechada de entidades, contexto Grupo/Empresa, RBAC e auditoria segura.
### Sistema - Seed Administrativo com Escopo Estrito
- Continuei o plano salvo a partir do commit `d3f8ad1f`, fortalecendo a funcao existente `seedData` usada pela aba Ferramentas.
- Foi removida a inferencia silenciosa da primeira empresa global e a criacao automatica de Grupo/Empresa; o bootstrap controlado continua preservado em `seedMultiCompanyData`.
- Execucoes agora exigem `group_id` explicito e, no modo de empresa unica, tambem `empresa_id`; empresas externas ao grupo sao bloqueadas.
- Chamadas sem usuario exigem `DEPLOY_AUDIT_TOKEN`; usuarios autenticados continuam exigindo administrador e passam pelo RBAC granular de Sistema/Ferramentas.
- O modo multiempresa foi preservado e continua semeando todas as empresas do grupo, repassando o token interno nas chamadas existentes.
- Quantidades de clientes, produtos e colaboradores foram normalizadas, inteiras e limitadas a 500 por tipo.
- Falhas por entidade deixaram de gravar o registro completo; auditorias agora contem somente Grupo/Empresa, tipo de erro e identificacao da operacao.
- Stack, payload bruto e mensagens de erro nas respostas multiempresa foram removidos; falhas auxiliares de estoque e auditoria deixaram de ser silenciosas.
- O teste de baseline existente foi ampliado para impedir retorno da selecao global, bootstrap automatico, empresa fora do grupo, ausencia de token/RBAC e auditoria com payload/stack.
- Validacoes concluidas: `node --check`, teste direcionado (1/1), `npm test` (32/32), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- O baseline de capturas operacionais silenciosas caiu de 186 para 181.
- Mantida a Regra-Mae: somente funcao, teste e status existentes foram melhorados; nenhuma tela, modulo, rota ou funcionalidade foi criada ou removida.
- Proximo passo sugerido: revisar as demais operacoes existentes da aba Ferramentas e os chamadores administrativos, garantindo escopo explicito, RBAC backend e auditoria resumida de ponta a ponta.
### Sistema - Seed Multiempresa com Contexto Explicito
- Continuei o plano salvo a partir do commit `0ca084fb`, fortalecendo a funcao existente `seedMultiCompanyData`.
- Foi removida a escolha automatica do primeiro grupo encontrado; execucoes normais agora exigem `group_id` explicito.
- A inicializacao de Grupo/Empresas foi preservada, mas exige `initialize_if_empty: true`, ausencia total de empresas e `DEPLOY_AUDIT_TOKEN` valido.
- Chamadas sem usuario exigem token interno; usuarios autenticados continuam exigindo administrador e passam pelo RBAC granular de Sistema/Ferramentas.
- `empresa_id` e `empresas_ids` sao validados contra o grupo, bloqueando qualquer destino externo.
- Quantidades de clientes, produtos e fornecedores foram normalizadas e limitadas a 500 por tipo; a inicializacao foi limitada a 20 empresas.
- Falhas de configuracao, criacao e propagacao deixaram de ser silenciosas e agora registram somente operacao, Grupo/Empresa e contexto tecnico minimo.
- Contadores de criacao so aumentam apos sucesso e o resumo por empresa passou a separar criados de falhas.
- A propagacao existente de Plano de Contas/Centro de Custo continua enviando o token interno.
- Auditoria final inclui Grupo/Empresa, IDs de empresas, contagens e resultados resumidos, sem copiar registros criados.
- O teste de baseline existente foi ampliado para impedir selecao global ambigua, bootstrap sem token e empresa fora do grupo.
- Validacoes concluidas: `node --check`, teste direcionado (6/6), `npm test` (31/31), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- O baseline de capturas operacionais silenciosas caiu de 190 para 186.
- Mantida a Regra-Mae: somente funcao, teste e status existentes foram melhorados; o bootstrap foi preservado de forma controlada e nenhuma tela, modulo ou rota foi criada.
- Proximo passo sugerido: endurecer o `seedData` existente, removendo inferencia global de empresa, validando Grupo/Empresa e reduzindo auditorias de erro com payload e stack completos.
### Sistema - Backfill Multiempresa com Varredura Segura
- Continuei o plano salvo a partir do commit `5ce6bfe0`, fortalecendo a funcao existente `backfillGroupEmpresa`.
- Chamadas sem usuario agora exigem `DEPLOY_AUDIT_TOKEN`; usuarios autenticados continuam exigindo perfil administrador e passam pelo RBAC granular de Sistema/Ferramentas.
- O backfill exige contexto `group_id`/`empresa_id` valido e rejeita empresa que nao pertenca ao grupo informado.
- A varredura global `filter({})` foi removida; cada entidade e consultada somente pelas empresas do grupo, usando seu campo de propriedade correto.
- A lista de entidades aceitas ficou fechada nas entidades operacionais ja atendidas, bloqueando nomes arbitrarios recebidos no payload.
- `NotaFiscal` permanece somente leitura: inconsistencias sao contabilizadas, mas o backfill nao altera registros fiscais.
- Registros com grupo divergente sao rejeitados e relatados; somente registros sem grupo e vinculados a empresa validada podem receber o `group_id`.
- Limite por entidade foi normalizado e limitado a 5.000 registros para reduzir abuso e sobrecarga.
- Auditorias agora incluem Grupo/Empresa e resumo de processados, atualizados, ignorados e erros, sem copiar registros completos.
- O teste de baseline existente foi ampliado e tambem confirma que a aba Ferramentas continua enviando Grupo/Empresa.
- Validacoes concluidas: `node --check`, teste direcionado (5/5), `npm test` (30/30), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- O baseline de capturas operacionais silenciosas caiu de 191 para 190.
- Mantida a Regra-Mae: somente funcao, teste e status existentes foram melhorados, sem criar tela, modulo ou rota e sem remover o fluxo de dry-run/aplicacao.
- Proximo passo sugerido: endurecer `seedMultiCompanyData`, eliminando deteccao global ambigua de grupo, validando empresas de destino e resumindo falhas/auditoria sem payloads extensos.
### Sistema - Sincronizacao Grupo/Empresas com Escopo Estrito
- Continuei o plano salvo a partir do commit `5a979f3d`, fortalecendo o fluxo existente `syncGroupCompany`.
- Chamadas sem usuario autenticado agora exigem `DEPLOY_AUDIT_TOKEN` no corpo ou no header `x-internal-token`; chamadas humanas passam pelo RBAC granular de Sistema/SyncGroupCompany.
- O contexto `group_id`/`empresa_id` e obrigatorio, e a empresa de origem precisa pertencer ao grupo resolvido.
- Foi removido o fallback que listava todas as empresas ativas quando a consulta por grupo falhava ou voltava vazia.
- Consultas e operacoes de `SyncMap` ficaram limitadas ao `group_id`, descartando mapas de empresas externas ao grupo.
- Sincronizacoes `up` e `down` validam o registro de destino antes de atualizar e persistem explicitamente Grupo/Empresa no escopo correto.
- Exclusoes agora removem somente espelhos cujo contexto corresponde ao mapa; falhas sao registradas sem apagar o mapa pendente.
- Auditorias registram apenas entidade, evento, direcao, IDs e totais, sem copiar o payload completo do registro.
- O teste de baseline existente foi ampliado para impedir retorno do fallback global, ausencia de token/RBAC e mapas sem filtro de grupo.
- Validacoes concluidas: `node --check`, teste direcionado (4/4), `npm test` (29/29), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- O baseline de capturas operacionais silenciosas caiu de 195 para 191.
- Mantida a Regra-Mae: somente funcao, teste e status existentes foram melhorados, sem criar tela, modulo ou rota e sem remover funcionalidade.
- Proximo passo sugerido: revisar `backfillGroupEmpresa`, `seedMultiCompanyData` e as automacoes externas que chamam `syncGroupCompany`, garantindo token interno e escopo estrito na origem.
### Financeiro - Persistência Interempresas com Escopo Estrito
- Continuei o plano salvo revisando persistência sensível e isolamento entre empresas.
- `intercompanyTransfer` deixou de conter a declaração duplicada de usuário que tornava o arquivo inválido.
- A transferência agora exige empresas distintas, existentes e pertencentes ao mesmo `group_id`.
- O RBAC backend é validado separadamente para a empresa de origem e a empresa de destino.
- `ContaPagar` e `ContaReceber` passam a ser criadas com `group_id` e `empresa_id`, preservando a ligação atual entre os lançamentos.
- A descrição recebida é sanitizada e limitada antes da persistência.
- Auditorias da transferência incluem Grupo/Empresa e identificadores mínimos, sem gravar a descrição livre.
- `conflictPolicy` deixou de registrar os documentos completos antes/depois e agora audita somente nomes e quantidade de campos alterados.
- Falhas auxiliares de auditoria deixaram de ser silenciosas e passaram a registrar contexto técnico seguro.
- O teste existente de baseline foi ampliado para proteger escopo interempresas e auditoria resumida.
- Validações concluídas: `node --check`, `npm test` (28/28), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- Mantida a Regra-Mãe: somente fluxos e testes existentes foram melhorados, sem criar módulo, tela ou rota e sem remover funcionalidade.
- Próximo passo sugerido: endurecer `syncGroupCompany`, removendo fallback global de empresas, exigindo autorização interna/RBAC e restringindo mapas ao Grupo/Empresa.
### Fiscal/Importação - Escopo e Auditoria Segura
- Continuei o próximo lote salvo nos fluxos existentes de autorização de NF-e, leitura de planilhas e propagação Grupo/Empresas.
- `onNotaFiscalAuthorized` agora resolve e valida `group_id`/`empresa_id` e rejeita NotaFiscal, Pedido, Produto e Cliente fora do contexto.
- A auditoria pós-autorização registra somente metadados e flags de DANFE/XML/chave, sem links ou payload fiscal completo.
- `parseSpreadsheet` valida URL HTTPS sem credenciais, bloqueia redirecionamentos e limita arquivos a 10 MB; a auditoria registra apenas origem, extensão, planilha, linhas e contexto.
- `propagateGroupConfigs` exige `DEPLOY_AUDIT_TOKEN` para automações sem usuário, valida todas as empresas no grupo e audita resultados resumidos.
- A chamada interna existente de `seedMultiCompanyData` passou a enviar o token de automação.
- Mantida a Regra-Mãe: melhorias nos fluxos existentes, sem criar telas, módulos ou rotas e sem remover funcionalidades.
- Validações concluídas: `node --check`, `npm test` (27/27), `npm run build`, `npm run audit:baseline` e `git diff --check` passaram.
- Próximo passo sugerido: revisar os fluxos restantes de Administração do Sistema, persistência sensível e testes de isolamento multiempresa.
### Comercial/Fiscal - Hooks Operacionais com Contexto e Auditoria Resumida
- Continuei o proximo passo salvo: revisar hooks operacionais (`onOrcamentoConfirmed`, `onOportunidadeStageChanged`, `onPedidoReadyToInvoice`) para reduzir logs com payloads completos e reforcar propagacao Grupo/Empresa.
- `onOrcamentoConfirmed` agora completa `group_id` a partir da empresa antes de criar Pedido, mantendo o fluxo existente de conversao de orcamento confirmado.
- Auditoria do Pedido gerado deixou de gravar o payload completo e passou a salvar resumo com pedido, orcamento, cliente, valor, empresa, grupo e quantidade de itens.
- `onOportunidadeStageChanged` agora completa contexto Grupo/Empresa antes de criar OrcamentoCliente e aceita a etapa com acento e sem acento para preservar compatibilidade.
- Auditoria do OrcamentoCliente gerado por oportunidade agora registra resumo de oportunidade, cliente, valor, empresa, grupo, etapa e status, sem payload completo.
- `onPedidoReadyToInvoice` agora resolve `group_id` pela empresa antes do guard fiscal, bloqueia pedido sem grupo e envia o grupo para `nfeActions`.
- Consulta de configuracao de integracao ERP passou a filtrar tambem por `empresa_id` ou `group_id`, reduzindo risco de usar configuracao de outro escopo.
- Auditorias de webhook ERP e NF-e automatica agora gravam metadados minimos, flags de DANFE/XML e resumo de itens, sem salvar NF-e completa nem retorno externo integral.
- Falhas auxiliares de webhook/auditoria deixaram de ser silenciosas e passam a registrar contexto tecnico no console, preservando o fluxo principal.
- Mantida a Regra-Mae: melhorias feitas somente nos hooks existentes, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar `onNotaFiscalAuthorized`, `parseSpreadsheet` e `propagateGroupConfigs` para reduzir payloads completos e reforcar auditoria/escopo.
### Estoque - Movimentos Operacionais com Escopo e Auditoria Resumida
- Continuei o proximo passo salvo: revisar funcoes operacionais de estoque/producao (`applyOrderStockMovements`, `applyAdjustmentsHandler`, `auditPedidoReserva`) para reduzir logs com movimentos completos e reforcar escopo Grupo/Empresa.
- `applyOrderStockMovements` agora completa `group_id` a partir da empresa usando helper existente antes de criar movimentacoes e auditorias.
- Movimentacoes de estoque geradas por pedido passaram a receber `group_id`, mantendo rastreabilidade multiempresa.
- Auditorias de bloqueio RBAC e baixa por pedido agora incluem `empresa_id` e `group_id`.
- A auditoria de baixa por pedido deixou de gravar detalhes de todos os movimentos e passou a registrar pedido, quantidade processada, IDs de produtos e quantidade total.
- `applyAdjustmentsHandler` agora audita ajustes de inventario com empresa/grupo e resumo de movimentos, sem gravar array completo.
- `stockAudit` passou a repassar `group_id` ao helper central de auditoria, e `auditPedidoReserva` passou a enviar grupo do pedido.
- Mantida a Regra-Mae: melhorias feitas em funcoes/helpers existentes de estoque, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar hooks operacionais (`onOrcamentoConfirmed`, `onOportunidadeStageChanged`, `onPedidoReadyToInvoice`) para reduzir logs com payloads completos e reforcar propagacao Grupo/Empresa.
### IA - Auditorias de Churn, Anomalias e RBAC Sanitizadas
- Continuei o proximo passo salvo: revisar funcoes de IA (`iaFinanceAnomalyScan`, `iaChurnAnalyzer`, `permissionOptimizer`) para reduzir logs com recomendacoes, sugestoes e amostras completas.
- `iaChurnAnalyzer` passou a auditar recomendacao de churn como metadados minimos e incluir `group_id` no `AuditLog`.
- Perfil de pagadores lentos no CRM deixou de gravar a lista completa de clientes e agora registra quantidade, IDs amostrados e maiores indicadores agregados.
- `permissionOptimizer` deixou de gravar todas as sugestoes por perfil e passou a auditar totais, IDs de perfis, bloqueios por modulo e quantidade de perfis marcados para aprovacao especial.
- `iaFinanceAnomalyScan` deixou de persistir amostras completas de previsoes, issues e sugestoes em auditoria/notificacao, mantendo resumos por severidade, entidade, tipo, risco e recomendacao.
- Auditoria de performance do scanner financeiro passou a registrar apenas duracao e escopo Grupo/Empresa, sem carregar filtros completos.
- Mantida a Regra-Mae: melhorias feitas nas funcoes existentes de IA/RBAC, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar funcoes operacionais de estoque/producao (`applyOrderStockMovements`, `applyAdjustmentsHandler`, `auditPedidoReserva`) para reduzir logs com movimentos completos e reforcar escopo Grupo/Empresa.
### Sistema - Erros e PII com Auditoria Sanitizada
- Continuei o proximo passo salvo: revisar `piiEncryptor`, `auditError` e funcoes de IA para reduzir logs com stack, metadata, recomendacoes e amostras completas.
- `auditError` passou a gravar `group_id` no campo correto do `AuditLog` e a reduzir stack para contagem/tamanho/topo limitado.
- Metadata de erro deixou de ser gravada completa; agora registra somente chaves, quantidade e quais campos parecem sensiveis.
- Mensagens de erro ficaram limitadas em tamanho para evitar vazamento acidental de payloads longos.
- `piiEncryptor` agora audita com `empresa_id` e `group_id` resolvidos pelo payload ou registro protegido.
- Auditoria de criptografia/descriptografia de PII registra apenas acao, lista de campos e quantidade, sem valores sensiveis.
- Mantida a Regra-Mae: melhorias feitas nas funcoes existentes `auditError` e `piiEncryptor`, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar funcoes de IA (`iaFinanceAnomalyScan`, `iaChurnAnalyzer`, `permissionOptimizer`) para reduzir logs com recomendacoes, sugestoes e amostras completas.
### Comercial - Solicitacoes de Aprovacao com Auditoria Segura
- Continuei o proximo passo salvo: revisar `solicitacoesAprovacao` para reduzir auditorias completas de politicas, solicitacoes e pedidos aprovados.
- As auditorias de politicas de aprovacao agora registram apenas entidades, quantidade de faixas e quantidade de niveis, sem gravar toda a regra operacional.
- Criacao, avaliacao, aprovacao e rejeicao de `SolicitacaoAprovacao` passaram a auditar snapshot resumido com status, escopo Grupo/Empresa, entidade alvo, solicitante/aprovador e metadados de dados propostos.
- Aceite de orcamento pelo Portal passou a auditar snapshot minimo do Pedido, sem salvar observacoes completas nem o registro inteiro.
- Pedido de revisao pelo Portal passou a registrar apenas existencia e tamanho do comentario, sem salvar o texto completo na auditoria.
- Notificacoes por WhatsApp e email foram preservadas no fluxo existente.
- Mantida a Regra-Mae: melhoria feita na funcao existente `solicitacoesAprovacao`, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar `piiEncryptor`, `auditError` e funcoes de IA para reduzir logs com stack, metadata, recomendacoes e amostras completas.
### Sistema - upsertConfig com Auditoria Resumida
- Continuei o proximo passo salvo: revisar funcoes backend restantes com `AuditLog.create` para reduzir payloads sensiveis e completar `group_id` quando ausente.
- O fluxo existente `upsertConfig` passou a auditar tambem o update direto por ID de `ConfiguracaoSistema`.
- Auditorias de criacao e edicao de configuracoes deixaram de gravar o documento completo e passaram a registrar snapshot resumido com chave, categoria, empresa, grupo, campos alterados e marcacao de campos sensiveis.
- Valores de tokens, senhas, API keys, certificados e secrets ficam protegidos no log, mantendo apenas metadados de rastreabilidade.
- O merge, retorno ao frontend e comportamento dos toggles foram preservados.
- Mantida a Regra-Mae: melhoria feita na funcao existente `upsertConfig`, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar `solicitacoesAprovacao` para reduzir auditorias completas de politicas, solicitacoes e pedidos aprovados.
### Integracoes - Estoque Baixo e Mirror de Configuracoes Auditados
- Continuei o proximo passo salvo: revisar `legacyIntegrationsMirror` no alerta de estoque baixo e espelho de configuracoes para auditar alteracoes de `ConfiguracaoSistema` com antes/depois resumido.
- O alerta de estoque baixo agora resolve `groupId` pela empresa antes de chamar `whatsappSend`, preservando o fluxo existente.
- A auditoria do alerta deixou de gravar descricao completa do produto e passou a registrar apenas produto_id, codigo, disponivel, minimo e flag abaixo_minimo.
- O espelho de configuracoes para `ConfiguracaoSistema` agora registra auditoria ao atualizar ou criar consolidacoes de Integracoes.
- A auditoria de configuracao guarda antes/depois resumido com chave, categoria, empresa, grupo e tipo da configuracao, sem gravar o documento completo.
- Mantida a Regra-Mae: melhoria feita na funcao existente `legacyIntegrationsMirror`, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar funcoes backend restantes com `AuditLog.create` para reduzir payloads sensiveis e completar `group_id` quando ausente.
### Integracoes - Actions Internas com Escopo Estrito
- Continuei o proximo passo salvo: revisar actions internas de API em `legacyIntegrationsMirror` para exigir escopo estrito nas consultas `status_pedido` e `cotar_aco`.
- As actions internas agora resolvem `groupId` pela empresa antes do RBAC, aceitando aliases `group_id` e `grupo_id` sem abrir consulta global.
- `status_pedido` passou a consultar por empresa quando houver empresa ativa ou por grupo quando o acesso for consolidado, validando o pedido retornado contra o contexto multiempresa.
- `cotar_aco` passou a filtrar produtos por empresa/grupo resolvido e descartar registros fora do contexto antes de montar o retorno.
- Auditoria de `cotar_aco` deixou de salvar amostra de produtos e agora registra somente quantidade de itens e tipo de escopo.
- Auditoria de `status_pedido` registra apenas identificadores minimos e escopo, mantendo rastreabilidade sem expor dados completos do pedido.
- Mantida a Regra-Mae: melhoria feita na action interna existente, sem criar rota, modulo, tela ou remover funcionalidade.
- Proximo passo sugerido: revisar `legacyIntegrationsMirror` no alerta de estoque baixo e espelho de configuracoes para auditar alteracoes de ConfiguracaoSistema com antes/depois resumido.
### Integracoes - Legacy Mirror com Webhooks Sanitizados
- Continuei o proximo passo salvo: revisar `legacyIntegrationsMirror` para sanitizar webhooks e auditorias com payload externo, mantendo Grupo/Empresa e RBAC.
- O mirror passou a reutilizar `completeGuardCallScope` e `recordMatchesGuardScope` existentes para resolver e validar contexto multiempresa em webhooks sensiveis.
- Auditorias de recebimento de webhook deixam de gravar payload externo completo e passam a registrar somente metadados: provedor, evento, token valido, flags de pagamento/pedido/itens e contagens.
- Webhooks Asaas e Juno agora filtram cobranca por empresa quando informada, validam a ContaReceber encontrada contra grupo/empresa e auditam antes/depois resumido.
- Webhook fiscal de eNotas/NFe.io agora valida a NotaFiscal no contexto Grupo/Empresa, propaga `group_id` para pos-autorizacao e audita apenas status/flags de XML, PDF e chave.
- Webhooks de marketplace passam a resolver `group_id` pela empresa, criar pedidos com grupo resolvido e bloquear update de pedido/produto fora do contexto.
- O espelho antigo de configuracoes para `ConfiguracaoSistema` passou a filtrar por categoria + chave + empresa/grupo e salvar `empresa_id`/`group_id` no documento consolidado.
- Mantida a Regra-Mae: melhoria feita na funcao de integracao existente, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar actions internas de API em `legacyIntegrationsMirror` para exigir escopo estrito tambem nas consultas `status_pedido` e `cotar_aco`.
### Financeiro - PaymentStatusManager com Escopo e Auditoria Segura
- Continuei o proximo passo salvo: revisar `paymentStatusManager` para reduzir payload de auditoria em baixas/conciliacao e garantir `group_id` nos logs financeiros.
- O helper de auditoria do backend financeiro deixou de referenciar variavel inexistente no `catch`, evitando erro secundario quando o log falhar.
- `checkout_iniciado` agora resolve `groupId` pela empresa, valida se a ContaReceber pertence ao contexto Grupo/Empresa e encaminha `group_id` para `emitirBoleto`.
- A auditoria do checkout nao grava URL completa da fatura; registra apenas metadados minimos como provedor, valor e flag de link gerado.
- `webhook_pagamento` agora valida a ContaReceber contra empresa/grupo antes da baixa, envia `group_id` para NF-e pos-pagamento e audita antes/depois resumido.
- `conciliar_extrato` usa escopo resolvido para conciliar e audita apenas quantidade de conciliados/divergencias, sem gravar extrato, arquivo ou retorno completo.
- Baixas de ContaPagar/ContaReceber continuam no fluxo existente, mas o AuditLog passou a registrar snapshot financeiro minimo e resumo do pagamento, sem gravar o registro inteiro nem detalhes completos de multimeios/parcelas.
- Mantida a Regra-Mae: melhoria feita na funcao financeira existente, sem criar modulo, tela, rota ou remover funcionalidade.
- Proximo passo sugerido: revisar `legacyIntegrationsMirror` para sanitizar webhooks e auditorias com payload externo, mantendo Grupo/Empresa e RBAC.
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

### Gate 18 - Preparacao segura do backup legado

- O backup original em `C:\Users\cpaba\Desktop\BACKUP ERP ANTIGO\BACKUP 20-08-2026` foi mantido intocavel.
- Criada a area isolada `D:\BACKUP ERP ANTIGO - CODEX` com pastas separadas para copia preservada, trabalho SQL, staging, relatorios e quarentena.
- A copia preservada concluiu 1.857 arquivos, 21.102.245.906 bytes (19,65 GB) e zero falhas no `robocopy`.
- Manifestos SHA-256 completos da origem e da copia foram comparados: 1.857 arquivos conferidos e zero divergencias de caminho, tamanho ou hash.
- A copia preservada foi marcada como somente leitura; os manifestos e logs permaneceram apenas no HD externo e nao foram adicionados ao GitHub.
- Microsoft Defender estava ativo, com protecao em tempo real habilitada, e concluiu a verificacao da copia com zero ameacas detectadas.
- Criada copia gravavel exclusiva para SQL com 18 arquivos MDF/LDF, 18.663.342.080 bytes (17,38 GB) e zero falhas.
- Nenhum executavel legado foi iniciado, nenhum banco foi anexado e nenhum dado, senha, MDF/LDF, TPS ou exportacao foi enviado ao GitHub.
- Validacao: `robocopy` sem falhas, comparacao SHA-256 com status `VALIDATED` e varredura Defender com zero deteccoes.
- Proximo passo obrigatorio: instalar SQL Server 2025 Developer/SSMS em instancia local isolada e anexar somente as copias em `02_SQL_WORK`, uma por vez, antes do inventario de schemas.

### Gate 18 - Ambiente SQL legado isolado

- Instalado SQL Server 2025 `17.0.1000.7`, edicao Standard Developer, em instancia nomeada `ERPZLEGACY` apenas para desenvolvimento e migracao local.
- A instancia usa exclusivamente autenticacao integrada do Windows; o usuario local foi cadastrado como administrador SQL durante o setup.
- TCP e Named Pipes permaneceram desabilitados, SQL Browser permaneceu desabilitado e o servico `MSSQL$ERPZLEGACY` foi configurado para inicializacao manual.
- A telemetria da instancia foi parada e desabilitada; nenhuma porta de firewall foi aberta.
- Instalado `sqlcmd` oficial 1.10.0 e validada conexao local explicita por Shared Memory.
- A consulta tecnica retornou SQL Server `17.0.1000.7`, `Standard Developer Edition (64-bit)`, sem consultar dados do backup.
- Instalado SQL Server Management Studio 22, versao `22.10.12201.205`; a ISO de instalacao foi desmontada ao final.
- O desligamento do computador ocorreu depois da instalacao do SSMS; os logs confirmaram conclusao com codigo 0, e a tentativa de retomada apenas informou que o SSMS ja estava instalado.
- Nenhum banco legado foi anexado e nenhum executavel contido no backup foi iniciado.
- Proximo passo obrigatorio: iniciar manualmente `ERPZLEGACY`, anexar primeiro o menor banco de trabalho (`TIDDF`) com prefixo `LEGACY_`, validar compatibilidade/integridade e somente entao seguir banco a banco.

### Gate 18 - Primeiro anexo controlado: TIDDF

- Os hashes SHA-256 de `TIDDF.mdf` e `TIDDF.ldf` foram reconferidos entre a copia preservada e `02_SQL_WORK`; ambos permaneceram identicos antes do anexo.
- O SQL Server recusou abrir MDF/LDF diretamente no HD externo mesmo com ACL exclusiva para o SID do servico; nenhuma tentativa alterou ou anexou esses arquivos.
- Para preservar o isolamento do servico, foi criada uma terceira copia de apenas 7 MB no diretorio de dados da instancia; os hashes continuaram identicos antes da abertura.
- A conta do servico e a conta Windows que executa o anexo receberam acesso somente nessas copias locais, conforme o modelo de personificacao do `CREATE DATABASE ... FOR ATTACH`.
- O banco foi anexado como `LEGACY_TIDDF`, convertido pela copia da versao interna 782 para 998 e colocado imediatamente em `READ_ONLY`.
- `DBCC CHECKDB` foi executado com `DATA_PURITY` e terminou sem erros.
- Inventario estrutural: 3 tabelas de XML, zero linhas de negocio, zero views, procedures, triggers ou funcoes; `TRUSTWORTHY`, Service Broker e database chaining desabilitados.
- Nenhum conteudo de registro foi exportado ou enviado ao GitHub; logs e metadados detalhados permaneceram em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- O servico `ERPZLEGACY` foi parado ao final e permanece com inicializacao manual.
- Proximo passo obrigatorio: repetir o fluxo hash -> copia local -> ACL minima -> anexo -> `READ_ONLY` -> `DBCC CHECKDB` no menor banco empresarial `TID_EMP05`, antes de identificar a empresa por metadados seguros.

### Gate 18 - Segundo anexo controlado: TID_EMP05

- Os hashes SHA-256 de `TID_EMP05.mdf` e `TID_EMP05_log.ldf` foram reconferidos entre a copia preservada, a area `02_SQL_WORK` e as copias locais usadas pela instancia; nao houve divergencia.
- Somente as copias locais foram abertas. O banco foi anexado como `LEGACY_TID_EMP05`, convertido na copia da versao interna 782 para 998 e mantido em `READ_ONLY`.
- `DBCC CHECKDB` com `DATA_PURITY` terminou sem erros; o banco permaneceu `ONLINE`, `MULTI_USER`, com `TRUSTWORTHY` e database chaining desabilitados.
- Inventario estrutural: 692 tabelas, zero views, 1 procedure, zero triggers, zero funcoes e 2.527 linhas estimadas.
- Das 2.527 linhas, 2.524 pertencem a duas tabelas de parametrizacao de campos. Apenas tres outras tabelas possuem uma linha cada; as demais tabelas de negocio estao vazias.
- A tabela existente de parametrizacao empresarial esta vazia. Nao ha CNPJ, razao social ou outro metadado confiavel que permita associar o banco ao Grupo CPA, 3Z LTDA ou CPA Ferro e Aco.
- O unico modulo SQL encontrado e uma procedure de alteracao de sequencia de versao. A referencia a execucao dinamica foi registrada para revisao, sem execucao; nao foram encontradas referencias a `xp_cmdshell`, `OPENROWSET`, `OPENDATASOURCE` ou automacao OLE.
- Classificacao: banco estrutural praticamente vazio, sem massa operacional relevante e sem identidade empresarial comprovada. Ele fica preservado, mas bloqueado para exportacao ou importacao ate surgir evidencia externa de pertencimento.
- Nenhum registro de negocio, documento fiscal, URL, CNPJ, senha ou arquivo do backup foi exportado ou enviado ao GitHub; os relatorios tecnicos detalhados permanecem somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- O servico `ERPZLEGACY` foi encerrado pelo proprio SQL Server ao final e permanece com inicializacao manual, sem TCP, Named Pipes ou SQL Browser.
- Validacao documental: este subgate nao altera runtime do ERP; foi exigido somente `git diff --check` antes do commit.
- Proximo passo obrigatorio: repetir o fluxo controlado no proximo banco empresarial por tamanho, `TID_EMP02`, e somente associar a uma empresa quando houver identificacao segura e conciliavel.

### Gate 18 - Terceiro anexo controlado: TID_EMP02

- Os hashes SHA-256 e tamanhos de `TID_EMP02.mdf` e `TID_EMP02_log.ldf` foram comparados entre origem, copia preservada e `02_SQL_WORK`; as tres versoes permaneceram identicas.
- Como `Program Files` recusou a copia sem elevacao, foi usada a pasta local isolada `C:\Users\cpaba\ERPZLEGACY_DATA`, com permissao concedida somente ao servico `MSSQL$ERPZLEGACY` sobre as copias de trabalho. Nenhum arquivo original ou preservado foi aberto pelo SQL.
- O banco foi anexado como `LEGACY_TID_EMP02`, convertido na copia da versao interna 782 para 998 e colocado imediatamente em `READ_ONLY`.
- `DBCC CHECKDB` com `DATA_PURITY` terminou com codigo 0 e sem mensagens de erro. O banco permaneceu `ONLINE`, `MULTI_USER`, com `TRUSTWORTHY`, Service Broker e database chaining desabilitados.
- Inventario estrutural: 714 tabelas, zero views, 1 procedure, zero triggers, zero funcoes, zero chaves estrangeiras declaradas e aproximadamente 66.005 linhas.
- A massa e predominantemente fiscal: 8.281 notas de saida, 7.917 itens, 8.045 registros de processamento eletronico, 8.477 logs fiscais, 5.126 duplicatas eletronicas e 2.052 fragmentos relacionados a XML, alem de entradas, cancelamentos e contas vinculadas.
- A identificacao foi feita sem expor XML ou CNPJ integral: 108 fragmentos continham bloco de emitente, todos com o mesmo nome historico `3Z ARMACAO LTDA` e o mesmo CNPJ mascarado. O banco fica classificado como origem fiscal da 3Z, ainda sujeito a conciliacao do CNPJ integral com o cadastro-alvo antes de qualquer importacao.
- O periodo agregado das notas vai de `2012-03-06` a `2026-07-21`, usando a conversao da data Clarion. Das 8.281 notas, 8.268 usam o codigo empresarial legado `2`; 13 registros usam codigo `0` e ficam previamente marcados para quarentena, sem propagacao automatica.
- O unico modulo SQL e a procedure legada `ALTERA_SEQUENCIA_VERSAO_11`, que contem referencia a execucao dinamica e nao foi executada. Nao foram encontradas referencias a `xp_cmdshell`, `OPENROWSET`, `OPENDATASOURCE` ou automacao OLE.
- Nenhum XML, chave fiscal, CNPJ integral, valor financeiro, senha, MDF/LDF ou registro de negocio foi exportado ou enviado ao GitHub. O relatorio de integridade permanece somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- O servico `ERPZLEGACY` foi encerrado ao final e permanece manual, sem TCP, Named Pipes ou SQL Browser.
- Validacao documental: este subgate nao altera o runtime do ERP; foi exigido somente `git diff --check` antes do commit.
- Proximo passo obrigatorio: repetir o fluxo controlado no banco empresarial `TID_EMP04`, identificar sua empresa por metadados seguros e manter qualquer contexto divergente em quarentena.

### Gate 18 - Quarto anexo controlado: TID_EMP04

- Os hashes SHA-256 e tamanhos de `TID_EMP04.mdf` e `TID_EMP04_log.ldf` foram comparados entre origem, copia preservada e `02_SQL_WORK`; as tres versoes permaneceram identicas.
- Foram abertas somente copias locais em `C:\Users\cpaba\ERPZLEGACY_DATA`, com acesso minimo para o servico SQL. O banco foi anexado como `LEGACY_TID_EMP04`, convertido na copia da versao interna 782 para 998 e colocado imediatamente em `READ_ONLY`.
- `DBCC CHECKDB` com `DATA_PURITY` terminou com codigo 0 e sem mensagens de erro. O banco permaneceu `ONLINE`, `MULTI_USER`, com `TRUSTWORTHY`, Service Broker e database chaining desabilitados.
- Inventario estrutural: 687 tabelas, zero views, 1 procedure, zero triggers, zero funcoes, zero chaves estrangeiras declaradas e somente 39 linhas estimadas.
- Das 39 linhas, 36 pertencem a `ParametrosCamposPadrao`; existem apenas um registro em `CadastroObservacoesPedidoCompra`, um em `EstoqueMateriais` e um em `HistoricoComentariosVenda`. Todas as demais tabelas estao vazias.
- Embora o MDF tenha 188 MB alocados, somente 11,75 MB estao em uso; o log tem 6,75 MB alocados e aproximadamente 1,24 MB em uso. O tamanho do arquivo nao representa massa operacional.
- `ParametrizacaoEmpresa` esta vazia, e os tres registros isolados nao possuem campo de Grupo, Empresa ou CNPJ. Nao existe evidencia segura para associar o banco ao Grupo CPA, 3Z LTDA ou CPA Ferro e Aco.
- O unico modulo SQL e a procedure legada `ALTERA_SEQUENCIA_VERSAO_11`, com referencia a execucao dinamica e sem execucao durante a analise. Nao foram encontradas referencias a `xp_cmdshell`, `OPENROWSET`, `OPENDATASOURCE` ou automacao OLE.
- Classificacao: banco estrutural praticamente vazio, preservado e bloqueado para exportacao ou importacao ate que exista evidencia externa conciliavel de pertencimento.
- Nenhum registro, CNPJ, valor, senha, MDF/LDF ou dado de negocio foi exportado ou enviado ao GitHub. O relatorio de integridade permanece apenas em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- O servico `ERPZLEGACY` foi encerrado ao final e permanece manual, sem TCP, Named Pipes ou SQL Browser.
- Validacao documental: este subgate nao altera o runtime do ERP; foi exigido somente `git diff --check` antes do commit.
- Proximo passo obrigatorio: realizar triagem estrutural controlada de `TID_TEMP`, o menor banco restante, para comprovar se possui dados necessarios ou se deve permanecer excluido da migracao.

### Gate 18 - Triagem controlada: TID_TEMP

- Os hashes SHA-256 e tamanhos de `TID_TEMP.mdf` e `TID_TEMP.ldf` foram comparados entre origem, copia preservada e `02_SQL_WORK`; as tres versoes permaneceram identicas.
- Foram abertas somente copias locais em `C:\Users\cpaba\ERPZLEGACY_DATA`, com acesso minimo para o servico SQL. O banco foi anexado como `LEGACY_TID_TEMP`, convertido na copia da versao interna 782 para 998 e colocado imediatamente em `READ_ONLY`.
- `DBCC CHECKDB` com `DATA_PURITY` terminou com codigo 0 e sem mensagens de erro. O banco permaneceu `ONLINE`, `MULTI_USER`, com `TRUSTWORTHY`, Service Broker e database chaining desabilitados.
- Inventario estrutural: 38 tabelas, zero views, procedures, triggers, funcoes ou chaves estrangeiras declaradas e 3.031 linhas estimadas.
- As nove tabelas nao vazias usam o prefixo auxiliar `CLA_`. A massa esta concentrada em selecao de materiais, fontes temporarias de estoque, detalhamento, romaneio, fila de e-mail, consulta de CNPJ, selecao de explorer e dados gerais de sessao.
- As quatro tabelas fora do prefixo `CLA_` (`HistoricoFinanceiro`, `HistoricoFinanceiroFornecedor_SQL`, `LogDeleteDuplicatas` e `TabelaTempSQL`) estao vazias.
- Os campos de gravacao das tabelas auxiliares apontam exclusivamente para `2026-08-19`, um dia antes do backup, reforcando que se trata de fotografia transitoria de processamento e selecao, nao de fonte mestre.
- Nenhuma tabela nao vazia possui contexto de Grupo ou Empresa. Chaves de usuario, produto, pedido e material encontradas servem ao processamento temporario e nao comprovam propriedade empresarial nem completude operacional.
- O MDF tem 255 MB alocados, mas somente 10,625 MB usados; o log tem 252,25 MB alocados e aproximadamente 5,40 MB usados. O tamanho fisico elevado nao representa massa historica.
- Nao existem modulos SQL nem referencias a `xp_cmdshell`, `OPENROWSET`, `OPENDATASOURCE`, automacao OLE ou execucao dinamica.
- Classificacao: `TID_TEMP` fica preservado e consultavel no arquivo local, mas excluido da migracao direta. Ele somente podera apoiar conciliacao futura se uma lacuna concreta for comprovada nos bancos operacionais; seus registros nunca devem substituir fontes mestres.
- Nenhum CNPJ, e-mail, registro temporario, MDF/LDF ou dado de negocio foi exportado ou enviado ao GitHub. O relatorio de integridade permanece apenas em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- O servico `ERPZLEGACY` foi encerrado ao final e permanece manual, sem TCP, Named Pipes ou SQL Browser.
- Validacao documental: este subgate nao altera o runtime do ERP; foi exigido somente `git diff --check` antes do commit.
- Proximo passo obrigatorio: repetir o fluxo controlado no banco `TID_EXETPS`, inventariar sua finalidade e impedir qualquer execucao de conteudo legado durante a analise.

### Gate 18 - Quinto anexo controlado: TID_EXETPS

- Os hashes SHA-256 e tamanhos de `TID_EXETPS.mdf` e `TID_EXETPS_log.ldf` foram comparados entre origem, copia preservada e `02_SQL_WORK`; as tres versoes permaneceram identicas.
- Foram abertas somente copias locais em `C:\Users\cpaba\ERPZLEGACY_DATA`, com acesso minimo para o servico SQL. O banco foi anexado como `LEGACY_TID_EXETPS`, convertido na copia da versao interna 782 para 998 e colocado imediatamente em `READ_ONLY`.
- `DBCC CHECKDB` com `DATA_PURITY` terminou com codigo 0 e sem mensagens de erro. O banco permaneceu `ONLINE`, `MULTI_USER`, com `TRUSTWORTHY`, Service Broker e database chaining desabilitados.
- Inventario estrutural: 981 tabelas, zero views, 34 procedures, 2 triggers, 12 funcoes, 22 chaves estrangeiras declaradas e aproximadamente 2.574.470 linhas.
- O MDF possui 969 MB alocados e aproximadamente 737,94 MB usados. A massa inclui cadastros de clientes, fornecedores e materiais, caixa, bancos, credito, estoque, entregas, tabelas de preco, comunicacoes e logs; portanto, `TID_EXETPS` nao e um simples repositorio de executaveis.
- A tabela `Empresas` confirmou que o banco e uma fonte central compartilhada. O mapa legado encontrado foi: codigo `1` CPA/Central Paulista Distribuidora de Aco, codigo `2` 3Z Armacao, codigo `3` Grupo CPA/CPA Ferro e Aco, codigo `4` Belgo Cercas inativa e codigo `5` Zuccaro Comercio de Ferragens.
- A distribuicao agregada confirma uso multiempresa: logs possuem registros nos codigos `1`, `2`, `3` e `5`; romaneios concentram-se no codigo `3`, com pequena massa historica no codigo `1`. O periodo de romaneios vai de `2012-03-07` a `2026-08-20`.
- O banco nao possui `groupId`/`empresaId` canonicos em todas as tabelas. A futura migracao devera mapear cada codigo legado, preservar a empresa proprietaria e impedir que tabelas sem contexto sejam propagadas automaticamente.
- Foram encontrados campos destinados a senhas, tokens, chaves de API, certificados e credenciais bancarias, de e-mail, IA e integracoes. Apenas os nomes dos campos e suas tabelas foram inventariados; nenhum valor foi consultado. Esses segredos ficam proibidos de exportacao e migracao, com redefinicao ou rotacao obrigatoria no ERP novo.
- Sete procedures possuem referencia a execucao dinamica, restritas ao alterador de versao e rotinas de classificacao de historico de materiais. Nenhuma foi executada. Nao foram encontradas referencias a `xp_cmdshell`, `OPENROWSET`, `OPENDATASOURCE` ou automacao OLE.
- Nao existem assemblies de usuario, credenciais de escopo de banco, fontes externas, sinonimos ou principals externos. Os dois triggers encontrados validam fornecedores e materiais; nenhum foi disparado porque nao houve escrita.
- Classificacao: fonte mestre e operacional central de alta prioridade, que exige staging, mapeamento empresa por empresa, RBAC, auditoria, idempotencia, quarentena e conciliacao antes de qualquer carga no ERP novo.
- Nenhum cliente, mensagem, valor financeiro, segredo, CNPJ integral, MDF/LDF ou registro de negocio foi exportado ou enviado ao GitHub. O relatorio de integridade permanece apenas em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- O servico `ERPZLEGACY` foi encerrado ao final e permanece manual, sem TCP, Named Pipes ou SQL Browser.
- Validacao documental: este subgate nao altera o runtime do ERP; foi exigido somente `git diff --check` antes do commit.
- Proximo passo obrigatorio: repetir o fluxo controlado no banco empresarial `TID_EMP01`, identificar sua empresa e seus periodos por metadados seguros antes de planejar qualquer exportacao.

### Gate 18 - Sexto anexo controlado: TID_EMP01

- Os hashes SHA-256 e tamanhos de `TID_EMP01.mdf` e `TID_EMP01_log.ldf` foram comparados entre origem, copia preservada e `02_SQL_WORK`; as tres versoes permaneceram identicas.
- Foram abertas somente copias locais em `C:\Users\cpaba\ERPZLEGACY_DATA`, com acesso minimo para o servico SQL. O banco foi anexado como `LEGACY_TID_EMP01`, convertido na copia da versao interna 782 para 998 e colocado imediatamente em `READ_ONLY`.
- `DBCC CHECKDB` com `DATA_PURITY` terminou com codigo 0 e sem mensagens de erro. O banco permaneceu `ONLINE`, `MULTI_USER`, com `TRUSTWORTHY`, Service Broker e database chaining desabilitados.
- Inventario estrutural: 722 tabelas, zero views, 1 procedure, zero triggers, zero funcoes, zero chaves estrangeiras declaradas e aproximadamente 1.841.537 linhas.
- O MDF possui aproximadamente 2.551,94 MB alocados e 2.309,31 MB usados. O log possui 1.082,81 MB alocados, mas apenas 35,09 MB usados.
- A massa e predominantemente fiscal: 139.593 notas de saida, 399.350 itens, 139.552 registros de processamento eletronico, 151.658 fragmentos relacionados a XML, 143.054 duplicatas eletronicas e dados vinculados de clientes, entradas, cancelamentos, tributos e contas.
- A identificacao foi feita sem expor XML ou CNPJ integral: 7.771 blocos de emitente apontaram para a mesma Central Paulista Distribuidora de Aco, em duas variacoes historicas do nome e com o mesmo CNPJ mascarado. O banco fica classificado como origem fiscal da CPA/Central Paulista.
- O periodo agregado das notas vai de `2012-03-05` a `2026-08-19`. Das 139.593 notas, 139.249 usam o codigo empresarial legado `1`; 187 usam codigo `0`, 151 usam codigo `3` e 6 usam codigo `2`. Os 344 registros fora do codigo proprietario ficam marcados para conciliacao e quarentena, sem propagacao automatica.
- Foram encontrados campos destinados a credenciais de integracoes, mas as respectivas tabelas estao vazias. Apenas nomes e tipos de campos foram inventariados; nenhum valor foi consultado ou migrado.
- O unico modulo SQL e a procedure legada `ALTERA_SEQUENCIA_VERSAO_11`, que possui referencia a execucao dinamica e nao foi executada. Nao foram encontradas referencias a `xp_cmdshell`, `OPENROWSET`, `OPENDATASOURCE` ou automacao OLE.
- Nao existem assemblies de usuario, credenciais de escopo de banco, fontes externas, sinonimos ou principals externos.
- Classificacao: banco fiscal de alta prioridade da CPA, que exige staging, mapeamento do codigo legado `1`, recorte dos ultimos cinco anos, reconciliacao financeira/fiscal, idempotencia, auditoria e quarentena antes de qualquer carga.
- Nenhum XML, chave fiscal, CNPJ integral, valor financeiro, segredo, MDF/LDF ou registro de negocio foi exportado ou enviado ao GitHub. O relatorio de integridade permanece apenas em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- O servico `ERPZLEGACY` foi encerrado ao final e permanece manual, sem TCP, Named Pipes ou SQL Browser.
- Validacao documental: este subgate nao altera o runtime do ERP; foi exigido somente `git diff --check` antes do commit.
- Proximo passo obrigatorio: realizar o anexo controlado de `TID_AUDITORIA`, inventariar sua cobertura por periodos e empresas sem exportacao integral e sem consultar conteudos sensiveis desnecessarios.

### Gate 18 - Setimo anexo controlado: TID_AUDITORIA

- Os hashes SHA-256 e tamanhos de `TID_AUDITORIA.mdf` e `TID_AUDITORIA.ldf` foram comparados entre origem, copia preservada e `02_SQL_WORK`; as tres versoes permaneceram identicas antes do anexo.
- Foram abertas somente copias locais em `C:\Users\cpaba\ERPZLEGACY_DATA`, com acesso minimo para o servico SQL. O banco foi anexado como `LEGACY_TID_AUDITORIA`, convertido na copia da versao interna 782 para 998 e colocado imediatamente em `READ_ONLY`.
- `DBCC CHECKDB` com `DATA_PURITY` terminou com codigo 0 e sem mensagens de erro. O banco permaneceu `ONLINE`, `MULTI_USER`, com `TRUSTWORTHY`, Service Broker e database chaining desabilitados.
- Inventario estrutural: 3 tabelas, sem views, procedures, triggers, funcoes ou chaves estrangeiras declaradas, com grande volume historico de eventos e logs.
- A estrutura principal separa empresa, entidade, lancamento, data, hora, usuario, tipo, coluna e conteudos anterior/atual. Os campos de conteudo nao foram consultados, exibidos nem exportados.
- A cobertura historica e multiempresa foi confirmada para os codigos legados `1` a `5`, com datas validas e predominancia do codigo `3`. As contagens detalhadas e os periodos exatos permanecem somente no relatorio local protegido.
- A janela dos ultimos cinco anos possui massa suficiente para migracao segmentada. Foram confirmados eventos de inclusao, alteracao e exclusao em fluxos comerciais, financeiros, fiscais, logisticos e de compras.
- O log tecnico tambem cobre a janela recente e contem indicadores de falhas da aplicacao legada. Nenhuma mensagem foi consultada; totais e periodos detalhados permanecem apenas no HD de analise.
- O banco nao possui modulos SQL nem referencias a `xp_cmdshell`, `OPENROWSET`, `OPENDATASOURCE`, automacao OLE ou execucao dinamica.
- Classificacao: arquivo historico multiempresa de alta sensibilidade. Qualquer exportacao futura devera ser segmentada por empresa, periodo e tabela, limitada a necessidade comprovada, sanitizada e conciliada; exportacao integral e proibida.
- Nenhum usuario, conteudo anterior/atual, mensagem, dado pessoal, MDF/LDF ou evento individual foi exportado ou enviado ao GitHub. O relatorio de integridade permanece apenas em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- O servico `ERPZLEGACY` foi encerrado ao final e permanece manual, sem TCP, Named Pipes ou SQL Browser.
- Validacao documental: este subgate nao altera o runtime do ERP; foi exigido somente `git diff --check` antes do commit.
- Proximo passo obrigatorio: repetir o fluxo controlado no ultimo banco empresarial principal, `TID_EMP03`, identificar sua empresa e seus periodos por metadados seguros antes de qualquer exportacao.

### Gate 18 - Oitavo anexo controlado: TID_EMP03

- Os hashes SHA-256 e tamanhos de `TID_EMP03.mdf` e `TID_EMP03_log.ldf` foram comparados entre origem, copia preservada, `02_SQL_WORK` e as copias locais usadas pela instancia; nao houve divergencia.
- Foram abertas somente copias locais em `C:\Users\cpaba\ERPZLEGACY_DATA`, com acesso minimo para o servico SQL. O banco foi anexado como `LEGACY_TID_EMP03`, convertido na copia da versao interna 782 para 998 e colocado imediatamente em `READ_ONLY`.
- `DBCC CHECKDB` com `DATA_PURITY` terminou com codigo 0 e sem mensagens de erro. O banco permaneceu `ONLINE`, `MULTI_USER`, com `TRUSTWORTHY`, Service Broker e database chaining desabilitados durante a analise.
- O inventario confirmou uma fonte operacional de grande porte, com centenas de tabelas e massa relevante nos fluxos de producao, comercial, estoque, financeiro e fiscal. Os totais detalhados permanecem somente nos relatorios locais protegidos.
- O periodo fiscal agregado identificado vai de `2012-03-05` a `2026-08-19`, cobrindo a janela dos ultimos cinco anos definida para a migracao.
- A tabela de parametrizacao empresarial e as tabelas de XML de saida estao vazias, e os registros eletronicos nao possuem chave fiscal utilizavel para confirmar diretamente o emitente. O nome `TID_EMP03` nao foi aceito como prova isolada de pertencimento.
- As principais tabelas com contexto demonstraram massa multiempresa: predomina o codigo legado `1`, existem registros dos codigos `2` e `3`, e tambem registros sem empresa valida. O banco foi classificado como fonte operacional compartilhada, sem autorizacao para importacao integral em uma unica empresa.
- A futura migracao devera segmentar cada lote pelo codigo empresarial conciliado com a fonte central, aplicar `groupId` e `empresaId` canonicos e encaminhar codigos ausentes, inativos ou divergentes para quarentena, sem propagacao automatica.
- Foram inventariados campos destinados a senhas, tokens e certificados apenas por nome e tipo; nenhum valor foi consultado ou exportado. Credenciais legadas permanecem proibidas de migracao e exigirao redefinicao ou rotacao.
- Os modulos SQL encontrados foram apenas inventariados e nenhum foi executado. Nao foram encontradas referencias a `xp_cmdshell`, `OPENROWSET` ou `OPENDATASOURCE`, nem assemblies de usuario, credenciais de escopo, fontes externas, sinonimos ou principals externos.
- Nenhum XML, chave fiscal, CNPJ integral, valor financeiro, segredo, MDF/LDF ou registro de negocio foi exportado ou enviado ao GitHub. O relatorio de integridade permanece apenas em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- O servico `ERPZLEGACY` foi encerrado ao final e permanece manual, sem TCP, Named Pipes ou SQL Browser.
- Validacao documental: este subgate nao altera o runtime do ERP; foi exigido somente `git diff --check` antes do commit.
- Proximo passo obrigatorio: iniciar o inventario seguro dos arquivos TPS por caminho, tamanho, tipo e hash, sem executar binarios legados e sem consultar ou importar valores de `USUSENHA.TPS`.

### Gate 18 - Inventario seguro dos arquivos TPS

- O inventario foi produzido exclusivamente a partir dos manifestos SHA-256 ja validados da origem e da copia preservada; nenhum registro TPS foi aberto ou interpretado nesta etapa.
- Foram identificados 294 arquivos TPS, totalizando 29.980.958 bytes, tanto na origem quanto na copia preservada. A comparacao de caminho relativo, tamanho e hash resultou em zero divergencias.
- A distribuicao por escopo confirmou 193 arquivos na raiz compartilhada, 29 em `EMP01`, 18 em `EMP02`, 28 em `EMP03`, 2 em `EMP04`, 13 em `EMP05` e 11 em `RH`.
- Os nomes indicam tabelas auxiliares, parametrizacoes e dados separados por empresa, mas nome de arquivo ou pasta nao foi aceito como prova suficiente de propriedade, completude ou precedencia sobre os bancos SQL ja classificados.
- `USUSENHA.TPS` e sua copia historica foram marcados como `BLOQUEADO_CREDENCIAL`: ficam proibidos de leitura de conteudo, parser, exportacao e migracao. Usuarios deverao receber redefinicao de senha no ERP novo.
- Dois arquivos de conexao foram marcados para revisao de seguranca e nao serao abertos enquanto nao existir metodo de extracao que garanta ausencia de exposicao de credenciais.
- Os relatorios `tps-inventory-metadata.csv` e `tps-inventory-summary.json` foram gravados apenas em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`; eles contem metadados tecnicos e nao fazem parte do repositorio.
- A verificacao completa anterior do Microsoft Defender continua valida para a copia preservada e havia terminado sem deteccoes. Nenhum executavel, biblioteca, script ou componente legado foi iniciado.
- Classificacao: conjunto TPS preservado para apoio de conciliacao e eventual preenchimento de lacunas, sempre subordinado a staging, contexto empresarial comprovado, idempotencia, RBAC, auditoria e quarentena. Importacao integral ou direta permanece proibida.
- Nenhum TPS, hash individual, senha, token, conexao, dado pessoal ou registro de negocio foi enviado ao GitHub. Nenhuma funcionalidade existente do ERP foi alterada ou removida.
- Validacao documental: os manifestos registram integridade `VALIDATED`, o resumo registra `content_opened=false`, `legacy_binary_executed=false` e zero divergencias; foi exigido `git diff --check` antes do commit.
- Proximo passo obrigatorio: verificar a disponibilidade de parser ou driver TopSpeed confiavel e isolado; somente se houver ferramenta segura, realizar um piloto de leitura em copia de TPS nao sensivel, mantendo `USUSENHA.TPS` e arquivos de conexao fora do teste.

### Gate 18 - Piloto isolado de leitura TPS

- Nao havia driver ODBC TopSpeed/Clarion, ferramenta instalada ou comando compativel no Windows. O driver oficial disponivel comercialmente e de 32 bits e exige DSN de 32 bits; ele nao foi adquirido nem instalado neste subgate.
- O backup contem executaveis e bibliotecas legadas relacionados a TopSpeed, inclusive utilitarios sem assinatura e uma versao antiga nao assinada do parser. Nenhum desses componentes foi carregado ou executado.
- A biblioteca `ClaTPS.dll` do backup possui assinatura valida da SoftVelocity, mas permaneceu bloqueada por fazer parte do ambiente legado e nao ser necessaria para o piloto.
- Foi instalado pelo Windows Package Manager o SDK oficial .NET `10.0.401`; o gerenciador verificou o hash do instalador antes da instalacao.
- O piloto isolado foi criado somente em `D:\BACKUP ERP ANTIGO - CODEX\03_STAGING\TPS_PILOT`, fora do ERP e do GitHub, usando `TpsParser 6.0.1` obtido do NuGet oficial.
- A assinatura de repositorio do pacote foi validada como pertencente ao NuGet.org, o hash de conteudo foi confirmado e a consulta de vulnerabilidades nao encontrou pacote vulneravel direto ou transitivo.
- O leitor foi limitado a acesso `read-only`, recusa arquivos de senha e conexao antes de abrir o arquivo e emite somente hash, esquema e contagens. Ele nao desserializa nem exibe valores de registros.
- O piloto usou exclusivamente uma copia de `BITOLAS.TPS` marcada como somente leitura e com SHA-256 identico ao manifesto. A leitura encontrou uma tabela, 17 registros e cinco campos, sem memo ou emissao de valores.
- O teste preventivo com o caminho de `USUSENHA.TPS` retornou o codigo esperado de bloqueio antes da abertura. O arquivo de credenciais nao foi lido, copiado para o piloto, interpretado ou exportado.
- Os relatorios sanitizados `tps-pilot-bitolas-schema.json` e `tps-parser-pilot-summary.json` ficaram somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`; o codigo descartavel do piloto tambem nao foi adicionado ao repositorio.
- Nenhum TPS, DLL, executavel, senha, conexao, hash individual ou valor de registro foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao: compilacao do piloto com zero erros e zero avisos; pacote com assinatura de repositorio valida; zero vulnerabilidades conhecidas; hash da copia aprovado; leitura somente leitura aprovada; `values_emitted=false`; bloqueio de credenciais aprovado.
- Proximo passo obrigatorio: executar inventario de esquemas e contagens dos TPS nao sensiveis em lotes pequenos, iniciando pelos escopos empresariais, sem emitir valores e colocando falhas, arquivos criptografados ou contexto incerto em quarentena.

### Gate 18 - Inventario de esquemas TPS: EMP01

- O primeiro lote empresarial TPS foi limitado ao escopo `EMP01` e executado somente no staging local, sem alterar ou abrir para escrita a origem e a copia preservada.
- Os 29 arquivos do escopo estavam classificados como nao sensiveis. Cada arquivo foi copiado individualmente para o piloto, teve o SHA-256 reconferido contra o manifesto e foi marcado como somente leitura antes do parser.
- O leitor isolado `TpsParser 6.0.1` processou 29 de 29 arquivos com sucesso. Nao houve arquivo bloqueado, criptografado, corrompido, divergente ou enviado para quarentena.
- O inventario encontrou 29 tabelas, 368 registros e 446 campos no total. Somente nomes e tipos de campos, comprimentos, indices, memos e contagens foram registrados; nenhum valor de registro foi desserializado ou emitido.
- A verificacao posterior reconferiu os 29 hashes da copia preservada e das copias do piloto, com zero divergencias. Todas as copias continuaram marcadas como somente leitura.
- Foram gerados 29 relatorios individuais de esquema e os resumos `tps-emp01-schema-summary.csv` e `tps-emp01-schema-summary.json`, armazenados somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Os relatorios foram validados programaticamente: 29 documentos validos, `accessMode=read-only`, `valuesEmitted=false` e zero relatorio invalido.
- O escopo da pasta `EMP01` continua sendo apenas uma pista de contexto. Nenhum dado sera associado automaticamente a CPA/Central Paulista sem conciliacao com as fontes SQL e o mapa empresarial central.
- Nenhum TPS, esquema detalhado, hash individual, dado pessoal, valor de registro, executavel ou codigo do piloto foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao documental: compilacao do leitor com zero erros e avisos; 29/29 leituras aprovadas; zero divergencias de hash; zero copias gravaveis; zero quarentenas; zero valores emitidos; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: repetir o mesmo fluxo controlado no escopo TPS `EMP02`, preservando a separacao empresarial e mantendo qualquer falha ou contexto incerto em quarentena.

### Gate 18 - Inventario de esquemas TPS: EMP02

- O segundo lote empresarial TPS foi limitado ao escopo `EMP02` e executado somente sobre copias no staging local. A origem e a copia preservada permaneceram sem abertura para escrita.
- Os 18 arquivos do escopo estavam classificados como nao sensiveis. Cada copia teve o SHA-256 comparado ao manifesto e foi marcada como somente leitura antes do processamento.
- O leitor isolado processou 18 de 18 arquivos com sucesso, encontrando 18 tabelas, 44 registros e 348 campos no total.
- Nao houve arquivo bloqueado, criptografado, corrompido, divergente, relatorio invalido ou item encaminhado para quarentena.
- Somente nomes e tipos de campos, comprimentos, indices, memos e contagens foram registrados. Nenhum valor de registro foi desserializado ou emitido.
- A verificacao posterior reconferiu os 18 hashes da copia preservada e das copias do piloto, com zero divergencias. Todas as copias continuaram marcadas como somente leitura.
- Foram gerados 18 relatorios individuais de esquema e os resumos `tps-emp02-schema-summary.csv` e `tps-emp02-schema-summary.json`, armazenados somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Os 18 documentos foram validados programaticamente com `accessMode=read-only`, `valuesEmitted=false` e zero relatorio invalido.
- O nome da pasta `EMP02` continua sendo apenas indicio de contexto. A vinculacao futura com a 3Z depende de conciliacao com o mapa empresarial central e os bancos SQL, registro por registro.
- Nenhum TPS, esquema detalhado, hash individual, dado pessoal, valor de registro, executavel ou codigo do piloto foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao documental: 18/18 leituras aprovadas; zero divergencias de hash; zero copias gravaveis; zero quarentenas; zero valores emitidos; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: repetir o fluxo controlado no escopo TPS `EMP03`, sem assumir pertencimento apenas pelo nome da pasta e mantendo registros ou arquivos de contexto incerto em quarentena.

### Gate 18 - Inventario de esquemas TPS: EMP03

- O terceiro lote empresarial TPS foi limitado ao escopo `EMP03` e executado somente sobre copias no staging local. Origem e copia preservada permaneceram sem abertura para escrita.
- Os 28 arquivos estavam classificados como nao sensiveis. Cada copia teve seu SHA-256 comparado ao manifesto e foi marcada como somente leitura antes do parser.
- O leitor isolado processou 28 de 28 arquivos com sucesso, encontrando 28 tabelas, 46.242 registros e 329 campos no total.
- Nao houve arquivo bloqueado, criptografado, corrompido, divergente, relatorio invalido ou item encaminhado para quarentena.
- Somente nomes e tipos de campos, comprimentos, indices, memos e contagens foram registrados. Nenhum valor de registro foi desserializado ou emitido.
- A verificacao posterior reconferiu os 28 hashes da copia preservada e das copias do piloto, com zero divergencias. Todas as copias continuaram marcadas como somente leitura.
- Foram gerados 28 relatorios individuais e os resumos `tps-emp03-schema-summary.csv` e `tps-emp03-schema-summary.json`, armazenados somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Os 28 documentos foram validados programaticamente com `accessMode=read-only`, `valuesEmitted=false` e zero relatorio invalido.
- O volume superior dos TPS em `EMP03` reforca sua relevancia para conciliacao, mas o nome da pasta nao comprova propriedade. A classificacao SQL anterior permanece soberana: ha contexto multiempresa e nenhuma carga integral pode ser atribuida automaticamente a CPA Ferro e Aco.
- Nenhum TPS, esquema detalhado, hash individual, dado pessoal, valor de registro, executavel ou codigo do piloto foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao documental: 28/28 leituras aprovadas; zero divergencias de hash; zero copias gravaveis; zero quarentenas; zero valores emitidos; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: repetir o fluxo controlado no escopo TPS `EMP04`, mantendo sua massa reduzida sem associacao empresarial ate existir evidencia externa conciliavel.

### Gate 18 - Inventario de esquemas TPS: EMP04

- O quarto lote empresarial TPS foi limitado ao escopo `EMP04` e executado somente sobre copias no staging local. Origem e copia preservada permaneceram sem abertura para escrita.
- O escopo possui apenas dois arquivos, ambos classificados como nao sensiveis. Cada copia teve o SHA-256 comparado ao manifesto e foi marcada como somente leitura antes do parser.
- O leitor isolado processou os dois arquivos com sucesso, encontrando duas tabelas, dois registros e 12 campos no total.
- Nao houve arquivo bloqueado, criptografado, corrompido, divergente, relatorio invalido ou item encaminhado para quarentena.
- Somente nomes e tipos de campos, comprimentos, indices, memos e contagens foram registrados. Nenhum valor de registro foi desserializado ou emitido.
- A verificacao posterior reconferiu os dois hashes da copia preservada e das copias do piloto, com zero divergencias. As duas copias continuaram marcadas como somente leitura.
- Foram gerados dois relatorios individuais e os resumos `tps-emp04-schema-summary.csv` e `tps-emp04-schema-summary.json`, armazenados somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Os dois documentos foram validados programaticamente com `accessMode=read-only`, `valuesEmitted=false` e zero relatorio invalido.
- A massa TPS reduzida acompanha a classificacao do banco SQL `TID_EMP04` como estrutura praticamente vazia. O escopo permanece preservado, mas sem associacao empresarial ou autorizacao para migracao ate existir evidencia externa conciliavel.
- Nenhum TPS, esquema detalhado, hash individual, dado pessoal, valor de registro, executavel ou codigo do piloto foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao documental: 2/2 leituras aprovadas; zero divergencias de hash; zero copias gravaveis; zero quarentenas; zero valores emitidos; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: repetir o fluxo controlado no escopo TPS `EMP05`, mantendo sua classificacao separada ate confirmar se possui massa complementar util ou apenas estrutura auxiliar.

### Gate 18 - Inventario de esquemas TPS: EMP05

- O quinto lote empresarial TPS foi limitado ao escopo `EMP05` e executado somente sobre copias no staging local. Origem e copia preservada permaneceram sem abertura para escrita.
- Os 13 arquivos estavam classificados como nao sensiveis. Cada copia teve seu SHA-256 comparado ao manifesto e foi marcada como somente leitura antes do parser.
- O leitor isolado processou 13 de 13 arquivos com sucesso, encontrando 13 tabelas, 19.725 registros e 235 campos no total.
- Nao houve arquivo bloqueado, criptografado, corrompido, divergente, relatorio invalido ou item encaminhado para quarentena.
- Somente nomes e tipos de campos, comprimentos, indices, memos e contagens foram registrados. Nenhum valor de registro foi desserializado ou emitido.
- A verificacao posterior reconferiu os 13 hashes da copia preservada e das copias do piloto, com zero divergencias. Todas as copias continuaram marcadas como somente leitura.
- Foram gerados 13 relatorios individuais e os resumos `tps-emp05-schema-summary.csv` e `tps-emp05-schema-summary.json`, armazenados somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Os 13 documentos foram validados programaticamente com `accessMode=read-only`, `valuesEmitted=false` e zero relatorio invalido.
- A existencia de massa TPS em `EMP05` nao substitui a classificacao do banco SQL correspondente como estrutura praticamente vazia. O escopo fica preservado como fonte complementar, sem associacao empresarial ou autorizacao de carga ate conciliacao externa.
- Nenhum TPS, esquema detalhado, hash individual, dado pessoal, valor de registro, executavel ou codigo do piloto foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao documental: 13/13 leituras aprovadas; zero divergencias de hash; zero copias gravaveis; zero quarentenas; zero valores emitidos; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: inventariar o escopo TPS `RH` somente em nivel de esquema e contagem, sem exibir dados de pessoas e mantendo qualquer arquivo sensivel ou falha em quarentena.

### Gate 18 - Inventario de esquemas TPS: RH

- O lote TPS de `RH` foi limitado a esquema e contagens, executado somente sobre copias no staging local e sem abertura para escrita da origem ou da copia preservada.
- Os 11 arquivos estavam classificados como nao sensiveis por nome. Cada copia teve o SHA-256 comparado ao manifesto e foi marcada como somente leitura antes do parser.
- A primeira chamada do orquestrador foi recusada pelo PowerShell por erro de sintaxe antes de criar copias ou abrir arquivos. O comando foi corrigido e reexecutado sem alterar a politica de seguranca.
- O leitor isolado processou 11 de 11 arquivos com sucesso, encontrando 11 tabelas, 15 registros e 111 campos no total.
- Nao houve arquivo bloqueado, criptografado, corrompido, divergente, relatorio invalido ou item encaminhado para quarentena.
- Somente nomes e tipos de campos, comprimentos, indices, memos e contagens foram registrados. Nenhum nome de pessoa, documento, salario, contato ou outro valor de registro foi desserializado ou emitido.
- A verificacao posterior reconferiu os 11 hashes da copia preservada e das copias do piloto, com zero divergencias. Todas as copias continuaram marcadas como somente leitura.
- Foram gerados 11 relatorios individuais e os resumos `tps-rh-schema-summary.csv` e `tps-rh-schema-summary.json`, armazenados somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Os 11 documentos foram validados programaticamente com `accessMode=read-only`, `valuesEmitted=false`, `personal_values_emitted=false` e zero relatorio invalido.
- O escopo permanece classificado como altamente sensivel. Qualquer leitura futura de valores exigira finalidade comprovada, minimizacao, contexto Grupo/Empresa, RBAC de RH, auditoria e staging separado.
- Nenhum TPS, esquema detalhado, hash individual, dado pessoal, valor de registro, executavel ou codigo do piloto foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao documental: 11/11 leituras aprovadas; zero divergencias de hash; zero copias gravaveis; zero quarentenas; zero valores gerais ou pessoais emitidos; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: dividir os 193 TPS do escopo compartilhado `ROOT` em lotes pequenos, excluir por politica os arquivos de senha e conexao e iniciar somente o primeiro lote nao sensivel de esquemas e contagens.

### Gate 18 - Inventario de esquemas TPS: ROOT-01

- Os 193 TPS da raiz compartilhada foram separados de forma deterministica: 189 arquivos elegiveis em cinco lotes de ate 40 itens e quatro arquivos excluidos por politica, sendo dois de credenciais e dois de conexao.
- A primeira geracao do plano falhou por formatacao do indice numerico antes de copiar ou abrir arquivos. O tipo foi corrigido, o plano foi recriado e validado com os 189 caminhos aparecendo exatamente uma vez.
- Este subgate executou somente o lote `ROOT-01`, com 40 arquivos nao sensiveis, sobre copias no staging local. Origem e copia preservada permaneceram sem abertura para escrita.
- Cada copia teve o SHA-256 comparado ao manifesto e foi marcada como somente leitura antes do parser. A verificacao final confirmou zero divergencias e zero copia gravavel.
- O leitor isolado processou 38 arquivos com sucesso, encontrando 39 tabelas, 23.186 registros e 501 campos no total. Somente esquema e contagens foram emitidos.
- Dois arquivos retornaram `TpsParserException`. Nao houve tentativa de reparo, parser legado ou leitura alternativa; as copias foram encaminhadas para `D:\BACKUP ERP ANTIGO - CODEX\05_QUARANTINE\TPS\ROOT-01`, mantidas somente leitura e com hashes conciliados.
- O manifesto de quarentena registra `ContentInspected=false`. A causa exata permanece indeterminada ate existir metodo seguro para distinguir arquivo criptografado, formato incompativel ou dano estrutural.
- Os quatro arquivos de senha e conexao ficaram fora do plano e do staging. A validacao final encontrou zero arquivo proibido no lote.
- Foram gerados 38 relatorios individuais, resumos do lote, plano de particionamento e manifesto de quarentena, todos armazenados somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Os 38 documentos foram validados programaticamente com `accessMode=read-only`, `valuesEmitted=false` e zero relatorio invalido.
- Nenhum TPS, esquema detalhado, hash individual, dado pessoal, valor de registro, executavel ou codigo do piloto foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao documental: 38/40 leituras aprovadas; duas quarentenas integras e nao inspecionadas; zero divergencias de hash; zero copias gravaveis; zero arquivos proibidos; zero valores emitidos; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: executar o lote compartilhado `ROOT-02` conforme o plano local validado, mantendo as mesmas exclusoes, somente leitura e quarentena por falha.

### Gate 18 - Inventario de esquemas TPS: ROOT-02

- Este subgate executou somente o lote `ROOT-02`, com os 40 arquivos previstos no plano local, sobre copias no staging. Origem e copia preservada permaneceram sem abertura para escrita.
- Cada copia teve o SHA-256 comparado ao plano e foi marcada como somente leitura antes do parser. A verificacao final confirmou zero divergencias e zero copia gravavel.
- O leitor isolado processou 39 arquivos com sucesso, encontrando 39 tabelas, 349.303 registros e 466 campos no total. Somente esquema e contagens foram emitidos.
- Um arquivo retornou `TpsParserException`. Nao houve tentativa de reparo, parser legado ou leitura alternativa; a copia foi encaminhada para `D:\BACKUP ERP ANTIGO - CODEX\05_QUARANTINE\TPS\ROOT-02`, mantida somente leitura e com hash conciliado.
- O manifesto de quarentena registra `ContentInspected=false`. A causa exata permanece indeterminada ate existir metodo seguro para distinguir arquivo criptografado, formato incompativel ou dano estrutural.
- Os arquivos de senha e conexao permaneceram fora do lote. A validacao final encontrou zero nome proibido no plano ou no staging.
- Foram gerados 39 relatorios individuais, os resumos `tps-root-02-schema-summary.csv` e `tps-root-02-schema-summary.json` e o manifesto de quarentena, armazenados somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Os 39 documentos foram validados programaticamente com `accessMode=read-only`, `valuesEmitted=false` e zero relatorio invalido.
- Nenhum TPS, esquema detalhado, hash individual, dado pessoal, valor de registro, executavel ou codigo do piloto foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao documental: 39/40 leituras aprovadas; uma quarentena integra e nao inspecionada; zero divergencias de hash; zero copias gravaveis; zero arquivos proibidos; zero valores emitidos; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: executar o lote compartilhado `ROOT-03` conforme o plano local validado, mantendo as mesmas exclusoes, somente leitura e quarentena por falha.

### Gate 18 - Inventario de esquemas TPS: ROOT-03

- Este subgate executou somente o lote `ROOT-03`, com os 40 arquivos previstos no plano local, sobre copias no staging. Origem e copia preservada permaneceram sem abertura para escrita.
- Cada copia teve o SHA-256 comparado ao plano e foi marcada como somente leitura antes do parser. A verificacao final confirmou zero divergencias e zero copia gravavel.
- O leitor isolado processou 39 arquivos com sucesso, encontrando 39 tabelas, 46.907 registros e 386 campos no total. Somente esquema e contagens foram emitidos.
- Um arquivo retornou falha generica do parser. Nao houve tentativa de reparo, parser legado ou leitura alternativa; a copia foi encaminhada para `D:\BACKUP ERP ANTIGO - CODEX\05_QUARANTINE\TPS\ROOT-03`, mantida somente leitura e com hash conciliado.
- O manifesto de quarentena registra `ContentInspected=false`. A causa exata permanece indeterminada ate existir metodo seguro para distinguir arquivo criptografado, formato incompativel, erro interno do parser ou dano estrutural.
- Os arquivos de senha e conexao permaneceram fora do lote. A validacao final encontrou zero nome proibido no plano ou no staging.
- Foram gerados 39 relatorios individuais, os resumos `tps-root-03-schema-summary.csv` e `tps-root-03-schema-summary.json` e o manifesto de quarentena, armazenados somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Os 39 documentos foram validados programaticamente com `accessMode=read-only`, `valuesEmitted=false` e zero relatorio invalido.
- Nenhum TPS, esquema detalhado, hash individual, dado pessoal, valor de registro, executavel ou codigo do piloto foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao documental: compilacao do leitor com zero erros e avisos; 39/40 leituras aprovadas; uma quarentena integra e nao inspecionada; zero divergencias de hash; zero copias gravaveis; zero arquivos proibidos; zero valores emitidos; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: executar o lote compartilhado `ROOT-04` conforme o plano local validado, mantendo as mesmas exclusoes, somente leitura e quarentena por falha.

### Gate 18 - Inventario de esquemas TPS: ROOT-04

- Este subgate executou somente o lote `ROOT-04`, com os 40 arquivos previstos no plano local, sobre copias no staging. Origem e copia preservada permaneceram sem abertura para escrita.
- Cada copia teve o SHA-256 comparado ao plano e foi marcada como somente leitura antes do parser. A verificacao final confirmou zero divergencias e zero copia gravavel.
- O leitor isolado processou 36 arquivos com sucesso, encontrando 36 tabelas, 6.976 registros e 479 campos no total. Somente esquema e contagens foram emitidos.
- Quatro arquivos retornaram falha do parser, sendo tres `TpsParserException` e uma falha generica. Nao houve tentativa de reparo, parser legado ou leitura alternativa; as copias foram encaminhadas para `D:\BACKUP ERP ANTIGO - CODEX\05_QUARANTINE\TPS\ROOT-04`, mantidas somente leitura e com hashes conciliados.
- O manifesto de quarentena registra `ContentInspected=false` para os quatro itens. As causas exatas permanecem indeterminadas ate existir metodo seguro para distinguir formato incompativel, erro interno do parser, criptografia ou dano estrutural.
- Os arquivos de senha e conexao permaneceram fora do lote. A validacao final encontrou zero nome proibido no plano ou no staging.
- Foram gerados 36 relatorios individuais, os resumos `tps-root-04-schema-summary.csv` e `tps-root-04-schema-summary.json` e o manifesto de quarentena, armazenados somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Os 36 documentos foram validados programaticamente com `accessMode=read-only`, `valuesEmitted=false` e zero relatorio invalido.
- Nenhum TPS, esquema detalhado, hash individual, dado pessoal, valor de registro, executavel ou codigo do piloto foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao documental: compilacao do leitor com zero erros e avisos; 36/40 leituras aprovadas; quatro quarentenas integras e nao inspecionadas; zero divergencias de hash; zero copias gravaveis; zero arquivos proibidos; zero valores emitidos; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: executar o ultimo lote compartilhado planejado, `ROOT-05`, mantendo as mesmas exclusoes, somente leitura e quarentena por falha.

### Gate 18 - Inventario de esquemas TPS: ROOT-05

- Este subgate executou o ultimo lote compartilhado planejado, `ROOT-05`, com 29 arquivos, somente sobre copias no staging. Origem e copia preservada permaneceram sem abertura para escrita.
- Cada copia teve o SHA-256 comparado ao plano e foi marcada como somente leitura antes do parser. A verificacao final confirmou zero divergencias e zero copia gravavel.
- O leitor isolado processou 27 arquivos com sucesso, encontrando 27 tabelas, 3.574 registros e 163 campos no total. Somente esquema e contagens foram emitidos.
- Dois arquivos retornaram falha do parser, sendo um `TpsParserException` e uma falha generica. Nao houve tentativa de reparo, parser legado ou leitura alternativa; as copias foram encaminhadas para `D:\BACKUP ERP ANTIGO - CODEX\05_QUARANTINE\TPS\ROOT-05`, mantidas somente leitura e com hashes conciliados.
- O manifesto de quarentena registra `ContentInspected=false` para os dois itens. As causas exatas permanecem indeterminadas ate existir metodo seguro para distinguir formato incompativel, erro interno do parser, criptografia ou dano estrutural.
- Os arquivos de senha e conexao permaneceram fora do lote. A validacao final encontrou zero nome proibido no plano ou no staging.
- Foram gerados 27 relatorios individuais, os resumos `tps-root-05-schema-summary.csv` e `tps-root-05-schema-summary.json` e o manifesto de quarentena, armazenados somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Os 27 documentos foram validados programaticamente com `accessMode=read-only`, `valuesEmitted=false` e zero relatorio invalido.
- Nenhum TPS, esquema detalhado, hash individual, dado pessoal, valor de registro, executavel ou codigo do piloto foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao documental: compilacao do leitor com zero erros e avisos; 27/29 leituras aprovadas; duas quarentenas integras e nao inspecionadas; zero divergencias de hash; zero copias gravaveis; zero arquivos proibidos; zero valores emitidos; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: consolidar os cinco resumos `ROOT` e seus manifestos de quarentena, validar cobertura dos 189 arquivos elegiveis e produzir somente totais agregados e prioridades de mapeamento, sem abrir valores.

### Gate 18 - Consolidacao dos lotes TPS compartilhados ROOT

- Os cinco lotes `ROOT-01` a `ROOT-05` foram consolidados sem reabrir arquivos TPS e sem ler valores de registros.
- A cobertura foi conciliada com o inventario geral: 193 arquivos no escopo compartilhado, sendo 189 elegiveis processados e quatro excluidos por politica, com duas credenciais bloqueadas e dois arquivos de conexao mantidos em revisao de seguranca.
- Dos 189 arquivos elegiveis, 179 tiveram leitura estrutural aprovada e 10 permaneceram em quarentena. Os manifestos confirmam `ContentInspected=false` para todos os itens em quarentena.
- A consolidacao contabilizou 26.433.566 bytes, 180 tabelas, 429.946 registros e 1.995 campos. Esses numeros representam somente metadados estruturais e nao autorizam migracao ou associacao empresarial.
- A verificacao cruzada confirmou 179 relatorios individuais seguros, 10 entradas de quarentena, zero relatorio com valores, zero item de quarentena inspecionado e cobertura completa dos 189 caminhos elegiveis.
- Foram gerados `tps-root-consolidated-summary.csv` e `tps-root-consolidated-summary.json` somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`. Os arquivos consolidados nao contem nomes, caminhos ou hashes individuais.
- A prioridade preliminar por volume de registros ficou: `ROOT-02`, `ROOT-03`, `ROOT-01`, `ROOT-04` e `ROOT-05`. Esse criterio nao determina empresa, relevancia de negocio ou permissao de carga.
- Toda vinculacao futura continua dependendo da conciliacao entre esquemas TPS, catalogos SQL e mapa empresarial central com `groupId` e `empresaId` comprovados.
- Nenhum TPS, esquema detalhado, hash individual, dado pessoal, valor de registro, executavel ou codigo do piloto foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao documental: 189/189 itens elegiveis cobertos; 179 leituras aprovadas; 10 quarentenas integras e nao inspecionadas; quatro exclusoes por politica preservadas; zero valores emitidos; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: iniciar o mapeamento estrutural do lote prioritario `ROOT-02` contra os catalogos SQL ja inventariados, comparando somente nomes, tipos e contagens e mantendo contexto empresarial indeterminado ate conciliacao externa.

### Gate 18 - Mapeamento estrutural parcial ROOT-02 x SQL

- O mapeamento foi executado somente sobre os 39 relatorios estruturais aprovados do `ROOT-02`; o arquivo em quarentena permaneceu fechado e sem tentativa alternativa de leitura.
- A consulta direta aos bancos nao foi realizada porque o Windows recusou a inicializacao do servico isolado por ACL. A tentativa nao iniciou a instancia, que permaneceu `Stopped` e com inicializacao `Manual`.
- Foram reutilizados apenas os catalogos persistidos de `LEGACY_TID_EMP05` e `LEGACY_TIDDF`, totalizando 695 tabelas e 72 colunas de contexto empresarial previamente inventariadas. A cobertura SQL foi classificada explicitamente como parcial.
- A comparacao conservadora de nomes produziu zero correspondencia exata, tres candidatos lexicais sujeitos a revisao e 36 tabelas TPS sem candidato seguro.
- Os tres candidatos lexicais possuem zero registros no TPS e nenhuma coincidencia de coluna de contexto. Nao houve correspondencia de tipo porque tipos SQL somente seriam comparados apos igualdade exata do nome da coluna.
- Os 349.303 registros e 466 campos contabilizados no `ROOT-02` continuam sem mapeamento seguro. Nenhum candidato recebeu contexto empresarial e nenhuma importacao foi autorizada.
- Foram gerados `tps-root-02-sql-structural-map.csv` e `tps-root-02-sql-structural-map-summary.json` somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- A primeira execucao do consolidador foi recusada por erro de sintaxe antes de gerar arquivos. A validacao posterior teve apenas uma comparacao incorreta entre booleano e texto; corrigida a checagem, as 39 linhas foram confirmadas com `ImportAuthorized=false`.
- Nenhum registro de negocio, valor TPS, dado pessoal, segredo, MDF/LDF ou identificador individual de arquivo foi consultado ou enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao documental: 39/39 esquemas cobertos; 349.303/349.303 registros sem candidato seguro; zero contexto empresarial definido; zero correspondencia de tipo; zero importacao autorizada; servico SQL parado/manual; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: persistir os catalogos completos dos bancos SQL ja validados por meio de uma inicializacao administrativa controlada da instancia, consultar somente `sys.tables`, `sys.columns` e tipos, desligar o servico e repetir o mapeamento do `ROOT-02` sem acessar valores.

### Gate 18 - Catalogo SQL completo e remapeamento estrutural ROOT-02

- A instancia `ERPZLEGACY` foi iniciada temporariamente com autorizacao administrativa, sem habilitar TCP ou Named Pipes. A conexao utilizou somente Shared Memory local.
- Os nove bancos `LEGACY_` foram confirmados `ONLINE`, `READ_ONLY` e `MULTI_USER`, com `TRUSTWORTHY`, Service Broker e database chaining desativados.
- O catalogo completo registrou 4.612 tabelas e 116.445 colunas com nomes, tipos, tamanhos, precisao, escala e nulabilidade. Nenhum valor de tabela de negocio foi consultado.
- A tentativa inicial de somar estimativas de linhas e a primeira extracao ordenada foram canceladas por `RESOURCE_SEMAPHORE`. A extracao final removeu agregacoes, joins e ordenacao no SQL, preservando o limite de memoria da instancia.
- Foram gerados `sql-legacy-database-state.csv`, `sql-legacy-table-catalog.csv`, `sql-legacy-column-catalog.csv` e `sql-legacy-schema-catalog-summary.json` somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- O remapeamento dos 39 esquemas aprovados do `ROOT-02` encontrou um candidato por nome exato, 22 candidatos estruturais para revisao e 16 tabelas sem candidato seguro. Nao houve vinculo automatico.
- Os candidatos cobrem 19.830 registros; 329.473 registros continuam sem candidato seguro. Foram observadas 311 coincidencias de nomes de campos, todas com familia de tipo compativel.
- Onze candidatos aparecem em mais de um banco, 13 possuem empate na maior pontuacao e 18 candidatos nao possuem registros TPS. Todas essas ocorrencias exigem revisao manual antes de qualquer decisao.
- O mapa e o resumo completos foram salvos localmente como `tps-root-02-sql-full-structural-map.csv` e `tps-root-02-sql-full-structural-map-summary.json`, com `CompanyContext=UNDETERMINED` e `ImportAuthorized=false` em todas as linhas.
- A instancia foi desligada pela propria conexao SQL ao final e permanece `Stopped` com inicializacao `Manual`. Nenhum dado real, segredo, MDF/LDF ou catalogo detalhado foi enviado ao GitHub.
- Validacao documental: nove bancos seguros; zero duplicidade de tabela ou coluna no catalogo; 39/39 esquemas TPS cobertos; zero empresa definida; zero importacao autorizada; zero valor lido; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: revisar estruturalmente os 23 candidatos do `ROOT-02`, priorizando os cinco que possuem registros, comparar contexto empresarial e ambiguidades entre bancos e manter qualquer correspondencia incerta sem autorizacao de carga.

### Gate 18 - Revisao dos candidatos ROOT-02 com registros

- A revisao foi limitada aos cinco candidatos estruturais do `ROOT-02` que possuem registros, totalizando 19.830 registros TPS. Foram usados somente os catalogos locais; a instancia SQL permaneceu desligada.
- `EMPRESAS` foi mantida como candidato forte de esquema para `Empresas`: nome exato, 17 de 18 campos coincidentes e compativeis. A correspondencia ainda nao comprova identidade empresarial nem autoriza importacao.
- `CXPOSDIA`, com 19.723 registros, possui cinco campos semanticos coincidentes e compativeis, mas o candidato SQL ocorre em cinco bancos sem campo empresarial explicito. Ficou em revisao multi-banco.
- `EMPRCOMP` apresenta 56 campos coincidentes, dos quais 36 semanticos e 20 genericos, mas aponta para o mesmo destino SQL de `EMPRESAS`. Ficou bloqueada por colisao de destino ate definir a separacao entre cadastro e configuracao.
- `GENITEM` foi rejeitada como candidata automatica porque a maior pontuacao estrutural empata entre nove tabelas e nao existe semelhanca de nome ou contexto empresarial.
- `FORFARD` permaneceu em revisao manual: 13 campos coincidentes, mas nove sao campos genericos legados, nao ha semelhanca de nome e nao existe contexto empresarial explicito.
- Todos os cinco candidatos preservam `CompanyContext=UNDETERMINED` e `ImportAuthorized=false`. Nenhuma decisao foi baseada apenas no nome da pasta, banco ou tabela.
- Foram gerados `tps-root-02-active-candidate-review.csv` e `tps-root-02-active-candidate-review-summary.json` somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- A validacao confirmou exatamente um candidato forte, uma revisao multi-banco, uma colisao de destino, uma rejeicao por ambiguidade e uma revisao manual, sem leitura de valores.
- Nenhum registro de negocio, dado pessoal, segredo, MDF/LDF, TPS ou relatorio detalhado foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Validacao documental: 5/5 candidatos ativos revisados; 19.830 registros cobertos; zero empresa definida; zero importacao autorizada; SQL `Stopped`/`Manual`; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: detalhar a separacao estrutural entre `EMPRESAS` e `EMPRCOMP` no destino SQL `Empresas`, identificando campos exclusivos, compartilhados e de configuracao, sem consultar valores e sem definir empresa automaticamente.

### Gate 18 - Separacao estrutural EMPRESAS x EMPRCOMP

- A analise foi executada somente sobre os esquemas TPS locais de `EMPRESAS` e `EMPRCOMP` e o catalogo SQL completo de `LEGACY_TID_EXETPS.dbo.Empresas`. A instancia SQL permaneceu desligada.
- O destino legado `Empresas` ocorre em um unico banco e possui 407 colunas. `EMPRESAS` possui 18 campos e tres registros; `EMPRCOMP` possui 65 campos e tres registros.
- As duas fontes totalizam 82 campos unicos: 17 exclusivos de cadastro, 64 exclusivos de configuracao e somente uma chave compartilhada, `CODIGOEMPRESA`.
- Foram localizados 72 campos no destino SQL, todos com familias de tipo compativeis. Outros 335 campos do destino nao aparecem nessas duas fontes e permanecem intocados.
- Dez campos TPS nao possuem correspondencia exata no destino. Nove sao placeholders genericos e foram classificados como `QUARANTINE_GENERIC`.
- `DIVIDEESTOQUE` e a unica lacuna semantica. Foi classificada como `CONFIGURATION_REVIEW_NO_TARGET`; nenhum campo, componente ou funcionalidade nova foi autorizado.
- Ao todo, 29 campos genericos `*LIVRE*` foram separados da migracao automatica, mesmo quando existe coluna homonima no banco legado. Seu significado precisa ser comprovado antes de qualquer uso.
- Nao foram encontrados campos de segredo nessas duas fontes. A regra geral de bloquear senhas, tokens, certificados e chaves continua obrigatoria para os demais lotes.
- Foi gerada a matriz `tps-root-02-empresas-emprcomp-separation.csv` e o resumo correspondente somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Todas as 82 linhas mantem `CompanyContext=UNDETERMINED` e `ImportAuthorized=false`; nenhum valor foi lido e nenhuma empresa foi associada automaticamente.
- Validacao documental: 82/82 campos classificados; uma chave compartilhada; 72 correspondencias de tipo compativel; nove lacunas genericas em quarentena; uma lacuna semantica em revisao; zero criacao nova; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: cruzar os 53 campos semanticos de `EMPRESAS` e `EMPRCOMP` com as entidades e configuracoes ja existentes no ERP novo, reutilizando o modelo atual e mantendo campos sem equivalente em revisao, sem criar estrutura nova.

### Gate 18 - Cruzamento EMPRESAS/EMPRCOMP com o ERP atual

- Os 53 campos semanticos foram cruzados apenas com contratos e componentes ja existentes no ERP novo, sem abrir snapshots locais, consultar valores de negocio ou iniciar a instancia SQL.
- Foram reutilizadas as estruturas atuais `Empresa`, `Empresa.endereco`, `Empresa.configuracao_fiscal`, `ConfiguracaoSistema` e as politicas existentes de RBAC e multiempresa. Nenhuma entidade, tela, modulo, componente ou campo novo foi criado ou autorizado.
- Doze campos possuem destino direto existente, incluindo identificacao, endereco e configuracoes basicas de NF-e. Todos continuam sujeitos a validacao de formato, dominio, `groupId` e `empresaId` antes de qualquer carga.
- Vinte e seis campos foram classificados como `CONFIG_KEY_REVIEW`, com destino potencial na entidade generica `ConfiguracaoSistema`. Cada chave devera ter significado e tipo comprovados antes do uso.
- Tres campos exigem transformacao controlada de dominio, dois serao tratados somente como identificadores legados de conciliacao e um permaneceu sem equivalente comprovado, sem criacao de estrutura nova.
- Sete campos relacionados a liberacao, acesso ou propagacao foram bloqueados para revisao de politica. Valores legados nunca concederao RBAC nem acesso entre Grupo e Empresas automaticamente.
- Dois campos contendo caminhos locais de ECF foram bloqueados por seguranca e portabilidade. Esses caminhos nao serao migrados automaticamente.
- A matriz `tps-root-02-current-erp-field-crosswalk.csv` e seu resumo JSON foram armazenados somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS` e mantem `CompanyContext=UNDETERMINED` e `ImportAuthorized=false` nas 53 linhas.
- A verificacao confirmou 53 campos unicos, zero autorizacao de importacao, zero contexto empresarial atribuido, obrigatoriedade de Grupo/Empresa em todas as linhas, zero valor lido e zero snapshot aberto.
- A instancia `ERPZLEGACY` permaneceu `Stopped` e com inicializacao `Manual`. Nenhum dado real, segredo, TPS, MDF/LDF ou relatorio detalhado foi enviado ao GitHub.
- Validacao documental: 53/53 campos classificados; 12 destinos diretos; 26 configuracoes em revisao; sete bloqueios de acesso; dois bloqueios de caminho; tres transformacoes; dois identificadores legados; uma lacuna sem equivalente; zero estrutura nova; `git diff --check` exigido antes do commit.
- Proximo passo obrigatorio: definir o contrato de importacao piloto para os campos cadastrais de `EMPRESAS`, reutilizando `Empresa`, com chave legada idempotente, validacao de CNPJ/endereco/status, contexto Grupo/Empresa comprovado, RBAC e auditoria, ainda sem ler ou importar valores reais.

### Gate 18 - Contrato do piloto cadastral EMPRESAS

- O contrato foi definido somente a partir do esquema de `EMPRESAS.TPS` e dos fluxos existentes `migracaoErpPolicy`, `localCadastroMasterPolicy`, `entityGuardPolicy`, `Empresa` e `AuditLog`. Nenhum valor do backup foi lido.
- O piloto operara em modo `UPDATE_EXISTING_ONLY`: nenhuma empresa sera criada automaticamente. Cada linha devera apontar para uma empresa ja cadastrada, pertencente ao Grupo confirmado e autorizada ao usuario.
- A identidade exigira `CODIGOEMPRESA` como chave legada primaria, `CODIGOTIDSOFT` como identificador secundario e conferencia independente do CNPJ normalizado. Razao social e nome fantasia servirao apenas como evidencia secundaria.
- A chave idempotente sera composta por `group_id`, `empresa_id`, origem da migracao e codigo legado. Reexecucoes deverao reutilizar o mesmo destino e nunca duplicar `Empresa`.
- Dos 18 campos estruturais, nove foram destinados a escrita cadastral, um a conferencia e escrita de CNPJ, um a transformacao controlada de status, dois a metadados de conciliacao, tres a configuracao posterior, um a bloqueio de acesso e um a revisao sem destino.
- `SITUACAO` somente podera ser traduzida para os dominios atuais `Ativa`, `Inativa` ou `Suspensa` por tabela aprovada. `CONTROLELIBERACAO` nunca concedera permissao; `INSCMUNICIPAL` permanece sem equivalente e sem autorizacao para criar campo.
- A execucao exigira no backend as permissoes granulares de importar e editar em `Cadastros/Organizacional`, alem de acesso efetivo ao Grupo e a Empresa. Flags do legado nao alteram RBAC.
- O fluxo exigira staging, reconciliacao de quantidade, confirmacao explicita e janela de migracao valida antes de qualquer persistencia. Conflitos de CNPJ, chave ou escopo irao para quarentena local sem interromper linhas validas.
- A auditoria devera registrar antes/depois resumidos, campos alterados, resultado, motivo, usuario, timestamp, lote, Grupo e Empresa. Linha bruta, CNPJ completo, endereco completo, credenciais e caminhos locais nao poderao ser persistidos no log.
- O helper visual atual registra objetos completos; por isso ele nao esta autorizado para a auditoria deste piloto. A futura execucao devera usar caminho backend com resumo seguro e falha fechada para RBAC, contexto e auditoria.
- Foram gerados `tps-root-02-empresas-pilot-import-contract.csv` e o resumo JSON somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`, ambos sem valores reais e com `ImportAuthorized=false`.
- Validacao documental: 18/18 campos unicos; zero valor lido; zero linha autorizada; Grupo e Empresa obrigatorios em todas as linhas; criacao automatica desabilitada; SQL `Stopped`/`Manual`; 21/21 testes focados de migracao e multiempresa aprovados.
- Nenhum TPS, dado cadastral, CNPJ, endereco, segredo, MDF/LDF ou relatorio detalhado foi enviado ao GitHub. Nenhuma funcionalidade do ERP foi alterada ou removida.
- Proximo passo obrigatorio: preparar a conciliacao controlada das tres linhas de `EMPRESAS` com as empresas ja cadastradas no ERP, lendo apenas os identificadores minimos necessarios em ambiente local, mascarando documentos nos relatorios e mantendo qualquer divergencia em quarentena, sem persistir alteracoes no sistema.

### Gate 18 - Conciliacao controlada das identidades EMPRESAS

- A conciliacao foi executada somente sobre a copia `ReadOnly` de `EMPRESAS.TPS` do staging `ROOT-02` e o snapshot local reduzido do ERP. Nenhum arquivo original foi alterado e nenhuma persistencia foi feita no sistema.
- O leitor TPS local existente foi ampliado com um modo restrito de conciliacao, preservando o modo estrutural anterior. O novo modo seleciona somente `CODIGOEMPRESA`, `CODIGOTIDSOFT`, `CGC`, `RAZAOSOCIAL` e `NOMEFANTASIA`.
- A primeira compilacao do modo restrito identificou apenas uma incompatibilidade de tipo do indice da biblioteca e nao executou leitura. A conversao foi corrigida e a compilacao seguinte terminou sem erros ou avisos.
- A primeira leitura confirmou os codigos, mas retornou strings vazias porque a biblioteca disponibilizava parte do conteudo em bytes. A decodificacao Latin-1 foi adicionada e validada sem emitir valores brutos.
- Foram encontrados tres registros legados e duas empresas no snapshot atual. Os tres registros possuem codigos e nomes, mas o campo `CGC` esta vazio nas tres linhas do TPS.
- As duas empresas atuais possuem CNPJ matematicamente valido, porem nenhum vinculo pode ser comprovado porque o documento correspondente nao existe em `EMPRESAS.TPS`. Nao houve coincidencia exata de nome; nomes continuam apenas como evidencia secundaria e nunca autorizam vinculo isoladamente.
- O resultado foi zero correspondencia unica e tres identidades nao resolvidas. Todas permanecem com `CompanyContext=UNDETERMINED` e `ImportAuthorized=false`.
- As tres pendencias foram registradas em manifesto de quarentena local usando apenas numero do registro, mascara, fingerprint e motivo. Nenhum nome, CNPJ completo, endereco ou linha bruta foi copiado para a quarentena.
- Foram gerados `tps-root-02-empresas-identity-reconciliation.json`, o CSV mascarado correspondente e `empresas-identity-quarantine.csv`, somente em `D:\BACKUP ERP ANTIGO - CODEX`.
- O SHA-256 da copia analisada coincide com o plano `ROOT-02` e com a copia preservada. A copia permaneceu somente leitura; a instancia SQL permaneceu `Stopped` e com inicializacao `Manual`.
- O codigo do leitor, os hashes individuais e os relatorios detalhados permanecem apenas na area local de migracao. Nenhum dado real, TPS, snapshot, MDF/LDF ou identificador foi enviado ao GitHub.
- Validacao documental: 3/3 linhas cobertas; cinco campos minimos selecionados; zero valor bruto emitido; zero CNPJ legado presente; zero vinculo seguro; tres quarentenas; zero importacao autorizada; compilacao local sem erros/avisos; integridade confirmada.
- Proximo passo obrigatorio: consultar de forma controlada somente os identificadores empresariais minimos no destino SQL legado `LEGACY_TID_EXETPS.dbo.Empresas`, correlacionar por `CODIGOEMPRESA`/`CODIGOTIDSOFT`, mascarar documentos e manter a instancia isolada desligada ao final, sem atualizar o ERP.

### Gate 18 - Cruzamento SQL das identidades EMPRESAS

- O cruzamento consultou somente `CODIGOEMPRESA`, `CODIGOTIDSOFT`, `CGC`, `RAZAOSOCIAL` e `NOMEFANTASIA` em `LEGACY_TID_EXETPS.dbo.Empresas`. As colunas proximas `TOKENTIDSERVICOS` e `URLTIDSERVICOS` foram explicitamente excluidas.
- Nao havia script local equivalente. Foi criado somente no staging da migracao um script restrito e reproduzivel, com processamento em memoria, saida mascarada e desligamento obrigatorio do SQL em bloco `finally`. Esse codigo nao foi adicionado ao repositorio.
- A primeira tentativa foi recusada pelo PowerShell por sintaxe incompativel antes de iniciar o servico. As tentativas diretas seguintes confirmaram a ACL administrativa do Windows e tambem nao iniciaram a instancia.
- A primeira chamada UAC revelou um erro de parenteses no script antes da execucao. A sintaxe foi corrigida, validada estaticamente com zero erros e as execucoes administrativas posteriores terminaram com codigo zero.
- A instancia foi usada somente por Shared Memory local. TCP e Named Pipes permaneceram desativados; o servico foi desligado ao final e permanece `Stopped`/`Manual`.
- A tabela SQL possui cinco linhas. As tres identidades TPS encontram exatamente um candidato SQL por `CODIGOEMPRESA`, e esses candidatos possuem CNPJ matematicamente valido.
- Nenhuma das tres identidades coincide por `CODIGOTIDSOFT`, e nenhuma possui coincidencia exata de nome. Assim, `CODIGOEMPRESA` foi mantido somente como evidencia de revisao, nunca como vinculo confirmado.
- Os tres CNPJs SQL apontam individualmente para empresa no snapshot atual, mas representam apenas duas empresas distintas: duas linhas legadas disputam o mesmo destino atual.
- As empresas do snapshot usado nao possuem Grupo explicito nas linhas consultadas. Portanto, as tres identidades continuam com contexto empresarial indeterminado.
- O resultado final foi tres candidatos `CODE_ONLY_SQL_CURRENT_CNPJ_REVIEW`, zero vinculo confirmado e zero importacao autorizada. Duas linhas possuem colisao de destino e as tres possuem divergencia TID e ausencia de Grupo.
- Foram gerados `tps-root-02-empresas-sql-identity-reconciliation.json`, o CSV mascarado correspondente, o resumo seguro da execucao e `empresas-sql-identity-quarantine.csv`, somente em `D:\BACKUP ERP ANTIGO - CODEX`.
- A quarentena contem apenas numero de registro, fingerprint e motivos tecnicos. Nenhum nome, codigo completo, CNPJ completo, endereco, token, URL ou linha SQL bruta foi persistido nela.
- Nenhum dado real, TPS, snapshot, MDF/LDF, hash individual ou relatorio detalhado foi enviado ao GitHub. Nenhuma entidade, tela, funcionalidade ou dado do ERP foi alterado.
- Validacao documental: 3/3 linhas TPS cobertas; cinco linhas SQL consultadas; tres candidatos por codigo principal; zero coincidencia TID; tres CNPJs validos; dois destinos atuais distintos; duas colisoes; tres ausencias de Grupo; zero contexto confirmado; zero importacao autorizada; SQL desligado e rede desativada.
- Proximo passo obrigatorio: reconciliar a topologia atual `Grupo CPA`/empresas usando fontes locais confiaveis de Grupo e Empresa, comprovar os IDs canonicos e decidir explicitamente a colisao de duas identidades legadas no mesmo destino, mantendo o ERP sem alteracoes e todas as linhas bloqueadas ate a decisao.

### Gate 18 - Prova da topologia atual e decisao da colisao empresarial

- A topologia foi comparada em quatro fontes locais: snapshot reduzido, snapshot completo e duas exportacoes somente leitura. Todas apresentam exatamente um Grupo e duas Empresas.
- Os hashes do ID do Grupo, dos dois IDs de Empresa e dos dois CNPJs sao completos e identicos nas quatro fontes. Nenhum nome, ID ou documento bruto foi emitido no relatorio.
- As linhas brutas de Empresa nao possuem `group_id`, `grupo_id` ou `grupo_empresarial_id`. O fluxo existente `normalizeSnapshotRecord` aplica explicitamente o primeiro Grupo importado como Grupo canonico das empresas durante a hidratacao local.
- A primeira geracao da prova foi invalidada porque uma chamada de hash sem espaco apos `return` produziu hashes nulos. Os arquivos dessa tentativa foram sobrescritos; nenhuma conclusao foi aproveitada antes da correcao.
- A geracao corrigida exigiu hashes completos antes de comparar fontes e confirmou estabilidade do Grupo, das Empresas e dos CNPJs, alem da presenca do contrato de normalizacao no codigo atual.
- A topologia atual ficou comprovada para fins de staging: um Grupo canonico e duas Empresas canonicas. Isso nao confirma sozinho a identidade das tres linhas legadas nem autoriza carga.
- A colisao foi decidida como relacionamento de aliases candidatos, nunca como nova empresa: duas linhas legadas permanecem em revisao muitos-para-um para uma Empresa atual e a terceira permanece alias individual para a outra Empresa.
- E proibido criar uma terceira Empresa, substituir IDs canonicos ou gravar mais de um cadastro empresarial para o mesmo CNPJ. Codigos adicionais somente poderao ser preservados no mapa local de migracao ate validacao humana.
- Foram gerados `current-erp-company-topology-proof.json`, `legacy-company-collision-decision.csv` e o resumo correspondente somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- A matriz possui tres linhas: duas `MANY_TO_ONE_ALIAS_REVIEW` e uma `SINGLE_ALIAS_REVIEW`; todas usam o Grupo canonico comprovado, preservam aliases localmente e mantem `ImportAuthorized=false`.
- Os 21 testes focados de migracao e multiempresa foram aprovados. A instancia SQL permaneceu `Stopped`/`Manual`; nenhum dado, snapshot, TPS, MDF/LDF, hash detalhado ou mapa foi enviado ao GitHub.
- Validacao documental: quatro fontes concordantes; um Grupo; duas Empresas; hashes completos e estaveis; tres aliases candidatos; dois destinos; uma colisao muitos-para-um; zero nova empresa; zero sobrescrita de ID; zero importacao autorizada.
- Proximo passo obrigatorio: revisar de forma controlada `SITUACAO`, `TIPOEMPRESA` e `VARIASEMPRESASGRUPO` dos tres candidatos SQL para classificar alias ativo/inativo e matriz/filial, emitindo somente categorias permitidas e mantendo a identidade bloqueada ate validacao humana.

### Gate 18 - Classificacao dos aliases empresariais legados

- O script SQL local existente foi ampliado para consultar somente `SITUACAO`, `TIPOEMPRESA` e `VARIASEMPRESASGRUPO`, alem dos cinco identificadores ja autorizados. Nenhuma coluna de token, URL, credencial ou configuracao sensivel foi acessada.
- Os valores foram convertidos apenas para categorias fechadas. Conteudo fora das listas permitidas recebeu `UNRECOGNIZED`, sem emissao do texto original.
- A sintaxe foi validada estaticamente antes da execucao. A consulta administrativa terminou com codigo zero por Shared Memory local; SQL foi desligado no `finally` e permanece `Stopped`/`Manual`, com TCP e Named Pipes desativados.
- Os tres registros foram classificados como ativos. Nao existe alias inativo ou suspenso nesse conjunto.
- Um registro possui `VARIASEMPRESASGRUPO` habilitado e foi classificado como `GROUP_SCOPE_RECORD_REVIEW`. Ele representa controle no escopo do Grupo e nao podera criar ou atualizar uma Empresa.
- Removido o registro de controle do Grupo da disputa empresarial, restam exatamente dois `SINGLE_COMPANY_ALIAS_AFTER_GROUP_EXCLUSION`, cada um apontando para uma das duas Empresas canonicas. Nao resta colisao entre candidatos empresariais.
- `TIPOEMPRESA` ficou `UNRECOGNIZED` nos tres registros. Nenhuma interpretacao de matriz/filial foi inventada e esse campo permanece fora de qualquer decisao automatica.
- A divergencia de `CODIGOTIDSOFT` continua presente. Por isso, os dois aliases empresariais sao candidatos de mapeamento, nao identidades confirmadas, e exigem validacao humana antes de qualquer carga.
- A matriz `legacy-company-collision-decision.csv`, seu resumo e o manifesto de quarentena foram atualizados somente no HD. A decisao proibe criar terceira Empresa, sobrescrever ID canonico ou usar o registro de Grupo como cadastro empresarial.
- A primeira atualizacao do resumo local calculou contagens zeradas por sintaxe abreviada incorreta de `Where-Object`. O resumo foi sobrescrito com filtros explicitos e validado com uma linha de Grupo, duas linhas de Empresa e zero colisao remanescente.
- Nenhum valor bruto, nome, CNPJ completo, ID, TPS, snapshot, MDF/LDF, script local ou relatorio detalhado foi enviado ao GitHub. Nenhum dado ou funcionalidade do ERP foi alterado.
- Validacao documental: oito colunas minimas consultadas; 3/3 registros ativos; um registro de Grupo; dois candidatos empresariais; dois destinos canonicos; zero colisao empresarial remanescente; tres tipos nao reconhecidos; zero criacao; zero importacao autorizada.
- Proximo passo obrigatorio: preparar um pacote local de validacao humana para os dois candidatos empresariais, exibindo somente codigo mascarado, final do CNPJ, empresa de destino conhecida e motivos pendentes; o registro de Grupo devera aparecer separado e nenhuma confirmacao sera inferida automaticamente.

### Gate 18 - Pacote de validacao humana das identidades empresariais

- Foi preparado no HD um pacote minimo para revisao humana das identidades legadas, sem alterar dados ou funcionalidades do ERP.
- A ficha `legacy-company-human-validation.csv` contem exatamente dois candidatos empresariais: um destinado a `CPA FERRO E AÇO` e outro a `3Z LTDA`.
- A ficha `legacy-group-record-human-validation.csv` mantem o terceiro registro isolado no escopo `Grupo CPA`, impedindo seu uso como cadastro de Empresa.
- Cada ficha expoe somente codigo legado mascarado, quatro ultimos digitos do CNPJ, destino conhecido, motivos pendentes e decisao humana.
- As tres decisoes foram iniciadas como `PENDENTE`. Nenhuma confirmacao foi inferida e `ImportAuthorized` permanece `false`.
- Os motivos pendentes preservados sao divergencia de `CODIGOTIDSOFT`, nome de origem nao confirmado, tipo empresarial nao reconhecido e confirmacao humana obrigatoria; o registro de Grupo tambem exige confirmacao explicita de escopo.
- O resumo `legacy-business-identity-human-validation-summary.json` registra apenas contagens, nomes dos arquivos do pacote e a negativa de importacao. Os tres arquivos permanecem exclusivamente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- A validacao confirmou duas linhas empresariais, uma linha de Grupo, esquemas exatos, mascaras validas, tres decisoes pendentes, zero campo proibido e zero autorizacao de importacao.
- Nenhum valor bruto, ID, hash de identidade, CNPJ completo, TPS, snapshot, MDF/LDF, script ou relatorio detalhado foi adicionado ao GitHub.
- A instancia SQL nao precisou ser iniciada nesta etapa e permanece `Stopped`/`Manual`.
- Mudanca exclusivamente documental no repositorio: dispensados testes de runtime; obrigatorios `git diff --check`, verificacao do pacote e confirmacao do servico SQL foram executados.
- Proximo passo obrigatorio: obter a decisao humana explicita para cada uma das tres fichas; somente depois gerar um mapa local assinado de aliases aprovados, mantendo rejeitados ou duvidosos em quarentena e sem executar importacao.

### Gate 18 - Aprovacao humana e mapa local de aliases

- O proprietario confirmou explicitamente os tres vinculos apresentados: um alias para `CPA FERRO E AÇO`, um alias para `3Z LTDA` e um registro de escopo para `Grupo CPA`.
- As duas fichas locais de validacao foram atualizadas de `PENDENTE` para `APROVADO`; nenhuma decisao foi inferida pelo processo.
- Foi criado `legacy-approved-business-alias-map.json` somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`, pois nao existia mapa aprovado equivalente.
- O mapa vincula as origens e os destinos exclusivamente por hashes completos, preserva o papel de cada alias e proibe criar nova Empresa ou sobrescrever IDs canonicos.
- O registro de Grupo permanece separado dos dois vinculos empresariais e nao pode ser tratado como cadastro de Empresa.
- A aprovacao do mapeamento nao autoriza carga: o mapa e todos os seus vinculos permanecem com `ImportAuthorized=false`.
- A confirmacao foi registrada como atestado explicito do proprietario. Como nao existe chave de assinatura digital configurada, o artefato declara corretamente `digitalSignatureConfigured=false` e usa SHA-256 apenas como selo de integridade, sem alegar assinatura criptografica.
- O selo foi recalculado a partir do arquivo persistido e conferiu integralmente. A validacao confirmou tres mapeamentos, tres aprovacoes, dois destinos empresariais, um destino de Grupo, zero identificador numerico longo e zero autorizacao de importacao.
- A instancia SQL nao foi iniciada e permanece `Stopped`/`Manual`.
- Nenhum arquivo local, dado real, hash de identidade, TPS, snapshot, MDF/LDF ou relatorio detalhado foi adicionado ao GitHub. O repositorio recebeu somente esta atualizacao documental.
- Mudanca exclusivamente documental no ERP: testes de runtime dispensados; foram executados `git diff --check`, validacao estrutural das fichas, verificacao do selo e confirmacao do servico SQL.
- Proximo passo obrigatorio: executar um ensaio local e somente leitura do resolvedor usando os tres aliases aprovados, comprovando resolucao unica, separacao Grupo/Empresa e idempotencia, sem gravar no ERP nem liberar importacao.

### Gate 18 - Dry-run idempotente dos aliases aprovados

- Foi executado um ensaio local `READ_ONLY_DRY_RUN` com o mapa aprovado, sem chamar API de gravacao, sem tocar no armazenamento do ERP e sem iniciar o SQL legado.
- O ensaio reutilizou o contrato existente de `normalizeSnapshotRecord`, que atribui explicitamente `group_id`, `grupo_id` e `grupo_empresarial_id` canonicos a cada Empresa importada.
- Os tres aliases resolveram de forma unica contra a topologia atual: dois no escopo `COMPANY` e um no escopo `GROUP`, todos vinculados ao unico Grupo canonico.
- Duas execucoes independentes produziram o mesmo hash de resultado, comprovando determinismo.
- A primeira aplicacao em memoria adicionou tres vinculos; a segunda adicionou zero, reconheceu os tres como inalterados e produziu zero conflito.
- Os cenarios negativos bloquearam destino inexistente, troca indevida de escopo Grupo/Empresa e Grupo de destino adulterado.
- O relatorio `legacy-approved-business-alias-dry-run.json` foi gravado somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS` e revalidado apos persistencia.
- O resultado registra `writesAttempted=0`, `erpStorageTouched=false`, `sqlStarted=false` e `importAuthorized=false`. A aprovacao de identidade continua separada da autorizacao de carga.
- Os 20 testes focados de contexto multiempresa e cadastros mestres foram aprovados, incluindo isolamento de empresa externa ao Grupo e falha fechada em escopos incompletos.
- A instancia SQL permanece `Stopped`/`Manual`. Nenhum arquivo local, dado real, hash de identidade, TPS, snapshot, MDF/LDF ou relatorio detalhado foi adicionado ao GitHub.
- Mudanca exclusivamente documental no repositorio; `git diff --check` foi aplicado no fechamento.
- Proximo passo obrigatorio: iniciar o lote de usuarios e perfis pelo inventario estrutural somente leitura das tabelas legadas, excluindo senhas, tokens e segredos antes de consultar qualquer registro.

### Gate 18 - Inventario estrutural de usuarios e RBAC legados

- O inventario reutilizou o catalogo estrutural local ja existente dos nove bancos; a instancia SQL nao foi iniciada e nenhuma consulta de registros foi executada.
- O catalogo cobre 4.612 combinacoes de banco, schema e tabela. O filtro corrigido identificou 34 nomes candidatos, 51 ocorrencias por banco e 563 colunas relacionadas a usuarios, acessos, escopos ou operadores.
- A filtragem inicial foi descartada porque `acesso` tambem capturava `acessorios` e os aliases de coluna usados nao correspondiam ao cabecalho real. A classificacao final exclui esse falso positivo e usa `Database`/`Schema` corretamente.
- A primeira geracao foi interrompida antes de gravar relatorios por sintaxe abreviada invalida de `return` no PowerShell. A expressao foi corrigida e toda a saida foi regenerada e validada.
- `Usuarios` foi classificada como conta central; `UsuariosPortalWeb` ficou em revisao separada; `UsoSiglasAcesso` e `ContrAcesso` ficaram como dicionario ou vinculo RBAC.
- Quinze ocorrencias de tabela foram classificadas como vinculos de Empresa, unidade, centro de custo ou estrutura organizacional. Vinte e duas tabelas de operadores foram separadas das contas de autenticacao.
- `PerfilTributacao` foi excluida do RBAC por representar configuracao fiscal, evitando confundir perfil tributario com perfil de acesso.
- Seis colunas foram marcadas `SENSITIVE_NEVER_READ`, incluindo senha, senha de e-mail, assinatura e caminho de assinatura. A tabela `UsuarioSenha` inteira recebeu `NEVER_READ_RECORDS`.
- O arquivo `USUSENHA.TPS`, ja marcado `BLOQUEADO_CREDENCIAL` no inventario TPS, foi incorporado a politica como fonte proibida. Senhas legadas nao serao lidas nem migradas; usuarios deverao redefinir credenciais.
- Foram gerados `legacy-user-rbac-structural-inventory.csv`, `legacy-user-rbac-column-policy.csv` e o resumo correspondente somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Validacao final: nove bancos; 4.612 tabelas catalogadas; 51 ocorrencias candidatas; 563 colunas; seis colunas sensiveis bloqueadas; uma tabela e um TPS de credenciais bloqueados; zero registro lido; zero importacao autorizada.
- A instancia SQL permanece `Stopped`/`Manual`. Nenhum dado, credencial, TPS, snapshot, MDF/LDF, hash detalhado ou relatorio local foi adicionado ao GitHub.
- Mudanca exclusivamente documental no repositorio; testes de runtime dispensados e `git diff --check` obrigatorio no fechamento.
- Proximo passo obrigatorio: definir a allowlist de campos para contas, RBAC e vinculos de escopo e executar somente contagens agregadas por tabela, ainda sem extrair nomes, e-mails, telefones, senhas ou permissoes individuais.

### Gate 18 - Allowlist e contagens agregadas de usuarios/RBAC

- Foi criada uma allowlist local para as 19 tabelas elegiveis: uma de contas centrais, uma de portal, duas de RBAC e quinze de vinculos de escopo ou estrutura organizacional.
- Das 152 colunas dessas fontes, 59 chaves tecnicas, estados de conta e metadados RBAC ficaram permitidos apenas para futura extracao controlada; oito campos pessoais e 81 campos sem mapeamento ficaram adiados.
- Quatro campos sensiveis presentes nas tabelas elegiveis permanecem `DENY_NEVER_READ`. A tabela `UsuarioSenha` e `USUSENHA.TPS` nao foram incluidos na query.
- A primeira tentativa de coleta nao iniciou porque o caminho esperado do PowerShell 7 nao existe neste computador. Nenhum servico ou banco foi tocado nessa tentativa.
- A primeira execucao pelo Windows PowerShell realizou somente as agregacoes, mas o resultado foi rejeitado porque o array JSON foi contado como um objeto. O `finally` desligou o SQL e nenhum arquivo de contagem foi aceito.
- A expansao do array foi corrigida e a consulta foi repetida. Foram executadas exclusivamente 19 expressoes `COUNT_BIG(*)`, com zero coluna de valor selecionada.
- O resultado validado possui 19 tabelas unicas e tres nao vazias: `Usuarios` soma 44 contas; as duas fontes RBAC somam 1.089 registros; `UsuariosPortalWeb` e as quinze fontes de vinculo de escopo estao vazias.
- A ausencia de vinculos nas fontes de escopo impede inferir liberacao para Grupo, Empresa, unidade ou centro de custo. Nenhum usuario recebera acesso multiempresa automaticamente.
- Foram gerados `legacy-user-rbac-safe-field-allowlist.csv`, seu resumo, `legacy-user-rbac-aggregate-counts.csv`, seu resumo e o resumo de execucao somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Validacao final: 19 tabelas; 19 chaves unicas; tres tabelas nao vazias; zero contagem negativa; zero coluna de valor; zero tabela de credencial; zero dado pessoal ou senha lido; zero importacao autorizada.
- A instancia SQL voltou a `Stopped`/`Manual`; TCP e Named Pipes permanecem desativados.
- Nenhum dado, credencial, TPS, snapshot, MDF/LDF, hash detalhado ou relatorio local foi adicionado ao GitHub. Mudanca exclusivamente documental no repositorio; testes de runtime dispensados e `git diff --check` obrigatorio no fechamento.
- Proximo passo obrigatorio: extrair em modo local somente hashes dos codigos das 44 contas e dos vinculos RBAC, comprovar a cardinalidade entre `Usuarios`, `ContrAcesso` e `UsoSiglasAcesso` e manter todos os acessos Grupo/Empresa bloqueados ate definicao explicita.

### Gate 18 - Correlacao hash-only de usuarios/RBAC - BLOCKED

- A politica local foi ajustada para permitir `ContrAcesso.MATRICULA` exclusivamente como `ALLOW_HASH_ONLY_CORRELATION`; o valor bruto continua proibido e nao foi lido nem persistido.
- Foi criada uma chave aleatoria de 32 bytes protegida por DPAPI `CurrentUser`, armazenada somente no HD com heranca removida e ACL exclusiva para `DELL-VINI\cpaba`. Apenas o fingerprint local da chave foi exibido.
- A consulta preparada limita-se a `Usuarios.CODIGO`, `ContrAcesso.MATRICULA`, `ContrAcesso.CODIGOSISTEMA`, `UsoSiglasAcesso.ID` e `UsoSiglasAcesso.SIGLA`, convertendo cada valor em hash salgado dentro do SQL antes da saida.
- O primeiro lancamento usou payload codificado acima do limite pratico do iniciador do Windows e nao produziu resumo. Um helper temporario foi criado para evitar esse limite, validado estaticamente e removido do repositorio antes do fechamento.
- A execucao direta do helper confirmou que o processo atual nao possui permissao para iniciar `MSSQL$ERPZLEGACY`. O erro foi registrado localmente como `ServiceCommandException`, com zero campo de senha consultado e zero valor pessoal persistido.
- Tres tentativas de elevacao pelo UAC, incluindo invocacao curta e modo destacado, nao chegaram a executar no ambiente atual e nao atualizaram o resumo. Nenhum resultado de correlacao foi produzido ou aceito.
- A instancia permanece `Stopped`/`Manual`. Nenhum dado, credencial, TPS, snapshot, MDF/LDF, hash de usuario ou relatorio detalhado foi adicionado ao GitHub.
- Estado `BLOCKED`: a correlacao depende de iniciar temporariamente a instancia com privilegio administrativo. Nao existe alternativa segura que preserve a consulta hash-only sem esse acesso.
- Todos os acessos de Grupo e Empresa permanecem negados, e `ImportAuthorized=false` continua obrigatorio.
- Proximo passo para desbloqueio: abrir o Codex como Administrador neste computador e repetir a consulta hash-only; depois validar 44 contas, 757 vinculos e 332 definicoes, desligando o SQL no `finally`.

### Gate 18 - Correlacao hash-only de usuarios/RBAC concluida

- O bloqueio foi removido com inicializacao manual da instancia pelo proprietario. A consulta foi executada contra o SQL ja ativo e o servico foi parado manualmente logo apos a analise.
- A sintaxe do helper temporario foi validada com zero erro. O arquivo foi removido antes do fechamento e nao sera enviado ao GitHub.
- A consulta acessou somente `Usuarios.CODIGO`, `ContrAcesso.MATRICULA`, `ContrAcesso.CODIGOSISTEMA`, `UsoSiglasAcesso.ID` e `UsoSiglasAcesso.SIGLA`; os valores foram transformados em hashes salgados dentro do SQL antes da saida.
- A chave de correlacao permanece protegida por DPAPI e ACL local. Nenhuma chave, codigo, matricula, nome, e-mail, senha ou permissao em texto foi persistida nos relatorios.
- Foram encontrados 44 usuarios e 44 hashes unicos, sem chave vazia ou duplicada.
- Os 757 vinculos RBAC encontram exatamente um usuario: zero usuario ausente e zero usuario ambiguo. Vinte e oito usuarios possuem vinculos e dezesseis nao possuem.
- As 332 definicoes possuem IDs unicos, mas apenas 133 siglas distintas; 69 grupos de sigla estao duplicados.
- Dos 757 vinculos, 172 encontram definicao por sigla, 263 nao encontram definicao e 322 sao ambiguos. Nenhum vinculo encontra a definicao pelo ID e nao ha aresta duplicada exata.
- Os 172 casamentos por sigla sao apenas candidatos tecnicos. Os 585 vinculos ausentes ou ambiguos permanecem bloqueados, e nenhum deles foi convertido em permissao atual.
- Foram gerados o relatorio hash-only, seu resumo e o resumo de execucao somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Validacao final: 2.222 hashes no formato SHA-256; zero hash invalido; 44 contas; 757 vinculos; 332 definicoes; zero valor bruto; zero campo de senha; zero dado pessoal persistido; zero acesso de Grupo/Empresa; zero importacao autorizada.
- A instancia foi confirmada `Stopped`/`Manual` apos a intervencao manual; TCP e Named Pipes permanecem desativados conforme a configuracao isolada.
- Nenhum dado, credencial, TPS, snapshot, MDF/LDF, hash detalhado ou relatorio local foi adicionado ao GitHub. Mudanca exclusivamente documental no repositorio; testes de runtime dispensados e `git diff --check` obrigatorio no fechamento.
- Proximo passo obrigatorio: separar localmente os 172 candidatos por sigla dos 585 vinculos bloqueados, consolidar as 69 siglas duplicadas e comparar somente a taxonomia legada com as chaves RBAC existentes, sem liberar acesso.

### Gate 18 - Filas RBAC e comparacao com chaves atuais

- A separacao foi executada somente sobre os hashes ja extraidos; a instancia SQL nao foi iniciada nesta etapa.
- A fonte canonicamente reutilizada no ERP atual foi `PerfilAcesso.permissoes` do snapshot vigente, respeitando os aliases de acao definidos em `entityGuardPolicy`.
- Foram identificadas 395 chaves RBAC canonicas distintas no conjunto atual de perfis. As chaves foram convertidas com a mesma chave DPAPI e somente seus hashes foram comparados.
- A primeira geracao foi interrompida antes de gravar as filas porque o PowerShell passou as 395 chaves como argumentos separados ao construtor de `HashSet`. O preenchimento foi corrigido para insercao item a item e toda a saida foi regenerada.
- A fila `legacy-user-rbac-candidate-queue.json` contem 172 vinculos com definicao legada unica por sigla, todos marcados `CANDIDATE_NOT_AUTHORIZED`.
- A fila `legacy-user-rbac-blocked-queue.json` contem 585 vinculos em quarentena: 263 sem definicao legada e 322 associados a siglas duplicadas.
- As 69 siglas duplicadas foram consolidadas em grupos de revisao, preservando os hashes de suas definicoes sem escolher automaticamente uma definicao vencedora.
- Dezesseis usuarios sem qualquer vinculo RBAC foram separados em fila propria e permanecem sem acesso de Grupo ou Empresa.
- A comparacao exata encontrou zero sigla legada igual a uma das 395 chaves canonicas atuais e zero candidato diretamente mapeavel. Nenhuma aproximacao textual ou permissao por semelhanca foi aplicada.
- Foram geradas seis filas/resumos somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`, incluindo candidatos, bloqueados, duplicatas, usuarios sem vinculo e comparacao com o RBAC atual.
- Validacao final: 172 candidatos; 585 bloqueados; 757 vinculos cobertos; 69 grupos duplicados; 16 usuarios sem vinculo; 2.262 hashes validos; zero hash invalido; zero acesso ou importacao autorizada.
- A instancia permanece `Stopped`/`Manual`. Nenhum dado, credencial, hash detalhado, TPS, snapshot, MDF/LDF ou relatorio local foi adicionado ao GitHub.
- Mudanca exclusivamente documental no repositorio; testes de runtime dispensados e `git diff --check` obrigatorio no fechamento.
- Proximo passo obrigatorio: preparar uma extracao local e sanitizada da taxonomia das 332 definicoes (`SIGLA`, `MODULO`, `NOMEPROCEDURE` e `DESCRICAOUSO`), consolidar as duplicatas semanticamente e produzir uma matriz de traducao para revisao humana, sem ativar permissoes.

### Gate 18 - Taxonomia RBAC sanitizada e matriz humana

- Foi definido e validado um contrato local de extracao que permite exclusivamente `SIGLA`, `MODULO`, `NOMEPROCEDURE` e `DESCRICAOUSO`; todas as demais colunas permanecem proibidas.
- A instancia foi iniciada manualmente pelo proprietario somente durante a consulta das 332 definicoes e nenhum campo de senha foi consultado.
- Os valores foram normalizados e sanitizados em memoria antes da persistencia. Nenhuma linha bruta, URL, e-mail, CPF/CNPJ, numero longo ou token potencial foi gravado sem tratamento.
- As 332 definicoes resultaram em 133 grupos de sigla e 133 linhas na matriz de traducao humana, sem sigla vazia.
- Foram encontrados 69 grupos com siglas duplicadas e 67 grupos com conflito semantico. As duplicatas foram consolidadas apenas para revisao, sem escolher automaticamente uma definicao vencedora.
- Duas definicoes com padrao semelhante a token foram redigidas e colocadas em quarentena. O conteudo original nao foi exposto nos relatorios.
- Todas as 133 linhas permanecem com decisao humana `PENDENTE`; destino, permissao atual e autorizacao continuam vazios. Foram realizados zero mapeamento automatico e zero liberacao de acesso.
- Foram gerados contrato, taxonomia sanitizada, matriz humana, quarentena e resumo exclusivamente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- Validacao final: 332 definicoes; 133 grupos; 69 grupos duplicados; 67 conflitos semanticos; 2 redacoes e 2 quarentenas; zero limite de campo excedido; zero caractere de controle; zero padrao inseguro sem redacao; zero acesso de Grupo/Empresa; zero importacao autorizada.
- A instancia foi confirmada `Stopped`/`Manual` ao final. TCP e Named Pipes permanecem desativados conforme a configuracao isolada.
- Nenhum dado, credencial, TPS, snapshot, MDF/LDF, hash detalhado ou relatorio local foi adicionado ao GitHub. Mudanca exclusivamente documental no repositorio; testes de runtime dispensados e `git diff --check` obrigatorio no fechamento.
- Proximo passo obrigatorio: preparar um pacote local de revisao humana para os 66 grupos sem conflito semantico, comparando-os com as chaves RBAC atuais sem sugerir acesso por similaridade; os 67 grupos conflitantes e as 2 redacoes permanecem em quarentena.

### Gate 18 - Pacote de revisao humana RBAC

- O pacote foi gerado somente a partir da taxonomia sanitizada e do `PerfilAcesso.permissoes` vigente, sem nova consulta aos bancos legados e sem iniciar a instancia SQL.
- A arvore de permissoes atual foi lida somente em memoria no armazenamento local do navegador. Foram confirmados 20 perfis, 601 ocorrencias e exatamente 395 caminhos RBAC distintos, correspondentes aos 395 hashes do inventario anterior.
- Dos 66 grupos sem conflito semantico, 2 continham redacao de seguranca e permaneceram bloqueados. A fila humana pronta contem 64 grupos unicos.
- A quarentena consolidada contem 69 grupos unicos: 67 por conflito semantico e 2 por conteudo redigido. Nenhum grupo bloqueado foi promovido para revisao pronta.
- O catalogo legivel das 395 chaves atuais foi separado da fila legada e marcado exclusivamente como referencia. Nao houve associacao por similaridade, recomendacao automatica ou escolha de permissao.
- Todas as 64 linhas revisaveis permanecem com `ReviewerDecision=PENDENTE`, `SelectedCurrentPermissionKey` vazio e autorizacoes de Grupo, Empresa e importacao iguais a `false`.
- As 69 linhas em quarentena permanecem com `ReviewerDecision=BLOQUEADO` e todas as autorizacoes iguais a `false`.
- Os campos textuais exportados foram protegidos contra formula CSV. Validacao final: 64 IDs de revisao unicos; 69 IDs de bloqueio unicos; 395 chaves atuais unicas; zero celula insegura; zero linha autorizada; zero sugestao por similaridade.
- Foram gerados `legacy-rbac-human-review-ready.csv`, `legacy-rbac-human-review-quarantine.csv`, `current-rbac-readable-key-catalog.csv` e `legacy-rbac-human-review-package-summary.json` somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- A instancia permanece `Stopped`/`Manual`, com TCP e Named Pipes desativados. Nenhum perfil completo, usuario, empresa, dado pessoal, hash detalhado ou relatorio local foi copiado para o repositorio.
- Mudanca exclusivamente documental no GitHub; testes de runtime dispensados e `git diff --check` obrigatorio no fechamento.
- Proximo passo obrigatorio: submeter os 64 grupos prontos a decisao humana controlada, exigindo uma chave exata do catalogo atual e justificativa para cada aceite; itens rejeitados ou sem decisao continuam sem acesso, e os 69 itens em quarentena nao podem ser selecionados.

### Gate 18 - Planilha controlada para decisao RBAC

- Foi criada a planilha local `legacy-rbac-controlled-human-review.xlsx` para a decisao humana dos 64 grupos prontos, sem macro, conexao com banco, botao de importacao ou mecanismo de concessao de acesso.
- A aba `Revisao` contem os 64 grupos, campos editaveis para decisao, chave RBAC exata, justificativa e revisor, alem de validacao calculada por linha.
- A decisao aceita somente `PENDENTE`, `ACEITAR` ou `REJEITAR`. A chave escolhida usa lista vinculada ao catalogo atual de 395 permissoes.
- Um aceite somente chega a `PRONTO PARA HOMOLOGACAO` quando possui chave existente exatamente uma vez no catalogo, justificativa e revisor. Chave por similaridade nao e calculada nem sugerida.
- A aba `Catalogo` contem apenas as 395 chaves RBAC legiveis de referencia, derivadas dos 20 perfis atuais e das 601 ocorrencias ja validadas.
- A aba `Quarentena` contem os 69 grupos bloqueados, sendo 67 conflitos semanticos e 2 redacoes de seguranca, sem campos de selecao para migracao.
- O XLSX exportado possui duas validacoes nativas nos intervalos `G9:G72` e `H9:H72` e 69 formulas de controle. A verificacao interna do arquivo confirmou a persistencia dessas estruturas.
- Testes apos reabertura: aceite incompleto resultou em `FALTAM DADOS`; chave inexistente em `CHAVE INVALIDA`; aceite completo de teste em `PRONTO PARA HOMOLOGACAO`; rejeicao em `REJEITADO`; restauracao final em `PENDENTE`.
- As tres abas foram renderizadas e revisadas visualmente, com titulos, cabecalhos, textos, campos editaveis e bloqueios legiveis.
- O arquivo final foi salvo somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`, com SHA-256 `12BEEB78ADEBF855F2605C1F74DFD3F78B4FA65E73193004B16C4D03D6747EA2`.
- O arquivo auxiliar de inspecao criado pelo gerador foi removido para evitar duplicacao de conteudo sanitizado. Nenhuma planilha, CSV, dado legado, perfil, hash detalhado ou relatorio local foi adicionado ao GitHub.
- A instancia SQL permanece `Stopped`/`Manual`; nenhuma alteracao de runtime foi realizada. Mudanca do repositorio exclusivamente documental, com `git diff --check` obrigatorio no fechamento.
- Proximo passo obrigatorio: o proprietario deve preencher a aba `Revisao`. Somente linhas com `PRONTO PARA HOMOLOGACAO` poderao compor um lote posterior de homologacao; linhas pendentes, rejeitadas, invalidas, incompletas ou em quarentena permanecem sem acesso e sem importacao.

### Gate 18 - Encerramento do RBAC legado e inventario agregado de clientes

- O proprietario classificou as siglas, os vinculos e a planilha de revisao do RBAC legado como material apenas de referencia. Todo o pacote foi arquivado somente no HD, sem importacao de permissao.
- As 44 contas antigas nao serao migradas. Usuarios e acessos serao cadastrados manualmente no ERP atual, sem leitura ou reaproveitamento de senhas legadas.
- Foi criado somente no staging local o contrato das 156 colunas de `LEGACY_TID_EXETPS.dbo.Clientes`: 37 campos permitidos para uso estrutural ou futuro staging controlado e 119 campos bloqueados por falta de significado ou destino confirmado.
- Campos livres, comentarios, historicos e saldos antigos permanecem fora da extracao. Nenhum importador, entidade, tela, rota ou funcionalidade paralela foi criado.
- A tabela mestre possui 22.895 clientes e 22.895 codigos legados distintos, sem codigo ou nome ausente. A reconciliacao por situacao e tipo cobriu 100% das linhas.
- A distribuicao agregada possui 21.747 clientes ativos, 39 inativos e 1.109 potenciais; 18.565 sao pessoas fisicas e 4.330 pessoas juridicas.
- A pre-validacao usa `TIPOCLIENTE`: pessoa fisica exige CPF e pessoa juridica exige CGC/CNPJ. Zeros de preenchimento sao tratados como ausencia e nao como documento valido.
- Todos os 22.895 registros possuem o documento esperado preenchido; 18.485 passam na validacao inicial de digitos e comprimento, e 4.410 apresentam formato incompativel e deverao seguir para quarentena antes de qualquer carga.
- A correlacao em fluxo sequencial encontrou oito grupos de documento duplicado, envolvendo 24 registros e 16 linhas adicionais a conciliar. O calculo usou HMAC-SHA256 apenas em memoria, com chave aleatoria descartada ao final; nenhum documento ou hash individual foi persistido.
- Os relatorios agregados nao possuem nomes, documentos, enderecos, e-mails ou linhas brutas. Contrato, contagens e resultados detalhados permanecem exclusivamente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`.
- O inventario confirmou outros cadastros mestres no backup: `Fornecedores` com aproximadamente 1.061 registros, `Funcionarios` com 83, `CadastroMateriais` com 2.360, `Transportadoras` com 14, `Vendedores` com 34 e `Bancos` com 164.
- Funcionarios serao tratados como dados pessoais de RH em lote proprio e nao serao confundidos com usuarios de autenticacao. Fornecedores, materiais/produtos e demais cadastros tambem terao contratos e quarentenas independentes antes de qualquer importacao.
- Uma consulta de duplicidade com alto pedido de memoria foi cancelada sem alterar o banco e substituida pelo processamento sequencial de baixo consumo. Nenhum resultado parcial foi aceito.
- A instancia SQL foi encerrada apos as consultas e permanece `Stopped`/`Manual`; TCP e Named Pipes estao desativados. Nenhuma importacao direta foi executada.
- Nenhum dado pessoal, credencial, arquivo TPS, MDF/LDF, CSV nominal, planilha ou relatorio local foi adicionado ao GitHub. A mudanca no repositorio e exclusivamente documental; testes de runtime foram dispensados e `git diff --check` e obrigatorio no fechamento.
- Proximo passo obrigatorio: preparar o lote nominal local de clientes usando o `Cliente` existente, validar CPF/CNPJ por digito verificador, aplicar idempotencia por `CODIGOCLIENTE` e documento normalizado no Grupo CPA e separar invalidos, duplicados ou sem identificacao em `05_QUARANTINE`, sem importar diretamente e sem enviar dados ao GitHub.

### Gate 18 - Staging nominal protegido de clientes

- O lote reutilizou o cadastro mestre `Cliente`, o payload do formulario existente e `localCadastroMasterPolicy`; nenhum importador, entidade, tela, rota ou funcao paralela foi criado.
- O Grupo canonico foi resolvido somente em memoria a partir do snapshot atual. Seu hash coincide com a prova de topologia previamente validada; o ID bruto aparece apenas nos CSVs privados.
- O contrato local foi atualizado para `NOMINAL_LOCAL_STAGING_COMPLETE`: 37 das 156 colunas estao permitidas somente no staging local e as outras 119 permanecem bloqueadas.
- As 22.895 linhas de `LEGACY_TID_EXETPS.dbo.Clientes` foram lidas por `SELECT` e reconciliadas integralmente, sem escrita no banco legado e sem chamada de criacao ou atualizacao no ERP.
- Foram gerados 18.458 candidatos e 4.437 registros em quarentena. Todas as linhas possuem `import_authorized=false` e o resumo confirma `directImportPerformed=false`.
- A validacao nominal completa de CPF/CNPJ inclui tipo esperado, somente digitos, comprimento, bloqueio de sequencias repetidas e digitos verificadores. Foram quarentenados 4.414 registros por documento invalido.
- Os oito grupos duplicados identificados anteriormente foram confirmados: as 24 linhas envolvidas permaneceram integralmente em quarentena, sem eleger automaticamente um registro vencedor.
- Um documento ja existe entre os clientes do snapshot atual e tambem foi bloqueado para revisao idempotente. Nenhum candidato aceito possui documento duplicado.
- Todos os candidatos possuem tipo e status reconhecidos, um unico `group_id` canonico, `scope_type=grupo` e `empresa_id` vazio. O cadastro mestre nao foi duplicado fisicamente entre empresas.
- `CODIGOCLIENTE` foi preservado como codigo legado e origem. Referencias a tabela de preco, vendedor, regiao, condicao de pagamento, transportadora, grupo de cliente, ramo e CNAE foram mantidas somente como codigos legados pendentes de mapeamento.
- Campos de nome, documento, endereco, cobranca e e-mail foram sanitizados. E-mails invalidos nao foram promovidos ao campo de contato; permaneceram apenas no arquivo privado para revisao.
- A validacao final confirmou 22.895/22.895 linhas reconciliadas, zero autorizacao indevida, zero candidato com motivo de quarentena, zero quarentena sem motivo, zero duplicidade entre candidatos e zero celula com prefixo inseguro para CSV.
- Os CSVs nominais foram gravados somente em `03_EXPORT_STAGING\CLIENTES\CLIENTES-LEGACY-TID-001` e `05_QUARANTINE\CLIENTES\CLIENTES-LEGACY-TID-001`, com heranca de ACL removida e uma unica regra para o usuario local.
- Os fingerprints usam HMAC-SHA256 com chave propria protegida por DPAPI `CurrentUser`; a chave nao foi exibida, exportada ou reutilizada do lote RBAC.
- O resumo sem dados pessoais e o contrato atualizado permanecem somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`. A verificacao confirmou ausencia de e-mail e documento bruto; sequencias longas aparecem apenas nos campos SHA-256.
- O script temporario de extracao foi removido apos a validacao. A instancia SQL foi encerrada e permanece `Stopped`/`Manual`, com TCP e Named Pipes desativados.
- Nenhum CSV nominal, ID bruto, dado pessoal, chave, hash individual, TPS, MDF/LDF ou relatorio local foi adicionado ao GitHub. A mudanca no repositorio e exclusivamente documental; testes de runtime foram dispensados e `git diff --check` e obrigatorio no fechamento.
- Proximo passo obrigatorio: mapear localmente as referencias legadas dos 18.458 candidatos contra as entidades existentes, iniciando por tabela de preco, condicao de pagamento, vendedor, regiao e transportadora; referencias ausentes ou ambiguas permanecem bloqueadas e nenhuma importacao pode ocorrer antes da homologacao.

### Gate 18 - Mapeamento estrito das referencias de clientes

- O mapeamento reutilizou exclusivamente `TabelaPreco`, `Colaborador`, `RegiaoAtendimento`, `Transportadora` e o campo textual `Cliente.condicao_comercial.condicao_pagamento` ja existentes.
- Foram comparados os 18.458 candidatos do staging. A politica permitiu apenas igualdade exata apos normalizacao de caixa, acentos e pontuacao; nenhuma aproximacao textual ou criacao automatica foi aplicada.
- Condicao de pagamento foi mantida separada de `FormaPagamento`: 26 codigos legados receberam texto valido no campo existente, cobrindo 2.217 clientes. Nenhum ID de forma de pagamento foi inferido.
- Permaneceram pendentes 47 codigos de referencia: sete tabelas de preco, 27 vendedores, nove regioes e quatro transportadoras.
- Entre as tabelas de preco, um dos sete codigos usados nao existe na tabela mestre legada. Nao houve correspondencia exata com a unica tabela atual dentro do Grupo canonico.
- Duas tabelas de preco atuais possuiam `group_id` diferente do Grupo canonico e foram excluidas da comparacao. Nenhum registro externo ao Grupo foi usado como destino.
- Entre os vendedores, seis dos 27 codigos usados nao foram encontrados na tabela mestre legada e nenhum dos demais coincidiu exatamente com os dois colaboradores atuais.
- As nove regioes possuem definicao legada, mas nenhuma coincide exatamente com a unica `RegiaoAtendimento` atual. As quatro transportadoras usadas possuem definicao legada, mas o ERP atual nao possui `Transportadora` cadastrada no snapshot.
- Foram geradas uma matriz resolvida com 26 linhas e uma fila pendente com 47 linhas. Ambas permanecem somente no HD, possuem ACL exclusiva do usuario local, hashes SHA-256 validados e `import_authorized=false` em todas as linhas.
- Os CSVs nominais originais de clientes permaneceram inalterados e conservaram seus hashes. A validacao encontrou zero chave de referencia repetida, zero decisao inconsistente e zero formula CSV insegura.
- O resumo de mapeamento nao contem nome, ID, e-mail, documento ou valor bruto. Nenhum cadastro, dado ou permissao foi gravado no ERP.
- As tentativas intermediarias que falharam na conversao de `DataRow` nao produziram resultado aceito. Os dois arquivos parciais foram removidos por caminho absoluto validado antes da geracao final.
- O script temporario foi removido. A instancia SQL permanece `Stopped`/`Manual`, com TCP e Named Pipes desativados.
- Regra confirmada para o lote futuro de materiais: em `CadastroMateriais`, somente registros classificados como `REVENDA` poderao seguir para staging e eventual homologacao. Os demais materiais serao apenas contabilizados e permanecerao fora da migracao.
- Nenhum CSV, matriz nominal, nome, ID bruto, dado pessoal, chave, TPS, MDF/LDF ou relatorio local foi adicionado ao GitHub. A mudanca no repositorio e exclusivamente documental; testes de runtime foram dispensados e `git diff --check` e obrigatorio no fechamento.
- Proximo passo obrigatorio: revisar localmente os 47 codigos pendentes contra os cadastros atuais, mantendo bloqueados os ausentes e os que exigiriam criar ou alterar cadastro sem homologacao; somente correspondencias exatas aprovadas poderao enriquecer o lote de clientes.

### Gate 18 - Revisao de codigos pendentes e campos importantes

- O proprietario autorizou criar campo importante ausente no ERP atual quando nao existir equivalente, incluindo codigo, e-mail, telefone e outros dados necessarios a operacao ou rastreabilidade.
- A autorizacao nao permite duplicacao indiscriminada: antes da criacao devem ser comprovadas a ausencia de equivalente, a necessidade do dado e a integracao no cadastro existente, com Grupo/Empresa, RBAC, validacao, sanitizacao e auditoria antes/depois.
- A revisao dos 47 codigos pendentes encontrou zero correspondencia exata adicional por codigo ou nome. Nenhuma referencia foi promovida e nenhuma aproximacao foi aplicada.
- `RegiaoAtendimento` ja possui `codigo_regiao`, mas nenhum dos nove codigos legados coincide exatamente com o unico codigo atual. Nao e necessario criar nova coluna para regiao.
- `Transportadora` ja possui politica de codigo mestre e campos de e-mail e telefone. O snapshot atual nao possui registro dessa entidade; nenhuma transportadora foi criada automaticamente.
- `Colaborador` e `Transportadora` ja possuem campos de e-mail e telefone. Esses dados devem reutilizar os campos existentes e nao justificam colunas duplicadas.
- Foram confirmadas duas lacunas relevantes: `TabelaPreco` nao possui campo para o codigo estavel da tabela legada, e `Colaborador` nao possui campo especifico para o codigo legado de vendedor.
- O contrato local propoe `TabelaPreco.codigo_tabela_legado` e `Colaborador.codigo_vendedor_legado`, ambos apenas para futura alteracao controlada no cadastro existente. Nenhum deles foi criado neste lote documental.
- Onze codigos de vendedor inativos ainda aparecem em 6.074 candidatos; outros seis codigos sem situacao cobrem 292 candidatos. Esses vinculos permanecem bloqueados.
- Duas transportadoras inativas aparecem em oito candidatos e tambem permanecem bloqueadas. As referencias ativas sem destino atual continuam pendentes, sem criar cadastro por inferencia.
- Foi gerado `legacy-client-reference-schema-gap-summary.json` somente no HD, sem nomes, IDs, documentos, e-mails ou dados brutos e com `importAuthorized=false`.
- Regra reforcada para o lote de materiais: `CadastroMateriais` sera filtrado exclusivamente pela classificacao `REVENDA`. O nome exato da coluna classificadora ainda deve ser comprovado no catalogo estrutural antes da leitura nominal; demais materiais serao apenas contabilizados e excluidos do staging.
- Nenhum dado ou funcionalidade do ERP foi alterado. Mudanca do repositorio exclusivamente documental; testes de runtime dispensados e `git diff --check` obrigatorio no fechamento.
- Proximo passo obrigatorio: implementar e testar os campos `codigo_tabela_legado` em `TabelaPreco` e `codigo_vendedor_legado` em `Colaborador`, somente nas estruturas existentes, com escopo de Grupo/Empresa, RBAC, sanitizacao, auditoria e preservacao de compatibilidade.

### Gate 18 - Codigos legados de tabela de preco e vendedor

- Foram incorporados aos cadastros existentes os campos `TabelaPreco.codigo_tabela_legado` e `Colaborador.codigo_vendedor_legado`; nenhuma entidade, tela, rota, importador ou modulo paralelo foi criado.
- Os dois formularios de tabela de preco e o formulario de colaborador exibem os campos com limite de 64 caracteres e formato restrito a letras, numeros, ponto, hifen, barra e sublinhado.
- A gravacao exige as permissoes granulares `Cadastros.Produtos.TabelaPreco.codigo_tabela_legado.editar` e `Cadastros.Pessoas.Colaborador.codigo_vendedor_legado.editar`. Importacao em lote contendo esses campos tambem exige `importar`; operacoes sem permissao falham fechadas no wrapper remoto e no cliente local.
- Codigos legados sao unicos por entidade dentro do Grupo, com comparacao sem diferenca entre maiusculas e minusculas. O mesmo codigo pode existir em outro Grupo sem colisao.
- Criacao, edicao e limpeza do codigo exigem `group_id` canonico. Empresa informada deve existir e pertencer ao Grupo; empresa externa e alteracao indevida do Grupo sao bloqueadas.
- `TabelaPreco` deixou de ser tratada como catalogo global no sanitizador backend e agora exige escopo multiempresa. `entityListSorted` passou a localizar tabela de preco e colaborador tambem pelos novos codigos.
- Auditoria local preserva antes/depois sanitizado. O wrapper remoto registra apenas o valor anterior e posterior do campo legado quando ele e alterado, evitando incluir o restante dos dados pessoais do colaborador nesse evento especifico.
- Nenhum dos 47 codigos pendentes foi automaticamente promovido, nenhum cadastro foi criado por inferencia e nenhuma linha nominal do backup foi gravada no ERP.
- Validacoes: `npm run audit:baseline` aprovado; `npm test` aprovado com 226/226 testes; teste focado aprovado com 13/13; `npm run typecheck` aprovado; `npm run build` aprovado fora do sandbox apos a primeira tentativa ser bloqueada por acesso ao `vite.config.js`; lint direcionado aos arquivos alterados aprovado; `git diff --check` aprovado.
- `npm run lint` global permanece reprovado por 86 erros e 18 avisos historicos em arquivos fora deste lote. Nenhum erro do lint direcionado pertence aos arquivos alterados; o baseline nao foi mascarado nem modificado.
- `TabelaPrecoFormCompleto.jsx`, `Layout.jsx` e `localBase44Client.js` continuam acima do limite recomendado de linhas. A alteracao foi mantida localizada para nao misturar uma refatoracao ampla com o contrato de migracao; a divisao segura permanece como divida tecnica registrada.
- A instancia `MSSQL$ERPZLEGACY` foi confirmada como `Stopped`/`Manual`. Nenhum CSV, nome, documento, e-mail, ID bruto, hash individual, TPS, MDF/LDF ou relatorio local foi adicionado ao GitHub.
- Proximo passo obrigatorio: gerar somente no HD uma proposta de homologacao para as referencias ativas entre os sete codigos de tabela de preco e os 27 codigos de vendedor; inativos, ausentes, ambiguos e empresas externas permanecem bloqueados. Somente decisoes exatas homologadas poderao enriquecer o staging de clientes.

### Gate 18 - Planilha de homologacao de tabelas de preco e vendedores

- Foi gerada somente no HD uma planilha controlada para revisar as 34 referencias pendentes de tabela de preco e vendedor, sem macro, conexao externa, botao ou mecanismo de importacao.
- A reconciliacao separou 16 referencias para decisao humana e manteve 18 bloqueadas. Todas as linhas preservam `import_authorized=false`.
- Das sete tabelas de preco, seis possuem cadastro mestre legado e aguardam confirmacao de situacao, escopo e destino; elas afetam 18.454 candidatos. Um codigo ausente no cadastro mestre, usado por tres candidatos, permanece bloqueado.
- Dos 27 vendedores, dez ativos aguardam homologacao e afetam 12.086 candidatos. Onze inativos, usados por 6.074 candidatos, e seis ausentes do cadastro mestre, usados por 292 candidatos, permanecem bloqueados.
- A aba de revisao aceita somente decisao controlada, escopo, empresa de destino quando aplicavel, ID de destino existente, justificativa e revisor. Nenhuma correspondencia e sugerida por similaridade.
- Uma vinculacao exige destino existente, justificativa e revisor. Um cadastro no fluxo existente exige escopo valido, empresa quando o registro for empresarial e justificativa/revisor. Linhas incompletas continuam pendentes.
- O XLSX possui tres abas, 16 formulas de validacao e duas listas de selecao nativas. A verificacao interna confirmou zero macro e zero vinculo externo; as tres abas foram renderizadas e revisadas visualmente.
- O arquivo final `legacy-client-table-seller-homologation.xlsx` foi salvo exclusivamente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`, com ACL restrita ao usuario local e SHA-256 verificado sem publicar o valor.
- O arquivo tecnico de inspecao criado durante a geracao foi removido para evitar duplicacao desnecessaria de conteudo privado.
- A instancia `MSSQL$ERPZLEGACY` permanece `Stopped`/`Manual`. Nenhuma consulta ao banco legado, gravacao no ERP ou alteracao de runtime foi realizada neste lote.
- Nenhum XLSX, CSV, nome, codigo individual, dado pessoal, ID bruto, hash detalhado, TPS, MDF/LDF ou relatorio local foi adicionado ao GitHub. A mudanca do repositorio e exclusivamente documental; testes de runtime foram dispensados e `git diff --check` e obrigatorio no fechamento.
- Proximo passo obrigatorio: o proprietario deve preencher a aba `Revisao`. Somente linhas cujo resultado calculado esteja pronto poderao compor um lote posterior; pendentes, rejeitadas, incompletas e todas as linhas da aba `Bloqueados` permanecem sem importacao.

### Gate 18 - Inventario estrutural agregado de fornecedores

- O lote reutilizou a entidade e o formulario `Fornecedor` existentes. Nenhum importador, entidade, tela, rota, componente ou fluxo paralelo foi criado.
- O catalogo de `LEGACY_TID_EXETPS.dbo.Fornecedores` possui 71 colunas. O contrato local classificou 13 para futuro staging controlado, 29 para mapeamento ou revisao de lacuna e 29 campos livres/historicos como bloqueados.
- CPF/tipo de pessoa, bairro, website, endereco de cobranca, dados bancarios, referencias contabeis e padroes de pedido de compra ficaram adiados. Campos importantes somente serao incorporados ao cadastro existente apos confirmar ausencia de equivalente, uso operacional, RBAC sensivel e escopo Grupo/Empresa.
- A consulta foi exclusivamente agregada e executada com o banco em `READ_ONLY`. Nenhuma linha nominal, documento, nome, endereco, e-mail ou dado bancario foi exportado.
- A tabela possui 1.061 fornecedores e 1.061 codigos legados distintos, sem codigo ou nome ausente. As distribuicoes por situacao, tipo de fornecedor e tipo de pessoa reconciliaram 100% das linhas.
- Todos os 1.061 registros estao marcados como ativos. Ha 816 fornecedores de despesas, 180 de custos e 65 classificados para ambos; 987 sao pessoas juridicas e 74 pessoas fisicas.
- Existem 109 e-mails preenchidos, dos quais cinco falharam na validacao basica de formato e deverao seguir para revisao antes de qualquer staging nominal.
- O documento esperado esta preenchido em todos os registros. Oitocentos e quarenta e nove possuem somente digitos e comprimento compativel; 212 possuem formato incompativel e permanecem bloqueados ate a validacao completa por digito verificador.
- Foram encontrados dez grupos de documento duplicado, envolvendo 25 linhas e 15 linhas adicionais a conciliar. Nenhum registro vencedor foi escolhido automaticamente.
- O contrato `legacy-supplier-extraction-contract.json` e o resumo `legacy-supplier-structural-summary.json` foram salvos somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`, com SHA-256 verificado e ACL exclusiva do usuario local.
- A verificacao confirmou zero valor de e-mail, CPF ou CNPJ formatado nos dois relatorios. Os helpers e o resultado tecnico temporario foram removidos do projeto antes do fechamento.
- A instancia `MSSQL$ERPZLEGACY` foi encerrada no bloco `finally` e permanece `Stopped`/`Manual`; TCP e Named Pipes continuam desativados conforme a configuracao isolada.
- Nenhum dado pessoal, CSV nominal, JSON local, hash detalhado, TPS, MDF/LDF ou relatorio foi adicionado ao GitHub. A mudanca do repositorio e exclusivamente documental; testes de runtime foram dispensados e `git diff --check` e obrigatorio no fechamento.
- Proximo passo obrigatorio: revisar no cadastro `Fornecedor` existente as lacunas de tipo de pessoa/CPF, bairro, website e endereco de cobranca; implementar somente os campos realmente necessarios com Grupo/Empresa, RBAC, sanitizacao e auditoria, antes de gerar staging nominal protegido e quarentena.

### Gate 18 - Campos essenciais e protecao do cadastro de fornecedores

- O cadastro `Fornecedor` existente foi ampliado, sem criar tela, entidade, rota, modulo ou importador paralelo. Foram incorporados tipo de pessoa, documento unificado CPF/CNPJ, bairro, website e endereco de cobranca.
- Os campos antigos `cpf` e `cnpj` foram preservados e continuam sincronizados com `cpf_cnpj`, mantendo compatibilidade com consultas e consumidores existentes.
- CPF e CNPJ passam por normalizacao para somente digitos, bloqueio de sequencias repetidas e validacao completa dos digitos verificadores conforme o tipo de pessoa. Website aceita somente URL completa com protocolo HTTP ou HTTPS e limite de tamanho.
- Criacao e edicao exigem `group_id` canonico. Alteracao indevida do Grupo e empresa proprietaria externa ao Grupo sao bloqueadas no cliente local e no sanitizador backend.
- A deduplicacao por documento permanece restrita ao Grupo, agora tambem cobre edicao sem colidir com o proprio registro. Nenhum registro e escolhido ou mesclado automaticamente.
- Os campos sensiveis exigem permissoes granulares nas secoes `Cadastros.Pessoas.Fornecedor.documento`, `Cadastros.Pessoas.Fornecedor.contato` e `Cadastros.Pessoas.Fornecedor.endereco_cobranca`. Lotes que contenham esses campos tambem exigem `importar`.
- A auditoria de criacao e edicao mascara documentos, contatos, enderecos e dados bancarios. O sanitizador backend aplica a mesma protecao ao antes/depois e o criptografador PII existente passou a atender `Fornecedor` com AES-GCM, sem criar servico paralelo.
- Busca e listagem passaram a reconhecer `codigo`, `cpf_cnpj`, `cpf` e `cnpj`; a exibicao identifica dinamicamente CPF ou CNPJ. Nenhum campo, aba, botao ou fluxo existente foi removido.
- `CadastroFornecedorCompleto.jsx` foi reduzido de 720 para 500 linhas pela extracao das secoes de dados gerais e contato/endereco para um componente auxiliar integrado ao mesmo formulario. A extracao foi necessaria pela regra de refatoracao de arquivos grandes e nao altera a interface publica.
- Nenhuma linha nominal do backup, documento, nome, endereco, e-mail, dado bancario, MDF/LDF, TPS, CSV ou relatorio local foi adicionada ao GitHub ou importada no ERP.
- Validacoes: teste focado aprovado com 17/17; suite completa aprovada com 230/230 apos o ajuste final do criptografador; lint direcionado aprovado; sintaxe dos dois hooks TypeScript alterados aprovada; `npm run audit:baseline` aprovado; `npm run build` aprovado; `git diff --check` aprovado.
- `npm run typecheck` global permanece reprovado pelo baseline historico de tipagem JS/TS distribuido em muitos modulos fora deste lote. A falha nao foi mascarada nem convertida em sucesso; os arquivos runtime do lote foram cobertos por lint, testes, transpilacao sintatica dos hooks e build de producao.
- A instancia `MSSQL$ERPZLEGACY` foi confirmada como `Stopped`/`Manual`. Este lote nao iniciou o SQL Server nem acessou os dados nominais legados.
- Proximo passo obrigatorio: gerar somente no HD o staging nominal protegido dos 1.061 fornecedores e a quarentena correspondente, aplicando o contrato estrutural ja aprovado, validacao integral de CPF/CNPJ, deduplicacao no Grupo e conciliacao das referencias; nenhuma importacao sera executada sem homologacao.

### Gate 18 - Staging nominal protegido de fornecedores

- O lote nominal dos 1.061 fornecedores foi gerado exclusivamente no HD a partir de `LEGACY_TID_EXETPS.dbo.Fornecedores`, com o banco confirmado em `READ_ONLY`. Nenhum registro foi importado no ERP.
- Foram separados 790 candidatos e 271 registros em quarentena, reconciliando 1.061/1.061 linhas sem descarte.
- A validacao completa encontrou 213 ocorrencias de CNPJ invalido e 15 de CPF invalido. Os totais sao superiores a verificacao estrutural anterior porque agora incluem digitos verificadores, e nao apenas formato e comprimento.
- Os dez grupos de documento duplicado permaneceram confirmados, envolvendo 25 linhas. Todas as linhas desses grupos foram mantidas em quarentena; nenhum registro vencedor foi escolhido automaticamente.
- Tambem foram identificados cinco e-mails invalidos e 42 websites sem URL HTTP/HTTPS valida. Os valores rejeitados nao foram promovidos aos candidatos e foram preservados somente na quarentena, em colunas explicitas de revisao.
- Os motivos podem se sobrepor dentro das 271 linhas de quarentena. Cada linha possui ao menos um motivo, e nenhum dos 790 candidatos possui motivo de quarentena ou documento duplicado.
- Todos os registros receberam o unico `group_id` canonico do Grupo, `scope_type=grupo` e empresa vazia. A validacao encontrou zero empresa externa, zero escopo divergente e zero linha com `import_authorized` diferente de `false`.
- O codigo legado foi preservado como `codigo`, `codigo_legado` e `codigo_origem`. A identidade idempotente usa HMAC-SHA256 com chave propria protegida por DPAPI `CurrentUser`; a chave nao foi exibida nem adicionada ao repositorio.
- Os CSVs foram gravados somente em `03_EXPORT_STAGING\FORNECEDORES\FORNECEDORES-LEGACY-TID-001` e `05_QUARANTINE\FORNECEDORES\FORNECEDORES-LEGACY-TID-001`, com ACL sem heranca e exclusiva do usuario local.
- A repeticao integral produziu os mesmos hashes para candidatos e quarentena antes da preservacao adicional dos campos privados de revisao, comprovando idempotencia. O hash final da quarentena foi recalculado no resumo e validado apos essa preservacao.
- A validacao final confirmou hashes correspondentes, zero formula CSV insegura, zero candidato duplicado, zero candidato com motivo, zero quarentena sem motivo, cinco valores privados para cinco e-mails invalidos e 42 valores privados para 42 websites invalidos.
- O resumo agregado `legacy-supplier-nominal-staging-summary.json` permanece somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`, sem nome, documento formatado, endereco ou e-mail.
- Os scripts e o log tecnico temporarios foram removidos. A instancia `MSSQL$ERPZLEGACY` permanece `Stopped`/`Manual`; TCP e Named Pipes permanecem desativados.
- Nenhum CSV, dado pessoal, codigo individual, hash individual, chave, TPS, MDF/LDF ou relatorio local foi adicionado ao GitHub. A alteracao do repositorio e exclusivamente documental; testes de runtime sao dispensados e `git diff --check` e obrigatorio no fechamento.
- Proximo passo obrigatorio: revisar localmente as 271 linhas em quarentena e inventariar as referencias adiadas de fornecedores, mantendo bloqueados documentos invalidos, duplicidades e destinos ausentes ou ambiguos; nenhuma importacao pode ocorrer antes da homologacao.

### Gate 18 - Revisao da quarentena e referencias de fornecedores

- Foi criada somente no HD uma fila derivada para revisar as 271 linhas em quarentena. O CSV original permaneceu preservado e nenhuma decisao foi aplicada automaticamente.
- Cada linha da fila possui `required_action`, status pendente, decisao, revisor, data e justificativa vazios e `import_authorized=false`. Os 271 fingerprints sao unicos e reconciliam integralmente a quarentena.
- As acoes pendentes totalizam 228 validacoes de documento na fonte, 25 conciliacoes de duplicidade no Grupo, cinco correcoes ou descartes controlados de e-mail e 42 confirmacoes de URL HTTP/HTTPS. As acoes podem se sobrepor na mesma linha.
- Zeros sentinela do banco legado foram tratados como ausencia em codigos de cliente correspondente, historico, transportadora, usuario e banco. Eles nao foram promovidos como referencias reais.
- Depois da remocao dos sentinelas, restaram duas decisoes de referencia: um codigo de cliente correspondente usado por um fornecedor e a traducao fiscal de `SIMPLESFEDERAL`, com um unico valor legado usado pelos 1.061 fornecedores.
- O cliente correspondente possui exatamente uma origem no staging protegido de clientes. O vinculo permanece com status `legacy_source_found_waiting_client_import`, sem `target_id`, porque nenhum cliente foi importado ou homologado no ERP.
- A traducao de `SIMPLESFEDERAL` permanece `pending_fiscal_homologation`. Nenhum valor fiscal foi aplicado ao cadastro atual.
- Historico contabil, codigo de sistema antigo, transportadora padrao, condicao de pagamento de compra, contas contabeis, finalidade, frete e usuario de lancamento nao possuem valor legado efetivo neste lote apos remover sentinelas.
- Dados sensiveis foram apenas contabilizados: 43 fornecedores possuem codigo de banco nao nulo, 38 possuem agencia, 38 possuem conta corrente, 15 possuem RG e um possui caixa postal/CEP. Nenhum desses valores foi exportado para a matriz de referencias.
- Certificado de pedido de compra nao possui valor preenchido. Os sete campos sensiveis inventariados permanecem com status `blocked_sensitive_rbac` ate existir contrato, permissao e homologacao especificos.
- Os arquivos `fornecedores-revisao-quarentena.csv` e `fornecedores-referencias-pendentes.csv` permanecem somente em `05_QUARANTINE\FORNECEDORES\FORNECEDORES-LEGACY-TID-001`, com ACL exclusiva, hashes validados e zero linha autorizada.
- O resumo `legacy-supplier-review-and-reference-summary.json` permanece somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`, sem nomes, e-mails, documentos ou valores bancarios.
- A verificacao final confirmou zero formula CSV insegura, hashes correspondentes, ACLs protegidas, zero `target_id` atribuido, zero dado sensivel na matriz e zero importacao.
- Scripts e log tecnico temporarios foram removidos. A instancia `MSSQL$ERPZLEGACY` permanece `Stopped`/`Manual`, com TCP e Named Pipes desativados.
- Nenhum CSV, valor individual, dado pessoal, codigo de referencia, hash individual, chave, TPS, MDF/LDF ou relatorio local foi adicionado ao GitHub. A alteracao do repositorio e exclusivamente documental; testes de runtime sao dispensados e `git diff --check` e obrigatorio no fechamento.
- Proximo passo obrigatorio: revisar no cadastro `Fornecedor` existente os campos `simples_nacional`, RG e `dados_bancarios`; implementar somente lacunas operacionais confirmadas com RBAC por campo, criptografia, escopo Grupo/Empresa e auditoria protegida antes de qualquer homologacao sensivel.

### Gate 18 - Campos fiscais e bancarios protegidos de fornecedores

- O formulario e a entidade `Fornecedor` existentes foram ampliados com `rg`, `simples_nacional` e `dados_bancarios`, sem criar tela, rota, entidade, importador ou modulo paralelo.
- RG aparece somente para pessoa fisica, aceita formato restrito e limite de 30 caracteres. O indicador do Simples Nacional e booleano e a traducao aceita somente valores explicitos. Dados bancarios usam allowlist de banco, agencia, conta e tipo de conta; quando preenchidos, banco e conta sao obrigatorios e o tipo fica limitado a corrente, poupanca ou pagamento.
- As gravacoes exigem permissoes independentes `Cadastros.Pessoas.Fornecedor.rg.editar`, `Cadastros.Pessoas.Fornecedor.simples_nacional.editar` e `Cadastros.Pessoas.Fornecedor.dados_bancarios.editar` nos wrappers remoto e local. Campos sem permissao nao seguem no payload.
- O escopo de Grupo/Empresa e a deduplicacao por documento continuam centralizados nas politicas existentes. Empresa externa ao Grupo e mudanca indevida do Grupo permanecem bloqueadas.
- RG foi incorporado ao conjunto PII criptografado de fornecedor. Dados bancarios continuam atendidos pelo criptografador AES-GCM existente; envelopes criptografados nao sao expostos nem convertidos em texto pelo formulario durante edicoes posteriores.
- Auditorias frontend e backend mascaram RG e o objeto bancario, incluindo banco, agencia, conta e PIX. O log backend agora carimba tambem `group_id` como campo proprio, alem de `empresa_id`, sem registrar valores sensiveis.
- `CadastroFornecedorCompleto.jsx` permaneceu dentro do limite de refatoracao, com a nova secao fiscal/financeira incorporada ao helper `FornecedorFormSections.jsx` ja existente e sem adicionar aba.
- Nenhum dos 43 codigos de banco, 38 pares agencia/conta, 15 RGs ou valor fiscal legado foi importado, exibido, colocado no status ou adicionado ao GitHub.
- Validacoes: teste focado aprovado com 19/19; suite completa aprovada com 232/232; lint direcionado aprovado; sintaxe TypeScript dos hooks alterados aprovada; `npm run build` aprovado; `npm run audit:baseline` aprovado; `git diff --check` aprovado.
- O build manteve apenas os avisos historicos de tamanho de chunk e imports estatico/dinamico. A auditoria baseline manteve dividas tecnicas globais ja conhecidas, sem falha e sem mascarar o resultado.
- Este lote nao iniciou nem consultou o SQL Server legado. Nenhum CSV, valor individual, dado pessoal, hash, TPS, MDF/LDF, planilha ou relatorio local integra o diff.
- Proximo passo obrigatorio: preparar somente no HD um contrato de homologacao sensivel para os 43 codigos de banco, 38 agencias/contas, 15 RGs e a traducao de `SIMPLESFEDERAL`; manter `import_authorized=false` e nao extrair valores nominais antes de confirmar mapeamentos, destino e permissoes.

### Gate 18 - Contrato de homologacao sensivel de fornecedores

- Foi preparado somente no HD o contrato `SUPPLIERS-SENSITIVE-HOMOLOGATION-001` para os campos sensiveis adiados de `Fornecedor`; nenhum importador, entidade, tela, rota ou funcionalidade paralela foi criado.
- O contrato cobre quatro decisoes: referencia bancaria, agencia/conta, RG e traducao de `SIMPLESFEDERAL` para `simples_nacional`. Ele registra somente estrutura, contagens, permissao necessaria, regra de decisao e gates de liberacao.
- Permanecem contabilizados 43 fornecedores com codigo bancario, seis codigos distintos, 38 com agencia/conta, 15 com RG e um unico valor fiscal legado usado nas 1.061 linhas. Nenhum desses valores foi extraido para o contrato ou para a matriz.
- A matriz possui quatro linhas agregadas, todas com `PENDING_HUMAN_HOMOLOGATION`, `values_extracted=false` e `import_authorized=false`. Revisor, data, justificativa e decisao permanecem vazios.
- A liberacao futura exige Banco existente e autorizado no mesmo Grupo, confirmacao de titularidade e tipo de conta, RG vinculado a pessoa fisica, traducao fiscal formal do valor legado, permissoes granulares, criptografia AES-GCM, auditoria protegida e idempotencia por Grupo/codigo legado.
- O contrato e o resumo foram gravados em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`; a matriz foi gravada em `05_QUARANTINE\FORNECEDORES\FORNECEDORES-LEGACY-TID-001`. Os tres arquivos possuem ACL sem heranca e exclusiva de `DELL-VINI\cpaba`.
- Validacoes locais: quatro de quatro linhas pendentes e nao autorizadas; zero valor extraido; zero formula CSV; zero padrao de e-mail, CPF ou CNPJ; hashes do contrato e da matriz recalculados e correspondentes ao resumo local.
- A instancia `MSSQL$ERPZLEGACY` foi confirmada como `Stopped`/`Manual`. O lote nao iniciou o SQL Server, nao consultou registros nominais e nao realizou gravacao no ERP.
- O gerador tecnico temporario foi removido antes do fechamento. Nenhum CSV, JSON local, hash, dado pessoal, valor bancario, RG, valor fiscal, TPS, MDF/LDF ou relatorio do HD integra o GitHub; a mudanca do repositorio e exclusivamente documental.
- Validacao do repositorio: `git diff --check` aprovado; testes de runtime dispensados porque nenhum codigo de aplicacao permaneceu alterado neste lote.
- Proximo passo obrigatorio: homologar a traducao fiscal de `SIMPLESFEDERAL` e mapear os seis codigos bancarios para cadastros `Banco` validos no Grupo. Sem essas decisoes humanas, os dados nominais e todas as importacoes permanecem bloqueados.

### Gate 18 - Proposta de mapeamento bancario e fiscal de fornecedores

- Foi gerada somente no HD uma proposta controlada com os seis codigos bancarios usados por fornecedores e o unico valor legado de `SIMPLESFEDERAL`. Nenhum destino ou traducao foi escolhido automaticamente.
- Os seis codigos bancarios possuem correspondencia exata em `LEGACY_TID_EXETPS.dbo.Bancos`; os nomes cadastrais foram obtidos por `NOMEFANTASIA`, com fallback para `RAZAOSOCIAL`. As seis referencias reconciliam exatamente 43 usos em fornecedores.
- A referencia fiscal possui um unico valor distinto e reconcilia as 1.061 linhas. O valor permanece sem conversao para booleano ate homologacao fiscal formal.
- A proposta possui sete linhas: seis bancarias e uma fiscal. Todas permanecem com `PENDING_HUMAN_HOMOLOGATION`, destino/valor normalizado/decisao/revisor/justificativa vazios e `import_authorized=false`.
- Agencia, conta corrente e RG nao foram extraidos neste lote. Nenhum dado pessoal ou bancario nominal de fornecedor foi lido para a proposta.
- O arquivo `fornecedores-mapeamento-bancos-fiscal.csv` permanece em `D:\BACKUP ERP ANTIGO - CODEX\05_QUARANTINE\FORNECEDORES\FORNECEDORES-LEGACY-TID-001`; o resumo agregado permanece em `04_REPORTS`. Ambos possuem ACL exclusiva de `DELL-VINI\cpaba`.
- Validacoes: sete de sete linhas pendentes; zero autorizada; seis de seis referencias com cadastro mestre e descricao resolvida; totais de uso 43/43 e 1.061/1.061; zero destino atribuido; zero traducao fiscal atribuida; zero formula CSV; hash recalculado e correspondente ao resumo local.
- A consulta ocorreu na instancia isolada e no banco `READ_ONLY`; `MSSQL$ERPZLEGACY` foi encerrado no bloco `finally` e confirmado como `Stopped`/`Manual` ao final de todas as tentativas.
- Os scripts, saidas tecnicas e arquivos brutos temporarios foram removidos. Nenhum CSV, JSON local, codigo ou nome bancario, valor fiscal, hash, dado pessoal, TPS, MDF/LDF ou relatorio do HD integra o GitHub; a mudanca do repositorio e exclusivamente documental.
- Validacao do repositorio: `git diff --check` aprovado; testes de runtime dispensados porque nenhum codigo de aplicacao permaneceu alterado neste lote.
- Proximo passo obrigatorio: um revisor autorizado deve preencher os seis `target_banco_id` com cadastros `Banco` existentes no Grupo e definir o booleano de `SIMPLESFEDERAL` com justificativa fiscal. Ate isso ocorrer, agencia, conta, RG, staging nominal e importacao permanecem bloqueados.

### Gate 18 - Evidencia tecnica da traducao fiscal de fornecedores

- A coluna legada `SIMPLESFEDERAL` foi consultada somente por metadado e agregacao no banco `LEGACY_TID_EXETPS`, confirmado em `READ_ONLY`; nenhum fornecedor nominal foi exibido ou alterado.
- A origem e `tinyint`, permite nulo e possui um unico valor efetivo: `0` nas 1.061/1.061 linhas. Essa evidencia sustenta a proposta tecnica `simples_nacional=false`, mas nao substitui a homologacao fiscal humana.
- A linha fiscal da proposta protegida no HD foi atualizada para `PROPOSED_AWAITING_FISCAL_HOMOLOGATION`, com valor normalizado `false`, justificativa tecnica e `import_authorized=false`. Nenhum dado foi importado no ERP.
- As seis referencias bancarias continuam sem `target_banco_id`. O ERP local abriu em `http://localhost:5174/cadastros`, mas o usuario atual recebeu `Permissao negada`; o RBAC foi respeitado e nao houve tentativa de contorno, consulta direta ao armazenamento do navegador ou atribuicao inventada.
- A matriz local permanece com sete linhas, sete nao autorizadas, zero banco vinculado e uma proposta fiscal. O SHA-256 recalculado corresponde ao resumo agregado local.
- O arquivo protegido e o resumo permanecem somente em `D:\BACKUP ERP ANTIGO - CODEX`; nenhum codigo/nome bancario, dado pessoal, valor nominal, CSV, JSON, hash, TPS, MDF/LDF ou relatorio local foi adicionado ao GitHub.
- A instancia `MSSQL$ERPZLEGACY` foi encerrada e confirmada como `Stopped`/`Manual`. A consulta final usou memoria compartilhada local; TCP, SQL Browser e os canais externos permaneceram desativados.
- A alteracao do repositorio e exclusivamente documental. Testes de runtime sao dispensados; `git diff --check` e a verificacao obrigatoria deste fechamento.
- Pendencia `BLOCKED`: a traducao fiscal exige aceite de revisor fiscal, e o mapeamento bancario exige usuario autorizado a visualizar os cadastros `Banco` do Grupo. Ate as duas homologacoes, agencia, conta, RG, staging nominal e importacao permanecem bloqueados.
- Proximo passo recomendado: obter os dois aceites humanos no fluxo existente e, somente depois, executar um piloto pequeno e reversivel de fornecedores com RBAC, escopo Grupo, auditoria e reconciliacao integral.

### Gate 18 - Contrato estrutural de produtos de revenda

- A ordem de migracao avancou para produtos sem atravessar o bloqueio humano de fornecedores. Foram reutilizados o cadastro mestre `Produto`, `ImportadorProdutosPlanilha`, `ImportarProdutosLote` e a politica de migracao existentes; nenhuma tela, entidade, rota ou importador paralelo foi criado.
- `LEGACY_TID_EXETPS.dbo.CadastroMateriais` foi confirmado com 2.360 linhas e 174 colunas no banco `READ_ONLY`. A coluna classificadora comprovada e `TIPOMATERIAL`, portanto a selecao futura sera estritamente `UPPER(TRIM(TIPOMATERIAL)) = REVENDA`, sem inferencia por descricao.
- A distribuicao agregada reconciliou 2.360/2.360: 1.137 `CONSUMO`, uma `PRODUCAO` e 1.222 `REVENDA`. Os 1.138 registros que nao sao revenda ficam fora do staging e de qualquer importacao.
- Entre os 1.222 registros de revenda, 1.198 estao ativos e 24 inativos. Todos possuem codigo, descricao e unidade; foram encontrados zero codigo ausente e zero grupo/linha com codigo duplicado. Os inativos permanecem elegiveis ao staging apenas para preservacao fiel do status, sem ativacao automatica.
- O contrato local classificou 19 colunas como `ALLOW_STRUCTURAL`, 55 como revisao de mapeamento ou lote posterior e 100 como bloqueadas. As 174 linhas mantem `import_authorized=false`.
- Campos livres, narrativos, historicos e com sufixo `_VELHO` foram bloqueados. Precos, custos, margens, descontos e comissoes ficaram para lote posterior homologado; referencias fiscais ou cadastrais sem destino exato ficaram em revisao.
- Os campos estruturais permitidos possuem destino existente confirmado, incluindo codigo/codigo legado, descricao, unidade, pesos, tipo de aco, bitola, situacao e a regra `tipo_item=Revenda`. Todo valor ainda dependera de sanitizacao, escopo Grupo/Empresa, RBAC, auditoria e quarentena no staging nominal.
- O contrato `legacy-product-structure-contract.csv` e o resumo `legacy-product-structure-summary.json` foram gravados somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`, com ACL exclusiva do usuario local. O hash do contrato foi recalculado e validado.
- Nenhum codigo ou descricao individual, preco, custo, dado fiscal nominal, CSV/JSON local, hash, TPS, MDF/LDF ou relatorio do HD foi adicionado ao GitHub. Nenhum registro foi criado ou atualizado no ERP.
- A instancia `MSSQL$ERPZLEGACY` foi encerrada e confirmada como `Stopped`/`Manual`; SQL Agent permaneceu `Stopped`/`Manual` e SQL Browser `Stopped`/`Disabled`.
- A alteracao do repositorio e exclusivamente documental. Testes de runtime sao dispensados; `git diff --check` e a validacao obrigatoria deste fechamento.
- Proximo passo obrigatorio: gerar somente no HD o staging nominal protegido dos 1.222 produtos `REVENDA`, preservando os 24 inativos, validar codigo/descricao/unidade e colocar referencias, campos fiscais duvidosos e qualquer inconsistencia em quarentena, sempre com `import_authorized=false`.

### Gate 18 - Staging nominal protegido de produtos de revenda

- O staging nominal foi gerado exclusivamente no HD para as 1.222 linhas cuja classificacao e exatamente `TIPOMATERIAL=REVENDA`. Os 1.137 materiais de consumo e o unico material de producao permaneceram fora do lote.
- Antes da extracao, o contrato estrutural foi corrigido de 19 para 14 campos permitidos. Cinco destinos inicialmente supostos nao existem de forma comprovada no cadastro `Produto` atual: prazo de garantia, descricao separada do site, titulo SEO, marca SEO e MPN; eles retornaram para `REVIEW_MAPPING`, sem criacao automatica de campos.
- O contrato local final possui 14 colunas `ALLOW_STRUCTURAL`, 60 em revisao e 100 bloqueadas, totalizando 174/174 com `import_authorized=false`. Foram reutilizados somente campos existentes de `Produto` e a politica de migracao atual.
- Foram produzidos 1.208 candidatos e 14 registros em quarentena, reconciliando 1.222/1.222 sem descarte. Os 1.198 ativos e 24 inativos foram preservados; nenhum inativo foi ativado automaticamente.
- As unidades `UN`, `PC`, `KG`, `CX` e `MT` foram mantidas; `M²` foi normalizada para `M2` e `LTS` para `LT`, conforme os codigos ja aceitos pelo importador existente. As 14 linhas com `BD`, `GRS`, `PAR`, `RL` ou `SER` ficaram em quarentena por falta de mapeamento homologado.
- Todos os candidatos possuem codigo legado, descricao, unidade valida, `tipo_item=Revenda`, contexto do unico Grupo canonico, `scope_type=grupo`, empresa vazia e compartilhamento de Grupo. Estoque atual, reservado e disponivel foram fixados em zero porque o estoque inicial pertence a lote posterior independente.
- O lote apresentou zero codigo duplicado, zero fingerprint duplicado, zero candidato invalido, zero quarentena sem motivo e zero celula com risco de formula CSV. Todas as 1.222 linhas mantem `import_authorized=false`, `confirmado=false` e `importacao_erp=false`.
- A geracao foi repetida integralmente e produziu os mesmos hashes para candidatos e quarentena, comprovando idempotencia. Os hashes gravados no resumo agregado correspondem aos arquivos finais.
- `produtos-revenda-candidatos.csv` permanece em `03_EXPORT_STAGING\PRODUTOS\PRODUTOS-LEGACY-TID-001`; `produtos-revenda-quarentena.csv` permanece em `05_QUARANTINE\PRODUTOS\PRODUTOS-LEGACY-TID-001`; contrato e resumo permanecem em `04_REPORTS`. Todos estao somente em `D:\BACKUP ERP ANTIGO - CODEX`, com ACL exclusiva do usuario local.
- Nenhum produto foi criado ou atualizado no ERP. Nenhum codigo, descricao, CSV/JSON local, fingerprint, hash, TPS, MDF/LDF ou relatorio do HD foi adicionado ao GitHub.
- A instancia `MSSQL$ERPZLEGACY` foi encerrada e confirmada como `Stopped`/`Manual`; SQL Agent permaneceu `Stopped`/`Manual` e SQL Browser `Stopped`/`Disabled`.
- A alteracao do repositorio e exclusivamente documental. Testes de runtime sao dispensados; `git diff --check` e a validacao obrigatoria deste fechamento.
- Proximo passo obrigatorio: preparar uma fila local de homologacao para as cinco unidades sem destino (`BD`, `GRS`, `PAR`, `RL`, `SER`) e inventariar de forma agregada as referencias/fiscais adiadas dos 1.208 candidatos, sem importar ou criar cadastros automaticamente.

### Gate 18 - Filas de homologacao e campos adiados de produtos

- Foi criada somente no HD uma fila de homologacao para as cinco unidades sem destino comprovado. As cinco linhas cobrem exatamente os 14 produtos em quarentena e possuem apenas sigla de origem, quantidade e descricao sugerida; `target_unidade_id`, codigo de destino, decisao, revisor e justificativa permanecem vazios.
- As descricoes sugeridas para `BD`, `GRS`, `PAR`, `RL` e `SER` sao apenas apoio humano. Nenhuma unidade foi criada, convertida, selecionada por similaridade ou liberada automaticamente; as cinco linhas permanecem `PENDING_HUMAN_HOMOLOGATION` e `import_authorized=false`.
- Os 60 campos adiados do contrato foram inventariados somente por contagem sobre os 1.208 candidatos. O relatorio nao contem nenhum valor de produto: registra apenas nome/tipo da coluna, categoria, quantidade preenchida e cardinalidade.
- Dos 60 campos adiados, 44 possuem algum valor efetivo e 16 estao vazios. A classificacao agregada ficou em oito campos comerciais para lote posterior, nove de e-commerce, 17 fiscais, 15 funcionais e 11 referencias cadastrais.
- Entre os campos com uso efetivo, oito sao comerciais, zero de e-commerce, 14 fiscais, 13 funcionais e nove referencias. Os campos vazios nao justificam criacao ou alteracao no ERP e permanecem sem destino.
- As duas matrizes totalizam 65 linhas, todas sem destino atribuido e com `import_authorized=false`. Nenhum valor nominal foi extraido para os relatorios, nenhum produto foi importado e nenhum cadastro foi criado.
- A geracao foi repetida e produziu os mesmos hashes nas filas de unidades e campos adiados. As ACLs foram confirmadas sem heranca e exclusivas do usuario local.
- `produtos-homologacao-unidades.csv` e `produtos-inventario-campos-adiados.csv` permanecem somente em `D:\BACKUP ERP ANTIGO - CODEX\05_QUARANTINE\PRODUTOS\PRODUTOS-LEGACY-TID-001`; o resumo agregado permanece em `04_REPORTS`.
- Nenhuma sigla individual alem das cinco ja registradas, valor fiscal/comercial, CSV/JSON local, cardinalidade por valor, hash, TPS, MDF/LDF ou relatorio do HD foi adicionado ao GitHub.
- A instancia `MSSQL$ERPZLEGACY` foi encerrada e confirmada como `Stopped`/`Manual`; SQL Agent permaneceu `Stopped`/`Manual` e SQL Browser `Stopped`/`Disabled`.
- A alteracao do repositorio e exclusivamente documental. Testes de runtime sao dispensados; `git diff --check` e a validacao obrigatoria deste fechamento.
- Pendencia `BLOCKED`: as cinco unidades exigem correspondencia exata em `UnidadeMedida` por usuario autorizado; os campos fiscais/comerciais com uso exigem homologacao propria antes de qualquer extracao de valores ou alteracao de schema.
- Proximo passo recomendado: revisar primeiro os nove campos de referencia com uso efetivo contra os cadastros mestres existentes, usando apenas correspondencia exata e mantendo ausentes/ambiguos bloqueados; precos, custos e fiscais continuam em lotes separados.

### Gate 18 - Reconciliacao de referencias mestres de produtos

- Os nove campos de referencia anteriormente apontados foram reavaliados nos 1.208 candidatos protegidos. `CODIGOCARACTERISTICA` e `CODIGOROTEIROPRODUCAO` continham somente sentinela zero nas 1.208 linhas e foram corrigidos para zero valor efetivo, restando sete campos reais para homologacao.
- Tres dos sete campos possuem mestre legado candidato confirmado. `CODIGOCLASSE` reconciliou integralmente 37/37 valores distintos e 1.208/1.208 usos em `dbo.ClasseMateriais`, sem ausencia ou ambiguidade.
- `CODIGOCF` reconciliou 139/140 valores distintos e 1.207/1.208 usos em `dbo.ClassificacaoFiscal`; a unica referencia ausente permanece bloqueada para revisao fiscal, sem substituicao inferida.
- `REFERENCIA` possui 443 valores distintos e 637 usos, mas nenhum correspondeu ao campo homonimo de `dbo.Referencias`. A relacao nao foi presumida e permanece bloqueada ate confirmacao funcional.
- Nao foi localizado mestre legado apropriado para `CODIGOMATERIALBELGO`, `CODIGOTIPO`, `SIGLACONVERTENDOUNIDADE` e `UNIDADEBELGO`. Esses quatro campos permanecem sem destino e sem extracao adicional.
- O unico destino funcional candidato no ERP atual e `GrupoProduto` para `CODIGOCLASSE`, reutilizando a estrutura existente. Nenhum `target_id` foi atribuido porque o usuario atual nao possui acesso ao cadastro e o RBAC nao foi contornado.
- A matriz local foi corrigida de 44 para 42 campos adiados com valor efetivo e de nove para sete referencias reais. A proposta agregada possui sete linhas, todas sem destino confirmado e com `import_authorized=false`.
- A geracao foi repetida e confirmou hash estavel, ACL sem heranca e exclusiva do usuario local, zero valor bruto exportado no relatorio agregado e zero importacao no ERP.
- `produtos-referencias-mestres-legado.csv` permanece somente em `D:\BACKUP ERP ANTIGO - CODEX\05_QUARANTINE\PRODUTOS\PRODUTOS-LEGACY-TID-001`; o resumo agregado permanece em `04_REPORTS`. Nenhum CSV, JSON local, codigo individual, valor fiscal, hash, TPS, MDF/LDF ou relatorio do HD integra o GitHub.
- A instancia `MSSQL$ERPZLEGACY` foi encerrada e confirmada como `Stopped`/`Manual`; SQL Agent permaneceu `Stopped`/`Manual` e SQL Browser `Stopped`/`Disabled`.
- A alteracao do repositorio e exclusivamente documental. Testes de runtime sao dispensados; `git diff --check` e a validacao obrigatoria deste fechamento.
- Proximo passo obrigatorio: preparar no HD a homologacao das 37 classes legadas contra `GrupoProduto` e isolar a unica classificacao fiscal ausente, sempre por correspondencia exata e com RBAC. As quatro referencias sem mestre e os 443 valores sem correspondencia permanecem bloqueados; nenhuma importacao esta autorizada.

### Gate 18 - Filas protegidas de classes e pendencia fiscal de produtos

- Foi preparada somente no HD a fila de homologacao das 37 classes legadas usadas pelos 1.208 produtos candidatos. A fila reutiliza o destino existente `GrupoProduto`; nenhuma entidade, tela, rota, campo ou importador paralelo foi criado.
- As 37 classes possuem correspondencia unica em `LEGACY_TID_EXETPS.dbo.ClasseMateriais`, sem classe ausente ou ambigua. As contagens de uso reconciliam exatamente 1.208/1.208 candidatos.
- Cada linha local preserva codigo, nome, tipo, setor e situacao legados para revisao, alem do contexto do unico Grupo canonico. Os campos de destino, decisao, revisor, data e justificativa permanecem vazios.
- O ERP atual possui `GrupoProduto` com codigo, nome, natureza e NCM padrao. O usuario atual, entretanto, nao possui permissao para consultar os registros do cadastro; o RBAC foi respeitado e nenhum `target_grupo_produto_id` foi atribuido ou inventado.
- A unica classificacao fiscal sem correspondencia no mestre legado foi isolada em fila propria, contendo somente a referencia local e a contagem de um produto afetado. Nenhum produto, descricao ou outro dado nominal foi associado ao relatorio agregado.
- As duas filas totalizam 38 linhas, todas com `import_authorized=false`. A validacao confirmou zero destino atribuido, zero classe ausente/ambigua, zero risco de formula CSV e zero importacao no ERP.
- A geracao foi repetida integralmente e produziu os mesmos hashes para as duas filas. Os hashes finais correspondem ao resumo local, e os arquivos possuem ACL sem heranca e exclusiva do usuario local.
- `produtos-homologacao-classes.csv` e `produtos-classificacao-fiscal-nao-conciliada.csv` permanecem somente em `D:\BACKUP ERP ANTIGO - CODEX\05_QUARANTINE\PRODUTOS\PRODUTOS-LEGACY-TID-001`; o resumo agregado permanece em `04_REPORTS`.
- Nenhum codigo ou nome de classe, referencia fiscal, `group_id`, CSV/JSON local, hash, TPS, MDF/LDF ou relatorio do HD integra o GitHub. A instancia `MSSQL$ERPZLEGACY` terminou `Stopped`/`Manual`, SQL Agent `Stopped`/`Manual` e SQL Browser `Stopped`/`Disabled`.
- A mudanca do repositorio e exclusivamente documental. Testes de runtime sao dispensados; `git diff --check` e a validacao obrigatoria deste fechamento.
- Pendencia `BLOCKED`: um usuario autorizado deve mapear cada classe para um `GrupoProduto` do mesmo Grupo e um responsavel fiscal deve decidir a unica classificacao ausente. Ate isso ocorrer, as 38 linhas e os produtos dependentes permanecem sem autorizacao de importacao.
- Proximo passo recomendado: enquanto essas decisoes humanas permanecem bloqueadas, revisar estruturalmente os 14 campos fiscais com uso efetivo nos produtos candidatos e confirmar destinos ja existentes, sem extrair valores nominais nem alterar schema automaticamente.

### Gate 18 - Revisao estrutural fiscal dos produtos de revenda

- Os 14 campos fiscais com preenchimento nos 1.208 produtos candidatos foram revisados somente por estrutura, quantidade e cardinalidade. Nenhum valor tributario foi extraido para a matriz ou para o resumo agregado.
- Dez campos possuem destino estrutural candidato ja existente. Aliquotas e CSTs encontram equivalentes em `Produto.tributacao` e em `TabelaFiscal`; `CSOSN` encontra candidato em `TabelaFiscal.icms_cst_csosn`, e a origem encontra candidatos em `Produto.origem_mercadoria` e `TabelaFiscal.origem_mercadoria`.
- A existencia desses campos nao autoriza o mapeamento automatico. `Produto` e cadastro mestre compartilhado, enquanto `TabelaFiscal` aplica regras por empresa, regime e cenario; o responsavel fiscal deve definir o escopo correto antes de qualquer extracao ou persistencia.
- Quatro campos nao possuem equivalente exato confirmado: codigo de lista de servicos, indicador booleano de substituicao tributaria e os dois controles de indicador de escala da NF-e. Nenhum campo novo foi criado por suposicao.
- Tres campos apresentam somente valor equivalente a zero nas 1.208 linhas: `CSOSN`, `ICMSSUBSTITUICAO` e `ORIGEMSITUACAOTRIB`. Eles nao foram descartados como sentinela, pois zero pode representar ausencia, falso ou origem nacional conforme a semantica fiscal.
- Os demais campos possuem combinacoes de zero e valores distintos. A matriz preserva apenas as contagens agregadas e marca traducao, regime e escopo como pendentes; valores e produtos afetados continuam fora do relatorio.
- `produtos-revisao-fiscal-estrutural.csv` possui 14 linhas, todas com `values_extracted=false`, `PENDING_FISCAL_HOMOLOGATION` e `import_authorized=false`. Nenhum destino fiscal foi aplicado ao staging.
- A geracao foi repetida e confirmou o mesmo hash, ACL sem heranca e exclusiva do usuario local, 14/14 linhas nao autorizadas, zero extracao e zero importacao.
- A matriz permanece somente em `D:\BACKUP ERP ANTIGO - CODEX\05_QUARANTINE\PRODUTOS\PRODUTOS-LEGACY-TID-001`; o resumo agregado permanece em `04_REPORTS`. Nenhum CSV/JSON local, valor fiscal, codigo individual, `group_id`, hash, TPS, MDF/LDF ou relatorio do HD integra o GitHub.
- A instancia `MSSQL$ERPZLEGACY` terminou `Stopped`/`Manual`, SQL Agent `Stopped`/`Manual` e SQL Browser `Stopped`/`Disabled`.
- A mudanca do repositorio e exclusivamente documental. Testes de runtime sao dispensados; `git diff --check` e a validacao obrigatoria deste fechamento.
- Pendencia `BLOCKED`: o responsavel fiscal deve decidir Produto versus TabelaFiscal, validar regime/empresa, traduzir codigos e definir o tratamento dos quatro campos sem destino. Nenhum dos 14 campos pode ser importado antes dessa homologacao.
- Proximo passo recomendado: enquanto a homologacao fiscal permanece bloqueada, revisar estruturalmente os oito campos comerciais com uso efetivo nos produtos candidatos, mantendo precos, custos, margens e comissoes sem valores e sem autorizacao.

### Gate 18 - Revisao estrutural comercial dos produtos de revenda

- Os oito campos comerciais adiados dos 1.208 produtos candidatos foram revisados somente por estrutura, quantidade e cardinalidade. Nenhum preco, custo, margem, desconto ou comissao foi extraido para a matriz ou para o resumo agregado.
- Tres campos possuem destino estrutural candidato ja existente: margem PMV pode corresponder a `Produto.margem_minima_percentual` ou `TabelaPrecoItem.margem_percentual`; desconto maximo pode corresponder a `TabelaPrecoItem.desconto_maximo_percentual`; margem contra tabela pode corresponder a `TabelaPrecoItem.margem_percentual`.
- Os destinos candidatos nao foram aceitos automaticamente porque a semantica, a tabela proprietaria, o escopo Grupo/Empresa e a regra de vigencia ainda precisam de homologacao comercial.
- Cinco campos nao possuem equivalente exato confirmado: politica de nao imprimir tabela, comissao por produto, percentual de preco maximo, preco em dolar e custo FOB. Nenhum campo novo foi criado por aproximacao.
- Seis campos apresentam somente zero nas 1.208 linhas. Eles foram mantidos na matriz, sem serem descartados, pois zero pode representar regra comercial valida ou apenas ausencia no legado.
- Somente dois campos possuem ocorrencias diferentes de zero: margem PMV em um produto e margem contra tabela em dez produtos. Os valores e os produtos afetados nao foram extraidos; apenas essas contagens agregadas foram conciliadas.
- A validacao encontrou zero valor negativo. A matriz `produtos-revisao-comercial-estrutural.csv` possui oito linhas, todas com `values_extracted=false`, permissao sensivel ainda nao confirmada, `PENDING_COMMERCIAL_HOMOLOGATION` e `import_authorized=false`.
- A geracao foi repetida e confirmou o mesmo hash, ACL sem heranca e exclusiva do usuario local, oito de oito linhas nao autorizadas, zero destino aplicado e zero importacao.
- A matriz permanece somente em `D:\BACKUP ERP ANTIGO - CODEX\05_QUARANTINE\PRODUTOS\PRODUTOS-LEGACY-TID-001`; o resumo agregado permanece em `04_REPORTS`. Nenhum CSV/JSON local, valor comercial, codigo individual, `group_id`, hash, TPS, MDF/LDF ou relatorio do HD integra o GitHub.
- A instancia `MSSQL$ERPZLEGACY` terminou `Stopped`/`Manual`, SQL Agent `Stopped`/`Manual` e SQL Browser `Stopped`/`Disabled`.
- A mudanca do repositorio e exclusivamente documental. Testes de runtime sao dispensados; `git diff --check` e a validacao obrigatoria deste fechamento.
- Pendencia `BLOCKED`: Comercial/Financeiro deve homologar o significado e o escopo dos tres destinos candidatos e decidir se os cinco campos sem equivalente possuem uso operacional. Nenhum dos oito campos pode ser importado antes dessa decisao e do RBAC especifico para custo, preco, margem, desconto e comissao.
- Proximo passo recomendado: enquanto as homologacoes fiscal e comercial permanecem bloqueadas, revisar estruturalmente os 13 campos funcionais com valor efetivo nos produtos candidatos, sem extrair valores ou criar campos automaticamente.

### Gate 18 - Revisao estrutural funcional dos produtos de revenda

- Os 13 campos funcionais adiados dos 1.208 produtos candidatos foram revisados somente por estrutura, quantidade e cardinalidade. Nenhum texto, peso, quantidade, indicador ou produto afetado foi extraido para a matriz ou para o resumo agregado.
- Tres campos possuem somente destino estrutural candidato: material importado pode traduzir para `Produto.origem_mercadoria`, peso de barra pode corresponder a `Produto.fatores_conversao.kg_por_peca`, e quantidade de metros pode corresponder a `Produto.fatores_conversao.metros_por_peca`.
- Os candidatos nao foram aceitos automaticamente. Origem exige traducao de enum; pesos e metros exigem confirmacao de unidade, embalagem e formula de conversao para evitar alterar estoque, venda, producao e expedicao.
- Dez campos nao possuem equivalente exato comprovado: descricao externa, material com defeito, ocultacao em consultas, produto controlado, dias de garantia, quantidade por embalagem, limite de lote, recebimento de pintura, tipo de calculo e trava de descricao de venda. Nenhum campo novo foi criado por similaridade.
- Dez dos 13 campos apresentam somente zero nas 1.208 linhas. Eles permanecem documentados e bloqueados, pois zero pode representar configuracao valida ou apenas ausencia no legado.
- Uso diferente de zero foi identificado apenas por contagem: descricao externa em um produto, peso de barra em 614 produtos e trava de descricao de venda em tres produtos. Nenhum desses valores ou produtos foi exposto.
- Peso de barra possui 388 valores nao zerados distintos e exige reconciliacao com peso liquido/bruto e fatores de conversao antes de qualquer aproveitamento. A validacao encontrou zero valor negativo.
- A matriz `produtos-revisao-funcional-estrutural.csv` possui 13 linhas, todas com `values_extracted=false`, permissao ainda nao confirmada, `PENDING_FUNCTIONAL_HOMOLOGATION` e `import_authorized=false`.
- A geracao foi repetida e confirmou o mesmo hash, ACL sem heranca e exclusiva do usuario local, 13/13 linhas nao autorizadas, zero destino aplicado e zero importacao.
- A matriz permanece somente em `D:\BACKUP ERP ANTIGO - CODEX\05_QUARANTINE\PRODUTOS\PRODUTOS-LEGACY-TID-001`; o resumo agregado permanece em `04_REPORTS`. Nenhum CSV/JSON local, texto, peso, quantidade, codigo individual, `group_id`, hash, TPS, MDF/LDF ou relatorio do HD integra o GitHub.
- A instancia `MSSQL$ERPZLEGACY` terminou `Stopped`/`Manual`, SQL Agent `Stopped`/`Manual` e SQL Browser `Stopped`/`Disabled`.
- A mudanca do repositorio e exclusivamente documental. Testes de runtime sao dispensados; `git diff --check` e a validacao obrigatoria deste fechamento.
- Pendencia `BLOCKED`: Operacao/Estoque deve homologar significado e unidade dos tres destinos candidatos e decidir se os dez campos sem equivalente possuem uso operacional. Nenhum campo funcional pode ser importado antes dessa decisao.
- Proximo passo recomendado: encerrar estruturalmente os campos adiados sem valor efetivo, incluindo os nove campos de e-commerce vazios, para impedir criacao desnecessaria de schema; depois avancar para o inventario agregado de estoque legado sem misturar quantidades ao cadastro mestre de produtos.

### Gate 18 - Encerramento dos campos de produto sem valor efetivo

- O inventario dos 60 campos adiados foi reavaliado depois da remocao logica das duas referencias compostas somente por sentinela zero. A contagem correta e 42 campos com valor efetivo e 18 sem valor, substituindo a contagem preliminar anterior de 44/16.
- Os 18 campos sem valor foram encerrados no inventario local como `CLOSED_NO_SOURCE_VALUE_NO_SCHEMA_CHANGE`, com decisao `DO_NOT_MIGRATE_NO_SOURCE_VALUE`, destino vazio e `import_authorized=false`.
- O fechamento cobre nove campos de e-commerce, tres fiscais, dois funcionais e quatro referencias. Nenhum campo, componente, entidade ou alteracao de schema foi criado para dados inexistentes.
- Os nove campos de e-commerce vazios incluem metadados de descricao/SEO e controles de imagens adicionais. O encerramento se refere apenas a migracao deste lote e nao remove nem desativa funcionalidades nativas existentes no ERP.
- As tres lacunas fiscais, duas funcionais e quatro referencias vazias tambem permanecem registradas para rastreabilidade, mas nao seguirao para staging nominal ou importacao sem nova fonte comprovada.
- O inventario original de 60 linhas foi preservado; somente status, decisao e justificativa dos 18 campos vazios foram atualizados. Nenhum valor de origem foi lido ou descartado.
- A validacao confirmou 18/18 linhas fechadas, zero destino atribuido, zero valor extraido e 18/18 com autorizacao falsa. A repeticao produziu o mesmo hash do inventario.
- `produtos-inventario-campos-adiados.csv` permanece somente em `D:\BACKUP ERP ANTIGO - CODEX\05_QUARANTINE\PRODUTOS\PRODUTOS-LEGACY-TID-001`; os resumos atualizados permanecem em `04_REPORTS`, todos com ACL sem heranca e exclusiva do usuario local.
- Nenhum CSV/JSON local, nome de produto, codigo individual, valor, `group_id`, hash, TPS, MDF/LDF ou relatorio do HD integra o GitHub. Nenhuma importacao ou alteracao no ERP foi realizada.
- A instancia `MSSQL$ERPZLEGACY` permaneceu `Stopped`/`Manual`, SQL Agent `Stopped`/`Manual` e SQL Browser `Stopped`/`Disabled`; este lote nao consultou o banco legado.
- A mudanca do repositorio e exclusivamente documental. Testes de runtime sao dispensados; `git diff --check` e a validacao obrigatoria deste fechamento.
- Proximo passo obrigatorio: iniciar o inventario estrutural e agregado do estoque legado em lote separado do cadastro mestre de produtos, identificando tabelas, empresas, saldos, reservas, locais e datas sem extrair movimentos ou quantidades nominais.

### Gate 18 - Inventario estrutural agregado do estoque legado

- Foram revisadas em modo `READ_ONLY` as seis fontes SQL preservadas `LEGACY_TID_EXETPS` e `LEGACY_TID_EMP01` a `LEGACY_TID_EMP05`, sem consultar valores de saldo, quantidade, custo, produto ou movimento.
- A busca estrutural encontrou 135 tabelas cujo nome sugere estoque, saldo, movimentacao, reserva, inventario, almoxarifado ou deposito. Vinte e duas possuem linhas estimadas; falsos positivos financeiros, como saldos de caixa/banco e depositos bancarios, foram identificados e nao classificados como estoque operacional.
- Setenta e nove estruturas possuem combinacao de nome e colunas compativel com operacao de estoque, mas somente 11 estao nao vazias. Essas 11 somam aproximadamente 562.604 linhas estimadas e permanecem apenas como candidatas, sem autorizacao de exportacao.
- `LEGACY_TID_EMP03` concentra 557.060 movimentos, 2.382 saldos de materiais e quatro transferencias. Como essa base ja foi classificada como compartilhada e as tres tabelas nao possuem coluna empresarial explicita, nenhuma linha pode ser atribuida automaticamente a CPA, 3Z ou CPA Ferro e Aco.
- `LEGACY_TID_EXETPS` possui 2.372 parametros de estoque de materiais, 421 movimentos e 184 saldos de materiais. A fonte e central multiempresa e essas tabelas tambem nao possuem contexto empresarial explicito.
- `LEGACY_TID_EMP01` possui 150 saldos e 12 movimentos; `LEGACY_TID_EMP02`, 17 saldos e um movimento; `LEGACY_TID_EMP04`, um saldo isolado; `LEGACY_TID_EMP05` nao possui tabela candidata nao vazia. Os nomes das bases continuam insuficientes para registros sem contexto ou para fontes previamente classificadas como compartilhadas/incertas.
- Nenhuma das 11 fontes operacionais nao vazias possui coluna empresarial ou de local de estoque identificavel. Cinco possuem coluna de data. Portanto, empresa proprietaria, local, precedencia entre saldo e movimento e data de corte permanecem obrigatoriamente pendentes.
- O relatorio `legacy-stock-structure-inventory.csv` contem somente metadados de banco/tabela, contagens estimadas e indicadores de presenca de colunas; todas as 135 linhas possuem `values_read=false` e `import_authorized=false`.
- A geracao foi repetida e confirmou o mesmo hash, ACL sem heranca e exclusiva do usuario local, seis de seis bases em somente leitura, zero valor consultado e zero importacao.
- O inventario e o resumo permanecem somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`. Nenhum CSV/JSON local, codigo de produto, saldo, quantidade, custo, movimento, empresa, hash, TPS, MDF/LDF ou relatorio do HD integra o GitHub.
- A instancia `MSSQL$ERPZLEGACY` terminou `Stopped`/`Manual`, SQL Agent `Stopped`/`Manual` e SQL Browser `Stopped`/`Disabled`.
- A mudanca do repositorio e exclusivamente documental. Testes de runtime sao dispensados; `git diff --check` e a validacao obrigatoria deste fechamento.
- Proximo passo obrigatorio: comparar os schemas de `EstoqueMateriais` e `MovimentacaoEstoque` entre as fontes, definir precedencia por empresa e periodo apenas por evidencias conciliaveis e manter `EMP03` bloqueado enquanto suas linhas nao puderem ser segmentadas com seguranca.

### Gate 18 - Comparacao de schemas e periodos do estoque legado

- Os schemas de `EstoqueMateriais` e `MovimentacaoEstoque` foram comparados nas seis bases preservadas em `READ_ONLY`. Foram inventariadas 210 definicoes de coluna em 12 fontes, sem leitura de codigo de produto, quantidade, custo, documento, lote ou texto historico.
- `EstoqueMateriais` possui o mesmo schema nas seis bases: chave de material, estoque principal e estoque em unidade paralela. As seis fontes possuem uma unica assinatura estrutural; cinco estao nao vazias.
- `MovimentacaoEstoque` tambem possui uma unica assinatura estrutural nas seis bases, com 32 colunas e chave primaria. Quatro fontes estao nao vazias.
- O movimento legado possui data, produto, quantidade, estoque anterior/atual, custo, documento e lote, mas nao possui `groupId`, `empresaId`, reserva ou local de estoque. O saldo mestre tambem nao possui empresa, local ou data de referencia.
- O periodo agregado de `LEGACY_TID_EMP03` cobre 557.060 movimentos entre `2012-03-06` e `2026-08-19`. Essa e a massa historica principal, mas continua bloqueada porque a base e compartilhada e nao permite separar diretamente CPA, 3Z e CPA Ferro e Aco.
- `LEGACY_TID_EXETPS` possui 421 movimentos entre `2012-01-26` e `2012-03-05`, terminando um dia antes do inicio do `EMP03`. A continuidade cronologica e apenas indicio de precedencia historica; nao comprova empresa nem autoriza concatenacao automatica.
- `LEGACY_TID_EMP01` possui 12 movimentos entre `2013-01-12` e `2024-03-08`; `LEGACY_TID_EMP02` possui um movimento em `2013-12-04`. Como esses periodos estao contidos no intervalo do `EMP03`, as fontes podem ser auxiliares ou duplicadas e exigem conciliacao por fingerprint antes de qualquer uso.
- `LEGACY_TID_EMP04` e `LEGACY_TID_EMP05` nao possuem movimentos. Os saldos existentes nao carregam data de corte, portanto nenhuma das cinco tabelas nao vazias foi declarada saldo inicial autoritativo.
- O ERP novo preserva saldo em `Produto.estoque_atual` e historico em `MovimentacaoEstoque`, com Grupo/Empresa, idempotencia e auditoria. Nenhum saldo legado foi aplicado ao produto e nenhum movimento foi recriado.
- Os relatorios `legacy-stock-schema-columns.csv`, `legacy-stock-source-comparison.csv`, `legacy-stock-movement-periods.csv` e o resumo permanecem somente em `D:\BACKUP ERP ANTIGO - CODEX\04_REPORTS`, com ACL exclusiva.
- A geracao foi repetida e confirmou hashes estaveis nos tres relatorios, 12/12 fontes nao autorizadas, seis bases em somente leitura e zero importacao.
- Nenhum CSV/JSON local, valor de estoque, codigo de produto, custo, documento, lote, hash, TPS, MDF/LDF ou relatorio do HD integra o GitHub. A instancia `MSSQL$ERPZLEGACY` terminou `Stopped`/`Manual`, SQL Agent `Stopped`/`Manual` e SQL Browser `Stopped`/`Disabled`.
- A mudanca do repositorio e exclusivamente documental. Testes de runtime sao dispensados; `git diff --check` e a validacao obrigatoria deste fechamento.
- Proximo passo obrigatorio: medir de forma agregada a sobreposicao dos movimentos entre `EMP01`, `EMP02`, `EMP03` e `EXETPS` e avaliar vinculo por documento com fontes que possuam empresa, usando fingerprints locais e sem exportar chaves, produtos, quantidades ou documentos.
