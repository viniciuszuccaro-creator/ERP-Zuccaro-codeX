import React, { useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Bell, RefreshCw, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import { canEditConfigByPermission, getConfigPermissionKey, loadScopedConfiguracaoSistema, useToggleConfig } from '@/components/lib/useToggleConfig';
import ToggleRow from '@/components/sistema/ToggleRow';
import usePermissions from '@/components/lib/usePermissions';

/**
 * ConfigGlobal — Painel de configuração global.
 * Tabs: Fiscal, Notificações, Segurança.
 * Toggles unificados via useToggleConfig (optimistic UI + persistência no banco).
 */
export default function ConfigGlobal({ empresaId, grupoId }) {
  const [activeTab, setActiveTab] = useState('fiscal');
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const eId = empresaId || empresaAtual?.id;
  const gId = grupoId || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem('group_atual_id'); } catch { return null; }
  })();

  const queryClient = useQueryClient();
  const queryKey = ['config-global', eId ?? 'sem', gId ?? 'sem'];
  const hasValidScope = Boolean(eId || gId);

  const { data: configs = [], refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      return loadScopedConfiguracaoSistema({ empresaId: eId, grupoId: gId, limit: 500, includeGlobal: true });
    },
    enabled: hasValidScope,
    staleTime: 0,
    gcTime: 30000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Subscription em tempo real
  React.useEffect(() => {
    const unsub = base44.entities.ConfiguracaoSistema.subscribe((evt) => {
      if (evt.type === 'create' || evt.type === 'update') {
        const d = evt.data || {};
        const relevante = (eId && d.empresa_id === eId) || (gId && d.group_id === gId) || (!d.empresa_id && !d.group_id);
        if (relevante) queryClient.invalidateQueries({ queryKey, exact: true });
      }
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [eId, gId]);

  // Hook unificado de toggles
  const { saving, handleToggle, getToggleValue } = useToggleConfig(eId, gId, queryKey);
  const getFieldPermission = useCallback((chave, categoria) => getConfigPermissionKey(chave, categoria), []);

  // Valores de campo de texto (não-toggle)
  const getConfig = useCallback((chave) => {
    const list = (configs || []).filter(c => c.chave === chave);
    if (!list.length) return null;
    if (gId && eId) { const e = list.find(c => c.group_id === gId && c.empresa_id === eId); if (e) return e; }
    if (eId) { const e = list.find(c => c.empresa_id === eId); if (e) return e; }
    if (gId) { const e = list.find(c => c.group_id === gId); if (e) return e; }
    return list.find(c => !c.empresa_id && !c.group_id) || list[0] || null;
  }, [configs, gId, eId]);

  const [savingField, setSavingField] = useState(/** @returns {Record<string, boolean>} */ () => ({}));
  const handleSaveField = useCallback(async (chave, categoria, dados) => {
    if (!hasValidScope) {
      toast.error('Selecione um grupo ou empresa para salvar configurações.');
      return;
    }
    if (!canEditConfigByPermission(hasPermission, chave, categoria)) {
      toast.error('Sem permissao para editar esta configuracao.');
      return;
    }
    if (savingField[chave]) return;
    setSavingField(prev => ({ ...prev, [chave]: true }));
    try {
      const scope = { ...(gId && { group_id: gId }), ...(eId && { empresa_id: eId }) };
      await base44.functions.invoke('upsertConfig', { chave, data: { chave, categoria, ...dados }, scope });
      await queryClient.invalidateQueries({ queryKey, exact: true });
      await refetch();
      toast.success('✅ Configuração salva!');
    } catch (err) {
      toast.error('Erro ao salvar: ' + String(err?.message || err));
    } finally {
      setSavingField(prev => { const n = { ...prev }; delete n[chave]; return n; });
    }
  }, [savingField, queryClient, queryKey, gId, eId, refetch, hasValidScope, hasPermission]);

  const handleFieldBlur = useCallback((chave, categoria, dados, atual = {}) => {
    const mudou = Object.entries(dados).some(([key, value]) => atual?.[key] !== value);
    if (!mudou) return;
    handleSaveField(chave, categoria, dados);
  }, [handleSaveField]);

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Parâmetros Globais</h2>
          <p className="text-sm text-slate-500">
            {eId ? `Empresa: ${empresaAtual?.nome_fantasia || eId}` : `Grupo: ${grupoAtual?.nome_do_grupo || gId}`}
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={isFetching || !hasValidScope} data-permission="Sistema.Configuracoes.visualizar" data-action="ConfigGlobal.atualizar"
          onClick={() => { queryClient.invalidateQueries({ queryKey }); refetch(); }}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Atualizando…' : 'Atualizar'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="inline-flex flex-nowrap min-w-max bg-white border shadow-sm">
            <TabsTrigger value="fiscal"><FileText className="w-4 h-4 mr-1.5" />Fiscal</TabsTrigger>
            <TabsTrigger value="notificacoes"><Bell className="w-4 h-4 mr-1.5" />Notificações</TabsTrigger>
            <TabsTrigger value="seguranca"><Shield className="w-4 h-4 mr-1.5" />Segurança</TabsTrigger>
          </TabsList>
        </div>

        {/* FISCAL */}
        <TabsContent value="fiscal" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" />Configurações Fiscais Padrão</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>CFOP Padrão — Dentro do Estado</Label>
                  <Input key={`cfop-int-${eId}-${gId}`} defaultValue={getConfig('fiscal_cfop_interno')?.valor || '5102'}
                    placeholder="5102" disabled={!hasValidScope || !!savingField.fiscal_cfop_interno} data-permission={getFieldPermission('fiscal_cfop_interno', 'Fiscal')} data-action="ConfigGlobal.Fiscal.cfopInterno" onBlur={(e) => handleFieldBlur('fiscal_cfop_interno', 'Fiscal', { valor: e.target.value }, getConfig('fiscal_cfop_interno') || { valor: '5102' })} />
                </div>
                <div>
                  <Label>CFOP Padrão — Fora do Estado</Label>
                  <Input key={`cfop-ext-${eId}-${gId}`} defaultValue={getConfig('fiscal_cfop_externo')?.valor || '6102'}
                    placeholder="6102" disabled={!hasValidScope || !!savingField.fiscal_cfop_externo} data-permission={getFieldPermission('fiscal_cfop_externo', 'Fiscal')} data-action="ConfigGlobal.Fiscal.cfopExterno" onBlur={(e) => handleFieldBlur('fiscal_cfop_externo', 'Fiscal', { valor: e.target.value }, getConfig('fiscal_cfop_externo') || { valor: '6102' })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Alíquota ICMS (%)</Label>
                  <Input type="number" key={`icms-${eId}-${gId}`} defaultValue={getConfig('fiscal_aliq_icms')?.numero || 18}
                    disabled={!hasValidScope || !!savingField.fiscal_aliq_icms} data-permission={getFieldPermission('fiscal_aliq_icms', 'Fiscal')} data-action="ConfigGlobal.Fiscal.icms" onBlur={(e) => handleFieldBlur('fiscal_aliq_icms', 'Fiscal', { numero: e.target.value === '' ? 18 : Number(e.target.value) }, getConfig('fiscal_aliq_icms') || { numero: 18 })} />
                </div>
                <div>
                  <Label>Alíquota PIS (%)</Label>
                  <Input type="number" key={`pis-${eId}-${gId}`} defaultValue={getConfig('fiscal_aliq_pis')?.numero || 1.65}
                    disabled={!hasValidScope || !!savingField.fiscal_aliq_pis} data-permission={getFieldPermission('fiscal_aliq_pis', 'Fiscal')} data-action="ConfigGlobal.Fiscal.pis" onBlur={(e) => handleFieldBlur('fiscal_aliq_pis', 'Fiscal', { numero: e.target.value === '' ? 1.65 : Number(e.target.value) }, getConfig('fiscal_aliq_pis') || { numero: 1.65 })} />
                </div>
                <div>
                  <Label>Alíquota COFINS (%)</Label>
                  <Input type="number" key={`cofins-${eId}-${gId}`} defaultValue={getConfig('fiscal_aliq_cofins')?.numero || 7.6}
                    disabled={!hasValidScope || !!savingField.fiscal_aliq_cofins} data-permission={getFieldPermission('fiscal_aliq_cofins', 'Fiscal')} data-action="ConfigGlobal.Fiscal.cofins" onBlur={(e) => handleFieldBlur('fiscal_aliq_cofins', 'Fiscal', { numero: e.target.value === '' ? 7.6 : Number(e.target.value) }, getConfig('fiscal_aliq_cofins') || { numero: 7.6 })} />
                </div>
              </div>
              <div>
                <Label>Observações Padrão NF-e</Label>
                <Textarea key={`obs-nfe-${eId}`} placeholder="Observações que aparecerão em todas as notas..." rows={2}
                  defaultValue={getConfig('fiscal_obs_nfe')?.valor || ''}
                  data-permission={getFieldPermission('fiscal_obs_nfe', 'Fiscal')}
                  data-action="ConfigGlobal.Fiscal.obsNfe"
                  disabled={!hasValidScope || !!savingField.fiscal_obs_nfe}
                  onBlur={(e) => handleFieldBlur('fiscal_obs_nfe', 'Fiscal', { valor: e.target.value }, getConfig('fiscal_obs_nfe') || { valor: '' })} />
              </div>
              {/* Status rápido das integrações */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t">
                {[
                  { chave: 'integracao_nfe', label: 'NF-e' },
                  { chave: 'integracao_boletos', label: 'Boleto/PIX' },
                  { chave: 'integracao_maps', label: 'Google Maps' },
                  { chave: 'integracao_whatsapp', label: 'WhatsApp' },
                ].map(({ chave, label }) => {
                  const rec = getConfig(chave);
                  const sub = rec?.[chave];
                  const ativo = !!(sub?.ativa || sub?.api_key);
                  return (
                    <div key={chave} className="p-3 border rounded-lg bg-white">
                      <div className="text-xs text-slate-500 mb-1">{label}</div>
                      <div className="flex items-center gap-1">
                        {ativo ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                        <Badge className={ativo ? 'bg-green-100 text-green-700 border-green-200 text-[10px]' : 'bg-slate-100 text-slate-500 text-[10px]'}>
                          {ativo ? 'Ativo' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTIFICAÇÕES */}
        <TabsContent value="notificacoes" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4" />Notificações Automáticas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <ToggleRow configs={configs} chave="notif_pedido_aprovado" categoria="Notificacoes" label="Pedido Aprovado" desc="Notifica cliente quando pedido for aprovado" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} disabled={!hasValidScope} />
              <ToggleRow configs={configs} chave="notif_entrega_transporte" categoria="Notificacoes" label="Entrega Saiu para Transporte" desc="Envia link de rastreamento ao cliente" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} disabled={!hasValidScope} />
              <ToggleRow configs={configs} chave="notif_boleto_gerado" categoria="Notificacoes" label="Boleto/PIX Gerado" desc="Envia boleto por WhatsApp e e-mail" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} disabled={!hasValidScope} />
              <ToggleRow configs={configs} chave="notif_titulo_vencido" categoria="Notificacoes" label="Título Vencido" desc="Alerta de inadimplência" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} disabled={!hasValidScope} />
              <ToggleRow configs={configs} chave="notif_op_atrasada" categoria="Notificacoes" label="OP Atrasada" desc="Alerta para gerente de produção" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} disabled={!hasValidScope} />
              <ToggleRow configs={configs} chave="notif_estoque_baixo" categoria="Notificacoes" label="Estoque Baixo" desc="Alerta quando produto abaixo do mínimo" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} disabled={!hasValidScope} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEGURANÇA */}
        <TabsContent value="seguranca" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" />Segurança & Acesso</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <ToggleRow configs={configs} chave="seg_login_duplo_fator" categoria="Seguranca" label="Autenticação em Dois Fatores (MFA)" desc="Exige código adicional no login" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} disabled={!hasValidScope} />
              <ToggleRow configs={configs} chave="seg_bloquear_ip_suspeito" categoria="Seguranca" label="Bloqueio de IP Suspeito" desc="Bloqueia IPs com muitas tentativas falhas" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} disabled={!hasValidScope} />
              <ToggleRow configs={configs} chave="seg_sessao_unica" categoria="Seguranca" label="Sessão Única por Usuário" desc="Impede múltiplos logins simultâneos" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} disabled={!hasValidScope} />
              <ToggleRow configs={configs} chave="seg_auditoria_detalhada" categoria="Seguranca" label="Auditoria Detalhada de Ações" desc="Registra todas as operações no AuditLog" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} disabled={!hasValidScope} />
              <ToggleRow configs={configs} chave="seg_notif_novo_dispositivo" categoria="Seguranca" label="Notificar Novo Dispositivo" desc="Alerta o usuário ao logar em novo dispositivo" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} disabled={!hasValidScope} />
              <ToggleRow configs={configs} chave="seg_lgpd_anonimizacao" categoria="Seguranca" label="Anonimização LGPD Automática" desc="Anonimiza dados de clientes inativos após 2 anos" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} disabled={!hasValidScope} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
