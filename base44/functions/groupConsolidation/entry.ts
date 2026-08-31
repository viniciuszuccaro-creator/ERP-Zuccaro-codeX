import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Simple in-memory cache per instance
const CACHE = globalThis.__gcCache || (globalThis.__gcCache = new Map());
const CACHE_TTL_MS = 300_000; // 5 minutes
const reportConsolidationFailure = (operation, error, context = {}) => {
  console.error('[groupConsolidation] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let filtros = {};
    try {
      const body = await req.json();
      const requested = body?.filtros || {};
      const group_id = requested.group_id || body?.group_id || body?.groupId || null;
      const empresa_id = requested.empresa_id || body?.empresa_id || body?.empresaId || null;
      if (group_id || empresa_id) {
        filtros = {
          ...(group_id ? { group_id } : {}),
          ...(empresa_id ? { empresa_id } : {}),
        };
      }
    } catch (error) { reportConsolidationFailure('Falha ao ler filtros', error); }

    if (!filtros.group_id && !filtros.empresa_id) {
      return Response.json({ error: 'empresa_id ou group_id obrigatório' }, { status: 400 });
    }

    const key = JSON.stringify(filtros || {});
    const entry = CACHE.get(key);
    if (entry && (Date.now() - entry.t) < CACHE_TTL_MS) {
      return Response.json(entry.resp);
    }

    const [pedidos, receber, pagar] = await Promise.all([
      base44.asServiceRole.entities.Pedido.filter(filtros, '-updated_date', 500),
      base44.asServiceRole.entities.ContaReceber.filter(filtros, '-updated_date', 500),
      base44.asServiceRole.entities.ContaPagar.filter(filtros, '-updated_date', 500)
    ]);

    const gaps = {
      pedido_sem_empresa: pedidos.filter(p => !p?.empresa_id).length,
      pedido_sem_grupo: pedidos.filter(p => !p?.group_id).length,
      receber_sem_empresa: receber.filter(r => !r?.empresa_id).length,
      pagar_sem_empresa: pagar.filter(c => !c?.empresa_id).length,
    };

    const groups = new Map();
    const add = (gid) => {
      if (!groups.has(gid)) groups.set(gid || null, { group_id: gid || null, pedidos: 0, valor_pedidos: 0, receber: 0, valor_receber: 0, pagar: 0, valor_pagar: 0 });
    };

    for (const p of pedidos) {
      const gid = p?.group_id || p?.empresa_id || null;
      add(gid);
      const g = groups.get(gid);
      g.pedidos += 1;
      g.valor_pedidos += Number(p?.valor_total || 0);
    }
    for (const r of receber) {
      const gid = r?.group_id || r?.empresa_id || null;
      add(gid);
      const g = groups.get(gid);
      g.receber += 1;
      g.valor_receber += Number(r?.valor || 0) - Number(r?.valor_recebido || 0);
    }
    for (const c of pagar) {
      const gid = c?.group_id || c?.empresa_id || null;
      add(gid);
      const g = groups.get(gid);
      g.pagar += 1;
      g.valor_pagar += Number(c?.valor || 0) - Number(c?.valor_pago || 0);
    }

    const summary = Array.from(groups.values());

    // Audit snapshot + performance
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        usuario: 'Sistema',
        acao: 'Criação',
        modulo: 'Sistema',
        entidade: 'ConsolidaçãoGrupo',
        descricao: `Snapshot multiempresa (${summary.length} escopos) — gaps: ${JSON.stringify(gaps)}`,
        dados_novos: { gerado_em: new Date().toISOString(), summary, gaps },
        data_hora: new Date().toISOString(),
      });
    } catch (error) { reportConsolidationFailure('Falha ao auditar consolidacao', error, filtros); }

    const durationMs = Date.now() - t0;
    if (durationMs > 500) {
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          usuario: 'Sistema',
          acao: 'Visualização',
          modulo: 'Sistema',
          tipo_auditoria: 'sistema',
          entidade: 'Performance',
          descricao: `groupConsolidation ${durationMs}ms`,
          dados_novos: { durationMs, filtros },
          data_hora: new Date().toISOString(),
        });
      } catch (error) { reportConsolidationFailure('Falha ao auditar desempenho', error, filtros); }
    }

    const resp = { ok: true, groups: summary.length, summary };
    try { CACHE.set(key, { t: Date.now(), resp }); } catch (error) { reportConsolidationFailure('Falha ao atualizar cache', error, filtros); }
    return Response.json(resp);
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
