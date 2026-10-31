import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';

test('Marketplace DTO declarations keep exactly the stage16 emitted JavaScript', () => {
  const emitted = ts.transpileModule(fs.readFileSync('src/components/lib/marketplacePedidoPolicy.js', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: true },
  }).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'), '992868b6b13b23bdad813fe3ee9cb73de3e3a3862fd4569bd1a8a7ec0f329c40');
});

test('Marketplace mutation variable typing keeps the complete existing runtime unchanged', () => {
  const file = 'src/components/integracoes/SincronizacaoMarketplaces.jsx';
  const emitted = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, removeComments: true },
  }).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'), '7444f63f5983f952775354a2c020d32c907c22ed90afb13c0cdbe0e0bad4fa60');
});

test('FormWrapper optional props preserve absence, undefined, null and provided values without changing submit ownership', () => {
  const file = 'src/components/common/FormWrapper.jsx';
  const parse = source => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const old = parse(execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`], { encoding: 'utf8' }));
  const next = parse(fs.readFileSync(file, 'utf8'));
  const fn = ast => ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'FormWrapper');
  const extract = ast => new Function(fn(ast).parameters[0].getText(ast), 'return [schema,defaultValues,externalData,onSubmit,children,withContext,formProps];');
  const submit = () => {}, child = () => null, schema = { safeParse: () => ({ success: true }) };
  for (const props of [{ onSubmit: submit, children: child }, { schema: undefined, defaultValues: undefined, externalData: undefined },
    { schema: null, defaultValues: null, externalData: null }, { schema, defaultValues: { synthetic: true }, externalData: { id: 'synthetic' }, onSubmit: submit, children: child, withContext: false, 'data-action': 'synthetic' }]) {
    assert.deepEqual(extract(next)(props), extract(old)(props));
  }
});

test('Marketplace option contracts retain item fields through both SKU branches and reject wrong typed identity/flags', () => {
  const filename = path.resolve('tests/synthetic-marketplace-options.ts');
  const source = `import {resolveSkuMarketplace,assertPedidoExternoOnCreate,assertPedidoMarketplaceOnCreate,assertMarketplaceAtivo,applyStatusExternoMarketplace} from '../src/components/lib/marketplacePedidoPolicy.js';
const missing = resolveSkuMarketplace({descricao:'Synthetic',quantidade:2});
const resolved = resolveSkuMarketplace({sku_externo:'synthetic-sku',descricao:'Synthetic',quantidade:2});
const description: string|undefined = missing.descricao || resolved.descricao;
const rawQuantity: unknown = missing.quantidade;
assertPedidoExternoOnCreate({record:{empresa_id:'synthetic-company',origem:'Shopee',id_externo:'synthetic-order',metadata:{synthetic:true}}});
assertPedidoMarketplaceOnCreate({record:{empresa_id:'synthetic-company',origem_pedido:'Manual'}});
assertMarketplaceAtivo({origem:'Shopee',configs:[{nome:'Shopee',ativo:true}]});
applyStatusExternoMarketplace({pedidoExterno:{id:'synthetic-order'},acao:'cancelar'});
// Negative fixtures follow.
assertPedidoExternoOnCreate({record:{empresa_id:42}});
assertMarketplaceAtivo({origem:false});
resolveSkuMarketplace({produto_id:42});
applyStatusExternoMarketplace({acao:1});`;
  const options = { allowJs: true, checkJs: true, noEmit: true, target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, types: [] };
  const host = ts.createCompilerHost(options), read = host.readFile;
  host.readFile = file => path.resolve(file) === filename ? source : read(file);
  const program = ts.createProgram([filename], options, host);
  const errors = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(errors.filter(error => !error.file || path.resolve(error.file.fileName) !== filename)
    .map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')), []);
  assert.equal(errors.length, 4);
  assert.ok(errors.every(error => error.code === 2322 && error.file.getLineAndCharacterOfPosition(error.start).line >= 10));
  assert.equal(new Set(errors.map(error => error.file.getLineAndCharacterOfPosition(error.start).line)).size, 4);
});

test('FormWrapper accepts the existing optional contracts while still requiring its submit owner and content', () => {
  const filename = path.resolve('tests/synthetic-form-wrapper.tsx');
  const source = `import FormWrapper from '../src/components/common/FormWrapper.jsx';
const uncontrolled = <FormWrapper onSubmit={()=>{}}><span>Synthetic</span></FormWrapper>;
const controlled = <FormWrapper onSubmit={()=>{}} externalData={{synthetic:true}}><span>Synthetic</span></FormWrapper>;
const invalid = <FormWrapper><span>Synthetic</span></FormWrapper>;
const missingContent = <FormWrapper onSubmit={()=>{}}/>;`;
  const options = { allowJs: true, checkJs: false, noEmit: true, jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true, baseUrl: process.cwd(), paths: { '@/*': ['./src/*'] } };
  const host = ts.createCompilerHost(options), read = host.readFile;
  host.readFile = file => path.resolve(file) === filename ? source : read(file);
  const program = ts.createProgram([filename], options, host);
  const errors = program.getSemanticDiagnostics().filter(error => error.file && path.resolve(error.file.fileName) === filename);
  assert.equal(errors.length, 2);
  assert.equal(errors[0].file.getLineAndCharacterOfPosition(errors[0].start).line, 3);
  assert.match(ts.flattenDiagnosticMessageText(errors[0].messageText, '\n'), /onSubmit/);
  assert.equal(errors[1].file.getLineAndCharacterOfPosition(errors[1].start).line, 4);
  assert.match(ts.flattenDiagnosticMessageText(errors[1].messageText, '\n'), /children/);
});
