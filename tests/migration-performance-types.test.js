import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

const hashes = {
  'src/components/lib/migracaoErpPolicy.js': '64051fe4d61ddb63999116d4391e5737385c9c60793448e85cefac09d7c7df89',
  'src/components/lib/usePerformanceMonitor.jsx': '646134205684929d7958141e69bbb9e15df522428389c06b8566d739adc2ff3e',
};
for (const [file, expected] of Object.entries(hashes)) test(`${file}: complete emitted runtime unchanged by annotations`, () => {
  const emitted = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true,jsx:ts.JsxEmit.Preserve},
  }).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'), expected);
});

function compileVirtual(filename, source) {
  const options = {allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,
    module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,types:[]};
  const host = ts.createCompilerHost(options), read = host.readFile;
  host.readFile = file => path.resolve(file) === filename ? source : read(file);
  return ts.getPreEmitDiagnostics(ts.createProgram([filename],options,host));
}

test('migration producer reports and explicit entity names retain typed contracts', () => {
  const filename = path.resolve('tests/synthetic-migration-types.ts');
  const source = `import {buildReconciliacaoMigracao,assertReconciliacaoMigracao,applyMigracaoOnCreate} from '../src/components/lib/migracaoErpPolicy.js';
assertReconciliacaoMigracao(buildReconciliacaoMigracao({origem:[],gravados:[],reusos:[]}));
assertReconciliacaoMigracao({});
applyMigracaoOnCreate({entityName:'Cliente',record:{group_id:'synthetic-group'},records:[]});
assertReconciliacaoMigracao({quantidade_origem:[]});
assertReconciliacaoMigracao({amostra:'invalid'});
applyMigracaoOnCreate({entityName:123});
applyMigracaoOnCreate({records:'invalid'});`;
  const errors = compileVirtual(filename,source);
  assert.deepEqual(errors.map(error => ({file:path.resolve(error.file?.fileName || ''),code:error.code,
    line:error.file?.getLineAndCharacterOfPosition(error.start).line})),
  [4,5,6,7].map(line => ({file:filename,code:2322,line})));
});

function performanceFunctionSource() {
  const file = 'src/components/lib/usePerformanceMonitor.jsx';
  const ast = ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
  const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === 'measurePerformance');
  assert.equal(declarations.length,1);
  return declarations[0].getFullText(ast);
}

test('performance contracts preserve generic results and numeric threshold without loading external services', () => {
  const filename = path.resolve('tests/synthetic-performance-types.js');
  const source = `/** @param {Record<string, unknown>} data */
function reportPerformance(data) { return Promise.resolve(data); }
${performanceFunctionSource()}
async function check() {
  const asyncResult = await measurePerformance(async () => ({synthetic:true}), {threshold_ms:10,modulo:'synthetic'});
  asyncResult.synthetic;
  const syncResult = await measurePerformance(() => 7);
  syncResult.toFixed();
  await measurePerformance(() => 7, {threshold_ms:'invalid'});
  asyncResult.missingProperty;
}`;
  const errors = compileVirtual(filename,source);
  assert.equal(errors.length,2);
  assert.deepEqual(errors.map(error => error.code),[2322,2339]);
  assert.ok(errors.every(error => path.resolve(error.file.fileName) === filename));
  assert.ok(errors[0].file.text.slice(errors[0].start,errors[0].start+errors[0].length).includes('threshold_ms'));
  assert.ok(errors[1].file.text.slice(errors[1].start,errors[1].start+errors[1].length).includes('missingProperty'));
});

function syntheticMonitor(duration) {
  const exports = {}, reports = [], times = [0,duration];
  const emitted = ts.transpileModule(performanceFunctionSource(), {
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,removeComments:true},
  }).outputText;
  new Function('exports','performance','reportPerformance',emitted)(exports,
    {now:() => times.shift()}, data => { reports.push(data); return Promise.resolve(); });
  return {measure:exports.measurePerformance,reports};
}

test('actual measurement preserves results, threshold branches, metadata and rejected errors', async () => {
  for (const threshold of [undefined,0,10,100]) {
    const {measure,reports} = syntheticMonitor(50);
    const result = {synthetic:true};
    assert.equal(await measure(() => result,{threshold_ms:threshold,modulo:'synthetic'}),result);
    assert.equal(reports.length,1);
    const [report] = reports;
    assert.equal(report.duracao_ms,50);
    assert.equal(report.modulo,'synthetic');
    assert.equal(report.erro,false);
    assert.equal(report.lento,threshold ? 50>threshold : undefined);
    assert.equal(report.percentual_acima_threshold,threshold ? (50>threshold ? (50-threshold)/threshold*100 : 0) : undefined);
  }
  const {measure,reports} = syntheticMonitor(20);
  const failure = new Error('synthetic failure');
  await assert.rejects(measure(async () => {throw failure;},{threshold_ms:10}), error => error === failure);
  assert.equal(reports.length,1);
  assert.equal(reports[0].erro,true);
  assert.equal(reports[0].erro_mensagem,'synthetic failure');
});
