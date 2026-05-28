import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import { Download, TrendingUp, TrendingDown, DollarSign, Percent, AlertCircle } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import FiltrosPeriodoEmpresa from "@/components/relatorios/FiltrosPeriodoEmpresa";
import { exportarCSV } from "@/components/relatorios/exportUtils";

export default function RelatorioDRE() {
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
  const canViewDRE = hasPermission("Financeiro", "DRE", "visualizar") ||
    hasPermission("Financeiro", "Relatorios", "visualizar") ||
    hasPermission("Financeiro", null, "visualizar");
  const canExportDRE = hasPermission("Financeiro", "DRE", "exportar") ||
    hasPermission("Financeiro", "Relatorios", "exportar") ||
    hasPermission("Financeiro", null, "exportar");

  const { data: pedidos = [] } = useQuery({
    queryKey: ['dre-pedidos', contextKey],
    queryFn: () => filterInContext('Pedido', {}, '-data_pedido', 9999),
    enabled: contextoValido && canViewDRE,
  });
  const { data: pagar = [] } = useQuery({
    queryKey: ['dre-pagar', contextKey],
    queryFn: () => filterInContext('ContaPagar', {}, '-data_vencimento', 9999),
    enabled: contextoValido && canViewDRE,
  });

  const filtrar = (lista, campo) => {
    const ini = new Date(filtros.data_inicio);
    const fim = new Date(filtros.data_fim + 'T23:59:59');
    return lista.filter(i => { const d = new Date(i[campo]||i.created_date); return d>=ini && d<=fim; });
  };

  const pedidosFiltrados = useMemo(() => filtrar(pedidos.filter(p=>p.status!=='Cancelado'), 'data_pedido'), [pedidos, filtros]);
  const pagarFiltrado = useMemo(() => filtrar(pagar, 'data_vencimento'), [pagar, filtros]);

  const receitaBruta = pedidosFiltrados.reduce((s,p)=>s+(p.valor_total||0),0);
  const cmv = pedidosFiltrados.reduce((s,p)=>{
    const itens = [...(p.itens_revenda||[]),...(p.itens_armado_padrao||[]),...(p.itens_corte_dobra||[])];
    return s + itens.reduce((si,it)=> si+((it.custo_unitario||it.custo_medio||0)*(it.quantidade||0)),0);
  },0);
  const lucroBruto = receitaBruta - cmv;
  const despesasOperacionais = pagarFiltrado.reduce((s,i)=>s+(i.valor||0),0);
  const ebitda = lucroBruto - despesasOperacionais;
  const margemBruta = receitaBruta > 0 ? (lucroBruto/receitaBruta)*100 : 0;
  const margemLiquida = receitaBruta > 0 ? (ebitda/receitaBruta)*100 : 0;

  const dreMensal = useMemo(() => {
    const m = {};
    pedidosFiltrados.forEach(p => {
      const mes = (p.data_pedido||'').slice(0,7); if(!mes) return;
      if(!m[mes]) m[mes] = { mes, receita: 0, cmv: 0, despesas: 0 };
      m[mes].receita += p.valor_total||0;
      const itens = [...(p.itens_revenda||[]),...(p.itens_armado_padrao||[]),...(p.itens_corte_dobra||[])];
      m[mes].cmv += itens.reduce((s,it)=>s+((it.custo_unitario||it.custo_medio||0)*(it.quantidade||0)),0);
    });
    pagarFiltrado.forEach(i => {
      const mes = (i.data_vencimento||'').slice(0,7); if(!mes) return;
      if(!m[mes]) m[mes] = { mes, receita: 0, cmv: 0, despesas: 0 };
      m[mes].despesas += i.valor||0;
    });
    return Object.values(m).sort((a,b)=>a.mes.localeCompare(b.mes)).map(m => ({
      ...m,
      lucro_bruto: m.receita - m.cmv,
      ebitda: m.receita - m.cmv - m.despesas,
      margem: m.receita > 0 ? ((m.receita-m.cmv-m.despesas)/m.receita*100).toFixed(1) : 0,
    }));
  }, [pedidosFiltrados, pagarFiltrado]);

  const despesasPorCategoria = useMemo(() => {
    const m = {};
    pagarFiltrado.forEach(i => { m[i.categoria||'Outros'] = (m[i.categoria||'Outros']||0)+(i.valor||0); });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([categoria,valor])=>({ categoria, valor }));
  }, [pagarFiltrado]);

  const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const fmtPct = v => `${Number(v).toFixed(1)}%`;

  const linhasDRE = [
    { label: '(+) Receita Bruta', valor: receitaBruta, destaque: false },
    { label: '(-) CMV / CPV', valor: -cmv, destaque: false },
    { label: '(=) Lucro Bruto', valor: lucroBruto, destaque: true, margem: margemBruta },
    { label: '(-) Despesas Operacionais', valor: -despesasOperacionais, destaque: false },
    { label: '(=) EBITDA / Resultado', valor: ebitda, destaque: true, margem: margemLiquida },
  ];

  const auditarExportacao = async (nome, quantidade, sucesso = true) => {
    try {
      await base44.entities.AuditLog.create({
        acao: sucesso ? "Exportacao" : "Bloqueio",
        modulo: "Financeiro",
        entidade: "RelatorioDRE",
        descricao: sucesso ? `Exportacao CSV do DRE: ${nome}` : `Exportacao bloqueada no DRE: ${nome}`,
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
      console.warn("Falha ao auditar exportacao do DRE:", error);
    }
  };

  const exportarDRE = async (dados, nomeArquivo) => {
    if (!contextoValido || !canExportDRE) {
      await auditarExportacao(nomeArquivo, dados?.length || 0, false);
      return;
    }
    exportarCSV(dados, nomeArquivo);
    await auditarExportacao(nomeArquivo, dados?.length || 0, true);
  };

  return (
    <div className="space-y-6 w-full h-full" data-permission="Financeiro.DRE.visualizar" data-context-required="group-or-company">
      {(!contextoValido || !canViewDRE) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar o DRE.</AlertDescription>
        </Alert>
      )}
      <FiltrosPeriodoEmpresa filtros={filtros} setFiltros={setFiltros} />

      {/* DRE Resumido */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base">DRE Resumida — {filtros.data_inicio} a {filtros.data_fim}</CardTitle>
            <Button size="sm" variant="outline" onClick={() => exportarDRE(linhasDRE.map(l=>({descricao:l.label, valor:l.valor, margem:l.margem})), 'dre_resumida')} disabled={!contextoValido || !canExportDRE} data-action="RelatorioDRE.exportarResumo" data-permission="Financeiro.DRE.exportar" data-context-required="group-or-company" data-sensitive="true">
              <Download className="w-3 h-3 mr-1" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {linhasDRE.map((linha, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-2 rounded-lg ${linha.destaque ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'}`}>
                <span className={`text-sm ${linha.destaque ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>{linha.label}</span>
                <div className="flex items-center gap-4">
                  {linha.margem !== undefined && (
                    <Badge variant="outline" className={linha.margem >= 0 ? 'text-green-700 border-green-300' : 'text-red-700 border-red-300'}>
                      {fmtPct(linha.margem)}
                    </Badge>
                  )}
                  <span className={`text-sm font-semibold ${linha.valor >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt(linha.valor)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Receita Bruta', value: fmt(receitaBruta), icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Lucro Bruto', value: fmt(lucroBruto), icon: DollarSign, color: lucroBruto>=0?'text-green-600':'text-red-600', bg: lucroBruto>=0?'bg-green-50':'bg-red-50' },
          { label: 'EBITDA', value: fmt(ebitda), icon: ebitda>=0?TrendingUp:TrendingDown, color: ebitda>=0?'text-green-600':'text-red-600', bg: ebitda>=0?'bg-green-50':'bg-red-50' },
          { label: 'Margem Líquida', value: fmtPct(margemLiquida), icon: Percent, color: margemLiquida>=0?'text-purple-600':'text-red-600', bg: 'bg-purple-50' },
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
              <CardTitle className="text-base">DRE Mensal (Receita × CMV × EBITDA)</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportarDRE(dreMensal, 'dre_mensal')} disabled={!contextoValido || !canExportDRE} data-action="RelatorioDRE.exportarMensal" data-permission="Financeiro.DRE.exportar" data-context-required="group-or-company" data-sensitive="true">
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={dreMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => typeof v === 'number' ? fmt(v) : v} />
                <Legend />
                <Bar dataKey="receita" fill="#3b82f6" name="Receita" />
                <Bar dataKey="cmv" fill="#f59e0b" name="CMV" />
                <Bar dataKey="despesas" fill="#ef4444" name="Despesas" />
                <Line type="monotone" dataKey="ebitda" stroke="#10b981" strokeWidth={2} name="EBITDA" dot={{ r: 3 }} />
                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Despesas por Categoria</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportarDRE(despesasPorCategoria, 'despesas_categoria')} disabled={!contextoValido || !canExportDRE} data-action="RelatorioDRE.exportarDespesas" data-permission="Financeiro.DRE.exportar" data-context-required="group-or-company" data-sensitive="true">
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={despesasPorCategoria} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="categoria" width={130} tick={{ fontSize: 9 }} />
                <Tooltip formatter={v => fmt(v)} />
                <Bar dataKey="valor" fill="#ef4444" name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução da Margem Líquida (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dreMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={v => `${v}%`} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="margem" stroke="#8b5cf6" strokeWidth={2} name="Margem %" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
