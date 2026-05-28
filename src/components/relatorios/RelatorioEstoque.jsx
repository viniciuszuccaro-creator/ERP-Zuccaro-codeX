import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter
} from "recharts";
import { Download, Package, AlertTriangle, TrendingDown, Archive } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import FiltrosPeriodoEmpresa from "@/components/relatorios/FiltrosPeriodoEmpresa";
import { exportarCSV } from "@/components/relatorios/exportUtils";

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

export default function RelatorioEstoque() {
  const [filtros, setFiltros] = useState({
    data_inicio: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    data_fim: new Date().toISOString().split('T')[0],
  });
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewRelatorio = hasPermission("Estoque", "Relatorios", "visualizar") ||
    hasPermission("Estoque", null, "visualizar");
  const canExportRelatorio = hasPermission("Estoque", "Relatorios", "exportar") ||
    hasPermission("Estoque", null, "exportar");

  const { data: produtos = [] } = useQuery({
    queryKey: ['rel-produtos', contextKey],
    queryFn: () => filterInContext('Produto', {}, '-estoque_atual', 200),
    enabled: contextoValido && canViewRelatorio,
  });
  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['rel-mov', contextKey],
    queryFn: () => filterInContext('MovimentacaoEstoque', {}, '-data_movimentacao', 9999),
    enabled: contextoValido && canViewRelatorio,
  });

  const produtosAtivos = produtos.filter(p => p.status === 'Ativo');
  const abaixoMinimo = produtosAtivos.filter(p => (p.estoque_atual || 0) < (p.estoque_minimo || 0));
  const semEstoque = produtosAtivos.filter(p => (p.estoque_atual || 0) <= 0);
  const valorTotal = produtosAtivos.reduce((s, p) => s + ((p.estoque_atual || 0) * (p.custo_medio || p.custo_aquisicao || 0)), 0);

  const porGrupo = useMemo(() => {
    const m = {};
    produtosAtivos.forEach(p => {
      const g = p.grupo || p.grupo_produto_nome || 'Outros';
      if (!m[g]) m[g] = { grupo: g, quantidade: 0, valor: 0 };
      m[g].quantidade += p.estoque_atual || 0;
      m[g].valor += (p.estoque_atual || 0) * (p.custo_medio || p.custo_aquisicao || 0);
    });
    return Object.values(m).sort((a,b)=>b.valor-a.valor).slice(0,10);
  }, [produtosAtivos]);

  const curvaABC = useMemo(() => {
    const classified = { A: 0, B: 0, C: 0, 'Sem Mov.': 0 };
    produtosAtivos.forEach(p => { classified[p.classificacao_abc || 'Sem Mov.']++; });
    return Object.entries(classified).map(([name, value]) => ({ name, value }));
  }, [produtosAtivos]);

  const movMensais = useMemo(() => {
    const ini = new Date(filtros.data_inicio);
    const fim = new Date(filtros.data_fim + 'T23:59:59');
    const m = {};
    movimentacoes.filter(mv => {
      const d = new Date(mv.data_movimentacao || mv.created_date);
      return d >= ini && d <= fim;
    }).forEach(mv => {
      const mes = (mv.data_movimentacao||'').slice(0,7); if(!mes) return;
      if(!m[mes]) m[mes] = { mes, entradas: 0, saidas: 0 };
      if (mv.tipo_movimento === 'entrada') m[mes].entradas += mv.quantidade || 0;
      if (mv.tipo_movimento === 'saida') m[mes].saidas += mv.quantidade || 0;
    });
    return Object.values(m).sort((a,b)=>a.mes.localeCompare(b.mes));
  }, [movimentacoes, filtros]);

  const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const auditarExportacao = async (nome, quantidade, sucesso = true) => {
    try {
      await base44.entities.AuditLog.create({
        acao: sucesso ? "Exportacao" : "Bloqueio",
        modulo: "Estoque",
        entidade: "RelatorioEstoque",
        descricao: sucesso ? `Exportacao CSV do relatorio de estoque: ${nome}` : `Exportacao bloqueada no relatorio de estoque: ${nome}`,
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
      console.warn("Falha ao auditar exportacao de estoque:", error);
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
    <div className="space-y-6 w-full h-full" data-permission="Estoque.Relatorios.visualizar" data-context-required="group-or-company">
      {(!contextoValido || !canViewRelatorio) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar o relatorio de estoque.</AlertDescription>
        </Alert>
      )}
      <FiltrosPeriodoEmpresa filtros={filtros} setFiltros={setFiltros} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Produtos Ativos', value: produtosAtivos.length, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Valor em Estoque', value: fmt(valorTotal), icon: Archive, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Abaixo do Mínimo', value: abaixoMinimo.length, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Sem Estoque', value: semEstoque.length, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Movimentações por Mês (Entradas × Saídas)</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportarRelatorio(movMensais, 'movimentacoes_mensais')} disabled={!contextoValido || !canExportRelatorio} data-action="RelatorioEstoque.exportarMovimentacoes" data-permission="Estoque.Relatorios.exportar" data-context-required="group-or-company" data-sensitive="true">
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={movMensais}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="entradas" fill="#10b981" name="Entradas" />
                <Bar dataKey="saidas" fill="#ef4444" name="Saídas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Valor em Estoque por Grupo</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportarRelatorio(porGrupo, 'estoque_por_grupo')} disabled={!contextoValido || !canExportRelatorio} data-action="RelatorioEstoque.exportarGrupo" data-permission="Estoque.Relatorios.exportar" data-context-required="group-or-company" data-sensitive="true">
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porGrupo} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="grupo" width={120} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => fmt(v)} />
                <Bar dataKey="valor" fill="#8b5cf6" name="Valor" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Classificação ABC</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={curvaABC} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({name,value}) => `${name}: ${value}`}>
                  {curvaABC.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
