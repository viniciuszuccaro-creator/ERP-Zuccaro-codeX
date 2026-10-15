import React from "react";
import CadastroClienteCompleto from "@/components/cadastros/CadastroClienteCompleto";

/**
 * Adapter legado comercial → CadastroClienteCompleto canônico.
 * Preserva import ClienteForm sem formulário paralelo.
 */
export default function ClienteForm({
  cliente,
  item,
  data,
  initialData,
  defaultValues,
  onSubmit,
  isSubmitting,
  onCancel,
  windowMode = false,
}) {
  const registro = cliente || item || data || initialData || defaultValues || null;
  return (
    <CadastroClienteCompleto
      cliente={registro}
      item={item || registro}
      data={data || registro}
      onSubmit={onSubmit}
      onSave={onSubmit}
      onClose={onCancel}
      onSuccess={onCancel}
      isSubmitting={isSubmitting}
      windowMode={windowMode}
    />
  );
}

ClienteForm.displayName = "ClienteForm";
ClienteForm.isSelfManagedCadastro = true;
