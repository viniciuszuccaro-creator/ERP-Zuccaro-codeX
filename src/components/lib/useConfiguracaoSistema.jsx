import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Hook de acesso centralizado às configurações do sistema
 * - Busca por categoria + chave (primeiro registro mais recente)
 * - Exposição segura (get/set) com cache via React Query
 * - Mantém simplicidade e não cria novos módulos: integra-se ao fluxo existente
 */
export default function useConfiguracaoSistema({ categoria, chave } = {}) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["configuracaoSistema", categoria || "*", chave || "*"],
    queryFn: async () => {
      const filtro = {};
      if (categoria) filtro.categoria = categoria;
      if (chave) filtro.chave = chave;
      const list = await base44.entities.ConfiguracaoSistema.filter(filtro, "-updated_date", 1);
      return Array.isArray(list) && list.length ? list[0] : null;
    },
    staleTime: 60_000,
  });

  const setMutation = useMutation({
    mutationFn: async (payload) => {
      if (!data?.id) {
        const novo = { categoria: categoria || "Sistema", chave: chave || "default", ...payload };
        return base44.entities.ConfiguracaoSistema.create(novo);
      }
      return base44.entities.ConfiguracaoSistema.update(data.id, payload);
    },
    onSuccess: async (res, variables) => {
      // Invalida todos os consumidores conhecidos
      queryClient.invalidateQueries({ queryKey: ["configuracaoSistema"] });
      queryClient.invalidateQueries({ queryKey: ["config-sistema"] });
      // Auditoria detalhada (quem, parâmetro, antes/depois)
      try {
        const me = await base44.auth.me();
        await base44.functions.invoke('auditEntityEvents', {
          event: {
            type: data?.id ? 'update' : 'create',
            entity_name: 'ConfiguracaoSistema',
            entity_id: (res && res.id) || data?.id || null
          },
          data: { ...(res || {}), __meta: { changed_by: me?.email || me?.full_name, param: chave || variables?.chave } },
          old_data: data || null
        });
      } catch (auditError) {
        console.error('[useConfiguracaoSistema] Falha ao auditar alteracao', auditError);
      }
    }
  });

  // Helper para acessar caminhos aninhados com safety
  const get = useMemo(() => {
    return (path, defaultValue = undefined) => {
      if (!data || !path) return defaultValue;
      const parts = String(path).split(".");
      let cur = data;
      for (const p of parts) {
        if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
          cur = cur[p];
        } else {
          return defaultValue;
        }
      }
      return cur == null ? defaultValue : cur;
    };
  }, [data]);

  return {
    config: data,
    isLoading,
    error,
    get,
    setConfig: (patch) => setMutation.mutate(patch),
    isSaving: setMutation.isPending,
  };
}
