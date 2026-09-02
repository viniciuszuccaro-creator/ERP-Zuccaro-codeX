import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { loadAnomalyConfig, computeIssues } from './_lib/anomalyUtils.js';
import * as ss from 'npm:simple-statistics@7.8.3';
import { notify } from './_lib/notificationService.js';
import { requireEntityGuard } from './_lib/security/guardCallPolicy.js';

// Detecção de anomalias financeiras (ML leve) com alerta no NotificationCenter
// === Helpers IA Estratégica Setorial (Ferro & Aço) - v1 ===
const safeNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const groupBy = (arr, keyFn) => arr.reduce((acc, x) => { const k = keyFn(x); (acc[k] = acc[k] || []).push(x); return acc; }, {});

function summarizeBy(items = [], key = 'severity') {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const name = item?.[key] || 'indefinido';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
}

function summarizeIssuesForAudit(issues = []) {
  const list = Array.isArray(issues) ? issues : [];
  return {
    total: list.length,
    por_severidade: summarizeBy(list, 'severity'),
    por_entidade: summarizeBy(list, 'entidade'),
    por_tipo: summarizeBy(list, 'tipo'),
    ids_amostra: list.map((item) => item?.id).filter(Boolean).slice(0, 30),
  };
}

function summarizeSuggestionsForAudit(sugestoes = []) {
  const list = Array.isArray(sugestoes) ? sugestoes : [];
  return {
    total: list.length,
    por_tipo: summarizeBy(list, 'tipo'),
    motivos: Array.from(new Set(list.map((item) => item?.motivo).filter(Boolean))).slice(0, 20),
  };
}

function summarizeForecastForAudit(previsoes = [], bodyPrevisao = {}, estoqueParams = {}) {
  const list = Array.isArray(previsoes) ? previsoes : [];
  return {
    total_itens: list.length,
    horizonte_dias: Number(bodyPrevisao?.horizon_days ?? 14),
    filtros_parametros: Object.keys(estoqueParams || {}),
    por_risco_ruptura: summarizeBy(list, 'risco_ruptura'),
    recomendacoes: summarizeBy(list, 'recomendacao'),
    produtos_ids_amostra: list.map((item) => item?.produto_id).filter(Boolean).slice(0, 30),
  };
}

function summarizeNotificationPayload(issues = [], sugestoes = []) {
  return {
    resumoSeveridade: summarizeBy(issues, 'severity'),
    issues: summarizeIssuesForAudit(issues),
    sugestoes: summarizeSuggestionsForAudit(sugestoes),
  };
}

function summarizeScanPerformance(durationMs, filtros = {}) {
  return {
    durationMs,
    empresa_id: filtros?.empresa_id || null,
    group_id: filtros?.group_id || null,
  };
}
function detectSteelPriceOscillation(produtos = [], fornecedores = []) {
  const fornById = fornecedores.reduce((m, f) => { m[f.id] = f; return m; }, {});
  const issues = [];
  const sugestoes = [];
  for (const p of produtos) {
    if (p?.eh_bitola !== true) continue;
    const custoRef = safeNum(p.ultimo_preco_compra ?? p.custo_aquisicao ?? p.custo_medio, 0);
    const precoVenda = safeNum(p.preco_venda, 0);
    const oscil = custoRef > 0 ? Math.abs((safeNum(p.custo_medio, custoRef) - custoRef) / custoRef) : 0;
    if (oscil >= 0.1) {
      issues.push({ entidade: 'Produto', tipo: 'oscilacao_preco_aco', severity: oscil >= 0.2 ? 'alto' : 'medio', id: p.id, data: { produto: p.descricao, oscilacao: Number((oscil*100).toFixed(1)) } });
    }
    const margemMin = safeNum(p.margem_minima_percentual, 10) / 100;
    const margemAtual = custoRef > 0 ? (precoVenda - custoRef) / custoRef : 0;
    if (margemAtual < margemMin + 0.05) {
      sugestoes.push({ tipo: 'reajuste_preco', produto_id: p.id, motivo: 'margem_baixa', dados: { margemAtual: Number((margemAtual*100).toFixed(1)), margemMin: Number((margemMin*100).toFixed(1)) } });
    }
    const f = fornById[p.fornecedor_id];
    const lead = safeNum(f?.lead_time_medio, 0);
    const giro30 = safeNum(p.quantidade_vendida_30dias, 0);
    const estDisp = safeNum(p.estoque_disponivel ?? (p.estoque_atual - p.estoque_reservado), 0);
    const estMin = safeNum(p.estoque_minimo, 0);
    if (giro30 > 0 && estDisp < estMin + giro30 && lead >= 7) {
      sugestoes.push({ tipo: 'compra_antecipada', produto_id: p.id, motivo: 'estoque_baixo_giro_alto_lead_alto', dados: { giro30, lead, estDisp, estMin } });
    }
  }
  return { issues, sugestoes };
}

