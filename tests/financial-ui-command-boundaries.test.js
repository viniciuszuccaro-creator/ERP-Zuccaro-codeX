import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { QueryClient } from '@tanstack/react-query';
import { financialUiBoundaryHunks, financialUiBoundaryRemainder } from './helpers/financialUiBoundaryRemainder.js';
import {consolidation80Hunks} from './helpers/consolidation80Remainder.js';

const prefix = 'src/components/financeiro/';
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const before = {
  'caixa-central/OrdensLiquidacaoPendentes': 'da79dc37fe61154d166c54f111a175e0f47c5220d21f38acc1607efa3dd7662f',
  CartoesACompensar: 'a6de2a23718024e38773285bbd62ecc9ce28e8a99d8a096977642d398fdd4843',
  CaixaPDVCompleto: '660c53cb0d8355e9cc6d0ed621b0ab1cd452051c2043329cee6b5269be561b52',
  DuplicarMesAnterior: 'd7aed10eabf42920544123a07eb42ca3c4e975bb05c20c72bd7b78a21797e724',
  ConciliacaoBancaria: '06ec8ff0f80bfd23534ee45db94d5021d141da8ff102ccff3a008fe18efb14a6',
  ConciliacaoBancariaTab: 'd0bd969c78a9e128bd6765b15f21acb16197be64f6e80490f1a7379b34b09130',
  SimularPagamentoModal: '7da440559d2d82d0c4323432220dafa2c1b6286db3e41a5220131a2f198be647',
};
for (const [name, expected] of Object.entries(before)) test(`${name}: complete stage50 source frozen outside exactly counted integration hunks`, () => {
  const file = prefix + name + '.jsx';
  const restored = financialUiBoundaryRemainder(file, read(file));
  assert.equal(createHash('sha256').update(restored).digest('hex'), expected);
  const [historicCurrent, historicPrevious] = financialUiBoundaryHunks[file][0];
  const [current,previous] = read(file).includes(historicCurrent) ? [historicCurrent,historicPrevious] : consolidation80Hunks[file].hunks[0];
  assert.throws(() => financialUiBoundaryRemainder(file, read(file).replace(current, previous)));
  assert.throws(() => financialUiBoundaryRemainder(file, read(file).replace(current, current + '\n' + current)));
  assert.notEqual(createHash('sha256').update(financialUiBoundaryRemainder(file, '// unrelated edit\n' + read(file))).digest('hex'), expected);
});
const parse = file => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
function nodes(tree, predicate) {
  const out = []; const visit = node => { if (predicate(node)) out.push(node); ts.forEachChild(node, visit); };
  visit(tree); return out;
}
function variable(file, name) {
  const ast = parse(file);
  const found = nodes(ast, node => ts.isVariableDeclaration(node) && node.name.getText(ast) === name);
  assert.equal(found.length, 1, name); return { ast, node: found[0] };
}
function callback(file, name, key, env) {
  const { ast, node } = variable(file, name);
  const fn = node.initializer.arguments[0].properties.find(property => property.name?.getText(ast) === key).initializer;
  return new Function(...Object.keys(env), `return (${fn.getText(ast)});`)(...Object.values(env));
}
const bindExpression = (text, env) => new Function(...Object.keys(env), `return (${text});`)(...Object.values(env));

test('installed v5 counterproof: legacy array filter invalidates an unrelated financial cache', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  try {
    client.setQueryData(['synthetic-target'], 1); client.setQueryData(['synthetic-other'], 2);
    await client.invalidateQueries(['synthetic-target']);
    assert.equal(client.getQueryState(['synthetic-other']).isInvalidated, true);
  } finally { client.clear(); }
});
let invalidationCount = 0;
for (const name of ['ConciliacaoBancaria', 'ConciliacaoBancariaTab', 'SimularPagamentoModal']) {
  const file = prefix + name + '.jsx', ast = parse(file);
  const calls = nodes(ast, node => ts.isCallExpression(node) && node.expression.getText(ast) === 'queryClient.invalidateQueries');
  for (const call of calls) {
    invalidationCount++;
    const filter = bindExpression(call.arguments[0].getText(ast), {}), target = filter.queryKey[0];
    test(`${name}/${target}: actual v5 filter invalidates matching tenant variants, never unrelated prefixes`, async () => {
      const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
      try {
        const keys = [[target], [target, 'company-a'], [target, 'company-b'], [target + '-different'], ['unrelated']];
        for (const key of keys) client.setQueryData(key, { synthetic: true });
        await client.invalidateQueries(filter);
        assert.deepEqual(keys.map(key => client.getQueryState(key).isInvalidated), [true, true, true, false, false]);
      } finally { client.clear(); }
    });
  }
}
// Three legacy writer invalidations were replaced by canonical scoped refetches, exercised by bank-manual-reconciliation-ui.
test('four remaining writer invalidations accounted for after canonical reconciliation migration', () => assert.equal(invalidationCount, 4));

