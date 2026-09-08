import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, DollarSign, Filter } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { toast } from 'sonner';

/**
 * V22.0 ETAPA 4 - Liquidação em Lote
 * Permite liquidar múltiplas contas simultaneamente com diferentes critérios
 */
export default function LiquidacaoEmLote({ onClose }) {
  const { filterInContext, updateInContext, empresaAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState('receber'); // 'receber' ou 'pagar'
  const [selecionados, setSelecionados] = useState([]);
  const [filtros, setFiltros] = useState({
    forma: 'todos',
    cliente: '',
    vencimento: 'todos',
  });

  // Buscar contas pendentes
  const { data: contas = [] } = useQuery({
    queryKey: ['liquidacao-lote', tipo, filtros],
    queryFn: () => {
      const query = { status: 'Pendente' };
      if (filtros.forma !== 'todos') {
        query[tipo === 'receber' ? 'forma_recebimento' : 'forma_pagamento'] = filtros.forma;
      }
      if (filtros.cliente) {
        query[tipo === 'receber' ? 'cliente' : 'fornecedor'] = { $regex: filtros.cliente, $options: 'i' };
      }
      return filterInContext(tipo === 'receber' ? 'ContaReceber' : 'ContaPagar', query, '-data_vencimento', 100);
    },
  });

  // Mutation para liquidar em lote
  const liquidarMutation = useMutation({
    mutationFn: async () => {
      const entity = tipo === 'receber' ? 'ContaReceber' : 'ContaPagar';
      const podeBaixar = tipo === 'receber'
        ? (hasPermission('Financeiro', 'ContaReceber', 'receber') || hasPermission('Financeiro', 'ContaReceber', 'baixar') || hasPermission('Financeiro', 'ContaReceber', 'liquidar'))
        : (hasPermission('Financeiro', 'ContaPagar', 'pagar') || hasPermission('Financeiro', 'ContaPagar', 'baixar') || hasPermission('Financeiro', 'ContaPagar', 'liquidar'));
      if (!podeBaixar) {
        throw new Error('Sem permissao para baixa manual.');
      }
      if (!empresaAtual?.id) {
        throw new Error('Selecione a empresa do pagamento.');
      }
      const campo = tipo === 'receber' ? 'data_recebimento' : 'data_pagamento';
      const atualizados = [];
      for (const id of selecionados) {
        const atual = contas.find((conta) => conta.id === id);
        if (!atual) continue;
        const statusAtual = String(atual.status || '').toLowerCase();
        if ((tipo === 'receber' && ['recebido', 'liquidado', 'baixado', 'conciliado'].includes(statusAtual))
          || (tipo === 'pagar' && ['pago', 'liquidado', 'baixado'].includes(statusAtual))) {
          atualizados.push(atual);
          continue;
        }
        const atualizado = await updateInContext(entity, id, {
          status: tipo === 'receber' ? 'Recebido' : 'Pago',
          [campo]: new Date().toISOString().split('T')[0],
          empresa_id: empresaAtual.id,
          ...(tipo === 'receber'
            ? { valor_recebido: atual.valor_recebido ?? atual.valor }
            : { valor_pago: atual.valor_pago ?? atual.valor }),
        });
        atualizados.push(atualizado);
      }
      return atualizados;
    },
    onSuccess: () => {
      toast.success(`${selecionados.length} título(s) liquidado(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['liquidacao'] });
      setSelecionados([]);
      onClose();
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao liquidar títulos');
    },
  });

  const toggleSelecao = (id) => {
    setSelecionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selecionarTodos = () => {
    if (selecionados.length === contas.length) {
      setSelecionados([]);
    } else {
      setSelecionados(contas.map(c => c.id));
    }
  };

  const totalSelecionado = contas
    .filter(c => selecionados.includes(c.id))
    .reduce((sum, c) => sum + (c.valor || 0), 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
            Liquidação em Lote
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Tipo e Filtros */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Filter className="w-5 h-5 text-slate-600" />
            <div className="flex gap-2">
              <Button
                variant={tipo === 'receber' ? 'default' : 'outline'}
                onClick={() => setTipo('receber')}
                size="sm"
              >
                A Receber
              </Button>
              <Button
                variant={tipo === 'pagar' ? 'default' : 'outline'}
                onClick={() => setTipo('pagar')}
                size="sm"
              >
                A Pagar
              </Button>
            </div>
            <select
              value={filtros.forma}
              onChange={(e) => setFiltros({ ...filtros, forma: e.target.value })}
              className="px-3 py-1 border rounded"
            >
              <option value="todos">Todas as formas</option>
              <option value="PIX">PIX</option>
              <option value="Boleto">Boleto</option>
              <option value="Cartão Crédito">Cartão Crédito</option>
              <option value="Cartão Débito">Cartão Débito</option>
              <option value="Dinheiro">Dinheiro</option>
            </select>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 border rounded-lg bg-blue-50">
              <p className="text-sm text-slate-600">Total Disponível</p>
              <p className="text-xl font-bold text-blue-600">{contas.length}</p>
            </div>
            <div className="p-3 border rounded-lg bg-green-50">
              <p className="text-sm text-slate-600">Selecionados</p>
              <p className="text-xl font-bold text-green-600">{selecionados.length}</p>
            </div>
            <div className="p-3 border rounded-lg bg-purple-50">
              <p className="text-sm text-slate-600">Valor Total</p>
              <p className="text-xl font-bold text-purple-600">
                R$ {totalSelecionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Ação de seleção */}
          <div className="flex items-center gap-2 p-2 border rounded-lg">
            <Checkbox
              checked={selecionados.length === contas.length && contas.length > 0}
              onCheckedChange={selecionarTodos}
            />
            <span className="text-sm font-semibold">Selecionar/Desmarcar Todos</span>
          </div>

          {/* Lista de contas */}
          <div className="space-y-2">
            {contas.map((conta) => (
              <div
                key={conta.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selecionados.includes(conta.id) ? 'bg-green-50 border-green-300' : 'hover:bg-slate-50'
                }`}
                onClick={() => toggleSelecao(conta.id)}
              >
                <div className="flex items-center gap-3">
                  <Checkbox checked={selecionados.includes(conta.id)} />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{conta.descricao}</p>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <span>{tipo === 'receber' ? conta.cliente : conta.fornecedor}</span>
                      <span>•</span>
                      <span>Venc: {conta.data_vencimento ? new Date(conta.data_vencimento).toLocaleDateString('pt-BR') : '-'}</span>
                      <span>•</span>
                      <span>{conta.forma_recebimento || conta.forma_pagamento}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${tipo === 'receber' ? 'text-green-600' : 'text-red-600'}`}>
                      R$ {(conta.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer com ações */}
        <div className="flex items-center justify-between p-4 border-t">
          <div>
            <Badge className="bg-purple-600 text-white">
              {selecionados.length} selecionado(s) • R$ {totalSelecionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => liquidarMutation.mutate()}
              disabled={selecionados.length === 0 || liquidarMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              {liquidarMutation.isPending ? 'Processando...' : `Liquidar ${selecionados.length} Título(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}