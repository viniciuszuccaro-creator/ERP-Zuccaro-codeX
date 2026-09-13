import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { applyCodigoOnCreate } from '../src/api/localCadastroMasterPolicy.js';
import {
  appendManualReconciliationEvidence,
  applyMigracaoOnCreate,
  approvePendingManualReconciliation,
  assertReconciliacaoMigracao,
  buildPendingManualReconciliation,
  buildManualReconciliationApprovalRequest,
  buildLoteMigracaoId,
  buildReconciliacaoMigracao,
  findManualReconciliationApprovalRequest,
  isManualReconciliationApprovalRequest,
  MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION,
  reviewPendingManualReconciliation,
  stampMigracaoRecord,
  stripSegredosMigracao,
} from '../src/components/lib/migracaoErpPolicy.js';
import { assertTituloOnCreate, assertTituloOnUpdate } from '../src/components/lib/financeiroTituloPolicy.js';
import {
  applyManualWorkflowTransition,
} from '../base44/functions/_lib/financeiro/manualReconciliationApprovalPolicy/entry.ts';

const loadSolicitacoesAprovacaoHandler = async () => {
  const original = await readFile(new URL('../base44/functions/solicitacoesAprovacao/entry.ts', import.meta.url), 'utf8');
  const instrumented = original
    .replace(/^import \{ createClientFromRequest \}[^\n]+\n/, 'const createClientFromRequest = () => globalThis.__approvalMockClient;\n')
    .replace(/import \{[\s\S]*?\} from '\.\.\/_lib\/financeiro\/manualReconciliationApprovalPolicy\/entry\.ts';\n/, 'const { MANUAL_RECONCILIATION_TYPE, applyManualWorkflowTransition, auditManualStaging, buildManualRecord, firstText, isManualReconciliationRequest, resolveManualScope } = globalThis.__manualApprovalPolicy;\n')
    .replace('Deno.serve(async (req) => {', 'globalThis.__captureApprovalHandler(async (req) => {');
  let handler = null;
  globalThis.__captureApprovalHandler = (candidate) => { handler = candidate; };
  globalThis.__manualApprovalPolicy = await import('../base44/functions/_lib/financeiro/manualReconciliationApprovalPolicy/entry.ts');
  await import(`data:text/javascript;base64,${Buffer.from(instrumented).toString('base64')}#${Date.now()}-${Math.random()}`);
  delete globalThis.__captureApprovalHandler;
  delete globalThis.__manualApprovalPolicy;
  assert.equal(typeof handler, 'function');
  return handler;
};

const makeApprovalClient = ({ existing = [], current = null, permissions = ['conciliar'], empresaGroup = 'g1', auditFails = false, updateFails = false, userId = 'u1' } = {}) => {
  const state = { created: [], deleted: [], audits: [], updates: [] };
  const user = { id: userId, full_name: 'Analista', perfil_acesso_id: 'p1', group_id: 'g1', empresa_atual_id: 'e1' };
  let stored = current || existing[0] || null;
  const solicitacoes = {
    filter: async () => existing,
    get: async () => stored,
    create: async (record) => { const created = { id: 'sa-created', ...record }; state.created.push(created); return created; },
    update: async (id, patch) => {
      if (updateFails) throw new Error('update down');
      stored = { ...stored, ...patch, id };
      state.updates.push({ id, patch });
      return stored;
    },
    delete: async (id) => { state.deleted.push(id); },
  };
  const client = {
    auth: { me: async () => user },
    asServiceRole: { entities: {
      PerfilAcesso: { get: async () => ({ permissoes: { Financeiro: { Migracao: permissions } } }) },
      Empresa: { get: async () => ({ id: 'e1', group_id: empresaGroup }) },
      SolicitacaoAprovacao: solicitacoes,
      AuditLog: { create: async (record) => { if (auditFails) throw new Error('audit down'); state.audits.push(record); return record; } },
    } },
    entities: { SolicitacaoAprovacao: solicitacoes },
  };
  return { client, state };
};

test('lote de migracao e estavel para o mesmo arquivo e contexto', () => {
  const a = buildLoteMigracaoId({
    arquivoNome: 'produtos-erp-antigo.csv',
    groupId: 'g1',
    empresaId: 'e1',
    entidade: 'Produto',
  });
  const b = buildLoteMigracaoId({
    arquivoNome: 'produtos-erp-antigo.csv',
    groupId: 'g1',
    empresaId: 'e1',
    entidade: 'Produto',
  });
  assert.equal(a, b);
  assert.match(a, /^MIG-produto-g1-e1-produtos-erp-antigo-csv$/);
});

test('migracao sem confirmacao nao grava em producao', () => {
  assert.throws(
    () => applyMigracaoOnCreate({
      entityName: 'Produto',
      record: {
        group_id: 'g1',
        empresa_id: 'e1',
        codigo: 'SKU-1',
        codigo_legado: 'SKU-1',
        origem_migracao: 'erp_antigo',
        lote_migracao: 'MIG-1',
      },
      records: [],
    }),
    /confirmacao/,
  );
});

