import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function Top10ProdutosCliente({ clienteId, onSelecionarProduto }) {
  const [usandoIA, setUsandoIA] = useState(false);
  const [sugestoesIA, setSugestoesIA] = useState([]);
  const { toast } = useToast();
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
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
  const consultaHabilitada = Boolean(clienteId && contextoValido && podeVisualizarHistorico);

  const { data: pedidos = [], isLoading: isLoadingPedidos } = useQuery({
    queryKey: ["top10-pedidos-cliente-contexto", clienteId, groupId, empresaId, contexto],
    queryFn: async () => filterInContext("Pedido", { cliente_id: clienteId }, "-data_pedido", 200),
    enabled: consultaHabilitada
  });

  const { data: produtos = [], isLoading: isLoadingProdutos } = useQuery({
    queryKey: ["top10-produtos-disponiveis-contexto", clienteId, groupId, empresaId, contexto],
    queryFn: async () => filterInContext("Produto", {}, "descricao", 500),
    enabled: consultaHabilitada
  });

  const produtosConsolidados = {};

  pedidos.forEach(pedido => {
    const itensRevenda = Array.isArray(pedido.itens_revenda) ? pedido.itens_revenda : [];

    itensRevenda.forEach(item => {
      if (!item || typeof item !== "object") return;

      const key = item.produto_id || item.codigo_sku || item.descricao;
      if (!key) return;

      if (!produtosConsolidados[key]) {
        produtosConsolidados[key] = {
          produto_id: item.produto_id,
          codigo: item.codigo_sku || "",
          descricao: item.descricao || "Produto",
          quantidade_total: 0,
          valor_total: 0,
          frequencia: 0,
          ultimo_preco: 0,
          ultima_compra: null,
          unidade: item.unidade || "UN"
        };
      }

      produtosConsolidados[key].quantidade_total += item.quantidade || 0;
      produtosConsolidados[key].valor_total += item.valor_item || 0;
      produtosConsolidados[key].frequencia += 1;
      produtosConsolidados[key].ultimo_preco = item.preco_unitario || 0;

      if (!produtosConsolidados[key].ultima_compra || (pedido.data_pedido && new Date(pedido.data_pedido) > new Date(produtosConsolidados[key].ultima_compra))) {
        produtosConsolidados[key].ultima_compra = pedido.data_pedido;
      }
    });
  });

  const top10Produtos = Object.values(produtosConsolidados)
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, 10);

  const buscarSugestoesIA = async () => {
    if (!podeUsarIA) {
      toast({
        title: "Acao bloqueada",
        description: "Selecione um contexto de grupo/empresa e confirme permissao para sugestoes comerciais com IA.",
        variant: "destructive"
      });
      return;
    }

    if (!clienteId || !produtos.length || !pedidos.length) {
      toast({
        title: "Aviso",
        description: "Nao ha dados suficientes de cliente, produtos ou pedidos para gerar sugestoes de IA.",
        variant: "destructive"
      });
      return;
    }

    setUsandoIA(true);
    setSugestoesIA([]);

    try {
      const historicoPedidos = pedidos.map(p => ({
        data: p.data_pedido,
        valor: p.valor_total,
        group_id: p.group_id || groupId || null,
        empresa_id: p.empresa_id || empresaId || null,
        itens: p.itens_revenda?.map(i => ({
          produto: i.descricao,
          quantidade: i.quantidade,
          valor: i.valor_item
        }))
      }));

      const linhasProdutos = produtos
        .slice(0, 50)
        .map(p => (p.codigo || "") + " - " + (p.descricao || "") + " - R$ " + (p.preco_venda || 0))
        .join("\n");

      const prompt = [
        "Analise o historico de compras deste cliente e sugira os 10 melhores produtos para oferecer agora.",
        "Considere padroes de compra, produtos complementares e frequencia.",
        "Use apenas os PRODUTOS DISPONIVEIS fornecidos e respeite o contexto de grupo/empresa informado.",
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

      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt,
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

      const sugestoesComProdutos = (resultado.sugestoes || [])
        .map(sug => {
          const prod = produtos.find(p => p.codigo === sug.produto_codigo);
          return prod ? { ...sug, produto: prod } : null;
        })
        .filter(Boolean)
        .slice(0, 10);

      setSugestoesIA(sugestoesComProdutos);

      toast({
        title: "IA analisou o historico",
        description: sugestoesComProdutos.length + " produtos sugeridos com base no comportamento do cliente"
      });
    } catch (error) {
      console.error("Erro ao buscar sugestoes de IA:", error);
      toast({
        title: "Erro na IA",
        description: "Nao foi possivel gerar sugestoes com IA. Detalhes: " + (error.message || "Erro desconhecido"),
        variant: "destructive"
      });
    } finally {
      setUsandoIA(false);
    }
  };

  const sugestoesExibir = sugestoesIA.length > 0
    ? sugestoesIA
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

  if (isLoadingPedidos || isLoadingProdutos) {
    return (
      <div className="w-full h-full flex justify-center items-center min-h-48" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
        <p className="ml-4 text-amber-700">Carregando historico e produtos...</p>
      </div>
    );
  }

  if (pedidos.length === 0 && sugestoesIA.length === 0 && top10Produtos.length === 0) {
    return (
      <div className="w-full h-full text-center py-8 text-slate-500 border rounded-lg bg-white p-6 shadow-sm" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
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
          {sugestoesIA.length > 0 ? "Sugestoes da IA" : "Baseado em historico"}
        </p>
        <Button size="sm" variant="outline" onClick={buscarSugestoesIA} disabled={usandoIA || !podeUsarIA || isLoadingProdutos || isLoadingPedidos} className="border-purple-300 text-purple-700 hover:bg-purple-50" data-permission="Comercial.Pedido.criar" data-action="analisar-produtos-cliente-ia" data-sensitive="true">
          {usandoIA ? "Analisando..." : "Analisar com IA"}
        </Button>
      </div>

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
          <div className="text-center py-8 text-slate-500">
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
