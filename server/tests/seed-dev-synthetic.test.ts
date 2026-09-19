import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { InMemoryProdutoRelationGuard } from '../src/db/produtoRelationGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { createInMemoryProdutoRepo } from '../src/repositories/inMemoryProdutoRepository.ts';
import type { Produto } from '../src/repositories/produtoTypes.ts';
import { ProdutoService } from '../src/services/produtoService.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, '../scripts/seed-dev-synthetic.sql');

type SeedRow = {
  id: string;
  groupId: string;
  empresaId?: string;
  marcaId?: string;
  unidadeId?: string;
  grupoId?: string;
  setorId?: string;
  codigo?: string;
  ativo?: boolean;
};

/** IDs sinteticos que o seed pode UPSERT (somente produtos). */
const UPSERTABLE_PRODUCT_IDS = new Set([SEED_IDS.produtoA, SEED_IDS.produtoB]);

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

  const produtoBlocks = sql.split(/INSERT INTO produtos/i).slice(1);
  for (const block of produtoBlocks) {
    const valuesMatch = block.match(/VALUES\s*\(([\s\S]*?)\)\s*ON CONFLICT/i);
    if (!valuesMatch) continue;
    const parts = [...valuesMatch[1].matchAll(/'([^']*)'|true|false|([0-9.]+)/g)].map((x) => x[1] ?? x[0]);
    // Colunas: id, group, empresa, codigo, descricao, nome, tipo_item, eh_bitola,
    // unidade_medida_id, unidade_principal, [unidades_secundarias?], grupo, marca, setor...
    const hasSecundarias = valuesMatch[1].includes('::jsonb') || valuesMatch[1].includes('["');
    const offset = hasSecundarias ? 1 : 0;
    produtos.set(parts[0], {
      id: parts[0],
      groupId: parts[1],
      empresaId: parts[2],
      codigo: parts[3],
      unidadeId: parts[8],
      grupoId: parts[10 + offset],
      marcaId: parts[11 + offset],
      setorId: parts[12 + offset],
      ativo: parts.includes('true'),
    });
  }

  return { marcas, unidades, grupos, setores, produtos };
}

/** Simula UPSERT do seed sobre um mapa de produtos (somente IDs sinteticos). */
function applyProdutoSeedUpserts(
  store: Map<string, SeedRow>,
  canonical: Map<string, SeedRow>,
) {
  for (const [id, row] of canonical) {
    if (!UPSERTABLE_PRODUCT_IDS.has(id)) {
      throw new Error(`ID nao autorizado para UPSERT: ${id}`);
    }
    store.set(id, { ...row });
  }
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

  for (const [label, p] of [['A', produtoA], ['B', produtoB]] as const) {
    assert.equal(parsed.marcas.get(p.marcaId!)?.groupId, p.groupId, `Produto ${label} marca tenant`);
    assert.equal(parsed.unidades.get(p.unidadeId!)?.groupId, p.groupId, `Produto ${label} unidade tenant`);
    assert.equal(parsed.grupos.get(p.grupoId!)?.groupId, p.groupId, `Produto ${label} grupo tenant`);
    assert.equal(parsed.setores.get(p.setorId!)?.groupId, p.groupId, `Produto ${label} setor tenant`);
  }
});

test('seed SQL: parents DO NOTHING; Produto A/B e Cliente A/B usam UPSERT convergente', () => {
  const sql = readFileSync(seedPath, 'utf8');
  const codeOnly = sql.replace(/--.*$/gm, '');

  const inserts = codeOnly.match(/INSERT INTO/gi)?.length ?? 0;
  const doNothing = codeOnly.match(/ON CONFLICT \(id\) DO NOTHING/gi)?.length ?? 0;
  const doUpdate = codeOnly.match(/ON CONFLICT \(id\) DO UPDATE SET/gi)?.length ?? 0;

  // R07B (32) + CondiçãoPagamento, vínculo Empresa e parcelas do R08 = 35.
  assert.equal(inserts, 35);
  assert.equal(doNothing, 15, 'parents de R01–04 + Empresa A2 + unidade UN = DO NOTHING');
  assert.equal(doUpdate, 12, 'R08 acrescenta CondiçãoPagamento ao UPSERT por id');

  assert.match(codeOnly, /WHERE produtos\.id = '77777777-aaaa-4aaa-8aaa-777777777777'/);
  assert.match(codeOnly, /WHERE produtos\.id = '88888888-bbbb-4bbb-8bbb-888888888888'/);
  assert.match(codeOnly, /WHERE clientes\.id = '99999999-aaaa-4aaa-8aaa-999999999991'/);
  assert.match(codeOnly, /WHERE clientes\.id = '99999999-bbbb-4bbb-8bbb-999999999993'/);

  // Marca LEGACY nao tem DO UPDATE (nunca mover tenant)
  const marcaBlocks = sql.split(/INSERT INTO marcas\b/i).slice(1);
  const legacyBlock = marcaBlocks.find((b) => b.includes(`'${SEED_IDS.marcaLegacyFalselyNamedB}'`));
  assert.ok(legacyBlock);
  assert.match(legacyBlock!, /ON CONFLICT \(id\) DO NOTHING/i);
  assert.doesNotMatch(legacyBlock!, /DO UPDATE/i);

  // Produto B UPSERT aponta marca canônica
  const produtoBlocks = sql.split(/INSERT INTO produtos\b/i).slice(1);
  const produtoBBlock = produtoBlocks.find((b) => b.includes(`'${SEED_IDS.produtoB}'`));
  assert.ok(produtoBBlock);
  assert.match(produtoBBlock!, /DO UPDATE SET/i);
  assert.match(produtoBBlock!, /marca_id = EXCLUDED\.marca_id/);
  assert.ok(produtoBBlock!.includes(SEED_IDS.marcaB));
  assert.ok(!produtoBBlock!.includes(SEED_IDS.marcaLegacyFalselyNamedB));
});

