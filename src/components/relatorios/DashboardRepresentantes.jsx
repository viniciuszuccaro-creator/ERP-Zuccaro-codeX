import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  DollarSign,
  TrendingUp,
  Award,
  Target,
  Calendar,
  Download
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

import useSecureReport from "./useSecureReport";
import { toast } from "sonner";

const tiposRepresentante = [
  { value: 'todos', label: 'Todos os Tipos' },
  { value: 'Representante Comercial', label: 'Representante Comercial' },
  { value: 'Construtor', label: 'Construtor' },
  { value: 'Arquiteto', label: 'Arquiteto' },
  { value: 'Engenheiro', label: 'Engenheiro' },
  { value: 'Influenciador', label: 'Influenciador' },
  { value: 'Parceiro', label: 'Parceiro' },
  { value: 'Outro', label: 'Outro' },
];

export default function DashboardRepresentantes() {
  const [periodoFiltro, setPeriodoFiltro] = React.useState("mes");
  const [tipoFiltro, setTipoFiltro] = React.useState("todos");
  const secure = useSecureReport({ kind:'representantes',entityName:'Representante',
    report:{ periodo:periodoFiltro === 'tudo' ? 'todos' : periodoFiltro,tipo:tipoFiltro } });
  const representantes = secure.data?.data || [];
  const canSeeCommission = secure.data?.capabilities?.comissao === true;
  const totalVendas = representantes.reduce((sum,rep) => sum + Number(rep.vendas),0);
  const clientesIndicados = representantes.reduce((sum,rep) => sum + Number(rep.clientes),0);
  const metricas = { totalRepresentantes:representantes.length,clientesIndicados,totalVendas,
    totalComissoes:representantes.reduce((sum,rep) => sum + Number(rep.comissao || 0),0),
    ticketMedio:clientesIndicados ? totalVendas/clientesIndicados : 0 };
  const dadosRankingRepresentantes = [...representantes].sort((a,b) => Number(b.vendas)-Number(a.vendas)).slice(0,10);
  const exportarRepresentantes = async () => {
    try { await secure.exportCsv(); }
    catch { toast.error('Exportação não concluída. Verifique a autorização e tente novamente.'); }
  };
  const dadosPorTipo = [
    { name: 'Representante', value: representantes.filter(r => r.tipo === 'Representante Comercial').length, color: '#8b5cf6' },
    { name: 'Construtor', value: representantes.filter(r => r.tipo === 'Construtor').length, color: '#3b82f6' },
    { name: 'Arquiteto', value: representantes.filter(r => r.tipo === 'Arquiteto').length, color: '#10b981' },
    { name: 'Engenheiro', value: representantes.filter(r => r.tipo === 'Engenheiro').length, color: '#f59e0b' },
    { name: 'Outros', value: representantes.filter(r => !['Representante Comercial', 'Construtor', 'Arquiteto', 'Engenheiro'].includes(String(r.tipo))).length, color: '#6b7280' }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 w-full h-full" data-permission="Comercial.Representantes.visualizar" data-context-required="group-or-company">
      {secure.status && <Alert className="border-amber-300 bg-amber-50"><AlertDescription>{secure.status}</AlertDescription></Alert>}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-purple-600" />
            Dashboard de Representantes
          </h2>
          <p className="text-sm text-slate-600">Análise de performance e comissões</p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[99999]">
              {tiposRepresentante.map(tipo => (
                <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[99999]">
              <SelectItem value="mes">Este Mês</SelectItem>
              <SelectItem value="trimestre">Trimestre</SelectItem>
              <SelectItem value="ano">Este Ano</SelectItem>
              <SelectItem value="tudo">Todo Período</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={exportarRepresentantes} disabled={!secure.canExport || !secure.data} data-action="DashboardRepresentantes.exportarCSV" data-permission="Comercial.Representantes.exportar" data-context-required="group-or-company" data-sensitive="true">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {secure.data && <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              Representantes no filtro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-600">{metricas.totalRepresentantes}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              Clientes Indicados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{metricas.clientesIndicados}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Total em Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              R$ {metricas.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-orange-600" />
              Comissões estimadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              {canSeeCommission ? `R$ ${metricas.totalComissoes.toLocaleString('pt-BR', { minimumFractionDigits:2 })}` : 'Sem permissão'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-pink-600" />
              Ticket Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-pink-600">
              R$ {metricas.ticketMedio.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking por Vendas Geradas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosRankingRepresentantes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <Legend />
                <Bar dataKey="vendas" name="Vendas Geradas" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={dadosPorTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {dadosPorTipo.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 Representantes - Performance Detalhada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 font-semibold">#</th>
                  <th className="text-left p-3 font-semibold">Representante</th>
                  <th className="text-left p-3 font-semibold">Tipo</th>
                  <th className="text-right p-3 font-semibold">Clientes</th>
                  <th className="text-right p-3 font-semibold">Pedidos</th>
                  <th className="text-right p-3 font-semibold">Total Vendas</th>
                  <th className="text-right p-3 font-semibold">Comissão Gerada</th>
                </tr>
              </thead>
              <tbody>
                {dadosRankingRepresentantes.map((rep, idx) => (
                  <tr key={idx} className="border-b hover:bg-slate-50">
                    <td className="p-3">
                      {idx === 0 && <span className="text-2xl">🥇</span>}
                      {idx === 1 && <span className="text-2xl">🥈</span>}
                      {idx === 2 && <span className="text-2xl">🥉</span>}
                      {idx > 2 && <span className="text-slate-500">{idx + 1}º</span>}
                    </td>
                    <td className="p-3 font-medium">{rep.nome}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">{rep.tipo}</Badge>
                    </td>
                    <td className="p-3 text-right font-semibold text-blue-600">{rep.clientes}</td>
                    <td className="p-3 text-right font-semibold text-slate-700">{rep.pedidos}</td>
                    <td className="p-3 text-right font-bold text-green-600">
                      R$ {rep.vendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-bold text-purple-600">
                      {canSeeCommission ? `R$ ${Number(rep.comissao).toLocaleString('pt-BR', { minimumFractionDigits:2 })}` : 'Sem permissão'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </>}
    </div>
  );
}