import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, TrendingUp, ArrowRight } from "lucide-react";
import BadgeOrigemPedido from "@/components/comercial/BadgeOrigemPedido";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.6 - Widget de Canais no Dashboard Principal
 * Mostra distribuição de pedidos por origem nos últimos 30 dias
 */
export default function WidgetCanaisOrigem({ empresaId }) {
  const navigate = useNavigate();
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaSelecionadaId = empresaId || empresaAtual?.id || null;
  const contextKey = empresaSelecionadaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewWidget = hasPermission("Dashboard", "Operacional", "visualizar") ||
    hasPermission("Comercial", "Relatorios", "visualizar") ||
    hasPermission("Dashboard", null, "visualizar");

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos-30-dias', contextKey],
    queryFn: async () => {
      const hoje = new Date();
      const dias30Atras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
      const todosPedidos = await filterInContext('Pedido', empresaSelecionadaId ? { empresa_id: empresaSelecionadaId } : {}, '-created_date', 500);

      return todosPedidos.filter(p => {
        if (!p.created_date) return false;
        const dataPedido = new Date(p.created_date);
        return dataPedido >= dias30Atras;
      });
    },
    enabled: contextoValido && canViewWidget,
    initialData: [],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="h-8 bg-slate-200 rounded"></div>
            <div className="h-8 bg-slate-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Agrupar por origem
  const porOrigem = pedidos.reduce((acc, p) => {
    const origem = p.origem_pedido || 'Manual';
    if (!acc[origem]) {
      acc[origem] = { count: 0, valor: 0 };
    }
    acc[origem].count++;
    acc[origem].valor += (p.valor_total || 0);
    return acc;
  }, {});

  const dadosOrdenados = Object.entries(porOrigem)
    .map(([origem, dados]) => ({
      origem,
      count: dados.count,
      valor: dados.valor,
      percentual: (dados.count / pedidos.length) * 100
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalPedidos = pedidos.length;
  const canalPrincipal = dadosOrdenados[0];

  return (
    <Card 
      className="hover:shadow-lg transition-all duration-300 cursor-pointer border-blue-200 bg-gradient-to-br from-blue-50 to-slate-50"
      onClick={() => navigate(createPageUrl('Cadastros') + '?tab=parametros&subtab=dashboard')}
      data-permission="Dashboard.Operacional.visualizar"
      data-context-required="group-or-company"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-5 h-5 text-blue-600" />
            Canais de Origem (30 dias)
          </CardTitle>
          <Badge className="bg-blue-100 text-blue-700">
            {totalPedidos} pedidos
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(!contextoValido || !canViewWidget) && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Selecione grupo ou empresa e confirme permissao para visualizar canais de origem.
          </div>
        )}
        
        {/* Canal Principal */}
        {canalPrincipal && (
          <div className="p-3 bg-white rounded-lg border border-blue-300 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-slate-700">Canal Líder</span>
              </div>
              <Badge className="bg-blue-600 text-white">
                {canalPrincipal.percentual.toFixed(0)}%
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <BadgeOrigemPedido origemPedido={canalPrincipal.origem} showLock={false} />
              <div className="text-right">
                <p className="text-lg font-bold text-blue-600">{canalPrincipal.count}</p>
                <p className="text-xs text-slate-600">pedidos</p>
              </div>
            </div>
          </div>
        )}

        {/* Outros Canais */}
        <div className="space-y-2">
          {dadosOrdenados.slice(1).map((canal, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <BadgeOrigemPedido origemPedido={canal.origem} showLock={false} />
                  <span className="text-xs text-slate-600">{canal.count} pedidos</span>
                </div>
                <Progress value={canal.percentual} className="h-1.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700 w-10 text-right">
                {canal.percentual.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 mt-2 border-t flex items-center justify-between text-xs">
          <span className="text-slate-600">Clique para ver dashboard completo</span>
          <ArrowRight className="w-4 h-4 text-blue-600" />
        </div>

      </CardContent>
    </Card>
  );
}
