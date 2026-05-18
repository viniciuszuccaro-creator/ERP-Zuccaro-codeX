import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, X, PackageMinus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import RequisicaoAlmoxarifadoForm from "./RequisicaoAlmoxarifadoForm";
import { useWindow } from "@/components/lib/useWindow";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { toast } from "sonner";

export default function RequisicoesAlmoxarifadoTab({ requisicoes, produtos }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { openWindow } = useWindow();
  const { empresaAtual, grupoAtual, contexto, createInContext, updateInContext } = useContextoVisual();
  const { canCreate } = usePermissions();
  const contextoValido = Boolean(empresaAtual?.id || grupoAtual?.id);
  const canCreateRequisicao = canCreate('Estoque', 'Requisicoes') || canCreate('Estoque', 'Requisições');
  const [formData, setFormData] = useState({
    numero_requisicao: `REQ-ALM-${Date.now()}`,
    data_requisicao: new Date().toISOString().split('T')[0],
    solicitante: "",
    setor: "",
    centro_custo: "",
    itens: [{ produto_id: "", produto_descricao: "", quantidade: 1, unidade_medida: "" }],
    finalidade: "",
    observacoes: "",
    status: "Pendente"
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (!contextoValido) throw new Error("Selecione grupo ou empresa antes de registrar requisicao.");
      if (!canCreateRequisicao) throw new Error("Sem permissao para registrar requisicao.");
      const itens = data.itens || [data];
      // Criar requisição como MovimentacaoEstoque
      for (const item of itens) {
        const quantidade = Number(item.quantidade || 0);
        if (!Number.isFinite(quantidade) || quantidade <= 0) {
          throw new Error("Quantidade da requisicao deve ser maior que zero.");
        }
        await createInContext('MovimentacaoEstoque', {
          empresa_id: empresaAtual?.id,
          group_id: contexto?.group_id,
          produto_id: item.produto_id,
          produto_descricao: item.produto_descricao,
          tipo_movimento: "saida",
          quantidade,
          data_movimentacao: data.data_requisicao,
          documento: data.numero_requisicao,
          motivo: `Requisição Almoxarifado - ${data.finalidade}`,
          localizacao_origem: "Almoxarifado",
          localizacao_destino: data.setor || data.setor_solicitante,
          responsavel: data.solicitante,
          observacoes: data.observacoes
        });

        // Atualizar estoque
        const produto = produtos.find(p => p.id === item.produto_id);
        if (produto) {
          const novoEstoque = (produto.estoque_atual || 0) - quantidade;
          if (novoEstoque < 0) {
            throw new Error(`Requisicao deixaria estoque negativo para ${produto.descricao}.`);
          }
          await updateInContext('Produto', produto.id, {
            estoque_atual: novoEstoque
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const aprovarMutation = useMutation({
    mutationFn: async ({ id, itens }) => {
      if (!contextoValido) throw new Error("Selecione grupo ou empresa antes de aprovar requisicao.");
      if (!canCreateRequisicao) throw new Error("Sem permissao para aprovar requisicao.");
      // Processar baixa no estoque para cada item
      for (const item of itens) {
        const produto = produtos.find(p => p.id === item.produto_id);
        if (produto) {
          const quantidade = Number(item.quantidade || 0);
          const novoEstoque = (produto.estoque_atual || 0) - quantidade;
          if (novoEstoque < 0) {
            throw new Error(`Aprovacao deixaria estoque negativo para ${produto.descricao}.`);
          }
          await updateInContext('Produto', produto.id, {
            estoque_atual: novoEstoque
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
    },
  });

  const resetForm = () => {
    setFormData({
      numero_requisicao: `REQ-ALM-${Date.now()}`,
      data_requisicao: new Date().toISOString().split('T')[0],
      solicitante: "",
      setor: "",
      centro_custo: "",
      itens: [{ produto_id: "", produto_descricao: "", quantidade: 1, unidade_medida: "" }],
      finalidade: "",
      observacoes: "",
      status: "Pendente"
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      itens: [...formData.itens, { produto_id: "", produto_descricao: "", quantidade: 1, unidade_medida: "" }]
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
        newItens[index].unidade_medida = produto.unidade_medida;
      }
    }
    
    setFormData({ ...formData, itens: newItens });
  };

  const statusColors = {
    'Pendente': 'bg-yellow-100 text-yellow-700',
    'Aprovada': 'bg-green-100 text-green-700',
    'Rejeitada': 'bg-red-100 text-red-700',
    'Entregue': 'bg-blue-100 text-blue-700'
  };

  const filteredRequisicoes = requisicoes.filter(r => {
    const searchLower = searchTerm.toLowerCase();
    return r.numero_requisicao?.toLowerCase().includes(searchLower) ||
      r.documento?.toLowerCase().includes(searchLower) ||
      r.solicitante?.toLowerCase().includes(searchLower) ||
      r.setor?.toLowerCase().includes(searchLower) ||
      r.centro_custo?.toLowerCase().includes(searchLower) ||
      r.finalidade?.toLowerCase().includes(searchLower) ||
      r.responsavel?.toLowerCase().includes(searchLower) ||
      r.status?.toLowerCase().includes(searchLower) ||
      r.observacoes?.toLowerCase().includes(searchLower) ||
      r.motivo?.toLowerCase().includes(searchLower) ||
      r.localizacao_destino?.toLowerCase().includes(searchLower);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nº requisição, solicitante, setor, produto, status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {canCreateRequisicao && (
          <Button
            className="bg-orange-600 hover:bg-orange-700"
            disabled={!contextoValido}
            data-permission="Estoque.Requisicoes.criar"
            onClick={() => openWindow(RequisicaoAlmoxarifadoForm, {
            windowMode: true,
            onSubmit: async (data) => {
              try {
                const user = await base44.auth.me();
                await createMutation.mutateAsync({
                  ...data,
                  solicitante: data.solicitante || user?.full_name || 'Sistema'
                });
                toast.success("✅ Requisição registrada!");
              } catch (error) {
                toast.error(error?.message || "Erro ao criar requisição");
              }
            }
          }, {
            title: '📋 Nova Requisição Almoxarifado',
            width: 900,
            height: 650
          })}
        >
            <Plus className="w-4 h-4 mr-2" />
            Nova Requisição
          </Button>
        )}

        <Dialog open={false}>
          <DialogTrigger asChild>
            <Button className="hidden">Removido</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto hidden">
            <DialogHeader>
              <DialogTitle>Requisição de Almoxarifado</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="numero_requisicao">Nº Requisição</Label>
                  <Input
                    id="numero_requisicao"
                    value={formData.numero_requisicao}
                    onChange={(e) => setFormData({ ...formData, numero_requisicao: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="data_requisicao">Data</Label>
                  <Input
                    id="data_requisicao"
                    type="date"
                    value={formData.data_requisicao}
                    onChange={(e) => setFormData({ ...formData, data_requisicao: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="solicitante">Solicitante *</Label>
                  <Input
                    id="solicitante"
                    value={formData.solicitante}
                    onChange={(e) => setFormData({ ...formData, solicitante: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="setor">Setor *</Label>
                  <Select
                    value={formData.setor}
                    onValueChange={(value) => setFormData({ ...formData, setor: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Produção">Produção</SelectItem>
                      <SelectItem value="Manutenção">Manutenção</SelectItem>
                      <SelectItem value="Administrativo">Administrativo</SelectItem>
                      <SelectItem value="Comercial">Comercial</SelectItem>
                      <SelectItem value="TI">TI</SelectItem>
                      <SelectItem value="RH">RH</SelectItem>
                      <SelectItem value="Logística">Logística</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="finalidade">Finalidade</Label>
                  <Input
                    id="finalidade"
                    value={formData.finalidade}
                    onChange={(e) => setFormData({ ...formData, finalidade: e.target.value })}
                    placeholder="Ex: Manutenção preventiva, Uso interno..."
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Itens da Requisição</Label>
                  <Button type="button" size="sm" variant="outline" onClick={handleAddItem}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {formData.itens.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 p-3 border rounded-lg">
                      <div className="col-span-7">
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
                          placeholder="Qtd"
                          value={item.quantidade}
                          onChange={(e) => handleItemChange(index, 'quantidade', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          value={item.unidade_medida}
                          readOnly
                          className="bg-slate-50"
                        />
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
                <Button type="submit" disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                  {createMutation.isPending ? 'Salvando...' : 'Criar Requisição'}
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
                <TableHead>Nº Requisição</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequisicoes.map((req) => (
                <TableRow key={req.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium font-mono text-sm">{req.numero_requisicao}</TableCell>
                  <TableCell>
                    {new Date(req.data_requisicao).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>{req.solicitante}</TableCell>
                  <TableCell>{req.setor}</TableCell>
                  <TableCell>{req.itens?.length || 0}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[req.status]}>
                      {req.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredRequisicoes.length === 0 && (
          <div className="text-center py-12">
            <PackageMinus className="w-16 h-16 mx-auto mb-4 opacity-30 text-slate-400" />
            <p className="text-slate-500">Nenhuma requisição de almoxarifado registrada</p>
          </div>
        )}
      </Card>
    </div>
  );
}
