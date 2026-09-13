import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Pequeno helper para saber se a entidade possui campos de contexto multiempresa
export default function useEntityContextInfo(entityName) {
  const { data: schema } = useQuery({
    queryKey: ["schema", entityName],
    queryFn: async () => {
      try {
        const fn = base44.entities?.[entityName]?.schema;
        if (typeof fn === "function") return await fn();
      } catch (error) {
        console.warn('[useEntityContextInfo] Schema da entidade indisponivel', error);
      }
      return null;
    },
    staleTime: 600000,
  });

  const props = schema?.properties || {};
  const hasGroup = Object.prototype.hasOwnProperty.call(props, "group_id");
  const empresaFields = ["empresa_id", "empresa_dona_id", "empresa_alocada_id"]; 
  const hasAnyEmpresa = empresaFields.some((f) => Object.prototype.hasOwnProperty.call(props, f));

  // Campo de contexto preferencial por entidade
  const ctxMap = {
    Fornecedor: "empresa_dona_id",
    Transportadora: "empresa_dona_id",
    Colaborador: "empresa_alocada_id",
  };
  const ctxField = ctxMap[entityName] || "empresa_id";

  return { schema, hasGroup, hasAnyEmpresa, ctxField };
}
