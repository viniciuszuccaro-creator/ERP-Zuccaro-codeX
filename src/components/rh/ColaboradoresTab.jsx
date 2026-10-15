import React from "react";
import { Users } from "lucide-react";
import VisualizadorUniversalEntidadeV24 from "@/components/cadastros/VisualizadorUniversalEntidadeV24";
import ColaboradorForm from "@/components/rh/ColaboradorForm";

export default function ColaboradoresTab({ windowMode = false }) {
  return (
    <div className="w-full h-full" data-rh-colaboradores-tab="v24">
      <VisualizadorUniversalEntidadeV24
        nomeEntidade="Colaborador"
        tituloDisplay="Colaboradores"
        icone={Users}
        camposPrincipais={["nome_completo","cpf","email","cargo","departamento","status"]}
        componenteEdicao={ColaboradorForm}
        windowMode={windowMode}
      />
    </div>
  );
}