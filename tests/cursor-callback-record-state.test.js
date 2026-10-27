import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import {iaResponseValidationRemainder} from './helpers/iaResponseValidationRemainder.js';
import {cadastroCodigoRegistroRemainder} from './helpers/cadastroCodigoRegistroRemainder.js';

const names = ['ApiExterna', 'CatalogoWeb', 'ChatbotCanal', 'ChatbotIntent',
  'ConfiguracaoIntegracao', 'ConfiguracaoWhatsApp', 'EventoNotificacao', 'GatewayPagamento',
  'ParametroCaixaDiario', 'ParametroConciliacaoBancaria',
  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao', 'RotaPadrao',
  'TabelaPreco', 'CadastroFiscal',
  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];
// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).
// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.
// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.
// KitProduto graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.
// Filial graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.
// CentroResultado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.
// JobAgendado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.
const parse = (path, text) => ts.createSourceFile(path, text.replace(/\r\n/g, '\n'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
function find(tree, predicate) {
  const found = [];
  function visit(node) { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); }
  visit(tree); return found;
}
const path = 'src/components/cadastros/useCadastroRecordState.js';
const source = fs.readFileSync(path, 'utf8');
const ast = parse(path, source);
const fn = ast.statements.find(ts.isFunctionDeclaration);
const emitted = ts.transpileModule(fn.getText(ast).replace('export default ', ''), {
  compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
}).outputText;
function harness() {
  let state, ref, effects = [];
  const hook = new Function('useCallback', 'useEffect', 'useRef', 'useState', `${emitted}; return useCadastroRecordState;`)(
    callback => callback, callback => effects.push(callback), value => (ref ||= { current: value }),
    value => [state ||= value, update => { state = typeof update === 'function' ? update(state) : update; }]);
  return {
    render(value, identity) { effects = []; return hook(value, identity); },
    flush() { for (const effect of effects) effect(); },
  };
}

test('actual shared hook switches identity before effects, resets new records, preserves dirty state and rejects stale setters', () => {
  const h = harness();
  let [value, setValue] = h.render({ id: 'a', nome: 'A' }, 'a:v1:company-a');
  h.flush(); setValue(previous => ({ ...previous, nome: 'Dirty' }));
  [value, setValue] = h.render({ id: 'a', nome: 'Server unchanged' }, 'a:v1:company-a');
  assert.equal(value.nome, 'Dirty'); h.flush();
  const staleSetter = setValue;
  [value, setValue] = h.render({ id: 'b', nome: 'B' }, 'b:v1:company-a');
  assert.equal(value.id, 'b');
  staleSetter({ id: 'a', nome: 'Late callback' });
  h.flush();
  assert.equal(h.render({ id: 'b' }, 'b:v1:company-a')[0].nome, 'B');
  [value, setValue] = h.render({ id: 'b', nome: 'New version' }, 'b:v2:company-a');
  assert.equal(value.nome, 'New version'); h.flush();
  [value] = h.render({ nome: '', ativo: true }, 'new:company-a');
  assert.deepEqual(value, { nome: '', ativo: true }); h.flush();
  [value, setValue] = h.render({ nome: '', ativo: true }, 'new:company-b');
  setValue({ nome: 'New company' }); h.flush();
  assert.equal(h.render({ nome: '' }, 'new:company-b')[0].nome, 'New company');
});

for (const name of names) test(`${name}: unchanged save, permission, fields and defaults; scoped reopen identity`, () => {
  const file = `src/components/cadastros/${name}Form.jsx`;
  // #353: CodigoField autorizado em RotaPadrao/TabelaPreco — remainder restaura pin e36231b3.
  const after = parse(file, cadastroCodigoRegistroRemainder(file, fs.readFileSync(file, 'utf8')));
  const before = parse(file, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`], { encoding: 'utf8' }));
  const declarations = tree => find(tree, node => ts.isVariableDeclaration(node)
    && /^(handle|buildPayload|pode|contextoValido|groupId|dadosIniciais)/.test(node.name.getText(tree))).map(node => node.getText(tree));
  assert.deepEqual(declarations(after), declarations(before));
  const state = tree => find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === '[formData, setFormData]')[0];
  assert.equal(state(after).initializer.expression.getText(after), 'useCadastroRecordState');
  assert.equal(state(after).initializer.arguments[0].getText(after), state(before).initializer.arguments[0].getText(before));
  const identity = state(after).initializer.arguments[1].getText(after);
  for (const field of ['?.id', '?.updated_date', 'grupoAtual?.id', 'empresaAtual?.id']) assert.ok(identity.includes(field));
  if (name !== 'GrupoEmpresarial') assert.ok(identity.includes('contexto'));
  const fields = tree => find(tree, node => ts.isJsxAttribute(node) && ['value', 'onChange', 'onValueChange', 'onCheckedChange', 'disabled', 'data-permission', 'data-action'].includes(node.name.getText(tree)))
    .map(node => node.getText(tree));
  assert.deepEqual(fields(after), fields(before));
});

test('ContatoB2B graduou do pin RecordState para useCadastroReopenOnIdentity com contatoBoundId', () => {
  const file = 'src/components/cadastros/ContatoB2BForm.jsx';
  const source = fs.readFileSync(file, 'utf8');
  assert.equal(names.includes('ContatoB2B'), false);
  assert.match(source, /useCadastroReopenOnIdentity/);
  assert.match(source, /contatoBoundId/);
  assert.match(source, /preferencias_comunicacao/);
  assert.doesNotMatch(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /prevUpdatedRef/);
});

test('Servico graduou do pin RecordState para useCadastroReopenOnIdentity com servicoBoundId', () => {
  const file = 'src/components/cadastros/ServicoForm.jsx';
  const source = fs.readFileSync(file, 'utf8');
  assert.equal(names.includes('Servico'), false);
  assert.match(source, /useCadastroReopenOnIdentity/);
  assert.match(source, /servicoBoundId/);
  assert.doesNotMatch(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /prevUpdatedRef/);
});

test('TipoFrete graduou do pin RecordState para useCadastroReopenOnIdentity com tipoFreteBoundId', () => {
  const file = 'src/components/cadastros/TipoFreteForm.jsx';
  const source = fs.readFileSync(file, 'utf8');
  assert.equal(names.includes('TipoFrete'), false);
  assert.match(source, /useCadastroReopenOnIdentity/);
  assert.match(source, /tipoFreteBoundId/);
  assert.doesNotMatch(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /prevUpdatedRef/);
});

test('SegmentoCliente graduou do pin RecordState para useCadastroReopenOnIdentity com segmentoBoundId', () => {
  const file = 'src/components/cadastros/SegmentoClienteForm.jsx';
  const source = fs.readFileSync(file, 'utf8');
  assert.equal(names.includes('SegmentoCliente'), false);
  assert.match(source, /useCadastroReopenOnIdentity/);
  assert.match(source, /segmentoBoundId/);
  assert.doesNotMatch(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /prevUpdatedRef/);
});

test('KitProduto graduou do pin RecordState para useCadastroReopenOnIdentity com kitBoundId', () => {
  const file = 'src/components/cadastros/KitProdutoForm.jsx';
  const source = fs.readFileSync(file, 'utf8');
  assert.equal(names.includes('KitProduto'), false);
  assert.match(source, /useCadastroReopenOnIdentity/);
  assert.match(source, /kitBoundId/);
  assert.match(source, /itens_kit/);
  assert.doesNotMatch(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /prevUpdatedRef/);
});

test('Filial graduou do pin RecordState para useCadastroReopenOnIdentity com filialBoundId', () => {
  const file = 'src/components/cadastros/FilialForm.jsx';
  const source = fs.readFileSync(file, 'utf8');
  assert.equal(names.includes('Filial'), false);
  assert.match(source, /useCadastroReopenOnIdentity/);
  assert.match(source, /filialBoundId/);
  assert.match(source, /matriz_id/);
  assert.doesNotMatch(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /prevUpdatedRef/);
});

test('CentroResultado graduou do pin RecordState para useCadastroReopenOnIdentity com centroBoundId', () => {
  const file = 'src/components/cadastros/CentroResultadoForm.jsx';
  const source = fs.readFileSync(file, 'utf8');
  assert.equal(names.includes('CentroResultado'), false);
  assert.match(source, /useCadastroReopenOnIdentity/);
  assert.match(source, /centroBoundId/);
  assert.match(source, /CadastroCodigoRegistroField/);
  assert.doesNotMatch(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /prevUpdatedRef/);
});

test('JobAgendado graduou do pin RecordState para useCadastroReopenOnIdentity com jobBoundId', () => {
  const file = 'src/components/cadastros/JobAgendadoForm.jsx';
  const source = fs.readFileSync(file, 'utf8');
  assert.equal(names.includes('JobAgendado'), false);
  assert.match(source, /useCadastroReopenOnIdentity/);
  assert.match(source, /jobBoundId/);
  assert.match(source, /parametros_execucao/);
  assert.doesNotMatch(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /prevUpdatedRef/);
});

test('Produto keeps the complete initializer and HTTP GET contract; props version cannot overwrite a loaded HTTP draft', () => {
  const file = 'src/components/cadastros/ProdutoFormV22_Completo.jsx';
  const after = parse(file, fs.readFileSync(file, 'utf8'));
  const before = parse(file, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`], { encoding: 'utf8' }));
  const declaration = (tree, name) => find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === name)[0];
  assert.equal(declaration(after, 'initialFormData').initializer.arguments[0].getText(after),
    declaration(before, '[formData, setFormData]').initializer.arguments[0].getText(before));
  const load = tree => find(tree, node => ts.isCallExpression(node) && node.expression.getText(tree) === 'useProdutoHttpEditLoad')[0].getText(tree);
  assert.equal(load(after), load(before));
  const identity = declaration(after, '[formData, setFormData]').initializer.arguments[1].getText(after);
  const key = (produto, produtoHttp) => new Function('produto', 'produtoHttp', 'groupId', 'empresaAtual', `return ${identity}`)(produto, produtoHttp, 'synthetic-group', { id: 'synthetic-company' });
  assert.equal(key({ id: 'a', updated_date: 'v1' }, true), key({ id: 'a', updated_date: 'v2' }, true));
  assert.notEqual(key({ id: 'a', updated_date: 'v1' }, false), key({ id: 'a', updated_date: 'v2' }, false));
  const h = harness();
  let [, setValue] = h.render({ id: 'a', descricao: 'Partial' }, key({ id: 'a' }, true));
  h.flush(); setValue({ id: 'a', descricao: 'Canonical GET' });
  assert.equal(h.render({ id: 'a', descricao: 'Late partial prop' }, key({ id: 'a', updated_date: 'v2' }, true))[0].descricao, 'Canonical GET');
  assert.equal(h.render({ id: 'b', descricao: 'B' }, key({ id: 'b' }, true))[0].id, 'b');
});

