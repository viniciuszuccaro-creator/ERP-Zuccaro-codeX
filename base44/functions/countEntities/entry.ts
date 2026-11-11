import { authorizeEntityRead, safeReadError, EntityReadError } from '../_lib/security/entityReadPolicy/entry.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * fastCount V2 — contagem eficiente com retry automático em 429
 * Estratégia: páginas de 500 com delay progressivo.
 * Primeira page: sem delay. Pages seguintes: delay crescente.
 */
async function fastCount(base44, entityName, finalFilter) {
  const PAGE = 500;
  const MAX_PAGES = 20; // cap em 10.000 registros
  let total = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    if (page > 0) await new Promise(r => setTimeout(r, 400 + page * 100));

    let batch = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        batch = await base44.asServiceRole.entities[entityName].filter(finalFilter, '-id', PAGE, page * PAGE);
        break;
      } catch (err) {
        const status = err?.status || err?.response?.status;
        if (status === 429) {
          await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
        } else {
          throw err;
        }
      }
    }

    const n = Array.isArray(batch) ? batch.length : 0;
    total += n;
    if (!Array.isArray(batch)) throw new EntityReadError('READ_COUNT_UNAVAILABLE',503);
    if (n < PAGE) return total;
  }

  throw new EntityReadError('READ_COUNT_INCOMPLETE',409);
}

async function countOne(base44, user, payload, cache = new Map()) {
  const { entityName, filter = {} } = payload || {};

  const access = await authorizeEntityRead(base44,user,payload,cache);
  const finalFilter = access.filter;

  const count = await fastCount(base44, entityName, finalFilter);
  return { entityName, count };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) { }

    const entitiesBatch = Array.isArray(body?.entities) ? body.entities : null;

    // MODO LOTE: { entities: [{ entityName, filter }, ...] }
    // Processa em janelas de 5 paralelas com delay de 200ms entre janelas
    if (entitiesBatch && entitiesBatch.length > 0) {
      if (entitiesBatch.length > 20) throw new EntityReadError('READ_INVALID_BATCH',400);
      const cache = new Map();
      for (const payload of entitiesBatch) await authorizeEntityRead(base44,user,payload,cache);
      const counts = {};
      // 2 paralelas com delay maior — evita burst de 429s
      const WINDOW = 2;
      const DELAY_BETWEEN_WINDOWS = 500;

      for (let i = 0; i < entitiesBatch.length; i += WINDOW) {
        const slice = entitiesBatch.slice(i, i + WINDOW);
        const results = await Promise.allSettled(
          slice.map(payload => countOne(base44, user, payload || {},cache))
        );
        results.forEach((r, idx) => {
          const payload = slice[idx] || {};
          if (r.status === 'fulfilled' && r.value?.entityName != null) {
            counts[r.value.entityName] = r.value.count;
          } else if (payload?.entityName) {
            throw r.status === 'rejected' ? r.reason : new EntityReadError('READ_COUNT_UNAVAILABLE',503);
          }
        });
        if (i + WINDOW < entitiesBatch.length) {
          await new Promise(r => setTimeout(r, DELAY_BETWEEN_WINDOWS));
        }
      }

      return Response.json({ counts });
    }

    // MODO SINGLE
    const single = await countOne(base44, user, {
      entityName: body?.entityName,
      filter: body?.filter || {},
      context: body?.context
    });

    return Response.json({ count: single.count, entityName: single.entityName });

  } catch (error) {
    return safeReadError(error);
  }
});