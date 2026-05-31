import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Edit, Trash2, Package, TrendingUp, Calendar, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import SearchInput from "@/components/ui/SearchInput";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { DollarSign } from "lucide-react";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function TabelaPrecoItensModal({ tabela, isOpen, onClose, windowMode = false }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [showItemForm, setShowItemForm] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { filterInContext, createInContext, updateInContext, deleteInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();

  const groupId = tabela?.group_id || tabela?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = tabela?.empresa_id || (contexto === "empresa" ? empresaAtual?.id : null);
  const contextoValido = Boolean(groupId || empresaId);
  const podeVisualizar =
    hasPermission("Comercial.TabelaPreco.visualizar") ||
    hasPermission("Cadastros.TabelaPreco.visualizar") ||
    hasPermission("comercial", "visualizar_tabela_preco") ||
    hasPermission("comercial", "editar_tabela_preco");
  const podeEditar =
    hasPermission("Comercial.TabelaPreco.editar") ||
    hasPermission("Cadastros.TabelaPreco.editar") ||
    hasPermission("comercial", "editar_tabela_preco");
  const acaoHabilitada = Boolean(contextoValido && podeEditar);
  const consultaHabilitada = Boolean(tabela?.id && contextoValido && podeVisualizar);

  const [formItem, setFormItem] = useState({
    produto_id: "",
    preco_base: 0,
    percentual_desconto: 0,
    data_inicio_vigencia: new Date().toISOString().split('T')[0],
    data_fim_vigencia: "",
    ativo: true,
    observacoes: ""
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["tabela-preco-itens-contexto", tabela?.id, groupId, empresaId, contexto],
    queryFn: () => filterInContext("TabelaPrecoItem", { tabela_preco_id: tabela.id }, "produto_descricao", 1000),
    enabled: consultaHabilitada,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-tabela-preco-contexto", groupId, empresaId, contexto],
    queryFn: () => filterInContext("Produto", {}, "descricao", 500),
    enabled: Boolean(contextoValido && podeVisualizar),
  });

  const createItemMutation = useMutation({
    mutationFn: (data) => {
      const produto = produtos.find(p => p.id === data.produto_id);
      const precoComDesconto = data.preco_base * (1 - data.percentual_desconto / 100);
      
      if (!acaoHabilitada) {
        throw new Error("Contexto de grupo/empresa e permissao para editar tabela de preco sao obrigatorios.");
      }

      return createInContext("TabelaPrecoItem", {
        ...data,
        tabela_preco_id: tabela.id,
        tabela_preco_nome: tabela.nome,
        produto_codigo: produto?.codigo,
        produto_descricao: produto?.descricao,
        preco_com_desconto: precoComDesconto,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabela-preco-itens'] });
      queryClient.invalidateQueries({ queryKey: ['tabelas-preco'] });
      setShowItemForm(false);
      setEditingItem(null);
      toast({ title: "✅ Item adicionado!" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }) => {
      const precoComDesconto = data.preco_base * (1 - data.percentual_desconto / 100);
      if (!acaoHabilitada) {
        throw new Error("Contexto de grupo/empresa e permissao para editar tabela de preco sao obrigatorios.");
      }

      return updateInContext("TabelaPrecoItem", id, {
        ...data,
        preco_com_desconto: precoComDesconto,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabela-preco-itens'] });
      setShowItemForm(false);
      setEditingItem(null);
      toast({ title: "✅ Item atualizado!" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id) => {
      if (!acaoHabilitada) {
        throw new Error("Contexto de grupo/empresa e permissão para editar tabela de preço são obrigatórios.");
      }
      return deleteInContext("TabelaPrecoItem", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabela-preco-itens'] });
      toast({ title: "✅ Item removido!" });
    },
  });

  const handleSubmitItem = (e) => {
    e.preventDefault();
    if (!acaoHabilitada) {
      toast({ title: "Acao bloqueada", description: "Selecione um contexto de grupo/empresa e confirme sua permissao para editar tabela de preco.", variant: "destructive" });
      return;
    }
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data: formItem });
    } else {
      createItemMutation.mutate(formItem);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setFormItem({
      produto_id: item.produto_id,
      preco_base: item.preco_base,
      percentual_desconto: item.percentual_desconto || 0,
      data_inicio_vigencia: item.data_inicio_vigencia || "",
      data_fim_vigencia: item.data_fim_vigencia || "",
      ativo: item.ativo !== false,
      observacoes: item.observacoes || ""
    });
    setShowItemForm(true);
  };

  const handleDeleteItem = (item) => {
    if (acaoHabilitada && confirm(`Regra-Mãe: confirma remover "${item.produto_descricao}" desta tabela de preço?`)) {
      deleteItemMutation.mutate(item.id);
    }
  };

  const filteredItens = itens.filter(i =>
    i.produto_descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.produto_codigo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const produtosDisponiveis = produtos.filter(p => 
    !itens.some(i => i.produto_id === p.id)
  );

  const content = (
    <div className={`w-full h-full ${windowMode ? 'overflow-hidden flex flex-col bg-white' : ''}`} data-context-required="true" data-permission="Comercial.TabelaPreco.visualizar">
      <div className={`${windowMode ? 'border-b pb-4 px-6 pt-6' : ''} flex-shrink-0`}>
        <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-green-600" />
                {tabela.nome}
              </DialogTitle>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline">{tabela.tipo}</Badge>
                <Badge className={tabela.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                  {tabela.ativo ? 'Ativa' : 'Inativa'}
                </Badge>
                {tabela.data_inicio && (
                  <span className="text-sm text-slate-600 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(tabela.data_inicio).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>
            
            {podeEditar && !showItemForm && (
              <Button 
                onClick={() => {
                  setEditingItem(null);
                  setFormItem({
                    produto_id: "",
                    preco_base: 0,
                    percentual_desconto: 0,
                    data_inicio_vigencia: new Date().toISOString().split('T')[0],
                    data_fim_vigencia: "",
                    ativo: true,
                    observacoes: ""
                  });
                  setShowItemForm(true);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Produto
              </Button>
            )}
          </div>
        </div>

      <div className={`flex-1 overflow-y-auto ${windowMode ? 'px-6 pb-6' : 'p-6'}`}>
          {showItemForm ? (
            <form onSubmit={handleSubmitItem} className="space-y-4 bg-slate-50 p-6 rounded-lg">
              <h3 className="font-semibold text-lg mb-4">
                {editingItem ? 'Editar Item' : 'Novo Item'}
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="produto_id">Produto *</Label>
                  <select
                    id="produto_id"
                    value={formItem.produto_id}
                    onChange={(e) => {
                      const produto = produtos.find(p => p.id === e.target.value);
                      setFormItem({ 
                        ...formItem, 
                        produto_id: e.target.value,
                        preco_base: produto?.preco_venda || 0
                      });
                    }}
                    required
                    className="w-full border rounded-md p-2"
                    disabled={!!editingItem || !acaoHabilitada}
                    data-permission="Comercial.TabelaPreco.editar"
                    data-action="selecionar-produto-tabela-preco"
                  >
                    <option value="">Selecione um produto...</option>
                    {(editingItem ? produtos : produtosDisponiveis).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.codigo} - {p.descricao}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="preco_base">Preço Base *</Label>
                  <Input
                    id="preco_base"
                    type="number"
                    step="0.01"
                    value={formItem.preco_base}
                    onChange={(e) => setFormItem({ ...formItem, preco_base: parseFloat(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="percentual_desconto">Desconto (%)</Label>
                  <Input
                    id="percentual_desconto"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formItem.percentual_desconto}
                    onChange={(e) => setFormItem({ ...formItem, percentual_desconto: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <Label>Preço Final</Label>
                  <div className="text-2xl font-bold text-green-600 mt-1">
                    R$ {(formItem.preco_base * (1 - formItem.percentual_desconto / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ativo_item"
                    checked={formItem.ativo}
                    onChange={(e) => setFormItem({ ...formItem, ativo: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="ativo_item" className="font-normal cursor-pointer">
                    Item Ativo
                  </Label>
                </div>

                <div>
                  <Label htmlFor="data_inicio_vigencia">Vigência Início</Label>
                  <Input
                    id="data_inicio_vigencia"
                    type="date"
                    value={formItem.data_inicio_vigencia}
                    onChange={(e) => setFormItem({ ...formItem, data_inicio_vigencia: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="data_fim_vigencia">Vigência Fim (opcional)</Label>
                  <Input
                    id="data_fim_vigencia"
                    type="date"
                    value={formItem.data_fim_vigencia}
                    onChange={(e) => setFormItem({ ...formItem, data_fim_vigencia: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="observacoes_item">Observações</Label>
                  <Input
                    id="observacoes_item"
                    value={formItem.observacoes}
                    onChange={(e) => setFormItem({ ...formItem, observacoes: e.target.value })}
                    placeholder="Observações sobre este preço"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowItemForm(false);
                    setEditingItem(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={!acaoHabilitada || createItemMutation.isPending || updateItemMutation.isPending}
                  data-permission="Comercial.TabelaPreco.editar"
                  data-action={editingItem ? "atualizar-item-tabela-preco" : "adicionar-item-tabela-preco"}
                  data-sensitive="true"
                  className="bg-green-600 hover:bg-green-700"
                >
                  {editingItem ? 'Atualizar' : 'Adicionar'}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="mb-4">
                <SearchInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Buscar produtos na tabela..."
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Código</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Preço Base</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Preço Final</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Status</TableHead>
                    {podeEditar && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItens.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium text-sm">
                        {item.produto_codigo || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-slate-400" />
                          {item.produto_descricao}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        R$ {(item.preco_base || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {item.percentual_desconto > 0 ? (
                          <Badge className="bg-red-100 text-red-700">
                            -{item.percentual_desconto}%
                          </Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-green-600">
                        R$ {(item.preco_com_desconto || item.preco_base || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {item.data_inicio_vigencia ? (
                          <>
                            {new Date(item.data_inicio_vigencia).toLocaleDateString('pt-BR')}
                            {item.data_fim_vigencia && (
                              <> até {new Date(item.data_fim_vigencia).toLocaleDateString('pt-BR')}</>
                            )}
                          </>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={item.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {item.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      {podeEditar && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditItem(item)}
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteItem(item)}
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredItens.length === 0 && (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Nenhum produto cadastrado nesta tabela</p>
                  {podeEditar && (
                    <Button 
                      onClick={() => setShowItemForm(true)}
                      className="mt-4 bg-green-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Primeiro Produto
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
  );

  if (windowMode) {
    return content;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1180px] max-h-[620px] overflow-hidden flex flex-col">
        {content}
      </DialogContent>
    </Dialog>
  );
}