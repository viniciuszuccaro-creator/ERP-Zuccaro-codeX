import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PERMS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts/vps/owner-admin-permissoes.json'), 'utf8'),
);

const OWNER_EMAIL = 'owner@example.com';
const SYNTH_EMAIL = 'synth@example.com';
const GROUP_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const AUTH_OWNER = '11111111-1111-4111-8111-111111111111';
const AUTH_SYNTH = '22222222-2222-4222-8222-222222222222';
const PROFILE_SYNTH = '33333333-3333-4333-8333-333333333333';

async function schema(db: PGlite) {
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text
    );
    CREATE TABLE groups (
      id uuid PRIMARY KEY
    );
    CREATE TABLE empresas (
      id uuid PRIMARY KEY,
      group_id uuid NOT NULL REFERENCES groups(id)
    );
    CREATE TABLE profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      auth_user_id uuid,
      email text,
      full_name text,
      role text,
      ativo boolean DEFAULT true,
      group_id uuid,
      empresa_id uuid,
      permissoes jsonb DEFAULT '{}'::jsonb,
      updated_at timestamptz
    );
  `);
  await db.query('INSERT INTO groups (id) VALUES ($1)', [GROUP_ID]);
  await db.query('INSERT INTO empresas (id, group_id) VALUES ($1, $2)', [EMPRESA_ID, GROUP_ID]);
  await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [AUTH_OWNER, OWNER_EMAIL]);
  await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [AUTH_SYNTH, SYNTH_EMAIL]);
  await db.query(
    `INSERT INTO profiles (id, auth_user_id, email, full_name, role, ativo, group_id, empresa_id, permissoes)
     VALUES ($1, $2, $3, 'Synth', 'admin', true, $4, $5, '{"*":["visualizar"]}'::jsonb)`,
    [PROFILE_SYNTH, AUTH_SYNTH, SYNTH_EMAIL, GROUP_ID, EMPRESA_ID],
  );
}

/** Trecho equivalente ao script: count + SELECT id (sem min(uuid)). */
async function grantOwner(db: PGlite) {
  const authCount = await db.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM auth.users WHERE lower(coalesce(email,'')) = lower($1)`,
    [OWNER_EMAIL],
  );
  assert.equal(authCount.rows[0]?.count, 1);
  const authId = await db.query<{ id: string }>(
    `SELECT id FROM auth.users WHERE lower(coalesce(email,'')) = lower($1) LIMIT 1`,
    [OWNER_EMAIL],
  );
  const vAuthId = authId.rows[0]!.id;

  await db.query('BEGIN');
  try {
    const profileCount = await db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM profiles
       WHERE lower(email) = lower($1) OR auth_user_id = $2`,
      [OWNER_EMAIL, vAuthId],
    );
    if ((profileCount.rows[0]?.count || 0) > 1) throw new Error('owner_profile_must_be_unique');

    if ((profileCount.rows[0]?.count || 0) === 1) {
      await db.query(
        `UPDATE profiles SET auth_user_id=$1, email=lower($2), role='admin', ativo=true,
         group_id=$3, empresa_id=$4, permissoes=$5::jsonb, updated_at=now()
         WHERE lower(email)=lower($2) OR auth_user_id=$1`,
        [vAuthId, OWNER_EMAIL, GROUP_ID, EMPRESA_ID, JSON.stringify(PERMS)],
      );
    } else {
      await db.query(
        `INSERT INTO profiles (auth_user_id, email, full_name, role, ativo, group_id, empresa_id, permissoes)
         VALUES ($1, lower($2), 'Owner', 'admin', true, $3, $4, $5::jsonb)`,
        [vAuthId, OWNER_EMAIL, GROUP_ID, EMPRESA_ID, JSON.stringify(PERMS)],
      );
    }

    await db.query(
      `UPDATE profiles SET role='user', permissoes='{}'::jsonb, updated_at=now()
       WHERE lower(email)=lower($1) OR auth_user_id=$2`,
      [SYNTH_EMAIL, AUTH_SYNTH],
    );
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function snapshotProfiles(db: PGlite) {
  const result = await db.query(
    `SELECT id, auth_user_id, email, full_name, role, ativo, group_id, empresa_id, permissoes
     FROM profiles
     WHERE lower(email) IN (lower($1), lower($2))
     ORDER BY email`,
    [OWNER_EMAIL, SYNTH_EMAIL],
  );
  return result.rows;
}

async function restoreSelective(
  db: PGlite,
  before: Awaited<ReturnType<typeof snapshotProfiles>>,
  ownerExistedBefore: boolean,
) {
  await db.query('BEGIN');
  const keepIds = before.map((r) => String(r.id));
  for (const item of before) {
    const existing = await db.query(`SELECT 1 FROM profiles WHERE id = $1`, [item.id]);
    if (existing.rows.length) {
      await db.query(
        `UPDATE profiles SET auth_user_id=$2, email=$3, full_name=$4, role=$5, ativo=$6,
         group_id=$7, empresa_id=$8, permissoes=$9::jsonb, updated_at=now()
         WHERE id=$1`,
        [
          item.id, item.auth_user_id, item.email, item.full_name, item.role, item.ativo,
          item.group_id, item.empresa_id, JSON.stringify(item.permissoes),
        ],
      );
    } else {
      await db.query(
        `INSERT INTO profiles (id, auth_user_id, email, full_name, role, ativo, group_id, empresa_id, permissoes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [
          item.id, item.auth_user_id, item.email, item.full_name, item.role, item.ativo,
          item.group_id, item.empresa_id, JSON.stringify(item.permissoes),
        ],
      );
    }
  }
  if (!ownerExistedBefore) {
    await db.query(
      `DELETE FROM profiles
       WHERE lower(email)=lower($1)
         AND NOT (id = ANY($2::uuid[]))`,
      [OWNER_EMAIL, keepIds],
    );
  }
  await db.query('COMMIT');
}

