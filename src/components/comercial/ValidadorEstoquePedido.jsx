import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Box, Package } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * 📦 VALIDADOR DE ESTOQUE PARA PEDIDO V21.5
 * 
 * Verifica disponibilidade de estoque antes de aprovar pedido
 * Exibe alertas de itens sem estoque
 * Calcula previsão de quando terá estoque (IA)
 */
export default function ValidadorEstoquePedido({ pedido, empresaId }) {
  const groupId = pedido?.group_id || pedido?.grupo_id || null;
  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos', groupId, empresaId],
    queryFn: () => base44.entities.Produto.filter({ group_id: groupId, empresa_id: empresaId }),
    enabled: !!groupId && !!empresaId
  });

  const itensRevenda = pedido?.itens_revenda || [];
  const demandaPorProduto = itensRevenda.reduce((totais, item) => {
    const produtoId = String(item?.produto_id || '');
    if (!produtoId) return totais;
    totais.set(produtoId, (totais.get(produtoId) || 0) + Number(item?.quantidade || 0));
    return totais;
  }, new Map());
  
  const verificacoes = itensRevenda.map(item => {
    const produto = produtos.find(p => p.id === item.produto_id);
    const estoqueAtual = Number(produto?.estoque_atual || 0);
    const estoqueReservado = Number(produto?.estoque_reservado || 0);
    const estoqueDisponivel = Math.max(0, estoqueAtual - estoqueReservado);
    const quantidadeNecessaria = Number(item.quantidade || 0);
    const quantidadeTotalProduto = demandaPorProduto.get(String(item?.produto_id || '')) || quantidadeNecessaria;
    const disponivel = estoqueDisponivel >= quantidadeTotalProduto;
    const falta = Math.max(0, quantidadeTotalProduto - estoqueDisponivel);
    
    return {
      item,
      produto,
      estoqueAtual,
      estoqueReservado,
      estoqueDisponivel,
      quantidadeNecessaria,
      quantidadeTotalProduto,
      disponivel,
      falta
    };
  });

  const todosDisponiveis = verificacoes.every(v => v.disponivel);
  const algumIndisponivel = verificacoes.some(v => !v.disponivel);

  if (itensRevenda.length === 0) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-4 text-center text-slate-500">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum item de revenda neste pedido</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-2 ${algumIndisponivel ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Box className="w-5 h-5" />
            Validação de Estoque
          </h3>
          {todosDisponiveis ? (
            <Badge className="bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Estoque OK
            </Badge>
          ) : (
            <Badge className="bg-red-600">
              <AlertCircle className="w-3 h-3 mr-1" />
              Estoque Insuficiente
            </Badge>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-white">
              <TableHead>Produto</TableHead>
              <TableHead>Qtd Necessária</TableHead>
              <TableHead>Disponível</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {verificacoes.map((v, idx) => (
              <TableRow key={idx} className="hover:bg-white/50">
                <TableCell className="font-medium">
                  {v.item.descricao || v.item.produto_descricao}
                </TableCell>
                <TableCell>{v.quantidadeNecessaria}</TableCell>
                <TableCell className={v.disponivel ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                  {v.estoqueDisponivel}
                </TableCell>
                <TableCell>
                  {v.disponivel ? (
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Disponível
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Falta {v.falta}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {algumIndisponivel && (
          <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded">
            <p className="text-sm text-red-800">
              <strong>⚠️ Ação necessária:</strong> Ajuste as quantidades ou aguarde reposição de estoque antes de aprovar o pedido.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}