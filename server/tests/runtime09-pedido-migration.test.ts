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
