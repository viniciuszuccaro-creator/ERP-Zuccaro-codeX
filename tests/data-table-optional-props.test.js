import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';

const path = 'src/components/ui/erp/DataTable.jsx';
function signature(source) {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ERPDataTable');
  const parameter = fn.parameters[0];
  const names = parameter.name.elements.map(element => element.name.getText(ast));
  const evaluate = new Function(`return function(${parameter.getText(ast)}) {
    return { ${names.filter(name => name !== 'isRowSelectable').join(',')} };
  };`)();
  const selectable = new Function(`return function(${parameter.getText(ast)}) {
    return isRowSelectable;
  };`)();
  return { evaluate, selectable, body: fn.body.getText(ast) };
}

test('defaults opcionais mantem entradas e corpo de DataTable', () => {
  const before = signature(execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }));
  const after = signature(readFileSync(path, 'utf8'));
  const bulkWiring = "    onBulkDeleteSelected: wrapAudit('ERPDataTable.onBulkDeleteSelected', onBulkDeleteSelected),\n    onBulkExportSelected: wrapAudit('ERPDataTable.onBulkExportSelected', onBulkExportSelected),\n";
  const normalizedBody = after.body.replace(/\r\n/g, '\n');
  assert.equal(normalizedBody.split(bulkWiring).length, 2);
  assert.equal(normalizedBody.replace(bulkWiring, '').replace(
    'onToggleSelectAll, onToggleItem, onBulkDeleteSelected, onBulkExportSelected]);',
    'onToggleSelectAll, onToggleItem]);'), before.body.replace(/\r\n/g, '\n'));
  const callback = () => {};
  for (const props of [{}, { onSortChange: callback, onColumnFiltersChange: callback,
    rowActionsRender: callback, selectedIds: new Set(['A']), permission: 'read' },
  { onSortChange: null, onBulkDeleteSelected: undefined, selectedIds: ['A'] }]) {
    assert.deepEqual(after.evaluate(props), before.evaluate(props));
  }
});

test('predicado padrao recebe linha e preserva predicado do chamador', () => {
  const current = signature(readFileSync(path, 'utf8'));
  const predicate = current.selectable({});
  assert.equal(predicate.length, 1);
  for (const row of [null, undefined, { id: 'A' }, { id: 'B', ativo: false }]) {
    assert.equal(predicate(row), true);
  }
  const custom = row => row.ativo === true;
  assert.equal(current.selectable({ isRowSelectable: custom }), custom);
  assert.equal(custom({ ativo: false }), false);
  assert.equal(custom({ ativo: true }), true);
});

test('selecao aceita Array e Set existentes sem mudar IDs, ordem, identidade ou entrada', () => {
  const source = readFileSync(path, 'utf8');
  const current = signature(source);
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let normalizeExpression, checkedExpression, toggleExpression, auditedExpression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'selectedSet') normalizeExpression = node.initializer.arguments[0].getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'audited') auditedExpression = node.initializer.arguments[0].getText(ast);
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'Checkbox') {
      const attrs = node.attributes.properties;
      const checked = attrs.find(item => item.name?.getText(ast) === 'checked')?.initializer?.expression;
      if (checked?.getText(ast) === 'selectedSet.has(row.id)') {
        checkedExpression = checked.getText(ast);
        toggleExpression = attrs.find(item => item.name?.getText(ast) === 'onCheckedChange').initializer.expression.getText(ast);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(normalizeExpression && checkedExpression && toggleExpression && auditedExpression);
  const ids = ['0007', 0, '0', '00000', '0007'];
  const rendered = [];
  for (const selectedIds of [ids, new Set(ids)]) {
    const snapshot = [...selectedIds];
    assert.equal(current.evaluate({ selectedIds }).selectedIds, selectedIds);
    const selectedSet = new Function('selectedIds', `return (${normalizeExpression})();`)(selectedIds);
    assert.deepEqual([...selectedSet], ['0007', 0, '0', '00000']);
    if (selectedIds instanceof Set) assert.equal(selectedSet, selectedIds);
    const calls = [];
    const markup = [];
    for (const id of ['0007', 0, '0', '00000', 'OTHER']) {
      const row = { id };
      const checked = new Function('selectedSet', 'row', `return (${checkedExpression});`)(selectedSet, row);
      assert.equal(checked, id !== 'OTHER');
      const html = renderToStaticMarkup(React.createElement(CheckboxPrimitive.Root, { checked, 'aria-label': String(id) }));
      assert.match(html, new RegExp(`data-state="${checked ? 'checked' : 'unchecked'}"`));
      markup.push(html);
      new Function('audited', 'row', `return (${toggleExpression});`)({ onToggleItem: value => calls.push(value) }, row)();
    }
    assert.deepEqual(calls, ['0007', 0, '0', '00000', 'OTHER']);
    assert.deepEqual([...selectedIds], snapshot);
    rendered.push(markup);
  }
  assert.deepEqual(rendered[0], rendered[1]);
  const first = current.evaluate({}).selectedIds, second = current.evaluate({}).selectedIds;
  assert.ok(first instanceof Set && second instanceof Set);
  assert.notEqual(first, second);
  assert.equal(first.size, 0);
  const props = current.evaluate({ onBulkDeleteSelected() { throw Error('bulk nao autorizado'); },
    onBulkExportSelected() { throw Error('bulk nao autorizado'); } });
  const audited = new Function('wrapAudit', ...Object.keys(props), `return (${auditedExpression})();`)(
    (_name, callback) => callback, ...Object.values(props));
  assert.equal(audited.onBulkDeleteSelected, props.onBulkDeleteSelected);
  assert.equal(audited.onBulkExportSelected, props.onBulkExportSelected);
});

