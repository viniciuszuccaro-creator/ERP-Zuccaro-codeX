import test from 'node:test';
import {consolidation84Hunks} from './helpers/consolidation84Remainder.js';
import {consolidation82Hunks,consolidation82Remainder} from './helpers/consolidation82Remainder.js';
import {portalBankSourceRemainder} from './helpers/portalBankSourceRemainder.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPortalDocumentoLinks, assertPortalTituloDoCliente } from '../src/components/lib/portalClientePolicy.js';
import { portalReadHunks, portalReadRemainder } from './helpers/portalReadRemainder.js';

const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
const frozen = {
  'src/lib/utils.js': '6f2e6d5cae1cce7c8663be5906fc9617a208d78fd6cf2815c8e260a10132e417',
  'src/components/financeiro/ContasReceberTab.jsx': 'd3168dad16aacf9e706a27f23b30b05fe310f792eee0db42ab76ae9ea796901a',
  'src/components/portal/DocumentosCliente.jsx': 'c648f7cbdf1bc7b6c461e5dbe784b9563466bad0d4c1dc5d810bd77825662f4e',
  'src/components/portal/BoletosList.jsx': '4bfd944b20d67fadbbd5d8534280f420d7754ba29262c64df949d2b7eac362e0',
};
function expression(file, name, deps = {}) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let found;
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name?.getText(tree) === name) {
      assert.ok(found === undefined); found = node;
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(found, name);
  const source = ts.isFunctionDeclaration(found) ? found.getText(tree).replace(/^export /, '') : found.initializer.getText(tree);
  return new Function(...Object.keys(deps), `return (${source});`)(...Object.values(deps));
}
const safe = expression('src/lib/utils.js', 'isSafeHttpUrl');
const scalar = expression('src/lib/utils.js', 'displayScalar');
for (const [file, hash] of Object.entries(frozen)) test(`${file}: exact read hunks preserve all other stage53 bytes`, () => {
  const source = read(file);
  assert.equal(digest(portalReadRemainder(file, source)), hash);
  for (const [current] of portalReadHunks[file]) {
    const target=[current,...(consolidation82Hunks[file]?.hunks||[]).map(h=>h[0]),...(consolidation84Hunks[file]?.hunks||[]).map(h=>h[0])].find(h=>source.includes(h));
    assert.ok(source.includes(target));
    assert.throws(() => portalReadRemainder(file, source.replace(target, '')));
    assert.throws(() => portalReadRemainder(file, source.replace(target, target + target)));
  }
  assert.notEqual(digest(portalReadRemainder(file, '// unexpected\n' + source)), hash);
});
test('prior financial policy retained outside exact bank-source hunks; Portal shell remains byte-identical', () => {
  assert.equal(digest(portalBankSourceRemainder('src/components/lib/portalClientePolicy.js',read('src/components/lib/portalClientePolicy.js'))), '17c89a7cf2604211fc76c13e498cc3bf22438bb8a907254ba08cbd801f56309c');
  assert.equal(digest(consolidation82Remainder('src/pages/PortalCliente.jsx',read('src/pages/PortalCliente.jsx'))), '56a6d03e815206603a7328d6ad17058e226313b9fb0f3c0dc827b9fa09543273');
});
test('HTTP guard allows absolute web URLs and rejects opaque inputs without coercion', () => {
  for (const url of ['https://example.invalid/a?x=1', 'http://example.invalid/a']) assert.equal(safe(url), true);
  let coerced = false;
  const opaque = { toString() { coerced = true; throw Error('must not coerce'); } };
  for (const value of [opaque, null, undefined, 1, '', '/relative', 'javascript:alert(1)', 'data:text/plain,synthetic', 'file:///synthetic', 'blob:https://example.invalid/a', 'portal://synthetic', 'https://user:secret@example.invalid']) assert.equal(safe(value), false);
  assert.equal(coerced, false);
});
const docs = 'src/components/portal/DocumentosCliente.jsx';
test('actual XML handler retains ownership denial and opens only safe links without opener', async () => {
  const calls = [], errors = [];
  const fn = expression(docs, 'handleDownloadNFe', { buildPortalDocumentoLinks, clienteId: 'synthetic-client', isSafeHttpUrl: safe, window: { open: (...args) => calls.push(args) }, toast: { error: message => errors.push(message) } });
  await fn({ id: 'synthetic-nfe', cliente_id: 'synthetic-other', xml_url: 'https://example.invalid/other' });
  await fn({ id: 'synthetic-nfe', cliente_id: 'synthetic-client', xml_url: 'javascript:alert(1)' });
  assert.equal(calls.length, 0); assert.equal(errors.length, 2);
  await fn({ id: 'synthetic-nfe', cliente_id: 'synthetic-client', xml_url: 'https://example.invalid/synthetic.xml' });
  assert.deepEqual(calls, [['https://example.invalid/synthetic.xml', '_blank', 'noopener,noreferrer']]);
});
test('actual boleto preview rejects unsafe URL without falling through to generation', () => {
  const calls = [], errors = [], generated = [], messages = [];
  const fn = expression(docs, 'handleVisualizarBoleto', { assertPortalTituloDoCliente, clienteId:'synthetic-client', isSafeHttpUrl: safe, window: { open: (...args) => calls.push(args) }, toast: { error: message => errors.push(message), message: message => messages.push(message) }, emitirSegundaVia: { mutate: value => generated.push(value) } });
  const owned={id:'synthetic-title',cliente_id:'synthetic-client'};
  fn({ ...owned, url_boleto_pdf: 'javascript:alert(1)' });
  assert.equal(errors.length, 1); assert.deepEqual(generated, []); assert.deepEqual(calls, []);
  fn({ ...owned, url_boleto_pdf: 'https://example.invalid/synthetic.pdf' });
  assert.deepEqual(calls, [['https://example.invalid/synthetic.pdf', '_blank', 'noopener,noreferrer']]);
  fn({ ...owned, url_boleto_pdf: 'portal://synthetic', linha_digitavel: 'synthetic-existing-line' });
  assert.equal(messages.length, 1); assert.deepEqual(generated, []);
});
test('actual document filters preserve literal strings and deny opaque field coercion', () => {
  const opaque = { toString() { throw Error('must not coerce'); } };
  const notasFiscais = [{ numero: '000123' }, { numero: 123 }, { numero: opaque, chave_acesso: opaque }];
  const contasReceber = [{ numero_documento: '000123' }, { descricao: 'SYNTHETIC' }, { numero_documento: opaque, descricao: opaque }];
  assert.deepEqual(expression(docs, 'filteredNFes', { notasFiscais, searchTerm: '000' }), [notasFiscais[0]]);
  assert.deepEqual(expression(docs, 'filteredNFes', { notasFiscais, searchTerm: '123' }), notasFiscais.slice(0, 2));
  assert.deepEqual(expression(docs, 'filteredBoletos', { contasReceber, searchTerm: 'synthetic' }), [contasReceber[1]]);
});
test('rendered scalar boundary excludes object children; numeric presentation retains Intl coercion', () => {
  assert.throws(() => renderToStaticMarkup(React.createElement('span', null, { synthetic: true })), /Objects are not valid/);
  assert.equal(renderToStaticMarkup(React.createElement('span', null, scalar({ synthetic: true }))), '<span></span>');
  assert.equal(scalar({ synthetic: true }), null); assert.equal(scalar(Infinity), null);
  assert.equal(scalar('0001'), '0001'); assert.equal(scalar(0), 0);
  const format = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  for (const value of ['12.50', 0, -2, '0']) assert.equal(format.format(Number(value)), format.format(value));
});
test('actual financial boleto callback blocks unsafe links before open', () => {
  const file = 'src/components/financeiro/ContasReceberTab.jsx';
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let callback;
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === 'onVerBoleto') {
      assert.ok(callback === undefined); callback = node.initializer.expression;
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(callback);
  const calls = [], errors = [];
  const fn = new Function('isSafeUrl', 'window', 'toast', `return (${callback.getText(tree)});`)(safe, { open: (...args) => calls.push(args) }, value => errors.push(value));
  fn({ boleto_url: 'data:text/html,synthetic' }); fn({});
  assert.equal(errors.length, 2); assert.deepEqual(calls, []);
  fn({ boleto_url: 'https://example.invalid/synthetic.pdf' });
  assert.deepEqual(calls, [['https://example.invalid/synthetic.pdf', '_blank', 'noopener,noreferrer']]);
});
test('document action surfaces guard actual URL fields without changing mutation commands', () => {
  const source = read(docs), boletos = read('src/components/portal/BoletosList.jsx');
  assert.ok(source.includes('isSafeHttpUrl(links.danfe) ? ('));
  assert.ok(source.includes('isSafeHttpUrl(conta.url_fatura) && ('));
  assert.ok(boletos.includes('isSafeHttpUrl(b.url_boleto_pdf) && ('));
  assert.ok(source.includes("window.open(links.danfe, '_blank', 'noopener,noreferrer')"));
  assert.ok(source.includes('const url = conta.url_fatura;'));
  assert.ok(source.includes("if (isSafeHttpUrl(url)) window.open(url, '_blank', 'noopener,noreferrer')"));
});
