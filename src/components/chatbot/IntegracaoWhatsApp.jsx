import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, AlertTriangle, CheckCircle, Code } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * V21.5 - INTEGRAÇÃO WHATSAPP BUSINESS API
 * 
 * Configuração e teste da integração bidirecional com WhatsApp
 * ⚠️ Requer Backend Functions habilitadas
 */
export default function IntegracaoWhatsApp() {
  const { hasPermission, isAdmin } = usePermissions();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const contextKey = empresaAtual?.id || grupoAtual?.id || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canEditIntegracao = isAdmin() ||
    hasPermission('Sistema', 'Integracoes', 'editar') ||
    hasPermission('Sistema', 'Integracoes', 'executar');
  const [config, setConfig] = useState({
    token: '',
    phoneNumberId: '',
    businessAccountId: '',
    webhookUrl: '',
    verifyToken: ''
  });

  const [testando, setTestando] = useState(false);
  const [statusConexao, setStatusConexao] = useState(null);

  const testarConexao = async () => {
    if (!contextoValido || !canEditIntegracao) {
      setStatusConexao({
        conectado: false,
        mensagem: 'Selecione grupo/empresa e confirme permissao de integracoes.'
      });
      return;
    }

    setTestando(true);
    
    // Simulação - em produção, chamaria backend function
    setTimeout(() => {
      const credenciaisPreenchidas = Boolean(config.token && config.phoneNumberId && config.businessAccountId);
      setStatusConexao({
        conectado: credenciaisPreenchidas,
        mensagem: 'Backend Functions não habilitadas'
      });
      setStatusConexao({
        conectado: credenciaisPreenchidas,
        mensagem: credenciaisPreenchidas
          ? 'Credenciais preenchidas. A validacao real depende das Backend Functions habilitadas.'
          : 'Preencha token, Phone Number ID e Business Account ID antes de validar a conexao.'
      });
      setTestando(false);
    }, 2000);
  };

  return (
    <div className="w-full h-full p-6 overflow-auto" data-permission="Sistema.Integracoes.editar" data-context-required="group-or-company">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-green-600" />
            Integração WhatsApp Business
          </h1>
          <p className="text-slate-600 mt-1">Configure a API oficial do WhatsApp Business</p>
        </div>

        {/* Alerta Backend Functions */}
        <Alert className="border-orange-300 bg-orange-50">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <AlertDescription>
            <p className="font-semibold text-orange-900">⚠️ Backend Functions Necessárias</p>
            <p className="text-sm text-orange-800 mt-1">
              A integração bidirecional com WhatsApp requer Backend Functions habilitadas.
              Habilite em: Dashboard → Settings → Backend Functions
            </p>
          </AlertDescription>
        </Alert>

        {/* Status */}
        {statusConexao && (
          <Alert className={statusConexao.conectado ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}>
            {statusConexao.conectado ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <AlertDescription className={statusConexao.conectado ? 'text-green-900' : 'text-red-900'}>
              {statusConexao.mensagem}
            </AlertDescription>
          </Alert>
        )}

        {/* Configuração */}
        <Card>
          <CardHeader>
            <CardTitle>Credenciais da API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Access Token</Label>
              <Input
                type="password"
                value={config.token}
                onChange={(e) => setConfig({ ...config, token: e.target.value })}
                placeholder="EAAxxxxxxxxxxxx"
                disabled={!contextoValido || !canEditIntegracao}
                data-sensitive="true"
              />
              <p className="text-xs text-slate-500 mt-1">
                Token de acesso permanente da Meta Business
              </p>
            </div>

            <div>
              <Label>Phone Number ID</Label>
              <Input
                value={config.phoneNumberId}
                onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
                placeholder="123456789012345"
                disabled={!contextoValido || !canEditIntegracao}
                data-sensitive="true"
              />
            </div>

            <div>
              <Label>Business Account ID</Label>
              <Input
                value={config.businessAccountId}
                onChange={(e) => setConfig({ ...config, businessAccountId: e.target.value })}
                placeholder="123456789012345"
                disabled={!contextoValido || !canEditIntegracao}
                data-sensitive="true"
              />
            </div>

            <div className="pt-4 border-t">
              <Button
                onClick={testarConexao}
                disabled={testando || !contextoValido || !canEditIntegracao}
                data-action="IntegracaoWhatsApp.testarConexao"
                data-permission="Sistema.Integracoes.executar"
                data-context-required="group-or-company"
                data-sensitive="true"
              >
                {testando ? 'Testando...' : 'Testar Conexão'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Webhook */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-5 h-5" />
              Configuração de Webhook
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription className="text-sm">
                Configure este webhook na Meta Business Platform para receber mensagens
              </AlertDescription>
            </Alert>

            <div>
              <Label>Webhook URL</Label>
              <Input
                value="https://api.base44.com/webhooks/whatsapp/[APP_ID]"
                disabled
                className="font-mono text-sm"
              />
            </div>

            <div>
              <Label>Verify Token</Label>
              <Input
                value="base44_verify_token_secure"
                disabled
                className="font-mono text-sm"
              />
            </div>

            <div>
              <Label>Eventos Subscritos</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge>messages</Badge>
                <Badge>message_status</Badge>
                <Badge>messaging_handover</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instruções */}
        <Card>
          <CardHeader>
            <CardTitle>Como Configurar</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <ol className="text-sm space-y-2">
              <li>Habilite <strong>Backend Functions</strong> no seu app Base44</li>
              <li>Crie uma app no <strong>Meta Business Platform</strong></li>
              <li>Ative o produto <strong>WhatsApp Business API</strong></li>
              <li>Gere um <strong>token de acesso permanente</strong></li>
              <li>Configure o <strong>webhook</strong> com a URL fornecida acima</li>
              <li>Insira as credenciais nesta tela e teste a conexão</li>
              <li>Pronto! Mensagens do WhatsApp aparecerão no Hub de Atendimento</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
