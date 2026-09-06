import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildMultiempresaReadFilter,
  empresaPertenceAoGrupo,
  entityRequiresEmpresaOnWrite,
  normalizeIdentifier,
  normalizeMultiempresaContext,
  recordMatchesEmpresaScope,
  recordMatchesGroupScope,
  resolveEmpresaIdOnWrite,
  toEntityScope,
  toGuardScope,
  userTemAcessoEmpresa,
  userTemAcessoGrupo,
  validateMultiempresaContext,
} from '../src/components/lib/contextoMultiempresaPolicy.js';

test('canonical context accepts Grupo CPA and both companies without mixing scope', () => {
  assert.deepEqual(normalizeMultiempresaContext({ scopeType: 'grupo', groupId: 'grupo-cpa', empresaId: 'cpa-aco' }), {
    groupId: 'grupo-cpa', empresaId: null, scopeType: 'grupo',
  });
  assert.equal(validateMultiempresaContext({ scopeType: 'empresa', groupId: 'grupo-cpa', empresaId: 'cpa-aco' }).valid, true);
  assert.equal(validateMultiempresaContext({ scopeType: 'empresa', groupId: 'grupo-cpa', empresaId: '3z' }).valid, true);
});

test('company scope is invalid without both group and company', () => {
  assert.equal(validateMultiempresaContext({ scopeType: 'empresa', empresaId: 'cpa-aco' }).valid, false);
  assert.equal(validateMultiempresaContext({ scopeType: 'empresa', groupId: 'grupo-cpa' }).valid, false);
});
test('multiempresa identifiers are trimmed and blank aliases fail closed', () => {
  assert.deepEqual(normalizeMultiempresaContext({ scopeType: ' empresa ', groupId: ' grupo-cpa ', empresaId: ' 3z ' }), {
    groupId: 'grupo-cpa', empresaId: '3z', scopeType: 'empresa',
  });
  assert.equal(validateMultiempresaContext({ scopeType: 'empresa', groupId: '   ', empresaId: '3z' }).valid, false);
  assert.deepEqual(toEntityScope({ contexto: 'empresa', group_id: 'grupo-cpa', empresa_id: '   ' }), {});
});

test('entity and guard scopes expose only normalized identifiers', () => {
  assert.deepEqual(toEntityScope({ contexto: 'empresa', grupo_id: 'grupo-cpa', empresa_id: '3z' }), {
    group_id: 'grupo-cpa', empresa_id: '3z',
  });
  assert.deepEqual(toEntityScope({ contexto: 'grupo', group_id: 'grupo-cpa' }), { group_id: 'grupo-cpa' });
  assert.deepEqual(toEntityScope({ group_id: ' grupo-cpa ' }), { group_id: 'grupo-cpa' });
  assert.equal(toGuardScope({ contexto: 'empresa', group_id: 'grupo-cpa' }).__blocked, true);
});
test('normalizeIdentifier trims identifiers and rejects blank values', () => {
  assert.equal(normalizeIdentifier('  local_empresa_3z  '), 'local_empresa_3z');
  assert.equal(normalizeIdentifier('   '), null);
  assert.equal(normalizeIdentifier(null), null);
});

test('recordMatchesEmpresaScope accepts canonical and shared company ownership', () => {
  assert.equal(recordMatchesEmpresaScope({ empresa_id: ' 3z ' }, '3z'), true);
  assert.equal(recordMatchesEmpresaScope({ empresa_dona_id: 'cpa-ferro' }, 'cpa-ferro'), true);
  assert.equal(recordMatchesEmpresaScope({ empresas_compartilhadas_ids: ['3z', 'cpa-ferro'] }, 'cpa-ferro'), true);
  assert.equal(recordMatchesEmpresaScope({ empresa_id: '3z' }, 'cpa-ferro'), false);
  assert.equal(recordMatchesEmpresaScope({ group_id: 'grupo-cpa' }, '3z'), false);
});

