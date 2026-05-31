import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { History, Package, Plus, TrendingUp, ShieldAlert } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function HistoricoComprasCliente({ clienteId, onAdicionarProduto }) {
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeVisualizarHistorico =
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("CRM.Cliente.visualizar") ||
    hasPermission("comercial", "visualizar_pedido");
  const podeAdicionarProduto =
    hasPermission("Comercial.Pedido.criar") ||
    hasPermission("Comercial.Pedido.editar") ||
    hasPermission("comercial", "criar_pedido") ||
    hasPermission("comercial", "editar_pedido");
  const consultaHabilitada = Boolean(clienteId && contextoValido && podeVisualizarHistorico);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-cliente-compras-contexto", clienteId, groupId, empresaId, contexto],
    queryFn: async () => {
      try {
        return await filterInContext("Pedido", { cliente_id: clienteId }, "-data_pedido", 200);
      } catch (error) {
        console.error("Erro ao buscar pedidos:", error);
        return [];
      }
    },
    enabled: consultaHabilitada
  });

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

  if (pedidos.length === 0) return null;

  const produtosConsolidados = {};
  pedidos.forEach(pedido => {
    const itensRevenda = Array.isArray(pedido.itens_revenda) ? pedido.itens_revenda : [];
    itensRevenda.forEach(item => {
      if (!item || typeof item !== "object") return;

      const key = item.produto_id || item.descricao;
      if (!key) return;

      if (!produtosConsolidados[key]) {
        produtosConsolidados[key] = {
          produto_id: item.produto_id,
          descricao: item.descricao || "Produto",
          codigo_sku: item.codigo_sku || "",
          quantidade_total: 0,
          valor_total: 0,
          frequencia: 0,
          ultimo_preco: 0
        };
      }

      produtosConsolidados[key].quantidade_total += item.quantidade || 0;
      produtosConsolidados[key].valor_total += item.valor_item || 0;
      produtosConsolidados[key].frequencia += 1;
      produtosConsolidados[key].ultimo_preco = item.preco_unitario || 0;
    });
  });

  const topProdutos = Object.values(produtosConsolidados)
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, 5);

  if (topProdutos.length === 0) return null;

  return (
    <Card className="w-full h-full border-2 border-blue-200" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
      <CardHeader className="bg-blue-50 border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="w-4 h-4 text-blue-600" />
          Histórico de Compras
          <Badge className="bg-blue-600 ml-auto">{pedidos.length} pedidos anteriores</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-2">
          {topProdutos.map((produto, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-blue-300 transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded">
                  <Package className="w-5 h-5 text-blue-600" />
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
                      custo_aquisicao: produto.ultimo_preco * 0.6,
                      unidade_medida: "UN",
                      estoque_atual: 100
                    });
                  }
                }}
                disabled={!podeAdicionarProduto}
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
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