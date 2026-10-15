import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, TrendingUp, Target, Zap } from "lucide-react";

/**
 * V21.6 - IA que sugere o melhor canal de venda por cliente
 * Baseado no histórico de compras e preferências
 */
export default function SugestorCanalInteligente({ clienteId, className = "" }) {
  
  // Buscar histórico do cliente
  const { data: pedidosCliente = [] } = useQuery({
    queryKey: ['pedidos-cliente', clienteId],
    queryFn: () => base44.entities.Pedido.filter({ cliente_id: clienteId }),
    initialData: [],
    enabled: !!clienteId
  });

  // Buscar uso do portal
  const { data: cliente } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: () => base44.entities.Cliente.get(clienteId),
    enabled: !!clienteId
  });

  if (!clienteId || pedidosCliente.length === 0) {
    return null;
  }

  // Analisar padrões
  const analise = pedidosCliente.reduce((acc, p) => {
    const origem = p.origem_pedido || 'Manual';
    if (!acc[origem]) {
      acc[origem] = { count: 0, valorTotal: 0, ultimaCompra: null };
    }
    acc[origem].count++;
    acc[origem].valorTotal += (p.valor_total || 0);
    if (!acc[origem].ultimaCompra || p.data_pedido > acc[origem].ultimaCompra) {
      acc[origem].ultimaCompra = p.data_pedido;
    }
    return acc;
  }, {});

  // Canal preferido (mais usado)
  const canalPreferido = Object.entries(analise)
    .sort((a, b) => b[1].count - a[1].count)[0];

  // Canal mais rentável
  const canalRentavel = Object.entries(analise)
    .sort((a, b) => b[1].valorTotal - a[1].valorTotal)[0];

  // Análise de uso do portal
  const usaPortal = cliente?.uso_portal?.total_acessos > 0;
  const canalSugerido = usaPortal && !canalPreferido?.[0]?.includes('Portal') 
    ? 'Portal' 
    : canalPreferido?.[0];

  // Gerar recomendação IA
  const gerarRecomendacao = () => {
    const insights = [];

    // Insight 1: Canal preferido
    if (canalPreferido) {
      const [canal, dados] = canalPreferido;
      const percentual = (dados.count / pedidosCliente.length) * 100;
      
      insights.push({
        tipo: 'preferencia',
        icone: Target,
        cor: 'blue',
        titulo: 'Canal Preferido',
        texto: `${percentual.toFixed(0)}% dos pedidos via ${canal}`,
        sugestao: `Continue usando ${canal} - cliente tem familiaridade`
      });
    }

    // Insight 2: Canal mais rentável
    if (canalRentavel && canalRentavel[0] !== canalPreferido?.[0]) {
      const [canal, dados] = canalRentavel;
      const ticketMedio = dados.valorTotal / dados.count;
      
      insights.push({
        tipo: 'rentavel',
        icone: TrendingUp,
        cor: 'green',
        titulo: 'Maior Ticket Médio',
        texto: `${canal}: R$ ${ticketMedio.toFixed(2)}`,
        sugestao: `Incentive vendas via ${canal} para maior valor`
      });
    }

    // Insight 3: Oportunidade Portal
    if (usaPortal && !canalPreferido?.[0]?.includes('Portal')) {
      insights.push({
        tipo: 'oportunidade',
        icone: Zap,
        cor: 'purple',
        titulo: 'Oportunidade: Portal',
        texto: `Cliente acessa portal (${cliente.uso_portal.total_acessos} vezes)`,
        sugestao: `Ative auto-pedido no portal para este cliente`
      });
    }

    // Insight 4: Multi-canal
    const canaisUsados = Object.keys(analise).length;
    if (canaisUsados >= 3) {
      insights.push({
        tipo: 'multicanal',
        icone: Sparkles,
        cor: 'orange',
        titulo: 'Cliente Multi-canal',
        texto: `Usa ${canaisUsados} canais diferentes`,
        sugestao: `Cliente avançado - ofereça todos os canais`
      });
    }

    return insights;
  };

  const insights = gerarRecomendacao();

  if (insights.length === 0) {
    return null;
  }

  const coresClasse = {
    blue: 'border-blue-300 bg-blue-50',
    green: 'border-green-300 bg-green-50',
    purple: 'border-sky-300 bg-sky-50',
    orange: 'border-orange-300 bg-orange-50'
  };

  const coresBadge = {
    blue: 'bg-blue-600 text-white',
    green: 'bg-green-600 text-white',
    purple: 'bg-sky-600 text-white',
    orange: 'bg-orange-600 text-white'
  };

  return (
    <Card className={`border-sky-300 bg-gradient-to-r from-sky-50 to-blue-50 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-5 h-5 text-sky-600 animate-pulse" />
          💡 IA: Sugestões de Canal de Venda
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, idx) => {
          const Icone = insight.icone;
          return (
            <Alert 
              key={idx} 
              className={`${coresClasse[insight.cor]} border-2`}
            >
              <Icone className={`w-4 h-4 text-${insight.cor}-600`} />
              <AlertDescription>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-slate-900 mb-1">
                      {insight.titulo}
                    </p>
                    <p className="text-xs text-slate-700 mb-2">
                      {insight.texto}
                    </p>
                    <p className="text-xs text-slate-600 italic">
                      💡 {insight.sugestao}
                    </p>
                  </div>
                  <Badge className={coresBadge[insight.cor]}>
                    IA
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          );
        })}

        <div className="text-xs text-slate-500 text-center pt-2 border-t">
          🤖 Análise baseada em {pedidosCliente.length} pedido(s) do cliente
        </div>
      </CardContent>
    </Card>
  );
}