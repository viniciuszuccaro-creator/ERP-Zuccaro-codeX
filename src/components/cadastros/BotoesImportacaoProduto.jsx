import React from "react";
import { Button } from "@/components/ui/button";
import { useWindow } from "@/components/lib/useWindow";
import { FileText } from "lucide-react";
import ImportacaoProdutoNFe from "./ImportacaoProdutoNFe";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { toast } from "sonner";

/**
 * V21.1.2-R2 - Botões de Importação de Produtos
 * ✅ Via NF-e
 * (Importação em lote e ERP mapeado desativadas temporariamente a pedido do cliente)
 */
export default function BotoesImportacaoProduto({ onProdutosCriados }) {
  const { openWindow } = useWindow();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { canCreate } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeImportarProduto = canCreate("Cadastros", "Produto") || canCreate("Estoque", "Produto") || canCreate("Cadastros", null);

  const auditarAberturaImportacao = async (acao, sucesso = true, motivo = null) => {
    try {
      await createInContext("AuditLog", {
        acao,
        modulo: "Cadastros",
        entidade: "Produto",
        tipo_auditoria: sucesso ? "cadastro" : "seguranca",
        descricao: motivo || "Abertura de importacao de produtos via NF-e.",
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId,
        dados_novos: {
          origem: "BotoesImportacaoProduto",
          fluxo: "ImportacaoProdutoNFe",
        },
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (_) {}
  };

  const abrirImportacaoNFe = async () => {
    if (!contextoValido) {
      await auditarAberturaImportacao("Cadastros.Produto.importacao_nfe.bloqueada_contexto", false, "Grupo ou empresa obrigatorio para importar produtos.");
      toast.error("Selecione um grupo ou empresa antes de importar produtos.");
      return;
    }

    if (!podeImportarProduto) {
      await auditarAberturaImportacao("Cadastros.Produto.importacao_nfe.negada", false, "Permissao negada para importar produtos.");
      toast.error("Sem permissao para importar produtos.");
      return;
    }

    await auditarAberturaImportacao("Cadastros.Produto.importacao_nfe.aberta");
    openWindow(
      ImportacaoProdutoNFe,
      { windowMode: true, onProdutosCriados: (produtos) => { onProdutosCriados && onProdutosCriados(produtos); } },
      { title: 'Importar Produtos via NF-e', width: 1100, height: 800 }
    );
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap" data-context-required="group-or-company" data-permission="Cadastros.Produto.importar">
        <Button
          variant="outline"
          onClick={abrirImportacaoNFe}
          disabled={!contextoValido || !podeImportarProduto}
          className="border-purple-300 hover:bg-purple-50"
          data-permission="Cadastros.Produto.importar"
          data-action="Cadastros.Produto.importar-nfe"
          data-context-required="group-or-company"
        >
          <FileText className="w-4 h-4 mr-2" />
          Importar via NF-e
        </Button>
        

      </div>






    </>
  );
}
