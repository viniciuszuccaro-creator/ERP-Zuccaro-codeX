import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, TrendingDown, DollarSign, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

export default function IAPriceBrain({ tabelaPrecoId, produtoId, onSugestaoAplicada }) {
  const [analisando, setAnalisando] = React.useState(false);
  const [sugestoes, setSugestoes] = React.useState(null);
  const queryClient = useQueryClient();
  const { contexto, empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const grupoAtivoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem('group_atual_id'); } catch { return null; }
  })();
  const empresaAtivaId = contexto === 'grupo' ? null : empresaAtual?.id;
  const contextoValido = !!(empresaAtivaId || grupoAtivoId);

  const { data: produto } = useQuery({
    queryKey: ['produto', produtoId],
    queryFn: () => filterInContext('Produto', { id: produtoId }, undefined, 1),
    enabled: !!produtoId && contextoValido,
    select: (data) => data[0]
  });

  const { data: tabelaPreco } = useQuery({
    queryKey: ['tabelaPreco', tabelaPrecoId],
    queryFn: () => filterInContext('TabelaPreco', { id: tabelaPrecoId }, undefined, 1),
    enabled: !!tabelaPrecoId && contextoValido,
    select: (data) => data[0]
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos'],
    queryFn: () => filterInContext('Pedido', {}, '-created_date', 100),
    enabled: contextoValido,
  });

  const analisarPrecoMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido) {
        throw new Error('Selecione um grupo ou empresa antes de analisar preco com IA.');
      }

      setAnalisando(true);
      
      const custoMedio = produto?.custo_medio || 0;
      const precoAtual = produto?.preco_venda || 0;
      const margemAtual = custoMedio > 0 ? ((precoAtual - custoMedio) / custoMedio * 100) : 0;
      const margemMinima = produto?.margem_minima_percentual || 10;
      
      // Calcular curva de vendas
      const vendasProduto = pedidos
        .filter(p => p.itens_revenda?.some(i => i.produto_id === produtoId))
        .slice(0, 30);
      
      const totalVendido = vendasProduto.reduce((sum, p) => {
        const item = p.itens_revenda.find(i => i.produto_id === produtoId);
        return sum + (item?.quantidade || 0);
      }, 0);

      const prompt = `
        Analise os dados de precificaÃ§Ã£o do produto e sugira o preÃ§o ideal:
        - Produto: ${produto?.descricao}
        - Custo MÃ©dio: R$ ${custoMedio.toFixed(2)}
        - PreÃ§o Atual: R$ ${precoAtual.toFixed(2)}
        - Margem Atual: ${margemAtual.toFixed(2)}%
        - Margem MÃ­nima Desejada: ${margemMinima}%
        - Total Vendido (Ãºltimos 30 pedidos): ${totalVendido} unidades
        
        Sugira:
        1. PreÃ§o ideal para manter margem mÃ­nima
        2. PreÃ§o competitivo baseado na curva de vendas
        3. Oportunidades de aumento de preÃ§o (se margem estÃ¡ muito alta e vendas estÃ¡veis)
        4. Alertas se margem estÃ¡ abaixo do mÃ­nimo
      `;

      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt,
        group_id: grupoAtivoId,
        empresa_id: empresaAtivaId,
        response_json_schema: {
          type: 'object',
          properties: {
            preco_sugerido_minimo: { type: 'number' },
            preco_sugerido_ideal: { type: 'number' },
            preco_sugerido_competitivo: { type: 'number' },
            justificativa: { type: 'string' },
            alertas: { type: 'array', items: { type: 'string' } },
            oportunidades: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      await base44.entities.LogsIA.create({
        tipo_ia: 'IA_PriceBrain',
        contexto_execucao: 'Comercial',
        entidade_relacionada: 'Produto',
        entidade_id: produtoId,
        acao_sugerida: `AnÃ¡lise de precificaÃ§Ã£o para ${produto?.descricao}`,
        resultado: 'AutomÃ¡tico',
        confianca_ia: 85,
        dados_entrada: { custo_medio: custoMedio, preco_atual: precoAtual, margem_atual: margemAtual },
        dados_saida: resultado,
        empresa_id: produto?.empresa_id || empresaAtivaId || null,
        group_id: produto?.group_id || grupoAtivoId || null,
      });

      setAnalisando(false);
      setSugestoes(resultado);
      return resultado;
    },
    onError: (error) => {
      setAnalisando(false);
      toast.error(String(error?.message || 'Erro ao analisar preco'));
    }
  });

  const aplicarSugestao = async (precoSugerido) => {
    if (onSugestaoAplicada) {
      onSugestaoAplicada(precoSugerido);
      toast.success('PreÃ§o sugerido aplicado!');
    }
  };

  if (!produto) {
    return <div className="p-4 text-slate-500">Selecione um produto para anÃ¡lise</div>;
  }

  const margemAtual = produto.custo_medio > 0 
    ? ((produto.preco_venda - produto.custo_medio) / produto.custo_medio * 100) 
    : 0;
  const margemBaixa = margemAtual < (produto.margem_minima_percentual || 10);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="w-5 h-5 text-purple-500" />
            AnÃ¡lise Inteligente de PreÃ§o
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-slate-600">Custo MÃ©dio</Label>
              <p className="text-lg font-bold text-slate-900">
                R$ {produto.custo_medio?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div>
              <Label className="text-xs text-slate-600">PreÃ§o Atual</Label>
              <p className="text-lg font-bold text-blue-600">
                R$ {produto.preco_venda?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Margem Atual</Label>
              <p className={`text-lg font-bold ${margemBaixa ? 'text-red-600' : 'text-green-600'}`}>
                {margemAtual.toFixed(2)}%
              </p>
            </div>
          </div>

          {margemBaixa && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">Margem Abaixo do MÃ­nimo</p>
                <p className="text-xs text-red-700">
                  Margem mÃ­nima configurada: {produto.margem_minima_percentual}%
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={() => analisarPrecoMutation.mutate()}
            disabled={analisando || !contextoValido}
            className="w-full bg-purple-600 hover:bg-purple-700"
            data-action="IA.PriceBrain.analisar"
          >
            {analisando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analisando com IA...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Analisar PreÃ§o com IA
              </>
            )}
          </Button>

          {sugestoes && (
            <div className="space-y-3 mt-4 pt-4 border-t">
              <h4 className="font-semibold text-slate-900">SugestÃµes da IA</h4>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-lg p-3 cursor-pointer hover:bg-slate-50" onClick={() => aplicarSugestao(sugestoes.preco_sugerido_minimo)}>
                  <Label className="text-xs text-slate-600">PreÃ§o MÃ­nimo</Label>
                  <p className="text-lg font-bold text-orange-600">R$ {sugestoes.preco_sugerido_minimo?.toFixed(2)}</p>
                </div>
                
                <div className="border rounded-lg p-3 cursor-pointer hover:bg-slate-50 bg-blue-50" onClick={() => aplicarSugestao(sugestoes.preco_sugerido_ideal)}>
                  <Label className="text-xs text-slate-600">PreÃ§o Ideal</Label>
                  <p className="text-lg font-bold text-blue-600">R$ {sugestoes.preco_sugerido_ideal?.toFixed(2)}</p>
                  <Badge className="mt-1 bg-blue-600">Recomendado</Badge>
                </div>
                
                <div className="border rounded-lg p-3 cursor-pointer hover:bg-slate-50" onClick={() => aplicarSugestao(sugestoes.preco_sugerido_competitivo)}>
                  <Label className="text-xs text-slate-600">PreÃ§o Competitivo</Label>
                  <p className="text-lg font-bold text-green-600">R$ {sugestoes.preco_sugerido_competitivo?.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm text-slate-700"><strong>Justificativa:</strong> {sugestoes.justificativa}</p>
              </div>

              {sugestoes.alertas?.length > 0 && (
                <div className="space-y-2">
                  {sugestoes.alertas.map((alerta, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 p-2 rounded">
                      <AlertTriangle className="w-4 h-4 mt-0.5" />
                      {alerta}
                    </div>
                  ))}
                </div>
              )}

              {sugestoes.oportunidades?.length > 0 && (
                <div className="space-y-2">
                  {sugestoes.oportunidades.map((oport, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-green-700 bg-green-50 p-2 rounded">
                      <TrendingUp className="w-4 h-4 mt-0.5" />
                      {oport}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

