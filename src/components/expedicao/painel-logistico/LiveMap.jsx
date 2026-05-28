import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { base44 } from '@/api/base44Client';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

export default function LiveMap({ posicao, entregaId, height = 340, contextoValido = true, canView = true, onAudit }) {
  const { filterInContext } = useContextoVisual();
  const [destino, setDestino] = useState(null);
  const [eta, setEta] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!entregaId) return;
      const list = await base44.entities.Entrega.filter({ id: entregaId }, undefined, 1);
      const e = list?.[0];
      if (!e) return;
      const lat = e?.endereco_entrega_completo?.latitude;
      const lng = e?.endereco_entrega_completo?.longitude;
      if (typeof lat === 'number' && typeof lng === 'number') {
        if (!cancelled) setDestino({ lat, lng, cliente: e.cliente_nome });
      }
    })();
    return () => { cancelled = true; };
  }, [entregaId, contextoValido, canView, filterInContext, onAudit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!posicao?.latitude || !posicao?.longitude || !destino || !contextoValido || !canView) return;
      try {
        const res = await base44.functions.invoke('computeEta', {
          origin: { lat: posicao.latitude, lng: posicao.longitude },
          destination: { lat: destino.lat, lng: destino.lng }
        });
        const data = res?.data;
        if (!cancelled && data?.eta_minutes != null) setEta(data.eta_minutes);
      } catch (error) {
        await onAudit?.({ acao: 'PainelLogistico.mapaVivo.eta.erro', sucesso: false, motivo: error?.message || 'erro_eta', detalhes: { entrega_id: entregaId } });
      }
    })();
    return () => { cancelled = true; };
  }, [posicao?.latitude, posicao?.longitude, destino?.lat, destino?.lng, contextoValido, canView, entregaId, onAudit]);

  const center = useMemo(() => ({ lat: posicao?.latitude || -23.55, lng: posicao?.longitude || -46.63 }), [posicao]);

  return (
    <div className="w-full rounded-lg border overflow-hidden" style={{ height }} data-permission="Expedicao.PainelLogistico.visualizar" data-context-required="true">
      {(!contextoValido || !canView) && (
        <div className="h-full w-full flex items-center justify-center bg-red-50 px-4 text-center text-sm text-red-800">
          {!contextoValido ? 'Selecione grupo/empresa para visualizar o mapa ao vivo.' : 'Seu perfil nao tem permissao para visualizar o mapa ao vivo.'}
        </div>
      )}
      {(contextoValido && canView) && (
      <MapContainer center={[center.lat, center.lng]} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        {posicao?.latitude && (
          <>
            <Marker position={[posicao.latitude, posicao.longitude]}>
              <Popup>
                Motorista {posicao.motorista_nome || ''}<br />
                Velocidade: {Math.round(posicao.velocidade_kmh || (posicao.velocidade || 0) * 3.6)} km/h
              </Popup>
            </Marker>
            <Circle center={[posicao.latitude, posicao.longitude]} radius={posicao.precisao_metros || 30} pathOptions={{ color: '#2563eb', fillOpacity: 0.1 }} />
          </>
        )}
        {destino && (
          <Marker position={[destino.lat, destino.lng]}>
            <Popup>
              Destino: {destino.cliente || 'Entrega'}<br/>
              {eta != null ? `ETA ~${eta} min` : 'Calculando ETA...'}
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}