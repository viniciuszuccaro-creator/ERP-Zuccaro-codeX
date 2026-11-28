import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const resolveRecordLabel = (record, labelFields) => {
  if (!record || typeof record !== "object") return "";
  for (const field of labelFields) {
    const val = String(record[field] || "").trim();
    if (val) return val;
  }
  return String(record.codigo || record.id || "").trim();
};

/**
 * CadastroEntitySelect — seletor reutilizável ligado à fonte mestre Cadastros Gerais.
 * Carrega registros da entidade oficial via filterInContext (escopo Grupo/Empresa),
 * preserva valor legado para compatibilidade e devolve { id, label, record } para gravar IDs oficiais.
 */
export default function CadastroEntitySelect(/** @type {any} */ {
  entityName,
  valueId = "",
  fallbackLabel = "",
  onSelect,
  placeholder = "Selecione...",
  labelFields = ["nome", "descricao", "nome_cargo", "nome_turno", "nome_banco", "nome_grupo", "nome_marca"],
  disabled = false,
  id = undefined,
  allowLegacyFallback = true,
  limit = 200,
}) {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);

  const { data: records = [], isLoading, isError } = useQuery({
    queryKey: ["cadastro-entity-select", entityName, groupId || "sem-grupo", empresaId || "grupo"],
    queryFn: async () => {
      const list = await filterInContext(entityName, {}, "nome", limit);
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(entityName && contextoValido),
    staleTime: 120000,
    retry: 1,
  });

  const options = useMemo(() => {
    const seen = new Set();
    return (records || [])
      .filter((r) => r && r.id && r.ativo !== false && r.status !== "Inativo")
      .map((r) => ({
        id: String(r.id),
        label: resolveRecordLabel(r, labelFields),
        codigo: r.codigo ? String(r.codigo) : "",
        record: r,
      }))
      .filter((o) => {
        if (!o.label || seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      })
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [records, labelFields]);

  // Com ID salvo, a identidade é só o ID: rótulo homônimo não pode substituí-lo (ex.: ID fora da página de 200)
  const matchedOption = useMemo(() => {
    if (valueId) {
      return options.find((o) => o.id === String(valueId)) || null;
    }
    const cleanFallback = String(fallbackLabel || "").trim().toLowerCase();
    if (cleanFallback) {
      const byLabel = options.find((o) => o.label.toLowerCase() === cleanFallback);
      if (byLabel) return byLabel;
    }
    return null;
  }, [options, valueId, fallbackLabel]);

  const legacySentinel = allowLegacyFallback && !matchedOption && String(fallbackLabel || "").trim()
    ? `__legacy__:${String(fallbackLabel).trim()}`
    : "";

  const currentSelectValue = matchedOption?.id || legacySentinel || "";

  const handleChange = (selectedValue) => {
    if (!selectedValue || typeof onSelect !== "function") return;
    if (selectedValue.startsWith("__legacy__:")) {
      const label = selectedValue.slice("__legacy__:".length);
      onSelect({ id: valueId || null, label, record: null });
      return;
    }
    const found = options.find((o) => o.id === selectedValue);
    if (found) {
      onSelect({ id: found.id, label: found.label, record: found.record });
    }
  };

  const resolvedPlaceholder = !contextoValido
    ? "Selecione grupo/empresa..."
    : isLoading
      ? "Carregando cadastro oficial..."
      : isError
        ? "Indisponível (erro de consulta)"
        : options.length === 0
          ? `Nenhum registro em ${entityName}`
          : placeholder;

  return (
    <Select
      value={currentSelectValue}
      onValueChange={handleChange}
      disabled={disabled || !contextoValido}
    >
      <SelectTrigger
        id={id}
        data-cadastro-select-entity={entityName}
        data-cadastro-select-state={
          !contextoValido ? "sem_contexto" : isLoading ? "carregando" : isError ? "erro" : options.length === 0 ? "vazio" : "ok"
        }
      >
        <SelectValue placeholder={resolvedPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {legacySentinel && (
          <SelectItem value={legacySentinel}>
            {fallbackLabel} (legado)
          </SelectItem>
        )}
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            {opt.codigo ? `${opt.codigo} — ${opt.label}` : opt.label}
          </SelectItem>
        ))}
        {!isLoading && !isError && options.length === 0 && !legacySentinel && (
          <div className="px-2 py-1.5 text-xs text-slate-500">
            Cadastre em Cadastros Gerais ({entityName})
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
