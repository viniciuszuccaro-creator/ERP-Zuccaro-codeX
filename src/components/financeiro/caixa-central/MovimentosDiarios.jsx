import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import useContextoVisual from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useUser } from '@/components/lib/UserContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  DollarSign,
  Printer,
  AlertTriangle
} from 'lucide-react';

export default function MovimentosDiarios() {
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [abaOperador, setAbaOperador] = useState("todos");
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewMovimentos = hasPermission('Financeiro', 'Caixa Diario', 'visualizar') ||
    hasPermission('Financeiro', 'Caixa Central', 'visualizar') ||
    hasPermission('Financeiro', null, 'visualizar');
  const canPrintMovimentos = hasPermission('Financeiro', 'Caixa Diario', 'exportar') ||
    hasPermission('Financeiro', 'Caixa Central', 'exportar') ||
    hasPermission('Financeiro', null, 'exportar');

  const { data: movimentosCaixa = [], isLoading } = useQuery({
    queryKey: ['movimentos-caixa', dataFiltro, contextKey],
    queryFn: async () => {
      const movsCaixa = await filterInContext('CaixaMovimento', {
        data_movimento: {
          $gte: new Date(dataFiltro + 'T00:00:00').toISOString(),
          $lt: new Date(dataFiltro + 'T23:59:59').toISOString()
        },
        cancelado: false
      }, 'data_movimento');

      return movsCaixa.map(m => ({
        ...m,
        tipo: m.tipo_movimento === 'Entrada' ? 'entrada' : 'saida',
        hora: new Date(m.data_movimento).toLocaleTimeString('pt-BR'),
        valor_movimento: m.valor,
        descricao: m.descricao,
        categoria: m.origem,
        forma_recebimento: m.forma_pagamento,
        forma_pagamento: m.forma_pagamento,
        numero_documento: m.pedido_id || m.conta_receber_id || m.conta_pagar_id
      }));
    },
    enabled: contextoValido && canViewMovimentos
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-movimentos', contextKey],
    queryFn: () => filterInContext('Pedido', {}, undefined, 100),
    enabled: contextoValido && canViewMovimentos
  });

  const operadoresUnicos = [...new Set(movimentosCaixa.map(m => m.usuario_operador_nome).filter(Boolean))];
  const movimentosFiltrados = abaOperador === "todos" 
    ? movimentosCaixa 
    : movimentosCaixa.filter(m => m.usuario_operador_nome === abaOperador);

  const totalEntradas = movimentosFiltrados.filter(m => m.tipo === 'entrada').reduce((sum, m) => sum + (m.valor_movimento || 0), 0);
  const totalSaidas = movimentosFiltrados.filter(m => m.tipo === 'saida').reduce((sum, m) => sum + (m.valor_movimento || 0), 0);
  const saldoCaixa = totalEntradas - totalSaidas;

  const auditarMovimento = async ({ acao, descricao, dadosNovos, sucesso = true }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: 'Financeiro',
        entidade: 'CaixaMovimento',
        descricao,
        usuario_id: user?.id || null,
        usuario: user?.full_name || user?.email || 'Usuario local',
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        dados_novos: dadosNovos,
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar movimentos diarios:', error);
    }
  };

  const handleImprimir = async () => {
    if (!contextoValido || !canPrintMovimentos) {
      await auditarMovimento({
        acao: 'Bloqueio',
        descricao: 'Impressao de movimentos diarios bloqueada por falta de contexto ou permissao.',
        dadosNovos: { dataFiltro, operador: abaOperador, quantidade: movimentosFiltrados.length },
        sucesso: false
      });
      return;
    }
    if (!window.confirm(`Imprimir movimentos diarios de ${dataFiltro} (${movimentosFiltrados.length} registro(s))?`)) {
      await auditarMovimento({
        acao: 'Cancelamento',
        descricao: 'Impressao de movimentos diarios cancelada pelo usuario.',
        dadosNovos: { dataFiltro, operador: abaOperador, quantidade: movimentosFiltrados.length },
        sucesso: false
      });
      return;
    }
    await auditarMovimento({
      acao: 'Impressao',
      descricao: 'Impressao de movimentos diarios do caixa.',
      dadosNovos: { dataFiltro, operador: abaOperador, quantidade: movimentosFiltrados.length, group_id: groupId, empresa_id: empresaId }
    });
    window.print();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-slate-500">
          Carregando movimentos...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 w-full h-full" data-permission="Financeiro.CaixaDiario.visualizar" data-context-required="group-or-company">
      {(!contextoValido || !canViewMovimentos) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar os movimentos diarios.</AlertDescription>
        </Alert>
      )}
      {/* Header com Filtro de Data */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-slate-50 border-b py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Caixa Diário - Controle PDV
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <Input
                  type="date"
                  value={dataFiltro}
                  onChange={(e) => setDataFiltro(e.target.value)}
                  className="w-48 h-8"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleImprimir}
                disabled={!contextoValido || !canPrintMovimentos}
                data-action="MovimentosDiarios.imprimir"
                data-permission="Financeiro.CaixaDiario.exportar"
                data-context-required="group-or-company"
                data-sensitive="true"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs por Operador */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-slate-50 border-b py-2">
          <CardTitle className="text-base">Movimentos por Operador PDV</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={abaOperador} onValueChange={setAbaOperador}>
            <TabsList className="w-full justify-start border-b rounded-none bg-slate-50">
              <TabsTrigger value="todos">
                📊 Todos ({movimentosCaixa.length})
              </TabsTrigger>
              {operadoresUnicos.map(operador => {
                const movsOperador = movimentosCaixa.filter(m => m.usuario_operador_nome === operador);
                return (
                  <TabsTrigger key={operador} value={operador}>
                    👤 {operador} ({movsOperador.length})
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value={abaOperador} className="mt-0">
              {/* Resumo do Operador */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 border-b">
                <div>
                  <p className="text-sm text-slate-600">Entradas</p>
                  <p className="text-2xl font-bold text-green-600">
                    R$ {totalEntradas.toFixed(2)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {movimentosFiltrados.filter(m => m.tipo === 'entrada').length} movimentos
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Saídas</p>
                  <p className="text-2xl font-bold text-red-600">
                    R$ {totalSaidas.toFixed(2)}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {movimentosFiltrados.filter(m => m.tipo === 'saida').length} movimentos
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Saldo</p>
                  <p className={`text-2xl font-bold ${saldoCaixa >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    R$ {saldoCaixa.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cliente / Pedido</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentosFiltrados.map((mov) => {
                      const pedidoVinculado = pedidos.find(p => p.id === mov.pedido_id);

                      return (
                        <TableRow key={mov.id}>
                          <TableCell className="text-sm">{mov.hora}</TableCell>
                          <TableCell>
                            {mov.tipo === 'entrada' ? (
                              <Badge className="bg-green-100 text-green-700">
                                <ArrowUpCircle className="w-3 h-3 mr-1" />
                                Entrada
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700">
                                <ArrowDownCircle className="w-3 h-3 mr-1" />
                                Saída
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {pedidoVinculado ? (
                              <div>
                                <p className="font-semibold">{pedidoVinculado.cliente_nome}</p>
                                <p className="text-xs text-slate-500">📋 {pedidoVinculado.numero_pedido}</p>
                              </div>
                            ) : (
                              <p>{mov.descricao || '-'}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{mov.categoria}</TableCell>
                          <TableCell className="text-sm">
                            <Badge variant="outline" className="text-xs">
                              {mov.forma_recebimento || mov.forma_pagamento || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className={`font-semibold ${mov.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                            {mov.tipo === 'entrada' ? '+' : '-'} R$ {mov.valor_movimento.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {movimentosFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                          <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-30" />
                          <p>Nenhum movimento registrado</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
