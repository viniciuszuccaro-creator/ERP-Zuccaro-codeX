import assert from 'node:assert/strict';
import test from 'node:test';
import { createDbClient } from '../src/db/client.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { loadConfig } from '../src/config/env.ts';
import { PostgresOrcamentoRepository } from '../src/repositories/postgresOrcamentoRepository.ts';
import { OrcamentoService } from '../src/services/orcamentoService.ts';
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
  } finally {
    let cleanupError: unknown;
    try {
      if (id) await db.withTransaction(async (tx) => {
        await tx.query('DELETE FROM orcamento_itens WHERE orcamento_id=$1 AND group_id=$2 AND empresa_id=$3', [id, scope.groupId, scope.empresaId]);
        await tx.query('DELETE FROM orcamentos WHERE id=$1 AND group_id=$2 AND empresa_id=$3', [id, scope.groupId, scope.empresaId]);
      });
    } catch (error) { cleanupError = error; }
    finally { await db.end(); }
    if (cleanupError) throw cleanupError;
  }
});

test('R08C PostgreSQL real: auditoria rollbacka create update cancel e sequencia', { skip: !enabled && 'DATABASE_URL not available' }, async () => {
  const db = createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL }));
  const repo = new PostgresOrcamentoRepository(db);
  const ids: string[] = [];
  try {
    const client = await db.query<{ id: string }>('SELECT id FROM cliente_empresas WHERE group_id=$1 AND empresa_id=$2 AND ativo=true LIMIT 1', [scope.groupId, scope.empresaId]);
    assert.ok(client.rows[0]?.id);
    const input = {
      cliente_empresa_id: client.rows[0].id,
      condicao_pagamento_id: SEED_IDS.condicaoPagamentoA,
      validade_em: '2026-10-01T00:00:00.000Z',
      itens: [{
        produto_id: SEED_IDS.produtoA,
        unidade_id: SEED_IDS.unidadeA,
        descricao: 'R08C auditoria sintetica',
        unidade_sigla: 'UN',
        quantidade: '2.000000',
        preco_unitario: '10.000000',
        desconto: '0.000000',
      }],
    };
    const baseline = await repo.create(scope, input);
    ids.push(baseline.id);
    const before = await db.query<{ total: number; max_numero: number }>(
      'SELECT count(*)::int total, COALESCE(MAX(numero::int),0)::int max_numero FROM orcamentos WHERE group_id=$1 AND empresa_id=$2',
      [scope.groupId, scope.empresaId],
    );

    await db.query("CREATE OR REPLACE FUNCTION force_orcamento_audit_failure() RETURNS TRIGGER AS $$ BEGIN IF NEW.entity = 'Orcamento' THEN RAISE EXCEPTION 'forced orcamento audit failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql");
    await db.query('CREATE TRIGGER trg_force_orcamento_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE force_orcamento_audit_failure()');

    const service = new OrcamentoService(
      repo,
      new PostgresAuditRepository(db),
      { assertEmpresaInGroup: async () => undefined },
      { assertAllowed: async () => undefined },
      { getEmpresaLinkById: async () => ({ id: input.cliente_empresa_id, ativo: true, bloqueado: false, habilitado_operacao: true }) } as any,
      { getById: async () => ({ id: SEED_IDS.produtoA, ativo: true, unidade_medida_id: SEED_IDS.unidadeA }) } as any,
      { getById: async () => ({ id: SEED_IDS.unidadeA, ativo: true }) } as any,
      { get: async () => ({ id: SEED_IDS.condicaoPagamentoA, ativo: true }) } as any,
    );
    const ctx = {
      requestId: 'r08c-audit-rollback',
      actorId: SEED_IDS.runtimeActorA,
      groupId: scope.groupId,
      empresaId: scope.empresaId,
    };

    await assert.rejects(service.create(ctx, input), /forced orcamento audit failure/);
    const state = await db.query<{ total: number; max_numero: number }>(
      'SELECT count(*)::int total, COALESCE(MAX(numero::int),0)::int max_numero FROM orcamentos WHERE group_id=$1 AND empresa_id=$2',
      [scope.groupId, scope.empresaId],
    );
    assert.deepEqual(state.rows[0], before.rows[0]);

    await assert.rejects(
      service.update(ctx, baseline.id, { ...input, itens: [{ ...input.itens[0], quantidade: '8.000000' }] }),
      /forced orcamento audit failure/,
    );
    let persisted = await repo.get(scope, baseline.id);
    assert.equal(persisted?.total, baseline.total);
    assert.deepEqual(persisted?.itens, baseline.itens);

    await assert.rejects(service.cancel(ctx, baseline.id), /forced orcamento audit failure/);
    persisted = await repo.get(scope, baseline.id);
    assert.equal(persisted?.status, 'EM_ABERTO');
    assert.equal(persisted?.ativo, true);

    await db.query('DROP TRIGGER trg_force_orcamento_audit_failure ON audit_logs');
    await db.query('DROP FUNCTION force_orcamento_audit_failure()');
    const afterRollback = await repo.create(scope, input);
    ids.push(afterRollback.id);
    assert.equal(Number(afterRollback.numero), before.rows[0].max_numero + 1);
  } finally {
    let cleanupError: unknown;
    try {
      await db.query('DROP TRIGGER IF EXISTS trg_force_orcamento_audit_failure ON audit_logs');
      await db.query('DROP FUNCTION IF EXISTS force_orcamento_audit_failure()');
      if (ids.length) await db.withTransaction(async (tx) => {
        await tx.query('DELETE FROM orcamento_itens WHERE orcamento_id = ANY($1::uuid[]) AND group_id=$2 AND empresa_id=$3', [ids, scope.groupId, scope.empresaId]);
        await tx.query('DELETE FROM orcamentos WHERE id = ANY($1::uuid[]) AND group_id=$2 AND empresa_id=$3', [ids, scope.groupId, scope.empresaId]);
      });
    } catch (error) { cleanupError = error; }
    finally { await db.end(); }
    if (cleanupError) throw cleanupError;
  }
});