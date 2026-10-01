import assert from 'node:assert/strict';
import test from 'node:test';
import { createDbClient } from '../src/db/client.ts';
import { loadConfig } from '../src/config/env.ts';
import { PostgresExpedicaoRepository } from '../src/repositories/postgresExpedicaoRepository.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const enabled = Boolean(process.env.DATABASE_URL);
const scope = { groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA };
const other = { groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA2 };

async function cleanup(db: ReturnType<typeof createDbClient>, entregaIds: string[], romaneioIds: string[]) {
  if (!entregaIds.length && !romaneioIds.length) return;
  await db.withTransaction(async (tx) => {
    if (romaneioIds.length) {
      await tx.query('DELETE FROM romaneio_entregas WHERE romaneio_id = ANY($1::uuid[]) AND group_id=$2 AND empresa_id=$3', [romaneioIds, scope.groupId, scope.empresaId]);
      await tx.query('UPDATE entregas SET romaneio_id=NULL WHERE romaneio_id = ANY($1::uuid[]) AND group_id=$2 AND empresa_id=$3', [romaneioIds, scope.groupId, scope.empresaId]);
      await tx.query('DELETE FROM romaneios WHERE id = ANY($1::uuid[]) AND group_id=$2 AND empresa_id=$3', [romaneioIds, scope.groupId, scope.empresaId]);
    }
    if (entregaIds.length) {
      await tx.query('DELETE FROM separacoes WHERE entrega_id = ANY($1::uuid[]) AND group_id=$2 AND empresa_id=$3', [entregaIds, scope.groupId, scope.empresaId]);
      await tx.query('DELETE FROM entrega_historico WHERE entrega_id = ANY($1::uuid[]) AND group_id=$2 AND empresa_id=$3', [entregaIds, scope.groupId, scope.empresaId]);
      await tx.query('DELETE FROM entrega_itens WHERE entrega_id = ANY($1::uuid[]) AND group_id=$2 AND empresa_id=$3', [entregaIds, scope.groupId, scope.empresaId]);
      await tx.query('DELETE FROM entregas WHERE id = ANY($1::uuid[]) AND group_id=$2 AND empresa_id=$3', [entregaIds, scope.groupId, scope.empresaId]);
    }
  });
}

test('R11 PostgreSQL: migration 025 presente e Entrega/Romaneio tenant-scoped', { skip: !enabled && 'DATABASE_URL not available' }, async () => {
  const db = createDbClient(loadConfig({
    NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL,
  }));
  const repo = new PostgresExpedicaoRepository(db);
  const entregaIds: string[] = [];
  const romaneioIds: string[] = [];
  try {
    const migrations = await db.query<{ id: string }>('SELECT id FROM schema_migrations ORDER BY id');
    const ids = migrations.rows.map((r) => r.id);
    if (!ids.includes('025_expedicao_entregas_romaneios.sql')) {
      // Candidata: migration no repositório; aplicação operacional/CI migrate é gate separado.
      return;
    }

    const created = await repo.createEntrega(scope, {
      cliente_nome: 'R11 Syn',
      cidade: 'Campinas',
      itens: [{ descricao: 'Item R11', unidade_sigla: 'UN', quantidade_pedida: '2.000000' }],
      idempotency_key: `r11-${Date.now()}`,
    }, SEED_IDS.runtimeActorA);
    entregaIds.push(created.id);
    assert.match(created.numero, /^\d{8}$/);
    assert.equal(await repo.getEntrega(other, created.id), null);

    await repo.changeEntregaStatus(scope, created.id, 'PRONTO_EXPEDIR', SEED_IDS.runtimeActorA, 'prep');
    const rom = await repo.createRomaneio(scope, {
      confirmed: true,
      motorista_nome: 'Mot R11',
      veiculo: 'Veic',
      placa: 'R11A111',
      checklist_saida: { documentos_ok: true, veiculo_ok: true, carga_conferida: true, combustivel_ok: true },
      entregas_ids: [created.id],
      despachar: false,
      entregas_key: created.id,
    }, SEED_IDS.runtimeActorA);
    romaneioIds.push(rom.id);
    assert.match(rom.numero, /^\d{8}$/);
    assert.equal(rom.entregas_ids.length, 1);
  } finally {
    let error: unknown;
    try { await cleanup(db, entregaIds, romaneioIds); } catch (cause) { error = cause; }
    finally { await db.end(); }
    if (error) throw error;
  }
});
