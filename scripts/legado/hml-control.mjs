import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Coordinates the existing private bootstrap; never provisions or imports data.
export const codespace = 'potential-xylophone-5gj7r9v9qqg637vxp';
export const privateRoot = '/home/codespace/erp-legado-privado-20261023/hml344-cpa-20261104';
export const publicUrl = `https://${codespace}-15173.app.github.dev/cadastros`;
const bootstrap = `${privateRoot}/api-bootstrap.private.mjs`;
const loader = '/workspaces/ERP-Zuccaro-codeX/server/node_modules/tsx/dist/loader.mjs';
const envKeys = ['ERP344_IE_GATE_SHA256', 'ERP344_POST_IE_BASELINE_SHA256',
  'ERP344_IE_COMPLETION_SHA256', 'ERP344_PHYSICAL_BASELINE_SHA256'];
const hash = value => createHash('sha256').update(value).digest('hex');

export function validateConfig(config) {
  assert.ok(config && typeof config === 'object' && !Array.isArray(config));
  assert.deepEqual(Object.keys(config).sort(), ['bootstrapSha256', 'pins', 'reviewedSha']);
  assert.match(config.reviewedSha, /^[a-f0-9]{40}$/);
  assert.match(config.bootstrapSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(config.pins).sort(), [...envKeys].sort());
  for (const key of envKeys) assert.match(config.pins[key], /^[a-f0-9]{64}$/);
  return config;
}

export function validateMarker(marker, sha) {
  assert.equal(marker.apiSha, sha, 'API_VERSION_MISMATCH');
  assert.equal(marker.webSha, sha, 'WEB_VERSION_MISMATCH');
  assert.equal(marker.dataOrigin, 'real-clients-FINAL100-private-HML');
  assert.equal(marker.operationalDatabase, false);
  assert.equal(marker.authMode, 'supabase_user');
  const physical = marker.physicalPreflight;
  assert.ok(physical && typeof physical === 'object');
  assert.equal(physical.database, 'hml344_restore_20261104');
  assert.equal(physical.schema, 'hml344_cpa_20261104');
  assert.match(physical.systemIdentifier, /^[0-9]+$/);
  assert.match(physical.schemaOid, /^[0-9]+$/);
  assert.ok(typeof physical.role === 'string' && physical.role.length > 0);
  return { sha, origin: marker.dataOrigin, url: publicUrl };
}

function privateFile(file) {
  const stat = fs.lstatSync(file);
  assert.equal(stat.isSymbolicLink(), false, 'PRIVATE_SYMLINK_DENIED');
  assert.equal(stat.isFile(), true);
  assert.equal(stat.uid, process.getuid());
  assert.equal(stat.mode & 0o077, 0, 'PRIVATE_FILE_PERMISSIONS_REQUIRED');
  assert.equal(fs.realpathSync(file), file, 'PRIVATE_PARENT_SYMLINK_DENIED');
  return fs.readFileSync(file);
}

function command(program, args) {
  const result = spawnSync(program, args, { encoding: 'utf8', timeout: 30000,
    maxBuffer: 1024 * 1024, windowsHide: true });
  assert.equal(result.status, 0, `${program}_FAILED`);
  return result.stdout.trim();
}

export function capacityReport(run = command) {
  const probes = {
    filesystem: ['df', ['-h', '/', '/workspaces']],
    inodes: ['df', ['-i', '/', '/workspaces']],
    docker: ['docker', ['system', 'df']],
    knownDirectories: ['du', ['-sh', '/workspaces/ERP-Zuccaro-codeX',
      '/workspaces/.erp-private-344', '/home/codespace/erp-legado-privado-20261023']],
  };
  const results = {};
  for (const [name, [program, args]] of Object.entries(probes)) {
    try { results[name] = { status: 'MEASURED', value: run(program, args) }; }
    catch { results[name] = { status: 'UNAVAILABLE', value: null }; }
  }
  return { event: 'READ_ONLY_CAPACITY', observedAt: new Date().toISOString(), results,
    accountQuota: 'NOT_QUERIED_USE_AUTHENTICATED_BILLING_PANEL', removedBytes: 0 };
}

export async function forwardPrivate(run = command) {
  run('gh', ['codespace', 'ports', 'visibility', '15173:private', '-c', codespace]);
  const ports = JSON.parse(run('gh', ['codespace', 'ports', '-c', codespace, '--json',
    'sourcePort,visibility,browseUrl']));
  const port = ports.find(item => Number(item.sourcePort) === 15173);
  assert.equal(port?.visibility?.toLowerCase(), 'private', 'PRIVATE_FORWARD_REQUIRED');
  assert.equal(new URL(port.browseUrl).protocol, 'https:');
  assert.equal(new URL(port.browseUrl).hostname, `${codespace}-15173.app.github.dev`);
}

async function health(sha, base = 'http://127.0.0.1:15173') {
  const get = suffix => fetch(`${base}${suffix}`, { redirect: 'error', signal: AbortSignal.timeout(4000) });
  const marker = await get('/__erp_hml');
  assert.equal(marker.status, 200);
  const checked = validateMarker(await marker.json(), sha);
  for (const endpoint of ['/health', '/ready']) assert.equal((await get(endpoint)).status, 200);
  // Session still has to be verified by the owner; anonymous access must fail closed.
  assert.equal((await get('/api/v1/clientes')).status, 401);
  return checked;
}

