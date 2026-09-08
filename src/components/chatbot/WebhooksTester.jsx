import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Webhook, Send, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import { ingestCanalExterno } from '@/components/lib/atendimentoConversaPolicy';

/**
 * V21.6 - TESTADOR DE WEBHOOKS
 * Testar webhooks de canais externos
 * ✅ Suporte multi-empresa
 * ✅ Layout responsivo w-full h-full
 */
export default function WebhooksTester({ canalConfig }) {
  const [payload, setPayload] = useState('{\n  "type": "message",\n  "text": "Teste",\n  "from": "11999990000",\n  "name": "Cliente Teste"\n}');
  const [resposta, setResposta] = useState(null);
  const { hasPermission, isAdmin } = usePermissions();
  const { empresaAtual, grupoAtual, createInContext, filterInContext } = useContextoVisual();
  const contextKey = empresaAtual?.id || grupoAtual?.id || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canTestWebhook = isAdmin() ||
    hasPermission('Sistema', 'Integracoes', 'executar') ||
    hasPermission('Sistema', 'Integracoes', 'editar') ||
    hasPermission('CRM', 'Atendimento', 'editar');
  const MAX_PAYLOAD_CHARS = 10000;

  const testarMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido || !canTestWebhook) {
        throw new Error('Selecione grupo/empresa e confirme permissao de integracoes antes de testar webhook.');
      }
      if (!empresaAtual?.id) {
        throw new Error('Selecione a empresa do atendimento antes de ingestir o canal.');
      }

      // Simular recebimento de webhook
      const webhookUrl = canalConfig?.webhook_url || 'local-ingest';

      if (payload.length > MAX_PAYLOAD_CHARS) {
        throw new Error('Payload muito grande para teste local de webhook');
      }

      // Parse do payload
      const data = JSON.parse(payload);
      const empresaId = empresaAtual?.id || canalConfig?.empresa_id || null;
      const groupId = grupoAtual?.id || canalConfig?.group_id || null;
      const configs = await filterInContext('ConfiguracaoCanal', {}, 'canal', 100);
      const inbound = ingestCanalExterno({
        payload: data,
        canal: canalConfig?.canal || data.canal || 'WhatsApp',
        empresaId,
        groupId,
        configs,
      });
      const conversa = await createInContext('ConversaOmnicanal', inbound.conversa);
      const mensagem = await createInContext('MensagemOmnicanal', {
        ...inbound.mensagem,
        conversa_id: conversa.id,
        data_envio: new Date().toISOString(),
      });

      return {
        success: true,
        data,
        conversa_id: conversa.id,
        mensagem_id: mensagem.id,
        timestamp: new Date().toISOString(),
        webhook_url: webhookUrl,
        group_id: groupId,
        empresa_id: empresaId
      };
    },
    onSuccess: (data) => {
      setResposta(data);
      toast.success('Webhook testado com sucesso!');
    },
    onError: (error) => {
      setResposta({ success: false, error: error.message });
      toast.error(error?.message || 'Erro ao testar webhook');
    }
  });

  return (
    <Card className="w-full h-full" data-permission="Sistema.Integracoes.executar" data-context-required="group-or-company">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-blue-600" />
          Testador de Webhooks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-slate-600 mb-2">URL do Webhook:</p>
          <Input
            value={canalConfig?.webhook_url || 'local-ingest (sem URL externa)'}
            disabled
            className="font-mono text-xs"
          />
        </div>

        <div>
          <p className="text-sm text-slate-600 mb-2">Payload de Teste (JSON):</p>
          <Textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            className="font-mono text-xs h-32"
            disabled={!contextoValido || !canTestWebhook}
          />
        </div>

        <Button
          onClick={() => testarMutation.mutate()}
          disabled={testarMutation.isPending || !contextoValido || !canTestWebhook}
          className="w-full bg-blue-600"
          data-action="WebhooksTester.testarWebhook"
          data-permission="Sistema.Integracoes.executar"
          data-context-required="group-or-company"
          data-sensitive="true"
        >
          <Send className="w-4 h-4 mr-2" />
          Enviar Teste
        </Button>

        {resposta && (
          <div className={`p-4 rounded-lg border-2 ${
            resposta.success ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {resposta.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span className="font-semibold">
                {resposta.success ? 'Sucesso' : 'Erro'}
              </span>
            </div>
            <pre className="text-xs bg-white p-3 rounded border overflow-auto">
              {JSON.stringify(resposta, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
