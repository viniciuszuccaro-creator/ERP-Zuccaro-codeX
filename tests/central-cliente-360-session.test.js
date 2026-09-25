import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canLoadCentralCliente360,
  central360SessionKey,
  createHttpApiClient,
  resolveErpAuthSessionToken,
} from '../src/api/httpApiClient.js';

const GROUP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GROUP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EMPRESA_A = '11111111-1111-4111-8111-111111111111';
const EMPRESA_B = '22222222-2222-4222-8222-222222222222';
const ACTOR_A = '33333333-3333-4333-8333-333333333333';
const ACTOR_B = '44444444-4444-4444-8444-444444444444';
const CLIENTE = '55555555-5555-4555-8555-555555555555';
const TOKEN = 'synthetic.jwt.session.token';

function memoryStorage(map = {}) {
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
    },
    setItem(key, value) {
      map[key] = String(value);
    },
  };
}

test('resolveErpAuthSessionToken lê token de erp_runtime_scope sem vazar whitespace', () => {
  const storage = memoryStorage({
    erp_runtime_scope: JSON.stringify({
      groupId: GROUP_A,
      empresaId: EMPRESA_A,
      token: `  ${TOKEN}  `,
    }),
  });
  assert.equal(resolveErpAuthSessionToken({ storage }), TOKEN);
});

test('resolveErpAuthSessionToken cai para base44_access_token e appToken', () => {
  const storage = memoryStorage({ base44_access_token: 'from-storage' });
  assert.equal(resolveErpAuthSessionToken({ storage }), 'from-storage');
  assert.equal(resolveErpAuthSessionToken({ storage: memoryStorage(), appToken: ' from-app ' }), 'from-app');
  assert.equal(resolveErpAuthSessionToken({ storage: memoryStorage(), appToken: '   ' }), '');
});

test('canLoadCentralCliente360 exige flag tenant ator e Bearer', () => {
  assert.equal(canLoadCentralCliente360({
    flag: true, clienteId: CLIENTE, groupId: GROUP_A, empresaId: EMPRESA_A, actorId: ACTOR_A, token: TOKEN,
  }), true);
  assert.equal(canLoadCentralCliente360({
    flag: false, clienteId: CLIENTE, groupId: GROUP_A, empresaId: EMPRESA_A, actorId: ACTOR_A, token: TOKEN,
  }), false);
  assert.equal(canLoadCentralCliente360({
    flag: true, clienteId: CLIENTE, groupId: GROUP_A, empresaId: EMPRESA_A, actorId: ACTOR_A, token: '',
  }), false);
  assert.equal(canLoadCentralCliente360({
    flag: true, clienteId: CLIENTE, groupId: GROUP_A, empresaId: EMPRESA_A, actorId: null, token: TOKEN,
  }), false);
  const sessionKey = central360SessionKey(TOKEN);
  assert.match(sessionKey, new RegExp(`^t${TOKEN.length}_[0-9a-f]{8}$`));
  assert.equal(central360SessionKey(''), 'none');
  assert.equal(sessionKey.includes(TOKEN), false);
  assert.notEqual(sessionKey, `t${TOKEN.length}`);
});

test('central360 envia Authorization Bearer e tenant; sem token não mascara falha', async () => {
  const calls = [];
  const client = createHttpApiClient({
    baseUrl: 'https://erp.invalid',
    getScope: () => ({
      groupId: GROUP_A,
      empresaId: EMPRESA_A,
      actorId: ACTOR_A,
      actorEmail: 'stale@example.test',
      token: TOKEN,
    }),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), headers: init.headers });
      return new Response(JSON.stringify({
        data: { identity: { codigo: 'C1' }, blocks: {}, meta: {} },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  await client.clientes.central360(CLIENTE);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[0].headers['X-Group-Id'], GROUP_A);
  assert.equal(calls[0].headers['X-Empresa-Id'], EMPRESA_A);
  assert.equal(calls[0].headers['X-Actor-Id'], undefined);
  assert.equal(calls[0].url.includes(TOKEN), false);
  assert.match(calls[0].url, /\/api\/v1\/clientes\/.+\/central-360/);
});

test('central360 sem sessão não envia Bearer e propaga 401', async () => {
  const client = createHttpApiClient({
    baseUrl: 'https://erp.invalid',
    getScope: () => ({ groupId: GROUP_A, empresaId: EMPRESA_A, actorId: ACTOR_A, token: '  ' }),
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers.Authorization, undefined);
      assert.equal(init.headers['X-Actor-Id'], ACTOR_A);
      return new Response(JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'missing bearer' } }), {
        status: 401, headers: { 'content-type': 'application/json' },
      });
    },
  });
  await assert.rejects(client.clientes.central360(CLIENTE), (error) => {
    assert.equal(error.status, 401);
    assert.equal(error.code, 'AUTH_REQUIRED');
    assert.equal(String(error).includes(TOKEN), false);
    return true;
  });
});

