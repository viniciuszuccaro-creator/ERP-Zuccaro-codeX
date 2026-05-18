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

export default function IAGovernancaCompliance() {
  const [analisando, setAnalisando] = useState(false);
  const queryClient = useQueryClient();
  const { contexto, empresaAtual, grupoAtual, empresasDoGrupo = [], filterInContext } = useContextoVisual();
  const { user } = useUser();
  const { isAdmin, hasPermission } = usePermissions();
  const grupoAtivoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem('group_atual_id'); } catch { return null; }
  })();
  const empresaAtivaId = contexto === 'grupo' ? null : empresaAtual?.id;
  const hasValidScope = !!(empresaAtivaId || grupoAtivoId);
  const scopeKey = empresaAtivaId || grupoAtivoId || 'sem-contexto';
  const scope = {
    ...(grupoAtivoId ? { group_id: grupoAtivoId } : {}),
    ...(empresaAtivaId ? { empresa_id: empresaAtivaId } : {}),
  };
  const podeExecutar = isAdmin() || hasPermission('Sistema', 'Seguranca', 'editar') || hasPermission('Sistema', 'Segurança', 'editar');
  const normalizeEmpresaIds = (values = []) => (Array.isArray(values) ? values : [])
    .map((item) => (typeof item === 'string' ? item : item?.empresa_id || item?.id))
    .filter(Boolean);
  const usuarioNoEscopo = (usuario) => {
    const vinculadas = normalizeEmpresaIds(usuario?.empresas_vinculadas);
    const temMarcadorEscopo = Boolean(usuario?.group_id || usuario?.grupo_id || usuario?.grupo_atual_id || usuario?.empresa_id || usuario?.empresa_atual_id || vinculadas.length);
    if (!temMarcadorEscopo) return true;
    if (contexto === 'grupo') {
      const empresasIds = empresasDoGrupo.map((empresa) => empresa.id);
      return usuario.group_id === grupoAtivoId ||
        usuario.grupo_id === grupoAtivoId ||
        usuario.grupo_atual_id === grupoAtivoId ||
        vinculadas.some((id) => empresasIds.includes(id));
    }
    return usuario.empresa_id === empresaAtivaId ||
      usuario.empresa_atual_id === empresaAtivaId ||
      vinculadas.includes(empresaAtivaId);
  };

  const auditarIA = async ({ acao, descricao, dadosNovos = null }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        empresa_id: empresaAtivaId || null,
        group_id: grupoAtivoId || null,
        acao,
        modulo: 'Seguranca',
        entidade: 'IA_Governanca',
        descricao,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar IA de governanca:', error);
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
      const rows = await base44.entities.User.list();
      return rows.filter(usuarioNoEscopo);
    },
    enabled: hasValidScope,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['logsIA', 'governanca', scopeKey],
    queryFn: () => base44.entities.LogsIA.filter({ tipo_ia: 'IA_Governanca', ...scope }, '-created_date', 50),
    enabled: hasValidScope,
  });

  const analisarGovernancaMutation = useMutation({
    mutationFn: async () => {
      if (!hasValidScope) {
        await auditarIA({
          acao: 'Bloqueio sem contexto',
          descricao: 'Tentativa de executar IA de governanca sem grupo ou empresa.',
          dadosNovos: scope
        });
        throw new Error('Selecione um grupo ou empresa antes de executar a analise.');
      }
      if (!podeExecutar) {
        await auditarIA({
          acao: 'Bloqueio por permissao',
          descricao: 'Tentativa de executar IA de governanca sem permissao.',
          dadosNovos: scope
        });
        throw new Error('Sem permissao para executar analise de governanca.');
      }
      setAnalisando(true);
      
      // Analisar cada perfil de acesso
      for (const perfil of perfis) {
        const permissoesSensiveis = [];
        const conflitos = [];
        
        // Verificar combinações críticas de SoD
        const permissoes = perfil.permissoes || {};
        
        // Regra 1: Não pode cadastrar fornecedor E aprovar pagamento
        if (permissoes.cadastros_gerais?.fornecedores?.includes('incluir') &&
            permissoes.financeiro?.pode_baixar_titulos) {
          conflitos.push({
            tipo_conflito: 'SoD - Fornecedor + Pagamento',
            descricao: 'Perfil permite cadastrar fornecedor E aprovar pagamentos - risco de fraude',
            severidade: 'Crítica',
            data_deteccao: new Date().toISOString()
          });
        }
        
        // Regra 2: Não pode criar pedido E emitir NF-e sem aprovação
        if (permissoes.comercial?.pedidos?.includes('incluir') &&
            permissoes.fiscal?.pode_emitir_nfe &&
            !permissoes.comercial?.pedidos?.includes('aprovar')) {
          conflitos.push({
            tipo_conflito: 'SoD - Pedido + NF-e sem Aprovação',
            descricao: 'Perfil permite criar pedido e emitir NF-e sem aprovação intermediária',
            severidade: 'Alta',
            data_deteccao: new Date().toISOString()
          });
        }
        
        // Regra 3: Não pode movimentar estoque E aprovar requisições
        if (permissoes.estoque?.movimentacoes?.includes('incluir') &&
            permissoes.estoque?.requisicoes?.includes('aprovar')) {
          conflitos.push({
            tipo_conflito: 'SoD - Estoque Próprio',
            descricao: 'Perfil permite movimentar estoque e aprovar próprias requisições',
            severidade: 'Média',
            data_deteccao: new Date().toISOString()
          });
        }
        
        // Atualizar perfil com conflitos detectados
        if (conflitos.length > 0) {
          await base44.entities.PerfilAcesso.update(perfil.id, {
            conflitos_sod_detectados: conflitos,
            permissoes_sensiveis: permissoesSensiveis,
            ...scope
          });
          
          // Registrar no log de IA
          await base44.entities.LogsIA.create({
            tipo_ia: 'IA_Governanca',
            contexto_execucao: 'Sistema',
            entidade_relacionada: 'PerfilAcesso',
            entidade_id: perfil.id,
            acao_sugerida: `Detectados ${conflitos.length} conflitos de SoD no perfil "${perfil.nome_perfil}"`,
            resultado: 'Automático',
            confianca_ia: 95,
            ...scope,
            dados_entrada: { perfil_id: perfil.id },
            dados_saida: { conflitos }
          });
        }
      }
      
      // Analisar padrões de acesso suspeitos nos usuários
      for (const usuario of usuarios) {
        const alertas = [];
        
        // Verificar acessos fora do horário
        if (usuario.ultimo_acesso) {
          const hora = new Date(usuario.ultimo_acesso).getHours();
          if (hora < 6 || hora > 22) {
            alertas.push({
              tipo: 'Acesso Fora do Horário',
              descricao: `Último acesso às ${hora}h`,
              severidade: 'Média'
            });
          }
        }
        
        // Verificar múltiplas tentativas de login falhadas
        if (usuario.tentativas_login_falhadas > 3) {
          alertas.push({
            tipo: 'Tentativas Login Falhadas',
            descricao: `${usuario.tentativas_login_falhadas} tentativas falhadas`,
            severidade: 'Alta'
          });
        }
        
        if (alertas.length > 0) {
          await base44.entities.LogsIA.create({
            tipo_ia: 'IA_Governanca',
            contexto_execucao: 'Sistema',
            entidade_relacionada: 'User',
            entidade_id: usuario.id,
            acao_sugerida: `Detectados ${alertas.length} alertas de segurança para usuário ${usuario.full_name}`,
            resultado: 'Automático',
            confianca_ia: 85,
            ...scope,
            dados_saida: { alertas }
          });
        }
      }
      
      setAnalisando(false);
      await auditarIA({
        acao: 'Analise IA Governanca',
        descricao: 'Analise de governanca e compliance executada no escopo atual.',
        dadosNovos: { perfis_analisados: perfis.length, usuarios_analisados: usuarios.length, ...scope }
      });
      return { perfis_analisados: perfis.length, usuarios_analisados: usuarios.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfisAcesso', scopeKey] });
      queryClient.invalidateQueries({ queryKey: ['logsIA', 'governanca', scopeKey] });
    },
    onError: (error) => {
      setAnalisando(false);
      toast.error(error.message || 'Erro ao executar analise de governanca.');
    }
  });

  const conflitosDetectados = perfis.reduce((acc, p) => 
    acc + (p.conflitos_sod_detectados?.length || 0), 0
  );

  const conflitosGravidade = perfis.reduce((acc, p) => {
    (p.conflitos_sod_detectados || []).forEach(c => {
      acc[c.severidade] = (acc[c.severidade] || 0) + 1;
    });
    return acc;
  }, {});

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
        <Button
          onClick={() => analisarGovernancaMutation.mutate()}
          disabled={analisando || !hasValidScope || !podeExecutar}
          className="bg-blue-600 hover:bg-blue-700"
          data-action="IAGovernanca.executarAnalise"
          data-permission="Sistema.Seguranca.editar"
          data-context-required="group-or-company"
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
              Executar Análise Completa
            </>
          )}
        </Button>
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
          {perfis.filter(p => p.conflitos_sod_detectados?.length > 0).length > 0 ? (
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
                  ${log.resultado === 'Automático' ? 'bg-blue-100 text-blue-800' : ''}
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
