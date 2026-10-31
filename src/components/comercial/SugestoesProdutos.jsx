import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, Package, Plus, Zap, ShieldAlert } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { resolveErpBackendMode } from "@/api/runtimeBackend";
import { readErpHttpSession } from "@/api/erpHttpSession";
import {
  historicoSessionCacheKey,
  loadPedidosHistoricoHttp,
} from "./HistoricoProdutosCliente";
import { consolidateTopProdutosFromPedidos } from "./historicoComprasClientePolicy";

const PEDIDOS_SUGESTOES_LIMIT = 100;
/** Evita novo `[]` a cada render quando a query ainda não tem data (Codex P1 loop). */
const PEDIDOS_VAZIOS = Object.freeze([]);
/** Mutável para SetStateAction<any[]>; referência estável no clear no-op. */
const SUGESTOES_VAZIAS = [];

/**
 * Sugestões por frequência no histórico — keep both com Top10 (IA) e HistoricoCompras.
 * HTTP: loadPedidosHistoricoHttp + policy; erro ≠ painel ausente / lista vazia.
 */
export default function SugestoesProdutos({ clienteId, itensAtuais = [], onAdicionarProduto = undefined }) {
  const [sugestoes, setSugestoes] = useState([]);
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const httpMode = resolveErpBackendMode() === "http";
  const sessionSnapshot = readErpHttpSession();
  const sessionActorId = sessionSnapshot?.actorId || null;
  const sessionCacheKey = historicoSessionCacheKey(sessionSnapshot);
  const podeVisualizarSugestoes =
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("Comercial.Pedido.criar") ||
    hasPermission("Comercial.Pedido.editar") ||
    hasPermission("Estoque.Produto.visualizar") ||
    hasPermission("Cadastros.Produto.visualizar");
  const podeAdicionarProduto =
    hasPermission("Comercial.Pedido.criar") ||
    hasPermission("Comercial.Pedido.editar") ||
    hasPermission("comercial", "criar_pedido") ||
    hasPermission("comercial", "editar_pedido");
  const consultaHabilitada = Boolean(
    clienteId
      && contextoValido
      && podeVisualizarSugestoes
      && (!httpMode || (empresaId && sessionActorId && sessionCacheKey)),
  );

  const {
    data: pedidosPage,
    isError: pedidosErro,
    isFetching: pedidosFetching,
    isLoading: isLoadingPedidos,
  } = useQuery({
    queryKey: [
      "pedidosClienteContexto",
      clienteId,
      groupId,
      empresaId,
      contexto,
      sessionActorId,
      sessionCacheKey,
      httpMode ? "http" : "legado",
    ],
    queryFn: async ({ signal }) => {
      if (!clienteId || !contextoValido || !podeVisualizarSugestoes) {
        throw Object.assign(new Error("Sugestoes bloqueadas: contexto ou permissao ausente."), {
          code: "SUGESTOES_CONTEXT_DENIED",
        });
      }
      if (httpMode) {
        if (!empresaId) {
          throw Object.assign(new Error("Sugestoes HTTP exigem empresa no contexto."), {
            code: "EMPRESA_CONTEXT_REQUIRED",
          });
        }
        return loadPedidosHistoricoHttp({
          clienteId,
          groupId,
          empresaId,
          signal,
          limit: PEDIDOS_SUGESTOES_LIMIT,
          offset: 0,
          expectedActorId: sessionActorId,
          expectedSessionKey: sessionCacheKey,
        });
      }
      const rows = await filterInContext("Pedido", { cliente_id: clienteId }, "-data_pedido", PEDIDOS_SUGESTOES_LIMIT);
      const data = Array.isArray(rows) ? rows : [];
      return {
        data,
        meta: { limit: PEDIDOS_SUGESTOES_LIMIT, offset: 0, total: data.length, hasMore: false },
      };
    },
    enabled: consultaHabilitada,
    staleTime: 60_000,
    retry: false,
  });

  const { data: produtos = [], isLoading: isLoadingProdutos } = useQuery({
    queryKey: ["produtosSugestoesContexto", groupId, empresaId, contexto],
    queryFn: () => filterInContext("Produto", {}, "descricao", 500),
    enabled: Boolean(contextoValido && podeVisualizarSugestoes),
    retry: false,
  });

  const pedidos = Array.isArray(pedidosPage?.data) ? pedidosPage.data : PEDIDOS_VAZIOS;
  const dadosPedidosDisponiveis = consultaHabilitada && !pedidosErro && pedidosPage != null;
  const paginaIncompleta = Boolean(pedidosPage?.meta?.hasMore)
    || (Number.isFinite(Number(pedidosPage?.meta?.total))
      && Number(pedidosPage.meta.total) > pedidos.length);

  useEffect(() => {
    const clearSugestoes = () => {
      setSugestoes((prev) => (prev.length === 0 ? prev : SUGESTOES_VAZIAS));
    };
    if (!consultaHabilitada || !dadosPedidosDisponiveis || produtos.length === 0) {
      clearSugestoes();
      return;
    }

    if (pedidos.length === 0) {
      clearSugestoes();
      return;
    }

    // Sem limite intermediário por valor — corta só após ordenar por frequência (Codex P2).
    const consolidados = consolidateTopProdutosFromPedidos(pedidos, { limit: null });
    const idsAtuais = (Array.isArray(itensAtuais) ? itensAtuais : [])
      .map((i) => i?.produto_id)
      .filter(Boolean);

    const sugestoesCalculadas = consolidados
      .filter((pc) => pc.produto_id && !idsAtuais.includes(pc.produto_id))
      .sort((a, b) => b.frequencia - a.frequencia)
      .slice(0, 3)
      .map((pc) => {
        const produtoCompleto = produtos.find((p) => p.id === pc.produto_id);
        const merged = {
          ...pc,
          ...produtoCompleto,
          frequencia: pc.frequencia,
          descricao: produtoCompleto?.descricao || pc.descricao,
        };
        // Catálogo manda em unidade/preço atuais; ausência ≠ inventar 0 / misturar UN.
        const precoCat = produtoCompleto?.preco_venda;
        const precoCatOk = precoCat != null && precoCat !== "" && Number.isFinite(Number(precoCat));
        if (precoCatOk) {
          merged.preco_venda = Number(precoCat);
        } else {
          delete merged.preco_venda;
          delete merged.ultimo_preco;
        }
        return merged;
      })
      .filter((s) => s.id && s.status === "Ativo");

    setSugestoes(sugestoesCalculadas);
  }, [consultaHabilitada, dadosPedidosDisponiveis, pedidos, produtos, itensAtuais]);

  if (!clienteId) {
    return null;
  }

  if (!contextoValido || !podeVisualizarSugestoes) {
    return (
      <Alert className="w-full h-full border-amber-200 bg-amber-50" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Sugestões de produtos exigem contexto de grupo/empresa e permissão comercial ou de produto.
        </AlertDescription>
      </Alert>
    );
  }

  if (httpMode && (!empresaId || !sessionActorId || !sessionCacheKey)) {
    return (
      <Alert
        className="w-full h-full border-amber-200 bg-amber-50"
        data-action="sugestoes-produtos-http-indisponivel"
        data-permission="Comercial.Pedido.visualizar"
      >
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Sugestões HTTP exigem empresa no contexto e sessão autenticada — não ocultar falha como ausência.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoadingPedidos || isLoadingProdutos || (pedidosFetching && !dadosPedidosDisponiveis)) {
    return (
      <Card className="w-full h-full border-sky-200 bg-sky-50/40" data-action="sugestoes-produtos-carregando">
        <CardContent className="p-4 text-sm text-slate-600">Carregando sugestões…</CardContent>
      </Card>
    );
  }

  if (pedidosErro || !dadosPedidosDisponiveis) {
    return (
      <Alert
        className="w-full h-full border-amber-200 bg-amber-50"
        data-action="sugestoes-produtos-http-indisponivel"
        data-permission="Comercial.Pedido.visualizar"
      >
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Não foi possível carregar o histórico para sugestões. Erro ≠ painel oculto.
        </AlertDescription>
      </Alert>
    );
  }

  if (sugestoes.length === 0) {
    return null;
  }

  return (
    <Card className="w-full h-full border-2 border-sky-200 bg-sky-50/30" data-context-required="true" data-permission="Comercial.Pedido.visualizar" data-action="sugerir-produtos">
      <CardHeader className="bg-sky-50 border-b border-sky-100">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-sky-600" />
          Sugestões pelo histórico
          <Badge className="bg-sky-600 ml-auto">
            {paginaIncompleta ? "Parcial" : "Frequência comprovada"}
          </Badge>
        </CardTitle>
        {paginaIncompleta ? (
          <Alert className="mt-2 border-amber-200 bg-amber-50" data-action="sugestoes-produtos-pagina-incompleta">
            <AlertDescription className="text-amber-800 text-xs">
              Há mais pedidos além desta página. Frequência é parcial (não inventar total).
            </AlertDescription>
          </Alert>
        ) : null}
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-2">
          {sugestoes.map((produto, idx) => (
            <div key={produto.id || idx} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-sky-300 transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-100 rounded">
                  <Package className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{produto.descricao}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Comprado {produto.frequencia}x
                    </Badge>
                    <span className="text-xs text-slate-600" data-action="sugestoes-preco-exibir">
                      {produto.preco_venda == null
                        ? "—"
                        : `R$ ${Number(produto.preco_venda).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>
              {typeof onAdicionarProduto === "function" ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={!podeAdicionarProduto}
                  data-permission="Comercial.Pedido.criar"
                  data-action="adicionar-produto-sugerido"
                  onClick={() => {
                    if (podeAdicionarProduto) onAdicionarProduto(produto);
                  }}
                  className="bg-sky-600 hover:bg-sky-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
