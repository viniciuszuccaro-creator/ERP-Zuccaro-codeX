import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { InMemoryProdutoRelationGuard } from '../src/db/produtoRelationGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { createInMemoryProdutoRepo } from '../src/repositories/inMemoryProdutoRepository.ts';
import { ProdutoService } from '../src/services/produtoService.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, '../scripts/seed-dev-synthetic.sql');

type SeedRow = { id: string; groupId: string; empresaId?: string; marcaId?: string; unidadeId?: string; grupoId?: string; setorId?: string };

function parseSeedInserts(sql: string) {
  const marcas = new Map<string, SeedRow>();
  const unidades = new Map<string, SeedRow>();
  const grupos = new Map<string, SeedRow>();
  const setores = new Map<string, SeedRow>();
  const produtos = new Map<string, SeedRow>();

  const marcaRe = /INSERT INTO marcas[\s\S]*?VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/gi;
  let m: RegExpExecArray | null;
  while ((m = marcaRe.exec(sql))) {
    marcas.set(m[1], { id: m[1], groupId: m[2], empresaId: m[3] });
  }

  const unidadeRe = /INSERT INTO unidades_medida[\s\S]*?VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/gi;
  while ((m = unidadeRe.exec(sql))) {
    unidades.set(m[1], { id: m[1], groupId: m[2], empresaId: m[3] });
  }

  const grupoRe = /INSERT INTO grupos_produto[\s\S]*?VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/gi;
  while ((m = grupoRe.exec(sql))) {
    grupos.set(m[1], { id: m[1], groupId: m[2], empresaId: m[3] });
  }

  const setorRe = /INSERT INTO setores_atividade[\s\S]*?VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/gi;
  while ((m = setorRe.exec(sql))) {
    setores.set(m[1], { id: m[1], groupId: m[2], empresaId: m[3] });
  }

  // produtos: id, group, empresa, ..., unidade, ..., grupo_produto, marca, setor (positional after fixed columns)
  const produtoBlocks = sql.split(/INSERT INTO produtos/i).slice(1);
  for (const block of produtoBlocks) {
    const valuesMatch = block.match(/VALUES\s*\(([\s\S]*?)\)\s*ON CONFLICT/i);
    if (!valuesMatch) continue;
    const parts = [...valuesMatch[1].matchAll(/'([^']*)'|true|false|([0-9.]+)/g)].map((x) => x[1] ?? x[0]);
    // Expected order from seed:
    // 0 id, 1 group, 2 empresa, 3 codigo, 4 descricao, 5 nome, 6 tipo_item, 7 eh_bitola,
    // 8 unidade_medida_id, 9 unidade_principal, 10 grupo_produto_id, 11 marca_id, 12 setor_atividade_id
    produtos.set(parts[0], {
      id: parts[0],
      groupId: parts[1],
      empresaId: parts[2],
      unidadeId: parts[8],
      grupoId: parts[10],
      marcaId: parts[11],
      setorId: parts[12],
    });
  }

  return { marcas, unidades, grupos, setores, produtos };
}

