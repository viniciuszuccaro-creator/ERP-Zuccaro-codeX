import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SITE_CPA_COST_CENTER_GET_OPERATION, SITE_CPA_COST_CENTER_LIST_OPERATION,
  SITE_CPA_PROJECT_GET_OPERATION, SITE_CPA_PROJECT_LIST_OPERATION,
  SITE_CPA_WORK_GET_OPERATION, SITE_CPA_WORK_LIST_OPERATION,
  SiteCpaWorkError, resolveSiteCpaWorkOperation, resolveWorkContext, workCapabilities,
} from '../base44/functions/_lib/security/siteCpaWork/entry.ts';
import { normalizeWorkInput } from '../base44/functions/_lib/security/siteCpaWork/contract.ts';

const now = Date.parse('2026-09-14T10:00:00.000Z');
const scope = { groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa' };
const matches = (record, criteria) => Object.entries(criteria).every(([key, value]) => record[key] === value);
const customer = (overrides = {}) => ({
  id: 'customer-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'Ativo',
  razao_social: 'Construtora Cliente', locais_entrega: [
    { id: 'obra-1', codigo: 'OB-01', nome: 'Torre Norte', obra: true, ativo: true,
      bairro: 'Centro', cidade: 'São Paulo', uf: 'SP' },
    { id: 'obra-2', codigo: 'OB-02', nome: 'Galpão Sul', obra: true, ativo: true,
      status: 'Concluída', cidade: 'Santos', uf: 'SP' },
    { id: 'obra-inativa', nome: 'Oculta', obra: true, ativo: false },
  ],
  ...overrides,
});
const approvedLink = ({ role = 'ADMIN_EMPRESA', allowedWorkIds, allWorks } = {}) => {
  const policy = { source: 'SITE_CPA', externalUserId: 'site-user-1', role };
  if (allowedWorkIds !== undefined) policy.allowedWorkIds = allowedWorkIds;
  if (allWorks !== undefined) policy.allWorks = allWorks;
  return {
    id: 'link-1', tipo_solicitacao: 'vinculo_site_cpa_cliente', entidade_alvo_id: 'customer-1',
    group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'aprovado', dados_propostos: policy,
  };
};
const project = (overrides = {}) => ({
  id: 'project-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1',
  obra_id: 'obra-1', codigo: 'PR-01', nome: 'Estrutural', status: 'Ativo', etapa: 'Estrutura',
  notas_internas: 'não expor', custo: 999, ...overrides,
});
const center = (overrides = {}) => ({
  id: 'center-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1',
  obra_id: 'obra-1', projeto_id: 'project-1', codigo: 'CC-01', descricao: 'Estrutura Torre', status: 'Ativo',
  orcamento_mensal: 99999, observacoes: 'não expor', ...overrides,
});

const createState = ({
  role = 'ADMIN_EMPRESA', allowedWorkIds, allWorks, linkStatus = 'aprovado',
  customers = [customer()], projects = [project(), project({ id: 'project-2', obra_id: 'obra-2',
    codigo: 'PR-02', nome: 'Finalizado', status: 'Concluído' })],
  centers = [center(), center({ id: 'center-2', obra_id: 'obra-2', projeto_id: 'project-2',
    codigo: 'CC-02', descricao: 'Centro concluído', status: 'Inativo' })], failEntity = null,
} = {}) => {
  const audits = [];
  const link = approvedLink({ role, allowedWorkIds, allWorks });
  link.status = linkStatus;
  const records = {
    Cliente: customers, SolicitacaoAprovacao: [link], Projeto: projects, CentroCusto: centers,
    Empresa: [{ id: 'cpa-aco', group_id: 'grupo-cpa' }], IntegracaoEvento: [],
  };
  const entities = Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, {
    filter: async (criteria = {}) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      return rows.filter((record) => matches(record, criteria));
    },
    create: async (record) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
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
  entities.AuditLog = { create: async (record) => {
    if (failEntity === 'AuditLog') throw new Error('audit unavailable');
    audits.push(record);
    return record;
  } };
  return { base44: { asServiceRole: { entities } }, records, audits, link };
};

const input = (overrides = {}) => ({
  externalUserId: 'site-user-1', erpCustomerId: 'customer-1', ...overrides,
});
const call = (state, operation, data = {}) => resolveSiteCpaWorkOperation({
  base44: state.base44, scope, payload: { data: input(data) },
  request: { operation, correlationId: `corr-${operation}` }, now,
});
const rejects = (promise, code, status) => assert.rejects(promise, (error) => (
  error instanceof SiteCpaWorkError && error.code === code && error.status === status
));

test('entrada limita paginação e sort e rejeita autoridade enviada pelo Site', () => {
  assert.equal(normalizeWorkInput({ data: input({ pageSize: 100, sort: 'code' }) }).sort, 'CODE');
  assert.throws(() => normalizeWorkInput({ data: input({ pageSize: 101 }) }), /page_invalid/);
  assert.throws(() => normalizeWorkInput({ data: input({ sort: 'custo' }) }), /sort_invalid/);
  assert.throws(() => normalizeWorkInput({ data: input({ allowedWorkIds: ['obra-1'] }) }), /authority_input_forbidden/);
});

test('ADMIN_EMPRESA lista obras oficiais com status, contagens e endereço minimizado', async () => {
  const result = await call(createState(), SITE_CPA_WORK_LIST_OPERATION);
  assert.equal(result.total, 2);
  assert.equal(result.items[0].code, 'OB-02');
  const active = result.items.find((item) => item.obraId === 'obra-1');
  const completed = result.items.find((item) => item.obraId === 'obra-2');
  assert.equal(active.status, 'ACTIVE');
  assert.equal(active.projectCount, 1);
  assert.equal(active.costCenterCount, 1);
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.selectable, false);
  assert.deepEqual(Object.keys(active.addressSummary).sort(), ['bairro', 'cidade', 'estado']);
});

