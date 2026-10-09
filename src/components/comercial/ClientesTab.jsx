import React from "react";
import { Users } from "lucide-react";
import VisualizadorUniversalEntidadeV24 from "@/components/cadastros/VisualizadorUniversalEntidadeV24";
import CadastroClienteCompleto from "@/components/cadastros/CadastroClienteCompleto";

/**
 * Aba Clientes do Comercial — reutiliza o Visualizador V24 dos Cadastros
 * (scope groupId/empresaId no queryKey, RBAC fail-closed, sem placeholder stale).
 */
export default function ClientesTab({ windowMode = false }) {
  return (
    <div className="w-full h-full" data-comercial-clientes-tab="v24">
      <VisualizadorUniversalEntidadeV24
        nomeEntidade="Cliente"
        tituloDisplay="Clientes"
        icone={Users}
        camposPrincipais={["nome", "razao_social", "cnpj", "cpf", "status", "email", "telefone", "endereco_principal"]}
        componenteEdicao={CadastroClienteCompleto}
        windowMode={windowMode}
      />
    </div>
  );
}