test('Colaborador retains legacy-code permission and all save/status/delete handlers', () => {
  const file = 'src/components/rh/ColaboradorForm.jsx';
  const after = parse(file, fs.readFileSync(file, 'utf8'));
  const before = parse(file, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`], { encoding: 'utf8' }));
  const contracts = tree => find(tree, node => ts.isVariableDeclaration(node) && /^(handle|podeEditarCodigoLegado)/.test(node.name.getText(tree))).map(node => node.getText(tree));
  assert.deepEqual(contracts(after), contracts(before));
  const state = tree => find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === '[formData, setFormData]')[0];
  assert.equal(state(after).initializer.arguments[0].getText(after), state(before).initializer.arguments[0].getText(before));
  assert.equal(state(after).initializer.expression.getText(after), 'useCadastroRecordState');
});

for (const file of ['cadastros/EmpresaForm.jsx', 'cadastros/EmpresaFormCompleto.jsx',
  'cadastros/TransportadoraForm.jsx', 'cadastros/ProdutoForm.jsx',
  'comercial/ClienteFormCompleto.jsx', 'cadastros/TabelaPrecoFormCompleto.jsx']) {
  test(`${file}: retained payload owner, validators, complete initializer and permissions`, () => {
    const path = 'src/components/' + file;
    const after = parse(path, iaResponseValidationRemainder(path, fs.readFileSync(path, 'utf8')));
    const before = parse(path, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }));
    const contract = tree => find(tree, node => ts.isVariableDeclaration(node)
      && /^(handle|buildPayload|pode|contextoValido|groupId|saveBlocked|permissao|schema)/.test(node.name.getText(tree)))
      .map(node => node.getText(tree));
    assert.deepEqual(contract(after), contract(before));
    const declarations = (tree, name) => find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === name)[0];
    const oldInitial = declarations(before, '[formData, setFormData]').initializer.arguments[0];
    const newState = declarations(after, '[formData, setFormData]');
    assert.equal(newState.initializer.expression.getText(after), 'useCadastroRecordState');
    if (declarations(after, 'initialFormData')) {
      assert.equal(declarations(after, 'initialFormData').initializer.arguments[0].getText(after), oldInitial.getText(before));
    } else if (ts.isArrowFunction(oldInitial)) {
      assert.equal(newState.initializer.arguments[0].getText(after), oldInitial.body.getText(before));
    } else assert.equal(newState.initializer.arguments[0].getText(after), oldInitial.getText(before));
    const fields = tree => find(tree, node => ts.isJsxAttribute(node) && ['value', 'onChange', 'onValueChange', 'disabled', 'data-permission'].includes(node.name.getText(tree))).map(node => node.getText(tree));
    assert.deepEqual(fields(after), fields(before));
  });
}

test('Cliente RHF actual reset effect changes records, clears transient validation and preserves same-identity edits', () => {
  const path = 'src/components/comercial/ClienteForm.jsx';
  const tree = parse(path, fs.readFileSync(path, 'utf8'));
  const effect = find(tree, node => ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect'
    && node.arguments[0].getText(tree).includes('hydratedIdentity'))[0];
  const hydratedIdentity = { current: 'a:v1:company-a' };
  let value = { nome: 'Dirty' }, valid = true, receita = { nome: 'Old result' };
  const run = (recordIdentity, defaultValues) => new Function('hydratedIdentity', 'recordIdentity', 'defaultValues', 'reset', 'setCpfCnpjValido', 'setDadosReceita', `return (${effect.arguments[0].getText(tree)})();`)(
    hydratedIdentity, recordIdentity, defaultValues, row => { value = row; }, row => { valid = row; }, row => { receita = row; });
  run('a:v1:company-a', { nome: 'Server same' }); assert.equal(value.nome, 'Dirty');
  run('b:v1:company-a', { nome: 'B' }); assert.equal(value.nome, 'B'); assert.equal(valid, false); assert.equal(receita, null);
  run('b:v2:company-a', { nome: 'Version2' }); assert.equal(value.nome, 'Version2');
  run('new:company-a', { nome: '' }); assert.equal(value.nome, '');
  run('new:company-b', { nome: 'New scope' }); assert.equal(value.nome, 'New scope');
  const before = parse(path, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }));
  const submit = ast => find(ast, node => ts.isVariableDeclaration(node) && ['onSubmitForm', 'unifiedSubmit'].includes(node.name.getText(ast))).map(node => node.getText(ast));
  assert.deepEqual(submit(tree), submit(before));
});

test('TabelaPreco complete resets item draft by ID/scope without changing its persistence owner', () => {
  const path = 'src/components/cadastros/TabelaPrecoFormCompleto.jsx';
  const tree = parse(path, fs.readFileSync(path, 'utf8'));
  const state = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === '[itensTabela, setItensTabela]')[0];
  assert.equal(state.initializer.expression.getText(tree), 'useCadastroRecordState');
  assert.equal(state.initializer.arguments[0].getText(tree), '[]');
  const identity = state.initializer.arguments[1].getText(tree);
  assert.ok(identity.includes('tabela?.id') && identity.includes('groupId') && identity.includes('empresaAtual?.id'));
  assert.ok(!identity.includes('updated_date'));
  const h = harness();
  let [, setItems] = h.render([], 'a:company-a'); h.flush(); setItems([{ produto_id: 'synthetic-product' }]);
  assert.equal(h.render([], 'b:company-a')[0].length, 0); h.flush();
  assert.equal(h.render([], 'new:company-b')[0].length, 0);
});

test('Cliente adapters normalize actual aliases with primary precedence and no persistence replacement', () => {
  for (const name of ['ClienteForm', 'ClienteFormCompleto']) {
    const path = `src/components/comercial/${name}.jsx`;
    const tree = parse(path, fs.readFileSync(path, 'utf8'));
    const declaration = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'cliente')[0];
    const names = ['clienteProp', 'item', 'data', 'initialData', name === 'ClienteForm' ? 'defaultValuesProp' : 'defaultValues'];
    const resolve = values => new Function(...names, `return ${declaration.initializer.getText(tree)}`)(...values);
    for (let index = 0; index < names.length; index++) {
      const record = { id: 'synthetic-' + index };
      const values = Array(names.length).fill(undefined); values[index] = record;
      assert.equal(resolve(values), record);
      for (let later = index + 1; later < names.length; later++) values[later] = { id: 'ignored' };
      assert.equal(resolve(values), record);
    }
    assert.equal(resolve(Array(names.length).fill(undefined)), null);
    assert.equal(find(tree, node => ts.isCallExpression(node) && /createInContext|updateInContext/.test(node.expression.getText(tree))).length, 0);
  }
});

test('Empresa reopen without validity metadata clears the previous expiry warning without a certificate fixture', () => {
  const path = 'src/components/cadastros/EmpresaForm.jsx';
  const tree = parse(path, fs.readFileSync(path, 'utf8'));
  const effect = find(tree, node => ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect'
    && node.arguments[0].getText(tree).includes('setAlertaCertificado'))[0];
  let alert = { tipo: 'error' };
  new Function('formData', 'setAlertaCertificado', `return (${effect.arguments[0].getText(tree)})();`)(
    { certificado_digital: {} }, value => { alert = value; });
  assert.equal(alert, null);
});
