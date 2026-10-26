import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('migration 017 preserva tenant RLS historico e conversao unica', async () => {
  const source = await readFile(new URL('../migrations/017_pedidos_comercial_360.sql', import.meta.url), 'utf8');
  for (const required of [
    'assert_pedido_same_tenant', 'assert_pedido_item_same_tenant',
    'UNIQUE (empresa_id, numero)', 'UNIQUE (empresa_id, orcamento_id)',
    'FOREIGN KEY (pedido_id,group_id,empresa_id)', 'pedido_historico', 'ordem BIGINT GENERATED ALWAYS AS IDENTITY',
    'FORCE ROW LEVEL SECURITY', 'REVOKE ALL ON TABLE pedidos FROM PUBLIC',
    "'FINALIZADO'", 'Rollback somente com backup/gate',
  ]) assert.ok(source.includes(required), required);
  assert.doesNotMatch(source, /count\s*\(\s*\*\s*\)\s*\+\s*1/i);
  assert.doesNotMatch(source, /status[^\n]*FECHADO/i);
});
test('repositorio PostgreSQL Pedido preserva lock sequencia tenant e executor', async () => {
  const source = await readFile(new URL('../src/repositories/postgresPedidoRepository.ts', import.meta.url), 'utf8');
  assert.match(source, /implements PedidoRepository/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /MAX\(numero::int\)/);
  assert.match(source, /p\.group_id=\$1 AND p\.empresa_id=\$2/);
  assert.match(source, /executor \? fn\(executor\) : this\.db\.withTransaction\(fn\)/);
  assert.doesNotMatch(source, /count\s*\(\s*\*\s*\)\s*\+\s*1/i);
});

test('migration 044 adiciona chave opcional única por tenant sem alterar pedidos antigos', async () => {
  const source = await readFile(new URL('../migrations/044_pedidos_idempotencia_direta.sql', import.meta.url), 'utf8');
  assert.match(source, /ADD COLUMN IF NOT EXISTS idempotency_key UUID/);
  assert.match(source, /ADD COLUMN IF NOT EXISTS payload_fingerprint TEXT/);
  assert.match(source, /ON pedidos\(group_id, empresa_id, idempotency_key\)/);
  assert.match(source, /WHERE idempotency_key IS NOT NULL/);
  assert.doesNotMatch(source, /DROP|TRUNCATE|DELETE FROM pedidos/i);
});

test('repositorio nao serializa chave ou fingerprint da intencao no Pedido publico', async () => {
  const source = await readFile(new URL('../src/repositories/postgresPedidoRepository.ts', import.meta.url), 'utf8');
  assert.match(source, /delete safe\.idempotency_key/);
  assert.match(source, /delete safe\.payload_fingerprint/);
  assert.match(source, /fingerprint: String\(result\.rows\[0\]\.payload_fingerprint\)/);
});

test('044 compensador: contraprova NULL, rollback e preservacao em engine isolada', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const fixture = new PGlite();
  const exec = async (sql: string) => { await fixture.exec(sql); };
  const rows = async (sql: string) => (await fixture.query(sql)).rows;
  try {
    const original = await readFile(new URL('../migrations/044_pedidos_idempotencia_direta.sql', import.meta.url), 'utf8');
    const candidate = await readFile(new URL('../schema-candidates/pedido_idempotency_pair.sql', import.meta.url), 'utf8');
    await exec('CREATE TEMP TABLE pedidos(group_id uuid NOT NULL, empresa_id uuid NOT NULL, marker text NOT NULL)');
    await exec(original);
    const group = '11111111-1111-4111-8111-111111111111';
    const company = '22222222-2222-4222-8222-222222222222';
    const key = '33333333-3333-4333-8333-333333333333';
    await exec(`INSERT INTO pedidos VALUES ('${group}','${company}','incomplete','${key}',NULL)`);
    // Counterproof: original CHECK admits UNKNOWN. Candidate must refuse without repairing data.
    await assert.rejects(exec(candidate), /pedidos_idempotency_pair_complete_check/);
    await exec('ROLLBACK');
    assert.equal((await rows("SELECT marker FROM pedidos WHERE marker='incomplete'")).length, 1);
    assert.equal((await rows("SELECT 1 FROM pg_constraint WHERE conrelid='pedidos'::regclass AND conname='pedidos_idempotency_pair_complete_check'")).length, 0);
    await exec("DELETE FROM pedidos WHERE marker='incomplete'"); // Disposable synthetic row only.
    await exec(`INSERT INTO pedidos VALUES ('${group}','${company}','legacy',NULL,NULL),
      ('${group}','${company}','valid','${key}','${'a'.repeat(64)}')`);
    const before = await rows('SELECT * FROM pedidos ORDER BY marker');
    await exec(candidate);
    assert.deepEqual(await rows('SELECT * FROM pedidos ORDER BY marker'), before);
    for (const [k, fingerprint] of [[`'${key}'`, 'NULL'], ['NULL', `'${'a'.repeat(64)}'`], [`'${key}'`, "'bad'"]]) {
      await assert.rejects(exec(`INSERT INTO pedidos VALUES ('${group}','${company}','invalid',${k},${fingerprint})`), /pedidos_idempotency_pair/);
    }
    await assert.rejects(exec(`INSERT INTO pedidos VALUES ('${group}','${company}','duplicate','${key}','${'a'.repeat(64)}')`), /uq_pedidos_idempotency_scope/);
    await exec(`INSERT INTO pedidos VALUES ('44444444-4444-4444-8444-444444444444','${company}','other-group','${key}','${'a'.repeat(64)}')`);
    assert.equal((await rows('SELECT * FROM pedidos')).length, 3);
    } finally { await fixture.close(); }
});
