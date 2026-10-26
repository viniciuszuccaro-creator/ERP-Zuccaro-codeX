import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {
  CADASTRO_DIRTY_REOPEN_CONFIRM,
  CADASTRO_DIRTY_SWITCH_CONFIRM,
  cadastroFormMatchesIncoming,
  cadastroFormSnapshot,
  decideCadastroReopen,
  isCadastroFormDirty,
} from '../src/components/cadastros/cadastroReopenPolicy.js';

const source = fs.readFileSync(new URL('../src/components/cadastros/RegiaoAtendimentoForm.jsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('region.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
let callback;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') callback = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.match(source, /updated_at \?\? .*updated_date/);
assert.match(source, /mapRegiaoToForm/);
assert.match(callback, /updated_at \?\? .*updated_date/);

const EMPTY_REGIAO = {
  nome_regiao: '', codigo_regiao: '', descricao: '', tipo_regiao: 'Personalizada',
  estados_abrangidos: [], cidades_abrangidas: [], cor_identificacao: '#3B82F6',
  vendedores_ids: [], transportadoras_preferenciais_ids: [],
  logistica: {
    prazo_entrega_padrao_dias: 0, custo_frete_base: 0, permite_entrega_expressa: false,
    prazo_entrega_expressa_dias: 0, acrescimo_frete_expresso_percentual: 0,
    distancia_centro_distribuicao_km: 0, dificuldade_acesso: 'Fácil',
  },
  comercial: {
    meta_vendas_mensal: 0, comissao_extra_percentual: 0,
    desconto_maximo_permitido_percentual: 0, exige_aprovacao_acima_valor: 0,
    prioridade_atendimento: 'Normal',
  },
  ativo: true, observacoes: '',
};
function mapRegiaoToForm(record) {
  if (!record) return { ...EMPTY_REGIAO, logistica: { ...EMPTY_REGIAO.logistica }, comercial: { ...EMPTY_REGIAO.comercial } };
  return {
    ...EMPTY_REGIAO,
    ...record,
    estados_abrangidos: Array.isArray(record.estados_abrangidos) ? record.estados_abrangidos : [],
    cidades_abrangidas: Array.isArray(record.cidades_abrangidas) ? record.cidades_abrangidas : [],
    vendedores_ids: Array.isArray(record.vendedores_ids) ? record.vendedores_ids : [],
    transportadoras_preferenciais_ids: Array.isArray(record.transportadoras_preferenciais_ids)
      ? record.transportadoras_preferenciais_ids : [],
    logistica: { ...EMPTY_REGIAO.logistica, ...(record.logistica || {}) },
    comercial: { ...EMPTY_REGIAO.comercial, ...(record.comercial || {}) },
  };
}

const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
function harness(props = {}) {
  const values = { open: true, windowMode: false, dadosIniciaisProps: undefined, regiaoId: 'synthetic-a', ...props };
  let current = true, loading, failed, queries = 0, errors = 0, pending;
  const versionOf = (r) => r?.updated_at ?? r?.updated_date;
  // Mirror useState(mapRegiaoToForm(props)) — first effect may be a no-op when identity matches.
  let formData = values.dadosIniciaisProps ? mapRegiaoToForm(values.dadosIniciaisProps) : undefined;
  const prevIdRef = { current: values.dadosIniciaisProps?.id || null };
  const prevUpdatedRef = { current: versionOf(values.dadosIniciaisProps) };
  const baselineRef = {
    current: cadastroFormSnapshot(
      values.dadosIniciaisProps ? mapRegiaoToForm(values.dadosIniciaisProps) : EMPTY_REGIAO,
    ),
  };
  const formDataRef = { current: formData || null };
  const bindings = {
    prevIdRef, prevUpdatedRef, baselineRef, formDataRef, mapRegiaoToForm,
    isFormScopeCurrent: () => current,
    setFormData: data => { formData = data; formDataRef.current = data; },
    setLoading: value => { loading = value; },
    setLoadFailed: value => { failed = value; },
    toast: { error: () => { errors++; } },
    window: { confirm: () => true },
    decideCadastroReopen, isCadastroFormDirty, cadastroFormMatchesIncoming, cadastroFormSnapshot,
    CADASTRO_DIRTY_REOPEN_CONFIRM, CADASTRO_DIRTY_SWITCH_CONFIRM,
    getInContext: (entity, id) => {
      assert.equal(entity, 'RegiaoAtendimento'); assert.equal(id, values.regiaoId); queries++;
      return new Promise((resolve, reject) => { pending = { resolve, reject }; });
    },
  };
  return {
    run(next) {
      Object.assign(values, next);
      formDataRef.current = formData;
      const env = { ...bindings, ...values };
      return new Function(...Object.keys(env), `return (${callback})();`)(...Object.values(env));
    },
    resolve: data => pending.resolve(data), reject: () => pending.reject(Error('synthetic query failure')),
    changeScope: () => { current = false; },
    dirty(patch) {
      formData = { ...formData, ...patch };
      formDataRef.current = formData;
    },
    state: () => ({ formData, loading, failed, queries, errors, id: prevIdRef.current, updated: prevUpdatedRef.current }),
  };
}
test('actual region effect loads first ID-only mount and keeps dirty data on same ID', async () => {
  const h = harness(); h.run();
  assert.equal(h.state().queries, 1); assert.equal(h.state().loading, true);
  h.resolve({ id: 'synthetic-a', nome_regiao: 'Synthetic' }); await flush();
  assert.equal(h.state().id, 'synthetic-a'); assert.equal(h.state().loading, false);
  h.run(); assert.equal(h.state().queries, 1);
});
test('actual region effect supports window mode, record change and reset without writing data', async () => {
  const h = harness({ open: false, windowMode: true }); h.run();
  h.resolve({ id: 'synthetic-a', nome_regiao: 'A' }); await flush();
  h.run({ regiaoId: undefined, dadosIniciaisProps: { id: 'synthetic-b', nome_regiao: 'B' } });
  assert.equal(h.state().formData.nome_regiao, 'B');
  h.run({ dadosIniciaisProps: { id: 'synthetic-b', nome_regiao: 'Must not overwrite dirty' } });
  assert.equal(h.state().formData.nome_regiao, 'B');
  h.run({ dadosIniciaisProps: undefined }); assert.equal(h.state().formData.nome_regiao, '');
});
test('actual region effect drops responses after close, switch of record or tenant', async () => {
  for (const action of ['cleanup', 'tenant']) {
    const h = harness(), cleanup = h.run();
    if (action === 'cleanup') cleanup(); else h.changeScope();
    h.resolve({ id: 'synthetic-a', nome_regiao: 'Do not paint' }); await flush();
    assert.equal(h.state().formData, undefined); assert.equal(h.state().id, null);
  }
});
test('actual region effect fails closed on query failure, missing or wrong identity and retries on reopen', async () => {
  for (const result of [null, { id: 'synthetic-wrong', nome_regiao: 'Wrong' }, { id: 'synthetic-a' }, 'error']) {
    const h = harness(), cleanup = h.run();
    if (result === 'error') h.reject(); else h.resolve(result);
    await flush();
    assert.equal(h.state().failed, true); assert.equal(h.state().id, null);
    assert.equal(h.state().formData, undefined); assert.equal(h.state().errors, 1);
    cleanup(); h.run({ open: true }); assert.equal(h.state().queries, 2);
    h.resolve(null); await flush();
  }
  assert.match(source, /loadReady = !loading && !loadFailed && prevIdRef.current === requestedId/);
  assert.match(source, /if \(!podeSalvar \|\| !isFormScopeCurrent\(\)\)/);
  assert.match(source, /decideCadastroReopen/);
  assert.doesNotMatch(source, /RegiaoAtendimento\.list\(/);
});

test('HTTP updated_at reabre mesmo ID sem depender do alias legado updated_date', async () => {
  const initial = {
    id: 'http-r1',
    nome_regiao: 'SYNTHETIC BEFORE',
    codigo_regiao: '000901',
    logistica: { custo_frete_base: 12.5, permite_entrega_expressa: true },
    comercial: { meta_vendas_mensal: 1000 },
    cidades_abrangidas: [{ cidade: 'Campinas', estado: 'SP' }],
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = harness({
    regiaoId: undefined,
    dadosIniciaisProps: initial,
  });
  h.run();
  assert.equal(h.state().formData.nome_regiao, 'SYNTHETIC BEFORE');
  assert.equal(h.state().formData.logistica.custo_frete_base, 12.5);
  assert.equal(h.state().updated, '2026-01-01T00:00:00Z');

  h.run({
    dadosIniciaisProps: {
      ...initial,
      nome_regiao: 'SYNTHETIC AFTER',
      logistica: { custo_frete_base: 99, permite_entrega_expressa: false },
      updated_at: '2026-01-02T00:00:00Z',
    },
  });
  assert.equal(h.state().formData.nome_regiao, 'SYNTHETIC AFTER');
  assert.equal(h.state().formData.logistica.custo_frete_base, 99);
  assert.equal(h.state().formData.comercial.meta_vendas_mensal, 1000);
  assert.equal(h.state().formData.cidades_abrangidas[0].cidade, 'Campinas');
  assert.equal(h.state().updated, '2026-01-02T00:00:00Z');
  assert.equal(h.state().id, 'http-r1');
});

test('HTTP updated_at dirty exige confirmacao e nao apaga aninhados do rascunho', async () => {
  const initial = {
    id: 'http-r2',
    nome_regiao: 'SYNTHETIC ORIGINAL',
    codigo_regiao: '000902',
    logistica: { custo_frete_base: 7, prazo_entrega_padrao_dias: 3 },
    comercial: { comissao_extra_percentual: 2 },
    updated_at: '2026-01-01T00:00:00Z',
  };
  const refused = harness({ regiaoId: undefined, dadosIniciaisProps: initial });
  refused.run();
  refused.dirty({
    nome_regiao: 'DRAFT LOCAL',
    logistica: { ...refused.state().formData.logistica, custo_frete_base: 42 },
  });
  let confirms = 0;
  const prevIdRef = { current: 'http-r2' };
  const prevUpdatedRef = { current: '2026-01-01T00:00:00Z' };
  const baselineRef = { current: cadastroFormSnapshot(mapRegiaoToForm(initial)) };
  const formDataRef = { current: refused.state().formData };
  let formData = refused.state().formData;
  const env = {
    open: true, windowMode: false, regiaoId: undefined,
    dadosIniciaisProps: {
      ...initial,
      nome_regiao: 'SERVER VERSION 2',
      logistica: { custo_frete_base: 1 },
      updated_at: '2026-01-02T00:00:00Z',
    },
    prevIdRef, prevUpdatedRef, baselineRef, formDataRef, mapRegiaoToForm,
    isFormScopeCurrent: () => true,
    setFormData: (data) => { formData = data; formDataRef.current = data; },
    setLoading: () => {}, setLoadFailed: () => {},
    toast: { error: () => {} },
    window: { confirm: () => { confirms++; return false; } },
    decideCadastroReopen, isCadastroFormDirty, cadastroFormMatchesIncoming, cadastroFormSnapshot,
    CADASTRO_DIRTY_REOPEN_CONFIRM, CADASTRO_DIRTY_SWITCH_CONFIRM,
    getInContext: async () => null,
  };
  new Function(...Object.keys(env), `return (${callback})();`)(...Object.values(env));
  assert.equal(confirms, 1);
  assert.equal(formData.nome_regiao, 'DRAFT LOCAL');
  assert.equal(formData.logistica.custo_frete_base, 42);
  assert.equal(formData.comercial.comissao_extra_percentual, 2);
  assert.equal(prevIdRef.current, 'http-r2');
  assert.equal(prevUpdatedRef.current, '2026-01-02T00:00:00Z');
});

test('mapRegiaoToForm preserva logistica/comercial quando HTTP omite aninhados', () => {
  const mapped = mapRegiaoToForm({
    id: 'http-r3',
    nome_regiao: 'Partial',
    codigo_regiao: '000903',
    updated_at: '2026-02-01T00:00:00Z',
  });
  assert.equal(mapped.nome_regiao, 'Partial');
  assert.equal(mapped.codigo_regiao, '000903');
  assert.equal(mapped.logistica.prazo_entrega_padrao_dias, 0);
  assert.equal(mapped.comercial.prioridade_atendimento, 'Normal');
  assert.deepEqual(mapped.cidades_abrangidas, []);
  assert.deepEqual(mapped.vendedores_ids, []);
});

test('payload de submit ancora id no boundId (prevIdRef), nao nas props divergentes', () => {
  assert.match(source, /prevIdRef\.current \? \{ id: prevIdRef\.current \}/);
});
