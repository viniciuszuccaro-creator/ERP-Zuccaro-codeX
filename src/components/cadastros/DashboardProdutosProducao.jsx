import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  Factory, Package, TrendingUp, AlertCircle,
  BarChart3, Zap, CheckCircle2, ArrowUpRight
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.6 - DASHBOARD DE PRODUTOS EM PRODUÇÃO
 * Análise completa de produtos configurados para manufatura
 * ✅ KPIs de produção
 * ✅ Análise por tipo de aço
 * ✅ Top produtos mais usados
 * ✅ Alertas de estoque crítico
 * ✅ Integração com Ordens de Produção
 */
export default function DashboardProdutosProducao({ onAbrirConversao }) {
  const { empresaAtual, grupoAtual, contexto, filterInContext } = useContextoVisual();
  const { hasPermission, canEdit } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === 'empresa' ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeVisualizarProduto = hasPermission('Cadastros', 'Produto', 'visualizar') || hasPermission('Estoque', 'Produto', 'visualizar') || hasPermission('Producao', 'Produto', 'visualizar') || hasPermission('Cadastros', null, 'visualizar') || hasPermission('Estoque', null, 'visualizar');
  const podeEditarProduto = canEdit('Cadastros', 'Produto') || canEdit('Estoque', 'Produto') || canEdit('Producao', 'Produto') || canEdit('Cadastros', null) || canEdit('Estoque', null);
  const consultasHabilitadas = contextoValido && podeVisualizarProduto;

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-producao', groupId, empresaId, contexto],
    queryFn: () => filterInContext('Produto', { tipo_item: 'Matéria-Prima Produção' }, 'descricao', 9999),
    enabled: consultasHabilitadas,
    staleTime: 120000,
  });

  const { data: ordensProducao = [] } = useQuery({
    queryKey: ['ordens-producao-dashboard-produtos', groupId, empresaId, contexto],
    queryFn: () => filterInContext('OrdemProducao', {}, '-created_date', 100),
    enabled: consultasHabilitadas,
    staleTime: 120000,
  });

  // Análises
  const produtosAtivos = produtos.filter(p => p.status === 'Ativo');
  const bitolas = produtos.filter(p => p.eh_bitola);
  const estoqueTotal = produtos.reduce((sum, p) => sum + (p.estoque_atual || 0), 0);
  const produtosCriticos = produtos.filter(p => 
    (p.estoque_atual || 0) <= (p.estoque_minimo || 0) && p.status === 'Ativo'
  );

  // Análise por tipo de aço
  const porTipoAco = {};
  bitolas.forEach(b => {
    const tipo = b.tipo_aco || 'Outros';
    porTipoAco[tipo] = (porTipoAco[tipo] || 0) + 1;
  });

  const dadosTipoAco = Object.entries(porTipoAco).map(([tipo, count]) => ({
    name: tipo,
    value: count
  }));

  // Top 5 produtos mais usados
  const usoProdutos = {};
  ordensProducao.forEach(op => {
    op.itens?.forEach(item => {
      if (item.produto_id) {
        usoProdutos[item.produto_id] = (usoProdutos[item.produto_id] || 0) + (item.quantidade || 0);
      }
    });
  });

  const top5Produtos = Object.entries(usoProdutos)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([produtoId, quantidade]) => {
      const produto = produtos.find(p => p.id === produtoId);
      return {
        nome: produto?.descricao || 'Desconhecido',
        quantidade: quantidade,
        unidade: produto?.unidade_principal || 'UN'
      };
    });

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="w-full h-full space-y-6" data-permission="Cadastros.Produto.visualizar" data-context-required="true">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Factory className="w-8 h-8 text-orange-600" />
            Dashboard de Produtos em Produção
          </h2>
          <p className="text-sm text-slate-600">Análise completa de matérias-primas</p>
        </div>
        
        {onAbrirConversao && (
          <Button
            onClick={onAbrirConversao}
            disabled={!contextoValido || !podeEditarProduto}
            className="bg-orange-600 hover:bg-orange-700"
            data-permission="Cadastros.Produto.editar"
            data-action="abrir-conversao-producao"
            data-sensitive
          >
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Converter Produtos
          </Button>
        )}
      </div>

      {(!contextoValido || !podeVisualizarProduto) && (
        <Alert variant="destructive">
          <AlertCircle className="w-5 h-5" />
          <AlertDescription>
            Dashboard de produtos em produção exige contexto de grupo/empresa e permissão para visualizar produtos.
          </AlertDescription>
        </Alert>
      )}

      {/* Alertas Criticos */}
      {produtosCriticos.length > 0 && (
        <Alert className="border-red-300 bg-red-50">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <AlertDescription>
            <p className="font-semibold text-red-900 mb-2">
              ⚠️ {produtosCriticos.length} produto(s) com estoque crítico
            </p>
            <div className="space-y-1 text-sm text-red-800">
              {produtosCriticos.slice(0, 3).map(p => (
                <p key={p.id}>• {p.descricao}: {p.estoque_atual || 0} {p.unidade_principal}</p>
              ))}
              {produtosCriticos.length > 3 && (
                <p className="text-xs">... e mais {produtosCriticos.length - 3}</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs Principais */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Package className="w-8 h-8 text-blue-600" />
              <Badge className="bg-blue-600 text-white">TOTAL</Badge>
            </div>
            <p className="text-3xl font-bold text-blue-700">{produtosAtivos.length}</p>
            <p className="text-sm text-slate-600 mt-1">Produtos Ativos</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Zap className="w-8 h-8 text-purple-600" />
              <Badge className="bg-purple-600 text-white">BITOLAS</Badge>
            </div>
            <p className="text-3xl font-bold text-purple-700">{bitolas.length}</p>
            <p className="text-sm text-slate-600 mt-1">Bitolas de Aço</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <Badge className="bg-green-600 text-white">ESTOQUE</Badge>
            </div>
            <p className="text-3xl font-bold text-green-700">
              {(estoqueTotal / 1000).toFixed(1)}
            </p>
            <p className="text-sm text-slate-600 mt-1">Toneladas (TON)</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <AlertCircle className="w-8 h-8 text-orange-600" />
              <Badge className="bg-orange-600 text-white">ALERTA</Badge>
            </div>
            <p className="text-3xl font-bold text-orange-700">{produtosCriticos.length}</p>
            <p className="text-sm text-slate-600 mt-1">Estoque Crítico</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-6">
        {/* Gráfico de Tipos de Aço */}
        <Card className="border-slate-200">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-base">🔧 Distribuição por Tipo de Aço</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {dadosTipoAco.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={dadosTipoAco}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {dadosTipoAco.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <p>Sem bitolas cadastradas</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top 5 Produtos Mais Usados */}
        <Card className="border-slate-200">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-base">🏆 Top 5 Produtos Mais Usados</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {top5Produtos.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={top5Produtos}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name, props) => [
                      `${value} ${props.payload.unidade}`, 
                      'Quantidade'
                    ]}
                  />
                  <Bar dataKey="quantidade" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Sem dados de produção ainda</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lista de Produtos Críticos */}
      {produtosCriticos.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="border-b bg-red-100">
            <CardTitle className="text-base text-red-900">
              🚨 Produtos com Estoque Crítico
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-red-200">
              {produtosCriticos.map((produto) => (
                <div key={produto.id} className="p-4 hover:bg-red-100 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-red-900">{produto.descricao}</p>
                      <div className="flex gap-4 text-xs text-red-700 mt-1">
                        <span>Atual: {produto.estoque_atual || 0} {produto.unidade_principal}</span>
                        <span>Mínimo: {produto.estoque_minimo || 0} {produto.unidade_principal}</span>
                        {produto.eh_bitola && (
                          <Badge className="bg-blue-600 text-white">
                            {produto.tipo_aco} {produto.bitola_diametro_mm}mm
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge className="bg-red-600 text-white">
                      CRÍTICO
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo Geral */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-purple-900 text-lg">Sistema de Produção Configurado</p>
              <p className="text-sm text-purple-700">
                {produtosAtivos.length} produto(s) disponíveis para Ordens de Produção
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-purple-700">{bitolas.length}</p>
              <p className="text-xs text-slate-600">Bitolas Ativas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}