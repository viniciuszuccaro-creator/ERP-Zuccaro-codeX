import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, TrendingUp, CheckCircle2, ArrowRight, Sparkles, Activity } from 'lucide-react';
import { useWindow } from '@/components/lib/useWindow';
import DashboardFechamentoPedidos from './DashboardFechamentoPedidos';
import { obterEstatisticasAutomacao } from '@/components/lib/useFluxoPedido';

/**
 * V21.6 FINAL - WIDGET RESUMIDO COM IA ANALYTICS
 */
export default function WidgetFechamentoPedidos({ empresaId = null }) {
  const { openWindow } = useWindow();
  const [estatisticasIA, setEstatisticasIA] = useState(null);

  // Carregar estatísticas IA
  useEffect(() => {
    obterEstatisticasAutomacao(empresaId, 7).then(stats => {
      setEstatisticasIA(stats);
    }).catch(() => {
      setEstatisticasIA(null);
    });
  }, [empresaId]);

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos', empresaId],
    queryFn: () => empresaId
      ? base44.entities.Pedido.filter({ empresa_id: empresaId }, '-created_date', 50)
      : base44.entities.Pedido.list('-created_date', 50),
    initialData: [],
  });

  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 7);

  const pedidosRecentes = pedidos.filter(p => {
    const dataPedido = new Date(p.created_date);
    return dataPedido >= dataLimite;
  });

  const pedidosFechados = pedidosRecentes.filter(p => 
    p.status === 'Pronto para Faturar' || 
    p.status === 'Faturado' || 
    p.status === 'Em Expedição'
  );

  const pedidosComAutomacao = pedidosFechados.filter(p => 
    p.observacoes_internas?.includes('[AUTOMAÇÃO')
  );

  const taxaAutomacao = pedidosFechados.length > 0 
    ? (pedidosComAutomacao.length / pedidosFechados.length) * 100 
    : 0;

  const pedidosProntosFechar = pedidos.filter(p => 
    p.status === 'Rascunho' && 
    (p.itens_revenda?.length > 0 || p.itens_armado_padrao?.length > 0)
  );

  return (
    <Card className="border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-purple-50 hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="w-5 h-5 text-blue-600" />
            Fechamento Automático
            {estatisticasIA && (
              <Badge className="bg-purple-600 text-white text-xs ml-1">
                <Sparkles className="w-3 h-3 mr-1" />
                IA
              </Badge>
            )}
          </CardTitle>
          <Badge className="bg-blue-600 text-white">7 dias</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Taxa de Automação */}
        <div className="bg-white/80 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Taxa de Automação</p>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-blue-600">{taxaAutomacao.toFixed(0)}%</p>
          <p className="text-xs text-slate-500 mt-1">
            {pedidosComAutomacao.length} de {pedidosFechados.length} pedidos
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/80 p-3 rounded-lg border text-center">
            <p className="text-xl font-bold text-green-600">{pedidosComAutomacao.length}</p>
            <p className="text-xs text-slate-600">Fechados</p>
          </div>
          <div className="bg-white/80 p-3 rounded-lg border text-center">
            <p className="text-xl font-bold text-orange-600">{pedidosProntosFechar.length}</p>
            <p className="text-xs text-slate-600">Prontos</p>
          </div>
          <div className="bg-white/80 p-3 rounded-lg border text-center">
            <p className="text-xl font-bold text-purple-600">~10s</p>
            <p className="text-xs text-slate-600">Tempo</p>
          </div>
        </div>

        {/* V21.6 FINAL: IA Analytics Mini */}
        {estatisticasIA && (
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-purple-700 flex items-center gap-1 font-semibold">
                <Activity className="w-3 h-3" />
                Analytics IA
              </span>
              <Badge className="bg-purple-600 text-white text-xs px-2">
                {estatisticasIA.diasAnalise}d
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center bg-white/50 rounded p-2">
                <div className="text-lg font-bold text-purple-600">
                  {estatisticasIA.totalPedidos}
                </div>
                <div className="text-xs text-purple-700">Total</div>
              </div>
              <div className="text-center bg-white/50 rounded p-2">
                <div className="text-lg font-bold text-green-600">
                  {estatisticasIA.pedidosAutomaticos}
                </div>
                <div className="text-xs text-green-700">Auto</div>
              </div>
              <div className="text-center bg-white/50 rounded p-2">
                <div className="text-lg font-bold text-orange-600">
                  {estatisticasIA.taxaAutomacao.toFixed(0)}%
                </div>
                <div className="text-xs text-orange-700">Taxa</div>
              </div>
            </div>
          </div>
        )}

        {/* Ação */}
        <Button
          onClick={() => openWindow(
            DashboardFechamentoPedidos,
            { windowMode: true, empresaId },
            {
              title: '📊 Dashboard de Fechamento Automático',
              width: 1200,
              height: 700
            }
          )}
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="sm"
        >
          Ver Dashboard Completo
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>

      </CardContent>
    </Card>
  );
}