test('migracao exige codigo legado', () => {
  assert.throws(
    () => applyMigracaoOnCreate({
      entityName: 'Produto',
      record: {
        group_id: 'g1',
        empresa_id: 'e1',
        origem_migracao: 'erp_antigo',
        lote_migracao: 'MIG-1',
        confirmado: true,
      },
      records: [],
    }),
    /Codigo legado/,
  );
});

test('retry da migracao reusa o mesmo registro pelo codigo legado', () => {
  const first = applyMigracaoOnCreate({
    entityName: 'Produto',
    record: {
      group_id: 'g1',
      empresa_id: 'e1',
      codigo: 'SKU-1',
      codigo_legado: 'SKU-1',
      origem_migracao: 'erp_antigo',
      lote_migracao: 'MIG-1',
      confirmado: true,
    },
    records: [],
  });
  assert.equal(first.reuse, null);
  assert.equal(first.record.codigo_legado, 'SKU-1');

  const retry = applyMigracaoOnCreate({
    entityName: 'Produto',
    record: first.record,
    records: [{ id: 'prod-1', group_id: 'g1', empresa_id: 'e1', codigo_legado: 'SKU-1', codigo: '0002' }],
  });
  assert.equal(retry.reuse.id, 'prod-1');
});

test('senha legada e removida na migracao de usuario', () => {
  const stamped = stampMigracaoRecord({
    group_id: 'g1',
    email: 'user@example.com',
    codigo_legado: 'user@example.com',
    senha: 'secret-legado',
    password: 'secret-legado',
  }, { entidade: 'User', confirmado: true });
  assert.equal(stamped.senha, undefined);
  assert.equal(stamped.password, undefined);
  const created = applyMigracaoOnCreate({
    entityName: 'User',
    record: stamped,
    records: [],
  });
  assert.equal(created.record.senha, undefined);
  assert.equal(stripSegredosMigracao({ senha_hash: 'x', nome: 'Ana' }).senha_hash, undefined);
});

test('codigo legado permanece mesmo sem conflito interno', () => {
  const record = applyCodigoOnCreate({
    entityName: 'Produto',
    record: {
      codigo: 'SKU-LEGADO',
      origem_migracao: 'erp_antigo',
      lote_migracao: 'MIG-1',
      group_id: 'g1',
    },
    records: [{ codigo: '0001', group_id: 'g1' }],
    sequenceValue: 1,
  });
  assert.equal(record.codigo, 'SKU-LEGADO');
  assert.equal(record.codigo_legado, 'SKU-LEGADO');
});

test('reconciliacao compara quantidade e bloqueia divergencia', () => {
  const report = buildReconciliacaoMigracao({
    origem: [{ preco_venda: 10 }, { preco_venda: 20 }],
    gravados: [{ preco_venda: 10, codigo: '0001', codigo_legado: 'A' }],
    reusos: [{ preco_venda: 20, codigo: '0002', codigo_legado: 'B' }],
  });
  assert.equal(report.quantidade_origem, 2);
  assert.equal(report.quantidade_gravada, 1);
  assert.equal(report.quantidade_reuso, 1);
  assert.equal(report.divergencia_quantidade, 0);
  assert.equal(report.total_financeiro_origem, 30);
  assert.equal(assertReconciliacaoMigracao(report), true);
  assert.throws(
    () => assertReconciliacaoMigracao({
      ...report,
      divergencia_quantidade: 1,
    }),
    /divergencia/,
  );
});

test('titulo financeiro sem evidencia fica isolado no staging para conciliacao manual', () => {
  const origem = {
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_legado: 'titulo-1',
    status: 'Pago',
    status_pagamento: 'Pago',
    data_pagamento: '2020-01-15',
    valor_pago: 125.5,
    valor: 125.5,
  };
  const snapshot = { ...origem };
  const staging = buildPendingManualReconciliation(origem, {
    arquivoNome: 'titulos.csv',
    registradoPor: 'financeiro-1',
    registradoEm: '2026-09-13T12:00:00.000Z',
  });

  assert.deepEqual(origem, snapshot);
  assert.equal(staging.status_migracao, MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION);
  assert.equal(staging.etapa_conciliacao, 'aguardando_evidencia');
  assert.equal(staging.destino_migracao, 'staging');
  assert.equal(staging.confirmado, false);
  assert.equal(staging.bloqueio_operacional, true);
  assert.equal(staging.requer_conciliacao_manual, true);
  assert.equal(staging.decisao_financeira, null);
  assert.equal(staging.status, undefined);
  assert.equal(staging.status_pagamento, undefined);
  assert.equal(staging.data_pagamento, undefined);
  assert.equal(staging.valor_pago, undefined);
  assert.deepEqual(staging.dados_origem_migracao, origem);
  assert.deepEqual(staging.aprovacoes_conciliacao, []);
  assert.equal(staging.historico_conciliacao[0].usuario_id, 'financeiro-1');
  assert.equal(staging.historico_conciliacao[0].group_id, 'g1');
  assert.equal(staging.historico_conciliacao[0].empresa_id, 'e1');
});

