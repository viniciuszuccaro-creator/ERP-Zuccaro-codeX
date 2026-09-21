import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../src/app.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import type { RequestContext } from '../src/audit/types.ts';
import { loadConfig } from '../src/config/env.ts';
import type { DbClient, DbQueryExecutor } from '../src/db/client.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { CLIENTE_FORBIDDEN_FIELDS } from '../src/repositories/clienteTypes.ts';
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

test('meta ERP-RUNTIME-08B prepara CondicaoPagamento sem ativar frontend HTTP', async () => {
  assert.ok(CLIENTE_FORBIDDEN_FIELDS.includes('tabela_preco_id'));
  const config = loadConfig({
    NODE_ENV: 'test',
    ERP_ENV: 'dev',
    PORT: '3080',
    CORS_ORIGINS: 'http://localhost:5173',
    REQUIRE_DATABASE: 'false',
  });
  const { app } = createApp({
    config,
    db: createDbClient(config),
    useMemory: true,
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/meta`);
    assert.equal(response.status, 200);
    const meta = await response.json() as {
      runtime: string;
      tabelaPreco: { frontendHttp: boolean };
      condicaoPagamento: { masterData: boolean; parcelasAtomicas: boolean; frontendHttp: boolean };
      pedido: { backendHttp: boolean; frontendHttp: boolean };
      preparedEntities: string[];
      httpPilotEntities: string[];
      httpEntities: string[];
    };
    assert.equal(meta.runtime, 'ERP-RUNTIME-08B');
    assert.equal(meta.tabelaPreco.frontendHttp, false);
    assert.ok(meta.preparedEntities.includes('TabelaPreco'));
    assert.ok(!meta.httpPilotEntities.includes('TabelaPreco'));
    assert.ok(meta.preparedEntities.includes('CondicaoPagamento'));
    assert.equal(meta.condicaoPagamento.masterData, true);
    assert.equal(meta.condicaoPagamento.parcelasAtomicas, true);
    assert.equal(meta.condicaoPagamento.frontendHttp, false);
    assert.ok(!meta.httpPilotEntities.includes('CondicaoPagamento'));
    assert.ok(!meta.httpEntities.includes('CondicaoPagamento'));
    assert.ok(meta.preparedEntities.includes('Pedido'));
    assert.ok(meta.httpEntities.includes('Pedido'));
    assert.equal(meta.pedido.backendHttp, true);
    assert.equal(meta.pedido.frontendHttp, false);
    assert.ok(!meta.preparedEntities.includes('Orçamento'));
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('unidade não permitida / vigência fora do fallback / zero explícito != missing', async () => {
  const pg = await boot();
  const db = dbClient(pg);
  const svc = service(db);
  try {
    await assert.rejects(
      () => svc.createItem(ctxA, SEED_IDS.tabelaPrecoA, {
        produto_id: SEED_IDS.produtoA,
        unidade_medida_id: SEED_IDS.unidadeB,
        preco: '10',
      }),
      /PRODUTO_UNIDADE_NOT_FOUND|UNIDADE_NOT_ALLOWED|not found|TABELA_PRECO_NOT_FOUND/i,
    );

    const zeroTabela = await svc.create(ctxA, {
      nome: 'ZERO EXPLICITO',
      vigencia_inicio: '2020-01-01',
    });
    await svc.createItem(ctxA, zeroTabela.id, {
      produto_id: SEED_IDS.produtoA,
      unidade_medida_id: SEED_IDS.unidadeA,
      preco: '0',
    });
    await svc.setPadrao(ctxA, zeroTabela.id);
    const zeroResolved = await svc.resolvePrice(ctxA, {
      produtoId: SEED_IDS.produtoA,
      unidadeMedidaId: SEED_IDS.unidadeA,
      businessDate: '2024-06-01',
    });
    assert.ok(zeroResolved);
    assert.equal(Number(zeroResolved?.preco), 0);

    const future = await svc.create(ctxA, {
      nome: 'FUTURA',
      vigencia_inicio: '2099-01-01',
    });
    await svc.createItem(ctxA, future.id, {
      produto_id: SEED_IDS.produtoA,
      unidade_medida_id: SEED_IDS.unidadeUnA,
      preco: '99',
    });
    await svc.setPadrao(ctxA, future.id);
    const futura = await svc.resolvePrice(ctxA, {
      produtoId: SEED_IDS.produtoA,
      unidadeMedidaId: SEED_IDS.unidadeUnA,
      businessDate: '2024-06-01',
    });
    assert.equal(futura, null);
  } finally {
    await pg.close();
  }
});

test('UPDATE cross-tenant SQL bloqueado e linha original intacta', async () => {
  const pg = await boot();
  try {
    const beforeTabela = await pg.query<{
      group_id: string; empresa_id: string; nome: string;
    }>('SELECT group_id, empresa_id, nome FROM tabelas_preco WHERE id=$1', [SEED_IDS.tabelaPrecoA]);
    assert.equal(beforeTabela.rows[0]?.group_id, SEED_IDS.groupA);

    await assert.rejects(
      () => pg.query(
        'UPDATE tabelas_preco SET group_id=$1 WHERE id=$2',
        [SEED_IDS.groupB, SEED_IDS.tabelaPrecoA],
      ),
      /TENANT_FK_MISMATCH|foreign key|violates/i,
    );
    await assert.rejects(
      () => pg.query(
        'UPDATE tabelas_preco SET empresa_id=$1 WHERE id=$2',
        [SEED_IDS.empresaB, SEED_IDS.tabelaPrecoA],
      ),
      /TENANT_FK_MISMATCH|foreign key|violates/i,
    );
    const afterTabela = await pg.query<{
      group_id: string; empresa_id: string; nome: string;
    }>('SELECT group_id, empresa_id, nome FROM tabelas_preco WHERE id=$1', [SEED_IDS.tabelaPrecoA]);
    assert.deepEqual(afterTabela.rows[0], beforeTabela.rows[0]);

    const link = await pg.query<{ id: string; group_id: string; empresa_id: string; tabela_preco_id: string }>(`
      SELECT id, group_id, empresa_id, tabela_preco_id
      FROM tabela_preco_empresas
      WHERE tabela_preco_id=$1 AND empresa_id=$2
    `, [SEED_IDS.tabelaPrecoA, SEED_IDS.empresaA]);
    const linkId = link.rows[0]?.id;
    assert.ok(linkId);
    const beforeLink = link.rows[0];

    await assert.rejects(
      () => pg.query('UPDATE tabela_preco_empresas SET group_id=$1 WHERE id=$2', [SEED_IDS.groupB, linkId]),
      /TENANT_FK_MISMATCH|foreign key|violates/i,
    );
    await assert.rejects(
      () => pg.query('UPDATE tabela_preco_empresas SET empresa_id=$1 WHERE id=$2', [SEED_IDS.empresaB, linkId]),
      /TENANT_FK_MISMATCH|foreign key|violates/i,
    );
    await assert.rejects(
      () => pg.query(
        'UPDATE tabela_preco_empresas SET tabela_preco_id=$1 WHERE id=$2',
        [SEED_IDS.tabelaPrecoB, linkId],
      ),
      /TENANT_FK_MISMATCH|foreign key|violates/i,
    );
    const afterLink = await pg.query<{
      group_id: string; empresa_id: string; tabela_preco_id: string;
    }>('SELECT group_id, empresa_id, tabela_preco_id FROM tabela_preco_empresas WHERE id=$1', [linkId]);
    assert.equal(afterLink.rows[0]?.group_id, beforeLink?.group_id);
    assert.equal(afterLink.rows[0]?.empresa_id, beforeLink?.empresa_id);
    assert.equal(afterLink.rows[0]?.tabela_preco_id, beforeLink?.tabela_preco_id);

    const beforeItem = await pg.query<{
      group_id: string; produto_id: string; unidade_medida_id: string; tabela_preco_id: string; preco: string;
    }>(`
      SELECT group_id, produto_id, unidade_medida_id, tabela_preco_id, preco::text AS preco
      FROM tabela_preco_itens WHERE id=$1
    `, [SEED_IDS.tabelaPrecoItemAKg]);

    await assert.rejects(
      () => pg.query(
        'UPDATE tabela_preco_itens SET group_id=$1 WHERE id=$2',
        [SEED_IDS.groupB, SEED_IDS.tabelaPrecoItemAKg],
      ),
      /TENANT_FK_MISMATCH|foreign key|violates/i,
    );
    await assert.rejects(
      () => pg.query(
        'UPDATE tabela_preco_itens SET produto_id=$1 WHERE id=$2',
        [SEED_IDS.produtoB, SEED_IDS.tabelaPrecoItemAKg],
      ),
      /TENANT_FK_MISMATCH|foreign key|violates/i,
    );
    await assert.rejects(
      () => pg.query(
        'UPDATE tabela_preco_itens SET unidade_medida_id=$1 WHERE id=$2',
        [SEED_IDS.unidadeB, SEED_IDS.tabelaPrecoItemAKg],
      ),
      /TENANT_FK_MISMATCH|foreign key|violates/i,
    );
    await assert.rejects(
      () => pg.query(
        'UPDATE tabela_preco_itens SET tabela_preco_id=$1 WHERE id=$2',
        [SEED_IDS.tabelaPrecoB, SEED_IDS.tabelaPrecoItemAKg],
      ),
      /TENANT_FK_MISMATCH|foreign key|violates/i,
    );
    const afterItem = await pg.query<{
      group_id: string; produto_id: string; unidade_medida_id: string; tabela_preco_id: string; preco: string;
    }>(`
      SELECT group_id, produto_id, unidade_medida_id, tabela_preco_id, preco::text AS preco
      FROM tabela_preco_itens WHERE id=$1
    `, [SEED_IDS.tabelaPrecoItemAKg]);
    assert.deepEqual(afterItem.rows[0], beforeItem.rows[0]);

    const beforeCe = await pg.query<{ tabela_preco_id: string | null; group_id: string; empresa_id: string }>(`
      SELECT tabela_preco_id, group_id, empresa_id FROM cliente_empresas
      WHERE cliente_id=$1 AND empresa_id=$2
    `, [SEED_IDS.clientePjA, SEED_IDS.empresaA]);

    await assert.rejects(
      () => pg.query(`
        UPDATE cliente_empresas SET tabela_preco_id=$1
        WHERE cliente_id=$2 AND empresa_id=$3
      `, [SEED_IDS.tabelaPrecoB, SEED_IDS.clientePjA, SEED_IDS.empresaA]),
      /TABELA_PRECO_NOT_AUTHORIZED|TENANT/i,
    );
    const afterCe = await pg.query<{ tabela_preco_id: string | null }>(`
      SELECT tabela_preco_id FROM cliente_empresas
      WHERE cliente_id=$1 AND empresa_id=$2
    `, [SEED_IDS.clientePjA, SEED_IDS.empresaA]);
    assert.equal(afterCe.rows[0]?.tabela_preco_id, beforeCe.rows[0]?.tabela_preco_id);
  } finally {
    await pg.close();
  }
});

test('padrão concorrente máximo 1 + item duplicado concorrente', async () => {
  const pg = await boot();
  const db = dbClient(pg);
  const svc = service(db);
  try {
    const t1 = await svc.create(ctxA, { nome: 'PADRAO CONC 1', vigencia_inicio: '2020-01-01' });
    const t2 = await svc.create(ctxA, { nome: 'PADRAO CONC 2', vigencia_inicio: '2020-01-01' });

    // Service deixa exatamente um padrão; unique parcial é a barreira final.
    await svc.setPadrao(ctxA, t1.id);
    await assert.rejects(
      () => pg.query(`
        UPDATE tabela_preco_empresas SET eh_padrao=true
        WHERE tabela_preco_id=$1 AND empresa_id=$2
      `, [t2.id, SEED_IDS.empresaA]),
      /uq_tabela_preco_empresas_padrao_ativo|unique/i,
    );
    const padraoAposConstraint = await pg.query<{ total: number }>(`
      SELECT count(*)::int AS total FROM tabela_preco_empresas
      WHERE empresa_id=$1 AND eh_padrao=true AND ativo=true
    `, [SEED_IDS.empresaA]);
    assert.equal(padraoAposConstraint.rows[0]?.total, 1);

    // Service concorrente (PGlite serializa TX; PostgreSQL real permanece gate obrigatório).
    const concurrent = await Promise.allSettled([
      svc.setPadrao(ctxA, t1.id),
      svc.setPadrao(ctxA, t2.id),
    ]);
    assert.ok(concurrent.some((r) => r.status === 'fulfilled'));
    const rejected = concurrent.filter((r) => r.status === 'rejected');
    for (const r of rejected) {
      assert.match(String((r as PromiseRejectedResult).reason), /CONFLICT|unique|padrao|TABELA_PRECO/i);
    }
    const padraoFinal = await pg.query<{ total: number }>(`
      SELECT count(*)::int AS total
      FROM tabela_preco_empresas
      WHERE empresa_id=$1 AND eh_padrao=true AND ativo=true
    `, [SEED_IDS.empresaA]);
    assert.equal(padraoFinal.rows[0]?.total, 1);

    const itemTabela = await svc.create(ctxA, {
      nome: 'ITEM CONC',
      vigencia_inicio: '2020-01-01',
    });
    const itemAttempts = await Promise.allSettled([
      svc.createItem(ctxA, itemTabela.id, {
        produto_id: SEED_IDS.produtoA,
        unidade_medida_id: SEED_IDS.unidadeA,
        preco: '1.50',
      }),
      svc.createItem(ctxA, itemTabela.id, {
        produto_id: SEED_IDS.produtoA,
        unidade_medida_id: SEED_IDS.unidadeA,
        preco: '2.50',
      }),
    ]);
    const itemOk = itemAttempts.filter((r) => r.status === 'fulfilled');
    const itemFail = itemAttempts.filter((r) => r.status === 'rejected');
    assert.equal(itemOk.length, 1);
    assert.equal(itemFail.length, 1);
    assert.match(String((itemFail[0] as PromiseRejectedResult).reason), /CONFLICT|unique|duplicate/i);
    const itemCount = await pg.query<{ total: number; ativos: number }>(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE ativo)::int AS ativos
      FROM tabela_preco_itens
      WHERE tabela_preco_id=$1 AND produto_id=$2 AND unidade_medida_id=$3
    `, [itemTabela.id, SEED_IDS.produtoA, SEED_IDS.unidadeA]);
    assert.equal(itemCount.rows[0]?.total, 1);
    assert.equal(itemCount.rows[0]?.ativos, 1);
  } finally {
    await pg.close();
  }
});