test('PGlite: min(uuid) não existe; count+SELECT concede e restore seletivo reverte', async () => {
  const db = new PGlite();
  await schema(db);

  await assert.rejects(
    () => db.query('SELECT min(id) FROM auth.users'),
    (err: any) => /min\(uuid\)|function min/i.test(String(err?.message || err)),
  );

  const before = await snapshotProfiles(db);
  assert.equal(before.length, 1);
  assert.equal(before[0]?.role, 'admin');
  const ownerExistedBefore = before.some((r) => String(r.email).toLowerCase() === OWNER_EMAIL);

  await grantOwner(db);

  const afterGrant = await snapshotProfiles(db);
  assert.equal(afterGrant.length, 2);
  const owner = afterGrant.find((r) => String(r.email).toLowerCase() === OWNER_EMAIL);
  const synth = afterGrant.find((r) => String(r.email).toLowerCase() === SYNTH_EMAIL);
  assert.equal(owner?.role, 'admin');
  assert.equal(Boolean((owner?.permissoes as any)?.['*']), false);
  assert.ok((owner?.permissoes as any)?.Cadastros);
  assert.equal(synth?.role, 'user');

  await restoreSelective(db, before, ownerExistedBefore);
  const afterRestore = await snapshotProfiles(db);
  assert.equal(afterRestore.length, 1);
  assert.equal(afterRestore[0]?.email, SYNTH_EMAIL);
  assert.equal(afterRestore[0]?.role, 'admin');
  assert.deepEqual(afterRestore[0]?.permissoes, before[0]?.permissoes);
});

test('PGlite: falha na TX faz ROLLBACK (sem estado parcial)', async () => {
  const db = new PGlite();
  await schema(db);
  const before = await snapshotProfiles(db);

  try {
    await db.query('BEGIN');
    await db.query(
      `INSERT INTO profiles (auth_user_id, email, full_name, role, ativo, group_id, empresa_id, permissoes)
       VALUES ($1, $2, 'Owner', 'admin', true, $3, $4, $5::jsonb)`,
      [AUTH_OWNER, OWNER_EMAIL, GROUP_ID, EMPRESA_ID, JSON.stringify(PERMS)],
    );
    // Força falha após mutação owner, antes do demote.
    await db.query('SELECT 1 FROM missing_table_force_fail');
    await db.query('COMMIT');
    assert.fail('expected failure');
  } catch {
    try { await db.query('ROLLBACK'); } catch { /* already aborted */ }
  }

  const after = await snapshotProfiles(db);
  assert.equal(after.length, before.length);
  assert.equal(after[0]?.role, 'admin');
});
