import assert from 'node:assert/strict';
import test from 'node:test';
import { createPasswordAuthSession } from '../src/services/authSessionService.ts';

test('createPasswordAuthSession troca senha por Bearer e lista perfis ativos', async () => {
  const authUserId = '11111111-1111-4111-8111-111111111111';
  const profileId = '22222222-2222-4222-8222-222222222222';
  const groupId = '33333333-3333-4333-8333-333333333333';
  const empresaId = '44444444-4444-4444-8444-444444444444';

  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        access_token: 'tok_test_abc',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: authUserId, email: 'synth@dev.synthetic.local' },
      };
    },
  });

  const db = {
    async query(sql) {
      if (String(sql).includes('razao_social')) {
        return {
          rows: [{
            id: empresaId,
            group_id: groupId,
            razao_social: 'CPA Ferro e Aco LTDA',
            nome_fantasia: 'CPA ferro e aço',
            status: 'Ativa',
          }, {
            id: '55555555-5555-4555-8555-555555555555',
            group_id: groupId,
            razao_social: '3Z LTDA',
            nome_fantasia: '3Z LTDA',
            status: 'Ativa',
          }],
        };
      }
      return {
        rows: [{
          id: profileId,
          group_id: groupId,
          empresa_id: empresaId,
          empresa_id_raw: null,
          role: 'admin',
          full_name: 'Proprietario Teste',
          group_name: 'Grupo CPA',
          permissoes: {},
        }],
      };
    },
  };

  const session = await createPasswordAuthSession({
    config: {
      authMode: 'supabase_user',
      supabaseUrl: 'http://127.0.0.1:8000',
      supabaseAnonKey: 'anon-test',
    },
    db,
    body: { email: 'synth@dev.synthetic.local', password: 'senha-forte-123' },
    fetchImpl,
  });

  assert.equal(session.accessToken, 'tok_test_abc');
  assert.equal(session.user.id, authUserId);
  assert.equal(session.profiles.length, 1);
  assert.equal(session.profiles[0].groupId, groupId);
  assert.equal(session.profiles[0].empresaId, empresaId);
  assert.equal(session.profiles[0].role, 'admin');
  assert.equal(session.profiles[0].fullName, 'Proprietario Teste');
  assert.equal(session.profiles[0].groupName, 'Grupo CPA');
  assert.equal(session.profiles[0].empresas.length, 2);
  assert.equal(session.profiles[0].empresas[0].nome_fantasia, 'CPA ferro e aço');
  assert.deepEqual(session.profiles[0].permissoes, {});
});

test('resolveBearerAuthSession rejeita token inválido e devolve permissoes do perfil', async () => {
  const { resolveBearerAuthSession } = await import('../src/services/authSessionService.ts');
  await assert.rejects(
    () => resolveBearerAuthSession({
      config: {
        authMode: 'supabase_user',
        supabaseUrl: 'http://127.0.0.1:8000',
        supabaseAnonKey: 'anon-test',
      },
      db: { async query() { return { rows: [] }; } },
      authorizationHeader: undefined,
    }),
    (err) => err?.code === 'AUTH_REQUIRED',
  );

  const authUserId = '11111111-1111-4111-8111-111111111111';
  const profileId = '22222222-2222-4222-8222-222222222222';
  const groupId = '33333333-3333-4333-8333-333333333333';
  const session = await resolveBearerAuthSession({
    config: {
      authMode: 'supabase_user',
      supabaseUrl: 'http://127.0.0.1:8000',
      supabaseAnonKey: 'anon-test',
    },
    db: {
      async query(sql) {
        if (String(sql).includes('razao_social')) {
          return {
            rows: [{
              id: '44444444-4444-4444-8444-444444444444',
              group_id: groupId,
              razao_social: 'Empresa A',
              nome_fantasia: 'Empresa A',
              status: 'Ativa',
            }],
          };
        }
        return {
          rows: [{
            id: profileId,
            group_id: groupId,
            empresa_id: null,
            empresa_id_raw: null,
            role: 'user',
            full_name: 'Comum',
            group_name: 'Grupo Teste',
            permissoes: { Comercial: { pedido: ['visualizar'] } },
          }],
        };
      },
    },
    authorizationHeader: 'Bearer tok_valid',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() { return { id: authUserId, email: 'u@example.com' }; },
    }),
  });
  assert.equal(session.profiles[0].role, 'user');
  assert.deepEqual(session.profiles[0].permissoes, { Comercial: { pedido: ['visualizar'] } });
});

