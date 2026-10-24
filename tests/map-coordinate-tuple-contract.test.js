import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const mapPath = 'src/components/expedicao/painel-logistico/MapView.jsx';
const realtimePath = 'src/components/expedicao/MapaTempoReal.jsx';
const read = path => readFileSync(path, 'utf8');
function parts(text) {
  const ast = ts.createSourceFile(mapPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let center, fly;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'center') center = node.initializer.arguments[0].getText(ast);
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'FlyTo') fly = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(center && fly);
  return { center, fly };
}
const emit = text => ts.transpileModule(text.replaceAll('\r\n', '\n'), { compilerOptions: {
  jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, removeComments: true,
} }).outputText;

test('callback real preserva selecao, media, fallback e coordenadas zero sem alterar fonte', () => {
  const old = parts(execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${mapPath}`], { encoding: 'utf8' })).center;
  const next = parts(read(mapPath)).center;
  for (const selected of [undefined, { endereco_entrega_completo: { latitude: -20, longitude: -40 } },
    { endereco_entrega_completo: { latitude: 0, longitude: 0 } }]) {
    for (const points of [[], [{ lat: 0, lng: 0 }], [{ lat: -20, lng: -40 }, { lat: -22, lng: -42 }]]) {
      const before = structuredClone({ selected, points });
      const evaluate = callback => new Function('selected', 'points', `${emit(`const fn = ${callback};`)}; return fn();`)(selected, points);
      assert.deepEqual(evaluate(next), evaluate(old));
      assert.deepEqual({ selected, points }, before);
      assert.equal(evaluate(next).length, 2);
    }
  }
});

test('FlyTo mantem guarda, zoom e argumentos usando mapa simulado sem tiles/rede', () => {
  const fly = parts(read(mapPath)).fly;
  for (const center of [undefined, null, [], [0], [0, 0], [-23.55, -46.63]]) {
    const calls = [];
    const env = { React: { useEffect: effect => effect() },
      useMap: () => ({ getZoom: () => 9, flyTo: (...args) => calls.push(args) }) };
    const run = new Function(...Object.keys(env), `${emit(fly)}; return FlyTo;`)(...Object.values(env));
    assert.equal(run({ center }), null);
    if (Array.isArray(center) && center.length === 2) assert.deepEqual(calls, [[center, 11, { duration: 0.7 }]]);
    else assert.deepEqual(calls, []);
  }
});

test('JavaScript emitido dos dois mapas permanece integralmente identico', () => {
  for (const path of [mapPath, realtimePath]) {
    const before = execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' });
    assert.equal(emit(read(path)), emit(before));
  }
});
