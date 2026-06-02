import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Truck, 
  Package, 
  MapPin, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Navigation,
  Calendar,
  Phone
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

const isSafeUrl = (value) => {
  try {
    const url = new URL(String(value || ''));
    return ['https:', 'http:'].includes(url.protocol);
  } catch {
    return false;
  }
};

/**
 * V21.6 - CONSULTAR ENTREGAS NO CHAT
 * 
 * Permite ao atendente:
 * ✅ Ver entregas do cliente
 * ✅ Status em tempo real
 * ✅ Timeline de rastreamento
 * ✅ Link para acompanhamento
 * ✅ Contato do motorista
 */
export default function ConsultarEntregaChat({ clienteId, conversa }) {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = conversa?.group_id || conversa?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = conversa?.empresa_id || empresaAtual?.id || null;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const podeConsultarEntregas = hasPermission('Expedicao', 'Entregas', 'visualizar')
    || hasPermission('Expedição', 'Entregas', 'visualizar')
    || hasPermission('CRM', 'Atendimento', 'visualizar')
    || hasPermission('Comercial', 'Pedidos', 'visualizar');

  // Buscar entregas do cliente
  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ['entregas-cliente', clienteId, contextKey],
    queryFn: async () => {
      if (!clienteId || !contextoValido || !podeConsultarEntregas) return [];
      return await filterInContext('Entrega', {
        cliente_id: clienteId,
        status: { $nin: ['Entregue', 'Cancelado'] }
      }, '-data_previsao');
    },
    enabled: !!clienteId && contextoValido && podeConsultarEntregas
  });

  // Buscar entregas recentes entregues
  const { data: entregasRecentes = [] } = useQuery({
    queryKey: ['entregas-recentes', clienteId, contextKey],
    queryFn: async () => {
      if (!clienteId || !contextoValido || !podeConsultarEntregas) return [];
      const todas = await filterInContext('Entrega', {
        cliente_id: clienteId,
        status: 'Entregue'
      }, '-data_entrega', 5);
      return todas;
    },
    enabled: !!clienteId && contextoValido && podeConsultarEntregas
  });

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const statusConfig = {
    'Aguardando Separação': { cor: 'bg-slate-500', icone: Package },
    'Em Separação': { cor: 'bg-blue-500', icone: Package },
    'Pronto para Expedir': { cor: 'bg-indigo-500', icone: Package },
    'Saiu para Entrega': { cor: 'bg-orange-500', icone: Truck },
    'Em Trânsito': { cor: 'bg-purple-500', icone: Navigation },
    'Entregue': { cor: 'bg-green-500', icone: CheckCircle },
    'Entrega Frustrada': { cor: 'bg-red-500', icone: AlertCircle },
    'Devolvido': { cor: 'bg-red-600', icone: AlertCircle }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <span className="text-sm text-slate-600">Carregando entregas...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="w-full h-full"
      data-permission="Expedicao.Entregas.visualizar"
      data-context-required="group_id|empresa_id"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-blue-900">
            <Truck className="w-5 h-5 text-blue-600" />
            Entregas
          </span>
          {entregas.length > 0 && (
            <Badge className="bg-orange-600">
              {entregas.length} em andamento
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(!contextoValido || !podeConsultarEntregas) && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>
              Selecione grupo/empresa e confirme permissao de entregas ou atendimento para consultar rastreamento.
            </span>
          </div>
        )}

        {entregas.length === 0 && entregasRecentes.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma entrega encontrada</p>
          </div>
        ) : (
          <>
            {/* Entregas em Andamento */}
            {entregas.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">Em Andamento</h4>
                {entregas.map((entrega, idx) => {
                  const config = statusConfig[entrega.status] || statusConfig['Aguardando Separação'];
                  const StatusIcon = config.icone;
                  
                  return (
                    <motion.div
                      key={entrega.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="p-4 bg-white rounded-lg border-2 border-slate-200 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-sm">
                            Pedido {entrega.numero_pedido}
                          </p>
                          <Badge className={`${config.cor} mt-1`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {entrega.status}
                          </Badge>
                        </div>
                        {entrega.data_previsao && (
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Previsão</p>
                            <p className="text-sm font-semibold text-blue-600">
                              {formatarData(entrega.data_previsao)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Endereço */}
                      {entrega.endereco_entrega_completo && (
                        <div className="flex items-start gap-2 mb-3 text-sm text-slate-600">
                          <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            {entrega.endereco_entrega_completo.logradouro}, {entrega.endereco_entrega_completo.numero}
                            {entrega.endereco_entrega_completo.bairro && ` - ${entrega.endereco_entrega_completo.bairro}`}
                          </span>
                        </div>
                      )}

                      {/* Motorista */}
                      {entrega.motorista && (
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-slate-600" />
                            <span className="text-sm">{entrega.motorista}</span>
                          </div>
                          {entrega.motorista_telefone && (
                            <a 
                              href={`tel:${entrega.motorista_telefone}`}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              {entrega.motorista_telefone}
                            </a>
                          )}
                        </div>
                      )}

                      {/* Timeline resumida */}
                      {entrega.historico_status?.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-slate-500 mb-2">Último status:</p>
                          <div className="flex items-center gap-2 text-xs">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>
                              {entrega.historico_status[entrega.historico_status.length - 1]?.observacao || 'Atualização de status'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Link de rastreamento */}
                      {entrega.link_publico_rastreamento && isSafeUrl(entrega.link_publico_rastreamento) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-3"
                          disabled={!contextoValido || !podeConsultarEntregas}
                          data-action="rastrear-entrega-chat"
                          data-permission="Expedicao.Entregas.visualizar"
                          data-context-required="group_id|empresa_id"
                          onClick={() => window.open(entrega.link_publico_rastreamento, '_blank')}
                        >
                          <Navigation className="w-4 h-4 mr-2" />
                          Rastrear Entrega
                        </Button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Entregas Recentes */}
            {entregasRecentes.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-700">Últimas Entregas</h4>
                {entregasRecentes.map(entrega => (
                  <div 
                    key={entrega.id}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium">Pedido {entrega.numero_pedido}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Entregue em</p>
                      <p className="text-sm font-semibold text-green-600">
                        {formatarData(entrega.data_entrega)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