test('seed SQL: Produto A/B FKs batem com tenant real (nao com o nome)', () => {
  const sql = readFileSync(seedPath, 'utf8');
  const parsed = parseSeedInserts(sql);

  assert.ok(parsed.marcas.has(SEED_IDS.marcaA));
  assert.equal(parsed.marcas.get(SEED_IDS.marcaA)?.groupId, SEED_IDS.groupA);

  assert.ok(parsed.marcas.has(SEED_IDS.marcaLegacyFalselyNamedB));
  assert.equal(
    parsed.marcas.get(SEED_IDS.marcaLegacyFalselyNamedB)?.groupId,
    SEED_IDS.groupA,
    'legado ffffffff deve permanecer/criar no Grupo A',
  );

  assert.ok(parsed.marcas.has(SEED_IDS.marcaB));
  assert.equal(parsed.marcas.get(SEED_IDS.marcaB)?.groupId, SEED_IDS.groupB);
  assert.equal(parsed.marcas.get(SEED_IDS.marcaB)?.empresaId, SEED_IDS.empresaB);

  const produtoA = parsed.produtos.get(SEED_IDS.produtoA);
  const produtoB = parsed.produtos.get(SEED_IDS.produtoB);
  assert.ok(produtoA);
  assert.ok(produtoB);

  assert.equal(produtoA.groupId, SEED_IDS.groupA);
  assert.equal(produtoA.empresaId, SEED_IDS.empresaA);
  assert.equal(produtoA.marcaId, SEED_IDS.marcaA);
  assert.equal(produtoA.unidadeId, SEED_IDS.unidadeA);
  assert.equal(produtoA.grupoId, SEED_IDS.grupoProdutoA);
  assert.equal(produtoA.setorId, SEED_IDS.setorA);

  assert.equal(produtoB.groupId, SEED_IDS.groupB);
  assert.equal(produtoB.empresaId, SEED_IDS.empresaB);
  assert.equal(produtoB.marcaId, SEED_IDS.marcaB);
  assert.notEqual(produtoB.marcaId, SEED_IDS.marcaLegacyFalselyNamedB);
  assert.equal(produtoB.unidadeId, SEED_IDS.unidadeB);
  assert.equal(produtoB.grupoId, SEED_IDS.grupoProdutoB);
  assert.equal(produtoB.setorId, SEED_IDS.setorB);

  // Todas FKs do produto batem com group do proprio produto
  for (const [label, p] of [['A', produtoA], ['B', produtoB]] as const) {
    assert.equal(parsed.marcas.get(p.marcaId!)?.groupId, p.groupId, `Produto ${label} marca tenant`);
    assert.equal(parsed.unidades.get(p.unidadeId!)?.groupId, p.groupId, `Produto ${label} unidade tenant`);
    assert.equal(parsed.grupos.get(p.grupoId!)?.groupId, p.groupId, `Produto ${label} grupo tenant`);
    assert.equal(parsed.setores.get(p.setorId!)?.groupId, p.groupId, `Produto ${label} setor tenant`);
  }
});

test('seed SQL: ON CONFLICT DO NOTHING presente (idempotencia)', () => {
  const sql = readFileSync(seedPath, 'utf8');
  const inserts = sql.match(/INSERT INTO/gi)?.length ?? 0;
  const conflicts = sql.match(/ON CONFLICT \(id\) DO NOTHING/gi)?.length ?? 0;
  assert.ok(inserts >= 14);
  assert.equal(conflicts, inserts);
});

function makeServiceWithSeedRelations(legacyMarcaInGroupA = true) {
  const audit = new InMemoryAuditRepository();
  const tenant = new InMemoryTenantGuard();
  tenant.link(SEED_IDS.empresaA, SEED_IDS.groupA);
  tenant.link(SEED_IDS.empresaB, SEED_IDS.groupB);
  const relations = new InMemoryProdutoRelationGuard();
  relations.linkMarca(SEED_IDS.marcaA, SEED_IDS.groupA);
  if (legacyMarcaInGroupA) {
    relations.linkMarca(SEED_IDS.marcaLegacyFalselyNamedB, SEED_IDS.groupA);
  }
  relations.linkMarca(SEED_IDS.marcaB, SEED_IDS.groupB);
  relations.linkUnidade(SEED_IDS.unidadeA, SEED_IDS.groupA);
  relations.linkUnidade(SEED_IDS.unidadeB, SEED_IDS.groupB);
  relations.linkGrupo(SEED_IDS.grupoProdutoA, SEED_IDS.groupA);
  relations.linkGrupo(SEED_IDS.grupoProdutoB, SEED_IDS.groupB);
  relations.linkSetor(SEED_IDS.setorA, SEED_IDS.groupA);
  relations.linkSetor(SEED_IDS.setorB, SEED_IDS.groupB);
  const repo = createInMemoryProdutoRepo();
  const service = new ProdutoService(repo, audit, tenant, relations);
  return { service, repo };
}