test('audit rollback no UPDATE e setPadrao', async () => {
  const pg = await boot();
  const db = dbClient(pg);
  const svc = service(db);
  try {
    const tabela = await svc.create(ctxA, {
      nome: 'AUDIT UPDATE',
      vigencia_inicio: '2020-01-01',
    });
    const other = await svc.create(ctxA, {
      nome: 'AUDIT PADRAO OTHER',
      vigencia_inicio: '2020-01-01',
    });
    await svc.setPadrao(ctxA, tabela.id);

    await pg.exec(`
      CREATE OR REPLACE FUNCTION force_tabela_preco_audit_failure_upd()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'forced audit failure update';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_force_tabela_preco_audit_failure_upd
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE PROCEDURE force_tabela_preco_audit_failure_upd();
    `);

    await assert.rejects(
      () => svc.update(ctxA, tabela.id, { nome: 'NAO DEVE GRAVAR' }),
      /forced audit failure update/,
    );
    const afterUpdate = await pg.query<{ nome: string }>(
      'SELECT nome FROM tabelas_preco WHERE id=$1',
      [tabela.id],
    );
    assert.equal(afterUpdate.rows[0]?.nome, 'AUDIT UPDATE');

    await assert.rejects(
      () => svc.setPadrao(ctxA, other.id),
      /forced audit failure update/,
    );
    const padrao = await pg.query<{ tabela_preco_id: string }>(`
      SELECT tabela_preco_id FROM tabela_preco_empresas
      WHERE empresa_id=$1 AND eh_padrao=true AND ativo=true
    `, [SEED_IDS.empresaA]);
    assert.equal(padrao.rows.length, 1);
    assert.equal(padrao.rows[0]?.tabela_preco_id, tabela.id);
  } finally {
    await pg.close();
  }
});

