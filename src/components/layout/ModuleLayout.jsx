import React from "react";
import ModuleHeader from "@/components/layout/ModuleHeader";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/** @param {{title: React.ReactNode, subtitle?: React.ReactNode, actions?: React.ReactNode,
 * children: React.ReactNode, className?: string}} props */
export default function ModuleLayout({ title, subtitle, actions, children, className = "" }) {
  const { empresaAtual } = useContextoVisual();
  return (
    <div className={`w-full h-full flex flex-col ${className}`}>
      <ModuleHeader>
        <div className="flex items-center justify-between w-full">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-slate-600 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {empresaAtual?.nome_fantasia && (
              <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 border">{empresaAtual.nome_fantasia}</span>
            )}
            {actions}
          </div>
        </div>
      </ModuleHeader>
      {children}
    </div>
  );
}