test('conciliacao manual exige contexto completo, codigo legado e auditoria', () => {
  const base = { group_id: 'g1', empresa_id: 'e1', codigo_legado: 'titulo-1' };
  const audit = { registradoPor: 'financeiro-1', registradoEm: '2026-09-13T12:00:00.000Z' };
  assert.throws(
    () => buildPendingManualReconciliation({ ...base, empresa_id: '' }, audit),
    /Grupo e Empresa/,
  );
  assert.throws(
    () => buildPendingManualReconciliation({ ...base, codigo_legado: '' }, audit),
    /Codigo legado/,
  );
  assert.throws(
    () => buildPendingManualReconciliation(base),
    /Usuario e data/,
  );
  assert.throws(
    () => buildPendingManualReconciliation(base, { ...audit, registradoEm: 'data-invalida' }),
    /Data de auditoria invalida/,
  );
});

test('pendencia manual nao pode ser promovida nem liquidada pelo fluxo operacional', () => {
  const staging = buildPendingManualReconciliation({
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_legado: 'titulo-1',
    status_pagamento: 'Pago',
  }, {
    registradoPor: 'financeiro-1',
    registradoEm: '2026-09-13T12:00:00.000Z',
  });

  assert.throws(
    () => applyMigracaoOnCreate({ entityName: 'ContaPagar', record: { ...staging, confirmado: true } }),
    /permanece no staging/,
  );
  assert.throws(
    () => assertTituloOnCreate({ record: { ...staging, status: 'Pendente' } }),
    /permanecer no staging/,
  );
  assert.throws(
    () => assertTituloOnUpdate({
      before: { id: 'cp-1', ...staging },
      patch: { status: 'Pago', status_pagamento: 'Pago' },
    }),
    /nao pode ser alterado/,
  );
});

test('evidencia de conciliacao exige permissao, metadados e e idempotente', () => {
  const staging = buildPendingManualReconciliation({
    group_id: 'g1', empresa_id: 'e1', codigo_legado: 'titulo-1', status_pagamento: 'Pago',
  }, { registradoPor: 'registrante-1', registradoEm: '2026-09-13T12:00:00.000Z' });
  const options = {
    evidencia: { id: 'ev-1', tipo: 'comprovante<script>', hash_sha256: 'hash-controlado', descricao: '<script>arquivo</script>' },
    usuarioId: 'analista-1',
    timestamp: '2026-09-13T13:00:00.000Z',
    temPermissao: true,
  };

  assert.throws(() => appendManualReconciliationEvidence(staging, { ...options, temPermissao: false }), /Permissao/);
  assert.throws(() => appendManualReconciliationEvidence(staging, { ...options, evidencia: { id: 'ev-1' } }), /Evidencia exige/);
  const withEvidence = appendManualReconciliationEvidence(staging, options);
  assert.equal(staging.evidencias_conciliacao.length, 0);
  assert.equal(withEvidence.evidencias_conciliacao.length, 1);
  assert.equal(withEvidence.evidencias_conciliacao[0].tipo, 'comprovante');
  assert.equal(withEvidence.evidencias_conciliacao[0].descricao, 'arquivo');
  assert.equal(withEvidence.etapa_conciliacao, 'evidencia_anexada');
  assert.equal(appendManualReconciliationEvidence(withEvidence, options), withEvidence);
  assert.throws(
    () => appendManualReconciliationEvidence(withEvidence, { ...options, evidencia: { ...options.evidencia, hash_sha256: 'outro-hash' } }),
    /ja utilizado/,
  );
});

test('revisao financeira exige evidencia, permissao e segregacao do registrante', () => {
  const staging = buildPendingManualReconciliation({
    group_id: 'g1', empresa_id: 'e1', codigo_legado: 'titulo-1',
  }, { registradoPor: 'registrante-1', registradoEm: '2026-09-13T12:00:00.000Z' });
  const review = {
    decisao: 'PAGO',
    justificativa: 'Comprovante conferido com o documento financeiro.',
    usuarioId: 'revisor-1',
    timestamp: '2026-09-13T14:00:00.000Z',
    temPermissao: true,
  };

  assert.throws(() => reviewPendingManualReconciliation(staging, review), /ao menos uma evidencia/);
  const withEvidence = appendManualReconciliationEvidence(staging, {
    evidencia: { id: 'ev-1', tipo: 'comprovante', referencia: 'arquivo-controlado' },
    usuarioId: 'analista-1', timestamp: '2026-09-13T13:00:00.000Z', temPermissao: true,
  });
  assert.throws(
    () => reviewPendingManualReconciliation(withEvidence, { ...review, usuarioId: 'registrante-1' }),
    /registrante nao pode revisar/,
  );
  assert.throws(() => reviewPendingManualReconciliation(withEvidence, { ...review, decisao: 'INDEFINIDO' }), /PAGO ou ABERTO/);
  const reviewed = reviewPendingManualReconciliation(withEvidence, review);
  assert.equal(reviewed.etapa_conciliacao, 'aguardando_aprovacao_final');
  assert.equal(reviewed.decisao_financeira.classificacao, 'PAGO');
  assert.equal(reviewed.decisao_financeira.status, 'EM_APROVACAO');
  assert.equal(reviewed.confirmado, false);
  assert.equal(reviewed.destino_migracao, 'staging');
});

