import assert from 'node:assert/strict';

const component = name => `src/components/${name}.jsx`;
export const primitiveUiEdits = {
  [component('auditoria/LogsAuditoria')]: [
    ['onCheckedChange={(checked) => setFiltroCritico(checked === true)}', 'onCheckedChange={setFiltroCritico}', 1],
    ['onCheckedChange={(checked) => setShowDescricao(checked === true)}', 'onCheckedChange={setShowDescricao}', 1],
    ['onCheckedChange={(checked) => setShowIP(checked === true)}', 'onCheckedChange={setShowIP}', 1],
  ],
  [component('expedicao/SeparacaoConferencia')]: ['quantidade','qualidade','embalagem','etiquetas','documentos'].map(field => [`conferiu_${field}: v === true`, `conferiu_${field}: v`, 1]),
  [component('expedicao/painel-logistico/ControlsBar')]: [["React.useState(/** @returns {boolean|'sim'} */ () => false)", 'React.useState(false)', 1]],
  'src/pages/Agenda.jsx': [
    ['!Number.isNaN(parsed.getTime())', '!isNaN(parsed)', 1],
    ...['dia_inteiro','lembrete','notificar_email','notificar_whatsapp'].map(field => [`${field}: checked === true`, `${field}: checked`, 1]),
  ],
  'src/pages/Relatorios.jsx': [['ativo: checked === true', 'ativo: checked', 1]],
  [component('chatbot/MonitorSLA')]: ['tfrMedio','trMedio'].map(field => [`Number(metricas.${field}) /`, `metricas.${field} /`, 1]),
  [component('comercial/MonitoramentoCanaisRealtime')]: [['agora.getTime() - ultimaAtualizacao.getTime()', 'agora.getTime() - ultimaAtualizacao', 1]],
  [component('estoque/ControleLotesValidade')]: [['dataValidade.getTime() - hoje.getTime()', 'dataValidade - hoje.getTime()', 1]],
  [component('expedicao/painel-logistico/AlertsPanel')]: ['prev','tsPronto','saida'].map(name => [`now.getTime() - ${name}.getTime()`, `now.getTime() - ${name}`, 1]),
  [component('expedicao/painel-logistico/BottlenecksPanel')]: [['now.getTime() - tsPronto.getTime()', 'now.getTime() - tsPronto', 1]],
  [component('producao/RelatoriosProducao')]: [
    ['Number(variacaoCusto) > 0', 'variacaoCusto > 0', 1],
    ['parseFloat(String(taxaRefugo))', 'parseFloat(taxaRefugo)', 1],
    ['parseFloat(String(variacaoCusto))', 'parseFloat(variacaoCusto)', 4],
  ],
  [component('portal/ChamadosCliente')]: [['!isNaN(Number(nota)) && Number(nota) >= 1 && Number(nota) <= 5', '!isNaN(nota) && nota >= 1 && nota <= 5', 1]],
  [component('chatbot/DashboardAtendente')]: [['parseFloat(String(metricas.tempoMedioResposta || 1))', 'parseFloat(metricas.tempoMedioResposta || 1)', 1]],
  [component('crm/FunilVendasAvancado')]: [['Number(metricas.taxaConversao) >= 20', 'metricas.taxaConversao >= 20', 2]],
  'src/pages/DashboardCorporativo.jsx': [['parseFloat(String(otd))', 'parseFloat(otd)', 1]],
  ...Object.fromEntries(['cadastros/DashboardCanaisOrigem','cadastros/HistoricoProduto'].map(name => [component(name), [["typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-'", 'value.toFixed(2)', 1]]])),
  [component('producao/DashboardRefugoIA')]: [["typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '-'", 'value.toFixed(1)', 2]],
};

