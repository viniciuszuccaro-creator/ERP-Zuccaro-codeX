import React from "react";
import RepresentanteFormCompleto from "@/components/cadastros/RepresentanteFormCompleto";

/**
 * Adapter canônico → RepresentanteFormCompleto.
 * Preserva imports/aliases legados (representante/item/data) sem store paralelo.
 * Capacidades do Completo (código+ID, self-managed, scope guard) permanecem.
 */
export default function RepresentanteForm({
  representante,
  item,
  data,
  initialData,
  defaultValues,
  isOpen,
  onClose,
  onSuccess,
  onSave,
  onSubmit,
  isSubmitting,
  windowMode = false,
}) {
  const registro = representante || item || data || initialData || defaultValues || null;
  return (
    <RepresentanteFormCompleto
      representante={registro}
      item={item || registro}
      data={data || registro}
      initialData={initialData || registro}
      defaultValues={defaultValues || registro}
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      onSave={onSave}
      onSubmit={onSubmit}
      windowMode={windowMode}
      isSubmitting={isSubmitting}
    />
  );
}

RepresentanteForm.isSelfManagedCadastro = true;
RepresentanteForm.displayName = "RepresentanteForm";