test('aprovacao final exige segundo usuario, mesma decisao e confirmacao humana', () => {
  const staging = buildPendingManualReconciliation({
    group_id: 'g1', empresa_id: 'e1', codigo_legado: 'titulo-1',
  }, { registradoPor: 'registrante-1', registradoEm: '2026-09-13T12:00:00.000Z' });
  const withEvidence = appendManualReconciliationEvidence(staging, {
    evidencia: { id: 'ev-1', tipo: 'comprovante', referencia: 'arquivo-controlado' },
    usuarioId: 'analista-1', timestamp: '2026-09-13T13:00:00.000Z', temPermissao: true,
  });
  const reviewed = reviewPendingManualReconciliation(withEvidence, {
    decisao: 'ABERTO', justificativa: 'Documento nao comprova a liquidacao.',
    usuarioId: 'revisor-1', timestamp: '2026-09-13T14:00:00.000Z', temPermissao: true,
  });
  const approval = {
    decisao: 'ABERTO',
    justificativa: 'Segunda conferencia confirma a classificacao.',
    usuarioId: 'aprovador-1',
    timestamp: '2026-09-13T15:00:00.000Z',
    temPermissao: true,
    confirmacaoHumana: true,
  };

  assert.throws(() => approvePendingManualReconciliation(reviewed, { ...approval, confirmacaoHumana: false }), /Confirmacao humana/);
  assert.throws(() => approvePendingManualReconciliation(reviewed, { ...approval, usuarioId: 'revisor-1' }), /aprovador final distinto/);
  assert.throws(() => approvePendingManualReconciliation(reviewed, { ...approval, decisao: 'PAGO' }), /confirmar a decisao revisada/);
  const approved = approvePendingManualReconciliation(reviewed, approval);
  assert.equal(reviewed.aprovacoes_conciliacao.length, 1);
  assert.equal(approved.aprovacoes_conciliacao.length, 2);
  assert.equal(approved.etapa_conciliacao, 'aprovada_aguardando_promocao_manual');
  assert.equal(approved.decisao_financeira.status, 'APROVADA');
  assert.equal(approved.status_migracao, MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION);
  assert.equal(approved.destino_migracao, 'staging');
  assert.equal(approved.confirmado, false);
  assert.equal(approved.bloqueio_operacional, true);
  assert.throws(
    () => applyMigracaoOnCreate({ entityName: 'ContaPagar', record: { ...approved, confirmado: true } }),
    /permanece no staging/,
  );
});

test('SolicitacaoAprovacao recebe envelope idempotente sem virar titulo operacional', () => {
  const staging = buildPendingManualReconciliation({
    group_id: 'g1', empresa_id: 'e1', codigo_legado: 'titulo-1',
    status: 'Pago', status_pagamento: 'Pago', valor_pago: 100,
  }, { registradoPor: 'registrante-1', registradoEm: '2026-09-13T12:00:00.000Z' });
  const request = buildManualReconciliationApprovalRequest(staging, {
    solicitanteId: 'registrante-1',
    solicitanteNome: 'Analista <script>',
    timestamp: '2026-09-13T12:05:00.000Z',
  });

  assert.equal(isManualReconciliationApprovalRequest(request), true);
  assert.equal(request.group_id, 'g1');
  assert.equal(request.empresa_id, 'e1');
  assert.equal(request.scope_type, 'empresa');
  assert.equal(request.entidade_alvo, 'ContaPagar');
  assert.equal(request.entidade_alvo_id, null);
  assert.equal(request.status, 'pendente');
  assert.equal(request.bloqueio_operacional, true);
  assert.equal(request.solicitante_nome, 'Analista');
  assert.equal(request.status_pagamento, undefined);
  assert.equal(request.valor_pago, undefined);
  assert.equal(request.dados_propostos.envelope_staging.status_migracao, MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION);
  assert.equal(request.dados_propostos.envelope_staging.confirmado, false);
  assert.match(request.idempotency_key, /^migracao-conciliacao\|g1\|e1\|ContaPagar\|titulo-1$/);

  const duplicate = findManualReconciliationApprovalRequest(request, [{ id: 'sa-1', ...request }]);
  assert.equal(duplicate.id, 'sa-1');
  assert.equal(findManualReconciliationApprovalRequest(request, [{ ...request, group_id: 'outro-grupo' }]), null);
});

test('adaptador persistente recusa envelope fora do staging financeiro', () => {
  const staging = buildPendingManualReconciliation({
    group_id: 'g1', empresa_id: 'e1', codigo_legado: 'titulo-1',
  }, { registradoPor: 'registrante-1', registradoEm: '2026-09-13T12:00:00.000Z' });
  assert.throws(
    () => buildManualReconciliationApprovalRequest({ ...staging, destino_migracao: 'producao' }, {
      solicitanteId: 'registrante-1', timestamp: '2026-09-13T12:05:00.000Z',
    }),
    /nao esta em staging bloqueado/,
  );
  assert.throws(
    () => buildManualReconciliationApprovalRequest({ ...staging, entidade_migracao: 'Pedido' }, {
      solicitanteId: 'registrante-1', timestamp: '2026-09-13T12:05:00.000Z',
    }),
    /Entidade financeira invalida/,
  );
});

