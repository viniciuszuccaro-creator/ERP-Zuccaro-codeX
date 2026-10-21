import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { financialUiBoundaryRemainder } from './helpers/financialUiBoundaryRemainder.js';

const path = 'src/components/lib/useFormasPagamento.jsx';
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const source = read(path);
const fields = ['ativa', 'aceita_desconto', 'percentual_desconto_padrao', 'aplicar_acrescimo', 'percentual_acrescimo_padrao', 'taxa_por_parcela', 'intervalo_parcelas_dias'];
const projection = fields.map(field => `      ${field}: forma.${field},\n`).join('');
function remainder(text) {
  assert.equal(text.split(projection).length - 1, 1, 'one exact projection, no broader replacement');
  assert.ok(text.endsWith('export default useFormasPagamento;\n'), 'only one final LF added by patch editor');
  return text.replace(projection, '').slice(0, -1);
}
const baseline = remainder(source);
const hash = text => createHash('sha256').update(text).digest('hex');
test('stage49 entire hook retained except seven source-field projections', () => {
  assert.equal(hash(baseline), 'a664f1b79edca5d51c68107a33d62b798b52f23615b80a07b8473de8a4c96b24');
  assert.throws(() => remainder(baseline));
  assert.throws(() => remainder(source + projection));
  assert.notEqual(hash(remainder(source.replace('max_parcelas: forma.maximo_parcelas || 1', 'max_parcelas: 12'))), hash(baseline));
});
for (const [file, expected] of [
  ['comercial/FechamentoFinanceiroTab.jsx', 'ae386c90edc5194049336d95e493a01c868496b5e91dd78b2bf9240ad8e0ea21'],
  ['financeiro/CaixaPDVCompleto.jsx', '660c53cb0d8355e9cc6d0ed621b0ab1cd452051c2043329cee6b5269be561b52'],
  ['cadastros/FormaPagamentoFormCompleto.jsx', '320532c61a1b8f8a17133026ac0327cfd4fd52bc0787373589329138139265a6'],
  ['cadastros/FormaPagamentoForm.jsx', '58182860db77f87684ebe10f0781b0617e9916cb90554ecf5a868efa21a4521f'],
]) test(`${file}: source, handlers, permissions and persistence ownership unchanged from stage49`, () => {
  assert.equal(hash(financialUiBoundaryRemainder('src/components/' + file, read('src/components/' + file))), expected);
});

function bind(text, { formas = [], bancos = [], gateways = [], filtros = {}, loading = {} } = {}) {
  const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'useFormasPagamento');
  const emitted = ts.transpileModule(fn.getText(ast).replace('export ', ''), {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
  }).outputText;
  const queries = [], reads = [];
  const rows = { 'formas-pagamento': formas, bancos, 'gateways-pagamento': gateways };
  const base44 = { entities: Object.fromEntries([
    ['FormaPagamento', formas], ['Banco', bancos], ['GatewayPagamento', gateways],
  ].map(([name, data]) => [name, { filter: async input => { reads.push([name, input]); return [...data]; } }])) };
  const hook = new Function('useQuery', 'base44', `${emitted};return useFormasPagamento;`)(
    query => { queries.push(query); return { data: rows[query.queryKey[0]], isLoading: loading[query.queryKey[0]] || false }; }, base44);
  return { api: hook(filtros), queries, reads };
}
const payment = (extra = {}) => ({
  id: 'payment-a', descricao: 'Synthetic payment', tipo: 'Boleto', ativa: true,
  aceita_desconto: true, percentual_desconto_padrao: 5, aplicar_acrescimo: true,
  percentual_acrescimo_padrao: 2, taxa_por_parcela: 1.5, intervalo_parcelas_dias: 30,
  prazo_compensacao_dias: 2, permite_parcelamento: true, maximo_parcelas: 6,
  disponivel_pdv: true, disponivel_ecommerce: false, ...extra,
});

