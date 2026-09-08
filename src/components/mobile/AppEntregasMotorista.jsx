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
import usePermissions from '@/components/lib/usePermissions';
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
  const { filterInContext, updateInContext, grupoAtual, empresaAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
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
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId && empresaId);
  const canUsarApp =
    hasPermission('Expedicao', 'Entrega', 'entregar')
    || hasPermission('Expedicao', 'Entrega', 'editar')
    || hasPermission('Expedicao', 'Motorista', 'visualizar')
    || hasPermission('Cadastros', 'Motorista', 'visualizar')
    || hasPermission('Logistica', 'Entrega', 'entregar');
  const canAgirEntrega =
    hasPermission('Expedicao', 'Entrega', 'entregar')
    || hasPermission('Expedicao', 'Entrega', 'editar')
    || hasPermission('Expedicao', 'Entrega', 'ocorrencia')
    || hasPermission('Logistica', 'Entrega', 'entregar');

  const auditMotorista = async ({ acao, sucesso = true, motivo = null, entregaId = null, detalhes = {} }) => {
    await base44.entities.AuditLog.create({
      acao,
      modulo: 'Expedicao',
      entidade: 'Entrega',
      tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
      usuario_id: user?.id || user?.email || null,
      usuario_nome: user?.full_name || user?.email || 'Motorista',
      group_id: groupId,
      grupo_id: groupId,
      empresa_id: empresaId || detalhes.empresa_id || null,
      registro_id: entregaId,
      resultado: sucesso ? 'sucesso' : 'bloqueado',
      motivo,
      detalhes,
      data_hora: new Date().toISOString(),
    });
  };
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

  // Buscar cadastro Motorista para vinculo usuario/colaborador/email
  const { data: motoristasCadastro = [] } = useQuery({
    queryKey: ['motoristas-app', groupId, empresaId],
    queryFn: () => filterInContext('Motorista', {}, 'nome_completo', 200),
    enabled: !!user && contextoValido && canUsarApp,
  });

  // Buscar entregas do motorista
  const { data: minhasEntregas = [], refetch } = useQuery({
    queryKey: ['entregas-motorista', user?.id, groupId, empresaId, motoristasCadastro.length],
    queryFn: async () => {
      const todas = await filterInContext('Entrega', {}, '-data_saida', 500);
      return ordenarEntregasRota(filtrarEntregasDoMotorista(todas, user, motoristasCadastro));
    },
    enabled: !!user && contextoValido && canUsarApp,
    refetchInterval: 30000
  });

  const proxima = proximaParada(minhasEntregas, user, motoristasCadastro);

  const syncFilaOffline = async () => {
    const queue = readMotoristaQueue();
    setFilaOffline(queue);
    if (!queue.length || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    for (const action of queue) {
      try {
        await updateInContext('Entrega', action.entrega_id, {
          ...action.patch,
          group_id: action.group_id || action.patch?.group_id || groupId,
          empresa_id: action.empresa_id || action.patch?.empresa_id || empresaId,
        });
        dequeueMotoristaAction(action.id);
        await auditMotorista({
          acao: 'Motorista.sync',
          entregaId: action.entrega_id,
          detalhes: { tipo: action.tipo, idempotency_key: action.idempotency_key },
        });
      } catch (error) {
        console.error('[Motorista] Falha ao sincronizar acao offline.', error);
        try {
          await auditMotorista({
            acao: 'Motorista.sync.erro',
            sucesso: false,
            motivo: error?.message || 'sync_falhou',
            entregaId: action.entrega_id,
          });
        } catch (auditError) {
          console.error(auditError);
        }
        break;
      }
    }
    setFilaOffline(readMotoristaQueue());
    refetch();
  };

  const aplicarPatchEntrega = async (entrega, patch, sucessoMsg, acaoAudit, options = {}) => {
    if (!contextoValido || !canAgirEntrega) {
      await auditMotorista({
        acao: `${acaoAudit || 'Motorista.acao'}.bloqueado`,
        sucesso: false,
        motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
        entregaId: entrega?.id,
      });
      throw new Error('Contexto ou permissao obrigatoria para acao do motorista.');
    }
    const stampedPatch = {
      ...patch,
      group_id: entrega.group_id || groupId,
      grupo_id: entrega.grupo_id || groupId,
      empresa_id: entrega.empresa_id || empresaId,
    };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queued = enqueueMotoristaAction({
        tipo: patch.status,
        entrega_id: entrega.id,
        patch: stampedPatch,
        idempotency_key: patch.idempotency_key,
        group_id: stampedPatch.group_id,
        empresa_id: stampedPatch.empresa_id,
        usuario_id: user?.id || null,
      });
      setFilaOffline(queued.queue);
      toast.success(queued.reused ? 'Acao ja estava na fila offline' : 'Acao salva offline para sincronizar');
      if (!options.keepOpen) setEntregaAtual(null);
      else setEntregaAtual({ ...entrega, ...stampedPatch });
      return;
    }
    await updateInContext('Entrega', entrega.id, stampedPatch);
    await auditMotorista({
      acao: acaoAudit || 'Motorista.acao',
      entregaId: entrega.id,
      detalhes: { status: stampedPatch.status, idempotency_key: stampedPatch.idempotency_key },
    });
    toast.success(sucessoMsg);
    if (!options.keepOpen) setEntregaAtual(null);
    else setEntregaAtual({ ...entrega, ...stampedPatch });
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
        if (entregaAtual && contextoValido) {
          base44.entities.PosicaoVeiculo.create({
            group_id: groupId,
            grupo_id: groupId,
            empresa_id: entregaAtual.empresa_id || empresaId,
            entrega_id: entregaAtual.id,
            romaneio_id: entregaAtual.romaneio_id,
            motorista_id: entregaAtual.motorista_id || user.id,
            motorista_nome: user.full_name,
            placa: entregaAtual.placa,
            ...novaLocalizacao,
            bateria_nivel: 0,
            conectividade: navigator.connection?.effectiveType || '4G'
          }).catch((error) => {
            console.error('[Motorista] Falha ao gravar PosicaoVeiculo.', error);
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
      if (!contextoValido || !canAgirEntrega) {
        await auditMotorista({ acao: 'Motorista.inicio.bloqueado', sucesso: false, motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada', entregaId: entrega?.id });
        throw new Error('Contexto ou permissao obrigatoria para iniciar entrega.');
      }
      const patch = buildInicioPatch({ entrega, user, localizacao, motoristas: motoristasCadastro });
      await aplicarPatchEntrega(entrega, patch, '🚚 Entrega iniciada!', 'Motorista.inicio', { keepOpen: true });
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel iniciar a entrega');
    }
  };

  const registrarChegada = async () => {
    try {
      const patch = buildChegadaPatch({ entrega: entregaAtual, user, localizacao, motoristas: motoristasCadastro });
      await aplicarPatchEntrega(entregaAtual, patch, '📍 Chegada registrada', 'Motorista.chegada', { keepOpen: true });
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
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const reader = new FileReader();
          reader.onload = () => {
            setFotoComprovante(String(reader.result || ''));
            toast.success('Foto salva offline (sera enviada no sync)');
          };
          reader.onerror = () => toast.error('Falha ao ler foto offline');
          reader.readAsDataURL(file);
          return;
        }
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setFotoComprovante(file_url);
        toast.success('✅ Foto capturada!');
      } catch (error) {
        try {
          const reader = new FileReader();
          reader.onload = () => {
            setFotoComprovante(String(reader.result || ''));
            toast.success('Upload falhou; foto guardada localmente');
          };
          reader.readAsDataURL(file);
        } catch {
          toast.error('Erro ao fazer upload da foto');
        }
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
        motoristas: motoristasCadastro,
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
        entregaParcial ? 'Motorista.parcial' : 'Motorista.confirmacao',
      );
      setFotoComprovante(null);
      setAssinaturaBase64(null);
      setNomeRecebedor('');
      setDocumentoRecebedor('');
      setEntregaParcial(false);
      setQtdParcial(0);
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
        motoristas: motoristasCadastro,
      });
      await aplicarPatchEntrega(entregaAtual, patch, '❌ Ocorrência registrada', 'Motorista.ocorrencia');
    } catch (error) {
      toast.error(error?.message || 'Falha ao registrar ocorrencia');
    }
  };

  if (!contextoValido || !canUsarApp) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center" data-context-required="true">
        <Card className="w-full max-w-md border-amber-200 bg-amber-50">
          <CardContent className="p-6 space-y-2 text-sm text-amber-950">
            <p className="font-semibold">App Motorista bloqueado</p>
            <p>Selecione grupo e empresa e garanta permissao de entrega/motorista.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const podeConfirmar = Boolean(nomeRecebedor && (fotoComprovante || assinaturaBase64 || documentoRecebedor));

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
          disabled={!podeConfirmar || !canAgirEntrega}
          className="w-full bg-green-600 hover:bg-green-700 h-14 text-lg"
          data-permission="Expedicao.Entrega.entregar"
          data-context-required="true"
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
                    motoristas: motoristasCadastro,
                  });
                  await aplicarPatchEntrega(entregaAtual, patch, '🔁 Logística reversa registrada', 'Motorista.reversa');
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
