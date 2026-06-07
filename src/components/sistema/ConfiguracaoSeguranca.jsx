import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Shield,
  Key,
  Clock,
  Smartphone,
  Lock,
  Save,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useUser } from '@/components/lib/UserContext';

const DEFAULT_SECURITY_CONFIG = {
  jwt_ativo: true,
  jwt_algoritmo: 'HS256',
  jwt_validade_access_minutos: 15,
  jwt_validade_refresh_dias: 30,
  jwt_rotacao_refresh: true,
  jwt_familia_tokens: true,
  jwt_revogar_familia_em_suspeita: true,
  sessao_unica: false,
  sessoes_simultaneas_max: 3,
  encerrar_sessoes_antigas_auto: true,
  timeout_inatividade_minutos: 60,
  timeout_absoluto_horas: 24,
  exigir_mfa: false,
  mfa_metodos_disponiveis: ['Email', 'WhatsApp'],
  mfa_validade_codigo_minutos: 5,
  mfa_exigir_novo_ip: true,
  mfa_exigir_novo_dispositivo: true,
  mfa_exigir_horario_incomum: false,
  tentativas_login_max: 5,
  bloqueio_tempo_minutos: 30,
  bloqueio_ip_suspeito: true,
  detectar_anomalias_ia: false,
  registrar_dispositivos: true,
  notificar_novo_dispositivo: true,
  notificar_novo_ip: true,
  politica_senha: {
    tamanho_minimo: 8,
    exigir_maiusculas: true,
    exigir_minusculas: true,
    exigir_numeros: true,
    exigir_especiais: false,
    trocar_senha_dias: 90,
    historico_senhas: 3
  }
};

const toBool = (value, fallback = false) => typeof value === 'boolean' ? value : fallback;
const toInt = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const normalizeSecurityConfig = (data = {}) => {
  const merged = {
    ...DEFAULT_SECURITY_CONFIG,
    ...data,
    politica_senha: {
      ...DEFAULT_SECURITY_CONFIG.politica_senha,
      ...(data?.politica_senha || {})
    }
  };

  return {
    ...merged,
    jwt_ativo: toBool(merged.jwt_ativo, true),
    jwt_validade_access_minutos: toInt(merged.jwt_validade_access_minutos, 15),
    jwt_validade_refresh_dias: toInt(merged.jwt_validade_refresh_dias, 30),
    jwt_rotacao_refresh: toBool(merged.jwt_rotacao_refresh, true),
    jwt_familia_tokens: toBool(merged.jwt_familia_tokens, true),
    jwt_revogar_familia_em_suspeita: toBool(merged.jwt_revogar_familia_em_suspeita, true),
    sessao_unica: toBool(merged.sessao_unica, false),
    sessoes_simultaneas_max: toInt(merged.sessoes_simultaneas_max, 3),
    encerrar_sessoes_antigas_auto: toBool(merged.encerrar_sessoes_antigas_auto, true),
    timeout_inatividade_minutos: toInt(merged.timeout_inatividade_minutos, 60),
    timeout_absoluto_horas: toInt(merged.timeout_absoluto_horas, 24),
    exigir_mfa: toBool(merged.exigir_mfa, false),
    mfa_metodos_disponiveis: Array.isArray(merged.mfa_metodos_disponiveis) ? merged.mfa_metodos_disponiveis : DEFAULT_SECURITY_CONFIG.mfa_metodos_disponiveis,
    mfa_validade_codigo_minutos: toInt(merged.mfa_validade_codigo_minutos, 5),
    mfa_exigir_novo_ip: toBool(merged.mfa_exigir_novo_ip, true),
    mfa_exigir_novo_dispositivo: toBool(merged.mfa_exigir_novo_dispositivo, true),
    mfa_exigir_horario_incomum: toBool(merged.mfa_exigir_horario_incomum, false),
    tentativas_login_max: toInt(merged.tentativas_login_max, 5),
    bloqueio_tempo_minutos: toInt(merged.bloqueio_tempo_minutos, 30),
    bloqueio_ip_suspeito: toBool(merged.bloqueio_ip_suspeito, true),
    detectar_anomalias_ia: toBool(merged.detectar_anomalias_ia, false),
    registrar_dispositivos: toBool(merged.registrar_dispositivos, true),
    notificar_novo_dispositivo: toBool(merged.notificar_novo_dispositivo, true),
    notificar_novo_ip: toBool(merged.notificar_novo_ip, true),
    politica_senha: {
      tamanho_minimo: toInt(merged.politica_senha?.tamanho_minimo, 8),
      exigir_maiusculas: toBool(merged.politica_senha?.exigir_maiusculas, true),
      exigir_minusculas: toBool(merged.politica_senha?.exigir_minusculas, true),
      exigir_numeros: toBool(merged.politica_senha?.exigir_numeros, true),
      exigir_especiais: toBool(merged.politica_senha?.exigir_especiais, false),
      trocar_senha_dias: toInt(merged.politica_senha?.trocar_senha_dias, 90),
      historico_senhas: toInt(merged.politica_senha?.historico_senhas, 3)
    }
  };
};