function analyzeObraConsumption(pedidos = [], movs = []) {
  const issues = [];
  const sugestoes = [];
  const movByDoc = groupBy(movs, m => m?.origem_documento_id || '');
  for (const ped of pedidos) {
    if (!Array.isArray(ped?.itens_corte_dobra) || ped.itens_corte_dobra.length === 0) continue;
    const estimado = ped.itens_corte_dobra.reduce((s, it) => s + safeNum(it.quantidade, 0), 0);
    const relMovs = movByDoc[ped.id] || [];
    const real = relMovs.reduce((s, m) => s + Math.abs(safeNum(m.quantidade, 0)), 0);
    if (estimado <= 0) continue;
    const rendimento = real / estimado;
    const sucata = real > estimado ? (real - estimado) / estimado : 0;
    if (rendimento < 0.9 || sucata > 0.1) {
      issues.push({ entidade: 'Pedido', tipo: 'rendimento_obra_baixo', severity: 'medio', id: ped.id, data: { obra: ped.obra_destino_nome || ped.obra_destino_id, rendimento: Number((rendimento*100).toFixed(1)), sucata: Number((sucata*100).toFixed(1)) } });
      sugestoes.push({ tipo: 'ajuste_rendimento_obra', pedido_id: ped.id, motivo: 'rendimento_baixo_ou_sucata_alta' });
    }
  }
  return { issues, sugestoes };
}

function analyzeLogistics(entregas = []) {
  const issues = [];
  const sugestoes = [];
  const byMotorista = groupBy(entregas, e => e?.motorista_id || '');
  for (const [mid, list] of Object.entries(byMotorista)) {
    if (!mid || mid === 'null' || mid === 'undefined') continue;
    const avgTempo = list.reduce((s, e) => s + safeNum(e.tempo_total_minutos, 0), 0) / Math.max(1, list.length);
    const atrasos = list.filter(e => e?.data_previsao && e?.data_entrega && new Date(e.data_entrega) > new Date(e.data_previsao)).length;
    const taxaAtraso = atrasos / Math.max(1, list.length);
    if (taxaAtraso >= 0.3 || avgTempo > 180) {
      issues.push({ entidade: 'Entrega', tipo: 'ineficiencia_logistica', severity: taxaAtraso >= 0.5 ? 'alto' : 'medio', id: mid, data: { motorista_id: mid, taxaAtraso: Number((taxaAtraso*100).toFixed(1)), avgTempo: Math.round(avgTempo) } });
      sugestoes.push({ tipo: 'melhoria_rota', motorista_id: mid, motivo: 'taxa_atraso_ou_tempo_alto' });
    }
  }
  return { issues, sugestoes };
}

