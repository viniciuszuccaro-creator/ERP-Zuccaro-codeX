import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import { metricReportRemainder } from './helpers/metricReportRemainder.js';

const bi = 'src/components/dashboard/DashboardOperacionalBI.jsx';
const logistics = 'src/components/expedicao/RelatoriosLogistica.jsx';
const picking = 'src/components/expedicao/SeparacaoConferenciaIA.jsx';
const rh = 'src/components/rh/DashboardRHRealtime.jsx';
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const hashes = {
  [bi]: 'eef0c77b4b48d31df561a6ee3f0f2dd366477f559440c01bf49a17a500bedf4a',
  [logistics]: 'e553909519dd92f5f526922cfe5063fed64f279b5a33a9dc8c04e94e634039a7',
  [picking]: '91cec6af6fe41b90575f7041c85d3c381b3f7a787c711a735b3747fe353fbf2b',
  [rh]: '43b11e0913df1361434aca075f54b9d406031b5ed2cc258f70b0f61b804a156e',
};
function once(text, after, before) {
  assert.equal(text.split(after).length, 2, 'exactly one approved hunk');
  return text.replace(after, before);
}
function remainder(file, source) {
  if (file === bi) return once(source, 'crescimento: Number(crescimento)', 'crescimento: parseFloat(crescimento)');
  if (file === logistics) return metricReportRemainder(file, source);
  const annotation = file === picking
    ? '  /** @type {[{itensPorHora: number | string, acuracia: number | string}, React.Dispatch<React.SetStateAction<{itensPorHora: number | string, acuracia: number | string}>>]} */\n'
    : '  /** @type {[{colaboradoresAtivos: number, presentesHoje: number, ausentesHoje: number, taxaPresenca: number | string, horasExtrasHoje: number, riscoTurnoverAlto: number, produtividadeMedia: number | string}, React.Dispatch<React.SetStateAction<{colaboradoresAtivos: number, presentesHoje: number, ausentesHoje: number, taxaPresenca: number | string, horasExtrasHoje: number, riscoTurnoverAlto: number, produtividadeMedia: number | string}>>]} */\n';
  // Match the declaration verbatim; no AST erasure of unrelated annotations.
  source = once(source, annotation, '');
  if (file === rh) {
    for (const [after, before] of [
      ['Number(metricas.taxaPresenca) >= 95', 'metricas.taxaPresenca >= 95'],
      ['Number(metricas.produtividadeMedia) >= 100', 'metricas.produtividadeMedia >= 100'],
      ['Number(metricas.taxaPresenca) < 95', 'metricas.taxaPresenca < 95'],
    ]) {
      const count = after.includes('taxaPresenca) >=') ? 2 : 1;
      assert.equal(source.split(after).length, count + 1);
      source = source.replaceAll(after, before);
    }
    assert.ok(source.endsWith('\n') && !source.endsWith('\n\n'));
    source = source.slice(0, -1);
  }
  return source;
}
for (const file of Object.keys(hashes)) test(`${file}: whole stage59 source retained outside counted hunks`, () => {
  const source = read(file);
  assert.equal(crypto.createHash('sha256').update(remainder(file, source)).digest('hex'), hashes[file]);
  if (file === rh) assert.throws(() => remainder(file, source + '// unexpected'));
  else assert.notEqual(crypto.createHash('sha256').update(remainder(file, source + '// unexpected')).digest('hex'), hashes[file]);
});
test('report remainder rejects missing or duplicated approved conversion without changing historical hashes', () => {
  const source=read(logistics);
  assert.throws(()=>metricReportRemainder(logistics,source.replace('Number(taxa) >= 90','true')));
  assert.throws(()=>metricReportRemainder(logistics,source+'\nNumber(taxa) >= 90'));
});
function nodes(source, predicate) {
  const root = ts.createSourceFile('metric.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const result = [];
  function visit(node) { if (predicate(node)) result.push(node.getText(root)); ts.forEachChild(node, visit); }
  visit(root); return result;
}
function effect(file, setter, args, before = false) {
  const source = before ? remainder(file, read(file)) : read(file);
  const callbacks = nodes(source, node => ts.isCallExpression(node) && node.expression.getText() === 'useEffect'
    && node.arguments[0]?.getText().includes(setter + '('));
  assert.equal(callbacks.length, 1);
  const callback = nodes(callbacks[0], node => ts.isArrowFunction(node));
  const body = callback[0]; assert.ok(body.startsWith('() =>'));
  return new Function(...Object.keys(args), `return (${body})();`)(...Object.values(args));
}
test('RH actual effect retains formatted text, numeric counts and decimal precision', () => {
  const today = new Date().toISOString().split('T')[0];
  const args = { colaboradores: [{status:'Ativo'}, {status:'Ativo'}, {status:'Inativo'}],
    pontos: [{data_hora:today, colaborador_id:'synthetic-a', tipo:'hora_extra', horas:1.25}],
    monitoramento:[{analise_comportamental_ia:{risco_turnover:'Alto'}, metricas_produtividade:{produtividade_vs_meta:100.04}}] };
  let current, previous;
  effect(rh, 'setMetricas', {...args, setMetricas: value => { current=value; }});
  effect(rh, 'setMetricas', {...args, setMetricas: value => { previous=value; }}, true);
  assert.deepEqual(current, previous);
  assert.deepEqual(current, { colaboradoresAtivos:2, presentesHoje:1, ausentesHoje:1,
    taxaPresenca:'50.0', horasExtrasHoje:1.25, riscoTurnoverAlto:1, produtividadeMedia:'100.0' });
});
test('RH absent rows do not fabricate replacement metrics', () => {
  effect(rh, 'setMetricas', {colaboradores:[], pontos:[], monitoramento:[], setMetricas:() => assert.fail('unexpected update')});
});
test('picking actual effect retains rate, capped accuracy and formatting', () => {
  for (const total of [1, 3, 10]) {
    const args = {separacao:{itens_separados:[{},{}]}, cronometro:{segundos:120}, pedido:{itens_revenda:Array(total).fill({})}};
    let current, previous;
    effect(picking, 'setDesempenho', {...args, setDesempenho:value => {current=value;}});
    effect(picking, 'setDesempenho', {...args, setDesempenho:value => {previous=value;}}, true);
    assert.deepEqual(current, previous);
    assert.equal(current.itensPorHora, '60.0');
    assert.equal(current.acuracia, Math.min(200 / total,100).toFixed(0));
  }
});
test('picking no elapsed time or no picked items keeps the original initial state', () => {
  for (const [items,seconds] of [[[],10], [[{}],0]]) effect(picking, 'setDesempenho', {
    separacao:{itens_separados:items}, cronometro:{segundos:seconds}, pedido:{},
    setDesempenho:() => assert.fail('unexpected update'),
  });
});
test('actual report conversion expressions preserve zero, negatives and rounded thresholds', () => {
  for (const file of [bi,logistics]) {
    const source=read(file), old=remainder(file,source);
    const identifier=file===bi?'crescimento':'taxa';
    const select=text => nodes(text,node => ts.isCallExpression(node) && node.arguments.length===1
      && node.arguments[0].getText()===identifier && ['Number','parseFloat'].includes(node.expression.getText()));
    const after=select(source), before=select(old);
    assert.equal(after.length,1); assert.equal(before.length,1);
    for(const value of [0,'0.0','-100.0','89.9','90.0','94.9','95.0','100.0','123.5']) {
      const evaluate=expression=>new Function(identifier,`return ${expression};`)(value);
      assert.equal(evaluate(after[0]),evaluate(before[0]));
    }
  }
});
test('RH numeric comparisons preserve thresholds for both initial numbers and formatted values', () => {
  const source=read(rh);
  const comparisons=nodes(source,node=>ts.isBinaryExpression(node)
    && [ts.SyntaxKind.GreaterThanEqualsToken,ts.SyntaxKind.LessThanToken].includes(node.operatorToken.kind)
    && node.left.getText().startsWith('Number(metricas.'));
  assert.equal(comparisons.length,4);
  for (const expression of comparisons) for (const value of [0,100,'0.0','94.9','95.0','99.9','100.0']) {
    const metricas={taxaPresenca:value,produtividadeMedia:value};
    const old=expression.replace(/Number\((metricas\.\w+)\)/g,'$1');
    const evaluate=text=>new Function('metricas',`return ${text};`)(metricas);
    assert.equal(evaluate(expression),evaluate(old));
  }
});
