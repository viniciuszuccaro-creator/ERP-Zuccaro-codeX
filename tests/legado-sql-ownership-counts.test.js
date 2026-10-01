import assert from 'node:assert/strict';
import test from 'node:test';
import { financialLinkQuery, inspectLegacySql, ownershipCountQuery, parseFinancialLinks, parseOwnershipCounts, sqlcmdArguments } from '../scripts/legado/sql-ownership-counts.mjs';

test('uses only allowlisted read-only SQL sources and requires every copy online/read-only', () => {
  const sql = ownershipCountQuery();
  assert.match(sql, /is_read_only = 1/);
  assert.match(sql, /state_desc = 'ONLINE'/);
  assert.match(sql, /LEGACY_SQL_READ_ONLY_GATE/);
  assert.match(sql, /\[LEGACY_TID_EMP03\]\.\[dbo\]\.\[ContaCorrenteClientes\]/);
  assert.match(sql, /\[LEGACY_TID_EMP01\]\.\[dbo\]\.\[NotaFiscalSaidas\]/);
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|EXEC)\b/i);
  const args = sqlcmdArguments(sql);
  assert.ok(args.includes('lpc:.\\ERPZLEGACY'));
  assert.ok(args.includes('-y'));
  assert.ok(args.includes('4096'));
  assert.ok(!args.includes('-W'));
});

test('returns only aggregate buckets, never a company assignment or private row', () => {
  const report = inspectLegacySql(() => JSON.stringify([
    { fonte: 'EMP03', entidade: 'PedidoVenda', categoria: 'codigo003', quantidade: 12 },
    { fonte: 'EMP03', entidade: 'PedidoVenda', categoria: 'semCodigo', quantidade: 2 },
    { fonte: 'EMP01', entidade: 'NotaFiscalSaidas', categoria: 'codigo001', quantidade: 3 },
  ]));
  const pedido = report.sources.find((row) => row.fonte === 'EMP03' && row.entidade === 'PedidoVenda');
  assert.equal(report.sources.length, 12);
  assert.equal(pedido.total, 14);
  assert.equal(pedido.codigo003, 12);
  assert.equal(report.ownershipProven, false);
  assert.equal(report.importAuthorized, false);
  assert.equal(report.databasesRequiredReadOnly, 9);
  assert.doesNotMatch(JSON.stringify(report), /cliente|cpf|cnpj|codigoLegado|empresaId/);
});

test('keeps empty SQL sources visible as zero counts', () => {
  const report = parseOwnershipCounts('[]');
  assert.equal(report.sources.length, 12);
  assert.ok(report.sources.every((source) => source.total === 0));
  assert.equal(parseOwnershipCounts('[\r\n]').sources.length, 12);
});

test('rejects malformed and unallowlisted SQL output without echoing it', () => {
  const invalid = [
    'private-name',
    '{}',
    JSON.stringify([{ fonte: 'EMP99', entidade: 'PedidoVenda', categoria: 'codigo001', quantidade: 1 }]),
    JSON.stringify([{ fonte: 'EMP01', entidade: 'PedidoVenda', categoria: 'private', quantidade: 1 }]),
    JSON.stringify([{ fonte: 'EMP01', entidade: 'PedidoVenda', categoria: 'codigo001', quantidade: -1 }]),
    JSON.stringify([{ fonte: 'EMP01', entidade: 'PedidoVenda', categoria: 'codigo001', quantidade: 1.5 }]),
    JSON.stringify([
      { fonte: 'EMP01', entidade: 'PedidoVenda', categoria: 'codigo001', quantidade: 1 },
      { fonte: 'EMP01', entidade: 'PedidoVenda', categoria: 'codigo001', quantidade: 2 },
    ]),
  ];
  for (const raw of invalid) {
    assert.throws(() => parseOwnershipCounts(raw), { message: 'LEGACY_SQL_RESULT_INVALID' });
  }
});

test('financial link probe counts only candidate relations and keeps ownership blocked', () => {
  const sql = financialLinkQuery();
  assert.match(sql, /LEGACY_SQL_READ_ONLY_GATE/);
  assert.match(sql, /is_read_only = 1/);
  assert.match(sql, /\[ContaCorrenteClientes\]/);
  assert.match(sql, /\[PedidoVenda\]/);
  assert.match(sql, /v\.NRPEDIDO = c\.NRPEDIDOVENDA AND v\.CODIGOCLIENTE = c\.CODIGOCLIENTE/);
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|EXEC)\b/i);
  const result = parseFinancialLinks(JSON.stringify([
    { categoria: 'semPedido', quantidade: 3 },
    { categoria: 'semCorrespondencia', quantidade: 2 },
    { categoria: 'pedidoAmbiguo', quantidade: 1 },
    { categoria: 'pedidoCandidatoUnico', quantidade: 4 },
  ]));
  assert.equal(result.total, 10);
  assert.equal(result.pedidoCandidatoUnico, 4);
  assert.equal(result.ownershipProven, false);
  assert.equal(result.importAuthorized, false);
  assert.doesNotMatch(JSON.stringify(result), /clienteId|pedidoId|cnpj|codigoEmpresa/);
});

test('financial link parser fails closed on private or duplicated SQL categories', () => {
  for (const value of [
    'private-row', '{}',
    JSON.stringify([{ categoria: 'cliente', quantidade: 1 }]),
    JSON.stringify([{ categoria: 'semPedido', quantidade: 1.2 }]),
    JSON.stringify([{ categoria: 'semPedido', quantidade: 1 }, { categoria: 'semPedido', quantidade: 2 }]),
  ]) assert.throws(() => parseFinancialLinks(value), { message: 'LEGACY_SQL_RESULT_INVALID' });
  assert.equal(parseFinancialLinks('[]').total, 0);
});
