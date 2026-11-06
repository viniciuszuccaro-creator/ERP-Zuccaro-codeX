import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import usePermissions from "@/components/lib/usePermissions";
import CentralPerfisAcesso from "@/components/sistema/CentralPerfisAcesso";
import RelatorioPermissoes from "@/components/sistema/RelatorioPermissoes";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import { useQuery } from "@tanstack/react-query";
import SoDChecker from "@/components/administracao-sistema/gestao-acessos/SoDChecker";
import UsuariosTab from "@/components/administracao-sistema/gestao-acessos/UsuariosTab";
import { Shield, Users, BarChart3, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  resolveGestaoAcessosKpiState,
  isGestaoAcessosScopeCurrent,
  buildGestaoAcessosPerfisQueryKey,
  buildGestaoAcessosUsersQueryKey,
  buildGestaoAcessosEmpresasQueryKey,
  registroNoEscopoGestaoAcessos,
  usuarioNoEscopoGestaoAcessos,
  countUsuariosSemPerfilGestaoAcessos,
  countPerfisAtivosGestaoAcessos,
} from "./gestaoAcessosIndexScope";

function readGestaoAcessosActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === "string" && session.actorId.trim()
    ? session.actorId.trim()
    : null;
  return { actorId, sessionKey: central360SessionKey(session?.token) };
}

/**
 * User/Perfil/Empresa via filterInContext; KPI 0 ≠ ready em loading/erro.
 */
