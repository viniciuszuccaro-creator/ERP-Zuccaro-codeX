import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SITE_CPA_ARMACAO_CONFIRM_OPERATION,
  SITE_CPA_ARMACAO_CREATE_OPERATION,
  SITE_CPA_ARMACAO_GET_OPERATION,
  SITE_CPA_ARMACAO_SEND_COMMERCIAL_OPERATION,
  SITE_CPA_ARMACAO_UPDATE_OPERATION,
  SiteCpaArmacaoError,
  armationCapabilities,
  resolveSiteCpaArmacaoOperation,
} from '../base44/functions/_lib/security/siteCpaArmacao/entry.ts';
import { normalizeArmationInput } from '../base44/functions/_lib/security/siteCpaArmacao/contract.ts';

const now = Date.parse('2026-09-13T21:00:00.000Z');
const scope = { groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa' };
const matches = (record, filter) => Object.entries(filter).every(([key, value]) => record[key] === value);
const customer = (overrides = {}) => ({
  id: 'customer-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'Ativo',
  razao_social: 'Cliente Um', vendedor_responsavel_id: 'seller-1', ...overrides,
});
const link = (role = 'ADMIN_EMPRESA', allowedWorkIds = []) => ({
  id: 'link-1', tipo_solicitacao: 'vinculo_site_cpa_cliente', entidade_alvo_id: 'customer-1',
  group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'aprovado',
  dados_propostos: { source: 'SITE_CPA', externalUserId: 'site-user-1', role, allowedWorkIds },
});

const createState = ({
  role = 'ADMIN_EMPRESA', allowedWorkIds = [], customers = [customer()], projects = [], products = [],
  orders = [], failEntity = null,
} = {}) => {
  const audits = [];
  const records = {
    Cliente: customers, SolicitacaoAprovacao: [link(role, allowedWorkIds)], Projeto: projects,
    Produto: products, Pedido: orders, CentroCusto: [],
    Colaborador: [{ id: 'seller-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', ativo: true, nome: 'Vendedor Oficial' }],
    Oportunidade: [], OrdemProducao: [], IntegracaoEvento: [], Empresa: [{ id: 'cpa-aco', group_id: 'grupo-cpa' }],
  };
  const entities = Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, {
    filter: async (filter = {}) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      return rows.filter((record) => matches(record, filter));
    },
    create: async (record) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      const created = { id: `${name}-${rows.length + 1}`, created_date: new Date(now).toISOString(), ...record };
      rows.push(created);
      return created;
    },
    update: async (id, patch) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      const found = rows.find((record) => record.id === id);
      if (!found) throw new Error(`${name} missing`);
      Object.assign(found, patch, { updated_date: new Date(now).toISOString() });
      return found;
    },
  }]));
  entities.AuditLog = { create: async (record) => {
    if (failEntity === 'AuditLog') throw new Error('audit unavailable');
    audits.push(record);
    return record;
  } };
  return { base44: { asServiceRole: { entities } }, records, audits };
};

const packageInput = (overrides = {}) => ({
  externalUserId: 'site-user-1', erpCustomerId: 'customer-1', externalArmacaoId: 'arm-site-1',
  title: 'Armação Torre A', source: 'MANUAL', pieces: [{
    pieceId: 'V1', pieceType: 'VIGA', quantity: 2, length: 6, unit: 'M', bend: 'BOTH',
    reinforcement: [{ reinforcementId: 'R1', diameterMm: 12.5, quantity: 4, length: 6, unit: 'M' }],
    stirrups: { diameterMm: 5, spacing: 20, unit: 'CM', count: 31 },
  }], ...overrides,
});
const call = (state, operation, data = {}) => resolveSiteCpaArmacaoOperation({
  base44: state.base44, scope, payload: { data: { ...packageInput(), ...data } },
  request: { operation, correlationId: `corr-${operation}`, idempotencyKey: `idem-${operation}` }, now,
});
const rejects = (promise, code, status) => assert.rejects(promise, (error) => (
  error instanceof SiteCpaArmacaoError && error.code === code && error.status === status
));

