import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Bolt,
  TrendingUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

/**
 * Monitor de Performance do Sistema
 * Métricas em tempo real
 */
export default function MonitorPerformance() {
  const [metricas, setMetricas] = useState([]);
  const { contexto, empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const scopeId = empresaAtual?.id || grupoAtual?.id || 'sem-contexto';
  const contextoValido = scopeId !== 'sem-contexto';

  const { data: monitoramento = [] } = useQuery({
    queryKey: ['monitoramento-sistema', scopeId, contexto],
    queryFn: () => filterInContext('MonitoramentoSistema', {}, '-timestamp', 60),
    enabled: contextoValido,
    refetchInterval: 60000 // Atualiza a cada 60s
  });

  useEffect(() => {
    if (monitoramento.length > 0) {
      const ultimasMetricas = monitoramento.slice(0, 30).reverse();
      setMetricas(ultimasMetricas.map(m => ({
        hora: new Date(m.timestamp).toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        cpu: m.cpu_uso_percent || 0,
        memoria: m.memoria_uso_mb || 0,
        latencia: m.latencia_media_ms || 0,
        requisicoes: m.requisicoes_por_segundo || 0
      })));
    }
  }, [monitoramento]);

  const ultimaMetrica = monitoramento[0] || {};
  
  const statusSistema = ultimaMetrica.status_geral || 'Saudável';
  const statusConfig = {
    'Saudável': { icone: CheckCircle, cardClass: 'border-green-200 bg-green-50', iconClass: 'text-green-600' },
    'Atenção': { icone: AlertTriangle, cardClass: 'border-yellow-200 bg-yellow-50', iconClass: 'text-yellow-600' },
    'Crítico': { icone: AlertTriangle, cardClass: 'border-red-200 bg-red-50', iconClass: 'text-red-600' },
    'Offline': { icone: Activity, cardClass: 'border-slate-200 bg-slate-50', iconClass: 'text-slate-600' }
  };
  
  const config = statusConfig[statusSistema] || statusConfig.Offline;
  const Icon = config.icone;

  if (!contextoValido) {
    return (
      <div className="w-full h-full p-6 overflow-auto" data-context-required="true">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6 flex items-center gap-3 text-yellow-900">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">
              Selecione Grupo ou Empresa para carregar as metricas de performance.
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full h-full space-y-6 p-6 overflow-auto">
      {/* Status Geral */}
      <Card className={config.cardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className={`w-6 h-6 ${config.iconClass}`} />
            Status do Sistema: {statusSistema}
          </CardTitle>
          <p className="text-sm text-slate-600 mt-1">
            Última atualização: {ultimaMetrica.timestamp 
              ? new Date(ultimaMetrica.timestamp).toLocaleString('pt-BR')
              : '-'
            }
          </p>
        </CardHeader>
      </Card>

      {/* Métricas Atuais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">CPU</p>
                <p className="text-3xl font-bold text-blue-900">
                  {ultimaMetrica.cpu_uso_percent?.toFixed(1) || 0}%
                </p>
              </div>
              <Cpu className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">Memória</p>
                <p className="text-3xl font-bold text-purple-900">
                  {ultimaMetrica.memoria_uso_mb?.toFixed(0) || 0} MB
                </p>
              </div>
              <HardDrive className="w-10 h-10 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">Latência</p>
                <p className="text-3xl font-bold text-orange-900">
                  {ultimaMetrica.latencia_media_ms?.toFixed(0) || 0} ms
                </p>
              </div>
              <Bolt className="w-10 h-10 text-orange-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Uptime</p>
                <p className="text-3xl font-bold text-green-900">
                  {ultimaMetrica.uptime_percent?.toFixed(2) || 99.97}%
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Performance */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base">CPU e Memória (Últimos 30min)</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={metricas}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="cpu" stroke="#3b82f6" name="CPU %" />
                <Line type="monotone" dataKey="memoria" stroke="#8b5cf6" name="RAM MB" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base">Latência e Requisições</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={metricas}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="latencia" stroke="#f59e0b" name="Latência ms" />
                <Line type="monotone" dataKey="requisicoes" stroke="#10b981" name="Req/s" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Performance */}
      {ultimaMetrica.alertas_gerados?.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="border-b bg-white/80">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Alertas de Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {ultimaMetrica.alertas_gerados.map((alerta, idx) => (
              <div key={idx} className="p-3 bg-white rounded border border-orange-200">
                <div className="flex items-start gap-2">
                  <Badge className={
                    alerta.severidade === 'Critical' ? 'bg-red-600' :
                    alerta.severidade === 'Error' ? 'bg-orange-600' :
                    alerta.severidade === 'Warning' ? 'bg-yellow-600' :
                    'bg-blue-600'
                  }>
                    {alerta.severidade}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{alerta.tipo}</p>
                    <p className="text-xs text-slate-600">{alerta.mensagem}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