for (const [name, setter] of [['CaixaPDVCompleto', 'setEmitirRecibo'], ['CaixaPDVCompleto', 'setEmitirNFe'], ['CaixaPDVCompleto', 'setEmitirBoleto'], ['DuplicarMesAnterior', 'setIncluirRecorrentes']]) {
  test(`${name}/${setter}: actual checkbox admits only literal true and has no financial side effect`, () => {
    const ast = parse(prefix + name + '.jsx');
    const attr = nodes(ast, node => ts.isJsxAttribute(node) && node.name.getText(ast) === 'onCheckedChange'
      && node.initializer.expression.getText(ast).includes(setter));
    assert.equal(attr.length, 1);
    let current;
    const fn = bindExpression(attr[0].initializer.expression.getText(ast), { [setter]: value => { current = value; } });
    for (const value of [true, false, 'indeterminate', 'true', 1, {}, null, undefined]) {
      fn(value); assert.equal(current, value === true);
    }
  });
}

const cards = prefix + 'CartoesACompensar.jsx', orders = prefix + 'caixa-central/OrdensLiquidacaoPendentes.jsx';
const card = () => ({ id: 'card-a', valor_liquido: 10, empresa_id: 'company-a', group_id: 'group-a' });
function cardEnvironment(patch = {}) {
  const writes = [], audits = [], events = [];
  return { writes, audits, events, env: {
    contextoValido: true, canConciliarCartoes: true, groupId: 'group-a', empresaId: 'company-a',
    user: { id: 'user-a', full_name: 'Synthetic user' },
    updateInContext: async (...args) => { writes.push(args); return { id: 'card-a', status_compensacao: 'Compensado' }; },
    auditarCartao: async data => { audits.push(data); },
    queryClient: { invalidateQueries: data => events.push(['invalidate', data]) },
    toast: { success: text => events.push(['success', text]), error: text => events.push(['error', text]) },
    ...patch,
  } };
}
test('actual manual card mutation retains scoped update, effective date and success audit/caches', async () => {
  const h = cardEnvironment(), input = { cartao: card() };
  const updated = await callback(cards, 'conciliarMutation', 'mutationFn', h.env)(input);
  assert.equal(h.writes.length, 1);
  const [entity, id, payload] = h.writes[0];
  assert.equal(entity, 'MovimentoCartao'); assert.equal(id, 'card-a');
  assert.equal(payload.group_id, 'group-a'); assert.equal(payload.empresa_id, 'company-a');
  assert.equal(payload.status_compensacao, 'Compensado'); assert.equal(payload.conciliado_por_id, 'user-a');
  assert.match(payload.data_recebimento_efetivo, /^\d{4}-\d{2}-\d{2}$/);
  await callback(cards, 'conciliarMutation', 'onSuccess', h.env)(updated, input);
  assert.equal(h.audits[0].cartao, input.cartao); assert.equal(h.audits[0].dadosNovos, updated);
  assert.deepEqual(h.events[0], ['invalidate', { queryKey: ['movimento-cartao'] }]);
});
test('actual manual card mutation blocks missing context, permission, ID and nonpositive value; propagates backend rejection', async () => {
  for (const [patch, input] of [
    [{ contextoValido: false }, card()], [{ canConciliarCartoes: false }, card()],
    [{}, { ...card(), id: undefined }], [{}, { ...card(), valor_liquido: 0 }], [{}, { ...card(), valor_liquido: -1 }],
  ]) {
    const h = cardEnvironment(patch);
    await assert.rejects(callback(cards, 'conciliarMutation', 'mutationFn', h.env)({ cartao: input }));
    assert.deepEqual(h.writes, []);
  }
  const error = Error('Synthetic backend rejection');
  const h = cardEnvironment({ updateInContext: async () => { throw error; } });
  await assert.rejects(callback(cards, 'conciliarMutation', 'mutationFn', h.env)({ cartao: card() }), value => value === error);
  callback(cards, 'conciliarMutation', 'onError', h.env)(error);
  assert.equal(h.events[0][0], 'error'); assert.deepEqual(h.audits, []);
});

