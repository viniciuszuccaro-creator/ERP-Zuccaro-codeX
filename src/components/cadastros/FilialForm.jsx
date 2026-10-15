import React from "react";
import EmpresaForm from "@/components/cadastros/EmpresaForm";

/**
 * Adapter legado → EmpresaForm canônico.
 * Filial é tipo de Empresa (Matriz/Filial + matriz_id no form canônico).
 * Preserva aliases filial/item/data sem store paralelo.
 */
export default function FilialForm({
  filial,
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
  const registro = filial || item || data || initialData || defaultValues || null;
  const comTipoFilial = registro && typeof registro === "object"
    ? { ...registro, tipo: registro.tipo === "Matriz" ? "Matriz" : "Filial" }
    : { tipo: "Filial" };

  return (
    <EmpresaForm
      empresa={comTipoFilial}
      item={item || comTipoFilial}
      data={data || comTipoFilial}
      initialData={initialData || comTipoFilial}
      defaultValues={defaultValues || comTipoFilial}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      windowMode={windowMode}
      loadIncomplete={loadIncomplete}
      isLoadingRecord={isLoadingRecord}
    />
  );
}

FilialForm.displayName = "FilialForm";