test('ClienteEmpresa cross-company + produto/unidade + precisão + vigência', async () => {
  const pg = await boot();
  const db = dbClient(pg);
  const svc = service(db);
  try {
    const exclusivaA = await svc.create(ctxA, {
      nome: 'EXCLUSIVA A',
      vigencia_inicio: '2020-01-01',
    });

    await assert.rejects(
      () => pg.query(`
        UPDATE cliente_empresas
        SET tabela_preco_id=$1
        WHERE cliente_id=$2 AND empresa_id=$3
      `, [exclusivaA.id, SEED_IDS.clientePjA, SEED_IDS.empresaA2]),
      /TABELA_PRECO_NOT_AUTHORIZED/,
    );
    const ceA2Antes = await pg.query<{ tabela_preco_id: string | null }>(`
      SELECT tabela_preco_id FROM cliente_empresas
      WHERE cliente_id=$1 AND empresa_id=$2
    `, [SEED_IDS.clientePjA, SEED_IDS.empresaA2]);
    assert.equal(ceA2Antes.rows[0]?.tabela_preco_id, null);

    await svc.linkEmpresa(ctxA, exclusivaA.id, SEED_IDS.empresaA2);
    await pg.query(`
      UPDATE cliente_empresas
      SET tabela_preco_id=$1
      WHERE cliente_id=$2 AND empresa_id=$3
    `, [exclusivaA.id, SEED_IDS.clientePjA, SEED_IDS.empresaA2]);
    const ceA2Depois = await pg.query<{ tabela_preco_id: string | null }>(`
      SELECT tabela_preco_id FROM cliente_empresas
      WHERE cliente_id=$1 AND empresa_id=$2
    `, [SEED_IDS.clientePjA, SEED_IDS.empresaA2]);
    assert.equal(ceA2Depois.rows[0]?.tabela_preco_id, exclusivaA.id);

    await assert.rejects(
      () => pg.query(`
        UPDATE cliente_empresas
        SET tabela_preco_id=$1
        WHERE cliente_id=$2 AND empresa_id=$3
      `, [SEED_IDS.tabelaPrecoB, SEED_IDS.clientePjA, SEED_IDS.empresaA2]),
      /TABELA_PRECO_NOT_AUTHORIZED/,
    );

    // Produto + unidade: principal KG e secundária UN permitidas; outro Grupo bloqueado.
    const precTabela = await svc.create(ctxA, {
      nome: 'PRECISAO UN',
      vigencia_inicio: '2020-01-01',
    });
    const kg = await svc.createItem(ctxA, precTabela.id, {
      produto_id: SEED_IDS.produtoA,
      unidade_medida_id: SEED_IDS.unidadeA,
      preco: '1.123456',
    });
    assert.equal(kg.preco, '1.123456');
    const un = await svc.createItem(ctxA, precTabela.id, {
      produto_id: SEED_IDS.produtoA,
      unidade_medida_id: SEED_IDS.unidadeUnA,
      preco: '3.5',
    });
    assert.ok(un.id);
    await assert.rejects(
      () => svc.createItem(ctxA, precTabela.id, {
        produto_id: SEED_IDS.produtoB,
        unidade_medida_id: SEED_IDS.unidadeA,
        preco: '1',
      }),
      /PRODUTO_UNIDADE_NOT_FOUND|TABELA_PRECO_NOT_FOUND|not found/i,
    );
    await assert.rejects(
      () => svc.createItem(ctxA, precTabela.id, {
        produto_id: SEED_IDS.produtoA,
        unidade_medida_id: SEED_IDS.unidadeA,
        preco: '1.1234567',
      }),
      /Validation failed|price_scale|scale/i,
    );
    await assert.rejects(
      () => svc.createItem(ctxA, precTabela.id, {
        produto_id: SEED_IDS.produtoA,
        unidade_medida_id: SEED_IDS.unidadeUnA,
        preco: '-0.01',
      }),
      /Validation failed|preco/i,
    );

    // Vigência: específica expirada não cai em tabela não autorizada.
    const expirada = await svc.create(ctxA, {
      nome: 'EXPIRADA CE',
      vigencia_inicio: '2020-01-01',
      vigencia_fim: '2020-12-31',
    });
    await svc.createItem(ctxA, expirada.id, {
      produto_id: SEED_IDS.produtoA,
      unidade_medida_id: SEED_IDS.unidadeA,
      preco: '77',
    });
    await svc.linkEmpresa(ctxA, expirada.id, SEED_IDS.empresaA);
    const vigentePadrao = await svc.create(ctxA, {
      nome: 'VIGENTE PADRAO',
      vigencia_inicio: '2020-01-01',
    });
    await svc.createItem(ctxA, vigentePadrao.id, {
      produto_id: SEED_IDS.produtoA,
      unidade_medida_id: SEED_IDS.unidadeA,
      preco: '11',
    });
    await svc.setPadrao(ctxA, vigentePadrao.id);

    const fromExpiredSpecific = await svc.resolvePrice(ctxA, {
      clienteEmpresaTabelaId: expirada.id,
      produtoId: SEED_IDS.produtoA,
      unidadeMedidaId: SEED_IDS.unidadeA,
      businessDate: '2024-06-01',
    });
    assert.ok(fromExpiredSpecific);
    assert.equal(fromExpiredSpecific?.origem_resolucao, 'padrao_empresa');
    assert.equal(fromExpiredSpecific?.tabela_preco_id, vigentePadrao.id);
    assert.equal(Number(fromExpiredSpecific?.preco), 11);

    // Tabela não autorizada à Empresa A nunca entra no fallback (mesmo passada como específica).
    const onlyA2 = await svc.create({
      ...ctxA,
      empresaId: SEED_IDS.empresaA2,
    }, {
      nome: 'SOMENTE A2',
      vigencia_inicio: '2020-01-01',
    });
    await svc.createItem({
      ...ctxA,
      empresaId: SEED_IDS.empresaA2,
    }, onlyA2.id, {
      produto_id: SEED_IDS.produtoA,
      unidade_medida_id: SEED_IDS.unidadeA,
      preco: '55',
    });
    const unsafe = await svc.resolvePrice(ctxA, {
      clienteEmpresaTabelaId: onlyA2.id,
      produtoId: SEED_IDS.produtoA,
      unidadeMedidaId: SEED_IDS.unidadeA,
      businessDate: '2024-06-01',
    });
    assert.ok(unsafe);
    assert.notEqual(unsafe?.tabela_preco_id, onlyA2.id);
    assert.equal(unsafe?.origem_resolucao, 'padrao_empresa');
  } finally {
    await pg.close();
  }
});
