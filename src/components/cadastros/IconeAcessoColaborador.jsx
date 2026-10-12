import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserCircle, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PainelDinamicoColaborador from "./PainelDinamicoColaborador";

export default function IconeAcessoColaborador({ colaborador, variant = "default" }) {
  const [painelAberto, setPainelAberto] = useState(false);

  if (!colaborador) return null;

  if (variant === "inline") {
    return (
      <>
        <button
          onClick={() => setPainelAberto(true)}
          className="text-sky-600 hover:text-sky-700 hover:underline font-medium text-sm"
        >
          {colaborador.nome_completo}
        </button>
        <PainelDinamicoColaborador
          colaborador={colaborador}
          isOpen={painelAberto}
          onClose={() => setPainelAberto(false)}
        />
      </>
    );
  }

  if (variant === "badge") {
    return (
      <>
        <Badge
          variant="outline"
          className="cursor-pointer hover:bg-sky-50 transition-colors"
          onClick={() => setPainelAberto(true)}
        >
          <UserCircle className="w-3 h-3 mr-1" />
          {colaborador.nome_completo}
        </Badge>
        <PainelDinamicoColaborador
          colaborador={colaborador}
          isOpen={painelAberto}
          onClose={() => setPainelAberto(false)}
        />
      </>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setPainelAberto(true)}
        title="Ver detalhes do colaborador"
      >
        <Eye className="w-4 h-4" />
      </Button>
      <PainelDinamicoColaborador
        colaborador={colaborador}
        isOpen={painelAberto}
        onClose={() => setPainelAberto(false)}
      />
    </>
  );
}