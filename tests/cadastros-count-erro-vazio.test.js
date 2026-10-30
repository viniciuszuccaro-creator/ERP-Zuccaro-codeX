/**
 * Pacote A / #431 — contraprova comportamental:
 * erro ≠ vazio; vazio ≠ falha; parcial ≠ total; negativos cross-tenant;
 * compartilhamento no contrato; Contatos adaptador single-save.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildCadastrosAllCountsFilter,
  fetchCadastrosAllCounts,
  normalizeCadastrosCounts,
  isValidCountValue,
} from '../src/components/cadastros/hooks/cadastrosAllCountsCore.js';
import {
  buildContextFilter,
  COUNT_SHARED_ENTITIES,
} from '../src/components/lib/cadastroCountFilter.js';
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

test('buildContextFilter canônico é compartilhado (useEntityCounts ≡ AllCounts)', () => {
  const args = ['Cliente', 'emp-a', 'grp-1', [{ id: 'emp-a' }, { id: 'emp-b' }]];
  assert.deepEqual(
    buildContextFilter(...args),
    buildCadastrosAllCountsFilter(...args),
  );
  assert.equal(
    fs.readFileSync(path.join(ROOT, 'components/lib/useEntityCounts.jsx'), 'utf8')
      .includes("from \"@/components/lib/cadastroCountFilter.js\""),
    true,
  );
  assert.equal(
    fs.readFileSync(path.join(ROOT, 'components/cadastros/hooks/cadastrosAllCountsCore.js'), 'utf8')
      .includes("from '../../lib/cadastroCountFilter.js'"),
    true,
  );
});

test('filtro de compartilhamento (Cliente) respeita shared no contrato multiempresa', () => {
  assert.equal(COUNT_SHARED_ENTITIES.has('Cliente'), true);
  const groupId = 'grp-synth-001';
  const empresaId = 'emp-synth-cpa';
  const shared = buildContextFilter('Cliente', empresaId, groupId, [{ id: empresaId }]);
  const expected = buildMultiempresaReadFilter({
    groupId,
    empresaId,
    ctxField: 'empresa_id',
    shared: true,
    empresaIdsDoGrupo: [],
    rest: {},
  });
  assert.deepEqual(shared, expected);
  const blob = JSON.stringify(shared);
  assert.match(blob, /empresas_compartilhadas_ids/);
  assert.match(blob, /empresa_dona_id/);
});

test('negativo cross-tenant: filtros de empresas distintas não colapsam', () => {
  const groupId = 'grp-synth-001';
  const a = buildCadastrosAllCountsFilter('Produto', 'emp-synth-cpa', groupId, [
    { id: 'emp-synth-cpa' },
    { id: 'emp-synth-other' },
  ]);
  const b = buildCadastrosAllCountsFilter('Produto', 'emp-synth-other', groupId, [
    { id: 'emp-synth-cpa' },
    { id: 'emp-synth-other' },
  ]);
  assert.notDeepEqual(a, b);
  assert.match(JSON.stringify(a), /emp-synth-cpa/);
  assert.doesNotMatch(JSON.stringify(a), /emp-synth-other/);
  assert.match(JSON.stringify(b), /emp-synth-other/);
  assert.doesNotMatch(JSON.stringify(b), /emp-synth-cpa/);
});

test('negativo cross-grupo: grupo distinto altera filtro fail-closed', () => {
  const empresaId = 'emp-synth-cpa';
  const g1 = buildCadastrosAllCountsFilter('Produto', empresaId, 'grp-a', [{ id: empresaId }]);
  const g2 = buildCadastrosAllCountsFilter('Produto', empresaId, 'grp-b', [{ id: empresaId }]);
  assert.notDeepEqual(g1, g2);
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

test('vazio real permanece distinto de falha (Produto:0 + Marca:0 sem throw)', async () => {
  const invoke = async () => ({ data: { counts: { Produto: 0, Marca: 0 } } });
  const counts = await fetchCadastrosAllCounts({
    invoke,
    empresaId: 'emp-synth-cpa',
    groupId: 'grp-synth-001',
    empresasDoGrupo: [{ id: 'emp-synth-cpa' }],
    entities: ['Produto', 'Marca'],
  });
  assert.deepEqual(counts, { Produto: 0, Marca: 0 });
});

test('parcial ≠ total: chave ausente lança READ_COUNT_PARTIAL (não preenche 0)', () => {
  assert.throws(
    () => normalizeCadastrosCounts({ Produto: 1 }, ['Produto', 'Marca']),
    (err) => err?.code === 'READ_COUNT_PARTIAL' && Array.isArray(err.missing) && err.missing.includes('Marca'),
  );
});

test('valores inválidos não viram total (null/false/\'\'/-1/1.5/overflow)', () => {
  for (const bad of [null, false, '', -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '2', undefined]) {
    assert.equal(isValidCountValue(bad), false, String(bad));
    assert.throws(
      () => normalizeCadastrosCounts({ Produto: bad, Marca: 1 }, ['Produto', 'Marca']),
      (err) => err?.code === 'READ_COUNT_PARTIAL' && err.missing.includes('Produto'),
    );
  }
  assert.equal(isValidCountValue(0), true);
  assert.equal(isValidCountValue(2), true);
  assert.deepEqual(normalizeCadastrosCounts({ Produto: 0, Marca: 2 }, ['Produto', 'Marca']), {
    Produto: 0,
    Marca: 2,
  });
});

test('parcial no batch agregada não vira total (fetch rejeita)', async () => {
  let calls = 0;
  const invoke = async () => {
    calls += 1;
    if (calls === 1) return { data: { counts: { Produto: 3 } } }; // Marca ausente
    return { data: { counts: { Produto: 3, Marca: 1 } } };
  };
  // Primeiro retorno parcial → normalize lança → catch do agregada repropaga PARTIAL
  await assert.rejects(
    () => fetchCadastrosAllCounts({
      invoke,
      empresaId: 'emp-synth-cpa',
      groupId: 'grp-synth-001',
      empresasDoGrupo: [{ id: 'emp-synth-cpa' }],
      entities: ['Produto', 'Marca'],
    }),
    /READ_COUNT_PARTIAL/,
  );
});

test('DEPOIS: mesmo escopo com Produto sintético conhecido retorna n≥1', async () => {
  const SYNTH_PRODUTO_ID = 'prod-synth-known-001';
  const invoke = async (_name, body) => {
    const names = (body?.entities || []).map((e) => e.entityName);
    assert.ok(names.includes('Produto'));
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

test('contrato HTTP countEntities: invoke recebe nome+payload com filtro canônico real', async () => {
  const empresaId = 'emp-synth-cpa';
  const groupId = 'grp-synth-001';
  const empresasDoGrupo = [{ id: empresaId }];
  const entities = ['Produto', 'Cliente', 'Marca'];
  /** @type {{ name: string, body: object }[]} */
  const calls = [];
  const invoke = async (name, body) => {
    calls.push({ name, body });
    assert.equal(name, 'countEntities');
    assert.ok(Array.isArray(body?.entities));
    assert.equal(body.entities.length, entities.length);
    for (const row of body.entities) {
      assert.equal(typeof row.entityName, 'string');
      assert.deepEqual(
        row.filter,
        buildContextFilter(row.entityName, empresaId, groupId, empresasDoGrupo),
        `filtro HTTP de ${row.entityName} deve ser o canônico (não só objeto solto)`,
      );
    }
    return {
      data: {
        counts: Object.fromEntries(entities.map((e, i) => [e, i === 0 ? 1 : i])),
      },
    };
  };
  const counts = await fetchCadastrosAllCounts({
    invoke,
    empresaId,
    groupId,
    empresasDoGrupo,
    entities,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'countEntities');
  assert.deepEqual(counts, { Produto: 1, Cliente: 1, Marca: 2 });
  // Bridge HTTP piloto permanece no facade (não só filtro local)
  const facade = fs.readFileSync(path.join(ROOT, 'api/base44Client.js'), 'utf8');
  assert.match(facade, /countEntitiesTouchesHttpPilot/);
  assert.match(facade, /runHttpPilotAwareCountEntities/);
});

