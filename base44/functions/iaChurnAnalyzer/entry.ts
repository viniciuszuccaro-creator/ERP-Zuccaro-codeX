import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getUserAndPerfil, assertPermission } from './_lib/guard.js';
import { loadChurnConfig, evaluateChurnRisk } from './_lib/churnUtils.js';

// Sinalização de churn no CRM: analisa Oportunidades e gera alerts no AuditLog
function buildChurnAuditPayload(evalRes = {}) {
  return {
    recomendacao_tipo: evalRes?.recomendacao?.tipo || null,
    probabilidade: evalRes?.detalhes?.probabilidade ?? null,
    dias_sem_contato: evalRes?.detalhes?.dias_sem_contato ?? null,
    atraso_previsto: evalRes?.detalhes?.atraso_prev ?? null,
  };
}

function buildSlowPayersAuditPayload(tops = []) {
  return {
    quantidade_clientes: tops.length,
    clientes_ids: tops.map((item) => item.cliente_id).slice(0, 20),
    maior_total: tops.length ? Math.max(...tops.map((item) => Number(item.total || 0))) : 0,
    maior_media_dias: tops.length ? Math.max(...tops.map((item) => Number(item.media || 0))) : 0,
  };
}
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const ctx = await getUserAndPerfil(base44);
    const permErr = await assertPermission(base44, ctx, 'CRM', 'Oportunidade', 'visualizar');
    if (permErr) return permErr;
    let body = {}; try { body = await req.json(); } catch { body = {}; }
    const filtros = (body?.filtros && (body.filtros.empresa_id || body.filtros.group_id)) ? body.filtros : {};
    const oportunidades = await base44.asServiceRole.entities.Oportunidade.filter(filtros, '-updated_date', 500);

    const cfg = await loadChurnConfig(base44);
    const flagged = [];

    for (const o of oportunidades) {
      const evalRes = evaluateChurnRisk(o, cfg);
      if (!evalRes.flagged) continue;
      flagged.push(o.id);
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          usuario: 'Sistema',
          acao: 'Visualização', modulo: 'CRM', entidade: 'Oportunidade', registro_id: o.id,
          descricao: `Sinal de churn: dias_sem_contato=${evalRes.detalhes.dias_sem_contato}, prob=${evalRes.detalhes.probabilidade}, atrasoPrev=${evalRes.detalhes.atraso_prev}`,
          dados_novos: buildChurnAuditPayload(evalRes),
          empresa_id: o?.empresa_id ?? (filtros?.empresa_id ?? null),
          group_id: o?.group_id ?? (filtros?.group_id ?? null),
          data_hora: new Date().toISOString(),
        });
        await base44.asServiceRole.entities.Notificacao?.create?.({
          titulo: 'Risco de Churn detectado',
          mensagem: `Oportunidade ${o?.titulo || o?.id} em risco (dias:${evalRes.detalhes.dias_sem_contato}, prob:${evalRes.detalhes.probabilidade}%).`,
          tipo: 'alerta',
          categoria: 'CRM',
          prioridade: 'Média',
          empresa_id: o?.empresa_id
        });
      } catch {}
    }

// Perfil Cliente (pagadores lentos, alto valor)
let sugeridas = 0;
try {
  const receber = await base44.asServiceRole.entities.ContaReceber.filter(filtros, '-updated_date', 500);
  const pend = (Array.isArray(receber) ? receber : []).filter(c => c.status === 'Pendente' && c.data_vencimento);
  const byCliente = pend.reduce((acc, c) => { const k = c?.cliente_id || c?.cliente || 'unknown'; (acc[k] = acc[k] || []).push(c); return acc; }, {});
  const tops = Object.entries(byCliente).map(([k, list]) => {
    const total = list.reduce((s, c) => s + (Number(c.valor)||0), 0);
    const dias = list.map(c => Math.max(0, Math.floor((Date.now() - new Date(c.data_vencimento).getTime())/86400000)));
    const media = dias.length ? dias.reduce((a,b)=>a+b,0)/dias.length : 0;
    return { cliente_id: k, total, media };
  }).filter(x => x.media >= 20 && x.total >= 50000).sort((a,b)=> b.total - a.total).slice(0, 10);
  sugeridas = tops.length;
  if (tops.length) {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: 'Sistema', acao: 'Visualização', modulo: 'CRM', entidade: 'PerfilCliente',
      descricao: `Pagadores lentos e alto valor: ${tops.length}`,
      dados_novos: buildSlowPayersAuditPayload(tops), empresa_id: (filtros?.empresa_id ?? null), group_id: (filtros?.group_id ?? null), data_hora: new Date().toISOString()
    });
    await base44.asServiceRole.entities.Notificacao?.create?.({
      titulo: 'Clientes com Risco Financeiro (CRM)',
      mensagem: `${tops.length} cliente(s) com atraso médio >=20 dias e alto valor.`,
      tipo: 'alerta', categoria: 'CRM', prioridade: 'Alta',
      empresa_id: (filtros?.empresa_id ?? null)
    });
  }
} catch {}

return Response.json({ ok: true, sinalizadas: flagged.length, sugeridas });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});