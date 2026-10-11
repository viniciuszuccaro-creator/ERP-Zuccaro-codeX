import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users, 
  AlertCircle, 
  Activity, 
  BarChart3,
  Truck,
  Box,
  Factory,
  FileText,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import useContextoGrupoEmpresa from "@/components/lib/useContextoGrupoEmpresa";
import ProtectedSection from "@/components/security/ProtectedSection";

export default function DashboardCorporativo() {
  const { grupoAtual, empresasDoGrupo, estaNoGrupo } = useContextoGrupoEmpresa();
  
  const [periodoSelecionado, setPeriodoSelecionado] = useState("mes_atual");
  const [empresaSelecionada, setEmpresaSelecionada] = useState("todas");
  const [activeTab, setActiveTab] = useState("visao-geral");

  // Calcular datas baseado no período
  const getDateRange = () => {
    const hoje = new Date();
    let dataInicio, dataFim;

    switch (periodoSelecionado) {
      case "mes_atual":
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataFim = hoje;
        break;
      case "mes_anterior":
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
        break;
      case "trimestre":
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
        dataFim = hoje;
        break;
      case "semestre":
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
        dataFim = hoje;
        break;
      case "ano":
        dataInicio = new Date(hoje.getFullYear(), 0, 1);
        dataFim = hoje;
        break;
      default:
        dataInicio = new Date(hoje.getFullYear(), 0, 1);
        dataFim = hoje;
    }

    return { dataInicio: dataInicio.toISOString().split('T')[0], dataFim: dataFim.toISOString().split('T')[0] };
  };

  const { dataInicio, dataFim } = getDateRange();

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-dashboard', grupoAtual?.id],
    queryFn: () => estaNoGrupo
      ? base44.entities.Pedido.filter({ group_id: grupoAtual?.id }, '-created_date', 9999)
      : base44.entities.Pedido.list('-created_date', 9999),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-dashboard', grupoAtual?.id],
    queryFn: () => estaNoGrupo
      ? base44.entities.Cliente.filter({ group_id: grupoAtual?.id }, '-created_date', 9999)
      : base44.entities.Cliente.list('-created_date', 9999),
  });

  const { data: totalClientes = 0 } = useQuery({
    queryKey: ['clientes-count-corp', grupoAtual?.id],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('countEntities', {
          entityName: 'Cliente',
          filter: estaNoGrupo ? { group_id: grupoAtual?.id } : {}
        });
        return response.data?.count || clientes.length;
      } catch {
        return clientes.length;
      }
    },
    staleTime: 60000,
    retry: 1
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-dashboard'],
    queryFn: () => base44.entities.Empresa.list(),
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-dashboard', grupoAtual?.id],
    queryFn: () => estaNoGrupo
      ? base44.entities.Produto.filter({ group_id: grupoAtual?.id }, '-created_date', 9999)
      : base44.entities.Produto.list('-created_date', 9999),
  });

  const { data: totalProdutos = 0 } = useQuery({
    queryKey: ['produtos-count-corp', grupoAtual?.id],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('countEntities', {
          entityName: 'Produto',
          filter: estaNoGrupo ? { group_id: grupoAtual?.id } : {}
        });
        return response.data?.count || produtos.length;
      } catch {
        return produtos.length;
      }
    },
    staleTime: 60000,
    retry: 1
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contas-receber-dashboard', grupoAtual?.id],
    queryFn: () => estaNoGrupo
      ? base44.entities.ContaReceber.filter({ group_id: grupoAtual?.id }, '-created_date', 9999)
      : base44.entities.ContaReceber.list(),
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ['contas-pagar-dashboard', grupoAtual?.id],
    queryFn: () => estaNoGrupo
      ? base44.entities.ContaPagar.filter({ group_id: grupoAtual?.id }, '-created_date', 9999)
      : base44.entities.ContaPagar.list(),
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ['entregas-dashboard', grupoAtual?.id],
    queryFn: () => estaNoGrupo
      ? base44.entities.Entrega.filter({ group_id: grupoAtual?.id }, '-created_date', 9999)
      : base44.entities.Entrega.list('-created_date', 9999),
  });

  const { data: ordensProducao = [] } = useQuery({
    queryKey: ['ops-dashboard', grupoAtual?.id],
    queryFn: () => estaNoGrupo
      ? base44.entities.OrdemProducao.filter({ group_id: grupoAtual?.id }, '-created_date', 9999)
      : base44.entities.OrdemProducao.list(),
  });

  // Filtrar por período e empresa
  const pedidosFiltrados = pedidos.filter(p => {
    const dentroDataInicio = !dataInicio || p.data_pedido >= dataInicio;
    const dentroDataFim = !dataFim || p.data_pedido <= dataFim;
    const daEmpresa = empresaSelecionada === "todas" || p.empresa_id === empresaSelecionada;
    return dentroDataInicio && dentroDataFim && daEmpresa;
  });

  // KPIs Consolidados
  const totalVendas = pedidosFiltrados.reduce((sum, p) => sum + (p.valor_total || 0), 0);
  const totalPedidos = pedidosFiltrados.length;
  const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;
  const totalEmpresas = empresasDoGrupo.length;

  // Faturamento por Empresa
  const faturamentoPorEmpresa = {};
  pedidosFiltrados.forEach(p => {
    const empresaNome = empresasDoGrupo.find(e => e.id === p.empresa_id)?.nome_fantasia || 'Outros';
    faturamentoPorEmpresa[empresaNome] = (faturamentoPorEmpresa[empresaNome] || 0) + (p.valor_total || 0);
  });

  const dadosEmpresa = Object.entries(faturamentoPorEmpresa)
    .map(([empresa, valor]) => ({ empresa, valor }))
    .sort((a, b) => b.valor - a.valor);

  // Evolução Mensal
  const evolucaoMensal = {};
  pedidosFiltrados.forEach(p => {
    const mes = p.data_pedido ? new Date(p.data_pedido).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) : 'Sem data';
    evolucaoMensal[mes] = (evolucaoMensal[mes] || 0) + (p.valor_total || 0);
  });

  const dadosEvolucao = Object.entries(evolucaoMensal)
    .map(([mes, valor]) => ({ mes, valor }))
    .slice(-6);

  // KPIs Operacionais Consolidados
  const clientesAtivos = clientes.filter(c => {
    const daEmpresa = empresaSelecionada === "todas" || c.empresa_id === empresaSelecionada;
    return c.status === 'Ativo' && daEmpresa;
  }).length;

  const produtosAtivos = empresaSelecionada === "todas" 
    ? totalProdutos 
    : produtos.filter(p => p.empresa_id === empresaSelecionada && p.status === 'Ativo').length;

  const valorEstoqueTotal = produtos
    .filter(p => empresaSelecionada === "todas" || p.empresa_id === empresaSelecionada)
    .reduce((sum, p) => sum + ((p.estoque_atual || 0) * (p.custo_aquisicao || 0)), 0);

  const entregasPendentes = entregas.filter(e => {
    const daEmpresa = empresaSelecionada === "todas" || e.empresa_id === empresaSelecionada;
    return (e.status !== 'Entregue' && e.status !== 'Cancelado') && daEmpresa;
  }).length;

  const opsEmProducao = ordensProducao.filter(op => {
    const daEmpresa = empresaSelecionada === "todas" || op.empresa_id === empresaSelecionada;
    return (op.status === 'Em Produção' || op.status === 'Liberada') && daEmpresa;
  }).length;

  const receitasPendentes = contasReceber
    .filter(c => {
      const daEmpresa = empresaSelecionada === "todas" || c.empresa_id === empresaSelecionada;
      return c.status === 'Pendente' && daEmpresa;
    })
    .reduce((sum, c) => sum + (c.valor || 0), 0);

  const despesasPendentes = contasPagar
    .filter(c => {
      const daEmpresa = empresaSelecionada === "todas" || c.empresa_id === empresaSelecionada;
      return c.status === 'Pendente' && daEmpresa;
    })
    .reduce((sum, c) => sum + (c.valor || 0), 0);

  const fluxoCaixa = receitasPendentes - despesasPendentes;

  // Performance por Empresa
  const performancePorEmpresa = empresasDoGrupo.map(empresa => {
    const pedidosEmpresa = pedidosFiltrados.filter(p => p.empresa_id === empresa.id);
    const valorTotal = pedidosEmpresa.reduce((sum, p) => sum + (p.valor_total || 0), 0);
    const qtdPedidos = pedidosEmpresa.length;

    const entregasEmpresa = entregas.filter(e => e.empresa_id === empresa.id);
    const entregasConcluidas = entregasEmpresa.filter(e => e.status === 'Entregue');
    const entregasNoPrazo = entregasConcluidas.filter(e => {
      if (!e.data_previsao || !e.data_entrega) return false;
      return new Date(e.data_entrega) <= new Date(e.data_previsao);
    });
    const otd = entregasConcluidas.length > 0 
      ? ((entregasNoPrazo.length / entregasConcluidas.length) * 100).toFixed(1)
      : 0;

    return {
      id: empresa.id,
      nome: empresa.nome_fantasia || empresa.razao_social,
      faturamento: valorTotal,
      pedidos: qtdPedidos,
      otd: parseFloat(otd),
      tipo: empresa.tipo
    };
  }).sort((a, b) => b.faturamento - a.faturamento);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (!estaNoGrupo) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <Card className="border-2 border-orange-300 bg-orange-50 shadow-xl max-w-2xl">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-orange-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-orange-900 mb-3">
              Dashboard Corporativo Indisponível
            </h2>
            <p className="text-orange-700 mb-4">
              Este dashboard é exclusivo para visão consolidada do grupo empresarial.
            </p>
            <p className="text-sm text-orange-600">
              Use o <strong>EmpresaSwitcher</strong> no header para mudar para o contexto de grupo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ProtectedSection module="Dashboard" section={["Corporativo"]} action="visualizar">
    <div className="w-full h-full min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Header com Filtros */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Building2 className="w-8 h-8 text-blue-600" />
              Dashboard Corporativo
            </h1>
            <p className="text-slate-600 mt-1">
              {grupoAtual?.nome_do_grupo || 'Grupo'} • {totalEmpresas} empresa(s) • Visão Consolidada
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
              <SelectTrigger className="w-48">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes_atual">Mês Atual</SelectItem>
                <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                <SelectItem value="trimestre">Último Trimestre</SelectItem>
                <SelectItem value="semestre">Último Semestre</SelectItem>
                <SelectItem value="ano">Ano Completo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
              <SelectTrigger className="w-48">
                <Building2 className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrar por empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Empresas</SelectItem>
                {empresasDoGrupo.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome_fantasia || emp.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs de Navegação */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border shadow-sm w-full flex-wrap h-auto">
            <TabsTrigger value="visao-geral" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-2" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Activity className="w-4 h-4 mr-2" />
              Performance por Empresa
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <DollarSign className="w-4 h-4 mr-2" />
              Consolidado Financeiro
            </TabsTrigger>
            <TabsTrigger value="operacional" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
              <Factory className="w-4 h-4 mr-2" />
              Operacional
            </TabsTrigger>
          </TabsList>

          {/* ABA: Visão Geral */}
          <TabsContent value="visao-geral" className="space-y-6 mt-6">
            {/* KPIs Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-700 font-medium">Faturamento Total</p>
                      <p className="text-3xl font-bold text-blue-900 mt-2">
                        R$ {totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">{totalPedidos} pedidos</p>
                    </div>
                    <DollarSign className="w-12 h-12 text-blue-600 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-700 font-medium">Ticket Médio</p>
                      <p className="text-3xl font-bold text-green-900 mt-2">
                        R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-green-600 mt-1">por pedido</p>
                    </div>
                    <TrendingUp className="w-12 h-12 text-green-600 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-700 font-medium">Fluxo de Caixa</p>
                      <p className={`text-3xl font-bold mt-2 ${fluxoCaixa >= 0 ? 'text-purple-900' : 'text-red-900'}`}>
                        R$ {fluxoCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-purple-600 mt-1">
                        {fluxoCaixa >= 0 ? 'Positivo' : 'Negativo'}
                      </p>
                    </div>
                    {fluxoCaixa >= 0 ? (
                      <ArrowUpRight className="w-12 h-12 text-purple-600 opacity-20" />
                    ) : (
                      <ArrowDownRight className="w-12 h-12 text-red-600 opacity-20" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-700 font-medium">Empresas Ativas</p>
                      <p className="text-3xl font-bold text-orange-900 mt-2">{totalEmpresas}</p>
                      <p className="text-xs text-orange-600 mt-1">no grupo</p>
                    </div>
                    <Building2 className="w-12 h-12 text-orange-600 opacity-20" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Faturamento por Empresa */}
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-blue-50/80 border-b border-blue-100">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    Faturamento por Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dadosEmpresa}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="empresa" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                      <Bar dataKey="valor" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Evolução Mensal */}
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-slate-50 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    Evolução Mensal
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dadosEvolucao}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" />
                      <YAxis />
                      <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                      <Line type="monotone" dataKey="valor" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Distribuição */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-blue-50/80 border-b border-blue-100">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Distribuição de Faturamento (%)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={dadosEmpresa}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ empresa, valor }) => `${empresa}: ${((valor / totalVendas) * 100).toFixed(1)}%`}
                      outerRadius={120}
                      dataKey="valor"
                    >
                      {dadosEmpresa.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: Performance por Empresa */}
          <TabsContent value="performance" className="space-y-6 mt-6">
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/60 border-b border-blue-100">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Ranking de Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {performancePorEmpresa.map((empresa, index) => (
                    <div 
                      key={empresa.id} 
                      className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all"
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="w-4 h-4 text-slate-600" />
                          <span className="font-semibold text-slate-900">{empresa.nome}</span>
                          <Badge variant="outline" className="text-xs">{empresa.tipo}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-2">
                          <div>
                            <p className="text-xs text-slate-500">Faturamento</p>
                            <p className="font-bold text-blue-600">
                              R$ {empresa.faturamento.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Pedidos</p>
                            <p className="font-bold text-green-600">{empresa.pedidos}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">OTD</p>
                            <p className={`font-bold ${empresa.otd >= 90 ? 'text-green-600' : empresa.otd >= 70 ? 'text-orange-600' : 'text-red-600'}`}>
                              {empresa.otd}%
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={`${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-orange-600' : 'bg-slate-300'} text-white`}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: Consolidado Financeiro */}
          <TabsContent value="financeiro" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-md bg-green-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-green-700 font-medium">Receitas Pendentes</p>
                      <p className="text-2xl font-bold text-green-900">
                        R$ {receitasPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-red-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <TrendingDown className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-red-700 font-medium">Despesas Pendentes</p>
                      <p className="text-2xl font-bold text-red-900">
                        R$ {despesasPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`border-0 shadow-md ${fluxoCaixa >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 ${fluxoCaixa >= 0 ? 'bg-blue-100' : 'bg-orange-100'} rounded-lg`}>
                      <DollarSign className={`w-6 h-6 ${fluxoCaixa >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${fluxoCaixa >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                        Saldo Projetado
                      </p>
                      <p className={`text-2xl font-bold ${fluxoCaixa >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
                        R$ {fluxoCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico Financeiro Detalhado */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Receitas vs Despesas por Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart 
                    data={empresasDoGrupo.map(emp => {
                      const receitasEmp = contasReceber
                        .filter(c => c.empresa_id === emp.id && c.status === 'Pendente')
                        .reduce((sum, c) => sum + (c.valor || 0), 0);
                      const despesasEmp = contasPagar
                        .filter(c => c.empresa_id === emp.id && c.status === 'Pendente')
                        .reduce((sum, c) => sum + (c.valor || 0), 0);
                      return {
                        empresa: emp.nome_fantasia || emp.razao_social,
                        receitas: receitasEmp,
                        despesas: despesasEmp,
                        saldo: receitasEmp - despesasEmp
                      };
                    })}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="empresa" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                    <Legend />
                    <Bar dataKey="receitas" fill="#10b981" name="Receitas" />
                    <Bar dataKey="despesas" fill="#ef4444" name="Despesas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: Operacional */}
          <TabsContent value="operacional" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-0 shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Clientes Ativos</CardTitle>
                  <Users className="w-5 h-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{clientesAtivos}</div>
                  <p className="text-xs text-slate-500 mt-1">em todas as empresas</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Produtos Ativos</CardTitle>
                  <Box className="w-5 h-5 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-600">{produtosAtivos}</div>
                  <p className="text-xs text-slate-500 mt-1">no catálogo consolidado</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Valor Estoque</CardTitle>
                  <Package className="w-5 h-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    R$ {(valorEstoqueTotal / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k
                  </div>
                  <p className="text-xs text-slate-500 mt-1">estoque total</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Entregas Pendentes</CardTitle>
                  <Truck className="w-5 h-5 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">{entregasPendentes}</div>
                  <p className="text-xs text-slate-500 mt-1">em andamento</p>
                </CardContent>
              </Card>
            </div>

            {/* OPs em Produção */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Factory className="w-5 h-5 text-indigo-600" />
                  Ordens de Produção por Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {empresasDoGrupo.map(empresa => {
                    const opsEmpresa = ordensProducao.filter(op => op.empresa_id === empresa.id);
                    const opsEmProducaoEmpresa = opsEmpresa.filter(op => 
                      op.status === 'Em Produção' || op.status === 'Liberada'
                    );
                    const opsConcluidas = opsEmpresa.filter(op => op.status === 'Concluída');

                    return (
                      <div key={empresa.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Building2 className="w-5 h-5 text-slate-600" />
                          <span className="font-medium text-slate-900">{empresa.nome_fantasia || empresa.razao_social}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Em Produção</p>
                            <p className="font-bold text-orange-600">{opsEmProducaoEmpresa.length}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Concluídas</p>
                            <p className="font-bold text-green-600">{opsConcluidas.length}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Total</p>
                            <p className="font-bold text-blue-600">{opsEmpresa.length}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Estoque Consolidado */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Box className="w-5 h-5 text-indigo-600" />
                  Visão Consolidada de Estoque
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {empresasDoGrupo.map(empresa => {
                    const produtosEmpresa = produtos.filter(p => p.empresa_id === empresa.id && p.status === 'Ativo');
                    const valorEstoque = produtosEmpresa.reduce((sum, p) => 
                      sum + ((p.estoque_atual || 0) * (p.custo_aquisicao || 0)), 0
                    );
                    const produtosBaixo = produtosEmpresa.filter(p => 
                      p.estoque_atual <= p.estoque_minimo
                    ).length;

                    return (
                      <div key={empresa.id} className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <Building2 className="w-4 h-4 text-slate-600" />
                          <span className="font-semibold text-slate-900">{empresa.nome_fantasia || empresa.razao_social}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-slate-500">Produtos</p>
                            <p className="font-bold text-indigo-600">{produtosEmpresa.length}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Valor</p>
                            <p className="font-bold text-green-600">
                              R$ {(valorEstoque / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Baixo</p>
                            <p className={`font-bold ${produtosBaixo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {produtosBaixo}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </ProtectedSection>
  );
}