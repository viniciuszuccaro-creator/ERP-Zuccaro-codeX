import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Shield,
  Key,
  Clock,
  Smartphone,
  Lock,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { persistOperationalAudit } from '@/components/lib/uiAudit';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useUser } from '@/components/lib/UserContext';
import JwtSecurityTab from './configuracao-seguranca/JwtSecurityTab';
import SessionsSecurityTab from './configuracao-seguranca/SessionsSecurityTab';
import MfaSecurityTab from './configuracao-seguranca/MfaSecurityTab';
import PasswordSecurityTab from './configuracao-seguranca/PasswordSecurityTab';

import { normalizeSecurityConfig, validateSecurityConfig } from './configuracao-seguranca/configuracaoSegurancaPolicy';

/**
 * @typedef {ReturnType<typeof normalizeSecurityConfig>} SecurityConfig
 * @typedef {{ empresaId?: string | null, grupoId?: string | null }} ConfiguracaoSegurancaProps
 * @typedef {{ acao: string, descricao: string, dadosNovos?: unknown, dadosAnteriores?: unknown }} SecurityAuditOptions
 */

/**
 * Configuração de Segurança e Sessões
 */
/** @param {ConfiguracaoSegurancaProps} props */
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

  /** @param {SecurityAuditOptions} options */
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

  /** @param {SecurityConfig} data */
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
    /** @param {SecurityConfig} data */
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
      await persistOperationalAudit({
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
      });
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
        <JwtSecurityTab
          formData={formData}
          setFormData={setFormData}
          controlesDesabilitados={controlesDesabilitados}
        />

        {/* ABA: SESSÕES */}
        <SessionsSecurityTab
          formData={formData}
          setFormData={setFormData}
          controlesDesabilitados={controlesDesabilitados}
        />

        {/* ABA: MFA */}
        <MfaSecurityTab
          formData={formData}
          setFormData={setFormData}
          controlesDesabilitados={controlesDesabilitados}
        />

        {/* ABA: SENHAS */}
        <PasswordSecurityTab
          formData={formData}
          setFormData={setFormData}
          controlesDesabilitados={controlesDesabilitados}
        />
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
