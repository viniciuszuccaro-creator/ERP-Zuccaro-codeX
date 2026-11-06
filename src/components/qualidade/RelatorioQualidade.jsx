import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  resolveRelatorioQualidadeKpiState,
  isRelatorioQualidadeScopeCurrent,
  buildRelatorioQualidadeQueryKey,
  filterInspecoesPorPeriodo,
  buildRelatorioQualidadeKpis,
} from "./relatorioQualidadeScope";

function readRelatorioQualidadeActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === "string" && session.actorId.trim()
    ? session.actorId.trim()
    : null;
  return { actorId, sessionKey: central360SessionKey(session?.token) };
}

/**
 * InspecaoQualidade via filterInContext; KPI 0 ≠ ready em loading/erro.
 */
export default function RelatorioQualidade({ empresaId: empresaIdProp }) {
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const [periodoInicio, setPeriodoInicio] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [periodoFim, setPeriodoFim] = useState(
    new Date().toISOString().split('T')[0]
  );

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaIdProp
    || (contexto === 'grupo' ? null : (empresaAtual?.id || null));
  const contextoValido = Boolean(groupId || empresaId);
  const { actorId, sessionKey } = readRelatorioQualidadeActorAndSession();
  const scopeExpected = { actorId, sessionKey };

  const inspecoesQuery = useQuery({
    queryKey: buildRelatorioQualidadeQueryKey({
      groupId, empresaId, actorId, sessionKey, periodoInicio, periodoFim,
    }),
    queryFn: async ({ signal }) => {
      const todas = await filterInContext('InspecaoQualidade', {}, '-created_date', 2000);
      if (signal?.aborted) {
        const err = new Error('RELATORIO_QUALIDADE_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isRelatorioQualidadeScopeCurrent(scopeExpected, readRelatorioQualidadeActorAndSession())) {
        throw new Error('RELATORIO_QUALIDADE_STALE_SCOPE');
      }
      return filterInspecoesPorPeriodo(todas, periodoInicio, periodoFim);
    },
    enabled: contextoValido,
  });

  const kpiState = resolveRelatorioQualidadeKpiState({
    contextoValido,
    isLoading: inspecoesQuery.isLoading,
    isError: inspecoesQuery.isError,
    isFetching: inspecoesQuery.isFetching,
    dataDefined: inspecoesQuery.data !== undefined,
  });
  const ready = kpiState === 'ready';
  const inspecoes = ready && Array.isArray(inspecoesQuery.data) ? inspecoesQuery.data : [];
  const {
    totalInspecoes,
    aprovadas,
    reprovadas,
    revisar,
    taxaAprovacao,
    tempoMedio,
  } = buildRelatorioQualidadeKpis(inspecoes);
  const kpiIndisponivel = !ready;

  // Por resultado
  const dadosResultado = [
    { nome: "Aprovado", valor: aprovadas, cor: "#10b981" },
    { nome: "Reprovado", valor: reprovadas, cor: "#ef4444" },
    { nome: "Revisar", valor: revisar, cor: "#f59e0b" }
  ].filter(d => d.valor > 0);

  // Por motivo de reprovação
  const porMotivo = {};
  inspecoes.filter(i => i.resultado === "Reprovado").forEach(i => {
    const motivo = i.motivo_reprovacao?.substring(0, 50) || "Não informado";
    porMotivo[motivo] = (porMotivo[motivo] || 0) + 1;
  });

  const dadosMotivos = Object.entries(porMotivo)
    .map(([motivo, qtd]) => ({ motivo, quantidade: qtd }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10);

  // Por responsável
  const porResponsavel = {};
  inspecoes.forEach(i => {
    const resp = i.responsavel_nome || "Não informado";
    if (!porResponsavel[resp]) {
      porResponsavel[resp] = { total: 0, aprovadas: 0, reprovadas: 0 };
    }
    porResponsavel[resp].total++;
    if (i.resultado === "Aprovado") porResponsavel[resp].aprovadas++;
    if (i.resultado === "Reprovado") porResponsavel[resp].reprovadas++;
  });

  const dadosResponsaveis = Object.entries(porResponsavel)
    .map(([resp, dados]) => ({
      responsavel: resp,
      ...dados,
      taxa_aprovacao: dados.total > 0 ? ((dados.aprovadas / dados.total) * 100).toFixed(1) : 0
    }))
    .sort((a, b) => b.total - a.total);

  const exportarExcel = () => {
    if (kpiIndisponivel) return;
    const csv = [
      ['Relatório de Qualidade'],
      ['Período', `${periodoInicio} a ${periodoFim}`],
      [''],
      ['KPIs'],
      ['Total Inspeções', totalInspecoes],
      ['Aprovadas', aprovadas],
      ['Reprovadas', reprovadas],
      ['Taxa Aprovação', `${taxaAprovacao}%`],
      ['Tempo Médio (min)', tempoMedio.toFixed(1)],
      [''],
      ['Por Responsável'],
      ['Inspetor', 'Total', 'Aprovadas', 'Reprovadas', 'Taxa'],
      ...dadosResponsaveis.map(r => [r.responsavel, r.total, r.aprovadas, r.reprovadas, `${r.taxa_aprovacao}%`])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Qualidade_${periodoInicio}_${periodoFim}.csv`;
    link.click();
  };

  const kpiText = (value) => (kpiIndisponivel ? '…' : value);

  return (
    <div className="w-full h-full space-y-6">
      {!contextoValido && (
        <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Selecione um grupo ou empresa para carregar o relatório de qualidade no escopo correto.
        </div>
      )}
      {/* Filtros */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <Label className="text-xs">Período Inicial</Label>
              <Input
                type="date"
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Período Final</Label>
              <Input
                type="date"
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={exportarExcel} disabled={kpiIndisponivel}>
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <p className="text-xs text-slate-600">Total</p>
            <p className="text-2xl font-bold">{kpiText(totalInspecoes)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-green-50">
          <CardContent className="p-4">
            <div className="flex justify-between">
              <div>
                <p className="text-xs text-green-700">Aprovadas</p>
                <p className="text-2xl font-bold text-green-900">{kpiText(aprovadas)}</p>
                <p className="text-xs text-green-600 mt-1">{kpiIndisponivel ? '…' : `${taxaAprovacao}%`}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-red-50">
          <CardContent className="p-4">
            <div className="flex justify-between">
              <div>
                <p className="text-xs text-red-700">Reprovadas</p>
                <p className="text-2xl font-bold text-red-900">{kpiText(reprovadas)}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-blue-50">
          <CardContent className="p-4">
            <p className="text-xs text-blue-700">Tempo Médio</p>
            <p className="text-2xl font-bold text-blue-900">
              {kpiIndisponivel ? '…' : `${tempoMedio.toFixed(0)} min`}
            </p>
          </CardContent>
        </Card>
      </div>

      {kpiIndisponivel ? (
        <div className="text-sm text-slate-500 p-4">
          {kpiState === 'loading' ? 'Carregando inspeções…' : kpiState === 'error' ? 'Erro ao carregar inspeções.' : 'Contexto indisponível.'}
        </div>
      ) : (
        <>
      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pizza Resultados */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base">Distribuição de Resultados</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosResultado}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ nome, valor }) => `${nome}: ${valor}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="valor"
                >
                  {dadosResultado.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cor} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Motivos Reprovação */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base">Principais Motivos de Reprovação</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosMotivos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="motivo" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={120} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantidade" fill="#ef4444" name="Ocorrências" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Inspetores */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base">Performance dos Inspetores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Inspetor</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Aprovadas</TableHead>
                <TableHead className="text-center">Reprovadas</TableHead>
                <TableHead className="text-center">Taxa Aprovação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dadosResponsaveis.map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{r.responsavel}</TableCell>
                  <TableCell className="text-center">{r.total}</TableCell>
                  <TableCell className="text-center text-green-600">{r.aprovadas}</TableCell>
                  <TableCell className="text-center text-red-600">{r.reprovadas}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={
                      parseFloat(r.taxa_aprovacao) >= 95 ? 'bg-green-100 text-green-700' :
                      parseFloat(r.taxa_aprovacao) >= 85 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }>
                      {r.taxa_aprovacao}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {dadosResponsaveis.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhuma inspeção no período</p>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}
