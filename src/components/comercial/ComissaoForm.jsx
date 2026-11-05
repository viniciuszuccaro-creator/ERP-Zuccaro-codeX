import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Save, DollarSign, Calculator } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";

/**
 * V21.1.2: Comissão Form - Adaptado para Window Mode
 */
export default function ComissaoForm({ comissao, onSubmit, windowMode = false }) {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);

  const [formData, setFormData] = useState(comissao || {
    vendedor: '',
    vendedor_id: '',
    pedido_id: '',
    numero_pedido: '',
    cliente: '',
    data_venda: new Date().toISOString().split('T')[0],
    valor_venda: 0,
    percentual_comissao: 5,
    valor_comissao: 0,
    status: 'Pendente',
    observacoes: ''
  });

  // Escopo multiempresa: Pedido via filterInContext (sem list unscoped).
  const { data: pedidos = [], isError: isErrorPedidosComissao } = useQuery({
    queryKey: ['pedidos-comissao', groupId, empresaId],
    queryFn: () => filterInContext('Pedido', {}, '-created_date', 500),
    enabled: contextoValido,
  });

  const handlePedidoChange = (pedidoId) => {
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (pedido) {
      const valorComissao = (pedido.valor_total || 0) * (formData.percentual_comissao / 100);
      setFormData({
        ...formData,
        pedido_id: pedidoId,
        numero_pedido: pedido.numero_pedido,
        cliente: pedido.cliente_nome,
        vendedor: pedido.vendedor,
        vendedor_id: pedido.vendedor_id,
        data_venda: pedido.data_pedido,
        valor_venda: pedido.valor_total || 0,
        valor_comissao: valorComissao
      });
    }
  };

  const handlePercentualChange = (percentual) => {
    const valorComissao = formData.valor_venda * (percentual / 100);
    setFormData({
      ...formData,
      percentual_comissao: percentual,
      valor_comissao: valorComissao
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!contextoValido) {
    const blocked = (
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="p-4 text-sm text-amber-900">
          Selecione grupo ou empresa para registrar comissão.
        </CardContent>
      </Card>
    );
    if (windowMode) return <div className="w-full h-full bg-white p-6">{blocked}</div>;
    return blocked;
  }

  const content = (
    <form onSubmit={handleSubmit} className={`space-y-6 ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}>
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Comissão de Vendas
          </h3>
          {isErrorPedidosComissao && (
            <p className="text-xs text-slate-500">Pedidos indisponíveis (erro de carga ≠ zero).</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Pedido *</Label>
              <Select
                value={formData.pedido_id}
                onValueChange={handlePedidoChange}
                required
                disabled={isErrorPedidosComissao}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {pedidos.filter(p => p.status === 'Aprovado' || p.status === 'Faturado').map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.numero_pedido} - {p.cliente_nome} - R$ {(p.valor_total || 0).toLocaleString('pt-BR')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Vendedor</Label>
              <Input
                value={formData.vendedor}
                readOnly
                className="bg-slate-50"
              />
            </div>

            <div>
              <Label>Cliente</Label>
              <Input
                value={formData.cliente}
                readOnly
                className="bg-slate-50"
              />
            </div>

            <div>
              <Label>Data da Venda</Label>
              <Input
                type="date"
                value={formData.data_venda}
                readOnly
                className="bg-slate-50"
              />
            </div>

            <div>
              <Label>Valor da Venda</Label>
              <Input
                value={`R$ ${formData.valor_venda.toLocaleString('pt-BR')}`}
                readOnly
                className="bg-slate-50 font-semibold"
              />
            </div>

            <div>
              <Label>Percentual Comissão (%)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.percentual_comissao}
                  onChange={(e) => handlePercentualChange(parseFloat(e.target.value) || 0)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Calcular"
                >
                  <Calculator className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label>Valor da Comissão</Label>
              <Input
                value={`R$ ${formData.valor_comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                readOnly
                className="bg-green-50 font-bold text-green-700"
              />
            </div>

            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
                placeholder="Observações sobre a comissão..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        <Button type="submit" className="bg-green-600 hover:bg-green-700">
          <Save className="w-4 h-4 mr-2" />
          {comissao ? 'Atualizar' : 'Registrar'} Comissão
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white">{content}</div>;
  }

  return content;
}