import React from "react";
import TabelaPrecoFormCompleto from "@/components/cadastros/TabelaPrecoFormCompleto";

/**
 * Adapter canônico → TabelaPrecoFormCompleto.
 * Preserva imports/aliases legados (tabela/item/data) sem store paralelo.
 * Bloco2 e Ações Rápidas já usam o Completo diretamente.
 */
export default function TabelaPrecoForm({
  tabela,
  item,
  data,
  initialData,
  defaultValues,
  onSubmit,
  isSubmitting,
  windowMode = false,
}) {
  const registro = tabela || item || data || initialData || defaultValues || null;
  return (
    <TabelaPrecoFormCompleto
      tabela={registro}
      onSubmit={onSubmit}
      windowMode={windowMode}
      isSubmitting={isSubmitting}
    />
  );
}
