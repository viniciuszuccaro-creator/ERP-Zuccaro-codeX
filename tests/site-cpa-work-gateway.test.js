import assert from 'node:assert/strict';
import test from 'node:test';

import { SITE_CPA_WORK_LIST_OPERATION } from '../base44/functions/_lib/security/siteCpaWork/entry.ts';
import {
  buildSiteCpaSignatureInput, handleSiteCpaGatewayRequest, hmacSha256Hex,
} from '../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts';

const now = Date.parse('2026-09-14T10:30:00.000Z');
const matches = (record, filter) => Object.entries(filter).every(([key, value]) => record[key] === value);

const createBase44 = () => {
  const records = {
    Cliente: [{ id: 'customer-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'Ativo',
      locais_entrega: [{ id: 'obra-1', obra: true, nome: 'Obra Gateway', ativo: true }] }],
    SolicitacaoAprovacao: [{
      id: 'link-1', tipo_solicitacao: 'vinculo_site_cpa_cliente', entidade_alvo_id: 'customer-1',
      group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'aprovado',
      dados_propostos: { source: 'SITE_CPA', externalUserId: 'site-user-1', role: 'ADMIN_EMPRESA' },
    }],
    Projeto: [], CentroCusto: [], IntegracaoEvento: [],
    Empresa: [{ id: 'cpa-aco', group_id: 'grupo-cpa', ativo: true }],
  };
  const audits = [];
  const entities = Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, {
    filter: async (filter = {}) => rows.filter((record) => matches(record, filter)),
    create: async (record) => {
      const created = { id: `${name}-${rows.length + 1}`, created_date: new Date(now).toISOString(), ...record };
      rows.push(created);
      return created;
    },
    update: async (id, patch) => {
      const found = rows.find((record) => record.id === id);
      Object.assign(found, patch);
      return found;
    },
  }]));
  entities.AuditLog = { create: async (record) => { audits.push(record); return record; } };
  return { base44: { asServiceRole: { entities } }, records, audits };
};

test('siteObraList atravessa autenticação, ledger e gateway v1', async () => {
  const state = createBase44();
  const payload = { version: '1', operation: SITE_CPA_WORK_LIST_OPERATION,
    data: { externalUserId: 'site-user-1', erpCustomerId: 'customer-1' } };
  const rawBody = JSON.stringify(payload);
  const timestamp = new Date(now).toISOString();
  const nonce = 'nonce-work-123456789012';
  const signature = await hmacSha256Hex('hmac-secret', buildSiteCpaSignatureInput({ timestamp, nonce, rawBody }));
  const response = await handleSiteCpaGatewayRequest({
    req: { headers: new Headers({
      authorization: 'Bearer service-token', 'content-type': 'application/json', 'x-origin': 'SITE_CPA',
      'x-correlation-id': 'corr-work-list', 'x-site-cpa-timestamp': timestamp,
      'x-site-cpa-nonce': nonce, 'x-site-cpa-signature': signature, 'idempotency-key': 'idem-work-list',
    }) },
    base44: state.base44, payload, rawBody,
    env: (name) => ({
      SITE_CPA_SERVICE_TOKEN: 'service-token', SITE_CPA_HMAC_SECRET: 'hmac-secret',
      SITE_CPA_GROUP_ID: 'grupo-cpa', SITE_CPA_DEFAULT_EMPRESA_ID: 'cpa-aco',
      SITE_CPA_ALLOWED_EMPRESA_IDS: 'cpa-aco',
    })[name] || '',
    now,
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.items[0].obraId, 'obra-1');
  assert.equal(state.records.IntegracaoEvento[0].status, 'concluido');
  assert.equal(state.audits.some((audit) => audit.descricao === 'siteObraList allowed'), true);
});
