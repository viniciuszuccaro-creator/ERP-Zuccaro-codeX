import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import {
  assertAnomalyScanContext,
  buildFinanceAnomalySuggestions,
} from '@/components/lib/iaTransversalPolicy';

/**
 * IA Detector de Anomalias Financeiras
 * Apenas sugere; não liquida nem baixa títulos.
 */
export default function IADetectorAnomalias() {
  const { filterInContext, empresaAtual, grupoAtual, estaNoGrupo } = useContextoVisual();
  const { hasPermission, isAdmin } = usePermissions();
  const [periodo, setPeriodo] = useState(30);
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const scopeType = estaNoGrupo ? 'grupo' : 'empresa';
  const contextoValido = Boolean(groupId && (scopeType === 'grupo' || empresaId));
  const canView = isAdmin?.() || hasPermission('Financeiro', null, 'ver') || hasPermission('Financeiro', null, 'visualizar');

  const { data: anomalias = [], isLoading } = useQuery({
    queryKey: ['ia-anomalias-financeiras', groupId, empresaId, scopeType, periodo],
    queryFn: async () => {
      assertAnomalyScanContext({ groupId, empresaId, scopeType });
      const [receber, pagar] = await Promise.all([
        filterInContext('ContaReceber', {}, '-created_date', 200),
        filterInContext('ContaPagar', {}, '-created_date', 200),
      ]);
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - periodo);
      const noPeriodo = (conta) => {
        const raw = conta.created_date || conta.data_vencimento || conta.data_emissao;
        if (!raw) return true;
        return new Date(raw) >= dataInicio;
      };
      const sugestao = buildFinanceAnomalySuggestions({
        receber: (receber || []).filter(noPeriodo),
        pagar: (pagar || []).filter(noPeriodo),
      });
      return sugestao.anomalias || [];
    },
    enabled: contextoValido && canView,
  });

  const porSeveridade = {
    alta: anomalias.filter((a) => a.severidade === 'alta').length,
    media: anomalias.filter((a) => a.severidade === 'media').length,
    baixa: anomalias.filter((a) => a.severidade === 'baixa').length,
  };

  if (!contextoValido) {
    return (
      <div className="w-full p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
        Selecione grupo e empresa para detectar anomalias financeiras.
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="w-full p-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm">
        Sem permissão para visualizar o detector de anomalias.
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col space-y-4 overflow-auto">
      <Card className="border-2 border-orange-500 bg-gradient-to-br from-orange-50 to-red-50">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-orange-600 flex items-center justify-center">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">IA Detector de Anomalias</CardTitle>
                <Badge className="bg-orange-600 text-white mt-1">Sugestão — sem baixa automática</Badge>
              </div>
            </div>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(Number(e.target.value))}
              className="px-3 py-2 border rounded"
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={60}>Últimos 60 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="border-2 border-slate-300">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-slate-600 mb-1">Total Detectado</p>
            <p className="text-3xl font-bold text-slate-900">{anomalias.length}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-red-300 bg-red-50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-slate-600 mb-1">Alta Prioridade</p>
            <p className="text-3xl font-bold text-red-600">{porSeveridade.alta}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-orange-300 bg-orange-50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-slate-600 mb-1">Média Prioridade</p>
            <p className="text-3xl font-bold text-orange-600">{porSeveridade.media}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-yellow-300 bg-yellow-50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-slate-600 mb-1">Baixa Prioridade</p>
            <p className="text-3xl font-bold text-yellow-600">{porSeveridade.baixa}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Zap className="w-8 h-8 text-blue-600 animate-pulse mx-auto mb-2" />
              <p className="text-slate-600">IA analisando padrões financeiros...</p>
            </CardContent>
          </Card>
        ) : anomalias.length === 0 ? (
          <Card className="border-2 border-green-300 bg-green-50">
            <CardContent className="p-6 text-center">
              <Shield className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <p className="text-lg font-semibold text-green-900">Nenhuma anomalia detectada!</p>
              <p className="text-sm text-slate-600">Suas operações financeiras estão saudáveis.</p>
            </CardContent>
          </Card>
        ) : (
          anomalias.map((anomalia, idx) => {
            const cores = {
              alta: 'border-red-400 bg-red-50',
              media: 'border-orange-400 bg-orange-50',
              baixa: 'border-yellow-400 bg-yellow-50',
            };
            const iconeCor = {
              alta: 'text-red-600',
              media: 'text-orange-600',
              baixa: 'text-yellow-600',
            };

            return (
              <Card key={idx} className={`border-2 ${cores[anomalia.severidade]}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-6 h-6 ${iconeCor[anomalia.severidade]} flex-shrink-0 mt-1`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-slate-900">{anomalia.tipo}</h3>
                        <Badge className={anomalia.severidade === 'alta' ? 'bg-red-600 text-white'
                          : anomalia.severidade === 'media' ? 'bg-orange-600 text-white'
                            : 'bg-yellow-600 text-white'}>
                          {anomalia.severidade.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="p-3 bg-white rounded border">
                          <p className="text-sm font-semibold text-slate-900">{anomalia.conta.descricao}</p>
                          <div className="flex items-center gap-3 text-sm text-slate-600 mt-1">
                            <span>{anomalia.conta.cliente || anomalia.conta.fornecedor}</span>
                            <span>•</span>
                            <span className="font-bold text-green-600">
                              R$ {(anomalia.conta.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        <div className="text-sm space-y-1">
                          <p className="text-slate-700">
                            <span className="font-semibold">Detalhes:</span> {anomalia.descricao}
                          </p>
                          <p className="text-blue-700">
                            <span className="font-semibold">Recomendação IA:</span> {anomalia.recomendacao}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
