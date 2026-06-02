import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, AlertTriangle, CheckCircle, TrendingUp, Timer } from 'lucide-react';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import { Progress } from '@/components/ui/progress';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.5 - MONITOR DE SLA (Service Level Agreement)
 * 
 * Monitora e alerta sobre:
 * ✅ Tempo de primeira resposta (TFR)
 * ✅ Tempo de resolução (TR)
 * ✅ Conversas críticas próximas ao limite
 * ✅ Performance por canal
 * ✅ Alertas em tempo real
 */
export default function MonitorSLA() {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const empresaId = empresaAtual?.id;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewSla = hasPermission('CRM', 'Atendimento', 'visualizar') ||
    hasPermission('CRM', 'Relatorios', 'visualizar') ||
    hasPermission('Sistema', 'Integracoes', 'visualizar');

  // Metas de SLA configuráveis
  const metasSLA = {
    tempo_primeira_resposta_minutos: 5,
    tempo_resolucao_minutos: 60,
    taxa_resolucao_meta: 85
  };

  const { data: conversas = [] } = useQuery({
    queryKey: ['conversas-sla', contextKey],
    queryFn: async () => {
      return await filterInContext('ConversaOmnicanal', {}, '-data_inicio', 1000);
    },
    enabled: contextoValido && canViewSla,
    refetchInterval: 10000
  });

  // Calcular métricas de SLA
  const metricas = React.useMemo(() => {
    const hoje = new Date();
    const inicioHoje = new Date(hoje.setHours(0, 0, 0, 0));
    
    const conversasHoje = conversas.filter(c => 
      new Date(c.data_inicio) >= inicioHoje
    );

    const comPrimeiraResposta = conversasHoje.filter(c => c.tempo_primeira_resposta_minutos);
    const tfrMedio = comPrimeiraResposta.length > 0
      ? comPrimeiraResposta.reduce((sum, c) => sum + c.tempo_primeira_resposta_minutos, 0) / comPrimeiraResposta.length
      : 0;
    
    const dentroSLA_TFR = comPrimeiraResposta.filter(c => 
      c.tempo_primeira_resposta_minutos <= metasSLA.tempo_primeira_resposta_minutos
    ).length;
    const taxaTFR = comPrimeiraResposta.length > 0
      ? (dentroSLA_TFR / comPrimeiraResposta.length) * 100
      : 0;

    const resolvidas = conversasHoje.filter(c => c.tempo_resolucao_minutos);
    const trMedio = resolvidas.length > 0
      ? resolvidas.reduce((sum, c) => sum + c.tempo_resolucao_minutos, 0) / resolvidas.length
      : 0;

    const dentroSLA_TR = resolvidas.filter(c =>
      c.tempo_resolucao_minutos <= metasSLA.tempo_resolucao_minutos
    ).length;
    const taxaTR = resolvidas.length > 0
      ? (dentroSLA_TR / resolvidas.length) * 100
      : 0;

    // Conversas críticas (próximas ao limite)
    const agora = new Date();
    const criticas = conversas.filter(c => {
      if (c.status === 'Resolvida' || c.status === 'Arquivada') return false;
      
      const tempoDecorrido = (agora - new Date(c.data_inicio)) / 1000 / 60; // minutos
      const limiteRestante = metasSLA.tempo_resolucao_minutos - tempoDecorrido;
      
      return limiteRestante < 15 && limiteRestante > 0; // Alerta 15min antes
    });

    const excedidas = conversas.filter(c => {
      if (c.status === 'Resolvida' || c.status === 'Arquivada') return false;
      const tempoDecorrido = (agora - new Date(c.data_inicio)) / 1000 / 60;
      return tempoDecorrido > metasSLA.tempo_resolucao_minutos;
    });

    return {
      tfrMedio: tfrMedio.toFixed(1),
      taxaTFR: taxaTFR.toFixed(0),
      trMedio: trMedio.toFixed(1),
      taxaTR: taxaTR.toFixed(0),
      conversasCriticas: criticas,
      conversasExcedidas: excedidas
    };
  }, [conversas]);

  return (
    <div className="w-full h-full space-y-6" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
      {(!contextoValido || !canViewSla) && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertDescription className="text-amber-800">
            Selecione grupo/empresa e confirme permissao de atendimento para monitorar SLA.
          </AlertDescription>
        </Alert>
      )}

      {/* Alertas */}
      {metricas.conversasExcedidas.length > 0 && (
        <Alert className="border-red-300 bg-red-50">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <AlertDescription className="text-red-900">
            <strong>{metricas.conversasExcedidas.length} conversa(s)</strong> excederam o SLA de resolução!
          </AlertDescription>
        </Alert>
      )}

      {metricas.conversasCriticas.length > 0 && (
        <Alert className="border-orange-300 bg-orange-50">
          <Clock className="w-5 h-5 text-orange-600" />
          <AlertDescription className="text-orange-900">
            <strong>{metricas.conversasCriticas.length} conversa(s)</strong> próximas do limite (15min restantes)
          </AlertDescription>
        </Alert>
      )}

      {/* Métricas de SLA */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-blue-600" />
                Tempo Primeira Resposta (TFR)
              </span>
              <Badge className={parseFloat(metricas.taxaTFR) >= 90 ? 'bg-green-600' : parseFloat(metricas.taxaTFR) >= 70 ? 'bg-yellow-600' : 'bg-red-600'}>
                {metricas.taxaTFR}% no SLA
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Tempo Médio</span>
                  <span className="text-2xl font-bold text-blue-600">{metricas.tfrMedio}min</span>
                </div>
                <Progress value={(metricas.tfrMedio / metasSLA.tempo_primeira_resposta_minutos) * 100} className="h-2" />
                <p className="text-xs text-slate-500 mt-1">Meta: {metasSLA.tempo_primeira_resposta_minutos} minutos</p>
              </div>

              <div className="pt-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Status:</span>
                  {parseFloat(metricas.tfrMedio) <= metasSLA.tempo_primeira_resposta_minutos ? (
                    <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      Dentro do SLA
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-600 text-xs font-semibold">
                      <AlertTriangle className="w-4 h-4" />
                      Fora do SLA
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Tempo de Resolução (TR)
              </span>
              <Badge className={parseFloat(metricas.taxaTR) >= 85 ? 'bg-green-600' : parseFloat(metricas.taxaTR) >= 70 ? 'bg-yellow-600' : 'bg-red-600'}>
                {metricas.taxaTR}% no SLA
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Tempo Médio</span>
                  <span className="text-2xl font-bold text-purple-600">{metricas.trMedio}min</span>
                </div>
                <Progress value={(metricas.trMedio / metasSLA.tempo_resolucao_minutos) * 100} className="h-2" />
                <p className="text-xs text-slate-500 mt-1">Meta: {metasSLA.tempo_resolucao_minutos} minutos</p>
              </div>

              <div className="pt-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Status:</span>
                  {parseFloat(metricas.trMedio) <= metasSLA.tempo_resolucao_minutos ? (
                    <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      Dentro do SLA
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-600 text-xs font-semibold">
                      <AlertTriangle className="w-4 h-4" />
                      Fora do SLA
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversas Críticas */}
      {(metricas.conversasCriticas.length > 0 || metricas.conversasExcedidas.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Conversas Requerendo Atenção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metricas.conversasExcedidas.map((conv) => (
                <div key={conv.id} className="p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-red-900">{conv.cliente_nome || 'Cliente'}</p>
                      <p className="text-xs text-red-700">
                        {conv.canal} • {conv.intent_principal || 'Sem assunto'}
                      </p>
                    </div>
                    <Badge className="bg-red-600">SLA Excedido</Badge>
                  </div>
                </div>
              ))}
              
              {metricas.conversasCriticas.map((conv) => (
                <div key={conv.id} className="p-3 bg-orange-50 border-2 border-orange-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-orange-900">{conv.cliente_nome || 'Cliente'}</p>
                      <p className="text-xs text-orange-700">
                        {conv.canal} • {conv.intent_principal || 'Sem assunto'}
                      </p>
                    </div>
                    <Badge className="bg-orange-600">Crítico</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