test('estrutura persistente existente fica fora das entidades financeiras operacionais', async () => {
  const approvals = await readFile(new URL('../base44/functions/solicitacoesAprovacao/entry.ts', import.meta.url), 'utf8');
  assert.match(approvals, /entities\.SolicitacaoAprovacao\.create/);
  assert.doesNotMatch(approvals, /tipo_solicitacao === 'conciliacao_migracao_financeira'[\s\S]*entities\.(ContaPagar|ContaReceber)\.(create|update)/);
});

test('backend isola conciliacao financeira do fluxo comercial generico', async () => {
  const approvals = await readFile(new URL('../base44/functions/solicitacoesAprovacao/entry.ts', import.meta.url), 'utf8');
  const policy = await readFile(new URL('../base44/functions/_lib/financeiro/manualReconciliationApprovalPolicy/entry.ts', import.meta.url), 'utf8');
  const specializedContract = approvals + policy;
  assert.match(approvals, /action === 'createManualReconciliation'/);
  assert.match(approvals, /action === 'listManualReconciliations'/);
  assert.match(approvals, /hasPermission\(base44, user, 'Financeiro', 'Migracao', 'conciliar'\)/);
  assert.match(approvals, /hasPermission\(base44, user, 'Financeiro', 'Migracao', 'aprovar'\)/);
  assert.match(specializedContract, /scopeType !== 'empresa' \|\| !groupId \|\| !empresaId/);
  assert.match(specializedContract, /Empresa\.get\(empresaId\)/);
  assert.match(approvals, /idempotency_key: prepared\.record\.idempotency_key/);
  assert.match(specializedContract, /sanitizeManualValue\(envelope\)/);
  assert.match(approvals, /Use a acao financeira especializada/);
  assert.match(approvals, /Conciliacao financeira nao pode ser decidida pelo fluxo comercial generico/);
  assert.match(approvals, /filter\(\(item\) => !isManualReconciliationRequest\(item\)\)/);
  const specialized = approvals.slice(
    approvals.indexOf("if (action === 'createManualReconciliation')"),
    approvals.indexOf("if (action === 'create')"),
  );
  assert.doesNotMatch(specialized, /entities\.(ContaPagar|ContaReceber)\.(create|update)/);
});

test('backend executa staging financeiro com contexto, RBAC, idempotencia e rollback', async () => {
  const handler = await loadSolicitacoesAprovacaoHandler();
  const staging = buildPendingManualReconciliation({
    group_id: 'g1', empresa_id: 'e1', codigo_legado: 'titulo-1', password: 'nao-persistir',
  }, { registradoPor: 'u1', registradoEm: '2026-09-13T12:00:00.000Z' });
  const approvalRequest = buildManualReconciliationApprovalRequest(staging, {
    solicitanteId: 'u1', timestamp: '2026-09-13T12:05:00.000Z',
  });
  const invoke = async (client, payload) => {
    globalThis.__approvalMockClient = client;
    const response = await handler({ json: async () => payload });
    return { status: response.status, body: await response.json() };
  };
  const payload = { action: 'createManualReconciliation', group_id: 'g1', empresa_id: 'e1', scope_type: 'empresa', approval_request: approvalRequest };

  const allowed = makeApprovalClient();
  const created = await invoke(allowed.client, payload);
  assert.equal(created.status, 200);
  assert.equal(created.body.reused, false);
  assert.equal(allowed.state.created.length, 1);
  assert.equal(allowed.state.audits.length, 1);
  assert.equal(allowed.state.created[0].dados_propostos.envelope_staging.password, undefined);
  assert.equal(allowed.state.created[0].entidade_alvo_id, null);

  const duplicateRecord = { id: 'sa-existing', ...allowed.state.created[0] };
  const duplicate = makeApprovalClient({ existing: [duplicateRecord] });
  const reused = await invoke(duplicate.client, payload);
  assert.equal(reused.status, 200);
  assert.equal(reused.body.reused, true);
  assert.equal(duplicate.state.created.length, 0);
  assert.equal(duplicate.state.audits[0].acao, 'Reutilizacao');

  const wrongGroup = makeApprovalClient({ empresaGroup: 'outro-grupo' });
  assert.equal((await invoke(wrongGroup.client, payload)).status, 403);
  assert.equal(wrongGroup.state.audits[0].sucesso, false);

  const denied = makeApprovalClient({ permissions: [] });
  assert.equal((await invoke(denied.client, payload)).status, 403);
  assert.equal(denied.state.created.length, 0);
  assert.equal(denied.state.audits[0].acao, 'Bloqueio');

  const tampered = makeApprovalClient();
  const badPayload = { ...payload, approval_request: { ...approvalRequest, empresa_id: 'outra-empresa' } };
  assert.equal((await invoke(tampered.client, badPayload)).status, 400);
  assert.equal(tampered.state.created.length, 0);
  const preapproved = makeApprovalClient();
  const preapprovedPayload = {
    ...payload,
    approval_request: {
      ...approvalRequest,
      dados_propostos: {
        ...approvalRequest.dados_propostos,
        envelope_staging: { ...approvalRequest.dados_propostos.envelope_staging, aprovacoes_conciliacao: [{ etapa: 'aprovacao_final' }] },
      },
    },
  };
  assert.equal((await invoke(preapproved.client, preapprovedPayload)).status, 400);
  assert.equal(preapproved.state.created.length, 0);

  const auditDown = makeApprovalClient({ auditFails: true });
  assert.equal((await invoke(auditDown.client, payload)).status, 503);
  assert.deepEqual(auditDown.state.deleted, ['sa-created']);
  delete globalThis.__approvalMockClient;
});

