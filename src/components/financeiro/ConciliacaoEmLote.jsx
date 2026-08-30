import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, CheckCircle, AlertTriangle, Filter } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import { toast } from 'sonner';

/**
 * V22.0 ETAPA 4 - Conciliação em Lote
 * Conciliação de pagamentos por critérios: pedido, NF, cliente, período
 */
export default function ConciliacaoEmLote() {
  const { filterInContext } = useContextoVisual();
  const queryClient = useQueryClient();
  const [criterio, setCriterio] = useState('pedido'); // 'pedido', 'nfe', 'cliente', 'periodo'
  const [filtro, setFiltro] = useState('');
  const [selecionados, setSelecionados] = useState([]);

  // Buscar itens para conciliação
  const { data: itens = [] } = useQuery({
    queryKey: ['conciliacao-lote', criterio, filtro],
    queryFn: async () => {
      if (!filtro) return [];
      
      const query = { status: 'Recebido' };
      
      switch (criterio) {
        case 'pedido':
          query.pedido_id = filtro;
          break;
        case 'nfe':
          query.nota_fiscal_id = filtro;
          break;
        case 'cliente':
          query.cliente = { $regex: filtro, $options: 'i' };
          break;
        case 'periodo': {
          // Buscar por período (últimos N dias)
          const dias = parseInt(filtro) || 7;
          const dataInicio = new Date();
          dataInicio.setDate(dataInicio.getDate() - dias);
          query.data_recebimento = { $gte: dataInicio.toISOString().split('T')[0] };
          break;
        }
      }
      
      return filterInContext('ContaReceber', query, '-data_recebimento', 100);
    },
  });

  // Agrupar por critério
  const grupos = itens.reduce((acc, item) => {
    let chave = '';
    switch (criterio) {
      case 'pedido':
        chave = item.pedido_id || 'Sem pedido';
        break;
      case 'nfe':
        chave = item.nota_fiscal_id || 'Sem NF-e';
        break;
      case 'cliente':
        chave = item.cliente || 'Sem cliente';
        break;
      case 'periodo':
        chave = item.data_recebimento || 'Sem data';
        break;
    }
    
    if (!acc[chave]) acc[chave] = [];
    acc[chave].push(item);
    return acc;
  }, {});

  // Mutation para conciliar
  const conciliarMutation = useMutation({
    mutationFn: async () => {
      const promises = selecionados.map(id =>
        base44.entities.ContaReceber.update(id, {
          status: 'Conciliado',
          data_conciliacao: new Date().toISOString(),
          'detalhes_pagamento.status_compensacao': 'Conciliado',
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success(`${selecionados.length} título(s) conciliado(s)!`);
      queryClient.invalidateQueries({ queryKey: ['conciliacao-lote'] });
      setSelecionados([]);
    },
    onError: () => {
      toast.error('Erro ao conciliar títulos');
    },
  });

  const toggleSelecao = (id) => {
    setSelecionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const totalSelecionado = itens
    .filter(i => selecionados.includes(i.id))
    .reduce((sum, i) => sum + (i.valor_recebido || i.valor || 0), 0);

  return (
    <div className="w-full h-full flex flex-col space-y-4 overflow-auto p-4">
      {/* Header */}
      <Card className="border-2 border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-purple-600" />
            Conciliação em Lote
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-slate-600" />
            <select
              value={criterio}
              onChange={(e) => { setCriterio(e.target.value); setFiltro(''); }}
              className="px-3 py-2 border rounded"
            >
              <option value="pedido">Por Pedido</option>
              <option value="nfe">Por NF-e</option>
              <option value="cliente">Por Cliente</option>
              <option value="periodo">Por Período</option>
            </select>
            
            {criterio === 'periodo' ? (
              <select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="flex-1 px-3 py-2 border rounded"
              >
                <option value="">Selecione o período</option>
                <option value="7">Últimos 7 dias</option>
                <option value="15">Últimos 15 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="60">Últimos 60 dias</option>
              </select>
            ) : (
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder={`Digite o ${criterio === 'cliente' ? 'nome do cliente' : criterio}...`}
                className="flex-1 px-3 py-2 border rounded"
              />
            )}
            
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Search className="w-4 h-4 mr-2" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      {itens.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-2 border-blue-300">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-slate-600">Encontrados</p>
              <p className="text-2xl font-bold text-blue-600">{itens.length}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-green-300">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-slate-600">Selecionados</p>
              <p className="text-2xl font-bold text-green-600">{selecionados.length}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-purple-300">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-slate-600">Valor Total</p>
              <p className="text-2xl font-bold text-purple-600">
                R$ {totalSelecionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grupos */}
      {Object.entries(grupos).length > 0 && (
        <div className="space-y-4">
          {Object.entries(grupos).map(([chave, itensGrupo]) => {
            const totalGrupo = itensGrupo.reduce((sum, i) => sum + (i.valor_recebido || i.valor || 0), 0);
            const todosSelec = itensGrupo.every(i => selecionados.includes(i.id));
            
            return (
              <Card key={chave}>
                <CardHeader className="bg-slate-50 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={todosSelec}
                        onCheckedChange={() => {
                          if (todosSelec) {
                            setSelecionados(prev => prev.filter(id => !itensGrupo.map(i => i.id).includes(id)));
                          } else {
                            setSelecionados(prev => [...new Set([...prev, ...itensGrupo.map(i => i.id)])]);
                          }
                        }}
                      />
                      <div>
                        <CardTitle className="text-lg">{chave}</CardTitle>
                        <p className="text-sm text-slate-600">{itensGrupo.length} título(s)</p>
                      </div>
                    </div>
                    <Badge className="bg-purple-600 text-white">
                      R$ {totalGrupo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="space-y-2">
                    {itensGrupo.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selecionados.includes(item.id) ? 'bg-green-50 border-green-300' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => toggleSelecao(item.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={selecionados.includes(item.id)} />
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">{item.descricao}</p>
                            <div className="flex items-center gap-3 text-sm text-slate-600">
                              <span>{item.cliente}</span>
                              <span>•</span>
                              <span>Recebido: {item.data_recebimento ? new Date(item.data_recebimento).toLocaleDateString('pt-BR') : '-'}</span>
                              {item.detalhes_pagamento?.status_compensacao && (
                                <>
                                  <span>•</span>
                                  <Badge variant="outline" className="text-xs">
                                    {item.detalhes_pagamento.status_compensacao}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                          <p className="text-lg font-bold text-green-600">
                            R$ {(item.valor_recebido || item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Ações */}
      {selecionados.length > 0 && (
        <Card className="border-2 border-green-500 bg-green-50 sticky bottom-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className="bg-green-600 text-white">
                  {selecionados.length} selecionado(s)
                </Badge>
                <span className="text-lg font-bold text-green-600">
                  R$ {totalSelecionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Button
                onClick={() => conciliarMutation.mutate()}
                disabled={conciliarMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {conciliarMutation.isPending ? 'Conciliando...' : 'Conciliar Selecionados'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
