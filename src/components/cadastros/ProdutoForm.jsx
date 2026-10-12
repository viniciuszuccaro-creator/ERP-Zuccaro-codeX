import React from "react";
import ProdutoFormV22_Completo from "@/components/cadastros/ProdutoFormV22_Completo";

/**
 * Adapter legado → ProdutoFormV22_Completo canônico.
 * Preserva aliases produto/item/data e onProdutosCriados → onSuccess.
 * Tipo/produção ficam no seletor canônico tipo_item do V22 (sem store paralelo).
 */
function ProdutoForm({
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

ProdutoForm.displayName = "ProdutoForm";
ProdutoForm.isSelfManagedCadastro = true;

export default ProdutoForm;