test('allowlist restringe listagem e detalhe imediatamente', async () => {
  const state = createState({ role: 'COMPRADOR', allowedWorkIds: ['obra-1'], allWorks: false });
  const list = await call(state, SITE_CPA_WORK_LIST_OPERATION);
  assert.deepEqual(list.items.map((item) => item.obraId), ['obra-1']);
  await rejects(call(state, SITE_CPA_WORK_GET_OPERATION, { obraId: 'obra-2' }), 'site_cpa_work_forbidden', 403);
});

test('papel não administrativo sem política explícita não recebe obras por omissão', async () => {
  const state = createState({ role: 'COMPRADOR' });
  const list = await call(state, SITE_CPA_WORK_LIST_OPERATION);
  assert.equal(list.total, 0);
  await rejects(call(state, SITE_CPA_WORK_GET_OPERATION, { obraId: 'obra-1' }),
    'site_cpa_work_forbidden', 403);
});

test('vínculo revogado ou Cliente de outro escopo falha fechado', async () => {
  await rejects(call(createState({ linkStatus: 'rejeitado' }), SITE_CPA_WORK_LIST_OPERATION),
    'site_cpa_work_customer_invalid', 403);
  await rejects(call(createState({ customers: [customer({ empresa_id: '3z' })] }), SITE_CPA_WORK_LIST_OPERATION),
    'site_cpa_work_customer_invalid', 403);
});

test('projetos suportam lista, detalhe, hierarquia, filtro e paginação', async () => {
  const child = project({ id: 'project-child', codigo: 'PR-01-A', nome: 'Térreo', parent_project_id: 'project-1' });
  const state = createState({ projects: [project(), child] });
  const list = await call(state, SITE_CPA_PROJECT_LIST_OPERATION, { obraId: 'obra-1', search: 'Térreo', pageSize: 1 });
  assert.equal(list.total, 1);
  assert.equal(list.items[0].parentProjectId, 'project-1');
  const detail = await call(state, SITE_CPA_PROJECT_GET_OPERATION, { obraId: 'obra-1', projectId: 'project-child' });
  assert.equal(detail.project.stage, 'Estrutura');
  assert.equal(JSON.stringify(detail).includes('notas_internas'), false);
});

test('hierarquia inválida e obra incompatível são bloqueadas', async () => {
  const broken = project({ id: 'project-broken', parent_project_id: 'missing' });
  await rejects(call(createState({ projects: [broken] }), SITE_CPA_PROJECT_GET_OPERATION,
    { projectId: 'project-broken' }), 'site_cpa_work_context_mismatch', 422);
  await rejects(call(createState(), SITE_CPA_PROJECT_GET_OPERATION,
    { obraId: 'obra-2', projectId: 'project-1' }), 'site_cpa_work_context_mismatch', 422);
});

test('projeto independente é permitido somente a vínculo com todas as obras', async () => {
  const independent = project({ id: 'project-free', obra_id: null });
  const admin = await call(createState({ projects: [independent] }), SITE_CPA_PROJECT_LIST_OPERATION);
  assert.equal(admin.total, 1);
  const buyer = await call(createState({ role: 'COMPRADOR', allowedWorkIds: ['obra-1'], allWorks: false,
    projects: [independent] }), SITE_CPA_PROJECT_LIST_OPERATION);
  assert.equal(buyer.total, 0);
});

