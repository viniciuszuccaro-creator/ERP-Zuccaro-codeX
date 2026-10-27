import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { httpMirrorAnnotationRemainder } from './helpers/httpMirrorAnnotationRemainder.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MASTER_CODE_SPECS } from '../src/api/localCadastroMasterPolicy.js';
import { clienteNavigationRemainder } from './helpers/clienteNavigationRemainder.js';
import { perfilPolicyRemainder, perfilViewerRemainder } from './helpers/perfilGateRemainder.js';

// Coorte ID-only restante (golden e36231b3). Operador/Condicao/MoedaIndice/ContatoB2B
// graduaram para useCadastroReopenOnIdentity — cobertos no teste seguinte.
const forms = ['CadastroFiscal', 'CentroOperacao', 'GrupoEmpresarial', 'Usuario',
  'ConfiguracaoBoletos', 'Webhook'];
const graduatedReopen = {
  OperadorCaixa: 'operadorBoundId',
  CondicaoComercial: 'condicaoBoundId',
  MoedaIndice: 'moedaBoundId',
  ContatoB2B: 'contatoBoundId',
};
const read = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const head = path => execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
const tree = (path, source) => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const emit = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, removeComments: true } }).outputText;
const fieldPath = 'src/components/cadastros/CadastroCodigoRegistroField.jsx';
function field(source) {
  const ast = tree(fieldPath, source);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'CadastroCodigoRegistroField');
  assert.ok(fn);
  return new Function('React', 'Input', 'Label', `${emit(fn.getText(ast).replace('export default ', ''))};return CadastroCodigoRegistroField;`)(
    React, props => React.createElement('input', props), props => React.createElement('label', props));
}
const markup = (component, props) => renderToStaticMarkup(React.createElement(component, props));

test('Cursor ID-only retains literal identity and never fabricates a master code', () => {
  const current = field(read(fieldPath));
  for (const id of ['0007', 0, '0', 'synthetic-uuid-like-id']) {
    const html = markup(current, { idOnly: true, hasId: true, entityId: id, value: 'DO-NOT-USE-AS-ID', action: 'id-tecnico-synthetic' });
    assert.ok(html.includes(`value="${id}"`));
    assert.ok(html.includes('readonly=""') && html.includes('disabled=""'));
    assert.ok(!html.includes('DO-NOT-USE-AS-ID') && !html.includes('Código de registro'));
    assert.equal((html.match(/<input/g) || []).length, 1);
    assert.ok(!html.includes('id-tecnico-id-tecnico-'));
  }
  for (const entityId of [null, undefined, '', ' ']) {
    const html = markup(current, { idOnly: true, hasId: true, entityId, action: 'id-tecnico-synthetic' });
    assert.ok(!html.includes('<input') && !html.includes('Código de registro'));
  }
});

test('legacy MASTER_CODE readonly rendering remains equivalent by default', () => {
  const before = field(head(fieldPath)), after = field(read(fieldPath));
  for (const props of [{ action: 'codigo-registro-synthetic' },
    { action: 'codigo-registro-synthetic', hasId: true, entityId: '0007', value: '000012' },
    { action: 'codigo-registro-synthetic', hasId: true, entityId: 0, value: 0 },
    { action: 'synthetic', hasId: true, entityId: null, value: '' }]) assert.equal(markup(after, props), markup(before, props));
  assert.doesNotMatch(read(fieldPath), /localStorage|sessionStorage|fetch\(|InvokeLLM|createInContext|updateInContext/);
});

test('remaining ID-only additions retain every existing handler context permission and field', () => {
  for (const name of forms) {
    assert.equal(Object.hasOwn(MASTER_CODE_SPECS, name), false, `Master code contract must not be hidden: ${name}`);
    const path = `src/components/cadastros/${name}Form.jsx`, source = read(path), ast = tree(path, source);
    const reopened = ['CadastroFiscal', 'CentroOperacao', 'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'].includes(name);
    const found = { imports: 0, fields: 0, reopenImports: 0, reopenCalls: 0 };
    const transform = context => {
      const visit = node => {
        if (ts.isImportDeclaration(node) && node.importClause?.name?.text === 'useCadastroRecordState') {
          assert.ok(reopened); found.reopenImports++; return undefined;
        }
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useCadastroRecordState') {
          assert.ok(reopened); assert.equal(node.arguments.length, 2); found.reopenCalls++;
          return ts.factory.createCallExpression(ts.factory.createIdentifier('useState'), undefined, [node.arguments[0]]);
        }
        if (ts.isImportDeclaration(node) && node.importClause?.name?.text === 'CadastroCodigoRegistroField') { found.imports++; return undefined; }
        if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'CadastroCodigoRegistroField') {
          const attrs = node.attributes.properties;
          assert.ok(attrs.some(a => a.name?.getText(ast) === 'idOnly' && !a.initializer));
          assert.equal(attrs.find(a => a.name?.getText(ast) === 'entityId').initializer.expression.getText(ast), 'dadosIniciais?.id');
          found.fields++; return undefined;
        }
        return ts.visitEachChild(node, visit, context);
      };
      return root => ts.visitNode(root, visit);
    };
    const transformed = ts.transform(ast, [transform]);
    try {
      assert.deepEqual(found, { imports: 1, fields: 1, reopenImports: Number(reopened), reopenCalls: Number(reopened) }, name);
      let expected = head(path);
      if (name === 'Webhook') {
        for (const [before, after] of [
          ['"w-full bg-indigo-600 hover:bg-indigo-700"', '"w-full bg-sky-600 hover:bg-sky-700"'],
          ['"flex items-center gap-3 p-4 border-b bg-gradient-to-r from-indigo-50 to-indigo-100"', '"flex items-center gap-3 p-4 border-b bg-gradient-to-r from-sky-50 to-sky-100"'],
          ['"w-6 h-6 text-indigo-600"', '"w-6 h-6 text-sky-600"'],
        ]) {
          assert.equal(expected.split(before).length, 2);
          expected = expected.replace(before, after);
        }
      }
      assert.equal(emit(ts.createPrinter().printFile(transformed.transformed[0])), emit(expected), name);
    } finally { transformed.dispose(); }
  }
});

