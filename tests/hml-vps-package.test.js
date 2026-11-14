import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileManifest, runtimeDependencies } from '../scripts/vps/package-hml-runtime.mjs';

function temporary(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-hml-package-'));
  try { fn(root); }
  finally {
    assert.ok(root.startsWith(path.join(os.tmpdir(), 'erp-hml-package-')));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('HML package manifest is deterministic, hashes content and refuses secrets/native binaries', () => temporary(root => {
  fs.mkdirSync(path.join(root, 'api'));
  fs.writeFileSync(path.join(root, 'api/app.js'), 'synthetic module');
  const first = fileManifest(root);
  assert.equal(first.length, 1); assert.equal(first[0].path, 'api/app.js');
  assert.deepEqual(fileManifest(root), first);
  fs.writeFileSync(path.join(root, 'api/app.js'), 'changed synthetic module');
  assert.notEqual(fileManifest(root)[0].sha256, first[0].sha256);
  for (const name of ['.env', '.env.hml', 'config.private.json', 'module.node', 'helper.exe', 'native.so']) {
    const file = path.join(root, name); fs.writeFileSync(file, 'synthetic');
    assert.throws(() => fileManifest(root), /PRIVATE_OR_NATIVE_FILE_DENIED/);
    fs.unlinkSync(file);
  }
}));

test('HML dependencies use exact installed production versions and reject platform-specific packages', () => temporary(root => {
  const server = path.join(root, 'server'); fs.mkdirSync(path.join(server, 'node_modules/example'), { recursive: true });
  const lock = { packages: { '': {}, 'node_modules/example': { version: '1.0.0' },
    'node_modules/development': { version: '2.0.0', dev: true } } };
  const write = () => fs.writeFileSync(path.join(server, 'package-lock.json'), JSON.stringify(lock));
  write(); fs.writeFileSync(path.join(server, 'node_modules/example/package.json'), JSON.stringify({ version: '1.0.0' }));
  assert.deepEqual(runtimeDependencies(root).map(v => v.key), ['node_modules/example']);
  lock.packages['node_modules/example'].version = '1.0.1'; write();
  assert.throws(() => runtimeDependencies(root), /DEPENDENCY_VERSION_MISMATCH/);
  lock.packages['node_modules/example'] = { version: '1.0.0', os: ['win32'] }; write();
  assert.throws(() => runtimeDependencies(root), /PLATFORM_DEPENDENCY_REQUIRES_LINUX_BUILD/);
}));
