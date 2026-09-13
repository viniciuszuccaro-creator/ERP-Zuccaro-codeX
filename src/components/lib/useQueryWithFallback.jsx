/**
 * useQueryWithFallback — Fase 2
 * Wrapper sobre useQuery que serve cache do localStorage como placeholderData
 * e persiste resultados automaticamente. 
 * Útil para qualquer query de leitura que precise de "instant first paint".
 */
import { useQuery } from '@tanstack/react-query';

function safeParse(str, fallback) {
  try { return JSON.parse(str) ?? fallback; } catch { return fallback; }
}

/**
 * @param {string}   storageKey - chave única para persistência
 * @param {object}   queryOptions - todas as opções do useQuery (queryKey, queryFn, etc.)
 * @param {any}      emptyValue - valor padrão quando não há cache (default: [])
 */
export function useQueryWithFallback(storageKey, queryOptions, emptyValue = []) {
  const persistedValue = typeof window !== 'undefined'
    ? safeParse(localStorage.getItem(`qfb_${storageKey}`), undefined)
    : undefined;

  const result = useQuery({
    staleTime: 90_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    ...queryOptions,
    placeholderData: (prev) => {
      if (prev !== undefined) return prev;
      if (persistedValue !== undefined) return persistedValue;
      const qph = queryOptions.placeholderData;
      if (typeof qph === 'function') return qph(prev);
      if (qph !== undefined) return qph;
      return emptyValue;
    },
  });

  // Persiste resultado quando disponível
  if (result.data !== undefined && result.data !== null) {
    try {
      localStorage.setItem(`qfb_${storageKey}`, JSON.stringify(result.data));
    } catch (error) {
      console.warn('[useQueryWithFallback] Falha ao persistir fallback local', error);
    }
  }

  return result;
}

export default useQueryWithFallback;
