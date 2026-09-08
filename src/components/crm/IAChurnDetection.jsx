import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import {
  assertIaUiContext,
  buildCrmAbcChurnOportunidade,
  buildCrmAbcChurnSuggestions,
  requireIaHumanConfirm,
} from '@/components/lib/iaTransversalPolicy';

/**
 * IA de Detecção de Churn (CRM)
 * Sugere oportunidades; grava somente após confirmação humana.
 */
export default function IAChurnDetection({ clientes = [] }) {
  const [resultado, setResultado] = useState(null);
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, estaNoGrupo, createInContext, filterInContext } = useContextoVisual();
  const { hasPermission, isAdmin, user } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const scopeType = estaNoGrupo ? 'grupo' : 'empresa';
  const canView = isAdmin?.() || hasPermission('CRM', null, 'ver') || hasPermission('CRM', null, 'visualizar');
  const canExecutar = isAdmin?.() || hasPermission('CRM', null, 'criar') || hasPermission('CRM', null, 'editar');

  const analisarMutation = useMutation({
    mutationFn: async () => {
      assertIaUiContext({ groupId, empresaId, scopeType });
      if (!canView) throw new Error('Sem permissao para analisar churn.');
      const sugestao = buildCrmAbcChurnSuggestions({ clientes });
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Sistema',
        usuario_id: user?.id || null,
        empresa_id: scopeType === 'grupo' ? null : empresaId,
        group_id: groupId,
        acao: 'Analise',
        modulo: 'CRM',
        entidade: 'IA_Churn_CRM',
        descricao: 'Analise CRM de churn gerou sugestoes sem gravacao automatica',
        dados_novos: {
          total_analisados: sugestao.total_analisados,
          clientes_risco: sugestao.clientes_risco,
          modo: sugestao.modo,
        },
        sucesso: true,
        data_hora: new Date().toISOString(),
      });
      return sugestao;
    },
    onSuccess: (sugestao) => {
      setResultado(sugestao);
      toast.success(`IA sugeriu ${sugestao.clientes_risco} clientes em risco. Confirme para gravar.`);
    },
    onError: (error) => toast.error(String(error?.message || error)),
  });

  const gravarMutation = useMutation({
    mutationFn: async () => {
      assertIaUiContext({ groupId, empresaId, scopeType });
      if (!canExecutar) throw new Error('Sem permissao para gravar oportunidades.');
      const sugestoes = resultado?.sugestoes || [];
      if (!sugestoes.length) throw new Error('Nenhuma sugestao para gravar.');
      if (!requireIaHumanConfirm(`Gravar ${sugestoes.length} oportunidade(s) de churn sugeridas pela IA?`)) {
        throw new Error('Gravacao cancelada.');
      }

      const criadas = [];
      for (const cliente of sugestoes) {
        const existentes = await filterInContext(
          'Oportunidade',
          { cliente_id: cliente.id },
          '-created_date',
          20
        );
        const aberta = (existentes || []).some((opp) =>
          ['Aberto', 'Em Andamento', 'Nova'].includes(String(opp.status || ''))
        );
        if (aberta) continue;

        const payload = {
          ...buildCrmAbcChurnOportunidade(cliente),
          group_id: groupId,
          empresa_id: scopeType === 'grupo' ? (cliente.empresa_id || empresaId) : empresaId,
          data_abertura: new Date().toISOString().split('T')[0],
        };
        const nova = await createInContext('Oportunidade', payload);
        criadas.push(nova);
      }

      if (!criadas.length) {
        throw new Error('Nenhuma oportunidade nova para gravar (ja existem abertas ou lista vazia).');
      }

      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Sistema',
        usuario_id: user?.id || null,
        empresa_id: scopeType === 'grupo' ? null : empresaId,
        group_id: groupId,
        acao: 'Criar',
        modulo: 'CRM',
        entidade: 'Oportunidade',
        descricao: 'Oportunidades de churn gravadas apos confirmacao humana',
        dados_novos: { quantidade: criadas.length },
        sucesso: true,
        data_hora: new Date().toISOString(),
      });

      return criadas;
    },
    onSuccess: (criadas) => {
      setResultado((prev) => prev ? { ...prev, oportunidades_criadas: criadas.length, lista_criadas: criadas } : prev);
      queryClient.invalidateQueries({ queryKey: ['oportunidades'] });
      toast.success(`${criadas.length} oportunidade(s) gravadas.`);
    },
    onError: (error) => toast.error(String(error?.message || error)),
  });

  if (!groupId || (scopeType !== 'grupo' && !empresaId)) {
    return (
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="p-4 text-sm text-amber-900">
          Selecione grupo e empresa para usar a IA de churn do CRM.
        </CardContent>
      </Card>
    );
  }

  if (!canView) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-4 text-sm text-slate-700">
          Sem permissão para visualizar a detecção de churn.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-300 bg-gradient-to-br from-orange-50 to-red-50">
      <CardHeader className="bg-white/80 border-b">
        <CardTitle className="flex items-center gap-2 text-orange-900">
          <AlertTriangle className="w-6 h-6 text-orange-600" />
          IA de Detecção de Churn
        </CardTitle>
        <p className="text-sm text-orange-700 mt-1">
          Analisa clientes A/B sem movimento e sugere oportunidades (grava só com confirmação)
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between p-4 bg-white rounded-lg border gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-slate-900 mb-1">Analisar risco de churn</p>
            <p className="text-xs text-slate-600">
              Detecta clientes classe A/B com + de 30 dias sem compra — modo sugestão
            </p>
          </div>
          <Button
            onClick={() => analisarMutation.mutate()}
            disabled={analisarMutation.isPending}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {analisarMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Sugerir com IA
              </>
            )}
          </Button>
        </div>

        {resultado && (
          <Alert className="border-green-300 bg-green-50">
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold text-green-900">Análise concluída (sugestão)</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-green-700">Clientes analisados</p>
                    <p className="text-xl font-bold text-green-900">{resultado.total_analisados}</p>
                  </div>
                  <div>
                    <p className="text-orange-700">Em risco</p>
                    <p className="text-xl font-bold text-orange-600">{resultado.clientes_risco}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Oportunidades gravadas</p>
                    <p className="text-xl font-bold text-blue-600">{resultado.oportunidades_criadas || 0}</p>
                  </div>
                </div>

                {(resultado.sugestoes || []).length > 0 && (
                  <div className="mt-3 p-3 bg-white rounded border space-y-2">
                    <p className="text-xs text-slate-600">Sugestões (não gravadas automaticamente):</p>
                    {(resultado.sugestoes || []).slice(0, 5).map((item) => (
                      <p key={item.id || item.nome} className="text-xs text-slate-700">
                        • {item.nome_fantasia || item.nome} — {item.motivo_risco}
                      </p>
                    ))}
                    {canExecutar && (
                      <Button
                        size="sm"
                        className="mt-2 bg-blue-600 hover:bg-blue-700"
                        disabled={gravarMutation.isPending || (resultado.oportunidades_criadas || 0) > 0}
                        onClick={() => gravarMutation.mutate()}
                      >
                        {gravarMutation.isPending ? 'Gravando...' : 'Confirmar e gravar oportunidades'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
