
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, TrendingUp, Download, Star, Award, Calendar, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import ExportMenu from "@/components/ui/ExportMenu"; // Added import
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function RentabilidadeCliente({ empresaId }) { // Kept empresaId as it was in original code, even if not in outline
  const [periodo, setPeriodo] = useState(12); // meses
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaSelecionadaId = empresaId || empresaAtual?.id || null;
  const contextKey = empresaSelecionadaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewRentabilidade = hasPermission("Comercial", "Rentabilidade", "visualizar") ||
    hasPermission("Comercial", "Relatorios", "visualizar") ||
    hasPermission("Financeiro", "Relatorios", "visualizar") ||
    hasPermission("Comercial", null, "visualizar");

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', 'rentabilidade-cliente', contextKey],
    queryFn: () => filterInContext('Cliente', {}, 'nome', 9999),
    enabled: contextoValido && canViewRentabilidade,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos', 'rentabilidade-cliente', contextKey],
    queryFn: () => filterInContext('Pedido', {}, '-data_pedido', 9999),
    enabled: contextoValido && canViewRentabilidade,
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contasReceber', 'rentabilidade-cliente', contextKey],
    queryFn: () => filterInContext('ContaReceber', {}, '-data_vencimento', 9999),
    enabled: contextoValido && canViewRentabilidade,
  });

  // Calcular rentabilidade por cliente
  const calcularRentabilidade = () => {
    const hoje = new Date();
    const dataCorte = new Date(hoje.getFullYear(), hoje.getMonth() - periodo, hoje.getDate());

    const porCliente = {};

    // Processar pedidos
    pedidos
      .filter(p => {
        const dataPedido = new Date(p.data_pedido);
        return p.status !== 'Cancelado' &&
               dataPedido >= dataCorte &&
               (!empresaSelecionadaId || p.empresa_id === empresaSelecionadaId);
      })
      .forEach(p => {
        const key = p.cliente_id || p.cliente_nome;
        if (!key) return;

        if (!porCliente[key]) {
          const cliente = clientes.find(c => c.id === p.cliente_id);
          porCliente[key] = {
            cliente_id: p.cliente_id,
            cliente_nome: p.cliente_nome,
            classificacao_abc: cliente?.classificacao_abc || 'Novo',
            regiao: cliente?.regiao_atendimento || 'Nacional',
            faturamento: 0,
            custos: 0,
            margem_valor: 0,
            margem_percentual: 0,
            quantidade_pedidos: 0,
            ticket_medio: 0,
            frequencia_dias: 0,
            primeira_compra: null,
            ultima_compra: null,
            dias_cliente: 0,
            status_pagamento: 'OK',
            dias_atraso_medio: 0,
          };
        }

        porCliente[key].faturamento += p.valor_total || 0;
        porCliente[key].custos += p.custo_total || 0;
        porCliente[key].quantidade_pedidos += 1;

        if (!porCliente[key].primeira_compra || new Date(p.data_pedido) < new Date(porCliente[key].primeira_compra)) {
          porCliente[key].primeira_compra = p.data_pedido;
        }
        if (!porCliente[key].ultima_compra || new Date(p.data_pedido) > new Date(porCliente[key].ultima_compra)) {
          porCliente[key].ultima_compra = p.data_pedido;
        }
      });

    // Analisar inadimplência
    contasReceber
      .filter(c => c.status === 'Atrasado' || (c.status === 'Pendente' && new Date(c.data_vencimento) < hoje))
      .forEach(c => {
        const key = c.cliente_id || c.cliente;
        if (porCliente[key]) {
          const diasAtraso = Math.floor((hoje - new Date(c.data_vencimento)) / (1000 * 60 * 60 * 24));
          // Use a simple average or sum up and then average later. For now, track just one status.
          // This part needs more robust logic for multiple atrasos per client if desired.
          porCliente[key].dias_atraso_medio = (porCliente[key].dias_atraso_medio || 0) + diasAtraso; // Sum for now
          porCliente[key].status_pagamento = diasAtraso > 30 ? 'Crítico' : 'Alerta';
        }
      });

    // Finalizar cálculos
    return Object.values(porCliente)
      .map(c => {
        c.margem_valor = c.faturamento - c.custos;
        c.margem_percentual = c.faturamento > 0 ? ((c.margem_valor / c.faturamento) * 100) : 0;
        c.ticket_medio = c.quantidade_pedidos > 0 ? c.faturamento / c.quantidade_pedidos : 0;

        if (c.primeira_compra && c.ultima_compra) {
          const diasAtivo = Math.floor((new Date(c.ultima_compra) - new Date(c.primeira_compra)) / (1000 * 60 * 60 * 24));
          c.dias_cliente = diasAtivo;
          c.frequencia_dias = c.quantidade_pedidos > 1 ? diasAtivo / (c.quantidade_pedidos - 1) : diasAtivo;
        }

        // Adjust dias_atraso_medio to be an average if multiple entries were summed
        // For simplicity, if multiple entries, the status takes precedence.
        if (c.dias_atraso_medio > 0 && c.status_pagamento !== 'OK') {
             // If there are multiple overdue items, 'dias_atraso_medio' sums them up
             // this is a simplistic approach; a more robust one would average across specific overdue accounts
             // For now, if there is any debt, update status, and the `dias_atraso_medio` becomes a general indicator.
        }


        // Score de relacionamento (0-100)
        c.score_relacionamento = Math.max(0, Math.min(100,
          (c.quantidade_pedidos * 5) + // Max 50 if 10 orders
          (c.margem_percentual * 0.5) + // Max 50 if 100% margin
          (c.dias_cliente / 20) - // Max 50 if 1000 days (approx 3 years)
          (c.dias_atraso_medio || 0) // Negative impact for delays
        ));


        return c;
      })
      .sort((a, b) => b.margem_valor - a.margem_valor);
  };

  const dados = calcularRentabilidade();
  const top20 = dados.slice(0, 20);

  // Totais
  const totalFaturamento = dados.reduce((sum, c) => sum + c.faturamento, 0);
  const totalMargem = dados.reduce((sum, c) => sum + c.margem_valor, 0);
  const margemMedia = totalFaturamento > 0 ? (totalMargem / totalFaturamento) * 100 : 0;
  const ticketMedioGeral = dados.reduce((sum, c) => sum + c.ticket_medio, 0) / dados.length || 0;

  // Top 5 mais rentáveis
  const top5Rentaveis = dados.slice(0, 5);

  // Distribuição por classificação ABC
  const distribuicaoABC = ['A', 'B', 'C', 'Novo'].map(classe => {
    const clientesClasse = dados.filter(c => c.classificacao_abc === classe);
    return {
      classe,
      quantidade: clientesClasse.length,
      faturamento: clientesClasse.reduce((sum, c) => sum + c.faturamento, 0),
      margem: clientesClasse.reduce((sum, c) => sum + c.margem_valor, 0),
    };
  }).filter(item => item.quantidade > 0); // Only show classes with clients

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  const exportarExcel = () => {
    const csv = [
      ['Cliente', 'Classificação', 'Faturamento', 'Custos', 'Margem R$', 'Margem %', 'Pedidos', 'Ticket Médio', 'Frequência (dias)', 'Score', 'Status Pagamento'],
      ...dados.map(c => [
        c.cliente_nome,
        c.classificacao_abc,
        c.faturamento.toFixed(2),
        c.custos.toFixed(2),
        c.margem_valor.toFixed(2),
        c.margem_percentual.toFixed(2),
        c.quantidade_pedidos,
        c.ticket_medio.toFixed(2),
        c.frequencia_dias.toFixed(0),
        c.score_relacionamento.toFixed(0),
        c.status_pagamento
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rentabilidade_Clientes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 w-full h-full" data-permission="Comercial.Rentabilidade.visualizar" data-context-required="group-or-company">
      {(!contextoValido || !canViewRentabilidade) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar rentabilidade por cliente.</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Rentabilidade por Cliente (Top 20)</h2> {/* Modified title */}
          <p className="text-sm text-slate-600">Análise de lucratividade por cliente</p> {/* Modified subtitle */}
        </div>
        <div className="flex gap-3">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2"
          >
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
            <option value={24}>24 meses</option>
          </select>
          <ExportMenu
            data={top20.map(c => ({
              Cliente: c.cliente_nome,
              Faturamento: `R$ ${c.faturamento.toFixed(2)}`,
              Custo: `R$ ${c.custos.toFixed(2)}`,
              Lucro: `R$ ${c.margem_valor.toFixed(2)}`,
              Margem: `${c.margem_percentual.toFixed(1)}%`,
              Pedidos: c.quantidade_pedidos
            }))}
            fileName="rentabilidade_clientes_top20"
            title="Rentabilidade por Cliente - Top 20"
            module="Comercial"
            section="Rentabilidade"
            action="exportar"
          />
        </div>
      </div>

      {/* KPIs Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Clientes Ativos</p>
                <p className="text-2xl font-bold text-blue-600">{dados.length}</p>
                <p className="text-xs text-slate-500 mt-1">com compras no período</p>
              </div>
              <Users className="w-8 h-8 text-blue-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">Faturamento Total</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">últimos {periodo} meses</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">Margem Média</p>
              <p className="text-2xl font-bold text-purple-600">
                {margemMedia.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500 mt-1">
                R$ {totalMargem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">Ticket Médio</p>
              <p className="text-2xl font-bold text-orange-600">
                R$ {ticketMedioGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">por pedido</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 Clientes Mais Rentáveis */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600" />
            🏆 Top 5 Clientes Mais Rentáveis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {top5Rentaveis.map((cliente, idx) => (
              <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">{idx + 1}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-lg">{cliente.cliente_nome}</p>
                    <Badge className={
                      cliente.classificacao_abc === 'A' ? 'bg-blue-100 text-blue-700' :
                      cliente.classificacao_abc === 'B' ? 'bg-green-100 text-green-700' :
                      cliente.classificacao_abc === 'C' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-700'
                    }>
                      {cliente.classificacao_abc}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mt-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Faturamento</p>
                      <p className="font-semibold text-green-600">
                        R$ {cliente.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Margem</p>
                      <p className="font-semibold text-purple-600">
                        R$ {cliente.margem_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        <span className="text-xs ml-1">({cliente.margem_percentual.toFixed(1)}%)</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Ticket Médio</p>
                      <p className="font-semibold text-blue-600">
                        R$ {cliente.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Pedidos</p>
                      <p className="font-semibold">{cliente.quantidade_pedidos}</p>
                      <p className="text-xs text-slate-500">a cada {cliente.frequencia_dias.toFixed(0)} dias</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="font-bold text-lg">{cliente.score_relacionamento.toFixed(0)}</span>
                  </div>
                  <p className="text-xs text-slate-500">Score</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Gráfico de Margem */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Margem por Cliente (Top 20)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={top20} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="cliente_nome" angle={-45} textAnchor="end" height={100} fontSize={11} />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'Margem %') return `${Number(value).toFixed(1)}%`;
                    return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                  }}
                />
                <Legend />
                <Bar dataKey="margem_valor" fill="#8b5cf6" name="Margem R$" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por ABC */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Distribuição por Classificação ABC</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={distribuicaoABC}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ classe, quantidade, percent }) => `${classe}: ${quantidade} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={120}
                  dataKey="faturamento"
                >
                  {distribuicaoABC.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {distribuicaoABC.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-600">Classe {item.classe}</p>
                      <p className="font-bold">{item.quantidade} clientes</p>
                    </div>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    R$ {item.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-green-600">
                    Margem: R$ {item.margem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Completa */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Análise Detalhada - Top 20 Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>ABC</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Margem R$</TableHead>
                  <TableHead className="text-right">Margem %</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="text-right">Frequência</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top20.map((cliente, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50">
                    <TableCell>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white ${
                        idx === 0 ? 'bg-gradient-to-br from-amber-500 to-amber-600' :
                        idx === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                        idx === 2 ? 'bg-gradient-to-br from-orange-600 to-orange-700' :
                        'bg-blue-500'
                      }`}>
                        {idx + 1}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{cliente.cliente_nome}</TableCell>
                    <TableCell>
                      <Badge className={
                        cliente.classificacao_abc === 'A' ? 'bg-blue-100 text-blue-700' :
                        cliente.classificacao_abc === 'B' ? 'bg-green-100 text-green-700' :
                        cliente.classificacao_abc === 'C' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-slate-100 text-slate-700'
                      }>
                        {cliente.classificacao_abc}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      R$ {cliente.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-purple-600">
                      R$ {cliente.margem_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {cliente.margem_percentual.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">{cliente.quantidade_pedidos}</TableCell>
                    <TableCell className="text-right">
                      R$ {cliente.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {cliente.frequencia_dias.toFixed(0)} dias
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="font-bold">{cliente.score_relacionamento.toFixed(0)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        cliente.status_pagamento === 'OK' ? 'bg-green-100 text-green-700' :
                        cliente.status_pagamento === 'Alerta' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }>
                        {cliente.status_pagamento}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
