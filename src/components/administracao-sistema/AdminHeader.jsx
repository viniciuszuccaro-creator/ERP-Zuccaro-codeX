import React from "react";
import { Settings, Building2, Users, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";

export default function AdminHeader() {
  const { empresaAtual, grupoAtual, estaNoGrupo } = useContextoVisual();
  const { user } = useUser();

  const contextoLabel = estaNoGrupo
    ? (grupoAtual?.nome_do_grupo || "Grupo Empresarial")
    : (empresaAtual?.nome_fantasia || empresaAtual?.razao_social || "Empresa não selecionada");

  const contextoColor = estaNoGrupo ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700";

  return (
    <header className="px-4 md:px-6 py-4 border-b bg-white/90 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">
              Administração do Sistema
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Hub central de configurações • multiempresa • RBAC
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Contexto atual */}
          <Badge className={`${contextoColor} flex items-center gap-1.5 px-2 py-1 text-xs font-medium`}>
            {estaNoGrupo ? <Users className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
            {contextoLabel}
          </Badge>

          {/* Role do usuário */}
          {user?.role === 'admin' && (
            <Badge className="bg-purple-100 text-purple-700 flex items-center gap-1.5 px-2 py-1 text-xs">
              <Shield className="w-3 h-3" />
              Administrador
            </Badge>
          )}
        </div>
      </div>
    </header>
  );
}