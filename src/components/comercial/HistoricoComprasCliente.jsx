import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { History, Package, Plus, TrendingUp, ShieldAlert } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { resolveErpBackendMode } from "@/api/runtimeBackend";
import { readErpHttpSession } from "@/api/erpHttpSession";
import {
  historicoSessionCacheKey,
  loadPedidosHistoricoHttp,
} from "./HistoricoProdutosCliente";
import { consolidateTopProdutosFromPedidos } from "./historicoComprasClientePolicy";

const PEDIDOS_COMPRAS_LIMIT = 200;

/**
 * Histórico de compras do cliente (Comercial) — keep both com portal/HistoricoComprasCliente.
 * HTTP: loadPedidosHistoricoHttp; erro ≠ lista vazia / top inventado.
 */
export default function HistoricoComprasCliente({ clienteId, onAdicionarProduto }) {
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const httpMode = resolveErpBackendMode() === "http";
  const sessionSnapshot = readErpHttpSession();
  const sessionActorId = sessionSnapshot?.actorId || null;
  const sessionCacheKey = historicoSessionCacheKey(sessionSnapshot);
  const podeVisualizarHistorico =
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("CRM.Cliente.visualizar") ||
    hasPermission("comercial", "visualizar_pedido");
  const podeAdicionarProduto =
    hasPermission("Comercial.Pedido.criar") ||
    hasPermission("Comercial.Pedido.editar") ||
    hasPermission("comercial", "criar_pedido") ||
    hasPermission("comercial", "editar_pedido");
  const consultaHabilitada = Boolean(
    clienteId
      && contextoValido
      && podeVisualizarHistorico
      && (!httpMode || (empresaId && sessionActorId && sessionCacheKey)),
  );

  const {
    data: pedidosPage,
    isError: pedidosErro,
    isFetching: pedidosFetching,
    isLoading,
  } = useQuery({
    queryKey: [
      "pedidos-cliente-compras-contexto",
      clienteId,
      groupId,
      empresaId,
      contexto,
      sessionActorId,
      sessionCacheKey,
      httpMode ? "http" : "legado",
    ],
    queryFn: async ({ signal }) => {
      if (!clienteId || !contextoValido || !podeVisualizarHistorico) {
        throw Object.assign(new Error("Historico de compras bloqueado: contexto ou permissao ausente."), {
          code: "COMPRAS_CONTEXT_DENIED",
        });
      }
      if (httpMode) {
        if (!empresaId) {
          throw Object.assign(new Error("Historico de compras HTTP exige empresa no contexto."), {
            code: "EMPRESA_CONTEXT_REQUIRED",
          });
        }
        return loadPedidosHistoricoHttp({
          clienteId,
          groupId,
          empresaId,
          signal,
          limit: PEDIDOS_COMPRAS_LIMIT,
          offset: 0,
          expectedActorId: sessionActorId,
          expectedSessionKey: sessionCacheKey,
        });
      }
      // Legado: sem catch→[] (erro ≠ vazio).
      const rows = await filterInContext("Pedido", { cliente_id: clienteId }, "-data_pedido", PEDIDOS_COMPRAS_LIMIT);
      const data = Array.isArray(rows) ? rows : [];
      return {
        data,
        meta: { limit: PEDIDOS_COMPRAS_LIMIT, offset: 0, total: data.length, hasMore: false },
      };
    },
    enabled: consultaHabilitada,
    staleTime: 60_000,
    retry: false,
  });

  const pedidos = Array.isArray(pedidosPage?.data) ? pedidosPage.data : [];
  const dadosDisponiveis = consultaHabilitada && !pedidosErro && pedidosPage != null;
  const paginaIncompleta = Boolean(pedidosPage?.meta?.hasMore)
    || (Number.isFinite(Number(pedidosPage?.meta?.total))
      && Number(pedidosPage.meta.total) > pedidos.length);

  if (!clienteId) return null;

  if (!contextoValido || !podeVisualizarHistorico) {
    return (
      <Alert className="w-full h-full border-amber-200 bg-amber-50" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Histórico de compras exige contexto de grupo/empresa e permissão para visualizar pedidos.
        </AlertDescription>
      </Alert>
    );
  }

  if (httpMode && (!empresaId || !sessionActorId || !sessionCacheKey)) {
    return (
      <Alert
        className="w-full h-full border-amber-200 bg-amber-50"
        data-action="historico-compras-http-indisponivel"
        data-permission="Comercial.Pedido.visualizar"
      >
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Histórico de compras HTTP exige empresa no contexto e sessão autenticada — não inventar top produtos vazio.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading || (pedidosFetching && !dadosDisponiveis)) {
    return (
      <Card className="w-full h-full border-sky-200 bg-sky-50/40" data-action="historico-compras-carregando">
        <CardContent className="p-4 text-sm text-slate-600">Carregando histórico de compras…</CardContent>
      </Card>
    );
  }

  if (pedidosErro || !dadosDisponiveis) {
    return (
      <Alert
        className="w-full h-full border-amber-200 bg-amber-50"
        data-action="historico-compras-http-indisponivel"
        data-permission="Comercial.Pedido.visualizar"
      >
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Não foi possível carregar o histórico de compras. Erro ≠ lista vazia de produtos.
        </AlertDescription>
      </Alert>
    );
  }

  if (pedidos.length === 0) return null;

  const topProdutos = consolidateTopProdutosFromPedidos(pedidos, { limit: 5 });

  if (topProdutos.length === 0) {
    return (
      <Alert
        className="w-full h-full border-slate-200 bg-slate-50"
        data-action="historico-compras-sem-itens"
        data-permission="Comercial.Pedido.visualizar"
      >
        <AlertDescription className="text-slate-700 text-sm">
          Pedidos encontrados, porém sem linhas de item para consolidar neste contexto.
          {paginaIncompleta ? " Página incompleta — agregação parcial." : ""}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full h-full border-2 border-sky-200" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
      <CardHeader className="bg-sky-50 border-b border-sky-100">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="w-4 h-4 text-sky-600" />
          Histórico de Compras
          <Badge className="bg-sky-600 ml-auto">
            {paginaIncompleta ? "—" : `${pedidos.length} pedidos anteriores`}
          </Badge>
        </CardTitle>
        {paginaIncompleta ? (
          <Alert className="mt-2 border-amber-200 bg-amber-50" data-action="historico-compras-pagina-incompleta">
            <AlertDescription className="text-amber-800 text-xs">
              Há mais pedidos além desta página. Ranking de produtos é parcial (não inventar total).
            </AlertDescription>
          </Alert>
        ) : null}
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-2">
          {topProdutos.map((produto, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-sky-300 transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-100 rounded">
                  <Package className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{produto.descricao}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {produto.quantidade_total} unidades
                    </Badge>
                    <span className="text-xs text-slate-600">
                      Último preço: R$ {produto.ultimo_preco.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!podeAdicionarProduto) return;
                  if (onAdicionarProduto && typeof onAdicionarProduto === "function") {
                    onAdicionarProduto({
                      id: produto.produto_id,
                      codigo: produto.codigo_sku,
                      descricao: produto.descricao,
                      preco_venda: produto.ultimo_preco,
                      // Sem custo inventado — caller/simulação decide; não fabricar 0.6×.
                      unidade_medida: "UN",
                    });
                  }
                }}
                disabled={!podeAdicionarProduto}
                className="border-sky-300 text-sky-700 hover:bg-sky-50"
                data-permission="Comercial.Pedido.criar"
                data-action="adicionar-produto-historico-cliente"
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
