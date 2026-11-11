import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Package, DollarSign, Calendar } from 'lucide-react';
import { isPortalClienteIdentificado } from '@/components/lib/portalClientePolicy';

/**
 * V21.5 - Analytics Portal Cliente
 * ✅ Gráficos de compras ao longo do tempo
 * ✅ Análise de produtos mais comprados
 * ✅ Evolução de pedidos
 * ✅ Métricas de relacionamento
 * ✅ 100% Responsivo
 */
/** @param {{clienteId?: string}} props */
export default function AnalyticsPortalCliente({ clienteId }) {
  const { data: pedidos = [] } = useQuery({
    queryKey: ['analytics-pedidos', clienteId],
    queryFn: () => isPortalClienteIdentificado(clienteId) ? base44.entities.Pedido.filter({ cliente_id: clienteId }, '-data_pedido', 100) : Promise.resolve([]),
    enabled: isPortalClienteIdentificado(clienteId),
  });

  // Agregar pedidos por mês
  const pedidosPorMes = pedidos.reduce((acc, pedido) => {
    const mes = new Date(pedido.data_pedido).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    acc[mes] = (acc[mes] || 0) + 1;
    return acc;
  }, {});

  const dadosGraficoMensal = Object.entries(pedidosPorMes).map(([mes, count]) => ({
    mes,
    pedidos: count,
  })).slice(-12);

  // Valores por mês
  const valoresPorMes = pedidos.reduce((acc, pedido) => {
    const mes = new Date(pedido.data_pedido).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    acc[mes] = (acc[mes] || 0) + (pedido.valor_total || 0);
    return acc;
  }, {});

  const dadosValoresMensal = Object.entries(valoresPorMes).map(([mes, valor]) => ({
    mes,
    valor: valor / 1000, // Em milhares
  })).slice(-12);

  // Status de pedidos
  const pedidosPorStatus = pedidos.reduce((acc, pedido) => {
    acc[pedido.status] = (acc[pedido.status] || 0) + 1;
    return acc;
  }, {});

  const dadosStatusPie = Object.entries(pedidosPorStatus).map(([status, count]) => ({
    name: status,
    value: count,
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  if (!isPortalClienteIdentificado(clienteId)) return <p role="status">Cliente do portal nao identificado. Operacoes indisponiveis.</p>;
  return (
    <div className="space-y-6 w-full h-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Gráfico de Pedidos por Mês */}
        <Card className="shadow-lg w-full">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-5 h-5 text-blue-600" />
              Pedidos por Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 w-full">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dadosGraficoMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="pedidos" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Valores por Mês */}
        <Card className="shadow-lg w-full">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="w-5 h-5 text-green-600" />
              Valores por Mês (R$ mil)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 w-full">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dadosValoresMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="valor" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por Status */}
        <Card className="shadow-lg w-full">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Status dos Pedidos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={dadosStatusPie}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dadosStatusPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Métricas Gerais */}
        <Card className="shadow-lg w-full">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-5 h-5 text-orange-600" />
              Resumo do Relacionamento
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 w-full">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-slate-700">Total de Pedidos</span>
                <span className="text-2xl font-bold text-blue-600">{pedidos.length}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-sm text-slate-700">Valor Total</span>
                <span className="text-xl font-bold text-green-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    pedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-sm text-slate-700">Ticket Médio</span>
                <span className="text-xl font-bold text-purple-600">
                  {pedidos.length > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    pedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0) / pedidos.length
                  ) : 'R$ 0,00'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-sm text-slate-700">Pedidos Entregues</span>
                <span className="text-2xl font-bold text-orange-600">
                  {pedidos.filter(p => p.status === 'Entregue').length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
