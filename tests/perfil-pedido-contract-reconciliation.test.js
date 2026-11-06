import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { getCadastroEntityPermissionKey, hasCadastroEntityPermission } from '../src/components/cadastros/cadastroEditLoadPolicy.js';
import { isTenantMasterEntity, assertCadastroFormScopeCurrent } from '../src/components/lib/contextoMultiempresaPolicy.js';
import { pedidoLegacyStatusLabel, matchesPedidoLegacyStatusFilter, isPedidoLegacyProducaoSobMedida,
  PEDIDO_STATUS_LABELS, nextPedidoStatus, canUsePedidoAction, evaluatePedidoStatusTransitionUiGate } from '../src/components/comercial/pedidoUiPolicy.js';

function parse(path) { return ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX); }
function variables(ast) {
  const result = new Map();
  function visit(node) { if (ts.isVariableDeclaration(node)) result.set(node.name.getText(ast), node.initializer); ts.forEachChild(node, visit); }
  visit(ast); return result;
}
function evaluate(expression, bindings) {
  return new Function(...Object.keys(bindings), `return (${expression});`)(...Object.values(bindings));
}
function checkers(module, section, allowed) {
  const permits = (m, s, a) => m === module && s === section && a === allowed;
  return { hasPermission: permits, canCreate: (m, s) => permits(m, s, 'criar'),
    canEdit: (m, s) => permits(m, s, 'editar'), canDelete: (m, s) => permits(m, s, 'excluir') };
}
test('Perfil host uses the backend owner and exact actions; generic Cadastros/admin/read do not grant writes', () => {
  const backend = parse('src/api/localBase44Client.js');
  const owners = evaluate(variables(backend).get('ENTITY_PERMISSION_SCOPE').getText(backend), {});
  assert.deepEqual(owners.PerfilAcesso, { module: 'Sistema', section: 'Controle de Acesso' });
  for (const action of ['visualizar', 'criar', 'editar', 'excluir']) {
    const owner = checkers('Sistema', 'Controle de Acesso', action);
    assert.equal(hasCadastroEntityPermission('PerfilAcesso', action, owner), true);
    assert.equal(hasCadastroEntityPermission('PerfilAcesso', action, { ...owner, isLoading: true }), false);
    for (const section of [null, 'PerfilAcesso']) assert.equal(hasCadastroEntityPermission('PerfilAcesso', action, checkers('Cadastros', section, action)), false);
    assert.equal(hasCadastroEntityPermission('PerfilAcesso', action, { role: 'admin' }), false);
    assert.equal(getCadastroEntityPermissionKey('PerfilAcesso', action), `Sistema.Controle de Acesso.${action}`);
    if (action !== 'visualizar') assert.equal(hasCadastroEntityPermission('PerfilAcesso', action, checkers('Sistema', 'Controle de Acesso', 'visualizar')), false);
  }
  assert.equal(hasCadastroEntityPermission('PerfilAcesso', 'aprovar', checkers('Sistema', 'Controle de Acesso', 'aprovar')), false);
  assert.equal(getCadastroEntityPermissionKey('Empresa', 'editar'), 'Cadastros.Organizacional.editar');
  assert.equal(getCadastroEntityPermissionKey('Cliente', 'editar'), 'Cadastros.Cliente.editar');
});
test('Before counterproof: old helper rejects Sistema owner and wrongly accepts generic Cadastros', () => {
  const path = 'src/components/cadastros/cadastroEditLoadPolicy.js';
  const source = execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' });
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'hasCadastroEntityPermission');
  const old = evaluate(fn.getText(ast).replace('export ', ''), { isTenantMasterEntity });
  assert.equal(old('PerfilAcesso', 'editar', checkers('Sistema', 'Controle de Acesso', 'editar')), false);
  assert.equal(old('PerfilAcesso', 'editar', checkers('Cadastros', null, 'editar')), true);
});
test('Profile buttons use the same owner, with create/edit distinguished instead of generic salvar', () => {
  const ast = parse('src/components/cadastros/PerfilAcessoForm.jsx'), keys = [];
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'data-permission') keys.push(node.initializer.expression.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.equal(keys.length, 3);
  for (const perfil of [null, { id: 'synthetic-profile' }]) {
    assert.deepEqual(keys.map(expression => evaluate(expression, { perfil, getCadastroEntityPermissionKey })), [
      'Sistema.Controle de Acesso.editar', 'Sistema.Controle de Acesso.excluir',
      `Sistema.Controle de Acesso.${perfil ? 'editar' : 'criar'}`,
    ]);
  }
  assert.ok(!ast.getFullText().includes('data-permission="Cadastros.PerfilAcesso.'));
});
test('Actual V24 gate, toolbar key and rejected mutation audit use the same profile owner', async () => {
  const ast = parse('src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx'), vars = variables(ast);
  for (const [action, name] of [['visualizar', 'canViewCadastro'], ['criar', 'canCreateCadastro'], ['editar', 'canEditCadastro'], ['excluir', 'canDeleteCadastro']]) {
    assert.equal(evaluate(vars.get(name).getText(ast), { ENTITY: 'PerfilAcesso', hasCadastroEntityPermission,
      permCheckers: checkers('Sistema', 'Controle de Acesso', action) }), true);
  }
  const cadastroPerm = evaluate(vars.get('cadastroPerm').getText(ast), { ENTITY: 'PerfilAcesso', getCadastroEntityPermissionKey });
  for (const action of ['criar', 'editar', 'excluir']) {
    const events = [], env = { ENTITY: 'PerfilAcesso', formScopeRef: { current: 'scope' }, scopeKey: 'scope', activeScopeRef: { current: 'scope' },
      assertCadastroFormScopeCurrent, canCreateCadastro: false, canEditCadastro: false, canDeleteCadastro: false,
      editItem: action === 'editar' ? { id: 'synthetic-profile' } : null, cadastroPerm,
      auditCadastroEvent: async (...args) => events.push(args) };
    const callback = evaluate(vars.get('handlePersistSubmit').arguments[0].getText(ast), env);
    await assert.rejects(callback(action === 'excluir' ? { id: 'synthetic-profile', _action: 'delete' } : { nome: 'Synthetic' }), /Sem permissao/);
    assert.equal(events.length, 1);
    assert.equal(events[0][2].permissao, `Sistema.Controle de Acesso.${action}`);
    env.activeScopeRef.current = 'other-scope'; events.length = 0;
    await assert.rejects(callback({ nome: 'Synthetic' }));
    assert.equal(events[0][2].motivo, 'escopo_alterado');
  }
});
test('Legacy status compatibility is presentation/filter only and never converts HTTP states', () => {
  const pairs = [['Aguardando AprovaÃ§Ã£o', 'Aguardando Aprovação'], ['Em ExpediÃ§Ã£o', 'Em Expedição'], ['Em TrÃ¢nsito', 'Em Trânsito']];
  for (const [old, label] of pairs) {
    const row = Object.freeze({ status: old, group_id: 'synthetic-group', empresa_id: 'synthetic-company' });
    assert.equal(pedidoLegacyStatusLabel(row.status), label);
    assert.equal(matchesPedidoLegacyStatusFilter(row.status, label), true);
    assert.equal(matchesPedidoLegacyStatusFilter(label, old), true);
    assert.equal(row.status, old);
    assert.equal(nextPedidoStatus({ status: old, tipo_operacao: 'ENTREGA', itens: [] }), null);
    for (const httpStatus of Object.keys(PEDIDO_STATUS_LABELS)) assert.equal(matchesPedidoLegacyStatusFilter(old, httpStatus), false);
  }
  for (const value of ['Rascunho', 'Aprovado', 'Faturado', 'Entregue', 'Cancelado', 'UNKNOWN', '__proto__', 'EM_ABERTO']) assert.equal(pedidoLegacyStatusLabel(value), value);
  assert.equal(matchesPedidoLegacyStatusFilter(undefined, undefined), false);
  assert.equal(matchesPedidoLegacyStatusFilter(undefined, 'todos'), true);
  assert.equal(isPedidoLegacyProducaoSobMedida('Produção Sob Medida'), true);
  assert.equal(isPedidoLegacyProducaoSobMedida('ProduÃ§Ã£o Sob Medida'), true);
  assert.equal(isPedidoLegacyProducaoSobMedida('EM_PRODUCAO'), false);
});
test('HTTP transitions preserve the exact existing state machine and reject missing operation instead of assuming pickup', () => {
  assert.equal(nextPedidoStatus({ status: 'EM_ABERTO', tipo_operacao: 'ENTREGA' }), null);
  for (const action of ['editar', 'cancelar']) {
    assert.equal(canUsePedidoAction(() => true, action), false);
    assert.equal(canUsePedidoAction(() => true, action, 'Aguardando Aprovação'), false);
    assert.equal(canUsePedidoAction(() => true, action, 'EM_ABERTO'), true);
    assert.equal(canUsePedidoAction(() => false, action, 'EM_ABERTO'), false);
  }
  for (const operation of ['ENTREGA', 'RETIRADA']) {
    const ready = operation === 'ENTREGA' ? 'PRONTO_ENTREGA' : 'PRONTO_RETIRADA';
    assert.equal(nextPedidoStatus({ status: 'EM_ABERTO', tipo_operacao: operation, itens: [] }), ready);
    assert.equal(nextPedidoStatus({ status: 'EM_ABERTO', tipo_operacao: operation, itens: [{ requer_producao: true }] }), 'EM_PRODUCAO');
    assert.equal(nextPedidoStatus({ status: 'EM_PRODUCAO', tipo_operacao: operation }), ready);
    assert.equal(nextPedidoStatus({ status: ready, tipo_operacao: operation }), 'FINALIZADO');
    for (const status of ['FINALIZADO', 'CANCELADO', 'Aprovado', 'Aguardando Aprovação', 'UNKNOWN']) assert.equal(nextPedidoStatus({ status, tipo_operacao: operation }), null);
  }
  for (const tipo_operacao of [undefined, null, '', 'entrega', 'UNKNOWN']) {
    const row = { status: 'EM_ABERTO', tipo_operacao, itens: [] };
    assert.equal(nextPedidoStatus(row), null);
    assert.equal(evaluatePedidoStatusTransitionUiGate({ row, groupId: 'synthetic-group', empresaId: 'synthetic-company', canTransition: true }).blockTransition, true);
  }
});
test('Pedidos tab keeps separate canonical routing and preserves all mutation handlers from stage14', () => {
  const path = 'src/components/comercial/PedidosTab.jsx', ast = parse(path), source = ast.getFullText();
  const old = ts.createSourceFile(path, execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const names = ['deleteMutation', 'executarAcaoSensivelPedido', 'marcarProntoParaFaturarSeguro', 'marcarProntoParaFaturarMutation',
    'solicitarExclusaoPedido', 'analisarAprovacaoSeguro', 'exportarPedidosCSV'];
  const before = variables(old), after = variables(ast);
  for (const name of names.filter(name => before.has(name))) {
    let current = after.get(name).getText(ast).replace(/\r\n/g, '\n');
    if (name === 'deleteMutation') {
      const annotation = '/** @type {{id: string} & Record<string, unknown>} */ ';
      assert.equal(current.split(annotation).length, 2);
      current = current.replace(annotation, '');
    }
    assert.equal(current, before.get(name).getText(old).replace(/\r\n/g, '\n'), name);
  }
  assert.ok(source.includes('if (props.canonicalHttp) return <PedidoCanonicoPanel {...props} />;'));
  assert.ok(source.includes('const matchStatus = matchesPedidoLegacyStatusFilter(p.status, statusFilter);'));
  assert.ok(source.includes('pedidoLegacyStatusLabel(p.status).toLowerCase().includes(searchLower)'));
  assert.ok(source.includes('canGerarOP && (isPedidoLegacyProducaoSobMedida(pedido.tipo_pedido)'));
});
