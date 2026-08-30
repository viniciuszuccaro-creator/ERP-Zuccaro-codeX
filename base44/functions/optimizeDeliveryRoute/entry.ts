import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { requireEntityGuard } from './_lib/security/guardCallPolicy.js';

import { z } from 'npm:zod@3.24.2';

// Otimização de rotas de entrega (multiempresa) usando Google Directions API
// Payload esperado:
// {
//   empresa_id: string,                // obrigatório
//   group_id?: string,                 // opcional
//   entrega_ids?: string[],            // se não informado, busca entregas pendentes
//   origem?: { lat: number, lng: number } | string, // se não informado, tenta Empresa.endereco
//   modo?: 'driving'|'bicycling'|'walking'|'transit' // default 'driving'
// }
// Retorno: { ok, total_distance_m, total_duration_s, ordered, api_mode }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const raw = await req.json().catch(() => ({}));
    const BodySchema = z.object({ // zod reforçado
      empresa_id: z.string().min(1, 'empresa_id obrigatório'),
      group_id: z.string().optional().nullable(),
      entrega_ids: z.array(z.string()).optional(),
      origem: z.union([z.string(), z.object({ lat: z.number(), lng: z.number() })]).optional(),
      modo: z.enum(['driving','bicycling','walking','transit']).optional(),
      regiao_entrega_id: z.string().optional(),
      constraints: z.object({
        vehicle_capacity_kg: z.number().optional(),
        vehicle_capacity_m3: z.number().optional(),
        respect_time_windows: z.boolean().optional(),
        respect_time_windows_strict: z.boolean().optional(),
        group_by_region: z.boolean().optional(),
        prefer_same_city: z.boolean().optional(),
        max_stops: z.number().int().optional(),
        max_route_duration_minutes: z.number().int().optional(),
        allow_multi_batches: z.boolean().optional(),
        route_start_time: z.string().optional()
      }).optional(),
      event: z.any().optional(),
      data: z.any().optional()
    }).passthrough();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: 'Payload inválido', issues: parsed.error.issues }, { status: 400 });
    }
    const body = parsed.data;
    // Suporte a automations: quando chamado por evento de Entrega
    let empresa_id = body?.empresa_id || null;
    let group_id = body?.group_id || null;
    const isAutomation = !!body?.event && body?.event?.entity_name === 'Entrega';
    const isPedidoEvent = !!body?.event && body?.event?.entity_name === 'Pedido';
    if (isAutomation || isPedidoEvent) {
      const d = body?.data || null;
      empresa_id = d?.empresa_id || empresa_id;
      group_id = d?.group_id || group_id;
    }

    // Contexto obrigatório
    if (!empresa_id) {
      return Response.json({ error: 'Contexto ausente: empresa_id obrigatório' }, { status: 400 });
    }

    const guardFailure = await requireEntityGuard(base44, {
      module: 'Expedição', section: 'Roteirizacao', action: 'executar', empresa_id, group_id,
    });
    if (guardFailure) return guardFailure;

    // Carregar entregas alvo com filtros e restrições (inclui janelas, prioridade, capacidade)
    const constraints = body?.constraints || {};
    const capKg = Number(constraints?.vehicle_capacity_kg) > 0 ? Number(constraints.vehicle_capacity_kg) : null;
    const capM3 = Number(constraints?.vehicle_capacity_m3) > 0 ? Number(constraints.vehicle_capacity_m3) : null;
    const regiaoId = body?.regiao_entrega_id || null;
    const usarJanela = constraints?.respect_time_windows === true;
    const usarJanelaEstrita = constraints?.respect_time_windows_strict === true;
    const preferSameCity = constraints?.prefer_same_city === true;
    const maxStops = (typeof constraints?.max_stops === 'number' && constraints.max_stops > 0) ? constraints.max_stops : null;
    const maxRouteMin = (typeof constraints?.max_route_duration_minutes === 'number' && constraints.max_route_duration_minutes > 0) ? constraints.max_route_duration_minutes : null;
    const allowMultiBatches = constraints?.allow_multi_batches === true;

    let entregas = [];
    const ids = Array.isArray(body?.entrega_ids) ? body.entrega_ids.filter(Boolean) : [];
    if (ids.length > 0) {
      // Busca por IDs
      const lotSize = 50;
      for (let i = 0; i < ids.length; i += lotSize) {
        const slice = ids.slice(i, i + lotSize);
        const part = await base44.asServiceRole.entities.Entrega.filter({ empresa_id, id: { $in: slice } }, undefined, slice.length);
        entregas.push(...(part || []));
      }
    } else {
      // Se veio de evento de Pedido, roteiriza somente as entregas vinculadas a ele
      const pedidoId = isPedidoEvent ? (body?.event?.entity_id || body?.data?.id) : null;
      if (pedidoId) {
        entregas = await base44.asServiceRole.entities.Entrega.filter({ empresa_id, pedido_id: pedidoId }, undefined, 100);
      } else {
        // Critério padrão: entregas pendentes para a empresa/região
        const crit = { empresa_id, status: { $in: ['Pronto para Expedir', 'Saiu para Entrega', 'Em Trânsito'] } };
        if (regiaoId) crit['regiao_entrega_id'] = regiaoId;
        entregas = await base44.asServiceRole.entities.Entrega.filter(crit, undefined, 100);
      }

      // Ordenação avançada (janelas + prioridade) e agrupamento opcional por região
      const prioWeight = { 'Urgente': 0, 'Alta': 1, 'Normal': 2, 'Baixa': 3 };
      const parseHHMM = (s) => {
        if (!s || typeof s !== 'string') return Number.POSITIVE_INFINITY;
        const [h, m] = s.split(':').map(n => parseInt(n, 10));
        if (isNaN(h) || isNaN(m)) return Number.POSITIVE_INFINITY;
        return (h * 60) + m;
      };
      const cityOf = (e) => String(e?.endereco_entrega_completo?.cidade || '');
      const sortByWindowAndPriority = (a, b) => {
        const ta = parseHHMM(a?.janela_entrega_inicio);
        const tb = parseHHMM(b?.janela_entrega_inicio);
        const pa = prioWeight[a?.prioridade] ?? 2;
        const pb = prioWeight[b?.prioridade] ?? 2;
        if (usarJanela && ta !== tb) return ta - tb;
        if (pa !== pb) return pa - pb;
        if (preferSameCity) {
          const ca = cityOf(a);
          const cb = cityOf(b);
          const cc = ca.localeCompare(cb);
          if (cc !== 0) return cc;
        }
        const na = (a?.cliente_nome || '').localeCompare(b?.cliente_nome || '');
        if (na !== 0) return na;
        return String(a?.id || '').localeCompare(String(b?.id || ''));
      };

      // Se solicitado, agrupa por região e ordena dentro de cada grupo
      if (constraints?.group_by_region) {
        // Tentativa de auto-alocação por região quando não houver regiao_entrega definida
        try {
          if (!regiaoId) {
            const filtroReg = group_id ? { group_id } : { empresa_id };
            const regioes = await base44.asServiceRole.entities.RegiaoAtendimento.filter(filtroReg, undefined, 200).catch(() => []);
            const byName = new Map((regioes || []).map(r => [String(r?.nome || r?.descricao || '').toLowerCase(), r]));
            for (const e of entregas) {
              if (!e?.regiao_entrega_id) {
                const c = cityOf(e).toLowerCase();
                const r = byName.get(c) || null;
                if (r) {
                  e.regiao_entrega_id = r.id; // atualiza em memória
                  e.regiao_entrega_nome = r.nome || r.descricao || null;
                  // melhor esforço: persistir
                  try { await base44.asServiceRole.entities.Entrega.update(e.id, { regiao_entrega_id: r.id, regiao_entrega_nome: e.regiao_entrega_nome }); } catch (_) {}
                }
              }
            }
          }
        } catch (_) {}

        const groups = new Map();
        for (const e of entregas) {
          const key = e?.regiao_entrega_id || e?.regiao_entrega_nome || 'Sem Região';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(e);
        }
        const orderedGroups = Array.from(groups.entries()).sort(([ka], [kb]) => String(ka).localeCompare(String(kb)));
        entregas = orderedGroups.flatMap(([, arr]) => arr.sort(sortByWindowAndPriority));
      } else {
        entregas.sort(sortByWindowAndPriority);
      }

      // Capacidade do veículo (kg e m3)
      if (capKg || capM3) {
        let accKg = 0;
        let accM3 = 0;
        entregas = entregas.filter(e => {
          const w = Number(e?.peso_total_kg || 0);
          const v = Number(e?.volume_total_m3 || 0);
          const fitsKg = !capKg || (accKg + w <= capKg);
          const fitsM3 = !capM3 || (accM3 + v <= capM3);
          if (fitsKg && fitsM3) {
            accKg += w;
            accM3 += v;
            return true;
          }
          return false;
        });
      }
    }

    // Autoalocação por região (melhoria incremental)
    if (regiaoId) {
      try {
        const reg = await base44.asServiceRole.entities.RegiaoAtendimento.filter({ id: regiaoId }, undefined, 1).then(r => r?.[0]).catch(() => null);
        for (const e of entregas) {
          if (!e?.regiao_entrega_id) {
            await base44.asServiceRole.entities.Entrega.update(e.id, { regiao_entrega_id: regiaoId, regiao_entrega_nome: reg?.nome || reg?.descricao || null });
          }
        }
      } catch (_) {}
    }

    if (!entregas || entregas.length === 0) {
      return Response.json({ ok: true, ordered: [], total_distance_m: 0, total_duration_s: 0, api_mode: 'none' });
    }

    // Resolver origem: payload.origem → Empresa.endereco → 1º ponto
    const origemIn = body?.origem || null;
    let originStr = '';
    const asLatLng = (x) => typeof x?.lat === 'number' && typeof x?.lng === 'number' ? `${x.lat},${x.lng}` : null;

    if (typeof origemIn === 'string') {
      originStr = origemIn;
    } else if (origemIn && asLatLng(origemIn)) {
      originStr = asLatLng(origemIn);
    }

    if (!originStr) {
      // Tenta Empresa
      const emp = await base44.asServiceRole.entities.Empresa.filter({ id: empresa_id }, undefined, 1).then(r => r?.[0]).catch(() => null);
      const endereco = emp?.endereco_principal || emp?.endereco || null;
      if (endereco) {
        const lat = endereco.latitude ?? endereco.lat;
        const lng = endereco.longitude ?? endereco.lng;
        if (typeof lat === 'number' && typeof lng === 'number') {
          originStr = `${lat},${lng}`;
        } else {
          const parts = [endereco.logradouro, endereco.numero, endereco.bairro, endereco.cidade, endereco.estado, endereco.cep].filter(Boolean);
          if (parts.length) originStr = parts.join(', ');
        }
      }
    }

    // Fallback: usa o primeiro destino como origem
    const toAddr = (e) => {
      const end = e?.endereco_entrega_completo || e?.endereco || {};
      const lat = end.latitude ?? end.lat;
      const lng = end.longitude ?? end.lng;
      if (typeof lat === 'number' && typeof lng === 'number') return `${lat},${lng}`;
      const p = [end.logradouro, end.numero, end.complemento, end.bairro, end.cidade, end.estado, end.cep].filter(Boolean);
      return p.length ? p.join(', ') : (end?.link_google_maps || '');
    };

    const rawStops = entregas.map((e) => ({ id: e.id, label: e.cliente_nome || e.numero_pedido || e.id, addr: toAddr(e) }));
    if (!originStr) originStr = rawStops[0].addr;

    // Waypoints (até limite Directions: ~25 pontos incluindo origem/destino)
    const modo = (body?.modo || 'driving');
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) return Response.json({ error: 'Missing GOOGLE_MAPS_API_KEY' }, { status: 500 });

    const maxPoints = 25; // Directions API typical limit (may vary by plan)
    const usableStops = rawStops.slice(0, Math.min(rawStops.length, maxPoints - 1));

    // Monta request Directions (usa optimize:true somente quando não estiver agrupando por região)
    const destination = usableStops[usableStops.length - 1].addr;
    const via = usableStops.slice(0, usableStops.length - 1).map(s => encodeURIComponent(s.addr));
    const optimizeWaypoints = !constraints?.group_by_region;
    const waypointsParam = via.length
      ? (optimizeWaypoints ? `optimize:true|${via.join('|')}` : `${via.join('|')}`)
      : (optimizeWaypoints ? 'optimize:true' : '');

    const baseUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destination)}${waypointsParam ? `&waypoints=${waypointsParam}` : ''}&mode=${encodeURIComponent(modo)}&language=pt-BR&key=${apiKey}`;
    const resp = await fetch(baseUrl);
    if (!resp.ok) {
      const txt = await resp.text();
      return Response.json({ error: 'Maps request failed', details: txt }, { status: 502 });
    }
    const data = await resp.json();
    const route = data?.routes?.[0];
    if (!route) return Response.json({ error: 'No route' }, { status: 502 });

    const order = route.waypoint_order || [];
    const legs = route.legs || [];

    let total_distance_m = 0;
    let total_duration_s = 0;
    for (const l of legs) {
      total_distance_m += l?.distance?.value || 0;
      total_duration_s += l?.duration?.value || 0;
    }

    // Reordena paradas conforme waypoint_order quando otimizado; caso contrário, mantém sequência planejada
    let reordered;
    if (optimizeWaypoints && order.length) {
      reordered = order.map((idx) => usableStops[idx]).concat([usableStops[usableStops.length - 1]]);
    } else {
      reordered = usableStops;
    }

    // Agrupa rótulos por região (best-effort)
    const byId = Object.fromEntries(entregas.map(e => [e.id, e]));
    const regionOf = (id) => {
      const e = byId[id];
      return e?.regiao_entrega_nome || e?.regiao_entrega_id || 'Sem Região';
    };

    // Estimar ETAs e status de SLA
    const now = Date.now();
    const etas = [];
    let accS = 0;
    for (const l of legs) { etas.push(new Date(now + (accS + (l?.duration?.value||0)) * 1000).toISOString()); accS += (l?.duration?.value || 0); }
    // legs length = ordered.length; última perna leva ao destino final
    let ordered = reordered.map((s, idx) => ({ entrega_id: s.id, label: s.label, address: s.addr, eta_iso: etas[idx] || null, regiao: regionOf(s.id) }));

    // Pós-processamento de restrições: janelas estritas, limite de paradas e duração
    const unassigned = [];
    if (usarJanelaEstrita) {
      const filtered = [];
      for (let i = 0; i < ordered.length; i++) {
        const o = ordered[i];
        const e = byId[o.entrega_id];
        const ji = parseHHMM(e?.janela_entrega_inicio);
        const jf = parseHHMM(e?.janela_entrega_fim);
        const d = o.eta_iso ? new Date(o.eta_iso) : null;
        const etaMin = d ? (d.getHours() * 60 + d.getMinutes()) : Number.POSITIVE_INFINITY;
        const okInicio = (ji === Number.POSITIVE_INFINITY) || (etaMin >= ji);
        const okFim = (jf === Number.POSITIVE_INFINITY) || (etaMin <= jf);
        if (okInicio && okFim) filtered.push(o); else unassigned.push(o.entrega_id);
      }
      ordered = filtered;
    }

    if (maxStops && ordered.length > maxStops) {
      const excess = ordered.splice(maxStops);
      unassigned.push(...excess.map(x => x.entrega_id));
    }

    if (maxRouteMin && legs?.length) {
      let acc = 0;
      let keepCount = 0;
      for (let i = 0; i < legs.length && i < ordered.length; i++) {
        acc += (legs[i]?.duration?.value || 0) / 60; // minutos
        if (acc <= maxRouteMin) keepCount = i + 1; else break;
      }
      if (keepCount < ordered.length) {
        const removed = ordered.splice(keepCount);
        unassigned.push(...removed.map(x => x.entrega_id));
        // recomputa totais parciais
        let td = 0, ts = 0;
        for (let i = 0; i < keepCount && i < legs.length; i++) { td += legs[i]?.distance?.value || 0; ts += legs[i]?.duration?.value || 0; }
        total_distance_m = td; total_duration_s = ts;
      }
    }

    // Best-effort: atualizar 'data_previsao' e histórico de planejamento
    try {
      for (let i = 0; i < ordered.length; i++) {
        const o = ordered[i];
        const data_previsao = o.eta_iso ? o.eta_iso.slice(0,10) : null;
        await base44.asServiceRole.entities.Entrega.update(o.entrega_id, {
          ...(data_previsao ? { data_previsao } : {}),
          historico_status: [
            ...(entregas[i]?.historico_status || []),
            { status: 'Roteirização Planejada', data_hora: new Date().toISOString(), usuario: user.full_name || 'Sistema' }
          ]
        });
      }
    } catch (_) {}

    // Auditoria
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        usuario: user.full_name || user.email || 'Usuário',
        usuario_id: user.id,
        empresa_id,
        group_id: group_id || null,
        acao: 'Execução',
        modulo: 'Expedição',
        tipo_auditoria: 'integracao',
        entidade: 'Roteirizacao',
        descricao: `Rota otimizada para ${ordered.length} paradas`,
        dados_novos: { origem: originStr, modo, stops: usableStops.length, total_distance_m, total_duration_s, unassigned_count: (unassigned?.length||0), constraints: constraints || {} },
        data_hora: new Date().toISOString(),
        sucesso: true
      });
    } catch {}

    return Response.json({ ok: true, total_distance_m, total_duration_s, ordered, api_mode: modo, unassigned });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