test('Centro de Custo exige ownership e não expõe orçamento ou observações internas', async () => {
  const state = createState();
  const list = await call(state, SITE_CPA_COST_CENTER_LIST_OPERATION, { obraId: 'obra-1' });
  assert.equal(list.total, 1);
  const detail = await call(state, SITE_CPA_COST_CENTER_GET_OPERATION, {
    obraId: 'obra-1', projectId: 'project-1', costCenterId: 'center-1',
  });
  assert.equal(detail.costCenter.name, 'Estrutura Torre');
  const serialized = JSON.stringify(detail);
  assert.equal(serialized.includes('orcamento_mensal'), false);
  assert.equal(serialized.includes('observacoes'), false);
});

test('Centro genérico não contorna allowlist e vínculos incompatíveis falham', async () => {
  const generic = center({ id: 'center-generic', obra_id: null, projeto_id: null });
  const limited = createState({ role: 'FINANCEIRO', allowedWorkIds: ['obra-1'], allWorks: false, centers: [generic] });
  const list = await call(limited, SITE_CPA_COST_CENTER_LIST_OPERATION);
  assert.equal(list.total, 0);
  await rejects(call(createState(), SITE_CPA_COST_CENTER_GET_OPERATION, {
    obraId: 'obra-2', projectId: 'project-1', costCenterId: 'center-1',
  }), 'site_cpa_work_context_mismatch', 422);
});

test('cross-tenant de Projeto e Centro de Custo não é localizável', async () => {
  await rejects(call(createState({ projects: [project({ empresa_id: '3z' })] }), SITE_CPA_PROJECT_GET_OPERATION,
    { projectId: 'project-1' }), 'site_cpa_project_not_found', 404);
  await rejects(call(createState({ centers: [center({ cliente_id: 'customer-2' })] }), SITE_CPA_COST_CENTER_GET_OPERATION,
    { costCenterId: 'center-1' }), 'site_cpa_cost_center_not_found', 404);
});

test('helper central resolve obra, Projeto e Centro de Custo coerentes', async () => {
  const state = createState();
  const context = {
    customer: state.records.Cliente[0], link: state.link, role: 'ADMIN_EMPRESA',
    workAccess: { allWorks: true, allowedWorkIds: new Set() },
  };
  const resolved = await resolveWorkContext({
    base44: state.base44, scope, context, obraId: 'obra-1', projectId: 'project-1', costCenterId: 'center-1',
  });
  assert.deepEqual([resolved.work.addressId, resolved.project.id, resolved.costCenter.id],
    ['obra-1', 'project-1', 'center-1']);
});

test('os quatro papéis empresariais possuem somente leitura', async () => {
  for (const role of ['ADMIN_EMPRESA', 'COMPRADOR', 'FINANCEIRO', 'CONSULTA']) {
    const options = role === 'ADMIN_EMPRESA' ? { role } : { role, allWorks: true };
    const result = await call(createState(options), SITE_CPA_WORK_LIST_OPERATION);
    assert.equal(result.source, 'ERP');
  }
});

test('auditoria minimizada e dependências falham fechadas', async () => {
  const state = createState();
  await call(state, SITE_CPA_WORK_LIST_OPERATION);
  assert.equal(state.audits[0].descricao, 'siteObraList allowed');
  assert.equal(JSON.stringify(state.audits[0]).includes('orcamento_mensal'), false);
  await rejects(call(createState({ failEntity: 'Projeto' }), SITE_CPA_PROJECT_LIST_OPERATION),
    'site_cpa_work_unavailable', 503);
  await rejects(call(createState({ failEntity: 'AuditLog' }), SITE_CPA_WORK_LIST_OPERATION),
    'site_cpa_audit_unavailable', 503);
});

test('capabilities refletem disponibilidade real das entidades existentes', async () => {
  assert.deepEqual(await workCapabilities({ base44: createState().base44, scope }), {
    WORK: 'ready', WORK_PROJECTS: 'ready', WORK_COST_CENTER: 'ready',
  });
  assert.deepEqual(await workCapabilities({ base44: createState({ failEntity: 'CentroCusto' }).base44, scope }), {
    WORK: 'ready', WORK_PROJECTS: 'ready', WORK_COST_CENTER: 'blocked',
  });
});
