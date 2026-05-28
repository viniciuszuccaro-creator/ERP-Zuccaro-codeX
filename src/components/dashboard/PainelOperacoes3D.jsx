import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Factory, 
  Truck, 
  Package, 
  AlertCircle,
  TrendingUp,
  Activity,
  MapPin
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import useContextoVisual from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * Painel de Operações 3D - Comando Central
 * Visualização global do ecossistema em tempo real
 */
export default function PainelOperacoes3D({ empresaId, grupoId }) {
  const [atualizandoAoVivo, setAtualizandoAoVivo] = useState(false);
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const effectiveGroupId = grupoId || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const effectiveEmpresaId = empresaId || empresaAtual?.id || null;
  const contextKey = effectiveEmpresaId || effectiveGroupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const canViewPainel = hasPermission("Dashboard", "Operacoes", "visualizar") ||
    hasPermission("Expedicao", "Painel Logistico", "visualizar") ||
    hasPermission("Producao", "Relatorios", "visualizar") ||
    hasPermission("Dashboard", null, "visualizar");

  // Queries com auto-refresh
  const { data: ops = [] } = useQuery({
    queryKey: ['ops-tempo-real', contextKey],
    queryFn: () => filterInContext('OrdemProducao', {}, '-updated_date', 50),
    enabled: contextoValido && canViewPainel,
    refetchInterval: 30000 // 30 segundos
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ['entregas-tempo-real', contextKey],
    queryFn: () => filterInContext('Entrega', {}, '-updated_date', 50),
    enabled: contextoValido && canViewPainel,
    refetchInterval: 30000
  });

  const { data: posicoesVeiculos = [] } = useQuery({
    queryKey: ['posicoes-veiculos', contextKey],
    queryFn: () => filterInContext('PosicaoVeiculo', {}, '-data_hora', 100),
    enabled: contextoValido && canViewPainel,
    refetchInterval: 60000 // 1 minuto
  });

  // KPIs em Tempo Real
  const opsEmProducao = ops.filter(o => 
    ['Em Corte', 'Em Dobra', 'Em Armação'].includes(o.status)
  ).length;

  const entregasEmTransito = entregas.filter(e => 
    e.status === 'Em Trânsito' || e.status === 'Saiu para Entrega'
  ).length;

  const alertasUrgentes = [
    ...ops.filter(o => o.alerta_falta_estoque),
    ...entregas.filter(e => e.prioridade === 'Urgente')
  ].length;

  // Posições únicas de veículos (última posição de cada)
  const veiculosAtivos = posicoesVeiculos.reduce((acc, pos) => {
    if (!acc[pos.veiculo_id] || new Date(pos.data_hora) > new Date(acc[pos.veiculo_id].data_hora)) {
      acc[pos.veiculo_id] = pos;
    }
    return acc;
  }, {});

  const veiculosArray = Object.values(veiculosAtivos);

  return (
    <div
      className="space-y-6 w-full h-full"
      data-permission="Dashboard.Operacoes.visualizar"
      data-context-required="group-or-company"
    >
      {(!contextoValido || !canViewPainel) && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            Selecione grupo ou empresa e confirme permissao para visualizar o painel de operacoes.
          </CardContent>
        </Card>
      )}
      {/* KPIs Principais */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">OPs em Produção</p>
                <p className="text-3xl font-bold text-blue-900">{opsEmProducao}</p>
              </div>
              <Factory className="w-12 h-12 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">Entregas em Trânsito</p>
                <p className="text-3xl font-bold text-orange-900">{entregasEmTransito}</p>
              </div>
              <Truck className="w-12 h-12 text-orange-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">Veículos Ativos</p>
                <p className="text-3xl font-bold text-purple-900">{veiculosArray.length}</p>
              </div>
              <MapPin className="w-12 h-12 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-red-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Alertas Urgentes</p>
                <p className="text-3xl font-bold text-red-900">{alertasUrgentes}</p>
              </div>
              <AlertCircle className="w-12 h-12 text-red-600 opacity-50 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapa de Operações */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Mapa de Operações em Tempo Real
          </CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={atualizandoAoVivo ? 'bg-green-600' : 'bg-slate-600'}>
              <div className={`w-2 h-2 rounded-full bg-white mr-2 ${atualizandoAoVivo ? 'animate-pulse' : ''}`} />
              {atualizandoAoVivo ? 'Ao Vivo' : 'Pausado'}
            </Badge>
            <button
              onClick={() => setAtualizandoAoVivo(!atualizandoAoVivo)}
              className="text-xs text-blue-600 hover:underline"
            >
              {atualizandoAoVivo ? 'Pausar' : 'Ativar'} Atualização Automática
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[500px] relative">
            <MapContainer
              center={[-23.55, -46.63]}
              zoom={11}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />

              {/* Marcadores dos Veículos */}
              {veiculosArray.map((pos) => (
                <Marker
                  key={pos.veiculo_id}
                  position={[pos.latitude, pos.longitude]}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold flex items-center gap-1">
                        <Truck className="w-4 h-4" />
                        {pos.motorista_nome}
                      </p>
                      <p className="text-xs text-slate-600">Placa: {pos.placa}</p>
                      <p className="text-xs text-slate-600">
                        Velocidade: {pos.velocidade_kmh?.toFixed(0)} km/h
                      </p>
                      <Badge className="mt-1 text-xs">
                        {pos.status_movimento}
                      </Badge>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Info Overlay */}
            <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 border">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Última Atualização</p>
                  <p className="font-semibold text-blue-600">
                    {veiculosArray.length > 0 
                      ? new Date(veiculosArray[0].data_hora).toLocaleTimeString('pt-BR')
                      : '-'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Veículos Online</p>
                  <p className="font-semibold text-green-600">
                    {veiculosArray.filter(v => v.conectividade === '4G' || v.conectividade === 'WiFi').length}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Em Movimento</p>
                  <p className="font-semibold text-orange-600">
                    {veiculosArray.filter(v => v.status_movimento === 'Em Movimento').length}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Entregas Concluídas Hoje</p>
                  <p className="font-semibold text-purple-600">
                    {entregas.filter(e => 
                      e.status === 'Entregue' && 
                      e.data_entrega &&
                      new Date(e.data_entrega).toDateString() === new Date().toDateString()
                    ).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Eventos Recentes */}
      <Card>
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base">Eventos Recentes (Tempo Real)</CardTitle>
        </CardHeader>
        <CardContent className="p-4 max-h-64 overflow-y-auto">
          <div className="space-y-2">
            {ops.slice(0, 5).map((op) => (
              <div key={op.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                <Factory className="w-4 h-4 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{op.numero_op}</p>
                  <p className="text-xs text-slate-600">{op.cliente_nome}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {op.status}
                </Badge>
              </div>
            ))}

            {entregas.slice(0, 5).map((ent) => (
              <div key={ent.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                <Truck className="w-4 h-4 text-orange-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{ent.numero_pedido}</p>
                  <p className="text-xs text-slate-600">{ent.cliente_nome}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {ent.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