test('normaliza unidade, dobra, armadura e recalcula estribos server-side', () => {
  const input = normalizeArmationInput({ data: packageInput() }, SITE_CPA_ARMACAO_CREATE_OPERATION);
  const piece = input.package.pieces[0];
  assert.equal(piece.dimensions.lengthMm, 6000);
  assert.equal(piece.bend, 'BOTH');
  assert.equal(piece.reinforcement[0].lengthMm, 6000);
  assert.equal(piece.stirrups.spacingMm, 200);
  assert.equal(piece.stirrups.count, 31);
});

test('rejeita contagem de estribos divergente e expressao executavel', () => {
  assert.throws(() => normalizeArmationInput({ data: packageInput({
    pieces: [{ pieceId: 'V1', pieceType: 'VIGA', quantity: 1, length: 600, unit: 'CM',
      stirrups: { diameterMm: 5, spacing: 20, unit: 'CM', count: 2 } }],
  }) }, SITE_CPA_ARMACAO_CREATE_OPERATION), /stirrup_count_mismatch/);
  assert.throws(() => normalizeArmationInput({ data: packageInput({
    variables: [{ name: 'L', formula: 'process.exit()' }],
  }) }, SITE_CPA_ARMACAO_CREATE_OPERATION), /expression_forbidden/);
});

test('bloqueia mass assignment de aprovacao e referencia insegura de documento', () => {
  assert.throws(() => normalizeArmationInput({ data: packageInput({ productionReleased: true }) },
    SITE_CPA_ARMACAO_CREATE_OPERATION), /production_input_forbidden/);
  assert.throws(() => normalizeArmationInput({ data: packageInput({
    evidence: [{ evidenceId: 'E1', url: 'https://public.example/projeto.pdf' }],
  }) }, SITE_CPA_ARMACAO_CREATE_OPERATION), /document_input_forbidden/);
  assert.throws(() => normalizeArmationInput({ data: packageInput({
    document: { sourceFileId: 'file-1', fileName: 'malware.exe', mimeType: 'application/x-msdownload',
      size: 100, sha256: 'a'.repeat(64) },
  }) }, SITE_CPA_ARMACAO_CREATE_OPERATION), /document_invalid/);
});

test('cria Projeto tecnico existente sem criar OP ou aprovar tecnicamente', async () => {
  const state = createState();
  const result = await call(state, SITE_CPA_ARMACAO_CREATE_OPERATION);
  assert.equal(result.status, 'DRAFT');
  assert.equal(result.reviewStatus, 'READY_FOR_CUSTOMER_REVIEW');
  assert.equal(result.productionReleased, false);
  assert.equal(result.productionOrderId, null);
  assert.equal(state.records.Projeto[0].site_technical_approved, false);
  assert.equal(state.records.OrdemProducao.length, 0);
});

test('Project Reader com baixa confianca permanece em revisao humana', async () => {
  const state = createState();
  const result = await call(state, SITE_CPA_ARMACAO_CREATE_OPERATION, {
    source: 'PROJECT_READER', evidence: [{ evidenceId: 'E1', sourceFileId: 'file-1', confidence: 0.55 }],
  });
  assert.equal(result.reviewStatus, 'NEEDS_REVIEW');
  assert.equal(result.technicalApproval, 'PENDING_INTERNAL_REVIEW');
});

test('create e idempotente para mesmo payload e conflita quando conteudo muda', async () => {
  const state = createState();
  const first = await call(state, SITE_CPA_ARMACAO_CREATE_OPERATION);
  const replay = await call(state, SITE_CPA_ARMACAO_CREATE_OPERATION);
  assert.equal(replay.armacaoId, first.armacaoId);
  assert.equal(replay.replayed, true);
  assert.equal(state.records.Projeto.length, 1);
  await rejects(call(state, SITE_CPA_ARMACAO_CREATE_OPERATION, { title: 'Outro projeto' }),
    'site_cpa_armacao_idempotency_conflict', 409);
});

