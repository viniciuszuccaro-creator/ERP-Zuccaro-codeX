import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

const cases = [
  ['src/components/financeiro/GeradorLinkPagamento.jsx',
    `/** @param {{titulo?: {id?: string, group_id?: string, grupo_id?: string, empresa_id?: string,
 * valor_total?: number | string, valor?: number | string, cliente_nome?: string, cliente?: string,
 * cliente_id?: string, cliente_cpf_cnpj?: string, numero_titulo?: string, numero_documento?: string},
 * pedido?: {id?: string, group_id?: string, grupo_id?: string, empresa_id?: string,
 * valor_total?: number | string, valor?: number | string, cliente_nome?: string, cliente?: string,
 * cliente_id?: string, cliente_cpf_cnpj?: string}, onClose: () => void}} props */
`, '97395a9375441041674b8e9ea713d8a3fdfb169e7bee7dd22caddc00ad4fb0fe'],
  ['src/components/sistema/DashboardPerformance.jsx',
    ' * @param {{empresaId?: string, grupoId?: string}} props\n',
    'ed354a83810671a424727d2a76ac9a00bdb75075b06d67180aa2a62cc7a0e9df'],
];
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React, removeComments: true };
function before(source, annotation) {
  assert.equal(source.split(annotation).length, 2, 'one exact annotation');
  return source.replace(annotation, '');
}
for (const [file, annotation, expected] of cases) {
  test(`${file}: complete previous source and executable behavior unchanged`, () => {
    const source = read(file), previous = before(source, annotation);
    assert.equal(hash(previous), expected);
    assert.equal(ts.transpileModule(source, { compilerOptions: options }).outputText,
      ts.transpileModule(previous, { compilerOptions: options }).outputText);
  });
  test(`${file}: invariant rejects missing, duplicate and unrelated edits`, () => {
    const source = read(file);
    assert.throws(() => before(source.replace(annotation, ''), annotation));
    assert.throws(() => before(source.replace(annotation, annotation + annotation), annotation));
    assert.notEqual(hash(before('// unintended\n' + source, annotation)), expected);
  });
}

test('actual optional context/origin props accept existing callers and reject wrong identity, amount and callback types', () => {
  const filename = path.resolve('tests/synthetic-optional-context.jsx');
  const lines = [
    "import React from 'react';",
    "import Link from '../src/components/financeiro/GeradorLinkPagamento';",
    "import Performance from '../src/components/sistema/DashboardPerformance';",
    '<Performance/>;',
    "<Performance empresaId='synthetic-a' grupoId='synthetic-group'/>;",
    "<Link titulo={{id:'synthetic-title',valor_total:'12.34'}} onClose={()=>{}}/>;",
    "<Link pedido={{id:'synthetic-order',valor:12.34}} onClose={()=>{}}/>;",
  ];
  const negatives = [];
  for (const line of [
    '<Performance empresaId={123}/>;', '<Performance grupoId={{id:123}}/>;',
    '<Link titulo={{id:123}} onClose={()=>{}}/>;',
    '<Link pedido={{valor:true}} onClose={()=>{}}/>;', '<Link onClose="invalid"/>;',
  ]) { negatives.push(lines.length); lines.push(line); }
  const config = { allowJs: true, checkJs: true, noEmit: true, jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true,
    baseUrl: process.cwd(), paths: { '@/*': ['./src/*'] } };
  const host = ts.createCompilerHost(config), original = host.readFile;
  host.readFile = file => path.resolve(file) === filename ? lines.join('\n') : original(file);
  const diagnostics = ts.createProgram([filename], config, host).getSemanticDiagnostics()
    .filter(error => error.file && path.resolve(error.file.fileName) === filename);
  assert.deepEqual(diagnostics.map(error => error.file.getLineAndCharacterOfPosition(error.start).line), negatives,
    JSON.stringify(diagnostics.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))));
});
