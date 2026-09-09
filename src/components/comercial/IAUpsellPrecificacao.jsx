import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Target, Brain } from 'lucide-react';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import {
  assertIaUiContext,
  buildUpsellSuggestions,
} from '@/components/lib/iaTransversalPolicy';

/**
 * IA de Upsell e Precificação Dinâmica
 * Analisa histórico no contexto e apenas sugere (Gate 16).
 */
export default function IAUpsellPrecificacao({ clienteId, pedidoAtual }) {
  const [sugestoes, setSugestoes] = useState([]);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState('');
  const { filterInContext, empresaAtual, grupoAtual, estaNoGrupo } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const scopeType = estaNoGrupo ? 'grupo' : 'empresa';

  useEffect(() => {
    if (!clienteId) return;
    analisarCliente();
  }, [clienteId, groupId, empresaId, scopeType]);

  const analisarCliente = async () => {
    setAnalisando(true);
    setErro('');
    try {
      assertIaUiContext({ groupId, empresaId, scopeType });
      const pedidosAnteriores = await filterInContext('Pedido', {
        cliente_id: clienteId,
        status: 'Entregue',
      }, '-data_pedido', 20);

      const resultado = buildUpsellSuggestions({
        pedidos: pedidosAnteriores,
        pedidoAtual,
      });
      setSugestoes((resultado.sugestoes || []).map((sug) => ({
        ...sug,
        icone: sug.tipo === 'reposicao' ? Target : sug.tipo === 'precificacao' ? TrendingUp : Sparkles,
        cor: sug.tipo === 'reposicao' ? 'green' : sug.tipo === 'precificacao' ? 'blue' : 'purple',
      })));
    } catch (error) {
      console.error('Erro ao analisar cliente:', error);
      setErro(String(error?.message || 'Falha na analise de upsell.'));
      setSugestoes([]);
    } finally {
      setAnalisando(false);
    }
  };

  if (!clienteId) return null;

  return (
    <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-blue-50 w-full">
      <CardHeader className="border-b bg-white/80">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="w-5 h-5 text-purple-600" />
          Assistente Inteligente
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {erro ? (
          <p className="text-sm text-amber-700">{erro}</p>
        ) : analisando ? (
          <div className="text-center py-8 text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
            <p className="text-sm">Analisando histórico do cliente...</p>
          </div>
        ) : sugestoes.length > 0 ? (
          <div className="space-y-3">
            {sugestoes.map((sug, idx) => {
              const Icon = sug.icone;
              const corClasses = {
                green: 'bg-green-50 border-green-200 text-green-900',
                blue: 'bg-blue-50 border-blue-200 text-blue-900',
                purple: 'bg-purple-50 border-purple-200 text-purple-900',
              };

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${corClasses[sug.cor]}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{sug.titulo}</p>
                        <Badge variant="outline" className="text-xs">
                          {sug.prioridade}
                        </Badge>
                      </div>
                      <p className="text-sm mt-1">{sug.descricao}</p>
                      <Button size="sm" className="mt-3" variant="outline" type="button" disabled>
                        {sug.acao} (sugestao)
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">Nenhuma sugestão no momento</p>
        )}
      </CardContent>
    </Card>
  );
}
