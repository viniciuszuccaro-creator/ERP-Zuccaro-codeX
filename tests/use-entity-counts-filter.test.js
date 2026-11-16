import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildContextFilter as fromCanonical } from '../src/components/lib/cadastroCountFilter.js';
import { buildCadastrosAllCountsFilter } from '../src/components/cadastros/hooks/cadastrosAllCountsCore.js';
import { buildMultiempresaReadFilter } from '../src/components/lib/contextoMultiempresaPolicy.js';

test('Grupo: contador inclui identidade do mestre como a listagem, sem outro grupo', async () => {
  const source = await readFile('src/api/localBase44Client.js', 'utf8');
  const start = source.indexOf('const matchesOperator =');
  const end = source.indexOf('const getCurrentGroupId =', start);
  const matches = Function('isPlainObject', 'getValue', source.slice(start, end) + ';return matchesFilter;')(
    value => Boolean(value && typeof value === 'object' && !Array.isArray(value)),
    (row, field) => row[field],
  );
  for (const empresa of [null, 'emp-a', 'emp-b']) {
    const filter = fromCanonical('GrupoEmpresarial', empresa, 'grp-1', []);
    assert.equal(matches({ id: 'grp-1', nome: 'Grupo autorizado' }, filter), true);
    assert.equal(matches({ id: 'grp-2', nome: 'Outro grupo' }, filter), false);
    assert.deepEqual(filter, buildMultiempresaReadFilter({ groupId: 'grp-1', extraGroupOr: [{ id: 'grp-1' }] }));
    assert.equal(matches({ id: 'grp-1' }, fromCanonical('Empresa', empresa, 'grp-1', [])), false);
  }
});

test('cadastroCountFilter canônico ≡ AllCounts e contrato Visualizador (função real)', () => {
  const args = ['Cliente', 'emp-a', 'grp-1', [{ id: 'emp-a' }, { id: 'emp-b' }]];
  const viaCanonical = fromCanonical(...args);
  const viaAllCounts = buildCadastrosAllCountsFilter(...args);
  assert.deepEqual(viaCanonical, viaAllCounts);
  const expected = buildMultiempresaReadFilter({
    groupId: 'grp-1',
    empresaId: 'emp-a',
    ctxField: 'empresa_id',
    shared: true,
    empresaIdsDoGrupo: [],
    rest: {},
  });
  assert.deepEqual(viaCanonical, expected);
  assert.match(JSON.stringify(viaCanonical), /empresas_compartilhadas_ids/);
});

test('Produto fail-closed e negativos cross-empresa via buildContextFilter real', () => {
  const groupId = 'grp-1';
  const a = fromCanonical('Produto', 'emp-a', groupId, [{ id: 'emp-a' }, { id: 'emp-b' }]);
  const b = fromCanonical('Produto', 'emp-b', groupId, [{ id: 'emp-a' }, { id: 'emp-b' }]);
  assert.notDeepEqual(a, b);
  assert.ok(a.$and);
  const noCtx = fromCanonical('Produto', null, null, []);
  assert.deepEqual(noCtx, { id: '__escopo_multiempresa_obrigatorio__' });
});

test('useEntityCounts reexporta cadastroCountFilter (sem segunda implementação)', async () => {
  const hook = await readFile(new URL('../src/components/lib/useEntityCounts.jsx', import.meta.url), 'utf8');
  assert.match(hook, /from "@\/components\/lib\/cadastroCountFilter\.js"/);
  assert.match(hook, /export \{ SIMPLE_CATALOG, buildContextFilter \}/);
  assert.doesNotMatch(hook, /function buildContextFilter\s*\(/);
  assert.match(hook, /Number\.isSafeInteger/);
});

test('base44Client rota countEntities batch pelo bridge HTTP piloto', async () => {
  const source = await readFile(new URL('../src/api/base44Client.js', import.meta.url), 'utf8');
  assert.match(source, /countEntitiesTouchesHttpPilot/);
  assert.match(source, /runHttpPilotAwareCountEntities/);
  assert.match(source, /badge "Clientes: 0"/);
});
