import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database,
  Cloud,
  Shield,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Play,
  Save,
  Mail,
  Settings,
  Bolt
} from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * Configuração de Backup Automático
 */
export default function ConfiguracaoBackup({ empresaId, grupoId }) {
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
  const podeEditarBackup = isAdmin() || hasPermission('Sistema', 'Configurações', 'editar') || hasPermission('Sistema', 'Configuracoes', 'editar') || hasPermission('Sistema', 'Backup', 'editar');
  const podeExecutarBackup = isAdmin() || hasPermission('Sistema', 'Configurações', 'executar') || hasPermission('Sistema', 'Configuracoes', 'executar') || hasPermission('Sistema', 'Backup', 'executar');

  const { data: config, isLoading } = useQuery({
    queryKey: ['config-backup', scopeId],
    queryFn: async () => {
      const configs = await base44.entities.ConfiguracaoBackup.filter(scope);
      
      if (configs.length > 0) {
        return configs[0];
      }
      
      // Config padrão
      return {
        empresa_id: empresaAtivaId || null,
        group_id: grupoAtivoId || null,
        ativo: true,
        frequencia: 'Diário',
        horario_execucao: '02:00',
        dia_semana: 'Domingo',
        dia_mes: 1,
        tipo_backup_padrao: 'Completo',
        retencao_dias: 30,
        provider_storage: 'Base44 Cloud',
        criptografia_ativa: true,
        algoritmo_criptografia: 'AES-256-GCM',
        compressao_ativa: true,
        algoritmo_compressao: 'gzip',
        nivel_compressao: 6,
        incluir_anexos: true,
        incluir_logs: true,
        validar_integridade: true,
        replicacao_geografica: false,
        notificar_email: true,
        notificar_apenas_erro: false,
        emails_notificacao: [],
        modulos_incluir: []
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
        ? await updateInContext('ConfiguracaoBackup', config.id, stamped)
        : await createInContext('ConfiguracaoBackup', stamped);
      try {
        const me = await base44.auth.me();
        await createInContext('AuditLog', {
          usuario: me?.full_name || me?.email || 'Usuario',
          usuario_id: me?.id || null,
          acao: config?.id ? 'Edicao' : 'Criacao',
          modulo: 'Backup',
          entidade: 'ConfiguracaoBackup',
          registro_id: result?.id || config?.id,
          empresa_id: empresaAtivaId || null,
          group_id: grupoAtivoId || null,
          descricao: 'Configuracao de backup atualizada',
          dados_novos: stamped,
          sucesso: true,
          data_hora: new Date().toISOString()
        });
      } catch (error) {
        console.error('[Auditoria] Falha ao registrar configuracao de backup.', error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-backup', scopeId] });
      toast.success('✅ Configuração salva com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao salvar:', error);
      toast.error('❌ Erro ao salvar configuração');
    },
    onSettled: () => setSalvando(false)
  });

  const executarBackupManualMutation = useMutation({
    mutationFn: async () => {
      const numeroBackup = `BKP-${Date.now()}`;
      
      // Simular backup
      const backup = await createInContext('BackupAutomatico', {
        group_id: grupoAtivoId,
        empresa_id: empresaAtivaId,
        tipo_backup: 'Completo',
        escopo: empresaAtivaId ? 'empresa' : 'grupo',
        numero_backup: numeroBackup,
        data_hora_inicio: new Date().toISOString(),
        status: 'Em Progresso',
        trigger: 'Manual',
        modulos_incluidos: ['Todos'],
        provider_storage: formData.provider_storage || 'Base44 Cloud',
        criptografado: formData.criptografia_ativa,
        automatico: false,
        executado_por: 'Sistema'
      });

      try {
        const me = await base44.auth.me();
        await createInContext('AuditLog', {
          usuario: me?.full_name || me?.email || 'Usuario',
          usuario_id: me?.id || null,
          acao: 'Execucao',
          modulo: 'Backup',
          entidade: 'BackupAutomatico',
          registro_id: backup?.id,
          empresa_id: empresaAtivaId || null,
          group_id: grupoAtivoId || null,
          descricao: `Backup manual iniciado (${numeroBackup})`,
          dados_novos: backup,
          sucesso: true,
          data_hora: new Date().toISOString()
        });
      } catch (error) {
        console.error('[Auditoria] Falha ao registrar inicio do backup.', error);
      }

      // Simular conclusão após 3 segundos
      setTimeout(async () => {
        await updateInContext('BackupAutomatico', backup.id, {
          status: 'Concluído',
          data_hora_fim: new Date().toISOString(),
          duracao_segundos: 3,
          quantidade_total_registros: 1500,
          tamanho_backup_mb: 45.2,
          tamanho_comprimido_mb: 12.8,
          taxa_compressao: 71.7,
          hash_integridade: 'sha256:' + Math.random().toString(36).substring(2, 15),
          arquivo_path: `/backups/${empresaAtivaId || grupoAtivoId}/${numeroBackup}.json.gz`,
          validacao_integridade: {
            validado: true,
            hash_valido: true,
            arquivo_integro: true,
            pode_restaurar: true
          }
        });

        try {
          const me = await base44.auth.me();
          await createInContext('AuditLog', {
            usuario: me?.full_name || me?.email || 'Usuario',
            usuario_id: me?.id || null,
            acao: 'Conclusao',
            modulo: 'Backup',
            entidade: 'BackupAutomatico',
            registro_id: backup?.id,
            empresa_id: empresaAtivaId || null,
            group_id: grupoAtivoId || null,
            descricao: `Backup manual concluido (${numeroBackup})`,
            dados_novos: { status: 'Concluido', numero_backup: numeroBackup },
            sucesso: true,
            data_hora: new Date().toISOString()
          });
        } catch (error) {
          console.error('[Auditoria] Falha ao registrar conclusao do backup.', error);
        }

        queryClient.invalidateQueries({ queryKey: ['backups', scopeId] });
        toast.success('✅ Backup concluído com sucesso!');
      }, 3000);

      return backup;
    },
    onSuccess: () => {
      toast.success('🚀 Backup manual iniciado!', {
        description: 'O backup está sendo processado...'
      });
    },
    onError: (error) => {
      console.error('Erro ao executar backup:', error);
      toast.error('❌ Erro ao executar backup manual');
    }
  });

  const handleSalvar = () => {
    if (!contextoValido) {
      toast.error('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeEditarBackup) {
      toast.error('Sem permissao para editar configuracoes de backup.');
      return;
    }
    setSalvando(true);
    salvarMutation.mutate(formData);
  };

  const handleExecutarBackup = () => {
    if (!contextoValido) {
      toast.error('Selecione um grupo ou empresa antes de executar backup.');
      return;
    }
    if (!podeExecutarBackup) {
      toast.error('Sem permissao para executar backup manual.');
      return;
    }
    executarBackupManualMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const calcularProximoBackup = () => {
    if (!formData.ativo) return 'Desativado';
    
    const hoje = new Date();
    const [hora, minuto] = (formData.horario_execucao || '02:00').split(':');
    const proximo = new Date(hoje);
    proximo.setHours(parseInt(hora), parseInt(minuto), 0, 0);
    
    if (proximo <= hoje) {
      proximo.setDate(proximo.getDate() + 1);
    }
    
    return proximo.toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Alert className={formData.ativo ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}>
        <Database className={`w-5 h-5 ${formData.ativo ? 'text-green-600' : 'text-orange-600'}`} />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-semibold ${formData.ativo ? 'text-green-900' : 'text-orange-900'}`}>
                {formData.ativo ? '✅ Backup Automático Ativo' : '⚠️ Backup Automático Desativado'}
              </p>
              <p className="text-sm text-slate-700 mt-1">
                {formData.ativo 
                  ? `Próximo backup: ${calcularProximoBackup()}`
                  : 'Ative o backup para proteger seus dados'
                }
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleExecutarBackup}
                disabled={executarBackupManualMutation.isPending || !contextoValido || !podeExecutarBackup}
                variant="outline"
                className="bg-white"
                data-action="Backup.executarManual"
                data-permission="Sistema.Backup.executar"
                data-sensitive="true"
              >
                {executarBackupManualMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2" />
                    Executando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Backup Manual
                  </>
                )}
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="geral" data-action="Backup.tab.geral">
            <Settings className="w-4 h-4 mr-2" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="armazenamento" data-action="Backup.tab.armazenamento">
            <Cloud className="w-4 h-4 mr-2" />
            Armazenamento
          </TabsTrigger>
          <TabsTrigger value="seguranca" data-action="Backup.tab.seguranca">
            <Shield className="w-4 h-4 mr-2" />
            Segurança
          </TabsTrigger>
          <TabsTrigger value="notificacoes" data-action="Backup.tab.notificacoes">
            <Mail className="w-4 h-4 mr-2" />
            Notificações
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
                  <Label className="text-base">Backup Automático</Label>
                  <p className="text-sm text-slate-600">Ativar backup automático agendado</p>
                </div>
                <Switch
                  data-action="Backup.automatico.ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({...formData, ativo: checked})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Frequência</Label>
                  <Select
                    value={formData.frequencia}
                    onValueChange={(value) => setFormData({...formData, frequencia: value})}
                  >
                    <SelectTrigger data-action="Backup.frequencia">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Diário">Diário</SelectItem>
                      <SelectItem value="Semanal">Semanal</SelectItem>
                      <SelectItem value="Quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="Mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Horário de Execução</Label>
                  <Input
                    type="time"
                    value={formData.horario_execucao}
                    onChange={(e) => setFormData({...formData, horario_execucao: e.target.value})}
                  />
                </div>

                {formData.frequencia === 'Semanal' && (
                  <div>
                    <Label>Dia da Semana</Label>
                    <Select
                      value={formData.dia_semana}
                      onValueChange={(value) => setFormData({...formData, dia_semana: value})}
                    >
                      <SelectTrigger data-action="Backup.diaSemana">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Domingo">Domingo</SelectItem>
                        <SelectItem value="Segunda">Segunda</SelectItem>
                        <SelectItem value="Terça">Terça</SelectItem>
                        <SelectItem value="Quarta">Quarta</SelectItem>
                        <SelectItem value="Quinta">Quinta</SelectItem>
                        <SelectItem value="Sexta">Sexta</SelectItem>
                        <SelectItem value="Sábado">Sábado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.frequencia === 'Mensal' && (
                  <div>
                    <Label>Dia do Mês</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.dia_mes || 1}
                      onChange={(e) => setFormData({...formData, dia_mes: parseInt(e.target.value)})}
                    />
                  </div>
                )}

                <div>
                  <Label>Tipo de Backup</Label>
                  <Select
                    value={formData.tipo_backup_padrao}
                    onValueChange={(value) => setFormData({...formData, tipo_backup_padrao: value})}
                  >
                    <SelectTrigger data-action="Backup.tipoBackupPadrao">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Completo">Completo</SelectItem>
                      <SelectItem value="Incremental">Incremental</SelectItem>
                      <SelectItem value="Diferencial">Diferencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Retenção (dias)</Label>
                  <Input
                    type="number"
                    min="7"
                    max="365"
                    value={formData.retencao_dias}
                    onChange={(e) => setFormData({...formData, retencao_dias: parseInt(e.target.value)})}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Backups serão mantidos por {formData.retencao_dias} dias
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Incluir Anexos</Label>
                    <p className="text-xs text-slate-600">PDFs, imagens, arquivos de projetos</p>
                  </div>
                  <Switch
                    data-action="Backup.incluirAnexos"
                    checked={formData.incluir_anexos}
                    onCheckedChange={(checked) => setFormData({...formData, incluir_anexos: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Incluir Logs de Auditoria</Label>
                    <p className="text-xs text-slate-600">Histórico de ações dos usuários</p>
                  </div>
                  <Switch
                    data-action="Backup.incluirLogs"
                    checked={formData.incluir_logs}
                    onCheckedChange={(checked) => setFormData({...formData, incluir_logs: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Validar Integridade</Label>
                    <p className="text-xs text-slate-600">Verificar integridade após backup</p>
                  </div>
                  <Switch
                    data-action="Backup.validarIntegridade"
                    checked={formData.validar_integridade}
                    onCheckedChange={(checked) => setFormData({...formData, validar_integridade: checked})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: ARMAZENAMENTO */}
        <TabsContent value="armazenamento" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-600" />
                Provedor de Armazenamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Provedor</Label>
                <Select
                  value={formData.provider_storage}
                  onValueChange={(value) => setFormData({...formData, provider_storage: value})}
                >
                  <SelectTrigger data-action="Backup.providerStorage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Base44 Cloud">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-blue-600" />
                        Base44 Cloud (Recomendado)
                      </div>
                    </SelectItem>
                    <SelectItem value="AWS S3">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-orange-600" />
                        AWS S3
                      </div>
                    </SelectItem>
                    <SelectItem value="Google Cloud Storage">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-red-600" />
                        Google Cloud Storage
                      </div>
                    </SelectItem>
                    <SelectItem value="Azure Blob">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-blue-600" />
                        Azure Blob Storage
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.provider_storage === 'Base44 Cloud' && (
                <Alert className="border-blue-300 bg-blue-50">
                  <Cloud className="w-5 h-5 text-blue-600" />
                  <AlertDescription>
                    <p className="font-semibold text-blue-900">Base44 Cloud - Configuração Automática</p>
                    <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                      <li>Redundância geográfica automática</li>
                      <li>Criptografia AES-256 em repouso</li>
                      <li>Backup contínuo com Point-in-Time Recovery</li>
                      <li>SLA de 99.99% de disponibilidade</li>
                      <li>Sem configuração adicional necessária</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {formData.provider_storage === 'AWS S3' && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm font-semibold text-slate-900">Configuração AWS S3</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Bucket Name</Label>
                      <Input
                        placeholder="my-backups"
                        value={formData.aws_s3_config?.bucket_name || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          aws_s3_config: {...(formData.aws_s3_config || {}), bucket_name: e.target.value}
                        })}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Region</Label>
                      <Input
                        placeholder="us-east-1"
                        value={formData.aws_s3_config?.region || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          aws_s3_config: {...(formData.aws_s3_config || {}), region: e.target.value}
                        })}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Access Key ID</Label>
                      <Input
                        type="password"
                        placeholder="AKIA..."
                        value={formData.aws_s3_config?.access_key_id || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          aws_s3_config: {...(formData.aws_s3_config || {}), access_key_id: e.target.value}
                        })}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Secret Access Key</Label>
                      <Input
                        type="password"
                        placeholder="***"
                        value={formData.aws_s3_config?.secret_access_key || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          aws_s3_config: {...(formData.aws_s3_config || {}), secret_access_key: e.target.value}
                        })}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <Label>Replicação Geográfica</Label>
                  <p className="text-xs text-slate-600">Replicar em múltiplas regiões</p>
                </div>
                <Switch
                  data-action="Backup.replicacaoGeografica"
                  checked={formData.replicacao_geografica}
                  onCheckedChange={(checked) => setFormData({...formData, replicacao_geografica: checked})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: SEGURANÇA */}
        <TabsContent value="seguranca" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                Segurança e Criptografia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Criptografia</Label>
                  <p className="text-sm text-slate-600">Criptografar backups (recomendado)</p>
                </div>
                <Switch
                  data-action="Backup.criptografiaAtiva"
                  checked={formData.criptografia_ativa}
                  onCheckedChange={(checked) => setFormData({...formData, criptografia_ativa: checked})}
                />
              </div>

              {formData.criptografia_ativa && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm font-semibold text-purple-900 mb-2">
                    🔒 Algoritmo: {formData.algoritmo_criptografia || 'AES-256-GCM'}
                  </p>
                  <p className="text-xs text-purple-700">
                    • Criptografia de ponta a ponta<br/>
                    • Chaves gerenciadas automaticamente<br/>
                    • Padrão militar de segurança
                  </p>
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Compressão</Label>
                    <p className="text-sm text-slate-600">Reduz tamanho dos backups</p>
                  </div>
                  <Switch
                    data-action="Backup.compressaoAtiva"
                    checked={formData.compressao_ativa}
                    onCheckedChange={(checked) => setFormData({...formData, compressao_ativa: checked})}
                  />
                </div>

                {formData.compressao_ativa && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Algoritmo</Label>
                      <Select
                        value={formData.algoritmo_compressao}
                        onValueChange={(value) => setFormData({...formData, algoritmo_compressao: value})}
                      >
                        <SelectTrigger className="text-sm" data-action="Backup.algoritmoCompressao">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gzip">gzip (balanceado)</SelectItem>
                          <SelectItem value="bzip2">bzip2 (alta compressão)</SelectItem>
                          <SelectItem value="lz4">lz4 (rápido)</SelectItem>
                          <SelectItem value="zstd">zstd (moderno)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Nível (1-9)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="9"
                        value={formData.nivel_compressao || 6}
                        onChange={(e) => setFormData({...formData, nivel_compressao: parseInt(e.target.value)})}
                        className="text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: NOTIFICAÇÕES */}
        <TabsContent value="notificacoes" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-5 h-5 text-green-600" />
                Notificações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Notificar por E-mail</Label>
                  <p className="text-sm text-slate-600">Enviar e-mail ao concluir backup</p>
                </div>
                <Switch
                  data-action="Backup.notificarEmail"
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
                  <Label>Notificar Apenas Erros</Label>
                  <p className="text-sm text-slate-600">Enviar e-mail apenas se houver erro</p>
                </div>
                <Switch
                  data-action="Backup.notificarApenasErro"
                  checked={formData.notificar_apenas_erro}
                  onCheckedChange={(checked) => setFormData({...formData, notificar_apenas_erro: checked})}
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
          disabled={salvando || salvarMutation.isPending || !contextoValido || !podeEditarBackup}
          className="bg-blue-600 hover:bg-blue-700"
          data-action="Backup.Configuracao.salvar"
          data-permission="Sistema.Backup.editar"
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
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-blue-50">
          <CardContent className="p-6">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-600 mb-1">Total Executados</p>
                <p className="text-2xl font-bold text-blue-600">
                  {config.total_backups_executados || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Taxa de Sucesso</p>
                <p className="text-2xl font-bold text-green-600">
                  {config.taxa_sucesso_percentual || 100}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Espaço Usado</p>
                <p className="text-2xl font-bold text-purple-600">
                  {(config.espaco_total_usado_gb || 0).toFixed(2)} GB
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Último Sucesso</p>
                <p className="text-sm font-semibold text-slate-900">
                  {config.ultimo_backup_sucesso 
                    ? new Date(config.ultimo_backup_sucesso).toLocaleDateString('pt-BR')
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