function ownsBootstrap(state) {
  assert.ok(Number.isSafeInteger(state.pid) && state.pid > 1);
  assert.ok(Date.parse(state.expiresAt) > Date.now(), 'HML_WINDOW_EXPIRED');
  const args = fs.readFileSync(`/proc/${state.pid}/cmdline`, 'utf8').split('\0');
  assert.ok(args.includes(bootstrap) && args.includes('--hml-current'), 'HML_PROCESS_IDENTITY_MISMATCH');
}

export async function withStartLease(directory, action) {
  fs.mkdirSync(directory, { mode: 0o700 });
  try { return await action(); }
  finally { fs.rmdirSync(directory); }
}

export async function main(mode) {
  assert.equal(process.platform, 'linux', 'LINUX_CODESPACE_REQUIRED');
  assert.equal(process.env.CODESPACE_NAME, codespace, 'EXISTING_CODESPACE_REQUIRED');
  assert.ok(['diagnose', 'status', 'start'].includes(mode), 'MODE_REQUIRED');
  if (mode === 'diagnose') {
    console.log(JSON.stringify(capacityReport()));
    return;
  }
  const config = validateConfig(JSON.parse(privateFile(`${privateRoot}/hml-launch.private.json`)));
  assert.equal(hash(privateFile(bootstrap)), config.bootstrapSha256, 'BOOTSTRAP_HASH_MISMATCH');
  const rootStat = fs.lstatSync(privateRoot);
  assert.equal(rootStat.uid, process.getuid());
  assert.equal(rootStat.mode & 0o077, 0, 'PRIVATE_DIRECTORY_PERMISSIONS_REQUIRED');
  // Fail before starting real-data services unless the existing tunnel is private.
  await forwardPrivate();
  const statePath = `${privateRoot}/api-bootstrap.private.json`;
  const lease = `${privateRoot}/hml-start.lock`;
  // Never recover a stale lease automatically: another executor may still own it.
  return withStartLease(lease, async () => {
    let response;
    try { response = await fetch('http://127.0.0.1:15173/__erp_hml', { signal: AbortSignal.timeout(2000) }); }
    catch (error) {
      if (error.cause?.code !== 'ECONNREFUSED') throw error;
    }
    if (response) {
      ownsBootstrap(JSON.parse(privateFile(statePath)));
      const checked = await health(config.reviewedSha);
      await forwardPrivate();
      console.log(JSON.stringify({ event: 'HML_ALREADY_RUNNING', ...checked, session: 'OWNER_VERIFICATION_REQUIRED' }));
      return;
    }
    assert.equal(mode, 'start', 'HML_NOT_RUNNING');
    assert.equal(fs.existsSync(`${privateRoot}/writer.lock`), false, 'HML_WRITER_BUSY');
    if (fs.existsSync(statePath)) {
      const old = JSON.parse(privateFile(statePath));
      assert.equal(old.state, 'STOPPED', 'PREVIOUS_BOOTSTRAP_REQUIRES_INSPECTION');
    }
    fs.accessSync(loader, fs.constants.R_OK);
    // Unique private logs; no session, environment or database contents on stdout.
    const fd = fs.openSync(`${privateRoot}/launcher-${Date.now()}-${process.pid}.private.log`, 'wx', 0o600);
    let child;
    try {
      child = spawn(process.execPath, ['--import', loader, bootstrap, '--hml-current'], {
        cwd: '/workspaces/ERP-Zuccaro-codeX', detached: true, windowsHide: true,
        stdio: ['ignore', fd, fd], env: { ...process.env, ...config.pins,
          ERP344_REVIEWED_CI_SHA: config.reviewedSha },
      });
    } finally { fs.closeSync(fd); }
    let failed = false;
    child.on('error', () => { failed = true; });
    child.unref();
    let ready = false, lastFailure = 'NOT_READY';
    for (let i = 0; i < 45; i += 1) {
      if (failed || child.exitCode !== null || child.signalCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
      try { await health(config.reviewedSha); ready = true; break; }
      catch (error) { lastFailure = error.code || 'HEALTH_CONTRACT_FAILED'; }
    }
    assert.equal(ready, true, `HML_START_NOT_READY_${lastFailure}_INSPECT_PRIVATE_LOG_NO_RETRY`);
    ownsBootstrap(JSON.parse(privateFile(statePath)));
    await forwardPrivate();
    const checked = await health(config.reviewedSha);
    console.log(JSON.stringify({ event: 'HML_STARTED', ...checked, session: 'OWNER_VERIFICATION_REQUIRED',
      externalAccess: 'NOT_VERIFIED_OPEN_PRIVATE_URL', availability: 'EXISTING_BOOTSTRAP_WINDOW' }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2]).catch(error => {
    console.error(JSON.stringify({ event: 'HML_CONTROL_BLOCKED', code: error.code || 'GUARD_FAILED',
      reason: error.code === 'ERR_ASSERTION' ? String(error.message).split('\n')[0] : 'Inspect private configuration and runtime' }));
    process.exitCode = 1;
  });
}