test('update preserva historico imutavel e exige expectedVersion', async () => {
  const state = createState();
  const created = await call(state, SITE_CPA_ARMACAO_CREATE_OPERATION);
  const updated = await call(state, SITE_CPA_ARMACAO_UPDATE_OPERATION, {
    armacaoId: created.armacaoId, expectedVersion: 1, title: 'Revisão B',
  });
  assert.equal(updated.version, 2);
  assert.deepEqual(updated.versions.map((item) => item.version), [1, 2]);
  assert.equal(state.records.Projeto[0].site_armacao_versions[0].snapshot.title, 'Armação Torre A');
  await rejects(call(state, SITE_CPA_ARMACAO_UPDATE_OPERATION, {
    armacaoId: created.armacaoId, expectedVersion: 1,
  }), 'site_cpa_armacao_version_conflict', 409);
});

test('update nao troca silenciosamente obra, Projeto, Pedido ou Centro de Custo', async () => {
  const state = createState({ customers: [customer({
    locais_entrega: [{ id: 'obra-1', obra: true, ativo: true }, { id: 'obra-2', obra: true, ativo: true }],
  })] });
  const created = await call(state, SITE_CPA_ARMACAO_CREATE_OPERATION, { obraId: 'obra-1' });
  await rejects(call(state, SITE_CPA_ARMACAO_UPDATE_OPERATION, {
    armacaoId: created.armacaoId, expectedVersion: 1, obraId: 'obra-2',
  }), 'site_cpa_armacao_context_immutable', 409);
});

test('confirmacao do Cliente nao equivale a aprovacao tecnica nem libera producao', async () => {
  const state = createState();
  const created = await call(state, SITE_CPA_ARMACAO_CREATE_OPERATION);
  const confirmed = await call(state, SITE_CPA_ARMACAO_CONFIRM_OPERATION, {
    armacaoId: created.armacaoId, expectedVersion: 1,
  });
  assert.equal(confirmed.status, 'CUSTOMER_CONFIRMED');
  assert.equal(confirmed.customerConfirmed, true);
  assert.equal(confirmed.technicalApproval, 'PENDING_INTERNAL_REVIEW');
  assert.equal(state.records.OrdemProducao.length, 0);
});

test('envio comercial exige confirmacao e reutiliza Orcamento sem OP', async () => {
  const state = createState();
  const created = await call(state, SITE_CPA_ARMACAO_CREATE_OPERATION);
  await rejects(call(state, SITE_CPA_ARMACAO_SEND_COMMERCIAL_OPERATION, {
    armacaoId: created.armacaoId, expectedVersion: 1,
  }), 'site_cpa_armacao_confirmation_required', 422);
  await call(state, SITE_CPA_ARMACAO_CONFIRM_OPERATION, { armacaoId: created.armacaoId, expectedVersion: 1 });
  const sent = await call(state, SITE_CPA_ARMACAO_SEND_COMMERCIAL_OPERATION, {
    armacaoId: created.armacaoId, expectedVersion: 1, externalQuoteId: 'quote-arm-1',
  });
  assert.equal(sent.status, 'WAITING_SELLER');
  assert.equal(state.records.Pedido.length, 1);
  assert.equal(state.records.Pedido[0].tipo, 'Orçamento');
  assert.equal(state.records.Pedido[0].site_quote_source, 'ARMACAO');
  assert.equal(state.records.OrdemProducao.length, 0);
  const replay = await call(state, SITE_CPA_ARMACAO_SEND_COMMERCIAL_OPERATION, {
    armacaoId: created.armacaoId, expectedVersion: 1, externalQuoteId: 'quote-arm-1',
  });
  assert.equal(replay.replayed, true);
  assert.equal(state.records.Pedido.length, 1);
});

test('RBAC permite leitura a CONSULTA e bloqueia escrita e FINANCEIRO', async () => {
  const consultation = createState({ role: 'CONSULTA' });
  await rejects(call(consultation, SITE_CPA_ARMACAO_CREATE_OPERATION), 'site_cpa_armacao_forbidden', 403);
  const record = {
    id: 'arm-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1',
    site_external_user_id: 'site-user-1', site_armacao_package: true, site_armacao_version: 1,
  };
  consultation.records.Projeto.push(record);
  const read = await call(consultation, SITE_CPA_ARMACAO_GET_OPERATION, { armacaoId: 'arm-1' });
  assert.equal(read.armacaoId, 'arm-1');
  await rejects(call(createState({ role: 'FINANCEIRO' }), SITE_CPA_ARMACAO_CREATE_OPERATION),
    'site_cpa_armacao_forbidden', 403);
});