test('OperadorCaixa CondicaoComercial MoedaIndice e ContatoB2B graduaram ID-only → reopen canônico com boundId', () => {
  for (const [name, boundId] of Object.entries(graduatedReopen)) {
    assert.equal(Object.hasOwn(MASTER_CODE_SPECS, name), false, `Master code contract must not be hidden: ${name}`);
    const path = `src/components/cadastros/${name}Form.jsx`;
    const source = read(path);
    const ast = tree(path, source);
    assert.match(source, /useCadastroReopenOnIdentity/);
    assert.match(source, new RegExp(boundId));
    assert.doesNotMatch(source, /prevUpdatedRef/);
    assert.doesNotMatch(source, /useCadastroRecordState/);
    let fields = 0;
    const visit = (node) => {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'CadastroCodigoRegistroField') {
        const attrs = node.attributes.properties;
        assert.ok(attrs.some(a => a.name?.getText(ast) === 'idOnly' && !a.initializer));
        assert.equal(attrs.find(a => a.name?.getText(ast) === 'entityId').initializer.expression.getText(ast), boundId);
        assert.equal(attrs.find(a => a.name?.getText(ast) === 'hasId').initializer.expression.getText(ast), `Boolean(${boundId})`);
        fields++;
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
    assert.equal(fields, 1, name);
  }
});

test('visualizer retains existing contracts after exact alias labels and initial-ID integration hunks', () => {
  const path = 'src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', source = clienteNavigationRemainder(perfilViewerRemainder(read(path))), ast = tree(path, source);
  const aliases = ['cadastroFiscal', 'comissao', 'notaFiscal'];
  const found = { aliases: 0, labels: 0, fallback: 0 };
  const transform = context => {
    const visit = node => {
      if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(ast) === 'FIELD_LABELS')) { found.labels++; return undefined; }
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'FORM_ALIASES') {
        const elements = node.initializer.elements.filter(element => {
          if (ts.isStringLiteral(element) && aliases.includes(element.text)) { found.aliases++; return false; }
          return true;
        });
        const retained = ts.factory.createNodeArray(elements, node.initializer.elements.hasTrailingComma);
        return ts.factory.updateVariableDeclaration(node, node.name, node.exclamationToken, node.type, ts.factory.updateArrayLiteralExpression(node.initializer, retained));
      }
      if (ts.isBinaryExpression(node) && node.left.getText(ast) === 'FIELD_LABELS[c]') { found.fallback++; return node.right; }
      return ts.visitEachChild(node, visit, context);
    };
    return root => ts.visitNode(root, visit);
  };
  const transformed = ts.transform(ast, [transform]);
  try {
    assert.deepEqual(found, { aliases: 3, labels: 1, fallback: 1 });
    const printer = ts.createPrinter();
    assert.equal(emit(printer.printFile(transformed.transformed[0])), emit(printer.printFile(tree(path, head(path)))));
  } finally { transformed.dispose(); }
});

test('operational routes and sensitive infrastructure remain unchanged by this cohort', () => {
  for (const path of ['server/src/app.ts', 'server/src/api/router.ts',
    'src/api/localCadastroMasterPolicy.js']) assert.equal(clienteConferenciaRemainder(path, read(path)), head(path));
  assert.equal(httpMirrorAnnotationRemainder(read('src/api/localBase44Client.js')), head('src/api/localBase44Client.js'));
  const path = 'src/components/cadastros/cadastroEditLoadPolicy.js';
  const annotation = ' * @param {{entityName?: string, expectedId?: string | number,\n'
    + ' * listRow?: Record<string, unknown> | null, fullRecord?: Record<string, unknown> | null,\n'
    + ' * loadError?: unknown}} [options]\n';
  const current = read(path);
  assert.equal(current.split(annotation).length, 2);
  assert.equal(perfilPolicyRemainder(current.replace(annotation, '')), head(path).replace(/\r\n/g, '\n'));
});
