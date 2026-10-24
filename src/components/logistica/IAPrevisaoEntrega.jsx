import React, { useState } from "react";
import { invokeErpIa } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, AlertTriangle, Calendar, Clock, Truck } from "lucide-react";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { assertIaUiContext, sanitizeIaPrompt } from "@/components/lib/iaTransversalPolicy";
import { validarPrevisaoEntregaIA } from "@/components/lib/iaResponsePolicy.js";

/**
 * IA de previsao de entrega — sugere data/risco; nao altera pedido sozinha.
 */
export default function IAPrevisaoEntrega({ pedido, historico = [], windowMode = false }) {
  const [previsaoResult, setPrevisao] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const { empresaAtual, grupoAtual, estaNoGrupo } = useContextoVisual();
  const { hasPermission, isAdmin, user } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || pedido?.group_id || pedido?.grupo_id || null;
  const empresaId = empresaAtual?.id || pedido?.empresa_id || null;
  const scopeType = estaNoGrupo ? "grupo" : "empresa";
  const iaIdentityKey = JSON.stringify([user?.id, pedido?.id, groupId, empresaId, scopeType]);
  const iaRequestScope = React.useRef({ key: iaIdentityKey, pending: false, active: true });
  const iaResultScope = React.useRef(null);
  if (iaRequestScope.current.key !== iaIdentityKey) iaRequestScope.current = { key: iaIdentityKey, pending: false, active: true };
  const previsao = iaResultScope.current === iaRequestScope.current ? previsaoResult : null;
  React.useEffect(() => {
    const scope = iaRequestScope.current;
    scope.active = true;
    setPrevisao(null);
    setCarregando(false);
    return () => { scope.active = false; };
  }, [iaIdentityKey]);
  const canExecutar = isAdmin?.()
    || hasPermission("Expedição", null, "visualizar")
    || hasPermission("Expedição", null, "ver")
    || hasPermission("Logística", null, "visualizar")
    || hasPermission("Logística", null, "ver");

  const containerClass = windowMode ? "w-full h-full flex flex-col" : "";

  const calcularPrevisaoIA = async () => {
    const activeScope = iaRequestScope.current;
    if (activeScope.pending || activeScope.active === false) return;
    activeScope.pending = true;
    const isCurrent = () => iaRequestScope.current === activeScope && activeScope.active !== false;
    setCarregando(true);
    try {
      assertIaUiContext({ groupId, empresaId, scopeType });
      if (!canExecutar) throw new Error("Sem permissao para calcular previsao de entrega.");
      if (!pedido || pedido.id == null || pedido.id === '') throw new Error("Pedido com identidade obrigatorio para previsao.");

      const prompt = sanitizeIaPrompt(`Voce e um sistema de IA especializado em previsao de entregas logisticas.
Analise o pedido e historico e sugira data/horario, riscos e recomendacoes.
Pedido: ${pedido.numero_pedido} / ${pedido.cliente_nome}
Cidade: ${pedido.endereco_entrega_principal?.cidade || "N/A"} / ${pedido.endereco_entrega_principal?.estado || "N/A"}
Peso: ${pedido.peso_total_kg || 0} kg / Valor: R$ ${(pedido.valor_total || 0).toFixed(2)}
Prioridade: ${pedido.prioridade || "Normal"} / Frete: ${pedido.tipo_frete}
Data prevista original: ${pedido.data_prevista_entrega || "N/A"}
Historico (ate 10): ${JSON.stringify(historico.slice(0, 10))}
Retorne apenas sugestao; nao execute alteracao no pedido.`);

      const resultado = await invokeErpIa('entrega_previsao', {
        prompt,
        group_id: groupId,
        empresa_id: empresaId,
        tipo_ia: "previsao_entrega",
        response_json_schema: {
          type: "object",
          properties: {
            data_prevista: { type: "string" },
            horario_previsto: { type: "string" },
            confianca_percentual: { type: "number" },
            fatores_risco: { type: "array", items: { type: "string" } },
            recomendacoes: { type: "array", items: { type: "string" } },
            prazo_dias: { type: "number" }
          }
        }
      });

      if (!isCurrent()) return;
      const validada = validarPrevisaoEntregaIA(resultado);
      iaResultScope.current = activeScope;
      setPrevisao(validada);
      toast.success("Previsao sugerida pela IA (pedido nao alterado).");
    } catch (error) {
      if (!isCurrent()) return;
      toast.error("Erro ao calcular previsao: " + (error?.message || error));
    } finally {
      activeScope.pending = false;
      if (isCurrent()) setCarregando(false);
    }
  };

  if (!groupId || (scopeType !== "grupo" && !empresaId)) {
    return (
      <Card className={`border-0 shadow-lg ${containerClass}`}>
        <CardContent className="p-4 text-sm text-amber-900 bg-amber-50">
          Selecione grupo e empresa para calcular previsao de entrega.
        </CardContent>
      </Card>
    );
  }

  if (!canExecutar) {
    return (
      <Card className={`border-0 shadow-lg ${containerClass}`}>
        <CardContent className="p-4 text-sm text-slate-700">
          Sem permissao para usar previsao de entrega com IA.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-0 shadow-lg ${containerClass}`}>
      <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Previsao de Entrega com IA
          <Badge className="bg-white/20 text-white border-0">Sugestao</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {!previsao ? (
          <Button
            onClick={calcularPrevisaoIA}
            disabled={carregando}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            size="lg"
          >
            <Zap className="w-5 h-5 mr-2" />
            {carregando ? "Calculando com IA..." : "Calcular Previsao com IA"}
          </Button>
        ) : (
          <div className="space-y-4">
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-300">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-blue-700">Data Prevista</p>
                      <p className="text-xl font-bold text-blue-900">{previsao.data_prevista}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-purple-700">Horario</p>
                      <p className="text-xl font-bold text-purple-900">{previsao.horario_previsto || 'Nao informado'}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-4">
                  Confianca: {previsao.confianca_percentual}% · Prazo: {previsao.prazo_dias ?? 'Nao informado'} dia(s) · pedido nao alterado automaticamente
                </p>
              </CardContent>
            </Card>

            {(previsao.fatores_risco || []).length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="w-4 h-4" /> Fatores de risco
                </p>
                {(previsao.fatores_risco || []).map((fator, idx) => (
                  <p key={idx} className="text-sm text-slate-700">• {fator}</p>
                ))}
              </div>
            )}

            {(previsao.recomendacoes || []).length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold flex items-center gap-2 text-indigo-800">
                  <TrendingUp className="w-4 h-4" /> Recomendacoes
                </p>
                {(previsao.recomendacoes || []).map((rec, idx) => (
                  <p key={idx} className="text-sm text-slate-700">• {rec}</p>
                ))}
              </div>
            )}

            <Button variant="outline" onClick={() => setPrevisao(null)} className="w-full">
              <Truck className="w-4 h-4 mr-2" />
              Nova previsao
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
