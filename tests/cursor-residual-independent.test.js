import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const parse = (file, source) => ts.createSourceFile(file, source.replace(/\r\n/g, '\n'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const names = ['CentroOperacao', 'TabelaFiscal', 'ParametroOrigemPedido', 'ConfiguracaoNFe'];
// LocalEstoque graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).
function find(tree, predicate) {
  const found = [];
  function visit(node) { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); }
  visit(tree); return found;
}
for (const name of names) test(`${name}: reopen keeps complete default values, handlers, permission gates and mutation callbacks`, () => {
  const file = `src/components/cadastros/${name}Form.jsx`;
  const before = parse(file, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`], { encoding: 'utf8' }));
  const after = parse(file, fs.readFileSync(file, 'utf8'));
  const contracts = tree => find(tree, node => ts.isVariableDeclaration(node)
    && /^(handle|pode|contextoValido|scope|groupId|grupoIdAtual|empresaIdAtual|mutation)/.test(node.name.getText(tree))).map(node => node.getText(tree));
  assert.deepEqual(contracts(after), contracts(before));
  const state = tree => find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === '[formData, setFormData]')[0];
  assert.equal(state(after).initializer.expression.getText(after), 'useCadastroRecordState');
  assert.equal(state(after).initializer.arguments[0].getText(after), state(before).initializer.arguments[0].getText(before));
  const identity = state(after).initializer.arguments[1].getText(after);
  for (const field of ['?.id', '?.updated_date', 'empresaAtual?.id']) assert.ok(identity.includes(field));
  assert.ok(identity.includes('groupId') || identity.includes('grupoAtual?.id'));
  const controls = tree => find(tree, node => ts.isJsxAttribute(node)
    && ['value', 'onChange', 'onValueChange', 'onCheckedChange', 'onClick', 'disabled', 'data-permission', 'data-action'].includes(node.name.getText(tree)))
    .map(node => node.getText(tree));
  assert.deepEqual(controls(after), controls(before));
});

test('LocalEstoque graduou do pin RecordState para useCadastroReopenOnIdentity com localBoundId', () => {
  const file = 'src/components/cadastros/LocalEstoqueForm.jsx';
  const source = fs.readFileSync(file, 'utf8');
  assert.equal(names.includes('LocalEstoque'), false);
  assert.match(source, /useCadastroReopenOnIdentity/);
  assert.match(source, /localBoundId/);
  assert.match(source, /estrutura_fisica/);
  assert.doesNotMatch(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /prevUpdatedRef/);
});

for (const [name, variable, primary] of [['TabelaFiscal', 'tabela', 'tabelaProp'], ['ParametroOrigemPedido', 'parametro', 'parametroProp'], ['ConfiguracaoNFe', 'config', 'configProp']]) {
  test(`${name}: aliases use the same normalized record in every existing permission/save handler`, () => {
    const file = `src/components/cadastros/${name}Form.jsx`, tree = parse(file, fs.readFileSync(file, 'utf8'));
    const declaration = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === variable)[0];
    const names = [primary, 'item', 'data', 'initialData', 'defaultValues'];
    const resolve = values => new Function(...names, `return ${declaration.initializer.getText(tree)}`)(...values);
    for (let index = 0; index < names.length; index++) {
      const record = { id: 'synthetic-' + index }, values = Array(names.length).fill(undefined); values[index] = record;
      assert.equal(resolve(values), record);
      for (let later = index + 1; later < names.length; later++) values[later] = { id: 'ignored-later-alias' };
      assert.equal(resolve(values), record);
    }
    assert.equal(resolve(Array(names.length).fill(undefined)), null);
  });
}

test('V24 formerly optional inputs remain runtime-equivalent while declaring optionality', () => {
  const file = 'src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx';
  const after = parse(file, fs.readFileSync(file, 'utf8'));
  const before = parse(file, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`], { encoding: 'utf8' }));
  const parameter = tree => tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'VisualizadorUniversalEntidadeV24').parameters[0].getText(tree);
  const select = (tree, input) => new Function(parameter(tree), 'return [entityName, columns, pageSizeProp, extraColors];')(input);
  for (const input of [{}, { entityName: undefined, columns: undefined }, { entityName: null, columns: null, pageSize: null, statusColors: null },
    { entityName: 'Cliente', columns: [{ field: 'nome' }], pageSize: 20, statusColors: { Ativo: 'green' } }]) {
    assert.deepEqual(select(after, input), select(before, input));
  }
});
