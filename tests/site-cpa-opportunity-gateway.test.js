import assert from 'node:assert/strict';
import test from 'node:test';
import { SITE_CPA_OPPORTUNITY_LIST_OPERATION } from '../base44/functions/_lib/security/siteCpaOpportunity/entry.ts';
import { buildSiteCpaSignatureInput, handleSiteCpaGatewayRequest, hmacSha256Hex }
  from '../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts';

const now = Date.parse('2026-09-13T15:00:00.000Z');
const matches = (record, filter) => Object.entries(filter).every(([key, value]) => record[key] === value);

test('siteOportunidadeList atravessa autenticação, ledger e gateway v1', async () => {
  const records = {
    Cliente: [{ id: 'customer-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'Ativo' }],
    SolicitacaoAprovacao: [{ id: 'link-1', tipo_solicitacao: 'vinculo_site_cpa_cliente',
      entidade_alvo_id: 'customer-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'aprovado',
      dados_propostos: { source: 'SITE_CPA', externalUserId: 'site-user-1', role: 'CONSULTA' } }],
    Oportunidade: [{ id: 'opp-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco',
      cliente_id: 'customer-1', titulo: 'Solicitação Site', origem: 'SITE_CPA', status: 'Aberto' }],
    Empresa: [{ id: 'cpa-aco', group_id: 'grupo-cpa' }], IntegracaoEvento: [],
  };
  const audits = [];
  const entities = Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, {
    filter: async (filter = {}) => rows.filter((record) => matches(record, filter)),
    create: async (record) => { const created = { id: `${name}-${rows.length + 1}`,
      created_date: new Date(now).toISOString(), ...record }; rows.push(created); return created; },
    update: async (id, patch) => { const found = rows.find((item) => item.id === id); Object.assign(found, patch); return found; },
  }]));
  entities.AuditLog = { create: async (record) => { audits.push(record); return record; } };
  const payload = { version: '1', operation: SITE_CPA_OPPORTUNITY_LIST_OPERATION,
    data: { externalUserId: 'site-user-1', erpCustomerId: 'customer-1' } };
  const rawBody = JSON.stringify(payload);
  const timestamp = new Date(now).toISOString();
  const nonce = 'nonce-opportunity-123456789';
  const signature = await hmacSha256Hex('secret', buildSiteCpaSignatureInput({ timestamp, nonce, rawBody }));
  const response = await handleSiteCpaGatewayRequest({
    req: { headers: new Headers({ authorization: 'Bearer token', 'content-type': 'application/json',
      'x-origin': 'SITE_CPA', 'x-correlation-id': 'corr-opportunity', 'x-site-cpa-timestamp': timestamp,
      'x-site-cpa-nonce': nonce, 'x-site-cpa-signature': signature, 'idempotency-key': 'idem-opportunity' }) },
    base44: { asServiceRole: { entities } }, payload, rawBody, now,
    env: (name) => ({ SITE_CPA_SERVICE_TOKEN: 'token', SITE_CPA_HMAC_SECRET: 'secret',
      SITE_CPA_GROUP_ID: 'grupo-cpa', SITE_CPA_DEFAULT_EMPRESA_ID: 'cpa-aco',
      SITE_CPA_ALLOWED_EMPRESA_IDS: 'cpa-aco' })[name] || '',
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.items[0].opportunityId, 'opp-1');
  assert.equal(records.IntegracaoEvento[0].status, 'concluido');
  assert.equal(audits.some((item) => item.descricao === 'siteOportunidadeList allowed'), true);
});
