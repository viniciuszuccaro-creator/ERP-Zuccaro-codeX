import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, TrendingUp, Brain } from 'lucide-react';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import {
  assertIaUiContext,
  buildRecomendacaoFromPedidos,
  requireIaHumanConfirm,
} from '@/components/lib/iaTransversalPolicy';

/**
 * Motor de Recomendação de Produtos
 * Sugere produtos no contexto; adiciona só com confirmação humana (Gate 16).
 */
export default function MotorRecomendacao({
  clienteId,
  itensAtuais = [],
  onAdicionarProduto,
}) {
  const [recomendacoes, setRecomendacoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [totalPedidosAnteriores, setTotalPedidosAnteriores] = useState(0);
  const [erro, setErro] = useState('');
  const { filterInContext, empresaAtual, grupoAtual, estaNoGrupo } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const scopeType = estaNoGrupo ? 'grupo' : 'empresa';

  useEffect(() => {
    if (clienteId) {
      buscarRecomendacoes();
    }
  }, [clienteId, itensAtuais, groupId, empresaId, scopeType]);

  const buscarRecomendacoes = async () => {
    setCarregando(true);
    setErro('');
    try {
      assertIaUiContext({ groupId, empresaId, scopeType });
      const pedidosAnteriores = await filterInContext('Pedido', {
        cliente_id: clienteId,
      }, '-data_pedido', 10);

      setTotalPedidosAnteriores(pedidosAnteriores.length);
      const base = buildRecomendacaoFromPedidos({
        pedidos: pedidosAnteriores,
        itensAtuais,
        limite: 5,
      });
      const produtosRecomendados = [...(base.recomendacoes || [])];

      if (produtosRecomendados.length > 0) {
        const analiseIA = await base44.integrations.Core.InvokeLLM({
          group_id: groupId,
          empresa_id: scopeType === 'grupo' ? null : empresaId,
          prompt: `
Cliente comprou anteriormente:
${produtosRecomendados.map((p) => `- ${p.descricao} (${p.frequencia}x)`).join('\n')}

Pedido atual tem ${itensAtuais.length} itens.

Sugira qual produto recomendar PRIMEIRO e por quê.
Retorne JSON:
{
  "produto_recomendado": "descrição do produto",
  "razao": "motivo da recomendação",
  "urgencia": "baixa | media | alta"
}
          `,
          response_json_schema: {
            type: 'object',
            properties: {
              produto_recomendado: { type: 'string' },
              razao: { type: 'string' },
              urgencia: { type: 'string' },
            },
          },
        });

        produtosRecomendados[0].razao_ia = analiseIA.razao;
        produtosRecomendados[0].urgencia = analiseIA.urgencia;
      }

      setRecomendacoes(produtosRecomendados);
    } catch (error) {
      console.error('Erro ao buscar recomendações:', error);
      setErro(String(error?.message || 'Falha nas recomendacoes.'));
      setRecomendacoes([]);
    } finally {
      setCarregando(false);
    }
  };

  const handleAdicionar = (rec) => {
    if (!onAdicionarProduto) return;
    if (!requireIaHumanConfirm(`Adicionar "${rec.descricao}" ao pedido conforme sugestao de IA?`)) {
      return;
    }
    onAdicionarProduto(rec);
  };

  if (carregando) {
    return (
      <Card className="border-purple-200 bg-purple-50 w-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
            <p className="text-sm text-purple-900">Analisando histórico...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (erro) {
    return (
      <Card className="border-amber-200 bg-amber-50 w-full">
        <CardContent className="p-4 text-sm text-amber-800">{erro}</CardContent>
      </Card>
    );
  }

  if (recomendacoes.length === 0) return null;

  return (
    <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 w-full">
      <CardHeader className="bg-white/80 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          Recomendações Inteligentes
          <Badge className="ml-auto bg-purple-600 text-white">
            {recomendacoes.length} sugestões
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {recomendacoes.map((rec, idx) => (
          <div
            key={idx}
            className={`p-3 bg-white border-2 rounded-lg ${
              idx === 0 && rec.urgencia === 'alta'
                ? 'border-orange-300 bg-orange-50'
                : 'border-purple-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-semibold text-sm">{rec.descricao}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    Comprou {rec.frequencia}x
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    R$ {rec.ultimo_preco?.toLocaleString('pt-BR')}
                  </Badge>
                </div>
                {rec.razao_ia && (
                  <p className="text-xs text-purple-700 mt-2">
                    {rec.razao_ia}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => handleAdicionar(rec)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>
        ))}

        <div className="pt-2 border-t">
          <p className="text-xs text-center text-purple-600">
            <TrendingUp className="w-3 h-3 inline mr-1" />
            Baseado em {totalPedidosAnteriores} pedidos anteriores (sugestao)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