test('resposta tardia de outro escopo é descartável via queryKey (hooks sem placeholder)', () => {
  const all = fs.readFileSync(
    path.join(ROOT, 'components/cadastros/hooks/useCadastrosAllCounts.jsx'),
    'utf8',
  );
  const ent = fs.readFileSync(path.join(ROOT, 'components/lib/useEntityCounts.jsx'), 'utf8');
  assert.match(all, /queryKey:\s*\["cadastros-all-counts-v5",\s*empresaId,\s*groupId,\s*grupoEmpIds,\s*actorId\]/);
  assert.match(ent, /const queryKey = \['entityCounts_v5',\s*entitiesKey,\s*groupId,\s*empresaId,\s*grupoEmpIdsKey,\s*actorId\];/);
  assert.match(all, /placeholderData:\s*undefined/);
  assert.match(ent, /placeholderData:\s*undefined/);
  assert.match(ent, /entityCounts_v5/);
  assert.match(ent, /Contagem parcial descartada/);
  // Ator canônico na key (A≠B); sem token em cache/key/log
  assert.match(all, /readErpHttpSession/);
  assert.match(ent, /readErpHttpSession/);
  assert.match(all, /readSessionActorId/);
  assert.match(ent, /readSessionActorId/);
  assert.doesNotMatch(all, /queryKey:[^\n]*token/);
  assert.doesNotMatch(ent, /queryKey:[^\n]*token/);
});

