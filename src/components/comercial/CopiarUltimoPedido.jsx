import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Clock, Package, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { resolveErpBackendMode } from "@/api/runtimeBackend";
import {
  loadPedidosHistoricoHttp,
  historicoSessionCacheKey,
} from "./HistoricoProdutosCliente";

const ULTIMO_PEDIDO_FETCH_LIMIT = 5;

/** @param {{ status?: string } | null | undefined} pedido */
export function isCopiarPedidoCancelado(pedido) {
  const s = String(pedido?.status || "").toUpperCase();
  return s === "CANCELADO" || s === "CANCELLED";
}

/**
 * @param {{ valor_total?: number, total?: number, valor_produtos?: number } | null | undefined} pedido
 * @returns {number}
 */
export function copiarPedidoValorTotal(pedido) {
  const raw = pedido?.valor_total ?? pedido?.total;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Número exibido: legado `numero_pedido` ou HTTP `numero`. */
export function copiarPedidoNumero(pedido) {
  return pedido?.numero_pedido || pedido?.numero || "—";
}

/**
 * Itens para cópia/UI: legado `itens_revenda` ou canônico HTTP `itens`.
 * @param {{
 *   itens_revenda?: Array<Record<string, unknown>>,
 *   itens?: Array<{
 *     produto_id?: string,
 *     descricao?: string,
 *     quantidade?: number,
 *     unidade_sigla?: string,
 *     unidade?: string,
 *     preco_unitario?: number,
 *     total?: number,
 *     valor_total?: number,
 *     subtotal?: number,
 *   }>,
 * } | null | undefined} pedido
 */
export function resolveCopiarPedidoItensRevenda(pedido) {
  if (Array.isArray(pedido?.itens_revenda) && pedido.itens_revenda.length) {
    return pedido.itens_revenda.map((item) => ({ ...item, id: undefined }));
  }
  if (Array.isArray(pedido?.itens) && pedido.itens.length) {
    return pedido.itens.map((item) => ({
      produto_id: item.produto_id,
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidade: item.unidade_sigla || item.unidade,
      preco_unitario: item.preco_unitario,
      valor_item: Number(item.total ?? item.valor_total ?? item.subtotal) || 0,
      id: undefined,
    }));
  }
  return [];
}

/**
 * Primeiro pedido não cancelado da página (já ordenada por data desc).
 * @param {Array<{ status?: string }> | null | undefined} pedidos
 */
export function pickUltimoPedidoNaoCancelado(pedidos) {
  const list = Array.isArray(pedidos) ? pedidos : [];
  return list.find((p) => !isCopiarPedidoCancelado(p)) || null;
}

/**
 * V21.1.2 - WINDOW MODE READY
 * Repetir último pedido do cliente — HTTP fail-closed (≠ base44 cru).
 * Keep both: capacidade distinta de HistoricoClienteTab / DetalhesCliente / HistoricoProdutosCliente.
 */
export default function CopiarUltimoPedido({ clienteId, onCopiar, windowMode = false }) {
  const { toast } = useToast();
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const httpMode = resolveErpBackendMode() === "http";
  const sessionSnapshot = readErpHttpSession();
  const sessionActorId = sessionSnapshot?.actorId || null;
  const sessionCacheKey = historicoSessionCacheKey(sessionSnapshot);
  const podeVisualizar =
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("CRM.Cliente.visualizar") ||
    hasPermission("comercial", "visualizar_pedido");
  const consultaHabilitada = Boolean(
    clienteId
      && contextoValido
      && podeVisualizar
      && (!httpMode || (empresaId && sessionActorId && sessionCacheKey)),
  );

  const {
    data: ultimoPedido,
    isError,
    isFetching,
    error,
  } = useQuery({
    queryKey: [
      "copiar-ultimo-pedido",
      clienteId,
      groupId,
      empresaId,
      contexto,
      sessionActorId,
      sessionCacheKey,
      httpMode ? "http" : "legado",
    ],
    queryFn: async ({ signal }) => {
      if (!clienteId || !contextoValido || !podeVisualizar) {
        throw Object.assign(new Error("Cópia bloqueada: contexto ou permissão ausente."), {
          code: "COPIAR_ULTIMO_CONTEXT_DENIED",
        });
      }
      if (httpMode) {
        if (!empresaId) {
          throw Object.assign(new Error("Cópia HTTP exige empresa no contexto."), {
            code: "EMPRESA_CONTEXT_REQUIRED",
          });
        }
        const page = await loadPedidosHistoricoHttp({
          clienteId,
          groupId,
          empresaId,
          signal,
          limit: ULTIMO_PEDIDO_FETCH_LIMIT,
          offset: 0,
          expectedActorId: sessionActorId,
          expectedSessionKey: sessionCacheKey,
        });
        return pickUltimoPedidoNaoCancelado(page?.data);
      }
      const rows = await filterInContext(
        "Pedido",
        { cliente_id: clienteId },
        "-data_pedido",
        ULTIMO_PEDIDO_FETCH_LIMIT,
      );
      return pickUltimoPedidoNaoCancelado(rows);
    },
    enabled: consultaHabilitada,
    staleTime: 60_000,
    retry: false,
  });

  const httpIndisponivel =
    httpMode
    && Boolean(clienteId)
    && podeVisualizar
    && contextoValido
    && (!consultaHabilitada || isError);

  const itens = resolveCopiarPedidoItensRevenda(ultimoPedido);
  const numero = copiarPedidoNumero(ultimoPedido);
  const valorTotal = copiarPedidoValorTotal(ultimoPedido);
  const dataPedidoRaw = ultimoPedido?.data_pedido || ultimoPedido?.created_at || null;
  const diasDesdeUltimo = dataPedidoRaw
    ? Math.floor((Date.now() - new Date(dataPedidoRaw).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const copiarPedido = () => {
    if (!ultimoPedido) return;
    const pedidoCopiado = {
      cliente_id: ultimoPedido.cliente_id || clienteId,
      cliente_nome: ultimoPedido.cliente_nome,
      cliente_cpf_cnpj: ultimoPedido.cliente_cpf_cnpj,
      vendedor: ultimoPedido.vendedor,
      vendedor_id: ultimoPedido.vendedor_id,
      endereco_entrega_principal: ultimoPedido.endereco_entrega_principal,
      itens_revenda: itens,
      condicao_pagamento: ultimoPedido.condicao_pagamento,
      forma_pagamento: ultimoPedido.forma_pagamento,
      tabela_preco: ultimoPedido.tabela_preco,
      tabela_preco_id: ultimoPedido.tabela_preco_id,
      tipo_frete: ultimoPedido.tipo_frete,
      transportadora: ultimoPedido.transportadora,
      transportadora_id: ultimoPedido.transportadora_id,
      numero_pedido: `CÓPIA-${numero}`,
      data_pedido: new Date().toISOString().split("T")[0],
      status: "Rascunho",
      observacoes_publicas: `Cópia do pedido ${numero}`,
      valor_produtos: ultimoPedido.valor_produtos ?? valorTotal,
      valor_total: valorTotal,
    };

    if (onCopiar) {
      onCopiar(pedidoCopiado);
      toast({
        title: "Pedido copiado",
        description: `${itens.length} itens copiados do pedido ${numero}`,
      });
    }
  };

  if (!clienteId) return null;

  if (httpIndisponivel) {
    return (
      <div
        className={windowMode ? "w-full h-full overflow-auto bg-white p-4" : "w-full"}
        data-action="copiar-ultimo-pedido-http-indisponivel"
        data-context-required="true"
        data-permission="Comercial.Pedido.visualizar"
      >
        <Alert className="border-sky-200 bg-sky-50">
          <ShieldAlert className="h-4 w-4 text-sky-700" />
          <AlertDescription className="text-sky-900 text-sm">
            {error?.message
              || "Último pedido indisponível em HTTP até sessão/empresa válidos. Não interprete ausência do cartão como “sem pedidos”."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!consultaHabilitada) {
    return (
      <div
        className={windowMode ? "w-full h-full p-4" : "w-full"}
        data-action="copiar-ultimo-pedido-contexto-negado"
      >
        <Alert className="border-amber-200 bg-amber-50">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            Cópia do último pedido exige contexto de grupo/empresa e permissão para visualizar pedidos.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isFetching && !ultimoPedido) {
    return (
      <div className={windowMode ? "w-full h-full p-4" : "w-full"} data-action="copiar-ultimo-pedido-loading">
        <Card className="border border-sky-100">
          <CardContent className="p-4 text-sm text-slate-500">Carregando último pedido…</CardContent>
        </Card>
      </div>
    );
  }

  // Sem pedido elegível após consulta OK — ocultar cartão (comportamento legado), com marcador.
  if (!ultimoPedido) {
    return (
      <div className="hidden" data-action="copiar-ultimo-pedido-vazio" aria-hidden="true" />
    );
  }

  const content = (
    <div
      className={windowMode ? "w-full h-full overflow-auto bg-white p-4" : "w-full"}
      data-action="copiar-ultimo-pedido"
      data-context-required="true"
      data-permission="Comercial.Pedido.visualizar"
    >
      <Card className={windowMode ? "border shadow-sm" : "border-2 border-sky-200 bg-gradient-to-r from-sky-50 to-slate-50"}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-700 rounded-lg">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Repetir Último Pedido</h4>
                <div className="flex gap-2 text-xs text-slate-600">
                  <span>Pedido {numero}</span>
                  {diasDesdeUltimo != null && (
                    <>
                      <span>•</span>
                      <span>há {diasDesdeUltimo} dias</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" size="sm" className="bg-sky-700 hover:bg-sky-800">
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Confirmar Cópia do Pedido</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Pedido Original</p>
                          <p className="font-semibold">{numero}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Data</p>
                          <p className="font-semibold">
                            {dataPedidoRaw
                              ? new Date(dataPedidoRaw).toLocaleDateString("pt-BR")
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Status</p>
                          <Badge>{ultimoPedido.status}</Badge>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Valor Total</p>
                          <p className="font-bold text-emerald-700">
                            R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Itens que serão copiados ({itens.length})
                    </h4>
                    <Card className="max-h-60 overflow-y-auto">
                      <CardContent className="p-0">
                        {itens.length === 0 ? (
                          <p className="p-3 text-sm text-slate-500" data-action="copiar-ultimo-pedido-sem-itens">
                            Pedido sem itens copiáveis neste contrato.
                          </p>
                        ) : (
                          itens.map((item, index) => (
                            <div
                              key={index}
                              className="p-3 border-b last:border-0 hover:bg-slate-50"
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="font-medium text-sm">{item.descricao}</p>
                                  <p className="text-xs text-slate-600">
                                    {item.quantidade} {item.unidade} × R${" "}
                                    {Number(item.preco_unitario || 0).toFixed(2)}
                                  </p>
                                </div>
                                <p className="font-semibold text-emerald-700">
                                  R$ {Number(item.valor_item || 0).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-sky-50 border-sky-200">
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-3 text-sky-900">O que será copiado:</h4>
                      <ul className="space-y-2 text-sm text-sky-900">
                        <li className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-sky-700 rounded-full" />
                          Todos os {itens.length} itens do pedido
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-sky-700 rounded-full" />
                          Endereço de entrega
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-sky-700 rounded-full" />
                          Condições de pagamento e frete
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-sky-700 rounded-full" />
                          Preços vigentes na época (validar antes de gravar)
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-3">
                      <p className="text-sm text-amber-800">
                        <strong>Atenção:</strong> Verifique se os preços e estoque ainda estão válidos antes de confirmar o novo pedido.
                      </p>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end gap-3 pt-4">
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline">
                        Cancelar
                      </Button>
                    </DialogTrigger>
                    <Button
                      type="button"
                      onClick={copiarPedido}
                      className="bg-sky-700 hover:bg-sky-800"
                      data-action="copiar-ultimo-pedido-confirmar"
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

  return content;
}
