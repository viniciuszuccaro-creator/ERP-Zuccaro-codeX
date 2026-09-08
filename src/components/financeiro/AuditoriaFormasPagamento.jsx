import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { Shield, AlertTriangle, CheckCircle2, Clock, User, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * AUDITORIA DE FORMAS DE PAGAMENTO V21.8
 * Rastreamento completo de alterações e uso
 */
export default function AuditoriaFormasPagamento() {
  const [filtroTipo, setFiltroTipo] = useState('todas');
  const { filterInContext, empresaAtual, grupoAtual, contexto, contextoValido } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const scopeId = empresaAtual?.id || grupoAtual?.id || 'sem-contexto';
  const canView = hasPermission('Sistema', 'Auditoria', 'visualizar')
    || hasPermission('Financeiro', 'FormaPagamento', 'visualizar');

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs-formas-pagamento', scopeId, contexto],
    queryFn: () => filterInContext('AuditLog', { entidade: 'FormaPagamento' }, '-created_date', 100),
    enabled: !!contextoValido && scopeId !== 'sem-contexto' && canView,
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ['formas-pagamento', scopeId, contexto],
    queryFn: () => filterInContext('FormaPagamento', {}, '-updated_date', 100),
    enabled: !!contextoValido && scopeId !== 'sem-contexto' && canView,
  });

  const agruparPorAcao = () => {
    const criados = auditLogs.filter(l => l.action_type === 'create').length;
    const atualizados = auditLogs.filter(l => l.action_type === 'update').length;
    const deletados = auditLogs.filter(l => l.action_type === 'delete').length;

    return { criados, atualizados, deletados, total: auditLogs.length };
  };

  const stats = agruparPorAcao();

  const logsFiltrados = filtroTipo === 'todas' 
    ? auditLogs 
    : auditLogs.filter(l => l.action_type === filtroTipo);

  const iconesPorAcao = {
    create: { icon: CheckCircle2, cor: 'text-green-600', label: 'Criação' },
    update: { icon: Edit, cor: 'text-blue-600', label: 'Atualização' },
    delete: { icon: Trash2, cor: 'text-red-600', label: 'Exclusão' }
  };

  return (
    <div className="w-full h-full p-6 space-y-6 overflow-auto">
      <div className="flex items-center gap-2">
        <Shield className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold text-slate-900">Auditoria de Formas de Pagamento</h2>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-600">Total de Eventos</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Shield className="w-8 h-8 text-slate-400 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700">Criações</p>
                <p className="text-2xl font-bold text-green-600">{stats.criados}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400 opacity-30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-700">Atualizações</p>
                <p className="text-2xl font-bold text-blue-600">{stats.atualizados}</p>
              </div>
              <Edit className="w-8 h-8 text-blue-400 opacity-30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-700">Exclusões</p>
                <p className="text-2xl font-bold text-red-600">{stats.deletados}</p>
              </div>
              <Trash2 className="w-8 h-8 text-red-400 opacity-30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Button 
              variant={filtroTipo === 'todas' ? 'default' : 'outline'}
              onClick={() => setFiltroTipo('todas')}
              size="sm"
            >
              Todas ({stats.total})
            </Button>
            <Button 
              variant={filtroTipo === 'create' ? 'default' : 'outline'}
              onClick={() => setFiltroTipo('create')}
              size="sm"
              className={filtroTipo === 'create' ? 'bg-green-600' : ''}
            >
              Criações ({stats.criados})
            </Button>
            <Button 
              variant={filtroTipo === 'update' ? 'default' : 'outline'}
              onClick={() => setFiltroTipo('update')}
              size="sm"
              className={filtroTipo === 'update' ? 'bg-blue-600' : ''}
            >
              Atualizações ({stats.atualizados})
            </Button>
            <Button 
              variant={filtroTipo === 'delete' ? 'default' : 'outline'}
              onClick={() => setFiltroTipo('delete')}
              size="sm"
              className={filtroTipo === 'delete' ? 'bg-red-600' : ''}
            >
              Exclusões ({stats.deletados})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* TIMELINE */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle>Timeline de Alterações ({logsFiltrados.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <div className="space-y-2 p-4">
              {logsFiltrados.map((log, index) => {
                const config = iconesPorAcao[log.action_type] || iconesPorAcao.update;
                const Icon = config.icon;
                const forma = formasPagamento.find(f => f.id === log.entity_id);

                return (
                  <div 
                    key={log.id} 
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center ${config.cor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-sm">
                          {config.label}: {forma?.descricao || log.entity_id}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {format(new Date(log.created_date), 'dd/MM/yy HH:mm')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <User className="w-3 h-3" />
                        <span>{log.user_email || log.created_by}</span>
                      </div>
                      {log.changes_summary && (
                        <div className="mt-2 p-2 bg-slate-50 rounded text-xs">
                          <pre className="text-slate-700 whitespace-pre-wrap">
                            {JSON.stringify(log.changes_summary, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {logsFiltrados.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Shield className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhum registro de auditoria encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ALERTAS DE SEGURANÇA */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="bg-amber-100 border-b border-amber-200">
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="w-5 h-5" />
            Alertas de Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          {stats.deletados > 0 && (
            <div className="p-3 bg-white rounded border border-red-200">
              <p className="text-sm text-red-900">
                <strong>⚠️ Atenção:</strong> {stats.deletados} forma(s) de pagamento foram excluídas recentemente. Verifique se não há impacto em transações antigas.
              </p>
            </div>
          )}
          {stats.atualizados > stats.criados * 3 && (
            <div className="p-3 bg-white rounded border border-amber-200">
              <p className="text-sm text-amber-900">
                <strong>💡 Insight:</strong> Alto número de atualizações ({stats.atualizados}). Considere revisar a configuração inicial das formas.
              </p>
            </div>
          )}
          {stats.total === 0 && (
            <div className="p-3 bg-white rounded border border-green-200">
              <p className="text-sm text-green-900">
                <strong>✅ OK:</strong> Sistema novo - nenhuma auditoria registrada ainda.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}