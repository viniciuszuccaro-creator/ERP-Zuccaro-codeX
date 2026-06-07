import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity,
  Database,
  Bolt,
  Shield,
  Mail,
  Settings,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * Configuração de Monitoramento de Performance
 */
export default function ConfiguracaoMonitoramento({ empresaId, grupoId }) {
  const [salvando, setSalvando] = useState(false);
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const grupoAtivoId = grupoId || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem('group_atual_id'); } catch { return null; }
  })();
  const empresaAtivaId = empresaId || empresaAtual?.id || null;
  const scopeId = empresaAtivaId || grupoAtivoId || 'sem-contexto';
  const scope = empresaAtivaId ? { empresa_id: empresaAtivaId } : grupoAtivoId ? { group_id: grupoAtivoId } : {};
  const contextoValido = scopeId !== 'sem-contexto';
  const podeEditarMonitoramento = isAdmin() || hasPermission('Sistema', 'Configurações', 'editar') || hasPermission('Sistema', 'Configuracoes', 'editar') || hasPermission('Sistema', 'Monitoramento', 'editar');

  const { data: config, isLoading } = useQuery({
    queryKey: ['config-monitoramento', scopeId],
    queryFn: async () => {
      const configs = await base44.entities.ConfiguracaoMonitoramento.filter(scope);
      
      if (configs.length > 0) {
        return configs[0];
      }
      
      // Config padrão
      return {
        empresa_id: empresaAtivaId || null,
        group_id: grupoAtivoId || null,
        ativo: true,
        nivel_monitoramento: 'Intermediário',
        coleta_automatica: true,
        intervalo_coleta_segundos: 60,
        retencao_logs_dias: 30,
        retencao_logs_criticos_dias: 365,
        thresholds: {
          query_lenta_ms: 1000,
          api_lenta_ms: 2000,
          page_load_lenta_ms: 3000,
          export_lento_ms: 10000,
          cpu_alta_percent: 80,
          memoria_alta_percent: 85,
          taxa_erro_percent: 5,
          disponibilidade_minima_percent: 99
        },
        monitorar_queries: true,
        monitorar_apis: true,
        monitorar_integracao: true,
        monitorar_exports: true,
        detectar_anomalias_ia: false,
        gerar_alertas_automaticos: true,
        notificar_email: true,
        emails_notificacao: [],
        agrupar_alertas_similares: true,
        janela_agrupamento_minutos: 15,
        alertar_apenas_criticos: false,
        ia_confianca_minima: 80,
        profiling_ativo: false,
        samplear_requisicoes: false,
        taxa_amostragem_percent: 100
      };
    },
    enabled: contextoValido,
  });

  const [formData, setFormData] = useState(config || {});

  React.useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      const stamped = { ...data, empresa_id: empresaAtivaId || null, group_id: grupoAtivoId || null };
      const result = config?.id
        ? await updateInContext('ConfiguracaoMonitoramento', config.id, stamped)
        : await createInContext('ConfiguracaoMonitoramento', stamped);
      try {
        const me = await base44.auth.me();
        await createInContext('AuditLog', {
          usuario: me?.full_name || me?.email || 'Usuario',
          usuario_id: me?.id || null,
          acao: config?.id ? 'Edicao' : 'Criacao',
          modulo: 'Monitoramento',
          entidade: 'ConfiguracaoMonitoramento',
          registro_id: result?.id || config?.id,
          empresa_id: empresaAtivaId || null,
          group_id: grupoAtivoId || null,
          descricao: 'Configuracao de monitoramento atualizada',
          dados_novos: stamped,
          sucesso: true,
          data_hora: new Date().toISOString()
        });
      } catch {}
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-monitoramento', scopeId] });
      toast.success('✅ Configuração salva!');
    },
    onError: (error) => {
      console.error('Erro ao salvar:', error);
      toast.error('❌ Erro ao salvar configuração');
    },
    onSettled: () => setSalvando(false)
  });

  const handleSalvar = () => {
    if (!contextoValido) {
      toast.error('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeEditarMonitoramento) {
      toast.error('Sem permissao para editar configuracoes de monitoramento.');
      return;
    }
    setSalvando(true);
    salvarMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Alert className={formData.ativo ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}>
        <Activity className={`w-5 h-5 ${formData.ativo ? 'text-green-600' : 'text-orange-600'}`} />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-semibold ${formData.ativo ? 'text-green-900' : 'text-orange-900'}`}>
                {formData.ativo ? '✅ Monitoramento de Performance Ativo' : '⚠️ Monitoramento Desativado'}
              </p>
              <p className="text-sm text-slate-700 mt-1">
                {formData.ativo 
                  ? `Nível: ${formData.nivel_monitoramento} • Coleta a cada ${formData.intervalo_coleta_segundos}s`
                  : 'Ative o monitoramento para rastrear performance'
                }
              </p>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="geral" data-action="Monitoramento.tab.geral">
            <Settings className="w-4 h-4 mr-2" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="thresholds" data-action="Monitoramento.tab.thresholds">
            <Bolt className="w-4 h-4 mr-2" />
            Thresholds
          </TabsTrigger>
          <TabsTrigger value="alertas" data-action="Monitoramento.tab.alertas">
            <Mail className="w-4 h-4 mr-2" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="avancado" data-action="Monitoramento.tab.avancado">
            <Database className="w-4 h-4 mr-2" />
            Avançado
          </TabsTrigger>
        </TabsList>

        {/* ABA: GERAL */}
        <TabsContent value="geral" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configurações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Monitoramento Ativo</Label>
                  <p className="text-sm text-slate-600">Ativar monitoramento de performance</p>
                </div>
                <Switch
                  data-action="Monitoramento.ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({...formData, ativo: checked})}
                />
              </div>

              <div>
                <Label>Nível de Monitoramento</Label>
                <Select
                  value={formData.nivel_monitoramento}
                  onValueChange={(value) => setFormData({...formData, nivel_monitoramento: value})}
                >
                  <SelectTrigger data-action="Monitoramento.nivel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Básico">Básico (apenas erros)</SelectItem>
                    <SelectItem value="Intermediário">Intermediário (erros + lentos)</SelectItem>
                    <SelectItem value="Avançado">Avançado (tudo + métricas)</SelectItem>
                    <SelectItem value="Completo">Completo (profiling detalhado)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  Níveis mais altos coletam mais dados mas podem impactar performance
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Intervalo de Coleta (segundos)</Label>
                  <Input
                    type="number"
                    min="10"
                    max="300"
                    value={formData.intervalo_coleta_segundos}
                    onChange={(e) => setFormData({...formData, intervalo_coleta_segundos: parseInt(e.target.value)})}
                  />
                </div>

                <div>
                  <Label>Retenção de Logs (dias)</Label>
                  <Input
                    type="number"
                    min="7"
                    max="365"
                    value={formData.retencao_logs_dias}
                    onChange={(e) => setFormData({...formData, retencao_logs_dias: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Monitorar Queries</Label>
                    <p className="text-xs text-slate-600">Rastrear queries do banco</p>
                  </div>
                  <Switch
                    data-action="Monitoramento.monitorarQueries"
                    checked={formData.monitorar_queries}
                    onCheckedChange={(checked) => setFormData({...formData, monitorar_queries: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Monitorar APIs</Label>
                    <p className="text-xs text-slate-600">Rastrear chamadas de API</p>
                  </div>
                  <Switch
                    data-action="Monitoramento.monitorarApis"
                    checked={formData.monitorar_apis}
                    onCheckedChange={(checked) => setFormData({...formData, monitorar_apis: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Monitorar Integrações</Label>
                    <p className="text-xs text-slate-600">Rastrear integrações externas</p>
                  </div>
                  <Switch
                    data-action="Monitoramento.monitorarIntegracao"
                    checked={formData.monitorar_integracao}
                    onCheckedChange={(checked) => setFormData({...formData, monitorar_integracao: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Monitorar Exportações</Label>
                    <p className="text-xs text-slate-600">Rastrear PDF/Excel</p>
                  </div>
                  <Switch
                    data-action="Monitoramento.monitorarExports"
                    checked={formData.monitorar_exports}
                    onCheckedChange={(checked) => setFormData({...formData, monitorar_exports: checked})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: THRESHOLDS */}
        <TabsContent value="thresholds" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bolt className="w-5 h-5 text-yellow-600" />
                Limites de Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 mb-4">
                Operações acima destes limites serão consideradas lentas e gerarão alertas
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Query Lenta (ms)</Label>
                  <Input
                    type="number"
                    value={formData.thresholds?.query_lenta_ms || 1000}
                    onChange={(e) => setFormData({
                      ...formData,
                      thresholds: {...(formData.thresholds || {}), query_lenta_ms: parseInt(e.target.value)}
                    })}
                  />
                </div>

                <div>
                  <Label className="text-xs">API Lenta (ms)</Label>
                  <Input
                    type="number"
                    value={formData.thresholds?.api_lenta_ms || 2000}
                    onChange={(e) => setFormData({
                      ...formData,
                      thresholds: {...(formData.thresholds || {}), api_lenta_ms: parseInt(e.target.value)}
                    })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Page Load Lenta (ms)</Label>
                  <Input
                    type="number"
                    value={formData.thresholds?.page_load_lenta_ms || 3000}
                    onChange={(e) => setFormData({
                      ...formData,
                      thresholds: {...(formData.thresholds || {}), page_load_lenta_ms: parseInt(e.target.value)}
                    })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Export Lento (ms)</Label>
                  <Input
                    type="number"
                    value={formData.thresholds?.export_lento_ms || 10000}
                    onChange={(e) => setFormData({
                      ...formData,
                      thresholds: {...(formData.thresholds || {}), export_lento_ms: parseInt(e.target.value)}
                    })}
                  />
                </div>

                <div>
                  <Label className="text-xs">CPU Alta (%)</Label>
                  <Input
                    type="number"
                    min="50"
                    max="100"
                    value={formData.thresholds?.cpu_alta_percent || 80}
                    onChange={(e) => setFormData({
                      ...formData,
                      thresholds: {...(formData.thresholds || {}), cpu_alta_percent: parseInt(e.target.value)}
                    })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Memória Alta (%)</Label>
                  <Input
                    type="number"
                    min="50"
                    max="100"
                    value={formData.thresholds?.memoria_alta_percent || 85}
                    onChange={(e) => setFormData({
                      ...formData,
                      thresholds: {...(formData.thresholds || {}), memoria_alta_percent: parseInt(e.target.value)}
                    })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Taxa de Erro Máxima (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.thresholds?.taxa_erro_percent || 5}
                    onChange={(e) => setFormData({
                      ...formData,
                      thresholds: {...(formData.thresholds || {}), taxa_erro_percent: parseInt(e.target.value)}
                    })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Disponibilidade Mínima (%)</Label>
                  <Input
                    type="number"
                    min="90"
                    max="100"
                    step="0.1"
                    value={formData.thresholds?.disponibilidade_minima_percent || 99}
                    onChange={(e) => setFormData({
                      ...formData,
                      thresholds: {...(formData.thresholds || {}), disponibilidade_minima_percent: parseFloat(e.target.value)}
                    })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: ALERTAS */}
        <TabsContent value="alertas" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                Configuração de Alertas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Gerar Alertas Automáticos</Label>
                  <p className="text-sm text-slate-600">Criar alertas quando thresholds forem excedidos</p>
                </div>
                <Switch
                  data-action="Monitoramento.alertasAutomaticos"
                  checked={formData.gerar_alertas_automaticos}
                  onCheckedChange={(checked) => setFormData({...formData, gerar_alertas_automaticos: checked})}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Notificar por E-mail</Label>
                  <p className="text-sm text-slate-600">Enviar e-mail quando alertas forem gerados</p>
                </div>
                <Switch
                  data-action="Monitoramento.notificarEmail"
                  checked={formData.notificar_email}
                  onCheckedChange={(checked) => setFormData({...formData, notificar_email: checked})}
                />
              </div>

              {formData.notificar_email && (
                <div>
                  <Label>E-mails para Notificação</Label>
                  <Input
                    placeholder="admin@empresa.com, ti@empresa.com"
                    value={(formData.emails_notificacao || []).join(', ')}
                    onChange={(e) => setFormData({
                      ...formData,
                      emails_notificacao: e.target.value.split(',').map(email => email.trim()).filter(e => e)
                    })}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Separe múltiplos e-mails com vírgula
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Agrupar Alertas Similares</Label>
                  <p className="text-sm text-slate-600">Evitar spam de alertas duplicados</p>
                </div>
                <Switch
                  data-action="Monitoramento.agruparAlertas"
                  checked={formData.agrupar_alertas_similares}
                  onCheckedChange={(checked) => setFormData({...formData, agrupar_alertas_similares: checked})}
                />
              </div>

              {formData.agrupar_alertas_similares && (
                <div>
                  <Label>Janela de Agrupamento (minutos)</Label>
                  <Input
                    type="number"
                    min="5"
                    max="60"
                    value={formData.janela_agrupamento_minutos}
                    onChange={(e) => setFormData({...formData, janela_agrupamento_minutos: parseInt(e.target.value)})}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Alertar Apenas Críticos</Label>
                  <p className="text-sm text-slate-600">Notificar apenas alertas de severidade Critical</p>
                </div>
                <Switch
                  data-action="Monitoramento.alertarApenasCriticos"
                  checked={formData.alertar_apenas_criticos}
                  onCheckedChange={(checked) => setFormData({...formData, alertar_apenas_criticos: checked})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: AVANÇADO */}
        <TabsContent value="avancado" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                Configurações Avançadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Detectar Anomalias com IA</Label>
                  <p className="text-sm text-slate-600">Usar IA para detectar padrões anormais</p>
                </div>
                <Switch
                  data-action="Monitoramento.ia.detectarAnomalias"
                  checked={formData.detectar_anomalias_ia}
                  onCheckedChange={(checked) => setFormData({...formData, detectar_anomalias_ia: checked})}
                />
              </div>

              {formData.detectar_anomalias_ia && (
                <div>
                  <Label>Confiança Mínima IA (%)</Label>
                  <Input
                    type="number"
                    min="50"
                    max="100"
                    value={formData.ia_confianca_minima}
                    onChange={(e) => setFormData({...formData, ia_confianca_minima: parseInt(e.target.value)})}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Profiling Ativo</Label>
                  <p className="text-sm text-slate-600">Profiling detalhado de funções</p>
                </div>
                <Switch
                  data-action="Monitoramento.profilingAtivo"
                  checked={formData.profiling_ativo}
                  onCheckedChange={(checked) => setFormData({...formData, profiling_ativo: checked})}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Samplear Requisições</Label>
                  <p className="text-sm text-slate-600">Monitorar apenas % das requisições (economia)</p>
                </div>
                <Switch
                  data-action="Monitoramento.samplearRequisicoes"
                  checked={formData.samplear_requisicoes}
                  onCheckedChange={(checked) => setFormData({...formData, samplear_requisicoes: checked})}
                />
              </div>

              {formData.samplear_requisicoes && (
                <div>
                  <Label>Taxa de Amostragem (%)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.taxa_amostragem_percent || 100}
                    onChange={(e) => setFormData({...formData, taxa_amostragem_percent: parseInt(e.target.value)})}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Recomendado: 10-20% para sistemas com alto volume
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Ações */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={handleSalvar}
          disabled={salvando || salvarMutation.isPending || !contextoValido || !podeEditarMonitoramento}
          className="bg-blue-600 hover:bg-blue-700"
          data-action="Monitoramento.Configuracao.salvar"
          data-permission="Sistema.Monitoramento.editar"
          data-sensitive="true"
        >
          {salvando || salvarMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar Configuração
            </>
          )}
        </Button>
      </div>

      {/* Estatísticas */}
      {config?.id && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-purple-50">
          <CardContent className="p-6">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-600 mb-1">Total Alertas</p>
                <p className="text-2xl font-bold text-blue-600">
                  {config.total_alertas_gerados || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Resolvidos</p>
                <p className="text-2xl font-bold text-green-600">
                  {config.total_alertas_resolvidos || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">MTTR (horas)</p>
                <p className="text-2xl font-bold text-purple-600">
                  {(config.mttr_horas || 0).toFixed(1)}h
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Último Alerta</p>
                <p className="text-sm font-semibold text-slate-900">
                  {config.ultimo_alerta_data 
                    ? new Date(config.ultimo_alerta_data).toLocaleString('pt-BR')
                    : 'Nunca'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
