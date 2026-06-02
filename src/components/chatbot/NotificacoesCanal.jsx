import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Mail, 
  MessageCircle, 
  Smartphone,
  Volume2,
  VolumeX,
  Settings,
  Check,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.6 - CONFIGURAÇÃO DE NOTIFICAÇÕES
 * 
 * ✅ Notificações por canal
 * ✅ Tipos de alerta
 * ✅ Sons de notificação
 * ✅ Prioridades
 * ✅ Suporte multi-empresa
 */
export default function NotificacoesCanal({ canalConfig }) {
  // Compatibilidade - aceita canalConfig ou canalId
  const canalId = canalConfig?.id;
  const { empresaAtual, grupoAtual, filterInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const empresaId = empresaAtual?.id;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewNotificacoes = hasPermission('Sistema', 'Integracoes', 'visualizar') ||
    hasPermission('CRM', 'Atendimento', 'visualizar');
  const canEditNotificacoes = hasPermission('Sistema', 'Integracoes', 'editar') ||
    hasPermission('CRM', 'Atendimento', 'editar');

  const tiposNotificacao = [
    { id: 'nova_mensagem', label: 'Nova mensagem do cliente', icone: MessageCircle },
    { id: 'transbordo', label: 'Transferência para humano', icone: AlertTriangle },
    { id: 'sla_alerta', label: 'SLA em risco', icone: AlertTriangle },
    { id: 'cliente_insatisfeito', label: 'Cliente insatisfeito detectado', icone: AlertTriangle }
  ];

  const canaisNotificacao = [
    { id: 'sistema', label: 'Sistema', icone: Bell },
    { id: 'email', label: 'E-mail', icone: Mail },
    { id: 'whatsapp', label: 'WhatsApp', icone: MessageCircle },
    { id: 'push', label: 'Push', icone: Smartphone }
  ];

  // Buscar configuração
  const { data: config } = useQuery({
    queryKey: ['config-notificacoes', canalId || 'primeiro-ativo', contextKey],
    queryFn: async () => {
      if (!canalId) {
        const configs = await filterInContext('ConfiguracaoCanal', { ativo: true }, 'canal', 10);
        return configs[0];
      }
      const configs = await filterInContext('ConfiguracaoCanal', { id: canalId }, 'canal', 1);
      return configs[0];
    },
    enabled: contextoValido && canViewNotificacoes
  });

  const [configLocal, setConfigLocal] = useState({
    nova_mensagem: true,
    transbordo: true,
    sla_alerta: true,
    cliente_insatisfeito: true,
    canais: ['sistema', 'email'],
    som_ativado: true
  });

  // Sincronizar com config quando carregar
  React.useEffect(() => {
    if (config?.notificacoes) {
      setConfigLocal({
        nova_mensagem: config.notificacoes.nova_mensagem ?? true,
        transbordo: config.notificacoes.transbordo ?? true,
        sla_alerta: config.notificacoes.sla_alerta ?? true,
        cliente_insatisfeito: config.notificacoes.cliente_insatisfeito ?? true,
        canais: config.notificacoes.canais || ['sistema'],
        som_ativado: true
      });
    }
  }, [config]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!config?.id || !contextoValido || !canEditNotificacoes) return;
      
      await updateInContext('ConfiguracaoCanal', config.id, {
        notificacoes: configLocal
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-notificacoes'] });
      toast.success('Configurações de notificação salvas!');
    }
  });

  const toggleTipo = (tipoId) => {
    setConfigLocal(prev => ({
      ...prev,
      [tipoId]: !prev[tipoId]
    }));
  };

  const toggleCanal = (canalIdLocal) => {
    setConfigLocal(prev => ({
      ...prev,
      canais: prev.canais.includes(canalIdLocal)
        ? prev.canais.filter(c => c !== canalIdLocal)
        : [...prev.canais, canalIdLocal]
    }));
  };

  return (
    <Card className="w-full h-full" data-permission="Sistema.Integracoes.editar" data-context-required="group-or-company">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" />
          Configurações de Notificação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tipos de Notificação */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Tipos de Alerta
          </h3>
          <div className="space-y-3">
            {tiposNotificacao.map(tipo => {
              const Icone = tipo.icone;
              return (
                <div key={tipo.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Icone className="w-4 h-4 text-slate-600" />
                    <span className="text-sm">{tipo.label}</span>
                  </div>
                  <Switch
                    checked={configLocal[tipo.id]}
                    disabled={!contextoValido || !canEditNotificacoes || !config?.id}
                    data-action="NotificacoesCanal.toggleTipo"
                    data-permission="Sistema.Integracoes.editar"
                    data-context-required="group-or-company"
                    onCheckedChange={() => toggleTipo(tipo.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Canais de Notificação */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Canais de Entrega
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {canaisNotificacao.map(canal => {
              const Icone = canal.icone;
              const ativo = configLocal.canais.includes(canal.id);
              return (
                <button
                  key={canal.id}
                  onClick={() => toggleCanal(canal.id)}
                  disabled={!contextoValido || !canEditNotificacoes || !config?.id}
                  data-action="NotificacoesCanal.toggleCanal"
                  data-permission="Sistema.Integracoes.editar"
                  data-context-required="group-or-company"
                  className={`p-3 rounded-lg border-2 flex items-center gap-2 transition-all ${
                    ativo 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Icone className="w-4 h-4" />
                  <span className="text-sm font-medium">{canal.label}</span>
                  {ativo && <Check className="w-4 h-4 ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Som */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-3">
            {configLocal.som_ativado ? (
              <Volume2 className="w-4 h-4 text-blue-600" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
            <span className="text-sm">Som de notificação</span>
          </div>
          <Switch
            checked={configLocal.som_ativado}
            disabled={!contextoValido || !canEditNotificacoes || !config?.id}
            data-action="NotificacoesCanal.toggleSom"
            data-permission="Sistema.Integracoes.editar"
            data-context-required="group-or-company"
            onCheckedChange={(checked) => setConfigLocal(prev => ({ ...prev, som_ativado: checked }))}
          />
        </div>

        {/* Salvar */}
        <Button
          onClick={() => salvarMutation.mutate()}
          disabled={salvarMutation.isPending || !contextoValido || !canEditNotificacoes || !config?.id}
          className="w-full bg-blue-600 hover:bg-blue-700"
          data-action="NotificacoesCanal.salvar"
          data-permission="Sistema.Integracoes.editar"
          data-context-required="group-or-company"
          data-sensitive="true"
        >
          {salvarMutation.isPending ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Salvar Configurações
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
