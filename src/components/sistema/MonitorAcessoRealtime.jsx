import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import {
  Activity,
  Users,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  TrendingUp,
  TrendingDown,
  Bolt
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function MonitorAcessoRealtime() {
  const [tempoReal, setTempoReal] = useState(new Date());
  const { contexto, empresaAtual, grupoAtual, empresasDoGrupo = [], filterInContext } = useContextoVisual();
  const { user, isAdmin, hasPermission } = usePermissions();
  const grupoAtivoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem('group_atual_id'); } catch { return null; }
  })();
  const empresaAtivaId = contexto === 'grupo' ? null : empresaAtual?.id;
  const scopeKey = empresaAtivaId || grupoAtivoId || 'sem-contexto';
  const contextoValido = scopeKey !== 'sem-contexto';
  const podeVisualizarMonitor = isAdmin() ||
    hasPermission('Sistema', ['Seguranca', 'Monitoramento', 'AcessoRealtime'], 'visualizar') ||
    hasPermission('Sistema', ['Segurança', 'Monitoramento', 'AcessoRealtime'], 'visualizar') ||
    hasPermission('Sistema', 'Monitoramento', 'visualizar') ||
    hasPermission('Sistema', 'Seguranca', 'visualizar') ||
    hasPermission('Sistema', 'Segurança', 'visualizar') ||
    hasPermission('Sistema', 'AcessoRealtime', 'visualizar');
  const normalizeEmpresaIds = (values = []) => (Array.isArray(values) ? values : [])
    .map((item) => (typeof item === 'string' ? item : item?.empresa_id || item?.id))
    .filter(Boolean);

  const usuarioNoEscopo = (u) => {
    if (!u) return false;
    const vinculadas = normalizeEmpresaIds(u.empresas_vinculadas);
    const temMarcacaoEscopo = u.group_id || u.grupo_id || u.grupo_atual_id || u.empresa_id || u.empresa_atual_id || vinculadas.length > 0;
    if (!temMarcacaoEscopo) return true;
    if (contexto === 'grupo') {
      const empresasIds = empresasDoGrupo.map((e) => e.id);
      return u.group_id === grupoAtivoId ||
        u.grupo_id === grupoAtivoId ||
        u.grupo_atual_id === grupoAtivoId ||
        vinculadas.some((id) => empresasIds.includes(id));
    }
    return u.empresa_id === empresaAtivaId ||
      u.empresa_atual_id === empresaAtivaId ||
      vinculadas.includes(empresaAtivaId);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTempoReal(new Date());
    }, 30000); // Atualiza a cada 30s

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (contextoValido && podeVisualizarMonitor) return;
    base44.entities.AuditLog.create({
      usuario: user?.full_name || user?.email || 'Usuario local',
      usuario_id: user?.id || null,
      acao: 'MonitorAcessoRealtime.bloqueado',
      modulo: 'Sistema',
      entidade: 'MonitorAcessoRealtime',
      tipo_auditoria: 'seguranca',
      empresa_id: empresaAtivaId || null,
      group_id: grupoAtivoId || null,
      grupo_id: grupoAtivoId || null,
      descricao: !contextoValido
        ? 'Monitor de acesso bloqueado por ausencia de contexto grupo/empresa'
        : 'Monitor de acesso bloqueado por ausencia de permissao',
      sucesso: false,
      data_hora: new Date().toISOString(),
    }).catch(() => {});
  }, [contextoValido, podeVisualizarMonitor, user?.id, user?.email, user?.full_name, empresaAtivaId, grupoAtivoId]);

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-monitor', scopeKey],
    queryFn: async () => {
      const rows = await base44.entities.User.list();
      return rows.filter(usuarioNoEscopo);
    },
    enabled: contextoValido && podeVisualizarMonitor,
  });

  const { data: auditoriaRecente = [] } = useQuery({
    queryKey: ['auditoria-realtime', scopeKey, tempoReal],
    queryFn: () => filterInContext('AuditoriaAcesso', {}, '-created_date', 100),
    enabled: contextoValido && podeVisualizarMonitor,
  });

  const getDataEvento = (evento) => evento?.data_hora || evento?.created_date || evento?.updated_date;

  // Usuários Online (últimos 5 minutos)
  const usuariosOnline = usuarios.filter(u => {
    if (!u.ultimo_acesso) return false;
    const diff = Date.now() - new Date(u.ultimo_acesso).getTime();
    return diff < 5 * 60 * 1000; // 5 minutos
  });

  // Acessos negados nas últimas 24h
  const acessosNegados24h = auditoriaRecente.filter(a => {
    const dataEvento = getDataEvento(a);
    if (!dataEvento) return false;
    const diff = Date.now() - new Date(dataEvento).getTime();
    const status = String(a.status || a.resultado || '').toLowerCase();
    return diff < 24 * 60 * 60 * 1000 && ['negado', 'bloqueado', 'falha'].includes(status);
  });

  // Tentativas de login falhas
  const loginsFalhados = usuarios.filter(u => 
    u.tentativas_login_falhas && u.tentativas_login_falhas > 0
  );

  // Usuários bloqueados
  const usuariosBloqueados = usuarios.filter(u => u.bloqueado === true);

  // Atividades por hora (últimas 24h)
  const atividadesPorHora = Array.from({ length: 24 }, (_, i) => {
    const hora = new Date();
    hora.setHours(hora.getHours() - (23 - i), 0, 0, 0);
    
    const count = auditoriaRecente.filter(a => {
      const dataEvento = getDataEvento(a);
      if (!dataEvento) return false;
      const aHora = new Date(dataEvento);
      return aHora.getHours() === hora.getHours() &&
             aHora.getDate() === hora.getDate();
    }).length;

    return {
      hora: `${String(hora.getHours()).padStart(2, '0')}h`,
      atividades: count
    };
  });

  // Ações mais comuns
  const acoesComuns = auditoriaRecente.reduce((acc, a) => {
    const acao = a.acao || 'outros';
    acc[acao] = (acc[acao] || 0) + 1;
    return acc;
  }, {});

  const dadosAcoes = Object.entries(acoesComuns)
    .map(([acao, quantidade]) => ({ acao, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 6);

  if (!contextoValido) {
    return (
      <div className="w-full h-full rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Selecione um grupo ou empresa para visualizar o monitoramento de acesso.
      </div>
    );
  }

  if (!podeVisualizarMonitor) {
    return (
      <div className="w-full h-full rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Acesso restrito ao monitoramento de seguranca.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full h-full" data-permission="Sistema.Seguranca.Monitoramento.AcessoRealtime.visualizar" data-context-required="true">
      {/* Status em Tempo Real */}
      <Card className="lg:col-span-3">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
            Monitor de Acesso em Tempo Real
            <Badge className="bg-green-600 text-white ml-auto">
              Atualizado: {tempoReal.toLocaleTimeString('pt-BR')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 border rounded-lg bg-green-50" data-action="MonitorAcessoRealtime.metric.online">
              <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-green-700">{usuariosOnline.length}</p>
              <p className="text-xs text-green-600">Online Agora</p>
            </div>

            <div className="text-center p-4 border rounded-lg bg-blue-50" data-action="MonitorAcessoRealtime.metric.acoes">
              <Eye className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-blue-700">{auditoriaRecente.length}</p>
              <p className="text-xs text-blue-600">Ações Recentes</p>
            </div>

            <div className="text-center p-4 border rounded-lg bg-orange-50" data-action="MonitorAcessoRealtime.metric.negados" data-sensitive="true">
              <AlertTriangle className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-orange-700">{acessosNegados24h.length}</p>
              <p className="text-xs text-orange-600">Acessos Negados</p>
            </div>

            <div className="text-center p-4 border rounded-lg bg-red-50" data-action="MonitorAcessoRealtime.metric.loginFalho" data-sensitive="true">
              <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-red-700">{loginsFalhados.length}</p>
              <p className="text-xs text-red-600">Login Falho</p>
            </div>

            <div className="text-center p-4 border rounded-lg bg-purple-50" data-action="MonitorAcessoRealtime.metric.bloqueados" data-sensitive="true">
              <Shield className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-purple-700">{usuariosBloqueados.length}</p>
              <p className="text-xs text-purple-600">Bloqueados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usuários Online */}
      <Card>
        <CardHeader className="bg-green-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-green-600" />
            Usuários Online ({usuariosOnline.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[300px]">
            {usuariosOnline.map(u => (
              <div key={u.id} className="p-3 border-b hover:bg-slate-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{u.full_name}</span>
                  <Badge className="bg-green-600 text-white">
                    <Activity className="w-3 h-3 mr-1 animate-pulse" />
                    Online
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">{u.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-500">
                    Último acesso: {new Date(u.ultimo_acesso).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
                {u.ip_ultimo_acesso && (
                  <p className="text-xs font-mono text-slate-400 mt-1">IP: {u.ip_ultimo_acesso}</p>
                )}
              </div>
            ))}
            {usuariosOnline.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum usuário online</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Atividades por Hora */}
      <Card className="lg:col-span-2">
        <CardHeader className="bg-blue-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Atividades nas Últimas 24h
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={atividadesPorHora}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="atividades" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Ações Mais Comuns */}
      <Card>
        <CardHeader className="bg-purple-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Bolt className="w-4 h-4 text-purple-600" />
            Ações Mais Frequentes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={dadosAcoes}
                dataKey="quantidade"
                nameKey="acao"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry) => entry.acao}
              >
                {dadosAcoes.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Alertas de Segurança */}
      <Card className="lg:col-span-2">
        <CardHeader className="bg-red-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            Alertas de Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <ScrollArea className="h-[250px]">
            <div className="space-y-3">
              {acessosNegados24h.map(acesso => (
                <div key={acesso.id} className="p-3 border border-red-200 rounded-lg bg-red-50">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="font-medium text-sm text-red-900">Acesso Negado</span>
                  </div>
                  <p className="text-xs text-red-700">
                    {acesso.usuario_nome || acesso.created_by} tentou acessar {acesso.recurso || acesso.modulo}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {new Date(getDataEvento(acesso)).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}

              {loginsFalhados.map(u => (
                <div key={u.id} className="p-3 border border-orange-200 rounded-lg bg-orange-50">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span className="font-medium text-sm text-orange-900">Tentativas de Login</span>
                  </div>
                  <p className="text-xs text-orange-700">
                    {u.full_name} ({u.email}) - {u.tentativas_login_falhas} tentativas
                  </p>
                  {u.data_ultima_tentativa_falha && (
                    <p className="text-xs text-orange-600 mt-1">
                      Última: {new Date(u.data_ultima_tentativa_falha).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              ))}

              {usuariosBloqueados.map(u => (
                <div key={u.id} className="p-3 border border-purple-200 rounded-lg bg-purple-50">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-sm text-purple-900">Usuário Bloqueado</span>
                  </div>
                  <p className="text-xs text-purple-700">{u.full_name}</p>
                  {u.motivo_bloqueio && (
                    <p className="text-xs text-purple-600 mt-1">Motivo: {u.motivo_bloqueio}</p>
                  )}
                </div>
              ))}

              {acessosNegados24h.length === 0 && loginsFalhados.length === 0 && usuariosBloqueados.length === 0 && (
                <div className="text-center py-12 text-green-600">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3" />
                  <p className="font-medium">Nenhum alerta de segurança</p>
                  <p className="text-sm">Sistema operando normalmente</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
