import React from "react";
import { Button } from "@/components/ui/button";
import { FileText, Upload } from "lucide-react";

export default function ProdutoFormHeader({ produto, onImportarNFe, onImportarLote, disabledImportacoes = false }) {
  return (
    <div className="flex justify-between items-center w-full">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          {produto ? `Editar: ${produto.descricao}` : 'Novo Produto'}
        </h2>
        <p className="text-sm text-slate-600">V21.1.2-R2 - Cadastro Avançado com IA</p>
      </div>

      {!produto && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onImportarNFe}
            disabled={disabledImportacoes}
            className="border-purple-300"
            data-permission="Cadastros.Produto.criar"
            data-action="importar-produto-nfe"
            data-sensitive
          >
            <FileText className="w-4 h-4 mr-2" />
            Via NF-e
          </Button>
          <Button
            variant="outline"
            onClick={onImportarLote}
            disabled={disabledImportacoes}
            className="border-green-300"
            data-permission="Cadastros.Produto.criar"
            data-action="importar-produto-lote"
            data-sensitive
          >
            <Upload className="w-4 h-4 mr-2" />
            Em Lote
          </Button>
        </div>
      )}
    </div>
  );
}
