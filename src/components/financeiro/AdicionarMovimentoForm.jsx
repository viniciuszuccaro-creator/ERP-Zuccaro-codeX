import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function AdicionarMovimentoForm({ initialData = {}, onSubmit, onCancel, empresaAtual }) {
  const [formMovimento, setFormMovimento] = useState({
    tipo: initialData.tipo || 'entrada',
    valor: initialData.valor || 0,
    forma_pagamento: initialData.forma_pagamento || 'Dinheiro',
    categoria: initialData.categoria || '',
    descricao: initialData.descricao || '',
    documento: initialData.documento || '',
    responsavel: initialData.responsavel || '',
    observacoes: initialData.observacoes || ''
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaAtual: empresaContexto, grupoAtual, createInContext } = useContextoVisual();
  const { canCreate, canEdit, hasPermission } = usePermissions();
  const empresaSelecionada = empresaAtual || empresaContexto;
  const groupId = grupoAtual?.id || empresaSelecionada?.group_id || empresaSelecionada?.grupo_id || null;
  const contextoValido = !!(empresaSelecionada?.id || groupId);
  const podeRegistrarMovimento = canCreate('Financeiro', 'Caixa') ||
    canEdit('Financeiro', 'Caixa') ||
    hasPermission('Financeiro', 'Caixa Central', 'criar') ||
    hasPermission('Financeiro', 'Movimentos de Caixa', 'criar');
  const controlesDesabilitados = !contextoValido || !podeRegistrarMovimento;

  const handleAdicionarMovimento = async () => {
    if (!contextoValido || !podeRegistrarMovimento) {
      toast({
        title: "Ação bloqueada",
        description: "Selecione um grupo/empresa e confirme sua permissão para movimentar caixa.",
        variant: "destructive"
      });
      return;
    }

    const movimento = {
      descricao: formMovimento.descricao,
      valor: formMovimento.valor,
      observacoes: formMovimento.observacoes,
      categoria: formMovimento.categoria,
      ...(empresaSelecionada?.id ? { empresa_id: empresaSelecionada.id } : {}),
      ...(groupId ? { group_id: groupId } : {})
    };

    try {
      if (formMovimento.tipo === 'entrada') {
        await createInContext('CaixaMovimento', {
          ...(empresaSelecionada?.id ? { empresa_id: empresaSelecionada.id } : {}),
          ...(groupId ? { group_id: groupId } : {}),
          data_movimento: new Date().toISOString(),
          tipo_movimento: formMovimento.categoria === 'Reforço' ? 'Reforço' : 'Entrada',
          origem: formMovimento.categoria === 'Venda' ? 'Venda Direta' : formMovimento.categoria === 'Reforço' ? 'Reforço' : 'Liquidação Título',
          forma_pagamento: formMovimento.forma_pagamento,
          valor: formMovimento.valor,
          descricao: formMovimento.descricao,
          cliente_nome: formMovimento.responsavel || 'Caixa',
          caixa_aberto: true,
          observacoes: formMovimento.observacoes
        });

        if (formMovimento.categoria !== 'Reforço') {
          await createInContext('ContaReceber', {
            ...movimento,
            cliente: formMovimento.responsavel || 'Caixa',
            data_emissao: new Date().toISOString().split('T')[0],
            data_vencimento: new Date().toISOString().split('T')[0],
            data_recebimento: new Date().toISOString().split('T')[0],
            forma_recebimento: formMovimento.forma_pagamento,
            valor_recebido: formMovimento.valor,
            status: 'Recebido',
            origem_tipo: 'manual'
          });
        }

        queryClient.invalidateQueries({ queryKey: ['movimentos-caixa'] });
        queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
        toast({ title: "✅ Entrada registrada no Caixa!" });
      } else {
        await createInContext('CaixaMovimento', {
          ...(empresaSelecionada?.id ? { empresa_id: empresaSelecionada.id } : {}),
          ...(groupId ? { group_id: groupId } : {}),
          data_movimento: new Date().toISOString(),
          tipo_movimento: formMovimento.categoria === 'Sangria' ? 'Sangria' : 'Saída',
          origem: formMovimento.categoria === 'Compra' ? 'Pagamento Título' : formMovimento.categoria === 'Sangria' ? 'Sangria' : formMovimento.categoria,
          forma_pagamento: formMovimento.forma_pagamento,
          valor: formMovimento.valor,
          descricao: formMovimento.descricao,
          fornecedor_nome: formMovimento.responsavel || 'Caixa',
          caixa_aberto: true,
          observacoes: formMovimento.observacoes
        });

        if (formMovimento.categoria !== 'Sangria') {
          await createInContext('ContaPagar', {
            ...movimento,
            fornecedor: formMovimento.responsavel || 'Caixa',
            data_emissao: new Date().toISOString().split('T')[0],
            data_vencimento: new Date().toISOString().split('T')[0],
            data_pagamento: new Date().toISOString().split('T')[0],
            forma_pagamento: formMovimento.forma_pagamento,
            valor_pago: formMovimento.valor,
            status: 'Pago'
          });
        }
        
        queryClient.invalidateQueries({ queryKey: ['movimentos-caixa'] });
        queryClient.invalidateQueries({ queryKey: ['contasPagar'] });
        toast({ title: "✅ Saída registrada no Caixa!" });
      }
      
      onSubmit();
    } catch (error) {
      toast({ title: "❌ Erro ao registrar movimento", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6 w-full h-full flex flex-col">
      <h2 className="text-2xl font-bold">
        {formMovimento.tipo === 'entrada' ? '➕ Entrada de Caixa' : '➖ Saída de Caixa'}
      </h2>
      
      <div className="flex-1 space-y-4 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Tipo *</Label>
            <Select
              value={formMovimento.tipo}
              onValueChange={(v) => setFormMovimento({ ...formMovimento, tipo: v, categoria: '' })}
              disabled={controlesDesabilitados}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">
                  <div className="flex items-center gap-2">
                    <ArrowUpCircle className="w-4 h-4 text-green-600" />
                    Entrada
                  </div>
                </SelectItem>
                <SelectItem value="saida">
                  <div className="flex items-center gap-2">
                    <ArrowDownCircle className="w-4 h-4 text-red-600" />
                    Saída
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Valor *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">R$</span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={formMovimento.valor}
                onChange={(e) => setFormMovimento({ ...formMovimento, valor: parseFloat(e.target.value) || 0 })}
                className="pl-10"
                disabled={controlesDesabilitados}
                required
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Forma de Pagamento *</Label>
            <Select
              value={formMovimento.forma_pagamento}
              onValueChange={(v) => setFormMovimento({ ...formMovimento, forma_pagamento: v })}
              disabled={controlesDesabilitados}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Dinheiro">💵 Dinheiro</SelectItem>
                <SelectItem value="PIX">🔷 PIX</SelectItem>
                <SelectItem value="Cartão Débito">💳 Cartão Débito</SelectItem>
                <SelectItem value="Cartão Crédito">💳 Cartão Crédito</SelectItem>
                <SelectItem value="Transferência">🏦 Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Categoria *</Label>
            <Select
              value={formMovimento.categoria}
              onValueChange={(v) => setFormMovimento({ ...formMovimento, categoria: v })}
              disabled={controlesDesabilitados}
              required
            >
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {formMovimento.tipo === 'entrada' ? (
                  <>
                    <SelectItem value="Venda">Venda</SelectItem>
                    <SelectItem value="Recebimento">Recebimento</SelectItem>
                    <SelectItem value="Reforço">Reforço</SelectItem>
                    <SelectItem value="Devolução">Devolução</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="Compra">Compra</SelectItem>
                    <SelectItem value="Despesa">Despesa</SelectItem>
                    <SelectItem value="Sangria">Sangria</SelectItem>
                    <SelectItem value="Devolução">Devolução</SelectItem>
                    <SelectItem value="Troco">Troco</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Descrição *</Label>
          <Input
            value={formMovimento.descricao}
            onChange={(e) => setFormMovimento({ ...formMovimento, descricao: e.target.value })}
            placeholder="Descreva o movimento..."
            disabled={controlesDesabilitados}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Documento/Referência</Label>
            <Input
              value={formMovimento.documento}
              onChange={(e) => setFormMovimento({ ...formMovimento, documento: e.target.value })}
              placeholder="Nº NF, Pedido, Cupom..."
            />
          </div>

          <div>
            <Label>Responsável</Label>
            <Input
              value={formMovimento.responsavel}
              onChange={(e) => setFormMovimento({ ...formMovimento, responsavel: e.target.value })}
              placeholder="Cliente ou Fornecedor"
            />
          </div>
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea
            value={formMovimento.observacoes}
            onChange={(e) => setFormMovimento({ ...formMovimento, observacoes: e.target.value })}
            rows={2}
          />
        </div>

        <Card className={`border-2 ${formMovimento.tipo === 'entrada' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Valor do Movimento:</p>
                <p className="text-2xl font-bold">
                  {formMovimento.tipo === 'entrada' ? '+' : '-'} R$ {formMovimento.valor.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600">Tipo:</p>
                <p className={`text-xl font-bold ${formMovimento.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                  {formMovimento.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          type="button"
          onClick={handleAdicionarMovimento}
          disabled={controlesDesabilitados}
          className={formMovimento.tipo === 'entrada' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
        >
          {formMovimento.tipo === 'entrada' ? <ArrowUpCircle className="w-4 h-4 mr-2" /> : <ArrowDownCircle className="w-4 h-4 mr-2" />}
          Registrar {formMovimento.tipo === 'entrada' ? 'Entrada' : 'Saída'}
        </Button>
      </div>
    </div>
  );
}
