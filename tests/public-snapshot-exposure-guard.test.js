import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('real ERP snapshots are not shipped as public assets', () => {
  assert.equal(existsSync(resolve(root, 'public/base44-local-core-snapshot.json')), false);
  assert.equal(existsSync(resolve(root, 'public/base44-local-snapshot.json')), false);
  assert.doesNotMatch(read('src/main.jsx'), /base44-local-(?:core-)?snapshot\.json/);
  assert.doesNotMatch(read('src/api/localBase44Client.js'), /sourceUrl\s*=\s*['"]\//);
});

test('nginx SPA denies legacy public snapshot paths with 404 (not HTML fallback)', () => {
  const nginx = read('deploy/nginx-erp.conf');
  assert.match(nginx, /location\s+=\s+\/base44-local-snapshot\.json\s*\{\s*return\s+404;/);
  assert.match(nginx, /location\s+=\s+\/base44-local-core-snapshot\.json\s*\{\s*return\s+404;/);
});

test('local recovery requires a selected file and never fetches a public snapshot', () => {
  const recovery = read('public/recover.html');
  assert.match(recovery, /type="file"/);
  assert.match(recovery, /localHosts\.includes\(window\.location\.hostname\)/);
  assert.match(recovery, /await file\.text\(\)/);
  assert.doesNotMatch(recovery, /fetch\s*\(/);
});

function recoveryHarness(hostname) {
  const html = read('public/recover.html');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const input = { files: [], disabled: false, events: {}, addEventListener(name, callback) { this.events[name] = callback; } };
  const button = { disabled: true, events: {}, addEventListener(name, callback) { this.events[name] = callback; } };
  const status = { textContent: '' };
  const storage = new Map();
  let destination = null;
  vm.runInNewContext(script, {
    document: { getElementById(id) { return { backup: input, restore: button, status }[id]; } },
    window: { location: { hostname, replace(path) { destination = path; } } },
    localStorage: { setItem(key, value) { storage.set(key, value); } },
    Date, JSON, Set,
  });
  return { input, button, status, storage, destination: () => destination };
}

test('remote recovery is disabled, and invalid local backup cannot replace data', async () => {
  const remote = recoveryHarness('erp.example.test');
  assert.equal(remote.input.disabled, true);
  assert.equal(remote.button.events.click, undefined);

  const local = recoveryHarness('127.0.0.1');
  local.input.files = [{ name: 'backup.json', size: 20, text: async () => JSON.stringify({ entities: {
    GrupoEmpresarial: [{ id: 'group-a' }], Empresa: [{ id: 'company-a', grupo_id: 'group-b' }],
  } }) }];
  local.input.events.change();
  await local.button.events.click();
  assert.equal(local.storage.size, 0);
  assert.equal(local.destination(), null);
});

test('explicit local backup restores the selected tenant and opens Cadastros', async () => {
  const local = recoveryHarness('localhost');
  local.input.files = [{ name: 'backup.json', size: 100, text: async () => JSON.stringify({ entities: {
    GrupoEmpresarial: [{ id: 'group-a' }], Empresa: [{ id: 'company-a', grupo_id: 'group-a' }],
  } }) }];
  local.input.events.change();
  await local.button.events.click();
  assert.equal(local.destination(), '/cadastros');
  assert.equal(local.storage.get('group_atual_id'), 'group-a');
  assert.equal(local.storage.get('empresa_atual_id'), 'company-a');
});
