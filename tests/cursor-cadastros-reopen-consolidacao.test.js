import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

// Coorte ainda em prevIdRef (não graduada neste lote).
const prevIdCases = [
  ['RepresentanteForm', 'dadosIniciais'],
  ['RepresentanteFormCompleto', 'representante'],
  ['CadastroClienteCompleto', 'cliente'],
  ['CadastroFornecedorCompleto', 'fornecedor'],
];
// Graduados para useCadastroRecordState (Pacote D FormaPagamento).
const recordStateCases = [
  ['FormaPagamentoForm', 'dadosIniciais'],
  ['FormaPagamentoFormCompleto', 'formaPagamentoNorm'],
];
function parse(file, source) { return ts.createSourceFile(file, source.replace(/\r\n/g, '\n'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX); }
function nodes(tree, predicate) {
  const found = [];
  function visit(node) { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); }
  visit(tree); return found;
}
for (const [name, recordKey] of prevIdCases) test(`actual ${name} effect hydrates A-B and preserves dirty data on identical identity`, () => {
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

for (const [name] of recordStateCases) test(`actual ${name} graduated to useCadastroRecordState (no prevIdRef wipe)`, () => {
  const file = `src/components/cadastros/${name}.jsx`;
  const source = fs.readFileSync(file, 'utf8');
  const ast = parse(file, source);
  assert.doesNotMatch(source, /prevIdRef/);
  const call = nodes(ast, node => ts.isCallExpression(node) && node.expression.getText(ast) === 'useCadastroRecordState')[0];
  assert.ok(call, `${name} must call useCadastroRecordState`);
  assert.equal(call.arguments.length, 2);
  // Identity pode ser literal ou const recordIdentity — ambos cobrem updated_date+escopo.
  assert.match(source, /recordIdentity[\s\S]*updated_date|updated_date[\s\S]*useCadastroRecordState/);
  assert.match(source, /recordIdentity[\s\S]*groupId|groupId[\s\S]*useCadastroRecordState/);
  assert.match(source, /empresaAtual/);
  assert.match(source, /from-sky-50/);
  assert.match(source, /ID técnico/);
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
