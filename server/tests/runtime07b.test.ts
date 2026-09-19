import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import type { RequestContext } from '../src/audit/types.ts';
import type { DbClient, DbQueryExecutor } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { PostgresTabelaPrecoRepository } from '../src/repositories/postgresTabelaPrecoRepository.ts';
import { TabelaPrecoService } from '../src/services/tabelaPrecoService.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function dbClient(db: PGlite): DbClient {
  return {
    pool: null,
    query: (text, params) => db.query(text, params as never) as never,
    withTransaction: (fn) => db.transaction((tx) => fn({
      query: (text, params) => tx.query(text, params as never) as never,
    } as DbQueryExecutor)),
    checkConnection: async () => true,
    end: async () => db.close(),
  };
}

async function boot() {
  const pg = new PGlite();
  const migrations = join(__dirname, '../migrations');
  for (const file of readdirSync(migrations).filter((name) => /^\d{3}_.*\.sql$/.test(name)).sort()) {
    await pg.exec(
      readFileSync(join(migrations, file), 'utf8')
        .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, ''),
    );
  }
  await pg.exec(readFileSync(join(__dirname, '../scripts/seed-dev-synthetic.sql'), 'utf8'));
  return pg;
}

function service(db: DbClient) {
  const tenant = new InMemoryTenantGuard();
  tenant.link(SEED_IDS.empresaA, SEED_IDS.groupA);
  tenant.link(SEED_IDS.empresaA2, SEED_IDS.groupA);
  tenant.link(SEED_IDS.empresaB, SEED_IDS.groupB);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId: SEED_IDS.runtimeActorA,
    groupId: SEED_IDS.groupA,
    permissions: {
      Cadastros: {
        tabela_preco: [
          'visualizar', 'criar', 'editar', 'inativar', 'restaurar',
          'vincular-empresa', 'gerenciar-itens', 'definir-padrao',
        ],
        cliente_empresa: ['visualizar', 'editar'],
      },
    },
  });
  return new TabelaPrecoService(
    new PostgresTabelaPrecoRepository(db),
    new PostgresAuditRepository(db),
    tenant,
    rbac,
  );
}

const ctxA: RequestContext = {
  requestId: 'runtime07b',
  groupId: SEED_IDS.groupA,
  empresaId: SEED_IDS.empresaA,
  actorId: SEED_IDS.runtimeActorA,
  scopeType: 'empresa',
};

