import React from "react";
import { Button } from "@/components/ui/button";
import { Users, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PainelDinamicoCliente from "./PainelDinamicoCliente";
import { useWindow } from "@/components/lib/useWindow";

function openClientePainel(openWindow, cliente) {
  const id = cliente?.id != null ? String(cliente.id) : "";
  const titleName = cliente?.nome || cliente?.razao_social || "Cliente";
  openWindow(
    PainelDinamicoCliente,
    { cliente, windowMode: true },
    {
      title: `Cliente: ${titleName}`,
      width: 1200,
      height: 700,
      // Evita janelas duplicadas do mesmo cliente (abertura repetida / variants).
      uniqueKey: id ? `painel-cliente-${id}` : `painel-cliente-sem-id-${titleName}`,
    },
  );
}

export default function IconeAcessoCliente({ cliente, variant = "default" }) {
  const { openWindow } = useWindow();

  if (!cliente) return null;

  if (variant === "inline") {
    return (
      <button
        type="button"
        data-action="cadastros-icone-cliente-abrir"
        onClick={() => openClientePainel(openWindow, cliente)}
        className="text-blue-600 hover:text-blue-700 hover:underline font-medium text-sm"
      >
        {cliente.nome || cliente.razao_social}
      </button>
    );
  }

  if (variant === "badge") {
    return (
      <Badge
        variant="outline"
        className="cursor-pointer hover:bg-blue-50 transition-colors"
        data-action="cadastros-icone-cliente-abrir"
        onClick={() => openClientePainel(openWindow, cliente)}
      >
        <Users className="w-3 h-3 mr-1" />
        {cliente.nome || cliente.razao_social}
      </Badge>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      data-action="cadastros-icone-cliente-abrir"
      onClick={() => openClientePainel(openWindow, cliente)}
      title="Ver detalhes do cliente"
    >
      <Eye className="w-4 h-4" />
    </Button>
  );
}
