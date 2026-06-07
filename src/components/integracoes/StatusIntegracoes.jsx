import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  DollarSign, 
  MessageCircle,
  Settings,
  Zap
} from 'lucide-react';
import integracaoNFe from '../lib/integracaoNFe';
import integracaoBoletos from '../lib/integracaoBoletos';
import integracaoWhatsApp from '../lib/integracaoWhatsApp';
import { useWindow } from '../lib/useWindow';
import ConfiguracaoNFeForm from '../cadastros/ConfiguracaoNFeForm';
import ConfiguracaoBoletosForm from '../cadastros/ConfiguracaoBoletosForm';
import ConfiguracaoWhatsAppForm from '../cadastros/ConfiguracaoWhatsAppForm';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

/**
 * Painel de Status das Integrações Reais
 * Mostra status de NF-e, Boletos/PIX e WhatsApp
 */
// Component helper para botões de configuração
function IntegrationConfigButtons({ integracao, empresaId, groupId }) {
  const { openWindow } = useWindow();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { filterInContext, createInContext, updateInContext } = useContextoVisual();
  const scopeId = empresaId || groupId || null;
  const scope = empresaId ? { empresa_id: empresaId } : groupId ? { group_id: groupId } : {};

  const handleConfigurar = () => {
    const entityMap = {
      'nfe': { 
        form: ConfiguracaoNFeForm,
        key: 'integracao_nfe',
        queryKey: 'configs-integracoes',
        title: '⚙️ Configurar NF-e'
      },
      'boleto': { 
        form: ConfiguracaoBoletosForm,
        key: 'integracao_boletos',
        queryKey: 'configs-integracoes',
        title: '⚙️ Configurar Boletos & PIX'
      },
      'whatsapp': { 
        form: ConfiguracaoWhatsAppForm,
        key: 'integracao_whatsapp',
        queryKey: 'configs-integracoes',
        title: '⚙️ Configurar WhatsApp Business'
      }
    };

    const cfg = entityMap[integracao.id];
    if (!cfg) return;

    const handleSubmit = async (data) => {
      try {
        if (!scopeId) throw new Error('Selecione um grupo ou empresa.');
        const chave = `integracoes_${scopeId}`;
        const existentes = await filterInContext('ConfiguracaoSistema', { chave }, undefined, 1);
        const payload = { chave, categoria: 'Integracoes', ...scope, [cfg.key]: data };
        if (existentes && existentes.length > 0) {
          await updateInContext('ConfiguracaoSistema', existentes[0].id, { ...existentes[0], ...payload });
          toast({ title: `✅ Integração atualizada!` });
        } else {
          await createInContext('ConfiguracaoSistema', payload);
          toast({ title: `✅ Integração criada!` });
        }
        queryClient.invalidateQueries({ queryKey: [cfg.queryKey] });
        queryClient.invalidateQueries({ queryKey: ['status-integracoes', scopeId] });
      } catch (error) {
        toast({ title: `❌ Erro ao salvar`, description: error.message, variant: "destructive" });
      }
    };

    openWindow(cfg.form, { 
      windowMode: true,
      onSubmit: handleSubmit,
      empresaId: empresaId || null,
      groupId: groupId || null,
      scope,
    }, {
      title: cfg.title,
      width: 1000,
      height: 700
    });
  };

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={integracao.onVerificar}
        disabled={integracao.verificando}
        className="flex-1"
        data-action={`IntegracoesStatus.${integracao.id}.verificar`}
      >
        {integracao.verificando ? 'Verificando...' : 'Verificar'}
      </Button>
      <Button
        size="sm"
        onClick={handleConfigurar}
        className="flex-1"
        data-action={`IntegracoesStatus.${integracao.id}.configurar`}
      >
        <Settings className="w-4 h-4 mr-1" />
        Configurar
      </Button>
    </div>
  );
}