function profileClients(contas = []) {
  const issues = [];
  const sugestoes = [];
  const pend = (Array.isArray(contas) ? contas : []).filter(c => c.status === 'Pendente' && c.data_vencimento);
  const byCliente = groupBy(pend, c => c?.cliente_id || c?.cliente || '');
  for (const [cid, list] of Object.entries(byCliente)) {
    const total = list.reduce((s, c) => s + safeNum(c.valor, 0), 0);
    const dias = list.map(c => Math.max(0, Math.floor((Date.now() - new Date(c.data_vencimento).getTime()) / 86400000)));
    const media = dias.length ? dias.reduce((a,b)=>a+b,0)/dias.length : 0;
    if (media >= 20 && total >= 50000) {
      issues.push({ entidade: 'ContaReceber', tipo: 'perfil_pagador_lento', severity: 'medio', id: cid, data: { cliente_id: cid, mediaDias: Math.round(media), total } });
      sugestoes.push({ tipo: 'cobranca_proativa', cliente_id: cid, motivo: 'media_dias_alta_e_valor_alto', dados: { mediaDias: Math.round(media), total } });
    }
  }
  return { issues, sugestoes };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const t0 = Date.now();
    const warnings = [];
    const reportScanFailure = (operation, error, context = {}) => {
      const warning = {
        operation,
        error: error?.message || String(error),
        ...context,
      };
      warnings.push(warning);
      console.error('[iaFinanceAnomalyScan] ' + operation, warning);
    };
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    const isScheduled = !user;

    // Filtros opcionais (multiempresa): { empresa_id?, group_id? }
    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const filtros = (body?.filtros && (body.filtros.empresa_id || body.filtros.group_id)) ? body.filtros : {};
    if (!filtros?.group_id) {
      return Response.json({ error: 'Contexto multiempresa obrigatorio para analise financeira' }, { status: 400 });
    }

        // RBAC granular via entityGuard (permite não-admin com permissão)
        if (!isScheduled) {
          const intentModule = body?.previsao_estoque?.enabled ? 'Estoque' : 'Financeiro';
          const guardFailure = await requireEntityGuard(base44, {
            module: intentModule, section: 'IA', action: 'visualizar', ...filtros,
          });
          if (guardFailure) return guardFailure;
        }

         // Coleta com escopo (quando fornecido)
    const receber = await base44.asServiceRole.entities.ContaReceber.filter(filtros, '-updated_date', 500);
    const pagar = await base44.asServiceRole.entities.ContaPagar.filter(filtros, '-updated_date', 500);
    if (!Array.isArray(receber) || !Array.isArray(pagar)) {
      return Response.json({ ok: true, issues: 0, details: [] });
    }

    // Ferro & Aço: detectar órfãos/inconsistências de estoque/produto + contexto ampliado
    let produtos = [], movs = [], fornecedores = [], pedidos = [], entregas = [];
    try { produtos = await base44.asServiceRole.entities.Produto.filter(filtros, '-updated_date', 300); } catch (error) { reportScanFailure('Falha ao carregar produtos', error, filtros); }
    try { movs = await base44.asServiceRole.entities.MovimentacaoEstoque.filter(filtros, '-updated_date', 300); } catch (error) { reportScanFailure('Falha ao carregar movimentacoes de estoque', error, filtros); }
    try { fornecedores = await base44.asServiceRole.entities.Fornecedor.filter(filtros, '-updated_date', 200); } catch (error) { reportScanFailure('Falha ao carregar fornecedores', error, filtros); }
    try { pedidos = await base44.asServiceRole.entities.Pedido.filter(filtros, '-updated_date', 200); } catch (error) { reportScanFailure('Falha ao carregar pedidos', error, filtros); }
    try { entregas = await base44.asServiceRole.entities.Entrega.filter(filtros, '-updated_date', 200); } catch (error) { reportScanFailure('Falha ao carregar entregas', error, filtros); }

    const orphanProdutos = produtos.filter(p => p.eh_bitola === true && !p.empresa_id);
    const estoqueSemFilial = movs.filter(m => !m.empresa_id || !m.localizacao_destino);
    let issues = [];
    let sugestoes = [];
    orphanProdutos.forEach(p => issues.push({ entidade: 'Produto', tipo: 'orfa_bitola_sem_empresa', severity: 'alto', id: p.id, data: p }));
    estoqueSemFilial.forEach(m => issues.push({ entidade: 'MovimentacaoEstoque', tipo: 'estoque_sem_filial', severity: 'alto', id: m.id, data: m }));

    // Grandes variações em estoque de aço/bitola
    try {
      const minKg = Number((await loadAnomalyConfig(base44))?.estoque?.anomaly?.min_kg_change ?? 500);
      const bigSteel = movs.filter(m => Number(Math.abs(m?.quantidade || 0)) >= minKg && (
        String(m?.produto_descricao || '').toLowerCase().includes('aço') ||
        String(m?.produto_descricao || '').toLowerCase().includes('aco') ||
        m?.produto_id
      ));
      bigSteel.forEach(m => issues.push({ entidade: 'MovimentacaoEstoque', tipo: 'estoque_aco_grande_variacao', severity: 'alto', id: m.id, data: { id: m.id, quantidade: m.quantidade, produto: m.produto_descricao } }));
    } catch (error) {
      reportScanFailure('Falha ao analisar variacoes de estoque', error, filtros);
    }

    // Tentativas repetidas (ajustes frequentes por responsável nas últimas 48h)
    try {
      const hoje = new Date();
      const inicio = new Date(hoje.getTime() - 2 * 24 * 60 * 60 * 1000);
      const ajustes = movs.filter(m => String(m?.tipo_movimento || '').toLowerCase() === 'ajuste' && m?.data_movimentacao && new Date(m.data_movimentacao) >= inicio);
      const byResp = ajustes.reduce((acc, m) => { const k = m?.responsavel || 'desconhecido'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
      Object.entries(byResp).forEach(([resp, cnt]) => {
        if (cnt >= 5) issues.push({ entidade: 'MovimentacaoEstoque', tipo: 'ajustes_repetidos_responsavel', severity: 'medio', responsavel: resp, quantidade: cnt });
      });
    } catch (error) {
      reportScanFailure('Falha ao analisar ajustes repetidos', error, filtros);
    }

    // Regras configuráveis + detecções já existentes
          const cfg = await loadAnomalyConfig(base44);
          issues = (computeIssues(receber, pagar, cfg) || []).concat(issues);
          // IA Setorial: extensões Ferro & Aço
          try {
            const r1 = detectSteelPriceOscillation(produtos, fornecedores);
            issues = issues.concat(r1.issues); sugestoes = sugestoes.concat(r1.sugestoes);
          } catch (error) { reportScanFailure('Falha ao analisar oscilacao de preco', error, filtros); }
          try {
            const r2 = analyzeObraConsumption(pedidos, movs);
            issues = issues.concat(r2.issues); sugestoes = sugestoes.concat(r2.sugestoes);
          } catch (error) { reportScanFailure('Falha ao analisar consumo por obra', error, filtros); }
          try {
            const r3 = analyzeLogistics(entregas);
            issues = issues.concat(r3.issues); sugestoes = sugestoes.concat(r3.sugestoes);
          } catch (error) { reportScanFailure('Falha ao analisar logistica', error, filtros); }
          try {
            const r4 = profileClients(receber);
            issues = issues.concat(r4.issues); sugestoes = sugestoes.concat(r4.sugestoes);
          } catch (error) { reportScanFailure('Falha ao analisar perfil de clientes', error, filtros); }

          // 2.0: Persistir flags em títulos de Pagar quando aplicável (service role)
          try {
            const idsDiverg = Array.from(new Set(issues.filter(i => i.entidade === 'ContaPagar' && i.tipo === 'taxa_marketplace_divergente' && i.id).map(i => i.id))).slice(0, 50);
            const idsDup = Array.from(new Set(issues.filter(i => i.entidade === 'ContaPagar' && i.tipo === 'duplicidade_pagar' && i.id).map(i => i.id))).slice(0, 50);
            if (idsDiverg.length || idsDup.length) {
              await Promise.all([
                ...idsDiverg.map(id => base44.asServiceRole.entities.ContaPagar.update(id, { alerta_taxa_divergente: true })),
                ...idsDup.map(id => base44.asServiceRole.entities.ContaPagar.update(id, { duplicidade_detectada: true }))
              ]);
            }
          } catch (error) {
            reportScanFailure('Falha ao persistir alertas financeiros', error, filtros);
          }

    // ML leve: outliers por Z-Score (valor)
    const valoresRec = Array.isArray(receber) ? receber.map(r => Number(r.valor || 0)).filter(v => v > 0) : [];
    const valoresPag = Array.isArray(pagar) ? pagar.map(p => Number(p.valor || 0)).filter(v => v > 0) : [];

    const addZOutliers = (arr, baseList, entidade) => {
      if (!arr.length) return;
      const mean = ss.mean(arr);
      const stdev = ss.standardDeviation(arr) || 1;
      const zThr = Number(cfg?.finance?.anomaly?.zscore_threshold ?? 3); // |z| >= zThr
      arr.forEach((v, i) => {
        const z = (v - mean) / stdev;
        if (Math.abs(z) >= zThr) {
          const ref = baseList[i];
          issues.push({ entidade, tipo: 'valor_outlier', severity: 'alto', valor: v, zscore: Number(z.toFixed(2)), id: ref?.id, data: ref });
        }
      });
    };

    addZOutliers(valoresRec, receber, 'ContaReceber');
    addZOutliers(valoresPag, pagar, 'ContaPagar');

    // ML leve: IQR (valor)
    const detectIQR = (arr, baseList, entidade) => {
      if (!arr.length) return;
      const sorted = [...arr].sort((a, b) => a - b);
      const q1 = ss.quantileSorted(sorted, 0.25);
      const q3 = ss.quantileSorted(sorted, 0.75);
      const iqr = q3 - q1 || 1;
      const k = Number(cfg?.finance?.anomaly?.iqr_multiplier ?? 1.5);
      const low = q1 - k * iqr;
      const high = q3 + k * iqr;
      arr.forEach((v, i) => {
        if (v < low || v > high) {
          const ref = baseList[i];
          issues.push({ entidade, tipo: 'valor_outlier_iqr', severity: 'medio', valor: v, q1, q3, iqr, id: ref?.id, data: ref });
        }
      });
    };

    detectIQR(valoresRec, receber, 'ContaReceber');
    detectIQR(valoresPag, pagar, 'ContaPagar');

    // ML leve: MAD (dias atraso) para pendentes
    const hoje = new Date();
    const daysLate = (dt) => Math.floor((hoje - new Date(dt)) / (1000 * 60 * 60 * 24));

    const pendRec = Array.isArray(receber) ? receber.filter(c => c.status === 'Pendente' && c.data_vencimento) : [];
    const pendPag = Array.isArray(pagar) ? pagar.filter(c => c.status === 'Pendente' && c.data_vencimento) : [];

    const detectMad = (baseList, entidade) => {
      const arr = baseList.map(c => Math.max(0, daysLate(c.data_vencimento)));
      if (!arr.length) return;
      const med = ss.median(arr);
      const absDev = arr.map(x => Math.abs(x - med));
      const mad = ss.median(absDev) || 1;
      const madK = Number(cfg?.finance?.anomaly?.mad_multiplier ?? 3);
      const thr = med + madK * mad; // robusto
      arr.forEach((v, i) => {
        if (v >= thr && v > 0) {
          const ref = baseList[i];
          issues.push({ entidade, tipo: 'atraso_outlier_mad', severity: 'medio', dias: v, med, mad, id: ref?.id, data: ref });
        }
      });
    };

    detectMad(pendRec, 'ContaReceber');
    detectMad(pendPag, 'ContaPagar');

    // Previsões de Estoque/Preço (IA leve) — multiempresa
    let previsoes = [];
    try {
      if (body?.previsao_estoque?.enabled) {
        const horizon = Number(body?.previsao_estoque?.horizon_days ?? 14);
        const estoqueParams = body?.previsao_estoque?.params || body?.estoque_params || {};
        const { tipos_aco, bitola_min_mm, bitola_max_mm, preco_min, preco_max } = estoqueParams;
        const filtroProdutos = produtos.filter(p => {
          if (p?.eh_bitola !== true) return false;
          if (Array.isArray(tipos_aco) && tipos_aco.length && p?.tipo_aco && !tipos_aco.includes(p.tipo_aco)) return false;
          if (bitola_min_mm != null && Number(p?.bitola_diametro_mm || 0) < Number(bitola_min_mm)) return false;
          if (bitola_max_mm != null && Number(p?.bitola_diametro_mm || 0) > Number(bitola_max_mm)) return false;
          const precoBase = Number(p?.preco_venda ?? p?.custo_medio ?? 0);
          if (preco_min != null && precoBase < Number(preco_min)) return false;
          if (preco_max != null && precoBase > Number(preco_max)) return false;
          return true;
        });
        const series = (arr) => {
          const vals = arr.filter(v => Number.isFinite(Number(v))).map(Number);
          if (vals.length === 0) return { mean: 0, trend: 0 };
          const mean = ss.mean(vals);
          const trend = vals.length >= 2 ? (vals[vals.length - 1] - vals[0]) / (vals.length - 1) : 0;
          return { mean, trend };
        };
        for (const p of filtroProdutos) {
          // Sinais: vendas 30d, estoque atual, custo e preço
          const vendas = [p?.quantidade_vendida_12meses, p?.quantidade_vendida_30dias, p?.estoque_disponivel].filter(v => v != null);
          const { mean, trend } = series(vendas);
          const demandaDia = Math.max(0, mean / 30);
          const estoqueAtual = Number(p?.estoque_disponivel ?? p?.estoque_atual ?? 0);
          const diasCobertura = demandaDia > 0 ? estoqueAtual / demandaDia : Infinity;
          const preco = Number(p?.preco_venda ?? 0);
          const custo = Number(p?.custo_medio ?? p?.custo_aquisicao ?? 0);
          const margem = custo > 0 ? (preco - custo) / custo : 0;
          // Previsão simples de preço: tendência da série de preço/custo
          const priceVals = [p?.ultimo_preco_compra, p?.custo_medio, p?.preco_venda].filter(v => v != null);
          const { trend: pTrend } = series(priceVals);
          const precoPrevisto = Number((preco + pTrend * (horizon/30)).toFixed(2));
          const riscoRuptura = Number.isFinite(diasCobertura) ? (diasCobertura < horizon ? 'alto' : diasCobertura < horizon * 1.5 ? 'medio' : 'baixo') : 'baixo';
          previsoes.push({
            produto_id: p.id,
            descricao: p.descricao,
            horizonte_dias: horizon,
            demanda_dia_estimada: Number(demandaDia.toFixed(2)),
            dias_cobertura: Number.isFinite(diasCobertura) ? Number(diasCobertura.toFixed(1)) : null,
            risco_ruptura: riscoRuptura,
            recomendacao: riscoRuptura !== 'baixo' ? 'repor' : 'ok',
            margem_percentual: Number((margem * 100).toFixed(1)),
            tendencia_demanda: Number(trend.toFixed(2)),
            preco_previsto: precoPrevisto,
          });
        }
        // Auditoria das previsões (entrada/saída)
        try {
          await base44.asServiceRole.entities.AuditLog.create({
            usuario: user?.full_name || 'Sistema',
            acao: 'Visualização',
            modulo: 'Estoque',
            tipo_auditoria: 'ia',
            entidade: 'PrevisaoEstoque',
            descricao: `Previsões geradas para ${previsoes.length} itens`,
            empresa_id: filtros?.empresa_id || null,
            group_id: filtros?.group_id || null,
            dados_novos: summarizeForecastForAudit(previsoes, body?.previsao_estoque, estoqueParams),
            data_hora: new Date().toISOString(),
          });
        } catch (error) {
          reportScanFailure('Falha ao auditar previsao de estoque', error, filtros);
        }
      }
    } catch (error) {
      reportScanFailure('Falha ao calcular previsao de estoque', error, filtros);
    }

    // Auditoria + Alerta no NotificationCenter
    if (issues.length > 0) {
      // Usa empresa do primeiro título como contexto padrão
      const alvoEmpresaId = (filtros?.empresa_id) || (receber[0]?.empresa_id) || (pagar[0]?.empresa_id) || null;

      await base44.asServiceRole.entities.AuditLog.create({
        usuario: 'Sistema',
        acao: 'Visualização',
        modulo: 'Financeiro',
        entidade: 'Monitoramento',
        descricao: `Anomalias detectadas: ${issues.length}`,
        dados_novos: { issues: summarizeIssuesForAudit(issues), sugestoes: summarizeSuggestionsForAudit(sugestoes) },
        empresa_id: alvoEmpresaId || null,
        group_id: filtros?.group_id || null,
        data_hora: new Date().toISOString(),
      });

      const resumoSeveridade = issues.reduce((acc, i) => { acc[i.severity] = (acc[i.severity] || 0) + 1; return acc; }, {});

      await notify(base44, {
        titulo: 'Anomalias Financeiras Detectadas',
        mensagem: `${issues.length} ocorrência(s) (Alta:${resumoSeveridade.alto || 0} • Média:${resumoSeveridade.medio || 0} • Baixa:${resumoSeveridade.baixo || 0}).`,
        tipo: 'alerta',
        categoria: 'Financeiro',
        prioridade: 'Alta',
        empresa_id: alvoEmpresaId,
        dados: summarizeNotificationPayload(issues, sugestoes)
      }, { whatsapp: true });

      // Canal opcional: WhatsApp (se configurado em Configuração do Sistema)
      try {
        if (cfg?.finance?.alerts?.whatsapp?.enabled && cfg.finance.alerts.whatsapp.to) {
          const msg = `Financeiro: ${issues.length} anomalia(s). Alta:${resumoSeveridade.alto || 0} • Média:${resumoSeveridade.medio || 0} • Baixa:${resumoSeveridade.baixo || 0}.`;
          await base44.asServiceRole.functions.invoke('whatsappSend', {
            action: 'sendText',
            numero: cfg.finance.alerts.whatsapp.to,
            mensagem: msg,
            empresaId: alvoEmpresaId || null,
            groupId: filtros?.group_id || null,
          });
        }
      } catch (error) {
        reportScanFailure('Falha ao enviar alerta financeiro por WhatsApp', error, filtros);
      }
    }

    const durationMs = Date.now() - t0;
    try { if (durationMs > 500) { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Sistema', acao: 'Visualização', modulo: body?.previsao_estoque?.enabled ? 'Estoque' : 'Financeiro', tipo_auditoria: 'sistema', entidade: 'Performance', descricao: `iaFinanceAnomalyScan demorou ${durationMs}ms`, dados_novos: summarizeScanPerformance(durationMs, filtros), group_id: filtros?.group_id || null, data_hora: new Date().toISOString() }); } } catch (error) { reportScanFailure('Falha ao auditar desempenho da analise', error, filtros); }
    return Response.json({ ok: true, issues: issues.length, details: issues, previsoes, warnings });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
