import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Target, Zap, Brain } from 'lucide-react';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { toast } from 'sonner';
import {
  assertForecastUiContext,
  buildVendasRecompraSuggestions,
} from '@/components/lib/iaTransversalPolicy';

/**
 * IA de Vendas Preditivas — sugere recompra; não cria campanha automaticamente.
 */
export default function IAVendasPreditivas({ empresaId: empresaIdProp }) {
  const [previsoes, setPrevisoes] = useState([]);
  const [analisando, setAnalisando] = useState(false);
  const { empresaAtual, grupoAtual, estaNoGrupo, filterInContext, createInContext } = useContextoVisual();
  const { hasPermission, isAdmin, user } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaIdProp || empresaAtual?.id || null;
  const scopeType = estaNoGrupo && !empresaIdProp ? 'grupo' : 'empresa';
  const contextoValido = Boolean(groupId && (scopeType === 'grupo' || empresaId));
  const canView = isAdmin?.()
    || hasPermission('Comercial', null, 'visualizar')
    || hasPermission('Comercial', null, 'ver')
    || hasPermission('CRM', null, 'visualizar')
    || hasPermission('CRM', null, 'ver');
  const userId = user?.id || user?.email || 'anon';

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', 'ia-vendas-preditivas', userId, groupId, empresaId, scopeType],
    queryFn: () => filterInContext('Cliente', {}, 'nome', 1000),
    enabled: contextoValido && canView,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos', 'ia-vendas-preditivas', userId, groupId, empresaId, scopeType],
    queryFn: () => filterInContext('Pedido', {}, '-data_pedido', 500),
    enabled: contextoValido && canView,
  });

  const analisarProbabilidadeRecompra = async () => {
    try {
      assertForecastUiContext({ groupId, empresaId, scopeType });
      if (!canView) throw new Error('Sem permissao para analisar recompra.');
      setAnalisando(true);
      const resultado = buildVendasRecompraSuggestions({ clientes, pedidos });
      setPrevisoes(resultado.previsoes || []);
      await createInContext('LogsIA', {
        tipo_ia: 'IA_Vendas_Preditivas',
        contexto_execucao: 'Comercial',
        entidade_relacionada: 'Cliente',
        resultado: 'Sugestao',
        confianca_ia: 82,
        dados_entrada: { clientes: clientes.length, pedidos: pedidos.length },
        dados_saida: { previsoes: (resultado.previsoes || []).length, modo: resultado.modo },
        empresa_id: scopeType === 'grupo' ? null : empresaId,
        group_id: groupId,
      });
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Sistema',
        usuario_id: user?.id || null,
        empresa_id: scopeType === 'grupo' ? null : empresaId,
        group_id: groupId,
        acao: 'Analise',
        modulo: 'Comercial',
        entidade: 'IA_Vendas_Preditivas',
        descricao: 'Previsao de recompra gerou sugestoes sem criar campanha',
        dados_novos: { previsoes: (resultado.previsoes || []).length, modo: resultado.modo },
        sucesso: true,
        data_hora: new Date().toISOString(),
      });
      toast.success(`Sugestao: ${(resultado.previsoes || []).length} cliente(s) com alta probabilidade.`);
    } catch (error) {
      toast.error(String(error?.message || error));
    } finally {
      setAnalisando(false);
    }
  };

  if (!contextoValido) {
    return (
      <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
        Selecione grupo e empresa para usar a previsao de recompra.
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm">
        Sem permissao para visualizar vendas preditivas.
      </div>
    );
  }

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
      <CardHeader className="border-b bg-white/80">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="w-5 h-5 text-purple-600" />
          IA de Vendas Preditivas
          <Badge variant="outline" className="text-purple-700 border-purple-300">Sugestão</Badge>
        </CardTitle>
        <p className="text-xs text-slate-600 mt-1">
          Clientes com alta probabilidade de recompra (sem campanha automática)
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <Button
          onClick={analisarProbabilidadeRecompra}
          disabled={analisando || !contextoValido}
          className="w-full bg-purple-600 hover:bg-purple-700"
          data-action="IA.VendasPreditivas.analisar"
        >
          {analisando ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Analisando Padrões...
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4 mr-2" />
              Analisar Probabilidade de Recompra
            </>
          )}
        </Button>

        {previsoes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-purple-900">
                {previsoes.length} cliente(s) detectado(s)
              </p>
              <Badge className="bg-purple-600">Alta Conversão</Badge>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {previsoes.map((prev) => {
                const temperaturaConfig = {
                  Quente: { cor: 'red', bgClass: 'bg-red-50', borderClass: 'border-red-300' },
                  Morno: { cor: 'orange', bgClass: 'bg-orange-50', borderClass: 'border-orange-300' },
                  Frio: { cor: 'blue', bgClass: 'bg-blue-50', borderClass: 'border-blue-300' },
                };
                const config = temperaturaConfig[prev.temperatura] || temperaturaConfig.Morno;

                return (
                  <Card key={prev.cliente_id} className={`${config.bgClass} ${config.borderClass}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{prev.cliente_nome}</p>
                          <p className="text-xs text-slate-600">
                            Ciclo médio: {prev.ciclo_medio_dias} dias | Há {prev.dias_desde_ultima} dias sem comprar
                          </p>
                        </div>
                        <Badge className={`bg-${config.cor}-600`}>
                          {prev.probabilidade}%
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-700">
                        <Target className="w-3 h-3" />
                        <span>Ticket Médio: R$ {Number(prev.ticket_medio).toLocaleString('pt-BR')}</span>
                      </div>

                      {(prev.produtos_preferidos || []).length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-slate-600 mb-1">Produtos Preferidos:</p>
                          <div className="flex gap-1 flex-wrap">
                            {prev.produtos_preferidos.map((prod, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {prod.descricao || prod}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button
                        size="sm"
                        className="w-full mt-3"
                        variant="outline"
                        disabled
                        title="Acao ainda nao conectada ao fluxo de campanhas"
                        data-action="IA.VendasPreditivas.campanha.placeholder"
                      >
                        <Zap className="w-4 h-4 mr-1" />
                        Criar Campanha Direcionada
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {previsoes.length === 0 && !analisando && (
          <div className="text-center py-8 text-purple-600">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Clique em &quot;Analisar&quot; para identificar oportunidades</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
