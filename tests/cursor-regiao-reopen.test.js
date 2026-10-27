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

const sourcePath = new URL('../src/components/cadastros/RegiaoAtendimentoForm.jsx', import.meta.url);
const source = fs.readFileSync(sourcePath, 'utf8');
const ast = ts.createSourceFile('region.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);

/** Extrai EMPTY_REGIAO + mapRegiaoToForm (+ version helper) da implementação REAL — sem cópia local. */
function loadRegiaoMapperFromSource(sourceText) {
  const tree = ts.createSourceFile('region.jsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const pieces = [];
  for (const stmt of tree.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const names = stmt.declarationList.declarations.map((d) => d.name.getText(tree));
    if (names.some((n) => n === 'EMPTY_REGIAO' || n === 'mapRegiaoToForm' || n === 'regiaoRecordVersion')) {
      pieces.push(stmt.getText(tree));
    }
  }
  assert.ok(pieces.length >= 2, 'mapper REAL (EMPTY_REGIAO + mapRegiaoToForm) deve existir no source');
  const emitted = ts.transpileModule(pieces.join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
  }).outputText;
  // Strip ESM leftovers; evaluate as plain function body.
  const body = emitted
    .replace(/^export\s+/gm, '')
    .replace(/export\s*\{[^}]*\};?/g, '');
  return new Function(`${body}; return { EMPTY_REGIAO, mapRegiaoToForm, regiaoRecordVersion };`)();
}

const { EMPTY_REGIAO, mapRegiaoToForm } = loadRegiaoMapperFromSource(source);

let callback;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') callback = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.match(source, /updated_at \?\? .*updated_date/);
assert.match(source, /mapRegiaoToForm/);
assert.match(callback, /updated_at \?\? .*updated_date/);
assert.match(source, /\.\.\.\(record\.logistica \|\| \{\}\)/);
assert.match(source, /\.\.\.\(record\.comercial \|\| \{\}\)/);

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

test('mapRegiaoToForm REAL preserva logistica/comercial quando HTTP omite aninhados', () => {
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

test('mapRegiaoToForm REAL conserva prazo/custo/expressa do record.logistica', () => {
  const mapped = mapRegiaoToForm({
    id: 'http-r4',
    nome_regiao: 'Full',
    logistica: {
      prazo_entrega_padrao_dias: 5,
      custo_frete_base: 88.5,
      permite_entrega_expressa: true,
      prazo_entrega_expressa_dias: 1,
    },
    comercial: { meta_vendas_mensal: 2500, prioridade_atendimento: 'Alta' },
  });
  assert.equal(mapped.logistica.prazo_entrega_padrao_dias, 5);
  assert.equal(mapped.logistica.custo_frete_base, 88.5);
  assert.equal(mapped.logistica.permite_entrega_expressa, true);
  assert.equal(mapped.logistica.prazo_entrega_expressa_dias, 1);
  assert.equal(mapped.comercial.meta_vendas_mensal, 2500);
  assert.equal(mapped.comercial.prioridade_atendimento, 'Alta');
});

test('contraprova cobertura: remover merge de logistica no mapper REAL perde custo/prazo/expressa', () => {
  const mergeLogistica = 'logistica: { ...EMPTY_REGIAO.logistica, ...(record.logistica || {}) },';
  assert.equal(source.split(mergeLogistica).length, 2, 'hunk de merge logistica deve existir exatamente uma vez');
  const brokenSource = source.replace(
    mergeLogistica,
    'logistica: { ...EMPTY_REGIAO.logistica },',
  );
  const { mapRegiaoToForm: brokenMap } = loadRegiaoMapperFromSource(brokenSource);
  const incoming = {
    id: 'mut',
    nome_regiao: 'Mutated',
    logistica: {
      prazo_entrega_padrao_dias: 9,
      custo_frete_base: 123,
      permite_entrega_expressa: true,
      prazo_entrega_expressa_dias: 2,
    },
  };
  const real = mapRegiaoToForm(incoming);
  const broken = brokenMap(incoming);
  assert.equal(real.logistica.custo_frete_base, 123);
  assert.equal(real.logistica.prazo_entrega_padrao_dias, 9);
  assert.equal(real.logistica.permite_entrega_expressa, true);
  // Mutação no source REAL: merge ausente → defaults; cobertura passa a falhar se só copiar o mapper.
  assert.equal(broken.logistica.custo_frete_base, 0);
  assert.equal(broken.logistica.prazo_entrega_padrao_dias, 0);
  assert.equal(broken.logistica.permite_entrega_expressa, false);
  assert.throws(() => {
    assert.equal(broken.logistica.custo_frete_base, 123);
    assert.equal(broken.logistica.prazo_entrega_padrao_dias, 9);
    assert.equal(broken.logistica.permite_entrega_expressa, true);
  });
});

test('payload de submit ancora id no boundId (prevIdRef), nao nas props divergentes', () => {
  assert.match(source, /prevIdRef\.current \? \{ id: prevIdRef\.current \}/);
});


test('troca de registro dirty: recusa mantem rascunho A e boundId A', async () => {
  const a = {
    id: 'http-ra',
    nome_regiao: 'REGIAO A',
    codigo_regiao: 'A001',
    logistica: { custo_frete_base: 10 },
    comercial: { meta_vendas_mensal: 500 },
    updated_at: '2026-01-01T00:00:00Z',
  };
  const refused = harness({ regiaoId: undefined, dadosIniciaisProps: a });
  refused.run();
  refused.dirty({ nome_regiao: 'DRAFT A' });
  let confirms = 0;
  const prevIdRef = { current: 'http-ra' };
  const prevUpdatedRef = { current: '2026-01-01T00:00:00Z' };
  const baselineRef = { current: cadastroFormSnapshot(mapRegiaoToForm(a)) };
  const formDataRef = { current: refused.state().formData };
  let formData = refused.state().formData;
  const env = {
    open: true, windowMode: false, regiaoId: undefined,
    dadosIniciaisProps: {
      id: 'http-rb',
      nome_regiao: 'REGIAO B',
      codigo_regiao: 'B001',
      logistica: { custo_frete_base: 1 },
      comercial: { meta_vendas_mensal: 1 },
      updated_at: '2026-02-01T00:00:00Z',
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
  assert.equal(formData.nome_regiao, 'DRAFT A');
  assert.equal(formData.logistica.custo_frete_base, 10);
  assert.equal(prevIdRef.current, 'http-ra');
});

test('resposta tardia ID-only apos cleanup nao pinta formulario', async () => {
  const h = harness();
  const cleanup = h.run();
  cleanup();
  h.resolve({
    id: 'synthetic-a',
    nome_regiao: 'LATE',
    logistica: { custo_frete_base: 9 },
    updated_at: '2026-03-01T00:00:00Z',
  });
  await flush();
  assert.equal(h.state().formData, undefined);
  assert.equal(h.state().id, null);
});
