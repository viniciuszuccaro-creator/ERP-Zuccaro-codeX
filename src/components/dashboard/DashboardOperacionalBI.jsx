import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, 
  Package, 
  Truck, 
  ShoppingCart, 
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Factory,
  CreditCard,
  Target,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button"; // keep single import
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

function DashboardOperacionalBI({ windowMode = false }) {
  const [periodoFiltro, setPeriodoFiltro] = useState("mes");
  const { empresaAtual, grupoAtual, estaNoGrupo, filtrarPorContexto, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewDashboard = hasPermission("Dashboard", "Operacional", "visualizar") ||
    hasPermission("Dashboard", null, "visualizar") ||
    hasPermission("Sistema", "Dashboard", "visualizar");

  const { data: pedidos = [], isError: errPedidos } = useQuery({
    queryKey: ["bi-pedidos", contextKey],
    queryFn: () => filterInContext('Pedido', {}, '-created_date', 9999),
    enabled: contextoValido && canViewDashboard,
    initialData: [],
    staleTime: 120000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const { data: ops = [], isError: errOps } = useQuery({
    queryKey: ["bi-ordens-producao", contextKey],
    queryFn: () => filterInContext('OrdemProducao', {}, '-data_emissao', 9999),
    enabled: contextoValido && canViewDashboard,
    initialData: [],
    staleTime: 120000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const { data: entregas = [], isError: errEntregas } = useQuery({
    queryKey: ["bi-entregas", contextKey],
    queryFn: () => filterInContext('Entrega', {}, '-created_date', 9999),
    enabled: contextoValido && canViewDashboard,
    initialData: [],
    staleTime: 120000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const { data: contasReceber = [], isError: errCR } = useQuery({
    queryKey: ["bi-contasReceber", contextKey],
    queryFn: () => filterInContext('ContaReceber', {}, '-data_vencimento', 9999),
    enabled: contextoValido && canViewDashboard,
    initialData: [],
    staleTime: 120000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const { data: produtos = [], isError: errProdutos } = useQuery({
    queryKey: ["bi-produtos", contextKey],
    queryFn: () => filterInContext('Produto', {}, '-created_date', 9999),
    enabled: contextoValido && canViewDashboard,
    initialData: [],
    staleTime: 120000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const { data: clientes = [], isError: errClientes } = useQuery({
    queryKey: ["bi-clientes", contextKey],
    queryFn: () => filterInContext('Cliente', {}, '-created_date', 9999),
    enabled: contextoValido && canViewDashboard,
    initialData: [],
    staleTime: 120000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  // Filtrar por contexto empresa/grupo
  const pedidosFiltrados = filtrarPorContexto(pedidos, 'empresa_id');
  const opsFiltradas = filtrarPorContexto(ops, 'empresa_id');
  const entregasFiltradas = filtrarPorContexto(entregas, 'empresa_id');
  const produtosFiltrados = filtrarPorContexto(produtos, 'empresa_id');
  const clientesFiltrados = filtrarPorContexto(clientes, 'empresa_id');
  const contasReceberFiltradas = filtrarPorContexto(contasReceber, 'empresa_id');

  const totalVendas = pedidosFiltrados.reduce((acc, p) => acc + (p.valor_total || 0), 0);
  const pedidosAbertos = pedidosFiltrados.filter(p => 
    p.status !== "Entregue" && p.status !== "Cancelado"
  ).length;
  const opsEmProducao = opsFiltradas.filter(op => 
    op.status !== "Concluída" && op.status !== "Cancelada"
  ).length;
  const entregasPendentes = entregasFiltradas.filter(e => 
    e.status !== "Entregue"
  ).length;
  const contasAtrasadas = contasReceberFiltradas.filter(c => c.status === "Atrasado").length;

  // IA: Análises Preditivas
  const calcularTendenciaVendas = () => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const pedidosMesAtual = pedidosFiltrados.filter(p => {
      const dataPedido = new Date(p.data_pedido);
      return dataPedido.getMonth() === mesAtual;
    });
    const pedidosMesAnterior = pedidosFiltrados.filter(p => {
      const dataPedido = new Date(p.data_pedido);
      return dataPedido.getMonth() === mesAtual - 1;
    });

    const valorAtual = pedidosMesAtual.reduce((s, p) => s + (p.valor_total || 0), 0);
    const valorAnterior = pedidosMesAnterior.reduce((s, p) => s + (p.valor_total || 0), 0);

    const crescimento = valorAnterior > 0 
      ? ((valorAtual - valorAnterior) / valorAnterior * 100).toFixed(1)
      : 0;

    return { valorAtual, valorAnterior, crescimento: parseFloat(crescimento) };
  };

  const queryClient = useQueryClient();
  const tendenciaVendas = calcularTendenciaVendas();

  const clientesComRiscoChurn = clientesFiltrados.filter(c => 
    c.risco_churn === 'Alto' || c.risco_churn === 'Crítico'
  ).length;

  const semDados = [pedidosFiltrados, opsFiltradas, entregasFiltradas, clientesFiltrados, produtosFiltrados, contasReceberFiltradas]
    .every(arr => (arr?.length || 0) === 0);
  const erroGeral = errPedidos || errOps || errEntregas || errCR || errProdutos || errClientes;

  const dadosVendasMes = [
    { mes: "Jan", valor: 45000 },
    { mes: "Fev", valor: 52000 },
    { mes: "Mar", valor: 48000 },
    { mes: "Abr", valor: 61000 },
    { mes: "Mai", valor: 55000 },
    { mes: "Jun", valor: 67000 },
  ];

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "w-full space-y-6 p-6 bg-gradient-to-br from-slate-50 to-blue-50";

  return (
    <div
      className={`${containerClass} min-h-[760px]`}
      data-permission="Dashboard.Operacional.visualizar"
      data-context-required="group-or-company"
    >
      <div className={windowMode ? "p-6 space-y-6 flex-1 overflow-auto" : "space-y-6 overflow-auto"}>
      {(!contextoValido || !canViewDashboard) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertDescription>
            Selecione grupo ou empresa e confirme permissao para visualizar o dashboard operacional.
          </AlertDescription>
        </Alert>
      )}
      {erroGeral && (
        <Alert className="border-red-300 bg-red-50">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Erro ao carregar dados (possível limite de requisições).</span>
            <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ predicate: () => true })}>Tentar novamente</Button>
          </AlertDescription>
        </Alert>
      )}
      {semDados && !erroGeral && (
        <Card className="border-2 border-amber-300 bg-amber-50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Sem dados para exibir</CardTitle>
            <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ predicate: () => true })}>Atualizar</Button>
          </CardHeader>
          <CardContent className="text-sm text-amber-700">
            Nenhuma informação encontrada no contexto atual. Selecione uma empresa/grupo ou cadastre registros para visualizar.
          </CardContent>
        </Card>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-purple-600" />
            Dashboard Operacional BI
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {estaNoGrupo ? 'Visão Consolidada do Grupo' : empresaAtual?.nome_fantasia || empresaAtual?.razao_social} • IA e Análises Preditivas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="semana">Esta Semana</SelectItem>
              <SelectItem value="mes">Este Mês</SelectItem>
              <SelectItem value="trimestre">Trimestre</SelectItem>
              <SelectItem value="ano">Ano</SelectItem>
            </SelectContent>
          </Select>

          <Badge className="bg-purple-600 px-3 py-2">
            <Sparkles className="w-4 h-4 mr-2" />
            IA Ativa
          </Badge>
        </div>
      </div>

      {/* IA: Tendência de Vendas */}
      <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-purple-600 rounded-xl">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-purple-900 mb-1">
                  IA: Análise de Tendência de Vendas
                </h3>
                <p className="text-sm text-purple-700">
                  Crescimento de {tendenciaVendas.crescimento > 0 ? '+' : ''}{tendenciaVendas.crescimento}% em relação ao mês anterior
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-purple-600 font-medium">Mês Atual</p>
              <p className="text-2xl font-bold text-purple-900">
                R$ {tendenciaVendas.valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              {tendenciaVendas.crescimento !== 0 && (
                <Badge className={tendenciaVendas.crescimento > 0 ? 'bg-green-600' : 'bg-red-600'}>
                  {tendenciaVendas.crescimento > 0 ? '↗' : '↘'} {Math.abs(tendenciaVendas.crescimento)}%
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-stretch">
        <Card className="border-0 shadow-md h-full bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-xl transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-90">Vendas Total</p>
                <p className="text-2xl font-bold">
                  R$ {(totalVendas / 1000).toFixed(0)}k
                </p>
                <p className="text-xs opacity-75 mt-1">{pedidosFiltrados.length} pedidos</p>
              </div>
              <DollarSign className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md h-full bg-gradient-to-br from-green-500 to-green-600 text-white hover:shadow-xl transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-90">Pedidos Abertos</p>
                <p className="text-2xl font-bold">{pedidosAbertos}</p>
                <p className="text-xs opacity-75 mt-1">em andamento</p>
              </div>
              <ShoppingCart className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md h-full bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-xl transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-90">OPs Produção</p>
                <p className="text-2xl font-bold">{opsEmProducao}</p>
                <p className="text-xs opacity-75 mt-1">ativas</p>
              </div>
              <Factory className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md h-full bg-gradient-to-br from-orange-500 to-orange-600 text-white hover:shadow-xl transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-90">Entregas Pend.</p>
                <p className="text-2xl font-bold">{entregasPendentes}</p>
                <p className="text-xs opacity-75 mt-1">em logística</p>
              </div>
              <Truck className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md h-full bg-gradient-to-br from-red-500 to-red-600 text-white hover:shadow-xl transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-90">Contas Atrasadas</p>
                <p className="text-2xl font-bold">{contasAtrasadas}</p>
                <p className="text-xs opacity-75 mt-1">atenção urgente</p>
              </div>
              <AlertTriangle className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md h-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white hover:shadow-xl transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-90">Produtos</p>
                <p className="text-2xl font-bold">{produtosFiltrados.length}</p>
                <p className="text-xs opacity-75 mt-1">no catálogo</p>
              </div>
              <Package className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md h-full bg-gradient-to-br from-cyan-500 to-cyan-600 text-white hover:shadow-xl transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-90">Clientes</p>
                <p className="text-2xl font-bold">{clientesFiltrados.length}</p>
                <p className="text-xs opacity-75 mt-1">cadastrados</p>
              </div>
              <Users className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <ResizablePanelGroup direction="horizontal" className="w-full min-h-[540px]">
        <ResizablePanel defaultSize={50} minSize={30} className="pr-3">
          <Card className="border-0 shadow-md h-full">
            <CardHeader>
              <CardTitle className="text-base">Vendas por Mês</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px] md:h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosVendasMes}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="valor" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </ResizablePanel>
        <ResizableHandle withHandle className="mx-1" />
        <ResizablePanel defaultSize={50} minSize={30} className="pl-3">
          <Card className="border-0 shadow-md h-full">
            <CardHeader>
              <CardTitle className="text-base">Evolução de Produção</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px] md:h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[
                  { mes: "Jan", ops: 12 },
                  { mes: "Fev", ops: 15 },
                  { mes: "Mar", ops: 18 },
                  { mes: "Abr", ops: 22 },
                  { mes: "Mai", ops: 19 },
                  { mes: "Jun", ops: 25 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="ops" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Sugestões Inteligentes da IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Análise de Vendas */}
            {tendenciaVendas.crescimento < -10 && (
              <div className="p-4 bg-white rounded-lg border-2 border-red-300 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-red-900">
                      📉 Queda de {Math.abs(tendenciaVendas.crescimento)}% nas vendas
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      <strong>Ação recomendada:</strong> Ativar campanhas promocionais, contatar clientes inativos, revisar estratégia comercial
                    </p>
                  </div>
                </div>
              </div>
            )}

            {tendenciaVendas.crescimento > 20 && (
              <div className="p-4 bg-white rounded-lg border-2 border-green-300 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-green-900">
                      📈 Crescimento de {tendenciaVendas.crescimento}%!
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      <strong>Oportunidade:</strong> Aumentar estoque de produtos mais vendidos, contratar mais pessoal
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Clientes em Risco */}
            {clientesComRiscoChurn > 0 && (
              <div className="p-4 bg-white rounded-lg border-2 border-orange-300 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Users className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-orange-900">
                      ⚠️ {clientesComRiscoChurn} cliente(s) com risco de churn
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      <strong>Ação recomendada:</strong> Contato proativo, ofertas personalizadas, pesquisa de satisfação
                    </p>
                  </div>
                </div>
              </div>
            )}

            {contasAtrasadas > 0 && (
              <div className="p-4 bg-white rounded-lg border-2 border-red-300 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-red-900">
                      💰 {contasAtrasadas} conta(s) atrasada(s)
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      <strong>Ação imediata:</strong> Ativar régua de cobrança, negociar condições, aplicar juros/multa
                    </p>
                  </div>
                </div>
              </div>
            )}

            {opsEmProducao > 10 && (
              <div className="p-4 bg-white rounded-lg border-2 border-blue-300 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Factory className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-blue-900">
                      🏭 {opsEmProducao} OPs em produção simultâneas
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      <strong>Otimização:</strong> Redistribuir cargas, verificar gargalos, considerar horas extras
                    </p>
                  </div>
                </div>
              </div>
            )}

            {entregasPendentes > 5 && (
              <div className="p-4 bg-white rounded-lg border-2 border-green-300 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Truck className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-green-900">
                      🚚 {entregasPendentes} entrega(s) em logística
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      <strong>Otimização:</strong> Roteirização inteligente, consolidar entregas por região
                    </p>
                  </div>
                </div>
              </div>
            )}

            {contasAtrasadas === 0 && opsEmProducao < 5 && entregasPendentes < 3 && clientesComRiscoChurn === 0 && (
              <div className="text-center py-8 text-slate-500">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-8 h-8 text-green-600" />
                </div>
                <p className="font-semibold text-lg text-green-900">Tudo funcionando perfeitamente! 🎉</p>
                <p className="text-sm text-slate-600 mt-1">A IA não detectou ações urgentes ou oportunidades de melhoria.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
  }
  export default React.memo(DashboardOperacionalBI);
