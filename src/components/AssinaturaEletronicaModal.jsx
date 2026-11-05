import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  PenTool, CheckCircle, X, Trash2, Download, 
  Shield, Clock, User, MapPin, Smartphone, Monitor
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  isAssinaturaModalScopeCurrent,
  assertAssinaturaModalContext,
  assertAssinaturaModalDocumento,
  buildAssinaturaModalCampoContrato,
  buildAssinaturaModalCampoPedido,
  resolveAssinaturaModalEntity,
} from "./assinaturaEletronicaModalScope";

/** Persistência Contrato/Pedido via updateInContext (não entities.update unscoped). */
export default function AssinaturaEletronicaModal({ 
  isOpen, 
  onClose, 
  documento, // contrato, pedido, etc
  tipo = "contrato", // contrato, pedido, termo
  onAssinado
}) {
  const { toast } = useToast();
  const { updateInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const readActorAndSession = () => {
    const session = readErpHttpSession();
    const actorId = typeof session?.actorId === "string" && session.actorId.trim()
      ? session.actorId.trim()
      : null;
    return { actorId, sessionKey: central360SessionKey(session?.token) };
  };
  const canvasRef = useRef(null);
  const [assinando, setAssinando] = useState(false);
  const [assinado, setAssinado] = useState(false);
  const [desenhando, setDesenhando] = useState(false);
  const [assinaturaVazia, setAssinaturaVazia] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [dadosAssinatura, setDadosAssinatura] = useState({
    nome_completo: "",
    cpf: "",
    email: "",
    cargo: "",
    ip_address: "",
    dispositivo: "",
    navegador: ""
  });

  useEffect(() => {
    const carregarUsuario = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        setDadosAssinatura(prev => ({
          ...prev,
          nome_completo: user.full_name || "",
          email: user.email || ""
        }));
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
      }
    };

    if (isOpen) {
      carregarUsuario();
      obterDadosDispositivo();
      inicializarCanvas();
    }
  }, [isOpen]);

  // Obter dados do dispositivo e navegador
  const obterDadosDispositivo = () => {
    // Detectar dispositivo
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const dispositivo = isMobile ? 'Mobile' : 'Desktop';

    // Detectar navegador
    const userAgent = navigator.userAgent;
    let navegador = 'Desconhecido';
    
    if (userAgent.indexOf("Firefox") > -1) {
      navegador = "Firefox";
    } else if (userAgent.indexOf("SamsungBrowser") > -1) {
      navegador = "Samsung Internet";
    } else if (userAgent.indexOf("Opera") > -1 || userAgent.indexOf("OPR") > -1) {
      navegador = "Opera";
    } else if (userAgent.indexOf("Trident") > -1) {
      navegador = "Internet Explorer";
    } else if (userAgent.indexOf("Edge") > -1) {
      navegador = "Edge";
    } else if (userAgent.indexOf("Chrome") > -1) {
      navegador = "Chrome";
    } else if (userAgent.indexOf("Safari") > -1) {
      navegador = "Safari";
    }

    // Simular IP (em produção viria do backend)
    const ip_address = "192.168.1." + Math.floor(Math.random() * 255);

    setDadosAssinatura(prev => ({
      ...prev,
      dispositivo,
      navegador,
      ip_address
    }));
  };

  // Inicializar canvas
  const inicializarCanvas = () => {
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Preencher com fundo branco
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, 100);
  };

  // Iniciar desenho
  const iniciarDesenho = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setDesenhando(true);
    setAssinaturaVazia(false);

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if (e.type === 'mousedown') {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    } else if (e.type === 'touchstart') {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  // Desenhar
  const desenhar = (e) => {
    if (!desenhando) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    let x, y;
    if (e.type === 'mousemove') {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    } else if (e.type === 'touchmove') {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  // Parar desenho
  const pararDesenho = () => {
    setDesenhando(false);
  };

  // Limpar assinatura
  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setAssinaturaVazia(true);
  };

  // Validar antes de assinar
  const validar = () => {
    if (assinaturaVazia) {
      toast({
        title: "⚠️ Assinatura obrigatória",
        description: "Desenhe sua assinatura no espaço indicado",
        variant: "destructive"
      });
      return false;
    }

    if (!dadosAssinatura.nome_completo) {
      toast({
        title: "⚠️ Nome completo obrigatório",
        variant: "destructive"
      });
      return false;
    }

    if (!dadosAssinatura.cpf) {
      toast({
        title: "⚠️ CPF obrigatório",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  // Converter canvas para base64
  const obterAssinaturaBase64 = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  // Assinar documento
  const assinarDocumento = async () => {
    if (!validar()) return;

    try {
      setAssinando(true);
      assertAssinaturaModalContext(groupId, empresaId);
      const documentoId = assertAssinaturaModalDocumento(documento, tipo);
      const scopeExpected = readActorAndSession();

      // Obter assinatura em base64
      const assinaturaImagem = obterAssinaturaBase64();

      // Dados completos da assinatura
      const assinatura = {
        ...dadosAssinatura,
        assinatura_imagem: assinaturaImagem,
        data_hora: new Date().toISOString(),
        documento_tipo: tipo,
        documento_id: documento.id,
        documento_numero: documento.numero_contrato || documento.numero_pedido || documento.numero,
        geolocation: "São Paulo, BR", // Em produção obteria via API
        user_id: currentUser?.id || "",
        user_email: currentUser?.email || ""
      };

      // Simular upload da assinatura
      await new Promise(resolve => setTimeout(resolve, 1500));

      const campoAssinatura = tipo === "contrato"
        ? buildAssinaturaModalCampoContrato(documento, assinatura)
        : buildAssinaturaModalCampoPedido(assinatura);
      await updateInContext(resolveAssinaturaModalEntity(tipo), documentoId, campoAssinatura);

      if (!isAssinaturaModalScopeCurrent(scopeExpected, readActorAndSession())) {
        throw Object.assign(new Error("ASSINATURA_MODAL_STALE_SCOPE"), {
          code: "ASSINATURA_MODAL_STALE_SCOPE",
        });
      }

      setAssinado(true);

      toast({
        title: "✅ Documento assinado!",
        description: "Assinatura registrada com sucesso"
      });

      if (onAssinado) {
        onAssinado(assinatura);
      }

    } catch (error) {
      console.error("Erro ao assinar:", error);
      toast({
        title: "❌ Erro ao assinar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setAssinando(false);
    }
  };
  // Baixar comprovante
  const baixarComprovante = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `assinatura_${tipo}_${documento.id}.png`;
    link.href = canvas.toDataURL();
    link.click();

    toast({
      title: "📥 Download iniciado",
      description: "Comprovante de assinatura baixado"
    });
  };

  const fechar = () => {
    limparAssinatura();
    setAssinado(false);
    onClose();
  };

  if (!documento) return null;

  return (
    <Dialog open={isOpen} onOpenChange={fechar}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Assinatura Eletrônica
            {assinado && <Badge className="bg-green-600">Assinado</Badge>}
          </DialogTitle>
        </DialogHeader>

        {!assinado ? (
          <div className="space-y-6">
            {/* Info do Documento */}
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 mb-2">Documento a ser assinado:</p>
                  <div className="grid grid-cols-2 gap-3 text-sm text-blue-800">
                    <div>
                      <span className="text-blue-600">Tipo:</span>{" "}
                      <strong className="capitalize">{tipo}</strong>
                    </div>
                    <div>
                      <span className="text-blue-600">Número:</span>{" "}
                      <strong>
                        {documento.numero_contrato || documento.numero_pedido || documento.numero}
                      </strong>
                    </div>
                    {documento.parte_contratante && (
                      <div className="col-span-2">
                        <span className="text-blue-600">Parte:</span>{" "}
                        <strong>{documento.parte_contratante}</strong>
                      </div>
                    )}
                    {documento.cliente_nome && (
                      <div className="col-span-2">
                        <span className="text-blue-600">Cliente:</span>{" "}
                        <strong>{documento.cliente_nome}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Dados do Assinante */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome Completo *</Label>
                <Input
                  value={dadosAssinatura.nome_completo}
                  onChange={(e) => setDadosAssinatura(prev => ({...prev, nome_completo: e.target.value}))}
                  required
                />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input
                  value={dadosAssinatura.cpf}
                  onChange={(e) => setDadosAssinatura(prev => ({...prev, cpf: e.target.value}))}
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={dadosAssinatura.email}
                  onChange={(e) => setDadosAssinatura(prev => ({...prev, email: e.target.value}))}
                />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input
                  value={dadosAssinatura.cargo}
                  onChange={(e) => setDadosAssinatura(prev => ({...prev, cargo: e.target.value}))}
                  placeholder="Ex: Diretor"
                />
              </div>
            </div>

            {/* Canvas de Assinatura */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Desenhe sua assinatura *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={limparAssinatura}
                  disabled={assinaturaVazia}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpar
                </Button>
              </div>
              
              <Card className="p-1 border-2 border-slate-300">
                <canvas
                  ref={canvasRef}
                  width={700}
                  height={200}
                  className="w-full cursor-crosshair touch-none"
                  onMouseDown={iniciarDesenho}
                  onMouseMove={desenhar}
                  onMouseUp={pararDesenho}
                  onMouseLeave={pararDesenho}
                  onTouchStart={iniciarDesenho}
                  onTouchMove={desenhar}
                  onTouchEnd={pararDesenho}
                />
              </Card>
              <p className="text-xs text-slate-500 mt-1">
                Use o mouse ou toque na tela para assinar
              </p>
            </div>

            {/* Dados do Dispositivo */}
            <Card className="p-4 bg-slate-50">
              <p className="font-semibold mb-3 text-sm">Dados da Assinatura (registrados automaticamente):</p>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="text-slate-500">Data/Hora</p>
                    <p className="font-semibold">{new Date().toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {dadosAssinatura.dispositivo === 'Mobile' ? (
                    <Smartphone className="w-4 h-4 text-slate-500" />
                  ) : (
                    <Monitor className="w-4 h-4 text-slate-500" />
                  )}
                  <div>
                    <p className="text-slate-500">Dispositivo</p>
                    <p className="font-semibold">{dadosAssinatura.dispositivo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="text-slate-500">Navegador</p>
                    <p className="font-semibold">{dadosAssinatura.navegador}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="text-slate-500">IP</p>
                    <p className="font-semibold">{dadosAssinatura.ip_address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <Shield className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="text-slate-500">Hash SHA-256</p>
                    <p className="font-mono text-xs">{documento.id?.substring(0, 16)}...</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Termos */}
            <Card className="p-4 border-amber-200 bg-amber-50">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p className="font-semibold mb-2">Declaração:</p>
                  <p>
                    Ao assinar este documento eletronicamente, declaro que:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-amber-800">
                    <li>Li e concordo com todos os termos do documento</li>
                    <li>Tenho plena capacidade jurídica para assinar</li>
                    <li>A assinatura tem validade legal conforme MP 2.200-2/2001</li>
                    <li>Os dados registrados são verdadeiros e precisos</li>
                  </ul>
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={fechar}>
                Cancelar
              </Button>
              <Button 
                type="button" 
                onClick={assinarDocumento}
                disabled={assinando}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {assinando ? (
                  <>
                    <Shield className="w-4 h-4 mr-2 animate-pulse" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <PenTool className="w-4 h-4 mr-2" />
                    Assinar Documento
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-green-900 mb-2">
              Documento Assinado!
            </h3>
            <p className="text-green-800 mb-6">
              Sua assinatura foi registrada com sucesso
            </p>

            <Card className="p-6 max-w-md mx-auto mb-6 text-left">
              <p className="font-semibold mb-3">Detalhes da Assinatura:</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Assinante:</span>
                  <strong>{dadosAssinatura.nome_completo}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">CPF:</span>
                  <strong>{dadosAssinatura.cpf}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Data/Hora:</span>
                  <strong>{new Date().toLocaleString('pt-BR')}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">IP:</span>
                  <strong>{dadosAssinatura.ip_address}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Dispositivo:</span>
                  <strong>{dadosAssinatura.dispositivo} - {dadosAssinatura.navegador}</strong>
                </div>
              </div>
            </Card>

            <div className="flex justify-center gap-3">
              <Button type="button" variant="outline" onClick={baixarComprovante}>
                <Download className="w-4 h-4 mr-2" />
                Baixar Comprovante
              </Button>
              <Button onClick={fechar} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                Concluir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}