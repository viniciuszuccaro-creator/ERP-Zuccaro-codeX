import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

test('mestre local recupera sessao quando snapshot desalinha grupo do perfil', async () => {
  const values = new Map();
  const storage = {
    getItem: (k) => values.get(String(k)) ?? null,
    setItem: (k, v) => values.set(String(k), String(v)),
    removeItem: (k) => values.delete(String(k)),
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  try {
    const { localBase44 } = await server.ssrLoadModule(`/src/api/localBase44Client.js?auth-boot=${Date.now()}`);
    localBase44.__local.reset();
    const db = localBase44.__local.export();
    db.PerfilAcesso = (db.PerfilAcesso || []).map((p) => (
      String(p.id) === 'local_perfil_admin'
        ? { ...p, group_id: 'grupo_importado_x', grupo_id: 'grupo_importado_x', ativo: true }
        : p
    ));
    storage.setItem('erp_integra_local_db_v1', JSON.stringify(db));
    storage.removeItem('erp_integra_local_auth_state_v1');
    storage.removeItem('sessao_id');
    const me = await localBase44.auth.me();
    assert.equal(me.id, 'local-admin-user');
    assert.equal(me.perfil_acesso_id, 'local_perfil_admin');
    assert.equal(await localBase44.auth.isAuthenticated(), true);
  } finally {
    await server.close();
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  }
});

test('mestre local mantem sessao apos realinhamento de access_version', async () => {
  const values = new Map();
  const storage = {
    getItem: (k) => values.get(String(k)) ?? null,
    setItem: (k, v) => values.set(String(k), String(v)),
    removeItem: (k) => values.delete(String(k)),
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  try {
    const { localBase44 } = await server.ssrLoadModule(`/src/api/localBase44Client.js?auth-rotate=${Date.now()}`);
    localBase44.__local.reset();
    assert.equal(await localBase44.auth.isAuthenticated(), true);
    const db = localBase44.__local.export();
    db.PerfilAcesso = (db.PerfilAcesso || []).map((p) => (
      String(p.id) === 'local_perfil_admin'
        ? { ...p, group_id: 'grupo_importado_y', grupo_id: 'grupo_importado_y', ativo: true }
        : p
    ));
    storage.setItem('erp_integra_local_db_v1', JSON.stringify(db));
    // Segunda leitura (equivalente a navegar para outro modulo) nao deve derrubar a sessao.
    assert.equal(await localBase44.auth.isAuthenticated(), true);
    const me = await localBase44.auth.me();
    assert.equal(me.id, 'local-admin-user');
  } finally {
    await server.close();
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  }
});

test('reset-local limpa estado de autenticacao local', async () => {
  const main = await import('node:fs/promises').then((fs) => (
    fs.readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
  ));
  assert.match(main, /erp_integra_local_auth_state_v1/);
  assert.match(main, /sessao_id/);
});
