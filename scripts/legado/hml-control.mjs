import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

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

function command(program, args, input) {
  const executable = program === 'gh' ? process.env.ERP344_GH_EXECUTABLE || program : program;
  const result = spawnSync(executable, args, { input, encoding: 'utf8', timeout: input ? 75000 : 30000,
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

export function validateTunnelProof(proof, mode, now = Date.now()) {
  assert.deepEqual(Object.keys(proof).sort(), ['browseUrl', 'codespace', 'expiresAt', 'mode',
    'observedAt', 'owner', 'port', 'repository', 'visibility']);
  assert.equal(proof.codespace, codespace);
  assert.equal(proof.repository, 'viniciuszuccaro-creator/ERP-Zuccaro-codeX');
  assert.equal(proof.owner, 'viniciuszuccaro-creator');
  assert.equal(proof.mode, mode);
  assert.equal(proof.port, 15173);
  assert.equal(proof.visibility, 'private');
  assert.equal(proof.browseUrl, publicUrl.replace('/cadastros', ''));
  assert.ok(Number.isSafeInteger(proof.observedAt) && Number.isSafeInteger(proof.expiresAt));
  assert.ok(proof.observedAt <= now + 5000 && now <= proof.expiresAt, 'TUNNEL_PROOF_EXPIRED');
  assert.ok(proof.expiresAt > proof.observedAt && proof.expiresAt - proof.observedAt <= 90000);
  return proof;
}

async function registerMissingPort(run) {
  const executable = process.env.ERP344_GH_EXECUTABLE || 'gh';
  const child = spawn(executable, ['codespace', 'ports', 'forward', '15173:15173', '-c', codespace],
    { stdio: 'ignore', windowsHide: true });
  let failed = false;
  child.on('error', () => { failed = true; });
  try {
    for (let i = 0; i < 15; i += 1) {
      const ports = JSON.parse(run('gh', ['codespace', 'ports', '-c', codespace, '--json', 'sourcePort']));
      if (ports.some(port => port.sourcePort === 15173)) return;
      assert.equal(failed || child.exitCode !== null, false, 'PORT_REGISTRATION_FAILED');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.fail('PORT_REGISTRATION_TIMEOUT');
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGINT');
  }
}

export async function viaGh(mode, run = command, register = registerMissingPort) {
  assert.ok(['diagnose', 'status', 'start', 'recover'].includes(mode), 'MODE_REQUIRED');
  const target = JSON.parse(run('gh', ['api', `/user/codespaces/${codespace}`, '--jq',
    '{name,state,owner:.owner.login,repository:.repository.full_name,machine:.machine.name}']));
  assert.equal(target.name, codespace);
  assert.equal(target.repository, 'viniciuszuccaro-creator/ERP-Zuccaro-codeX');
  assert.equal(target.owner, 'viniciuszuccaro-creator');
  assert.equal(target.machine, 'basicLinux32gb', 'MACHINE_CHANGED_REQUIRES_REVIEW');
  assert.equal(target.state, 'Available', 'CODESPACE_NOT_AVAILABLE_NO_AUTOMATIC_RESTART');
  if (mode !== 'diagnose') {
    const ports = JSON.parse(run('gh', ['codespace', 'ports', '-c', codespace, '--json', 'sourcePort']));
    if (!ports.some(port => port.sourcePort === 15173)) await register(run);
    await forwardPrivate(run);
  }
  const observedAt = Date.now();
  const proof = { codespace, repository: target.repository, owner: target.owner, mode, port: 15173,
    visibility: 'private', browseUrl: publicUrl.replace('/cadastros', ''), observedAt, expiresAt: observedAt + 90000 };
  // The authenticated SSH stream carries public controller code and bounded metadata ONLY.
  // OAuth remains in the desktop credential store, never an environment copied to Codespace.
  const source = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const input = source + `\nawait main(${JSON.stringify(mode)},${JSON.stringify(proof)}).catch(reportFailure);\n`;
  const result = run('gh', ['codespace', 'ssh', '-c', codespace, '--',
    `env CODESPACE_NAME=${codespace} node --input-type=module`], input);
  if (mode !== 'diagnose') await forwardPrivate(run);
  return result;
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

/** Tracks only sockets accepted by the explicitly supplied HML servers. */
export function createOwnedShutdown({ graceMs = 1000, timeoutMs = 15000, onStage = () => {} } = {}) {
  assert.ok(Number.isSafeInteger(graceMs) && graceMs >= 0);
  assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs > graceMs);
  const servers = new Map(), errors = [];
  let closing;
  const emit = (stage, phase) => {
    try { onStage({ event: 'HML_CLOSE_STAGE', stage, phase }); }
    catch (error) { errors.push(error); }
  };
  return {
    track(label, server) {
      assert.ok(['api', 'web'].includes(label) && !servers.has(label) && !closing);
      assert.ok([...servers.values()].every(entry => entry.server !== server));
      const sockets = new Set();
      const connection = socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); };
      server.on('connection', connection);
      servers.set(label, { server, sockets, connection });
      return server;
    },
    close(vite) {
      if (closing) return closing;
      closing = (async () => {
        let drain, deadline, forcedConnections = 0;
        try {
          const jobs = [...servers].map(([label, { server }]) => {
            emit(label, 'BEGIN');
            return new Promise((resolve, reject) => server.close(error => {
              if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') { emit(label, 'FAILED'); reject(error); }
              else { emit(label, 'DONE'); resolve(); }
            }));
          });
          jobs.push(Promise.resolve().then(async () => {
            emit('vite', 'BEGIN'); await vite?.close(); emit('vite', 'DONE');
          }));
          drain = setTimeout(() => {
            for (const { sockets } of servers.values()) for (const socket of sockets) {
              forcedConnections++; socket.destroy();
            }
            emit('owned-connections', 'DRAINED');
          }, graceMs);
          const settled = Promise.allSettled(jobs).then(results => {
            errors.push(...results.filter(result => result.status === 'rejected').map(result => result.reason));
            if (errors.length) throw new AggregateError(errors, 'HML_CLOSE_FAILED');
          });
          await Promise.race([settled, new Promise((_, reject) => {
            deadline = setTimeout(() => { emit('lifecycle', 'TIMEOUT'); reject(new Error('HML_CLOSE_TIMEOUT')); }, timeoutMs);
          })]);
          return { forcedConnections, servers: servers.size };
        } finally {
          clearTimeout(drain); clearTimeout(deadline);
          for (const { server, connection } of servers.values()) server.off('connection', connection);
        }
      })();
      return closing;
    },
  };
}

export function validateRecoveryEvidence(plan, state, lock, conservation, baseline, now = Date.now()) {
  assert.equal(state.state, 'STOPPED_EMERGENCY_REQUIRES_INSPECTION');
  assert.ok(Number.isSafeInteger(plan.pid) && plan.pid > 1);
  assert.equal(plan.pid, state.pid); assert.equal(lock.pid, state.pid);
  assert.equal(conservation.rows, 100); assert.equal(conservation.fullRowsMatch, true);
  assert.equal(conservation.readOnly, true); assert.equal(conservation.rolledBack, true);
  assert.equal(conservation.businessWrites, 0);
  assert.ok(Number.isSafeInteger(plan.observedAt) && now >= plan.observedAt && now - plan.observedAt <= 300000);
  assert.ok(Number.isSafeInteger(plan.stoppedAt) && plan.stoppedAt <= plan.observedAt);
  assert.ok(now >= Date.parse(conservation.observedAt) && now - Date.parse(conservation.observedAt) <= 300000);
  assert.ok(Date.parse(conservation.observedAt) >= plan.stoppedAt
    && Date.parse(conservation.observedAt) <= plan.observedAt, 'RECOVERY_PROOF_MUST_FOLLOW_STOP');
  assert.equal(baseline.state.rows.length, 100);
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
  const rows = [...baseline.state.rows].sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(new Set(rows.map(row => row.id)).size, 100);
  assert.equal(hash(JSON.stringify(stable(rows))), conservation.sha256, 'RECOVERY_ROWS_NOT_CONSERVED');
  for (const key of ['stateSha256', 'lockSha256', 'conservationSha256', 'baselineSha256']) assert.match(plan[key], /^[a-f0-9]{64}$/);
  return true;
}

export async function recoverStoppedResources(root, { checkProcess, checkSocket, baselineSha256, now = Date.now() } = {}) {
  assert.equal(typeof checkProcess, 'function'); assert.equal(typeof checkSocket, 'function');
  const read = name => privateFile(path.join(root, name));
  const planBytes = read('hml-recovery.private.json'), plan = JSON.parse(planBytes);
  const stateBytes = read('api-bootstrap.private.json'), lockBytes = read('writer.lock');
  assert.equal(Math.trunc(fs.lstatSync(path.join(root, 'api-bootstrap.private.json')).mtimeMs), plan.stoppedAt);
  const conservationBytes = read('recovery-conservation.private.json');
  const baselineBytes = privateFile('/workspaces/.erp-private-344/ie20-address-20261110/conservation-baseline-after-ie20.private.json');
  assert.match(baselineSha256 || '', /^[a-f0-9]{64}$/);
  assert.equal(hash(baselineBytes), baselineSha256, 'REVIEWED_BASELINE_PIN_CHANGED');
  for (const [key, bytes] of [['state', stateBytes], ['lock', lockBytes], ['conservation', conservationBytes], ['baseline', baselineBytes]]) {
    assert.equal(hash(bytes), plan[`${key}Sha256`]);
  }
  validateRecoveryEvidence(plan, JSON.parse(stateBytes), JSON.parse(lockBytes), JSON.parse(conservationBytes), JSON.parse(baselineBytes), now);
  await checkProcess(plan.pid);
  const socket = path.join(root, 'api.sock');
  if (fs.existsSync(socket)) {
    const stat = fs.lstatSync(socket);
    assert.ok(stat.isSocket() && stat.uid === process.getuid());
    assert.equal(stat.ino, plan.socket?.ino); assert.equal(stat.dev, plan.socket?.dev);
    await checkSocket(socket);
  } else assert.equal(plan.socket, null);
  await checkProcess(plan.pid);
  assert.equal(hash(read('api-bootstrap.private.json')), plan.stateSha256);
  assert.equal(hash(read('writer.lock')), plan.lockSha256);
  assert.equal(hash(read('hml-recovery.private.json')), hash(planBytes));
  assert.equal(hash(read('recovery-conservation.private.json')), plan.conservationSha256);
  return archiveInspectedResources(root, plan, { now, planSha256: hash(planBytes) });
}

// Archival is deliberately separate from authorization: main/recover performs all probes first.
export function archiveInspectedResources(root, plan, { now = Date.now(), move = fs.renameSync, planSha256 } = {}) {
  assert.match(planSha256 || '', /^[a-f0-9]{64}$/);
  assert.equal(hash(fs.readFileSync(path.join(root, 'api-bootstrap.private.json'))), plan.stateSha256);
  assert.equal(hash(fs.readFileSync(path.join(root, 'writer.lock'))), plan.lockSha256);
  assert.equal(hash(fs.readFileSync(path.join(root, 'hml-recovery.private.json'))), planSha256);
  assert.equal(hash(fs.readFileSync(path.join(root, 'recovery-conservation.private.json'))), plan.conservationSha256);
  const archive = path.join(root, `recovery-${now}-${process.pid}`);
  fs.mkdirSync(archive, { mode: 0o700 });
  // An interrupted archival never makes the ordinary start path eligible.
  const inProgress = path.join(root, 'hml-recovery.in-progress');
  fs.writeFileSync(inProgress, JSON.stringify({ archive, planSha256 }), { flag: 'wx', mode: 0o600 });
  for (const [name, expected] of [['api-bootstrap.private.json', plan.stateSha256], ['writer.lock', plan.lockSha256],
    ['hml-recovery.private.json', planSha256], ['recovery-conservation.private.json', plan.conservationSha256]]) {
    assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
    move(path.join(root, name), path.join(archive, name));
    assert.equal(hash(fs.readFileSync(path.join(archive, name))), expected);
  }
  const socket = path.join(root, 'api.sock');
  if (fs.existsSync(socket)) {
    const stat = fs.lstatSync(socket);
    assert.ok(stat.isSocket() && stat.uid === process.getuid());
    assert.equal(stat.ino, plan.socket.ino); assert.equal(stat.dev, plan.socket.dev);
    move(socket, path.join(archive, 'api.sock'));
  }
  fs.writeFileSync(path.join(root, 'api-bootstrap.private.json'), JSON.stringify({ pid: plan.pid, state: 'STOPPED',
    recoveredFrom: plan.stateSha256, recoveryArchive: archive, authSessionVerified: false }), { flag: 'wx', mode: 0o600 });
  move(inProgress, path.join(archive, 'recovery-completed.private.json'));
  return { event: 'HML_RECOVERED_AFTER_INSPECTION', businessWrites: 0, restartPerformed: false };
}

export async function main(mode, tunnelProof = null) {
  assert.equal(process.platform, 'linux', 'LINUX_CODESPACE_REQUIRED');
  assert.equal(process.env.CODESPACE_NAME, codespace, 'EXISTING_CODESPACE_REQUIRED');
  assert.ok(['diagnose', 'status', 'start', 'recover'].includes(mode), 'MODE_REQUIRED');
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
  const forward = tunnelProof
    ? async () => validateTunnelProof(tunnelProof, mode)
    : forwardPrivate;
  await forward();
  const statePath = `${privateRoot}/api-bootstrap.private.json`;
  const lease = `${privateRoot}/hml-start.lock`;
  // Never recover a stale lease automatically: another executor may still own it.
  return withStartLease(lease, async () => {
    assert.equal(fs.existsSync(`${privateRoot}/hml-recovery.in-progress`), false, 'INCOMPLETE_RECOVERY_REQUIRES_INSPECTION');
    let response;
    try { response = await fetch('http://127.0.0.1:15173/__erp_hml', { signal: AbortSignal.timeout(2000) }); }
    catch (error) {
      if (error.cause?.code !== 'ECONNREFUSED') throw error;
    }
    if (response) {
      assert.notEqual(mode, 'recover', 'LIVE_HML_RECOVERY_DENIED');
      ownsBootstrap(JSON.parse(privateFile(statePath)));
      const checked = await health(config.reviewedSha);
      await forward();
      console.log(JSON.stringify({ event: 'HML_ALREADY_RUNNING', ...checked, session: 'OWNER_VERIFICATION_REQUIRED' }));
      return;
    }
    if (mode === 'recover') {
      const result = await recoverStoppedResources(privateRoot, {
        baselineSha256: config.pins.ERP344_POST_IE_BASELINE_SHA256,
        checkProcess: async pid => {
          assert.equal(fs.existsSync(`/proc/${pid}`), false, 'RECOVERY_PROCESS_STILL_PRESENT');
          try { process.kill(pid, 0); assert.fail('RECOVERY_PROCESS_ALIVE'); }
          catch (error) { assert.equal(error.code, 'ESRCH', 'RECOVERY_PROCESS_UNPROVEN'); }
        },
        checkSocket: socket => new Promise((resolve, reject) => {
          const connection = net.createConnection(socket);
          connection.setTimeout(1500, () => { connection.destroy(); reject(new Error('RECOVERY_SOCKET_UNPROVEN')); });
          connection.once('connect', () => { connection.destroy(); reject(new Error('RECOVERY_SOCKET_ALIVE')); });
          connection.once('error', error => { connection.destroy(); error.code === 'ECONNREFUSED' ? resolve() : reject(error); });
        }),
      });
      console.log(JSON.stringify(result)); return;
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
    await forward();
    const checked = await health(config.reviewedSha);
    console.log(JSON.stringify({ event: 'HML_STARTED', ...checked, session: 'OWNER_VERIFICATION_REQUIRED',
      externalAccess: 'NOT_VERIFIED_OPEN_PRIVATE_URL', availability: 'EXISTING_BOOTSTRAP_WINDOW' }));
  });
}

function reportFailure(error) {
    console.error(JSON.stringify({ event: 'HML_CONTROL_BLOCKED', code: error.code || 'GUARD_FAILED',
      reason: error.code === 'ERR_ASSERTION' ? String(error.message).split('\n')[0] : 'Inspect private configuration and runtime' }));
    process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--via-gh') {
    viaGh(process.argv[3]).then(output => console.log(output)).catch(reportFailure);
  } else main(process.argv[2]).catch(reportFailure);
}
