import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Truck, Navigation } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * Mapa de Rastreamento em Tempo Real.
 * Mostra posicoes atualizadas dos veiculos a cada 60s.
 */
export default function MapaRastreamentoRealTime({ entregaId, empresaId }) {
  const [posicaoAtual, setPosicaoAtual] = useState(null);
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const effectiveEmpresaId = empresaId || empresaAtual?.id || null;
  const effectiveGroupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(effectiveGroupId || effectiveEmpresaId);
  const canViewTracking = hasPermission("Expedicao", "Rastreamento", "visualizar") ||
    hasPermission("Expedicao", "Entregas", "visualizar") ||
    hasPermission("Expedicao", "Painel Logistico", "visualizar");

  const { data: posicoes = [] } = useQuery({
    queryKey: ["posicoes-veiculo", entregaId, effectiveGroupId, effectiveEmpresaId],
    queryFn: () => filterInContext(
      "PosicaoVeiculo",
      { entrega_id: entregaId },
      "-data_hora",
      100
    ),
    refetchInterval: 60000,
    enabled: Boolean(entregaId && contextoValido && canViewTracking)
  });

  const { data: entrega } = useQuery({
    queryKey: ["entrega-rastreamento", entregaId, effectiveGroupId, effectiveEmpresaId],
    queryFn: async () => {
      const entregas = await filterInContext("Entrega", { id: entregaId }, undefined, 1);
      return entregas[0] || null;
    },
    enabled: Boolean(entregaId && contextoValido && canViewTracking)
  });

  useEffect(() => {
    if (posicoes.length > 0) {
      setPosicaoAtual(posicoes[0]);
    } else {
      setPosicaoAtual(null);
    }
  }, [posicoes]);

  if (!contextoValido || !canViewTracking) {
    return (
      <Card className="h-full" data-permission="Expedicao.Rastreamento.visualizar" data-context-required="true">
        <CardContent className="p-12 text-center text-amber-700 bg-amber-50">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Selecione um contexto grupo/empresa e confirme permissao para visualizar o rastreamento.</p>
        </CardContent>
      </Card>
    );
  }

  if (!entrega) {
    return (
      <Card className="h-full" data-permission="Expedicao.Rastreamento.visualizar" data-context-required="true">
        <CardContent className="p-12 text-center text-slate-500">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Selecione uma entrega para rastrear</p>
        </CardContent>
      </Card>
    );
  }

  const posicaoDestino = {
    lat: entrega.endereco_entrega_completo?.latitude,
    lng: entrega.endereco_entrega_completo?.longitude
  };

  const posicaoVeiculo = posicaoAtual ? {
    lat: posicaoAtual.latitude,
    lng: posicaoAtual.longitude
  } : null;

  const centerMap = posicaoVeiculo || posicaoDestino || { lat: -23.55, lng: -46.63 };

  return (
    <Card className="h-full" data-permission="Expedicao.Rastreamento.visualizar" data-context-required="true">
      <CardHeader className="border-b bg-slate-50">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-600" />
            Rastreamento em Tempo Real
          </div>
          {posicaoAtual && (
            <Badge className="bg-green-100 text-green-700">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
              Online
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[500px] relative">
          <MapContainer
            center={[centerMap.lat, centerMap.lng]}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />

            {posicaoDestino.lat && posicaoDestino.lng && (
              <Marker position={[posicaoDestino.lat, posicaoDestino.lng]}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">Destino</p>
                    <p className="text-slate-600">{entrega.cliente_nome}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {entrega.endereco_entrega_completo?.logradouro}, {entrega.endereco_entrega_completo?.numero}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}

            {posicaoVeiculo && (
              <Marker position={[posicaoVeiculo.lat, posicaoVeiculo.lng]}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold flex items-center gap-1">
                      <Truck className="w-4 h-4" />
                      Veiculo
                    </p>
                    <p className="text-slate-600">{posicaoAtual.motorista_nome}</p>
                    <p className="text-xs text-slate-500">
                      Velocidade: {posicaoAtual.velocidade_kmh?.toFixed(0)} km/h
                    </p>
                    <p className="text-xs text-slate-500">
                      Atualizado: {new Date(posicaoAtual.data_hora).toLocaleTimeString("pt-BR")}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}

            {posicaoVeiculo && posicaoDestino.lat && posicaoDestino.lng && (
              <Polyline
                positions={[
                  [posicaoVeiculo.lat, posicaoVeiculo.lng],
                  [posicaoDestino.lat, posicaoDestino.lng]
                ]}
                color="#3b82f6"
                dashArray="10, 10"
              />
            )}
          </MapContainer>

          {posicaoAtual && (
            <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 border">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Distancia Restante</p>
                  <p className="font-semibold text-blue-600">
                    {posicaoAtual.distancia_proxima_entrega_km?.toFixed(1) || "-"} km
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Tempo Estimado</p>
                  <p className="font-semibold text-orange-600">
                    {posicaoAtual.tempo_estimado_proxima_entrega_min || "-"} min
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Status</p>
                  <Badge className="bg-blue-100 text-blue-700">
                    {posicaoAtual.status_movimento}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