function orderEnvironment(type = 'Recebimento', patch = {}) {
  const writes = [], audits = [], events = [];
  const ordem = { id: 'order-a', tipo_operacao: type, group_id: 'group-a', empresa_id: 'company-a', titulos_vinculados: [{ titulo_id: 'title-a', valor_titulo: 10 }] };
  const env = {
    contextoValido: true, podeReceber: true, podePagar: true, ordensLiquidacao: [ordem],
    podeLiquidarOrdem: () => true, groupId: 'group-a', empresaId: 'company-a', user: { id: 'user-a', full_name: 'Synthetic user' },
    updateInContext: async (...args) => { writes.push(args); }, auditarOrdem: async data => audits.push(data),
    queryClient: { invalidateQueries: data => events.push(['invalidate', data]) }, toast: data => events.push(['toast', data]),
    formaPagamentoLiquidacao: 'Synthetic form', observacoesLiquidacao: 'Synthetic note',
    setLiquidacaoDialogOpen: data => events.push(['dialog', data]), setOrdemSelecionada: data => events.push(['selected', data]),
    setFormaPagamentoLiquidacao: data => events.push(['form', data]), setObservacoesLiquidacao: data => events.push(['note', data]),
    ...patch,
  };
  return { writes, audits, events, ordem, env };
}
const orderCommand = () => ({ ordemId: 'order-a', dados: { forma_pagamento: 'Synthetic form', observacoes: 'Synthetic note', usuario_id: 'user-a' } });
for (const type of ['Recebimento', 'Pagamento']) test(`${type}: actual manual order handler preserves title/owner update and order completion`, async () => {
  const h = orderEnvironment(type);
  const output = await callback(orders, 'liquidarOrdemMutation', 'mutationFn', h.env)(orderCommand());
  assert.equal(output, h.ordem); assert.equal(h.writes.length, 2);
  assert.equal(h.writes[0][0], type === 'Pagamento' ? 'ContaPagar' : 'ContaReceber');
  assert.equal(h.writes[0][1], 'title-a'); assert.equal(h.writes[0][2].empresa_id, 'company-a');
  assert.equal(h.writes[0][2].status, type === 'Pagamento' ? 'Pago' : 'Recebido');
  assert.equal(h.writes[1][0], 'CaixaOrdemLiquidacao'); assert.equal(h.writes[1][2].status, 'Liquidado');
  await callback(orders, 'liquidarOrdemMutation', 'onSuccess', h.env)(output);
  assert.equal(h.audits[0].ordem, h.ordem); assert.equal(h.events.filter(event => event[0] === 'invalidate').length, 4);
  assert.deepEqual(h.events.at(-1), ['note', '']);
});
test('actual order mutation blocks context/action/title permissions and propagates update errors', async () => {
  for (const [type, patch] of [['Recebimento', { contextoValido: false }], ['Pagamento', { podeLiquidarOrdem: () => false }], ['Recebimento', { podeReceber: false }], ['Pagamento', { podePagar: false }]]) {
    const h = orderEnvironment(type, patch);
    await assert.rejects(callback(orders, 'liquidarOrdemMutation', 'mutationFn', h.env)(orderCommand()));
    assert.deepEqual(h.writes, []);
  }
  const error = Error('Synthetic update failure');
  const h = orderEnvironment('Recebimento', { updateInContext: async () => { throw error; } });
  await assert.rejects(callback(orders, 'liquidarOrdemMutation', 'mutationFn', h.env)(orderCommand()), value => value === error);
  assert.deepEqual(h.events, []); assert.deepEqual(h.audits, []);
});
