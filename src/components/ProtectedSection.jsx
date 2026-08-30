import React from "react";
import usePermissions from "@/components/lib/usePermissions";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

// ProtectedSection: esconde (por padrão) blocos inteiros quando não há permissão
export default function ProtectedSection({
  children,
  module,
  section = null,
  action = "ver",
  mode = "hide", // "hide" | "disable"
  auditDenied = true,
  auditMetadata = null,
}) {
  const { hasPermission, isLoading } = usePermissions();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  if (isLoading) return null;

  const allowed = hasPermission(module, section, action);
  if (allowed) return <>{children}</>;

  if (auditDenied) {
    try {
      base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuário",
        usuario_id: user?.id,
        empresa_id: empresaAtual?.id || null,
        empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
        acao: "Bloqueio",
        modulo: module,
        entidade: section || "-",
        descricao: `Acesso negado à seção: ${module}/${section || "-"}/${action}`,
        dados_novos: {
          ...(auditMetadata || {}),
          contexto: contexto || 'empresa',
          group_id: grupoAtual?.id || null,
          page: typeof window !== 'undefined' ? window?.location?.pathname : undefined,
          url: typeof window !== 'undefined' ? window?.location?.href : undefined,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          headers_snapshot: {
            'x-company-id': empresaAtual?.id || null,
            'x-tenant-id': (contexto === 'grupo' ? grupoAtual?.id : empresaAtual?.id) || null,
            'x-scope': contexto || 'empresa',
          },
        },
      });
    } catch (error) {
      console.error('[Auditoria] Falha ao registrar secao negada.', error);
    }
  }

  if (mode === "disable") {
    return <div className="w-full h-full opacity-50 pointer-events-none select-none" aria-disabled="true">{children}</div>;
  }
  return null;
}