export default function StatusIntegracoes({ empresaId, groupId }) {
  const [verificandoNFe, setVerificandoNFe] = useState(false);
  const [verificandoBoleto, setVerificandoBoleto] = useState(false);
  const [verificandoWhatsApp, setVerificandoWhatsApp] = useState(false);

  const [statusNFe, setStatusNFe] = useState(null);
  const [statusBoleto, setStatusBoleto] = useState(null);
  const [statusWhatsApp, setStatusWhatsApp] = useState(null);
  const { filterInContext } = useContextoVisual();
  const scopeId = empresaId || groupId || null;
  const scope = empresaId ? { empresa_id: empresaId } : groupId ? { group_id: groupId } : {};

  const verificarConfigLocal = async (key) => {
    if (!scopeId) return { configurado: false, erro: 'Selecione um grupo ou empresa.' };
    const chave = `integracoes_${scopeId}`;
    const rows = await filterInContext('ConfiguracaoSistema', { chave }, undefined, 1);
    const cfg = rows?.[0]?.[key];
    const configurado = !!(cfg?.ativo || cfg?.api_key || cfg?.api_url || cfg?.provedor);
    return { configurado, conectado: configurado, integracao: cfg || null };
  };

  // Verificar NFe
  const handleVerificarNFe = async () => {
    setVerificandoNFe(true);
    try {
      const resultado = empresaId ? await integracaoNFe.verificarConfiguracao(empresaId) : await verificarConfigLocal('integracao_nfe');
      setStatusNFe(resultado);
    } catch (error) {
      setStatusNFe({ configurado: false, erro: error.message });
    } finally {
      setVerificandoNFe(false);
    }
  };

  // Verificar Boletos
  const handleVerificarBoleto = async () => {
    setVerificandoBoleto(true);
    try {
      const resultado = empresaId ? await integracaoBoletos.verificarConfiguracao(empresaId) : await verificarConfigLocal('integracao_boletos');
      setStatusBoleto(resultado);
    } catch (error) {
      setStatusBoleto({ configurado: false, erro: error.message });
    } finally {
      setVerificandoBoleto(false);
    }
  };

  // Verificar WhatsApp
  const handleVerificarWhatsApp = async () => {
    setVerificandoWhatsApp(true);
    try {
      const resultado = empresaId ? await integracaoWhatsApp.verificarConexao(empresaId) : await verificarConfigLocal('integracao_whatsapp');
      setStatusWhatsApp(resultado);
    } catch (error) {
      setStatusWhatsApp({ conectado: false, erro: error.message });
    } finally {
      setVerificandoWhatsApp(false);
    }
  };

  useEffect(() => {
    if (scopeId) {
      handleVerificarNFe();
      handleVerificarBoleto();
      handleVerificarWhatsApp();
    }
  }, [scopeId]);

  const integracoes = [
    {
      id: 'nfe',
      titulo: 'NF-e Eletrônica',
      descricao: 'Emissão de notas fiscais',
      icon: FileText,
      cor: 'blue',
      status: statusNFe,
      verificando: verificandoNFe,
      onVerificar: handleVerificarNFe,
      provedores: ['eNotas', 'NFe.io', 'Focus NFe'],
      provedor_atual: statusNFe?.integracao?.provedor
    },
    {
      id: 'boleto',
      titulo: 'Boletos e PIX',
      descricao: 'Geração de cobranças',
      icon: DollarSign,
      cor: 'green',
      status: statusBoleto,
      verificando: verificandoBoleto,
      onVerificar: handleVerificarBoleto,
      provedores: ['Asaas', 'Juno', 'Mercado Pago'],
      provedor_atual: statusBoleto?.integracao?.provedor
    },
    {
      id: 'whatsapp',
      titulo: 'WhatsApp Business',
      descricao: 'Envio de mensagens',
      icon: MessageCircle,
      cor: 'emerald',
      status: statusWhatsApp,
      verificando: verificandoWhatsApp,
      onVerificar: handleVerificarWhatsApp,
      provedores: ['Evolution API', 'Baileys', 'WPPCONNECT'],
      provedor_atual: statusWhatsApp?.whatsapp?.provedor || 'Evolution API'
    }
  ];

  return (
    <div className="space-y-6">
      <Alert className="border-blue-300 bg-blue-50">
        <Zap className="w-5 h-5 text-blue-600" />
        <AlertDescription>
          <p className="font-semibold text-blue-900 mb-1">
            🚀 Integrações Reais Implementadas!
          </p>
          <p className="text-sm text-blue-800">
            Sistema pronto para conectar com APIs reais de <strong>NF-e</strong>, <strong>Boletos/PIX</strong> e <strong>WhatsApp</strong>.
            Configure as credenciais para ativar.
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-3 gap-6">
        {integracoes.map((integracao) => {
          const Icon = integracao.icon;
          const status = integracao.status;
          const configurado = status?.configurado || status?.conectado;
          
          return (
            <Card key={integracao.id} className={`border-2 ${
              configurado ? 'border-green-300' : 'border-orange-300'
            }`}>
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="w-5 h-5 text-slate-700" />
                  {integracao.titulo}
                </CardTitle>
                <p className="text-xs text-slate-600 mt-1">{integracao.descricao}</p>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  {configurado ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">Configurado</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-orange-600" />
                      <span className="text-sm font-semibold text-orange-700">Não Configurado</span>
                    </>
                  )}
                </div>

                {/* Provedor */}
                {integracao.provedor_atual && (
                  <div>
                    <p className="text-xs text-slate-600">Provedor</p>
                    <Badge className="mt-1 bg-slate-700">
                      {integracao.provedor_atual}
                    </Badge>
                  </div>
                )}

                {/* Mensagem de Erro */}
                {status?.erro && (
                  <div className="p-2 bg-orange-50 rounded text-xs text-orange-700 border border-orange-200">
                    {status.erro}
                  </div>
                )}

                {/* WhatsApp: QR Code */}
                {integracao.id === 'whatsapp' && status?.qrcode && (
                  <div className="text-center">
                    <p className="text-xs text-slate-600 mb-2">Escaneie para conectar:</p>
                    <img src={status.qrcode} alt="QR Code" className="w-32 h-32 mx-auto border" />
                  </div>
                )}

                {/* Provedores Disponíveis */}
                <div>
                  <p className="text-xs text-slate-600 mb-2">Provedores suportados:</p>
                  <div className="flex flex-wrap gap-1">
                    {integracao.provedores.map((p) => (
                      <Badge key={p} variant="outline" className="text-xs">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Botões */}
                <IntegrationConfigButtons integracao={integracao} empresaId={empresaId} groupId={groupId} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Instruções de Configuração */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base">Como Configurar as Integrações</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900">1. NF-e (eNotas.io ou NFe.io)</p>
                <p className="text-sm text-blue-700 mt-1">
                  • Crie conta em <a href="https://enotas.com.br" target="_blank" className="underline">eNotas.com.br</a> ou <a href="https://nfe.io" target="_blank" className="underline">NFe.io</a><br/>
                  • Obtenha sua API Key<br/>
                  • Configure em: <strong>Fiscal → Configurações → Integração NF-e</strong><br/>
                  • Faça upload do Certificado Digital A1
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <DollarSign className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-900">2. Boletos/PIX (Asaas)</p>
                <p className="text-sm text-green-700 mt-1">
                  • Crie conta em <a href="https://asaas.com" target="_blank" className="underline">Asaas.com</a><br/>
                  • Ative sua conta (necessita CNPJ e documentos)<br/>
                  • Obtenha API Key em: Integrações → Sua Chave de API<br/>
                  • Configure em: <strong>Financeiro → Configurações → Gateway de Pagamento</strong>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <MessageCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-900">3. WhatsApp Business (Evolution API)</p>
                <p className="text-sm text-emerald-700 mt-1">
                  • Opção 1: Hospede sua própria Evolution API<br/>
                  • Opção 2: Use serviço gerenciado (diversos no mercado)<br/>
                  • Configure URL e API Key<br/>
                  • Escaneie QR Code para conectar seu WhatsApp<br/>
                  • Configure em: <strong>Integrações → WhatsApp Business</strong>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas de Uso */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">NF-e Emitidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {/* placeholder - seria query real */}
              -
            </div>
            <p className="text-xs text-slate-500">Últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Cobranças Geradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              -
            </div>
            <p className="text-xs text-slate-500">Últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Mensagens Enviadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              -
            </div>
            <p className="text-xs text-slate-500">Últimos 30 dias</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
