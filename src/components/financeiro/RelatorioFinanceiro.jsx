import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Download, Filter } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * Relatórios Financeiros Avançados
 */
export default function RelatorioFinanceiro({ empresaId, windowMode = false }) {
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaSelecionadaId = empresaId || empresaAtual?.id || null;
  const contextKey = empresaSelecionadaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewRelatorio = hasPermission("Financeiro", "Relatorios", "visualizar") ||
    hasPermission("Financeiro", "Relatorio Financeiro", "visualizar") ||
    hasPermission("Financeiro", null, "visualizar");
  const canExportRelatorio = hasPermission("Financeiro", "Relatorios", "exportar") ||
    hasPermission("Financeiro", "Relatorio Financeiro", "exportar") ||
    hasPermission("Financeiro", null, "exportar");

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contasReceber-analytics-financeiro', contextKey],
    queryFn: () => filterInContext('ContaReceber', empresaSelecionadaId ? { empresa_id: empresaSelecionadaId } : {}, '-data_vencimento', 5000),
    enabled: contextoValido && canViewRelatorio,
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ['contasPagar-analytics-financeiro', contextKey],
    queryFn: () => filterInContext('ContaPagar', empresaSelecionadaId ? { empresa_id: empresaSelecionadaId } : {}, '-data_vencimento', 5000),
    enabled: contextoValido && canViewRelatorio,
  });

  // Filtrar por empresa se necessário
  const receberFiltradas = contasReceber.filter(c => {
    if (empresaSelecionadaId && c.empresa_id && c.empresa_id !== empresaSelecionadaId) return false;
    if (groupId && c.group_id && c.group_id !== groupId && c.grupo_id !== groupId) return false;
    if (periodoInicio && c.data_vencimento < periodoInicio) return false;
    if (periodoFim && c.data_vencimento > periodoFim) return false;
    if (filtroCliente !== "todos" && c.cliente_id !== filtroCliente) return false;
    return true;
  });

  const pagarFiltradas = contasPagar.filter(c => {
    if (empresaSelecionadaId && c.empresa_id && c.empresa_id !== empresaSelecionadaId) return false;
    if (groupId && c.group_id && c.group_id !== groupId && c.grupo_id !== groupId) return false;
    if (periodoInicio && c.data_vencimento < periodoInicio) return false;
    if (periodoFim && c.data_vencimento > periodoFim) return false;
    return true;
  });

  // Por Forma de Pagamento
  const porFormaPagamento = {};
  receberFiltradas.filter(c => c.status === "Recebido").forEach(c => {
    const forma = c.forma_recebimento || "Outros";
    if (!porFormaPagamento[forma]) {
      porFormaPagamento[forma] = { forma, valor: 0, quantidade: 0 };
    }
    porFormaPagamento[forma].valor += c.valor_recebido || c.valor || 0;
    porFormaPagamento[forma].quantidade += 1;
  });

  const dadosFormaPagamento = Object.values(porFormaPagamento);

  // Cobranças Enviadas vs Pagas
  const cobrancasGeradas = receberFiltradas.filter(c => 
    c.status_cobranca && c.status_cobranca !== "nao_gerada"
  ).length;

  const cobrancasPagas = receberFiltradas.filter(c => 
    c.status_cobranca === "paga" || c.status === "Recebido"
  ).length;

  const taxaEfetividade = cobrancasGeradas > 0 
    ? ((cobrancasPagas / cobrancasGeradas) * 100).toFixed(1)
    : 0;

  // Baixas Automáticas vs Manuais
  const baixasAutomaticas = receberFiltradas.filter(c => 
    c.status === "Recebido" && c.webhook_status === "pago"
  ).length;

  const baixasManuais = receberFiltradas.filter(c => 
    c.status === "Recebido" && !c.webhook_status
  ).length;

  // Provisão de Recebimento
  const hoje = new Date();
  const em30dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
  const em60dias = new Date(hoje.getTime() + 60 * 24 * 60 * 60 * 1000);
  const em90dias = new Date(hoje.getTime() + 90 * 24 * 60 * 60 * 1000);

  const provisao = {
    ate30: receberFiltradas
      .filter(c => c.status === "Pendente" && new Date(c.data_vencimento) <= em30dias)
      .reduce((sum, c) => sum + (c.valor || 0), 0),
    ate60: receberFiltradas
      .filter(c => c.status === "Pendente" && new Date(c.data_vencimento) <= em60dias && new Date(c.data_vencimento) > em30dias)
      .reduce((sum, c) => sum + (c.valor || 0), 0),
    ate90: receberFiltradas
      .filter(c => c.status === "Pendente" && new Date(c.data_vencimento) <= em90dias && new Date(c.data_vencimento) > em60dias)
      .reduce((sum, c) => sum + (c.valor || 0), 0)
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  const content = (
    <div
      className="space-y-1.5 w-full h-full"
      data-permission="Financeiro.Relatorios.visualizar"
      data-context-required="group-or-company"
      data-can-export={canExportRelatorio ? "true" : "false"}
    >
      {(!contextoValido || !canViewRelatorio) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertDescription>
            Selecione grupo ou empresa e confirme permissao para visualizar relatorios financeiros.
          </AlertDescription>
        </Alert>
      )}
      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div>
              <Label>Período Início</Label>
              <Input
                type="date"
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Período Fim</Label>
              <Input
                type="date"
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Cliente</Label>
              <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                <SelectTrigger className="mt-2 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="formas-pagamento">
        <TabsList className="bg-white border flex-wrap h-auto">
          <TabsTrigger value="formas-pagamento">
            <CreditCard className="w-4 h-4 mr-2" />
            Formas de Pagamento
          </TabsTrigger>
          <TabsTrigger value="efetividade">
            <TrendingUp className="w-4 h-4 mr-2" />
            Efetividade
          </TabsTrigger>
          <TabsTrigger value="provisao">
            <DollarSign className="w-4 h-4 mr-2" />
            Provisão
          </TabsTrigger>
        </TabsList>

        <TabsContent value="formas-pagamento">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-base">Recebimentos por Forma</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {dadosFormaPagamento.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={dadosFormaPagamento}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ forma, valor }) => `${forma}: R$ ${valor.toFixed(0)}`}
                        outerRadius={100}
                        dataKey="valor"
                      >
                        {dadosFormaPagamento.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum recebimento registrado</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-base">Detalhamento</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Forma</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dadosFormaPagamento.map((forma, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{forma.forma}</TableCell>
                        <TableCell className="text-right">{forma.quantidade}</TableCell>
                        <TableCell className="text-right font-semibold">
                          R$ {forma.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="efetividade">
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-sm">Cobranças Geradas</CardTitle>
              </CardHeader>
              <CardContent className="p-6 text-center">
                <p className="text-4xl font-bold text-blue-900">{cobrancasGeradas}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-green-50">
                <CardTitle className="text-sm">Cobranças Pagas</CardTitle>
              </CardHeader>
              <CardContent className="p-6 text-center">
                <p className="text-4xl font-bold text-green-900">{cobrancasPagas}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-purple-50">
                <CardTitle className="text-sm">Taxa de Efetividade</CardTitle>
              </CardHeader>
              <CardContent className="p-6 text-center">
                <p className="text-4xl font-bold text-purple-900">{taxaEfetividade}%</p>
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-base">Baixas Automáticas vs Manuais</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[
                    { tipo: 'Automáticas', quantidade: baixasAutomaticas },
                    { tipo: 'Manuais', quantidade: baixasManuais }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tipo" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="quantidade" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="provisao">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base">Provisão de Recebimento (Aging)</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-6 mb-6">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-green-700 mb-2">Até 30 dias</p>
                    <p className="text-3xl font-bold text-green-900">
                      R$ {provisao.ate30.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-yellow-700 mb-2">31 a 60 dias</p>
                    <p className="text-3xl font-bold text-yellow-900">
                      R$ {provisao.ate60.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-orange-700 mb-2">61 a 90 dias</p>
                    <p className="text-3xl font-bold text-orange-900">
                      R$ {provisao.ate90.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  { periodo: '0-30 dias', valor: provisao.ate30 },
                  { periodo: '31-60 dias', valor: provisao.ate60 },
                  { periodo: '61-90 dias', valor: provisao.ate90 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" />
                  <YAxis />
                  <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                  <Bar dataKey="valor" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-indigo-50 overflow-auto p-1.5">{content}</div>;
  }

  return content;
}
