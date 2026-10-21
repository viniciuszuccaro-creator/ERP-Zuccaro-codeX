import React from "react";

/** @param {{title?: React.ReactNode, subtitle?: React.ReactNode, actions?: React.ReactNode,
 * children?: React.ReactNode, className?: string}} props */
export default function ModuleHeader({ title, subtitle, actions, children, className = "" }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-2 px-1.5 ${className}`}>
      <div className="min-w-0">
        {title && (
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 leading-tight truncate">{title}</h1>
        )}
        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5 truncate">{subtitle}</p>
        )}
        {!title && children}
      </div>
      {actions && (
        <div className="flex items-center gap-2 ml-auto">{actions}</div>
      )}
      {/* Quando title é fornecido, children podem conter controles extras abaixo do header */}
      {title && children && (
        <div className="w-full mt-2">{children}</div>
      )}
    </div>
  );
}
