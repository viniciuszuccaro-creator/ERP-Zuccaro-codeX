import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as policies from '../src/components/lib/iaResponsePolicy.js';
import {publicSuggestionFile as file, publicSuggestionPolicy as policy, publicSuggestionHunks as hunks, publicSuggestionAddition as addition, publicLookupSuggestionRemainder as remainder} from './helpers/publicLookupSuggestionRemainder.js';

const read = name => fs.readFileSync(name, 'utf8').replace(/\r\n/g, '\n');
for (const [name, hash, changes] of [[file, '6eb14a6757bf2826b6f29ef4a337fa8259d7ba82a94b0c2439e94d2d0750f9b6', hunks], [policy, '119f4ba0b883133e4c12ede7119b1beb51536c783ac3afa907c43289923e3b4f', [[addition, '']]]]) test(`${name}: complete prior source retained outside exact manual-review hunks`, () => {
  const source = read(name), digest = text => crypto.createHash('sha256').update(text).digest('hex');
  assert.equal(digest(remainder(name, source)), hash);
  for (const [after, before] of changes) {
    assert.throws(() => remainder(name, source.replace(after, before)));
    assert.throws(() => remainder(name, source.replace(after, after + after)));
  }
  assert.notEqual(digest(remainder(name, '// unintended\n' + source)), hash);
});
const ncm = {descricao: 'Synthetic proposed description', unidade: 'UN', aliquota_ipi: 0, aliquota_pis: 1.65, aliquota_cofins: 7.6, cest: 'synthetic', obs: 'Synthetic review'};
const rntrc = {valido: true, situacao: 'Ativo', tipo_registro: 'ETC', categoria: 'Synthetic'};
for (const [kind, validate, valid] of [['NCM', policies.validarSugestaoNcmConsultaIA, ncm], ['RNTRC', policies.validarSugestaoRntrcConsultaIA, rntrc]]) {
  test(`${kind}: actual schema accepts object/JSON proposals but supplies no verification or fiscal authority`, () => {
    assert.deepEqual(validate(valid), valid); assert.deepEqual(validate(JSON.stringify(valid)), valid);
    assert.ok(!Object.hasOwn(validate(valid), 'verificado'));
    if (kind === 'NCM') for (const value of [-5, 0, 150]) assert.equal(validate({...valid, aliquota_ipi: value}).aliquota_ipi, value);
  });
  test(`${kind}: schema rejects malformed/incomplete/opaque/oversized/injected responses without coercion`, () => {
    for (const input of [null, undefined, 1, false, [], {}, '{}', 'invalid json', ' '.repeat(100001),
      {erro: 'synthetic-private-error'}, {...valid, verificado: true}, {...valid, unknown: true},
      ...(kind === 'NCM' ? [{...valid, descricao: {}}, {...valid, descricao: ''}, {...valid, obs: 'x'.repeat(4001)}, {...valid, aliquota_ipi: '10'}, {...valid, aliquota_ipi: Infinity}]
        : [{...valid, valido: 'true'}, {...valid, situacao: 'unknown'}, {...valid, tipo_registro: 'unknown'}, {...valid, categoria: {}}])]) {
      assert.throws(() => validate(input), error => error instanceof Error && !error.message.includes('synthetic-private-error'));
    }
  });
}
function harness({llm = async () => ncm, backend = {sucesso: true, dados: {razao_social: 'Synthetic'}}, source = read(file)} = {}) {
  const states = [], calls = [], logs = []; let cursor = 0;
  const ReactMock = {...React, useState: initial => {
    const index = cursor++; if (!(index in states)) states[index] = initial;
    return [states[index], value => { states[index] = value; }];
  }};
  const tag = name => ({children, ...props}) => React.createElement(name, props, children);
  const dependencies = {
    react: ReactMock,
    '@/api/base44Client': {base44: {
      functions: {invoke: async (...args) => { calls.push(['invoke', ...args]); return {data: backend}; }},
      integrations: {Core: {InvokeLLM: async options => { calls.push(['llm', options]); return llm(options); }}},
    }},
    '@/components/lib/iaResponsePolicy': policies,
    '@/components/ui/button': {Button: tag('button')}, '@/components/ui/alert': {Alert: tag('section'), AlertDescription: tag('div')},
    'lucide-react': Object.fromEntries(['Loader2', 'Search', 'CheckCircle', 'AlertCircle'].map(name => [name, tag('i')])),
  };
  const output = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true}}).outputText;
  const exports = {};
  new Function('require', 'exports', 'fetch', 'console', output)(name => { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; }, exports,
    async () => { throw Error('synthetic external fetch forbidden'); }, Object.fromEntries(['log', 'warn', 'error'].map(name => [name, (...args) => logs.push(args)])));
  return {exports, states, calls, logs,
    render: props => { cursor = 0; return exports.BotaoBuscaAutomatica(props); },
    hook: tipo => { cursor = 0; return exports.useBuscaAutomatica(tipo); },
  };
}
function click(tree) {
  let button;
  function visit(node) { if (!React.isValidElement(node)) return; if (node.props.onClick) { assert.ok(button === undefined); button = node; } React.Children.forEach(node.props.children, visit); }
  visit(tree); assert.ok(button); return button.props.onClick();
}
for (const [tipo, input, proposal, name] of [['ncm', '00000000', ncm, 'buscarDadosNCM'], ['rntrc', 'synthetic-registration', rntrc, 'buscarDadosRNTRC']]) {
  test(`${tipo}: actual lookup returns an unverified proposal, never authoritative dados, for object and JSON responses`, async () => {
    for (const response of [proposal, JSON.stringify(proposal)]) {
      const h = harness({llm: async () => response}), result = await h.exports[name](input);
      assert.equal(result.sucesso, true); assert.equal(result.verificado, false);
      assert.equal(result.codigo_consultado, input); assert.equal(result.fonte, 'Sugestao IA nao verificada');
      assert.deepEqual(result.sugestao, proposal); assert.ok(!Object.hasOwn(result, 'dados'));
      assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], 'llm');
      assert.ok(h.calls[0][1].prompt.includes('nao verificada')); assert.ok(h.calls[0][1].prompt.includes('antes do preenchimento manual'));
    }
  });
  test(`${tipo}: old button counterproof automatically applied IA output; new button displays proposal without invoking callback`, async () => {
    const oldCalls = [], old = harness({llm: async () => proposal, source: remainder(file, read(file))});
    await click(old.render({tipo, valor: input, onDadosEncontrados: value => oldCalls.push(value)}));
    assert.deepEqual(oldCalls, [proposal]);
    const callbacks = [], h = harness({llm: async () => proposal}), props = {tipo, valor: input, onDadosEncontrados: value => callbacks.push(value)};
    await click(h.render(props)); assert.deepEqual(callbacks, []); assert.equal(h.states[0], false);
    const html = renderToStaticMarkup(h.render(props));
    assert.ok(html.includes('Sugestao IA nao verificada')); assert.ok(html.includes(input)); assert.ok(html.includes('preencher manualmente'));
    assert.ok(html.includes('border-amber-300')); assert.ok(!html.includes('Dados REAIS preenchidos'));
    assert.ok(html.includes(tipo === 'ncm' ? proposal.descricao : 'Ativo')); assert.ok(!html.includes('onDadosEncontrados'));
  });
  test(`${tipo}: actual hook separates proposal from dados and clears previous proposal on failed new request`, async () => {
    let count = 0; const h = harness({llm: async () => { if (count++) throw Error('synthetic-private-error'); return proposal; }});
    const result = await h.hook(tipo).buscar(input); assert.equal(result.verificado, false);
    assert.equal(h.hook(tipo).dados, null); assert.deepEqual(h.hook(tipo).sugestao, proposal); assert.equal(h.hook(tipo).erro, null);
    const failed = await h.hook(tipo).buscar(input); assert.equal(failed.sucesso, false);
    assert.equal(h.hook(tipo).dados, null); assert.equal(h.hook(tipo).sugestao, null);
    assert.ok(!h.hook(tipo).erro.includes('synthetic-private-error')); assert.equal(h.hook(tipo).buscando, false);
  });
  test(`${tipo}: invalid/prohibited response and provider failure never apply form fields or echo provider body`, async () => {
    for (const llm of [async () => ({}), async () => ({erro: 'synthetic-private-error'}), async () => ({...proposal, verificado: true}), async () => { throw Error('synthetic-private-error'); }]) {
      const callbacks = [], h = harness({llm}), props = {tipo, valor: input, onDadosEncontrados: value => callbacks.push(value)};
      await click(h.render(props)); assert.deepEqual(callbacks, []); assert.equal(h.states[1].sucesso, false);
      assert.ok(!JSON.stringify(h.states).includes('synthetic-private-error')); assert.ok(!JSON.stringify(h.logs).includes('synthetic-private-error'));
    }
  });
}
test('existing CNPJ button callback and hook data channel remain intact, separate from proposal path', async () => {
  const callbacks = [], h = harness(), props = {tipo: 'cnpj', valor: '00000000000000', onDadosEncontrados: value => callbacks.push(value)};
  await click(h.render(props)); assert.deepEqual(callbacks, [{razao_social: 'Synthetic'}]); assert.equal(h.calls[0][0], 'invoke');
  const hook = harness(); await hook.hook('cnpj').buscar('00000000000000');
  assert.deepEqual(hook.hook('cnpj').dados, {razao_social: 'Synthetic'}); assert.equal(hook.hook('cnpj').sugestao, null);
});
test('NCM invalid input still blocks provider before any request with previous fixed validation reason', async () => {
  const h = harness(); assert.deepEqual(await h.exports.buscarDadosNCM('bad'), {sucesso: false, erro: 'NCM deve ter 8 dígitos'}); assert.deepEqual(h.calls, []);
});
test('rendered proposal escapes markup and preserves zero, false and literal suggested values without claiming verification', async () => {
  const h = harness({llm: async () => ({...rntrc, valido: false, categoria: '<script>synthetic</script>'})});
  const props = {tipo: 'rntrc', valor: 'synthetic', onDadosEncontrados: () => { throw Error('must not apply'); }};
  await click(h.render(props)); const html = renderToStaticMarkup(h.render(props));
  assert.ok(html.includes('Nao')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>'));
});
