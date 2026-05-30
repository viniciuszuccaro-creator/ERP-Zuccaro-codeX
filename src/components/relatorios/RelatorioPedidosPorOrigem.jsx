import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BadgeOrigemPedido from "@/components/comercial/BadgeOrigemPedido";
import DashboardCanaisOrigem from "@/components/cadastros/DashboardCanaisOrigem";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  FileText, 
  Download, 
  Eye,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { useWindow } from "@/components/lib/useWindow";
import PedidoFormCompleto from "@/components/comercial/PedidoFormCompleto";

/**
 * V21.6 - Relatório de Pedidos por Origem
 * Filtro, análise e exportação de pedidos agrupados por canal
 */
export default function RelatorioPedidosPorOrigem({ empresaId, windowMode = false }) {
  const { openWindow } = useWindow();
  const [abaAtiva, setAbaAtiva] = useState('relatorio');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [origemFiltro, setOrigemFiltro] = useState('todos');
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaSelecionadaId = empresaId || empresaAtual?.id || null;
  const contextKey = empresaSelecionadaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewRelatorio = hasPermission('Comercial', 'Relatorios', 'visualizar') ||
    hasPermission('Comercial', 'Pedidos', 'visualizar') ||
    hasPermission('Comercial', null, 'visualizar');
  const canExportRelatorio = hasPermission('Comercial', 'Relatorios', 'exportar') ||
    hasPermission('Comercial', 'Pedidos', 'exportar') ||
    hasPermission('Comercial', null, 'exportar');

  // Buscar pedidos
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos-origem', contextKey],
    queryFn: () => filterInContext('Pedido', empresaSelecionadaId ? { empresa_id: empresaSelecionadaId } : {}, '-created_date', 500),
    enabled: contextoValido && canViewRelatorio,
    initialData: [],
  });

  // Buscar clientes para referência
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-pedidos-origem', contextKey],
    queryFn: () => filterInContext('Cliente', {}, 'nome', 2000),
    enabled: contextoValido && canViewRelatorio,
    initialData: [],
  });

  // Filtrar pedidos
  const pedidosFiltrados = pedidos.filter(p => {
    let valido = true;

    if (dataInicio && p.data_pedido < dataInicio) valido = false;
    if (dataFim && p.data_pedido > dataFim) valido = false;
    if (origemFiltro !== 'todos' && p.origem_pedido !== origemFiltro) valido = false;

    return valido;
  });

  // Agrupar por origem
  const pedidosPorOrigem = pedidosFiltrados.reduce((acc, p) => {
    const origem = p.origem_pedido || 'Não Definido';
    if (!acc[origem]) {
      acc[origem] = {
        pedidos: [],
        total: 0,
        valorTotal: 0,
        aprovados: 0
      };
    }
    acc[origem].pedidos.push(p);
    acc[origem].total++;
    acc[origem].valorTotal += (p.valor_total || 0);
    if (p.status === 'Aprovado' || p.status === 'Faturado' || p.status === 'Entregue') {
      acc[origem].aprovados++;
    }
    return acc;
  }, {});

  const origens = Object.keys(pedidosPorOrigem);

  const auditarExportacao = async (sucesso = true, motivo = null) => {
    try {
      await base44.entities.AuditLog.create({
        acao: sucesso ? 'Exportacao' : 'Bloqueio',
        modulo: 'Comercial',
        entidade: 'RelatorioPedidosPorOrigem',
        descricao: sucesso
          ? 'Exportacao CSV do relatorio de pedidos por origem'
          : (motivo || 'Bloqueio de exportacao do relatorio de pedidos por origem por contexto ou RBAC'),
        usuario_id: user?.id || null,
        usuario: user?.email || user?.full_name || 'Usuario',
        empresa_id: empresaSelecionadaId,
        group_id: groupId,
        grupo_id: groupId,
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        dados_novos: {
          dataInicio,
          dataFim,
          origemFiltro,
          quantidadeOrigens: origens.length,
          quantidadePedidos: pedidosFiltrados.length,
          contextKey
        },
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar exportacao de pedidos por origem:', error);
    }
  };

  const handleExportar = async () => {
    if (!contextoValido || !canExportRelatorio) {
      await auditarExportacao(false, 'Tentativa de exportar pedidos por origem sem contexto grupo/empresa ou permissao RBAC.');
      return;
    }

    const confirmado = window.confirm(`Exportar ${origens.length} origens e ${pedidosFiltrados.length} pedidos para CSV?`);
    if (!confirmado) {
      await auditarExportacao(false, 'Exportacao CSV do relatorio de pedidos por origem cancelada pelo usuario.');
      return;
    }

    const csvContent = [
      ['Origem', 'Total Pedidos', 'Valor Total', 'Aprovados', 'Taxa Conversão', 'group_id', 'grupo_id', 'empresa_id'],
      ...origens.map(origem => {
        const dados = pedidosPorOrigem[origem];
        const taxa = dados.total > 0 ? ((dados.aprovados / dados.total) * 100).toFixed(1) : 0;
        return [
          origem,
          dados.total,
          `R$ ${dados.valorTotal.toFixed(2)}`,
          dados.aprovados,
          `${taxa}%`,
          groupId || '',
          groupId || '',
          empresaSelecionadaId || ''
        ];
      })
    ].map(row => row.join(';')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pedidos_por_origem_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    await auditarExportacao(true);
  };

  const containerClass = windowMode 
    ? "w-full h-full flex flex-col overflow-hidden" 
    : "w-full h-full";

  return (
    <div
      className={containerClass}
      data-permission="Comercial.Relatorios.visualizar"
      data-context-required="group-or-company"
    >
      {(!contextoValido || !canViewRelatorio) && (
        <Alert className="mb-4 border-amber-300 bg-amber-50">
          <AlertDescription>
            Selecione grupo ou empresa e confirme permissao para visualizar pedidos por origem.
          </AlertDescription>
        </Alert>
      )}
      
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className={windowMode ? "w-full h-full flex flex-col" : ""}>
        <div className={windowMode ? "p-6 pb-4" : "mb-4"}>
          <TabsList className="bg-slate-100">
            <TabsTrigger value="relatorio">
              <FileText className="w-4 h-4 mr-2" />
              Relatório Detalhado
            </TabsTrigger>
            <TabsTrigger value="dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard Analytics
            </TabsTrigger>
          </TabsList>

          <Button
            onClick={handleExportar}
            variant="outline"
            disabled={!contextoValido || !canExportRelatorio}
            data-action="RelatorioPedidosPorOrigem.exportarCSV"
            data-permission="Comercial.Relatorios.exportar"
            data-context-required="group-or-company"
            data-sensitive="true"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* ABA: RELATÓRIO DETALHADO */}
        <TabsContent value="relatorio" className={windowMode ? "mt-0 flex-1 overflow-auto p-6 pt-0" : "mt-0"}>
          
          {/* Filtros */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="data-inicio">Data Início</Label>
                  <Input
                    id="data-inicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="data-fim">Data Fim</Label>
                  <Input
                    id="data-fim"
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="origem-filtro">Filtrar por Origem</Label>
                  <select
                    id="origem-filtro"
                    value={origemFiltro}
                    onChange={(e) => setOrigemFiltro(e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-300 px-3"
                  >
                    <option value="todos">Todas as Origens</option>
                    {origens.map(origem => (
                      <option key={origem} value={origem}>{origem}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumo por Origem */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Resumo por Origem ({pedidosFiltrados.length} pedidos)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Aprovados</TableHead>
                    <TableHead className="text-right">Taxa Conversão</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {origens.map(origem => {
                    const dados = pedidosPorOrigem[origem];
                    const taxa = dados.total > 0 ? ((dados.aprovados / dados.total) * 100) : 0;
                    const ticketMedio = dados.total > 0 ? (dados.valorTotal / dados.total) : 0;

                    return (
                      <TableRow key={origem}>
                        <TableCell>
                          <BadgeOrigemPedido origemPedido={origem} showLock={false} />
                        </TableCell>
                        <TableCell className="text-right font-semibold">{dados.total}</TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">
                          R$ {dados.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">{dados.aprovados}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={taxa >= 70 ? 'bg-green-100 text-green-700' : taxa >= 40 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}>
                            {taxa.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-blue-600 font-semibold">
                          R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Lista de Pedidos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" />
                Pedidos Detalhados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidosFiltrados.slice(0, 50).map(pedido => (
                      <TableRow key={pedido.id}>
                        <TableCell className="font-mono text-xs">
                          {pedido.numero_pedido}
                        </TableCell>
                        <TableCell>{pedido.cliente_nome}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <BadgeOrigemPedido origemPedido={pedido.origem_pedido} />
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            pedido.status === 'Aprovado' ? 'bg-green-100 text-green-700' :
                            pedido.status === 'Rascunho' ? 'bg-slate-100 text-slate-700' :
                            pedido.status === 'Aguardando Aprovação' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }>
                            {pedido.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          R$ {(pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openWindow({
                              title: `Pedido ${pedido.numero_pedido}`,
                              component: PedidoFormCompleto,
                              props: { pedido, clientes },
                              size: 'xlarge'
                            })}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* ABA: DASHBOARD ANALYTICS */}
        <TabsContent value="dashboard" className={windowMode ? "mt-0 flex-1 overflow-auto" : "mt-0"}>
          <DashboardCanaisOrigem empresaId={empresaSelecionadaId} windowMode={windowMode} />
        </TabsContent>
      </Tabs>

    </div>
  );
}
