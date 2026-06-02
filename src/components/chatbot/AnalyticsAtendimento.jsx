import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  TrendingUp,
  Clock,
  MessageCircle,
  Users,
  ThumbsUp,
  Bot,
  Phone
} from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.5 - ANALYTICS DE ATENDIMENTO OMNICANAL
 * 
 * Dashboard de métricas e KPIs do Hub de Atendimento
 */
export default function AnalyticsAtendimento() {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const empresaId = empresaAtual?.id;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewAnalytics = hasPermission('CRM', 'Atendimento', 'visualizar') ||
    hasPermission('CRM', 'Relatorios', 'visualizar') ||
    hasPermission('Dashboard', 'Atendimento', 'visualizar') ||
    hasPermission('Sistema', 'Integracoes', 'visualizar');

  // Buscar todas as conversas
  const { data: conversas = [] } = useQuery({
    queryKey: ['analytics-conversas', contextKey],
    queryFn: async () => {
      return await filterInContext('ConversaOmnicanal', {}, '-data_inicio', 1000);
    },
    enabled: contextoValido && canViewAnalytics
  });

  // Buscar todas as mensagens
  const { data: mensagens = [] } = useQuery({
    queryKey: ['analytics-mensagens', contextKey],
    queryFn: async () => {
      return await filterInContext('MensagemOmnicanal', {}, '-created_date', 2000);
    },
    enabled: contextoValido && canViewAnalytics
  });

  // Calcular métricas
  const calcularMetricas = () => {
    const totalConversas = conversas.length;
    const resolvidasBot = conversas.filter(c => c.tipo_atendimento === 'Bot' && c.resolvido).length;
    const resolvidasHumano = conversas.filter(c => c.tipo_atendimento === 'Humano' && c.resolvido).length;
    
    const taxaResolucaoBot = totalConversas > 0 ? ((resolvidasBot / totalConversas) * 100).toFixed(1) : 0;
    
    const conversasComTempo = conversas.filter(c => c.tempo_resolucao_minutos);
    const tempoMedioResolucao = conversasComTempo.length > 0
      ? (conversasComTempo.reduce((acc, c) => acc + (c.tempo_resolucao_minutos || 0), 0) / conversasComTempo.length).toFixed(1)
      : 0;

    const conversasAvaliadas = conversas.filter(c => c.score_satisfacao);
    const satisfacaoMedia = conversasAvaliadas.length > 0
      ? (conversasAvaliadas.reduce((acc, c) => acc + (c.score_satisfacao || 0), 0) / conversasAvaliadas.length).toFixed(1)
      : 0;

    return {
      totalConversas,
      resolvidasBot,
      resolvidasHumano,
      taxaResolucaoBot,
      tempoMedioResolucao,
      satisfacaoMedia
    };
  };

  const metricas = calcularMetricas();

  // Dados para gráficos
  const canais = [
    { nome: 'WhatsApp' },
    { nome: 'Instagram' },
    { nome: 'Facebook' },
    { nome: 'Telegram' },
    { nome: 'Email' },
    { nome: 'WebChat' },
    { nome: 'Portal' }
  ];
  
  const conversasPorCanal = canais.map(canal => ({
    canal: canal.nome,
    total: conversas.filter(c => c.canal === canal.nome).length
  })).filter(d => d.total > 0);

  const conversasPorStatus = [
    { status: 'Em Progresso', total: conversas.filter(c => c.status === 'Em Progresso').length },
    { status: 'Aguardando', total: conversas.filter(c => c.status === 'Aguardando').length },
    { status: 'Não Atribuída', total: conversas.filter(c => c.status === 'Não Atribuída').length },
    { status: 'Resolvida', total: conversas.filter(c => c.status === 'Resolvida').length }
  ];

  const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981'];

  return (
    <div className="w-full h-full overflow-auto p-6" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analytics de Atendimento</h1>
          <p className="text-slate-600 mt-1">Métricas e KPIs do Hub Omnicanal</p>
        </div>

        {(!contextoValido || !canViewAnalytics) && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription className="text-amber-800">
              Selecione grupo/empresa e confirme permissao de atendimento para visualizar analytics.
            </AlertDescription>
          </Alert>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
                <MessageCircle className="w-4 h-4" />
                Total
              </div>
              <p className="text-2xl font-bold">{metricas.totalConversas}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-600 text-sm mb-1">
                <Bot className="w-4 h-4" />
                Bot Resolveu
              </div>
              <p className="text-2xl font-bold text-purple-600">{metricas.resolvidasBot}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
                <Phone className="w-4 h-4" />
                Humano Resolveu
              </div>
              <p className="text-2xl font-bold text-blue-600">{metricas.resolvidasHumano}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                Taxa Bot
              </div>
              <p className="text-2xl font-bold text-green-600">{metricas.taxaResolucaoBot}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-orange-600 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Tempo Médio
              </div>
              <p className="text-2xl font-bold text-orange-600">{metricas.tempoMedioResolucao}min</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-indigo-600 text-sm mb-1">
                <ThumbsUp className="w-4 h-4" />
                Satisfação
              </div>
              <p className="text-2xl font-bold text-indigo-600">{metricas.satisfacaoMedia}/5</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Conversas por Canal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Conversas por Canal</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={conversasPorCanal}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="canal" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Conversas por Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribuição por Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={conversasPorStatus}
                    dataKey="total"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {conversasPorStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