test('createPasswordAuthSession rejeita credenciais inválidas sem vazar detalhes', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 400,
    async json() { return { error: 'invalid_grant', error_description: 'secret' }; },
  });
  await assert.rejects(
    () => createPasswordAuthSession({
      config: {
        authMode: 'supabase_user',
        supabaseUrl: 'http://127.0.0.1:8000',
        supabaseAnonKey: 'anon-test',
      },
      db: { async query() { return { rows: [] }; } },
      body: { email: 'x@y.com', password: 'senha-forte-123' },
      fetchImpl,
    }),
    (err) => err?.code === 'AUTH_INVALID_CREDENTIALS' && err?.statusCode === 401,
  );
});

// Real SQL + actual middleware: the session list must agree with endpoint authorization.
test('tenant session: company admin A, group owner A/B, inactive and cross-group denied', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { resolveBearerAuthSession } = await import('../src/services/authSessionService.ts');
  const { createSupabaseAuthMiddleware } = await import('../src/middleware/requestContext.ts');
  const db = new PGlite();
  const user = '11111111-1111-4111-8111-111111111111';
  const actor = '22222222-2222-4222-8222-222222222222';
  const group = '33333333-3333-4333-8333-333333333333';
  const a = '44444444-4444-4444-8444-444444444444';
  const b = '55555555-5555-4555-8555-555555555555';
  const other = '66666666-6666-4666-8666-666666666666';
  const c = '77777777-7777-4777-8777-777777777777';
  try {
    await db.exec(`CREATE TABLE groups(id uuid, nome_do_grupo text);
      CREATE TABLE empresas(id uuid, group_id uuid, razao_social text, nome_fantasia text, status text);
      CREATE TABLE profiles(id uuid, auth_user_id uuid, group_id uuid, empresa_id uuid, role text, full_name text, permissoes jsonb, ativo boolean);`);
    await db.query('INSERT INTO groups VALUES ($1,$2),($3,$4)', [group,'Synthetic group',other,'Other']);
    for (const [id,g] of [[a,group],[b,group],[c,other]]) await db.query("INSERT INTO empresas VALUES($1,$2,'Synthetic','Synthetic','Ativa')",[id,g]);
    await db.query("INSERT INTO profiles VALUES($1,$2,$3,$4,'admin','Synthetic','{}',true)",[actor,user,group,a]);
    const fetchImpl = async () => ({ok:true,status:200,json:async()=>({id:user,email:'owner@example.com'})}) as Response;
    const adapter = {query:async(sql:string,params?:unknown[])=>db.query(sql,params)};
    const session = () => resolveBearerAuthSession({config:{authMode:'supabase_user',supabaseUrl:'http://auth.test',supabaseAnonKey:'synthetic'},db:adapter as any,authorizationHeader:'Bearer synthetic',fetchImpl:fetchImpl as typeof fetch});
    const middleware = createSupabaseAuthMiddleware({supabaseUrl:'http://auth.test',anonKey:'synthetic',db:adapter as any,fetchImpl:fetchImpl as typeof fetch});
    const access = (company:string, actorHeader=actor) => new Promise<any>(resolve=>middleware({path:'/api/v1/pedidos',method:'GET',query:{},header:(key:string)=>({authorization:'Bearer synthetic','x-group-id':group,'x-empresa-id':company,'x-actor-id':actorHeader}[key])} as any,{} as any,resolve));
    assert.deepEqual((await session()).profiles[0].empresas.map(e=>e.id),[a]);
    assert.equal(await access(a),undefined);
    assert.equal((await access(b)).code,'ACTOR_SCOPE_DENIED');
    assert.equal((await access(c)).code,'ACTOR_SCOPE_DENIED');
    await db.query('UPDATE profiles SET empresa_id=NULL WHERE id=$1',[actor]);
    const owner = (await session()).profiles[0];
    assert.equal(owner.empresaId,null,'group scope is not a synthetic first-company binding');
    assert.deepEqual(new Set(owner.empresas.map(e=>e.id)),new Set([a,b]));
    assert.equal(await access(a),undefined);
    assert.equal(await access(b),undefined);
    assert.equal((await access(c)).code,'ACTOR_SCOPE_DENIED');
    assert.equal((await access(a,c)).code,'ACTOR_HEADER_MISMATCH');
    await db.query("UPDATE empresas SET status='Inativa' WHERE id=$1",[b]);
    assert.deepEqual((await session()).profiles[0].empresas.map(e=>e.id),[a]);
    assert.equal((await access(b)).code,'ACTOR_SCOPE_DENIED');
  } finally {await db.close();}
});
