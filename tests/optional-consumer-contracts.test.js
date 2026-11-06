import test from 'node:test';
import { cepReadRemainder } from './helpers/cepReadRemainder.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const card = 'src/components/financeiro/LaunchpadCard.jsx';
const cep = 'src/components/comercial/BuscaCEP.jsx';
const audit = 'src/components/lib/uiAudit.jsx';
const header = 'src/components/portal/PortalHeader.jsx';
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const annotations = {
  [card]: '/** @param {{title: React.ReactNode, description: React.ReactNode, icon: React.ElementType,\n * onClick?: (event: React.MouseEvent | React.KeyboardEvent) => void, color?: string,\n * badge?: React.ReactNode, badgeVariant?: string, dataPermission?: string, dataAction?: string}} props */\n',
  [cep]: "/** @param {{onEnderecoEncontrado: (endereco: {cep: string, logradouro: string, bairro: string,\n * cidade: string, estado: string, complemento: string, numero: string,\n * latitude: number | null, longitude: number | null, mapa_url: string}) => void,\n * enderecoAtual?: {cep?: string}, label?: string}} props */\n",
  [audit]: '/** @param {{component: string, issue: string, severity?: string, meta?: unknown}} options */\n',
  [header]: '/** @param {{cliente: {nome_fantasia?: string, razao_social?: string, nome?: string,\n * classificacao_abc?: string, status?: string, cnpj?: string, tipo?: string, score_saude_cliente?: number} | null,\n * spotlight?: {raw?: string, exp_minutes_remaining?: string | number}}} props */\n',
};
const hashes = {
  [card]: '4003fb068ef3683c0412c73a3485d8024933125783d3e279218261d1a7bf9f3e',
  [cep]: '2ee9f464cce67b7d8f13f382804b02a84a98f8c95dd0529dd3c07df578c91451',
  [audit]: 'fde305a808aae7ac42bc7fa2d45f0f88c502157051176df3f54ae18435ba5a0d',
  [header]: 'e90e524234b7b3e40d5a9de1780919ca8036376a5d86f622773be8e3c62a37de',
};
function remainder(file, text) {
  if (file === cep) return cepReadRemainder(text);
  assert.equal(text.split(annotations[file]).length, 2);
  let source = text.replace(annotations[file], '');
  if (file === cep || file === header) {
    assert.ok(source.endsWith('\n') && !source.endsWith('\n\n')); source = source.slice(0, -1);
  }
  return source;
}
const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React, removeComments: true };
for (const file of Object.keys(hashes)) test(`${file}: whole stage56 source retained outside exact approved hunks`, () => {
  const source = read(file), before = remainder(file, source);
  assert.equal(crypto.createHash('sha256').update(before).digest('hex'), hashes[file]);
  if (file !== cep) assert.equal(ts.transpileModule(source, { compilerOptions: options }).outputText, ts.transpileModule(before, { compilerOptions: options }).outputText);
  assert.throws(() => remainder(file, source.replace(annotations[file], '')));
  assert.throws(() => remainder(file, source.replace(annotations[file], annotations[file] + annotations[file])));
  assert.notEqual(crypto.createHash('sha256').update(remainder(file, '// unintended\n' + source)).digest('hex'), hashes[file]);
});
function load(file, dependencies, globals = {}, source = read(file)) {
  const output = ts.transpileModule(source, { compilerOptions: { ...options, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, exports = {};
  new Function('require', 'exports', ...Object.keys(globals), output)(name => { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; }, exports, ...Object.values(globals));
  return exports;
}
const tag = type => ({ children, ...props }) => React.createElement(type, props, children);
const ui = { react: React, '@/components/ui/card': { Card: tag('section'), CardContent: tag('div') }, '@/components/ui/badge': { Badge: tag('span') } };
const Icon = props => React.createElement('i', props);

test('actual card preserves metadata and handles pointer, Enter and Space exactly once', () => {
  const Card = load(card, ui).default, calls = [], events = [];
  const rendered = Card({ title: 'Synthetic', description: 'Synthetic', icon: Icon, dataPermission: 'Synthetic.View', dataAction: 'Synthetic.Open', onClick: event => calls.push(event) });
  const event = key => ({ key, preventDefault: () => events.push('prevent'), stopPropagation: () => events.push('stop') });
  const click = event(), enter = event('Enter'), space = event(' ');
  rendered.props.onClick(click); rendered.props.onKeyDown(enter); rendered.props.onKeyDown(space); rendered.props.onKeyDown(event('Escape'));
  assert.deepEqual(calls, [click, enter, space]); assert.deepEqual(events, ['stop', 'prevent', 'stop', 'prevent', 'stop']);
  const html = renderToStaticMarkup(rendered); assert.ok(html.includes('data-permission="Synthetic.View"')); assert.ok(html.includes('data-action="Synthetic.Open"'));
});
test('card absent optional metadata/callback keeps attributes absent, not a fabricated permission', () => {
  const Card = load(card, ui).default, rendered = Card({ title: 'Synthetic', description: 'Synthetic', icon: Icon });
  rendered.props.onClick({ stopPropagation() {} });
  rendered.props.onKeyDown({ key: 'Enter', stopPropagation() {}, preventDefault() {} });
  const html = renderToStaticMarkup(rendered);
  assert.ok(!html.includes('data-permission=')); assert.ok(!html.includes('data-action='));
  assert.ok(html.includes('data-launchpad-color="blue"'));
});
test('header omits spotlight by default and renders supplied display metadata without installing auth', () => {
  const Header = load(header, { ...ui, 'lucide-react': { Building2: Icon, Users: Icon, Lock: Icon, Star: Icon } }).default;
  const cliente = { nome: 'Synthetic Client', classificacao_abc: 'A', status: 'Ativo', score_saude_cliente: 0 };
  const plain = renderToStaticMarkup(React.createElement(Header, { cliente }));
  assert.ok(plain.includes('Synthetic Client')); assert.ok(!plain.includes('Link seguro'));
  const highlighted = renderToStaticMarkup(React.createElement(Header, { cliente, spotlight: { raw: 'synthetic-not-a-token', exp_minutes_remaining: 5 } }));
  assert.ok(highlighted.includes('expira em 5 min')); assert.ok(!highlighted.includes('synthetic-not-a-token'));
  assert.ok(renderToStaticMarkup(React.createElement(Header, { cliente: null })).includes('Cliente'));
});

function cepHarness(props, fetch, source = read(cep)) {
  const states = [], effects = [], messages = []; let cursor = 0;
  const ReactMock = { ...React, useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; }, useEffect: fn => effects.push(fn) };
  const Component = load(cep, { react: ReactMock, '@/components/ui/input': { Input: tag('input') }, '@/components/ui/button': { Button: tag('button') }, '@/components/ui/label': { Label: tag('label') }, 'lucide-react': { Search: Icon, Loader2: Icon, Check: Icon, AlertCircle: Icon }, sonner: { toast: { error: value => messages.push(value), success: value => messages.push(value) } } }, { fetch, setTimeout: () => 1, console: { error() {} } }, source).default;
  return { states, effects, messages, render: () => { cursor = 0; return Component(props); } };
}
function findButton(tree) {
  let button;
  function visit(node) { if (!React.isValidElement(node)) return; if (node.props.onClick) { assert.ok(button === undefined); button = node; } React.Children.forEach(node.props.children, visit); }
  visit(tree); assert.ok(button); return button;
}
test('CEP without current address starts empty and refuses invalid input before any fetch', async () => {
  let calls = 0; const h = cepHarness({ onEnderecoEncontrado() {} }, async () => { calls++; throw Error('network forbidden'); });
  const tree = h.render(); assert.equal(h.states[0], ''); h.effects[0]();
  await findButton(tree).props.onClick(); assert.equal(calls, 0); assert.equal(h.messages.length, 1);
});
test('CEP keeps current text and returns synthetic address through the actual callback only after successful reads', async () => {
  const calls = [], results = [];
  const h = cepHarness({ enderecoAtual: { cep: 'synthetic' }, onEnderecoEncontrado: value => results.push(value) }, async url => {
    calls.push(url); return { json: async () => calls.length === 1 ? { cep: 'synthetic', logradouro: 'Synthetic', bairro: 'Synthetic', localidade: 'Synthetic', uf: 'XX' } : [] };
  });
  h.render(); assert.equal(h.states[0], 'synthetic');
  h.states[0] = '00000000'; await findButton(h.render()).props.onClick();
  assert.equal(calls.length, 2); assert.equal(results.length, 1); assert.equal(results[0].cidade, 'Synthetic');
  assert.equal(results[0].latitude, null); assert.equal(results[0].mapa_url, ''); assert.equal(h.states[1], false);
});
test('CEP failure does not emit an address or keep loading', async () => {
  const results = [], h = cepHarness({ onEnderecoEncontrado: value => results.push(value) }, async () => { throw Error('synthetic failure'); });
  h.render(); h.states[0] = '00000000'; await findButton(h.render()).props.onClick();
  assert.deepEqual(results, []); assert.equal(h.states[1], false); assert.equal(h.messages.length, 1);
});

const validAddress = { cep: 'synthetic', logradouro: 'Synthetic', bairro: 'Synthetic', localidade: 'Synthetic', uf: 'XX' };
test('counterproof: previous CEP emitted opaque address field; actual boundary now denies it before geocoding', async () => {
  for (const [source, expected] of [[cepReadRemainder(read(cep)), 1], [read(cep), 0]]) {
    const rows = []; let calls = 0;
    const h = cepHarness({ onEnderecoEncontrado: value => rows.push(value) }, async () => ({ json: async () => ++calls === 1 ? { ...validAddress, logradouro: { opaque: true } } : [] }), source);
    h.render(); h.states[0] = '00000000'; await findButton(h.render()).props.onClick();
    assert.equal(rows.length, expected); assert.equal(calls, expected ? 2 : 1); assert.equal(h.states[1], false);
  }
});
for (const [label, payload] of [
  ['null', null], ['array', []], ['primitive', 'synthetic'], ['missing', {}],
  ['opaque street', { ...validAddress, logradouro: {} }], ['numeric CEP', { ...validAddress, cep: 123 }],
  ['nontext state', { ...validAddress, uf: false }], ['opaque complement', { ...validAddress, complemento: {} }],
]) test(`CEP malformed ${label}: no callback, no geocoding, generic error, loading cleared`, async () => {
  const rows = []; let calls = 0;
  const h = cepHarness({ onEnderecoEncontrado: value => rows.push(value) }, async () => { calls++; return { json: async () => payload }; });
  h.render(); h.states[0] = '00000000'; await findButton(h.render()).props.onClick();
  assert.deepEqual(rows, []); assert.equal(calls, 1); assert.equal(h.states[1], false); assert.equal(h.messages.length, 1);
  assert.ok(h.messages[0].includes('Erro ao buscar CEP'));
});
test('CEP not-found response keeps existing not-found message and never geocodes', async () => {
  const rows = []; let calls = 0;
  const h = cepHarness({ onEnderecoEncontrado: value => rows.push(value) }, async () => { calls++; return { json: async () => ({ erro: true }) }; });
  h.render(); h.states[0] = '00000000'; await findButton(h.render()).props.onClick();
  assert.deepEqual(rows, []); assert.equal(calls, 1); assert.equal(h.states[1], false); assert.equal(h.messages.length, 1);
  assert.ok(h.messages[0].includes('CEP não encontrado'));
});

test('actual UI issue logger allows absent metadata, keeps context fields and sanitizes supplied metadata', async () => {
  const sanitizer = load('src/components/lib/sanitizeOnWrite.jsx', {}), rows = [];
  const mod = load(audit, { '@/api/base44Client': { base44: { auth: { me: async () => ({ id: 'synthetic-user' }) }, entities: { AuditLog: { create: row => { rows.push(row); return Promise.resolve(row); } } } } }, sonner: { toast: {} }, '@/components/lib/sanitizeOnWrite': sanitizer }, { localStorage: { getItem: key => key === 'empresa_atual_id' ? 'synthetic-a' : 'synthetic-group' }, window: { location: { pathname: '/synthetic' } }, console: { error() {} } });
  mod.logUIIssue({ component: 'Synthetic', issue: 'Synthetic' });
  mod.logUIIssue({ component: 'Synthetic', issue: 'Synthetic', meta: { token: 'synthetic-secret', safe: 'synthetic' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(rows.length, 2); assert.equal(rows[0].empresa_id, 'synthetic-a'); assert.equal(rows[0].group_id, 'synthetic-group');
  assert.equal(rows[0].dados_novos.meta, null); assert.ok(!JSON.stringify(rows[1].dados_novos.meta).includes('synthetic-secret'));
});

test('actual optional prop contracts compile valid consumers and reject invalid declared values', () => {
  const filename = path.resolve('tests/synthetic-optional-consumers.jsx');
  const lines = [
    "import React from 'react';", "import Card from '../src/components/financeiro/LaunchpadCard';", "import CEP from '../src/components/comercial/BuscaCEP';", "import Header from '../src/components/portal/PortalHeader';", "import {logUIIssue} from '../src/components/lib/uiAudit';",
    "const Icon=()=>null;", "<Card title='Synthetic' description='Synthetic' icon={Icon}/>;", "<CEP onEnderecoEncontrado={()=>{}}/>;", "<Header cliente={{nome:'Synthetic'}}/>;", "logUIIssue({component:'Synthetic',issue:'Synthetic'});",
  ];
  const negatives = [];
  for (const line of ["<Card title='Synthetic' description='Synthetic' icon={Icon} dataPermission={123}/>;", "<Card title='Synthetic' description='Synthetic' icon={Icon} onClick='invalid'/>;", "<CEP onEnderecoEncontrado={()=>{}} enderecoAtual={{cep:123}}/>;", "<Header cliente={{nome:'Synthetic'}} spotlight={{raw:123}}/>;", "logUIIssue({component:123,issue:'Synthetic'});"] ) { negatives.push(lines.length); lines.push(line); }
  const config = { allowJs: true, checkJs: true, noEmit: true, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, baseUrl: process.cwd(), paths: { '@/*': ['./src/*'] } };
  const host = ts.createCompilerHost(config), original = host.readFile; host.readFile = file => path.resolve(file) === filename ? lines.join('\n') : original(file);
  const diagnostics = ts.createProgram([filename], config, host).getSemanticDiagnostics().filter(error => error.file && path.resolve(error.file.fileName) === filename);
  assert.deepEqual(diagnostics.map(error => error.file.getLineAndCharacterOfPosition(error.start).line), negatives, JSON.stringify(diagnostics.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))));
});