test('falha countEntities não vira KPI via page.length / entityListSorted', () => {
  const ent = fs.readFileSync(path.join(ROOT, 'components/lib/useEntityCounts.jsx'), 'utf8');
  assert.doesNotMatch(ent, /entityListSorted/);
  assert.doesNotMatch(ent, /limit:\s*2000/);
  assert.doesNotMatch(ent, /res\.data\.length/);
  assert.match(ent, /READ_COUNT_UNAVAILABLE/);
  assert.match(ent, /nunca fabricar KPI com page\.length/);
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
  // remainder pin e36231b3 permanece autorizado
  const rem = fs.readFileSync(
    path.join(path.resolve('tests/helpers/scopeListCacheRemainder.js')),
    'utf8',
  );
  assert.match(rem, /lastGoodData\.current = \[\]/);
  assert.match(rem, /everLoadedRef\.current = false/);
});

test('Visualizador propaga countsUnavailable — total ≠ 0 fabricado; cross-page bloqueado', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'components/cadastros/VisualizadorUniversalEntidadeV24.jsx'),
    'utf8',
  );
  assert.match(src, /countsUnavailable/);
  assert.match(src, /countKnown/);
  assert.match(src, /countsUnavailable \? null : Number/);
  assert.match(src, /data-counts-unavailable/);
  assert.match(src, /Contagem indisponível/);
  assert.match(src, /total indisponível/);
  assert.match(src, /if \(!countKnown\) return;/);
  assert.match(src, /Exclusao em lote bloqueada: contagem indisponivel/);
  assert.doesNotMatch(src, /entityListSorted[\s\S]{0,80}totalCount/);
  const rem = fs.readFileSync(
    path.join(path.resolve('tests/helpers/scopeListCacheRemainder.js')),
    'utf8',
  );
  assert.match(rem, /countsUnavailable/);
  assert.match(rem, /visualizer countsUnavailable hook/);
});

test('Contatos comercial: bind imutável, erro≠form vazio, single-save', () => {
  const orphan = fs.readFileSync(
    path.join(ROOT, 'components/comercial/GerenciarContatosCliente.jsx'),
    'utf8',
  );
  assert.match(orphan, /GerenciarContatosClienteForm/);
  assert.match(orphan, /canEdit\("Cadastros", "Cliente"\)/);
  assert.match(orphan, /assertScopeCurrent/);
  assert.equal((orphan.match(/Cliente\.update/g) || []).length, 1);
  assert.equal((orphan.match(/mutateAsync/g) || []).length, 1);
  assert.match(orphan, /onChange=\{handleChange\}/);
  assert.match(orphan, /persistBusy=\{updateClienteMutation\.isPending\}/);
  // Binding ao load; troca invalida geração; erro de leitura não abre Form
  assert.match(orphan, /setBound\(null\)/);
  assert.match(orphan, /editorGen/);
  assert.match(orphan, /data-contatos-read-error/);
  assert.match(orphan, /READ_STALE_SCOPE/);
  assert.match(orphan, /queryKey:\s*\["cliente",\s*clienteId,\s*liveScope\.key\]/);
  // Leitura canônica por id (HTTP GET) — filter({id})+ [0] não transmite id na fachada
  assert.match(orphan, /Cliente\.get\(clienteId\)/);
  assert.doesNotMatch(orphan, /Cliente\.filter\(\{\s*id:\s*clienteId\s*\}\)/);
  assert.doesNotMatch(orphan, /clientes\[0\]/);
  assert.doesNotMatch(orphan, /loadedScopeRef\.current = \{ groupId, empresaId \}/);
  assert.doesNotMatch(orphan, /base44\.entities\.Contato/);
  // Ator canônico na identidade de escopo (Codex residual A→B); sem token em key/cache/log
  assert.match(orphan, /readErpHttpSession/);
  assert.match(orphan, /actorId/);
  assert.match(orphan, /readSessionActorId/);
  assert.match(orphan, /Sessão\/ator alterado/);
  assert.doesNotMatch(orphan, /queryKey:[^\n]*token/);
  assert.doesNotMatch(orphan, /scopePair\([^)]*token/);
  assert.doesNotMatch(orphan, /bound\.token|askedScope\.token|liveScope\.token/);
  // Ausência pós-refetch (success/data=null) invalida bound — não mantém Form antigo
  assert.match(orphan, /data-contatos-read-empty/);
  assert.match(orphan, /if \(!loaded\?\.row \|\| !loaded\?\.askedScope\) \{\s*setBound\(null\)/s);
  assert.match(orphan, /if \(isError\) \{\s*setBound\(null\)/s);
  assert.match(orphan, /String\(loaded\.row\.id\) !== String\(clienteId\)/);
});
