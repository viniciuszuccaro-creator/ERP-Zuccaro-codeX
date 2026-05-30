import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  DollarSign,
  TrendingUp,
  Award,
  Target,
  Calendar,
  Download
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import { exportarCSV } from "@/components/relatorios/exportUtils";

const tiposRepresentante = [
  { value: 'todos', label: 'Todos os Tipos' },
  { value: 'Representante Comercial', label: 'Representante Comercial' },
  { value: 'Construtor', label: 'Construtor' },
  { value: 'Arquiteto', label: 'Arquiteto' },
  { value: 'Engenheiro', label: 'Engenheiro' },
  { value: 'Influenciador', label: 'Influenciador' },
  { value: 'Parceiro', label: 'Parceiro' },
  { value: 'Outro', label: 'Outro' },
];

export default function DashboardRepresentantes() {
  const [periodoFiltro, setPeriodoFiltro] = React.useState("mes");
  const [tipoFiltro, setTipoFiltro] = React.useState("todos");
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewDashboard = hasPermission("Comercial", "Representantes", "visualizar") ||
    hasPermission("Comercial", "Relatorios", "visualizar") ||
    hasPermission("Comercial", null, "visualizar");
  const canExportDashboard = hasPermission("Comercial", "Representantes", "exportar") ||
    hasPermission("Comercial", "Relatorios", "exportar") ||
    hasPermission("Comercial", null, "exportar");

  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes-dashboard', contextKey],
    queryFn: () => filterInContext('Representante', { status: 'Ativo' }, 'nome', 1000),
    enabled: contextoValido && canViewDashboard
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-dashboard-representantes', contextKey],
    queryFn: () => filterInContext('Cliente', {}, 'nome', 5000),
    enabled: contextoValido && canViewDashboard
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-dashboard-representantes', contextKey],
    queryFn: () => filterInContext('Pedido', {}, '-data_pedido', 5000),
    enabled: contextoValido && canViewDashboard
  });

  const calcularMetricasGerais = () => {
    const clientesComIndicador = clientes.filter(c => c.indicador_id);
    const pedidosComIndicador = pedidos.filter(p => p.indicador_id);
    const totalVendas = pedidosComIndicador.reduce((sum, p) => sum + (p.valor_total || 0), 0);
    
    const totalComissoes = pedidosComIndicador.reduce((sum, p) => {
      const rep = representantes.find(r => r.id === p.indicador_id);
      if (!rep) return sum;
      const valor = p.valor_total || 0;
      const percentual = rep.percentual_comissao || 0;
      const fixo = rep.valor_fixo_comissao || 0;
      return sum + (valor * percentual / 100) + fixo;
    }, 0);

    return {
      totalRepresentantes: representantes.length,
      clientesIndicados: clientesComIndicador.length,
      totalVendas,
      totalComissoes,
      ticketMedio: clientesComIndicador.length > 0 ? totalVendas / clientesComIndicador.length : 0
    };
  };

  const metricas = calcularMetricasGerais();

  const dadosRankingRepresentantes = representantes
    .map(rep => {
      const clientesIndicados = clientes.filter(c => c.indicador_id === rep.id);
      const pedidosIndicados = pedidos.filter(p => p.indicador_id === rep.id);
      const totalVendas = pedidosIndicados.reduce((sum, p) => sum + (p.valor_total || 0), 0);
      const totalComissao = pedidosIndicados.reduce((sum, p) => {
        const valor = p.valor_total || 0;
        const percentual = rep.percentual_comissao || 0;
        const fixo = rep.valor_fixo_comissao || 0;
        return sum + (valor * percentual / 100) + fixo;
      }, 0);

      return {
        nome: rep.nome,
        tipo: rep.tipo_representante,
        clientes: clientesIndicados.length,
        pedidos: pedidosIndicados.length,
        vendas: totalVendas,
        comissao: totalComissao
      };
    })
    .filter(r => tipoFiltro === 'todos' || r.tipo === tipoFiltro)
    .sort((a, b) => b.vendas - a.vendas)
    .slice(0, 10);


  const auditarExportacao = async (sucesso = true, motivo = null) => {
    try {
      await base44.entities.AuditLog.create({
        acao: sucesso ? "Exportacao" : "Bloqueio",
        modulo: "Comercial",
        entidade: "DashboardRepresentantes",
        descricao: sucesso ? "Exportacao CSV do dashboard de representantes" : (motivo || "Bloqueio de exportacao do dashboard de representantes"),
        usuario_id: user?.id || null,
        usuario: user?.full_name || user?.email || "Usuario local",
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        dados_novos: { periodoFiltro, tipoFiltro, quantidade: dadosRankingRepresentantes.length, contextKey },
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar exportacao de representantes:", error);
    }
  };

  const exportarRepresentantes = async () => {
    if (!contextoValido || !canExportDashboard) {
      await auditarExportacao(false, "Tentativa de exportar dashboard de representantes sem contexto grupo/empresa ou permissao RBAC.");
      return;
    }
    const confirmado = window.confirm(`Exportar ${dadosRankingRepresentantes.length} representantes para CSV?`);
    if (!confirmado) {
      await auditarExportacao(false, "Exportacao CSV do dashboard de representantes cancelada pelo usuario.");
      return;
    }
    const dadosComContexto = dadosRankingRepresentantes.map((item) => ({
      ...item,
      periodo: periodoFiltro,
      group_id: groupId,
      grupo_id: groupId,
      empresa_id: empresaId,
    }));
    exportarCSV(dadosComContexto, "dashboard_representantes");
    await auditarExportacao(true);
  };
  const dadosPorTipo = [
    { name: 'Representante', value: representantes.filter(r => r.tipo_representante === 'Representante Comercial').length, color: '#8b5cf6' },
    { name: 'Construtor', value: representantes.filter(r => r.tipo_representante === 'Construtor').length, color: '#3b82f6' },
    { name: 'Arquiteto', value: representantes.filter(r => r.tipo_representante === 'Arquiteto').length, color: '#10b981' },
    { name: 'Engenheiro', value: representantes.filter(r => r.tipo_representante === 'Engenheiro').length, color: '#f59e0b' },
    { name: 'Outros', value: representantes.filter(r => !['Representante Comercial', 'Construtor', 'Arquiteto', 'Engenheiro'].includes(r.tipo_representante)).length, color: '#6b7280' }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 w-full h-full" data-permission="Comercial.Relatorios.visualizar" data-context-required="group-or-company">
      {(!contextoValido || !canViewDashboard) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar o dashboard de representantes.</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-purple-600" />
            Dashboard de Representantes
          </h2>
          <p className="text-sm text-slate-600">Análise de performance e comissões</p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[99999]">
              {tiposRepresentante.map(tipo => (
                <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[99999]">
              <SelectItem value="mes">Este Mês</SelectItem>
              <SelectItem value="trimestre">Trimestre</SelectItem>
              <SelectItem value="ano">Este Ano</SelectItem>
              <SelectItem value="tudo">Todo Período</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={exportarRepresentantes} disabled={!contextoValido || !canExportDashboard} data-action="DashboardRepresentantes.exportarCSV" data-permission="Comercial.Relatorios.exportar" data-context-required="group-or-company" data-sensitive="true">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              Representantes Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-600">{metricas.totalRepresentantes}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              Clientes Indicados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{metricas.clientesIndicados}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Total em Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              R$ {metricas.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-orange-600" />
              Comissões Geradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              R$ {metricas.totalComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-pink-600" />
              Ticket Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-pink-600">
              R$ {metricas.ticketMedio.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking por Vendas Geradas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosRankingRepresentantes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <Legend />
                <Bar dataKey="vendas" name="Vendas Geradas" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={dadosPorTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {dadosPorTipo.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 Representantes - Performance Detalhada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 font-semibold">#</th>
                  <th className="text-left p-3 font-semibold">Representante</th>
                  <th className="text-left p-3 font-semibold">Tipo</th>
                  <th className="text-right p-3 font-semibold">Clientes</th>
                  <th className="text-right p-3 font-semibold">Pedidos</th>
                  <th className="text-right p-3 font-semibold">Total Vendas</th>
                  <th className="text-right p-3 font-semibold">Comissão Gerada</th>
                </tr>
              </thead>
              <tbody>
                {dadosRankingRepresentantes.map((rep, idx) => (
                  <tr key={idx} className="border-b hover:bg-slate-50">
                    <td className="p-3">
                      {idx === 0 && <span className="text-2xl">🥇</span>}
                      {idx === 1 && <span className="text-2xl">🥈</span>}
                      {idx === 2 && <span className="text-2xl">🥉</span>}
                      {idx > 2 && <span className="text-slate-500">{idx + 1}º</span>}
                    </td>
                    <td className="p-3 font-medium">{rep.nome}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">{rep.tipo}</Badge>
                    </td>
                    <td className="p-3 text-right font-semibold text-blue-600">{rep.clientes}</td>
                    <td className="p-3 text-right font-semibold text-slate-700">{rep.pedidos}</td>
                    <td className="p-3 text-right font-bold text-green-600">
                      R$ {rep.vendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-bold text-purple-600">
                      R$ {rep.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}