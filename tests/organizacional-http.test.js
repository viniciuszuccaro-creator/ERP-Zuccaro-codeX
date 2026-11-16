import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrganizacionalPatch, hydrateOrganizacional, createOrganizacionalHttp } from '../src/api/organizacionalHttp.js';
import { prepareHmlOrganizacionalSqlPermissions } from '../scripts/vps/hml-owner-permissions.mjs';

test('HML SQL plan is physically bound and grants only named columns/policies, with reversal', () => {
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const e = { database: 'hml_test', schema: 'hml_test', role: 'hml_app', schemaOid: '123', clusterIdentifier: '456',
    groupId: ids[0], profileId: ids[1], authUserId: ids[1] };
  const p = prepareHmlOrganizacionalSqlPermissions(e, ids);
  assert.match(p.sql, /pg_control_system/); assert.match(p.sql, /NOT rolbypassrls/);
  assert.match(p.sql, /FOR UPDATE TO "hml_app"/);
  assert.match(p.sql, /current_setting\('app.empresa_id'/);
  assert.doesNotMatch(p.sql, /CREATE ROLE|ALTER ROLE|GRANT ALL|GRANT UPDATE ON|ADD COLUMN|SET role='admin'/i);
  assert.deepEqual(p.columns.empresas, ['razao_social', 'nome_fantasia', 'cnpj', 'updated_at']);
  assert.match(p.reverseSql, /DROP POLICY hml_org_edit/); assert.match(p.reverseSql, /REVOKE UPDATE/);
  for (const patch of [{ database: 'operacional' }, { schema: 'public' }, { role: 'bad;role' }]) {
    assert.throws(() => prepareHmlOrganizacionalSqlPermissions({ ...e, ...patch }, ids));
  }
  assert.throws(() => prepareHmlOrganizacionalSqlPermissions(e, [ids[0]]));
});

test('organizacional adapter preserves omission, exact identity, null and version', async () => {
  const row = hydrateOrganizacional('GrupoEmpresarial', { id: 'g', group_id: 'g', nome_do_grupo: 'Original', observacoes: 'Keep', cnpj_grupo: null,
    version: 'a'.repeat(64), supported_fields: ['nome_do_grupo', 'observacoes', 'cnpj_grupo'] });
  assert.deepEqual(buildOrganizacionalPatch('GrupoEmpresarial', row, { nome: 'New' }), { expected_version: row.version, nome_do_grupo: 'New' });
  assert.deepEqual(buildOrganizacionalPatch('GrupoEmpresarial', row, { descricao: '' }), { expected_version: row.version, observacoes: null });
  assert.throws(() => buildOrganizacionalPatch('GrupoEmpresarial', row, { id: 'other' }), /imutavel/);
  assert.throws(() => hydrateOrganizacional('Empresa', { id: 'partial' }), /incompleta/);
  const calls = [];
  const api = createOrganizacionalHttp('GrupoEmpresarial', async (path, options) => {
    calls.push({ path, options });
    return options?.unwrap === false ? { data: [row], meta: { total: 1 } } : row;
  });
  assert.equal((await api.get('g')).id, 'g');
  assert.equal(await api.count({ id: 'g' }), 1);
  assert.equal(await api.count({ group_id: 'foreign' }), 0);
  await api.update('g', { expected_version: row.version, nome_do_grupo: 'New' });
  assert.equal(calls.at(-1).options.method, 'PATCH');
  await assert.rejects(api.create({}), /nao habilitada/);
  await assert.rejects(api.delete('g'), /especifico/);
  const partial = createOrganizacionalHttp('Empresa', async () => ({ data: [], meta: { total: 1 } }));
  await assert.rejects(partial.list(), /parcial/);
});
