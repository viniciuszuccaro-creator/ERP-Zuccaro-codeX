import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, Package, MapPin, Calendar, ExternalLink } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

/**
 * V21.1.2: Painel de Entregas do Pedido - WINDOW MODE READY
 * Mostra todas as entregas vinculadas a um pedido
 */
export default function PainelEntregasPedido({ pedidoId, windowMode = false }) {
  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ['entregas-pedido', pedidoId],
    queryFn: async () => {
      const todas = await base44.entities.Entrega.list('-created_date');
      return todas.filter(e => e.pedido_id === pedidoId);
    },
    enabled: !!pedidoId,
  });

  const statusColors = {
    'Aguardando Separação': 'bg-yellow-100 text-yellow-700',
    'Em Separação': 'bg-blue-100 text-blue-700',
    'Pronto para Expedir': 'bg-sky-100 text-sky-700',
    'Saiu para Entrega': 'bg-orange-100 text-orange-700',
    'Em Trânsito': 'bg-cyan-100 text-cyan-700',
    'Entregue': 'bg-green-100 text-green-700',
    'Entrega Frustrada': 'bg-red-100 text-red-700'
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-slate-500">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Carregando entregas...</p>
        </CardContent>
      </Card>
    );
  }

  const content = (
    <div className={`space-y-4 ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}>
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-600" />
          Entregas ({entregas.length})
        </h3>
        <Link to={createPageUrl("Expedicao")}>
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            Ver Expedição
          </Button>
        </Link>
      </div>

      {entregas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma entrega criada para este pedido</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entregas.map(entrega => (
            <Card key={entrega.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-slate-900">
                        {entrega.numero_pedido || 'Sem número'}
                      </p>
                      {entrega.qr_code && (
                        <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">
                          {entrega.qr_code}
                        </code>
                      )}
                    </div>
                  </div>
                  <Badge className={statusColors[entrega.status] || 'bg-slate-100 text-slate-700'}>
                    {entrega.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-slate-600 text-xs">Destino</p>
                      <p className="font-medium text-slate-900">
                        {entrega.endereco_entrega_completo?.cidade}/{entrega.endereco_entrega_completo?.estado}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-slate-600 text-xs">Previsão</p>
                      <p className="font-medium text-slate-900">
                        {entrega.data_previsao 
                          ? new Date(entrega.data_previsao).toLocaleDateString('pt-BR') 
                          : 'Não definida'}
                      </p>
                    </div>
                  </div>
                </div>

                {entrega.transportadora && (
                  <p className="text-xs text-slate-600 mt-2">
                    <strong>Transportadora:</strong> {entrega.transportadora}
                  </p>
                )}

                {entrega.data_entrega && (
                  <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
                    <p className="text-sm text-green-900">
                      ✅ Entregue em {new Date(entrega.data_entrega).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white">{content}</div>;
  }

  return content;
}