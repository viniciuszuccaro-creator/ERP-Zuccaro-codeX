import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import useContextoVisual from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useUser } from '@/components/lib/UserContext';
import { MapPin, TrendingUp, DollarSign, Users, Package, Award, FileDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CORES_GRAFICO = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#6366F1'];

export default function RelatorioVendasPorRegiao() {
  const [periodoSelecionado, setPeriodoSelecionado] = useState('30');
  const [vendedorSelecionado, setVendedorSelecionado] = useState('todos');
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewRelatorio = hasPermission('Comercial', 'Relatorios', 'visualizar') ||
    hasPermission('Comercial', 'Vendas', 'visualizar') ||
    hasPermission('Comercial', null, 'visualizar');
  const canExportRelatorio = hasPermission('Comercial', 'Relatorios', 'exportar') ||
    hasPermission('Comercial', 'Vendas', 'exportar') ||
    hasPermission('Comercial', null, 'exportar');

  const { data: regioes = [] } = useQuery({
    queryKey: ['regioes-atendimento', contextKey],
    queryFn: () => filterInContext('RegiaoAtendimento', {}, 'nome_regiao', 500),
    enabled: contextoValido && canViewRelatorio
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-vendas-regiao', contextKey],
    queryFn: () => filterInContext('Pedido', {}, '-data_pedido', 1000),
    enabled: contextoValido && canViewRelatorio
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-vendas-regiao', contextKey],
    queryFn: () => filterInContext('Cliente', {}, 'nome', 2000),
    enabled: contextoValido && canViewRelatorio
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores-comercial-vendas-regiao', contextKey],
    queryFn: () => filterInContext('Colaborador', { departamento: 'Comercial' }, 'nome_completo', 500),
    enabled: contextoValido && canViewRelatorio
  });

  const calcularDataLimite = () => {
    const hoje = new Date();
    const diasAtras = parseInt(periodoSelecionado);
    const dataLimite = new Date(hoje);
    dataLimite.setDate(dataLimite.getDate() - diasAtras);
    return dataLimite;
  };

  const dadosPorRegiao = useMemo(() => {
    const dataLimite = calcularDataLimite();
    const pedidosFiltrados = pedidos.filter(p => {
      const dataPedido = new Date(p.data_pedido);
      const dentroDataLimite = dataPedido >= dataLimite;
      const vendedorMatch = vendedorSelecionado === 'todos' || p.vendedor_id === vendedorSelecionado;
      return dentroDataLimite && vendedorMatch && p.status !== 'Cancelado';
    });

    const dados = regioes.map(regiao => {
      const clientesDaRegiao = clientes.filter(c => c.regiao_atendimento_id === regiao.id);
      const pedidosDaRegiao = pedidosFiltrados.filter(p => 
        clientesDaRegiao.some(c => c.id === p.cliente_id)
      );

      const valorTotal = pedidosDaRegiao.reduce((sum, p) => sum + (p.valor_total || 0), 0);
      const quantidadePedidos = pedidosDaRegiao.length;
      const ticketMedio = quantidadePedidos > 0 ? valorTotal / quantidadePedidos : 0;

      return {
        id: regiao.id,
        nome: regiao.nome_regiao,
        tipo: regiao.tipo_regiao,
        cor: regiao.cor_identificacao,
        totalClientes: clientesDaRegiao.length,
        quantidadePedidos,
        valorTotal,
        ticketMedio,
        metaMensal: regiao.comercial?.meta_vendas_mensal || 0,
        percentualMeta: regiao.comercial?.meta_vendas_mensal > 0 
          ? (valorTotal / regiao.comercial.meta_vendas_mensal) * 100 
          : 0
      };
    });

    return dados.sort((a, b) => b.valorTotal - a.valorTotal);
  }, [regioes, pedidos, clientes, periodoSelecionado, vendedorSelecionado]);

  const totaisGerais = useMemo(() => {
    return dadosPorRegiao.reduce((acc, regiao) => ({
      totalClientes: acc.totalClientes + regiao.totalClientes,
      totalPedidos: acc.totalPedidos + regiao.quantidadePedidos,
      totalVendas: acc.totalVendas + regiao.valorTotal
    }), { totalClientes: 0, totalPedidos: 0, totalVendas: 0 });
  }, [dadosPorRegiao]);

  const dadosGraficoBarras = dadosPorRegiao.map(r => ({
    nome: r.nome,
    Vendas: r.valorTotal,
    Meta: r.metaMensal,
    Pedidos: r.quantidadePedidos
  }));

  const dadosGraficoPizza = dadosPorRegiao.map(r => ({
    name: r.nome,
    value: r.valorTotal
  }));

  const auditarExportacao = async (sucesso = true) => {
    try {
      await base44.entities.AuditLog.create({
        acao: sucesso ? 'Exportacao' : 'Bloqueio',
        modulo: 'Comercial',
        entidade: 'RelatorioVendasPorRegiao',
        descricao: sucesso
          ? 'Exportacao CSV do relatorio de vendas por regiao'
          : 'Bloqueio de exportacao do relatorio de vendas por regiao por contexto ou RBAC',
        usuario_id: user?.id || null,
        usuario: user?.email || user?.full_name || 'Usuario',
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        dados_novos: {
          periodoSelecionado,
          vendedorSelecionado,
          quantidadeRegioes: dadosPorRegiao.length,
          totalVendas: totaisGerais.totalVendas
        },
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar exportacao de vendas por regiao:', error);
    }
  };

  const exportarCSV = async () => {
    if (!contextoValido || !canExportRelatorio) {
      await auditarExportacao(false);
      return;
    }

    const headers = ['Região', 'Tipo', 'Total Clientes', 'Qtd Pedidos', 'Valor Total', 'Ticket Médio', 'Meta Mensal', '% Meta'];
    const rows = dadosPorRegiao.map(r => [
      r.nome,
      r.tipo,
      r.totalClientes,
      r.quantidadePedidos,
      r.valorTotal.toFixed(2),
      r.ticketMedio.toFixed(2),
      r.metaMensal.toFixed(2),
      r.percentualMeta.toFixed(1)
    ]);

    const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vendas_por_regiao_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    await auditarExportacao(true);
  };

  return (
    <div
      className="space-y-6 w-full h-full"
      data-permission="Comercial.Relatorios.visualizar"
      data-context-required="group-or-company"
    >
      {(!contextoValido || !canViewRelatorio) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertDescription>
            Selecione grupo ou empresa e confirme permissao para visualizar vendas por regiao.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-7 h-7 text-blue-600" />
            Relatório de Vendas por Região
          </h2>
          <p className="text-sm text-slate-600 mt-1">Análise de desempenho comercial segmentado por região de atendimento</p>
        </div>
        <Button
          onClick={exportarCSV}
          variant="outline"
          disabled={!contextoValido || !canExportRelatorio}
          data-action="RelatorioVendasPorRegiao.exportarCSV"
          data-permission="Comercial.Relatorios.exportar"
          data-context-required="group-or-company"
          data-sensitive="true"
        >
          <FileDown className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Período</Label>
              <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="60">Últimos 60 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="180">Últimos 6 meses</SelectItem>
                  <SelectItem value="365">Último ano</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Vendedor</Label>
              <Select value={vendedorSelecionado} onValueChange={setVendedorSelecionado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os vendedores</SelectItem>
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Clientes</p>
                <p className="text-2xl font-bold">{totaisGerais.totalClientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Pedidos</p>
                <p className="text-2xl font-bold">{totaisGerais.totalPedidos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Vendas</p>
                <p className="text-2xl font-bold">
                  R$ {totaisGerais.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Ticket Médio</p>
                <p className="text-2xl font-bold">
                  R$ {totaisGerais.totalPedidos > 0 
                    ? (totaisGerais.totalVendas / totaisGerais.totalPedidos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    : '0,00'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Região (R$)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosGraficoBarras}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip 
                  formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Legend />
                <Bar dataKey="Vendas" fill="#3B82F6" />
                <Bar dataKey="Meta" fill="#94A3B8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Vendas (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosGraficoPizza}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dadosGraficoPizza.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Região</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dadosPorRegiao.map((regiao, index) => (
              <div key={regiao.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded" 
                      style={{ backgroundColor: regiao.cor || CORES_GRAFICO[index % CORES_GRAFICO.length] }}
                    />
                    <div>
                      <p className="font-bold text-lg">{regiao.nome}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{regiao.tipo}</Badge>
                        <Badge className="bg-blue-100 text-blue-700 text-xs">
                          {regiao.totalClientes} clientes
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {regiao.metaMensal > 0 && (
                    <div className="text-right">
                      <Badge className={
                        regiao.percentualMeta >= 100 ? 'bg-green-100 text-green-700' :
                        regiao.percentualMeta >= 70 ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }>
                        {regiao.percentualMeta.toFixed(1)}% da meta
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Pedidos</p>
                    <p className="text-xl font-bold">{regiao.quantidadePedidos}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Valor Total</p>
                    <p className="text-xl font-bold text-green-600">
                      R$ {regiao.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Ticket Médio</p>
                    <p className="text-xl font-bold text-blue-600">
                      R$ {regiao.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Meta Mensal</p>
                    <p className="text-xl font-bold text-slate-700">
                      {regiao.metaMensal > 0 
                        ? `R$ ${regiao.metaMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : 'Não definida'
                      }
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {dadosPorRegiao.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <MapPin className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhuma região cadastrada ou sem vendas no período</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Análise de Performance */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50">
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-600" />
            Top 3 Regiões
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            {dadosPorRegiao.slice(0, 3).map((regiao, index) => (
              <div key={regiao.id} className="text-center p-4 border rounded-lg bg-gradient-to-br from-white to-slate-50">
                <div className="text-4xl mb-2">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                </div>
                <p className="font-bold text-lg mb-1">{regiao.nome}</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {regiao.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {regiao.quantidadePedidos} pedidos • {regiao.totalClientes} clientes
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
