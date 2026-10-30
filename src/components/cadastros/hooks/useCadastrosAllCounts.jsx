/**
 * useCadastrosAllCounts V6 — Contagens Cadastros Gerais
 *
 * Pacote A (#429→correção):
 * - Filtro alinhado a buildContextFilter / Visualizador (núcleo puro).
 * - Falha de countEntities ≠ resultado vazio (isError; sem fabricar 0).
 * - Troca de grupo/empresa: sem placeholder cross-tenant.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useEffect } from "react";
import {
  BLOCOS_ENTITIES,
  ALL_ENTITIES,
  buildCadastrosAllCountsFilter,
  emptyCadastrosCounts,
  fetchCadastrosAllCounts as fetchCountsCore,
} from "./cadastrosAllCountsCore.js";

export { BLOCOS_ENTITIES, buildCadastrosAllCountsFilter, fetchCountsCore as fetchCadastrosAllCounts };

export default function useCadastrosAllCounts() {
  const { empresaAtual, grupoAtual, empresasDoGrupo } = useContextoVisual();
  const empresaId = empresaAtual?.id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(empresaId || groupId);
  const queryClient = useQueryClient();
  const grupoEmpIds = (Array.isArray(empresasDoGrupo) ? empresasDoGrupo : [])
    .map((e) => e?.id)
    .filter(Boolean)
    .sort()
    .join(",");

  const { data, isLoading, isError, error, isFetching, failureReason } = useQuery({
    queryKey: ["cadastros-all-counts-v5", empresaId, groupId, grupoEmpIds],
    queryFn: async () => {
      if (!contextoValido) return emptyCadastrosCounts();
      return fetchCountsCore({
        invoke: (name, body) => base44.functions.invoke(name, body),
        empresaId,
        groupId,
        empresasDoGrupo,
      });
    },
    staleTime: 20_000,
    gcTime: 10 * 60_000,
    placeholderData: undefined,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    retry: 1,
    retryDelay: (attempt) => Math.min(2000 * (attempt + 1), 8000),
  });

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["cadastros-all-counts-v5"] });
    queryClient.invalidateQueries({ queryKey: ["entityCounts_v5"] });
  }, [empresaId, groupId, grupoEmpIds, queryClient]);

  useEffect(() => {
    const unsubs = ALL_ENTITIES.map((name) => {
      const api = base44.entities?.[name];
      if (!api?.subscribe) return null;
      return api.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ["cadastros-all-counts-v5"] });
        queryClient.invalidateQueries({ queryKey: ["entityCounts_v5"] });
      });
    }).filter(Boolean);
    return () => { unsubs.forEach((u) => { if (typeof u === "function") u(); }); };
  }, [empresaId, groupId, queryClient]);

  const counts = isError ? {} : (data || {});
  const totals = Object.fromEntries(
    Object.entries(BLOCOS_ENTITIES).map(([bloco, entities]) => [
      bloco,
      isError
        ? null
        : entities.reduce((sum, e) => sum + (Number(counts[e]) || 0), 0),
    ]),
  );

  return {
    counts,
    totals,
    isLoading: isLoading || (isFetching && !data && !isError),
    isError,
    error: error || failureReason || null,
    countsUnavailable: Boolean(isError),
  };
}