test('seed R08 mantém condição, vínculos, parcelas e default na mesma transação', () => {
  const sql = readFileSync(seedPath, 'utf8');
  const start = sql.indexOf('-- CONDICOES DE PAGAMENTO (ERP-RUNTIME-08B)');
  assert.ok(start >= 0);
  const block = sql.slice(start);
  const begin = block.indexOf('BEGIN;');
  const commit = block.indexOf('COMMIT;');
  assert.ok(begin >= 0 && commit > begin, 'R08 seed must have a closed transaction');
  const transactional = block.slice(begin, commit);
  assert.match(transactional, /INSERT INTO condicoes_pagamento/);
  assert.match(transactional, /INSERT INTO condicao_pagamento_empresas/);
  assert.match(transactional, /INSERT INTO condicao_pagamento_parcelas/);
  assert.match(transactional, /UPDATE cliente_empresas SET condicao_pagamento_id/);
});

test('seed SQL: Cliente PJ/PF A e PJ B com tenant e documentos sintéticos', () => {
  const sql = readFileSync(seedPath, 'utf8');
  assert.match(sql, new RegExp(SEED_IDS.clientePjA));
  assert.match(sql, new RegExp(SEED_IDS.clientePfA));
  assert.match(sql, new RegExp(SEED_IDS.clientePjB));
  assert.match(sql, /11222333000181/);
  assert.match(sql, /52998224725/);
  assert.match(sql, /34028316000103/);
  assert.match(sql, /entity_code_sequences/);
  assert.match(sql, /INSERT INTO cliente_empresas/);
  assert.match(sql, new RegExp(SEED_IDS.empresaA2));
  assert.match(sql, /Bloqueio sintetico para E2E/);
  assert.match(sql, /ON CONFLICT \(cliente_id, empresa_id\) DO UPDATE SET/);
  assert.match(sql, /INSERT INTO cliente_locais/);
  assert.match(sql, /INSERT INTO cliente_local_finalidades/);
  assert.match(sql, /INSERT INTO obras/);
  assert.match(sql, /INSERT INTO obra_empresas/);
  assert.match(sql, /INSERT INTO obra_locais/);
  assert.doesNotMatch(
    sql.match(/INSERT INTO cliente_local_finalidades[\s\S]*$/)?.[0] ?? '',
    /'OBRA'/,
  );

  // Cliente B: group_id na 2ª coluna do VALUES deve ser Grupo B
  const valuesMatch = sql.match(
    new RegExp(
      `'${SEED_IDS.clientePjB}'\\s*,\\s*'([^']+)'\\s*,\\s*'([^']+)'`,
    ),
  );
  assert.ok(valuesMatch);
  assert.equal(valuesMatch![1], SEED_IDS.groupB);
  assert.equal(valuesMatch![2], SEED_IDS.empresaB);
});

