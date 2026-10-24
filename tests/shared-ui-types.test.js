import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import {browserFormBoundaryRemainder} from './helpers/browserFormBoundaryRemainder.js';

test('shared component typing retains exactly the existing emitted JavaScript', () => {
  const emit = source => ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, removeComments: true } }).outputText;
  for (const file of ['src/components/ui/progress.jsx', 'src/components/ui/scroll-area.jsx', 'src/components/common/FormWrapper.jsx']) {
    let source = browserFormBoundaryRemainder(file,fs.readFileSync(file, 'utf8').replace(/\r\n/g,'\n'));
    if (file.endsWith('/FormWrapper.jsx')) {
      for (const name of ['schema', 'defaultValues', 'externalData']) {
        const exact = `  ${name} = undefined,`;
        assert.equal(source.split(exact).length, 2);
        source = source.replace(exact, `  ${name},`);
      }
    }
    assert.equal(emit(source), emit(execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`], { encoding: 'utf8' })));
  }
});
test('shared UI props accept native contracts and reject wrong value or orientation', () => {
  const filename = path.resolve('tests/synthetic-ui-props.tsx');
  const source = `import {Progress} from '../src/components/ui/progress';
import {ScrollArea,ScrollBar} from '../src/components/ui/scroll-area';
const good = <ScrollArea className="synthetic" type="auto"><Progress value={12} className="synthetic"/><ScrollBar orientation="horizontal"/></ScrollArea>;
const badValue = <Progress value="not-numeric"/>;
const badOrientation = <ScrollBar orientation="diagonal"/>;`;
  const options = { allowJs: true, checkJs: false, noEmit: true, jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true, baseUrl: process.cwd(), paths: { '@/*': ['./src/*'] } };
  const host = ts.createCompilerHost(options), read = host.readFile;
  host.readFile = file => path.resolve(file) === filename ? source : read(file);
  const program = ts.createProgram([filename], options, host);
  assert.ok(program.getSourceFiles().some(file => path.resolve(file.fileName) === filename));
  const errors = program.getSemanticDiagnostics().filter(d => d.file && path.resolve(d.file.fileName) === filename);
  assert.equal(errors.length, 2);
  for (const error of errors) assert.equal(error.code, 2322);
  assert.ok(errors.every(error => error.file.getLineAndCharacterOfPosition(error.start).line >= 3));
});

test('Pedido FormWrapper callback invokes RHF validation without treating record data as an event', async () => {
  const source = fs.readFileSync('src/components/comercial/PedidoFormCompleto.jsx', 'utf8');
  const ast = ts.createSourceFile('pedido.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let callback;
  function visit(node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === 'FormWrapper') {
      callback = node.attributes.properties.find(prop => prop.name?.getText(ast) === 'onSubmit').initializer.expression.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(callback);
  let validated = 0, submitted = 0;
  const handleSubmit = () => { submitted++; };
  const rhfHandleSubmit = handler => async event => { assert.equal(event, undefined); validated++; await handler(); };
  const onSubmit = new Function('rhfHandleSubmit', 'handleSubmit', `return (${callback});`)(rhfHandleSubmit, handleSubmit);
  await onSubmit({ synthetic: 'record is not a React event' });
  assert.equal(validated, 1); assert.equal(submitted, 1);
});