test('company read filter requires group membership and company ownership together', () => {
  const filter = buildMultiempresaReadFilter({
    groupId: 'local_grupo_cpa',
    empresaId: 'local_empresa_3z',
    rest: { status: 'Aberto' },
  });
  assert.ok(Array.isArray(filter.$and));
  assert.equal(filter.$and.length, 2);
  assert.equal(filter.status, 'Aberto');
  assert.ok(filter.$and[0].$or.some((item) => item.group_id === 'local_grupo_cpa'));
  assert.ok(filter.$and[1].$or.some((item) => item.empresa_id === 'local_empresa_3z'));
  assert.equal(JSON.stringify(filter).includes('"group_id":"local_grupo_cpa"') && !filter.$or, true);
});

test('group consolidation keeps company ids of the same group without a company-only branch', () => {
  const filter = buildMultiempresaReadFilter({
    groupId: 'local_grupo_cpa',
    empresaIdsDoGrupo: ['local_empresa_3z', 'local_empresa_cpa'],
  });
  assert.ok(filter.$or);
  assert.equal(filter.$and, undefined);
  assert.ok(filter.$or.some((item) => item.group_id === 'local_grupo_cpa'));
  assert.ok(filter.$or.some((item) => item.empresa_id?.$in?.includes('local_empresa_3z')));
});

test('company of another group is rejected for switch and match', () => {
  const user = {
    grupo_atual_id: 'local_grupo_cpa',
    empresa_atual_id: 'local_empresa_3z',
    empresas_vinculadas: [{ empresa_id: 'local_empresa_3z', ativo: true }],
    grupos_vinculados: [{ grupo_id: 'local_grupo_cpa', ativo: true }],
  };
  const outra = { id: 'outra-empresa', group_id: 'outro-grupo' };
  assert.equal(empresaPertenceAoGrupo(outra, 'local_grupo_cpa'), false);
  assert.equal(recordMatchesGroupScope(outra, 'local_grupo_cpa'), false);
  assert.equal(userTemAcessoEmpresa(user, outra), false);
  assert.equal(userTemAcessoGrupo(user, 'outro-grupo'), false);
  assert.equal(userTemAcessoEmpresa(user, { id: 'local_empresa_3z', group_id: 'local_grupo_cpa' }), true);
});

test('fiscal and commercial operations require an emitting company', () => {
  assert.equal(entityRequiresEmpresaOnWrite('NotaFiscal'), true);
  assert.equal(entityRequiresEmpresaOnWrite('Pedido'), true);
  assert.equal(entityRequiresEmpresaOnWrite('Cliente'), false);
  assert.equal(resolveEmpresaIdOnWrite({ group_id: 'local_grupo_cpa' }), null);
  assert.equal(resolveEmpresaIdOnWrite({ empresa_faturamento_id: 'local_empresa_3z' }), 'local_empresa_3z');
});

test('existing multiempresa call sites fail closed against cross-company leak', async () => {
  const policy = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const visual = await readFile(new URL('../src/components/lib/useContextoVisual.jsx', import.meta.url), 'utf8');
  const grupo = await readFile(new URL('../src/components/lib/useContextoGrupoEmpresa.jsx', import.meta.url), 'utf8');

  assert.match(policy, /buildMultiempresaReadFilter/);
  assert.match(policy, /Empresa obrigatoria para operacao nesta entidade/);
  assert.doesNotMatch(policy, /LOCAL_RELAXED_CONTEXT_ENTITIES/);
  assert.match(visual, /buildMultiempresaReadFilter/);
  assert.doesNotMatch(visual, /Empresa\.list\(\)/);
  assert.match(visual, /item\[campo\] === filtroEmpresa \|\| item\.empresa_id === filtroEmpresa/);
  assert.match(grupo, /userTemAcessoEmpresa/);
  assert.match(grupo, /userTemAcessoGrupo/);
  assert.doesNotMatch(grupo, /currentUser\?\.role === 'admin'/);
  assert.doesNotMatch(grupo, /Empresa\.list\(\)/);
  assert.doesNotMatch(grupo, /GrupoEmpresarial\.list\(\)/);
});
