import React from 'react';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { useWindow } from '@/components/lib/useWindow';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import ConfiguracaoNFeForm from '@/components/cadastros/ConfiguracaoNFeForm';
import ConfiguracaoBoletosForm from '@/components/cadastros/ConfiguracaoBoletosForm';
import ConfiguracaoWhatsAppForm from '@/components/cadastros/ConfiguracaoWhatsAppForm';

// Component helper para botões de configuração
export default function IntegrationConfigButtons({ integracao, empresaId, groupId, onAudit }) {
  const { openWindow } = useWindow();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const scopeId = empresaId || groupId || null;
  const scope = empresaId ? { empresa_id: empresaId, group_id: groupId || null } : groupId ? { group_id: groupId } : {};
  const contextoValido = !!groupId;
  const podeExecutar = isAdmin() || hasPermission('Sistema', 'Integracoes', 'executar') || hasPermission('Sistema', 'Integrações', 'executar');
  const podeCriar = isAdmin() || hasPermission('Sistema', 'Integracoes', 'criar') || hasPermission('Sistema', 'Integrações', 'criar');
  const podeEditar = isAdmin() || hasPermission('Sistema', 'Integracoes', 'editar') || hasPermission('Sistema', 'Integrações', 'editar');

  const handleConfigurar = () => {
    if (!contextoValido || (!podeCriar && !podeEditar)) {
      toast({ title: 'Acesso negado', description: 'Selecione um contexto valido e confirme sua permissao.', variant: 'destructive' });
      void onAudit({ acao: 'Bloqueio Configuracao', integracao: integracao.id, sucesso: false });
      return;
    }

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
        if (!contextoValido) {
          toast({ title: 'Contexto invalido', variant: 'destructive' });
          await onAudit({ acao: 'Bloqueio sem contexto', integracao: integracao.id, sucesso: false });
          return;
        }
        const chave = `integracoes_${scopeId}`;
        const existentes = await filterInContext('ConfiguracaoSistema', { chave, ...scope }, undefined, 1);
        const operacao = existentes?.length ? 'editar' : 'criar';
        const permitido = operacao === 'editar' ? podeEditar : podeCriar;
        if (!permitido) {
          toast({ title: 'Acesso negado', description: `Seu perfil nao permite ${operacao} esta integracao.`, variant: 'destructive' });
          await onAudit({ acao: 'Bloqueio por permissao', integracao: integracao.id, sucesso: false, operacao });
          return;
        }
        const payload = { chave, categoria: 'Integracoes', ...scope, [cfg.key]: data };
        if (existentes?.length) {
          await updateInContext('ConfiguracaoSistema', existentes[0].id, payload);
        } else {
          await createInContext('ConfiguracaoSistema', payload);
        }
        await onAudit({ acao: 'Configuracao salva', integracao: integracao.id, sucesso: true, operacao });
        toast({ title: operacao === 'editar' ? 'Integracao atualizada!' : 'Integracao criada!' });
        queryClient.invalidateQueries({ queryKey: [cfg.queryKey] });
        queryClient.invalidateQueries({ queryKey: ['status-integracoes', groupId || null, empresaId || null] });
      } catch (error) {
        console.warn('[StatusIntegracoes] Falha ao salvar configuracao:', error);
        await onAudit({ acao: 'Erro ao salvar configuracao', integracao: integracao.id, sucesso: false });
        toast({ title: 'Erro ao salvar integracao.', variant: 'destructive' });
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
        disabled={integracao.verificando || !contextoValido || !podeExecutar}
        className="flex-1"
        data-action={`IntegracoesStatus.${integracao.id}.verificar`}
        data-permission="Sistema.Integracoes.executar"
        data-context-required="group-or-company"
        data-sensitive="true"
      >
        {integracao.verificando ? 'Verificando...' : 'Verificar'}
      </Button>
      <Button
        size="sm"
        onClick={handleConfigurar}
        disabled={!contextoValido || (!podeCriar && !podeEditar)}
        className="flex-1"
        data-action={`IntegracoesStatus.${integracao.id}.configurar`}
        data-permission="Sistema.Integracoes.criar|Sistema.Integracoes.editar"
        data-context-required="group-or-company"
        data-sensitive="true"
      >
        <Settings className="w-4 h-4 mr-1" />
        Configurar
      </Button>
    </div>
  );
}
