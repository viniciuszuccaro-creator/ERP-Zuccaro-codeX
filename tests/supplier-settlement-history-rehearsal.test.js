import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { bindSupplierSettlementRehearsal } from '../scripts/legado/supplier-settlement-history-rehearsal.mjs';

const groupId = '11111111-1111-4111-8111-111111111111';
const empresaId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';

function fixture(options = {}) {
  const bytes = Buffer.from(JSON.stringify({
    kind: 'legacy-supplier-settlement-history-review', executable: false,
    createsPayable: false, confirmsPayment: false, sourceArchiveSha256: 'a'.repeat(64),
    destination: { groupId, schema: 'history_test' }, count: 1,
    rows: [{ empresaId, classe: 'BAIXA_HISTORICA_SEM_COMPROVANTE',
      relatorio: 1, fornecedor: 2, nota: 3, dataBaixa: 4, sequenciaHex: '31', valor: '12.30' }],
    ...options.manifest,
  }));
  const calls = [];
  const targetPin = { cluster_id: '12345', database_oid: '123', schema_oid: '456', role: 'history_runner' };
  let probes = 0;
  const q = { query: async text => {
    if (text.includes('current_database()')) {
      assert.match(text, /current_schemas\(false\)::text\[\] AS schemas/);
      return { rows: [{
      db: options.database ?? 'erp_history_rehearsal', schema: 'history_test', restricted: true,
      ...targetPin, login: targetPin.role, schemas: ['history_test', 'pg_catalog'],
      ...(++probes === 2 && options.drift ? options.drift : {}),
      }] };
    }
    if (text.includes('INSERT INTO')) { calls.push('insert'); return { rowCount: options.replay ? 0 : 1 }; }
    if (text.includes('FILTER')) return { rows: [{ n: options.conflict ? 0 : 1, archived: 0 }] };
    return {};
  } };
  return { calls, input: { bytes, targetPin, expectedSha: createHash('sha256').update(bytes).digest('hex'),
    ctx: { groupId, empresaId, actorId },
    db: { withTenantContext: (_, fn) => fn(), withTransaction: fn => fn(q) },
    authorize: async (_, mode, tx) => { assert.equal(tx, q); calls.push(mode); },
    audit: { append: async (entry, tx) => { assert.equal(tx, q); assert.equal(entry.actorId, actorId); calls.push(entry.action); } },
  } };
}

test('rejects a changed hash, payable manifest, or non-rehearsal database', async () => {
  const { input } = fixture();
  assert.throws(() => bindSupplierSettlementRehearsal({ ...input, expectedSha: 'b'.repeat(64) }), /HISTORY_SCOPE_OR_HASH/);
  assert.throws(() => bindSupplierSettlementRehearsal(fixture({ manifest: { createsPayable: true } }).input), /HISTORY_INVALID_MANIFEST/);
  const live = fixture({ database: 'hml344_restore_20261104' });
  await assert.rejects(bindSupplierSettlementRehearsal(live.input)({ mode: 'apply' }), /HISTORY_REHEARSAL_DESTINATION_REQUIRED/);
  assert.deepEqual(live.calls, []);
});

test('fails closed before authorizing the next batch when its destination changes', async () => {
  const row = { empresaId, classe: 'BAIXA_HISTORICA_SEM_COMPROVANTE',
    relatorio: 1, fornecedor: 2, nota: 3, dataBaixa: 4, sequenciaHex: '31', valor: '12.30' };
  for (const drift of [{ cluster_id: '999' }, { database_oid: '999' }, { schema_oid: '999' },
    { login: 'other' }, { schemas: ['history_test', 'public', 'pg_catalog'] }]) {
    const { input, calls } = fixture({ drift, manifest: { count: 2, rows: [row, { ...row, relatorio: 2 }] } });
    const run = bindSupplierSettlementRehearsal(input);
    const checkpoints = [];
    await assert.rejects(run({ mode: 'apply', batchSize: 1, onCommitted: c => checkpoints.push(c) }),
      /HISTORY_REHEARSAL_DESTINATION_REQUIRED/);
    assert.deepEqual(checkpoints, [{ offset: 0, changed: 1 }]);
    assert.deepEqual(calls, ['apply', 'insert', 'create']);
  }
});

test('authorizes and audits changed batches, but not replay or conflict', async () => {
  const fresh = fixture();
  assert.deepEqual(await bindSupplierSettlementRehearsal(fresh.input)({ mode: 'apply' }), { processed: 1, changed: 1 });
  assert.deepEqual(fresh.calls, ['apply', 'insert', 'create']);
  const replay = fixture({ replay: true });
  assert.deepEqual(await bindSupplierSettlementRehearsal(replay.input)({ mode: 'apply' }), { processed: 1, changed: 0 });
  assert.deepEqual(replay.calls, ['apply', 'insert']);
  const conflict = fixture({ conflict: true });
  await assert.rejects(bindSupplierSettlementRehearsal(conflict.input)({ mode: 'apply' }), /HISTORY_CONFLICT_OR_ARCHIVED/);
  assert.deepEqual(conflict.calls, ['apply', 'insert']);
});
