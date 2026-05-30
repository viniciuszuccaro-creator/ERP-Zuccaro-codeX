
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { AlertTriangle, TrendingDown, Download, Clock, DollarSign, Shield } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import ExportMenu from "@/components/ui/ExportMenu"; // Added import
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function DashboardInadimplencia({ empresaId }) {
  const [filtroRisco, setFiltroRisco] = useState("todos");
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaSelecionadaId = empresaId || empresaAtual?.id || null;
  const contextKey = empresaSelecionadaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewInadimplencia = hasPermission("Financeiro", "Inadimplencia", "visualizar") ||
    hasPermission("Financeiro", "Relatorios", "visualizar") ||
    hasPermission("Financeiro", null, "visualizar");

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contasReceber', 'dashboard-inadimplencia', contextKey],
    queryFn: () => filterInContext('ContaReceber', {}, '-data_vencimento', 9999),
    enabled: contextoValido && canViewInadimplencia,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', 'dashboard-inadimplencia', contextKey],
    queryFn: () => filterInContext('Cliente', {}, 'nome', 9999),
    enabled: contextoValido && canViewInadimplencia,
  });

  const hoje = new Date();

  // Analisar inadimplência
  const analisarInadimplencia = () => {
    const porCliente = {};

    contasReceber
      .filter(c => (!empresaSelecionadaId || c.empresa_id === empresaSelecionadaId))
      .forEach(conta => {
        const key = conta.cliente_id || conta.cliente;
        if (!key) return;

        if (!porCliente[key]) {
          const cliente = clientes.find(cl => cl.id === conta.cliente_id || cl.nome === conta.cliente);
          
          porCliente[key] = {
            cliente_id: conta.cliente_id,
            cliente_nome: conta.cliente,
            classificacao_abc: cliente?.classificacao_abc || 'Novo',
            titulos_total: 0,
            titulos_vencidos: 0,
            titulos_a_vencer: 0,
            valor_total: 0,
            valor_vencido: 0,
            valor_a_vencer: 0,
            dias_atraso_medio: 0,
            maior_atraso: 0,
            titulos: [],
            score_pagamento: cliente?.score_pagamento || 100,
            limite_credito: cliente?.condicao_comercial?.limite_credito || 0,
          };
        }

        const vencimento = new Date(conta.data_vencimento);
        const diasAtraso = differenceInDays(hoje, vencimento);

        porCliente[key].titulos_total += 1;
        porCliente[key].valor_total += conta.valor || 0;

        if (conta.status === 'Pendente') {
          porCliente[key].titulos.push({
            numero: conta.numero_documento,
            vencimento: conta.data_vencimento,
            valor: conta.valor,
            dias_atraso: Math.max(0, diasAtraso),
            status: diasAtraso > 0 ? 'Vencido' : 'A Vencer'
          });

          if (diasAtraso > 0) {
            porCliente[key].titulos_vencidos += 1;
            porCliente[key].valor_vencido += conta.valor || 0;
            
            if (diasAtraso > porCliente[key].maior_atraso) {
              porCliente[key].maior_atraso = diasAtraso;
            }
          } else {
            porCliente[key].titulos_a_vencer += 1;
            porCliente[key].valor_a_vencer += conta.valor || 0;
          }
        }
      });

    // Calcular dias médio de atraso e score de risco
    return Object.values(porCliente)
      .map(c => {
        const titulosVencidos = c.titulos.filter(t => t.dias_atraso > 0);
        c.dias_atraso_medio = titulosVencidos.length > 0
          ? titulosVencidos.reduce((sum, t) => sum + t.dias_atraso, 0) / titulosVencidos.length
          : 0;

        // Score de risco (0-100, quanto maior pior)
        c.score_risco = Math.min(100,
          (c.dias_atraso_medio * 2) +
          (c.titulos_vencidos * 5) +
          (c.maior_atraso) +
          ((c.valor_vencido / Math.max(1, c.limite_credito)) * 20)
        );

        // Classificação de risco
        if (c.score_risco >= 70 || c.dias_atraso_medio > 60) c.nivel_risco = 'Crítico';
        else if (c.score_risco >= 40 || c.dias_atraso_medio > 30) c.nivel_risco = 'Alto';
        else if (c.score_risco >= 20 || c.dias_atraso_medio > 15) c.nivel_risco = 'Médio';
        else if (c.titulos_vencidos > 0) c.nivel_risco = 'Baixo';
        else c.nivel_risco = 'OK';

        // Previsão de recebimento (baseado em histórico)
        const mediaRecebimento = c.dias_atraso_medio + 7; // Estimativa conservadora
        c.previsao_recebimento_dias = Math.ceil(mediaRecebimento);

        return c;
      })
      .filter(c => c.titulos_vencidos > 0 || filtroRisco === "todos")
      .sort((a, b) => b.score_risco - a.score_risco);
  };

  const dados = analisarInadimplencia();

  // Filtrar por risco
  const dadosFiltrados = filtroRisco === "todos" 
    ? dados 
    : dados.filter(c => c.nivel_risco === filtroRisco);

  // Totais
  const totalVencido = dados.reduce((sum, c) => sum + c.valor_vencido, 0);
  const totalAVencer = dados.reduce((sum, c) => sum + c.valor_a_vencer, 0);
  const totalTitulosVencidos = dados.reduce((sum, c) => sum + c.titulos_vencidos, 0);
  const diasAtrasoMedioGeral = dados.length > 0
    ? dados.reduce((sum, c) => sum + c.dias_atraso_medio, 0) / dados.length
    : 0;

  // Distribuição por nível de risco
  const distribuicaoRisco = ['Crítico', 'Alto', 'Médio', 'Baixo', 'OK'].map(nivel => {
    const clientesNivel = dados.filter(c => c.nivel_risco === nivel);
    return {
      nivel,
      quantidade: clientesNivel.length,
      valor: clientesNivel.reduce((sum, c) => sum + c.valor_vencido, 0),
    };
  });

  const COLORS = {
    'Crítico': '#ef4444',
    'Alto': '#f97316',
    'Médio': '#f59e0b',
    'Baixo': '#3b82f6',
    'OK': '#10b981'
  };

  // The exportarExcel function is removed as ExportMenu will handle it

  return (
    <div className="space-y-6 w-full h-full" data-permission="Financeiro.Inadimplencia.visualizar" data-context-required="group-or-company">
      {(!contextoValido || !canViewInadimplencia) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar inadimplencia.</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Dashboard de Inadimplência</h2>
          <p className="text-sm text-slate-600">Score de risco e análise de inadimplência</p> {/* Updated text */}
        </div>
        <div className="flex gap-3">
          <select
            value={filtroRisco}
            onChange={(e) => setFiltroRisco(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="todos">Todos</option>
            <option value="Crítico">Crítico</option>
            <option value="Alto">Alto</option>
            <option value="Médio">Médio</option>
            <option value="Baixo">Baixo</option>
            <option value="OK">OK</option>
          </select>
          <ExportMenu 
            data={dadosFiltrados.map(c => ({
              Cliente: c.cliente_nome,
              'Total Devido': `R$ ${c.valor_vencido.toFixed(2)}`,
              'Dias Atraso Médio': c.dias_atraso_medio.toFixed(0),
              'Score de Risco': c.score_risco.toFixed(0),
              Classificacao: c.nivel_risco,
              group_id: groupId,
              grupo_id: groupId,
              empresa_id: empresaSelecionadaId
            }))} 
            fileName="dashboard_inadimplencia" 
            title="Dashboard de Inadimplência"
            module="Financeiro"
            section="Inadimplencia"
            action="exportar"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Valor Vencido</p>
                <p className="text-2xl font-bold text-red-900">
                  R$ {totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-red-600 mt-1">{totalTitulosVencidos} títulos</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">A Vencer</p>
              <p className="text-2xl font-bold text-blue-600">
                R$ {totalAVencer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">próximos vencimentos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">Dias Atraso Médio</p>
                <p className="text-2xl font-bold text-orange-900">
                  {diasAtrasoMedioGeral.toFixed(0)}
                </p>
                <p className="text-xs text-orange-600 mt-1">dias</p>
              </div>
              <Clock className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">Clientes com Atraso</p>
              <p className="text-2xl font-bold text-slate-900">
                {dados.filter(c => c.titulos_vencidos > 0).length}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {((dados.filter(c => c.titulos_vencidos > 0).length / Math.max(1, dados.length)) * 100).toFixed(1)}% do total
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Distribuição por Nível de Risco */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Distribuição por Nível de Risco</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={distribuicaoRisco.filter(d => d.quantidade > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.nivel}: ${entry.quantidade}`}
                  outerRadius={100}
                  dataKey="quantidade"
                >
                  {distribuicaoRisco.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.nivel]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-3 gap-2 mt-4">
              {distribuicaoRisco.filter(d => d.quantidade > 0).map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg border" style={{ borderColor: COLORS[item.nivel] }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-600">{item.nivel}</p>
                      <p className="font-bold">{item.quantidade}</p>
                    </div>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[item.nivel] }} />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top 10 Maiores Devedores */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Top 10 Maiores Devedores</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosFiltrados.slice(0, 10)} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="cliente_nome" angle={-45} textAnchor="end" height={100} fontSize={10} />
                <YAxis />
                <Tooltip
                  formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Legend />
                <Bar dataKey="valor_vencido" fill="#ef4444" name="Valor Vencido" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Detalhada */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            Análise Detalhada de Inadimplência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Cliente</TableHead>
                  <TableHead>ABC</TableHead>
                  <TableHead className="text-right">Títulos Vencidos</TableHead>
                  <TableHead className="text-right">Valor Vencido</TableHead>
                  <TableHead className="text-right">Dias Atraso Médio</TableHead>
                  <TableHead className="text-right">Maior Atraso</TableHead>
                  <TableHead className="text-right">Score Risco</TableHead>
                  <TableHead>Nível Risco</TableHead>
                  <TableHead className="text-right">Previsão Recebimento</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosFiltrados.map((cliente, idx) => (
                  <TableRow key={idx} className={`hover:bg-slate-50 ${
                    cliente.nivel_risco === 'Crítico' ? 'bg-red-50' :
                    cliente.nivel_risco === 'Alto' ? 'bg-orange-50' : ''
                  }`}>
                    <TableCell className="font-medium">{cliente.cliente_nome}</TableCell>
                    <TableCell>
                      <Badge className={
                        cliente.classificacao_abc === 'A' ? 'bg-blue-100 text-blue-700' :
                        cliente.classificacao_abc === 'B' ? 'bg-green-100 text-green-700' :
                        'bg-yellow-100 text-yellow-700'
                      }>
                        {cliente.classificacao_abc}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      {cliente.titulos_vencidos}
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      R$ {cliente.valor_vencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      {cliente.dias_atraso_medio.toFixed(0)} dias
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {cliente.maior_atraso} dias
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, cliente.score_risco)}%`,
                              backgroundColor: COLORS[cliente.nivel_risco]
                            }}
                          />
                        </div>
                        <span className="font-bold text-sm">{cliente.score_risco.toFixed(0)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className="text-white"
                        style={{ backgroundColor: COLORS[cliente.nivel_risco] }}
                      >
                        {cliente.nivel_risco}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      ~{cliente.previsao_recebimento_dias} dias
                    </TableCell>
                    <TableCell>
                      {cliente.nivel_risco === 'Crítico' && (
                        <Badge className="bg-red-100 text-red-700">
                          Bloquear
                        </Badge>
                      )}
                      {cliente.nivel_risco === 'Alto' && (
                        <Badge className="bg-orange-100 text-orange-700">
                          Cobrar
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {dadosFiltrados.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <TrendingDown className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Nenhum cliente com inadimplência no filtro selecionado</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
