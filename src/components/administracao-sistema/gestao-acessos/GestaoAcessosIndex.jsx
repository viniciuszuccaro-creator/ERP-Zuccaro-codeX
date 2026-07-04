import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import usePermissions from "@/components/lib/usePermissions";
import CentralPerfisAcesso from "@/components/sistema/CentralPerfisAcesso";
import RelatorioPermissoes from "@/components/sistema/RelatorioPermissoes";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { useQuery } from "@tanstack/react-query";
import SoDChecker from "@/components/administracao-sistema/gestao-acessos/SoDChecker";
import UsuariosTab from "@/components/administracao-sistema/gestao-acessos/UsuariosTab";
import { Shield, Users, BarChart3, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function GestaoAcessosIndex() {
  const { hasPermission, isAdmin } = usePermissions();
  const podeVer = isAdmin() || hasPermission('Sistema', ['Controle de Acesso'], 'visualizar');
  const { filterInContext, createInContext, empresaAtual, grupoAtual, contexto, empresasDoGrupo = [] } = useContextoVisual();
  const { user } = useUser();
  const [tab, setTab] = React.useState('perfis');
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const scopeKey = contexto === 'grupo' ? (groupId || 'sem-grupo') : (empresaAtual?.id || groupId || 'sem-contexto');
  const contextoValido = contexto === 'grupo' ? Boolean(groupId) : Boolean(groupId && empresaAtual?.id);
  const normalizeEmpresaIds = (values = []) => (Array.isArray(values) ? values : [])
    .map((item) => (typeof item === 'string' ? item : item?.empresa_id || item?.id))
    .filter(Boolean);
  const registroNoEscopo = (registro) => {
    const empresasVinculadas = normalizeEmpresaIds(registro.empresas_vinculadas || registro.empresas || registro.empresas_ids);
    const registroGroupId = registro.group_id || registro.grupo_id || registro.groupId || registro.grupoId;
    const registroEmpresaId = registro.empresa_id || registro.empresaId || registro.empresa_atual_id;
    const temMarcadorEscopo = Boolean(registroGroupId || registroEmpresaId || empresasVinculadas.length);

    if (!temMarcadorEscopo) return false;
    if (contexto === 'grupo') {
      const empresasIds = empresasDoGrupo.map((e) => e.id);
      return registroGroupId === groupId || empresasVinculadas.some((id) => empresasIds.includes(id));
    }
    return registroGroupId === groupId
      || registroEmpresaId === empresaAtual?.id
      || empresasVinculadas.includes(empresaAtual?.id);
  };

  const getDadosContexto = () => ({
    contexto: contexto || 'sem-contexto',
    contexto_valido: contextoValido,
    group_id: groupId,
    empresa_id: empresaAtual?.id || null,
    empresas_grupo: empresasDoGrupo.length,
    permissao: 'Sistema.Controle de Acesso.visualizar',
    pode_visualizar: podeVer,
  });

  const auditarGestaoAcessos = async ({ acao, descricao, dadosNovos = {}, sucesso = true, tipo = 'seguranca' }) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario',
        usuario_id: user?.id || null,
        empresa_id: empresaAtual?.id || null,
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
  }, [podeVer, groupId, empresaAtual?.id]);

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
    return;
    try {
      void createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'UsuÃ¡rio',
        usuario_id: user?.id,
        empresa_id: empresaAtual?.id || null,
        group_id: groupId,
        empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
        acao: 'VisualizaÃ§Ã£o',
        modulo: 'Sistema',
        tipo_auditoria: 'ui',
        entidade: 'Controle de Acesso',
        descricao: `Aba visualizada: ${next}`,
        data_hora: new Date().toISOString(),
      }).catch((error) => console.warn("Falha ao auditar aba de gestao de acessos:", error));
    } catch {}
  };

  // Hooks SEMPRE antes de qualquer return condicional
  const { data: perfis = [] } = useQuery({
    queryKey: ['perfis-acesso', scopeKey],
    queryFn: async () => {
      const scoped = await filterInContext('PerfilAcesso', {}, '-updated_date', 500);
      if (scoped.length) return scoped;
      const rows = await base44.entities.PerfilAcesso.list('-updated_date', 500);
      const filtrados = rows.filter(registroNoEscopo);
      void auditarGestaoAcessos({
        acao: 'Fallback consulta perfis RBAC',
        descricao: 'Consulta de perfis usou fallback direto e filtragem de escopo no cliente.',
        dadosNovos: {
          total_bruto: rows.length,
          total_no_escopo: filtrados.length,
          motivo: 'filterInContext_sem_resultado',
        },
        sucesso: true,
        tipo: 'seguranca',
      });
      return filtrados;
    },
    enabled: podeVer,
  });
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios', scopeKey],
    queryFn: async () => {
      const rows = await base44.entities.User.list();
      let usuariosSemMarcadorEscopo = 0;
      const filtrados = rows.filter((u) => {
        const empresasVinculadas = normalizeEmpresaIds(u.empresas_vinculadas);
        const temMarcadorEscopo = Boolean(
          u.group_id || u.grupo_id || u.grupo_atual_id || u.empresa_id || u.empresa_atual_id || empresasVinculadas.length
        );
        if (!temMarcadorEscopo) {
          usuariosSemMarcadorEscopo += 1;
          return true;
        }
        if (contexto === 'grupo') {
          const empresasIds = empresasDoGrupo.map((e) => e.id);
          return u.group_id === groupId
            || u.grupo_id === groupId
            || u.grupo_atual_id === groupId
            || empresasVinculadas.some((id) => empresasIds.includes(id));
        }
        return u.empresa_id === empresaAtual?.id
          || u.empresa_atual_id === empresaAtual?.id
          || empresasVinculadas.includes(empresaAtual?.id);
      });
      if (usuariosSemMarcadorEscopo > 0) {
        void auditarGestaoAcessos({
          acao: 'Alerta usuarios sem escopo',
          descricao: 'Consulta de usuarios encontrou registros sem marcador multiempresa explicito. Fluxo preservado para revisao gradual.',
          dadosNovos: {
            total_bruto: rows.length,
            total_no_escopo: filtrados.length,
            usuarios_sem_marcador_escopo: usuariosSemMarcadorEscopo,
          },
          sucesso: false,
          tipo: 'seguranca',
        });
      }
      return filtrados;
    },
    enabled: podeVer && scopeKey !== 'sem-contexto',
  });
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-ga', scopeKey],
    queryFn: () => filterInContext('Empresa', {}, 'nome_fantasia', 500),
    enabled: podeVer && !!scopeKey,
  });

  if (!podeVer) {
    return (
      <div className="p-6 flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="font-semibold text-slate-800">Acesso Restrito</p>
        <p className="text-sm text-slate-500">VocÃª nÃ£o tem permissÃ£o para acessar a GestÃ£o de Acessos.</p>
      </div>
    );
  }

  // EstatÃ­sticas rÃ¡pidas para o banner de status do RBAC
  const usuariosNoEscopo = usuarios;
  const usuariosSemPerfil = usuariosNoEscopo.filter(u => !u.perfil_acesso_id && u.role !== 'admin').length;
  const perfisAtivos = perfis.filter(p => p.ativo !== false).length;

  return (
    <div className="w-full h-full flex flex-col gap-3 min-h-0 overflow-hidden">
      {/* Banner RBAC com estatÃ­sticas */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-xs text-blue-600 font-medium">RBAC Ativo</p>
              <p className="text-lg font-bold text-blue-900">{perfisAtivos} perfil(is)</p>
            </div>
          </CardContent>
        </Card>
        <Card className={usuariosSemPerfil > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}>
          <CardContent className="p-3 flex items-center gap-3">
            {usuariosSemPerfil > 0
              ? <AlertTriangle className="w-8 h-8 text-amber-600 flex-shrink-0" />
              : <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />}
            <div>
              <p className={`text-xs font-medium ${usuariosSemPerfil > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {usuariosSemPerfil > 0 ? 'Sem perfil atribuÃ­do' : 'Todos com perfil'}
              </p>
              <p className={`text-lg font-bold ${usuariosSemPerfil > 0 ? 'text-amber-900' : 'text-green-900'}`}>
                {usuariosSemPerfil > 0 ? `${usuariosSemPerfil} usuÃ¡rio(s)` : `${usuariosNoEscopo.length} usuÃ¡rio(s)`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-3 flex items-center gap-3">
            <Users className="w-8 h-8 text-slate-600 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-600 font-medium">Total de UsuÃ¡rios</p>
              <p className="text-lg font-bold text-slate-900">{usuariosNoEscopo.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aviso se hÃ¡ usuÃ¡rios sem perfil */}
      {usuariosSemPerfil > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 w-full">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
          <span>
            <strong>{usuariosSemPerfil} usuÃ¡rio(s)</strong> sem perfil RBAC atribuÃ­do.
            Acesse a aba <strong>UsuÃ¡rios</strong> para corrigir.
          </span>
        </div>
      )}

      {/* Info RBAC */}
       <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 w-full">
         <Shield className="w-4 h-4 flex-shrink-0 text-blue-600 mt-0.5" />
         <span className="leading-relaxed break-words min-w-0 flex-1">
           <strong>RBAC granular + multiempresa</strong> â€” Perfis controlam acesso por mÃ³dulo, seÃ§Ã£o e aÃ§Ã£o. 
           PermissÃµes propagam automaticamente entre grupo â†” empresas. 
           Admins tÃªm acesso total. Atribua perfis na aba <em>UsuÃ¡rios</em>.
           Verifique conflitos SoD na aba correspondente.
         </span>
       </div>

      <Tabs value={tab} onValueChange={handleTabChange} className="w-full h-full min-h-0 flex flex-col">
        <div className="w-full overflow-x-auto pb-1 -mx-1 px-1">
          <TabsList className="inline-flex h-auto gap-1 flex-nowrap min-w-max bg-slate-100 p-1 rounded-lg">
            <TabsTrigger value="perfis" data-action="RBAC.tab.perfis" data-permission="Sistema.Controle de Acesso.visualizar" className="text-xs px-2.5 sm:px-4 py-1.5 whitespace-nowrap rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Shield className="w-3.5 h-3.5 mr-1" />
              Perfis RBAC
              <Badge className="ml-1.5 text-[9px] bg-blue-100 text-blue-700 px-1">{perfisAtivos}</Badge>
            </TabsTrigger>
            <TabsTrigger value="usuarios" data-action="RBAC.tab.usuarios" data-permission="Sistema.Controle de Acesso.visualizar" className="text-xs px-2.5 sm:px-4 py-1.5 whitespace-nowrap rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Users className="w-3.5 h-3.5 mr-1" />
              UsuÃ¡rios
              {usuariosSemPerfil > 0 && (
                <Badge className="ml-1.5 text-[9px] bg-amber-100 text-amber-700 px-1">{usuariosSemPerfil} âš </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sod" data-action="RBAC.tab.sod" data-permission="Sistema.Controle de Acesso.visualizar" className="text-xs px-2.5 sm:px-4 py-1.5 whitespace-nowrap rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              SoD
            </TabsTrigger>
            <TabsTrigger value="relatorios" data-action="RBAC.tab.relatorios" data-permission="Sistema.Controle de Acesso.visualizar" className="text-xs px-2.5 sm:px-4 py-1.5 whitespace-nowrap rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <BarChart3 className="w-3.5 h-3.5 mr-1" />
              RelatÃ³rios
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

