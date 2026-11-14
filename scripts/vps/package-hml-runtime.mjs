import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function command(bin, args, cwd = repository) {
  const result = spawnSync(bin, args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, `${path.basename(bin)}_FAILED`);
  return result.stdout.trim();
}

export function runtimeDependencies(repo) {
  const server = path.join(repo, 'server');
  const lock = JSON.parse(fs.readFileSync(path.join(server, 'package-lock.json')));
  return Object.entries(lock.packages).filter(([key, value]) => key.startsWith('node_modules/')
    && value.dev !== true && value.devOptional !== true).map(([key, value]) => {
    assert.ok(!key.includes('..') && !value.link && !value.os && !value.cpu, 'PLATFORM_DEPENDENCY_REQUIRES_LINUX_BUILD');
    const folder = path.join(server, key);
    assert.ok(!fs.lstatSync(folder).isSymbolicLink(), 'DEPENDENCY_LINK_DENIED');
    const installed = JSON.parse(fs.readFileSync(path.join(folder, 'package.json')));
    assert.equal(installed.version, value.version, 'DEPENDENCY_VERSION_MISMATCH');
    return { key, folder, version: value.version };
  });
}

export function fileManifest(root) {
  const files = [];
  const visit = folder => {
    for (const entry of fs.readdirSync(folder).sort()) {
      const file = path.join(folder, entry), stat = fs.lstatSync(file);
      assert.ok(!stat.isSymbolicLink(), 'PACKAGE_LINK_DENIED');
      if (stat.isDirectory()) visit(file);
      else {
        const relative = path.relative(root, file).split(path.sep).join('/');
        assert.ok(!/(^|\/)\.env(?:\.|$)|\.private\.|\.(?:node|exe|dll|so)$/i.test(relative), 'PRIVATE_OR_NATIVE_FILE_DENIED');
        files.push({ path: relative, bytes: stat.size, sha256: digest(fs.readFileSync(file)) });
      }
    }
  };
  visit(root);
  return files;
}

export async function packageRuntime(destination, { validation = false } = {}) {
  assert.notEqual(os.hostname(), 'srv1982741', 'BUILD_ON_SHARED_VPS_FORBIDDEN');
  destination = path.resolve(destination);
  assert.ok(!destination.startsWith(repository + path.sep) && !fs.existsSync(destination), 'NEW_EXTERNAL_PACKAGE_REQUIRED');
  const sha = command('git', ['rev-parse', 'HEAD']);
  const before = command('git', ['status', '--porcelain']);
  const branch = command('git', ['branch', '--show-current']);
  assert.ok(branch.startsWith('codex/'), 'EXISTING_CODEX_BRANCH_REQUIRED');
  const origin = command('git', ['remote', 'get-url', 'origin']);
  assert.match(origin, /^(?:https:\/\/(?:[^/@]+@)?github\.com\/|git@github\.com:)viniciuszuccaro-creator\/ERP-Zuccaro-codeX(?:\.git)?$/);
  const remote = command('git', ['ls-remote', '--refs', 'origin', `refs/heads/${branch}`]).split(/\s/)[0];
  const published = before === '' && remote === sha;
  assert.ok(validation || published, 'PUBLISHED_CLEAN_CHECKOUT_REQUIRED');
  const dependencies = runtimeDependencies(repository);
  command(process.execPath, [path.join(repository, 'server/node_modules/typescript/bin/tsc'), '-p', 'server/tsconfig.json']);
  const old = { ...process.env };
  try {
    for (const key of Object.keys(process.env)) if (/^(VITE_|BASE44_)/.test(key)) delete process.env[key];
    Object.assign(process.env, { VITE_ERP_BACKEND: 'http', VITE_ERP_HTTP_CLIENTE_360: 'true',
      VITE_ERP_HTTP_PRODUTO: 'true', VITE_ERP_API_SAME_ORIGIN: 'true', VITE_ERP_API_BASE_URL: '' });
    const { build } = await import('vite');
    // Keep the canonical plugins/config, but never load a local .env into public assets.
    await build({ root: repository, envDir: false, mode: 'production' });
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in old)) delete process.env[key];
    Object.assign(process.env, old);
  }
  fs.mkdirSync(destination, { recursive: false, mode: 0o700 });
  const api = path.join(destination, 'api'); fs.mkdirSync(api);
  fs.cpSync(path.join(repository, 'server/dist'), path.join(api, 'dist'), { recursive: true });
  fs.copyFileSync(path.join(repository, 'server/package.json'), path.join(api, 'package.json'));
  fs.copyFileSync(path.join(repository, 'scripts/vps/hml-bootstrap.mjs'), path.join(api, 'hml-bootstrap.mjs'));
  for (const dependency of dependencies) {
    fs.cpSync(dependency.folder, path.join(api, dependency.key), { recursive: true });
  }
  fs.cpSync(path.join(repository, 'dist'), path.join(destination, 'web'), { recursive: true });
  const marker = path.join(destination, 'web/.well-known'); fs.mkdirSync(marker);
  fs.writeFileSync(path.join(marker, 'erp-version.json'), JSON.stringify({ sha,
    sourceState: published ? 'PUBLISHED_CLEAN' : 'UNPUBLISHED_VALIDATION', environment: 'hml',
    dataInBuild: false, apiSha: sha, webSha: sha }));
  const files = fileManifest(destination);
  assert.equal(command('git', ['status', '--porcelain']), before, 'CHECKOUT_CHANGED_DURING_PACKAGE');
  const result = { version: 1, sha, sourceState: published ? 'PUBLISHED_CLEAN' : 'UNPUBLISHED_VALIDATION',
    node: process.version, dependencies: dependencies.map(({ key, version }) => ({ key, version })),
    files, bytes: files.reduce((sum, f) => sum + f.bytes, 0), filesSha256: digest(JSON.stringify(files)),
    databaseOrSecretsIncluded: false, migrationsExecuted: false };
  fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(result));
  console.log(JSON.stringify({ sha, state: result.sourceState, files: files.length, bytes: result.bytes,
    filesSha256: result.filesSha256, requiresReviewAndCI: true }));
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  packageRuntime(process.argv[2], { validation: process.argv[3] === '--validation' }).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
