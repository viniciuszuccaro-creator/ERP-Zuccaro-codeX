import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, CheckCircle, AlertCircle, Send, Copy, QrCode, FileText, Eye } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * Teste de Geração de Boletos e PIX
 * V21.1.2 - WINDOW MODE READY
 */
export default function TesteBoletos({ configuracao, windowMode = false }) {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [valorTeste, setValorTeste] = useState("150.00");
  const [clienteTeste, setClienteTeste] = useState("Cliente Teste Ltda");

  const { toast } = useToast();
  const { user } = useUser();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || user?.grupo_atual_id || user?.grupo_padrao_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeTestar = isAdmin() || hasPermission("Sistema", "Integracoes", "editar") || hasPermission("Sistema", "Integrações", "editar");

  const auditarTeste = async (acao, descricao, dadosNovos = null) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        acao,
        modulo: "Integracoes",
        entidade: "TesteBoletos",
        descricao,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Falha ao auditar teste de boletos:", error);
    }
  };

  const executarTeste = async () => {
    if (!contextoValido) {
      toast({
        title: "Contexto obrigatorio",
        description: "Selecione grupo ou empresa antes de testar boleto/PIX.",
        variant: "destructive"
      });
      await auditarTeste("Bloqueio sem contexto", "Tentativa de testar boleto/PIX sem grupo ou empresa.", { valor_teste: valorTeste, cliente_teste: clienteTeste });
      return;
    }
    if (!podeTestar) {
      toast({
        title: "Permissao negada",
        description: "Seu perfil nao permite executar testes de integracoes.",
        variant: "destructive"
      });
      await auditarTeste("Bloqueio por permissao", "Tentativa de testar boleto/PIX sem permissao.", { valor_teste: valorTeste, cliente_teste: clienteTeste });
      return;
    }
    if (!valorTeste || parseFloat(valorTeste) <= 0) {
      toast({
        title: "❌ Erro",
        description: "Informe um valor válido",
        variant: "destructive"
      });
      return;
    }

    setTestando(true);
    setResultado(null);

    try {
      // Simular geração de boleto e PIX
      await new Promise(resolve => setTimeout(resolve, 2000));

      const boletoSimulado = {
        status: 'success',
        valor: parseFloat(valorTeste),
        cliente: clienteTeste,
        vencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        boleto: {
          linha_digitavel: '34191.79001 01043.510047 91020.150008 1 96610000015000',
          codigo_barras: '34191966100000150001790010104351004912010150',
          url_pdf: 'https://exemplo.com/boleto.pdf',
          nosso_numero: Math.floor(Math.random() * 10000000)
        },
        pix: {
          qrcode_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...',
          copia_cola: '00020126580014br.gov.bcb.pix0136' + Math.random().toString(36).substring(2, 15),
          validade_horas: 24
        },
        provedor: configuracao?.integracao_boletos?.provedor || 'Simulação',
        id_cobranca: `COB${Date.now()}`
      };

      setResultado(boletoSimulado);
      await auditarTeste("Teste Boleto PIX", "Teste simulado de boleto e PIX executado.", {
        valor: boletoSimulado.valor,
        cliente: boletoSimulado.cliente,
        provedor: boletoSimulado.provedor,
        id_cobranca: boletoSimulado.id_cobranca,
      });

      toast({
        title: "✅ Cobrança Gerada!",
        description: `Boleto e PIX gerados com sucesso`
      });
    } catch (error) {
      setResultado({
        status: 'error',
        mensagem: error.message
      });
      await auditarTeste("Erro Teste Boleto PIX", "Falha no teste simulado de boleto e PIX.", { erro: error.message, valor_teste: valorTeste, cliente_teste: clienteTeste });
      
      toast({
        title: "❌ Erro na Geração",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setTestando(false);
    }
  };

  const copiarCodigoPix = async () => {
    if (!contextoValido || !podeTestar) {
      toast({
        title: "Acao bloqueada",
        description: "Selecione contexto e confirme permissao para copiar codigo sensivel.",
        variant: "destructive"
      });
      await auditarTeste(contextoValido ? "Bloqueio por permissao" : "Bloqueio sem contexto", "Tentativa de copiar codigo PIX sem contexto/permissao.");
      return;
    }
    if (resultado?.pix?.copia_cola) {
      navigator.clipboard.writeText(resultado.pix.copia_cola);
      await auditarTeste("Copiar PIX", "Codigo PIX copia e cola copiado em teste.", { id_cobranca: resultado?.id_cobranca || null });
      toast({
        title: "✅ Código PIX Copiado!",
        description: "Cole no app do seu banco"
      });
    }
  };

  return (
    <div className={`space-y-4 ${windowMode ? 'w-full h-full overflow-auto p-6 bg-white' : ''}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Testar Geração de Boleto e PIX
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-300 bg-amber-50">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <AlertDescription>
              <strong>🧪 Modo de Simulação</strong><br />
              Esta integração está em modo de teste. Para gerar boletos e PIX reais, 
              configure a integração com Asaas, Juno ou outro gateway de pagamento.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="valor_teste">Valor do Teste (R$)</Label>
              <Input
                id="valor_teste"
                type="number"
                step="0.01"
                value={valorTeste}
                onChange={(e) => setValorTeste(e.target.value)}
                placeholder="150.00"
                disabled={!contextoValido || !podeTestar}
                data-action="Integracoes.TesteBoletos.valorTeste"
                data-permission="Sistema.Integracoes.editar"
                data-context-required="group-or-company"
              />
            </div>
            <div>
              <Label htmlFor="cliente_teste">Cliente de Teste</Label>
              <Input
                id="cliente_teste"
                value={clienteTeste}
                onChange={(e) => setClienteTeste(e.target.value)}
                placeholder="Nome do cliente..."
                disabled={!contextoValido || !podeTestar}
                data-action="Integracoes.TesteBoletos.clienteTeste"
                data-permission="Sistema.Integracoes.editar"
                data-context-required="group-or-company"
              />
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Provedor:</strong> {configuracao?.integracao_boletos?.provedor || 'Não configurado'}
            </p>
            <p className="text-sm text-blue-900">
              <strong>Status:</strong> {configuracao?.integracao_boletos?.ativa ? '✅ Ativa' : '⚠️ Inativa'}
            </p>
            <p className="text-sm text-blue-900">
              <strong>Ambiente:</strong> {configuracao?.integracao_boletos?.ambiente || 'Sandbox'}
            </p>
          </div>

          <Button
            onClick={executarTeste}
            disabled={testando || !contextoValido || !podeTestar}
            className="w-full bg-green-600 hover:bg-green-700"
            data-action="Integracoes.TesteBoletos.executar"
            data-permission="Sistema.Integracoes.editar"
            data-context-required="group-or-company"
            data-sensitive="true"
          >
            {testando ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Gerando Cobrança...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Gerar Boleto e PIX de Teste
              </>
            )}
          </Button>

          {resultado && resultado.status === 'success' && (
            <div className="space-y-3">
              {/* Boleto */}
              <Card className="bg-orange-50 border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Boleto Bancário
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">
                    <p><strong>Nosso Número:</strong> {resultado.boleto.nosso_numero}</p>
                    <p><strong>Vencimento:</strong> {new Date(resultado.vencimento).toLocaleDateString('pt-BR')}</p>
                    <p className="text-xs font-mono bg-white p-2 rounded mt-2 break-all">
                      {resultado.boleto.linha_digitavel}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="w-full" data-action="Integracoes.TesteBoletos.verPdf" data-permission="Sistema.Integracoes.visualizar" data-context-required="group-or-company" data-sensitive="true">
                    <Eye className="w-4 h-4 mr-1" />
                    Ver Boleto PDF
                  </Button>
                </CardContent>
              </Card>

              {/* PIX */}
              <Card className="bg-green-50 border-green-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <QrCode className="w-4 h-4" />
                    PIX Copia e Cola
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="bg-white p-3 rounded border text-center">
                    <div className="w-32 h-32 mx-auto bg-slate-200 rounded flex items-center justify-center mb-2">
                      <QrCode className="w-16 h-16 text-slate-400" />
                    </div>
                    <p className="text-xs text-slate-600">
                      Válido por {resultado.pix.validade_horas}h
                    </p>
                  </div>
                  
                  <div className="text-xs font-mono bg-white p-2 rounded border break-all">
                    {resultado.pix.copia_cola}
                  </div>

                  <Button 
                    size="sm" 
                    onClick={copiarCodigoPix}
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={!contextoValido || !podeTestar}
                    data-action="Integracoes.TesteBoletos.copiarPix"
                    data-permission="Sistema.Integracoes.editar"
                    data-context-required="group-or-company"
                    data-sensitive="true"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copiar Código PIX
                  </Button>
                </CardContent>
              </Card>

              <div className="p-3 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Valor:</strong> R$ {resultado.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-blue-900">
                  <strong>Cliente:</strong> {resultado.cliente}
                </p>
                <p className="text-sm text-blue-900">
                  <strong>ID da Cobrança:</strong> {resultado.id_cobranca}
                </p>
              </div>
            </div>
          )}

          {resultado && resultado.status === 'error' && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-900">
                  <AlertCircle className="w-5 h-5" />
                  <p>{resultado.mensagem}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
