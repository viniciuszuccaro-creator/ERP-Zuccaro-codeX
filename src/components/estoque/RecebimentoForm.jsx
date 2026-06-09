import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Save, PackageCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import FormWrapper from "@/components/common/FormWrapper";
import { z } from 'zod';
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * V21.1.2: Recebimento Form - Adaptado para Window Mode
 */
export default function RecebimentoForm({ recebimento, onSubmit, windowMode = false }) {
  const { carimbarContexto, filterInContext, empresaAtual } = useContextoVisual();
  const schema = z.object({
    ordem_compra_id: z.string().min(1, 'OC é obrigatória'),
    data_recebimento: z.string().min(8, 'Data obrigatória'),
    itens_recebidos: z.array(z.object({
      produto_id: z.string().optional(),
      descricao: z.string().optional(),
      quantidade_solicitada: z.number().nonnegative().optional(),
      quantidade_recebida: z.number().nonnegative(),
      unidade: z.string().optional(),
      divergencia: z.boolean().optional()
    })).optional()
  });
  const [formData, setFormData] = useState(recebimento || {
    ordem_compra_id: '',
    numero_oc: '',
    fornecedor_nome: '',
    data_recebimento: new Date().toISOString().split('T')[0],
    nota_fiscal: '',
    transportadora: '',
    conferente: '',
    observacoes: '',
    itens_recebidos: []
  });

  const [novoItem, setNovoItem] = useState({
    produto_id: '',
    descricao: '',
    quantidade_solicitada: 0,
    quantidade_recebida: 0,
    unidade: 'UN',
    divergencia: false
  });

  const { data: ordensCompra = [] } = useQuery({
    queryKey: ['ordensCompra', empresaAtual?.id],
    queryFn: () => filterInContext('OrdemCompra', {}, '-updated_date', 9999),
  });

  const handleOCChange = (ocId) => {
    const oc = ordensCompra.find(o => o.id === ocId);
    if (oc) {
      setFormData({
        ...formData,
        ordem_compra_id: ocId,
        numero_oc: oc.numero_oc,
        fornecedor_nome: oc.fornecedor_nome,
        itens_recebidos: (oc.itens || []).map(item => ({
          produto_id: item.produto_id,
          descricao: item.descricao,
          quantidade_solicitada: item.quantidade_solicitada,
          quantidade_recebida: item.quantidade_solicitada,
          unidade: item.unidade,
          divergencia: false
        }))
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const content = (
    <FormWrapper
      schema={schema}
      defaultValues={formData}
      onSubmit={() => onSubmit(carimbarContexto(formData,'empresa_id'))}
      externalData={formData}
      className={`space-y-6 w-full h-full ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}
      data-permission="Estoque.Recebimento.criar"
      data-action="Estoque.Recebimento.formularioJanela"
      data-context-required="group-or-company"
    >
      <Card
        data-permission="Estoque.Recebimento.criar"
        data-action="Estoque.Recebimento.dadosCompra"
        data-context-required="group-or-company"
      >
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-green-600" />
            Recebimento de Compra
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Ordem de Compra *</Label>
              <Select
                value={formData.ordem_compra_id}
                onValueChange={handleOCChange}
                required
              >
                <SelectTrigger
                  data-permission="Estoque.Recebimento.criar"
                  data-action="Estoque.Recebimento.ordemCompra"
                  data-context-required="group-or-company"
                >
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {ordensCompra.filter(o => o.status === 'Enviada ao Fornecedor' || o.status === 'Em Processo').map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.numero_oc} - {o.fornecedor_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data Recebimento *</Label>
              <Input
                type="date"
                value={formData.data_recebimento}
                onChange={(e) => setFormData({ ...formData, data_recebimento: e.target.value })}
                data-permission="Estoque.Recebimento.criar"
                data-action="Estoque.Recebimento.data"
                data-context-required="group-or-company"
                required
              />
            </div>

            <div>
              <Label>Nota Fiscal</Label>
              <Input
                value={formData.nota_fiscal}
                onChange={(e) => setFormData({ ...formData, nota_fiscal: e.target.value })}
                data-permission="Estoque.Recebimento.criar"
                data-action="Estoque.Recebimento.notaFiscal"
                data-context-required="group-or-company"
                placeholder="NF-e número"
              />
            </div>

            <div>
              <Label>Transportadora</Label>
              <Input
                value={formData.transportadora}
                onChange={(e) => setFormData({ ...formData, transportadora: e.target.value })}
                data-permission="Estoque.Recebimento.criar"
                data-action="Estoque.Recebimento.transportadora"
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label>Conferente</Label>
              <Input
                value={formData.conferente}
                onChange={(e) => setFormData({ ...formData, conferente: e.target.value })}
                data-permission="Estoque.Recebimento.criar"
                data-action="Estoque.Recebimento.conferente"
                data-context-required="group-or-company"
                placeholder="Responsável"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card
        data-permission="Estoque.Recebimento.criar"
        data-action="Estoque.Recebimento.itens"
        data-context-required="group-or-company"
      >
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold">Itens Recebidos</h3>

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Produto</TableHead>
                <TableHead>Solicitado</TableHead>
                <TableHead>Recebido</TableHead>
                <TableHead>Divergência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formData.itens_recebidos.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.descricao}</TableCell>
                  <TableCell>{item.quantidade_solicitada} {item.unidade}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.quantidade_recebida}
                      onChange={(e) => {
                        const qtd = parseFloat(e.target.value) || 0;
                        const divergencia = qtd !== item.quantidade_solicitada;
                        const novosItens = [...formData.itens_recebidos];
                        novosItens[index] = { ...item, quantidade_recebida: qtd, divergencia };
                        setFormData({ ...formData, itens_recebidos: novosItens });
                      }}
                      className="w-24 text-sm"
                      data-permission="Estoque.Recebimento.criar"
                      data-action="Estoque.Recebimento.quantidadeRecebida"
                      data-context-required="group-or-company"
                      data-sensitive="true"
                    />
                  </TableCell>
                  <TableCell>
                    {item.divergencia && (
                      <span className="text-xs text-orange-600 font-semibold">Divergente</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {formData.itens_recebidos.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              Selecione uma ordem de compra para conferir itens
            </div>
          )}

          <div>
            <Label>Observações do Recebimento</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              data-permission="Estoque.Recebimento.criar"
              data-action="Estoque.Recebimento.observacoes"
              data-context-required="group-or-company"
              rows={3}
              placeholder="Avarias, divergências, condições da entrega..."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        <Button
          type="submit"
          className="bg-green-600 hover:bg-green-700"
          data-permission="Estoque.Recebimento.criar"
          data-action="Estoque.Recebimento.confirmarJanela"
          data-context-required="group-or-company"
          data-sensitive="true"
        >
          <Save className="w-4 h-4 mr-2" />
          Confirmar Recebimento
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return (
      <div
        className="w-full h-full bg-white"
        data-permission="Estoque.Recebimento.criar"
        data-context-required="group-or-company"
      >
        {content}
      </div>
    );
  }

  return content;
}
