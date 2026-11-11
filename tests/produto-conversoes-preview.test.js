import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function load(file) {
  const exports = {};
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  new Function('exports', 'require', compiled)(exports, id => {
    if (id === 'react') return { ...react, default: react };
    if (id.endsWith('/CalculadoraUnidades')) return load('src/components/lib/CalculadoraUnidades.jsx');
    return new Proxy({}, { get: (_, key) => String(key) });
  });
  return exports;
}
const render = load('src/components/cadastros/AbaConversoesProduto.jsx').default;
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  if (node == null || node === false) return '';
  return typeof node === 'object' ? text(node.props.children) : String(node);
}

test('persisted product factors: preview agrees with the sales converter, including TON to pieces', () => {
  const product = { id: 'synthetic-product', empresa_id: 'synthetic-company',
    fatores_conversao: { kg_por_metro: 2, kg_por_peca: 20, metros_por_peca: 10, peca_por_ton: 50 },
    unidades_secundarias: ['KG', 'MT', 'PÇ', 'TON'] };
  const before = structuredClone(product);
  const preview = text(render({ formData: product }));
  for (const expected of ['50.000 MT', '5.000 PÇ', '20.000 KG', '100.000 KG', '1000.000 KG', '50.000 PÇ']) {
    assert.ok(preview.includes(expected), expected);
  }
  assert.deepEqual(product, before, 'preview must never mutate or persist product data');
  assert.equal(text(render({ formData: structuredClone(product) })), preview, 'reopen uses persisted factors');
});

test('legacy decimal strings and theoretical meter weight work without a parallel conversion rule', () => {
  const preview = text(render({ formData: { peso_teorico_kg_m: '2',
    fatores_conversao: { kg_por_peca: '20', peca_por_ton: '50' } } }));
  assert.ok(preview.includes('50.000 MT'));
  assert.ok(preview.includes('50.000 PÇ'));
});

test('new or incomplete product and invalid factors render unavailable instead of crashing or inventing zero equivalence', () => {
  for (const formData of [{}, { fatores_conversao: null }, {
    fatores_conversao: { kg_por_peca: 'invalid', kg_por_metro: -1, peca_por_ton: Infinity },
  }]) {
    const preview = text(render({ formData }));
    assert.ok(preview.includes('Não disponível'));
    assert.ok(preview.includes('1000.000 KG'), 'fixed TON/KG conversion remains available');
    assert.doesNotMatch(preview, /NaN|Infinity|0\.000 PÇ|0\.000 MT/);
  }
});