test('ownership bloqueia Cliente, usuario, Grupo e Empresa adulterados', async () => {
  const base = { id: 'arm-1', site_armacao_package: true, site_armacao_version: 1,
    group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1', site_external_user_id: 'site-user-1' };
  await rejects(call(createState({ projects: [{ ...base, cliente_id: 'customer-2' }] }),
    SITE_CPA_ARMACAO_GET_OPERATION, { armacaoId: 'arm-1' }), 'site_cpa_armacao_scope_forbidden', 403);
  await rejects(call(createState({ projects: [{ ...base, site_external_user_id: 'other-user' }] }),
    SITE_CPA_ARMACAO_GET_OPERATION, { armacaoId: 'arm-1' }), 'site_cpa_armacao_scope_forbidden', 403);
  await rejects(call(createState({ projects: [{ ...base, group_id: 'other-group' }] }),
    SITE_CPA_ARMACAO_GET_OPERATION, { armacaoId: 'arm-1' }), 'site_cpa_armacao_not_found', 404);
  await rejects(call(createState({ projects: [{ ...base, empresa_id: '3z' }] }),
    SITE_CPA_ARMACAO_GET_OPERATION, { armacaoId: 'arm-1' }), 'site_cpa_armacao_not_found', 404);
});

test('obra e Produto de armadura exigem escopo e ownership', async () => {
  const invalidWork = createState({ allowedWorkIds: ['obra-2'], customers: [customer({
    locais_entrega: [{ id: 'obra-1', obra: true, ativo: true }],
  })] });
  await rejects(call(invalidWork, SITE_CPA_ARMACAO_CREATE_OPERATION, { obraId: 'obra-1' }),
    'site_cpa_armacao_work_invalid', 403);
  const invalidProduct = createState({ products: [{
    id: 'steel-1', group_id: 'grupo-cpa', empresa_id: '3z', ativo: true,
  }] });
  await rejects(call(invalidProduct, SITE_CPA_ARMACAO_CREATE_OPERATION, { pieces: [{
    pieceId: 'V1', pieceType: 'VIGA', quantity: 1, length: 1, unit: 'M',
    reinforcement: [{ diameterMm: 10, quantity: 2, erpProductId: 'steel-1' }],
  }] }), 'site_cpa_armacao_product_invalid', 422);
});

test('resposta e auditoria minimizam dados e nao expõem comandos internos', async () => {
  const state = createState();
  const result = await call(state, SITE_CPA_ARMACAO_CREATE_OPERATION);
  const serialized = JSON.stringify(result);
  for (const forbidden of ['margin', 'markup', 'internalNotes', 'sellerApproved']) {
    assert.equal(serialized.includes(forbidden), false);
  }
  assert.equal(result.cost, undefined);
  assert.equal(state.audits[0].descricao, 'siteArmacaoCreate allowed');
  assert.equal(JSON.stringify(state.audits[0]).includes('reinforcement'), false);
});

test('dependencia e auditoria indisponiveis falham fechadas', async () => {
  await rejects(call(createState({ failEntity: 'Projeto' }), SITE_CPA_ARMACAO_CREATE_OPERATION),
    'site_cpa_armacao_unavailable', 503);
  await rejects(call(createState({ failEntity: 'AuditLog' }), SITE_CPA_ARMACAO_CREATE_OPERATION),
    'site_cpa_audit_unavailable', 503);
});

test('capabilities degradam sem storage/scanner e bloqueiam liberacao de producao', async () => {
  assert.deepEqual(await armationCapabilities({ base44: createState().base44, scope }), {
    WORK: 'degraded', PRODUCTION_INTAKE: 'degraded', PRODUCTION_RELEASE: 'blocked',
  });
  assert.deepEqual(await armationCapabilities({ base44: createState({ failEntity: 'Projeto' }).base44, scope }), {
    WORK: 'blocked', PRODUCTION_INTAKE: 'blocked', PRODUCTION_RELEASE: 'blocked',
  });
});