const validateSecurityConfig = (data = {}) => {
  const issues = [];
  if (data.jwt_ativo && data.jwt_validade_access_minutos < 5) issues.push('Access Token deve ter validade minima de 5 minutos.');
  if (data.jwt_ativo && data.jwt_validade_refresh_dias < 1) issues.push('Refresh Token deve ter validade minima de 1 dia.');
  if (data.exigir_mfa && (!Array.isArray(data.mfa_metodos_disponiveis) || data.mfa_metodos_disponiveis.length === 0)) issues.push('MFA exige ao menos um metodo disponivel.');
  if ((data.politica_senha?.tamanho_minimo || 0) < 8) issues.push('Politica de senha deve exigir no minimo 8 caracteres.');
  if (data.tentativas_login_max < 3) issues.push('Tentativas maximas de login deve ser no minimo 3.');
  return issues;
};

/**
 * Configuração de Segurança e Sessões
 */
export default function ConfiguracaoSeguranca({ empresaId, grupoId }) {
  const [salvando, setSalvando] = useState(false);
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const { user } = useUser();
  const grupoAtivoId = grupoId || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem('group_atual_id'); } catch { return null; }
  })();
  const empresaAtivaId = empresaId || empresaAtual?.id || null;
  const scopeId = empresaAtivaId || grupoAtivoId || 'sem-contexto';
  const scope = empresaAtivaId ? { empresa_id: empresaAtivaId } : grupoAtivoId ? { group_id: grupoAtivoId } : {};
  const contextoValido = scopeId !== 'sem-contexto';
  const podeEditarSeguranca = isAdmin() || hasPermission('Sistema', 'Segurança', 'editar') || hasPermission('Sistema', 'Seguranca', 'editar');
  const controlesDesabilitados = !contextoValido || !podeEditarSeguranca;

  const auditarSeguranca = async ({ acao, descricao, dadosNovos = null, dadosAnteriores = null }) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        acao,
        modulo: 'Seguranca',
        entidade: 'ConfiguracaoSeguranca',
        empresa_id: empresaAtivaId || null,
        group_id: grupoAtivoId || null,
        descricao,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar configuracao de seguranca:', error);
    }
  };

  const { data: config, isLoading } = useQuery({
    queryKey: ['config-seguranca', scopeId],
    queryFn: async () => {
      const configs = await base44.entities.ConfiguracaoSeguranca.filter(scope);
      
      if (configs.length > 0) {
        return normalizeSecurityConfig(configs[0]);
      }
      
      // Config padrão
      return normalizeSecurityConfig({
        empresa_id: empresaAtivaId || null,
        group_id: grupoAtivoId || null,
        jwt_ativo: true,
        jwt_algoritmo: 'HS256',
        jwt_validade_access_minutos: 15,
        jwt_validade_refresh_dias: 30,
        jwt_rotacao_refresh: true,
        jwt_familia_tokens: true,
        jwt_revogar_familia_em_suspeita: true,
        sessao_unica: false,
        sessoes_simultaneas_max: 3,
        encerrar_sessoes_antigas_auto: true,
        timeout_inatividade_minutos: 60,
        timeout_absoluto_horas: 24,
        exigir_mfa: false,
        mfa_metodos_disponiveis: ['Email', 'WhatsApp'],
        mfa_validade_codigo_minutos: 5,
        mfa_exigir_novo_ip: true,
        mfa_exigir_novo_dispositivo: true,
        mfa_exigir_horario_incomum: false,
        tentativas_login_max: 5,
        bloqueio_tempo_minutos: 30,
        bloqueio_ip_suspeito: true,
        detectar_anomalias_ia: false,
        registrar_dispositivos: true,
        notificar_novo_dispositivo: true,
        notificar_novo_ip: true,
        politica_senha: {
          tamanho_minimo: 8,
          exigir_maiusculas: true,
          exigir_minusculas: true,
          exigir_numeros: true,
          exigir_especiais: false,
          trocar_senha_dias: 90,
          historico_senhas: 3
        }
      });
    },
    enabled: contextoValido,
  });

  const [formData, setFormData] = useState(normalizeSecurityConfig(config || {}));

  React.useEffect(() => {
    if (config) {
      setFormData(normalizeSecurityConfig(config));
    }
  }, [config]);

  const syncSecurityMirrorConfigs = async (data) => {
    const mirrorConfigs = [
      ['cc_exigir_mfa', data.exigir_mfa],
      ['seg_login_duplo_fator', data.exigir_mfa],
      ['cc_bloquear_ips_suspeitos', data.bloqueio_ip_suspeito],
      ['seg_bloquear_ip_suspeito', data.bloqueio_ip_suspeito],
      ['cc_ia_seguranca_ativa', data.detectar_anomalias_ia],
      ['seg_sessao_unica', data.sessao_unica],
      ['seg_notif_novo_dispositivo', data.notificar_novo_dispositivo],
      ['seg_auditoria_detalhada', true],
    ];

    await Promise.all(mirrorConfigs.map(([chave, ativa]) => base44.functions.invoke('upsertConfig', {
      chave,
      data: {
        chave,
        categoria: 'Seguranca',
        ativa: Boolean(ativa),
        origem: 'ConfiguracaoSeguranca',
      },
      scope,
    })));
  };

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      const clean = normalizeSecurityConfig(data);
      const stamped = {
        ...clean,
        empresa_id: empresaAtivaId || null,
        group_id: grupoAtivoId || null,
        origem_configuracao: empresaAtivaId ? 'empresa' : 'grupo',
      };
      const before = config?.id ? await base44.entities.ConfiguracaoSeguranca.get(config.id).catch(() => null) : null;
      const result = config?.id
        ? await updateInContext('ConfiguracaoSeguranca', config.id, stamped)
        : await createInContext('ConfiguracaoSeguranca', stamped);
      await syncSecurityMirrorConfigs(stamped);
      try {
        const me = await base44.auth.me();
        await createInContext('AuditLog', {
          usuario: me?.full_name || me?.email || 'Usuario',
          usuario_id: me?.id || null,
          acao: config?.id ? 'Edicao' : 'Criacao',
          modulo: 'Seguranca',
          entidade: 'ConfiguracaoSeguranca',
          registro_id: result?.id || config?.id,
          empresa_id: empresaAtivaId || null,
          group_id: grupoAtivoId || null,
          descricao: 'Configuracao de seguranca atualizada',
          dados_anteriores: before,
          dados_novos: stamped,
          sucesso: true,
          data_hora: new Date().toISOString()
        });
      } catch {}
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-seguranca', scopeId] });
      queryClient.invalidateQueries({ queryKey: ['config-center-v2'] });
      queryClient.invalidateQueries({ queryKey: ['config-global'] });
      toast.success('✅ Configuração salva com sucesso!');
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
      auditarSeguranca({
        acao: 'Bloqueio sem contexto',
        descricao: 'Tentativa de salvar configuracoes de seguranca sem grupo ou empresa.',
        dadosNovos: { scope }
      });
      return;
    }
    if (!podeEditarSeguranca) {
      toast.error('Sem permissao para editar configuracoes de seguranca.');
      auditarSeguranca({
        acao: 'Bloqueio por permissao',
        descricao: 'Tentativa de salvar configuracoes de seguranca sem permissao.',
        dadosNovos: { scope }
      });
      return;
    }
    const clean = normalizeSecurityConfig(formData);
    const issues = validateSecurityConfig(clean);
    if (issues.length) {
      toast.error(issues[0]);
      return;
    }
    if (!window.confirm('Regra-Mae: confirma salvar configuracoes de seguranca para o contexto atual? Esta acao sensivel sera auditada.')) {
      return;
    }
    setSalvando(true);
    salvarMutation.mutate(clean);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full space-y-6">
      {/* Status Banner */}
      <Alert className={formData.jwt_ativo ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}>
        <Shield className={`w-5 h-5 ${formData.jwt_ativo ? 'text-green-600' : 'text-orange-600'}`} />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-semibold ${formData.jwt_ativo ? 'text-green-900' : 'text-orange-900'}`}>
                {formData.jwt_ativo ? '✅ JWT e Controle de Sessões Ativo' : '⚠️ Autenticação JWT Desativada'}
              </p>
              <p className="text-sm text-slate-700 mt-1">
                {formData.jwt_ativo 
                  ? `Access: ${formData.jwt_validade_access_minutos}min • Refresh: ${formData.jwt_validade_refresh_dias}dias • Max: ${formData.sessoes_simultaneas_max} sessões`
                  : 'Ative JWT para maior segurança'
                }
              </p>
            </div>
            <div className="flex gap-2">
              {formData.exigir_mfa && (
                <Badge className="bg-purple-600">MFA Ativo</Badge>
              )}
              {formData.detectar_anomalias_ia && (
                <Badge className="bg-blue-600">IA Segurança</Badge>
              )}
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="jwt" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="jwt" data-action="Seguranca.tab.jwt" data-permission="Sistema.Seguranca.visualizar" data-context-required="group-or-company">
            <Key className="w-4 h-4 mr-2" />
            JWT
          </TabsTrigger>
          <TabsTrigger value="sessoes" data-action="Seguranca.tab.sessoes" data-permission="Sistema.Seguranca.visualizar" data-context-required="group-or-company">
            <Clock className="w-4 h-4 mr-2" />
            Sessões
          </TabsTrigger>
          <TabsTrigger value="mfa" data-action="Seguranca.tab.mfa" data-permission="Sistema.Seguranca.visualizar" data-context-required="group-or-company">
            <Smartphone className="w-4 h-4 mr-2" />
            MFA
          </TabsTrigger>
          <TabsTrigger value="senhas" data-action="Seguranca.tab.senhas" data-permission="Sistema.Seguranca.visualizar" data-context-required="group-or-company">
            <Lock className="w-4 h-4 mr-2" />
            Senhas
          </TabsTrigger>
        </TabsList>

        {/* ABA: JWT */}
        <TabsContent value="jwt" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600" />
                Configurações JWT
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">JWT Ativo</Label>
                  <p className="text-sm text-slate-600">Usar JWT para autenticação</p>
                </div>
                <Switch
                  data-action="Seguranca.jwt.ativo"
                  checked={formData.jwt_ativo}
                  disabled={controlesDesabilitados}
                  onCheckedChange={(checked) => setFormData({...formData, jwt_ativo: checked})}
                />
              </div>

              {formData.jwt_ativo && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Algoritmo</Label>
                      <Select
                        value={formData.jwt_algoritmo}
                        disabled={controlesDesabilitados}
                        onValueChange={(value) => setFormData({...formData, jwt_algoritmo: value})}
                      >
                        <SelectTrigger data-action="Seguranca.jwt.algoritmo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HS256">HS256 (HMAC SHA-256)</SelectItem>
                          <SelectItem value="HS384">HS384 (HMAC SHA-384)</SelectItem>
                          <SelectItem value="HS512">HS512 (HMAC SHA-512)</SelectItem>
                          <SelectItem value="RS256">RS256 (RSA SHA-256)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Validade Access Token (min)</Label>
                      <Input
                        type="number"
                        min="5"
                        max="120"
                        value={formData.jwt_validade_access_minutos}
                      disabled={controlesDesabilitados}
                      onChange={(e) => setFormData({...formData, jwt_validade_access_minutos: Number.isNaN(parseInt(e.target.value, 10)) ? 15 : parseInt(e.target.value, 10)})}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Recomendado: 15-30 minutos
                      </p>
                    </div>

                    <div>
                      <Label>Validade Refresh Token (dias)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={formData.jwt_validade_refresh_dias}
                      disabled={controlesDesabilitados}
                      onChange={(e) => setFormData({...formData, jwt_validade_refresh_dias: Number.isNaN(parseInt(e.target.value, 10)) ? 30 : parseInt(e.target.value, 10)})}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Recomendado: 7-30 dias
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Rotação de Refresh Tokens</Label>
                        <p className="text-sm text-slate-600">Gera novo token a cada uso (segurança)</p>
                      </div>
                      <Switch
                        data-action="Seguranca.jwt.rotacaoRefresh"
                        checked={formData.jwt_rotacao_refresh}
                        disabled={controlesDesabilitados}
                        onCheckedChange={(checked) => setFormData({...formData, jwt_rotacao_refresh: checked})}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Família de Tokens</Label>
                        <p className="text-sm text-slate-600">Detecta roubo de tokens</p>
                      </div>
                      <Switch
                        data-action="Seguranca.jwt.familiaTokens"
                        checked={formData.jwt_familia_tokens}
                        disabled={controlesDesabilitados}
                        onCheckedChange={(checked) => setFormData({...formData, jwt_familia_tokens: checked})}
                      />
                    </div>

                    {formData.jwt_familia_tokens && (
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Revogar Família em Suspeita</Label>
                          <p className="text-sm text-slate-600">Revoga todos tokens se detectar uso duplo</p>
                        </div>
                        <Switch
                          data-action="Seguranca.jwt.revogarFamiliaSuspeita"
                          checked={formData.jwt_revogar_familia_em_suspeita}
                          disabled={controlesDesabilitados}
                          onCheckedChange={(checked) => setFormData({...formData, jwt_revogar_familia_em_suspeita: checked})}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: SESSÕES */}
        <TabsContent value="sessoes" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                Controle de Sessões
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Sessão Única</Label>
                  <p className="text-sm text-slate-600">Permite apenas 1 dispositivo conectado</p>
                </div>
                <Switch
                  data-action="Seguranca.sessoes.sessaoUnica"
                  checked={formData.sessao_unica}
                  disabled={controlesDesabilitados}
                  onCheckedChange={(checked) => setFormData({...formData, sessao_unica: checked})}
                />
              </div>

              {!formData.sessao_unica && (
                <div>
                  <Label>Sessões Simultâneas Máximas</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.sessoes_simultaneas_max}
                    disabled={controlesDesabilitados}
                    onChange={(e) => setFormData({...formData, sessoes_simultaneas_max: Number.isNaN(parseInt(e.target.value, 10)) ? 3 : parseInt(e.target.value, 10)})}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Quantidade máxima de dispositivos conectados simultaneamente
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Timeout Inatividade (min)</Label>
                  <Input
                    type="number"
                    min="5"
                    max="480"
                    value={formData.timeout_inatividade_minutos}
                    disabled={controlesDesabilitados}
                    onChange={(e) => setFormData({...formData, timeout_inatividade_minutos: Number.isNaN(parseInt(e.target.value, 10)) ? 60 : parseInt(e.target.value, 10)})}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Desconecta após este tempo sem atividade
                  </p>
                </div>

                <div>
                  <Label>Timeout Absoluto (horas)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="168"
                    value={formData.timeout_absoluto_horas}
                    disabled={controlesDesabilitados}
                    onChange={(e) => setFormData({...formData, timeout_absoluto_horas: Number.isNaN(parseInt(e.target.value, 10)) ? 24 : parseInt(e.target.value, 10)})}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Tempo máximo de uma sessão
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Encerrar Sessões Antigas Automaticamente</Label>
                  <p className="text-sm text-slate-600">Ao atingir o limite, encerra as mais antigas</p>
                </div>
                <Switch
                  data-action="Seguranca.sessoes.encerrarAntigasAuto"
                  checked={formData.encerrar_sessoes_antigas_auto}
                  disabled={controlesDesabilitados}
                  onCheckedChange={(checked) => setFormData({...formData, encerrar_sessoes_antigas_auto: checked})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: MFA */}
        <TabsContent value="mfa" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-green-600" />
                Autenticação de Dois Fatores (MFA)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Exigir MFA</Label>
                  <p className="text-sm text-slate-600">Obrigar autenticação de dois fatores</p>
                </div>
                <Switch
                  data-action="Seguranca.mfa.exigir"
                  checked={formData.exigir_mfa}
                  disabled={controlesDesabilitados}
                  onCheckedChange={(checked) => setFormData({...formData, exigir_mfa: checked})}
                />
              </div>

              {formData.exigir_mfa && (
                <>
                  <div>
                    <Label className="mb-2 block">Métodos Disponíveis</Label>
                    <div className="space-y-2">
                      {['Email', 'WhatsApp', 'SMS', 'Authenticator'].map((metodo) => (
                        <div key={metodo} className="flex items-center gap-2">
                          <Checkbox
                            data-action={`Seguranca.MFA.metodo.${metodo}`}
                            checked={(formData.mfa_metodos_disponiveis || []).includes(metodo)}
                            disabled={controlesDesabilitados}
                            onCheckedChange={(checked) => {
                              const metodos = formData.mfa_metodos_disponiveis || [];
                              if (checked) {
                                setFormData({
                                  ...formData,
                                  mfa_metodos_disponiveis: [...metodos, metodo]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  mfa_metodos_disponiveis: metodos.filter(m => m !== metodo)
                                });
                              }
                            }}
                          />
                          <Label className="font-normal cursor-pointer">{metodo}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Validade do Código MFA (min)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={formData.mfa_validade_codigo_minutos}
                      disabled={controlesDesabilitados}
                      onChange={(e) => setFormData({...formData, mfa_validade_codigo_minutos: Number.isNaN(parseInt(e.target.value, 10)) ? 5 : parseInt(e.target.value, 10)})}
                    />
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <p className="text-sm font-semibold text-slate-700">Exigir MFA em:</p>
                    
                    <div className="flex items-center justify-between">
                      <Label className="font-normal">Novo IP Address</Label>
                      <Switch
                        data-action="Seguranca.mfa.novoIp"
                        checked={formData.mfa_exigir_novo_ip}
                        disabled={controlesDesabilitados}
                        onCheckedChange={(checked) => setFormData({...formData, mfa_exigir_novo_ip: checked})}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="font-normal">Novo Dispositivo</Label>
                      <Switch
                        data-action="Seguranca.mfa.novoDispositivo"
                        checked={formData.mfa_exigir_novo_dispositivo}
                        disabled={controlesDesabilitados}
                        onCheckedChange={(checked) => setFormData({...formData, mfa_exigir_novo_dispositivo: checked})}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="font-normal">Horário Incomum</Label>
                      <Switch
                        data-action="Seguranca.mfa.horarioIncomum"
                        checked={formData.mfa_exigir_horario_incomum}
                        disabled={controlesDesabilitados}
                        onCheckedChange={(checked) => setFormData({...formData, mfa_exigir_horario_incomum: checked})}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: SENHAS */}
        <TabsContent value="senhas" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="w-5 h-5 text-orange-600" />
                Política de Senhas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tamanho Mínimo</Label>
                  <Input
                    type="number"
                    min="4"
                    max="32"
                    value={formData.politica_senha?.tamanho_minimo || 8}
                    disabled={controlesDesabilitados}
                    onChange={(e) => setFormData({
                      ...formData,
                      politica_senha: {...(formData.politica_senha || {}), tamanho_minimo: Number.isNaN(parseInt(e.target.value, 10)) ? 8 : parseInt(e.target.value, 10)}
                    })}
                  />
                </div>

                <div>
                  <Label>Trocar Senha a Cada (dias)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="365"
                    value={formData.politica_senha?.trocar_senha_dias || 90}
                    disabled={controlesDesabilitados}
                    onChange={(e) => setFormData({
                      ...formData,
                      politica_senha: {...(formData.politica_senha || {}), trocar_senha_dias: Number.isNaN(parseInt(e.target.value, 10)) ? 90 : parseInt(e.target.value, 10)}
                    })}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    0 = nunca expira
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-semibold text-slate-700">Requisitos:</p>

                <div className="flex items-center justify-between">
                  <Label className="font-normal">Exigir Maiúsculas</Label>
                  <Switch
                    data-action="Seguranca.senha.exigirMaiusculas"
                    checked={formData.politica_senha?.exigir_maiusculas}
                    disabled={controlesDesabilitados}
                    onCheckedChange={(checked) => setFormData({
                      ...formData,
                      politica_senha: {...(formData.politica_senha || {}), exigir_maiusculas: checked}
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="font-normal">Exigir Minúsculas</Label>
                  <Switch
                    data-action="Seguranca.senha.exigirMinusculas"
                    checked={formData.politica_senha?.exigir_minusculas}
                    disabled={controlesDesabilitados}
                    onCheckedChange={(checked) => setFormData({
                      ...formData,
                      politica_senha: {...(formData.politica_senha || {}), exigir_minusculas: checked}
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="font-normal">Exigir Números</Label>
                  <Switch
                    data-action="Seguranca.senha.exigirNumeros"
                    checked={formData.politica_senha?.exigir_numeros}
                    disabled={controlesDesabilitados}
                    onCheckedChange={(checked) => setFormData({
                      ...formData,
                      politica_senha: {...(formData.politica_senha || {}), exigir_numeros: checked}
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="font-normal">Exigir Caracteres Especiais</Label>
                  <Switch
                    data-action="Seguranca.senha.exigirEspeciais"
                    checked={formData.politica_senha?.exigir_especiais}
                    disabled={controlesDesabilitados}
                    onCheckedChange={(checked) => setFormData({
                      ...formData,
                      politica_senha: {...(formData.politica_senha || {}), exigir_especiais: checked}
                    })}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <Label>Histórico de Senhas</Label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.politica_senha?.historico_senhas || 3}
                  disabled={controlesDesabilitados}
                  onChange={(e) => setFormData({
                    ...formData,
                    politica_senha: {...(formData.politica_senha || {}), historico_senhas: Number.isNaN(parseInt(e.target.value, 10)) ? 3 : parseInt(e.target.value, 10)}
                  })}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Impede reusar as últimas N senhas
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tentativas de Login */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Proteção contra Brute Force
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tentativas Máximas</Label>
                  <Input
                    type="number"
                    min="3"
                    max="10"
                    value={formData.tentativas_login_max}
                    disabled={controlesDesabilitados}
                    onChange={(e) => setFormData({...formData, tentativas_login_max: Number.isNaN(parseInt(e.target.value, 10)) ? 5 : parseInt(e.target.value, 10)})}
                  />
                </div>

                <div>
                  <Label>Tempo de Bloqueio (min)</Label>
                  <Input
                    type="number"
                    min="5"
                    max="1440"
                    value={formData.bloqueio_tempo_minutos}
                    disabled={controlesDesabilitados}
                    onChange={(e) => setFormData({...formData, bloqueio_tempo_minutos: Number.isNaN(parseInt(e.target.value, 10)) ? 30 : parseInt(e.target.value, 10)})}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Bloquear IPs Suspeitos</Label>
                  <p className="text-sm text-slate-600">Bloqueia IPs com muitas tentativas falhas</p>
                </div>
                <Switch
                  data-action="Seguranca.bruteforce.bloquearIpSuspeito"
                  checked={formData.bloqueio_ip_suspeito}
                  disabled={controlesDesabilitados}
                  onCheckedChange={(checked) => setFormData({...formData, bloqueio_ip_suspeito: checked})}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                Protecao Adaptativa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>IA para Detectar Anomalias</Label>
                  <p className="text-sm text-slate-600">Ativa leitura inteligente de comportamento suspeito</p>
                </div>
                <Switch
                  data-action="Seguranca.adaptativa.detectarAnomalias"
                  checked={formData.detectar_anomalias_ia}
                  disabled={controlesDesabilitados}
                  onCheckedChange={(checked) => setFormData({...formData, detectar_anomalias_ia: checked})}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Registrar Dispositivos</Label>
                  <p className="text-sm text-slate-600">Mantem historico local dos dispositivos autorizados</p>
                </div>
                <Switch
                  data-action="Seguranca.adaptativa.registrarDispositivos"
                  checked={formData.registrar_dispositivos}
                  disabled={controlesDesabilitados}
                  onCheckedChange={(checked) => setFormData({...formData, registrar_dispositivos: checked})}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Notificar Novo Dispositivo</Label>
                  <p className="text-sm text-slate-600">Gera alerta quando houver login em dispositivo novo</p>
                </div>
                <Switch
                  data-action="Seguranca.adaptativa.notificarDispositivo"
                  checked={formData.notificar_novo_dispositivo}
                  disabled={controlesDesabilitados}
                  onCheckedChange={(checked) => setFormData({...formData, notificar_novo_dispositivo: checked})}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Notificar Novo IP</Label>
                  <p className="text-sm text-slate-600">Gera alerta quando o acesso vier de IP desconhecido</p>
                </div>
                <Switch
                  data-action="Seguranca.adaptativa.notificarIp"
                  checked={formData.notificar_novo_ip}
                  disabled={controlesDesabilitados}
                  onCheckedChange={(checked) => setFormData({...formData, notificar_novo_ip: checked})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Ações */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={handleSalvar}
          disabled={salvando || salvarMutation.isPending || controlesDesabilitados}
          className="bg-blue-600 hover:bg-blue-700"
          data-action="Seguranca.Configuracao.salvar"
          data-permission="Sistema.Seguranca.editar"
          data-context-required="group-or-company"
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
      {config?.estatisticas && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-purple-50">
          <CardContent className="p-6">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-600 mb-1">Sessões Ativas</p>
                <p className="text-2xl font-bold text-green-600">
                  {config.estatisticas.total_sessoes_ativas || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Tentativas Falhas</p>
                <p className="text-2xl font-bold text-orange-600">
                  {config.estatisticas.total_tentativas_falhas || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Bloqueios</p>
                <p className="text-2xl font-bold text-red-600">
                  {config.estatisticas.total_bloqueios || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">MFA Validados</p>
                <p className="text-2xl font-bold text-purple-600">
                  {config.estatisticas.total_mfa_validados || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
