import React from "react";
import { Package } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import VisualizadorUniversalEntidade from "@/components/cadastros/VisualizadorUniversalEntidade";
import CadastroFornecedorCompleto from "@/components/cadastros/CadastroFornecedorCompleto";

export default function FornecedoresTab({ fornecedores, windowMode = false }) {
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;

  const content = (
    <div
      className="w-full h-full"
      data-permission="Compras.Fornecedores.visualizar"
      data-context-required="group-or-company"
      data-context-mode={contexto}
      data-group-id={groupId || ""}
      data-empresa-id={empresaId || ""}
    >
      <VisualizadorUniversalEntidade
        nomeEntidade="Fornecedor"
        tituloDisplay="Fornecedores"
        icone={Package}
        camposPrincipais={["nome","razao_social","cnpj","categoria","status","telefone","email"]}
        componenteEdicao={CadastroFornecedorCompleto}
        queryKey={["fornecedores"]}
        windowMode={windowMode}
      />
    </div>
  );

  if (windowMode) {
    return (
      <div
        className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-cyan-50 overflow-auto p-1.5"
        data-permission="Compras.Fornecedores.visualizar"
        data-context-required="group-or-company"
      >
        {content}
      </div>
    );
  }

  return content;
}