test('partial-state: Produto B com marca legado converge para Marca B REAL (cenarios 1-5)', () => {
  const sql = readFileSync(seedPath, 'utf8');
  const canonical = parseSeedInserts(sql).produtos;
  assert.equal(canonical.get(SEED_IDS.produtoB)?.marcaId, SEED_IDS.marcaB);

  // Cenario 1: banco limpo
  const clean = new Map<string, SeedRow>();
  applyProdutoSeedUpserts(clean, canonical);
  assert.equal(clean.get(SEED_IDS.produtoB)?.marcaId, SEED_IDS.marcaB);
  assert.equal(clean.get(SEED_IDS.produtoA)?.marcaId, SEED_IDS.marcaA);

  // Cenario 2: segunda execucao — sem duplicar, mesmo estado
  const beforeSecond = JSON.stringify([...clean.entries()]);
  applyProdutoSeedUpserts(clean, canonical);
  assert.equal(JSON.stringify([...clean.entries()]), beforeSecond);
  assert.equal(clean.size, 2);

  // Cenario 3: partial-state Produto B com marca LEGACY (Grupo A)
  const partial = new Map<string, SeedRow>([
    [SEED_IDS.produtoB, {
      id: SEED_IDS.produtoB,
      groupId: SEED_IDS.groupB,
      empresaId: SEED_IDS.empresaB,
      codigo: 'PROD-B-001',
      unidadeId: SEED_IDS.unidadeB,
      grupoId: SEED_IDS.grupoProdutoB,
      marcaId: SEED_IDS.marcaLegacyFalselyNamedB,
      setorId: SEED_IDS.setorB,
      ativo: true,
    }],
  ]);
  assert.equal(partial.get(SEED_IDS.produtoB)?.marcaId, SEED_IDS.marcaLegacyFalselyNamedB);
  applyProdutoSeedUpserts(partial, canonical);
  const after = partial.get(SEED_IDS.produtoB)!;
  assert.equal(after.marcaId, SEED_IDS.marcaB, 'reconcilia marca legado → Marca B REAL');
  assert.equal(after.groupId, SEED_IDS.groupB);
  assert.equal(after.empresaId, SEED_IDS.empresaB);
  assert.equal(after.unidadeId, SEED_IDS.unidadeB);
  assert.equal(after.grupoId, SEED_IDS.grupoProdutoB);
  assert.equal(after.setorId, SEED_IDS.setorB);
  assert.equal(after.codigo, 'PROD-B-001');

  // Cenario 4: seed novamente apos reconciliacao
  const snap = JSON.stringify(after);
  applyProdutoSeedUpserts(partial, canonical);
  assert.equal(JSON.stringify(partial.get(SEED_IDS.produtoB)), snap);

  // Cenario 5: registro nao sintetico nao e alterado pelo UPSERT do seed
  const foreignId = '99999999-9999-4999-8999-999999999999';
  const storeWithForeign = new Map<string, SeedRow>([
    [foreignId, {
      id: foreignId,
      groupId: SEED_IDS.groupB,
      empresaId: SEED_IDS.empresaB,
      marcaId: SEED_IDS.marcaB,
      codigo: 'REAL-001',
    }],
  ]);
  applyProdutoSeedUpserts(storeWithForeign, canonical);
  assert.equal(storeWithForeign.get(foreignId)?.codigo, 'REAL-001');
  assert.equal(storeWithForeign.get(foreignId)?.marcaId, SEED_IDS.marcaB);
  assert.ok(storeWithForeign.has(SEED_IDS.produtoA));
  assert.ok(storeWithForeign.has(SEED_IDS.produtoB));
  assert.equal(storeWithForeign.size, 3);
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

test('partial-state via service: update Produto B marca legado → Marca B REAL passa protecao', async () => {
  const { service, repo } = makeServiceWithSeedRelations(true);
  const ts = new Date().toISOString();
  // Simula linha ja existente no DEV com FK inconsistente (como seed parcial antigo)
  const stale: Produto = {
    id: SEED_IDS.produtoB,
    group_id: SEED_IDS.groupB,
    empresa_id: SEED_IDS.empresaB,
    codigo: 'PROD-B-001',
    codigo_barras: null,
    descricao: 'PRODUTO DEV SINTETICO B',
    nome: 'PRODUTO DEV SINTETICO B',
    tipo_item: 'Revenda',
    tipo_aco: null,
    eh_bitola: true,
    peso_teorico_kg_m: 0.963,
    bitola_diametro_mm: 12.5,
    comprimento_barra_padrao_m: 12,
    unidade_medida_id: SEED_IDS.unidadeB,
    unidade_medida: 'KG',
    unidade_principal: 'KG',
    unidades_secundarias: [],
    fatores_conversao: {},
    grupo_produto_id: SEED_IDS.grupoProdutoB,
    grupo_legado: null,
    marca_id: SEED_IDS.marcaLegacyFalselyNamedB,
    setor_atividade_id: SEED_IDS.setorB,
    peso_liquido_kg: 0,
    peso_bruto_kg: 0,
    altura_cm: 0,
    largura_cm: 0,
    comprimento_cm: 0,
    volume_m3: 0,
    ncm: null,
    cest: null,
    origem_mercadoria: null,
    status: 'Ativo',
    foto_produto_url: null,
    ativo: true,
    created_at: ts,
    updated_at: ts,
  };
  repo.seed([stale]);
  assert.equal(
    (await repo.getById({ groupId: SEED_IDS.groupB, empresaId: SEED_IDS.empresaB }, SEED_IDS.produtoB))?.marca_id,
    SEED_IDS.marcaLegacyFalselyNamedB,
  );

  const fixed = await service.update({
    requestId: 'reconcile-b',
    groupId: SEED_IDS.groupB,
    empresaId: SEED_IDS.empresaB,
  }, SEED_IDS.produtoB, {
    marca_id: SEED_IDS.marcaB,
    unidade_medida_id: SEED_IDS.unidadeB,
    grupo_produto_id: SEED_IDS.grupoProdutoB,
    setor_atividade_id: SEED_IDS.setorB,
  });
  assert.equal(fixed.marca_id, SEED_IDS.marcaB);

  // Manter negativo: nao permite voltar para marca do Grupo A
  await assert.rejects(
    () => service.update({
      requestId: 'bad-back',
      groupId: SEED_IDS.groupB,
      empresaId: SEED_IDS.empresaB,
    }, SEED_IDS.produtoB, { marca_id: SEED_IDS.marcaLegacyFalselyNamedB }),
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
