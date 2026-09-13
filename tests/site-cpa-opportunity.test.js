import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SITE_CPA_OPPORTUNITY_CONTEXT_OPERATION, SITE_CPA_OPPORTUNITY_GET_OPERATION,
  SITE_CPA_OPPORTUNITY_LIST_OPERATION, SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION,
  SiteCpaOpportunityError, opportunityCapabilities, resolveSiteCpaOpportunityOperation,
} from '../base44/functions/_lib/security/siteCpaOpportunity/entry.ts';
import { normalizeOpportunityInput } from '../base44/functions/_lib/security/siteCpaOpportunity/contract.ts';

const scope = { groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa' };
const matches = (record, filter) => Object.entries(filter).every(([key, value]) => record[key] === value);
const customer = (overrides = {}) => ({
  id: 'customer-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'Ativo',
  razao_social: 'Cliente Um', locais_entrega: [{ id: 'obra-1', obra: true, nome: 'Obra Um', ativo: true }],
  ...overrides,
});
const link = (role = 'ADMIN_EMPRESA') => ({
  id: 'link-1', tipo_solicitacao: 'vinculo_site_cpa_cliente', entidade_alvo_id: 'customer-1',
  group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'aprovado',
  dados_propostos: { source: 'SITE_CPA', externalUserId: 'site-user-1', role },
});
const opportunity = (overrides = {}) => ({
  id: 'opp-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1',
  titulo: 'Cotação aço', origem: 'SITE_CPA', status: 'Aberto', etapa: 'Proposta',
  valor_estimado: 123456, probabilidade: 80, observacoes: 'interno', custo: 99, ...overrides,
});

const createState = ({ role = 'ADMIN_EMPRESA', failEntity = null, opportunities = [opportunity()] } = {}) => {
  const audits = [];
  const records = {
    Cliente: [customer()], SolicitacaoAprovacao: [link(role)], Oportunidade: opportunities,
    Pedido: [
      { id: 'quote-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1',
        tipo: 'Orçamento', site_proposal_status: 'UNDER_REVIEW' },
      { id: 'order-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1',
        tipo: 'Pedido', status: 'Pendente' },
    ],
    Projeto: [{ id: 'project-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1',
      site_armacao_status: 'NEEDS_REVIEW' }],
    ConversaOmnicanal: [{ id: 'chat-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1', status: 'Nova' }],
    Entrega: [{ id: 'delivery-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1', status: 'Ocorrência' }],
    ContaReceber: [{ id: 'receive-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1', saldo: 999 }],
  };
  const entities = Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, {
    filter: async (filter = {}) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      return rows.filter((record) => matches(record, filter));
    },
    create: async (record) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      const created = { id: `${name}-${rows.length + 1}`, created_date: '2026-09-13T12:00:00.000Z', ...record };
      rows.push(created);
      return created;
    },
  }]));
  entities.AuditLog = { create: async (record) => {
    if (failEntity === 'AuditLog') throw new Error('audit unavailable');
    audits.push(record); return record;
  } };
  return { base44: { asServiceRole: { entities } }, records, audits };
};

const input = (overrides = {}) => ({ externalUserId: 'site-user-1', erpCustomerId: 'customer-1', ...overrides });
const call = (state, operation, data = {}) => resolveSiteCpaOpportunityOperation({
  base44: state.base44, scope, payload: { data: input(data) }, request: { operation, correlationId: `corr-${operation}` },
});
const rejects = (promise, code, status) => assert.rejects(promise, (error) => (
  error instanceof SiteCpaOpportunityError && error.code === code && error.status === status
));

test('contrato limita paginação e rejeita campos de autoridade ou conteúdo executável', () => {
  assert.equal(normalizeOpportunityInput({ data: input({ pageSize: 100 }) }).pageSize, 100);
  assert.throws(() => normalizeOpportunityInput({ data: input({ pageSize: 101 }) }), /page_invalid/);
  assert.throws(() => normalizeOpportunityInput({ data: input({ score: 100 }) }), /authority_input_forbidden/);
  assert.throws(() => normalizeOpportunityInput({ data: input({ message: '<script>alert(1)</script>' }) }), /signal_invalid/);
});

test('lista e detalhe expõem somente contrato público e paginado', async () => {
  const state = createState();
  const list = await call(state, SITE_CPA_OPPORTUNITY_LIST_OPERATION, { pageSize: 1 });
  assert.equal(list.total, 1);
  assert.equal(list.items[0].opportunityId, 'opp-1');
  const detail = await call(state, SITE_CPA_OPPORTUNITY_GET_OPERATION, { opportunityId: 'opp-1' });
  const serialized = JSON.stringify(detail);
  for (const secret of ['valor_estimado', 'probabilidade', 'observacoes', 'custo']) assert.equal(serialized.includes(secret), false);
});

