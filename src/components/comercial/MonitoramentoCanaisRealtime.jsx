import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, TrendingUp, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * V21.6 - Monitoramento em Tempo Real de Pedidos por Canal
 * Atualiza automaticamente a cada 30 segundos
 */
export default function MonitoramentoCanaisRealtime({ empresaId, autoRefresh = true }) {
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date());

  // Buscar pedidos em tempo real
  const { data: pedidos = [], refetch } = useQuery({
    queryKey: ['pedidos-realtime', empresaId],
    queryFn: () => {
      if (empresaId) {
        return base44.entities.Pedido.filter({ empresa_id: empresaId });
      }
      return base44.entities.Pedido.list('-created_date', 100);
    },
    initialData: [],
    refetchInterval: autoRefresh ? 30000 : false // 30 segundos
  });

  // Buscar parâmetros
  const { data: parametros = [] } = useQuery({
    queryKey: ['parametros-origem-pedido'],
    queryFn: () => base44.entities.ParametroOrigemPedido.list(),
    initialData: []
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setUltimaAtualizacao(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Analisar últimos 30 minutos
  const agora = new Date();
  const ultimos30min = new Date(agora.getTime() - 30 * 60 * 1000);

  const pedidosRecentes = pedidos.filter((p) => {
    const dataPedido = new Date(p.created_date || p.data_pedido);
    return dataPedido >= ultimos30min;
  });

  // Agrupar por canal
  const porCanal = parametros.map((param) => {
    const origemMap = {
      'ERP': 'Manual',
      'Site': 'Site',
      'E-commerce': 'E-commerce',
      'Chatbot': 'Chatbot',
      'WhatsApp': 'WhatsApp',
      'Portal Cliente': 'Portal',
      'Marketplace': 'Marketplace',
      'API': 'API',
      'App Mobile': 'App'
    };

    const origemEsperada = origemMap[param.canal] || param.canal;

    const pedidosCanal = pedidosRecentes.filter((p) => {
      const origemPedido = origemMap[p.origem_pedido] || p.origem_pedido;
      return origemPedido === param.canal || p.origem_pedido === origemEsperada;
    });

    return {
      nome: param.nome,
      canal: param.canal,
      cor: param.cor_badge,
      count: pedidosCanal.length,
      ultimoPedido: pedidosCanal[0]?.created_date || null
    };
  }).filter((c) => c.count > 0);

  const CORES = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    yellow: 'from-yellow-500 to-yellow-600',
    pink: 'from-pink-500 to-pink-600',
    cyan: 'from-cyan-500 to-cyan-600'
  };

  const tempoDesdeUltimaAtualizacao = Math.floor((agora.getTime() - ultimaAtualizacao.getTime()) / 1000);

  return (
    <Card className="border-cyan-300 bg-gradient-to-r from-cyan-50 to-blue-50">
      <CardHeader className="px-6 flex flex-col space-y-1.5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-5 h-5 text-cyan-600 animate-pulse" />
            Monitoramento em Tempo Real
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-600 text-white">
              <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
              Ao Vivo
            </Badge>
            <span className="text-xs text-slate-500">
              Atualiza a cada 30s
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        
        {/* Resumo Últimos 30min */}
        <div className="bg-white/60 mb-1 px-3 rounded-lg flex items-center gap-4 border border-cyan-200">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-600" />
            <div>
              <p className="text-xs text-slate-600">Últimos 30 minutos</p>
              <p className="text-2xl font-bold text-cyan-600">
                {pedidosRecentes.length}
              </p>
              <p className="text-xs text-slate-500">pedidos recebidos</p>
            </div>
          </div>
          
          <div className="flex-1 border-l pl-4">
            <p className="text-xs text-slate-600 mb-1">Por Canal:</p>
            <div className="flex gap-2 flex-wrap">
              <AnimatePresence>
                {porCanal.map((canal, idx) =>
                <motion.div
                  key={canal.canal}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: idx * 0.1 }}>

                    <Badge className={`bg-gradient-to-r ${CORES[canal.cor] || CORES.blue} text-white`}>
                      {canal.nome}: {canal.count}
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Lista de Canais Ativos */}
        {porCanal.length > 0 ?
        <div className="space-y-2">
            {porCanal.map((canal, idx) => {
            const tempoUltimo = canal.ultimoPedido ?
            Math.floor((agora.getTime() - new Date(canal.ultimoPedido).getTime()) / 60000) :
            null;

            return (
              <motion.div
                key={canal.canal}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-md transition-all">

                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${CORES[canal.cor] || CORES.blue} rounded-lg flex items-center justify-center`}>
                      <span className="text-white font-bold text-lg">{canal.count}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{canal.nome}</p>
                      <p className="text-xs text-slate-500">
                        {tempoUltimo !== null ?
                      tempoUltimo === 0 ? 'Agora mesmo' :
                      tempoUltimo === 1 ? 'Há 1 minuto' :
                      `Há ${tempoUltimo} minutos` :
                      'Sem pedidos recentes'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                  tempoUltimo !== null && tempoUltimo < 5 ?
                  'bg-green-500 animate-pulse' :
                  tempoUltimo < 15 ?
                  'bg-yellow-500' :
                  'bg-slate-300'}`
                  } />
                  </div>
                </motion.div>);

          })}
          </div> :

        <Alert className="border-slate-300">
            <AlertDescription className="text-sm text-slate-600">
              Nenhum pedido recebido nos últimos 30 minutos
            </AlertDescription>
          </Alert>
        }

      </CardContent>
    </Card>);

}
