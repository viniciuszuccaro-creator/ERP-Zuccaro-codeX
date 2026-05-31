import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, Package, Plus, Zap, ShieldAlert } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function SugestoesProdutos({ clienteId, itensAtuais = [], onAdicionarProduto }) {
  const [sugestoes, setSugestoes] = useState([]);
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
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
  const consultaHabilitada = Boolean(clienteId && contextoValido && podeVisualizarSugestoes);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidosClienteContexto", clienteId, groupId, empresaId, contexto],
    queryFn: async () => filterInContext("Pedido", { cliente_id: clienteId }, "-data_pedido", 100),
    enabled: consultaHabilitada
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtosSugestoesContexto", groupId, empresaId, contexto],
    queryFn: () => filterInContext("Produto", {}, "descricao", 500),
    enabled: Boolean(contextoValido && podeVisualizarSugestoes),
  });

  useEffect(() => {
    if (!consultaHabilitada || pedidos.length === 0 || produtos.length === 0) {
      setSugestoes([]);
      return;
    }

    try {
      const produtosComprados = {};

      pedidos.forEach(pedido => {
        const itensRevenda = Array.isArray(pedido.itens_revenda) ? pedido.itens_revenda : [];

        itensRevenda.forEach(item => {
          if (!item || typeof item !== "object") return;

          const produtoId = item.produto_id;
          if (!produtoId) return;

          if (!produtosComprados[produtoId]) {
            produtosComprados[produtoId] = {
              produto_id: produtoId,
              descricao: item.descricao,
              quantidade_total: 0,
              frequencia: 0
            };
          }

          produtosComprados[produtoId].quantidade_total += item.quantidade || 0;
          produtosComprados[produtoId].frequencia += 1;
        });
      });

      const idsAtuais = itensAtuais.map(i => i.produto_id).filter(Boolean);

      const sugestoesCalculadas = Object.values(produtosComprados)
        .filter(pc => !idsAtuais.includes(pc.produto_id))
        .sort((a, b) => b.frequencia - a.frequencia)
        .slice(0, 3)
        .map(pc => {
          const produtoCompleto = produtos.find(p => p.id === pc.produto_id);
          return {
            ...pc,
            ...produtoCompleto
          };
        })
        .filter(s => s.id && s.status === "Ativo");

      setSugestoes(sugestoesCalculadas);
    } catch (error) {
      console.error("Erro ao calcular sugestões:", error);
      setSugestoes([]);
    }
  }, [consultaHabilitada, pedidos, produtos, itensAtuais]);

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

  if (sugestoes.length === 0) {
    return null;
  }

  return (
    <Card className="w-full h-full border-2 border-purple-200 bg-purple-50" data-context-required="true" data-permission="Comercial.Pedido.visualizar" data-action="sugerir-produtos">
      <CardHeader className="bg-gradient-to-r from-purple-100 to-purple-50 border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-600" />
          Sugestões Inteligentes
          <Badge className="bg-purple-600 ml-auto">Com Base no Histórico</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-2">
          {sugestoes.map((produto, idx) => (
            <div key={produto.id || idx} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-purple-300 transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded">
                  <Package className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{produto.descricao}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Comprado {produto.frequencia}x
                    </Badge>
                    <span className="text-xs text-slate-600">
                      R$ {(produto.preco_venda || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!podeAdicionarProduto}
                data-permission="Comercial.Pedido.criar"
                data-action="adicionar-produto-sugerido"
                onClick={() => {
                  if (podeAdicionarProduto && onAdicionarProduto && typeof onAdicionarProduto === "function") {
                    onAdicionarProduto(produto);
                  }
                }}
                className="bg-purple-600 hover:bg-purple-700"
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
