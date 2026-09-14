import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, AlertTriangle, Clock, DollarSign, Factory, Package, Sparkles, TrendingUp, Truck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

/** @typedef {import('@/components/lib/useRealtimeData').RealtimeKpis} RealtimeKpis */
/** @typedef {import('@/components/lib/useRealtimeData').RealtimePedido} RealtimePedido */
/** @typedef {import('@/components/lib/useRealtimeData').RealtimeEntrega} RealtimeEntrega */

/**
 * Apresentacao privada do dashboard existente, sem consultas ou persistencia.
 * @param {{ kpis: RealtimeKpis, pedidosRecentes: RealtimePedido[], entregasAtivas: RealtimeEntrega[] }} props
 */
export default function DashboardTempoRealOperations({ kpis, pedidosRecentes, entregasAtivas }) {
  const percentualEntregas = kpis.expedicao.entregasHoje > 0
    ? Math.min(100, Math.max(0, (kpis.expedicao.realizadas / kpis.expedicao.entregasHoje) * 100))
    : 0;
  const percentualProducao = Math.min(100, Math.max(0, Number(kpis.producao.percentualMedio) || 0));

  return (
    <>
      <ResizablePanelGroup direction="horizontal" className="w-full h-[520px] md:h-[640px]">
        <ResizablePanel defaultSize={55} minSize={35}>
          <Card className="h-full border-0 shadow-md overflow-hidden">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Pedidos Recentes
                <Badge className="ml-auto bg-blue-600">Tempo Real</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[520px] md:max-h-[640px] overflow-auto">
              <div className="divide-y">
                <AnimatePresence>
                  {pedidosRecentes.map((pedido) => (
                    <motion.div
                      key={pedido.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">{pedido.numero_pedido || '-'}</span>
                            <Badge className={
                              pedido.status === 'Aprovado' ? 'bg-green-100 text-green-700'
                                : pedido.status === 'Em Produção' ? 'bg-blue-100 text-blue-700'
                                  : pedido.status === 'Aguardando Aprovação' ? 'bg-orange-100 text-orange-700'
                                    : 'bg-slate-100 text-slate-700'
                            }>
                              {pedido.status || 'Sem status'}
                            </Badge>
                            {pedido.prioridade === 'Urgente' && (
                              <Badge className="bg-red-600">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Urgente
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mt-1 truncate">{pedido.cliente_nome || '-'}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-semibold text-lg text-green-600">
                            R$ {Number(pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-slate-500">
                            {pedido.created_date ? new Date(pedido.created_date).toLocaleTimeString('pt-BR') : '-'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {pedidosRecentes.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum pedido recente</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </ResizablePanel>

        <ResizableHandle withHandle={undefined} className={undefined} />

        <ResizablePanel defaultSize={45} minSize={25}>
          <Card className="h-full border-0 shadow-md overflow-hidden">
            <CardHeader className="bg-orange-50 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-600" />
                Entregas em Andamento
                {entregasAtivas.length > 0 && (
                  <Badge className="ml-auto bg-orange-600">{entregasAtivas.length} ativas</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className={entregasAtivas.length > 0 ? 'p-0 max-h-[520px] md:max-h-[640px] overflow-auto' : 'p-6 text-slate-500'}>
              {entregasAtivas.length > 0 ? (
                <div className="divide-y">
                  <AnimatePresence>
                    {entregasAtivas.slice(0, 5).map((entrega) => (
                      <motion.div
                        key={entrega.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-4 hover:bg-slate-50"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-900">{entrega.numero_pedido || '-'}</span>
                              <Badge className={
                                entrega.status === 'Saiu para Entrega' ? 'bg-blue-600'
                                  : entrega.status === 'Em Trânsito' ? 'bg-orange-600'
                                    : entrega.status === 'Pronto para Expedir' ? 'bg-green-100 text-green-700'
                                      : 'bg-slate-100 text-slate-700'
                              }>
                                {entrega.status || 'Sem status'}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">
                              {entrega.cliente_nome || '-'} • {entrega.endereco_entrega_completo?.cidade || '-'}
                            </p>
                            {entrega.motorista && (
                              <p className="text-xs text-slate-500 mt-1">
                                {entrega.motorista} • {entrega.placa || '-'}
                              </p>
                            )}
                          </div>
                          <div className="text-left sm:text-right">
                            {entrega.data_previsao && (
                              <p className="text-sm text-slate-600">
                                <Clock className="w-3 h-3 inline mr-1" />
                                {new Date(entrega.data_previsao).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : 'Sem entregas ativas'}
            </CardContent>
          </Card>
        </ResizablePanel>
      </ResizablePanelGroup>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.pedidos.aguardandoAprovacao > 0 && (
          <RealtimeAlert icon={AlertTriangle} color="orange" title={`${kpis.pedidos.aguardandoAprovacao} Pedido(s)`} detail="Aguardando Aprovação" />
        )}
        {kpis.financeiro.atrasados > 0 && (
          <RealtimeAlert icon={DollarSign} color="red" title={`${kpis.financeiro.atrasados} Título(s)`} detail="Vencidos/Atrasados" />
        )}
        {kpis.producao.opsAtrasadas > 0 && (
          <RealtimeAlert icon={Factory} color="red" title={`${kpis.producao.opsAtrasadas} OP(s)`} detail="Atrasadas" />
        )}
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base">Operações em Andamento</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <ProgressRow label="Produção" color="purple" percentual={percentualProducao} detail={`${kpis.producao.opsEmAndamento} OPs em andamento`} />
          {kpis.expedicao.entregasHoje > 0 && (
            <ProgressRow label="Entregas Hoje" color="orange" percentual={percentualEntregas} detail={`${kpis.expedicao.realizadas} de ${kpis.expedicao.entregasHoje} concluídas`} />
          )}
        </CardContent>
      </Card>

      {kpis.pedidos.aguardandoAprovacao > 3 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-purple-600" />
                <div className="flex-1">
                  <p className="font-bold text-purple-900">IA: {kpis.pedidos.aguardandoAprovacao} pedidos aguardando aprovação</p>
                  <p className="text-sm text-purple-700">Ação sugerida: Revisar e aprovar pedidos urgentes para não atrasar produção</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="text-center text-xs text-slate-500">
        <Activity className="w-3 h-3 inline mr-1" />
        Atualizado automaticamente conforme o intervalo seguro do painel
      </div>
    </>
  );
}

/** @param {{ icon: React.ElementType, color: 'orange' | 'red', title: string, detail: string }} props */
function RealtimeAlert({ icon: Icon, color, title, detail }) {
  const styles = color === 'orange'
    ? { card: 'border-orange-300 bg-orange-50', icon: 'text-orange-600', title: 'text-orange-900', detail: 'text-orange-700' }
    : { card: 'border-red-300 bg-red-50', icon: 'text-red-600', title: 'text-red-900', detail: 'text-red-700' };
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={styles.card}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Icon className={`w-8 h-8 ${styles.icon}`} />
            <div>
              <p className={`font-semibold ${styles.title}`}>{title}</p>
              <p className={`text-sm ${styles.detail}`}>{detail}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** @param {{ label: string, color: 'purple' | 'orange', percentual: number, detail: string }} props */
function ProgressRow({ label, color, percentual, detail }) {
  const textColor = color === 'purple' ? 'text-purple-600' : 'text-orange-600';
  const barColor = color === 'purple' ? 'from-purple-500 to-purple-600' : 'from-orange-500 to-orange-600';
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className={`text-sm font-semibold ${textColor}`}>{Math.round(percentual)}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-3">
        <motion.div
          className={`bg-gradient-to-r ${barColor} h-3 rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${percentual}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <p className="text-xs text-slate-500 mt-1">{detail}</p>
    </div>
  );
}
