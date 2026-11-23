import ClienteConferenciaLegado from './ClienteConferenciaLegado';
import React, { useState } from "react";
import { Users } from "lucide-react";
import VisualizadorUniversalEntidadeV24 from "@/components/cadastros/VisualizadorUniversalEntidadeV24";
import CadastroClienteCompleto from "@/components/cadastros/CadastroClienteCompleto";

/**
 * Aba Clientes do Comercial — reutiliza o Visualizador V24 dos Cadastros
 * (scope groupId/empresaId no queryKey, RBAC fail-closed, sem placeholder stale).
 */
export default function ClientesTab({ windowMode = false, initialClienteId = undefined, navigationReceipt = undefined, reopenRequestId = undefined }) {
  const [conferencia, setConferencia] = useState(() => new URLSearchParams(window.location.search).get('conferencia_legado') === '1');
  if (conferencia) return <div className="w-full h-full p-4"><button type="button" onClick={() => setConferencia(false)}>Voltar aos clientes</button><ClienteConferenciaLegado /></div>;
  return (
    <div className="w-full h-full" data-comercial-clientes-tab="v24">
      <button type="button" className="m-2 rounded border border-blue-200 px-3 py-2 text-blue-700" onClick={() => setConferencia(true)}>Conferir coorte legada</button>
      <VisualizadorUniversalEntidadeV24
        nomeEntidade="Cliente"
        tituloDisplay="Clientes"
        icone={Users}
        camposPrincipais={["nome", "razao_social", "cnpj", "cpf", "status", "email", "telefone", "endereco_principal"]}
        componenteEdicao={CadastroClienteCompleto}
        windowMode={windowMode}
        initialRecordId={initialClienteId}
        navigationReceipt={navigationReceipt}
        reopenRequestId={reopenRequestId}
      />
    </div>
  );
}
