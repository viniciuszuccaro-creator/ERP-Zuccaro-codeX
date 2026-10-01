import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('migration 025 preserva tenant RLS historico romaneio e side-effects reservados', async () => {
  const source = await readFile(new URL('../migrations/025_expedicao_entregas_romaneios.sql', import.meta.url), 'utf8');
  for (const required of [
    'assert_entrega_same_tenant',
    'assert_entrega_item_same_tenant',
    'assert_romaneio_same_tenant',
    'assert_separacao_same_tenant',
    'UNIQUE (empresa_id, numero)',
    'UNIQUE (empresa_id, pedido_id)',
    'UNIQUE (empresa_id, entregas_key)',
    'FOREIGN KEY (entrega_id,group_id,empresa_id)',
    'entrega_historico',
    'romaneio_entregas',
    'FORCE ROW LEVEL SECURITY',
    'REVOKE ALL ON TABLE entregas FROM PUBLIC',
    'REVOKE ALL ON TABLE romaneios FROM PUBLIC',
    "'PRONTO_EXPEDIR'",
    "'SAIU_ENTREGA'",
    'Pedido soft/nullable',
    'Rollback somente com backup/gate',
    'Sem aplicacao operacional',
  ]) assert.ok(source.includes(required), required);
  assert.doesNotMatch(source, /count\s*\(\s*\*\s*\)\s*\+\s*1/i);
});

test('repositorio PostgreSQL Expedicao preserva lock sequencia tenant e executor', async () => {
  const source = await readFile(new URL('../src/repositories/postgresExpedicaoRepository.ts', import.meta.url), 'utf8');
  assert.match(source, /implements ExpedicaoRepository/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /MAX\(numero::int\)/);
  assert.match(source, /group_id=\$1 AND empresa_id=\$2/);
  assert.match(source, /executor \? fn\(executor\) : this\.db\.withTransaction\(fn\)/);
  assert.doesNotMatch(source, /count\s*\(\s*\*\s*\)\s*\+\s*1/i);
});

test('ExpedicaoService mantem portas Pedido/estoque reserved por default', async () => {
  const source = await readFile(new URL('../src/services/expedicaoService.ts', import.meta.url), 'utf8');
  assert.match(source, /reservedPedidoPort/);
  assert.match(source, /reservedEstoquePort/);
  assert.match(source, /pedidoSideEffect/);
  assert.match(source, /ESTOQUE_SIDE_EFFECT_FAILED/);
  assert.match(source, /allowGlobalWildcard: false/);
});
