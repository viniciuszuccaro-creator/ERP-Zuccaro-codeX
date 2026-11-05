import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Users, Shield } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

export default function MonitoramentoRHInteligente({ windowMode = false }) {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId);

  // Escopo multiempresa: MonitoramentoRH/Colaborador via filterInContext.
  // Sem list unscoped; enabled exige contexto; erro ≠ zero KPI.
  const { data: monitoramentos = [], isLoading, isError: isErrorMonitoramentos } = useQuery({
    queryKey: ["monitoramento-rh", groupId, empresaAtual?.id],
    queryFn: () => filterInContext("MonitoramentoRH", {}, "-created_date", 500),
    enabled: contextoValido,
  });

  const { data: colaboradores = [], isError: isErrorColaboradores } = useQuery({
    queryKey: ["colaboradores-monitoramento-rh", groupId, empresaAtual?.id],
    queryFn: () => filterInContext("Colaborador", {}, "nome_completo", 500),
    enabled: contextoValido,
  });

  const alertasCriticos = monitoramentos.filter(m => 
    m.alertas_gerados?.some(a => a.severidade === "Alta")
  );

  const riscoTurnoverAlto = monitoramentos.filter(m => 
    m.analise_comportamental_ia?.risco_turnover === "Alto" || 
    m.analise_comportamental_ia?.risco_turnover === "Crítico"
  );

  if (isLoading) return <div className="p-6">Carregando monitoramento...</div>;

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-6";
  const cargaIndisponivel = isErrorMonitoramentos || isErrorColaboradores;

  return (
    <div className={containerClass}>
      <div className={windowMode ? "p-6 space-y-6 flex-1 overflow-auto" : "space-y-6"}>
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Monitoramento RH Inteligente</h2>
        <p className="text-sm text-slate-600 mt-1">IA detecta riscos e padrões comportamentais</p>
        {cargaIndisponivel && (
          <p className="text-xs text-slate-500 mt-1">
            Contagem RH indisponível (erro de carga ≠ zero).
          </p>
        )}
        {!contextoValido && (
          <p className="text-xs text-slate-500 mt-1">
            Selecione um grupo ou empresa para carregar o monitoramento.
          </p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Colaboradores</p>
                <p className="text-2xl font-bold">{cargaIndisponivel ? "—" : colaboradores.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Risco Turnover</p>
                <p className="text-2xl font-bold text-red-600">{cargaIndisponivel ? "—" : riscoTurnoverAlto.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Alertas Críticos</p>
                <p className="text-2xl font-bold text-orange-600">{cargaIndisponivel ? "—" : alertasCriticos.length}</p>
              </div>
              <Shield className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Produtividade</p>
                <p className="text-2xl font-bold text-green-600">
                  {cargaIndisponivel
                    ? "—"
                    : monitoramentos.length > 0
                    ? (monitoramentos.reduce((acc, m) => acc + (m.metricas_produtividade?.produtividade_vs_meta || 0), 0) / monitoramentos.length).toFixed(0)
                    : 0}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alertas e Análises IA</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {monitoramentos
              .filter(m => m.alertas_gerados?.length > 0)
              .map(monitor => (
                <div key={monitor.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">{monitor.colaborador_nome}</h4>
                      <p className="text-xs text-slate-500">
                        Período: {new Date(monitor.periodo_referencia).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    
                    {monitor.analise_comportamental_ia?.risco_turnover && (
                      <Badge 
                        className={
                          monitor.analise_comportamental_ia.risco_turnover === "Crítico" ? "bg-red-500 text-white" :
                          monitor.analise_comportamental_ia.risco_turnover === "Alto" ? "bg-orange-500 text-white" :
                          monitor.analise_comportamental_ia.risco_turnover === "Médio" ? "bg-yellow-500 text-white" :
                          "bg-green-500 text-white"
                        }
                      >
                        Risco: {monitor.analise_comportamental_ia.risco_turnover}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    {monitor.alertas_gerados?.map((alerta, idx) => (
                      <div key={idx} className={`p-3 rounded border-l-4 ${
                        alerta.severidade === "Alta" ? "border-red-500 bg-red-50" :
                        alerta.severidade === "Média" ? "border-yellow-500 bg-yellow-50" :
                        "border-blue-500 bg-blue-50"
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{alerta.tipo_alerta}</p>
                            <p className="text-xs text-slate-600 mt-1">{alerta.descricao}</p>
                            {alerta.acao_recomendada && (
                              <p className="text-xs text-blue-600 mt-2">
                                💡 {alerta.acao_recomendada}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {monitor.analise_comportamental_ia?.sugestoes_retencao?.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-xs font-semibold text-blue-900 mb-2">🤖 Sugestões de Retenção IA:</p>
                      <ul className="text-xs text-blue-700 space-y-1">
                        {monitor.analise_comportamental_ia.sugestoes_retencao.map((sug, idx) => (
                          <li key={idx}>• {sug}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}

            {monitoramentos.filter(m => m.alertas_gerados?.length > 0).length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>{cargaIndisponivel ? "Alertas indisponíveis (erro ≠ lista vazia)" : "Nenhum alerta detectado"}</p>
                {!cargaIndisponivel && (
                  <p className="text-xs mt-2">Tudo está funcionando bem! 🎉</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
