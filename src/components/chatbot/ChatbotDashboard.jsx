import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  TrendingUp, 
  Clock, 
  Bot, 
  User, 
  CheckCircle,
  AlertCircle,
  BarChart3,
  Activity,
  Timer
} from 'lucide-react';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

/**
 * V21.6 - DASHBOARD ANALYTICS CHATBOT OMNICANAL
 * 
 * Dashboard completo com métricas avançadas:
 * ✅ KPIs em tempo real
 * ✅ Gráficos de performance
 * ✅ Análise de sentimento
 * ✅ Taxa de resolução bot vs humano
 * ✅ Tempo médio de resposta
 * ✅ Canais mais utilizados
 * ✅ Intents mais comuns
 * ✅ Satisfação do cliente (CSAT)
 */
export default function ChatbotDashboard() {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewDashboard = hasPermission('CRM', 'Atendimento', 'visualizar') ||
    hasPermission('Sistema', 'Integracoes', 'visualizar') ||
    hasPermission('Dashboard', 'Atendimento', 'visualizar');

  // Buscar todas as conversas
  const { data: conversas = [] } = useQuery({
    queryKey: ['conversas-analytics', contextKey],
    queryFn: async () => {
      return await filterInContext('ConversaOmnicanal', {}, '-data_inicio', 1000);
    },
    enabled: contextoValido && canViewDashboard
  });

  // Buscar todas as mensagens
  const { data: mensagens = [] } = useQuery({
    queryKey: ['mensagens-analytics', contextKey],
    queryFn: async () => {
      return await filterInContext('MensagemOmnicanal', {}, '-created_date', 2000);
    },
    enabled: contextoValido && canViewDashboard
  });

  // Buscar interações
  const { data: interacoes = [] } = useQuery({
    queryKey: ['interacoes-analytics', contextKey],
    queryFn: async () => {
      return await filterInContext('ChatbotInteracao', {}, '-created_date', 1000);
    },
    enabled: contextoValido && canViewDashboard
  });

  // Calcular métricas
  const metricas = React.useMemo(() => {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    const conversasMes = conversas.filter(c => new Date(c.data_inicio) >= inicioMes);
    const totalConversas = conversasMes.length;
    const resolvidasBot = conversasMes.filter(c => c.tipo_atendimento === 'Bot' && c.resolvido).length;
    const transferidas = conversasMes.filter(c => c.tipo_atendimento === 'Humano').length;
    const emAndamento = conversas.filter(c => c.status === 'Em Progresso').length;
    const aguardando = conversas.filter(c => c.status === 'Aguardando').length;
    
    const temposResposta = conversasMes
      .filter(c => c.tempo_primeira_resposta_minutos)
      .map(c => c.tempo_primeira_resposta_minutos);
    const tempoMedio = temposResposta.length > 0
      ? (temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length).toFixed(1)
      : 0;
    
    const avaliacoes = conversasMes.filter(c => c.score_satisfacao);
    const csat = avaliacoes.length > 0
      ? (avaliacoes.reduce((a, c) => a + c.score_satisfacao, 0) / avaliacoes.length).toFixed(1)
      : 0;
    
    const taxaResolucaoBot = totalConversas > 0
      ? ((resolvidasBot / totalConversas) * 100).toFixed(0)
      : 0;
    
    const taxaTransbordo = totalConversas > 0
      ? ((transferidas / totalConversas) * 100).toFixed(0)
      : 0;

    // Conversas por canal
    const porCanal = conversasMes.reduce((acc, c) => {
      acc[c.canal] = (acc[c.canal] || 0) + 1;
      return acc;
    }, {});

    // Intents mais comuns
    const porIntent = interacoes.reduce((acc, i) => {
      if (i.intent_detectado) {
        acc[i.intent_detectado] = (acc[i.intent_detectado] || 0) + 1;
      }
      return acc;
    }, {});

    // Sentimentos
    const porSentimento = conversasMes.reduce((acc, c) => {
      acc[c.sentimento_geral || 'Neutro'] = (acc[c.sentimento_geral || 'Neutro'] || 0) + 1;
      return acc;
    }, {});

    return {
      totalConversas,
      resolvidasBot,
      transferidas,
      emAndamento,
      aguardando,
      tempoMedio,
      csat,
      taxaResolucaoBot,
      taxaTransbordo,
      porCanal,
      porIntent,
      porSentimento
    };
  }, [conversas, interacoes]);

  // Dados para gráficos
  const dadosCanais = Object.entries(metricas.porCanal).map(([canal, total]) => ({
    canal,
    total
  }));

  const dadosIntents = Object.entries(metricas.porIntent)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([intent, total]) => ({
      intent: intent.replace('_', ' '),
      total
    }));

  const dadosSentimentos = Object.entries(metricas.porSentimento).map(([sentimento, total]) => ({
    name: sentimento,
    value: total
  }));

  const CORES_SENTIMENTO = {
    'Positivo': '#10b981',
    'Neutro': '#6b7280',
    'Negativo': '#ef4444',
    'Frustrado': '#dc2626',
    'Urgente': '#f59e0b'
  };

  return (
    <div className="w-full h-full space-y-6 overflow-auto" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
      {(!contextoValido || !canViewDashboard) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Selecione um grupo/empresa e confirme permissao de atendimento para visualizar o dashboard.
        </div>
      )}

      {/* KPIs Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
              <MessageCircle className="w-4 h-4" />
              Total (mês)
            </div>
            <p className="text-3xl font-bold text-slate-900">{metricas.totalConversas}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
              <Activity className="w-4 h-4" />
              Em Andamento
            </div>
            <p className="text-3xl font-bold text-blue-600">{metricas.emAndamento}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-600 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Aguardando
            </div>
            <p className="text-3xl font-bold text-orange-600">{metricas.aguardando}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
              <Bot className="w-4 h-4" />
              Taxa Bot
            </div>
            <p className="text-3xl font-bold text-green-600">{metricas.taxaResolucaoBot}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-600 text-sm mb-1">
              <Timer className="w-4 h-4" />
              Tempo Médio
            </div>
            <p className="text-3xl font-bold text-purple-600">{metricas.tempoMedio}min</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-600 text-sm mb-1">
              <CheckCircle className="w-4 h-4" />
              CSAT
            </div>
            <p className="text-3xl font-bold text-yellow-600">{metricas.csat}/5</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Conversas por Canal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Conversas por Canal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dadosCanais}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="canal" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Intents Mais Comuns */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Intents Mais Comuns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dadosIntents} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="intent" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="total" fill="#9333ea" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição de Sentimentos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              Análise de Sentimento
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={dadosSentimentos}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dadosSentimentos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CORES_SENTIMENTO[entry.name] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance Bot vs Humano */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-600" />
              Bot vs Humano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-green-600" />
                    Resolvidas pelo Bot
                  </span>
                  <span className="text-sm font-bold text-green-600">{metricas.taxaResolucaoBot}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all"
                    style={{ width: `${metricas.taxaResolucaoBot}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600 flex items-center gap-2">
                    <User className="w-4 h-4 text-orange-600" />
                    Transbordo Humano
                  </span>
                  <span className="text-sm font-bold text-orange-600">{metricas.taxaTransbordo}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-orange-600 h-3 rounded-full transition-all"
                    style={{ width: `${metricas.taxaTransbordo}%` }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t mt-4">
                <p className="text-xs text-slate-500 mb-2">Eficiência Geral</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {((metricas.resolvidasBot / metricas.totalConversas) * 100 || 0).toFixed(0)}%
                  </span>
                  <span className="text-sm text-slate-600">de economia operacional</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Últimas Conversas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimas Conversas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 text-xs font-semibold text-slate-600">Cliente</th>
                  <th className="pb-3 text-xs font-semibold text-slate-600">Canal</th>
                  <th className="pb-3 text-xs font-semibold text-slate-600">Intent</th>
                  <th className="pb-3 text-xs font-semibold text-slate-600">Sentimento</th>
                  <th className="pb-3 text-xs font-semibold text-slate-600">Tipo</th>
                  <th className="pb-3 text-xs font-semibold text-slate-600">Status</th>
                  <th className="pb-3 text-xs font-semibold text-slate-600">CSAT</th>
                </tr>
              </thead>
              <tbody>
                {conversas.slice(0, 10).map((conversa) => (
                  <tr key={conversa.id} className="border-b hover:bg-slate-50">
                    <td className="py-3 text-sm">{conversa.cliente_nome || 'Anônimo'}</td>
                    <td className="py-3">
                      <Badge className="text-xs">{conversa.canal}</Badge>
                    </td>
                    <td className="py-3 text-xs text-slate-600">{conversa.intent_principal || '-'}</td>
                    <td className="py-3">
                      <Badge className={`text-xs ${
                        conversa.sentimento_geral === 'Positivo' ? 'bg-green-100 text-green-700' :
                        conversa.sentimento_geral === 'Negativo' ? 'bg-red-100 text-red-700' :
                        conversa.sentimento_geral === 'Frustrado' ? 'bg-red-600' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {conversa.sentimento_geral || 'Neutro'}
                      </Badge>
                    </td>
                    <td className="py-3">
                      {conversa.tipo_atendimento === 'Bot' ? (
                        <Bot className="w-4 h-4 text-green-600" />
                      ) : (
                        <User className="w-4 h-4 text-orange-600" />
                      )}
                    </td>
                    <td className="py-3">
                      <Badge variant="outline" className="text-xs">
                        {conversa.status}
                      </Badge>
                    </td>
                    <td className="py-3">
                      {conversa.score_satisfacao ? (
                        <div className="flex gap-0.5">
                          {[...Array(conversa.score_satisfacao)].map((_, i) => (
                            <div key={i} className="w-3 h-3 bg-yellow-400 rounded-full" />
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
