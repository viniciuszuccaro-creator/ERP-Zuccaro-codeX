import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
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

test('owner password recovery targets existing identity and preserves private input on failures', async () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/vps/deploy-owner-access-incidente.sh'), 'utf8');
  const code = source.match(/GATE_JS="\$\(cat <<'JS'\r?\n([\s\S]*?)\r?\nJS/)![1];
  const other = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  async function run(fault = '', password = 'synthetic-password-only') {
    const stages: string[] = [], logs: string[] = [], requests: string[] = [];
    let exitCode = 0;
    await new Promise<void>(resolve => {
      const client = {connect: async () => {}, end: async () => resolve(), query: async (sql: string, args: unknown[]) => {
        let rows: unknown[] = [];
        if (sql.startsWith('SELECT id FROM auth.users')) rows = fault === 'missing' ? [] : [{id:AUTH_OWNER}];
        else if (sql.startsWith('SELECT id,auth_user_id')) rows = [{id:PROFILE_SYNTH, auth_user_id:AUTH_OWNER, group_id:fault==='tenant' ? other : GROUP_ID, ativo:fault!=='inactive',role:fault==='demoted'?'user':'admin',empresa_id:fault==='company'?EMPRESA_ID:null,permissoes:fault==='permissions'?{Comercial:{}}:fault==='wildcard'?{...PERMS,'*':['visualizar']}:PERMS}];
        else if (sql.startsWith('SELECT id,nome_do_grupo')) rows = [{id:GROUP_ID,nome_do_grupo:'Grupo CPA',status:'Ativo'}];
        else if (sql.startsWith('SELECT id,group_id')) rows = [{id:EMPRESA_ID,group_id:GROUP_ID,nome_fantasia:'CPA ferro e aço',status:'Ativa'}, {id:other,group_id:GROUP_ID,nome_fantasia:'3Z LTDA',status:'Ativa'}];
        else if (sql.startsWith('INSERT INTO audit_logs')) {
          const payload = JSON.parse(args[3] as string);
          assert.deepEqual(Object.keys(payload).sort(), ['operation','stage']);
          assert.equal(JSON.stringify(args).includes(password), false);
          if (fault==='intent' && payload.stage==='requested') throw new Error('audit failure');
          if (fault==='completion' && payload.stage==='completed') throw new Error('audit failure');
          stages.push(payload.stage);
        } else throw new Error('unexpected SQL mutation');
        return {rows, rowCount:rows.length};
      }};
      const processMock = {env:{SUPABASE_URL:'http://auth.synthetic', SUPABASE_SERVICE_ROLE_KEY:'synthetic-admin'}, get exitCode(){return exitCode;}, set exitCode(value:number){exitCode=value;}};
      vm.runInNewContext(code, {
        require: (name:string)=>name==='fs'?{readFileSync:()=>['password',OWNER_EMAIL,GROUP_ID,EMPRESA_ID,other,'Synthetic','YES','PASSWORD',password,JSON.stringify(PERMS)].join('\0')}:{Client:class {constructor(){return client;}}},
        process:processMock, console:{log:(v:unknown)=>logs.push(String(v)),error:(v:unknown)=>logs.push(String(v))}, URL, AbortSignal,
        fetch: async (_url:URL, options:{method?:string;body?:string})=>{
          const method=options.method??'GET'; requests.push(method);
          if(method==='PUT') {assert.deepEqual(stages,['requested']);assert.deepEqual(JSON.parse(options.body!),{password});if(fault==='transport') throw new Error('private transport details');}
          return {ok:!(method==='PUT' && fault==='rejected'),json:async()=>{if(method==='PUT' && fault==='json') throw new Error('private invalid response');return {id:fault==='identity'||(method==='PUT'&&fault==='responseIdentity')?AUTH_SYNTH:AUTH_OWNER,email:OWNER_EMAIL,email_confirmed_at:'2026-01-01'};}};
        },
      });
    });
    assert.equal(logs.join('\n').includes(password),false);
    assert.equal(logs.join('\n').includes(OWNER_EMAIL),false);
    assert.equal(logs.join('\n').includes('private transport details'),false);
    return {stages,logs:logs.join('\n'),requests,exitCode};
  }
  const ok=await run(); assert.equal(ok.exitCode,0); assert.deepEqual(ok.requests,['GET','PUT']); assert.deepEqual(ok.stages,['requested','completed']);
  for(const fault of ['missing','tenant','inactive','demoted','company','permissions','wildcard','identity','intent']) {const result=await run(fault);assert.notEqual(result.exitCode,0);assert.equal(result.requests.includes('PUT'),false);}
  assert.equal((await run('', 'short')).requests.length,0);
  const lost=await run('transport');assert.deepEqual(lost.requests,['GET','PUT']);assert.match(lost.logs,/unconfirmed_no_automatic_retry/);
  assert.deepEqual(lost.stages,['requested','unconfirmed']);
  for(const fault of ['json','responseIdentity']) {const result=await run(fault);assert.deepEqual(result.requests,['GET','PUT']);assert.deepEqual(result.stages,['requested','unconfirmed']);assert.match(result.logs,/unconfirmed_no_automatic_retry/);}
  assert.deepEqual((await run('rejected')).stages,['requested','rejected']);
  assert.match((await run('completion')).logs,/password_changed_completion_audit_failed/);
  assert.match(source,/unset PASSWORD PASSWORD_CONFIRM\r?\n\s*\[\[/);
  assert.match(source,/read -r -s -p 'Proprietário: confirme/);
});

test('actual psql COPY loads private JSON without server file privilege', {skip: !process.env.DATABASE_URL}, () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-copy-'));
  const file = path.join(folder, 'synthetic.json');
  const role = `owner_copy_${process.pid}`;
  const payload = {label: "Aspas ' e \" / barra \\ / aço", nested: PERMS};
  fs.writeFileSync(file, JSON.stringify(payload) + '\n', {mode: 0o600});
  try {
    const source = fs.readFileSync(path.join(ROOT, 'scripts/vps/provision-owner-admin-profile.sh'), 'utf8');
    assert.equal(source.includes('pg_read_file'), false);
    const command = source.match(/^\\copy _owner_json[^\r\n]+/m)![0];
    const restoreFormat = source.split('\n').find(line => line.includes("printf '%s\\n' 'BEGIN;'"))!.trim();
    const emitted = spawnSync('bash', ['-c', 'dest_path="$1"; ' + restoreFormat, 'test', file.replaceAll('\\','/')], {encoding:'utf8'});
    assert.equal(emitted.status, 0, emitted.stderr);
    assert.equal(emitted.stdout.split('\n').find(line => line.startsWith('\\copy')), command.replace('/tmp/owner-admin-permissoes.json', file.replaceAll('\\','/')));
    const sql = `BEGIN; CREATE ROLE ${role} NOSUPERUSER NOBYPASSRLS; SET LOCAL ROLE ${role};
SELECT has_function_privilege(current_user, 'pg_read_file(text)', 'EXECUTE');
CREATE TEMP TABLE _owner_json(payload jsonb NOT NULL) ON COMMIT DROP;
${command.replace('/tmp/owner-admin-permissoes.json', file.replaceAll('\\', '/'))}
SELECT payload FROM _owner_json;
ROLLBACK;`;
    const result = spawnSync('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', process.env.DATABASE_URL!], {input: sql, encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.split('\n').includes('f'), 'role cannot read server files');
    const copied = result.stdout.split('\n').find(line => line.startsWith('{'))!;
    assert.deepEqual(JSON.parse(copied), payload);
  } finally {fs.rmSync(folder, {recursive:true, force:true});}
});

test('actual deployment preflight is read-only and blocks unauthorized tenant reuse', async () => {
  const db = new PGlite();
  try {
    await schema(db);
    const other = 'c2c2c2c2-cccc-4ccc-8ccc-c2c2c2c2c2c2';
    await db.exec("ALTER TABLE groups ADD COLUMN nome_do_grupo text, ADD COLUMN status text; ALTER TABLE empresas ADD COLUMN nome_fantasia text, ADD COLUMN razao_social text, ADD COLUMN status text; UPDATE groups SET nome_do_grupo='Grupo CPA',status='Ativo'; UPDATE empresas SET nome_fantasia='CPA ferro e aço',razao_social='CPA ferro e aço',status='Ativa';");
    await db.query("INSERT INTO empresas(id,group_id,nome_fantasia,razao_social,status) VALUES($1,$2,'3Z LTDA','3Z LTDA','Ativa')", [other, GROUP_ID]);
    const source = fs.readFileSync(path.join(ROOT, 'scripts/vps/deploy-owner-access-incidente.sh'), 'utf8');
    const code = source.match(/GATE_JS="\$\(cat <<'JS'\r?\n([\s\S]*?)\r?\nJS/);
    assert.ok(code, 'execute actual deployment gate');
    async function gate(op: string, reuse = 'YES', email = OWNER_EMAIL) {
      const logs: string[] = [];
      let writes = 0;
      await new Promise<void>((resolve, reject) => {
        const client = { connect: async () => {}, query: async (sql: string, args?: unknown[]) => {
          if (/^(INSERT|UPDATE|DELETE|BEGIN|COMMIT|LOCK)/i.test(sql)) writes++;
          const result = await db.query(sql, args);
          return { ...result, rowCount: result.rows.length };
        }, end: async () => { resolve(); } };
        const context = {
          require: (name: string) => name === 'fs' ? { readFileSync: () => [op, email, GROUP_ID, EMPRESA_ID, other, 'Synthetic owner', reuse, 'APPLY', ''].join('\0') } : { Client: class { constructor() { return client; } } },
          process: { env: {}, exitCode: 0 }, console: { log: (value: unknown) => logs.push(String(value)), error: (value: unknown) => logs.push(String(value)) },
        };
        try { vm.runInNewContext(code![1], context); } catch (error) { reject(error); }
      });
      assert.equal(writes, 0);
      assert.equal(logs.join('').includes(email), false);
      return logs.join('\n');
    }
    assert.match(await gate('audit', 'NO'), /owner_auth_count/);
    assert.match(await gate('preflight', 'NO'), /synthetic_tenant_requires_owner_decision/);
    assert.match(await gate('preflight'), /owner_preflight=PASS/);
    assert.match(await gate('preflight', 'YES', 'missing@example.com'), /existing_group_and_auth_required/);
    await db.query("INSERT INTO groups(id,nome_do_grupo,status) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Other','Ativo')");
    await db.query("UPDATE empresas SET group_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' WHERE id=$1", [other]);
    assert.match(await gate('preflight'), /existing_company_mismatch_no_reparent/);
  } finally { await db.close(); }
});

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

test('actual provision SQL group scope and audit failure rollback', async () => {
  const db = new PGlite();
  try {
    await schema(db);
    // Auth is authoritative even when the local profile email has drifted.
    await db.query('UPDATE profiles SET email=$1 WHERE id=$2', ['drifted@example.com', PROFILE_SYNTH]);
    await db.exec('CREATE TABLE audit_logs(group_id uuid, empresa_id uuid, actor_email text, entity text, entity_id text, action text, before_data jsonb, after_data jsonb);');
    const source = fs.readFileSync(path.join(ROOT,'scripts/vps/provision-owner-admin-profile.sh'),'utf8');
    const raw = source.match(/<<'SQL'\r?\n(BEGIN;\r?\n\r?\nCREATE TEMP TABLE _owner_json[\s\S]*?)\r?\nSQL/)!;
    assert.ok(raw,'execute actual shell SQL');
    const variables: Record<string,string> = {owner_email:OWNER_EMAIL,owner_full_name:'Synthetic owner',owner_group_id:GROUP_ID,owner_empresa_id:EMPRESA_ID,synth_email:SYNTH_EMAIL,demote_synth:'YES',owner_scope:'GROUP',expected_owner_admin:'1',expected_synth_admin:'0'};
    const sql = raw[1].replace(/:'([a-z_]+)'/g,(_all,key)=>{assert.ok(key in variables,key);return "'"+variables[key].replaceAll("'","''")+"'";}).replace(/\\copy _owner_json[^\r\n]+/,"INSERT INTO _owner_json VALUES ('"+JSON.stringify(PERMS).replaceAll("'","''")+"'::jsonb);");
    await db.exec(sql);
    const owner = await db.query<{empresa_id:string|null}>('SELECT empresa_id FROM profiles WHERE auth_user_id=$1',[AUTH_OWNER]);
    assert.equal(owner.rows[0].empresa_id,null);
    const audit = await db.query('SELECT before_data,after_data FROM audit_logs');
    assert.equal(audit.rows.length,2);
    const synthAudit = await db.query<{before_data:{role:string},after_data:{role:string}}>(
      'SELECT before_data,after_data FROM audit_logs WHERE entity_id=$1', [PROFILE_SYNTH]);
    assert.equal(synthAudit.rows.length,1);
    assert.equal(synthAudit.rows[0].before_data.role,'admin');
    assert.equal(synthAudit.rows[0].after_data.role,'user');
    assert.equal(JSON.stringify(audit.rows).includes(OWNER_EMAIL),false);
    assert.equal(JSON.stringify(audit.rows).includes('Synthetic owner'),false);
    await db.exec("DELETE FROM audit_logs; DELETE FROM profiles WHERE auth_user_id='"+AUTH_OWNER+"'; UPDATE profiles SET role='admin' WHERE auth_user_id='"+AUTH_SYNTH+"'; ALTER TABLE audit_logs ADD CONSTRAINT fail_audit CHECK(false);");
    await assert.rejects(()=>db.exec(sql));
    await db.exec('ROLLBACK');
    const restored = await db.query('SELECT role FROM profiles WHERE auth_user_id=$1',[AUTH_SYNTH]);
    assert.equal(restored.rows[0].role,'admin');
    const absent = await db.query('SELECT id FROM profiles WHERE auth_user_id=$1',[AUTH_OWNER]);
    assert.equal(absent.rows.length,0);
    await db.query("INSERT INTO profiles(auth_user_id,email,role,ativo,group_id) VALUES($1,$2,'user',true,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')", [AUTH_OWNER, OWNER_EMAIL]);
    await assert.rejects(()=>db.exec(sql), /existing_owner_identity_or_tenant_conflict/);
    await db.exec('ROLLBACK');
    const unchanged = await db.query('SELECT role,group_id FROM profiles WHERE auth_user_id=$1', [AUTH_OWNER]);
    assert.equal(unchanged.rows[0].role, 'user');
    assert.equal(unchanged.rows[0].group_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    await db.query('DELETE FROM profiles WHERE auth_user_id=$1', [AUTH_OWNER]);
    await db.query("UPDATE profiles SET group_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' WHERE id=$1", [PROFILE_SYNTH]);
    await assert.rejects(()=>db.exec(sql), /synth_profile_other_group/);
    await db.exec('ROLLBACK');
    const foreign = await db.query('SELECT role,group_id FROM profiles WHERE id=$1', [PROFILE_SYNTH]);
    assert.equal(foreign.rows[0].role,'admin');
    assert.equal(foreign.rows[0].group_id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    assert.equal((await db.query('SELECT id FROM profiles WHERE auth_user_id=$1',[AUTH_OWNER])).rows.length,0);
    assert.equal((await db.query('SELECT entity_id FROM audit_logs')).rows.length,0);
  } finally {await db.close();}
});
