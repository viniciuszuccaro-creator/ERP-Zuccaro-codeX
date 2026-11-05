import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calculator, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import useContextoVisual from '@/components/lib/useContextoVisual';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { central360SessionKey } from '@/api/httpApiClient';
import {
  buildCalcularComissoesInvalidateKey,
  isCalcularComissoesScopeCurrent,
  filtrarPedidosPeriodoComissao,
  agruparComissoesPorVendedor,
} from './calcularComissoesScope';

function readCalcularComissoesActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === 'string' ? session.actorId.trim() : '';
  return {
    actorId: actorId || null,
    sessionKey: central360SessionKey(session?.token),
  };
}

/**
 * Cálculo de comissões por período.
 * Escopo multiempresa: Comissao.create via createInContext (sem create unscoped).
 * Fail-closed sem Grupo/Empresa. STALE_SCOPE se ator/sessão mudar mid-loop.
 */
export default function CalcularComissoesForm({ onSubmit, onCancel, pedidos = [] }) {
  const [periodo, setPeriodo] = useState('mes');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const { actorId, sessionKey } = readCalcularComissoesActorAndSession();
  const scopeExpected = { actorId, sessionKey };

  const handleCalcularComissoes = async () => {
    try {
      if (!contextoValido) {
        toast({
          title: 'Contexto de Grupo/Empresa obrigatório para calcular comissões',
          variant: 'destructive',
        });
        return;
      }

      const hoje = new Date();
      let dataInicioCalculo = new Date();
      let dataFimCalculo = hoje;

      if (periodo === 'mes') {
        dataInicioCalculo = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      } else if (periodo === 'trimestre') {
        const trimestre = Math.floor(hoje.getMonth() / 3);
        dataInicioCalculo = new Date(hoje.getFullYear(), trimestre * 3, 1);
      } else if (periodo === 'ano') {
        dataInicioCalculo = new Date(hoje.getFullYear(), 0, 1);
      } else if (periodo === 'personalizado' && dataInicio && dataFim) {
        dataInicioCalculo = new Date(dataInicio);
        dataFimCalculo = new Date(dataFim);
      }

      const pedidosPeriodo = filtrarPedidosPeriodoComissao(pedidos, dataInicioCalculo, dataFimCalculo);

      if (pedidosPeriodo.length === 0) {
        toast({ title: '⚠️ Nenhum pedido encontrado no período selecionado', variant: 'destructive' });
        return;
      }

      const agrupadas = agruparComissoesPorVendedor(pedidosPeriodo, 5);

      let contador = 0;
      for (const dados of agrupadas) {
        if (!isCalcularComissoesScopeCurrent(scopeExpected, readCalcularComissoesActorAndSession())) {
          throw new Error('CALCULAR_COMISSOES_STALE_SCOPE');
        }
        await createInContext('Comissao', {
          vendedor: dados.vendedor,
          vendedor_id: dados.vendedor_id,
          pedido_id: dados.pedidos[0]?.id,
          numero_pedido: `Período: ${periodo}`,
          cliente: `${dados.pedidos.length} vendas`,
          data_venda: new Date().toISOString().split('T')[0],
          valor_venda: dados.total_vendas,
          percentual_comissao: dados.percentual_comissao,
          valor_comissao: dados.valor_comissao,
          status: 'Pendente',
          observacoes: `Comissão calculada automaticamente para ${dados.pedidos.length} vendas no período.`,
        });
        contador++;
      }

      toast({ title: `✅ ${contador} comissões calculadas com sucesso!` });
      queryClient.invalidateQueries({
        queryKey: buildCalcularComissoesInvalidateKey({
          groupId, empresaId, actorId, sessionKey,
        }),
      });
      onSubmit();
    } catch (error) {
      toast({ title: '❌ Erro ao calcular comissões', description: error.message, variant: 'destructive' });
    }
  };

  const pedidosDisponiveis = pedidos?.filter(p => 
    p.status === 'Aprovado' || p.status === 'Faturado' || p.status === 'Entregue'
  ) || [];

  const vendedoresUnicos = [...new Set(pedidosDisponiveis.map(p => p.vendedor).filter(Boolean))];
  const totalVendasDisponiveis = pedidosDisponiveis.reduce((sum, p) => sum + (p.valor_total || 0), 0);

  // Breakdown por vendedor
  const breakdownVendedores = vendedoresUnicos.map(vendedor => {
    const pedidosVendedor = pedidosDisponiveis.filter(p => p.vendedor === vendedor);
    const totalVendas = pedidosVendedor.reduce((sum, p) => sum + (p.valor_total || 0), 0);
    const comissao = totalVendas * 0.05;
    return {
      vendedor,
      qtdPedidos: pedidosVendedor.length,
      totalVendas,
      comissao
    };
  }).sort((a, b) => b.totalVendas - a.totalVendas);

  // Status dos pedidos
  const statusCount = pedidosDisponiveis.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  if (!contextoValido) {
    return (
      <div className="p-6 w-full h-full">
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            Selecione grupo ou empresa para calcular comissões (contexto obrigatório).
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 w-full h-full flex flex-col">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Calculator className="w-7 h-7 text-purple-600" />
        Calcular Comissões
      </h2>
      
      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* INFORMAÇÕES GERAIS DO SISTEMA */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="p-4 space-y-3">
            <h4 className="font-bold text-blue-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Dados Disponíveis no Sistema
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg border border-blue-100">
                <span className="text-xs text-slate-500 block mb-1">Total de Pedidos</span>
                <span className="font-bold text-2xl text-blue-600">{pedidos?.length || 0}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-green-100">
                <span className="text-xs text-slate-500 block mb-1">Pedidos Aprovados/Faturados</span>
                <span className="font-bold text-2xl text-green-600">{pedidosDisponiveis.length}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-purple-100">
                <span className="text-xs text-slate-500 block mb-1">Vendedores Ativos</span>
                <span className="font-bold text-2xl text-purple-600">{vendedoresUnicos.length}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-orange-100">
                <span className="text-xs text-slate-500 block mb-1">Total em Vendas</span>
                <span className="font-bold text-xl text-orange-600">
                  R$ {(totalVendasDisponiveis / 1000).toFixed(1)}k
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <Label htmlFor="periodo">Período</Label>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger id="periodo">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Mês Atual</SelectItem>
              <SelectItem value="trimestre">Trimestre Atual</SelectItem>
              <SelectItem value="ano">Ano Atual</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {periodo === 'personalizado' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dataInicio">Data Início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dataFim">Data Fim</Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>
        )}

        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 space-y-3">
            <h4 className="font-semibold text-slate-900">📊 Estimativa de Cálculo:</h4>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Pedidos Disponíveis:</span>
              <span className="font-bold text-lg text-blue-600">{pedidosDisponiveis.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Vendedores Únicos:</span>
              <span className="font-bold text-lg text-purple-600">{vendedoresUnicos.length}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm text-slate-600">Total em Vendas:</span>
              <span className="font-bold text-lg text-green-600">
                R$ {totalVendasDisponiveis.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Comissões Estimadas (5%):</span>
              <span className="font-bold text-xl text-orange-600">
                R$ {(totalVendasDisponiveis * 0.05).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h4 className="font-semibold mb-2 text-blue-900">O sistema irá:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Buscar todos os pedidos aprovados/faturados no período</li>
              <li>• Agrupar por vendedor</li>
              <li>• Calcular comissão de 5% sobre o total</li>
              <li>• Criar registros pendentes de aprovação</li>
            </ul>
          </CardContent>
        </Card>

        {/* BREAKDOWN POR VENDEDOR */}
        {breakdownVendedores.length > 0 && (
          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <CardContent className="p-4">
              <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
                👥 Breakdown por Vendedor
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {breakdownVendedores.map((v, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-purple-100 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-slate-900">{v.vendedor}</span>
                      <Badge className="bg-purple-600">{v.qtdPedidos} pedidos</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500">Total Vendas:</span>
                        <span className="font-bold text-green-600 ml-2">
                          R$ {v.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Comissão:</span>
                        <span className="font-bold text-orange-600 ml-2">
                          R$ {v.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* STATUS DOS PEDIDOS */}
        {Object.keys(statusCount).length > 0 && (
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                📋 Status dos Pedidos Incluídos
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(statusCount).map(([status, count]) => (
                  <div key={status} className="bg-white p-2 rounded-lg border border-green-100 text-center">
                    <div className="text-2xl font-bold text-green-600">{count}</div>
                    <div className="text-xs text-slate-500">{status}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* PEDIDOS INCLUÍDOS */}
        {pedidosDisponiveis.length > 0 && (
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-4">
              <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                📦 Últimos Pedidos a Serem Calculados
              </h4>
              <div className="space-y-1 max-h-48 overflow-y-auto text-xs">
                {pedidosDisponiveis.slice(0, 10).map((p, idx) => (
                  <div key={idx} className="bg-white p-2 rounded border border-blue-100 flex justify-between items-center">
                    <div className="flex gap-2 items-center">
                      <span className="font-mono font-semibold text-blue-600">#{p.numero_pedido}</span>
                      <span className="text-slate-600">{p.cliente_nome}</span>
                      <Badge variant="outline" className="text-xs">{p.status}</Badge>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-slate-500">{p.vendedor}</span>
                      <span className="font-bold text-green-600">
                        R$ {(p.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
                {pedidosDisponiveis.length > 10 && (
                  <div className="text-center text-slate-500 pt-2">
                    ... e mais {pedidosDisponiveis.length - 10} pedidos
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleCalcularComissoes} className="bg-purple-600 hover:bg-purple-700">
          <Calculator className="w-4 h-4 mr-2" />
          Calcular Comissões Agora
        </Button>
      </div>
    </div>
  );
}