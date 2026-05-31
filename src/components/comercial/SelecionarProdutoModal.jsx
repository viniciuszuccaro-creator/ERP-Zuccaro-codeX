import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Package, CheckCircle, AlertTriangle } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function SelecionarProdutoModal({ isOpen, onClose, onSelect }) {
  const [searchTerm, setSearchTerm] = useState("");
  const { empresaAtual, grupoAtual, contexto, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === 'empresa' ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeVisualizarProdutos = hasPermission('Comercial', 'Pedido', 'criar') || hasPermission('Comercial', 'Pedido', 'editar') || hasPermission('Estoque', 'Produto', 'visualizar') || hasPermission('Cadastros', 'Produto', 'visualizar');
  const consultaHabilitada = contextoValido && podeVisualizarProdutos;

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-seletor-comercial-modal', groupId, empresaId, contexto],
    queryFn: () => filterInContext('Produto', {}, 'descricao', 500),
    enabled: consultaHabilitada,
    staleTime: 120000,
  });

  const produtosFiltrados = produtos.filter(p => 
    p.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh]" data-permission="Comercial.Pedido.criar" data-context-required="true">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Selecionar Produto
          </DialogTitle>
        </DialogHeader>

        {(!contextoValido || !podeVisualizarProdutos) && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Selecionar produto exige contexto de grupo/empresa e permissão para visualizar produtos comerciais.
            </AlertDescription>
          </Alert>
        )}

        <div className="w-full h-full space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Buscar por código ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
              disabled={!consultaHabilitada}
              data-action="SelecionarProduto.buscar"
              data-permission="Comercial.Pedido.criar"
            />
          </div>

          <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0">
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Un</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtosFiltrados.map((produto) => {
                  const estoqueBaixo = (produto.estoque_atual || 0) <= (produto.estoque_minimo || 0);

                  return (
                    <TableRow 
                      key={produto.id}
                      className="hover:bg-slate-50"
                    >
                      <TableCell className="font-mono text-sm">{produto.codigo || '-'}</TableCell>
                      <TableCell className="font-medium">{produto.descricao}</TableCell>
                      <TableCell>{produto.unidade_medida || 'UN'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={estoqueBaixo ? 'text-orange-600 font-semibold' : ''}>
                            {produto.estoque_atual || 0}
                          </span>
                          {estoqueBaixo && (
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        R$ {(produto.preco_venda || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          disabled={!consultaHabilitada}
                          data-action="SelecionarProduto.adicionar"
                          data-permission="Comercial.Pedido.criar"
                          onClick={() => {
                            onSelect(produto);
                            onClose();
                          }}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Adicionar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {produtosFiltrados.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-500">Nenhum produto encontrado</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-50 p-3 rounded">
            <span>Total de produtos: {produtosFiltrados.length}</span>
            <span>Clique em "Adicionar" para incluir no pedido</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}