import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

function stableKey(obj) {
  try {
    const seen = new WeakSet();
    const s = (v) => {
      if (v && typeof v === 'object') {
        if (seen.has(v)) return '"[circular]"';
        seen.add(v);
        if (Array.isArray(v)) return '[' + v.map(s).join(',') + ']';
        const keys = Object.keys(v).sort();
        return '{' + keys.map(k => JSON.stringify(k) + ':' + s(v[k])).join(',') + '}';
      }
      return JSON.stringify(v);
    };
    return s(obj);
  } catch { return JSON.stringify(obj); }
}

// --- Batching helpers (window-scoped singletons) ---
function getHelpers() {
  const win = typeof window !== 'undefined' ? window : {};
  if (!win.__countBatchQueue) win.__countBatchQueue = new Map();
  if (!win.__countBatchTimer) win.__countBatchTimer = null;
  if (!win.__countInflight) win.__countInflight = new Map();
  if (!win.__countCooldown) win.__countCooldown = new Map();
  if (!win.__countCache) win.__countCache = new Map();
  return {
    queue: win.__countBatchQueue,
    getTimer: () => win.__countBatchTimer,
    setTimer: (t) => { win.__countBatchTimer = t; },
    inflight: win.__countInflight,
    cooldown: win.__countCooldown,
    cache: win.__countCache,
  };
}

async function flushBatch() {
  const { queue, inflight, cache, cooldown } = getHelpers();
  const items = Array.from(queue.values());
  queue.clear();
  if (!items.length) return;

  const entities = items.map(it => ({
    entityName: it.entityName,
    filter: it.filter,
    withGroupTotal: false,
  }));

  // Retry exponencial para o batch inteiro (3 tentativas)
  let attempt = 0;
  while (true) {
    try {
      const res = await base44.functions.invoke('countEntities', { entities });
      const counts = res?.data?.counts || {};
      items.forEach(it => {
        const c = typeof counts[it.entityName] === 'number' ? counts[it.entityName] : 0;
        cache.set(it.reqKey, c);
        try {
          localStorage.setItem(`count_cache_${it.reqKey}`, String(c));
        } catch (error) {
          console.warn('[useCountEntities] Falha ao persistir contagem em cache', error);
        }
        it.resolvers.forEach(r => r(c));
      });
      break; // sucesso — sai do loop
    } catch (err) {
      const status = err?.response?.status || err?.status;
      const now = Date.now();
      if (status === 429 && attempt < 3) {
        const delay = 600 * Math.pow(2, attempt) + Math.floor(Math.random() * 300);
        items.forEach(it => cooldown.set(it.entityName, now + delay));
        await new Promise(r => setTimeout(r, delay));
        attempt++;
        continue;
      }
      // Fallback: serve cache para cada item
      items.forEach(it => {
        if (status === 429) cooldown.set(it.entityName, now + 3000);
        const cached = cache.get(it.reqKey)
          ?? (() => { try { const v = Number(localStorage.getItem(`count_cache_${it.reqKey}`) || '0'); return isNaN(v) ? 0 : v; } catch { return 0; } })();
        it.resolvers.forEach(r => r(typeof cached === 'number' ? cached : 0));
      });
      break;
    }
  }

  // Limpa inflight após resolução (sucesso ou fallback)
  items.forEach(it => inflight.delete(it.reqKey));
}

function enqueue(reqKey, entityName, filter) {
  const { queue, inflight, cache, cooldown, getTimer, setTimer } = getHelpers();

  // Se já há inflight p/ esta chave, retorna a mesma promise
  if (inflight.has(reqKey)) return inflight.get(reqKey);

  const p = new Promise(resolve => {
    const existing = queue.get(reqKey);
    if (existing) {
      existing.resolvers.push(resolve);
    } else {
      queue.set(reqKey, { reqKey, entityName, filter, resolvers: [resolve] });
    }
  });

  inflight.set(reqKey, p);

  if (!getTimer()) {
    const BATCH_WINDOW = 12; // ms
    setTimer(setTimeout(async () => {
      setTimer(null);
      await flushBatch();
    }, BATCH_WINDOW));
  }

  return p;
}

/**
 * Hook de contagem de entidades com micro-batching automático.
 * Agrupa múltiplas chamadas no mesmo tick em um único request ao backend.
 * Retrocompatível com a interface anterior.
 */
export function useCountEntities(entityName, filter = {}, options = {}) {
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { cache, cooldown } = getHelpers();

  // Monta filtro com contexto multiempresa quando não explicitado
  const ctxCampoMap = { Fornecedor: 'empresa_dona_id', Transportadora: 'empresa_dona_id', Colaborador: 'empresa_alocada_id' };
  const campoEmpresa = ctxCampoMap[entityName] || 'empresa_id';
  const empresaId = empresaAtual?.id;
  const groupId = grupoAtual?.id;

  let finalFilter = { ...(filter || {}) };
  if (!finalFilter.$or && !finalFilter[campoEmpresa] && !finalFilter.group_id && (empresaId || groupId)) {
    const orConds = [];
    if (empresaId) {
      if (entityName === 'Cliente') {
        orConds.push({ empresa_id: empresaId }, { empresa_dona_id: empresaId }, { empresas_compartilhadas_ids: { $in: [empresaId] } });
      } else if (entityName === 'Fornecedor' || entityName === 'Transportadora') {
        orConds.push({ empresa_dona_id: empresaId }, { empresas_compartilhadas_ids: { $in: [empresaId] } });
      } else if (entityName === 'Colaborador') {
        orConds.push({ empresa_alocada_id: empresaId });
      } else {
        orConds.push({ [campoEmpresa]: empresaId });
      }
    }
    if (groupId) orConds.push({ group_id: groupId });
    if (orConds.length) finalFilter = { ...finalFilter, $or: orConds };
  }

  const reqKey = `${entityName}|${stableKey(finalFilter)}|${empresaId || ''}|${groupId || ''}`;

  const { data: count = 0, isLoading, error, refetch } = useQuery({
    queryKey: [entityName, 'count', stableKey(finalFilter), empresaId || null, groupId || null],
    queryFn: async () => {
      // cooldown anti-429
      const cd = cooldown.get(entityName) || 0;
      if (Date.now() < cd) {
        const cached = cache.get(reqKey);
        if (typeof cached === 'number') return cached;
        try {
          const v = Number(localStorage.getItem(`count_cache_${reqKey}`) || '0');
          if (!isNaN(v)) return v;
        } catch (error) {
          console.warn('[useCountEntities] Falha ao ler contagem em cache', error);
        }
        return 0;
      }
      // micro-batching: agrupa chamadas no mesmo tick
      const result = await enqueue(reqKey, entityName, finalFilter);
      return typeof result === 'number' ? result : 0;
    },
    staleTime: options.staleTime ?? 120000,
    gcTime: options.gcTime ?? 120000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 2,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 5000),
    enabled: options.enabled ?? true,
    placeholderData: (prev) => {
      if (prev !== undefined) return prev;
      const cached = cache.get(reqKey);
      if (typeof cached === 'number') return cached;
      try {
        const v = Number(localStorage.getItem(`count_cache_${reqKey}`) || '0');
        if (!isNaN(v)) return v;
      } catch (error) {
        console.warn('[useCountEntities] Falha ao ler contagem em cache', error);
      }
      return 0;
    },
    ...options,
  });

  return { count, isLoading, error, refetch };
}

export default useCountEntities;
