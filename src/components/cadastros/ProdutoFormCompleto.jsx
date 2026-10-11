import React from "react";
import ProdutoFormV22_Completo from "@/components/cadastros/ProdutoFormV22_Completo";

/**
 * Adapter legado → ProdutoFormV22_Completo canônico (Bloco2 / VisualizadorProdutos).
 * Preserva aliases produto/item/data e onProdutosCriados → onSuccess.
 * Abas/importação NFe-lote ficam no V22 canônico.
 */
function ProdutoFormCompleto({
  produto,
  item,
  data,
  initialData,
  defaultValues,
  onSubmit,
  onSuccess,
  isSubmitting,
  onProdutosCriados,
  windowMode = false,
  closeSelf,
}) {
  const registro = produto || item || data || initialData || defaultValues || null;
  return (
    <ProdutoFormV22_Completo
      produto={registro}
      item={item || registro}
      data={data || registro}
      onSubmit={onSubmit}
      onSuccess={onSuccess || onProdutosCriados}
      isSubmitting={isSubmitting}
      windowMode={windowMode}
      closeSelf={closeSelf}
    />
  );
}

ProdutoFormCompleto.displayName = "ProdutoFormCompleto";
ProdutoFormCompleto.isSelfManagedCadastro = true;

export default ProdutoFormCompleto;
