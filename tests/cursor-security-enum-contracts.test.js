import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { assertCadastroRecordInTenant } from '../src/components/cadastros/cadastroEditLoadPolicy.js';

function tree(name) {
  const path = `src/components/cadastros/${name}Form.jsx`;
  return ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
}
function variables(ast) {
  const result = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node)) result.set(node.name.getText(ast), node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(ast); return result;
}
function run(ast, name, bindings) {
  return new Function(...Object.keys(bindings), `return (${variables(ast).get(name).getText(ast)});`)(...Object.values(bindings));
}
function context(extra = {}) {
  const calls = [], errors = [];
  return { calls, errors, bindings: {
    onSubmit: value => calls.push(value), toast: { error: value => errors.push(value) },
    identity: 'record-a', current: { current: { identity: 'record-a', podeSalvar: true, podeCriar: true, podeEditar: true } },
    scope: { isCurrent: () => true, assertCurrent() {} },
    groupId: 'synthetic-group', empresaId: 'synthetic-company', empresaAtual: { id: 'synthetic-company' },
    assertCadastroRecordInTenant, ...extra,
    podeConsultar: true, fornecedoresReady: true, centrosCustoReady: true, formasPagamentoReady: true,
    empresasReady: true, tiposDespesaReady: true, planoContasReady: true, centrosResultadoReady: true,
  } };
}
const event = { preventDefault() {} };
test('PerfilAcesso owner permission rejects Cadastros-only grants and loading', () => {
  const ast = tree('PerfilAcesso');
  for (const [variable, checker] of [['podeCriar', 'canCreate'], ['podeEditar', 'canEdit'], ['podeExcluir', 'canDelete']]) {
    const grant = (module, section) => module === 'Sistema' && section === 'Controle de Acesso';
    assert.equal(run(ast, variable, { isLoading: false, [checker]: grant }), true);
    assert.equal(run(ast, variable, { isLoading: true, [checker]: grant }), false);
    assert.equal(run(ast, variable, { isLoading: false, [checker]: module => module === 'Cadastros' }), false);
  }
});
test('PerfilAcesso submit preserves SoD denial and rechecks revocation after await', async () => {
  const ast = tree('PerfilAcesso');
  for (const kind of ['allowed', 'sod', 'revoked', 'reopened', 'scope', 'tenant']) {
    const ctx = context({ perfil: { id: 'profile', group_id: kind === 'tenant' ? 'other-group' : 'synthetic-group' },
      formData: { nome: 'Synthetic profile', permissoes: {} }, podeEditar: true, podeCriar: true,
      alert() { throw Error('Unexpected alert'); } });
    ctx.bindings.validarSegregacaoFuncao = async () => {
      if (kind === 'revoked') ctx.bindings.current.current.podeEditar = false;
      if (kind === 'reopened') ctx.bindings.current.current.identity = 'record-b';
      if (kind === 'scope') ctx.bindings.scope.isCurrent = () => false;
      return kind === 'sod';
    };
    await run(ast, 'handleSubmit', ctx.bindings)(event);
    assert.equal(ctx.calls.length, kind === 'allowed' ? 1 : 0, kind);
    if (kind === 'allowed') assert.equal(ctx.calls[0].nome_perfil, 'Synthetic profile');
    else assert.equal(ctx.errors.length, 1, kind);
  }
});
test('SoD critical pair still blocks; warning pair does not; absent permissions do not throw', async () => {
  const ast = tree('PerfilAcesso');
  for (const [permissoes, expected] of [[undefined, false], [{ cadastros: { criar_fornecedor: true }, financeiro: { aprovar_pagamentos: true } }, true],
    [{ cadastros: { criar_cliente: true }, comercial: { aprovar_desconto_acima_10: true } }, false]]) {
    let blocked;
    const validate = run(ast, 'validarSegregacaoFuncao', { formData: { permissoes }, setConflitosIA() {}, setBloqueioSoD: v => { blocked = v; } });
    assert.equal(await validate(), expected); assert.equal(blocked, expected);
  }
});
for (const [name, recordKey, formData] of [
  ['ModeloDocumento', 'dadosIniciais', { nome_modelo: 'Synthetic model', formato_saida: 'PDF' }],
  ['ConfiguracaoDespesaRecorrente', 'config', { tipo_despesa_id: 'synthetic-type', descricao: 'Synthetic expense', valor_base: 50, periodicidade: 'Mensal', empresa_id: 'synthetic-company', origem: 'empresa' }],
]) {
  test(`${name}: actual submit denies unavailable/reopened/cross-tenant contexts and keeps payload owner`, () => {
    const ast = tree(name);
    for (const kind of ['allowed', 'permission', 'reopened', 'scope', 'tenant']) {
      const ctx = context({ formData, [recordKey]: { id: 'synthetic-record', group_id: kind === 'tenant' ? 'other-group' : 'synthetic-group' } });
      if (kind === 'permission') ctx.bindings.current.current.podeSalvar = false;
      if (kind === 'reopened') ctx.bindings.current.current.identity = 'record-b';
      if (kind === 'scope') ctx.bindings.scope.isCurrent = () => false;
      run(ast, 'handleSubmit', ctx.bindings)(event);
      assert.equal(ctx.calls.length, kind === 'allowed' ? 1 : 0, kind);
      if (kind === 'allowed') for (const [key, value] of Object.entries(formData)) assert.deepEqual(ctx.calls[0][key], value);
    }
  });
}
test('Recurring expense lookups are scoped and discard late revoked/context responses', async () => {
  const ast = tree('ConfiguracaoDespesaRecorrente');
  for (const kind of ['allowed', 'query-failure', 'revoked', 'reopened', 'scope']) {
    const ctx = context(); ctx.bindings.current.current.podeConsultar = true;
    ctx.bindings.filterInContext = async (entity, filters) => {
      assert.equal(entity, 'TipoDespesa'); assert.deepEqual(filters, { ativo: true });
      if (kind === 'query-failure') throw Error('Synthetic failure');
      if (kind === 'revoked') ctx.bindings.current.current.podeConsultar = false;
      if (kind === 'reopened') ctx.bindings.current.current.identity = 'record-b';
      if (kind === 'scope') ctx.bindings.scope.assertCurrent = () => { throw Error('Synthetic context change'); };
      return [{ id: 'synthetic-type' }];
    };
    const pending = run(ast, 'scopedLookup', ctx.bindings)('TipoDespesa', { ativo: true });
    if (kind === 'allowed') assert.deepEqual(await pending, [{ id: 'synthetic-type' }]);
    else await assert.rejects(pending);
  }
  const text = ast.getFullText();
  assert.equal((text.match(/enabled: podeConsultar && scope.isCurrent\(\)/g) || []).length, 7);
  assert.equal((text.match(/queryKey: \[.+\.\.\.lookupKey\]/g) || []).length, 7);
  assert.ok(!text.includes('base44.entities.'));
});
test('Recurring expense failed or pending lookup blocks save and revoked reads hide cached rows', () => {
  const ast = tree('ConfiguracaoDespesaRecorrente');
  for (const name of ['fornecedoresReady', 'centrosCustoReady', 'formasPagamentoReady', 'empresasReady', 'tiposDespesaReady', 'planoContasReady', 'centrosResultadoReady']) {
    const ctx = context({ config: null, formData: {} }); ctx.bindings[name] = false;
    run(ast, 'handleSubmit', ctx.bindings)(event);
    assert.equal(ctx.calls.length, 0); assert.match(ctx.errors[0], /verificacao/);
  }
  for (const allowed of [false, true]) {
    const select = run(ast, 'visibleRows', { podeConsultar: allowed, scope: { isCurrent: () => allowed } });
    assert.deepEqual(select([{ id: 'synthetic-cached' }]), allowed ? [{ id: 'synthetic-cached' }] : []);
  }
});
test('Reopened security forms keep exact defaults from the base, without payload replacement', () => {
  for (const name of ['PerfilAcesso', 'ModeloDocumento', 'ConfiguracaoDespesaRecorrente']) {
    const ast = tree(name), path = ast.fileName;
    const before = ts.createSourceFile(path, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
    const old = variables(before).get('[formData, setFormData]');
    const next = variables(ast).get('[formData, setFormData]');
    assert.equal(next.expression.getText(ast), 'useCadastroRecordState');
    assert.equal(next.arguments[0].getText(ast).replace(/\r\n/g, '\n'), old.arguments[0].getText(before).replace(/\r\n/g, '\n'));
  }
});
test('Fiscal origins display canonical labels while keeping every known historical wire value', () => {
  const path = 'src/components/cadastros/produto/FiscalContabilSection.jsx';
  const ast = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const origins = run(ast, 'origensMercadoria', {});
  assert.equal(origins.length, 6);
  for (const variants of origins) for (const value of variants) {
    assert.equal(variants.includes(value) ? value : variants[0], value);
    assert.ok(!variants[0].includes('Ã'));
    assert.equal(value[0], variants[0][0]);
  }
  const text = ast.getFullText();
  assert.ok(text.includes('value={variants.includes(formData.origem_mercadoria) ? formData.origem_mercadoria : variants[0]}'));
  assert.ok(text.includes('<SelectItem value={formData.origem_mercadoria} disabled>'));
  assert.ok(!text.includes('setFormData(prev => ({...prev, origem_mercadoria: variants'));
});
test('Pedido delivery action uses the existing canonical module without changing actions or fallback', () => {
  const path = 'src/components/comercial/PedidosTab.jsx';
  const ast = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  for (const allowed of [[], ['Comercial', 'Pedido', 'criarEntrega'], ['Expedição', 'Entrega', 'criar'], ['Expedição', null, 'criar']]) {
    const result = run(ast, 'canCriarEntrega', { hasPermission: (...args) => JSON.stringify(args) === JSON.stringify(allowed) });
    assert.equal(result, allowed.length > 0);
  }
  assert.equal(run(ast, 'canCriarEntrega', { hasPermission: (_module, _section, action) => action === 'editar' }), false);
});