test('politica backend exige tres usuarios e mantem aprovacao no staging', () => {
  const staging = buildPendingManualReconciliation({
    group_id: 'g1', empresa_id: 'e1', codigo_legado: 'titulo-1',
  }, { registradoPor: 'u1', registradoEm: '2026-09-13T12:00:00.000Z' });
  const initial = {
    id: 'sa-1',
    ...buildManualReconciliationApprovalRequest(staging, {
      solicitanteId: 'u1', timestamp: '2026-09-13T12:05:00.000Z',
    }),
  };
  const evidenceInput = {
    evidencia: { id: 'ev-1', tipo: 'comprovante<script>', referencia: 'arquivo-controlado' },
  };
  const withEvidence = applyManualWorkflowTransition(
    initial,
    'attachManualReconciliationEvidence',
    evidenceInput,
    { id: 'u1' },
    '2026-09-13T13:00:00.000Z',
  ).record;
  assert.equal(withEvidence.dados_propostos.envelope_staging.evidencias_conciliacao[0].tipo, 'comprovante');
  assert.equal(
    applyManualWorkflowTransition(withEvidence, 'attachManualReconciliationEvidence', evidenceInput, { id: 'u1' }).reused,
    true,
  );
  assert.throws(
    () => applyManualWorkflowTransition(withEvidence, 'reviewManualReconciliation', {
      decisao: 'ABERTO', justificativa: 'Documento insuficiente.',
    }, { id: 'u1' }),
    /Registrante nao pode revisar/,
  );
  const reviewed = applyManualWorkflowTransition(withEvidence, 'reviewManualReconciliation', {
    decisao: 'ABERTO', justificativa: 'Documento insuficiente.',
  }, { id: 'u2' }, '2026-09-13T14:00:00.000Z').record;
  assert.throws(
    () => applyManualWorkflowTransition(reviewed, 'approveManualReconciliation', {
      decisao: 'ABERTO', justificativa: 'Confirmado.', confirmacao_humana: true,
    }, { id: 'u2' }),
    /distinto do registrante e revisor/,
  );
  const approved = applyManualWorkflowTransition(reviewed, 'approveManualReconciliation', {
    decisao: 'ABERTO', justificativa: 'Segunda conferencia confirma a decisao.', confirmacao_humana: true,
  }, { id: 'u3' }, '2026-09-13T15:00:00.000Z').record;
  const envelope = approved.dados_propostos.envelope_staging;
  assert.equal(approved.status, 'pendente');
  assert.equal(approved.bloqueio_operacional, true);
  assert.equal(envelope.etapa_conciliacao, 'aprovada_aguardando_promocao_manual');
  assert.equal(envelope.status_migracao, MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION);
  assert.equal(envelope.destino_migracao, 'staging');
  assert.equal(envelope.confirmado, false);
  assert.equal(envelope.bloqueio_operacional, true);
});

