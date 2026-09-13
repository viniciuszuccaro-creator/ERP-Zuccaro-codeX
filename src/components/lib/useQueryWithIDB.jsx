/**
 * useQueryWithIDB — Fase 3
 * Wrapper sobre useQuery com cache de segundo nível em IndexedDB.
 * Para queries grandes (listas de entidades), persiste no IDB além do localStorage.
 * Instant first paint: serve IDB enquanto faz o fetch em background.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { idbGet, idbSet } from './useIndexedDBCache';

function safeParse(str, fallback) {
  try { return JSON.parse(str) ?? fallback; } catch { return fallback; }
}

/**
 * @param {string}   idbKey       - chave única para o IDB (deve ser estável)
 * @param {object}   queryOptions - opções do useQuery (queryKey, queryFn, etc.)
 * @param {object}   options      - { ttlMs, emptyValue }
 */
export function useQueryWithIDB(idbKey, queryOptions, options = {}) {
  const { ttlMs = 10 * 60 * 1000, emptyValue = [] } = options;
  const idbDataRef = useRef(undefined);
  const idbLoadedRef = useRef(false);

  // Carrega do IDB de forma síncrona via ref (na primeira renderização)
  // Nota: IDB é async, então usamos localStorage como ponte rápida
  const lsKey = `idb_bridge_${idbKey}`;
  const lsFallback = typeof window !== 'undefined'
    ? safeParse(localStorage.getItem(lsKey), undefined)
    : undefined;

  const result = useQuery({
    staleTime: 90_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    ...queryOptions,
    placeholderData: (prev) => {
      if (prev !== undefined) return prev;
      if (idbDataRef.current !== undefined) return idbDataRef.current;
      if (lsFallback !== undefined) return lsFallback;
      const qph = queryOptions.placeholderData;
      if (typeof qph === 'function') return qph(prev);
      if (qph !== undefined) return qph;
      return emptyValue;
    },
  });

  // Carrega do IDB para próximas renderizações
  useEffect(() => {
    if (idbLoadedRef.current) return;
    idbLoadedRef.current = true;
    idbGet(idbKey).then((val) => {
      if (val !== undefined) {
        idbDataRef.current = val;
        // Atualiza também o LS bridge para velocidade
        try {
          localStorage.setItem(lsKey, JSON.stringify(val));
        } catch (error) {
          console.warn('[useQueryWithIDB] Falha ao atualizar cache local', error);
        }
      }
    }).catch(() => {});
  }, [idbKey]);

  // Persiste no IDB quando houver dados frescos
  useEffect(() => {
    if (result.data === undefined || result.data === null) return;
    if (!result.isSuccess) return;
    idbSet(idbKey, result.data, ttlMs).catch(() => {});
    try {
      localStorage.setItem(lsKey, JSON.stringify(result.data));
    } catch (error) {
      console.warn('[useQueryWithIDB] Falha ao persistir cache local', error);
    }
  }, [result.data, result.isSuccess, idbKey, ttlMs]);

  return result;
}

export default useQueryWithIDB;
