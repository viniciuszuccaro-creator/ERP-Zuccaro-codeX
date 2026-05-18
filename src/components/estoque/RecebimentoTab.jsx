import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, PackageCheck, Search, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import RecebimentoForm from "./RecebimentoForm";
import { useWindow } from "@/components/lib/useWindow";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { toast } from "sonner";

export default function RecebimentoTab({ recebimentos, ordensCompra, produtos }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingRecebimento, setViewingRecebimento] = useState(null);
  const { openWindow } = useWindow();
  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const { canCreate } = usePermissions();
  const contextoValido = Boolean(empresaAtual?.id || grupoAtual?.id);
  const canCreateRecebimento = canCreate('Estoque', 'Recebimento');
  const [formData, setFormData] = useState({
    numero_recebimento: `REC-${Date.now()}`,
    ordem_compra_id: "",
    fornecedor: "",
    data_recebimento: new Date().toISOString().split('T')[0],
    numero_nf: "",
    itens: [{ produto_id: "", produto_descricao: "", quantidade_pedida: 0, quantidade_recebida: 0, status_item: "Conforme" }],
    responsavel_recebimento: "",
    observacoes: "",
    status: "Pendente"
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (!contextoValido) throw new Error("Selecione grupo ou empresa antes de registrar recebimento.");
      if (!canCreateRecebimento) throw new Error("Sem permissao para registrar recebimento.");
      const itensRecebidos = data.itens || data.itens_recebidos || [];
      if (!itensRecebidos.some(item => Number(item.quantidade_recebida) > 0)) {
        throw new Error("Informe ao menos um item recebido com quantidade maior que zero.");
      }
      // Criar recebimento
      await createInContext('MovimentacaoEstoque', {
        tipo_movimentacao: "Entrada",
        empresa_id: empresaAtual?.id,
        data_movimentacao: data.data_recebimento,
        documento: data.numero_nf || data.numero_recebimento,
        responsavel: data.responsavel_recebimento,
        observacoes: `Recebimento: ${data.numero_recebimento}`,
        itens_recebidos: itensRecebidos
      });

      // Atualizar estoque de cada produto
      for (const item of itensRecebidos) {
        const quantidadeRecebida = Number(item.quantidade_recebida || 0);
        if (quantidadeRecebida > 0) {
          const produto = produtos.find(p => p.id === item.produto_id);
          if (produto) {
            await updateInContext('Produto', produto.id, {
              estoque_atual: (produto.estoque_atual || 0) + quantidadeRecebida
            });

            // Criar movimentação individual
            await createInContext('MovimentacaoEstoque', {
              empresa_id: empresaAtual?.id,
              produto_id: item.produto_id,
              produto_descricao: item.produto_descricao,
              tipo_movimentacao: "Entrada",
              quantidade: quantidadeRecebida,
              data_movimentacao: data.data_recebimento,
              documento: data.numero_nf || data.numero_recebimento,
              motivo: "Recebimento de compra",
              responsavel: data.responsavel_recebimento,
              observacoes: data.observacoes
            });
          }
        }
      }

      // Atualizar status da ordem de compra se informada
      if (data.ordem_compra_id) {
        await updateInContext('OrdemCompra', data.ordem_compra_id, {
          status: "Recebida"
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['ordensCompra'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      numero_recebimento: `REC-${Date.now()}`,
      ordem_compra_id: "",
      fornecedor: "",
      data_recebimento: new Date().toISOString().split('T')[0],
      numero_nf: "",
      itens: [{ produto_id: "", produto_descricao: "", quantidade_pedida: 0, quantidade_recebida: 0, status_item: "Conforme" }],
      responsavel_recebimento: "",
      observacoes: "",
      status: "Pendente"
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleOrdemCompraChange = (ocId) => {
    const oc = ordensCompra.find(o => o.id === ocId);
    if (oc) {
      setFormData({
        ...formData,
        ordem_compra_id: ocId,
        fornecedor: oc.fornecedor_nome,
        itens: oc.itens?.map(item => ({
          produto_id: "",
          produto_descricao: item.descricao,
          quantidade_pedida: item.quantidade,
          quantidade_recebida: item.quantidade,
          status_item: "Conforme"
        })) || []
      });
    }
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      itens: [...formData.itens, { produto_id: "", produto_descricao: "", quantidade_pedida: 0, quantidade_recebida: 0, status_item: "Conforme" }]
    });
  };

  const handleRemoveItem = (index) => {
    const newItens = formData.itens.filter((_, i) => i !== index);
    setFormData({ ...formData, itens: newItens });
  };

  const handleItemChange = (index, field, value) => {
    const newItens = [...formData.itens];
    newItens[index][field] = value;
    
    if (field === 'produto_id') {
      const produto = produtos.find(p => p.id === value);
      if (produto) {
        newItens[index].produto_descricao = produto.descricao;
      }
    }
    
    setFormData({ ...formData, itens: newItens });
  };

  const statusColors = {
    'Pendente': 'bg-yellow-100 text-yellow-700',
    'Conferido': 'bg-blue-100 text-blue-700',
    'Aprovado': 'bg-green-100 text-green-700',
    'Divergente': 'bg-red-100 text-red-700'
  };

  const filteredRecebimentos = recebimentos.filter(r => {
    const searchLower = searchTerm.toLowerCase();
    return r.numero_recebimento?.toLowerCase().includes(searchLower) ||
      r.documento?.toLowerCase().includes(searchLower) ||
      r.fornecedor?.toLowerCase().includes(searchLower) ||
      r.numero_nf?.includes(searchLower) ||
      r.responsavel_recebimento?.toLowerCase().includes(searchLower) ||
      r.responsavel?.toLowerCase().includes(searchLower) ||
      r.status?.toLowerCase().includes(searchLower) ||
      r.observacoes?.toLowerCase().includes(searchLower) ||
      r.itens_recebidos?.some(i => i?.produto_descricao?.toLowerCase().includes(searchLower));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            placeholder="Buscar por nº recebimento, fornecedor, NF, responsável, produto, status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {canCreateRecebimento && (
          <Button
            className="bg-green-600 hover:bg-green-700"
            disabled={!contextoValido}
            data-permission="Estoque.Recebimento.criar"
            onClick={() => openWindow(RecebimentoForm, {
            windowMode: true,
            onSubmit: async (data) => {
              try {
                const user = await base44.auth.me();
                await createMutation.mutateAsync({
                  ...data,
                  conferente: data.conferente || user?.full_name || 'Sistema'
                });
                toast.success("✅ Recebimento registrado!");
              } catch (error) {
                toast.error(error?.message || "Erro ao registrar recebimento");
              }
            }
          }, {
            title: '📦 Novo Recebimento',
            width: 1000,
            height: 700
          })}
        >
            <Plus className="w-4 h-4 mr-2" />
            Registrar Recebimento
          </Button>
        )}

        <Dialog open={false}>
          <DialogTrigger asChild>
            <Button className="hidden">Removido</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto hidden">
            <DialogHeader>
              <DialogTitle>Registrar Recebimento de Produtos</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="numero_recebimento">Nº Recebimento</Label>
                  <Input
                    id="numero_recebimento"
                    value={formData.numero_recebimento}
                    onChange={(e) => setFormData({ ...formData, numero_recebimento: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="data_recebimento">Data Recebimento</Label>
                  <Input
                    id="data_recebimento"
                    type="date"
                    value={formData.data_recebimento}
                    onChange={(e) => setFormData({ ...formData, data_recebimento: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="ordem_compra">Ordem de Compra (opcional)</Label>
                  <Select
                    value={formData.ordem_compra_id}
                    onValueChange={handleOrdemCompraChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma OC" />
                    </SelectTrigger>
                    <SelectContent>
                      {ordensCompra.filter(o => o.status === 'Enviada' || o.status === 'Em Processo').map((oc) => (
                        <SelectItem key={oc.id} value={oc.id}>
                          {oc.numero_oc} - {oc.fornecedor_nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="fornecedor">Fornecedor</Label>
                  <Input
                    id="fornecedor"
                    value={formData.fornecedor}
                    onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="numero_nf">Nº Nota Fiscal</Label>
                  <Input
                    id="numero_nf"
                    value={formData.numero_nf}
                    onChange={(e) => setFormData({ ...formData, numero_nf: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="responsavel_recebimento">Responsável</Label>
                  <Input
                    id="responsavel_recebimento"
                    value={formData.responsavel_recebimento}
                    onChange={(e) => setFormData({ ...formData, responsavel_recebimento: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Itens do Recebimento</Label>
                  <Button type="button" size="sm" variant="outline" onClick={handleAddItem}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {formData.itens.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 p-3 border rounded-lg">
                      <div className="col-span-4">
                        <Select
                          value={item.produto_id}
                          onValueChange={(value) => handleItemChange(index, 'produto_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {produtos.filter(p => p.status === 'Ativo').map((produto) => (
                              <SelectItem key={produto.id} value={produto.id}>
                                {produto.codigo ? `${produto.codigo} - ` : ''}{produto.descricao}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Qtd Pedida"
                          value={item.quantidade_pedida}
                          onChange={(e) => handleItemChange(index, 'quantidade_pedida', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Qtd Recebida"
                          value={item.quantidade_recebida}
                          onChange={(e) => handleItemChange(index, 'quantidade_recebida', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-3">
                        <Select
                          value={item.status_item}
                          onValueChange={(value) => handleItemChange(index, 'status_item', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Conforme">Conforme</SelectItem>
                            <SelectItem value="Divergente">Divergente</SelectItem>
                            <SelectItem value="Avariado">Avariado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1 flex items-center">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveItem(index)}
                          disabled={formData.itens.length === 1}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="submit" disabled={createMutation.isPending} className="bg-green-600 hover:bg-green-700">
                  {createMutation.isPending ? 'Salvando...' : 'Registrar Recebimento'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-md">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Nº Recebimento</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>NF</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecebimentos.map((rec) => (
                <TableRow key={rec.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium font-mono text-sm">{rec.numero_recebimento}</TableCell>
                  <TableCell>
                    {new Date(rec.data_recebimento).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>{rec.fornecedor}</TableCell>
                  <TableCell className="font-mono text-sm">{rec.numero_nf || '-'}</TableCell>
                  <TableCell>{rec.itens?.length || 0}</TableCell>
                  <TableCell>{rec.responsavel_recebimento || '-'}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[rec.status]}>
                      {rec.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewingRecebimento(rec)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredRecebimentos.length === 0 && (
          <div className="text-center py-12">
            <PackageCheck className="w-16 h-16 mx-auto mb-4 opacity-30 text-slate-400" />
            <p className="text-slate-500">Nenhum recebimento registrado</p>
          </div>
        )}
      </Card>
    </div>
  );
}