test('backend persiste workflow especializado com RBAC, contexto e rollback', async () => {
  const handler = await loadSolicitacoesAprovacaoHandler();
  const staging = buildPendingManualReconciliation({
    group_id: 'g1', empresa_id: 'e1', codigo_legado: 'titulo-2',
  }, { registradoPor: 'u1', registradoEm: '2026-09-13T12:00:00.000Z' });
  const initial = {
    id: 'sa-2',
    ...buildManualReconciliationApprovalRequest(staging, {
      solicitanteId: 'u1', timestamp: '2026-09-13T12:05:00.000Z',
    }),
  };
  const invoke = async (client, payload) => {
    globalThis.__approvalMockClient = client;
    const response = await handler({ json: async () => payload });
    return { status: response.status, body: await response.json() };
  };
  const basePayload = {
    group_id: 'g1', empresa_id: 'e1', scope_type: 'empresa', solicitacao_id: 'sa-2',
  };

  const denied = makeApprovalClient({ current: initial, permissions: [] });
  assert.equal((await invoke(denied.client, {
    ...basePayload, action: 'attachManualReconciliationEvidence',
    evidencia: { id: 'ev-2', tipo: 'comprovante', referencia: 'arquivo' },
  })).status, 403);
  assert.equal(denied.state.updates.length, 0);

  const wrongContext = makeApprovalClient({ current: { ...initial, empresa_id: 'e2' } });
  assert.equal((await invoke(wrongContext.client, {
    ...basePayload, action: 'attachManualReconciliationEvidence',
    evidencia: { id: 'ev-2', tipo: 'comprovante', referencia: 'arquivo' },
  })).status, 403);
  assert.equal(wrongContext.state.updates.length, 0);

  const allowed = makeApprovalClient({ current: initial });
  const attached = await invoke(allowed.client, {
    ...basePayload, action: 'attachManualReconciliationEvidence',
    evidencia: { id: 'ev-2', tipo: 'comprovante', referencia: 'arquivo' },
  });
  assert.equal(attached.status, 200);
  assert.equal(attached.body.record.status, 'pendente');
  assert.equal(attached.body.record.dados_propostos.envelope_staging.etapa_conciliacao, 'evidencia_anexada');
  assert.equal(allowed.state.audits[0].acao, 'Evidencia');

  const reviewer = makeApprovalClient({ current: attached.body.record, userId: 'u2' });
  const reviewed = await invoke(reviewer.client, {
    ...basePayload, action: 'reviewManualReconciliation',
    decisao: 'ABERTO', justificativa: 'Documento nao comprova liquidacao.',
  });
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.body.record.dados_propostos.envelope_staging.etapa_conciliacao, 'aguardando_aprovacao_final');
  assert.equal(reviewer.state.audits[0].acao, 'Revisao');

  const sameReviewer = makeApprovalClient({ current: reviewed.body.record, permissions: ['aprovar'], userId: 'u2' });
  assert.equal((await invoke(sameReviewer.client, {
    ...basePayload, action: 'approveManualReconciliation',
    decisao: 'ABERTO', justificativa: 'Confirmado.', confirmacao_humana: true,
  })).status, 409);
  assert.equal(sameReviewer.state.updates.length, 0);

  const approver = makeApprovalClient({ current: reviewed.body.record, permissions: ['aprovar'], userId: 'u3' });
  const approved = await invoke(approver.client, {
    ...basePayload, action: 'approveManualReconciliation',
    decisao: 'ABERTO', justificativa: 'Segunda conferencia confirma a decisao.', confirmacao_humana: true,
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.record.status, 'pendente');
  assert.equal(approved.body.record.bloqueio_operacional, true);
  assert.equal(approved.body.record.dados_propostos.envelope_staging.etapa_conciliacao, 'aprovada_aguardando_promocao_manual');
  assert.equal(approved.body.record.dados_propostos.envelope_staging.confirmado, false);
  assert.equal(approver.state.audits[0].acao, 'Aprovacao');

  const auditDown = makeApprovalClient({ current: initial, auditFails: true });
  assert.equal((await invoke(auditDown.client, {
    ...basePayload, action: 'attachManualReconciliationEvidence',
    evidencia: { id: 'ev-3', tipo: 'comprovante', referencia: 'arquivo-2' },
  })).status, 503);
  assert.equal(auditDown.state.updates.length, 2);
  assert.deepEqual(auditDown.state.updates[1].patch.dados_propostos, initial.dados_propostos);
  delete globalThis.__approvalMockClient;
});

