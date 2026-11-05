import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Download, Calendar, DollarSign, Filter } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

/**
 * RELATÓRIO AVANÇADO DE FORMAS DE PAGAMENTO V21.8
 * Análise temporal, comparativo e exportação
 */
export default function RelatorioFormasPagamento() {
  const [periodo, setPeriodo] = useState(30); // dias
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId);

  // Escopo multiempresa: sem list unscoped; enabled exige contexto; erro ≠ zero KPI.
  const { data: formasPagamento = [], isError: isErrorFormas } = useQuery({
    queryKey: ['formas-pagamento-relatorio', groupId, empresaAtual?.id],
    queryFn: () => filterInContext('FormaPagamento', {}, 'descricao', 500),
    enabled: contextoValido,
  });

  const { data: pedidos = [], isError: isErrorPedidos } = useQuery({
    queryKey: ['pedidos-relatorio', groupId, empresaAtual?.id, periodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), periodo);
      const todos = await filterInContext('Pedido', {}, '-created_date', 2000);
      return todos.filter(p => new Date(p.data_pedido) >= dataInicio);
    },
    enabled: contextoValido,
  });

  const { data: contasReceber = [], isError: isErrorContas } = useQuery({
    queryKey: ['contas-receber-relatorio', groupId, empresaAtual?.id, periodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), periodo);
      const todas = await filterInContext('ContaReceber', {}, '-created_date', 2000);
      return todas.filter(c => new Date(c.data_emissao) >= dataInicio);
    },
    enabled: contextoValido,
  });

  const { data: movimentosCaixa = [], isError: isErrorMovimentos } = useQuery({
    queryKey: ['movimentos-caixa-relatorio', groupId, empresaAtual?.id, periodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), periodo);
      const todos = await filterInContext('CaixaMovimento', {}, '-data_movimento', 2000);
      return todos.filter(m => new Date(m.data_movimento) >= dataInicio);
    },
    enabled: contextoValido,
  });

  const cargaIndisponivel = isErrorFormas || isErrorPedidos || isErrorContas || isErrorMovimentos;

  // ANALYTICS TEMPORAL
  const gerarDadosTemporal = () => {
    const dados = [];
    for (let i = periodo; i >= 0; i--) {
      const data = subDays(new Date(), i);
      const dataStr = format(data, 'dd/MM');
      
      const registro = { data: dataStr };
      
      formasPagamento.forEach(forma => {
        const pedidosDia = pedidos.filter(p => 
          format(new Date(p.data_pedido), 'dd/MM') === dataStr && 
          p.forma_pagamento === forma.descricao
        );
        const valorDia = pedidosDia.reduce((sum, p) => sum + (p.valor_total || 0), 0);
        registro[forma.descricao] = valorDia;
      });
      
      dados.push(registro);
    }
    return dados;
  };

  const dadosTemporal = gerarDadosTemporal();
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];

  // TOTALIZADORES
  const totalizadores = formasPagamento.map(forma => {
    const pedidosForma = pedidos.filter(p => p.forma_pagamento === forma.descricao);
    const contasForma = contasReceber.filter(c => c.forma_recebimento === forma.descricao);
    const movimentosForma = movimentosCaixa.filter(m => m.forma_pagamento === forma.descricao);
    
    const valorPedidos = pedidosForma.reduce((sum, p) => sum + (p.valor_total || 0), 0);
    const valorContas = contasForma.reduce((sum, c) => sum + (c.valor_recebido || c.valor || 0), 0);
    const valorMovimentos = movimentosForma.reduce((sum, m) => sum + (m.valor || 0), 0);
    
    return {
      forma,
      pedidos: pedidosForma.length,
      contas: contasForma.length,
      movimentos: movimentosForma.length,
      valor_total: valorPedidos + valorContas + valorMovimentos,
      ticket_medio: (pedidosForma.length + contasForma.length) > 0 
        ? (valorPedidos + valorContas) / (pedidosForma.length + contasForma.length) 
        : 0
    };
  }).sort((a, b) => b.valor_total - a.valor_total);

  const valorTotalGeral = totalizadores.reduce((sum, t) => sum + t.valor_total, 0);

  const exportarCSV = () => {
    const headers = ['Forma de Pagamento', 'Tipo', 'Pedidos', 'Contas', 'Movimentos', 'Valor Total', 'Ticket Médio', '% do Total'];
    const rows = totalizadores.map(t => [
      t.forma.descricao,
      t.forma.tipo,
      t.pedidos,
      t.contas,
      t.movimentos,
      t.valor_total.toFixed(2),
      t.ticket_medio.toFixed(2),
      ((t.valor_total / valorTotalGeral) * 100).toFixed(1) + '%'
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-formas-pagamento-${periodo}dias.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {(cargaIndisponivel || !contextoValido) && (
        <p className="text-xs text-slate-500">
          {!contextoValido
            ? 'Selecione um grupo ou empresa para carregar o relatório de formas de pagamento.'
            : 'Relatório indisponível (erro de carga ≠ zero).'}
        </p>
      )}
      {/* CONTROLES */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button 
            variant={periodo === 7 ? 'default' : 'outline'}
            onClick={() => setPeriodo(7)}
            size="sm"
          >
            7 dias
          </Button>
          <Button 
            variant={periodo === 30 ? 'default' : 'outline'}
            onClick={() => setPeriodo(30)}
            size="sm"
          >
            30 dias
          </Button>
          <Button 
            variant={periodo === 90 ? 'default' : 'outline'}
            onClick={() => setPeriodo(90)}
            size="sm"
          >
            90 dias
          </Button>
        </div>
        <Button
          onClick={exportarCSV}
          className="bg-green-600 hover:bg-green-700"
          disabled={!contextoValido || cargaIndisponivel || totalizadores.length === 0}
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* GRÁFICO TEMPORAL */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Evolução nos últimos {periodo} dias
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={dadosTemporal}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="data" />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <Legend />
              {formasPagamento.slice(0, 5).map((forma, index) => (
                <Line 
                  key={forma.id}
                  type="monotone" 
                  dataKey={forma.descricao} 
                  stroke={COLORS[index]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* DISTRIBUIÇÃO PERCENTUAL */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Distribuição por Valor
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={totalizadores.filter(t => t.valor_total > 0)}
                  dataKey="valor_total"
                  nameKey="forma.descricao"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${((entry.valor_total / valorTotalGeral) * 100).toFixed(0)}%`}
                >
                  {totalizadores.filter(t => t.valor_total > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Volume de Transações
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={totalizadores.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="forma.descricao" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="pedidos" fill="#3b82f6" name="Pedidos" stackId="a" />
                <Bar dataKey="contas" fill="#10b981" name="Contas" stackId="a" />
                <Bar dataKey="movimentos" fill="#f59e0b" name="Movimentos" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* TABELA DETALHADA */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle>Detalhamento por Forma</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 border-b">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold">Forma</th>
                  <th className="text-center p-3 text-xs font-semibold">Pedidos</th>
                  <th className="text-center p-3 text-xs font-semibold">Contas</th>
                  <th className="text-center p-3 text-xs font-semibold">Movimentos</th>
                  <th className="text-right p-3 text-xs font-semibold">Valor Total</th>
                  <th className="text-right p-3 text-xs font-semibold">Ticket Médio</th>
                  <th className="text-right p-3 text-xs font-semibold">% do Total</th>
                </tr>
              </thead>
              <tbody>
                {totalizadores.map((item, index) => (
                  <tr key={item.forma.id} className="border-b hover:bg-slate-50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{item.forma.icone}</span>
                        <span className="font-semibold text-sm">{item.forma.descricao}</span>
                      </div>
                    </td>
                    <td className="text-center p-3 text-sm">{item.pedidos}</td>
                    <td className="text-center p-3 text-sm">{item.contas}</td>
                    <td className="text-center p-3 text-sm">{item.movimentos}</td>
                    <td className="text-right p-3 font-bold text-sm">
                      R$ {item.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right p-3 text-sm">
                      R$ {item.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right p-3">
                      <Badge className={index < 3 ? 'bg-green-600' : 'bg-slate-600'}>
                        {((item.valor_total / valorTotalGeral) * 100).toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-bold border-t-2">
                  <td className="p-3">TOTAL GERAL</td>
                  <td className="text-center p-3">{totalizadores.reduce((s, t) => s + t.pedidos, 0)}</td>
                  <td className="text-center p-3">{totalizadores.reduce((s, t) => s + t.contas, 0)}</td>
                  <td className="text-center p-3">{totalizadores.reduce((s, t) => s + t.movimentos, 0)}</td>
                  <td className="text-right p-3 text-blue-900">
                    R$ {valorTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right p-3">-</td>
                  <td className="text-right p-3">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}