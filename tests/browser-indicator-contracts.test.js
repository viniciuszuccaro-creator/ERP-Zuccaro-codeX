import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import {readBoundaryRemainder} from './helpers/readBoundaryRemainder.js';

const files = {
  cache: ['src/components/lib/useIndexedDBCache.jsx', '26d395ddbdc117fcb9d79311412d66b1388a1f41638ba111306eba045824fb0c'],
  modal: ['src/components/lib/WindowModal.jsx', '07f332c08bb465c50b3f4baaf74d93a7edddde99fbcf3597afb457426d069373'],
  driver: ['src/components/mobile/AppEntregasMotorista.jsx', 'ef9273614d17281d675643ab484faee93a78ea762afccdbcca582ab9dd039532'],
  dre: ['src/components/relatorios/DREComparativo.jsx', '7d9cc13ab4c7c13dd4190cfbf9a3b57f9e170f52f6a0219958225a74d8bb7434'],
  export: ['src/components/ui/ExportMenu.jsx', 'ea9ec90fcaddc2b5a461443bd95a288c8ca4627b2bdc7411040ecb4f91f0f3bf'],
  dashboard: ['src/pages/Dashboard.jsx', '5b8ddf19ed369ceb076cd9a80cbc08ae7009eb30fd0a40ffe277135c3f01d00a'],
  quote: ['src/pages/OrcamentoSite.jsx', 'c8a2db58e48fe10416f1b270f48701f36f2ba90124c4ae59094edfb22754525b'],
};
const source = key => fs.readFileSync(files[key][0], 'utf8').replace(/\r\n/g, '\n');
const ast = key => ts.createSourceFile(files[key][0], source(key), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
function nodes(key, predicate) {
  const tree = ast(key), found = [];
  function visit(node) { if (predicate(node, tree)) found.push(node); ts.forEachChild(node, visit); }
  visit(tree); return {tree, found};
}
function variable(key, name) {
  const {tree, found} = nodes(key, node => ts.isVariableDeclaration(node) && node.name.getText() === name);
  assert.equal(found.length, 1, name); return {tree, node: found[0]};
}
function bind(key, name, dependencies) {
  const {tree, node} = variable(key, name);
  return new Function(...Object.keys(dependencies), `return (${node.initializer.getText(tree)});`)(...Object.values(dependencies));
}
function replaceExact(text, after, before, count = 1) {
  assert.equal(text.split(after).length - 1, count, after);
  return text.split(after).join(before);
}
for (const [key, [,hash]] of Object.entries(files)) test(`${key}: only enumerated browser boundary edits; all other executable code unchanged`, () => {
  let text = readBoundaryRemainder(files[key][0], source(key));
  if (key === 'cache') {
    text = replaceExact(text, 'req.onupgradeneeded = () => {\n      const db = req.result;', 'req.onupgradeneeded = (e) => {\n      const db = e.target.result;');
    text = replaceExact(text, 'req.onsuccess = () => { _db = req.result; resolve(_db); };', 'req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };');
  }
  if (key === 'modal') text = replaceExact(text, "e.target instanceof Element && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)", "['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)");
  if (key === 'driver') {
    text = replaceExact(text, 'useState(/** @returns {false | number} */ () => false)', 'useState(false)');
    text = replaceExact(text, "if (!(canvas instanceof HTMLCanvasElement)) return;\n    const ctx = canvas.getContext('2d');\n    if (!ctx) return;", "if (!canvas) return;\n    const ctx = canvas.getContext('2d');");
    text = replaceExact(text, "('connection' in navigator && navigator.connection && typeof navigator.connection === 'object' && 'effectiveType' in navigator.connection && typeof navigator.connection.effectiveType === 'string' && navigator.connection.effectiveType) || '4G'", "navigator.connection?.effectiveType || '4G'");
    text = replaceExact(text, 'input.files?.[0]', 'e.target.files[0]');
    text = replaceExact(text, "if (canvas && !(canvas instanceof HTMLCanvasElement)) throw new Error('Elemento de assinatura invalido.');\n      if (canvas instanceof HTMLCanvasElement) assinatura = canvas.toDataURL('image/png');", "if (canvas) assinatura = canvas.toDataURL('image/png');");
    text = replaceExact(text, "                  if (!(canvas instanceof HTMLCanvasElement)) return;\n", '');
    text = replaceExact(text, "                  if (!ctx) return;\n", '');
  }
  if (key === 'dashboard') {
    let count = 0;
    text = text.replace(/Number\((otd|aproveitamentoBarra|taxaInadimplencia)\)(?= (?:>=|<) \d)/g, (_, value) => { count++; return value; });
    assert.equal(count, 12);
  }
  if (key === 'quote') text = replaceExact(text, '                              if (!(qtyInput instanceof HTMLInputElement)) return;\n', '');
  const emitted = ts.transpileModule(text, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React, removeComments: true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'), hash);
});

test('IndexedDB upgrade/success use the owned request, not a foreign event target; open failure rejects', async () => {
  const tree = ast('cache');
  const fn = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'openDB');
  for (const fail of [false, true]) {
    const calls = [], db = {objectStoreNames: {contains: () => false}, createObjectStore: (...args) => {calls.push(args); return {createIndex: (...index) => calls.push(index)};}};
    const req = {result: db, error: new Error('synthetic open failure')};
    const open = new Function('indexedDB', `let _db=null; const DB_NAME='synthetic', DB_VERSION=1, STORE_NAME='query_cache'; ${fn.getText(tree)}; return openDB;`)({open: () => req});
    const result = open();
    if (fail) { req.onerror(); await assert.rejects(result, /synthetic open failure/); }
    else { req.onupgradeneeded({target: {result: null}}); req.onsuccess({target: null}); assert.equal(await result, db); assert.equal(await open(), db); assert.equal(calls.length, 2); }
  }
});

class SyntheticCanvas {
  constructor(context = {}) { this.context = context; this.handlers = new Map(); this.width = 600; this.height = 150; }
  getContext() { return this.context; }
  toDataURL() { return 'data:image/png;synthetic-signature'; }
  getBoundingClientRect() { return {left: 10, top: 20}; }
  addEventListener(name, fn) { this.handlers.set(name, fn); }
  removeEventListener(name, fn) { assert.equal(this.handlers.get(name), fn); this.handlers.delete(name); }
}
function signatureEffect(canvas, values) {
  const {tree, found} = nodes('driver', node => ts.isCallExpression(node) && node.expression.getText() === 'React.useEffect' && node.arguments[0]?.getText().includes("getElementById('assinatura-canvas')"));
  assert.equal(found.length, 1);
  return new Function('document', 'HTMLCanvasElement', 'setAssinaturaBase64', 'console', 'toast', `return (${found[0].arguments[0].getText(tree)})();`)(
    {getElementById: () => canvas}, SyntheticCanvas, value => values.push(value), {error: () => {}}, {error: () => values.push('error')});
}
test('signature effect rejects missing/wrong canvas or unavailable 2D context and cleans all six listeners', () => {
  for (const canvas of [null, {}, new SyntheticCanvas(null)]) assert.equal(signatureEffect(canvas, []), undefined);
  const strokes = [], values = [], canvas = new SyntheticCanvas({beginPath() {}, moveTo(...p) {strokes.push(p);}, lineTo(...p) {strokes.push(p);}, stroke() {}});
  const cleanup = signatureEffect(canvas, values); assert.equal(canvas.handlers.size, 6);
  canvas.handlers.get('mousedown')({offsetX: 1, offsetY: 2});
  canvas.handlers.get('mousemove')({offsetX: 3, offsetY: 4, preventDefault() {}});
  canvas.handlers.get('mouseup')(); assert.deepEqual(strokes, [[1,2],[3,4]]); assert.deepEqual(values, ['data:image/png;synthetic-signature']);
  cleanup(); assert.equal(canvas.handlers.size, 0);
});
test('preparing signature preserves the previous value if absent and blocks wrong canvas or encoder failure', () => {
  const {tree, node} = variable('driver', 'confirmarEntrega');
  const prelude = node.initializer.body.statements.slice(0, 2).map(n => n.getText(tree)).join('\n');
  for (const [canvas, expected, errors] of [[null, 'synthetic-previous', 0], [{}, undefined, 1], [new SyntheticCanvas(), 'data:image/png;synthetic-signature', 0], [{...new SyntheticCanvas()}, undefined, 1]]) {
    const notices = [];
    const result = new Function('document', 'HTMLCanvasElement', 'assinaturaBase64', 'console', 'toast', `${prelude}\nreturn assinatura;`)(
      {getElementById: () => canvas}, SyntheticCanvas, 'synthetic-previous', {error() {}}, {error: () => notices.push('error')});
    assert.equal(result, expected); assert.equal(notices.length, errors);
  }
});
test('GPS accepts the numeric browser watch ID, keeps current scoped payload and never invokes real geolocation', () => {
  for (const connection of [undefined, {}, {effectiveType: 'wifi'}, {effectiveType: 123}]) {
    const watches = [], rows = [], notices = [];
    const navigator = {geolocation: {watchPosition: success => {success({coords: {latitude: 1, longitude: 2, accuracy: 3, speed: 0}}); return 12;}}, ...(connection === undefined ? {} : {connection})};
    bind('driver', 'iniciarRastreamento', {navigator, setLocalizacao() {}, entregaAtual: {id: 'synthetic-delivery', empresa_id: 'synthetic-company'}, contextoValido: true,
      base44: {entities: {PosicaoVeiculo: {create: async row => rows.push(row)}}}, groupId: 'synthetic-group', empresaId: 'synthetic-company', user: {id: 'synthetic-user'},
      setRastreando: id => watches.push(id), toast: {success() {}, error: value => notices.push(value)}, console: {error() {}}})();
    assert.deepEqual(watches, [12]); assert.equal(rows[0].empresa_id, 'synthetic-company'); assert.equal(rows[0].group_id, 'synthetic-group');
    assert.equal(rows[0].conectividade, connection?.effectiveType === 'wifi' ? 'wifi' : '4G'); assert.deepEqual(notices, []);
  }
  const errors = []; bind('driver', 'iniciarRastreamento', {navigator: {}, toast: {error: value => errors.push(value)}})(); assert.equal(errors.length, 1);
});
test('indicator threshold conversions preserve all twelve expressions at numeric strings, zeros and invalid values', () => {
  const {tree, node} = variable('dashboard', 'kpisOperacionais');
  let count = 0;
  function visit(n) {
    if (ts.isBinaryExpression(n) && ts.isCallExpression(n.left) && n.left.expression.getText() === 'Number') {
      count++; const current = n.getText(tree), previous = current.replace(/Number\((\w+)\)/, '$1');
      for (const value of [0, 1, 4.99, 5, 9.99, 10, 69.99, 70, 79.99, 80, 89.99, 90, 100, '0', '5.0', '70.0', '90.0', 'NaN', 'Infinity']) {
        const deps = {otd: value, aproveitamentoBarra: value, taxaInadimplencia: value};
        const evaluate = text => new Function(...Object.keys(deps), `return ${text};`)(...Object.values(deps));
        assert.equal(evaluate(current), evaluate(previous));
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(node.initializer); assert.equal(count, 12);
});
test('export guard still denies permission/context/empty data/cancellation and awaits optional veto callback', async () => {
  const scenarios = [
    {blocked: true, safeData: [{}], expected: false, auditCount: 1},
    {blocked: false, safeData: [], expected: false, auditCount: 0},
    {blocked: false, safeData: [{}], confirm: false, expected: false, auditCount: 1},
    {blocked: false, safeData: [{}], onBeforeExport: async () => false, expected: false, auditCount: 0},
    {blocked: false, safeData: [{}], onBeforeExport: async () => true, expected: true, auditCount: 0},
    {blocked: false, safeData: [{}], confirm: true, expected: true, auditCount: 0},
  ];
  for (const scenario of scenarios) {
    const audits = [];
    const fn = bind('export', 'ensureCanExport', {blocked: scenario.blocked, safeData: scenario.safeData, section: 'Synthetic', title: 'Synthetic', audit: async row => audits.push(row),
      alert() {}, onBeforeExport: scenario.onBeforeExport, window: {confirm: () => scenario.confirm}});
    assert.equal(await fn('CSV'), scenario.expected); assert.equal(audits.length, scenario.auditCount);
  }
});

test('photo callback reads only its owned input, handles cancel and awaits a synthetic upload', async () => {
  const uploads = [], photos = [], file = new Blob(['synthetic image'], {type: 'image/png'});
  const input = {files: [], click() {}};
  const capture = bind('driver', 'tirarFoto', {document: {createElement: () => input}, navigator: {onLine: true},
    base44: {integrations: {Core: {UploadFile: async payload => {uploads.push(payload); return {file_url: 'synthetic-local-result'};}}}},
    setFotoComprovante: value => photos.push(value), toast: {success() {}, error() {}}});
  await capture(); await input.onchange({target: {files: [file]}}); assert.deepEqual(uploads, []);
  input.files = [file]; await input.onchange({target: null});
  assert.equal(uploads.length, 1); assert.equal(uploads[0].file, file); assert.deepEqual(photos, ['synthetic-local-result']);
});
test('window activation recognizes interactive Elements but not text/non-Elements', () => {
  const {tree, node} = variable('modal', 'isInteractiveElement');
  class Element { constructor(tagName) { this.tagName = tagName; } }
  const expression = new Function('e', 'Element', `return ${node.initializer.getText(tree)};`);
  for (const tag of ['INPUT','TEXTAREA','SELECT','BUTTON']) assert.equal(expression({target: new Element(tag)}, Element), true);
  for (const target of [null, {}, {tagName: 'INPUT'}, new Element('DIV')]) assert.equal(expression({target}, Element), false);
});
test('quote quantity guard does not add an item when the expected numeric input is absent or wrong', () => {
  const {tree, found} = nodes('quote', node => ts.isArrowFunction(node) && ts.isBlock(node.body) && node.body.getText().includes('const qtyInput =') && node.parameters[0]?.name.getText() === 'e');
  assert.equal(found.length, 1);
  class HTMLInputElement { constructor(value, q) { this.value = value; this.dataset = {q}; } }
  for (const [input, expected] of [[null, undefined], [{value: '2'}, undefined], [new HTMLInputElement('3'), 3], [new HTMLInputElement('3', '4'), 4]]) {
    const added = [];
    new Function('HTMLInputElement', 'addToCart', 'p', 'preco', 'isProdutoDisponivelSite', 'toast', `return (${found[0].getText(tree)});`)(
      HTMLInputElement, (product, qty) => added.push(qty), {id: 'synthetic-product'}, 1, () => true, {success() {}})({currentTarget: {parentElement: {querySelector: () => input}}});
    assert.deepEqual(added, expected === undefined ? [] : [expected]);
  }
});
test('actual export props accept optional callbacks and only the existing export action; no permission selector', () => {
  const tree = ast('export'), fn = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ExportMenu');
  const docs = fn.jsDoc.map(doc => doc.getText(tree)).join('\n');
  const fixture = `${docs}\nfunction menu(${fn.parameters.map(p => p.getText(tree)).join(',')}) {}\n` +
    `menu({data: [], action: 'exportar'});\nmenu({data: [], onBeforeExport: async event => event.quantidade > 0, onExport: async event => { String(event.formato); }});\n` +
    `menu({data: [], action: 'pagar'});\nmenu({data: [], onBeforeExport: event => 'invalid'});\n`;
  const filename = path.resolve('tests/synthetic-export-contract.js');
  const options = {allowJs: true, checkJs: true, noEmit: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true};
  const host = ts.createCompilerHost(options), read = host.readFile; host.readFile = file => path.resolve(file) === filename ? fixture : read(file);
  const errors = ts.createProgram([filename], options, host).getSemanticDiagnostics().filter(e => e.file && path.resolve(e.file.fileName) === filename);
  assert.equal(errors.length, 2, errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n'));
  assert.ok(errors.every(e => e.file.text.slice(e.file.getPositionOfLineAndCharacter(e.file.getLineAndCharacterOfPosition(e.start).line, 0)).startsWith('menu({data: [], action: \'pagar\'});') ||
    e.file.text.slice(e.file.getPositionOfLineAndCharacter(e.file.getLineAndCharacterOfPosition(e.start).line, 0)).startsWith("menu({data: [], onBeforeExport: event => 'invalid'});")));
});
