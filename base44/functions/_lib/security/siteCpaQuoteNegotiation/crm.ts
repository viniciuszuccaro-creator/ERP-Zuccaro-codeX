import { SiteCpaQuoteError } from './contract.ts';

const text = (value) => String(value ?? '').trim();

export const ensureQuoteOpportunity = async ({ base44, scope, quote }) => {
  let existing;
  try {
    const rows = await base44.asServiceRole.entities.Oportunidade.filter({
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      orcamento_id: quote.id,
    }, '-created_date', 2);
    existing = (Array.isArray(rows) ? rows : [])[0] || null;
  } catch {
    throw new SiteCpaQuoteError(503, 'site_cpa_quote_crm_unavailable');
  }
  if (existing) {
    if (text(existing.cliente_id) !== text(quote.cliente_id)) {
      throw new SiteCpaQuoteError(409, 'site_cpa_quote_crm_conflict');
    }
    return existing;
  }
  try {
    return await base44.asServiceRole.entities.Oportunidade.create({
      titulo: `Orçamento Site ${quote.numero_pedido || quote.id}`,
      descricao: 'Oportunidade originada pelo contrato oficial do Site CPA.',
      origem: 'SITE_CPA',
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      cliente_id: quote.cliente_id,
      cliente_nome: quote.cliente_nome || null,
      vendedor_id: quote.vendedor_id || null,
      vendedor_nome: quote.vendedor || null,
      valor_estimado: Number(quote.valor_total || 0),
      etapa: 'Proposta',
      etapa_funil: 'Proposta',
      status: 'Aberto',
      data_abertura: quote.data_pedido || new Date().toISOString().slice(0, 10),
      orcamento_id: quote.id,
      origem_externa_id: quote.origem_externa_id || null,
    });
  } catch {
    throw new SiteCpaQuoteError(503, 'site_cpa_quote_crm_unavailable');
  }
};
