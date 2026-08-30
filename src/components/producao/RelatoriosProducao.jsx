import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { Factory, Clock, TrendingUp, DollarSign, AlertTriangle, Download, Printer } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";

export default function RelatoriosProducao({ ops = [] }) {
  const { contexto, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const { toast } = useToast();
  const empresaId = contexto === 'grupo' ? null : (empresaAtual?.id || null);
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = contexto === 'grupo'
    ? Boolean(groupId)
    : Boolean(groupId && empresaId);
  const canViewReports = hasPermission("Produção", "Relatórios", "visualizar") ||
    hasPermission("Produção", "Relatórios", "ver") ||
    hasPermission("Producao", "Relatorios", "visualizar") ||
    hasPermission("Producao", "Relatorios", "ver") ||
    hasPermission("Producao", null, "visualizar");
  const canExportReports = hasPermission("Produção", "Relatórios", "exportar") ||
    hasPermission("Producao", "Relatorios", "exportar") ||
    hasPermission("Producao", null, "exportar");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");

  const opsContextuais = Array.isArray(ops) ? ops.filter(op => {
    const registroGroupId = op.group_id || op.grupo_id;
    const registroEmpresaId = op.empresa_id || op.empresa_dona_id;
    if (registroGroupId !== groupId) return false;
    if (empresaId && registroEmpresaId !== empresaId) return false;
    return true;
  }) : [];

  const opsFiltradas = opsContextuais.filter(op => {
    if (periodoInicio && op.data_emissao < periodoInicio) return false;
    if (periodoFim && op.data_emissao > periodoFim) return false;
    return true;
  });

  const totalOPs = opsFiltradas.length;
  const opsFinalizadas = opsFiltradas.filter(op => op.status === "Finalizada").length;
  const taxaConclusao = totalOPs > 0 ? ((opsFinalizadas / totalOPs) * 100).toFixed(1) : 0;

  const pesoTotal = opsFiltradas.reduce((sum, op) => sum + (op.peso_teorico_total_kg || 0), 0);
  const pesoReal = opsFiltradas.reduce((sum, op) => sum + (op.peso_real_total_kg || 0), 0);
  const perdaTotal = opsFiltradas.reduce((sum, op) => sum + (op.perda_kg_real || 0), 0);
  const taxaPerda = pesoTotal > 0 ? ((perdaTotal / pesoTotal) * 100).toFixed(2) : 0;

  const custoPrevisto = opsFiltradas.reduce((sum, op) => sum + (op.custos_previstos?.total || 0), 0);
  const custoReal = opsFiltradas.reduce((sum, op) => sum + (op.custos_reais?.total || 0), 0);
  const variacaoCusto = custoPrevisto > 0 ? (((custoReal - custoPrevisto) / custoPrevisto) * 100).toFixed(1) : 0;

  const tempoEstimado = opsFiltradas.reduce((sum, op) => sum + (op.tempo_estimado_horas || 0), 0);
  const tempoReal = opsFiltradas.reduce((sum, op) => sum + (op.tempo_real_horas || 0), 0);
  const eficienciaMedia = tempoEstimado > 0 && tempoReal > 0
    ? ((tempoEstimado / tempoReal) * 100).toFixed(1)
    : 0;

  const porStatus = {};
  opsFiltradas.forEach(op => {
    const status = op.status || "Rascunho";
    if (!porStatus[status]) {
      porStatus[status] = 0;
    }
    porStatus[status] += 1;
  });
  const dadosStatus = Object.entries(porStatus).map(([status, quantidade]) => ({
    status,
    quantidade
  }));

  const porTipo = {};
  opsFiltradas.forEach(op => {
    const tipo = op.tipo_producao || "outro";
    if (!porTipo[tipo]) {
      porTipo[tipo] = { tipo, quantidade: 0, peso: 0 };
    }
    porTipo[tipo].quantidade += 1;
    porTipo[tipo].peso += op.peso_real_total_kg || 0;
  });
  const dadosTipo = Object.values(porTipo);

  const porOperador = {};
  opsFiltradas.forEach(op => {
    (op.apontamentos || []).forEach(apt => {
      const operador = apt.operador || "Não informado";
      if (!porOperador[operador]) {
        porOperador[operador] = { operador, ops: 0, peso: 0, tempo: 0, refugo: 0 };
      }
      porOperador[operador].peso += apt.peso_produzido_kg || 0;
      porOperador[operador].tempo += apt.tempo_minutos || 0;
      porOperador[operador].refugo += apt.peso_refugado_kg || 0;
    });
  });
  const dadosOperadores = Object.values(porOperador);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const auditRelatorioProducao = async ({ acao, descricao, sucesso = true, dadosNovos = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario_id: user?.id,
        usuario: user?.full_name || user?.email || 'Usuário',
        acao,
        modulo: 'Produção',
        tipo_auditoria: sucesso ? 'relatorio' : 'seguranca',
        entidade: 'RelatoriosProducao',
        descricao,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        sucesso,
        dados_novos: dadosNovos,
        detalhes: {
          periodoInicio,
          periodoFim,
          quantidade_ops: opsFiltradas.length,
          contexto,
          ...dadosNovos,
        },
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar relatório de produção:', error);
    }
  };

  const handleExportarCSV = async () => {
    if (!contextoValido || !canViewReports || !canExportReports) {
      await auditRelatorioProducao({
        acao: 'RelatoriosProducao.exportar_bloqueado',
        descricao: 'Tentativa de exportar relatório de produção sem contexto ou permissão.',
        sucesso: false,
        dadosNovos: { motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada' },
      });
      toast({ title: 'Acesso negado', description: 'Selecione contexto válido e confirme permissão de exportação.', variant: 'destructive' });
      return;
    }

    const confirmado = window.confirm(`Confirma exportar ${opsFiltradas.length} ordens de producao para CSV?`);
    if (!confirmado) {
      await auditRelatorioProducao({
        acao: 'RelatoriosProducao.exportar_cancelado',
        descricao: 'Exportacao CSV cancelada pelo usuario.',
        sucesso: false,
        dadosNovos: { motivo: 'confirmacao_cancelada', quantidade_ops: opsFiltradas.length },
      });
      return;
    }

    const headers = ['numero_op', 'status', 'tipo_producao', 'data_emissao', 'peso_teorico_total_kg', 'peso_real_total_kg', 'perda_kg_real', 'custo_previsto', 'custo_real', 'group_id', 'grupo_id', 'empresa_id'];
    const linhas = opsFiltradas.map(op => [
      op.numero_op || op.numero || op.id || '',
      op.status || '',
      op.tipo_producao || '',
      op.data_emissao || '',
      op.peso_teorico_total_kg || 0,
      op.peso_real_total_kg || 0,
      op.perda_kg_real || 0,
      op.custos_previstos?.total || 0,
      op.custos_reais?.total || 0,
      groupId || '',
      groupId || '',
      empresaId || '',
    ]);
    const csv = [headers, ...linhas]
      .map(row => row.map(value => {
        const semQuebras = String(value ?? '').replace(/\r?\n|\r/g, ' ');
        const seguro = /^[=+\-@]/.test(semQuebras.trimStart()) ? `'${semQuebras}` : semQuebras;
        return `"${seguro.replace(/"/g, '""')}"`;
      }).join(';'))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-producao-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    await auditRelatorioProducao({
      acao: 'Exportação',
      descricao: 'Exportação CSV de relatório de produção.',
      dadosNovos: { formato: 'csv', quantidade_ops: opsFiltradas.length },
    });
    toast({ title: 'Exportação concluída', description: `${opsFiltradas.length} OPs exportadas.` });
  };

  const handleImprimirRelatorio = async () => {
    if (!contextoValido || !canViewReports) {
      await auditRelatorioProducao({
        acao: 'RelatoriosProducao.imprimir_bloqueado',
        descricao: 'Tentativa de imprimir relatório de produção sem contexto ou permissão.',
        sucesso: false,
        dadosNovos: { motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada' },
      });
      toast({ title: 'Acesso negado', description: 'Selecione contexto válido e confirme permissão de visualização.', variant: 'destructive' });
      return;
    }
    await auditRelatorioProducao({
      acao: 'Impressão',
      descricao: 'Impressão de relatório de produção acionada.',
      dadosNovos: { quantidade_ops: opsFiltradas.length },
    });
    window.print();
  };

  if (!contextoValido || !canViewReports) {
    return (
      <Alert className="border-red-200 bg-red-50" data-permission="Producao.Relatorios.visualizar" data-context-required="group-or-company">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <AlertDescription>{!contextoValido ? (contexto === 'grupo' ? "Selecione um grupo para visualizar relatórios de produção." : "Selecione uma empresa vinculada a um grupo para visualizar relatórios de produção.") : "Seu perfil não possui permissão para visualizar relatórios de produção."}</AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="space-y-6 w-full h-full" data-permission="Producao.Relatorios.visualizar" data-context-required="group-or-company">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
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
            </div>
            <div className="flex gap-2 no-print">
              <Button type="button" variant="outline" onClick={handleImprimirRelatorio} data-permission="Producao.Relatorios.visualizar" data-action="RelatoriosProducao.imprimir" data-context-required="group-or-company">
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Button type="button" onClick={handleExportarCSV} disabled={!canExportReports} data-permission="Producao.Relatorios.exportar" data-action="RelatoriosProducao.exportar_csv" data-context-required="group-or-company" data-sensitive>
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Factory className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <p className="text-xs text-slate-600">Total OPs</p>
            <p className="text-2xl font-bold">{totalOPs}</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-600" />
            <p className="text-xs text-green-700">Finalizadas</p>
            <p className="text-2xl font-bold text-green-900">{opsFinalizadas}</p>
            <p className="text-xs text-green-600">{taxaConclusao}%</p>
          </CardContent>
        </Card>

        <Card className="bg-red-50">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-600" />
            <p className="text-xs text-red-700">Perda Total</p>
            <p className="text-2xl font-bold text-red-900">{perdaTotal.toFixed(0)} kg</p>
            <p className="text-xs text-red-600">{taxaPerda}%</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-6 h-6 mx-auto mb-2 text-purple-600" />
            <p className="text-xs text-purple-700">Custo Real</p>
            <p className="text-xl font-bold text-purple-900">
              R$ {custoReal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-purple-600">
              {variacaoCusto > 0 ? '+' : ''}{variacaoCusto}% vs previsto
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <p className="text-xs text-blue-700">Eficiência</p>
            <p className="text-2xl font-bold text-blue-900">{eficienciaMedia}%</p>
            <p className="text-xs text-blue-600">
              {tempoReal.toFixed(0)}h reais
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="geral" data-permission="Producao.Relatorios.visualizar" data-context-required="group-or-company">
        <TabsList className="bg-white border flex-wrap h-auto">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="tipo">Por Tipo</TabsTrigger>
          <TabsTrigger value="operadores">Por Operador</TabsTrigger>
          <TabsTrigger value="custos">Custos</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base">Distribuição por Status</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dadosStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ status, quantidade }) => `${status}: ${quantidade}`}
                    outerRadius={100}
                    dataKey="quantidade"
                  >
                    {dadosStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tipo">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base">Produção por Tipo</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosTipo}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tipo" />
                  <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="quantidade" fill="#3b82f6" name="Quantidade" />
                  <Bar yAxisId="right" dataKey="peso" fill="#10b981" name="Peso (kg)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operadores">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base">Desempenho por Operador</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Operador</TableHead>
                    <TableHead className="text-right">Peso Produzido</TableHead>
                    <TableHead className="text-right">Tempo (h)</TableHead>
                    <TableHead className="text-right">Refugo</TableHead>
                    <TableHead className="text-right">Produtividade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dadosOperadores.map((op, idx) => {
                    const produtividade = op.tempo > 0 ? (op.peso / (op.tempo / 60)).toFixed(2) : 0;
                    const taxaRefugo = op.peso > 0 ? ((op.refugo / op.peso) * 100).toFixed(1) : 0;

                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{op.operador}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {op.peso.toFixed(1)} kg
                        </TableCell>
                        <TableCell className="text-right">
                          {(op.tempo / 60).toFixed(1)}h
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={parseFloat(taxaRefugo) > 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                            {op.refugo.toFixed(1)} kg ({taxaRefugo}%)
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-600">
                          {produtividade} kg/h
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {dadosOperadores.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Factory className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Nenhum apontamento registrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custos">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-base">Custo Previsto vs Real</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { tipo: 'Previsto', valor: custoPrevisto },
                    { tipo: 'Real', valor: custoReal }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tipo" />
                    <YAxis />
                    <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                    <Bar dataKey="valor" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-purple-50">
                <CardTitle className="text-base">Análise de Variação</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">Custo Previsto:</span>
                    <span className="font-bold text-lg">
                      R$ {custoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">Custo Real:</span>
                    <span className="font-bold text-lg">
                      R$ {custoReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-px bg-slate-300"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-900 font-semibold">Variação:</span>
                    <span className={`font-bold text-xl ${parseFloat(variacaoCusto) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {parseFloat(variacaoCusto) > 0 ? '+' : ''}{variacaoCusto}%
                    </span>
                  </div>

                  {parseFloat(variacaoCusto) > 10 && (
                    <Alert className="border-red-200 bg-red-50 mt-4">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <AlertDescription>
                        <strong>Atenção:</strong> Custo real {parseFloat(variacaoCusto)}% acima do previsto.
                        Revisar perdas e tempos de produção.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
