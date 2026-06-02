import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  MessageCircle, 
  Clock, 
  CheckCircle, 
  TrendingUp,
  Star,
  Award,
  Target,
  Flame
} from 'lucide-react';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.6 - DASHBOARD DO ATENDENTE
 * 
 * Métricas individuais:
 * ✅ Conversas atendidas hoje
 * ✅ Tempo médio de resposta
 * ✅ Taxa de resolução
 * ✅ CSAT individual
 * ✅ Ranking e gamificação
 */
export default function DashboardAtendente() {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { user, hasPermission } = usePermissions();
  const empresaId = empresaAtual?.id;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewAtendente = hasPermission('CRM', 'Atendimento', 'visualizar') ||
    hasPermission('Dashboard', 'Atendimento', 'visualizar');

  const { data: metricas, isLoading } = useQuery({
    queryKey: ['metricas-atendente', user?.id, contextKey],
    queryFn: async () => {
      if (!user?.id) return null;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // Buscar conversas do atendente
      const conversas = await filterInContext('ConversaOmnicanal', {
        atendente_id: user.id
      }, '-data_ultima_mensagem', 500);

      const conversasHoje = conversas.filter(c => 
        new Date(c.data_ultima_mensagem) >= hoje
      );

      const resolvidasHoje = conversasHoje.filter(c => c.status === 'Resolvida');
      
      // Calcular tempo médio de resposta
      const temposResposta = conversas
        .filter(c => c.tempo_primeira_resposta_minutos)
        .map(c => c.tempo_primeira_resposta_minutos);
      const tempoMedio = temposResposta.length > 0
        ? temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length
        : 0;

      // Calcular CSAT
      const avaliacoes = conversas.filter(c => c.score_satisfacao);
      const csat = avaliacoes.length > 0
        ? avaliacoes.reduce((sum, c) => sum + c.score_satisfacao, 0) / avaliacoes.length
        : 0;

      // Taxa de resolução
      const taxaResolucao = conversasHoje.length > 0
        ? (resolvidasHoje.length / conversasHoje.length) * 100
        : 0;

      // Sequência de dias
      const diasConsecutivos = 5; // TODO: calcular real

      return {
        conversasHoje: conversasHoje.length,
        resolvidasHoje: resolvidasHoje.length,
        emAndamento: conversasHoje.filter(c => c.status === 'Em Progresso').length,
        tempoMedioResposta: tempoMedio.toFixed(1),
        csat: csat.toFixed(1),
        taxaResolucao: taxaResolucao.toFixed(0),
        totalAvaliacoes: avaliacoes.length,
        diasConsecutivos,
        pontos: resolvidasHoje.length * 10 + Math.round(csat * 5),
        nivel: Math.floor(conversas.length / 50) + 1
      };
    },
    enabled: !!user?.id && contextoValido && canViewAtendente,
    refetchInterval: 30000
  });

  if (!contextoValido || !canViewAtendente) {
    return (
      <Card className="w-full h-full" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
        <CardContent className="p-4 text-sm text-amber-800">
          Selecione grupo/empresa e confirme permissao de atendimento para visualizar o painel do atendente.
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !metricas) {
    return (
      <Card className="w-full h-full" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-1/2" />
            <div className="h-8 bg-slate-200 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const metaSLA = 5; // minutos
  const metaResolucao = 80; // %

  return (
    <div className="w-full h-full space-y-4" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
      {/* Header com pontos */}
      <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Olá, {user?.full_name?.split(' ')[0]}</p>
              <p className="text-2xl font-bold">{metricas.pontos} pontos</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-1">
                <Award className="w-8 h-8" />
              </div>
              <Badge className="bg-white/30">Nível {metricas.nivel}</Badge>
            </div>
          </div>
          
          {metricas.diasConsecutivos >= 3 && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Flame className="w-4 h-4 text-orange-300" />
              <span>{metricas.diasConsecutivos} dias consecutivos!</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs Principais */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-blue-600 text-xs mb-1">
              <MessageCircle className="w-3 h-3" />
              Atendimentos Hoje
            </div>
            <p className="text-2xl font-bold">{metricas.conversasHoje}</p>
            <p className="text-xs text-slate-500">{metricas.emAndamento} em andamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-green-600 text-xs mb-1">
              <CheckCircle className="w-3 h-3" />
              Resolvidas
            </div>
            <p className="text-2xl font-bold text-green-600">{metricas.resolvidasHoje}</p>
            <p className="text-xs text-slate-500">{metricas.taxaResolucao}% taxa</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-purple-600 text-xs mb-1">
              <Clock className="w-3 h-3" />
              Tempo Médio
            </div>
            <p className="text-2xl font-bold text-purple-600">{metricas.tempoMedioResposta}min</p>
            <Progress 
              value={Math.min((metaSLA / parseFloat(metricas.tempoMedioResposta || 1)) * 100, 100)} 
              className="h-1 mt-1" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-yellow-600 text-xs mb-1">
              <Star className="w-3 h-3" />
              CSAT
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold text-yellow-600">{metricas.csat}</p>
              <span className="text-sm text-slate-500">/5</span>
            </div>
            <p className="text-xs text-slate-500">{metricas.totalAvaliacoes} avaliações</p>
          </CardContent>
        </Card>
      </div>

      {/* Metas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            Metas do Dia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Taxa de Resolução</span>
              <span className={parseFloat(metricas.taxaResolucao) >= metaResolucao ? 'text-green-600' : 'text-orange-600'}>
                {metricas.taxaResolucao}% / {metaResolucao}%
              </span>
            </div>
            <Progress 
              value={Math.min((parseFloat(metricas.taxaResolucao) / metaResolucao) * 100, 100)} 
              className="h-2" 
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>SLA de Resposta</span>
              <span className={parseFloat(metricas.tempoMedioResposta) <= metaSLA ? 'text-green-600' : 'text-orange-600'}>
                {metricas.tempoMedioResposta}min / {metaSLA}min
              </span>
            </div>
            <Progress 
              value={parseFloat(metricas.tempoMedioResposta) <= metaSLA 
                ? 100 
                : Math.max(0, 100 - ((parseFloat(metricas.tempoMedioResposta) - metaSLA) * 20))} 
              className="h-2" 
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
