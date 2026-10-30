/**
 * Pacote A — contraprova: erro de contagem ≠ vazio; filtro multiempresa alinhado.
 * Registro sintético conhecido no mesmo escopo (before/after).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildCadastrosAllCountsFilter,
  fetchCadastrosAllCounts,
} from '../src/components/cadastros/hooks/cadastrosAllCountsCore.js';
import { buildMultiempresaReadFilter } from '../src/components/lib/contextoMultiempresaPolicy.js';

const ROOT = path.resolve('src');

test('filtro CadastrosAllCounts alinha a multiempresa (Produto empresa+grupo)', () => {
  const groupId = 'grp-synth-001';
  const empresaId = 'emp-synth-cpa';
  const a = buildCadastrosAllCountsFilter('Produto', empresaId, groupId, [{ id: empresaId }]);
  const b = buildMultiempresaReadFilter({
    groupId,
    empresaId,
    ctxField: 'empresa_id',
    shared: false,
    empresaIdsDoGrupo: [],
    rest: {},
  });
  assert.deepEqual(a, b);
  assert.ok(a.$and, 'deve usar $and grupo∧empresa');
  assert.notEqual(JSON.stringify(a), JSON.stringify({ empresa_id: empresaId }));
});

test('ANTES: falha countEntities não vira zero silencioso (contraprova)', async () => {
  const invoke = async () => {
    throw new Error('READ_COUNT_UNAVAILABLE');
  };
  await assert.rejects(
    () => fetchCadastrosAllCounts({
      invoke,
      empresaId: 'emp-synth-cpa',
      groupId: 'grp-synth-001',
      empresasDoGrupo: [{ id: 'emp-synth-cpa' }],
      entities: ['Produto', 'Marca'],
    }),
    /READ_COUNT_UNAVAILABLE/,
  );
});

test('DEPOIS: mesmo escopo com Produto sintético conhecido retorna n≥1', async () => {
  const SYNTH_PRODUTO_ID = 'prod-synth-known-001';
  const invoke = async (_name, body) => {
    const names = (body?.entities || []).map((e) => e.entityName);
    assert.ok(names.includes('Produto'));
    // Filtro do request deve carregar escopo grupo∧empresa (não só empresa_id)
    const produtoFilter = body.entities.find((e) => e.entityName === 'Produto')?.filter;
    assert.ok(produtoFilter?.$and, 'Produto no escopo autorizado usa $and');
    return {
      data: {
        counts: {
          Produto: 1,
          Marca: 2,
        },
        synth_id: SYNTH_PRODUTO_ID,
      },
    };
  };
  const counts = await fetchCadastrosAllCounts({
    invoke,
    empresaId: 'emp-synth-cpa',
    groupId: 'grp-synth-001',
    empresasDoGrupo: [{ id: 'emp-synth-cpa' }],
    entities: ['Produto', 'Marca'],
  });
  assert.equal(counts.Produto, 1);
  assert.equal(counts.Marca, 2);
  assert.notEqual(counts.Produto, 0);
});

test('UI Cadastros distingue erro (—) de zero; banner data-counts-unavailable', () => {
  const page = fs.readFileSync(path.join(ROOT, 'pages/Cadastros.jsx'), 'utf8');
  assert.match(page, /data-counts-unavailable/);
  assert.match(page, /countsUnavailable/);
  assert.match(page, /Contagens indisponíveis por erro de consulta/);

  const badge = fs.readFileSync(path.join(ROOT, 'components/cadastros/GroupCountBadge.jsx'), 'utf8');
  assert.match(badge, /countsUnavailable/);
  assert.match(badge, /não é zero/);

  const hook = fs.readFileSync(
    path.join(ROOT, 'components/cadastros/hooks/useCadastrosAllCounts.jsx'),
    'utf8',
  );
  assert.match(hook, /cadastrosAllCountsCore/);
  assert.match(hook, /countsUnavailable/);
});

test('Visualizador zera lastGoodData na troca de escopo (lista pós-contexto)', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'components/cadastros/VisualizadorUniversalEntidadeV24.jsx'),
    'utf8',
  );
  assert.match(src, /lastGoodData\.current = \[\]/);
  assert.match(src, /everLoadedRef\.current = false/);
  assert.match(src, /Erro ao carregar dados/);
  assert.match(src, /Nenhum registro de/);
});

test('Contatos comercial adapta ao Form canônico (RBAC+scope) sem 3º módulo', () => {
  const orphan = fs.readFileSync(
    path.join(ROOT, 'components/comercial/GerenciarContatosCliente.jsx'),
    'utf8',
  );
  assert.match(orphan, /GerenciarContatosClienteForm/);
  assert.match(orphan, /canEdit\("Cadastros", "Cliente"\)/);
  assert.match(orphan, /assertScopeCurrent/);
});
