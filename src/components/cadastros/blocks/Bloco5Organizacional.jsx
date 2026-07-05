import React, { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWindow } from "@/components/lib/useWindow";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { useToast } from "@/components/ui/use-toast";
import VisualizadorUniversalEntidadeV24 from "@/components/cadastros/VisualizadorUniversalEntidadeV24";
import { Building2, Spline, Users, Briefcase, Clock, Shield } from "lucide-react";
import CountBadgeSimplificado from "@/components/cadastros/CountBadgeSimplificado";

import GrupoEmpresarialForm from "@/components/cadastros/GrupoEmpresarialForm";
import EmpresaForm from "@/components/cadastros/EmpresaForm";
import DepartamentoForm from "@/components/cadastros/DepartamentoForm";
import CargoForm from "@/components/cadastros/CargoForm";
import TurnoForm from "@/components/cadastros/TurnoForm";
import PerfilAcessoForm from "@/components/cadastros/PerfilAcessoForm";

function filterTiles(tiles, searchTerm) {
  const q = String(searchTerm || "").trim().toLowerCase();
  if (!q) return tiles;
  return tiles.filter(({ k, t }) => `${k} ${t}`.toLowerCase().includes(q));
}

export default function Bloco5Organizacional({ allCounts, isLoading, searchTerm = "" }) {
  const { openWindow } = useWindow();
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { user } = useUser();
  const { toast } = useToast();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);

  const getTotalEntidade = (entidade) => Number(allCounts?.[entidade] || 0);

  const getDadosContexto = () => ({
    bloco: "Estrutura Organizacional",
    contexto: grupoAtual?.id ? "grupo" : empresaAtual?.id ? "empresa" : "sem-contexto",
    contexto_valido: contextoValido,
    group_id: groupId,
    empresa_id: empresaId,
    empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
    grupo_nome: grupoAtual?.nome || grupoAtual?.nome_grupo || null,
  });

  const registrarAuditoria = async (entidade, acao, sucesso = true, extras = {}) => {
    try {
      await createInContext("AuditLog", {
        usuario_id: user?.id,
        usuario: user?.full_name || user?.email || "Usuario",
        acao,
        modulo: "Cadastros",
        entidade,
        tipo_auditoria: sucesso ? "acesso" : "seguranca",
        descricao: `${acao} em cadastro de estrutura organizacional: ${entidade}`,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        dados_novos: {
          ...getDadosContexto(),
          entidade,
          permissao: `Cadastros.${entidade}.visualizar`,
          permissao_alternativa: `Sistema.${entidade}.visualizar`,
          total_entidade: getTotalEntidade(entidade),
          contexto_exigido: entidade === "GrupoEmpresarial" ? "grupo" : "group-or-company",
          ...(extras || {}),
        },
        data_hora: new Date().toISOString(),
        sucesso,
      });
    } catch (_) {}
  };

  const openList = (entidade, titulo, Icon, campos, FormComp) => () => {
    if (!contextoValido && entidade !== "GrupoEmpresarial") {
      toast({
        title: "Selecione grupo ou empresa",
        description: "Cadastros organizacionais precisam de contexto ativo para abrir.",
        variant: "destructive",
      });
      registrarAuditoria(entidade, "Bloqueio sem contexto", false, { motivo: "contexto_obrigatorio", titulo });
      return;
    }
    if (!canViewEntity(entidade)) {
      toast({
        title: "Acesso negado",
        description: "Seu perfil nao possui permissao para visualizar este cadastro.",
        variant: "destructive",
      });
      registrarAuditoria(entidade, "Bloqueio por permissao", false, { motivo: "permissao_negada", titulo });
      return;
    }
    registrarAuditoria(entidade, "Visualizacao", true, { titulo, campos_principais: campos, visualizador: "VisualizadorUniversalEntidadeV24", window_mode: true });
    openWindow(VisualizadorUniversalEntidadeV24, { nomeEntidade: entidade, tituloDisplay: titulo, icone: Icon, camposPrincipais: campos, componenteEdicao: FormComp, windowMode: true }, { title: titulo, width: 1400, height: 800 });
  };

  // Campos reais de cada entidade (sem alias — getDisplayValue faz fallback)
  const tiles = [
    { k: 'GrupoEmpresarial', t: 'Grupos Empresariais', i: Building2, c: ['nome','cnpj','descricao'],                              f: GrupoEmpresarialForm },
    { k: 'Empresa',          t: 'Empresas',             i: Spline,    c: ['razao_social','nome_fantasia','cnpj','cidade'],          f: EmpresaForm },
    { k: 'Departamento',     t: 'Departamentos',        i: Users,     c: ['nome','descricao'],                                     f: DepartamentoForm },
    { k: 'Cargo',            t: 'Cargos',               i: Briefcase, c: ['nome','nome_cargo','descricao','nivel_hierarquico'],   f: CargoForm },
    { k: 'Turno',            t: 'Turnos',               i: Clock,     c: ['nome','nome_turno','horario_inicio','horario_fim'],     f: TurnoForm },
    { k: 'PerfilAcesso',     t: 'Perfis de Acesso',     i: Shield,    c: ['nome_perfil','nivel_perfil','descricao','ativo'],        f: PerfilAcessoForm },
  ];
  const filteredTiles = filterTiles(tiles, searchTerm);

  useEffect(() => {
    const termo = String(searchTerm || "").trim().replace(/\s+/g, " ").slice(0, 120);
    if (termo.length < 3) return;
    void registrarAuditoria("Bloco5Organizacional", "Filtro aplicado", contextoValido, {
      termo,
      total_itens_bloco: tiles.length,
      total_itens_filtrados: filteredTiles.length,
      entidades_filtradas: filteredTiles.map(({ k }) => k),
      motivo: contextoValido ? null : "contexto_obrigatorio",
    });
  }, [searchTerm, contextoValido, filteredTiles.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const canViewEntity = (entidade) =>
    hasPermission("Cadastros", entidade, "visualizar") ||
    hasPermission("Cadastros", null, "visualizar") ||
    hasPermission("Sistema", entidade, "visualizar") ||
    hasPermission("Sistema", null, "visualizar");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      <Card className="rounded-sm shadow-sm border bg-white/80 backdrop-blur">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b rounded-t-sm">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-700"/> Estrutura Organizacional
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 text-sm text-slate-600">
          {contextoValido ? "Total consolidado do grupo/empresa." : "Selecione grupo ou empresa para abrir a estrutura organizacional."}
        </CardContent>
      </Card>

      {filteredTiles.map(({ k, t, i: Icon, c, f: FormComp }) => (
        <Card key={k} className="rounded-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group border"
          onClick={openList(k, t, Icon, c, FormComp)}
          data-permission={`Cadastros.${k}.visualizar`}
          data-action={`Cadastros.${k}.abrir`}
          data-context-required={k === "GrupoEmpresarial" ? "group" : "group-or-company"}>
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                <div className="p-1.5 rounded-sm bg-orange-50 group-hover:bg-orange-100 transition-colors">
                  <Icon className="w-4 h-4 text-orange-600" />
                </div>
                {t}
                <CountBadgeSimplificado entities={[k]} allCounts={allCounts} isLoading={isLoading} />
              </CardTitle>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 rounded-sm text-xs h-7"
                onClick={(e) => { e.stopPropagation(); openList(k, t, Icon, c, FormComp)(); }}
                disabled={(!contextoValido && k !== "GrupoEmpresarial") || !canViewEntity(k)}
                data-permission={`Cadastros.${k}.visualizar`}
                data-action={`Cadastros.${k}.abrir`}
                data-context-required={k === "GrupoEmpresarial" ? "group" : "group-or-company"}>
                Abrir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 text-xs text-slate-500">Clique para listar, criar e editar.</CardContent>
        </Card>
      ))}
    </div>
  );
}
