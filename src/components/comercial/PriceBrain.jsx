import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingDown, TrendingUp, Zap, Sparkles, Lightbulb, Brain } from 'lucide-react';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import { useUser } from '@/components/lib/UserContext';
import {
  assertIaUiContext,
  requireIaHumanConfirm,
  stampIaSuggestion,
} from '@/components/lib/iaTransversalPolicy';

export default function PriceBrain({ pedido, onSugestaoAplicada }) {
  const [analisando, setAnalisando] = useState(false);
  const [sugestao, setSugestao] = useState(null);
  const [erro, setErro] = useState('');
  const { filterInContext, createInContext, empresaAtual, grupoAtual, estaNoGrupo } = useContextoVisual();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || pedido?.group_id || null;
  const empresaId = empresaAtual?.id || pedido?.empresa_id || null;
  const scopeType = estaNoGrupo ? 'grupo' : 'empresa';

  useEffect(() => {
    if (pedido?.cliente_id && (pedido.itens_revenda?.length > 0 || pedido.itens_producao?.length > 0)) {
      analisarPrecos();
    }
  }, [pedido?.cliente_id, groupId, empresaId]);

  const analisarPrecos = async () => {
    setAnalisando(true);
    setErro('');
    try {
      assertIaUiContext({ groupId, empresaId, scopeType });

      const pedidosCliente = await filterInContext('Pedido', {
        cliente_id: pedido.cliente_id,
      }, '-data_pedido', 10);

      const ticketMedioCliente = pedidosCliente.length > 0
        ? pedidosCliente.reduce((sum, p) => sum + (p.valor_total || 0), 0) / pedidosCliente.length
        : 0;

      const ultimaCompra = pedidosCliente[0];

      const analise = await base44.integrations.Core.InvokeLLM({
        group_id: groupId,
        empresa_id: scopeType === 'grupo' ? null : empresaId,
        prompt: `
Você é o PriceBrain - IA especialista em precificação dinâmica para ERPs industriais.
Apenas SUGIRA. Nao execute desconto sozinho.

DADOS DO PEDIDO ATUAL:
- Cliente: ${pedido.cliente_nome}
- Valor Atual: R$ ${pedido.valor_total?.toLocaleString('pt-BR')}
- Itens: ${(pedido.itens_revenda?.length || 0) + (pedido.itens_producao?.length || 0)}
- Forma Pagamento: ${pedido.forma_pagamento || 'Não definida'}

HISTÓRICO DO CLIENTE:
- Total de Pedidos: ${pedidosCliente.length}
- Ticket Médio: R$ ${ticketMedioCliente.toLocaleString('pt-BR')}
- Última Compra: ${ultimaCompra ? `R$ ${ultimaCompra.valor_total?.toLocaleString('pt-BR')} em ${new Date(ultimaCompra.data_pedido).toLocaleDateString('pt-BR')}` : 'Nenhuma'}

RETORNE em JSON:
{
  "estrategia": "desconto_rapido | upsell | fidelizacao | manter_preco",
  "razao": "explicação breve",
  "desconto_sugerido_percentual": number (0-15),
  "valor_com_desconto": number,
  "produtos_upsell": ["produto1", "produto2"],
  "condicao_especial": "string",
  "confianca": number (0-100)
}
        `,
        response_json_schema: {
          type: 'object',
          properties: {
            estrategia: { type: 'string' },
            razao: { type: 'string' },
            desconto_sugerido_percentual: { type: 'number' },
            valor_com_desconto: { type: 'number' },
            produtos_upsell: { type: 'array', items: { type: 'string' } },
            condicao_especial: { type: 'string' },
            confianca: { type: 'number' },
          },
        },
      });

      const stamped = stampIaSuggestion(analise);
      setSugestao(stamped);

      await createInContext('AuditoriaIA', {
        group_id: groupId,
        empresa_id: scopeType === 'grupo' ? null : empresaId,
        modulo: 'Comercial',
        funcionalidade: 'PriceBrain',
        usuario_id: user?.id || null,
        usuario_nome: user?.full_name || user?.email || 'Usuario',
        data_hora: new Date().toISOString(),
        input_dados: {
          cliente_id: pedido.cliente_id,
          valor_pedido: pedido.valor_total,
          historico: { pedidos: pedidosCliente.length, ticket_medio: ticketMedioCliente },
          modo: 'sugestao',
        },
        output_resultado: stamped,
        confianca_percentual: stamped.confianca,
        status: 'Sugestao',
      });
    } catch (error) {
      console.error('Erro ao analisar preços:', error);
      setErro(String(error?.message || 'Falha no PriceBrain.'));
      setSugestao(null);
    } finally {
      setAnalisando(false);
    }
  };

  const aplicarSugestao = () => {
    if (!sugestao || !onSugestaoAplicada) return;
    if (!requireIaHumanConfirm(
      `Aplicar desconto sugerido de ${sugestao.desconto_sugerido_percentual}% (R$ ${Number(sugestao.valor_com_desconto || 0).toLocaleString('pt-BR')})?`,
    )) {
      return;
    }

    const novoValor = sugestao.valor_com_desconto;
    const descontoPercentual = sugestao.desconto_sugerido_percentual;

    onSugestaoAplicada({
      ...pedido,
      valor_total: novoValor,
      desconto_geral_pedido_percentual: descontoPercentual,
      desconto_geral_pedido_valor: pedido.valor_total - novoValor,
      observacoes_internas: `${pedido.observacoes_internas || ''}\n\nPriceBrain (confirmado): ${sugestao.razao} (${sugestao.condicao_especial})`,
    });

    setSugestao(null);
  };

  if (analisando) {
    return (
      <Card className="border-purple-200 bg-purple-50 w-full">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            <p className="text-sm text-purple-900">
              <Brain className="w-4 h-4 inline mr-1" />
              PriceBrain analisando histórico (apenas sugestao)...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (erro) {
    return (
      <Alert className="border-amber-200 bg-amber-50">
        <AlertDescription className="text-amber-800 text-sm">{erro}</AlertDescription>
      </Alert>
    );
  }

  if (!sugestao) return null;

  const estrategiaConfig = {
    desconto_rapido: {
      cor: 'green',
      icone: TrendingDown,
      titulo: 'Desconto para Fechamento Rápido',
    },
    upsell: {
      cor: 'blue',
      icone: TrendingUp,
      titulo: 'Oportunidade de Upsell',
    },
    fidelizacao: {
      cor: 'purple',
      icone: Sparkles,
      titulo: 'Fidelização',
    },
    manter_preco: {
      cor: 'slate',
      icone: Lightbulb,
      titulo: 'Manter Preço',
    },
  };

  const cfg = estrategiaConfig[sugestao.estrategia] || estrategiaConfig.manter_preco;
  const Icon = cfg.icone;

  return (
    <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-blue-50 w-full">
      <CardHeader className="bg-white/80 border-b pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-600" />
          PriceBrain
          <Badge variant="outline" className="ml-auto text-xs">
            Confiança {sugestao.confianca || 0}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Icon className="w-5 h-5 mt-0.5 text-purple-700" />
          <div className="flex-1">
            <p className="font-semibold text-sm">{cfg.titulo}</p>
            <p className="text-sm text-slate-700 mt-1">{sugestao.razao}</p>
            {sugestao.desconto_sugerido_percentual > 0 && (
              <p className="text-sm mt-2 font-medium text-green-700">
                Desconto sugerido: {sugestao.desconto_sugerido_percentual}% → R${' '}
                {Number(sugestao.valor_com_desconto || 0).toLocaleString('pt-BR')}
              </p>
            )}
            {sugestao.condicao_especial && (
              <p className="text-xs text-slate-500 mt-1">{sugestao.condicao_especial}</p>
            )}
          </div>
        </div>
        {onSugestaoAplicada && sugestao.desconto_sugerido_percentual > 0 && (
          <Button type="button" className="w-full" onClick={aplicarSugestao}>
            Aplicar sugestão (confirmação)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
