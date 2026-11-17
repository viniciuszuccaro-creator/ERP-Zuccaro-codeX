import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareHmlOwnerPermissions, prepareHmlOrganizacionalFiscalSchema } from '../scripts/vps/hml-owner-permissions.mjs';

const expected = { database: 'hml_fixture', schema: 'hml_fixture', schemaOid: '1234', clusterIdentifier: '987654',
  profileId: '11111111-1111-4111-8111-111111111111', authUserId: '22222222-2222-4222-8222-222222222222',
  groupId: '33333333-3333-4333-8333-333333333333' };
const before = { id: expected.profileId, auth_user_id: expected.authUserId, group_id: expected.groupId,
  empresa_id: null, role: 'user', ativo: true, permissoes: { Cadastros: { cliente_local: ['visualizar'] } } };
const input = () => ({ before: structuredClone(before), expected: { ...expected },
  requestId: 'HML-owner-grant-fixture0001', approvalRef: 'OWNER_AUTHORIZED_HML_FULL_FIXTURE_20261116' });

test('fiscal capability plan is HML-only, nullable, three columns and no population or new policy', () => {
  const target = { ...expected, role: 'hml_app_fixture' };
  const companies = ['44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'];
  const plan = prepareHmlOrganizacionalFiscalSchema(target, companies);
  assert.equal(plan.operationalAuthorized, false);
  assert.equal(plan.populatesValues, false);
  assert.equal(plan.createsRolesOrPolicies, false);
  assert.equal((plan.sql.match(/ADD COLUMN/g) || []).length, 3);
  assert.match(plan.sql, /NOT rolsuper AND NOT rolbypassrls/);
  assert.match(plan.sql, /GRANT UPDATE \(inscricao_estadual,regime_tributario\)/);
  assert.doesNotMatch(plan.sql, /DEFAULT|CREATE POLICY|ALTER ROLE|INSERT INTO|UPDATE .* SET/);
  assert.match(plan.reverseSql, /FISCAL_VALUES_REQUIRE_AUDITED_CAS_REVERSAL_FIRST/);
  assert.match(plan.reverseSql, /REVOKE UPDATE/);
  assert.throws(() => prepareHmlOrganizacionalFiscalSchema({ ...target, schema: 'public' }, companies));
});

test('HML owner plan reuses exact canonical catalog, retains role and does not execute', () => {
  const result = prepareHmlOwnerPermissions(input());
  assert.deepEqual(result.nextPermissions, JSON.parse(readFileSync(new URL('../scripts/vps/owner-admin-permissoes.json', import.meta.url))));
  assert.equal(result.changesRole, false); assert.equal(result.changesSqlGrants, false);
  assert.equal(result.operationalAuthorized, false);
  for (const key of ['visualizar', 'editar', 'restaurar', 'importar']) assert.ok(result.nextPermissions.Cadastros.cliente_local.includes(key));
  assert.match(result.sql, /FOR UPDATE/); assert.match(result.sql, /to_jsonb\(p\)<>/);
  assert.match(result.sql, /HML_PROFILE_REPLAY_CONFLICT/); assert.match(result.sql, /pg_control_system/);
  assert.match(result.sql, /INSERT INTO "hml_fixture"\.audit_logs/);
  assert.match(result.sql, /search_path TO pg_catalog,"hml_fixture",pg_temp/);
  assert.doesNotMatch(result.sql, /(?<!pg_catalog\.)\b(?:to_jsonb|jsonb_build_object|pg_control_system)\(/);
  assert.doesNotMatch(result.sql, /\b(COMMIT|GRANT|ALTER ROLE|CREATE ROLE|DROP|TRUNCATE)\b/);
  assert.deepEqual(before, input().before);
});

test('HML owner rejects another identity, tenant, company, role, wildcard and lost capabilities', () => {
  for (const mutate of [
    x => { x.expected.database = 'erp_operacional'; }, x => { x.expected.schema = 'public'; },
    x => { x.before.id = expected.authUserId; }, x => { x.before.auth_user_id = expected.groupId; },
    x => { x.before.group_id = expected.profileId; }, x => { x.before.empresa_id = expected.groupId; },
    x => { x.before.role = 'admin'; }, x => { x.before.ativo = false; },
    x => { x.before.permissoes['*'] = ['visualizar']; },
    x => { x.before.permissoes.Cadastros.cliente_local = ['*']; },
    x => { x.before.permissoes.ExistingUnmappedCapability = ['visualizar']; },
    x => { x.requestId = 'unapproved'; }, x => { x.approvalRef = 'general approval'; },
  ]) {
    const changed = input(); mutate(changed); assert.throws(() => prepareHmlOwnerPermissions(changed));
  }
});

test('HML reverse requires original audited receipt and uses CAS without role or tenant overwrite', () => {
  const grant = prepareHmlOwnerPermissions(input());
  const reverseInput = { ...input(), before: { ...before, permissoes: grant.nextPermissions },
    direction: 'reverse', requestId: 'HML-owner-reverse-fixture0001', originalRequestId: grant.requestId,
    restorePermissions: before.permissoes };
  const reverse = prepareHmlOwnerPermissions(reverseInput);
  assert.deepEqual(reverse.nextPermissions, before.permissoes);
  assert.match(reverse.sql, /HML_ORIGINAL_PERMISSION_RECEIPT_REQUIRED/);
  assert.match(reverse.sql, /after_data->'profile'=/);
  assert.match(reverse.sql, /before_data->'profile'->'permissoes'=/);
  assert.doesNotMatch(reverse.sql, /SET role=|SET group_id=|SET auth_user_id=/);
  assert.throws(() => prepareHmlOwnerPermissions({ ...reverseInput, originalRequestId: undefined }));
});
