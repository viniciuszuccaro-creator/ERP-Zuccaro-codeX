import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart3, FileText, Truck, MapPin, TrendingUp } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
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
  const canViewReports = hasPermission("Expedição", "Relatórios", "ver") || hasPermission("Expedição", "Relatórios", "visualizar");
  const activeEmpresaId = empresaId || empresaAtual?.id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(activeEmpresaId || groupId);
  const contextKey = groupId ? `grupo:${groupId}` : `empresa:${activeEmpresaId || "sem-empresa"}`;

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
  romaneios.forEach(r => {
    if (!porMotorista[r.motorista]) {
      porMotorista[r.motorista] = { motorista: r.motorista, entregas: 0, realizadas: 0, frustradas: 0, km: 0 };
    }
    porMotorista[r.motorista].entregas += r.quantidade_entregas || 0;
    porMotorista[r.motorista].realizadas += r.entregas_realizadas || 0;
    porMotorista[r.motorista].frustradas += r.entregas_frustradas || 0;
    porMotorista[r.motorista].km += r.km_rodado || 0;
  });
  const dadosMotoristas = Object.values(porMotorista);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-6";

  return (
    <div className={containerClass}>
      <div className={windowMode ? "p-6 space-y-6 flex-1" : "space-y-6"}>
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
                <BarChart data={[
                  { cidade: 'São Paulo', quantidade: 15 },
                  { cidade: 'Campinas', quantidade: 8 },
                  { cidade: 'Santos', quantidade: 5 },
                  { cidade: 'Sorocaba', quantidade: 3 }
                ]}>
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
