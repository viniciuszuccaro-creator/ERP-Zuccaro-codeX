import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

/**
 * V22.0 ETAPA 4 - Auditoria de Liquidações
 * Rastreamento completo de todas as liquidações realizadas
 */
export default function AuditoriaLiquidacoes() {
  const { filterInContext, empresaAtual, grupoAtual, contexto, contextoValido } = useContextoVisual();
  const scopeId = empresaAtual?.id || grupoAtual?.id || 'sem-contexto';

  const { data: auditorias = [] } = useQuery({
    queryKey: ['auditoria-liquidacoes', scopeId, contexto],
    queryFn: () => filterInContext('AuditLog', {
      modulo: 'Financeiro',
      acao: { $in: ['Edição', 'Criação'] },
      descricao: { $regex: 'liquidação|baixa|recebimento|pagamento', $options: 'i' }
    }, '-data_hora', 100),
    enabled: !!contextoValido && scopeId !== 'sem-contexto',
  });

  // Buscar ordens de liquidação
  const { data: ordensLiquidacao = [] } = useQuery({
    queryKey: ['ordens-liquidacao-auditoria', scopeId, contexto],
    queryFn: () => filterInContext('CaixaOrdemLiquidacao', {}, '-created_date', 50),
    enabled: !!contextoValido && scopeId !== 'sem-contexto',
  });

  const estatisticas = {
    totalLiquidacoes: auditorias.length,
    recebimentos: auditorias.filter(a => a.descricao?.includes('recebimento')).length,
    pagamentos: auditorias.filter(a => a.descricao?.includes('pagamento')).length,
    ordensProcessadas: ordensLiquidacao.filter(o => o.status === 'Processado').length,
    ordensPendentes: ordensLiquidacao.filter(o => o.status === 'Pendente').length,
  };

  return (
    <div className="w-full h-full flex flex-col space-y-4 overflow-auto p-4">
      {/* Header */}
      <Card className="border-2 border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            Auditoria de Liquidações
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-2 border-blue-300">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-slate-600 mb-1">Total</p>
            <p className="text-3xl font-bold text-blue-600">{estatisticas.totalLiquidacoes}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-300">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-slate-600 mb-1">Recebimentos</p>
            <p className="text-3xl font-bold text-green-600">{estatisticas.recebimentos}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-red-300">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-slate-600 mb-1">Pagamentos</p>
            <p className="text-3xl font-bold text-red-600">{estatisticas.pagamentos}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-purple-300">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-slate-600 mb-1">Processadas</p>
            <p className="text-3xl font-bold text-purple-600">{estatisticas.ordensProcessadas}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-orange-300">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-slate-600 mb-1">Pendentes</p>
            <p className="text-3xl font-bold text-orange-600">{estatisticas.ordensPendentes}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ordens de Liquidação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ordens de Liquidação Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-auto">
            {ordensLiquidacao.map((ordem) => (
              <div key={ordem.id} className="p-3 border rounded-lg hover:bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {ordem.tipo_operacao === 'Recebimento' ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <DollarSign className="w-4 h-4 text-red-600" />
                    )}
                    <span className="font-semibold text-slate-900">{ordem.tipo_operacao}</span>
                    <Badge variant="outline" className="text-xs">
                      {ordem.origem}
                    </Badge>
                  </div>
                  <Badge className={ordem.status === 'Processado' ? 'bg-green-600 text-white' : 'bg-orange-600 text-white'}>
                    {ordem.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600">Valor Total</p>
                    <p className={`font-bold ${ordem.tipo_operacao === 'Recebimento' ? 'text-green-600' : 'text-red-600'}`}>
                      R$ {(ordem.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Forma Pretendida</p>
                    <p className="font-semibold text-slate-900">{ordem.forma_pagamento_pretendida}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Data da Ordem</p>
                    <p className="font-semibold text-slate-900">
                      {ordem.data_ordem ? new Date(ordem.data_ordem).toLocaleString('pt-BR') : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Títulos Vinculados</p>
                    <p className="font-semibold text-slate-900">{ordem.titulos_vinculados?.length || 0}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Timeline de Auditorias */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timeline de Liquidações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-auto">
            {auditorias.map((audit) => (
              <div key={audit.id} className="flex items-start gap-3 p-3 border-l-4 border-blue-500 bg-slate-50 rounded">
                <Calendar className="w-5 h-5 text-blue-600 mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-900">{audit.descricao}</p>
                    <Badge className="bg-blue-600 text-white text-xs">{audit.acao}</Badge>
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p>Usuário: {audit.usuario}</p>
                    <p>Módulo: {audit.modulo} • Entidade: {audit.entidade}</p>
                    <p className="text-xs text-slate-500">
                      {audit.data_hora ? new Date(audit.data_hora).toLocaleString('pt-BR') : '-'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}