test('013 migration + seed 2x + RLS FORCE + nome ATACADO A/A2', async () => {
  const pg = await boot();
  try {
    await pg.exec(readFileSync(join(__dirname, '../scripts/seed-dev-synthetic.sql'), 'utf8'));
    const count = await pg.query<{ total: number }>('SELECT count(*)::int AS total FROM tabelas_preco');
    assert.equal(count.rows[0]?.total, 2);

    const rls = await pg.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('tabelas_preco','tabela_preco_empresas','tabela_preco_itens')
      ORDER BY c.relname
    `);
    assert.equal(rls.rows.length, 3);
    for (const row of rls.rows) {
      assert.equal(row.relrowsecurity, true);
      assert.equal(row.relforcerowsecurity, true);
    }

    await pg.query(`
      INSERT INTO tabelas_preco (
        id, group_id, empresa_id, codigo, nome, moeda, vigencia_inicio, ativo
      ) VALUES (
        'aaaaaaaa-1111-4111-8111-aaaaaaaaaaa1',
        $1, $2, '000099', 'ATACADO', 'BRL', '2020-01-01', true
      )
    `, [SEED_IDS.groupA, SEED_IDS.empresaA2]);

    await assert.rejects(
      () => pg.query(`
        INSERT INTO tabelas_preco (
          id, group_id, empresa_id, codigo, nome, moeda, vigencia_inicio, ativo
        ) VALUES (
          'aaaaaaaa-1111-4111-8111-aaaaaaaaaaa2',
          $1, $2, '000098', 'ATACADO', 'BRL', '2020-01-01', true
        )
      `, [SEED_IDS.groupA, SEED_IDS.empresaA]),
      /uq_tabelas_preco_origem_nome_ativo|unique/i,
    );

    await pg.exec(`
      CREATE ROLE runtime07b_probe NOLOGIN;
      GRANT SELECT ON tabelas_preco, tabela_preco_empresas, tabela_preco_itens TO runtime07b_probe;
      SET ROLE runtime07b_probe;
    `);
    const denied = await pg.query<{ total: number }>('SELECT count(*)::int AS total FROM tabelas_preco');
    assert.equal(denied.rows[0]?.total, 0);
    await pg.exec(`RESET ROLE`);
  } finally {
    await pg.close();
  }
});

test('CRUD + padrão único + fallback + item produto/unidade + monetário', async () => {
  const pg = await boot();
  const db = dbClient(pg);
  const svc = service(db);
  try {
    const created = await svc.create(ctxA, {
      nome: 'VAREJO A',
      vigencia_inicio: '2024-01-01',
      vigencia_fim: null,
    });
    assert.equal(created.empresa_id, SEED_IDS.empresaA);
    assert.match(created.codigo, /^\d{6}$/);

    const promo = await svc.create(ctxA, {
      nome: 'PROMO A',
      vigencia_inicio: '2024-01-01',
    });
    await svc.setPadrao(ctxA, created.id);
    const swapped = await svc.setPadrao(ctxA, promo.id);
    assert.ok(swapped.empresas.some((e) => e.empresa_id === SEED_IDS.empresaA && e.eh_padrao));

    const list = await svc.listItens(ctxA, SEED_IDS.tabelaPrecoA);
    assert.ok(list.meta.total >= 2);

    await assert.rejects(
      () => svc.createItem(ctxA, SEED_IDS.tabelaPrecoA, {
        produto_id: SEED_IDS.produtoA,
        unidade_medida_id: SEED_IDS.unidadeA,
        preco: '1.234567',
      }),
      /CONFLICT|unique/i,
    );

    await assert.rejects(
      () => svc.createItem(ctxA, SEED_IDS.tabelaPrecoA, {
        produto_id: SEED_IDS.produtoA,
        unidade_medida_id: SEED_IDS.unidadeA,
        preco: '-1',
      }),
      /Validation failed|VALIDATION_ERROR|preco/i,
    );

    await assert.rejects(
      () => svc.createItem(ctxA, SEED_IDS.tabelaPrecoA, {
        produto_id: SEED_IDS.produtoA,
        unidade_medida_id: SEED_IDS.unidadeA,
        preco: '1.1234567',
      }),
      /Validation failed|VALIDATION_ERROR|scale/i,
    );

    const resolved = await svc.resolvePrice(ctxA, {
      clienteEmpresaTabelaId: SEED_IDS.tabelaPrecoA,
      produtoId: SEED_IDS.produtoA,
      unidadeMedidaId: SEED_IDS.unidadeA,
      businessDate: '2024-06-01',
    });
    assert.ok(resolved);
    assert.equal(resolved?.origem_resolucao, 'cliente_empresa');

    const missing = await svc.resolvePrice(ctxA, {
      produtoId: SEED_IDS.produtoA,
      unidadeMedidaId: '00000000-0000-4000-8000-000000000099',
      businessDate: '2024-06-01',
    });
    assert.equal(missing, null);

    await assert.rejects(
      () => svc.create(ctxA, {
        nome: 'X',
        vigencia_inicio: '2024-01-01',
        group_id: SEED_IDS.groupB,
      }),
      /Validation failed|VALIDATION_ERROR/,
    );
  } finally {
    await pg.close();
  }
});

test('cross-group SQL + inativação bloqueada + concorrência código', async () => {
  const pg = await boot();
  try {
    await assert.rejects(
      () => pg.query(`
        INSERT INTO tabela_preco_itens (
          group_id, tabela_preco_id, produto_id, unidade_medida_id, preco
        ) VALUES ($1, $2, $3, $4, 1)
      `, [SEED_IDS.groupA, SEED_IDS.tabelaPrecoA, SEED_IDS.produtoB, SEED_IDS.unidadeA]),
      /TENANT_FK_MISMATCH/,
    );

    await assert.rejects(
      () => pg.query(`
        UPDATE cliente_empresas
        SET tabela_preco_id = $1
        WHERE cliente_id = $2 AND empresa_id = $3
      `, [SEED_IDS.tabelaPrecoB, SEED_IDS.clientePjA, SEED_IDS.empresaA]),
      /TABELA_PRECO_NOT_AUTHORIZED|TENANT/,
    );

    const db = dbClient(pg);
    const svc = service(db);
    await assert.rejects(() => svc.softDelete(ctxA, SEED_IDS.tabelaPrecoA), /TABELA_PRECO_IN_USE|empresa default|referenced/i);

    const codes = await Promise.all([
      pg.query<{ codigo: string }>(`SELECT reserve_entity_codigo($1,'TabelaPreco',6) AS codigo`, [SEED_IDS.groupA]),
      pg.query<{ codigo: string }>(`SELECT reserve_entity_codigo($1,'TabelaPreco',6) AS codigo`, [SEED_IDS.groupA]),
    ]);
    assert.notEqual(codes[0].rows[0]?.codigo, codes[1].rows[0]?.codigo);
  } finally {
    await pg.close();
  }
});

test('RBAC fail-closed sem actor', async () => {
  const pg = await boot();
  const db = dbClient(pg);
  const svc = service(db);
  try {
    await assert.rejects(
      () => svc.list({ ...ctxA, actorId: null }),
      /Permission denied|PERMISSION_DENIED/i,
    );
  } finally {
    await pg.close();
  }
});

test('audit rollback no CREATE de TabelaPreco', async () => {
  const pg = await boot();
  try {
    await pg.exec(`
      CREATE OR REPLACE FUNCTION force_tabela_preco_audit_failure()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'forced audit failure';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_force_tabela_preco_audit_failure
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE PROCEDURE force_tabela_preco_audit_failure();
    `);
    const db = dbClient(pg);
    const svc = service(db);
    const before = await pg.query<{ total: number }>('SELECT count(*)::int AS total FROM tabelas_preco');
    await assert.rejects(
      () => svc.create(ctxA, {
        nome: 'AUDIT FAIL',
        vigencia_inicio: '2024-01-01',
      }),
      /forced audit failure/,
    );
    const after = await pg.query<{ total: number }>('SELECT count(*)::int AS total FROM tabelas_preco');
    assert.equal(after.rows[0]?.total, before.rows[0]?.total);
  } finally {
    await pg.close();
  }
});
