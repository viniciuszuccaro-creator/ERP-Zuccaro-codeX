import React from "react";
import CadastroClienteCompleto from "@/components/cadastros/CadastroClienteCompleto";

/**
 * Adapter legado comercial → CadastroClienteCompleto canônico (Bloco1 / ClientesTab).
 * Preserva props cliente/onSubmit/onCancel sem store paralelo.
 */
function ClienteFormCompleto({
  cliente,
  item,
  data,
  initialData,
  defaultValues,
  onSubmit,
  onSave,
  onCancel,
  onClose,
  onSuccess,
  isSubmitting,
  windowMode = false,
  isOpen,
}) {
  const registro = cliente || item || data || initialData || defaultValues || null;
  return (
    <CadastroClienteCompleto
      cliente={registro}
      item={item || registro}
      data={data || registro}
      initialData={initialData || registro}
      defaultValues={defaultValues || registro}
      onSubmit={onSubmit}
      onSave={onSave || onSubmit}
      onClose={onClose || onCancel}
      onSuccess={onSuccess || onCancel}
      isSubmitting={isSubmitting}
      windowMode={windowMode}
      isOpen={isOpen}
    />
  );
}

ClienteFormCompleto.displayName = "ClienteFormCompleto";
ClienteFormCompleto.isSelfManagedCadastro = true;

export default React.memo(ClienteFormCompleto);
