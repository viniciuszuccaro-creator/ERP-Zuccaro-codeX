import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { 
  MessageCircle, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  Send
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import WhatsAppBusinessEngine from '../sistema/WhatsAppBusinessEngine';
import { useUser } from '@/components/lib/UserContext';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * Configuração WhatsApp Business
 */
export default function ConfigWhatsAppBusiness({ empresaId: empresaIdProp }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();

  const [config, setConfig] = useState({
    ativo: false,
    api_url: 'https://api.whatsapp.com/send',
    api_token: '',
    numero_whatsapp: '',
    enviar_pedido_aprovado: true,
    enviar_saida_entrega: true,
    enviar_entrega_concluida: true,
    enviar_cobranca: true,
    enviar_cobranca_dias_antes: 3
  });

  const [testando, setTestando] = useState(false);
  const empresaId = empresaIdProp || empresaAtual?.id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || user?.grupo_atual_id || user?.grupo_padrao_id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeEditar = isAdmin() || hasPermission("Sistema", "Integracoes", "editar") || hasPermission("Sistema", "Integrações", "editar");
  const chaveConfig = empresaId ? `whatsapp_business_${empresaId}` : groupId ? `whatsapp_business_${groupId}` : null;
  const scope = {
    ...(groupId ? { group_id: groupId } : {}),
    ...(empresaId ? { empresa_id: empresaId } : {}),
  };

  const auditarWhatsApp = async (acao, descricao, dadosNovos = null, dadosAnteriores = null) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        acao,
        modulo: 'Integracoes',
        entidade: 'ConfiguracaoSistema',
        registro_id: chaveConfig,
        descricao,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar WhatsApp Business:', error);
    }
  };

  const { data: configSalva } = useQuery({
    queryKey: ['config-whatsapp', chaveConfig],
    queryFn: async () => {
      if (!chaveConfig) return null;
      const registros = await filterInContext('ConfiguracaoSistema', { chave: chaveConfig }, '-updated_date', 1);
      return registros?.[0] || null;
    },
    enabled: !!chaveConfig
  });

  useEffect(() => {
    if (configSalva?.integracao_whatsapp) {
      setConfig((prev) => ({ ...prev, ...configSalva.integracao_whatsapp }));
    }
  }, [configSalva]);

  const salvarMutation = useMutation({
    mutationFn: async (dados) => {
      if (!contextoValido) {
        await auditarWhatsApp('Bloqueio sem contexto', 'Tentativa de salvar WhatsApp Business sem grupo ou empresa.', dados);
        throw new Error('Selecione grupo ou empresa antes de salvar.');
      }
      if (!podeEditar) {
        await auditarWhatsApp('Bloqueio por permissao', 'Tentativa de salvar WhatsApp Business sem permissao.', dados);
        throw new Error('Seu perfil nao permite salvar integracoes.');
      }
      const payload = {
        chave: chaveConfig,
        categoria: 'Integracoes',
        integracao_whatsapp: dados,
        ...scope
      };
      const salvo = configSalva?.id
        ? await updateInContext('ConfiguracaoSistema', configSalva.id, payload)
        : await createInContext('ConfiguracaoSistema', payload);
      await auditarWhatsApp('Salvar WhatsApp Business', 'Configuracao WhatsApp Business salva com escopo multiempresa.', payload, configSalva || null);
      return salvo;
    },
    onSuccess: () => {
      toast({ title: '✅ Configuração salva!' });
      queryClient.invalidateQueries({ queryKey: ['config-whatsapp', chaveConfig] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const testarEnvio = async () => {
    if (!contextoValido) {
      toast({
        title: 'Contexto obrigatorio',
        description: 'Selecione grupo ou empresa antes de testar o WhatsApp.',
        variant: 'destructive'
      });
      await auditarWhatsApp('Bloqueio sem contexto', 'Tentativa de testar WhatsApp Business sem grupo ou empresa.');
      return;
    }
    if (!podeEditar) {
      toast({
        title: 'Permissao negada',
        description: 'Seu perfil nao permite testar integracoes.',
        variant: 'destructive'
      });
      await auditarWhatsApp('Bloqueio por permissao', 'Tentativa de testar WhatsApp Business sem permissao.');
      return;
    }
    setTestando(true);

    try {
      const resultado = await WhatsAppBusinessEngine.enviarMensagem(
        config.numero_whatsapp,
        `🎉 *Teste de Integração WhatsApp Business*\n\nOlá!\n\nEste é um teste de envio automático do ERP Zuccaro.\n\nSe você recebeu esta mensagem, a integração está funcionando perfeitamente! ✅`,
        { tipo: 'teste', empresa_id: empresaId, group_id: groupId }
      );
      await auditarWhatsApp(resultado.sucesso ? 'Teste WhatsApp Business' : 'Erro Teste WhatsApp Business', 'Teste de envio WhatsApp Business executado.', {
        sucesso: resultado.sucesso,
        erro: resultado.erro || null,
        numero_whatsapp: config.numero_whatsapp
      });

      if (resultado.sucesso) {
        toast({ 
          title: '✅ Teste enviado!',
          description: 'Mensagem de teste enviada com sucesso'
        });
      } else {
        toast({ 
          title: '❌ Erro no teste',
          description: resultado.erro,
          variant: 'destructive'
        });
      }

    } catch (error) {
      await auditarWhatsApp('Erro Teste WhatsApp Business', 'Falha ao testar envio WhatsApp Business.', { erro: error.message, numero_whatsapp: config.numero_whatsapp });
      toast({ 
        title: '❌ Erro',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="bg-white/80 border-b">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-green-600" />
            WhatsApp Business - Mensagens Automáticas
            {config.ativo && (
              <Badge className="bg-green-600 text-white ml-auto">
                <Zap className="w-3 h-3 mr-1" />
                ATIVO
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Status da Integração */}
          <Alert className={config.ativo ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}>
            {config.ativo ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <AlertDescription>
                  <p className="font-semibold text-green-900">✅ Integração Ativa</p>
                  <p className="text-sm text-green-700 mt-1">
                    Mensagens automáticas estão sendo enviadas
                  </p>
                </AlertDescription>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <AlertDescription>
                  <p className="font-semibold text-orange-900">⚠️ Integração Inativa</p>
                  <p className="text-sm text-orange-700 mt-1">
                    Configure e ative para enviar mensagens automáticas
                  </p>
                </AlertDescription>
              </>
            )}
          </Alert>

          {/* Configurações */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-semibold">Ativar Integração</p>
                <p className="text-sm text-slate-600">Habilitar envios automáticos</p>
              </div>
              <Switch
                checked={config.ativo}
                onCheckedChange={(checked) => setConfig({ ...config, ativo: checked })}
                disabled={!contextoValido || !podeEditar}
                data-action="Integracoes.WhatsApp.ativo"
                data-permission="Sistema.Integracoes.editar"
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label>Número WhatsApp da Empresa</Label>
              <Input
                value={config.numero_whatsapp}
                onChange={(e) => setConfig({ ...config, numero_whatsapp: e.target.value })}
                placeholder="(11) 98765-4321"
                disabled={!contextoValido || !podeEditar}
                data-action="Integracoes.WhatsApp.numero"
                data-permission="Sistema.Integracoes.editar"
                data-context-required="group-or-company"
              />
              <p className="text-xs text-slate-500 mt-1">
                Formato: (DDD) 9XXXX-XXXX
              </p>
            </div>

            <div>
              <Label>API Token (Opcional)</Label>
              <Input
                type="password"
                value={config.api_token}
                onChange={(e) => setConfig({ ...config, api_token: e.target.value })}
                placeholder="Token da API WhatsApp Business"
                disabled={!contextoValido || !podeEditar}
                data-action="Integracoes.WhatsApp.apiToken"
                data-permission="Sistema.Integracoes.editar"
                data-context-required="group-or-company"
                data-sensitive="true"
              />
            </div>

            <div className="border-t pt-4">
              <p className="font-semibold mb-3">Eventos Automáticos</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white rounded border">
                  <div>
                    <p className="text-sm font-medium">Pedido Aprovado</p>
                    <p className="text-xs text-slate-600">Notificar cliente quando pedido for aprovado</p>
                  </div>
                  <Switch
                    checked={config.enviar_pedido_aprovado}
                    onCheckedChange={(checked) => setConfig({ ...config, enviar_pedido_aprovado: checked })}
                    disabled={!contextoValido || !podeEditar}
                    data-action="Integracoes.WhatsApp.pedidoAprovado"
                    data-permission="Sistema.Integracoes.editar"
                    data-context-required="group-or-company"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded border">
                  <div>
                    <p className="text-sm font-medium">Saída para Entrega</p>
                    <p className="text-xs text-slate-600">Enviar rastreamento quando sair para entrega</p>
                  </div>
                  <Switch
                    checked={config.enviar_saida_entrega}
                    onCheckedChange={(checked) => setConfig({ ...config, enviar_saida_entrega: checked })}
                    disabled={!contextoValido || !podeEditar}
                    data-action="Integracoes.WhatsApp.saidaEntrega"
                    data-permission="Sistema.Integracoes.editar"
                    data-context-required="group-or-company"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded border">
                  <div>
                    <p className="text-sm font-medium">Entrega Concluída</p>
                    <p className="text-xs text-slate-600">Confirmar entrega realizada</p>
                  </div>
                  <Switch
                    checked={config.enviar_entrega_concluida}
                    onCheckedChange={(checked) => setConfig({ ...config, enviar_entrega_concluida: checked })}
                    disabled={!contextoValido || !podeEditar}
                    data-action="Integracoes.WhatsApp.entregaConcluida"
                    data-permission="Sistema.Integracoes.editar"
                    data-context-required="group-or-company"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded border">
                  <div>
                    <p className="text-sm font-medium">Cobrança (Boleto/PIX)</p>
                    <p className="text-xs text-slate-600">Enviar cobrança automaticamente</p>
                  </div>
                  <Switch
                    checked={config.enviar_cobranca}
                    onCheckedChange={(checked) => setConfig({ ...config, enviar_cobranca: checked })}
                    disabled={!contextoValido || !podeEditar}
                    data-action="Integracoes.WhatsApp.cobranca"
                    data-permission="Sistema.Integracoes.editar"
                    data-context-required="group-or-company"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={testarEnvio}
              disabled={testando || !config.numero_whatsapp || !contextoValido || !podeEditar}
              variant="outline"
              className="flex-1"
              data-action="Integracoes.WhatsApp.testarEnvio"
              data-permission="Sistema.Integracoes.editar"
              data-context-required="group-or-company"
              data-sensitive="true"
            >
              {testando ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Testar Envio
                </>
              )}
            </Button>

            <Button
              onClick={() => salvarMutation.mutate(config)}
              disabled={salvarMutation.isPending || !contextoValido || !podeEditar}
              className="flex-1 bg-green-600 hover:bg-green-700"
              data-action="Integracoes.WhatsApp.salvar"
              data-permission="Sistema.Integracoes.editar"
              data-context-required="group-or-company"
              data-sensitive="true"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Salvar Configuração
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
