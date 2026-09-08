import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { optimizeProductPrice } from './_lib/pricing/optimizeProductPriceHandler.js';
import { getUserAndPerfil, assertPermission, audit } from './_lib/guard.js';

// === IA Setorial (Ferro & Aço) — helpers locais ===
function computeSteelSuggestions(produtos = []) {
  const sugestoes = [];
  for (const p of produtos) {
    if (p?.eh_bitola !== true) continue;
    const custoRef = Number(p.ultimo_preco_compra ?? p.custo_aquisicao ?? p.custo_medio) || 0;
    const precoVenda = Number(p.preco_venda) || 0;
    const margemMin = (Number(p.margem_minima_percentual) || 10) / 100;
    const margemAtual = custoRef > 0 ? (precoVenda - custoRef) / custoRef : 0;
    if (margemAtual < margemMin + 0.05) {
      sugestoes.push({ tipo: 'reajuste_preco', produto_id: p.id, motivo: 'margem_baixa', dados: { margemAtual: Number((margemAtual*100).toFixed(1)), margemMin: Number((margemMin*100).toFixed(1)) } });
    }
    const giro30 = Number(p.quantidade_vendida_30dias) || 0;
    const estDisp = Number(p.estoque_disponivel ?? (p.estoque_atual - p.estoque_reservado)) || 0;
    const estMin = Number(p.estoque_minimo) || 0;
    if (giro30 > 0 && estDisp < estMin + giro30) {
      sugestoes.push({ tipo: 'compra_antecipada', produto_id: p.id, motivo: 'estoque_baixo_giro_alto', dados: { giro30, estDisp, estMin } });
    }
  }
  return sugestoes;
}

