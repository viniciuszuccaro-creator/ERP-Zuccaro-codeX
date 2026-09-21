import assert from 'node:assert/strict';
import test from 'node:test';
import { createDbClient } from '../src/db/client.ts';
import { loadConfig } from '../src/config/env.ts';
import { PostgresOrcamentoRepository } from '../src/repositories/postgresOrcamentoRepository.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const enabled = Boolean(process.env.DATABASE_URL);
const scope = { groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA };
const other = { groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA2 };

test('R08C PostgreSQL real: orcamento create get list update cancel e isolamento', { skip: !enabled && 'DATABASE_URL not available' }, async () => {
  const db = createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL }));
  const repo = new PostgresOrcamentoRepository(db);
  let id: string | null = null;
  try {
    const client = await db.query<{ id: string }>('SELECT id FROM cliente_empresas WHERE group_id=$1 AND empresa_id=$2 AND ativo=true LIMIT 1', [scope.groupId, scope.empresaId]);
    assert.ok(client.rows[0]?.id);
    const input = { cliente_empresa_id: client.rows[0].id, condicao_pagamento_id: SEED_IDS.condicaoPagamentoA, validade_em: '2026-10-01T00:00:00.000Z', itens: [{ produto_id: SEED_IDS.produtoA, unidade_id: SEED_IDS.unidadeA, descricao: 'R08C sintetico', unidade_sigla: 'UN', quantidade: '2.000000', preco_unitario: '10.000000', desconto: '0.000000' }] };
    const created = await repo.create(scope, input); id = created.id;
    assert.match(created.numero, /^\d{8}$/); assert.equal(created.itens.length, 1); assert.equal(created.total, '20.000000');
    assert.equal((await repo.get(other, id)), null);
    const page = await repo.list(scope, 1, 0); assert.ok(page.total >= 1); assert.ok(page.rows.every((x) => x.itens.length >= 1));
    const updated = await repo.update(scope, id, { ...input, itens: [{ ...input.itens[0], quantidade: '3.000000' }] });
    assert.equal(updated?.total, '30.000000'); assert.equal(updated?.itens.length, 1);
    assert.equal(await repo.update(other, id, input), null);
    const cancelled = await repo.cancel(scope, id); assert.equal(cancelled?.status, 'CANCELADO'); assert.equal(cancelled?.ativo, false);
    assert.equal(await repo.cancel(scope, id), null);
  } finally { if (id) await db.query('DELETE FROM orcamentos WHERE id=$1 AND group_id=$2 AND empresa_id=$3', [id, scope.groupId, scope.empresaId]); await db.end(); }
});
