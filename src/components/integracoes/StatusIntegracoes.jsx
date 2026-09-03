import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  DollarSign, 
  MessageCircle,
  Zap
} from 'lucide-react';
import integracaoNFe from '../lib/integracaoNFe';
import integracaoBoletos from '../lib/integracaoBoletos';
import integracaoWhatsApp from '../lib/integracaoWhatsApp';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useUser } from '@/components/lib/UserContext';
import IntegrationConfigButtons from '@/components/integracoes/IntegrationConfigButtons';

/**
 * Painel de Status das Integrações Reais
 * Mostra status de NF-e, Boletos/PIX e WhatsApp
 */
const summarizeIntegrationStatus = (resultado = {}) => {
  const provedor = resultado?.integracao?.provedor || resultado?.whatsapp?.provedor || null;
  const qrcode = typeof resultado?.qrcode === 'string'
    && (/^https:\/\//i.test(resultado.qrcode) || /^data:image\/(png|jpeg|webp);base64,/i.test(resultado.qrcode))
    ? resultado.qrcode
    : null;

  return {
    configurado: resultado?.configurado === true,
    conectado: resultado?.conectado === true,
    erro: resultado?.erro ? 'Configuracao pendente ou conexao indisponivel.' : null,
    integracao: provedor ? { provedor } : null,
    whatsapp: provedor ? { provedor } : null,
    qrcode,
  };
};

export default function StatusIntegracoes({ empresaId, groupId }) {
  const [verificandoNFe, setVerificandoNFe] = useState(false);
  const [verificandoBoleto, setVerificandoBoleto] = useState(false);
  const [verificandoWhatsApp, setVerificandoWhatsApp] = useState(false);

  const [statusNFe, setStatusNFe] = useState(null);
  const [statusBoleto, setStatusBoleto] = useState(null);
  const [statusWhatsApp, setStatusWhatsApp] = useState(null);
  const { filterInContext, createInContext } = useContextoVisual();
  const { user } = useUser();
  const { isAdmin, hasPermission } = usePermissions();
  const scopeId = empresaId || groupId || null;
  const scope = empresaId ? { empresa_id: empresaId, group_id: groupId || null } : groupId ? { group_id: groupId } : {};
  const contextoValido = !!groupId;
  const podeExecutarIntegracoes = isAdmin() || hasPermission('Sistema', 'Integracoes', 'executar') || hasPermission('Sistema', 'Integrações', 'executar');

  const auditStatus = async ({ acao, integracao, sucesso, operacao = null, configurado = null, conectado = null }) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        empresa_id: empresaId || null,
        group_id: groupId || null,
        grupo_id: groupId || null,
        acao,
        modulo: 'Integracoes',
        entidade: 'ConfiguracaoSistema',
        registro_id: scopeId ? `integracoes_${scopeId}` : null,
        descricao: `${acao} na integracao ${integracao}`,
        dados_novos: { integracao, operacao, configurado, conectado },
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('[StatusIntegracoes] Falha ao registrar auditoria:', error);
    }
  };

  const verificarConfigLocal = async (key) => {
    if (!contextoValido) return summarizeIntegrationStatus({ erro: true });
    const chave = `integracoes_${scopeId}`;
    const rows = await filterInContext('ConfiguracaoSistema', { chave, ...scope }, undefined, 1);
    const cfg = rows?.[0]?.[key];
    const configurado = !!(cfg?.ativo || cfg?.api_key || cfg?.api_url || cfg?.provedor);
    return summarizeIntegrationStatus({ configurado, conectado: configurado, integracao: { provedor: cfg?.provedor || null } });
  };

  const podeVerificar = async (integracao, setStatus) => {
    if (contextoValido && podeExecutarIntegracoes) return true;
    setStatus(summarizeIntegrationStatus({ erro: true }));
    await auditStatus({ acao: contextoValido ? 'Bloqueio por permissao' : 'Bloqueio sem contexto', integracao, sucesso: false });
    return false;
  };

  // Verificar NFe
  const handleVerificarNFe = async () => {
    if (!await podeVerificar('nfe', setStatusNFe)) return;
    setVerificandoNFe(true);
    try {
      const resultado = empresaId ? await integracaoNFe.verificarConfiguracao(empresaId, groupId) : await verificarConfigLocal('integracao_nfe');
      const statusSeguro = summarizeIntegrationStatus(resultado);
      setStatusNFe(statusSeguro);
      await auditStatus({ acao: 'Verificacao', integracao: 'nfe', sucesso: true, configurado: statusSeguro.configurado });
    } catch (error) {
      console.warn('[StatusIntegracoes] Falha ao verificar NFe:', error);
      setStatusNFe(summarizeIntegrationStatus({ erro: true }));
      await auditStatus({ acao: 'Erro na verificacao', integracao: 'nfe', sucesso: false });
    } finally {
      setVerificandoNFe(false);
    }
  };

  // Verificar Boletos
  const handleVerificarBoleto = async () => {
    if (!await podeVerificar('boleto', setStatusBoleto)) return;
    setVerificandoBoleto(true);
    try {
      const resultado = empresaId ? await integracaoBoletos.verificarConfiguracao(empresaId, groupId) : await verificarConfigLocal('integracao_boletos');
      const statusSeguro = summarizeIntegrationStatus(resultado);
      setStatusBoleto(statusSeguro);
      await auditStatus({ acao: 'Verificacao', integracao: 'boleto', sucesso: true, configurado: statusSeguro.configurado });
    } catch (error) {
      console.warn('[StatusIntegracoes] Falha ao verificar boleto:', error);
      setStatusBoleto(summarizeIntegrationStatus({ erro: true }));
      await auditStatus({ acao: 'Erro na verificacao', integracao: 'boleto', sucesso: false });
    } finally {
      setVerificandoBoleto(false);
    }
  };

  // Verificar WhatsApp
  const handleVerificarWhatsApp = async () => {
    if (!await podeVerificar('whatsapp', setStatusWhatsApp)) return;
    setVerificandoWhatsApp(true);
    try {
      const resultado = empresaId ? await integracaoWhatsApp.verificarConexao(empresaId, groupId) : await verificarConfigLocal('integracao_whatsapp');
      const statusSeguro = summarizeIntegrationStatus(resultado);
      setStatusWhatsApp(statusSeguro);
      await auditStatus({ acao: 'Verificacao', integracao: 'whatsapp', sucesso: true, conectado: statusSeguro.conectado });
    } catch (error) {
      console.warn('[StatusIntegracoes] Falha ao verificar WhatsApp:', error);
      setStatusWhatsApp(summarizeIntegrationStatus({ erro: true }));
      await auditStatus({ acao: 'Erro na verificacao', integracao: 'whatsapp', sucesso: false });
    } finally {
      setVerificandoWhatsApp(false);
    }
  };

  useEffect(() => {
    setStatusNFe(null);
    setStatusBoleto(null);
    setStatusWhatsApp(null);
    if (contextoValido && podeExecutarIntegracoes) {
      void handleVerificarNFe();
      void handleVerificarBoleto();
      void handleVerificarWhatsApp();
    }
  }, [scopeId, groupId, podeExecutarIntegracoes]);

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
    <div className="w-full h-full space-y-6">
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
                <IntegrationConfigButtons integracao={integracao} empresaId={empresaId} groupId={groupId} onAudit={auditStatus} />
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
                  • Crie conta em <a href="https://enotas.com.br" target="_blank" rel="noreferrer" className="underline">eNotas.com.br</a> ou <a href="https://nfe.io" target="_blank" rel="noreferrer" className="underline">NFe.io</a><br/>
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
                  • Crie conta em <a href="https://asaas.com" target="_blank" rel="noreferrer" className="underline">Asaas.com</a><br/>
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
