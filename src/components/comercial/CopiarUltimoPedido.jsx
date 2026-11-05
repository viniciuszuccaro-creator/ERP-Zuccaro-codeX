import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Clock, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  buildCopiarUltimoPedidoQueryKey,
  isCopiarUltimoPedidoScopeCurrent,
  resolveCopiarUltimoPedidoKpiState,
  pickUltimoPedidoNaoCancelado,
} from "./copiarUltimoPedidoScope";

function readCopiarUltimoActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === 'string' ? session.actorId.trim() : '';
  return {
    actorId: actorId || null,
    sessionKey: central360SessionKey(session?.token),
  };
}

/**
 * V21.1.2 - WINDOW MODE READY
 * Convertido para suportar window mode independente
 *
 * Escopo multiempresa: Pedido via filterInContext (sem filter unscoped / $ne).
 * Loading/erro ≠ ausência de último pedido. STALE_SCOPE em resposta tardia.
 */
export default function CopiarUltimoPedido({ clienteId, onCopiar, windowMode = false }) {
  const { toast } = useToast();
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const { actorId, sessionKey } = readCopiarUltimoActorAndSession();
  const contextoValido = Boolean(groupId || empresaId);
  const scopeExpected = { actorId, sessionKey };

  const {
    data: ultimoPedido,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: buildCopiarUltimoPedidoQueryKey({
      clienteId, groupId, empresaId, actorId, sessionKey,
    }),
    queryFn: async ({ signal }) => {
      // Sem $ne no filtro server: lote recente + exclusão Cancelado local (contrato legado).
      const rows = await filterInContext(
        'Pedido',
        { cliente_id: clienteId },
        '-data_pedido',
        20,
      );
      if (signal?.aborted) {
        const err = new Error('COPIAR_ULTIMO_PEDIDO_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isCopiarUltimoPedidoScopeCurrent(scopeExpected, readCopiarUltimoActorAndSession())) {
        throw new Error('COPIAR_ULTIMO_PEDIDO_STALE_SCOPE');
      }
      return pickUltimoPedidoNaoCancelado(rows);
    },
    enabled: Boolean(clienteId) && contextoValido,
  });

  const kpiState = resolveCopiarUltimoPedidoKpiState({
    contextoValido,
    clienteId,
    isLoading,
    isError,
    isFetching,
    dataDefined: ultimoPedido !== undefined,
  });

  if (kpiState === 'unavailable') {
    return null;
  }

  if (kpiState === 'loading') {
    const loading = (
      <div className={windowMode ? 'w-full h-full overflow-auto bg-white p-4' : ''}>
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-600">
            Carregando último pedido do cliente…
          </CardContent>
        </Card>
      </div>
    );
    return loading;
  }

  if (kpiState === 'error') {
    return (
      <div className={windowMode ? 'w-full h-full overflow-auto bg-white p-4' : ''}>
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            Não foi possível carregar o último pedido (erro ≠ ausência).
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ultimoPedido) return null;

  const diasDesdeUltimo = Math.floor(
    (new Date() - new Date(ultimoPedido.data_pedido)) / (1000 * 60 * 60 * 24)
  );

  const copiarPedido = () => {
    const pedidoCopiado = {
      // Copiar dados do cliente
      cliente_id: ultimoPedido.cliente_id,
      cliente_nome: ultimoPedido.cliente_nome,
      cliente_cpf_cnpj: ultimoPedido.cliente_cpf_cnpj,
      vendedor: ultimoPedido.vendedor,
      vendedor_id: ultimoPedido.vendedor_id,
      
      // Copiar endereço
      endereco_entrega_principal: ultimoPedido.endereco_entrega_principal,
      
      // Copiar itens
      itens_revenda: ultimoPedido.itens_revenda?.map(item => ({
        ...item,
        // Limpar IDs
        id: undefined
      })),
      
      // Copiar condições comerciais
      condicao_pagamento: ultimoPedido.condicao_pagamento,
      forma_pagamento: ultimoPedido.forma_pagamento,
      tabela_preco: ultimoPedido.tabela_preco,
      tabela_preco_id: ultimoPedido.tabela_preco_id,
      
      // Copiar frete
      tipo_frete: ultimoPedido.tipo_frete,
      transportadora: ultimoPedido.transportadora,
      transportadora_id: ultimoPedido.transportadora_id,
      
      // Novos dados
      numero_pedido: `CÓPIA-${ultimoPedido.numero_pedido}`,
      data_pedido: new Date().toISOString().split('T')[0],
      status: 'Rascunho',
      observacoes_publicas: `Cópia do pedido ${ultimoPedido.numero_pedido}`,
      
      // Recalcular valores
      valor_produtos: ultimoPedido.valor_produtos,
      valor_total: ultimoPedido.valor_total
    };

    if (onCopiar) {
      onCopiar(pedidoCopiado);
      
      toast({
        title: "✅ Pedido Copiado!",
        description: `${ultimoPedido.itens_revenda?.length || 0} itens copiados do pedido ${ultimoPedido.numero_pedido}`,
      });
    }
  };

  const content = (
    <div className={windowMode ? 'w-full h-full overflow-auto bg-white p-4' : ''}>
      <Card className={windowMode ? 'border shadow-sm' : 'border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50'}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">
                Repetir Último Pedido
              </h4>
              <div className="flex gap-2 text-xs text-slate-600">
                <span>Pedido {ultimoPedido.numero_pedido}</span>
                <span>•</span>
                <span>há {diasDesdeUltimo} dias</span>
              </div>
            </div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Confirmar Cópia do Pedido</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Informações do Pedido Original */}
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600 mb-1">Pedido Original</p>
                        <p className="font-semibold">{ultimoPedido.numero_pedido}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 mb-1">Data</p>
                        <p className="font-semibold">
                          {new Date(ultimoPedido.data_pedido).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 mb-1">Status</p>
                        <Badge>{ultimoPedido.status}</Badge>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 mb-1">Valor Total</p>
                        <p className="font-bold text-green-600">
                          R$ {ultimoPedido.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Itens do Pedido */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Itens que serão copiados ({ultimoPedido.itens_revenda?.length || 0})
                  </h4>
                  <Card className="max-h-60 overflow-y-auto">
                    <CardContent className="p-0">
                      {ultimoPedido.itens_revenda?.map((item, index) => (
                        <div 
                          key={index} 
                          className="p-3 border-b last:border-0 hover:bg-slate-50"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-sm">{item.descricao}</p>
                              <p className="text-xs text-slate-600">
                                {item.quantidade} {item.unidade} × R$ {item.preco_unitario?.toFixed(2)}
                              </p>
                            </div>
                            <p className="font-semibold text-green-600">
                              R$ {item.valor_item?.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Resumo do que será copiado */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-3 text-blue-900">
                      O que será copiado:
                    </h4>
                    <ul className="space-y-2 text-sm text-blue-800">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full" />
                        Todos os {ultimoPedido.itens_revenda?.length || 0} itens do pedido
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full" />
                        Endereço de entrega
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full" />
                        Condições de pagamento e frete
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full" />
                        Preços vigentes na época
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                {/* Alerta */}
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-3">
                    <p className="text-sm text-amber-800">
                      ⚠️ <strong>Atenção:</strong> Verifique se os preços e estoque ainda estão válidos antes de confirmar o novo pedido.
                    </p>
                  </CardContent>
                </Card>

                {/* Botões */}
                <div className="flex justify-end gap-3 pt-4">
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline">
                      Cancelar
                    </Button>
                  </DialogTrigger>
                  <Button
                    type="button"
                    onClick={copiarPedido}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Confirmar Cópia
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (windowMode) {
    return content;
  }

  return content;
}
