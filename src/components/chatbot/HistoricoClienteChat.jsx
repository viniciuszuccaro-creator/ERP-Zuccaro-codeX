import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Package,
  DollarSign,
  TrendingUp,
  Calendar,
  FileText,
  Phone,
  User
} from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.5 - HISTÓRICO DO CLIENTE NO HUB
 * 
 * Painel lateral com informações contextuais do cliente
 * durante o atendimento
 */
export default function HistoricoClienteChat({ clienteId }) {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const empresaId = empresaAtual?.id;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewHistorico = hasPermission('CRM', 'Atendimento', 'visualizar') ||
    hasPermission('CRM', 'Clientes', 'visualizar') ||
    hasPermission('Comercial', 'Clientes', 'visualizar');

  // Buscar dados do cliente
  const { data: cliente } = useQuery({
    queryKey: ['cliente-chat', clienteId, contextKey],
    queryFn: async () => {
      const clientes = await filterInContext('Cliente', { id: clienteId }, 'nome', 1);
      return clientes[0];
    },
    enabled: !!clienteId && contextoValido && canViewHistorico
  });

  // Buscar pedidos recentes
  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-cliente-chat', clienteId, contextKey],
    queryFn: () => filterInContext('Pedido', { cliente_id: clienteId }, '-data_pedido', 5),
    enabled: !!clienteId && contextoValido && canViewHistorico
  });

  // Buscar conversas anteriores
  const { data: conversasAnteriores = [] } = useQuery({
    queryKey: ['conversas-anteriores', clienteId, contextKey],
    queryFn: () => filterInContext('ConversaOmnicanal', { cliente_id: clienteId, status: 'Resolvida' }, '-data_finalizacao', 10),
    enabled: !!clienteId && contextoValido && canViewHistorico
  });

  if (!clienteId || !cliente) {
    return (
      <Card className="w-full h-full" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
        <CardContent className="p-6 text-center text-slate-400">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Selecione uma conversa para ver o histórico do cliente</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full h-full overflow-auto space-y-4" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
      {/* Informações do Cliente */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4" />
            Informações do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-sm font-semibold">{cliente.nome}</p>
            <p className="text-xs text-slate-600">{cliente.cpf || cliente.cnpj}</p>
          </div>
          
          {cliente.contatos && cliente.contatos.length > 0 && (
            <div className="space-y-1">
              {cliente.contatos.slice(0, 3).map((contato, idx) => (
                <p key={idx} className="text-xs text-slate-600">
                  {contato.tipo}: {contato.valor}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Badge className={
              cliente.status === 'Ativo' ? 'bg-green-600' :
              cliente.status === 'Prospect' ? 'bg-blue-600' :
              'bg-slate-600'
            }>
              {cliente.status}
            </Badge>
            {cliente.classificacao_abc && (
              <Badge variant="outline">{cliente.classificacao_abc}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumo Financeiro */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Resumo Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-600">Compras 12 meses</span>
            <span className="text-sm font-semibold">
              R$ {(cliente.valor_compras_12meses || 0).toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-600">Ticket Médio</span>
            <span className="text-sm font-semibold">
              R$ {(cliente.ticket_medio || 0).toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-600">Pedidos</span>
            <span className="text-sm font-semibold">{cliente.quantidade_pedidos || 0}</span>
          </div>
        </CardContent>
      </Card>

      {/* Pedidos Recentes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="w-4 h-4" />
            Últimos Pedidos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pedidos.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhum pedido</p>
          ) : (
            pedidos.map((pedido) => (
              <div key={pedido.id} className="p-2 bg-slate-50 rounded text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold">{pedido.numero_pedido}</span>
                  <Badge className="text-xs" variant="outline">{pedido.status}</Badge>
                </div>
                <p className="text-slate-600">
                  R$ {pedido.valor_total?.toLocaleString('pt-BR')}
                </p>
                <p className="text-slate-500">
                  {new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Histórico de Conversas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Conversas Anteriores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {conversasAnteriores.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhuma conversa anterior</p>
          ) : (
            conversasAnteriores.slice(0, 5).map((conv) => (
              <div key={conv.id} className="p-2 bg-slate-50 rounded text-xs">
                <div className="flex justify-between items-center mb-1">
                  <Badge className="text-xs">{conv.canal}</Badge>
                  <span className="text-slate-500">
                    {new Date(conv.data_finalizacao).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <p className="text-slate-600 truncate">{conv.intent_principal}</p>
                {conv.score_satisfacao && (
                  <p className="text-slate-500">⭐ {conv.score_satisfacao}/5</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Tags e Assuntos */}
      {cliente.tags && cliente.tags.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {cliente.tags.map((tag, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
