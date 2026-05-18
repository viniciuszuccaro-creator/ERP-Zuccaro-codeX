import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Lock, 
  Eye, 
  AlertTriangle,
  CheckCircle,
  Activity,
  Database,
  FileText,
  Clock
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * Painel de Governança Corporativa
 * Compliance, Auditoria e Segurança
 */
export default function PainelGovernanca({ empresaId, grupoId }) {
  const [periodo, setPeriodo] = useState('hoje');
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const groupId = grupoId || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaAtivaId = empresaId || empresaAtual?.id || null;
  const scopeKey = empresaAtivaId || groupId || 'sem-contexto';
  const scope = {
    ...(groupId ? { group_id: groupId } : {}),
    ...(empresaAtivaId ? { empresa_id: empresaAtivaId } : {}),
  };
  const contextoValido = scopeKey !== 'sem-contexto';
  const podeVerGovernanca = isAdmin() || hasPermission('Sistema', 'Seguranca', 'visualizar') || hasPermission('Sistema', 'Segurança', 'visualizar');

  const { data: auditoriaGlobal = [] } = useQuery({
    queryKey: ['auditoria-global', scopeKey],
    queryFn: () => filterInContext('AuditoriaGlobal', {}, '-data_hora', 100),
    enabled: contextoValido && podeVerGovernanca,
  });

  const { data: auditoriaAcessos = [] } = useQuery({
    queryKey: ['auditoria-acessos', scopeKey],
    queryFn: () => filterInContext('AuditoriaAcesso', {}, '-data_hora', 50),
    enabled: contextoValido && podeVerGovernanca,
  });

  const { data: governanca } = useQuery({
    queryKey: ['governanca-empresa', scopeKey],
    queryFn: async () => {
      const configs = await base44.entities.GovernancaEmpresa.filter(scope);
      return configs[0];
    },
    enabled: contextoValido && podeVerGovernanca
  });

  if (!podeVerGovernanca) {
    return <div className="p-4 text-sm text-slate-500">Sem permissao para visualizar governanca.</div>;
  }

  // KPIs de Governança
  const loginsHoje = auditoriaAcessos.filter(a => 
    a.tipo_acao === 'Login' && 
    a.sucesso &&
    new Date(a.data_hora).toDateString() === new Date().toDateString()
  ).length;

  const tentativasFalhas = auditoriaAcessos.filter(a => 
    !a.sucesso &&
    new Date(a.data_hora).toDateString() === new Date().toDateString()
  ).length;

  const acoesAltoRisco = auditoriaGlobal.filter(a => 
    a.nivel_risco === 'Alto' || a.nivel_risco === 'Crítico'
  ).length;

  const alertasIA = auditoriaGlobal.filter(a => a.alerta_ia_gerado).length;

  return (
    <div className="space-y-6">
      {/* KPIs de Segurança */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Logins Hoje</p>
                <p className="text-3xl font-bold text-green-900">{loginsHoje}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">Tentativas Falhas</p>
                <p className="text-3xl font-bold text-orange-900">{tentativasFalhas}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-orange-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Ações Alto Risco</p>
                <p className="text-3xl font-bold text-red-900">{acoesAltoRisco}</p>
              </div>
              <Shield className="w-10 h-10 text-red-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">Alertas IA</p>
                <p className="text-3xl font-bold text-purple-900">{alertasIA}</p>
              </div>
              <Activity className="w-10 h-10 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuração de Governança */}
      {governanca && (
        <Card>
          <CardHeader className="bg-blue-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600" />
              Configuração de Governança
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-slate-600">Nível de Conformidade</p>
                <Badge className="mt-1 bg-blue-600">
                  {governanca.nivel_conformidade}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-600">Auditoria Automática</p>
                <Badge className={governanca.auditoria_automatica ? 'bg-green-600' : 'bg-slate-600'}>
                  {governanca.auditoria_automatica ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-600">IA de Segurança</p>
                <Badge className={governanca.ia_seguranca_ativa ? 'bg-purple-600' : 'bg-slate-600'}>
                  {governanca.ia_seguranca_ativa ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-600">Backup Automático</p>
                <p className="font-semibold text-slate-900">
                  {governanca.backup_automatico ? `A cada ${governanca.backup_periodo_dias} dia(s)` : 'Desativado'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Retenção de Logs</p>
                <p className="font-semibold text-slate-900">
                  {governanca.retencao_logs_dias} dias
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Último Backup</p>
                <p className="font-semibold text-slate-900">
                  {governanca.ultimo_backup 
                    ? new Date(governanca.ultimo_backup).toLocaleString('pt-BR')
                    : '-'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs" data-action="Governanca.tab.logs" data-permission="Sistema.Seguranca.visualizar" data-context-required="group-or-company">Logs de Auditoria</TabsTrigger>
          <TabsTrigger value="acessos" data-action="Governanca.tab.acessos" data-permission="Sistema.Seguranca.visualizar" data-context-required="group-or-company">Acessos e Logins</TabsTrigger>
          <TabsTrigger value="riscos" data-action="Governanca.tab.riscos" data-permission="Sistema.Seguranca.visualizar" data-context-required="group-or-company">Ações de Risco</TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base">Últimas Ações no Sistema</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risco</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditoriaGlobal.slice(0, 20).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">
                        {new Date(log.data_hora).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {log.usuario_nome}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.acao}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.modulo}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.entidade_afetada || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.sucesso ? 'default' : 'destructive'} className="text-xs">
                          {log.sucesso ? 'Sucesso' : 'Falha'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          log.nivel_risco === 'Crítico' ? 'bg-red-600' :
                          log.nivel_risco === 'Alto' ? 'bg-orange-600' :
                          log.nivel_risco === 'Médio' ? 'bg-yellow-600' :
                          'bg-green-600'
                        }>
                          {log.nivel_risco}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acessos">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base">Histórico de Acessos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditoriaAcessos.map((acesso) => (
                    <TableRow key={acesso.id}>
                      <TableCell className="text-xs">
                        {new Date(acesso.data_hora).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {acesso.usuario_nome}
                      </TableCell>
                      <TableCell className="text-sm">
                        {acesso.tipo_acao}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {acesso.ip_address}
                      </TableCell>
                      <TableCell className="text-xs">
                        {acesso.dispositivo_tipo}
                      </TableCell>
                      <TableCell>
                        <Badge variant={acesso.sucesso ? 'default' : 'destructive'} className="text-xs">
                          {acesso.sucesso ? 'Sucesso' : 'Falha'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="riscos">
          <Card>
            <CardHeader className="bg-red-50 border-b border-red-200">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Ações de Alto Risco
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Alerta IA</TableHead>
                    <TableHead>Investigado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditoriaGlobal
                    .filter(a => a.nivel_risco === 'Alto' || a.nivel_risco === 'Crítico')
                    .map((log) => (
                    <TableRow key={log.id} className="bg-red-50/30">
                      <TableCell className="text-xs">
                        {new Date(log.data_hora).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {log.usuario_nome}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.acao}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.entidade_afetada}
                        {log.registro_chave && (
                          <span className="text-xs text-slate-600 block">
                            {log.registro_chave}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.alerta_ia_gerado ? (
                          <Badge className="bg-purple-600 text-xs">
                            {log.tipo_alerta}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.investigado ? 'default' : 'outline'} className="text-xs">
                          {log.investigado ? 'Sim' : 'Pendente'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {auditoriaGlobal.filter(a => a.nivel_risco === 'Alto' || a.nivel_risco === 'Crítico').length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-16 h-16 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma ação de alto risco detectada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Políticas de Segurança */}
      {governanca?.politicas_senha && (
        <Card>
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-5 h-5 text-slate-600" />
              Políticas de Senha
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-600">Tamanho Mínimo</p>
                <p className="font-semibold">{governanca.politicas_senha.tamanho_minimo} caracteres</p>
              </div>
              <div>
                <p className="text-slate-600">Trocar Senha</p>
                <p className="font-semibold">A cada {governanca.politicas_senha.trocar_senha_dias} dias</p>
              </div>
              <div>
                <p className="text-slate-600">Exigir Maiúsculas/Números</p>
                <p className="font-semibold">
                  {governanca.politicas_senha.exigir_maiusculas && governanca.politicas_senha.exigir_numeros ? 'Sim' : 'Não'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
