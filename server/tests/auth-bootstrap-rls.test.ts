import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

import { AUTH_IDS, authTables, authSeed, authColumnGrants, authPolicy } from './helpers/authBootstrapFixture.ts';
test('Auth 042: SELECT only, owner/branch/inactive/foreign identity isolation and no implicit grants',async()=>{
  const db=new PGlite();try{
    await db.exec(authTables+authSeed());const policy=await authPolicy();assert.doesNotMatch(policy,/\b(CREATE ROLE|GRANT|USING\s*\(true\))\b/i);
    await db.exec(policy);await db.exec(policy);await db.exec('CREATE ROLE auth_fixture NOSUPERUSER NOBYPASSRLS;SET ROLE auth_fixture');
    await assert.rejects(db.query('SELECT id FROM profiles'),/permission denied/i);
    await db.exec('RESET ROLE');await db.exec(authColumnGrants('auth_fixture'));await db.exec('SET ROLE auth_fixture');
    assert.equal((await db.query('SELECT id FROM profiles')).rows.length,0);
    for(const [user,count]of [[AUTH_IDS.owner,2],[AUTH_IDS.branch,1],[AUTH_IDS.foreign,0]]as const){
      await db.query("SELECT set_config('app.auth_user_id',$1,false)",[user]);
      assert.equal((await db.query('SELECT id FROM profiles')).rows.length,1);
      assert.equal((await db.query('SELECT id FROM empresas')).rows.length,count);
    }
    await assert.rejects(db.query('UPDATE profiles SET role=\'admin\''),/permission denied/i);
  }finally{await db.close();}
});