test('config retains literal identity, raw known values, extension fields and unchanged aliases without mutating source', () => {
  const forma = payment({ private_extension: { synthetic: true }, banco: 'source-collision', gateway: 'source-collision' });
  const bank = { id: 'bank-a', suporta_cobranca_boleto: true };
  const gateway = { id: 'gateway-a' };
  forma.usa_gateway = true; forma.gateway_pagamento_id = gateway.id;
  const frozen = structuredClone(forma);
  const fixture = { formas: [forma], bancos: [bank], gateways: [gateway] };
  const before = bind(baseline, fixture).api.obterConfiguracao(forma.id);
  const after = bind(source, fixture).api.obterConfiguracao(forma.id);
  assert.deepEqual(after, before);
  assert.equal(after.banco, bank); assert.equal(after.gateway, gateway);
  assert.equal(after.private_extension, forma.private_extension);
  assert.notEqual(after, forma); assert.deepEqual(forma, frozen);
  for (const field of fields) assert.equal(after[field], forma[field]);
});

test('legacy missing fields remain undefined with only the seven documented additive own keys', () => {
  const forma = { id: 'legacy-a', tipo: 'Dinheiro' };
  const fixture = { formas: [forma] };
  const before = bind(baseline, fixture).api.obterConfiguracao(forma.id);
  const after = bind(source, fixture).api.obterConfiguracao(forma.id);
  assert.deepEqual(Object.keys(after).filter(key => !Object.hasOwn(before, key)).sort(), [...fields].sort());
  for (const key of fields) { assert.ok(Object.hasOwn(after, key)); assert.equal(after[key], undefined); delete after[key]; }
  assert.deepEqual(after, before);
  assert.equal(bind(source, fixture).api.validarFormaPagamento(forma.id).valido, false);
});

test('record identity is strict; missing ID is not inferred by description, value or numeric coercion', () => {
  const api = bind(source, { formas: [payment({ id: 1 }), payment({ id: '1', ativa: false })] }).api;
  assert.equal(api.obterConfiguracao(1).ativa, true);
  assert.equal(api.obterConfiguracao('1').ativa, false);
  assert.equal(api.obterConfiguracao('Synthetic payment'), null);
  assert.equal(api.obterConfiguracao('missing'), null);
  assert.equal(api.calcularValorFinal(100, 'missing'), 100);
  assert.equal(api.calcularParcelas(100, 'missing', 4), null);
  assert.equal(api.validarFormaPagamento('missing').valido, false);
});

for (const [name, patch] of [
  ['standard', {}],
  ['inactive', { ativa: false }],
  ['discount disabled', { aceita_desconto: false }],
  ['surcharge disabled', { aplicar_acrescimo: false }],
  ['zero rates', { percentual_desconto_padrao: 0, percentual_acrescimo_padrao: 0, taxa_por_parcela: 0 }],
  ['legacy numeric strings', { percentual_desconto_padrao: '5', percentual_acrescimo_padrao: '2', taxa_por_parcela: '1.5', intervalo_parcelas_dias: '15', maximo_parcelas: '3' }],
  ['legacy negative values', { percentual_desconto_padrao: -5, taxa_por_parcela: -1 }],
  ['no installments', { permite_parcelamento: false }],
  ['zero fallback inputs', { maximo_parcelas: 0, intervalo_parcelas_dias: 0, prazo_compensacao_dias: 0 }],
]) test(`${name}: actual hook calculations and recommendations remain equivalent to stage49`, () => {
  const fixture = { formas: [payment(patch), payment({ id: 'payment-b', tipo: 'Dinheiro', aceita_desconto: false })] };
  const before = bind(baseline, fixture).api, after = bind(source, fixture).api;
  for (const amount of [0, 1, 100, 1234.56, -10]) {
    for (const count of [0, 1, 3, 12]) assert.deepEqual(after.calcularParcelas(amount, 'payment-a', count), before.calcularParcelas(amount, 'payment-a', count));
    assert.equal(after.calcularValorFinal(amount, 'payment-a'), before.calcularValorFinal(amount, 'payment-a'));
    for (const context of ['pdv', 'ecommerce', 'all']) assert.deepEqual(after.recomendarMelhorForma(amount, context), before.recomendarMelhorForma(amount, context));
    for (const capacity of [1, 100, 500]) assert.deepEqual(after.sugerirParcelamentoIdeal(amount, capacity), before.sugerirParcelamentoIdeal(amount, capacity));
  }
  assert.deepEqual(after.validarFormaPagamento('payment-a'), before.validarFormaPagamento('payment-a'));
});