test('IDOR, Cliente e empresa cruzados falham fechados', async () => {
  await rejects(call(createState(), SITE_CPA_OPPORTUNITY_GET_OPERATION, { opportunityId: 'missing' }),
    'site_cpa_opportunity_not_found', 404);
  await rejects(call(createState({ opportunities: [opportunity({ empresa_id: '3z' })] }),
    SITE_CPA_OPPORTUNITY_GET_OPERATION, { opportunityId: 'opp-1' }), 'site_cpa_opportunity_not_found', 404);
  await rejects(call(createState({ opportunities: [opportunity({ cliente_id: 'customer-2' })] }),
    SITE_CPA_OPPORTUNITY_GET_OPERATION, { opportunityId: 'opp-1' }), 'site_cpa_opportunity_not_found', 404);
});

test('contexto 360 usa fatos reais, minimiza financeiro e gera somente sugestões', async () => {
  const result = await call(createState(), SITE_CPA_OPPORTUNITY_CONTEXT_OPERATION, { opportunityId: 'opp-1' });
  assert.equal(result.summary.openQuotes, 1);
  assert.equal(result.summary.financial.receivablesCount, 1);
  assert.equal(result.signals.some((item) => item.type === 'CHAT_WAITING_AGENT'), true);
  assert.equal(result.recommendations.every((item) => item.executionPolicy === 'SUGGESTION_ONLY'
    && item.requiresHumanConfirmation === true), true);
  assert.equal(result.copilot.state, 'degraded');
  assert.equal(JSON.stringify(result).includes('saldo'), false);
});

test('CONSULTA lê contexto sem resumo financeiro e não envia sinal', async () => {
  const state = createState({ role: 'CONSULTA' });
  const result = await call(state, SITE_CPA_OPPORTUNITY_CONTEXT_OPERATION);
  assert.equal(result.summary.financial, null);
  await rejects(call(state, SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION, {
    externalSignalId: 'signal-1', signalType: 'TALK_TO_SELLER',
  }), 'site_cpa_opportunity_forbidden', 403);
});

test('sinal allowlisted cria Oportunidade real uma vez e preserva vendedor não atribuído', async () => {
  const state = createState({ opportunities: [] });
  const data = { externalSignalId: 'signal-1', signalType: 'CLIENT_REQUESTED_CONTACT', message: 'Quero conversar.' };
  const first = await call(state, SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION, data);
  const second = await call(state, SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION, data);
  assert.equal(first.signalStatus, 'RECORDED');
  assert.equal(second.signalStatus, 'ALREADY_RECORDED');
  assert.equal(state.records.Oportunidade.length, 1);
  assert.equal(first.opportunity.seller.assignmentStatus, 'UNASSIGNED');
});

test('reuso de signal id com tipo divergente retorna conflito', async () => {
  const state = createState({ opportunities: [opportunity({ site_signal_id: 'signal-1', site_signal_type: 'TALK_TO_SELLER' })] });
  await rejects(call(state, SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION, {
    externalSignalId: 'signal-1', signalType: 'BETTER_PRICE_REQUESTED',
  }), 'site_cpa_opportunity_signal_conflict', 409);
});

test('referência adulterada no sinal é bloqueada', async () => {
  await rejects(call(createState(), SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION, {
    externalSignalId: 'signal-2', signalType: 'BETTER_PRICE_REQUESTED', erpQuoteId: 'quote-other',
  }), 'site_cpa_opportunity_context_forbidden', 403);
});

test('dependência opcional indisponível degrada sem fabricar contexto', async () => {
  const result = await call(createState({ failEntity: 'Entrega' }), SITE_CPA_OPPORTUNITY_CONTEXT_OPERATION);
  assert.equal(result.unavailableSources.includes('DELIVERY'), true);
  assert.equal(result.summary.deliveries, 0);
  assert.equal(result.copilot.state, 'degraded');
});

test('Oportunidade e auditoria são dependências fail-closed e capabilities são honestas', async () => {
  await rejects(call(createState({ failEntity: 'Oportunidade' }), SITE_CPA_OPPORTUNITY_LIST_OPERATION),
    'site_cpa_opportunity_unavailable', 503);
  await rejects(call(createState({ failEntity: 'AuditLog' }), SITE_CPA_OPPORTUNITY_LIST_OPERATION),
    'site_cpa_audit_unavailable', 503);
  assert.deepEqual(await opportunityCapabilities({ base44: createState().base44, scope }), {
    OPPORTUNITY_READ: 'ready', OPPORTUNITY_SIGNAL: 'ready', COMMERCIAL_COPILOT: 'degraded',
  });
  assert.deepEqual(await opportunityCapabilities({ base44: createState({ failEntity: 'Oportunidade' }).base44, scope }), {
    OPPORTUNITY_READ: 'blocked', OPPORTUNITY_SIGNAL: 'blocked', COMMERCIAL_COPILOT: 'blocked',
  });
});