test('central existente integra conciliacao financeira sem promover titulo', async () => {
  const central = await readFile(new URL('../src/components/comercial/CentralAprovacoesManager.jsx', import.meta.url), 'utf8');
  const tab = await readFile(new URL('../src/components/comercial/ConciliacaoFinanceiraAprovacoesTab.jsx', import.meta.url), 'utf8');
  const uiPolicy = await readFile(new URL('../src/components/comercial/conciliacaoFinanceiraUiPolicy.js', import.meta.url), 'utf8');
  const localClient = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');

  assert.match(central, /ConciliacaoFinanceiraAprovacoesTab/);
  assert.match(central, /Financeiro(?:"\s*,\s*"Migracao|\.Migracao\.conciliar)/);
  assert.match(tab, /resolveConciliacaoFinanceiraAccess/);
  assert.match(tab, /filterConciliacoesByScope\(response\?\.data/);
  assert.match(uiPolicy, /contexto === "empresa"/);
  assert.match(uiPolicy, /textId\(record\.group_id\) === expectedGroupId/);
  assert.match(uiPolicy, /textId\(record\.empresa_id\) === expectedEmpresaId/);
  assert.match(tab, /action: "listManualReconciliations"/);
  assert.match(tab, /attachManualReconciliationEvidence/);
  assert.match(tab, /reviewManualReconciliation/);
  assert.match(tab, /approveManualReconciliation/);
  assert.match(tab, /confirmacao_humana/);
  assert.match(tab, /Financeiro\.Migracao\.conciliar/);
  assert.match(tab, /Financeiro\.Migracao\.aprovar/);
  assert.doesNotMatch(tab, /entities\.(ContaPagar|ContaReceber)\.(create|update)/);

  assert.match(localClient, /invokeLocalManualReconciliation/);
  assert.match(localClient, /MANUAL_RECONCILIATION_LOCAL_ACTIONS/);
  assert.match(localClient, /appendLocalManualReconciliationAudit/);
  assert.match(localClient, /applyManualWorkflowTransition\(current, payload\.action, payload, user\)/);
  assert.match(localClient, /contexto !== 'empresa'/);
  assert.doesNotMatch(
    localClient.slice(localClient.indexOf('const invokeLocalManualReconciliation'), localClient.indexOf('const functions =')),
    /entities\.(ContaPagar|ContaReceber)\.(create|update)/,
  );
});

test('importadores existentes fazem staging e reconciliam', async () => {
  const lote = await readFile(new URL('../src/components/cadastros/ImportarProdutosLote.jsx', import.meta.url), 'utf8');
  const planilha = await readFile(new URL('../src/components/estoque/ImportadorProdutosPlanilha.jsx', import.meta.url), 'utf8');
  const nfe = await readFile(new URL('../src/components/cadastros/ImportarProdutosNFe.jsx', import.meta.url), 'utf8');
  const nfeAuto = await readFile(new URL('../src/components/cadastros/ImportacaoProdutoNFe.jsx', import.meta.url), 'utf8');
  const backup = await readFile(new URL('../src/components/sistema/ConfiguracaoBackup.jsx', import.meta.url), 'utf8');
  assert.match(lote, /assertReconciliacaoMigracao/);
  assert.match(lote, /confirmado: false/);
  assert.match(lote, /Boolean\(groupId\)/);
  assert.match(lote, /Codigo legado obrigatorio/);
  assert.match(planilha, /assertReconciliacaoMigracao/);
  assert.match(planilha, /confirmado: false/);
  assert.match(planilha, /contextoGrupoId/);
  assert.match(planilha, /Auditoria obrigatoria falhou/);
  assert.match(nfe, /stampMigracaoRecord/);
  assert.match(nfe, /assertReconciliacaoMigracao/);
  assert.match(nfe, /origem_migracao: 'nfe_xml'/);
  assert.match(nfe, /groupId && \(contexto === 'grupo' \|\| empresaId\)/);
  assert.doesNotMatch(nfe, /catch \(_\) \{\}/);
  assert.match(nfeAuto, /stampMigracaoRecord/);
  assert.match(nfeAuto, /assertReconciliacaoMigracao/);
  assert.match(nfeAuto, /origem_migracao: 'nfe_xml'/);
  assert.match(nfeAuto, /groupId && \(contexto === 'grupo' \|\| empresaId\)/);
  assert.doesNotMatch(nfeAuto, /catch \(_\) \{\}/);
  const fiscalXml = await readFile(new URL('../src/components/fiscal/ImportarXMLNFe.jsx', import.meta.url), 'utf8');
  assert.match(fiscalXml, /stampMigracaoRecord/);
  assert.match(fiscalXml, /assertReconciliacaoMigracao/);
  assert.match(fiscalXml, /origem_migracao: 'nfe_xml'/);
  assert.match(fiscalXml, /groupId && empresaSelecionadaId/);
  assert.match(fiscalXml, /createInContext\('AuditLog'/);
  assert.doesNotMatch(fiscalXml, /console\.warn\('Falha ao auditar importacao XML NF-e:/);
  const recebimento = await readFile(new URL('../src/components/compras/ImportacaoNFeRecebimento.jsx', import.meta.url), 'utf8');
  assert.match(recebimento, /groupId && empresaId/);
  assert.match(recebimento, /simulacao: true/);
  assert.match(recebimento, /Resultado simulado/);
  assert.match(recebimento, /throw error/);
  assert.doesNotMatch(recebimento, /console\.warn\('Falha ao auditar importacao de NF-e:/);
  const botoes = await readFile(new URL('../src/components/cadastros/BotoesImportacaoProduto.jsx', import.meta.url), 'utf8');
  assert.match(botoes, /groupId && \(contexto === 'grupo' \|\| empresaId\)/);
  assert.match(botoes, /Auditoria obrigatoria falhou/);
  assert.doesNotMatch(botoes, /catch \(_\) \{\}/);
  const ocTab = await readFile(new URL('../src/components/compras/OrdensCompraTab.jsx', import.meta.url), 'utf8');
  assert.match(ocTab, /groupId && \(contexto === 'grupo' \|\| empresaId\)/);
  assert.match(ocTab, /Auditoria obrigatoria falhou para ordem de compra/);
  assert.doesNotMatch(ocTab, /console\.warn\('Falha ao auditar ordem de compra:/);
  const ocForm = await readFile(new URL('../src/components/compras/RecebimentoOCForm.jsx', import.meta.url), 'utf8');
  assert.match(ocForm, /groupId && \(contexto === 'grupo' \|\| empresaId\)/);
  assert.match(ocForm, /Auditoria obrigatoria falhou para recebimento de OC/);
  for (const name of [
    'SolicitacaoCompraForm.jsx',
    'CotacaoForm.jsx',
    'CotacoesTab.jsx',
    'AvaliacaoFornecedorForm.jsx',
    'FornecedoresTabOptimized.jsx',
    'DetalhesFornecedor.jsx',
  ]) {
    const src = await readFile(new URL(`../src/components/compras/${name}`, import.meta.url), 'utf8');
    assert.match(src, /groupId && \(contexto === 'grupo' \|\| empresaId\)/, name);
    assert.match(src, /Auditoria obrigatoria falhou/, name);
    assert.doesNotMatch(src, /Boolean\(groupId \|\| empresaId\)/, name);
    assert.doesNotMatch(src, /console\.warn\('Falha ao auditar/, name);
  }
  assert.match(backup, /throw error/);
  assert.doesNotMatch(backup, /Falha ao registrar configuracao de backup\.', error\);\r?\n\s*\}/);
});
