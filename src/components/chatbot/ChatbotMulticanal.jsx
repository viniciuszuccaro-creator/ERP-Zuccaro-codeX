import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  MessageCircle, 
  Instagram, 
  Send,
  Phone,
  Mail,
  Globe,
  Smartphone,
  Settings,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.6 - GERENCIADOR MULTICANAL
 * 
 * Visualização e controle de todos os canais:
 * ✅ Status de conexão por canal
 * ✅ Ativar/desativar canais
 * ✅ Estatísticas por canal
 * ✅ Configurações rápidas
 * ✅ Links para configuração detalhada
 */
export default function ChatbotMulticanal() {
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewCanais = hasPermission('Sistema', 'Integracoes', 'visualizar') || hasPermission('CRM', 'Atendimento', 'visualizar');
  const canEditCanais = hasPermission('Sistema', 'Integracoes', 'editar') || hasPermission('CRM', 'Atendimento', 'editar');

  const canaisDisponiveis = [
    { id: 'WhatsApp', nome: 'WhatsApp', icone: Phone, cor: 'bg-green-600', corLight: 'bg-green-100 text-green-700' },
    { id: 'Instagram', nome: 'Instagram', icone: Instagram, cor: 'bg-pink-600', corLight: 'bg-pink-100 text-pink-700' },
    { id: 'Facebook', nome: 'Facebook', icone: MessageCircle, cor: 'bg-blue-600', corLight: 'bg-blue-100 text-blue-700' },
    { id: 'Telegram', nome: 'Telegram', icone: Send, cor: 'bg-sky-500', corLight: 'bg-sky-100 text-sky-700' },
    { id: 'Email', nome: 'Email', icone: Mail, cor: 'bg-slate-600', corLight: 'bg-slate-100 text-slate-700' },
    { id: 'WebChat', nome: 'WebChat', icone: Globe, cor: 'bg-purple-600', corLight: 'bg-purple-100 text-purple-700' },
    { id: 'Portal', nome: 'Portal Cliente', icone: Globe, cor: 'bg-indigo-600', corLight: 'bg-indigo-100 text-indigo-700' },
    { id: 'SMS', nome: 'SMS', icone: Smartphone, cor: 'bg-orange-600', corLight: 'bg-orange-100 text-orange-700' }
  ];

  // Buscar configurações de canais
  const { data: configsCanais = [], isLoading } = useQuery({
    queryKey: ['configs-canais-multi', contextKey],
    queryFn: async () => {
      return await filterInContext('ConfiguracaoCanal', {}, 'canal', 100);
    },
    enabled: contextoValido && canViewCanais
  });

  // Buscar estatísticas por canal
  const { data: estatisticas = {} } = useQuery({
    queryKey: ['estatisticas-canais', contextKey],
    queryFn: async () => {
      const conversas = await filterInContext('ConversaOmnicanal', {}, '-data_inicio', 1000);

      const stats = {};
      canaisDisponiveis.forEach(canal => {
        const conversasCanal = conversas.filter(c => c.canal === canal.id);
        stats[canal.id] = {
          total: conversasCanal.length,
          ativas: conversasCanal.filter(c => c.status !== 'Resolvida').length,
          resolvidas: conversasCanal.filter(c => c.status === 'Resolvida').length,
          tempoMedio: 0
        };
      });

      return stats;
    },
    enabled: contextoValido && canViewCanais
  });

  const toggleCanalMutation = useMutation({
    mutationFn: async ({ canalId, ativo }) => {
      if (!contextoValido) {
        throw new Error('Contexto de grupo ou empresa obrigatorio para alterar canal.');
      }
      if (!canEditCanais) {
        throw new Error('Usuario sem permissao para alterar canais.');
      }

      const configExistente = configsCanais.find(c => c.canal === canalId);
      
      if (configExistente) {
        await updateInContext('ConfiguracaoCanal', configExistente.id, { ativo });
      } else {
        await createInContext('ConfiguracaoCanal', {
          canal: canalId,
          ativo,
          modo_atendimento: 'Bot com Transbordo',
          mensagem_boas_vindas: `Olá! Bem-vindo ao atendimento via ${canalId}. Como posso ajudar?`
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configs-canais-multi'] });
      queryClient.invalidateQueries({ queryKey: ['estatisticas-canais'] });
      toast.success('Canal atualizado!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar canal:', error);
      toast.error(error?.message || 'Erro ao atualizar canal');
    }
  });

  const getConfigCanal = (canalId) => {
    return configsCanais.find(c => c.canal === canalId);
  };

  const getStatusCanal = (canalId) => {
    const config = getConfigCanal(canalId);
    if (!config) return { status: 'nao_configurado', label: 'Não Configurado', cor: 'bg-slate-400' };
    if (!config.ativo) return { status: 'inativo', label: 'Inativo', cor: 'bg-slate-400' };
    
    // Verificar se tem credenciais para canais que precisam
    if (['WhatsApp', 'Instagram', 'Facebook', 'Telegram'].includes(canalId)) {
      if (!config.credenciais?.api_key && !config.credenciais?.access_token) {
        return { status: 'pendente', label: 'Pendente Config', cor: 'bg-orange-500' };
      }
    }
    
    return { status: 'ativo', label: 'Ativo', cor: 'bg-green-500' };
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div
      className="w-full h-full overflow-auto p-4 lg:p-6"
      data-permission="Sistema.Integracoes.visualizar"
      data-context-required="group_id|empresa_id"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <MessageCircle className="w-8 h-8 text-blue-600" />
              Canais de Atendimento
            </h1>
            <p className="text-slate-600 mt-1">Gerencie todos os canais de comunicação</p>
          </div>
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['configs-canais-multi'] })}
            disabled={!contextoValido || !canViewCanais}
            data-action="atualizar-canais"
            data-permission="Sistema.Integracoes.visualizar"
            data-context-required="group_id|empresa_id"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {(!contextoValido || !canViewCanais) && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Selecione um grupo/empresa e confirme a permissao em Integracoes ou Atendimento para gerenciar canais.
            </span>
          </div>
        )}

        {/* Grid de Canais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {canaisDisponiveis.map(canal => {
            const config = getConfigCanal(canal.id);
            const status = getStatusCanal(canal.id);
            const stats = estatisticas[canal.id] || { total: 0, ativas: 0, resolvidas: 0 };
            const Icone = canal.icone;

            return (
              <Card key={canal.id} className={`relative h-full overflow-hidden transition-all hover:shadow-lg ${
                status.status === 'ativo' ? 'ring-2 ring-green-500' : ''
              }`}>
                {/* Indicador de Status */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${status.cor}`} />
                
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${canal.cor} rounded-lg flex items-center justify-center`}>
                        <Icone className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{canal.nome}</CardTitle>
                        <Badge className={`text-xs ${canal.corLight}`}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                    
                    <Switch
                      checked={config?.ativo || false}
                      disabled={toggleCanalMutation.isPending || !contextoValido || !canEditCanais}
                      data-action="alternar-canal"
                      data-channel={canal.id}
                      data-permission="Sistema.Integracoes.editar"
                      data-context-required="group_id|empresa_id"
                      onCheckedChange={(checked) => {
                        toggleCanalMutation.mutate({ canalId: canal.id, ativo: checked });
                      }}
                    />
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* Estatísticas */}
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="p-2 bg-slate-50 rounded">
                      <p className="text-lg font-bold text-blue-600">{stats.ativas}</p>
                      <p className="text-xs text-slate-500">Ativas</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded">
                      <p className="text-lg font-bold text-green-600">{stats.resolvidas}</p>
                      <p className="text-xs text-slate-500">Resolvidas</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded">
                      <p className="text-lg font-bold text-slate-600">{stats.total}</p>
                      <p className="text-xs text-slate-500">Total</p>
                    </div>
                  </div>

                  {/* Modo de Atendimento */}
                  {config && (
                    <div className="text-xs text-slate-600 mb-3">
                      <span className="font-medium">Modo:</span> {config.modo_atendimento || 'Não definido'}
                    </div>
                  )}

                  {/* Botão Configurar */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={!contextoValido || !canViewCanais}
                    data-action="configurar-canal"
                    data-channel={canal.id}
                    data-permission="Sistema.Integracoes.visualizar"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toast.info(`Acesse a aba "Canais" para configurar ${canal.nome} em detalhes.`);
                    }}
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    Configurar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Resumo Geral */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo de Integração</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">
                  {configsCanais.filter(c => c.ativo).length}
                </p>
                <p className="text-sm text-slate-600">Canais Ativos</p>
              </div>
              
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <AlertCircle className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-orange-600">
                  {canaisDisponiveis.filter(c => getStatusCanal(c.id).status === 'pendente').length}
                </p>
                <p className="text-sm text-slate-600">Pendentes Config</p>
              </div>
              
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <MessageCircle className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600">
                  {Object.values(estatisticas).reduce((sum, s) => sum + s.ativas, 0)}
                </p>
                <p className="text-sm text-slate-600">Conversas Ativas</p>
              </div>
              
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <Globe className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-600">
                  {canaisDisponiveis.length}
                </p>
                <p className="text-sm text-slate-600">Canais Disponíveis</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