test('configured source drives discount, surcharge and installments; no invented financial movement', () => {
  const api = bind(source, { formas: [payment()] }).api;
  assert.equal(api.calcularValorFinal(100, 'payment-a'), 97);
  const rows = api.calcularParcelas(100, 'payment-a', 2);
  assert.equal(rows.length, 2); assert.equal(rows[1].numero_parcelas, 2);
  assert.equal(rows[1].intervalo_dias, 30); assert.equal(rows[1].taxa_aplicada, 1.5);
  assert.equal(rows[1].valor_parcela, (97 / 2) * 1.015);
  assert.ok(rows.every(row => !Object.hasOwn(row, 'movementId') && !Object.hasOwn(row, 'titulo_id')));
});

test('bank/gateway selection and mandatory integration validation keep their current contract', () => {
  const formas = [payment({ integracao_obrigatoria: true, usa_gateway: true, gateway_pagamento_id: 'gateway-a' }), payment({ id: 'pix-a', tipo: 'PIX' })];
  const banks = [{ id: 'pix-bank', suporta_cobranca_pix: true }, { id: 'boleto-bank', suporta_cobranca_boleto: true }];
  const fixture = { formas, bancos: banks, gateways: [{ id: 'gateway-a' }] };
  const api = bind(source, fixture).api;
  assert.equal(api.obterConfiguracao('payment-a').banco.id, 'boleto-bank');
  assert.equal(api.obterConfiguracao('pix-a').banco.id, 'pix-bank');
  assert.equal(api.obterConfiguracao('payment-a').gateway.id, 'gateway-a');
  assert.equal(api.validarFormaPagamento('payment-a').valido, true);
  assert.equal(bind(source, { formas }).api.validarFormaPagamento('payment-a').valido, false);
  assert.equal(api.obterBancoPorTipo('Dinheiro'), null);
});

test('actual queries keep existing filters, ordering, loading and cache contract; no network is used', async () => {
  const fixture = { formas: [payment({ ordem_exibicao: 2 }), payment({ id: 'payment-b', ordem_exibicao: 1 })], filtros: { empresa_id: 'company-a' }, loading: { bancos: true } };
  const before = bind(baseline, fixture), after = bind(source, fixture);
  assert.equal(after.api.isLoading, true);
  assert.deepEqual(after.queries.map(query => ({ key: query.queryKey, stale: query.staleTime })), before.queries.map(query => ({ key: query.queryKey, stale: query.staleTime })));
  assert.deepEqual((await after.queries[0].queryFn()).map(row => row.id), ['payment-b', 'payment-a']);
  await after.queries[1].queryFn(); await after.queries[2].queryFn();
  assert.deepEqual(after.reads, [['FormaPagamento', { ativa: true, empresa_id: 'company-a' }], ['Banco', { ativo: true }], ['GatewayPagamento', { ativo: true }]]);
  const api = after.api;
  assert.equal(api.obterFormasPorContexto('pdv').length, 2); assert.equal(api.obterFormasPorContexto('ecommerce').length, 0);
  assert.equal(api.obterFormaPorDescricao('Synthetic payment').id, 'payment-a');
  assert.equal(api.obterFormaPorDescricao('Boleto').id, 'payment-a');
});

test('prototype-named JSON extension stays a copied data property, never prototype mutation', () => {
  const forma = JSON.parse('{"id":"json-a","__proto__":{"synthetic":true},"ativa":true}');
  const config = bind(source, { formas: [forma] }).api.obterConfiguracao('json-a');
  assert.equal(Object.getPrototypeOf(config), Object.prototype);
  assert.ok(Object.hasOwn(config, '__proto__'));
  assert.equal(config.synthetic, undefined); assert.equal(Object.prototype.synthetic, undefined);
});
