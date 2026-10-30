import React, { useState } from "react";
import { invokeErpIa } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { assertIaUiContext } from "@/components/lib/iaTransversalPolicy";
import { validarSugestoesProdutosIA } from "@/components/lib/iaResponsePolicy.js";
import { resolveErpBackendMode } from "@/api/runtimeBackend";
import { readErpHttpSession } from "@/api/erpHttpSession";
import {
  historicoSessionCacheKey,
  loadPedidosHistoricoHttp,
} from "./HistoricoProdutosCliente";
import {
  consolidateTopProdutosFromPedidos,
  extractItensPedidoHistorico,
  resolveValorPedidoHistorico,
  resolveValorItemHistorico,
} from "./historicoComprasClientePolicy";

const PEDIDOS_TOP10_LIMIT = 200;

/**
 * Top 10 produtos do cliente + IA — keep both com HistoricoComprasCliente (capacidade distinta).
 * HTTP: reutiliza loadPedidosHistoricoHttp + policy; erro ≠ "sem histórico".
 */
export default function Top10ProdutosCliente({ clienteId, onSelecionarProduto = undefined }) {
  const [usandoIA, setUsandoIA] = useState(false);
  const [sugestoesIA, setSugestoesIA] = useState([]);
  const { toast } = useToast();
  const { filterInContext, empresaAtual, grupoAtual, contexto, estaNoGrupo } = useContextoVisual();
  const { hasPermission, user } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const scopeType = estaNoGrupo || contexto === "grupo" ? "grupo" : "empresa";
  const httpMode = resolveErpBackendMode() === "http";
  const sessionSnapshot = readErpHttpSession();
  const sessionActorId = sessionSnapshot?.actorId || null;
  const sessionCacheKey = historicoSessionCacheKey(sessionSnapshot);
  const iaIdentityKey = JSON.stringify([user?.id, clienteId, groupId, empresaId, scopeType]);
  const iaRequestScope = React.useRef({ key: iaIdentityKey, pending: false, active: true });
  const iaResultScope = React.useRef(null);
  if (iaRequestScope.current.key !== iaIdentityKey) iaRequestScope.current = { key: iaIdentityKey, pending: false, active: true };
  const sugestoesVisiveis = iaResultScope.current === iaRequestScope.current ? sugestoesIA : [];
  React.useEffect(() => {
    const scope = iaRequestScope.current;
    scope.active = true;
    setSugestoesIA([]);
    setUsandoIA(false);
    return () => { scope.active = false; };
  }, [iaIdentityKey]);
  let contextoValido = false;
  try {
    assertIaUiContext({ groupId, empresaId, scopeType });
    contextoValido = true;
  } catch {
    contextoValido = false;
  }
  const podeVisualizarHistorico =
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("Comercial.Pedido.criar") ||
    hasPermission("Comercial.Pedido.editar") ||
    hasPermission("Estoque.Produto.visualizar") ||
    hasPermission("Cadastros.Produto.visualizar");
  const podeSelecionarProduto =
    hasPermission("Comercial.Pedido.criar") ||
    hasPermission("Comercial.Pedido.editar") ||
    hasPermission("comercial", "criar_pedido") ||
    hasPermission("comercial", "editar_pedido");
  const podeUsarIA = contextoValido && podeVisualizarHistorico && podeSelecionarProduto;
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
    isLoading: isLoadingPedidos,
  } = useQuery({
    queryKey: [
      "top10-pedidos-cliente-contexto",
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
        throw Object.assign(new Error("Top10 bloqueado: contexto ou permissao ausente."), {
          code: "TOP10_CONTEXT_DENIED",
        });
      }
      if (httpMode) {
        if (!empresaId) {
          throw Object.assign(new Error("Top10 HTTP exige empresa no contexto."), {
            code: "EMPRESA_CONTEXT_REQUIRED",
          });
        }
        return loadPedidosHistoricoHttp({
          clienteId,
          groupId,
          empresaId,
          signal,
          limit: PEDIDOS_TOP10_LIMIT,
          offset: 0,
          expectedActorId: sessionActorId,
          expectedSessionKey: sessionCacheKey,
        });
      }
      const rows = await filterInContext("Pedido", { cliente_id: clienteId }, "-data_pedido", PEDIDOS_TOP10_LIMIT);
      const data = Array.isArray(rows) ? rows : [];
      return {
        data,
        meta: { limit: PEDIDOS_TOP10_LIMIT, offset: 0, total: data.length, hasMore: false },
      };
    },
    enabled: consultaHabilitada,
    staleTime: 60_000,
    retry: false,
  });

  const { data: produtos = [], isLoading: isLoadingProdutos } = useQuery({
    queryKey: ["top10-produtos-disponiveis-contexto", clienteId, groupId, empresaId, contexto],
    queryFn: async () => filterInContext("Produto", {}, "descricao", 500),
    enabled: consultaHabilitada,
    retry: false,
  });

  const pedidos = Array.isArray(pedidosPage?.data) ? pedidosPage.data : [];
  const dadosPedidosDisponiveis = consultaHabilitada && !pedidosErro && pedidosPage != null;
  const paginaIncompleta = Boolean(pedidosPage?.meta?.hasMore)
    || (Number.isFinite(Number(pedidosPage?.meta?.total))
      && Number(pedidosPage.meta.total) > pedidos.length);

  const top10Produtos = dadosPedidosDisponiveis
    ? consolidateTopProdutosFromPedidos(pedidos, { limit: 10 }).map((row) => ({
        ...row,
        codigo: row.codigo_sku || "",
        unidade: row.unidade || "UN",
      }))
    : [];

  const buscarSugestoesIA = async () => {
    if (!podeUsarIA) {
      toast({
        title: "Acao bloqueada",
        description: "Selecione grupo e empresa e confirme permissao para sugestoes comerciais com IA.",
        variant: "destructive"
      });
      return;
    }

    if (!clienteId || !produtos.length || !dadosPedidosDisponiveis || !pedidos.length) {
      toast({
        title: "Aviso",
        description: pedidosErro
          ? "Historico de pedidos indisponivel — nao inventar sugestoes a partir de falha."
          : "Nao ha dados suficientes de cliente, produtos ou pedidos para gerar sugestoes de IA.",
        variant: "destructive"
      });
      return;
    }

    const activeScope = iaRequestScope.current;
    if (activeScope.pending || activeScope.active === false) return;
    activeScope.pending = true;
    const isCurrent = () => iaRequestScope.current === activeScope && activeScope.active !== false;
    setUsandoIA(true);
    setSugestoesIA([]);

    try {
      assertIaUiContext({ groupId, empresaId, scopeType });
      const historicoPedidos = pedidos.map(p => ({
        data: p.data_pedido || p.created_date || null,
        valor: resolveValorPedidoHistorico(p),
        group_id: p.group_id || groupId || null,
        empresa_id: p.empresa_id || empresaId || null,
        itens: extractItensPedidoHistorico(p).map(i => ({
          produto: i.descricao || i.nome || null,
          quantidade: i.quantidade,
          valor: resolveValorItemHistorico(i),
        })),
      }));

      const linhasProdutos = produtos
        .slice(0, 50)
        .map(p => (p.codigo || "") + " - " + (p.descricao || "") + " - R$ " + (p.preco_venda || 0))
        .join("\n");

      const prompt = [
        "Analise o historico de compras deste cliente e sugira os 10 melhores produtos para oferecer agora.",
        "Considere padroes de compra, produtos complementares e frequencia.",
        "Use apenas os PRODUTOS DISPONIVEIS fornecidos e respeite o contexto de grupo/empresa informado.",
        "Apenas SUGIRA. Nao execute pedido nem altere estoque.",
        "",
        "CONTEXTO:",
        "Grupo: " + (groupId || "nao informado"),
        "Empresa: " + (empresaId || "nao informada"),
        "",
        "HISTORICO DE PEDIDOS:",
        JSON.stringify(historicoPedidos, null, 2),
        "",
        "PRODUTOS DISPONIVEIS:",
        linhasProdutos,
        "",
        "Retorne um JSON contendo um array de objetos em sugestoes com:",
        "- produto_codigo: string, codigo SKU existente em PRODUTOS DISPONIVEIS",
        "- motivo_sugestao: string",
        "- score_confianca: number de 0 a 100",
        "- produtos_complementares: string[] opcional"
      ].join("\n");

      const resultado = await invokeErpIa('comercial_produtos', {
        prompt,
        group_id: groupId,
        empresa_id: scopeType === "grupo" ? null : empresaId,
        response_json_schema: {
          type: "object",
          properties: {
            sugestoes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  produto_codigo: { type: "string" },
                  motivo_sugestao: { type: "string" },
                  score_confianca: { type: "number" },
                  produtos_complementares: {
                    type: "array",
                    items: { type: "string" }
                  }
                },
                required: ["produto_codigo", "motivo_sugestao", "score_confianca"]
              }
            }
          },
          required: ["sugestoes"]
        }
      });

      if (!isCurrent()) return;
      const resposta = validarSugestoesProdutosIA(resultado, produtos.slice(0, 50));
      const sugestoesComProdutos = resposta.sugestoes
        .map(sug => {
          const prod = produtos.find(p => p.codigo === sug.produto_codigo);
          return prod ? { ...sug, produto: prod } : null;
        })
        .filter(Boolean)
        .slice(0, 10);

      iaResultScope.current = activeScope;
      setSugestoesIA(sugestoesComProdutos);

      toast({
        title: "IA analisou o historico",
        description: sugestoesComProdutos.length + " produtos sugeridos com base no comportamento do cliente"
      });
    } catch (error) {
      if (!isCurrent()) return;
      console.error("Erro ao buscar sugestoes de IA:", error);
      toast({
        title: "Erro na IA",
        description: "Nao foi possivel gerar sugestoes com IA. Detalhes: " + (error.message || "Erro desconhecido"),
        variant: "destructive"
      });
    } finally {
      activeScope.pending = false;
      if (isCurrent()) setUsandoIA(false);
    }
  };

  const sugestoesExibir = sugestoesVisiveis.length > 0
    ? sugestoesVisiveis
    : top10Produtos.map(t => {
      const fullProduct = produtos.find(p => p.id === t.produto_id) || {
        id: t.produto_id,
        codigo: t.codigo,
        descricao: t.descricao,
        preco_venda: t.ultimo_preco,
        unidade_medida: t.unidade,
      };
      return {
        produto: fullProduct,
        motivo_sugestao: "Comprado " + t.quantidade_total + " " + t.unidade + " anteriormente",
        score_confianca: Math.min(100, t.frequencia * 20 + (t.valor_total / 100)),
      };
    });

  if (!clienteId) return null;

  if (!contextoValido || !podeVisualizarHistorico) {
    return (
      <Alert className="w-full h-full border-amber-200 bg-amber-50" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Sugestoes de produtos exigem contexto de grupo/empresa e permissao para visualizar pedidos ou produtos.
        </AlertDescription>
      </Alert>
    );
  }

  if (httpMode && (!empresaId || !sessionActorId || !sessionCacheKey)) {
    return (
      <Alert
        className="w-full h-full border-amber-200 bg-amber-50"
        data-action="top10-produtos-http-indisponivel"
        data-permission="Comercial.Pedido.visualizar"
      >
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Top produtos HTTP exige empresa no contexto e sessao autenticada — nao inventar ranking vazio.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoadingPedidos || isLoadingProdutos || (pedidosFetching && !dadosPedidosDisponiveis)) {
    return (
      <div className="w-full h-full flex justify-center items-center min-h-48" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
        <p className="ml-4 text-amber-700">Carregando historico e produtos...</p>
      </div>
    );
  }

  if (pedidosErro || !dadosPedidosDisponiveis) {
    return (
      <Alert
        className="w-full h-full border-amber-200 bg-amber-50"
        data-action="top10-produtos-http-indisponivel"
        data-permission="Comercial.Pedido.visualizar"
      >
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Nao foi possivel carregar o historico de pedidos deste cliente. Erro ≠ ausencia de compras.
        </AlertDescription>
      </Alert>
    );
  }

  if (pedidos.length === 0 && sugestoesVisiveis.length === 0 && top10Produtos.length === 0) {
    return (
      <div className="w-full h-full text-center py-8 text-slate-500 border rounded-lg bg-white p-6 shadow-sm" data-context-required="true" data-permission="Comercial.Pedido.visualizar" data-action="top10-produtos-sem-historico">
        <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Cliente sem historico de compras</p>
        <Button size="sm" variant="outline" onClick={buscarSugestoesIA} disabled={usandoIA || !podeUsarIA || isLoadingProdutos} className="mt-3 border-purple-300 text-purple-700 hover:bg-purple-50" data-permission="Comercial.Pedido.criar" data-action="buscar-sugestoes-ia-cliente" data-sensitive="true">
          {usandoIA ? "Analisando..." : "Buscar sugestoes com IA"}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full h-full space-y-4" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
      <div className="flex justify-between items-center">
        <p className="text-sm text-blue-700 font-medium">
          {sugestoesVisiveis.length > 0 ? "Sugestoes da IA" : "Baseado em historico"}
          {paginaIncompleta ? " (parcial — página incompleta)" : ""}
        </p>
        <Button size="sm" variant="outline" onClick={buscarSugestoesIA} disabled={usandoIA || !podeUsarIA || isLoadingProdutos || isLoadingPedidos} className="border-purple-300 text-purple-700 hover:bg-purple-50" data-permission="Comercial.Pedido.criar" data-action="analisar-produtos-cliente-ia" data-sensitive="true">
          {usandoIA ? "Analisando..." : "Analisar com IA"}
        </Button>
      </div>

      {paginaIncompleta ? (
        <Alert className="border-amber-200 bg-amber-50" data-action="top10-produtos-pagina-incompleta">
          <AlertDescription className="text-amber-800 text-xs">
            Há mais pedidos além desta página. Ranking Top10 é parcial (não inventar total).
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {sugestoesExibir.slice(0, 10).map((sug, idx) => (
          <button key={sug.produto?.id || "sug-" + idx} type="button" onClick={() => {
            if (podeSelecionarProduto && onSelecionarProduto && typeof onSelecionarProduto === "function" && sug.produto) onSelecionarProduto(sug.produto);
          }} className="w-full p-3 text-left hover:bg-blue-100 transition-colors border rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed" disabled={!sug.produto || !podeSelecionarProduto} data-permission="Comercial.Pedido.criar" data-action="selecionar-sugestao-produto-cliente">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-sm">{sug.produto?.descricao || "Produto desconhecido"}</p>
                <p className="text-xs text-slate-600 mt-1">{sug.motivo_sugestao || "Sugestao comercial"}</p>
                {sug.score_confianca !== undefined && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                      <div className="bg-purple-600 h-1.5 rounded-full transition-all" style={{ width: Math.max(0, Math.min(100, sug.score_confianca)) + "%" }} />
                    </div>
                    <span className="text-xs text-slate-500">{Math.round(sug.score_confianca)}%</span>
                  </div>
                )}
              </div>
              <div className="text-right ml-4">
                <p className="font-bold text-green-600">R$ {(sug.produto?.preco_venda || 0).toFixed(2)}</p>
                <Badge variant="outline" className="text-xs mt-1">{sug.produto?.codigo || "N/A"}</Badge>
              </div>
            </div>
          </button>
        ))}
        {sugestoesExibir.length === 0 && (
          <div className="text-center py-8 text-slate-500" data-action="top10-produtos-sem-itens">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma sugestao encontrada para este cliente.</p>
            <Button size="sm" variant="outline" onClick={buscarSugestoesIA} disabled={usandoIA || !podeUsarIA || isLoadingProdutos || isLoadingPedidos} className="mt-3 border-purple-300 text-purple-700 hover:bg-purple-50" data-permission="Comercial.Pedido.criar" data-action="tentar-sugestoes-ia-cliente" data-sensitive="true">
              {usandoIA ? "Analisando..." : "Tentar buscar com IA"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
