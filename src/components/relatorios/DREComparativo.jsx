import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Download, Calendar, AlertTriangle } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

import ExportMenu from "@/components/ui/ExportMenu";

export default function DREComparativo({ empresaId, windowMode = false }) {
  const [periodo, setPeriodo] = useState("3"); // 3, 6, 12 meses
  const [tipoGrafico, setTipoGrafico] = useState("linha");
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaSelecionadaId = empresaId || empresaAtual?.id || null;
  const contextKey = empresaSelecionadaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewDRE = hasPermission("Financeiro", "DRE", "visualizar") ||
    hasPermission("Financeiro", "Relatorios", "visualizar") ||
    hasPermission("Financeiro", null, "visualizar");
  const canExportDRE = hasPermission("Financeiro", "DRE", "exportar") ||
    hasPermission("Financeiro", "Relatorios", "exportar") ||
    hasPermission("Financeiro", null, "exportar");

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contasReceber', 'dre-comparativo', contextKey],
    queryFn: () => filterInContext('ContaReceber', {}, '-data_emissao', 9999),
    enabled: contextoValido && canViewDRE,
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ['contasPagar', 'dre-comparativo', contextKey],
    queryFn: () => filterInContext('ContaPagar', {}, '-data_emissao', 9999),
    enabled: contextoValido && canViewDRE,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos', 'dre-comparativo', contextKey],
    queryFn: () => filterInContext('Pedido', {}, '-data_pedido', 9999),
    enabled: contextoValido && canViewDRE,
  });

  // Gerar dados dos últimos N meses
  const gerarDadosPeriodo = () => {
    const meses = parseInt(periodo);
    const dados = [];
    
    for (let i = meses - 1; i >= 0; i--) {
      const dataRef = subMonths(new Date(), i);
      const mesRef = format(dataRef, 'yyyy-MM');
      const mesNome = format(dataRef, 'MMM/yy');
      
      const inicio = startOfMonth(dataRef);
      const fim = endOfMonth(dataRef);

      // Receita Bruta (pedidos faturados)
      const receitaBruta = pedidos
        .filter(p => {
          const dataPedido = new Date(p.data_pedido);
          return dataPedido >= inicio && dataPedido <= fim && 
                 (p.status === 'Faturado' || p.status === 'Entregue') &&
                 (!empresaSelecionadaId || p.empresa_id === empresaSelecionadaId);
        })
        .reduce((sum, p) => sum + (p.valor_total || 0), 0);

      // CPV (Custo dos Produtos Vendidos)
      const cpv = pedidos
        .filter(p => {
          const dataPedido = new Date(p.data_pedido);
          return dataPedido >= inicio && dataPedido <= fim && 
                 (p.status === 'Faturado' || p.status === 'Entregue') &&
                 (!empresaSelecionadaId || p.empresa_id === empresaSelecionadaId);
        })
        .reduce((sum, p) => sum + (p.custo_total || 0), 0);

      // Despesas (contas a pagar do período)
      const despesas = contasPagar
        .filter(c => {
          const dataEmissao = new Date(c.data_emissao);
          return dataEmissao >= inicio && dataEmissao <= fim &&
                 (!empresaSelecionadaId || c.empresa_id === empresaSelecionadaId);
        })
        .reduce((sum, c) => sum + (c.valor || 0), 0);

      const receitaLiquida = receitaBruta * 0.92; // Dedução de 8% (impostos)
      const lucroBruto = receitaLiquida - cpv;
      const lucroLiquido = lucroBruto - despesas;

      dados.push({
        mes: mesNome,
        mesCompleto: mesRef,
        receitaBruta,
        receitaLiquida,
        cpv,
        lucroBruto,
        despesas,
        lucroLiquido,
        margemBruta: receitaLiquida > 0 ? ((lucroBruto / receitaLiquida) * 100) : 0,
        margemLiquida: receitaLiquida > 0 ? ((lucroLiquido / receitaLiquida) * 100) : 0,
      });
    }
    
    return dados;
  };

  const dadosComparativos = gerarDadosPeriodo();

  // Calcular variações mês a mês
  const calcularVariacao = (mes, campo) => {
    const idx = dadosComparativos.findIndex(d => d.mes === mes);
    if (idx <= 0) return null;
    
    const atual = dadosComparativos[idx][campo];
    const anterior = dadosComparativos[idx - 1][campo];
    
    if (anterior === 0) return null;
    return ((atual - anterior) / anterior) * 100;
  };

  const ultimoMes = dadosComparativos[dadosComparativos.length - 1] || {};
  const penultimoMes = dadosComparativos[dadosComparativos.length - 2] || {};

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-6";

  return (
    <div className={containerClass} data-permission="Financeiro.DRE.visualizar" data-context-required="group-or-company">
      <div className={windowMode ? "p-6 space-y-6 flex-1 overflow-auto" : "space-y-6"}>
      {(!contextoValido || !canViewDRE) && (
        <Alert className="border-amber-300 bg-amber-50" data-permission="Financeiro.DRE.visualizar" data-context-required="group-or-company">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar o DRE comparativo.</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">DRE Comparativo Multi-Períodos</h2>
          <p className="text-sm text-slate-600">Análise comparativa de desempenho com IA</p>
        </div>
        <div className="flex gap-3">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipoGrafico} onValueChange={setTipoGrafico}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linha">Linha</SelectItem>
              <SelectItem value="barra">Barra</SelectItem>
            </SelectContent>
          </Select>
          <ExportMenu 
            data={dadosComparativos.map(d => ({
              Mês: d.mes,
              'Receita Bruta': d.receitaBruta,
              'Receita Líquida': d.receitaLiquida,
              CPV: d.cpv,
              'Lucro Bruto': d.lucroBruto,
              Despesas: d.despesas,
              'Lucro Líquido': d.lucroLiquido,
              'Margem Bruta %': d.margemBruta,
              'Margem Líquida %': d.margemLiquida,
              group_id: groupId,
              grupo_id: groupId,
              empresa_id: empresaSelecionadaId,
            }))} 
            fileName="dre_comparativo" 
            title="DRE Comparativo Multi-Períodos"
            module="Financeiro"
            section="DRE"
            action="exportar"
            disabled={!contextoValido || !canExportDRE}
          />
        </div>
      </div>

      {/* KPIs Último Mês */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Receita Líquida</p>
                <p className="text-2xl font-bold text-blue-600">
                  R$ {(ultimoMes.receitaLiquida || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                {penultimoMes.receitaLiquida && (
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    {calcularVariacao(ultimoMes.mes, 'receitaLiquida') > 0 ? (
                      <TrendingUp className="w-3 h-3 text-green-600" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-600" />
                    )}
                    {Math.abs(calcularVariacao(ultimoMes.mes, 'receitaLiquida') || 0).toFixed(1)}% vs mês anterior
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">Lucro Bruto</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {(ultimoMes.lucroBruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Margem: {(ultimoMes.margemBruta || 0).toFixed(1)}%
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">Despesas</p>
              <p className="text-2xl font-bold text-orange-600">
                R$ {(ultimoMes.despesas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {((ultimoMes.despesas / ultimoMes.receitaLiquida) * 100 || 0).toFixed(1)}% da receita
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">Lucro Líquido</p>
              <p className={`text-2xl font-bold ${ultimoMes.lucroLiquido >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                R$ {(ultimoMes.lucroLiquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Margem: {(ultimoMes.margemLiquida || 0).toFixed(1)}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Evolução */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Evolução Financeira</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {tipoGrafico === "linha" ? (
              <LineChart data={dadosComparativos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Legend />
                <Line type="monotone" dataKey="receitaLiquida" stroke="#3b82f6" name="Receita Líquida" strokeWidth={2} />
                <Line type="monotone" dataKey="lucroBruto" stroke="#10b981" name="Lucro Bruto" strokeWidth={2} />
                <Line type="monotone" dataKey="lucroLiquido" stroke="#8b5cf6" name="Lucro Líquido" strokeWidth={2} />
              </LineChart>
            ) : (
              <BarChart data={dadosComparativos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Legend />
                <Bar dataKey="receitaLiquida" fill="#3b82f6" name="Receita Líquida" />
                <Bar dataKey="lucroBruto" fill="#10b981" name="Lucro Bruto" />
                <Bar dataKey="lucroLiquido" fill="#8b5cf6" name="Lucro Líquido" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Comparativa */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Tabela Comparativa Detalhada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Receita Bruta</TableHead>
                  <TableHead className="text-right">Receita Líquida</TableHead>
                  <TableHead className="text-right">CPV</TableHead>
                  <TableHead className="text-right">Lucro Bruto</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Lucro Líquido</TableHead>
                  <TableHead className="text-right">Margem %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosComparativos.map((mes, idx) => {
                  const variacao = calcularVariacao(mes.mes, 'lucroLiquido');
                  return (
                    <TableRow key={idx} className="hover:bg-slate-50">
                      <TableCell className="font-medium">{mes.mes}</TableCell>
                      <TableCell className="text-right">
                        R$ {mes.receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {mes.receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        R$ {mes.cpv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-semibold">
                        R$ {mes.lucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        R$ {mes.despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${mes.lucroLiquido >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        R$ {mes.lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        {variacao !== null && (
                          <span className="text-xs ml-2">
                            {variacao > 0 ? '+' : ''}{variacao.toFixed(1)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-xs">
                          <div>Bruta: {mes.margemBruta.toFixed(1)}%</div>
                          <div>Líquida: {mes.margemLiquida.toFixed(1)}%</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
