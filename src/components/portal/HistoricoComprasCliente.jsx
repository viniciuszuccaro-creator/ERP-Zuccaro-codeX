import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Package, TrendingUp, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { isPortalClienteIdentificado } from '@/components/lib/portalClientePolicy';

/**
 * V21.5 - Histórico de Compras Inteligente
 * ✅ Produtos mais comprados
 * ✅ Frequência de compras
 * ✅ Sugestões personalizadas IA
 * ✅ Fidelidade e cashback
 */
/** @param {{clienteId?: string}} props */
export default function HistoricoComprasCliente({ clienteId }) {
  const { data: cliente } = useQuery({
    queryKey: ['cliente-historico', clienteId],
    queryFn: () => isPortalClienteIdentificado(clienteId) ? base44.entities.Cliente.filter({ id: clienteId }).then(r => r[0]) : Promise.resolve(null),
    enabled: isPortalClienteIdentificado(clienteId),
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['historico-pedidos', clienteId, cliente?.empresa_id, cliente?.group_id],
    queryFn: () => isPortalClienteIdentificado(clienteId) ? base44.entities.Pedido.filter({ cliente_id: clienteId, empresa_id: cliente?.empresa_id || undefined, group_id: cliente?.group_id || undefined }, '-data_pedido', 100) : Promise.resolve([]),
    enabled: isPortalClienteIdentificado(clienteId),
  });

  // Produtos mais comprados
  const produtosFrequencia = {};
  pedidos.forEach(pedido => {
    (pedido.itens_revenda || []).forEach(item => {
      const key = item.produto_id || item.descricao;
      if (!produtosFrequencia[key]) {
        produtosFrequencia[key] = {
          descricao: item.produto_descricao || item.descricao,
          quantidade: 0,
          valor_total: 0,
        };
      }
      produtosFrequencia[key].quantidade += item.quantidade || 0;
      produtosFrequencia[key].valor_total += item.valor_total || 0;
    });
  });

  const topProdutos = Object.values(produtosFrequencia)
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10);

  const dadosGrafico = topProdutos.map(p => ({
    produto: p.descricao.substring(0, 20),
    quantidade: p.quantidade,
  }));

  if (!isPortalClienteIdentificado(clienteId)) return <p role="status">Cliente do portal nao identificado. Operacoes indisponiveis.</p>;
  return (
    <div className="space-y-6 w-full h-full">
      {/* KPIs de Fidelidade */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total de Compras</p>
                <p className="text-3xl font-bold text-blue-600">{pedidos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Valor Total</p>
                <p className="text-2xl font-bold text-green-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    cliente?.valor_compras_12meses || 0
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Pontos Fidelidade</p>
                <p className="text-3xl font-bold text-amber-600">
                  {cliente?.pontos_fidelidade || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Produtos Mais Comprados */}
      <Card className="shadow-lg w-full">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base">Top 10 Produtos Mais Comprados</CardTitle>
        </CardHeader>
        <CardContent className="p-6 w-full">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosGrafico} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="produto" type="category" width={150} />
              <Tooltip />
              <Bar dataKey="quantidade" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Lista Detalhada */}
      <Card className="shadow-lg w-full">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base">Produtos Favoritos</CardTitle>
        </CardHeader>
        <CardContent className="p-6 w-full">
          <div className="space-y-3">
            {topProdutos.map((produto, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium">{produto.descricao}</p>
                    <p className="text-sm text-slate-600">
                      {produto.quantidade.toFixed(2)} unidades compradas
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.valor_total)}
                  </p>
                  <Badge className="bg-blue-100 text-blue-700 text-xs mt-1">
                    Top {idx + 1}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Classificação do Cliente */}
      {cliente?.classificacao_abc && (
        <Card className={`border-2 shadow-lg w-full ${
          cliente.classificacao_abc === 'A' ? 'border-yellow-500 bg-yellow-50' :
          cliente.classificacao_abc === 'B' ? 'border-blue-500 bg-blue-50' :
          'border-slate-500 bg-slate-50'
        }`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                cliente.classificacao_abc === 'A' ? 'bg-yellow-500 text-white' :
                cliente.classificacao_abc === 'B' ? 'bg-blue-500 text-white' :
                'bg-slate-500 text-white'
              }`}>
                {cliente.classificacao_abc}
              </div>
              <div>
                <p className="font-bold text-lg">
                  {cliente.classificacao_abc === 'A' && '🏆 Cliente Premium'}
                  {cliente.classificacao_abc === 'B' && '⭐ Cliente Especial'}
                  {cliente.classificacao_abc === 'C' && '✨ Cliente Regular'}
                </p>
                <p className="text-sm text-slate-600">
                  Classificação baseada no volume de compras
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
