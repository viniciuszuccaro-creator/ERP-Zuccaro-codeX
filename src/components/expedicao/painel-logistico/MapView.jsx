import React from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import 'leaflet/dist/leaflet.css';

const statusColor = (s) => {
  switch (s) {
    case 'Pronto para Expedir': return '#0ea5e9';
    case 'Saiu para Entrega':
    case 'Em Trânsito': return '#f59e0b';
    case 'Entregue': return '#10b981';
    case 'Entrega Frustrada': return '#ef4444';
    default: return '#64748b';
  }
};

function FlyTo({ center }) {
  const map = useMap();
  React.useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2) {
      map.flyTo(center, Math.max(map.getZoom(), 11), { duration: 0.7 });
    }
  }, [center, map]);
  return null;
}

export default function MapView({ entregas = [], selected, onSelect, contextoValido = true, canView = true, onAudit }) {
  const points = (entregas || [])
    .map((e) => ({
      id: e.id,
      status: e.status,
      numero_pedido: e.numero_pedido,
      rota_id: e.rota_id,
      motorista: e.motorista,
      lat: e?.endereco_entrega_completo?.latitude ?? null,
      lng: e?.endereco_entrega_completo?.longitude ?? null,
      cliente: e.cliente_nome,
      previsao: e.data_previsao,
    }))
    .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number');

  const center = React.useMemo(() => {
    if (selected && selected.endereco_entrega_completo?.latitude && selected.endereco_entrega_completo?.longitude) {
      return [selected.endereco_entrega_completo.latitude, selected.endereco_entrega_completo.longitude];
    }
    if (!points.length) return [-23.55052, -46.633308]; // São Paulo fallback
    const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return [avgLat, avgLng];
  }, [points, selected]);

  return (
    <div className="w-full h-full" data-permission="Expedicao.PainelLogistico.visualizar" data-context-required="true">
      <MapContainer center={center} zoom={11} className="w-full h-full rounded-lg overflow-hidden border border-slate-200">
        <FlyTo center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={8}
            pathOptions={{ color: statusColor(p.status), fillColor: statusColor(p.status), fillOpacity: 0.8 }}
            eventHandlers={{ click: async () => { if (!contextoValido || !canView) { await onAudit?.({ acao: 'PainelLogistico.mapa.selecionar.bloqueado', sucesso: false, motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada', detalhes: { entrega_id: p.id } }); return; } await onAudit?.({ acao: 'PainelLogistico.mapa.selecionar', detalhes: { entrega_id: p.id } }); onSelect && onSelect(entregas.find(e => e.id === p.id)); } }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{p.cliente}</div>
                <div>Status: {p.status}</div>
                {p.numero_pedido && <div>Pedido: {p.numero_pedido}</div>}
                {p.motorista && <div>Motorista: {p.motorista}</div>}
                {p.previsao && <div>Previsão: {new Date(p.previsao).toLocaleDateString('pt-BR')}</div>}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}