// Ferro & Aço: oscilação de preço por bitola/fornecedor
function detectSteelPriceOscillation(produtos = [], fornecedores = []) {
  const fornById = fornecedores.reduce((m, f) => { m[f.id] = f; return m; }, {});
  const issues = [];
  const sugestoes = [];
  for (const p of produtos) {
    if (p?.eh_bitola !== true) continue;
    const custoRef = Number(p.ultimo_preco_compra ?? p.custo_aquisicao ?? p.custo_medio) || 0;
    const precoVenda = Number(p.preco_venda) || 0;
    const oscil = custoRef > 0 ? Math.abs(((Number(p.custo_medio) || custoRef) - custoRef) / custoRef) : 0;
    if (oscil >= 0.1) {
      issues.push({ entidade: 'Produto', tipo: 'oscilacao_preco_aco', severity: oscil >= 0.2 ? 'alto' : 'medio', id: p.id, dados: { produto: p.descricao, oscilacao: Number((oscil*100).toFixed(1)), fornecedor_id: p.fornecedor_id || null } });
    }
    const margemMin = ((Number(p.margem_minima_percentual) || 10) / 100);
    const margemAtual = custoRef > 0 ? (precoVenda - custoRef) / custoRef : 0;
    if (margemAtual < margemMin + 0.05) {
      sugestoes.push({ tipo: 'reajuste_preco', produto_id: p.id, motivo: 'margem_baixa', dados: { margemAtual: Number((margemAtual*100).toFixed(1)), margemMin: Number((margemMin*100).toFixed(1)) } });
    }
    const f = fornById[p.fornecedor_id];
    const lead = Number(f?.lead_time_medio) || 0;
    const giro30 = Number(p.quantidade_vendida_30dias) || 0;
    const estDisp = Number(p.estoque_disponivel ?? (p.estoque_atual - p.estoque_reservado)) || 0;
    const estMin = Number(p.estoque_minimo) || 0;
    if (giro30 > 0 && estDisp < estMin + giro30 && lead >= 7) {
      sugestoes.push({ tipo: 'compra_antecipada', produto_id: p.id, motivo: 'estoque_baixo_giro_alto_lead_alto', dados: { giro30, lead, estDisp, estMin } });
    }
  }
  return { issues, sugestoes };
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    let payload; try { payload = await req.json(); } catch { payload = {}; }
    const event = payload?.event || null;
    const entityId = event?.entity_id || payload?.produto_id || null;
    const isBatch = !entityId; // Automação diária roda em lote quando não enviar produto_id

    // Se automação passar produto_id vazio/null, cai para lote ao invés de 400
    if (!isBatch && (entityId === null || entityId === undefined || entityId === '')) {
      // força modo lote para evitar 400 em execuções agendadas
      return Response.json({ ok: true, batch: true, note: 'produto_id ausente — fallback para lote', skipped: true });
    }

    // Se vier evento de update, processa só quando houve alteração de custo relevante
    const data = payload?.data || null;
    const oldData = payload?.old_data || null;
    if (event?.type === 'update') {
      const costFields = ['custo_medio', 'custo_aquisicao'];
      const changed = costFields.some(f => (data?.[f] ?? null) !== (oldData?.[f] ?? null));
      if (!changed) {
        return Response.json({ ok: true, skipped: true, reason: 'no_cost_change' });
      }
    }

    // Autenticação: o agente herda o usuário. Sem usuário não executa.
    const user = await base44.auth.me().catch(() => null);
    let ctx = null;
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    ctx = await getUserAndPerfil(base44).catch(() => null);
    const perm = await assertPermission(base44, ctx, 'Comercial', 'Produto', 'editar');
    if (perm) return perm;
    if (payload?.confirmado !== true && !event) {
      return Response.json({ error: 'Acao critica do agente exige confirmacao humana.' }, { status: 403 });
    }

    // Execução em lote (sem produto_id): processa N produtos por execução para evitar timeouts // v2
    if (isBatch) {
      const limit = Math.min(Math.max(Number(payload?.limit) || 100, 1), 1000); // 1..1000
      const rawFiltro = payload?.filter || { status: 'Ativo' };
      const filtro = { ...rawFiltro };
      if (payload?.filtros?.empresa_id) filtro.empresa_id = payload.filtros.empresa_id;
      if (payload?.filtros?.group_id) filtro.group_id = payload.filtros.group_id;

      const produtos = await base44.asServiceRole.entities.Produto.filter(filtro, '-updated_date', limit);
      let updated = 0, skipped = 0, failed = 0, creditExhausted = false;

      for (const p of produtos) {
        if (creditExhausted) break;
        try {
          const r = await optimizeProductPrice(base44, ctx, { entityId: p.id, payload: { data: p }, user: user || { full_name: 'Automação' }, simulate: true });
          if (r?.updated) updated++; else skipped++;
        } catch (e) {
          const msg = String(e?.message || e);
          if (/Insufficient integration credits/i.test(msg)) {
            creditExhausted = true;
          } else {
            failed++;
          }
        }
      }

      // Oscilação de preços por bitola/fornecedor + sugestões setoriais
      const fornecedores = await base44.asServiceRole.entities.Fornecedor.filter(filtro, '-updated_date', 200);
      const osc = detectSteelPriceOscillation(produtos, fornecedores);
      const sugestoes = computeSteelSuggestions(produtos).concat(osc.sugestoes).slice(0, 100);
      const oscIssues = (osc.issues || []).slice(0, 100);
      try {
        await audit(base44, user || { full_name: 'Automação' }, {
          acao: 'Edição',
          modulo: 'Comercial',
          entidade: 'Produto',
          descricao: 'Otimização de preços em lote (agendada)',
          empresa_id: (payload?.filtros?.empresa_id ?? null),
          dados_novos: { total: produtos.length, updated, skipped, failed, creditExhausted, duracao_ms: Date.now() - t0, sugestoes, oscIssues }
        });
        if (sugestoes.length) {
          await base44.asServiceRole.entities.Notificacao?.create?.({
            titulo: 'Sugestões Comerciais (Aço)',
            mensagem: `${sugestoes.length} sugestão(ões) (reajuste/compra antecipada/oscilação).`,
            tipo: 'info',
            categoria: 'Comercial',
            prioridade: 'Média'
          });
        }
      } catch {}

      const res = { ok: true, batch: true, total: produtos.length, updated, skipped, failed, creditExhausted };
      if (creditExhausted) res.reason = 'insufficient_credits';
      return Response.json(res);
    }

    // Execução unitária (com produto_id ou webhooks)
    const result = await optimizeProductPrice(base44, ctx, { entityId, payload, user, simulate: true });
    return Response.json(result);
  } catch (error) {
    const msg = String(error?.message || error);
    if (/Insufficient integration credits/i.test(msg)) {
      // Evita falha da automação quando os créditos de integração acabarem
      return Response.json({ ok: true, skipped: true, reason: 'insufficient_credits' });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
});