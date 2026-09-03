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
import WhatsAppEventToggles from './WhatsAppEventToggles';

/**
 * Configuração WhatsApp Business
 */
export default function ConfigWhatsAppBusiness({ empresaId: empresaIdProp }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();

  const configInicial = {
    ativo: false,
    api_url: 'https://api.whatsapp.com/send',
    api_token: '',
    numero_whatsapp: '',
    enviar_pedido_aprovado: true,
    enviar_saida_entrega: true,
    enviar_entrega_concluida: true,
    enviar_cobranca: true,
    enviar_cobranca_dias_antes: 3
  };
  const [config, setConfig] = useState(configInicial);

  const [testando, setTestando] = useState(false);
  const empresaId = empresaIdProp || empresaAtual?.id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || user?.grupo_atual_id || user?.grupo_padrao_id || null;
  const contextoValido = Boolean(groupId);
  const admin = isAdmin();
  const podeCriar = admin || hasPermission("Sistema", "Integracoes", "criar") || hasPermission("Sistema", "Integrações", "criar");
  const podeEditar = admin || hasPermission("Sistema", "Integracoes", "editar") || hasPermission("Sistema", "Integrações", "editar");
  const podeExecutar = admin || hasPermission("Sistema", "Integracoes", "executar") || hasPermission("Sistema", "Integrações", "executar");
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
        sucesso: !/^(Bloqueio|Erro)/.test(acao),
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
    enabled: contextoValido && !!chaveConfig
  });
  const operacaoSalvar = configSalva?.id ? 'editar' : 'criar';
  const podeSalvar = operacaoSalvar === 'editar' ? podeEditar : podeCriar;

  useEffect(() => {
    if (configSalva?.integracao_whatsapp) {
      setConfig({ ...configInicial, ...configSalva.integracao_whatsapp });
    } else {
      setConfig(configInicial);
    }
  }, [chaveConfig, configSalva]);

  const salvarMutation = useMutation({
    mutationFn: async (dados) => {
      if (!contextoValido) {
        await auditarWhatsApp('Bloqueio sem contexto', 'Tentativa de salvar WhatsApp Business sem grupo.', { configuracao_informada: Boolean(dados) });
        throw new Error('Selecione grupo ou empresa antes de salvar.');
      }
      if (!podeSalvar) {
        await auditarWhatsApp('Bloqueio por permissao', 'Tentativa de salvar WhatsApp Business sem permissao.', { operacao: operacaoSalvar });
        throw new Error('Seu perfil nao permite salvar integracoes.');
      }
      const telefoneNormalizado = String(dados.numero_whatsapp || '').replace(/\D/g, '').slice(0, 13);
      if (telefoneNormalizado && (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 13)) {
        throw new Error('Telefone invalido');
      }
      const configuracaoSegura = {
        ...dados,
        numero_whatsapp: telefoneNormalizado,
        api_token: String(dados.api_token || '').trim().slice(0, 500),
        enviar_cobranca_dias_antes: Math.min(30, Math.max(0, Number(dados.enviar_cobranca_dias_antes) || 0)),
      };
      const payload = {
        chave: chaveConfig,
        categoria: 'Integracoes',
        integracao_whatsapp: configuracaoSegura,
        ...scope
      };
      const salvo = configSalva?.id
        ? await updateInContext('ConfiguracaoSistema', configSalva.id, payload)
        : await createInContext('ConfiguracaoSistema', payload);
      await auditarWhatsApp('Salvar WhatsApp Business', 'Configuracao WhatsApp Business salva com escopo multiempresa.', {
        operacao: operacaoSalvar,
        ativo: Boolean(configuracaoSegura.ativo),
        token_configurado: Boolean(configuracaoSegura.api_token),
        numero_configurado: Boolean(configuracaoSegura.numero_whatsapp),
        eventos_ativos: [
          configuracaoSegura.enviar_pedido_aprovado,
          configuracaoSegura.enviar_saida_entrega,
          configuracaoSegura.enviar_entrega_concluida,
          configuracaoSegura.enviar_cobranca,
        ].filter(Boolean).length,
      }, { configuracao_existente: Boolean(configSalva?.id) });
      return salvo;
    },
    onSuccess: () => {
      toast({ title: '✅ Configuração salva!' });
      queryClient.invalidateQueries({ queryKey: ['config-whatsapp', chaveConfig] });
    },
    onError: async (error) => {
      console.warn('Falha ao salvar WhatsApp Business:', error);
      await auditarWhatsApp('Erro Salvar WhatsApp Business', 'Falha ao persistir configuracao WhatsApp Business.', {
        operacao: operacaoSalvar,
        tipo_erro: 'persistence_error',
      });
      toast({
        title: 'Erro ao salvar',
        description: 'Nao foi possivel salvar a configuracao.',
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
    if (!podeExecutar) {
      toast({
        title: 'Permissao negada',
        description: 'Seu perfil nao permite testar integracoes.',
        variant: 'destructive'
      });
      await auditarWhatsApp('Bloqueio por permissao', 'Tentativa de testar WhatsApp Business sem permissao.');
      return;
    }
    const telefoneNormalizado = String(config.numero_whatsapp || '').replace(/\D/g, '');
    if (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 13) {
      toast({ title: 'Telefone invalido', description: 'Informe um telefone com DDD antes de testar.', variant: 'destructive' });
      await auditarWhatsApp('Bloqueio telefone invalido', 'Teste WhatsApp bloqueado por telefone invalido.', { telefone_informado: Boolean(telefoneNormalizado) });
      return;
    }
    setTestando(true);

    try {
      const resultado = await WhatsAppBusinessEngine.enviarMensagem(
        telefoneNormalizado,
        `🎉 *Teste de Integração WhatsApp Business*\n\nOlá!\n\nEste é um teste de envio automático do ERP Zuccaro.\n\nSe você recebeu esta mensagem, a integração está funcionando perfeitamente! ✅`,
        { tipo: 'teste', empresa_id: empresaId, group_id: groupId }
      );
      await auditarWhatsApp(resultado.sucesso ? 'Teste WhatsApp Business' : 'Erro Teste WhatsApp Business', 'Teste de envio WhatsApp Business executado.', {
        envio_concluido: Boolean(resultado.sucesso),
        tipo_erro: resultado.sucesso ? null : 'provider_error',
        numero_informado: Boolean(telefoneNormalizado)
      });

      if (resultado.sucesso) {
        toast({ 
          title: '✅ Teste enviado!',
          description: 'Mensagem de teste enviada com sucesso'
        });
      } else {
        toast({ 
          title: '❌ Erro no teste',
          description: 'O provedor nao confirmou o envio.',
          variant: 'destructive'
        });
      }

    } catch (error) {
      console.warn('Falha ao testar WhatsApp Business:', error);
      await auditarWhatsApp('Erro Teste WhatsApp Business', 'Falha ao testar envio WhatsApp Business.', { tipo_erro: 'unexpected_error', numero_informado: Boolean(telefoneNormalizado) });
      toast({ 
        title: '❌ Erro',
        description: 'Nao foi possivel concluir o teste.',
        variant: 'destructive'
      });
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="w-full h-full space-y-6">
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
                disabled={!contextoValido || !podeSalvar}
                data-action="Integracoes.WhatsApp.ativo"
                data-permission={`Sistema.Integracoes.${operacaoSalvar}`}
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label>Número WhatsApp da Empresa</Label>
              <Input
                value={config.numero_whatsapp}
                onChange={(e) => setConfig({ ...config, numero_whatsapp: e.target.value })}
                placeholder="(11) 98765-4321"
                maxLength={20}
                disabled={!contextoValido || !podeSalvar}
                data-action="Integracoes.WhatsApp.numero"
                data-permission={`Sistema.Integracoes.${operacaoSalvar}`}
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
                maxLength={500}
                disabled={!contextoValido || !podeSalvar}
                data-action="Integracoes.WhatsApp.apiToken"
                data-permission={`Sistema.Integracoes.${operacaoSalvar}`}
                data-context-required="group-or-company"
                data-sensitive="true"
              />
            </div>

            <WhatsAppEventToggles
              config={config}
              disabled={!contextoValido || !podeSalvar}
              permission={`Sistema.Integracoes.${operacaoSalvar}`}
              onChange={(field, checked) => setConfig((current) => ({ ...current, [field]: checked }))}
            />
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button
              onClick={testarEnvio}
              disabled={testando || !config.numero_whatsapp || !contextoValido || !podeExecutar}
              variant="outline"
              className="flex-1"
              data-action="Integracoes.WhatsApp.testarEnvio"
              data-permission="Sistema.Integracoes.executar"
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
              disabled={salvarMutation.isPending || !contextoValido || !podeSalvar}
              className="flex-1 bg-green-600 hover:bg-green-700"
              data-action="Integracoes.WhatsApp.salvar"
              data-permission={`Sistema.Integracoes.${operacaoSalvar}`}
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