export default function GestaoAcessosIndex() {
  const { hasPermission, isAdmin } = usePermissions();
  const podeVer = isAdmin() || hasPermission('Sistema', ['Controle de Acesso'], 'visualizar');
  const { filterInContext, createInContext, empresaAtual, grupoAtual, contexto, empresasDoGrupo = [] } = useContextoVisual();
  const { user } = useUser();
  const [tab, setTab] = React.useState('perfis');
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === 'grupo' ? null : (empresaAtual?.id || null);
  const contextoValido = contexto === 'grupo' ? Boolean(groupId) : Boolean(groupId && empresaId);
  const { actorId, sessionKey } = readGestaoAcessosActorAndSession();
  const scopeExpected = { actorId, sessionKey };
  const escopoOpts = {
    contexto,
    grupoAtivoId: groupId,
    empresaAtivaId: empresaId,
    empresasDoGrupo,
  };

  const getDadosContexto = () => ({
    contexto: contexto || 'sem-contexto',
    contexto_valido: contextoValido,
    group_id: groupId,
    empresa_id: empresaId,
    empresas_grupo: empresasDoGrupo.length,
    permissao: 'Sistema.Controle de Acesso.visualizar',
    pode_visualizar: podeVer,
  });

  const auditarGestaoAcessos = async ({ acao, descricao, dadosNovos = {}, sucesso = true, tipo = 'seguranca' }) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario',
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
        acao,
        modulo: 'Sistema',
        tipo_auditoria: tipo,
        entidade: 'Controle de Acesso',
        descricao,
        dados_novos: {
          ...getDadosContexto(),
          ...(dadosNovos || {}),
        },
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Falha ao auditar gestao de acessos:", error);
    }
  };

  React.useEffect(() => {
    if (podeVer) return;
    void auditarGestaoAcessos({
      acao: 'Bloqueio por permissao',
      descricao: 'Tentativa de acessar Gestao de Acessos sem permissao de visualizacao.',
      dadosNovos: { motivo: 'permissao_negada' },
      sucesso: false,
    });
  }, [podeVer, groupId, empresaId]);

  const handleTabChange = (next) => {
    setTab(next);
    void auditarGestaoAcessos({
      acao: contextoValido ? 'Visualizacao' : 'Alerta contexto incompleto',
      descricao: `Aba visualizada: ${next}`,
      dadosNovos: {
        aba_anterior: tab,
        aba_solicitada: next,
        motivo: contextoValido ? null : 'contexto_obrigatorio',
      },
      sucesso: contextoValido,
      tipo: 'ui',
    });
  };

  const perfisQuery = useQuery({
    queryKey: buildGestaoAcessosPerfisQueryKey({ groupId, empresaId, actorId, sessionKey }),
    queryFn: async ({ signal }) => {
      const scoped = await filterInContext('PerfilAcesso', {}, '-updated_date', 500);
      if (signal?.aborted) {
        const err = new Error('GESTAO_ACESSOS_PERFIS_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isGestaoAcessosScopeCurrent(scopeExpected, readGestaoAcessosActorAndSession())) {
        throw new Error('GESTAO_ACESSOS_STALE_SCOPE');
      }
      return (Array.isArray(scoped) ? scoped : []).filter((r) => registroNoEscopoGestaoAcessos(r, escopoOpts));
    },
    enabled: podeVer && contextoValido,
  });

  const usuariosQuery = useQuery({
    queryKey: buildGestaoAcessosUsersQueryKey({ groupId, empresaId, actorId, sessionKey }),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('User', {}, 'full_name', 500);
      if (signal?.aborted) {
        const err = new Error('GESTAO_ACESSOS_USERS_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isGestaoAcessosScopeCurrent(scopeExpected, readGestaoAcessosActorAndSession())) {
        throw new Error('GESTAO_ACESSOS_STALE_SCOPE');
      }
      let usuariosSemMarcadorEscopo = 0;
      const filtrados = (Array.isArray(rows) ? rows : []).filter((u) => {
        const { inclui, semMarcador } = usuarioNoEscopoGestaoAcessos(u, escopoOpts);
        if (semMarcador) usuariosSemMarcadorEscopo += 1;
        return inclui;
      });
      if (usuariosSemMarcadorEscopo > 0) {
        void auditarGestaoAcessos({
          acao: 'Alerta usuarios sem escopo',
          descricao: 'Consulta de usuarios encontrou registros sem marcador multiempresa explicito. Fluxo preservado para revisao gradual.',
          dadosNovos: {
            total_bruto: Array.isArray(rows) ? rows.length : 0,
            total_no_escopo: filtrados.length,
            usuarios_sem_marcador_escopo: usuariosSemMarcadorEscopo,
          },
          sucesso: false,
          tipo: 'seguranca',
        });
      }
      return filtrados;
    },
    enabled: podeVer && contextoValido,
  });

  const empresasQuery = useQuery({
    queryKey: buildGestaoAcessosEmpresasQueryKey({ groupId, empresaId, actorId, sessionKey }),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('Empresa', {}, 'nome_fantasia', 500);
      if (signal?.aborted) {
        const err = new Error('GESTAO_ACESSOS_EMPRESAS_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isGestaoAcessosScopeCurrent(scopeExpected, readGestaoAcessosActorAndSession())) {
        throw new Error('GESTAO_ACESSOS_STALE_SCOPE');
      }
      return rows;
    },
    enabled: podeVer && contextoValido,
  });

  const kpiState = resolveGestaoAcessosKpiState({
    canView: podeVer,
    contextoValido,
    isLoading: usuariosQuery.isLoading || perfisQuery.isLoading,
    isError: usuariosQuery.isError || perfisQuery.isError,
    isFetching: usuariosQuery.isFetching || perfisQuery.isFetching,
    dataDefined: usuariosQuery.data !== undefined && perfisQuery.data !== undefined,
  });
  const ready = kpiState === 'ready';
  const usuarios = ready && Array.isArray(usuariosQuery.data) ? usuariosQuery.data : [];
  const perfis = ready && Array.isArray(perfisQuery.data) ? perfisQuery.data : [];
  const empresas = Array.isArray(empresasQuery.data) ? empresasQuery.data : [];

  if (!podeVer) {
    return (
      <div className="p-6 flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="font-semibold text-slate-800">Acesso Restrito</p>
        <p className="text-sm text-slate-500">Voce nao tem permissao para acessar a Gestao de Acessos.</p>
      </div>
    );
  }

  const usuariosNoEscopo = usuarios;
  const usuariosSemPerfil = countUsuariosSemPerfilGestaoAcessos(usuariosNoEscopo);
  const perfisAtivos = countPerfisAtivosGestaoAcessos(perfis);
  const kpiIndisponivel = !ready;

  return (
    <div className="w-full h-full flex flex-col gap-3 min-h-0 overflow-hidden">
      <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-xs text-blue-600 font-medium">RBAC Ativo</p>
              <p className="text-lg font-bold text-blue-900">
                {kpiIndisponivel ? '…' : `${perfisAtivos} perfil(is)`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className={!kpiIndisponivel && usuariosSemPerfil > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}>
          <CardContent className="p-3 flex items-center gap-3">
            {!kpiIndisponivel && usuariosSemPerfil > 0
              ? <AlertTriangle className="w-8 h-8 text-amber-600 flex-shrink-0" />
              : <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />}
            <div>
              <p className={`text-xs font-medium ${!kpiIndisponivel && usuariosSemPerfil > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {kpiIndisponivel
                  ? (kpiState === 'loading' ? 'Carregando…' : kpiState === 'error' ? 'Erro' : 'Contexto')
                  : (usuariosSemPerfil > 0 ? 'Sem perfil atribuido' : 'Todos com perfil')}
              </p>
              <p className={`text-lg font-bold ${!kpiIndisponivel && usuariosSemPerfil > 0 ? 'text-amber-900' : 'text-green-900'}`}>
                {kpiIndisponivel
                  ? '…'
                  : (usuariosSemPerfil > 0 ? `${usuariosSemPerfil} usuario(s)` : `${usuariosNoEscopo.length} usuario(s)`)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-3 flex items-center gap-3">
            <Users className="w-8 h-8 text-slate-600 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-600 font-medium">Total de Usuarios</p>
              <p className="text-lg font-bold text-slate-900">
                {kpiIndisponivel ? '…' : usuariosNoEscopo.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!kpiIndisponivel && usuariosSemPerfil > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 w-full">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
          <span>
            <strong>{usuariosSemPerfil} usuario(s)</strong> sem perfil RBAC atribuido.
            Acesse a aba <strong>Usuarios</strong> para corrigir.
          </span>
        </div>
      )}

       <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 w-full">
         <Shield className="w-4 h-4 flex-shrink-0 text-blue-600 mt-0.5" />
         <span className="leading-relaxed break-words min-w-0 flex-1">
           <strong>RBAC granular + multiempresa</strong> — Perfis controlam acesso por modulo, secao e acao.
           Permissoes propagam automaticamente entre grupo ↔ empresas.
           Admins tem acesso total. Atribua perfis na aba <em>Usuarios</em>.
           Verifique conflitos SoD na aba correspondente.
         </span>
       </div>

      <Tabs value={tab} onValueChange={handleTabChange} className="w-full h-full min-h-0 flex flex-col">
        <div className="w-full overflow-x-auto pb-1 -mx-1 px-1">
          <TabsList className="inline-flex h-auto gap-1 flex-nowrap min-w-max bg-slate-100 p-1 rounded-lg">
            <TabsTrigger value="perfis" data-action="RBAC.tab.perfis" data-permission="Sistema.Controle de Acesso.visualizar" className="text-xs px-2.5 sm:px-4 py-1.5 whitespace-nowrap rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Shield className="w-3.5 h-3.5 mr-1" />
              Perfis RBAC
              <Badge className="ml-1.5 text-[9px] bg-blue-100 text-blue-700 px-1">{kpiIndisponivel ? '…' : perfisAtivos}</Badge>
            </TabsTrigger>
            <TabsTrigger value="usuarios" data-action="RBAC.tab.usuarios" data-permission="Sistema.Controle de Acesso.visualizar" className="text-xs px-2.5 sm:px-4 py-1.5 whitespace-nowrap rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Users className="w-3.5 h-3.5 mr-1" />
              Usuarios
              {!kpiIndisponivel && usuariosSemPerfil > 0 && (
                <Badge className="ml-1.5 text-[9px] bg-amber-100 text-amber-700 px-1">{usuariosSemPerfil} pendentes</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sod" data-action="RBAC.tab.sod" data-permission="Sistema.Controle de Acesso.visualizar" className="text-xs px-2.5 sm:px-4 py-1.5 whitespace-nowrap rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              SoD
            </TabsTrigger>
            <TabsTrigger value="relatorios" data-action="RBAC.tab.relatorios" data-permission="Sistema.Controle de Acesso.visualizar" className="text-xs px-2.5 sm:px-4 py-1.5 whitespace-nowrap rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <BarChart3 className="w-3.5 h-3.5 mr-1" />
              Relatorios
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="perfis" className="mt-3 w-full flex-1 min-h-0 overflow-auto">
          <div className="w-full h-full overflow-x-auto">
            <CentralPerfisAcesso />
          </div>
        </TabsContent>

        <TabsContent value="usuarios" className="mt-3 w-full flex-1 min-h-0 overflow-auto">
          <div className="w-full h-full">
            <UsuariosTab />
          </div>
        </TabsContent>

        <TabsContent value="sod" className="mt-3 w-full flex-1 min-h-0 overflow-auto">
          <div className="w-full h-full overflow-x-auto">
            <SoDChecker />
          </div>
        </TabsContent>

        <TabsContent value="relatorios" className="mt-3 w-full flex-1 min-h-0 overflow-auto">
          <div className="w-full h-full overflow-x-auto">
            <RelatorioPermissoes perfis={perfis} usuarios={usuariosNoEscopo} empresas={empresas} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
