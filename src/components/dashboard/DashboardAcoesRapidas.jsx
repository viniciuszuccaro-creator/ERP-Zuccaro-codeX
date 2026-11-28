import React from "react";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  DollarSign,
  Package,
  Truck,
  Factory,
  Database,
  FileBarChart,
} from "lucide-react";
import { createPageUrl } from "@/utils";

/**
 * DashboardAcoesRapidas — barra compacta de atalhos úteis (referência erp-integra-novo),
 * preservando rotas existentes e respeitando RBAC + contexto ativo.
 */
export default function DashboardAcoesRapidas({
  hasContextoAtivo = false,
  canSeeComercial = false,
  canSeeFinanceiro = false,
  canSeeEstoque = false,
  canSeeExpedicao = false,
  canSeeProducao = false,
  canSeeCadastros = false,
  canSeeRelatorios = false,
  relatoriosUrl = "",
  onNavigate,
}) {
  const shortcuts = [
    {
      key: "comercial",
      label: "Comercial",
      icon: ShoppingCart,
      allowed: canSeeComercial,
      permission: "Comercial.visualizar",
      url: createPageUrl("Comercial"),
      accent: "text-blue-700 border-blue-200 hover:bg-blue-50",
    },
    {
      key: "financeiro",
      label: "Financeiro",
      icon: DollarSign,
      allowed: canSeeFinanceiro,
      permission: "Financeiro.visualizar",
      url: createPageUrl("Financeiro"),
      accent: "text-emerald-700 border-emerald-200 hover:bg-emerald-50",
    },
    {
      key: "estoque",
      label: "Estoque",
      icon: Package,
      allowed: canSeeEstoque,
      permission: "Estoque.visualizar",
      url: createPageUrl("Estoque"),
      accent: "text-amber-800 border-amber-200 hover:bg-amber-50",
    },
    {
      key: "expedicao",
      label: "Expedição",
      icon: Truck,
      allowed: canSeeExpedicao,
      permission: "Expedicao.visualizar",
      url: createPageUrl("Expedicao"),
      accent: "text-sky-700 border-sky-200 hover:bg-sky-50",
    },
    {
      key: "producao",
      label: "Produção",
      icon: Factory,
      allowed: canSeeProducao,
      permission: "Producao.visualizar",
      url: createPageUrl("Producao"),
      accent: "text-purple-700 border-purple-200 hover:bg-purple-50",
    },
    {
      key: "cadastros",
      label: "Cadastros Gerais",
      icon: Database,
      allowed: canSeeCadastros,
      permission: "Cadastros.visualizar",
      url: createPageUrl("Cadastros"),
      accent: "text-slate-700 border-slate-200 hover:bg-slate-50",
    },
    {
      key: "relatorios",
      label: "Relatórios do Período",
      icon: FileBarChart,
      allowed: canSeeRelatorios,
      permission: "Relatorios.visualizar",
      url: relatoriosUrl || createPageUrl("Relatorios"),
      accent: "text-indigo-700 border-indigo-200 hover:bg-indigo-50",
    },
  ].filter((item) => item.allowed);

  if (shortcuts.length === 0) return null;

  return (
    <nav
      aria-label="Atalhos rápidos do Dashboard"
      data-block="dashboard-acoes-rapidas"
      className="w-full flex flex-wrap items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm"
    >
      <span className="text-xs font-semibold text-slate-500 mr-1">Atalhos:</span>
      {shortcuts.map(({ key, label, icon: Icon, permission, url, accent }) => (
        <Button
          key={key}
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasContextoAtivo}
          onClick={() => typeof onNavigate === "function" && onNavigate(url)}
          className={`h-7 px-2.5 text-xs bg-white ${accent}`}
          data-action={`Dashboard.atalho.${key}`}
          data-permission={permission}
          data-context-required="true"
        >
          <Icon className="w-3.5 h-3.5 mr-1.5 shrink-0" aria-hidden />
          {label}
        </Button>
      ))}
    </nav>
  );
}
