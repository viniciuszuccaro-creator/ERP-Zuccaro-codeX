import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import DashboardSeguranca from "@/components/sistema/DashboardSeguranca";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function SegurancaDashboard() {
  const { filterInContext, contexto, empresasDoGrupo = [], empresaAtual, grupoAtual } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const canView =
    isAdmin() ||
    hasPermission("Sistema", "Seguranca", "visualizar") ||
    hasPermission("Sistema", "Segurança", "visualizar");
  const scopeKey = empresaAtual?.id || grupoAtual?.id || "sem-contexto";

  const usuarioNoEscopo = React.useCallback((usuario = {}) => {
    if (!usuario) return false;
    if (contexto === "grupo") {
      const empresasIds = empresasDoGrupo.map((empresa) => empresa.id).filter(Boolean);
      const vinculadas = Array.isArray(usuario.empresas_vinculadas) ? usuario.empresas_vinculadas : [];
      return usuario.group_id === grupoAtual?.id ||
        usuario.grupo_id === grupoAtual?.id ||
        usuario.grupo_atual_id === grupoAtual?.id ||
        vinculadas.some((v) => empresasIds.includes(v?.empresa_id || v?.id || v));
    }
    return !empresaAtual?.id ||
      usuario.empresa_id === empresaAtual.id ||
      usuario.empresa_atual_id === empresaAtual.id ||
      (Array.isArray(usuario.empresas_vinculadas) && usuario.empresas_vinculadas.some((v) => (v?.empresa_id || v?.id || v) === empresaAtual.id));
  }, [contexto, empresasDoGrupo, empresaAtual?.id, grupoAtual?.id]);

  const { data = {} } = useQuery({
    queryKey: ["seguranca-dashboard-real", scopeKey],
    enabled: canView,
    queryFn: async () => {
      const [usuariosRaw, perfis, auditoriaAcessos] = await Promise.all([
        base44.entities.User.list("-updated_date", 500),
        filterInContext("PerfilAcesso", {}, "-updated_date", 500),
        filterInContext("AuditLog", {}, "-data_hora", 100),
      ]);
      const usuarios = (usuariosRaw || []).filter(usuarioNoEscopo);
      const usuariosComPerfil = usuarios.filter((usuario) => usuario.perfil_acesso_id).length;
      return {
        usuarios,
        perfis,
        auditoriaAcessos,
        estatisticas: {
          cobertura: usuarios.length ? Math.round((usuariosComPerfil / usuarios.length) * 100) : 0,
          totalUsuarios: usuarios.length,
          conflitosTotal: auditoriaAcessos.filter((item) => String(item?.acao || item?.descricao || "").toLowerCase().includes("conflito")).length,
        },
      };
    },
  });

  if (!canView) {
    return <div className="w-full h-full p-4 text-sm text-slate-500">Acesso restrito.</div>;
  }

  return (
    <div className="w-full h-full" data-permission="Sistema.Seguranca.visualizar">
      <DashboardSeguranca
        estatisticas={data.estatisticas || { cobertura: 0, totalUsuarios: 0, conflitosTotal: 0 }}
        perfis={data.perfis || []}
        usuarios={data.usuarios || []}
        auditoriaAcessos={data.auditoriaAcessos || []}
      />
    </div>
  );
}
