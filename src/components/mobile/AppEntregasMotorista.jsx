import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MapPin, 
  Navigation, 
  CheckCircle, 
  Clock, 
  Phone,
  Camera,
  FileText,
  AlertCircle,
  Package,
  Truck,
  User,
  Send,
  Loader2
} from 'lucide-react';
import { useUser } from '@/components/lib/UserContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import {
  buildChegadaPatch,
  buildConfirmacaoPatch,
  buildInicioPatch,
  buildOcorrenciaPatch,
  buildReversaPatch,
  dequeueMotoristaAction,
  enqueueMotoristaAction,
  filtrarEntregasDoMotorista,
  ordenarEntregasRota,
  proximaParada,
  readMotoristaQueue,
} from '@/components/lib/appMotoristaPolicy';

/**
 * App Mobile Completo para Motoristas
 * V12.0 - Com GPS, foto, assinatura, fila offline e idempotencia
 */
export default function AppEntregasMotorista() {
  const { user } = useUser();
  const { filterInContext, grupoAtual, empresaAtual } = useContextoVisual();
  const [entregaAtual, setEntregaAtual] = useState(null);
  const [localizacao, setLocalizacao] = useState(null);
  const [rastreando, setRastreando] = useState(false);
  const [fotoComprovante, setFotoComprovante] = useState(null);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [smsNumero, setSmsNumero] = useState('');
  const [assinaturaBase64, setAssinaturaBase64] = useState(null);
  const [nomeRecebedor, setNomeRecebedor] = useState('');
  const [documentoRecebedor, setDocumentoRecebedor] = useState('');
  const [entregaParcial, setEntregaParcial] = useState(false);
  const [qtdParcial, setQtdParcial] = useState(0);
  const [filaOffline, setFilaOffline] = useState([]);
  // Logística reversa (UI)
  const [reversaMotivo, setReversaMotivo] = useState('Recusa Total');
  const [reversaQtd, setReversaQtd] = useState(0);
  const [reversaValor, setReversaValor] = useState(0);
  const queryClient = useQueryClient();

  // Captura de assinatura no canvas
  React.useEffect(() => {
    const canvas = document.getElementById('assinatura-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let drawing = false; let lastX = 0; let lastY = 0;
    const start = (x, y) => { drawing = true; lastX = x; lastY = y; };
    const move = (x, y) => { if (!drawing) return; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke(); lastX = x; lastY = y; };
    const end = () => { drawing = false; try { setAssinaturaBase64(canvas.toDataURL('image/png')); } catch (error) { console.error('[Entrega] Falha ao capturar assinatura.', error); toast.error('Nao foi possivel capturar a assinatura.'); } };
    const getPos = (e) => { if (e.touches?.[0]) { const rect = canvas.getBoundingClientRect(); return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }; } const rect = canvas.getBoundingClientRect(); return { x: e.offsetX ?? 0, y: e.offsetY ?? 0 }; };
    const mdown = (e) => { const p = getPos(e); start(p.x, p.y); };
    const mmove = (e) => { const p = getPos(e); move(p.x, p.y); e.preventDefault(); };
    const mup = () => end();
    canvas.addEventListener('mousedown', mdown); canvas.addEventListener('mousemove', mmove); canvas.addEventListener('mouseup', mup);
    canvas.addEventListener('touchstart', mdown, { passive: false }); canvas.addEventListener('touchmove', mmove, { passive: false }); canvas.addEventListener('touchend', mup);
    return () => {
      canvas.removeEventListener('mousedown', mdown); canvas.removeEventListener('mousemove', mmove); canvas.removeEventListener('mouseup', mup);
      canvas.removeEventListener('touchstart', mdown); canvas.removeEventListener('touchmove', mmove); canvas.removeEventListener('touchend', mup);
    };
  }, []);

  // Buscar entregas do motorista
  const { data: minhasEntregas = [], refetch } = useQuery({
    queryKey: ['entregas-motorista', user?.id, grupoAtual?.id, empresaAtual?.id],
    queryFn: async () => {
      const todas = await filterInContext('Entrega', {}, '-data_saida', 500);
      return ordenarEntregasRota(filtrarEntregasDoMotorista(todas, user));
    },
    enabled: !!user && Boolean(grupoAtual?.id || empresaAtual?.id),
    refetchInterval: 30000
  });

  const proxima = proximaParada(minhasEntregas, user);

  const syncFilaOffline = async () => {
    const queue = readMotoristaQueue();
    setFilaOffline(queue);
    if (!queue.length || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    for (const action of queue) {
      try {
        await base44.entities.Entrega.update(action.entrega_id, action.patch);
        dequeueMotoristaAction(action.id);
      } catch (error) {
        console.error('[Motorista] Falha ao sincronizar acao offline.', error);
        break;
      }
    }
    setFilaOffline(readMotoristaQueue());
    refetch();
  };

  const aplicarPatchEntrega = async (entrega, patch, sucessoMsg) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queued = enqueueMotoristaAction({
        tipo: patch.status,
        entrega_id: entrega.id,
        patch,
        idempotency_key: patch.idempotency_key,
      });
      setFilaOffline(queued.queue);
      toast.success(queued.reused ? 'Acao ja estava na fila offline' : 'Acao salva offline para sincronizar');
      setEntregaAtual(null);
      return;
    }
    await base44.entities.Entrega.update(entrega.id, patch);
    toast.success(sucessoMsg);
    setEntregaAtual(null);
    refetch();
  };

  // Iniciar rastreamento GPS
  useEffect(() => {
    const goOnline = () => {
      setIsOffline(false);
      syncFilaOffline();
    };
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    setFilaOffline(readMotoristaQueue());
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  useEffect(() => {
    if (minhasEntregas.length > 0 && !rastreando) {
      iniciarRastreamento();
    }

    return () => {
      if (rastreando && navigator.geolocation) {
        navigator.geolocation.clearWatch(rastreando);
      }
    };
  }, [minhasEntregas]);

  const iniciarRastreamento = () => {
    if (!navigator.geolocation) {
      toast.error('GPS não disponível neste dispositivo');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const novaLocalizacao = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          precisao: position.coords.accuracy,
          velocidade: position.coords.speed || 0,
          timestamp: new Date().toISOString()
        };

        setLocalizacao(novaLocalizacao);

        // Enviar posição para servidor
        if (entregaAtual) {
          base44.entities.PosicaoVeiculo.create({
            entrega_id: entregaAtual.id,
            romaneio_id: entregaAtual.romaneio_id,
            motorista_id: user.id,
            motorista_nome: user.full_name,
            placa: entregaAtual.placa,
            ...novaLocalizacao,
            bateria_nivel: 0,
            conectividade: navigator.connection?.effectiveType || '4G'
          });
        }
      },
      (error) => {
        console.error('Erro GPS:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );

    setRastreando(watchId);
    toast.success('📍 Rastreamento GPS ativado');
  };

  const iniciarEntrega = async (entrega) => {
    try {
      const patch = buildInicioPatch({ entrega, user, localizacao });
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const queued = enqueueMotoristaAction({
          tipo: 'inicio',
          entrega_id: entrega.id,
          patch,
          idempotency_key: patch.idempotency_key,
        });
        setFilaOffline(queued.queue);
        toast.success('Inicio salvo offline');
      } else {
        await base44.entities.Entrega.update(entrega.id, patch);
      }
      setEntregaAtual({ ...entrega, ...patch });
      try { await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Motorista',
        usuario_id: user?.id,
        empresa_id: entrega.empresa_id || null,
        group_id: entrega.group_id || null,
        acao: 'Edição', modulo: 'Expedição', tipo_auditoria: 'ui', entidade: 'Entrega', registro_id: entrega.id,
        descricao: 'Entrega iniciada no app do motorista', data_hora: new Date().toISOString()
      }); } catch (error) { console.error('[Auditoria] Falha ao registrar inicio da entrega.', error); }
      refetch();
      toast.success('🚚 Entrega iniciada!');
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel iniciar a entrega');
    }
  };

  const registrarChegada = async () => {
    try {
      const patch = buildChegadaPatch({ entrega: entregaAtual, user, localizacao });
      await base44.entities.Entrega.update(entregaAtual.id, patch);
      setEntregaAtual({ ...entregaAtual, ...patch });
      toast.success('📍 Chegada registrada');
      refetch();
    } catch (error) {
      toast.error(error?.message || 'Falha ao registrar chegada');
    }
  };

  const tirarFoto = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setFotoComprovante(file_url);
        toast.success('✅ Foto capturada!');
      } catch (error) {
        toast.error('Erro ao fazer upload da foto');
      }
    };

    input.click();
  };

  const confirmarEntrega = async () => {
    let assinatura = assinaturaBase64;
    try {
      const canvas = document.getElementById('assinatura-canvas');
      if (canvas) assinatura = canvas.toDataURL('image/png');
    } catch (error) {
      console.error('[Entrega] Falha ao preparar assinatura.', error);
      toast.error('Nao foi possivel preparar a assinatura da entrega.');
      return;
    }

    try {
      const patch = buildConfirmacaoPatch({
        entrega: entregaAtual,
        user,
        localizacao,
        parcial: entregaParcial,
        quantidade_entregue: qtdParcial,
        comprovante: {
          foto_comprovante: fotoComprovante,
          assinatura_digital: assinatura,
          nome_recebedor: nomeRecebedor,
          documento_recebedor: documentoRecebedor,
        },
      });
      await aplicarPatchEntrega(
        entregaAtual,
        patch,
        entregaParcial ? 'Entrega parcial confirmada' : '✅ Entrega confirmada com sucesso!',
      );
      setFotoComprovante(null);
      setAssinaturaBase64(null);
      setNomeRecebedor('');
      setDocumentoRecebedor('');
      setEntregaParcial(false);
      setQtdParcial(0);
      try { await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Motorista',
        usuario_id: user?.id,
        empresa_id: entregaAtual?.empresa_id || null,
        group_id: entregaAtual?.group_id || null,
        acao: 'Edição', modulo: 'Expedição', tipo_auditoria: 'ui', entidade: 'Entrega', registro_id: entregaAtual?.id,
        descricao: entregaParcial ? 'Entrega parcial no app do motorista' : 'Entrega confirmada (foto + assinatura) no app do motorista',
        data_hora: new Date().toISOString()
      }); } catch (error) { console.error('[Auditoria] Falha ao registrar confirmacao da entrega.', error); }
    } catch (error) {
      toast.error(error?.message || 'Falha ao confirmar entrega');
    }
  };

  const registrarOcorrencia = async (motivo) => {
    try {
      const patch = buildOcorrenciaPatch({
        entrega: entregaAtual,
        user,
        localizacao,
        motivo,
        foto: fotoComprovante,
      });
      await aplicarPatchEntrega(entregaAtual, patch, '❌ Ocorrência registrada');
    } catch (error) {
      toast.error(error?.message || 'Falha ao registrar ocorrencia');
    }
  };

  if (!entregaAtual) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <Card className="mb-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Minhas Entregas</h1>
                <p className="text-sm opacity-90">{user?.full_name}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{minhasEntregas.length}</p>
                <p className="text-xs opacity-90">pendentes</p>
                {filaOffline.length > 0 && (
                  <p className="text-xs opacity-90 mt-1">{filaOffline.length} na fila offline</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {proxima && (
          <Alert className="mb-4 border-blue-300 bg-blue-50">
            <Navigation className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800">
              Proxima parada: <strong>{proxima.cliente_nome}</strong>
              {proxima.sequencia_rota ? ` · seq #${proxima.sequencia_rota}` : ''}
            </AlertDescription>
          </Alert>
        )}

        {localizacao && (
          <Alert className="mb-4 border-green-300 bg-green-50">
            <MapPin className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-sm text-green-700">
              📍 GPS ativo • Precisão: {localizacao.precisao?.toFixed(0)}m
            </AlertDescription>
          </Alert>
        )}

        {isOffline && (
          <Alert className="mb-4 border-amber-300 bg-amber-50">
            <AlertDescription className="text-sm text-amber-800">
              Sem conexão: você pode enviar sua localização por SMS para o centro de operações.
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input placeholder="Número do gateway SMS (ex.: 28900)" value={smsNumero} onChange={(e)=>setSmsNumero(e.target.value)} />
                <Button variant="outline" onClick={()=>{
                  const lat = localizacao?.latitude?.toFixed(6) || 'LAT';
                  const lng = localizacao?.longitude?.toFixed(6) || 'LNG';
                  const entrega = minhasEntregas?.[0]?.id || 'ENTREGA';
                  const placa = minhasEntregas?.[0]?.placa || 'PLACA';
                  const body = `GPS ${lat},${lng} ENTREGA:${entrega} PLACA:${placa}`;
                  const href = `sms:${encodeURIComponent(smsNumero)}?body=${encodeURIComponent(body)}`;
                  window.location.href = href;
                }}>
                  Abrir SMS com localização
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {minhasEntregas.map((entrega) => (
            <Card key={entrega.id} className={`border-2 hover:shadow-lg transition-all ${proxima?.id === entrega.id ? 'border-blue-500' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-lg">{entrega.cliente_nome}</p>
                    <p className="text-sm text-slate-600">
                      Pedido: {entrega.numero_pedido}
                    </p>
                  </div>
                  <Badge className="bg-blue-600">#{entrega.sequencia_rota || entrega.ordem_sequencia || '-'}</Badge>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">
                        {entrega.endereco_entrega_completo?.logradouro}, {entrega.endereco_entrega_completo?.numero}
                      </p>
                      <p className="text-slate-600">
                        {entrega.endereco_entrega_completo?.bairro} - {entrega.endereco_entrega_completo?.cidade}/{entrega.endereco_entrega_completo?.estado}
                      </p>
                      <p className="text-slate-500">CEP: {entrega.endereco_entrega_completo?.cep}</p>
                    </div>
                  </div>

                  {entrega.contato_entrega?.telefone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-slate-500" />
                      <a href={`tel:${entrega.contato_entrega.telefone}`} className="text-blue-600">
                        {entrega.contato_entrega.telefone}
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Package className="w-4 h-4 text-slate-500" />
                    <span>{entrega.volumes || 1} volume(s) • {entrega.peso_total_kg?.toFixed(2) || '0.00'} kg</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => iniciarEntrega(entrega)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Iniciar Entrega
                  </Button>
                  
                  {entrega.endereco_entrega_completo?.mapa_url && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(entrega.endereco_entrega_completo.mapa_url, '_blank')}
                    >
                      <MapPin className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {minhasEntregas.length === 0 && (
            <div className="text-center py-12">
              <Truck className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-slate-500">Nenhuma entrega pendente</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tela de Entrega Ativa
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-slate-100 p-4">
      <Card className="mb-4 bg-gradient-to-r from-green-600 to-green-700 text-white border-0">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">Entrega em Andamento</h2>
            <Badge className="bg-white text-green-700">
              <Clock className="w-3 h-3 mr-1" />
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Badge>
          </div>
          <p className="text-xl font-bold">{entregaAtual.cliente_nome}</p>
          <p className="text-sm opacity-90">Pedido: {entregaAtual.numero_pedido}</p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Endereço de Entrega
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium">{entregaAtual.endereco_entrega_completo?.logradouro}, {entregaAtual.endereco_entrega_completo?.numero}</p>
          <p className="text-sm text-slate-600">
            {entregaAtual.endereco_entrega_completo?.bairro} - {entregaAtual.endereco_entrega_completo?.cidade}/{entregaAtual.endereco_entrega_completo?.estado}
          </p>
          <p className="text-sm text-slate-500 mt-1">CEP: {entregaAtual.endereco_entrega_completo?.cep}</p>
          
          {entregaAtual.endereco_entrega_completo?.mapa_url && (
            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={() => window.open(entregaAtual.endereco_entrega_completo.mapa_url, '_blank')}
            >
              <Navigation className="w-4 h-4 mr-2" />
              Abrir no Google Maps
            </Button>
          )}

          {entregaAtual.contato_entrega?.telefone && (
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => window.open(`tel:${entregaAtual.contato_entrega.telefone}`, '_self')}
            >
              <Phone className="w-4 h-4 mr-2" />
              Ligar para {entregaAtual.contato_entrega.nome || 'contato'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Comprovante de Entrega
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Foto do Comprovante *</Label>
            {fotoComprovante ? (
              <div className="relative">
                <img src={fotoComprovante} className="w-full rounded-lg border" alt="Comprovante" />
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={() => setFotoComprovante(null)}
                >
                  Tirar outra
                </Button>
              </div>
            ) : (
              <Button
                onClick={tirarFoto}
                variant="outline"
                className="w-full h-32 border-dashed"
              >
                <div className="text-center">
                  <Camera className="w-8 h-8 mx-auto mb-2" />
                  <p>Tirar Foto</p>
                </div>
              </Button>
            )}
          </div>

          <div>
            <Label>Nome de Quem Recebeu *</Label>
            <Input
              value={nomeRecebedor}
              onChange={(e) => setNomeRecebedor(e.target.value)}
              placeholder="Nome completo..."
              className="mt-1"
            />
          </div>

          <div>
            <Label>CPF/RG (Opcional)</Label>
            <Input
              value={documentoRecebedor}
              onChange={(e) => setDocumentoRecebedor(e.target.value)}
              placeholder="000.000.000-00"
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-between gap-3 border rounded p-3">
            <div>
              <Label>Entrega parcial</Label>
              <p className="text-xs text-slate-500">Marque se apenas parte dos volumes foi entregue</p>
            </div>
            <input type="checkbox" checked={entregaParcial} onChange={(e) => setEntregaParcial(e.target.checked)} />
          </div>
          {entregaParcial && (
            <div>
              <Label>Quantidade entregue *</Label>
              <Input
                type="number"
                value={qtdParcial}
                onChange={(e) => setQtdParcial(parseFloat(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
          )}

          <div>
            <Label className="mb-2 block">Assinatura Digital</Label>
            <div className="border-2 border-dashed rounded-lg p-4 bg-white">
              <canvas
                id="assinatura-canvas"
                width="300"
                height="150"
                className="w-full border rounded"
                style={{ touchAction: 'none' }}
              />
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  const canvas = document.getElementById('assinatura-canvas');
                  const ctx = canvas.getContext('2d');
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  setAssinaturaBase64(null);
                }}
              >
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isOffline && (
        <Alert className="mb-4 border-amber-300 bg-amber-50">
          <AlertDescription className="text-sm text-amber-800">
            Sem conexão: envie sua posição via SMS.
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input placeholder="Número do gateway SMS" value={smsNumero} onChange={(e)=>setSmsNumero(e.target.value)} />
              <Button variant="outline" onClick={()=>{
                const lat = localizacao?.latitude?.toFixed(6) || 'LAT';
                const lng = localizacao?.longitude?.toFixed(6) || 'LNG';
                const entrega = entregaAtual?.id || 'ENTREGA';
                const placa = entregaAtual?.placa || 'PLACA';
                const body = `GPS ${lat},${lng} ENTREGA:${entrega} PLACA:${placa}`;
                const href = `sms:${encodeURIComponent(smsNumero)}?body=${encodeURIComponent(body)}`;
                window.location.href = href;
              }}>
                Abrir SMS com localização
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <Button
          onClick={registrarChegada}
          variant="outline"
          className="w-full h-12"
        >
          <MapPin className="w-5 h-5 mr-2" />
          Registrar Chegada
        </Button>

        <Button
          onClick={confirmarEntrega}
          disabled={!fotoComprovante || !nomeRecebedor}
          className="w-full bg-green-600 hover:bg-green-700 h-14 text-lg"
        >
          <CheckCircle className="w-5 h-5 mr-2" />
          {entregaParcial ? 'Confirmar Entrega Parcial' : 'Confirmar Entrega'}
        </Button>

        <details className="bg-white rounded-lg border">
          <summary className="p-4 cursor-pointer font-medium text-sm">
            ⚠️ Entrega Frustrada?
          </summary>
          <div className="p-4 pt-0 space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => registrarOcorrencia('Cliente Ausente')}>Cliente Ausente</Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => registrarOcorrencia('Endereço Incorreto')}>Endereço Incorreto</Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => registrarOcorrencia('Recusa de Recebimento')}>Recusa de Recebimento</Button>
          </div>
        </details>

        <details className="bg-white rounded-lg border">
          <summary className="p-4 cursor-pointer font-medium text-sm">
            🔁 Logística Reversa
          </summary>
          <div className="p-4 pt-0 space-y-3">
            <label className="text-xs text-slate-600">Motivo</label>
            <select className="w-full border rounded p-2" value={reversaMotivo} onChange={(e)=>setReversaMotivo(e.target.value)}>
              <option>Recusa Total</option>
              <option>Recusa Parcial</option>
              <option>Avaria</option>
              <option>Troca</option>
              <option>Outro</option>
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600">Quantidade Devolvida</label>
                <input type="number" className="w-full border rounded p-2" value={reversaQtd} onChange={(e)=>setReversaQtd(parseFloat(e.target.value)||0)} />
              </div>
              <div>
                <label className="text-xs text-slate-600">Valor Devolvido (R$)</label>
                <input type="number" step="0.01" className="w-full border rounded p-2" value={reversaValor} onChange={(e)=>setReversaValor(parseFloat(e.target.value)||0)} />
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full border-red-300 text-red-700"
              onClick={async ()=>{
                try {
                  const patch = buildReversaPatch({
                    entrega: entregaAtual,
                    user,
                    localizacao,
                    motivo: reversaMotivo,
                    quantidade: reversaQtd,
                    valor: reversaValor,
                  });
                  await aplicarPatchEntrega(entregaAtual, patch, '🔁 Logística reversa registrada');
                } catch (error) {
                  toast.error(error?.message || 'Falha ao registrar reversa');
                }
              }}
            >
              Registrar Reversa
            </Button>
          </div>
        </details>

        <Button variant="outline" className="w-full" onClick={() => setEntregaAtual(null)}>Voltar para Lista</Button>
      </div>
    </div>
  );
}
