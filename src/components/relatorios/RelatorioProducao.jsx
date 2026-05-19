import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Download, Factory, CheckCircle, Clock, AlertCircle } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import { base44 } from "@/api/base44Client";
import FiltrosPeriodoEmpresa from "@/components/relatorios/FiltrosPeriodoEmpresa";
import { exportarCSV } from "@/components/relatorios/exportUtils";

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

export default function RelatorioProducao() {
  const [filtros, setFiltros] = useState({
    data_inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    data_fim: new Date().toISOString().split('T')[0],
  });
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const empresaId = empresaAtual?.id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const contextKey = groupId ? `grupo:${groupId}` : `empresa:${empresaId || "sem-empresa"}`;
  const podeVerRelatorio = hasPermission("Produção", "Relatórios", "visualizar") ||
    hasPermission("Produção", null, "visualizar") ||
    hasPermission("Producao", "Relatorios", "visualizar") ||
    hasPermission("Producao", null, "visualizar");
  const podeExportarRelatorio = hasPermission("Produção", "Relatórios", "exportar") ||
    hasPermission("Producao", "Relatorios", "exportar") ||
    hasPermission("Relatórios", "Produção", "exportar") ||
    hasPermission("Relatorios", "Producao", "exportar");

  const { data: ordens = [] } = useQuery({
    queryKey: ['rel-ops', contextKey],
    queryFn: () => filterInContext('OrdemProducao', {}, '-created_date', 9999),
    enabled: contextoValido && podeVerRelatorio,
  });
  const { data: apontamentos = [] } = useQuery({
    queryKey: ['rel-apontamentos', contextKey],
    queryFn: () => filterInContext('ApontamentoProducao', {}, '-created_date', 9999),
    enabled: contextoValido && podeVerRelatorio,
  });

  const orsFiltrados = useMemo(() => {
    const ini = new Date(filtros.data_inicio);
    const fim = new Date(filtros.data_fim + 'T23:59:59');
    return ordens.filter(o => {
      const d = new Date(o.data_inicio || o.created_date);
      return d >= ini && d <= fim;
    });
  }, [ordens, filtros]);

  const total = orsFiltrados.length;
  const concluidas = orsFiltrados.filter(o => o.status === 'Concluída' || o.status === 'Finalizado').length;
  const emAndamento = orsFiltrados.filter(o => ['Em Produção','Em Andamento','Iniciada'].includes(o.status)).length;
  const atrasadas = orsFiltrados.filter(o => o.status === 'Atrasada' || o.atraso_dias > 0).length;

  const porStatus = useMemo(() => {
    const m = {};
    orsFiltrados.forEach(o => { m[o.status||'N/A'] = (m[o.status||'N/A']||0)+1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [orsFiltrados]);

  const producaoMensal = useMemo(() => {
    const m = {};
    orsFiltrados.forEach(o => {
      const mes = (o.data_inicio||o.created_date||'').slice(0,7); if(!mes) return;
      if(!m[mes]) m[mes] = { mes, total: 0, concluidas: 0 };
      m[mes].total++;
      if (o.status === 'Concluída' || o.status === 'Finalizado') m[mes].concluidas++;
    });
    return Object.values(m).sort((a,b)=>a.mes.localeCompare(b.mes));
  }, [orsFiltrados]);

  const porProduto = useMemo(() => {
    const m = {};
    orsFiltrados.forEach(o => {
      const p = o.produto_descricao || o.descricao || 'N/A';
      if(!m[p]) m[p] = { produto: p, quantidade: 0, ops: 0 };
      m[p].quantidade += o.quantidade_produzida || o.quantidade || 0;
      m[p].ops++;
    });
    return Object.values(m).sort((a,b)=>b.quantidade-a.quantidade).slice(0,10);
  }, [orsFiltrados]);

  const eficiencia = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  const auditarExportacao = async ({ nomeArquivo, linhas, sucesso = true, motivo = null }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        acao: sucesso ? "Exportação" : "RelatorioProducao.bloqueado",
        modulo: "Produção",
        entidade: "RelatorioProducao",
        tipo_auditoria: sucesso ? "ui" : "seguranca",
        descricao: sucesso ? `CSV ${nomeArquivo} exportado.` : motivo,
        dados_novos: { nomeArquivo, linhas, filtros },
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar exportação de produção:", error);
    }
  };

  const handleExportarCSV = async (dados, nomeArquivo) => {
    if (!contextoValido || !podeExportarRelatorio) {
      await auditarExportacao({ nomeArquivo, linhas: dados?.length || 0, sucesso: false, motivo: "Tentativa de exportar relatório de produção sem contexto ou permissão." });
      return;
    }
    exportarCSV(dados, nomeArquivo);
    await auditarExportacao({ nomeArquivo, linhas: dados?.length || 0 });
  };

  if (!contextoValido || !podeVerRelatorio) {
    return (
      <div className="space-y-6 w-full h-full" data-permission="Producao.Relatorios.visualizar" data-context-required="true">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 text-amber-800">
            {!contextoValido ? "Selecione um grupo ou empresa para visualizar relatórios de produção." : "Seu perfil não possui permissão para visualizar relatórios de produção."}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full h-full" data-permission="Producao.Relatorios.visualizar" data-context-required="true">
      <FiltrosPeriodoEmpresa filtros={filtros} setFiltros={setFiltros} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total de OPs', value: total, icon: Factory, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Concluídas', value: concluidas, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Em Andamento', value: emAndamento, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: `Eficiência ${eficiencia}%`, value: atrasadas + ' atrasadas', icon: AlertCircle, color: atrasadas > 0 ? 'text-red-600' : 'text-green-600', bg: atrasadas > 0 ? 'bg-red-50' : 'bg-green-50' },
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
              <CardTitle className="text-base">OPs por Mês (Total × Concluídas)</CardTitle>
              <Button size="sm" variant="outline" onClick={() => handleExportarCSV(producaoMensal, 'producao_mensal')} disabled={!podeExportarRelatorio} data-permission="Producao.Relatorios.exportar" data-action="RelatorioProducao.exportarMensal" data-sensitive>
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={producaoMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#94a3b8" name="Total" />
                <Bar dataKey="concluidas" fill="#10b981" name="Concluídas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">OPs por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={porStatus} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({name,value}) => `${name}: ${value}`} labelLine={false}>
                  {porStatus.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Top 10 Produtos Produzidos</CardTitle>
              <Button size="sm" variant="outline" onClick={() => handleExportarCSV(porProduto, 'top_produtos_producao')} disabled={!podeExportarRelatorio} data-permission="Producao.Relatorios.exportar" data-action="RelatorioProducao.exportarProdutos" data-sensitive>
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porProduto} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="produto" width={130} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="quantidade" fill="#8b5cf6" name="Qtd Produzida" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
