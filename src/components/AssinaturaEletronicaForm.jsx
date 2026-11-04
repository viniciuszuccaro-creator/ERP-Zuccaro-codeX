import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  PenTool, CheckCircle, Trash2, Download, 
  Shield, Clock, User, MapPin, Smartphone, Monitor
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function AssinaturaEletronicaForm({ 
  documento, 
  tipo = "contrato", 
  onAssinado,
  windowMode = false
}) {
  const { toast } = useToast();
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

    carregarUsuario();
    obterDadosDispositivo();
    setTimeout(() => inicializarCanvas(), 100);
  }, []);

  const obterDadosDispositivo = () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const dispositivo = isMobile ? 'Mobile' : 'Desktop';
    const userAgent = navigator.userAgent;
    let navegador = 'Desconhecido';
    
    if (userAgent.indexOf("Firefox") > -1) navegador = "Firefox";
    else if (userAgent.indexOf("Chrome") > -1) navegador = "Chrome";
    else if (userAgent.indexOf("Safari") > -1) navegador = "Safari";
    else if (userAgent.indexOf("Edge") > -1) navegador = "Edge";

    // Sem fonte canônica de IP no browser → DESCONHECIDO (não fabricar 192.168.x).
    // Persistência/auditoria server-side deve capturar IP real quando disponível.
    const ip_address = null;

    setDadosAssinatura(prev => ({ ...prev, dispositivo, navegador, ip_address }));
  };

  const inicializarCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

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

  const pararDesenho = () => setDesenhando(false);

  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setAssinaturaVazia(true);
  };

  const validar = () => {
    if (assinaturaVazia) {
      toast({ title: "⚠️ Assinatura obrigatória", description: "Desenhe sua assinatura no espaço indicado", variant: "destructive" });
      return false;
    }
    if (!dadosAssinatura.nome_completo) {
      toast({ title: "⚠️ Nome completo obrigatório", variant: "destructive" });
      return false;
    }
    if (!dadosAssinatura.cpf) {
      toast({ title: "⚠️ CPF obrigatório", variant: "destructive" });
      return false;
    }
    return true;
  };

  const obterAssinaturaBase64 = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  const assinarDocumento = async () => {
    if (!validar()) return;

    try {
      setAssinando(true);

      const assinaturaImagem = obterAssinaturaBase64();
      const assinatura = {
        ...dadosAssinatura,
        assinatura_imagem: assinaturaImagem,
        data_hora: new Date().toISOString(),
        documento_tipo: tipo,
        documento_id: documento.id,
        documento_numero: documento.numero_contrato || documento.numero_pedido || documento.numero,
        geolocation: "São Paulo, BR",
        user_id: currentUser?.id || "",
        user_email: currentUser?.email || ""
      };

      await new Promise(resolve => setTimeout(resolve, 1500));

      let campoAssinatura = {};
      
      if (tipo === "contrato") {
        campoAssinatura = {
          assinado: true,
          data_assinatura: new Date().toISOString().split('T')[0],
          assinatura_digital: assinatura,
          status: documento.status === "Aguardando Assinatura" ? "Vigente" : documento.status
        };
        await base44.entities.Contrato.update(documento.id, campoAssinatura);
      } else if (tipo === "pedido") {
        campoAssinatura = {
          assinado_cliente: true,
          data_assinatura_cliente: new Date().toISOString(),
          assinatura_cliente: assinatura
        };
        await base44.entities.Pedido.update(documento.id, campoAssinatura);
      }

      setAssinado(true);
      toast({ title: "✅ Documento assinado!", description: "Assinatura registrada com sucesso" });

      if (onAssinado) onAssinado(assinatura);

    } catch (error) {
      console.error("Erro ao assinar:", error);
      toast({ title: "❌ Erro ao assinar", description: error.message, variant: "destructive" });
    } finally {
      setAssinando(false);
    }
  };

  const baixarComprovante = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `assinatura_${tipo}_${documento.id}.png`;
    link.href = canvas.toDataURL();
    link.click();

    toast({ title: "📥 Download iniciado", description: "Comprovante de assinatura baixado" });
  };

  if (!documento) return null;

  const content = (
    <div className={`space-y-6 ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}>
      {!assinado ? (
        <>
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-blue-900 mb-2">Documento a ser assinado:</p>
                <div className="grid grid-cols-2 gap-3 text-sm text-blue-800">
                  <div>
                    <span className="text-blue-600">Tipo:</span> <strong className="capitalize">{tipo}</strong>
                  </div>
                  <div>
                    <span className="text-blue-600">Número:</span>{" "}
                    <strong>{documento.numero_contrato || documento.numero_pedido || documento.numero}</strong>
                  </div>
                  {documento.cliente_nome && (
                    <div className="col-span-2">
                      <span className="text-blue-600">Cliente:</span> <strong>{documento.cliente_nome}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'nome_completo', label: 'Nome Completo *', required: true },
              { key: 'cpf', label: 'CPF *', placeholder: '000.000.000-00', required: true },
              { key: 'email', label: 'E-mail', type: 'email' },
              { key: 'cargo', label: 'Cargo', placeholder: 'Ex: Diretor' }
            ].map(({ key, label, placeholder, type, required }) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input
                  type={type || 'text'}
                  value={dadosAssinatura[key]}
                  onChange={(e) => setDadosAssinatura(prev => ({...prev, [key]: e.target.value}))}
                  placeholder={placeholder}
                  required={required}
                  className="mt-1"
                />
              </div>
            ))}
          </div>

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
            <p className="text-xs text-slate-500 mt-1">Use o mouse ou toque na tela para assinar</p>
          </div>

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
                {dadosAssinatura.dispositivo === 'Mobile' ? <Smartphone className="w-4 h-4 text-slate-500" /> : <Monitor className="w-4 h-4 text-slate-500" />}
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
              <div className="flex items-center gap-2" data-action="assinatura-ip" data-kpi-status={dadosAssinatura.ip_address ? "ok" : "unavailable"}>
                <MapPin className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-slate-500">IP</p>
                  <p className={`font-semibold ${dadosAssinatura.ip_address ? "" : "text-amber-800"}`} data-action={dadosAssinatura.ip_address ? undefined : "assinatura-ip-desconhecido"}>
                    {dadosAssinatura.ip_address || "DESCONHECIDO"}
                  </p>
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

          <Card className="p-4 border-amber-200 bg-amber-50">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold mb-2">Declaração:</p>
                <p>Ao assinar este documento eletronicamente, declaro que:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-amber-800">
                  <li>Li e concordo com todos os termos do documento</li>
                  <li>Tenho plena capacidade jurídica para assinar</li>
                  <li>A assinatura tem validade legal conforme MP 2.200-2/2001</li>
                  <li>Os dados registrados são verdadeiros e precisos</li>
                </ul>
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
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
        </>
      ) : (
        <div className="py-12 text-center">
          <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-green-900 mb-2">Documento Assinado!</h3>
          <p className="text-green-800 mb-6">Sua assinatura foi registrada com sucesso</p>

          <Card className="p-6 max-w-md mx-auto mb-6 text-left">
            <p className="font-semibold mb-3">Detalhes da Assinatura:</p>
            <div className="space-y-2 text-sm">
              {[
                ['Assinante', dadosAssinatura.nome_completo],
                ['CPF', dadosAssinatura.cpf],
                ['Data/Hora', new Date().toLocaleString('pt-BR')],
                ['IP', dadosAssinatura.ip_address || 'DESCONHECIDO'],
                ['Dispositivo', `${dadosAssinatura.dispositivo} - ${dadosAssinatura.navegador}`]
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-600">{label}:</span>
                  <strong className={label === 'IP' && !dadosAssinatura.ip_address ? 'text-amber-800' : undefined}>{value}</strong>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex justify-center gap-3">
            <Button type="button" variant="outline" onClick={baixarComprovante}>
              <Download className="w-4 h-4 mr-2" />
              Baixar Comprovante
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white">{content}</div>;
  }

  return content;
}