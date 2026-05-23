import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ControlsBar from "./painel-logistico/ControlsBar";
import MapView from "./painel-logistico/MapView";
import QueuePanels from "./painel-logistico/QueuePanels";
import BottlenecksPanel from "./painel-logistico/BottlenecksPanel";
import AlertsPanel from "./painel-logistico/AlertsPanel";
import DriverChat from "./painel-logistico/DriverChat";
import OcorrenciasPanel from "./painel-logistico/OcorrenciasPanel";
import PerformanceReportDialog from "./painel-logistico/PerformanceReportDialog";
import RouteOptimizerPanel from "./painel-logistico/RouteOptimizerPanel";
import { Activity } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

export default function DashboardLogistico({ empresaId, entregas: entregasProp = [], windowMode }) {
  const queryClient = useQueryClient();
  const { filterInContext, empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const effectiveEmpresaId = empresaId || empresaAtual?.id || null;
  const effectiveGroupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(effectiveGroupId || effectiveEmpresaId);
  const canViewPainel = hasPermission("Expedicao", "Painel Logistico", "visualizar") || hasPermission("Expedicao", "Rotas", "visualizar") || hasPermission("Expedicao", "Entregas", "visualizar");
  const canEditRules = hasPermission("Expedicao", "Painel Logistico", "editar") || hasPermission("Expedicao", "Configuracoes", "editar");
  const canSimulate = hasPermission("Expedicao", "Painel Logistico", "editar") || hasPermission("Expedicao", "Rotas", "editar");
  const canExportReport = hasPermission("Expedicao", "Relatorios", "exportar") || hasPermission("Expedicao", "Painel Logistico", "exportar");

  const auditPainel = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao, modulo: "Expedicao", entidade: "PainelLogistico",
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        usuario_id: user?.id || user?.email || null,
        usuario_nome: user?.full_name || user?.email || "Sistema",
        group_id: effectiveGroupId, grupo_id: effectiveGroupId, empresa_id: effectiveEmpresaId,
        resultado: sucesso ? "sucesso" : "bloqueado", motivo, detalhes, data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar painel logistico", error);
    }
  };

  const [selected, setSelected] = React.useState(null);
  const [filters, setFilters] = React.useState({ q: '', statuses: [] });
  const [simResult, setSimResult] = React.useState(null);
  const [showReport, setShowReport] = React.useState(false);

  React.useEffect(() => {
    const handler = (e) => setSimResult(e.detail || null);
    window.addEventListener('logistica:simulation', handler);
    window.addEventListener('logistica:route', handler);
    return () => {
      window.removeEventListener('logistica:simulation', handler);
      window.removeEventListener('logistica:route', handler);
    };
  }, []);

  // Regras configuráveis salvas em ConfiguracaoSistema
  const rulesKey = React.useMemo(() => effectiveEmpresaId ? `logistica_alertas_rules_${effectiveEmpresaId}` : `logistica_alertas_rules_${effectiveGroupId || "global"}`, [effectiveEmpresaId, effectiveGroupId]);
  const { data: rules, isLoading: loadingRules } = useQuery({
    queryKey: ['log-rules', rulesKey, effectiveGroupId, effectiveEmpresaId],
    queryFn: async () => {
      const rows = await filterInContext('ConfiguracaoSistema', { chave: rulesKey }, undefined, 1);
      return rows?.[0]?.valor_json || rows?.[0]?.regras || { minAtrasoHoras: 1, maxFilaRota: 8, maxTransitoHoras: 6 };
    },
    enabled: contextoValido && canViewPainel
  });

  const saveRulesMutation = useMutation({
    mutationFn: async (newRules) => {
      if (!contextoValido || !canEditRules) {
        await auditPainel({ acao: "PainelLogistico.regras.salvar.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
        throw new Error("Contexto ou permissao obrigatoria para salvar regras.");
      }
      const rows = await filterInContext('ConfiguracaoSistema', { chave: rulesKey }, undefined, 1);
      const payload = { chave: rulesKey, valor_json: newRules, group_id: effectiveGroupId, grupo_id: effectiveGroupId, empresa_id: effectiveEmpresaId };
      if (rows?.length) {
        await updateInContext("ConfiguracaoSistema", rows[0].id, payload);
      } else {
        await createInContext("ConfiguracaoSistema", payload);
      }
      await auditPainel({ acao: "PainelLogistico.regras.salvar", detalhes: { rulesKey, regras: newRules } });
      return newRules;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['log-rules', rulesKey] }),
    onError: (error) => auditPainel({ acao: "PainelLogistico.regras.salvar.erro", sucesso: false, motivo: error?.message || "erro_salvar" })
  });

  // Carrega entregas em tempo quase real (fallback props)
  const { data: entregas = [] } = useQuery({
    queryKey: ['painel-logistico-entregas', effectiveGroupId, effectiveEmpresaId],
    queryFn: async () => await filterInContext('Entrega', {}, '-updated_date', 400),
    initialData: entregasProp,
    staleTime: 15000,
    enabled: contextoValido && canViewPainel
  });

  const handleEntregaUpdated = (e) => {
    try { setSelected(e); } catch (_) {}
    try { queryClient.invalidateQueries({ queryKey: ['painel-logistico-entregas', effectiveGroupId, effectiveEmpresaId] }); } catch (_) {}
  };

  const filtradas = React.useMemo(() => {
    const q = (filters.q || '').toLowerCase();
    return (entregas || []).filter((e) => {
      const byQ = !q || [e.cliente_nome, e.numero_pedido, e.motorista, e.regiao_entrega_nome].some(v => String(v || '').toLowerCase().includes(q));
      const byS = !filters.statuses?.length || filters.statuses.includes(e.status);
      return byQ && byS;
    });
  }, [entregas, filters]);

  return (
    <div className="w-full h-full" data-permission="Expedicao.PainelLogistico.visualizar" data-context-required="true">
      <Card className="mb-3">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2"><Activity className="w-4 h-4 text-teal-600"/> Painel Logístico</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{filtradas.length} entregas</Badge>
              <Button size="sm" variant="outline" onClick={() => { auditPainel({ acao: "PainelLogistico.relatorio.abrir" }); setShowReport(true); }} disabled={!contextoValido || !canExportReport} data-permission="Expedicao.Relatorios.exportar" data-action="PainelLogistico.relatorio.abrir" data-context-required="true" data-sensitive="true">Relatório</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ControlsBar filters={filters} setFilters={setFilters} rules={rules} onSaveRules={(r) => saveRulesMutation.mutate(r)} loadingRules={saveRulesMutation.isPending || loadingRules} contextoValido={contextoValido} canEditRules={canEditRules} canSimulate={canSimulate} onAudit={auditPainel} />
          {simResult && (
            <div className="mt-3 grid md:grid-cols-3 gap-2 text-sm">
              <div className="border rounded p-2">Distância Total: <span className="font-medium">{(simResult?.total_distance_km ?? simResult?.distance_km ?? 0).toLocaleString('pt-BR')} km</span></div>
              <div className="border rounded p-2">Duração Total: <span className="font-medium">{(simResult?.total_duration_min ?? simResult?.duration_min ?? 0)} min</span></div>
              <div className="border rounded p-2">Não Alocados: <span className="font-medium">{(simResult?.unassigned?.length || 0)}</span></div>
            </div>
          )}

          <RouteOptimizerPanel entregas={filtradas} empresaId={effectiveEmpresaId} groupId={effectiveGroupId} onSelectEntrega={setSelected} contextoValido={contextoValido} canOptimize={canSimulate} onAudit={auditPainel} />
        </CardContent>
      </Card>

      <ResizablePanelGroup direction="horizontal" className="w-full h-[70vh] min-h-[480px]">
        <ResizablePanel defaultSize={65} minSize={45}>
          <MapView entregas={filtradas} selected={selected} onSelect={setSelected} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={35} minSize={30}>
          <div className="grid gap-3 h-full grid-rows-[1fr_1fr_1fr_1fr]">
            <AlertsPanel entregas={filtradas} rules={rules} onSelectEntrega={setSelected} />
            <BottlenecksPanel entregas={filtradas} rules={rules} onSelectEntrega={setSelected} />
            <QueuePanels entregas={filtradas} onSelectEntrega={setSelected} />
            {selected ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <DriverChat entrega={selected} onUpdated={handleEntregaUpdated} />
                <OcorrenciasPanel entrega={selected} onUpdated={handleEntregaUpdated} />
              </div>
            ) : (
              <Card className="h-full"><CardContent className="text-sm text-slate-500 p-3">Selecione uma entrega no mapa para conversar com o motorista e registrar ocorrências.</CardContent></Card>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      <PerformanceReportDialog open={showReport} onOpenChange={setShowReport} entregas={filtradas} contextoValido={contextoValido} canExport={canExportReport} onAudit={auditPainel} />
    </div>
  );
}