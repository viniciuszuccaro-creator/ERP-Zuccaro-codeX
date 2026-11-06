import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Clock, DollarSign } from 'lucide-react';

export default function AlertasFinanceirosEmpresa({ empresaId, groupId, windowMode = false }) {
  const { data: contasPagar = [] } = useQuery({
    queryKey: ['alertas-pagar', empresaId],
    queryFn: () => base44.entities.ContaPagar.filter(
      empresaId ? { empresa_id: empresaId } : { group_id: groupId }
    ),
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['alertas-receber', empresaId],
    queryFn: () => base44.entities.ContaReceber.filter(
      empresaId ? { empresa_id: empresaId } : { group_id: groupId }
    ),
  });

  const { data: conciliacoes = [] } = useQuery({
    queryKey: ['alertas-conciliacao', empresaId],
    queryFn: () => base44.entities.ConciliacaoBancaria.filter({ 
      status: 'Pendente',
      ...(empresaId ? { empresa_id: empresaId } : { group_id: groupId })
    }),
  });

  const { data: pedidosAprovacao = [] } = useQuery({
    queryKey: ['alertas-aprovacao', empresaId],
    queryFn: async () => {
      const pedidos = await base44.entities.Pedido.list();
      return pedidos.filter(p => 
        p.status_aprovacao === 'pendente' && 
        (empresaId ? p.empresa_id === empresaId : p.group_id === groupId)
      );
    },
  });

  const hoje = new Date();
  const pagarVencendo = contasPagar.filter(c => {
    const venc = new Date(c.data_vencimento);
    const diffDias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return c.status === 'Pendente' && diffDias >= 0 && diffDias <= 3;
  });

  const pagarVencidas = contasPagar.filter(c => 
    c.status === 'Atrasado' || (c.status === 'Pendente' && new Date(c.data_vencimento) < hoje)
  );

  const receberVencendo = contasReceber.filter(c => {
    const venc = new Date(c.data_vencimento);
    const diffDias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return c.status === 'Pendente' && diffDias >= 0 && diffDias <= 3;
  });

  const receberVencidas = contasReceber.filter(c => 
    c.status === 'Atrasado' || (c.status === 'Pendente' && new Date(c.data_vencimento) < hoje)
  );

  const alertas = [
    {
      tipo: 'Pagar Vencidas',
      quantidade: pagarVencidas.length,
      valor: pagarVencidas.reduce((acc, c) => acc + (c.valor || 0), 0),
      cor: 'red',
      icon: AlertTriangle
    },
    {
      tipo: 'Pagar Vencendo (3 dias)',
      quantidade: pagarVencendo.length,
      valor: pagarVencendo.reduce((acc, c) => acc + (c.valor || 0), 0),
      cor: 'orange',
      icon: Clock
    },
    {
      tipo: 'Receber Vencidas',
      quantidade: receberVencidas.length,
      valor: receberVencidas.reduce((acc, c) => acc + (c.valor || 0), 0),
      cor: 'red',
      icon: AlertTriangle
    },
    {
      tipo: 'Receber Vencendo (3 dias)',
      quantidade: receberVencendo.length,
      valor: receberVencendo.reduce((acc, c) => acc + (c.valor || 0), 0),
      cor: 'yellow',
      icon: Clock
    },
    {
      tipo: 'Conciliações Pendentes',
      quantidade: conciliacoes.length,
      valor: conciliacoes.reduce((acc, c) => acc + Math.abs(c.valor_diferenca || 0), 0),
      cor: 'blue',
      icon: CheckCircle2
    },
    {
      tipo: 'Aprovações de Desconto',
      quantidade: pedidosAprovacao.length,
      valor: pedidosAprovacao.reduce((acc, p) => acc + (p.valor_total || 0), 0),
      cor: 'purple',
      icon: DollarSign
    }
  ];

  return (
    <div className={windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-4"}>
      <div className={windowMode ? "p-6 space-y-4 flex-1" : "space-y-4 p-6"}>
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="w-6 h-6 text-orange-600" />
        <h2 className="text-2xl font-bold text-slate-900">Alertas Financeiros</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alertas.map((alerta, idx) => {
          const Icon = alerta.icon;
          const corClasses = {
            red: 'border-red-200 bg-red-50',
            orange: 'border-orange-200 bg-orange-50',
            yellow: 'border-yellow-200 bg-yellow-50',
            blue: 'border-blue-200 bg-blue-50',
            purple: 'border-purple-200 bg-purple-50'
          };

          const corTexto = {
            red: 'text-red-700',
            orange: 'text-orange-700',
            yellow: 'text-yellow-700',
            blue: 'text-blue-700',
            purple: 'text-purple-700'
          };

          if (alerta.quantidade === 0) return null;

          return (
            <Card key={idx} className={`border-2 ${corClasses[alerta.cor]}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${corTexto[alerta.cor]}`}>{alerta.tipo}</p>
                    <p className={`text-3xl font-bold ${corTexto[alerta.cor]} mt-2`}>{alerta.quantidade}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      R$ {alerta.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Icon className={`w-8 h-8 ${corTexto[alerta.cor]} opacity-50`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {alertas.every(a => a.quantidade === 0) && (
        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <p className="text-lg font-semibold text-green-800">Tudo em ordem!</p>
            <p className="text-sm text-green-700 mt-2">Não há alertas financeiros pendentes no momento.</p>
          </CardContent>
        </Card>
      )}
    </div></div>
  );
}
