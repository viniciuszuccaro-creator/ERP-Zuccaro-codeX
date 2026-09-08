import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Database, 
  Download, 
  Eye, 
  CheckCircle2, 
  XCircle,
  Clock,
  HardDrive,
  Shield,
  RefreshCw,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useUser } from '@/components/lib/UserContext';
import { isStatusBackupConcluido } from '@/components/lib/viradaProducaoPolicy';

/**
 * Histórico de Backups
 */
export default function HistoricoBackups({ empresaId, grupoId }) {
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [backupSelecionado, setBackupSelecionado] = useState(null);
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const grupoAtivoId = grupoId || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaAtivaId = empresaId || empresaAtual?.id || null;
  const scopeId = empresaAtivaId || grupoAtivoId || 'sem-contexto';
  const contextoValido = scopeId !== 'sem-contexto';
  const canRestaurar = hasPermission('Sistema', 'Backup', 'restaurar') || hasPermission('Sistema', 'Backup', 'executar') || hasPermission('Seguranca', 'Backup', 'restaurar');
  const canExpirar = hasPermission('Sistema', 'Backup', 'excluir') || hasPermission('Sistema', 'Backup', 'editar') || hasPermission('Seguranca', 'Backup', 'excluir');

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['backups', scopeId],
    queryFn: async () => {
      const filter = empresaAtivaId 
        ? { empresa_id: empresaAtivaId }
        : { group_id: grupoAtivoId };
      
      const result = await base44.entities.BackupAutomatico.filter(
        filter,
        '-data_hora_inicio',
        50
      );
      return result;
    },
    enabled: contextoValido,
  });

  const auditBackup = async ({ acao, sucesso = true, motivo = null, detalhes = {}, registroId = null }) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario',
        usuario_id: user?.id || null,
        acao,
        modulo: 'Backup',
        entidade: 'BackupAutomatico',
        registro_id: registroId,
        empresa_id: empresaAtivaId || null,
        group_id: grupoAtivoId || null,
        descricao: motivo || acao,
        dados_novos: detalhes,
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Auditoria] Falha ao registrar acao de backup.', error);
      throw new Error('Auditoria obrigatoria falhou para operacao de backup.');
    }
  };

  const restaurarMutation = useMutation({
    mutationFn: async (backup) => {
      if (!contextoValido) {
        throw new Error('Selecione um grupo ou empresa antes de restaurar backup.');
      }
      if (!canRestaurar) {
        await auditBackup({
          acao: 'Backup.restaurar_bloqueado',
          sucesso: false,
          motivo: 'permissao_negada',
          registroId: backup?.id,
        });
        throw new Error('Sem permissao para restaurar backup.');
      }
      if (!isStatusBackupConcluido(backup?.status)) {
        throw new Error('Somente backup concluido pode ser restaurado.');
      }

      toast.success('🔄 Iniciando restauração...', {
        description: 'Este processo pode levar alguns minutos'
      });

      const result = await base44.entities.BackupAutomatico.restore(backup.id, {
        group_id: grupoAtivoId,
        empresa_id: empresaAtivaId,
      });

      await auditBackup({
        acao: 'Backup.restaurar',
        motivo: `Restauracao aplicada para backup ${backup.numero_backup || backup.id}`,
        detalhes: { summary: result?.summary, numero_backup: backup.numero_backup },
        registroId: backup.id,
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups', scopeId] });
      toast.success('✅ Restauração concluída!', {
        description: 'Dados restaurados a partir do snapshot do backup'
      });
      setDetalhesOpen(false);
    },
    onError: (error) => {
      console.error('Erro ao restaurar:', error);
      toast.error(error?.message || '❌ Erro ao restaurar backup');
    }
  });

  const excluirMutation = useMutation({
    mutationFn: async (backupId) => {
      if (!contextoValido) {
        throw new Error('Selecione um grupo ou empresa antes de expirar backup.');
      }
      if (!canExpirar) {
        await auditBackup({
          acao: 'Backup.expirar_bloqueado',
          sucesso: false,
          motivo: 'permissao_negada',
          registroId: backupId,
        });
        throw new Error('Sem permissao para expirar backup.');
      }

      await updateInContext('BackupAutomatico', backupId, {
        status: 'Expirado'
      });
      await auditBackup({
        acao: 'Backup.expirar',
        motivo: 'Backup marcado como expirado',
        registroId: backupId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups', scopeId] });
      toast.success('✅ Backup excluído');
    },
    onError: (error) => {
      console.error('Erro ao expirar backup:', error);
      toast.error(error.message || 'Erro ao expirar backup');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const backupsAtivos = backups.filter(b => b.status !== 'Expirado' && b.status !== 'Cancelado');
  const espacoTotal = backupsAtivos.reduce((sum, b) => sum + (b.tamanho_comprimido_mb || 0), 0) / 1024;
  const formatarDataBackup = (valor) => {
    if (!valor) return '-';
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? '-' : data.toLocaleString('pt-BR');
  };
  const formatarDataBackupCurta = (valor) => {
    if (!valor) return 'Nunca';
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? 'Nunca' : data.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-xs text-blue-700">Total de Backups</p>
                <p className="text-2xl font-bold text-blue-900">{backupsAtivos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-xs text-green-700">Concluídos</p>
                <p className="text-2xl font-bold text-green-900">
                  {backups.filter(b => isStatusBackupConcluido(b.status)).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <HardDrive className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-xs text-purple-700">Espaço Usado</p>
                <p className="text-2xl font-bold text-purple-900">
                  {espacoTotal.toFixed(2)} GB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-xs text-orange-700">Último Backup</p>
                <p className="text-sm font-semibold text-orange-900">
                  {backupsAtivos.length > 0 
                    ? formatarDataBackupCurta(backupsAtivos[0].data_hora_inicio)
                    : 'Nunca'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Histórico de Backups
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Data/Hora</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Registros</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backupsAtivos.map((backup) => (
                <TableRow key={backup.id} className="hover:bg-slate-50">
                  <TableCell className="text-sm">
                    {formatarDataBackup(backup.data_hora_inicio)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {backup.numero_backup}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {backup.tipo_backup}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {(backup.quantidade_total_registros || 0).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-semibold">
                        {(backup.tamanho_comprimido_mb || 0).toFixed(1)} MB
                      </p>
                      {backup.taxa_compressao && (
                        <p className="text-xs text-green-600">
                          -{backup.taxa_compressao.toFixed(0)}%
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {backup.duracao_segundos 
                      ? `${backup.duracao_segundos}s`
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      isStatusBackupConcluido(backup.status) ? 'bg-green-100 text-green-700' :
                      backup.status === 'Em Progresso' ? 'bg-blue-100 text-blue-700' :
                      backup.status === 'Erro' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }>
                      {backup.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setBackupSelecionado(backup);
                          setDetalhesOpen(true);
                        }}
                        title="Ver detalhes"
                        data-action="Backup.Historico.verDetalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {isStatusBackupConcluido(backup.status) && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Confirma restauração deste backup? Esta ação não pode ser desfeita.')) {
                                restaurarMutation.mutate(backup);
                              }
                            }}
                            title="Restaurar"
                            className="text-blue-600 hover:text-blue-700"
                            data-action="Backup.Historico.restaurar"
                            disabled={restaurarMutation.isPending || !contextoValido || !canRestaurar}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Confirma exclusão deste backup?')) {
                                excluirMutation.mutate(backup.id);
                              }
                            }}
                            title="Excluir"
                            className="text-red-600 hover:text-red-700"
                            data-action="Backup.Historico.expirar"
                            disabled={excluirMutation.isPending || !contextoValido || !canExpirar}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {backupsAtivos.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Database className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhum backup realizado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Detalhes */}
      <Dialog open={detalhesOpen} onOpenChange={setDetalhesOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              Detalhes do Backup - {backupSelecionado?.numero_backup}
            </DialogTitle>
          </DialogHeader>

          {backupSelecionado && (
            <div className="space-y-4">
              {/* Status */}
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate-600">Status</p>
                      <Badge className={
                        backupSelecionado.status === 'Concluído' ? 'bg-green-600' :
                        backupSelecionado.status === 'Erro' ? 'bg-red-600' :
                        'bg-blue-600'
                      }>
                        {backupSelecionado.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Tipo</p>
                      <p className="font-semibold text-sm">{backupSelecionado.tipo_backup}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Trigger</p>
                      <p className="font-semibold text-sm">{backupSelecionado.trigger}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Duração</p>
                      <p className="font-semibold text-sm">{backupSelecionado.duracao_segundos}s</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dados do Backup */}
              <Card>
                <CardHeader className="bg-slate-50">
                  <p className="font-semibold text-sm">Dados do Backup</p>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-600">Total de Registros</p>
                      <p className="text-lg font-bold text-blue-600">
                        {(backupSelecionado.quantidade_total_registros || 0).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Tamanho Original</p>
                      <p className="text-lg font-bold text-purple-600">
                        {(backupSelecionado.tamanho_backup_mb || 0).toFixed(2)} MB
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Tamanho Comprimido</p>
                      <p className="text-lg font-bold text-green-600">
                        {(backupSelecionado.tamanho_comprimido_mb || 0).toFixed(2)} MB
                      </p>
                      {backupSelecionado.taxa_compressao && (
                        <p className="text-xs text-green-600">
                          -{backupSelecionado.taxa_compressao.toFixed(0)}% economia
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Formato</p>
                      <Badge variant="outline" className="text-xs">
                        {backupSelecionado.formato_arquivo || 'JSON.gz'}
                      </Badge>
                    </div>
                  </div>

                  {backupSelecionado.provider_storage && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-slate-600 mb-1">Armazenamento</p>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-purple-600" />
                        <p className="font-semibold text-sm">{backupSelecionado.provider_storage}</p>
                        {backupSelecionado.criptografado && (
                          <Badge className="bg-purple-600 text-xs">Criptografado</Badge>
                        )}
                      </div>
                      {backupSelecionado.arquivo_path && (
                        <p className="text-xs text-slate-500 mt-1 font-mono">
                          {backupSelecionado.arquivo_path}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Validação de Integridade */}
              {backupSelecionado.validacao_integridade && (
                <Card>
                  <CardHeader className="bg-green-50 border-b">
                    <p className="font-semibold text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      Validação de Integridade
                    </p>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        {backupSelecionado.validacao_integridade.hash_valido ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span>Hash Válido</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {backupSelecionado.validacao_integridade.arquivo_integro ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span>Arquivo Íntegro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {backupSelecionado.validacao_integridade.pode_restaurar ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span>Pode Restaurar</span>
                      </div>
                    </div>

                    {backupSelecionado.hash_integridade && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-slate-600 mb-1">Hash SHA-256</p>
                        <p className="text-xs font-mono bg-slate-100 p-2 rounded">
                          {backupSelecionado.hash_integridade}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Entidades Incluídas */}
              {backupSelecionado.entidades_backup && backupSelecionado.entidades_backup.length > 0 && (
                <Card>
                  <CardHeader className="bg-slate-50 border-b">
                    <p className="font-semibold text-sm">Entidades Incluídas</p>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {backupSelecionado.entidades_backup.slice(0, 10).map((ent, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                          <span className="text-slate-700">{ent.entidade}</span>
                          <Badge variant="outline" className="text-xs">
                            {ent.quantidade_registros} registros
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Histórico de Restaurações */}
              {backupSelecionado.restauracoes && backupSelecionado.restauracoes.length > 0 && (
                <Card>
                  <CardHeader className="bg-blue-50 border-b">
                    <p className="font-semibold text-sm flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-blue-600" />
                      Histórico de Restaurações
                    </p>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {backupSelecionado.restauracoes.map((rest, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded text-sm">
                          <div>
                            <p className="font-medium">
                              {rest.tipo_restauracao}
                              {rest.sucesso ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600 inline ml-2" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-600 inline ml-2" />
                              )}
                            </p>
                            <p className="text-xs text-slate-600">
                              {formatarDataBackup(rest.data_hora)} • {rest.usuario}
                            </p>
                            {rest.observacoes && (
                              <p className="text-xs text-slate-500 mt-1">{rest.observacoes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Ações */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                {isStatusBackupConcluido(backupSelecionado.status) && (
                  <Button
                    onClick={() => {
                      if (confirm('⚠️ ATENÇÃO!\n\nA restauração irá substituir TODOS os dados atuais pelos dados deste backup.\n\nEsta ação NÃO pode ser desfeita.\n\nTem certeza que deseja continuar?')) {
                        restaurarMutation.mutate(backupSelecionado);
                      }
                    }}
                    disabled={restaurarMutation.isPending || !contextoValido || !canRestaurar}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {restaurarMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Restaurando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Restaurar Backup
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
