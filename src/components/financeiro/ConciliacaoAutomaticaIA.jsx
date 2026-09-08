import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Zap, CheckCircle2, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import {
  assertIaUiContext,
  buildConciliacaoMatchSuggestions,
  requireIaHumanConfirm,
} from '@/components/lib/iaTransversalPolicy';

export default function ConciliacaoAutomaticaIA({ empresaId: empresaIdProp }) {
  const queryClient = useQueryClient();
  const [processando, setProcessando] = useState(false);
  const [resultados, setResultados] = useState(null);
  const { empresaAtual, grupoAtual, estaNoGrupo, filterInContext, updateInContext, createInContext } = useContextoVisual();
  const { hasPermission, isAdmin, user } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaIdProp || empresaAtual?.id || null;
  const scopeType = estaNoGrupo && !empresaIdProp ? 'grupo' : 'empresa';
  const contextoValido = Boolean(groupId && (scopeType === 'grupo' || empresaId));
  const canView = isAdmin?.() || hasPermission('Financeiro', null, 'ver') || hasPermission('Financeiro', null, 'visualizar');
  const canExecutar = isAdmin?.() || hasPermission('Financeiro', 'Conciliacao', 'editar') || hasPermission('Financeiro', null, 'editar');

  const { data: extratos = [] } = useQuery({
    queryKey: ['extratos-pendentes', groupId, empresaId, scopeType],
    queryFn: () => filterInContext('ExtratoBancario', { conciliado: false }, '-data_movimento', 500),
    enabled: contextoValido && canView,
  });

  const { data: movimentos = [] } = useQuery({
    queryKey: ['movimentos-nao-conciliados', groupId, empresaId, scopeType],
    queryFn: () => filterInContext('CaixaMovimento', { conciliado: false }, '-data_movimento', 500),
    enabled: contextoValido && canView,
  });

  const executarConciliacaoIA = async () => {
    try {
      assertIaUiContext({ groupId, empresaId, scopeType });
      if (!canExecutar) throw new Error('Sem permissao para executar conciliacao assistida.');
      setProcessando(true);
      const sugestao = buildConciliacaoMatchSuggestions({ extratos, movimentos });
      setResultados(sugestao);
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Sistema',
        usuario_id: user?.id || null,
        empresa_id: scopeType === 'grupo' ? null : empresaId,
        group_id: groupId,
        acao: 'Analise',
        modulo: 'Financeiro',
        entidade: 'ConciliacaoIA',
        descricao: 'IA gerou sugestoes de conciliacao sem aplicar automaticamente',
        dados_novos: {
          total_analisados: sugestao.total_analisados,
          conciliados: sugestao.conciliados,
          modo: sugestao.modo,
        },
        sucesso: true,
        data_hora: new Date().toISOString(),
      });
      toast.success(`IA sugeriu ${sugestao.conciliados} matches exatos. Confirme para aplicar.`);
    } catch (error) {
      toast.error(String(error?.message || error));
    } finally {
      setProcessando(false);
    }
  };

  const aplicarConciliacoes = useMutation({
    mutationFn: async () => {
      assertIaUiContext({ groupId, empresaId, scopeType });
      if (!canExecutar) throw new Error('Sem permissao para aplicar conciliacao.');
      const matchesExatos = (resultados?.matches || []).filter((m) => m.exato);
      if (!matchesExatos.length) throw new Error('Nenhum match exato para aplicar.');
      if (!requireIaHumanConfirm(`Aplicar ${matchesExatos.length} conciliacao(oes) sugeridas pela IA?`)) {
        throw new Error('Aplicacao cancelada.');
      }

      for (const match of matchesExatos) {
        await updateInContext('ExtratoBancario', match.extrato.id, {
          conciliado: true,
          movimento_vinculado_id: match.movimento.id,
          data_conciliacao: new Date().toISOString(),
        });
        await updateInContext('CaixaMovimento', match.movimento.id, {
          conciliado: true,
          extrato_vinculado_id: match.extrato.id,
        });
        await createInContext('ConciliacaoBancaria', {
          empresa_id: match.extrato.empresa_id || empresaId,
          group_id: groupId,
          extrato_bancario_id: match.extrato.id,
          movimento_caixa_id: match.movimento.id,
          data_conciliacao: new Date().toISOString(),
          valor_extrato: match.extrato.valor,
          valor_movimento: match.movimento.valor,
          valor_diferencia: 0,
          valor_diferenca: 0,
          tem_divergencia: false,
          status: 'conciliado',
          conciliado_por_ia: true,
          observacoes: 'Conciliacao assistida por IA (confirmada pelo usuario)',
        });
      }

      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Sistema',
        usuario_id: user?.id || null,
        empresa_id: scopeType === 'grupo' ? null : empresaId,
        group_id: groupId,
        acao: 'Conciliar',
        modulo: 'Financeiro',
        entidade: 'ConciliacaoBancaria',
        descricao: 'Conciliacoes aplicadas apos confirmacao humana',
        dados_novos: { quantidade: matchesExatos.length },
        sucesso: true,
        data_hora: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extratos-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['movimentos-nao-conciliados'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacoes-bancarias'] });
      toast.success('Conciliacoes aplicadas com sucesso.');
      setResultados(null);
    },
    onError: (error) => toast.error(String(error?.message || error)),
  });

  if (!contextoValido) {
    return (
      <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
        Selecione grupo e empresa para usar a conciliacao assistida por IA.
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm">
        Sem permissao para visualizar conciliacao assistida.
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader className="bg-purple-100/50 border-b border-purple-200">
          <CardTitle className="flex items-center gap-2 text-purple-900">
            <Sparkles className="w-6 h-6" />
            Motor de Conciliação Assistida com IA
          </CardTitle>
          <p className="text-sm text-purple-700 mt-1">
            Pareamento inteligente por valor e data — aplica somente após confirmação
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-lg border-2 border-blue-200">
              <p className="text-sm text-blue-700 mb-1">Extratos Pendentes</p>
              <p className="text-3xl font-bold text-blue-900">{extratos.length}</p>
            </div>
            <div className="p-4 bg-white rounded-lg border-2 border-green-200">
              <p className="text-sm text-green-700 mb-1">Movimentos Disponíveis</p>
              <p className="text-3xl font-bold text-green-900">{movimentos.length}</p>
            </div>
          </div>

          <Button
            onClick={executarConciliacaoIA}
            disabled={processando || extratos.length === 0 || !canExecutar}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            size="lg"
          >
            {processando ? (
              <>
                <Zap className="w-5 h-5 mr-2 animate-pulse" />
                Processando IA...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Sugerir Conciliação Assistida
              </>
            )}
          </Button>

          {processando && (
            <div className="space-y-2">
              <Progress value={65} className="h-2" />
              <p className="text-sm text-center text-purple-700">
                Analisando padrões e comparando valores...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {resultados && (
        <Card className="border-green-200">
          <CardHeader className="bg-green-50 border-b border-green-200">
            <CardTitle className="flex items-center gap-2 text-green-900">
              <TrendingUp className="w-5 h-5" />
              Resultados da IA (sugestão)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">Analisados</p>
                <p className="text-2xl font-bold text-blue-900">{resultados.total_analisados}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700">Matches Exatos</p>
                <p className="text-2xl font-bold text-green-900">{resultados.conciliados}</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-700">Com Divergência</p>
                <p className="text-2xl font-bold text-orange-900">{resultados.divergencias}</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-700">Sem Match</p>
                <p className="text-2xl font-bold text-slate-900">{resultados.sem_match}</p>
              </div>
            </div>

            {resultados.matches.length > 0 && (
              <div className="space-y-3">
                <p className="font-semibold text-slate-900">Matches Encontrados:</p>
                {resultados.matches.slice(0, 5).map((match, idx) => (
                  <div key={idx} className={`p-4 rounded-lg border-2 ${match.exato ? 'bg-green-50 border-green-300' : 'bg-orange-50 border-orange-300'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{match.extrato.descricao}</p>
                        <p className="text-xs text-slate-600 mt-1">
                          Extrato: R$ {Math.abs(match.extrato.valor).toFixed(2)} •
                          Movimento: R$ {Math.abs(match.movimento.valor).toFixed(2)}
                        </p>
                      </div>
                      {match.exato ? (
                        <Badge className="bg-green-600">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Match 100%
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-600">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Divergência
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {resultados.matches.length > 5 && (
                  <p className="text-sm text-slate-500 text-center">
                    +{resultados.matches.length - 5} matches adicionais
                  </p>
                )}
              </div>
            )}

            {resultados.conciliados > 0 && canExecutar && (
              <Button
                onClick={() => aplicarConciliacoes.mutate()}
                disabled={aplicarConciliacoes.isPending}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Confirmar e aplicar {resultados.conciliados} conciliações
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
