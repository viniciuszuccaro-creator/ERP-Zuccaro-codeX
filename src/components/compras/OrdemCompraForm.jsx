import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Save, ShoppingCart, Plus, Trash2 } from "lucide-react";
import FormWrapper from "@/components/common/FormWrapper";
import { z } from "zod";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import FormErrorSummary from "@/components/common/FormErrorSummary";

/**
 * V21.1.2: Ordem Compra Form - Adaptado para Window Mode
 */
export default function OrdemCompraForm({ ordemCompra, onSubmit, windowMode = false }) {
  // React Hook Form + Zod
  const defaultValues = ordemCompra || {
    numero_oc: `OC-${Date.now()}`,
    fornecedor_id: '',
    fornecedor_nome: '',
    data_solicitacao: new Date().toISOString().split('T')[0],
    data_entrega_prevista: '',
    valor_total: 0,
    prazo_entrega_acordado: 30,
    condicao_pagamento: 'À Vista',
    forma_pagamento: 'Boleto',
    observacoes: '',
    status: 'Solicitada',
    itens: []
  };


  const [novoItem, setNovoItem] = useState({
    produto_id: '',
    descricao: '',
    quantidade_solicitada: 1,
    unidade: 'UN',
    valor_unitario: 0,
    valor_total: 0
  });

  const { empresaAtual, grupoAtual, contexto, filterInContext, carimbarContexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;

  // Zod schema (mantido)

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores', groupId, empresaId],
    queryFn: () => filterInContext('Fornecedor', {}, '-updated_date', 9999),
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos', groupId, empresaId],
    queryFn: () => filterInContext('Produto', {}, '-updated_date', 9999),
  });

  const handleAddItem = () => {
    if (!novoItem.produto_id) return;
    
    const itemComValorTotal = {
      ...novoItem,
      valor_total: novoItem.quantidade_solicitada * novoItem.valor_unitario
    };

    const current = watch('itens') || [];
    const updated = [...current, itemComValorTotal];
    setValue('itens', updated, { shouldValidate: true });
    const total = updated.reduce((sum, it) => sum + (it.valor_total || 0), 0);
    setValue('valor_total', total, { shouldValidate: false });

    setNovoItem({
      produto_id: '',
      descricao: '',
      quantidade_solicitada: 1,
      unidade: 'UN',
      valor_unitario: 0,
      valor_total: 0
    });
  };

  const handleRemoveItem = (index) => {
    const current = watch('itens') || [];
    const updated = current.filter((_, i) => i !== index);
    setValue('itens', updated, { shouldValidate: true });
    const total = updated.reduce((sum, it) => sum + (it.valor_total || 0), 0);
    setValue('valor_total', total, { shouldValidate: false });
  };

  const handleProdutoChange = (produtoId) => {
    const produto = produtos.find(p => p.id === produtoId);
    if (produto) {
      setNovoItem({
        ...novoItem,
        produto_id: produtoId,
        descricao: produto.descricao,
        unidade: produto.unidade_medida || 'UN',
        valor_unitario: produto.custo_aquisicao || 0
      });
    }
  };

  const ocSchema = z.object({
    numero_oc: z.string().min(3),
    fornecedor_id: z.string().min(1, 'Fornecedor é obrigatório'),
    fornecedor_nome: z.string().optional(),
    data_solicitacao: z.string().min(8, 'Data inválida'),
    data_entrega_prevista: z.string().optional(),
    prazo_entrega_acordado: z.number().nonnegative().default(0),
    condicao_pagamento: z.string().optional(),
    forma_pagamento: z.string().optional(),
    observacoes: z.string().optional(),
    valor_total: z.number().nonnegative().default(0),
    itens: z.array(z.object({
      produto_id: z.string().min(1, 'Produto obrigatório'),
      descricao: z.string().min(1, 'Descrição obrigatória'),
      quantidade_solicitada: z.number().positive('Quantidade > 0'),
      unidade: z.string().min(1, 'Unidade obrigatória'),
      valor_unitario: z.number().nonnegative('Valor unitário inválido'),
      valor_total: z.number().nonnegative('Valor total inválido')
    })).min(1, 'Inclua ao menos 1 item')
  });

  const { register, handleSubmit: rhfHandleSubmit, control, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(ocSchema),
    defaultValues,
  });

  const onValid = (data) => {
    onSubmit(carimbarContexto(data, 'empresa_id'));
  };

  const unifiedSubmit = React.useCallback(() => rhfHandleSubmit(onValid)(), [rhfHandleSubmit, onValid]);

  const content = (
    <FormWrapper
      onSubmit={unifiedSubmit}
      externalData={watch()}
      className={`space-y-6 w-full h-full ${windowMode ? 'p-6 overflow-auto' : ''}`}
      data-permission="Compras.OrdemCompra.criar"
      data-action="Compras.OrdemCompra.formularioJanela"
      data-context-required="group-or-company"
      data-context-mode={contexto}
    >
      <FormErrorSummary messages={Object.values(errors || {}).map(e => e?.message).filter(Boolean)} />
      <Card
        data-permission="Compras.OrdemCompra.criar"
        data-action="Compras.OrdemCompra.dados"
        data-context-required="group-or-company"
      >
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Dados da Ordem de Compra
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Número OC *</Label>
              <Input
                {...register('numero_oc')}
                data-permission="Compras.OrdemCompra.criar"
                data-action="Compras.OrdemCompra.numero"
                data-context-required="group-or-company"
              />
              {errors.numero_oc && <p className="text-red-600 text-xs mt-1">{errors.numero_oc.message}</p>}
            </div>

            <div>
              <Label>Fornecedor *</Label>
              <Controller
                control={control}
                name="fornecedor_id"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      const forn = fornecedores.find(f => f.id === v);
                      setValue('fornecedor_nome', forn?.nome || '', { shouldValidate: false });
                    }}
                  >
                    <SelectTrigger
                      data-permission="Compras.OrdemCompra.criar"
                      data-action="Compras.OrdemCompra.fornecedor"
                      data-context-required="group-or-company"
                    >
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedores.filter(f => f.status === 'Ativo').map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.fornecedor_id && <p className="text-red-600 text-xs mt-1">{errors.fornecedor_id.message}</p>}
            </div>

            <div>
              <Label>Data Solicitação *</Label>
              <Input
                type="date"
                {...register('data_solicitacao')}
                data-permission="Compras.OrdemCompra.criar"
                data-action="Compras.OrdemCompra.dataSolicitacao"
                data-context-required="group-or-company"
              />
              {errors.data_solicitacao && <p className="text-red-600 text-xs mt-1">{errors.data_solicitacao.message}</p>}
            </div>

            <div>
              <Label>Entrega Prevista</Label>
              <Input
                type="date"
                {...register('data_entrega_prevista')}
                data-permission="Compras.OrdemCompra.criar"
                data-action="Compras.OrdemCompra.entregaPrevista"
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label>Prazo Entrega (dias)</Label>
              <Input
                type="number"
                {...register('prazo_entrega_acordado', { valueAsNumber: true })}
                data-permission="Compras.OrdemCompra.criar"
                data-action="Compras.OrdemCompra.prazoEntrega"
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label>Condição Pagamento</Label>
              <Controller
                control={control}
                name="condicao_pagamento"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      data-permission="Compras.OrdemCompra.criar"
                      data-action="Compras.OrdemCompra.condicaoPagamento"
                      data-context-required="group-or-company"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="À Vista">À Vista</SelectItem>
                      <SelectItem value="30 dias">30 dias</SelectItem>
                      <SelectItem value="60 dias">60 dias</SelectItem>
                      <SelectItem value="90 dias">90 dias</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                {...register('observacoes')}
                rows={2}
                data-permission="Compras.OrdemCompra.criar"
                data-action="Compras.OrdemCompra.observacoes"
                data-context-required="group-or-company"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card
        data-permission="Compras.OrdemCompra.criar"
        data-action="Compras.OrdemCompra.itens"
        data-context-required="group-or-company"
      >
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-lg">Itens da OC</h3>
          {errors.itens && <p className="text-red-600 text-xs mt-1">{errors.itens.message}</p>}

          <div className="grid grid-cols-5 gap-3 p-4 bg-slate-50 rounded-lg">
            <div>
              <Label className="text-xs">Produto</Label>
              <Select value={novoItem.produto_id} onValueChange={handleProdutoChange}>
                <SelectTrigger
                  className="h-9 text-xs"
                  data-permission="Compras.OrdemCompra.criar"
                  data-action="Compras.OrdemCompra.itemProduto"
                  data-context-required="group-or-company"
                >
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {produtos.filter(p => p.status === 'Ativo').map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo} - {p.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Qtd</Label>
              <Input
                type="number"
                step="0.01"
                value={novoItem.quantidade_solicitada}
                onChange={(e) => setNovoItem({ ...novoItem, quantidade_solicitada: parseFloat(e.target.value) || 0 })}
                className="h-9 text-xs"
                data-permission="Compras.OrdemCompra.criar"
                data-action="Compras.OrdemCompra.itemQuantidade"
                data-context-required="group-or-company"
                data-sensitive="true"
              />
            </div>

            <div>
              <Label className="text-xs">Unidade</Label>
              <Input
                value={novoItem.unidade}
                readOnly
                className="h-9 text-xs bg-slate-100"
                data-permission="Compras.OrdemCompra.visualizar"
                data-action="Compras.OrdemCompra.itemUnidade"
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label className="text-xs">Valor Unit.</Label>
              <Input
                type="number"
                step="0.01"
                value={novoItem.valor_unitario}
                onChange={(e) => setNovoItem({ ...novoItem, valor_unitario: parseFloat(e.target.value) || 0 })}
                className="h-9 text-xs"
                data-permission="Compras.OrdemCompra.criar"
                data-action="Compras.OrdemCompra.itemValorUnitario"
                data-context-required="group-or-company"
                data-sensitive="true"
              />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Ação</Label>
              <Button
                type="button"
                onClick={handleAddItem}
                size="sm"
                className="w-full h-9 bg-green-600 hover:bg-green-700"
                data-permission="Compras.OrdemCompra.criar"
                data-action="Compras.OrdemCompra.adicionarItem"
                data-context-required="group-or-company"
                data-sensitive="true"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Produto</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Valor Unit.</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(watch('itens') || []).map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.descricao}</TableCell>
                  <TableCell>{item.quantidade_solicitada} {item.unidade}</TableCell>
                  <TableCell>R$ {item.valor_unitario?.toFixed(2)}</TableCell>
                  <TableCell className="font-bold">R$ {item.valor_total?.toFixed(2)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-600"
                      data-permission="Compras.OrdemCompra.criar"
                      data-action="Compras.OrdemCompra.removerItem"
                      data-context-required="group-or-company"
                      data-sensitive="true"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {(watch('itens') || []).length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              Adicione produtos à ordem de compra
            </div>
          )}

          <div
            className="flex justify-end p-4 bg-blue-50 rounded-lg"
            data-permission="Compras.OrdemCompra.visualizar"
            data-action="Compras.OrdemCompra.valorTotal"
            data-context-required="group-or-company"
            data-sensitive="true"
          >
            <div className="text-right">
              <p className="text-sm text-blue-700">Valor Total</p>
              <p className="text-2xl font-bold text-blue-900">
                R$ {(watch('valor_total') || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        <Button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700"
          data-permission="Compras.OrdemCompra.criar"
          data-action="Compras.OrdemCompra.confirmarJanela"
          data-context-required="group-or-company"
          data-sensitive="true"
        >
          <Save className="w-4 h-4 mr-2" />
          {ordemCompra ? 'Atualizar' : 'Criar'} Ordem de Compra
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return (
      <div
        className="w-full h-full bg-white"
        data-permission="Compras.OrdemCompra.criar"
        data-context-required="group-or-company"
        data-context-mode={contexto}
      >
        {content}
      </div>
    );
  }

  return content;
}
