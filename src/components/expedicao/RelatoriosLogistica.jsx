import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart3, FileText, Truck, MapPin, Download } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
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

/**
 * Relatórios de Logística e Expedição
 */
export default function RelatoriosLogistica({ empresaId, windowMode = false }) {
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const canViewReports = hasPermission("Expedicao", "Relatorios", "ver") || hasPermission("Expedicao", "Relatorios", "visualizar") || hasPermission("Expedicao", "Relatorio", "visualizar");
  const canExportReports = hasPermission("Expedicao", "Relatorios", "exportar") || hasPermission("Expedicao", "Entrega", "exportar");
  const activeEmpresaId = empresaId || empresaAtual?.id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(activeEmpresaId || groupId);
  const contextKey = groupId ? `grupo:${groupId}` : `empresa:${activeEmpresaId || "sem-empresa"}`;

  const auditRelatorio = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: "Expedicao",
        entidade: "RelatorioLogistica",
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        usuario_id: user?.id || user?.email || null,
        usuario_nome: user?.full_name || user?.email || "Sistema",
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: activeEmpresaId,
        resultado: sucesso ? "sucesso" : "bloqueado",
        motivo,
        detalhes,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar relatorio de logistica", error);
    }
  };
  const { data: entregas = [] } = useQuery({
    queryKey: ['entregas-relatorio', contextKey],
    queryFn: () => filterInContext('Entrega', {}, '-created_date', 9999),
    enabled: canViewReports && contextoValido,
  });

  const { data: romaneios = [] } = useQuery({
    queryKey: ['romaneios-relatorio', contextKey],
    queryFn: () => filterInContext('Romaneio', {}, '-created_date', 9999),
    enabled: canViewReports && contextoValido,
  });

  const romaneiosFiltrados = romaneios.filter(r => {
    if (activeEmpresaId && r.empresa_id !== activeEmpresaId && r.empresa_responsavel_id !== activeEmpresaId) return false;
    if (groupId && r.group_id && r.group_id !== groupId) return false;
    return true;
  });

  const entregasFiltradas = entregas.filter(e => {
    if (activeEmpresaId && e.empresa_id !== activeEmpresaId && e.empresa_responsavel_id !== activeEmpresaId) return false;
    if (periodoInicio && e.data_saida < periodoInicio) return false;
    if (periodoFim && e.data_saida > periodoFim) return false;
    return true;
  });

  // Métricas
  const totalEntregas = entregasFiltradas.length;
  const entregasRealizadas = entregasFiltradas.filter(e => e.status === "Entregue").length;
  const entregasFrustradas = entregasFiltradas.filter(e => e.status === "Entrega Frustrada").length;
  const taxaSucesso = totalEntregas > 0 ? ((entregasRealizadas / totalEntregas) * 100).toFixed(1) : 0;

  // Tempo médio
  const entregasComTempo = entregasFiltradas.filter(e => e.data_entrega && e.data_saida);
  const tempoMedio = entregasComTempo.length > 0
    ? entregasComTempo.reduce((sum, e) => {
        const horas = (new Date(e.data_entrega) - new Date(e.data_saida)) / (1000 * 60 * 60);
        return sum + horas;
      }, 0) / entregasComTempo.length
    : 0;

  // Por motorista
  const porMotorista = {};
  romaneiosFiltrados.forEach(r => {
    if (!porMotorista[r.motorista]) {
      porMotorista[r.motorista] = { motorista: r.motorista, entregas: 0, realizadas: 0, frustradas: 0, km: 0 };
    }
    porMotorista[r.motorista].entregas += r.quantidade_entregas || 0;
    porMotorista[r.motorista].realizadas += r.entregas_realizadas || 0;
    porMotorista[r.motorista].frustradas += r.entregas_frustradas || 0;
    porMotorista[r.motorista].km += r.km_rodado || 0;
  });
  const dadosMotoristas = Object.values(porMotorista);

  const porCidade = {};
  entregasFiltradas.forEach(e => {
    const cidade = e.endereco_entrega_completo?.cidade || "Sem cidade";
    const estado = e.endereco_entrega_completo?.estado || "";
    const chave = `${cidade}/${estado}`;
    if (!porCidade[chave]) porCidade[chave] = { cidade: chave, quantidade: 0 };
    porCidade[chave].quantidade += 1;
  });
  const dadosCidades = Object.values(porCidade).sort((a, b) => b.quantidade - a.quantidade).slice(0, 15);

  const exportarResumoCSV = async () => {
    if (!contextoValido || !canExportReports) {
      await auditRelatorio({ acao: "Logistica.relatorio.exportar_csv.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
      return;
    }
    const headers = ["indicador", "valor"];
    const rows = [
      ["total_entregas", totalEntregas],
      ["entregas_realizadas", entregasRealizadas],
      ["entregas_frustradas", entregasFrustradas],
      ["taxa_sucesso", taxaSucesso],
      ["tempo_medio_horas", tempoMedio.toFixed(1)],
    ];
    const escapeCsv = (value) => "\"" + String(value ?? "").replace(/\"/g, "\"\"") + "\"";
    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio-logistica-resumo.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    await auditRelatorio({ acao: "Logistica.relatorio.exportar_csv", detalhes: { totalEntregas, periodoInicio, periodoFim } });
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-6";

  return (
    <div className={containerClass} data-permission="Expedicao.Relatorios.visualizar" data-context-required="true">
      <div className={windowMode ? "p-6 space-y-6 flex-1" : "space-y-6"}>
      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-end">
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
            <Button
              type="button"
              variant="outline"
              onClick={exportarResumoCSV}
              disabled={!contextoValido || !canExportReports}
              data-permission="Expedicao.Relatorios.exportar"
              data-action="Logistica.relatorio.exportar_csv"
              data-context-required="true"
              data-sensitive="true"
            >
              <Download className="w-4 h-4 mr-2" /> CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">
            <BarChart3 className="w-4 h-4 mr-2" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="motoristas">
            <Truck className="w-4 h-4 mr-2" />
            Por Motorista
          </TabsTrigger>
          <TabsTrigger value="cidades">
            <MapPin className="w-4 h-4 mr-2" />
            Por Cidade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-slate-600">Total Entregas</p>
                <p className="text-3xl font-bold">{totalEntregas}</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-green-700">Realizadas</p>
                <p className="text-3xl font-bold text-green-900">{entregasRealizadas}</p>
                <p className="text-xs text-green-600">{taxaSucesso}%</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-red-700">Frustradas</p>
                <p className="text-3xl font-bold text-red-900">{entregasFrustradas}</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-blue-700">Tempo Médio</p>
                <p className="text-3xl font-bold text-blue-900">{tempoMedio.toFixed(1)}</p>
                <p className="text-xs text-blue-600">horas</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="motoristas">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base">Desempenho por Motorista</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Motorista</TableHead>
                    <TableHead className="text-center">Entregas</TableHead>
                    <TableHead className="text-center">Realizadas</TableHead>
                    <TableHead className="text-center">Frustradas</TableHead>
                    <TableHead className="text-center">Taxa Sucesso</TableHead>
                    <TableHead className="text-right">KM Rodado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dadosMotoristas.map((m, idx) => {
                    const taxa = m.entregas > 0 ? ((m.realizadas / m.entregas) * 100).toFixed(1) : 0;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{m.motorista}</TableCell>
                        <TableCell className="text-center">{m.entregas}</TableCell>
                        <TableCell className="text-center text-green-700">{m.realizadas}</TableCell>
                        <TableCell className="text-center text-red-700">{m.frustradas}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={parseFloat(taxa) >= 90 ? 'bg-green-600' : 'bg-yellow-600'}>
                            {taxa}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{m.km.toFixed(0)} km</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {dadosMotoristas.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Truck className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cidades">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base">Entregas por Cidade</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={dadosCidades}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="cidade" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="quantidade" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