// #348 intentionally evolves Relatorios. Invert only these exact reviewed hunks
// before checking the ORIGINAL stage44 hash. All other executable code stays frozen;
// new report behavior is exercised end-to-end in secure-report-behavior.test.js.
export const reportRecoveryEdits = [
  [
    "const DashboardInadimplencia = React.lazy(() => import(\"@/components/relatorios/DashboardInadimplencia\"));\nconst RelatorioVendasPorRegiao = React.lazy(() => import(\"@/components/relatorios/RelatorioVendasPorRegiao\"));\nconst RelatorioPersonalizado = React.lazy(() => import(\"@/components/relatorios/RelatorioPersonalizado\"));\nconst DashboardRepresentantes = React.lazy(() => import(\"@/components/relatorios/DashboardRepresentantes\"));\nimport useContextoVisual from \"@/components/lib/useContextoVisual\";\nimport ErrorBoundary from \"@/components/lib/ErrorBoundary\";\nimport ProtectedSection from \"@/components/security/ProtectedSection\";\nimport { hasReportGrant } from \"@/components/relatorios/useSecureReport\";\nimport usePermissions from \"@/components/lib/usePermissions\";\nimport { z } from \"zod\";\n",
    "const DashboardInadimplencia = React.lazy(() => import(\"@/components/relatorios/DashboardInadimplencia\"));\nconst RelatorioVendasPorRegiao = React.lazy(() => import(\"@/components/relatorios/RelatorioVendasPorRegiao\"));\nconst DashboardRepresentantes = React.lazy(() => import(\"@/components/relatorios/DashboardRepresentantes\"));\nimport useContextoVisual from \"@/components/lib/useContextoVisual\";\nimport ErrorBoundary from \"@/components/lib/ErrorBoundary\";\nimport ProtectedSection from \"@/components/security/ProtectedSection\";\nimport usePermissions from \"@/components/lib/usePermissions\";\nimport { z } from \"zod\";\n"
  ],
  [
    "const RelatorioDRE = React.lazy(() => import(\"@/components/relatorios/RelatorioDRE\"));\n\nlet reportSequence = 0;\n\nexport default function Relatorios() {\n  const [activeTab, setActiveTab] = useState(() => {\n    const tab = new URLSearchParams(window.location.search).get('tab');\n    if (tab) return tab;\n    try { return localStorage.getItem('Relatorios_tab') || 'vendas'; }\n    catch { return 'vendas'; }\n  });\n  const handleTabChange = (value) => {\n    setActiveTab(value);\n",
    "const RelatorioDRE = React.lazy(() => import(\"@/components/relatorios/RelatorioDRE\"));\n\nexport default function Relatorios() {\n  const [activeTab, setActiveTab] = useState(\"vendas\");\n  useEffect(() => {\n    const params = new URLSearchParams(window.location.search);\n    let initial = params.get('tab');\n    if (!initial) { try { initial = localStorage.getItem('Relatorios_tab'); } catch (error) { console.warn('[Relatorios] Falha ao restaurar aba', error); } }\n    if (initial) setActiveTab(initial);\n  }, []);\n  const handleTabChange = (value) => {\n    setActiveTab(value);\n"
  ],
  [
    "  const queryClient = useQueryClient();\n  const { empresaAtual, grupoAtual, estaNoGrupo, filterInContext } = useContextoVisual();\n  const { hasPermission,user,perfilAcesso,isLoading:permissionsLoading } = usePermissions();\n  const reportSession = useMemo(() => ++reportSequence,[user,perfilAcesso]);\n  const secureTab = [\"representantes\",\"personalizado\"].includes(activeTab);\n  const hasContextoAtivo = Boolean(empresaAtual?.id || grupoAtual?.id || estaNoGrupo);\n  const canViewRelatorios = hasPermission('Relatórios', null, 'visualizar') || hasPermission('Relatorios', null, 'visualizar') || hasPermission('Relatórios', null, 'ver');\n",
    "  const queryClient = useQueryClient();\n  const { empresaAtual, grupoAtual, estaNoGrupo, filterInContext } = useContextoVisual();\n  const { hasPermission } = usePermissions();\n  const hasContextoAtivo = Boolean(empresaAtual?.id || grupoAtual?.id || estaNoGrupo);\n  const canViewRelatorios = hasPermission('Relatórios', null, 'visualizar') || hasPermission('Relatorios', null, 'visualizar') || hasPermission('Relatórios', null, 'ver');\n"
  ],
  [
    "\n  const { data: clientes = [] } = useQuery({\n    queryKey: ['clientes', user?.id,reportSession,empresaAtual?.id, grupoAtual?.id, estaNoGrupo],\n    queryFn: () => filterInContext('Cliente', {}, '-created_date', 9999),\n    enabled: Boolean(hasContextoAtivo && canViewRelatorios && !permissionsLoading && !secureTab && hasPermission('Cadastros','Pessoas','visualizar'))\n  });\n\n  const { data: pedidos = [] } = useQuery({\n    queryKey: ['pedidos', user?.id,reportSession,empresaAtual?.id, grupoAtual?.id, estaNoGrupo],\n    queryFn: () => filterInContext('Pedido', {}, '-data_pedido', 9999),\n    enabled: Boolean(hasContextoAtivo && canViewRelatorios && !permissionsLoading && !secureTab && hasPermission('Comercial','pedido','visualizar'))\n  });\n\n  const { data: produtos = [] } = useQuery({\n    queryKey: ['produtos', user?.id,reportSession,empresaAtual?.id, grupoAtual?.id, estaNoGrupo],\n    queryFn: () => filterInContext('Produto', {}, '-created_date', 9999),\n    enabled: Boolean(hasContextoAtivo && canViewRelatorios && !permissionsLoading && !secureTab && hasPermission('Estoque','Produtos','visualizar'))\n  });\n\n  const { data: contasReceber = [] } = useQuery({\n    queryKey: ['contasReceber', user?.id,reportSession,empresaAtual?.id, grupoAtual?.id, estaNoGrupo],\n    queryFn: () => filterInContext('ContaReceber', {}, '-data_vencimento', 9999),\n    enabled: Boolean(hasContextoAtivo && canViewRelatorios && !permissionsLoading && !secureTab && hasPermission('Financeiro','ContaReceber','visualizar'))\n  });\n\n  const { data: contasPagar = [] } = useQuery({\n    queryKey: ['contasPagar', user?.id,reportSession,empresaAtual?.id, grupoAtual?.id, estaNoGrupo],\n    queryFn: () => filterInContext('ContaPagar', {}, '-data_vencimento', 9999),\n    enabled: Boolean(hasContextoAtivo && canViewRelatorios && !permissionsLoading && !secureTab && hasPermission('Financeiro','ContaPagar','visualizar'))\n  });\n\n",
    "\n  const { data: clientes = [] } = useQuery({\n    queryKey: ['clientes', empresaAtual?.id, grupoAtual?.id, estaNoGrupo],\n    queryFn: () => filterInContext('Cliente', {}, '-created_date', 9999),\n    enabled: Boolean(hasContextoAtivo && canViewRelatorios)\n  });\n\n  const { data: pedidos = [] } = useQuery({\n    queryKey: ['pedidos', empresaAtual?.id, grupoAtual?.id, estaNoGrupo],\n    queryFn: () => filterInContext('Pedido', {}, '-data_pedido', 9999),\n    enabled: Boolean(hasContextoAtivo && canViewRelatorios)\n  });\n\n  const { data: produtos = [] } = useQuery({\n    queryKey: ['produtos', empresaAtual?.id, grupoAtual?.id, estaNoGrupo],\n    queryFn: () => filterInContext('Produto', {}, '-created_date', 9999),\n    enabled: Boolean(hasContextoAtivo && canViewRelatorios)\n  });\n\n  const { data: contasReceber = [] } = useQuery({\n    queryKey: ['contasReceber', empresaAtual?.id, grupoAtual?.id, estaNoGrupo],\n    queryFn: () => filterInContext('ContaReceber', {}, '-data_vencimento', 9999),\n    enabled: Boolean(hasContextoAtivo && canViewRelatorios)\n  });\n\n  const { data: contasPagar = [] } = useQuery({\n    queryKey: ['contasPagar', empresaAtual?.id, grupoAtual?.id, estaNoGrupo],\n    queryFn: () => filterInContext('ContaPagar', {}, '-data_vencimento', 9999),\n    enabled: Boolean(hasContextoAtivo && canViewRelatorios)\n  });\n\n"
  ],
  [
    "            Agendamento\n          </TabsTrigger>\n          {hasReportGrant(perfilAcesso,'Comercial','Representantes','visualizar') && <TabsTrigger value=\"representantes\">Representantes</TabsTrigger>}\n          {hasReportGrant(perfilAcesso,'Relatorios','Personalizado','visualizar') && <TabsTrigger value=\"personalizado\">Personalizado</TabsTrigger>}\n          <TabsTrigger value=\"vendas\" data-permission=\"Comercial.visualizar\" className=\"data-[state=active]:bg-blue-600 data-[state=active]:text-white\">\n            <TrendingUp className=\"w-4 h-4 mr-2\" />Vendas\n",
    "            Agendamento\n          </TabsTrigger>\n          <TabsTrigger value=\"vendas\" data-permission=\"Comercial.visualizar\" className=\"data-[state=active]:bg-blue-600 data-[state=active]:text-white\">\n            <TrendingUp className=\"w-4 h-4 mr-2\" />Vendas\n"
  ],
  [
    "        </TabsContent>\n\n        <TabsContent value=\"representantes\">\n          {activeTab === 'representantes' && !permissionsLoading && hasReportGrant(perfilAcesso,'Comercial','Representantes','visualizar') && <Suspense fallback={<div>Carregando...</div>}><DashboardRepresentantes /></Suspense>}\n        </TabsContent>\n        <TabsContent value=\"personalizado\">\n          {activeTab === 'personalizado' && !permissionsLoading && hasReportGrant(perfilAcesso,'Relatorios','Personalizado','visualizar') && <Suspense fallback={<div>Carregando...</div>}><RelatorioPersonalizado /></Suspense>}\n        </TabsContent>\n        <TabsContent value=\"vendas\">\n          <Suspense fallback={<div className=\"p-8 text-center text-slate-500\">Carregando...</div>}><RelatorioVendas /></Suspense>\n",
    "        </TabsContent>\n\n        <TabsContent value=\"vendas\">\n          <Suspense fallback={<div className=\"p-8 text-center text-slate-500\">Carregando...</div>}><RelatorioVendas /></Suspense>\n"
  ]
];

export function primitiveUiBoundaryRemainder(file, source) {
  if (file === 'src/pages/Relatorios.jsx') for (const [after,before] of reportRecoveryEdits) {
    assert.equal(source.split(after).length-1,1,'Exact authorized #348 recovery hunk');
    source=source.replace(after,before);
  }
  const edits = primitiveUiEdits[file]; if (!edits) return source;
  for (const [after, before, count] of edits) {
    assert.equal(source.split(after).length - 1, count, `Exact stage45 boundary count: ${file}: ${after}`);
    source = source.split(after).join(before);
  }
  return source;
}
