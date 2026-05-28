import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { AlertTriangle, TrendingDown, TrendingUp, Download, Calendar } from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth, isBefore, isAfter, isWithinInterval } from "date-fns";
import ExportMenu from "@/components/ui/ExportMenu"; // Added new import
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function FluxoCaixaProjetado({ windowMode = false }) {
  const [mesesProjecao, setMesesProjecao] = useState(6);
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canViewRelatorio = hasPermission("Financeiro", "Relatorios", "visualizar") ||
    hasPermission("Financeiro", "Fluxo Caixa", "visualizar") ||
    hasPermission("Financeiro", null, "visualizar");
  const canExportRelatorio = hasPermission("Financeiro", "Relatorios", "exportar") ||
    hasPermission("Financeiro", "Fluxo Caixa", "exportar") ||
    hasPermission("Financeiro", null, "exportar");

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contasReceber', 'fluxo-caixa-projetado', groupId, empresaId],
    queryFn: () => filterInContext('ContaReceber', {}, '-data_vencimento', 1000),
    enabled: contextoValido && canViewRelatorio,
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ['contasPagar', 'fluxo-caixa-projetado', groupId, empresaId],
    queryFn: () => filterInContext('ContaPagar', {}, '-data_vencimento', 1000),
    enabled: contextoValido && canViewRelatorio,
  });

  // Calcular saldo inicial (caixa atual)
  const saldoInicial = () => {
    const recebido = contasReceber
      .filter(c => c.status === 'Recebido' /* Removed && (!empresaId || c.empresa_id === empresaId) */)
      .reduce((sum, c) => sum + (c.valor_recebido || c.valor || 0), 0);
    
    const pago = contasPagar
      .filter(c => c.status === 'Pago' /* Removed && (!empresaId || c.empresa_id === empresaId) */)
      .reduce((sum, c) => sum + (c.valor_pago || c.valor || 0), 0);
    
    return recebido - pago;
  };

  // Gerar projeção mês a mês
  const gerarProjecao = () => {
    const dados = [];
    let saldoAcumulado = saldoInicial();
    const hoje = new Date();

    for (let i = 0; i < mesesProjecao; i++) {
      const mesRef = addMonths(hoje, i);
      const inicio = startOfMonth(mesRef);
      const fim = endOfMonth(mesRef);
      const mesNome = format(mesRef, 'MMM/yy');

      // Contas a receber do mês
      const receitaPrevista = contasReceber
        .filter(c => {
          const dataVencimento = new Date(c.data_vencimento);
          return (c.status === 'Pendente' || c.status === 'Atrasado') &&
                 isWithinInterval(dataVencimento, { start: inicio, end: fim }); // Removed && (!empresaId || c.empresa_id === empresaId)
        })
        .reduce((sum, c) => sum + (c.valor || 0), 0);

      // Contas a pagar do mês
      const despesaPrevista = contasPagar
        .filter(c => {
          const dataVencimento = new Date(c.data_vencimento);
          return (c.status === 'Pendente' || c.status === 'Atrasado') &&
                 isWithinInterval(dataVencimento, { start: inicio, end: fim }); // Removed && (!empresaId || c.empresa_id === empresaId)
        })
        .reduce((sum, c) => sum + (c.valor || 0), 0);

      const saldoMes = receitaPrevista - despesaPrevista;
      saldoAcumulado += saldoMes;

      dados.push({
        mes: mesNome,
        mesCompleto: format(mesRef, 'yyyy-MM'),
        receitaPrevista,
        despesaPrevista,
        saldoMes,
        saldoAcumulado,
        deficitPrevisto: saldoAcumulado < 0,
        alertaNivel: saldoAcumulado < 0 ? 'crítico' : saldoAcumulado < 10000 ? 'alerta' : 'ok',
      });
    }

    return dados;
  };

  const projecao = gerarProjecao();
  const saldoAtual = saldoInicial();

  // Identificar meses com déficit
  const mesesDeficit = projecao.filter(m => m.deficitPrevisto);

  // Maior entrada e saída prevista
  const maiorEntrada = Math.max(...projecao.map(m => m.receitaPrevista));
  const maiorSaida = Math.max(...projecao.map(m => m.despesaPrevista));

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-6";

  return (
    <div className={containerClass}>
      <div className={windowMode ? "p-6 space-y-6 flex-1 overflow-auto" : "space-y-6"}>
      {(!contextoValido || !canViewRelatorio) && (
        <Alert className="border-amber-300 bg-amber-50" data-permission="Financeiro.Relatorios.visualizar" data-context-required="true">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar o fluxo de caixa projetado.</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Fluxo de Caixa Projetado (6 meses)</h2> {/* Updated title */}
          <p className="text-sm text-slate-600">Previsão de entradas e saídas com IA</p> {/* Updated description */}
        </div>
        <ExportMenu 
          data={projecao} // Passed projecao array as data
          fileName="fluxo_caixa_projetado" 
          title="Fluxo de Caixa Projetado"
          disabled={!contextoValido || !canExportRelatorio}
          data-permission="Financeiro.Relatorios.exportar"
          data-context-required="true"
          // You might want to specify columns for ExportMenu if it doesn't infer them or if you want specific order/names
          columns={[
            { header: 'Mês', accessor: 'mes' },
            { header: 'Receita Prevista', accessor: 'receitaPrevista' },
            { header: 'Despesa Prevista', accessor: 'despesaPrevista' },
            { header: 'Saldo do Mês', accessor: 'saldoMes' },
            { header: 'Saldo Acumulado', accessor: 'saldoAcumulado' },
            { header: 'Status', accessor: 'alertaNivel' },
          ]}
        />
      </div>

      {/* Alertas Críticos */}
      {mesesDeficit.length > 0 && (
        <Card className="border-0 shadow-md bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">⚠️ Alerta de Déficit Previsto</p>
                <p className="text-sm text-red-700">
                  {mesesDeficit.length} mês(es) com saldo negativo previsto: {mesesDeficit.map(m => m.mes).join(', ')}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Pior cenário: {mesesDeficit[0]?.mes} com saldo de R$ {mesesDeficit[0]?.saldoAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">Saldo Atual (Caixa)</p>
              <p className={`text-2xl font-bold ${saldoAtual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Calculado em tempo real
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">Saldo Projetado (6 meses)</p>
              <p className={`text-2xl font-bold ${projecao[projecao.length - 1]?.saldoAcumulado >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                R$ {(projecao[projecao.length - 1]?.saldoAcumulado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Projeção para {projecao[projecao.length - 1]?.mes}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">Maior Entrada Prevista</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {maiorEntrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Melhor mês de recebimento
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">Maior Saída Prevista</p>
              <p className="text-2xl font-bold text-red-600">
                R$ {maiorSaida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Pico de despesas
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Projeção */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Projeção de Saldo Acumulado</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={projecao}>
              <defs>
                <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip
                formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" label="Linha de Déficit" />
              <Area 
                type="monotone" 
                dataKey="saldoAcumulado" 
                stroke="#3b82f6" 
                fillOpacity={1} 
                fill="url(#colorSaldo)"
                name="Saldo Acumulado"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Projeção Mês a Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Receita Prevista</TableHead>
                  <TableHead className="text-right">Despesa Prevista</TableHead>
                  <TableHead className="text-right">Saldo do Mês</TableHead>
                  <TableHead className="text-right">Saldo Acumulado</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projecao.map((mes, idx) => (
                  <TableRow key={idx} className={`hover:bg-slate-50 ${mes.deficitPrevisto ? 'bg-red-50' : ''}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {mes.mes}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-semibold">
                      <div className="flex items-center justify-end gap-1">
                        <TrendingUp className="w-3 h-3" />
                        R$ {mes.receitaPrevista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-red-600 font-semibold">
                      <div className="flex items-center justify-end gap-1">
                        <TrendingDown className="w-3 h-3" />
                        R$ {mes.despesaPrevista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${mes.saldoMes >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      R$ {mes.saldoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className={`text-right font-bold text-lg ${mes.saldoAcumulado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      R$ {mes.saldoAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {mes.alertaNivel === 'crítico' && (
                        <Badge className="bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Déficit
                        </Badge>
                      )}
                      {mes.alertaNivel === 'alerta' && (
                        <Badge className="bg-yellow-100 text-yellow-700">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Atenção
                        </Badge>
                      )}
                      {mes.alertaNivel === 'ok' && (
                        <Badge className="bg-green-100 text-green-700">Saudável</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