test('seed semantico: Produto A/B com FKs corretas; legado ffffffff nao serve ao Grupo B', async () => {
  const { service } = makeServiceWithSeedRelations(true);

  const a = await service.create({
    requestId: 'seed-a',
    groupId: SEED_IDS.groupA,
    empresaId: SEED_IDS.empresaA,
  }, {
    descricao: 'PRODUTO DEV SINTETICO A',
    codigo: 'PROD-A-001',
    marca_id: SEED_IDS.marcaA,
    unidade_medida_id: SEED_IDS.unidadeA,
    grupo_produto_id: SEED_IDS.grupoProdutoA,
    setor_atividade_id: SEED_IDS.setorA,
  });
  assert.equal(a.marca_id, SEED_IDS.marcaA);

  const b = await service.create({
    requestId: 'seed-b',
    groupId: SEED_IDS.groupB,
    empresaId: SEED_IDS.empresaB,
  }, {
    descricao: 'PRODUTO DEV SINTETICO B',
    codigo: 'PROD-B-001',
    marca_id: SEED_IDS.marcaB,
    unidade_medida_id: SEED_IDS.unidadeB,
    grupo_produto_id: SEED_IDS.grupoProdutoB,
    setor_atividade_id: SEED_IDS.setorB,
  });
  assert.equal(b.marca_id, SEED_IDS.marcaB);

  // Negativo: Produto B + marca legado (Grupo A) deve bloquear
  await assert.rejects(
    () => service.create({
      requestId: 'seed-bad',
      groupId: SEED_IDS.groupB,
      empresaId: SEED_IDS.empresaB,
    }, {
      descricao: 'BAD',
      marca_id: SEED_IDS.marcaLegacyFalselyNamedB,
    }),
    (err: unknown) => (err as { code?: string }).code === 'TENANT_FK_MISMATCH',
  );

  // Negativo: Produto B + Marca A → TENANT_FK_MISMATCH
  await assert.rejects(
    () => service.create({
      requestId: 'seed-bad-a',
      groupId: SEED_IDS.groupB,
      empresaId: SEED_IDS.empresaB,
    }, {
      descricao: 'BAD',
      marca_id: SEED_IDS.marcaA,
    }),
    (err: unknown) => (err as { code?: string }).code === 'TENANT_FK_MISMATCH',
  );
});

test('protecao permanece: Produto A + FKs do Grupo B bloqueadas', async () => {
  const { service } = makeServiceWithSeedRelations(true);
  const ctx = {
    requestId: 'neg',
    groupId: SEED_IDS.groupA,
    empresaId: SEED_IDS.empresaA,
  };

  await assert.rejects(
    () => service.create(ctx, { descricao: 'X', marca_id: SEED_IDS.marcaB }),
    (err: unknown) => (err as { code?: string }).code === 'TENANT_FK_MISMATCH',
  );
  await assert.rejects(
    () => service.create(ctx, { descricao: 'X', unidade_medida_id: SEED_IDS.unidadeB }),
    (err: unknown) => (err as { code?: string }).code === 'TENANT_FK_MISMATCH',
  );
  await assert.rejects(
    () => service.create(ctx, { descricao: 'X', grupo_produto_id: SEED_IDS.grupoProdutoB }),
    (err: unknown) => (err as { code?: string }).code === 'TENANT_FK_MISMATCH',
  );
  await assert.rejects(
    () => service.create(ctx, { descricao: 'X', setor_atividade_id: SEED_IDS.setorB }),
    (err: unknown) => (err as { code?: string }).code === 'TENANT_FK_MISMATCH',
  );
});

test('idempotencia semantica: criar duas vezes o mesmo codigo no mesmo tenant conflita; tenants distintos ok', async () => {
  const { service } = makeServiceWithSeedRelations(true);
  await service.create({
    requestId: 'i1',
    groupId: SEED_IDS.groupA,
    empresaId: SEED_IDS.empresaA,
  }, { descricao: 'A', codigo: 'IDEMP-1', marca_id: SEED_IDS.marcaA });

  await assert.rejects(
    () => service.create({
      requestId: 'i2',
      groupId: SEED_IDS.groupA,
      empresaId: SEED_IDS.empresaA,
    }, { descricao: 'A2', codigo: 'IDEMP-1', marca_id: SEED_IDS.marcaA }),
    (err: unknown) => (err as { code?: string }).code === 'CONFLICT',
  );

  const other = await service.create({
    requestId: 'i3',
    groupId: SEED_IDS.groupB,
    empresaId: SEED_IDS.empresaB,
  }, { descricao: 'B', codigo: 'IDEMP-1', marca_id: SEED_IDS.marcaB });
  assert.equal(other.codigo, 'IDEMP-1');
});
