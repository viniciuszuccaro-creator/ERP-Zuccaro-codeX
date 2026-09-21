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