import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, CheckCircle, RefreshCw, Eye, Users, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import { useUser } from '@/components/lib/UserContext';
import usePermissions from '@/components/lib/usePermissions';
import { toast } from 'sonner';
import {
  assertIaUiContext,
  buildSodConflictSuggestions,
  requireIaHumanConfirm,
  stampIaLogSugestao,
} from '@/components/lib/iaTransversalPolicy';

export default function IAGovernancaCompliance() {
  const [analisando, setAnalisando] = useState(false);
  const [resultadoAnalise, setResultadoAnalise] = useState(null);
  const queryClient = useQueryClient();
  const { contexto, empresaAtual, grupoAtual, empresasDoGrupo = [], filterInContext, createInContext, updateInContext, estaNoGrupo } = useContextoVisual();
  const { user } = useUser();
  const { isAdmin, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const scopeType = estaNoGrupo || contexto === 'grupo' ? 'grupo' : 'empresa';
  let hasValidScope = false;
  try {
    assertIaUiContext({ groupId, empresaId, scopeType });
    hasValidScope = true;
  } catch {
    hasValidScope = false;
  }
  const scopeKey = `${groupId || 'sem-grupo'}|${empresaId || 'sem-empresa'}|${scopeType}`;
  const scope = {
    ...(groupId ? { group_id: groupId } : {}),
    ...(scopeType !== 'grupo' && empresaId ? { empresa_id: empresaId } : {}),
  };
  const podeExecutar = isAdmin() || hasPermission('Sistema', 'Seguranca', 'editar') || hasPermission('Sistema', 'Segurança', 'editar');
  const normalizeEmpresaIds = (values = []) => (Array.isArray(values) ? values : [])
    .map((item) => (typeof item === 'string' ? item : item?.empresa_id || item?.id))
    .filter(Boolean);
  const usuarioNoEscopo = (usuario) => {
    const vinculadas = normalizeEmpresaIds(usuario?.empresas_vinculadas);
    const temMarcadorEscopo = Boolean(usuario?.group_id || usuario?.grupo_id || usuario?.grupo_atual_id || usuario?.empresa_id || usuario?.empresa_atual_id || vinculadas.length);
    if (!temMarcadorEscopo) return false;
    if (scopeType === 'grupo') {
      const empresasIds = empresasDoGrupo.map((empresa) => empresa.id);
      return usuario.group_id === groupId ||
        usuario.grupo_id === groupId ||
        usuario.grupo_atual_id === groupId ||
        vinculadas.some((id) => empresasIds.includes(id));
    }
    return usuario.empresa_id === empresaId ||
      usuario.empresa_atual_id === empresaId ||
      vinculadas.includes(empresaId);
  };

  const auditarIA = async ({ acao, descricao, dadosNovos = null }) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        empresa_id: scope.empresa_id || null,
        group_id: scope.group_id || null,
        acao,
        modulo: 'Seguranca',
        entidade: 'IA_Governanca',
        descricao,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.error('Falha ao auditar IA de governanca:', error);
      throw error;
    }
  };

  const { data: perfis = [] } = useQuery({
    queryKey: ['perfisAcesso', scopeKey],
    queryFn: () => filterInContext('PerfilAcesso', {}, '-updated_date', 500),
    enabled: hasValidScope,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios', scopeKey],
    queryFn: async () => {
      const rows = await filterInContext('User', {}, '-updated_date', 500).catch(async () => {
        const all = await base44.entities.User.list();
        return all.filter(usuarioNoEscopo);
      });
      return (rows || []).filter(usuarioNoEscopo);
    },
    enabled: hasValidScope,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['logsIA', 'governanca', scopeKey],
    queryFn: () => filterInContext('LogsIA', { tipo_ia: 'IA_Governanca' }, '-created_date', 50),
    enabled: hasValidScope,
  });

  const analisarGovernancaMutation = useMutation({
    mutationFn: async () => {
      assertIaUiContext({ groupId, empresaId, scopeType });
      if (!podeExecutar) {
        await auditarIA({
          acao: 'Bloqueio por permissao',
          descricao: 'Tentativa de executar IA de governanca sem permissao.',
          dadosNovos: scope
        });
        throw new Error('Sem permissao para executar analise de governanca.');
      }
      setAnalisando(true);

      const sugestao = buildSodConflictSuggestions({ perfis, usuarios });

      await createInContext('LogsIA', stampIaLogSugestao({
        tipo_ia: 'IA_Governanca',
        contexto_execucao: 'Sistema',
        entidade_relacionada: 'PerfilAcesso',
        acao_sugerida: `Analise SoD: ${sugestao.total_conflitos} conflito(s) sugeridos (sem gravacao automatica)`,
        confianca_ia: 95,
        ...scope,
        dados_entrada: { perfis: perfis.length, usuarios: usuarios.length },
        dados_saida: sugestao,
      }));

      await auditarIA({
        acao: 'Analise IA Governanca',
        descricao: 'Analise de governanca gerou sugestoes sem alterar PerfilAcesso.',
        dadosNovos: { ...sugestao, ...scope }
      });

      setAnalisando(false);
      return sugestao;
    },
    onSuccess: (sugestao) => {
      setResultadoAnalise(sugestao);
      queryClient.invalidateQueries({ queryKey: ['logsIA', 'governanca', scopeKey] });
      toast.success(`IA sugeriu ${sugestao.total_conflitos} conflito(s). Confirme para gravar nos perfis.`);
    },
    onError: (error) => {
      setAnalisando(false);
      toast.error(error.message || 'Erro ao executar analise de governanca.');
    }
  });

  const gravarConflitosMutation = useMutation({
    mutationFn: async () => {
      assertIaUiContext({ groupId, empresaId, scopeType });
      if (!podeExecutar) throw new Error('Sem permissao para gravar conflitos SoD.');
      const lista = resultadoAnalise?.sugestoes_perfis || [];
      if (!lista.length) throw new Error('Nenhuma sugestao para gravar.');
      if (!requireIaHumanConfirm(`Gravar conflitos SoD em ${lista.length} perfil(is)? Isso altera PerfilAcesso.`)) {
        throw new Error('Gravacao cancelada.');
      }
      for (const item of lista) {
        await updateInContext('PerfilAcesso', item.perfil_id, {
          conflitos_sod_detectados: item.conflitos.map((c) => ({
            ...c,
            data_deteccao: new Date().toISOString(),
          })),
          ...scope,
        });
        await createInContext('LogsIA', stampIaLogSugestao({
          tipo_ia: 'IA_Governanca',
          contexto_execucao: 'Sistema',
          entidade_relacionada: 'PerfilAcesso',
          entidade_id: item.perfil_id,
          acao_sugerida: `Conflitos SoD gravados no perfil "${item.nome_perfil}" apos confirmacao`,
          confianca_ia: 95,
          ...scope,
          dados_saida: { conflitos: item.conflitos },
        }));
      }
      await auditarIA({
        acao: 'Gravar SoD',
        descricao: 'Conflitos SoD gravados apos confirmacao humana.',
        dadosNovos: { perfis: lista.length },
      });
      return lista.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ['perfisAcesso', scopeKey] });
      queryClient.invalidateQueries({ queryKey: ['logsIA', 'governanca', scopeKey] });
      toast.success(`${n} perfil(is) atualizado(s).`);
    },
    onError: (error) => toast.error(error.message || 'Falha ao gravar conflitos.'),
  });

  const conflitosDetectados = (resultadoAnalise?.total_conflitos
    ?? perfis.reduce((acc, p) => acc + (p.conflitos_sod_detectados?.length || 0), 0));

  const conflitosGravidade = (() => {
    const acc = {};
    const fonte = resultadoAnalise?.sugestoes_perfis
      ? resultadoAnalise.sugestoes_perfis.flatMap((p) => p.conflitos)
      : perfis.flatMap((p) => p.conflitos_sod_detectados || []);
    fonte.forEach((c) => {
      acc[c.severidade] = (acc[c.severidade] || 0) + 1;
    });
    return acc;
  })();

  return (
    <div className="w-full h-full p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-600" />
            IA de Governança e Compliance
          </h2>
          <p className="text-slate-600 mt-1">Detecção automática de riscos de SoD e padrões suspeitos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => analisarGovernancaMutation.mutate()}
            disabled={analisando || !hasValidScope || !podeExecutar}
            className="bg-blue-600 hover:bg-blue-700"
            data-action="IAGovernanca.executarAnalise"
            data-permission="Sistema.Seguranca.editar"
            data-context-required="group-and-company"
            data-sensitive="true"
          >
            {analisando ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Executar Análise (sugestão)
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => gravarConflitosMutation.mutate()}
            disabled={!resultadoAnalise?.sugestoes_perfis?.length || gravarConflitosMutation.isPending || !podeExecutar}
            data-action="IAGovernanca.gravarSoD"
            data-permission="Sistema.Seguranca.editar"
            data-sensitive="true"
          >
            Gravar conflitos (confirmação)
          </Button>
        </div>
      </div>

      {/* Resumo de Riscos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total de Conflitos</p>
                <p className="text-2xl font-bold text-slate-900">{conflitosDetectados}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Críticos</p>
                <p className="text-2xl font-bold text-red-600">{conflitosGravidade['Crítica'] || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Altos</p>
                <p className="text-2xl font-bold text-orange-600">{conflitosGravidade['Alta'] || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Médios</p>
                <p className="text-2xl font-bold text-yellow-600">{conflitosGravidade['Média'] || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Conflitos por Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-red-500" />
            Conflitos de Segregação de Funções (SoD) Detectados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {resultadoAnalise?.sugestoes_perfis?.length > 0 ? (
            resultadoAnalise.sugestoes_perfis.map((item) => (
              <div key={item.perfil_id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{item.nome_perfil}</h3>
                  <Badge className="bg-orange-100 text-orange-800">
                    {item.conflitos.length} conflito(s) sugerido(s)
                  </Badge>
                </div>
                <div className="space-y-2">
                  {item.conflitos.map((conflito, idx) => (
                    <Alert key={idx} className="border-orange-200 bg-orange-50">
                      <AlertDescription>
                        <p className="font-medium text-sm">{conflito.tipo_conflito}</p>
                        <p className="text-xs text-slate-600 mt-1">{conflito.descricao}</p>
                        <Badge className="mt-2" variant="outline">{conflito.severidade}</Badge>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            ))
          ) : perfis.filter(p => p.conflitos_sod_detectados?.length > 0).length > 0 ? (
            perfis.filter(p => p.conflitos_sod_detectados?.length > 0).map(perfil => (
              <div key={perfil.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{perfil.nome_perfil}</h3>
                    <p className="text-sm text-slate-600">{perfil.descricao}</p>
                  </div>
                  <Badge variant="outline" className="bg-red-50 text-red-700">
                    {perfil.conflitos_sod_detectados.length} conflito(s)
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  {perfil.conflitos_sod_detectados.map((conflito, idx) => (
                    <Alert key={idx} className={`
                      ${conflito.severidade === 'Crítica' ? 'border-red-300 bg-red-50' : ''}
                      ${conflito.severidade === 'Alta' ? 'border-orange-300 bg-orange-50' : ''}
                      ${conflito.severidade === 'Média' ? 'border-yellow-300 bg-yellow-50' : ''}
                    `}>
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-sm">{conflito.tipo_conflito}</p>
                            <p className="text-xs text-slate-600 mt-1">{conflito.descricao}</p>
                          </div>
                          <Badge className={`
                            ${conflito.severidade === 'Crítica' ? 'bg-red-600' : ''}
                            ${conflito.severidade === 'Alta' ? 'bg-orange-600' : ''}
                            ${conflito.severidade === 'Média' ? 'bg-yellow-600' : ''}
                          `}>
                            {conflito.severidade}
                          </Badge>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>Nenhum conflito de SoD detectado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-500" />
            Logs de Análise Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {logs.slice(0, 10).map(log => (
              <div key={log.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{log.acao_sugerida}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(log.created_date).toLocaleString('pt-BR')} • Confiança: {log.confianca_ia}%
                  </p>
                </div>
                <Badge className={`
                          ${log.resultado === 'Aceito' ? 'bg-green-100 text-green-800' : ''}
                          ${log.resultado === 'Sugestao' || log.resultado === 'Automático' ? 'bg-blue-100 text-blue-800' : ''}
                          ${log.resultado === 'Rejeitado' ? 'bg-red-100 text-red-800' : ''}
                `}>
                  {log.resultado}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
