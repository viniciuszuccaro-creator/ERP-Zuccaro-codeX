import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Truck, Navigation, Calendar, Clock, Package, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

/**
 * V21.5 - Rastreamento em Tempo Real COMPLETO
 * ✅ Auto-refresh 30s
 * ✅ GPS e QR Code
 * ✅ Barra de progresso visual
 * ✅ Links públicos compartilháveis
 * ✅ Endereço completo
 * ✅ w-full h-full responsivo
 */
export default function RastreamentoRealtime() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Atualiza a cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  const { data: entregas = [], refetch } = useQuery({
    queryKey: ['rastreamento-realtime', currentTime.getTime()],
    queryFn: async () => {
      const user = await base44.auth.me();
      const entregasData = await base44.entities.Entrega.filter(
        { cliente_nome: user.full_name },
        '-data_previsao',
        50
      );
      return entregasData.filter(e => 
        e.status !== 'Entregue' && 
        e.status !== 'Cancelado' && 
        e.status !== 'Aguardando Separação'
      );
    },
    refetchInterval: 30000, // Auto-refresh a cada 30s
  });

  const statusInfo = {
    'Em Separação': { color: 'bg-yellow-100 text-yellow-800', icon: Package, progress: 20 },
    'Pronto para Expedir': { color: 'bg-blue-100 text-blue-800', icon: CheckCircle2, progress: 40 },
    'Saiu para Entrega': { color: 'bg-purple-100 text-purple-800', icon: Truck, progress: 60 },
    'Em Trânsito': { color: 'bg-orange-100 text-orange-800', icon: Navigation, progress: 80 },
  };

  useEffect(() => {
    // Auto-refresh manual trigger
    const autoRefresh = setInterval(() => {
      refetch();
    }, 30000);

    // Inscrição em tempo real nas atualizações de Entrega
    let unsubscribe = null;
    try {
      unsubscribe = base44.entities.Entrega.subscribe(() => {
        refetch();
      });
    } catch (error) {
      console.error('[RastreamentoRealtime] Falha ao assinar atualizacoes da entrega', error);
    }

    return () => {
      clearInterval(autoRefresh);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [refetch]);

  return (
    <div className="space-y-6 w-full h-full">
      {/* Header com Atualização em Tempo Real */}
      <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">Rastreamento em Tempo Real</h2>
              <p className="text-blue-100 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Última atualização: {currentTime.toLocaleTimeString('pt-BR')}
              </p>
            </div>
            <Button
              onClick={() => refetch()}
              variant="secondary"
              size="sm"
              className="bg-white text-blue-600 hover:bg-blue-50"
            >
              Atualizar Agora
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Entregas em Andamento */}
      <div className="grid gap-6 w-full">
        {entregas.map((entrega) => {
          const statusDetail = statusInfo[entrega.status] || { 
            color: 'bg-gray-100 text-gray-800', 
            icon: Truck, 
            progress: 50 
          };
          const StatusIcon = statusDetail.icon;

          return (
            <Card key={entrega.id} className="border-2 border-blue-200 hover:shadow-2xl transition-all">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                      <StatusIcon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Pedido {entrega.numero_pedido}</CardTitle>
                      <p className="text-sm text-slate-600 mt-1">
                        {entrega.motorista && `Motorista: ${entrega.motorista}`}
                        {entrega.placa && ` • Placa: ${entrega.placa}`}
                      </p>
                    </div>
                  </div>
                  <Badge className={`${statusDetail.color} text-sm px-3 py-1`}>
                    {entrega.status}
                  </Badge>
                </div>

                {/* Barra de Progresso */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-600">Progresso da Entrega</span>
                    <span className="font-bold text-blue-600">{statusDetail.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${statusDetail.progress}%` }}
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                {/* Informações de Entrega */}
                {entrega.data_previsao && (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                    <Calendar className="w-6 h-6 text-blue-600" />
                    <div>
                      <p className="text-sm text-blue-900 font-medium">Previsão de Entrega</p>
                      <p className="text-lg font-bold text-blue-700">
                        {format(new Date(entrega.data_previsao), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>
                )}

                {/* QR Code */}
                {entrega.qr_code && (
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg">
                    <p className="text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      QR Code de Rastreamento
                    </p>
                    <p className="font-mono text-sm bg-white px-4 py-2 rounded border border-purple-300 inline-block">
                      {entrega.qr_code}
                    </p>
                  </div>
                )}

                {/* Código de Rastreamento da Transportadora */}
                {entrega.codigo_rastreamento && (
                  <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <p className="text-sm font-bold text-green-900 mb-2">Código Transportadora</p>
                    <p className="font-mono text-lg font-bold text-green-700">{entrega.codigo_rastreamento}</p>
                  </div>
                )}

                {/* Endereço de Entrega */}
                {entrega.endereco_entrega_completo && (
                  <div className="p-4 bg-slate-50 rounded-lg border">
                    <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Endereço de Entrega
                    </p>
                    <p className="text-sm font-medium">{entrega.endereco_entrega_completo.logradouro}, {entrega.endereco_entrega_completo.numero}</p>
                    <p className="text-sm text-slate-600">{entrega.endereco_entrega_completo.complemento}</p>
                    <p className="text-sm text-slate-600">
                      {entrega.endereco_entrega_completo.bairro} - {entrega.endereco_entrega_completo.cidade}/{entrega.endereco_entrega_completo.estado}
                    </p>
                    <p className="text-sm text-slate-600">CEP: {entrega.endereco_entrega_completo.cep}</p>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  {entrega.link_rastreamento && (
                    <Button
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      onClick={() => window.open(entrega.link_rastreamento, '_blank')}
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      Ver no Mapa (GPS)
                    </Button>
                  )}
                  {entrega.link_publico_rastreamento && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        navigator.clipboard.writeText(entrega.link_publico_rastreamento);
                        alert('Link de rastreamento copiado!');
                      }}
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      Copiar Link
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {entregas.length === 0 && (
          <Card>
            <CardContent className="p-16 text-center">
              <Truck className="w-20 h-20 text-slate-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-slate-600">Nenhuma entrega em andamento</p>
              <p className="text-sm text-slate-500 mt-2">
                Quando houver entregas em trânsito, você poderá rastreá-las aqui em tempo real
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Legenda de Status */}
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm">Legenda de Status</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <span>Em Separação</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span>Pronto</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full" />
              <span>Saiu</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full" />
              <span>Em Trânsito</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
