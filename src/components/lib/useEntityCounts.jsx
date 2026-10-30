/**
 * useEntityCounts V6 — contagem robusta multiempresa
 * - SEM cache em memória (COUNT_CACHE removido — causava contagens stale após mutações)
 * - Usa batch API do countEntities (1 request para N entidades)
 * - React Query com staleTime=30s controla a frequência de re-fetch
 * - Invalidação automática via subscribe por entidade
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useMemo, useEffect } from "react";
import {
  SIMPLE_CATALOG,
  buildContextFilter,
} from "@/components/lib/cadastroCountFilter.js";

export { SIMPLE_CATALOG, buildContextFilter };

/** Ator canônico da sessão HTTP — sem token em queryKey/cache/log. */
function readSessionActorId() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === "string" ? session.actorId.trim() : "";
  return actorId || null;
}

/** Fingerprint de sessão (não o token) — troca A→B mesmo com mesmo ator invalida cache. */
function readSessionCacheKey() {
  const session = readErpHttpSession();
  return central360SessionKey(session?.token);
}

// Contagem individual via countEntities. Falha propaga — nunca fabricar KPI com page.length.
async function countSingle(entityName, filter) {
  try {
    const res = await base44.functions.invoke('countEntities', {
      entityName,
      filter: filter || {},
    });
    const d = res?.data;
    const n = d?.count;
    if (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0) return n;
  } catch (error) {
    console.error('[useEntityCounts] Falha na contagem individual', error, { entityName });
  }
  throw new Error('READ_COUNT_UNAVAILABLE');
}

export function useEntityCounts(entities = []) {
  const { grupoAtual, empresaAtual, empresasDoGrupo } = useContextoVisual();
  const queryClient = useQueryClient();
  const actorId = readSessionActorId();
  const sessionKey = readSessionCacheKey();

  const groupId = grupoAtual?.id || null;
  const empresaId = empresaAtual?.id || null;

  const normalized = useMemo(() => {
    const arr = Array.isArray(entities) ? entities : [entities];
    return arr.filter(Boolean);
  }, [entities.join ? entities.join(',') : JSON.stringify(entities)]);

  const entitiesKey = useMemo(() => [...normalized].sort().join(','), [normalized]);

  const grupoEmpIdsKey = useMemo(
    () => (Array.isArray(empresasDoGrupo) ? empresasDoGrupo.map(e => e.id).filter(Boolean).sort().join(',') : ''),
    [empresasDoGrupo]
  );

  // sessionKey (fingerprint) ≠ token cru — sessão rotacionada invalida; sem segredo na key.
  const queryKey = ['entityCounts_v5', entitiesKey, groupId, empresaId, grupoEmpIdsKey, actorId, sessionKey];

  // Sempre busca — se não há contexto, usa filtro vazio (conta tudo) ou
  // contexto do grupo/empresa quando disponível
  const canFetch = normalized.length > 0;

  const { data: counts = {}, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!normalized.length) return {};

      const batchPayload = [];

      for (const entityName of normalized) {
        // Sempre aplica escopo quando ha grupo/empresa (inclusive SIMPLE_CATALOG)
        const ctxFilter = buildContextFilter(entityName, empresaId, groupId, empresasDoGrupo) ?? {};
        batchPayload.push({ entityName, filter: ctxFilter });
      }

      if (!batchPayload.length) return {};

      // Batch API — 1 request para todas as entidades
      try {
        const res = await base44.functions.invoke('countEntities', {
          entities: batchPayload,
        });
        const d = res?.data;
        if (d?.counts && typeof d.counts === 'object') {
          // Parcial ≠ total: exige number safe-integer ≥0 por entidade (sem coerção null/false/'').
          const full = {};
          let complete = true;
          for (const entityName of normalized) {
            if (!Object.prototype.hasOwnProperty.call(d.counts, entityName)) {
              complete = false;
              break;
            }
            const n = d.counts[entityName];
            if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) {
              complete = false;
              break;
            }
            full[entityName] = n;
          }
          if (complete) return full;
          console.warn('[useEntityCounts] Contagem parcial descartada (≠ total)');
        }
      } catch (error) {
        console.warn('[useEntityCounts] Contagem agregada indisponivel', error);
      }

      // Fallback sequencial: falha propaga (erro ≠ vazio); nunca misturar parcial com total
      const result = {};
      for (let i = 0; i < batchPayload.length; i++) {
        const { entityName, filter } = batchPayload[i];
        result[entityName] = await countSingle(entityName, filter);
        if (i < batchPayload.length - 1) await new Promise(r => setTimeout(r, 200));
      }
      return result;
    },
    staleTime: 30_000,     // 30s — contagens frescas após cadastros
    gcTime: 300_000,
    // Sem placeholder cross-tenant (evita badge do tenant anterior após troca)
    placeholderData: undefined,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    enabled: canFetch,
    retry: 1,
  });

  // Invalidar quando registros mudam
  useEffect(() => {
    if (!normalized.length) return;
    const unsubs = normalized.map(entity => {
      const api = base44.entities?.[entity];
      if (!api?.subscribe) return null;
      return api.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['entityCounts_v5'] });
      });
    }).filter(Boolean);
    return () => { unsubs.forEach(u => { if (typeof u === 'function') u(); }); };
  }, [entitiesKey, queryClient]);

  const total = useMemo(
    () => (isError ? null : normalized.reduce((acc, e) => acc + (Number(counts[e]) || 0), 0)),
    [counts, normalized, isError]
  );

  return {
    counts: isError ? {} : (counts || {}),
    total,
    isLoading,
    isError,
    error: error || null,
    countsUnavailable: Boolean(isError),
  };
}

export default useEntityCounts;
