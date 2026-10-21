import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  CreditCard,
  Package,
  Star,
  DollarSign,
  Target,
  Brain
} from 'lucide-react';

/**
 * Assistente Inteligente - Comercial
 * Analisa contexto e sugere ações proativas
 */
export default function AssistenteInteligente({ pedido, cliente }) {
  const [sugestoes, setSugestoes] = useState([]);
  const [sugestoesDispensadas, setSugestoesDispensadas] = useState([]);

  useEffect(() => {
    if (cliente && pedido) {
      analisarContexto();
    }
  }, [cliente, pedido]);

  const analisarContexto = () => {
    const novasSugestoes = [];

    // SUGESTÃO 1: Limite de Crédito
    if (cliente?.condicao_comercial) {
      const { limite_credito, limite_credito_utilizado } = cliente.condicao_comercial;
      const limiteDisponivel = (limite_credito || 0) - (limite_credito_utilizado || 0);
      const percentualUso = limite_credito > 0 
        ? (limite_credito_utilizado / limite_credito) * 100 
        : 0;

      if (percentualUso >= 90 && pedido.valor_total > limiteDisponivel) {
        novasSugestoes.push({
          tipo: 'urgente',
          icone: AlertTriangle,
          titulo: 'Limite de Crédito Excedido',
          descricao: `Cliente usando ${percentualUso.toFixed(0)}% do limite. Pedido excede crédito disponível (R$ ${limiteDisponivel.toLocaleString('pt-BR')}).`,
          acao: 'Solicitar aprovação especial',
          prioridade: 'alta'
        });
      } else if (percentualUso >= 70) {
        novasSugestoes.push({
          tipo: 'alerta',
          icone: CreditCard,
          titulo: 'Limite de Crédito em Uso',
          descricao: `${percentualUso.toFixed(0)}% do limite em uso. Considerar antecipação de parcelas ou desconto à vista.`,
          acao: 'Verificar situação financeira',
          prioridade: 'media'
        });
      }
    }

    // SUGESTÃO 2: Produto em Estoque Baixo
    const itensRevenda = pedido?.itens_revenda || [];
    itensRevenda.forEach(item => {
      if (item.estoque_disponivel !== undefined && item.estoque_disponivel < item.quantidade) {
        novasSugestoes.push({
          tipo: 'alerta',
          icone: Package,
          titulo: 'Estoque Insuficiente',
          descricao: `${item.descricao}: apenas ${item.estoque_disponivel} disponível (pedido: ${item.quantidade}).`,
          acao: 'Reservar ou solicitar compra',
          prioridade: 'media'
        });
      }
    });

    // SUGESTÃO 3: Cliente Inativo
    const diasSemComprar = cliente?.dias_sem_comprar || 0;
    if (diasSemComprar > 60) {
      novasSugestoes.push({
        tipo: 'info',
        icone: TrendingUp,
        titulo: 'Cliente Voltando a Comprar',
        descricao: `Cliente sem comprar há ${diasSemComprar} dias. Oportunidade de fidelização.`,
        acao: 'Oferecer desconto reativação',
        prioridade: 'baixa'
      });
    }

    // SUGESTÃO 4: Produto Complementar (Cross-sell)
    const contemBitola = itensRevenda.some(i => i.descricao?.toLowerCase().includes('bitola'));
    if (contemBitola && !itensRevenda.some(i => i.descricao?.toLowerCase().includes('arame'))) {
      novasSugestoes.push({
        tipo: 'info',
        icone: Sparkles,
        titulo: 'Produto Complementar',
        descricao: 'Cliente está comprando bitola. Sugerir arame recozido para amarração?',
        acao: 'Adicionar arame recozido',
        prioridade: 'baixa'
      });
    }

    // SUGESTÃO 5: Margem Baixa
    if (pedido?.margem_total_percentual && pedido.margem_total_percentual < 15) {
      novasSugestoes.push({
        tipo: 'alerta',
        icone: DollarSign,
        titulo: 'Margem Abaixo do Ideal',
        descricao: `Margem atual: ${pedido.margem_total_percentual.toFixed(1)}%. Ideal: 20-25%.`,
        acao: 'Revisar preços',
        prioridade: 'media'
      });
    }

    // SUGESTÃO 6: Cliente VIP
    if (cliente?.classificacao_abc === 'A' && cliente?.score_pagamento >= 95) {
      novasSugestoes.push({
        tipo: 'success',
        icone: Star,
        titulo: 'Cliente VIP - Classe A',
        descricao: `Score de pagamento: ${cliente.score_pagamento}. Priorizar atendimento e aprovação.`,
        acao: 'Aprovação express',
        prioridade: 'baixa'
      });
    }

    setSugestoes(novasSugestoes.filter(s => !sugestoesDispensadas.includes(s.titulo)));
  };

  const dispensarSugestao = (titulo) => {
    setSugestoesDispensadas([...sugestoesDispensadas, titulo]);
    setSugestoes(sugestoes.filter(s => s.titulo !== titulo));
  };

  const executarAcao = (sugestao) => {
    console.log('Executar ação:', sugestao.acao);
  };

  if (sugestoes.length === 0) {
    return (
      <div className="fixed bottom-6 right-6 z-40">
        <Badge className="bg-green-600 text-white flex items-center gap-2 px-4 py-2 shadow-lg">
          <Brain className="w-4 h-4 animate-pulse" />
          Assistente IA: {sugestoesDispensadas.length} sugestão(ões) dispensada(s)
        </Badge>
      </div>
    );
  }

  const corPorTipo = {
    urgente: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-900' },
    alerta: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-900' },
    info: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-900' },
    success: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-900' }
  };

  return (
    <div className="fixed bottom-6 right-6 w-96 max-h-[600px] overflow-y-auto z-40 space-y-3">
      {sugestoes.map((sugestao, idx) => {
        const cores = corPorTipo[sugestao.tipo];
        const Icon = sugestao.icone;

        return (
          <Card key={idx} className={`${cores.border} ${cores.bg} shadow-lg`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 mt-0.5 ${cores.text.replace('text-', 'text-')}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`font-semibold text-sm ${cores.text}`}>
                      {sugestao.titulo}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {sugestao.prioridade}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-700 mb-3">
                    {sugestao.descricao}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => executarAcao(sugestao)}
                      variant="outline"
                    >
                      {sugestao.acao}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dispensarSugestao(sugestao.titulo)}
                      className="text-xs"
                    >
                      Dispensar
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Badge className="bg-sky-600 text-white w-full flex items-center justify-center gap-2 px-4 py-3 shadow-lg">
        <Brain className="w-4 h-4 animate-pulse" />
        Assistente IA Ativo • {sugestoes.length} sugestão(ões)
      </Badge>
    </div>
  );
}
