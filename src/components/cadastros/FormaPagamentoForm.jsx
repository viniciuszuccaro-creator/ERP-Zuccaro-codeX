import React from "react";
import FormaPagamentoFormCompleto from "@/components/cadastros/FormaPagamentoFormCompleto";

/**
 * Adapter canônico → FormaPagamentoFormCompleto.
 * Preserva imports/referências legadas (forma/item/data) sem store paralelo.
 * Capacidades do Completo (abas, codigo+ID, bancos/gateways) permanecem.
 */
export default function FormaPagamentoForm({
  forma,
  formaPagamento,
  item,
  data,
  initialData,
  defaultValues,
  onSubmit,
  onSave,
  onClose,
  isSubmitting,
  windowMode = false,
}) {
  const registro = formaPagamento || forma || item || data || initialData || defaultValues || null;
  return (
    <FormaPagamentoFormCompleto
      formaPagamento={registro}
      item={item || registro}
      data={data || registro}
      onSubmit={onSubmit}
      onSave={onSave}
      onClose={onClose}
      windowMode={windowMode}
      isSubmitting={isSubmitting}
    />
  );
}
