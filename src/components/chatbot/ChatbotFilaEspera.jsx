import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Users, AlertCircle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import {
  buildAssumirConversa,
  ordenarFilaAtendimento,
  statusNaFilaAtendimento,
} from '@/components/lib/atendimentoConversaPolicy';

/**
 * V21.5 - FILA DE ESPERA INTELIGENTE
 *
 * Recursos:
 * Visualizacao de conversas aguardando / nao atribuidas
 * Priorizacao por prioridade + sentimento + tempo
 * Assumir conversa com carimbo unico
 */
export default function ChatbotFilaEspera() {
  const { empresaAtual, grupoAtual, filterInContext, updateInContext, createInContext } = useContextoVisual();
  const { user, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewFila = hasPermission('CRM', 'Atendimento', 'visualizar') ||
    hasPermission('Sistema', 'Integracoes', 'visualizar');
  const canAssume = hasPermission('CRM', 'Atendimento', 'editar') ||
    hasPermission('Sistema', 'Integracoes', 'editar');

  const { data: conversasFila = [] } = useQuery({
    queryKey: ['fila-espera', contextKey],
    queryFn: async () => {
      const todas = await filterInContext('ConversaOmnicanal', {}, '-transferido_em', 300);
      return ordenarFilaAtendimento((todas || []).filter((item) => statusNaFilaAtendimento(item.status)));
    },
    enabled: contextoValido && canViewFila,
    refetchInterval: 5000
  });

  const { data: atendentesDisponiveis = [] } = useQuery({
    queryKey: ['atendentes-disponiveis-fila', contextKey],
    queryFn: async () => {
      const usuarios = await filterInContext('User', {}, 'full_name', 500);
      return (usuarios || []).filter((u) => u.ativo !== false && (u.role === 'admin' || u.perfil_acesso_id || u.pode_atender_transbordo));
    },
    enabled: contextoValido && canViewFila
  });

  const assumirMutation = useMutation({
    mutationFn: async (conversa) => {
      if (!canAssume) throw new Error('Sem permissao para assumir conversa.');
      const decision = buildAssumirConversa({ conversa, user, empresaId });
      if (decision.reuse) return decision.patch;
      await updateInContext('ConversaOmnicanal', conversa.id, decision.patch);
      await createInContext('AuditLog', {
        empresa_id: conversa.empresa_id || empresaId,
        group_id: conversa.group_id || groupId,
        usuario: user?.full_name || user?.email,
        usuario_id: user?.id,
        acao: 'Edicao',
        modulo: 'Atendimento',
        entidade: 'ConversaOmnicanal',
        registro_id: conversa.id,
        descricao: 'Conversa assumida pela fila de espera',
        dados_novos: decision.patch,
        data_hora: new Date().toISOString(),
        sucesso: true,
      });
      return decision.patch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fila-espera'] });
      queryClient.invalidateQueries({ queryKey: ['conversas-omnicanal'] });
      toast.success('Conversa assumida');
    },
    onError: (error) => toast.error(error?.message || 'Falha ao assumir'),
  });

  const calcularTempoEspera = (dataTransferencia) => {
    if (!dataTransferencia) return '0min';
    const agora = new Date();
    const transferido = new Date(dataTransferencia);
    const diffMinutos = Math.floor((agora - transferido) / 1000 / 60);
    if (diffMinutos < 60) return `${diffMinutos}min`;
    const horas = Math.floor(diffMinutos / 60);
    const minutos = diffMinutos % 60;
    return `${horas}h ${minutos}min`;
  };

  const conversasOrdenadas = conversasFila;
  const tempoMedioEspera = conversasOrdenadas.length > 0
    ? conversasOrdenadas.reduce((sum, c) => {
        const base = c.transferido_em || c.data_inicio || c.created_date;
        if (!base) return sum;
        const diffMinutos = Math.floor((new Date() - new Date(base)) / 1000 / 60);
        return sum + Math.max(0, diffMinutos);
      }, 0) / conversasOrdenadas.length
    : 0;

  return (
    <div className="space-y-4 w-full h-full" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
      {(!contextoValido || !canViewFila) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Selecione um grupo/empresa e confirme permissao de atendimento para visualizar a fila.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-600 text-sm mb-1">
              <Users className="w-4 h-4" />
              Na Fila
            </div>
            <p className="text-3xl font-bold text-orange-600">{conversasOrdenadas.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-600 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Tempo Médio
            </div>
            <p className="text-3xl font-bold text-purple-600">{tempoMedioEspera.toFixed(0)}min</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              Atendentes
            </div>
            <p className="text-3xl font-bold text-green-600">{atendentesDisponiveis.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fila de Espera (Ordenado por Prioridade)</CardTitle>
        </CardHeader>
        <CardContent>
          {conversasOrdenadas.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Nenhuma conversa aguardando atendimento</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversasOrdenadas.map((conversa, idx) => {
                const baseTempo = conversa.transferido_em || conversa.data_inicio || conversa.created_date;
                const tempoEspera = calcularTempoEspera(baseTempo);
                const esperaMuito = baseTempo && (new Date() - new Date(baseTempo) > 10 * 60 * 1000);

                return (
                  <div
                    key={conversa.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      esperaMuito ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-slate-900">#{idx + 1}</span>
                          <span className="text-sm font-medium">
                            {conversa.cliente_nome || 'Cliente Anônimo'}
                          </span>
                          <Badge className={`text-xs ${
                            conversa.prioridade === 'Urgente' ? 'bg-red-600' :
                            conversa.prioridade === 'Alta' ? 'bg-orange-600' :
                            'bg-slate-600'
                          }`}>
                            {conversa.prioridade || 'Normal'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {conversa.canal}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {conversa.status}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Aguardando: {tempoEspera}
                          </span>
                          {conversa.sentimento_geral && (
                            <Badge className={`text-xs ${
                              conversa.sentimento_geral === 'Frustrado' ? 'bg-red-600' :
                              conversa.sentimento_geral === 'Urgente' ? 'bg-orange-600' :
                              'bg-slate-600'
                            }`}>
                              {conversa.sentimento_geral}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {esperaMuito && (
                          <div className="flex items-center gap-1 text-red-600 text-xs font-semibold">
                            <AlertCircle className="w-4 h-4" />
                            SLA
                          </div>
                        )}
                        {canAssume && (
                          <Button
                            size="sm"
                            onClick={() => assumirMutation.mutate(conversa)}
                            disabled={assumirMutation.isPending}
                            data-action="ChatbotFilaEspera.assumir"
                          >
                            Assumir
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
