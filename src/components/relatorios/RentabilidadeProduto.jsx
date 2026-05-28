
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";
import { Package, TrendingUp, Download, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import ExportMenu from "@/components/ui/ExportMenu";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function RentabilidadeProduto({ empresaId }) {
  const [periodo, setPeriodo] = useState(12);
  const [ordenacao, setOrdenacao] = useState("margem_valor");
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaSelecionadaId = empresaId || empresaAtual?.id || null;
  const contextKey = empresaSelecionadaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewRentabilidade = hasPermission("Comercial", "Rentabilidade", "visualizar") ||
    hasPermission("Comercial", "Relatorios", "visualizar") ||
    hasPermission("Financeiro", "Relatorios", "visualizar") ||
    hasPermission("Comercial", null, "visualizar");

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos', 'rentabilidade-produto', contextKey],
    queryFn: () => filterInContext('Produto', {}, 'descricao', 9999),
    enabled: contextoValido && canViewRentabilidade,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos', 'rentabilidade-produto', contextKey],
    queryFn: () => filterInContext('Pedido', {}, '-data_pedido', 9999),
    enabled: contextoValido && canViewRentabilidade,
  });

  // Calcular rentabilidade por produto
  const calcularRentabilidade = () => {
    const hoje = new Date();
    const dataCorte = new Date(hoje.getFullYear(), hoje.getMonth() - periodo, hoje.getDate());

    const porProduto = {};

    pedidos
      .filter(p => {
        const dataPedido = new Date(p.data_pedido);
        return p.status !== 'Cancelado' &&
               dataPedido >= dataCorte &&
               (!empresaSelecionadaId || p.empresa_id === empresaSelecionadaId);
      })
      .forEach(pedido => {
        const itensRevenda = pedido.itens_revenda || [];

        itensRevenda.forEach(item => {
          const key = item.produto_id || item.codigo_sku || item.descricao;
          if (!key) return;

          if (!porProduto[key]) {
            const produto = produtos.find(p => p.id === item.produto_id || p.codigo === item.codigo_sku);

            porProduto[key] = {
              produto_id: item.produto_id,
              codigo: item.codigo_sku || produto?.codigo,
              descricao: item.descricao || produto?.descricao,
              unidade: item.unidade || produto?.unidade_medida,
              classificacao_abc: produto?.classificacao_abc || 'Novo',
              grupo: produto?.grupo || 'Outros',
              quantidade_vendida: 0,
              receita_total: 0,
              custo_total: 0,
              margem_valor: 0,
              margem_percentual: 0,
              quantidade_pedidos: 0,
              preco_medio_venda: 0,
              custo_medio: produto?.custo_medio || 0,
              estoque_atual: produto?.estoque_atual || 0,
              giro_estoque: 0,
            };
          }

          const custoItem = (item.custo_unitario || 0) * (item.quantidade || 0);

          porProduto[key].quantidade_vendida += item.quantidade || 0;
          porProduto[key].receita_total += item.valor_item || 0;
          porProduto[key].custo_total += custoItem;
          porProduto[key].quantidade_pedidos += 1;
        });
      });

    // Finalizar cálculos
    return Object.values(porProduto)
      .map(p => {
        p.margem_valor = p.receita_total - p.custo_total;
        p.margem_percentual = p.receita_total > 0 ? ((p.margem_valor / p.receita_total) * 100) : 0;
        p.preco_medio_venda = p.quantidade_vendida > 0 ? p.receita_total / p.quantidade_vendida : 0;

        // Giro de estoque (vendas / estoque médio)
        const estoqueMedio = p.estoque_atual > 0 ? p.estoque_atual : 1;
        p.giro_estoque = p.quantidade_vendida / estoqueMedio;

        return p;
      })
      .filter(p => p.receita_total > 0) // Apenas produtos com vendas
      .sort((a, b) => {
        if (ordenacao === "margem_valor") return b.margem_valor - a.margem_valor;
        if (ordenacao === "margem_percentual") return b.margem_percentual - a.margem_percentual;
        if (ordenacao === "receita") return b.receita_total - a.receita_total;
        if (ordenacao === "quantidade") return b.quantidade_vendida - a.quantidade_vendida;
        return 0;
      });
  };

  const dados = calcularRentabilidade();
  const top20 = dados.slice(0, 20);

  // Totais
  const totalReceita = dados.reduce((sum, p) => sum + p.receita_total, 0);
  const totalMargem = dados.reduce((sum, p) => sum + p.margem_valor, 0);
  const margemMediaPonderada = totalReceita > 0 ? (totalMargem / totalReceita) * 100 : 0;

  // Produtos com margem negativa
  const produtosMargemNegativa = dados.filter(p => p.margem_percentual < 0);

  // Curva ABC
  const curvaABC = () => {
    const sorted = [...dados].sort((a, b) => b.receita_total - a.receita_total);
    let acumulado = 0;
    const total = sorted.reduce((sum, p) => sum + p.receita_total, 0);

    return sorted.map((p, idx) => {
      acumulado += p.receita_total;
      const percentualAcumulado = (acumulado / total) * 100;

      let classe = 'C';
      if (percentualAcumulado <= 80) classe = 'A';
      else if (percentualAcumulado <= 95) classe = 'B';

      return {
        produto: p.descricao?.substring(0, 20),
        receita: p.receita_total,
        percentualAcumulado,
        classe,
        posicao: idx + 1
      };
    }).slice(0, 30);
  };

  return (
    <div className="space-y-6 w-full h-full" data-permission="Comercial.Rentabilidade.visualizar" data-context-required="group-or-company">
      {(!contextoValido || !canViewRentabilidade) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar rentabilidade por produto.</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Rentabilidade por Produto (Curva ABC)</h2>
          <p className="text-sm text-slate-600">Classificação ABC de produtos</p>
        </div>
        <div className="flex gap-3">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2"
          >
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
            <option value={24}>24 meses</option>
          </select>
          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="margem_valor">Margem (R$)</option>
            <option value="margem_percentual">Margem (%)</option>
            <option value="receita">Receita</option>
            <option value="quantidade">Quantidade</option>
          </select>
          <ExportMenu
            data={dados.map(p => ({
              'Código': p.codigo,
              'Produto': p.descricao,
              'ABC': p.classificacao_abc,
              'Qtd Vendida': p.quantidade_vendida.toFixed(2),
              'Receita Total': `R$ ${p.receita_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              'Custo Total': `R$ ${p.custo_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              'Margem R$': `R$ ${p.margem_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              'Margem %': `${p.margem_percentual.toFixed(1)}%`,
              'Preço Médio': `R$ ${p.preco_medio_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              'Pedidos': p.quantidade_pedidos,
              'Giro Estoque': p.giro_estoque.toFixed(2)
            }))}
            fileName="rentabilidade_produtos"
            title="Rentabilidade por Produto - Curva ABC"
            module="Comercial"
            section="Rentabilidade"
            action="exportar"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">Total Produtos Vendidos</p>
              <p className="text-2xl font-bold text-blue-600">{dados.length}</p>
              <p className="text-xs text-slate-500 mt-1">no período</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">Receita Total</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-slate-600">Margem Média</p>
              <p className="text-2xl font-bold text-purple-600">
                {margemMediaPonderada.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500 mt-1">
                R$ {totalMargem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-md ${produtosMargemNegativa.length > 0 ? 'bg-red-50 border-red-200' : ''}`}>
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-red-700">Produtos com Margem Negativa</p>
              <p className="text-2xl font-bold text-red-600">{produtosMargemNegativa.length}</p>
              {produtosMargemNegativa.length > 0 && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Requer atenção
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Comparativo Receita x Custo x Margem */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Receita x Custo x Margem (Top 20)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={top20}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="descricao" angle={-45} textAnchor="end" height={120} fontSize={10} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'Margem %') return `${Number(value).toFixed(1)}%`;
                    return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="receita_total" fill="#10b981" name="Receita" />
                <Bar yAxisId="left" dataKey="custo_total" fill="#ef4444" name="Custo" />
                <Line yAxisId="right" type="monotone" dataKey="margem_percentual" stroke="#8b5cf6" strokeWidth={2} name="Margem %" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Curva ABC */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Curva ABC - Participação na Receita</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={curvaABC()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="posicao" label={{ value: 'Produtos (ordenados)', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: '% Acumulado', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === '% Acumulado') return `${Number(value).toFixed(1)}%`;
                    return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="percentualAcumulado" stroke="#3b82f6" strokeWidth={3} name="% Acumulado" />
                {/* Linhas de referência ABC */}
                <Line dataKey={() => 80} stroke="#10b981" strokeDasharray="5 5" name="Classe A (80%)" strokeWidth={1} dot={false} />
                <Line dataKey={() => 95} stroke="#f59e0b" strokeDasharray="5 5" name="Classe B (95%)" strokeWidth={1} dot={false} />
              </LineChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">Classe A (0-80%)</p>
                <p className="font-bold text-blue-900">
                  {curvaABC().filter(c => c.classe === 'A').length} produtos
                </p>
                <p className="text-xs text-blue-600 mt-1">80% da receita</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-700">Classe B (80-95%)</p>
                <p className="font-bold text-green-900">
                  {curvaABC().filter(c => c.classe === 'B').length} produtos
                </p>
                <p className="text-xs text-green-600 mt-1">15% da receita</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-xs text-yellow-700">Classe C (95-100%)</p>
                <p className="font-bold text-yellow-900">
                  {curvaABC().filter(c => c.classe === 'C').length} produtos
                </p>
                <p className="text-xs text-yellow-600 mt-1">5% da receita</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Produtos com Problema */}
      {produtosMargemNegativa.length > 0 && (
        <Card className="border-0 shadow-md bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">⚠️ Produtos com Margem Negativa</p>
                <p className="text-sm text-red-700">
                  {produtosMargemNegativa.length} produto(s) estão vendendo abaixo do custo
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Produtos: {produtosMargemNegativa.slice(0, 3).map(p => p.descricao).join(', ')}
                  {produtosMargemNegativa.length > 3 && ` e mais ${produtosMargemNegativa.length - 3}...`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela Detalhada */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Análise Detalhada - Top 20 Produtos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>#</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>ABC</TableHead>
                  <TableHead className="text-right">Qtd Vendida</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Margem R$</TableHead>
                  <TableHead className="text-right">Margem %</TableHead>
                  <TableHead className="text-right">Preço Médio</TableHead>
                  <TableHead className="text-right">Giro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top20.map((produto, idx) => (
                  <TableRow key={idx} className={`hover:bg-slate-50 ${produto.margem_percentual < 0 ? 'bg-red-50' : ''}`}>
                    <TableCell>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white ${
                        idx < 3 ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-slate-400'
                      }`}>
                        {idx + 1}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{produto.codigo || '-'}</TableCell>
                    <TableCell className="font-medium">{produto.descricao}</TableCell>
                    <TableCell>
                      <Badge className={
                        produto.classificacao_abc === 'A' ? 'bg-blue-100 text-blue-700' :
                        produto.classificacao_abc === 'B' ? 'bg-green-100 text-green-700' :
                        produto.classificacao_abc === 'C' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-slate-100 text-slate-700'
                      }>
                        {produto.classificacao_abc}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {produto.quantidade_vendida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} {produto.unidade}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      R$ {produto.receita_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      R$ {produto.custo_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${produto.margem_valor >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                      R$ {produto.margem_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${produto.margem_percentual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {produto.margem_percentual.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {produto.preco_medio_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{produto.giro_estoque.toFixed(1)}x</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
