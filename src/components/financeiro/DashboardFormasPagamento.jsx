import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, DollarSign, Zap, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import HeaderFormasCompacto from './formas-pagamento/HeaderFormasCompacto';
import KPIsFormas from './formas-pagamento/KPIsFormas';
import useContextoVisual from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

export default function DashboardFormasPagamento({ windowMode = false }) {
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewDashboard = hasPermission('Financeiro', 'Formas de Pagamento', 'visualizar') ||
    hasPermission('Financeiro', 'Relatorios', 'visualizar') ||
    hasPermission('Financeiro', null, 'visualizar');

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ['formas-pagamento', contextKey],
    queryFn: () => filterInContext('FormaPagamento', {}, 'descricao', 500),
    enabled: contextoValido && canViewDashboard,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-analytics-formas', contextKey],
    queryFn: () => filterInContext('Pedido', {}, '-created_date', 1000),
    enabled: contextoValido && canViewDashboard,
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contas-receber-analytics-formas', contextKey],
    queryFn: () => filterInContext('ContaReceber', {}, '-created_date', 1000),
    enabled: contextoValido && canViewDashboard,
  });

  const { data: movimentosCaixa = [] } = useQuery({
    queryKey: ['movimentos-caixa-analytics', contextKey],
    queryFn: () => filterInContext('CaixaMovimento', {}, '-data_movimento', 1000),
    enabled: contextoValido && canViewDashboard,
  });

  const analisarUso = () => {
    const usoPorForma = {};
    
    formasPagamento.forEach(f => {
      const usoPedidos = pedidos.filter(p => p.forma_pagamento === f.descricao).length;
      const usoContas = contasReceber.filter(c => c.forma_recebimento === f.descricao).length;
      const usoCaixa = movimentosCaixa.filter(m => m.forma_pagamento === f.descricao).length;
      
      const valorPedidos = pedidos.filter(p => p.forma_pagamento === f.descricao).reduce((sum, p) => sum + (p.valor_total || 0), 0);
      const valorContas = contasReceber.filter(c => c.forma_recebimento === f.descricao).reduce((sum, c) => sum + (c.valor_recebido || c.valor || 0), 0);

      usoPorForma[f.descricao] = {
        forma: f,
        total_usos: usoPedidos + usoContas + usoCaixa,
        pedidos: usoPedidos,
        contas: usoContas,
        caixa: usoCaixa,
        valor_total: valorPedidos + valorContas,
        ticket_medio: (usoPedidos + usoContas) > 0 ? (valorPedidos + valorContas) / (usoPedidos + usoContas) : 0
      };
    });
    
    return Object.values(usoPorForma).sort((a, b) => b.valor_total - a.valor_total);
  };

  const dadosAnalytics = analisarUso();
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];

  const totalAtivas = formasPagamento.filter(f => f.ativa).length;
  const totalPDV = formasPagamento.filter(f => f.disponivel_pdv).length;
  const totalEcommerce = formasPagamento.filter(f => f.disponivel_ecommerce).length;
  const totalIntegradas = formasPagamento.filter(f => f.gerar_cobranca_online).length;

  const content = (
    <div
      className="space-y-1.5 w-full h-full"
      data-permission="Financeiro.Formas de Pagamento.visualizar"
      data-context-required="group-or-company"
    >
      {(!contextoValido || !canViewDashboard) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertDescription>
            Selecione grupo ou empresa e confirme permissao para visualizar formas de pagamento.
          </AlertDescription>
        </Alert>
      )}
      <HeaderFormasCompacto />
      <KPIsFormas totalAtivas={totalAtivas} totalPDV={totalPDV} totalEcommerce={totalEcommerce} totalIntegradas={totalIntegradas} />

      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
        <Card className="border-0 shadow-sm">
          <CardHeader className="bg-slate-50 border-b py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Volume de Transações
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dadosAnalytics.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="forma.descricao" angle={-45} textAnchor="end" height={80} style={{ fontSize: '10px' }} />
                <YAxis style={{ fontSize: '10px' }} />
                <Tooltip />
                <Bar dataKey="total_usos" fill="#3b82f6" name="Usos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="bg-slate-50 border-b py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Valor Transacionado
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={dadosAnalytics.filter(d => d.valor_total > 0).slice(0, 8)}
                  dataKey="valor_total"
                  nameKey="forma.descricao"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `R$ ${(entry.valor_total / 1000).toFixed(0)}k`}
                  style={{ fontSize: '10px' }}
                >
                  {dadosAnalytics.filter(d => d.valor_total > 0).slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="bg-green-100 border-b border-green-200 py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2 text-green-900">
              <TrendingUp className="w-4 h-4" />
              Top 5 por Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="space-y-2">
              {dadosAnalytics.slice(0, 5).map((item, index) => (
                <div key={item.forma.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-600 text-white text-xs">#{index + 1}</Badge>
                    <span className="text-lg">{item.forma.icone}</span>
                    <p className="font-semibold text-sm">{item.forma.descricao}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">{item.total_usos}</p>
                    <p className="text-xs text-slate-500">transações</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="bg-blue-100 border-b border-blue-200 py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-900">
              <DollarSign className="w-4 h-4" />
              Top 5 por Valor
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="space-y-2">
              {dadosAnalytics.filter(d => d.valor_total > 0).slice(0, 5).map((item, index) => (
                <div key={item.forma.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600 text-white text-xs">#{index + 1}</Badge>
                    <span className="text-lg">{item.forma.icone}</span>
                    <div>
                      <p className="font-semibold text-sm">{item.forma.descricao}</p>
                      <p className="text-xs text-slate-500">
                        Ticket: R$ {item.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">
                      R$ {item.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 min-h-[120px] max-h-[120px]">
        <CardHeader className="bg-gradient-to-r from-purple-100 to-blue-100 border-b py-2 px-3">
          <CardTitle className="text-sm flex items-center gap-2 text-purple-900">
            <Zap className="w-4 h-4" />
            🤖 Recomendações da IA
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 space-y-1 overflow-auto">
          {dadosAnalytics.filter(d => d.total_usos === 0).length > 0 && (
            <Alert className="border-orange-300 bg-orange-50 py-1 px-2">
              <AlertDescription className="text-xs">
                <strong>⚠️ Sem uso:</strong> {dadosAnalytics.filter(d => d.total_usos === 0).map(d => d.forma.descricao).join(', ')}
              </AlertDescription>
            </Alert>
          )}
          
          {dadosAnalytics[0]?.total_usos > 0 && (
            <Alert className="border-green-300 bg-green-50 py-1 px-2">
              <AlertDescription className="text-xs">
                <strong>🏆 Destaque:</strong> {dadosAnalytics[0].forma.descricao} - {dadosAnalytics[0].total_usos} transações
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-indigo-50 overflow-auto p-1.5">{content}</div>;
  }

  return content;
}