test('botoes bulk despacham callbacks reais auditados com IDs integrais e propagam falhas', async () => {
  const source = readFileSync(path, 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let auditedExpression, dependencies;
  const clicks = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'audited') {
      auditedExpression = node.initializer.arguments[0].getText(ast);
      dependencies = node.initializer.arguments[1].elements.map(item => item.getText(ast));
    }
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'Button') {
      const click = node.openingElement.attributes.properties.find(item => item.name?.getText(ast) === 'onClick')?.initializer?.expression;
      for (const key of ['onBulkDeleteSelected', 'onBulkExportSelected']) {
        if (click?.getText(ast).includes(`audited.${key}`)) clicks.set(key, click.getText(ast));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(clicks.size, 2);
  const current = signature(source);
  const ids = new Set(['0007', 0, '0', 1, '1']);
  for (const key of clicks.keys()) {
    assert.ok(dependencies.includes(key));
    const calls = [], audit = [];
    const expected = new Error('backend recusou operacao');
    const callback = async values => { calls.push(values); throw expected; };
    const props = current.evaluate({ [key]: callback });
    const wrap = (label, fn) => typeof fn === 'function' ? (...args) => {
      audit.push(label);
      return fn(...args);
    } : undefined;
    const audited = new Function('wrapAudit', ...Object.keys(props), `return (${auditedExpression})();`)(wrap, ...Object.values(props));
    const click = new Function('audited', 'selectedSet', `return (${clicks.get(key)});`)(audited, ids);
    await assert.rejects(click(), error => error === expected);
    assert.deepEqual(calls, [[...ids]]);
    assert.deepEqual(audit, [`ERPDataTable.${key}`]);
    assert.deepEqual([...ids], ['0007', 0, '0', 1, '1']);
    const absentProps = current.evaluate({});
    const absent = new Function('wrapAudit', ...Object.keys(absentProps), `return (${auditedExpression})();`)(wrap, ...Object.values(absentProps));
    assert.equal(absent[key], undefined);
    assert.equal(new Function('audited', 'selectedSet', `return (${clicks.get(key)});`)(absent, ids)(), undefined);
  }
});

test('contrato real de selectedIds aceita ambos produtores e rejeita IDs e recipientes invalidos', () => {
  const source = readFileSync(path, 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ERPDataTable');
  const element = fn.parameters[0].name.elements.find(item => item.name.getText(ast) === 'selectedIds');
  const parameter = `{${element.getText(ast)}}`;
  const name = `${process.cwd().replaceAll('\\', '/')}/tests/datatable-selection.virtual.js`;
  function diagnostics(body) {
    const text = `function consume(${parameter}) { return selectedIds; }\n${body}\nexport {};`;
    const options = { allowJs: true, checkJs: true, noEmit: true, strict: true, skipLibCheck: true, types: [],
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext };
    const host = ts.createCompilerHost(options), get = host.getSourceFile.bind(host);
    host.getSourceFile = (file, lang, ...rest) => file.replaceAll('\\', '/') === name
      ? ts.createSourceFile(file, text, lang, true, ts.ScriptKind.JS) : get(file, lang, ...rest);
    return ts.getPreEmitDiagnostics(ts.createProgram([name], options, host))
      .map(item => ({ code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, ' ') }));
  }
  assert.deepEqual(diagnostics("consume({});consume({selectedIds:['0007',0]});consume({selectedIds:new Set(['0007',0])});"), []);
  for (const body of ['consume({selectedIds:[false]});', 'consume({selectedIds:[{id:7}]});',
    'consume({selectedIds:new Set([false])});', 'consume({selectedIds:{}});']) {
    const errors = diagnostics(body);
    assert.equal(errors.length, 1, JSON.stringify(errors));
    assert.ok([2322, 2739, 2740].includes(errors[0].code), JSON.stringify(errors));
  }
});
