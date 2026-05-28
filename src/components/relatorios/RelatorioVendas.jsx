import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from "recharts";
import { Download, TrendingUp, ShoppingCart, Users, DollarSign, AlertCircle } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import FiltrosPeriodoEmpresa from "@/components/relatorios/FiltrosPeriodoEmpresa";
import { exportarCSV } from "@/components/relatorios/exportUtils";

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#64748b'];

export default function RelatorioVendas() {
  const [filtros, setFiltros] = useState({
    data_inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    data_fim: new Date().toISOString().split('T')[0],
  });
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewRelatorio = hasPermission("Comercial", "Relatorios", "visualizar") ||
    hasPermission("Comercial", "Vendas", "visualizar") ||
    hasPermission("Comercial", null, "visualizar");
  const canExportRelatorio = hasPermission("Comercial", "Relatorios", "exportar") ||
    hasPermission("Comercial", "Vendas", "exportar") ||
    hasPermission("Comercial", null, "exportar");

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos-relatorio', contextKey],
    queryFn: () => filterInContext('Pedido', {}, '-data_pedido', 9999),
    enabled: contextoValido && canViewRelatorio,
  });

  const pedidosFiltrados = useMemo(() => {
    const ini = new Date(filtros.data_inicio);
    const fim = new Date(filtros.data_fim + 'T23:59:59');
    return pedidos.filter(p => {
      const d = new Date(p.data_pedido || p.created_date);
      return d >= ini && d <= fim && p.status !== 'Cancelado';
    });
  }, [pedidos, filtros]);

  const totalFaturado = pedidosFiltrados.reduce((s, p) => s + (p.valor_total || 0), 0);
  const qtdPedidos = pedidosFiltrados.length;
  const ticketMedio = qtdPedidos > 0 ? totalFaturado / qtdPedidos : 0;
  const clientesUnicos = new Set(pedidosFiltrados.map(p => p.cliente_id || p.cliente_nome)).size;

  const vendasMensais = useMemo(() => {
    const mapa = {};
    pedidosFiltrados.forEach(p => {
      const mes = (p.data_pedido || p.created_date || '').slice(0, 7);
      if (!mes) return;
      mapa[mes] = (mapa[mes] || 0) + (p.valor_total || 0);
    });
    return Object.entries(mapa).sort().map(([mes, valor]) => ({ mes, valor }));
  }, [pedidosFiltrados]);

  const vendasPorStatus = useMemo(() => {
    const mapa = {};
    pedidos.forEach(p => {
      const s = p.status || 'Sem Status';
      mapa[s] = (mapa[s] || 0) + 1;
    });
    return Object.entries(mapa).map(([name, value]) => ({ name, value }));
  }, [pedidos]);

  const top10Clientes = useMemo(() => {
    const mapa = {};
    pedidosFiltrados.forEach(p => {
      const c = p.cliente_nome || 'N/A';
      mapa[c] = (mapa[c] || 0) + (p.valor_total || 0);
    });
    return Object.entries(mapa).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([cliente, valor])=>({ cliente, valor }));
  }, [pedidosFiltrados]);

  const fmt = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const auditarExportacao = async (nome, quantidade, sucesso = true) => {
    try {
      await base44.entities.AuditLog.create({
        acao: sucesso ? "Exportacao" : "Bloqueio",
        modulo: "Comercial",
        entidade: "RelatorioVendas",
        descricao: sucesso ? `Exportacao CSV do relatorio de vendas: ${nome}` : `Exportacao bloqueada no relatorio de vendas: ${nome}`,
        usuario_id: user?.id || null,
        usuario: user?.full_name || user?.email || "Usuario local",
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        dados_novos: { nome, quantidade, filtros },
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar exportacao de vendas:", error);
    }
  };

  const exportarRelatorio = async (dados, nomeArquivo) => {
    if (!contextoValido || !canExportRelatorio) {
      await auditarExportacao(nomeArquivo, dados?.length || 0, false);
      return;
    }
    exportarCSV(dados, nomeArquivo);
    await auditarExportacao(nomeArquivo, dados?.length || 0, true);
  };

  return (
    <div className="space-y-6 w-full h-full" data-permission="Comercial.Relatorios.visualizar" data-context-required="group-or-company">
      {(!contextoValido || !canViewRelatorio) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar o relatorio de vendas.</AlertDescription>
        </Alert>
      )}
      <FiltrosPeriodoEmpresa filtros={filtros} setFiltros={setFiltros} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Faturado', value: fmt(totalFaturado), icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pedidos', value: qtdPedidos, icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Ticket Médio', value: fmt(ticketMedio), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Clientes Ativos', value: clientesUnicos, icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(k => (
          <Card key={k.label} className="border-0 shadow-md">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${k.bg} flex items-center justify-center`}>
                <k.icon className={`w-5 h-5 ${k.color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{k.label}</p>
                <p className="text-lg font-bold text-slate-900">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Faturamento Mensal</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportarRelatorio(vendasMensais, 'vendas_mensais')} disabled={!contextoValido || !canExportRelatorio} data-action="RelatorioVendas.exportarMensal" data-permission="Comercial.Relatorios.exportar" data-context-required="group-or-company" data-sensitive="true">
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={vendasMensais}>
                <defs>
                  <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} />
                <Area type="monotone" dataKey="valor" stroke="#3b82f6" fill="url(#colorVendas)" name="Faturamento" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pedidos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={vendasPorStatus} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {vendasPorStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Top 10 Clientes por Faturamento</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportarRelatorio(top10Clientes, 'top_clientes')} disabled={!contextoValido || !canExportRelatorio} data-action="RelatorioVendas.exportarClientes" data-permission="Comercial.Relatorios.exportar" data-context-required="group-or-company" data-sensitive="true">
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={top10Clientes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="cliente" width={140} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => fmt(v)} />
                <Bar dataKey="valor" fill="#3b82f6" name="Faturamento" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
