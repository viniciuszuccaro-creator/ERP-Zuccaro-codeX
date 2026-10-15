import React from "react";
import EmpresaForm from "@/components/cadastros/EmpresaForm";

/**
 * Adapter legado → EmpresaForm canônico (Bloco5).
 * Preserva imports/aliases (empresa/item/data) e props de carga incompleta.
 * Capacidades fiscais/webhooks/certificado/endereço ficam no form canônico.
 * Status/delete/IA do Completo antigo: Bloco5 usa EmpresaForm; Visualizador trata delete.
 */
export default function EmpresaFormCompleto({
  empresa,
  item,
  data,
  initialData,
  defaultValues,
  onSubmit,
  isSubmitting,
  windowMode = false,
  loadIncomplete = false,
  isLoadingRecord = false,
}) {
  const registro = empresa || item || data || initialData || defaultValues || null;
  return (
    <EmpresaForm
      empresa={registro}
      item={item || registro}
      data={data || registro}
      initialData={initialData || registro}
      defaultValues={defaultValues || registro}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      windowMode={windowMode}
      loadIncomplete={loadIncomplete}
      isLoadingRecord={isLoadingRecord}
    />
  );
}

EmpresaFormCompleto.displayName = "EmpresaFormCompleto";
