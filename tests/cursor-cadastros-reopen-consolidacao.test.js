import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const cases = [
  ['RepresentanteForm', 'dadosIniciais'], ['FormaPagamentoForm', 'dadosIniciais'],
  ['RepresentanteFormCompleto', 'representante'], ['FormaPagamentoFormCompleto', 'formaPagamentoNorm'],
  ['CadastroClienteCompleto', 'cliente'], ['CadastroFornecedorCompleto', 'fornecedor'],
];
function parse(file, source) { return ts.createSourceFile(file, source.replace(/\r\n/g, '\n'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX); }
function nodes(tree, predicate) {
  const found = [];
  function visit(node) { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); }
  visit(tree); return found;
}
for (const [name, recordKey] of cases) test(`actual ${name} effect hydrates A-B and preserves dirty data on identical identity`, () => {
  const file = `src/components/cadastros/${name}.jsx`, source = fs.readFileSync(file, 'utf8'), ast = parse(file, source);
  const effect = nodes(ast, node => ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
    && node.arguments[0].getText(ast).includes('prevIdRef'))[0];
  assert.ok(effect);
  let formData = { id: 'synthetic-a', nome: 'Dirty value' };
  const bindings = {
    prevIdRef: { current: 'synthetic-a' }, prevUpdatedRef: { current: 'version-a' },
    setFormData: value => { formData = value; }, emptyFormData: { nome: '' },
    empresaAtual: { id: 'synthetic-company' }, groupId: 'synthetic-group',
  };
  const run = record => {
    const env = { ...bindings, [recordKey]: record };
    new Function(...Object.keys(env), `return (${effect.arguments[0].getText(ast)})();`)(...Object.values(env));
  };
  run({ id: 'synthetic-a', nome: 'Do not overwrite dirty', updated_date: 'version-a' });
  assert.equal(formData.nome, 'Dirty value');
  run({ id: 'synthetic-b', nome: 'Second', updated_date: 'version-b' });
  assert.equal(formData.nome, 'Second');
  run({ id: 'synthetic-b', nome: 'Again same ID', updated_date: 'version-b' });
  assert.equal(formData.nome, 'Second');
  if (['cliente', 'fornecedor'].includes(recordKey)) {
    run({ id: 'synthetic-b', nome: 'New server version', updated_date: 'version-c' });
    assert.equal(formData.nome, 'New server version');
    run(null); assert.equal(formData.nome, '');
    assert.equal(formData.group_id, 'synthetic-group');
  } else if (recordKey === 'dadosIniciais') {
    run(null); assert.equal(formData.nome, '');
  }
});

test('legacy adapters retain all submit handlers, field contracts and permission predicates', () => {
  for (const name of ['RepresentanteForm', 'FormaPagamentoForm']) {
    const file = `src/components/cadastros/${name}.jsx`;
    const before = parse(file, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`], { encoding: 'utf8' }));
    const after = parse(file, fs.readFileSync(file, 'utf8'));
    const contract = tree => nodes(tree, node => ts.isVariableDeclaration(node)
      && /^(handle|buildPayload|pode|contextoValido|groupId)/.test(node.name.getText(tree)))
      .map(node => node.getText(tree));
    assert.deepEqual(contract(after), contract(before), name);
    const stateBefore = nodes(before, node => ts.isVariableDeclaration(node) && node.name.getText(before) === '[formData, setFormData]')[0];
    const defaults = nodes(after, node => ts.isVariableDeclaration(node) && node.name.getText(after) === 'emptyFormData')[0];
    assert.equal(defaults.initializer.getText(after), stateBefore.initializer.arguments[0].right.getText(before));
  }
});
