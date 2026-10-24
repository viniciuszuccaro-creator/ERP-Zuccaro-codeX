import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Clock,
  UserCheck,
  UserX,
  Award,
  Activity
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

/**
 * ETAPA 7: DASHBOARD RH TEMPO REAL V21.4
 * Consolidação e melhoria do módulo de RH
 */

function DashboardRHRealtime({ empresaId, windowMode = false }) {
  const { filterInContext } = useContextoVisual();
  /** @type {[{colaboradoresAtivos: number, presentesHoje: number, ausentesHoje: number, taxaPresenca: number | string, horasExtrasHoje: number, riscoTurnoverAlto: number, produtividadeMedia: number | string}, React.Dispatch<React.SetStateAction<{colaboradoresAtivos: number, presentesHoje: number, ausentesHoje: number, taxaPresenca: number | string, horasExtrasHoje: number, riscoTurnoverAlto: number, produtividadeMedia: number | string}>>]} */
  const [metricas, setMetricas] = useState({
    colaboradoresAtivos: 0,
    presentesHoje: 0,
    ausentesHoje: 0,
    taxaPresenca: 0,
    horasExtrasHoje: 0,
    riscoTurnoverAlto: 0,
    produtividadeMedia: 0
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => filterInContext('Colaborador', {})
  });

  const { data: pontos = [] } = useQuery({
    queryKey: ['pontos'],
    queryFn: () => filterInContext('Ponto', {})
  });

  const { data: monitoramento = [] } = useQuery({
    queryKey: ['monitoramento-rh'],
    queryFn: () => filterInContext('MonitoramentoRH', {})
  });

  useEffect(() => {
    if (colaboradores.length > 0) {
      const ativos = colaboradores.filter(c => c.status === 'Ativo').length;
      
      const hoje = new Date().toISOString().split('T')[0];
      const pontosHoje = pontos.filter(p => p.data_hora?.startsWith(hoje));
      const colaboradoresComPontoHoje = new Set(pontosHoje.map(p => p.colaborador_id));
      const presentes = colaboradoresComPontoHoje.size;
      const ausentes = ativos - presentes;
      const taxaPresenca = ativos > 0 ? (presentes / ativos) * 100 : 0;

      const horasExtras = pontosHoje
        .filter(p => p.tipo === 'hora_extra')
        .reduce((sum, p) => sum + (p.horas || 0), 0);

      const riscoAlto = monitoramento.filter(m => 
        m.analise_comportamental_ia?.risco_turnover === 'Alto' || 
        m.analise_comportamental_ia?.risco_turnover === 'Crítico'
      ).length;

      const produtividades = monitoramento
        .map(m => m.metricas_produtividade?.produtividade_vs_meta || 0)
        .filter(p => p > 0);
      const prodMedia = produtividades.length > 0
        ? produtividades.reduce((a, b) => a + b, 0) / produtividades.length
        : 0;

      setMetricas({
        colaboradoresAtivos: ativos,
        presentesHoje: presentes,
        ausentesHoje: ausentes,
        taxaPresenca: taxaPresenca.toFixed(1),
        horasExtrasHoje: horasExtras,
        riscoTurnoverAlto: riscoAlto,
        produtividadeMedia: prodMedia.toFixed(1)
      });
    }
  }, [colaboradores, pontos, monitoramento]);

  const dadosPorDepartamento = [
    { dept: 'Produção', qtd: colaboradores.filter(c => c.departamento === 'Operacional').length },
    { dept: 'Comercial', qtd: colaboradores.filter(c => c.departamento === 'Comercial').length },
    { dept: 'Financeiro', qtd: colaboradores.filter(c => c.departamento === 'Financeiro').length },
    { dept: 'Logística', qtd: colaboradores.filter(c => c.departamento === 'Logística').length },
    { dept: 'Administrativo', qtd: colaboradores.filter(c => c.departamento === 'Administrativo').length }
  ].filter(d => d.qtd > 0);

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "w-full h-full space-y-6";

  return (
    <div className={containerClass}>
      <div className={windowMode ? "p-6 space-y-6 flex-1 overflow-auto" : "space-y-6"}>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Colaboradores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold">{metricas.colaboradoresAtivos}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Presentes Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold text-green-600">{metricas.presentesHoje}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Ausentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-600" />
              <span className="text-2xl font-bold text-red-600">{metricas.ausentesHoje}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Taxa Presença</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className={`w-5 h-5 ${Number(metricas.taxaPresenca) >= 95 ? 'text-green-600' : 'text-yellow-600'}`} />
              <span className="text-2xl font-bold">{metricas.taxaPresenca}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Horas Extras</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <span className="text-2xl font-bold">{metricas.horasExtrasHoje}</span>
              <span className="text-sm text-slate-600">h</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Risco Turnover</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-2xl font-bold text-red-600">{metricas.riscoTurnoverAlto}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Produtividade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Award className={`w-5 h-5 ${Number(metricas.produtividadeMedia) >= 100 ? 'text-green-600' : 'text-yellow-600'}`} />
              <span className="text-2xl font-bold">{metricas.produtividadeMedia}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Colaboradores por Departamento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dadosPorDepartamento}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dept" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="qtd" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status dos Colaboradores</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Ativos', value: colaboradores.filter(c => c.status === 'Ativo').length },
                    { name: 'Férias', value: colaboradores.filter(c => c.status === 'Férias').length },
                    { name: 'Afastado', value: colaboradores.filter(c => c.status === 'Afastado').length }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alertas IA */}
      <Card className="border-red-200">
        <CardHeader className="bg-red-50">
          <CardTitle className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-5 h-5" />
            Alertas de RH (IA)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {metricas.riscoTurnoverAlto > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <Badge variant="destructive">Crítico</Badge>
                <span className="ml-2 font-medium">{metricas.riscoTurnoverAlto} colaboradores com alto risco de saída</span>
                <p className="text-sm text-red-600 mt-1">Ação: Agendar 1-on-1 e revisar plano de retenção</p>
              </div>
            )}

            {Number(metricas.taxaPresenca) < 95 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <Badge className="bg-yellow-600">Atenção</Badge>
                <span className="ml-2 font-medium">Taxa de presença abaixo do esperado</span>
              </div>
            )}

            {metricas.riscoTurnoverAlto === 0 && Number(metricas.taxaPresenca) >= 95 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded text-center">
                <Award className="w-5 h-5 inline text-green-600 mr-2" />
                <span className="font-medium text-green-800">Time engajado e produtivo!</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
export default React.memo(DashboardRHRealtime);