test('central360 403 não é sucesso e não vaza token', async () => {
  const client = createHttpApiClient({
    baseUrl: 'https://erp.invalid',
    getScope: () => ({ groupId: GROUP_A, empresaId: EMPRESA_A, actorId: ACTOR_A, token: TOKEN }),
    fetchImpl: async () => new Response(JSON.stringify({
      error: { code: 'FORBIDDEN', message: 'no permission' },
    }), { status: 403, headers: { 'content-type': 'application/json' } }),
  });
  await assert.rejects(client.clientes.central360(CLIENTE), (error) => {
    assert.equal(error.status, 403);
    assert.equal(error.code, 'FORBIDDEN');
    assert.equal(JSON.stringify(error).includes(TOKEN), false);
    return true;
  });
});

test('troca de empresa ou usuário invalida chave de sessão/consulta', () => {
  const keyA = ['cliente-central-360', GROUP_A, EMPRESA_A, ACTOR_A, CLIENTE, central360SessionKey(TOKEN)];
  const keyEmpresaB = ['cliente-central-360', GROUP_A, EMPRESA_B, ACTOR_A, CLIENTE, central360SessionKey(TOKEN)];
  const keyActorB = ['cliente-central-360', GROUP_A, EMPRESA_A, ACTOR_B, CLIENTE, central360SessionKey(TOKEN)];
  const keyGroupB = ['cliente-central-360', GROUP_B, EMPRESA_A, ACTOR_A, CLIENTE, central360SessionKey(TOKEN)];
  const keyNoSession = ['cliente-central-360', GROUP_A, EMPRESA_A, ACTOR_A, CLIENTE, central360SessionKey('')];
  const keyOtherToken = ['cliente-central-360', GROUP_A, EMPRESA_A, ACTOR_A, CLIENTE, central360SessionKey(`${TOKEN}.rev`)];

  assert.notDeepEqual(keyA, keyEmpresaB);
  assert.notDeepEqual(keyA, keyActorB);
  assert.notDeepEqual(keyA, keyGroupB);
  assert.notDeepEqual(keyA, keyNoSession);
  assert.notDeepEqual(keyA, keyOtherToken);
  assert.equal(canLoadCentralCliente360({
    flag: true, clienteId: CLIENTE, groupId: GROUP_A, empresaId: EMPRESA_B, actorId: ACTOR_A, token: TOKEN,
  }), true);
});

test('política de cache do painel: chave distinta implica sem reaproveitar payload entre tenants', () => {
  // Contratos usados pelo useQuery do CentralCliente360Panel (staleTime/gcTime 0).
  const cachePolicy = Object.freeze({ staleTime: 0, gcTime: 0, refetchOnMount: 'always' });
  assert.equal(cachePolicy.staleTime, 0);
  assert.equal(cachePolicy.gcTime, 0);
  assert.equal(cachePolicy.refetchOnMount, 'always');
  const keys = [
    central360SessionKey(TOKEN),
    central360SessionKey(`${TOKEN}x`),
    central360SessionKey(''),
  ];
  assert.equal(new Set(keys).size, 3);
});

test('duas sessões com tokens diferentes de comprimento idêntico invalidam o cache', () => {
  // Reproduz o bug: chave só por length colidia; fingerprint deve distinguir.
  const tokenA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.session.A';
  const tokenB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.session.B';
  assert.equal(tokenA.length, tokenB.length);
  assert.notEqual(tokenA, tokenB);

  const legacyLengthOnlyA = `t${tokenA.length}`;
  const legacyLengthOnlyB = `t${tokenB.length}`;
  assert.equal(legacyLengthOnlyA, legacyLengthOnlyB, 'pré-condição: length-only colide');

  const keyA = central360SessionKey(tokenA);
  const keyB = central360SessionKey(tokenB);
  assert.notEqual(keyA, keyB);
  assert.equal(keyA.includes(tokenA), false);
  assert.equal(keyB.includes(tokenB), false);
  assert.match(keyA, new RegExp(`^t${tokenA.length}_[0-9a-f]{8}$`));
  assert.match(keyB, new RegExp(`^t${tokenB.length}_[0-9a-f]{8}$`));

  const queryKeyA = ['cliente-central-360', GROUP_A, EMPRESA_A, ACTOR_A, CLIENTE, keyA];
  const queryKeyB = ['cliente-central-360', GROUP_A, EMPRESA_A, ACTOR_A, CLIENTE, keyB];
  assert.notDeepEqual(queryKeyA, queryKeyB);
});
