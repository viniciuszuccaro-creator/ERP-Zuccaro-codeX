import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity, 
  Bolt, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Cpu,
  HardDrive
} from 'lucide-react';
import { calcularMetricas } from '../lib/usePerformanceMonitor';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

/**
 * Dashboard de Performance e APM
 */
export default function DashboardPerformance({ empresaId, grupoId }) {
  const [periodo, setPeriodo] = useState('24h');
  const [moduloFiltro, setModuloFiltro] = useState('todos');
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const grupoAtivoId = grupoId || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem('group_atual_id'); } catch { return null; }
  })();
  const empresaAtivaId = empresaId || empresaAtual?.id || null;
  const scopeId = empresaAtivaId || grupoAtivoId || 'sem-contexto';
  const contextoValido = scopeId !== 'sem-contexto';

  const dataInicio = new Date();
  if (periodo === '1h') dataInicio.setHours(dataInicio.getHours() - 1);
  else if (periodo === '24h') dataInicio.setHours(dataInicio.getHours() - 24);
  else if (periodo === '7d') dataInicio.setDate(dataInicio.getDate() - 7);
  else if (periodo === '30d') dataInicio.setDate(dataInicio.getDate() - 30);

  // Logs de performance
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['logs-performance', scopeId, periodo],
    queryFn: async () => {
      const result = await filterInContext('LogPerformance', {}, '-timestamp', 1000);
      
      return result.filter(log => new Date(log.timestamp) >= dataInicio);
    },
    enabled: contextoValido,
    refetchInterval: 30000 // 30 segundos
  });

  // Alertas ativos
  const { data: alertas = [] } = useQuery({
    queryKey: ['alertas-performance', scopeId],
    queryFn: async () => {
      const filter = {
        ...(empresaAtivaId ? { empresa_id: empresaAtivaId } : { group_id: grupoAtivoId }),
        status: { $in: ['Novo', 'Investigando', 'Em Correção'] }
      };

      const result = await filterInContext(
        'AlertaPerformance',
        filter,
        '-data_hora',
        50
      );
      
      return result;
    },
    enabled: contextoValido,
    refetchInterval: 30000
  });

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!contextoValido) {
    return (
      <div className="w-full h-full p-6 overflow-auto" data-context-required="true">
        <Alert className="border-yellow-300 bg-yellow-50">
          <AlertTriangle className="w-5 h-5 text-yellow-700" />
          <AlertDescription className="text-sm text-yellow-900">
            Selecione Grupo ou Empresa para visualizar o dashboard de performance.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Filtrar por módulo
  const logsFiltrados = moduloFiltro === 'todos' 
    ? logs 
    : logs.filter(l => l.modulo === moduloFiltro);

  // Métricas gerais
  const metricas = calcularMetricas(logsFiltrados);

  // Queries mais lentas
  const queriesLentas = logs
    .filter(l => l.tipo_operacao === 'query' && l.lento)
    .sort((a, b) => b.duracao_ms - a.duracao_ms)
    .slice(0, 10);

  // APIs mais lentas
  const apisLentas = logs
    .filter(l => l.tipo_operacao === 'api_call' && l.lento)
    .sort((a, b) => b.duracao_ms - a.duracao_ms)
    .slice(0, 10);

  // Erros
  const erros = logs.filter(l => l.erro);

  // Por módulo
  const porModulo = {};
  logs.forEach(log => {
    if (!porModulo[log.modulo]) {
      porModulo[log.modulo] = [];
    }
    porModulo[log.modulo].push(log);
  });

  const modulosMetricas = Object.entries(porModulo).map(([modulo, logsModulo]) => ({
    modulo,
    ...calcularMetricas(logsModulo)
  })).sort((a, b) => b.duracao_media_ms - a.duracao_media_ms);

  // Alertas por severidade
  const alertasCriticos = alertas.filter(a => a.severidade === 'Critical').length;
  const alertasErro = alertas.filter(a => a.severidade === 'Error').length;
  const alertasWarning = alertas.filter(a => a.severidade === 'Warning').length;

  return (
    <div className="w-full h-full space-y-6 p-6 overflow-auto" data-context-required="true">
      {/* Status Banner */}
      <Alert className={
        alertasCriticos > 0 ? 'border-red-300 bg-red-50' :
        alertasErro > 0 ? 'border-orange-300 bg-orange-50' :
        'border-green-300 bg-green-50'
      }>
        <Activity className={`w-5 h-5 ${
          alertasCriticos > 0 ? 'text-red-600' :
          alertasErro > 0 ? 'text-orange-600' :
          'text-green-600'
        }`} />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-semibold ${
                alertasCriticos > 0 ? 'text-red-900' :
                alertasErro > 0 ? 'text-orange-900' :
                'text-green-900'
              }`}>
                {alertasCriticos > 0 ? '🚨 Alertas Críticos Detectados' :
                 alertasErro > 0 ? '⚠️ Problemas de Performance' :
                 '✅ Sistema Operando Normalmente'
                }
              </p>
              <p className="text-sm text-slate-700 mt-1">
                {alertas.length} alerta(s) ativo(s) • Monitoramento em tempo real
              </p>
            </div>
            <div className="flex gap-2">
              {alertasCriticos > 0 && (
                <Badge className="bg-red-600">{alertasCriticos} Críticos</Badge>
              )}
              {alertasErro > 0 && (
                <Badge className="bg-orange-600">{alertasErro} Erros</Badge>
              )}
              {alertasWarning > 0 && (
                <Badge className="bg-yellow-600">{alertasWarning} Avisos</Badge>
              )}
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
          data-action="Performance.filtro.periodo"
        >
          <option value="1h">Última Hora</option>
          <option value="24h">Últimas 24h</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>

        <select
          value={moduloFiltro}
          onChange={(e) => setModuloFiltro(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
          data-action="Performance.filtro.modulo"
        >
          <option value="todos">Todos os Módulos</option>
          <option value="Comercial">Comercial</option>
          <option value="Financeiro">Financeiro</option>
          <option value="Producao">Produção</option>
          <option value="Estoque">Estoque</option>
          <option value="Expedicao">Expedição</option>
          <option value="Fiscal">Fiscal</option>
        </select>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card className="border-2 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-xs text-blue-700">Total Ops</p>
                <p className="text-2xl font-bold text-blue-900">
                  {metricas?.total_operacoes || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-xs text-green-700">Tempo Médio</p>
                <p className="text-2xl font-bold text-green-900">
                  {metricas?.duracao_media_ms || 0}ms
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Bolt className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-xs text-purple-700">P95</p>
                <p className="text-2xl font-bold text-purple-900">
                  {metricas?.p95_ms || 0}ms
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-xs text-orange-700">Ops Lentas</p>
                <p className="text-2xl font-bold text-orange-900">
                  {metricas?.operacoes_lentas || 0}
                </p>
                <p className="text-xs text-orange-600">
                  {metricas?.taxa_lento_percent || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-xs text-red-700">Erros</p>
                <p className="text-2xl font-bold text-red-900">
                  {metricas?.operacoes_erro || 0}
                </p>
                <p className="text-xs text-red-600">
                  {metricas?.taxa_erro_percent || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="queries" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="queries" data-action="Performance.tab.queries">
            <Database className="w-4 h-4 mr-2" />
            Queries Lentas
          </TabsTrigger>
          <TabsTrigger value="modulos" data-action="Performance.tab.modulos">
            <BarChart3 className="w-4 h-4 mr-2" />
            Por Módulo
          </TabsTrigger>
          <TabsTrigger value="erros" data-action="Performance.tab.erros">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Erros ({erros.length})
          </TabsTrigger>
          <TabsTrigger value="alertas" data-action="Performance.tab.alertas">
            <Activity className="w-4 h-4 mr-2" />
            Alertas ({alertas.length})
          </TabsTrigger>
        </TabsList>

        {/* ABA: QUERIES LENTAS */}
        <TabsContent value="queries" className="space-y-4">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-5 h-5 text-orange-600" />
                Top 10 Queries Mais Lentas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {queriesLentas.map((log, idx) => (
                  <div key={log.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-orange-100 text-orange-700">
                            #{idx + 1}
                          </Badge>
                          <span className="font-semibold text-sm">
                            {log.funcionalidade}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {log.modulo}
                          </Badge>
                        </div>
                        {log.entidade && (
                          <p className="text-xs text-slate-600">
                            Entidade: {log.entidade} • {log.registros_afetados || 0} registros
                          </p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-orange-600">
                          {log.duracao_ms}ms
                        </p>
                        {log.percentual_acima_threshold > 0 && (
                          <p className="text-xs text-orange-600">
                            +{Math.round(log.percentual_acima_threshold)}% threshold
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {queriesLentas.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-600" />
                    <p>Nenhuma query lenta detectada</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: POR MÓDULO */}
        <TabsContent value="modulos" className="space-y-4">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Performance por Módulo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {modulosMetricas.map((mod) => (
                  <div key={mod.modulo} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900">{mod.modulo}</span>
                        <Badge variant="outline" className="text-xs">
                          {mod.total_operacoes} ops
                        </Badge>
                        {mod.taxa_erro_percent > 0 && (
                          <Badge className="bg-red-100 text-red-700 text-xs">
                            {mod.taxa_erro_percent}% erros
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-slate-600">Média:</span>
                          <span className="ml-2 font-bold text-blue-600">
                            {mod.duracao_media_ms}ms
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">P95:</span>
                          <span className="ml-2 font-bold text-purple-600">
                            {mod.p95_ms}ms
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Barra de progresso */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            mod.taxa_lento_percent > 20 ? 'bg-red-600' :
                            mod.taxa_lento_percent > 10 ? 'bg-orange-600' :
                            'bg-green-600'
                          }`}
                          style={{ width: `${Math.min(mod.taxa_lento_percent, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600 w-16 text-right">
                        {mod.taxa_lento_percent}% lentas
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: ERROS */}
        <TabsContent value="erros" className="space-y-4">
          <Card>
            <CardHeader className="bg-red-50 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Erros Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {erros.slice(0, 20).map((log) => (
                  <div key={log.id} className="p-4 hover:bg-red-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-red-600">
                            {log.erro_tipo || 'Erro'}
                          </Badge>
                          <span className="font-semibold text-sm text-red-900">
                            {log.funcionalidade}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {log.modulo}
                          </Badge>
                        </div>
                        <p className="text-sm text-red-800 mb-1">
                          {log.erro_mensagem}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600">
                          {log.duracao_ms}ms
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {erros.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-600" />
                    <p>Nenhum erro detectado</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: ALERTAS */}
        <TabsContent value="alertas" className="space-y-4">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Alertas Ativos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {alertas.map((alerta) => (
                  <div key={alerta.id} className={`p-4 ${
                    alerta.severidade === 'Critical' ? 'bg-red-50' :
                    alerta.severidade === 'Error' ? 'bg-orange-50' :
                    'bg-yellow-50'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={
                            alerta.severidade === 'Critical' ? 'bg-red-600' :
                            alerta.severidade === 'Error' ? 'bg-orange-600' :
                            'bg-yellow-600'
                          }>
                            {alerta.severidade}
                          </Badge>
                          <span className="font-semibold text-sm">
                            {alerta.tipo_alerta}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {alerta.modulo}
                          </Badge>
                          <Badge className={`text-xs ${
                            alerta.status === 'Novo' ? 'bg-blue-600' :
                            alerta.status === 'Resolvido' ? 'bg-green-600' :
                            'bg-slate-600'
                          }`}>
                            {alerta.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-700 mb-1">
                          {alerta.descricao}
                        </p>
                        {alerta.acao_recomendada && (
                          <p className="text-xs text-blue-700 mb-1">
                            💡 {alerta.acao_recomendada}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                          <span>Primeira: {new Date(alerta.primeira_ocorrencia).toLocaleString('pt-BR')}</span>
                          {alerta.quantidade_ocorrencias > 1 && (
                            <span className="font-semibold text-orange-600">
                              {alerta.quantidade_ocorrencias} ocorrências
                            </span>
                          )}
                          {alerta.responsavel_nome && (
                            <span>Responsável: {alerta.responsavel_nome}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {alerta.valor_medido && (
                          <p className="text-lg font-bold text-red-600">
                            {alerta.valor_medido}
                            {alerta.metrica_tipo === 'duracao' ? 'ms' : ''}
                          </p>
                        )}
                        {alerta.percentual_excedido > 0 && (
                          <p className="text-xs text-red-600">
                            +{Math.round(alerta.percentual_excedido)}%
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {alertas.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-600" />
                    <p>Nenhum alerta ativo</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Métricas Detalhadas */}
      {metricas && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-blue-50">
          <CardHeader className="border-b">
            <CardTitle className="text-base">Métricas Detalhadas</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-5 gap-6">
              <div>
                <p className="text-xs text-slate-600 mb-1">Min</p>
                <p className="text-lg font-bold text-green-600">{metricas.duracao_min_ms}ms</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Média</p>
                <p className="text-lg font-bold text-blue-600">{metricas.duracao_media_ms}ms</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">P95</p>
                <p className="text-lg font-bold text-purple-600">{metricas.p95_ms}ms</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">P99</p>
                <p className="text-lg font-bold text-orange-600">{metricas.p99_ms}ms</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Max</p>
                <p className="text-lg font-bold text-red-600">{metricas.duracao_max_ms}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timestamp */}
      <div className="text-center text-xs text-slate-500">
        <Activity className="w-3 h-3 inline mr-1" />
        Atualizado automaticamente a cada 30 segundos
      </div>
    </div>
  );
}
