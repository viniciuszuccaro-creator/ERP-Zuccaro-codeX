import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import { Download, TrendingUp, TrendingDown, DollarSign, AlertCircle } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import FiltrosPeriodoEmpresa from "@/components/relatorios/FiltrosPeriodoEmpresa";
import { exportarCSV } from "@/components/relatorios/exportUtils";

export default function RelatorioFinanceiro() {
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
  const canViewRelatorio = hasPermission("Financeiro", "Relatorios", "visualizar") ||
    hasPermission("Financeiro", "Relatorio Financeiro", "visualizar") ||
    hasPermission("Financeiro", null, "visualizar");
  const canExportRelatorio = hasPermission("Financeiro", "Relatorios", "exportar") ||
    hasPermission("Financeiro", "Relatorio Financeiro", "exportar") ||
    hasPermission("Financeiro", null, "exportar");

  const { data: receber = [] } = useQuery({
    queryKey: ['rel-receber', contextKey],
    queryFn: () => filterInContext('ContaReceber', {}, '-data_vencimento', 9999),
    enabled: contextoValido && canViewRelatorio,
  });
  const { data: pagar = [] } = useQuery({
    queryKey: ['rel-pagar', contextKey],
    queryFn: () => filterInContext('ContaPagar', {}, '-data_vencimento', 9999),
    enabled: contextoValido && canViewRelatorio,
  });

  const filtrar = (lista, campo) => {
    const ini = new Date(filtros.data_inicio);
    const fim = new Date(filtros.data_fim + 'T23:59:59');
    return lista.filter(i => { const d = new Date(i[campo] || i.created_date); return d >= ini && d <= fim; });
  };

  const receberFiltrado = useMemo(() => filtrar(receber, 'data_vencimento'), [receber, filtros]);
  const pagarFiltrado = useMemo(() => filtrar(pagar, 'data_vencimento'), [pagar, filtros]);

  const totalReceber = receberFiltrado.reduce((s,i) => s+(i.valor||0), 0);
  const totalPagar = pagarFiltrado.reduce((s,i) => s+(i.valor||0), 0);
  const saldo = totalReceber - totalPagar;
  const inadimplentes = receberFiltrado.filter(i => i.status === 'Atrasado').length;

  const fluxoMensal = useMemo(() => {
    const mapa = {};
    receberFiltrado.forEach(i => {
      const m = (i.data_vencimento||'').slice(0,7); if(!m) return;
      if(!mapa[m]) mapa[m] = { mes: m, receitas: 0, despesas: 0 };
      mapa[m].receitas += i.valor || 0;
    });
    pagarFiltrado.forEach(i => {
      const m = (i.data_vencimento||'').slice(0,7); if(!m) return;
      if(!mapa[m]) mapa[m] = { mes: m, receitas: 0, despesas: 0 };
      mapa[m].despesas += i.valor || 0;
    });
    return Object.values(mapa).sort((a,b)=>a.mes.localeCompare(b.mes)).map(m => ({ ...m, saldo: m.receitas - m.despesas }));
  }, [receberFiltrado, pagarFiltrado]);

  const statusReceber = useMemo(() => {
    const m = {};
    receberFiltrado.forEach(i => { m[i.status||'N/A'] = (m[i.status||'N/A']||0) + (i.valor||0); });
    return Object.entries(m).map(([status, valor]) => ({ status, valor }));
  }, [receberFiltrado]);

  const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const auditarExportacao = async (nome, quantidade, sucesso = true) => {
    try {
      await base44.entities.AuditLog.create({
        acao: sucesso ? "Exportacao" : "Bloqueio",
        modulo: "Financeiro",
        entidade: "RelatorioFinanceiro",
        descricao: sucesso ? `Exportacao CSV do relatorio financeiro: ${nome}` : `Exportacao bloqueada no relatorio financeiro: ${nome}`,
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
      console.warn("Falha ao auditar exportacao do relatorio financeiro:", error);
    }
  };

  const exportarRelatorio = async (dados, nomeArquivo) => {
    const linhas = Array.isArray(dados) ? dados : [];
    if (!contextoValido || !canExportRelatorio) {
      await auditarExportacao(nomeArquivo, linhas.length, false);
      return;
    }
    if (!window.confirm(`Exportar ${linhas.length} registro(s) do relatorio financeiro (${nomeArquivo})?`)) {
      await auditarExportacao(`${nomeArquivo}: cancelado pelo usuario`, linhas.length, false);
      return;
    }
    const dadosComContexto = linhas.map((linha) => ({
      ...linha,
      group_id: linha.group_id || groupId,
      grupo_id: linha.grupo_id || linha.group_id || groupId,
      empresa_id: linha.empresa_id || empresaId
    }));
    exportarCSV(dadosComContexto, nomeArquivo);
    await auditarExportacao(nomeArquivo, dadosComContexto.length, true);
  };

  return (
    <div className="space-y-6 w-full h-full" data-permission="Financeiro.Relatorios.visualizar" data-context-required="group-or-company">
      {(!contextoValido || !canViewRelatorio) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar o relatorio financeiro.</AlertDescription>
        </Alert>
      )}
      <FiltrosPeriodoEmpresa filtros={filtros} setFiltros={setFiltros} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total a Receber', value: fmt(totalReceber), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total a Pagar', value: fmt(totalPagar), icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Saldo Projetado', value: fmt(saldo), icon: DollarSign, color: saldo >= 0 ? 'text-blue-600' : 'text-red-600', bg: saldo >= 0 ? 'bg-blue-50' : 'bg-red-50' },
          { label: 'Títulos Atrasados', value: inadimplentes, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
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
              <CardTitle className="text-base">Fluxo de Caixa Mensal (Receitas × Despesas)</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportarRelatorio(fluxoMensal, 'fluxo_mensal')} disabled={!contextoValido || !canExportRelatorio} data-action="RelatorioFinanceiro.exportarFluxo" data-permission="Financeiro.Relatorios.exportar" data-context-required="group-or-company" data-sensitive="true">
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={fluxoMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} />
                <Legend />
                <Bar dataKey="receitas" fill="#10b981" name="Receitas" />
                <Bar dataKey="despesas" fill="#ef4444" name="Despesas" />
                <Line type="monotone" dataKey="saldo" stroke="#3b82f6" strokeWidth={2} name="Saldo" dot={false} />
                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Contas a Receber por Status</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportarRelatorio(statusReceber, 'status_receber')} disabled={!contextoValido || !canExportRelatorio} data-action="RelatorioFinanceiro.exportarStatusReceber" data-permission="Financeiro.Relatorios.exportar" data-context-required="group-or-company" data-sensitive="true">
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusReceber}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} />
                <Bar dataKey="valor" fill="#10b981" name="Valor" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução do Saldo Projetado</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={fluxoMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="saldo" stroke="#3b82f6" strokeWidth={2} name="Saldo" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
