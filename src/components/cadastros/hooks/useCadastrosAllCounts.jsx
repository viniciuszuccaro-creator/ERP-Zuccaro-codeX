/**
 * useCadastrosAllCounts V6 — Contagens Cadastros Gerais
 *
 * Pacote A (#429→correção):
 * - Filtro alinhado a buildContextFilter / Visualizador (núcleo puro).
 * - Falha de countEntities ≠ resultado vazio (isError; sem fabricar 0).
 * - Auxiliar parcial (ex. SetorAtividade 500) ≠ envenenar blocos autorizados.
 * - Troca de grupo/empresa: sem placeholder cross-tenant.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useEffect } from "react";
import {
  BLOCOS_ENTITIES,
  ALL_ENTITIES,
  buildCadastrosAllCountsFilter,
  fetchCadastrosAllCounts as fetchCountsCore,
} from "./cadastrosAllCountsCore.js";

export { BLOCOS_ENTITIES, buildCadastrosAllCountsFilter, fetchCountsCore as fetchCadastrosAllCounts };

/** Ator canônico da sessão HTTP — sem token em queryKey/cache/log. */
function readSessionActorId() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === "string" ? session.actorId.trim() : "";
  return actorId || null;
}

function readSessionCacheKey() {
  const session = readErpHttpSession();
  return central360SessionKey(session?.token);
}

/**
 * @typedef {{ counts: Record<string, number>, missing: string[] }} CadastrosCountsPayload
 */

export default function useCadastrosAllCounts() {
  const { empresaAtual, grupoAtual, empresasDoGrupo } = useContextoVisual();
  const empresaId = empresaAtual?.id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const actorId = readSessionActorId();
  const sessionKey = readSessionCacheKey();
  const contextoValido = Boolean(empresaId || groupId);
  const queryClient = useQueryClient();
  const grupoEmpIds = (Array.isArray(empresasDoGrupo) ? empresasDoGrupo : [])
    .map((e) => e?.id)
    .filter(Boolean)
    .sort()
    .join(",");

  const { data, isLoading, isError, error, isFetching, failureReason } = useQuery({
    queryKey: ["cadastros-all-counts-v5", empresaId, groupId, grupoEmpIds, actorId, sessionKey],
    queryFn: async () => {
      if (!contextoValido) {
        // Sem grupo/empresa: indisponível (—), nunca fabricar 0 como total confirmado.
        return /** @type {CadastrosCountsPayload} */ ({
          counts: {},
          missing: ALL_ENTITIES.slice(),
        });
      }
      try {
        const counts = await fetchCountsCore({
          invoke: (name, body) => base44.functions.invoke(name, body),
          empresaId,
          groupId,
          empresasDoGrupo,
        });
        return /** @type {CadastrosCountsPayload} */ ({ counts, missing: [] });
      } catch (err) {
        const partial = /** @type {{ code?: string, message?: string, partialCounts?: Record<string, number>, missing?: string[] }} */ (err);
        if (
          (partial?.code === "READ_COUNT_PARTIAL" || partial?.message === "READ_COUNT_PARTIAL")
          && partial.partialCounts
          && Object.keys(partial.partialCounts).length > 0
        ) {
          // Parcial utilizável: não marcar a query como erro global.
          return {
            counts: partial.partialCounts,
            missing: Array.isArray(partial.missing) ? partial.missing : [],
          };
        }
        throw err;
      }
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
  }, [empresaId, groupId, grupoEmpIds, actorId, sessionKey, queryClient]);

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
  }, [empresaId, groupId, actorId, sessionKey, queryClient]);

  const counts = isError ? {} : (data?.counts || {});
  const missing = isError ? ALL_ENTITIES.slice() : (data?.missing || []);
  const missingSet = new Set(missing);
  const totals = Object.fromEntries(
    Object.entries(BLOCOS_ENTITIES).map(([bloco, entities]) => {
      if (isError) return [bloco, null];
      const blocoMissing = entities.some((e) => missingSet.has(e));
      if (blocoMissing) return [bloco, null];
      return [bloco, entities.reduce((sum, e) => sum + (Number(counts[e]) || 0), 0)];
    }),
  );

  const hasAnyCount = Object.keys(counts).length > 0;
  const countsPartial = !isError && missing.length > 0 && hasAnyCount;
  const countsUnavailable = Boolean(isError) || (!hasAnyCount && missing.length > 0);

  return {
    counts,
    totals,
    missing,
    countsPartial,
    isLoading: isLoading || (isFetching && !data && !isError),
    isError,
    error: error || failureReason || null,
    countsUnavailable,
  };
}
