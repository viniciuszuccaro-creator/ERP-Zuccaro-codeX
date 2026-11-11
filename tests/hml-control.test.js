import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { capacityReport, forwardPrivate, validateConfig, validateMarker, validateTunnelProof, viaGh, withStartLease, codespace,
  createOwnedShutdown, validateRecoveryEvidence, archiveInspectedResources } from '../scripts/legado/hml-control.mjs';

const sha = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const config = () => ({ reviewedSha: sha, bootstrapSha256: digest, pins: {
  ERP344_IE_GATE_SHA256: digest, ERP344_POST_IE_BASELINE_SHA256: digest,
  ERP344_IE_COMPLETION_SHA256: digest, ERP344_PHYSICAL_BASELINE_SHA256: digest,
} });
const marker = () => ({ apiSha: sha, webSha: sha, dataOrigin: 'real-clients-FINAL100-private-HML',
  operationalDatabase: false, authMode: 'supabase_user', physicalPreflight: {
    database: 'hml344_restore_20261104', schema: 'hml344_cpa_20261104',
    systemIdentifier: '1234567890', schemaOid: '1234', role: 'synthetic_hml_role',
  } });

const tunnel = (now = Date.now()) => ({ codespace, repository: 'viniciuszuccaro-creator/ERP-Zuccaro-codeX',
  owner: 'viniciuszuccaro-creator', mode: 'start', port: 15173, visibility: 'private',
  browseUrl: `https://${codespace}-15173.app.github.dev`, observedAt: now, expiresAt: now + 90000 });

test('SSH tunnel proof binds operation, target, private port and a short validity window', () => {
  const now = Date.now(), proof = tunnel(now);
  assert.equal(validateTunnelProof(proof, 'start', now), proof);
  for (const patch of [{ codespace: 'another' }, { repository: 'other/repo' }, { owner: 'another' },
    { mode: 'status' }, { port: 5173 }, { visibility: 'public' }, { browseUrl: 'https://example.test' },
    { expiresAt: now - 1 }, { expiresAt: now + 90001 }, { observedAt: now + 6000 }, { token: 'not-allowed' }]) {
    assert.throws(() => validateTunnelProof({ ...proof, ...patch }, 'start', now));
  }
});

test('desktop verifies identity/private tunnel before SSH, sends no OAuth and verifies tunnel again', async () => {
  const calls = [], old = process.env.GH_TOKEN;
  process.env.GH_TOKEN = 'SYNTHETIC_NEVER_COPY_TO_REMOTE';
  try {
    const result = await viaGh('start', (program, args, input) => {
      calls.push({ program, args, input });
      if (args[0] === 'api') return JSON.stringify({ name: codespace, state: 'Available',
        repository: 'viniciuszuccaro-creator/ERP-Zuccaro-codeX', owner: 'viniciuszuccaro-creator', machine: 'basicLinux32gb' });
      if (args.includes('ssh')) {
        assert.ok(calls.some(c => c.args.includes('15173:private')));
        assert.ok(input.includes('await main("start",'));
        assert.equal(input.includes(process.env.GH_TOKEN), false);
        assert.equal(input.includes('GH_TOKEN='), false);
        return 'SYNTHETIC_ALREADY_RUNNING';
      }
      return args.includes('--json') ? JSON.stringify([{ sourcePort: 15173, visibility: 'private',
        browseUrl: `https://${codespace}-15173.app.github.dev` }]) : '';
    }, () => assert.fail('existing tunnel must not be registered again'));
    assert.equal(result, 'SYNTHETIC_ALREADY_RUNNING');
    assert.equal(calls.filter(c => c.args.includes('ssh')).length, 1);
    assert.equal(calls.filter(c => c.args.includes('15173:private')).length, 2);
  } finally { if (old === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = old; }
});

test('desktop rejects another target, stopped environment or failed private visibility before SSH', async () => {
  for (const patch of [{ name: 'other' }, { state: 'Shutdown' }, { machine: 'larger' },
    { repository: 'other/repo' }, { owner: 'other' }]) {
    await assert.rejects(() => viaGh('start', (_program, args) => {
      assert.equal(args[0], 'api');
      return JSON.stringify({ name: codespace, state: 'Available', repository: 'viniciuszuccaro-creator/ERP-Zuccaro-codeX',
        owner: 'viniciuszuccaro-creator', machine: 'basicLinux32gb', ...patch });
    }));
  }
  await assert.rejects(() => viaGh('start', (_program, args) => {
    assert.equal(args.includes('ssh'), false);
    if (args[0] === 'api') return JSON.stringify({ name: codespace, state: 'Available',
      repository: 'viniciuszuccaro-creator/ERP-Zuccaro-codeX', owner: 'viniciuszuccaro-creator', machine: 'basicLinux32gb' });
    if (args.includes('visibility')) throw new Error('GH_PERMISSION_DENIED');
    return JSON.stringify([{ sourcePort: 15173 }]);
  }), /GH_PERMISSION_DENIED/);
});

test('desktop registers a missing 15173 once and never substitutes the synthetic port', async () => {
  let registered = false, registrations = 0, ssh = 0;
  await viaGh('status', (_program, args) => {
    if (args[0] === 'api') return JSON.stringify({ name: codespace, state: 'Available',
      repository: 'viniciuszuccaro-creator/ERP-Zuccaro-codeX', owner: 'viniciuszuccaro-creator', machine: 'basicLinux32gb' });
    if (args.includes('ssh')) { ssh++; assert.equal(registered, true); return 'SYNTHETIC_STATUS'; }
    if (args.includes('visibility')) { assert.ok(args.includes('15173:private')); return ''; }
    return JSON.stringify(registered ? [{ sourcePort: 15173, visibility: 'private',
      browseUrl: `https://${codespace}-15173.app.github.dev` }] : [{ sourcePort: 5173 }]);
  }, async () => { registered = true; registrations++; });
  assert.equal(registrations, 1);
  assert.equal(ssh, 1);
});

test('startup lease excludes concurrent invocation, preserves another lease and releases only its own on failure', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hml-controller-synthetic-'));
  const lease = path.join(root, 'lease');
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  try {
    const first = withStartLease(lease, () => pending);
    try {
      await assert.rejects(() => withStartLease(lease, () => assert.fail('second startup must not run')),
        error => error.code === 'EEXIST');
      assert.ok(fs.existsSync(lease));
    } finally { release(); await first; }
    assert.equal(fs.existsSync(lease), false);
    await assert.rejects(() => withStartLease(lease, () => { throw new Error('synthetic startup failure'); }), /synthetic startup failure/);
    assert.equal(fs.existsSync(lease), false);
    fs.mkdirSync(lease);
    await assert.rejects(() => withStartLease(lease, () => assert.fail('existing lease must not be bypassed')));
    assert.ok(fs.existsSync(lease));
    fs.rmdirSync(lease);
  } finally { fs.rmdirSync(root); }
});

test('capacity probes remain independent and never classify unavailable data as zero or perform cleanup', () => {
  const calls = [];
  const report = capacityReport((program, args) => {
    calls.push([program, args]);
    if (program === 'docker') throw new Error('permission denied');
    return 'SYNTHETIC measured size';
  });
  assert.equal(report.results.filesystem.status, 'MEASURED');
  assert.deepEqual(report.results.docker, { status: 'UNAVAILABLE', value: null });
  assert.equal(report.results.knownDirectories.status, 'MEASURED');
  assert.equal(report.removedBytes, 0);
  assert.deepEqual(calls.map(([program]) => program), ['df', 'df', 'docker', 'du']);
  assert.deepEqual(calls[2][1], ['system', 'df']);
});

test('HML controller accepts only complete reviewed pins; no credential or arbitrary command config', () => {
  assert.deepEqual(validateConfig(config()), config());
  for (const field of ['reviewedSha', 'bootstrapSha256']) {
    assert.throws(() => validateConfig({ ...config(), [field]: '' }));
  }
  assert.throws(() => validateConfig({ ...config(), command: 'seed' }));
  assert.throws(() => validateConfig({ ...config(), pins: { ...config().pins, SERVICE_ROLE: 'secret' } }));
  assert.throws(() => validateConfig({ ...config(), pins: {} }));
});

test('HML controller rejects synthetic, mixed-version, operational and unproven physical markers', () => {
  assert.equal(validateMarker(marker(), sha).sha, sha);
  for (const patch of [{ apiSha: 'c'.repeat(40) }, { webSha: 'c'.repeat(40) },
    { operationalDatabase: true }, { authMode: 'synthetic' }, { physicalPreflight: null },
    { physicalPreflight: {} }, { physicalPreflight: { ...marker().physicalPreflight, database: 'operational' } },
    { physicalPreflight: { ...marker().physicalPreflight, schema: 'public' } },
    { dataOrigin: 'synthetic' }]) {
    assert.throws(() => validateMarker({ ...marker(), ...patch }, sha));
  }
});

test('HML controller requests only private visibility and verifies returned port and HTTPS host', async () => {
  const calls = [];
  await forwardPrivate((program, args) => {
    calls.push([program, args]);
    return args.includes('--json') ? JSON.stringify([{ sourcePort: 15173, visibility: 'private',
      browseUrl: `https://${codespace}-15173.app.github.dev/` }]) : '';
  });
  assert.deepEqual(calls[0], ['gh', ['codespace', 'ports', 'visibility', '15173:private', '-c', codespace]]);
  for (const port of [{ sourcePort: 15173, visibility: 'public', browseUrl: 'https://example.test' },
    { sourcePort: 5173, visibility: 'private', browseUrl: 'https://example.test' },
    { sourcePort: 15173, visibility: 'private', browseUrl: 'http://example.test' }]) {
    await assert.rejects(() => forwardPrivate((_program, args) => args.includes('--json') ? JSON.stringify([port]) : ''));
  }
  await assert.rejects(() => forwardPrivate(() => { throw new Error('channel unavailable'); }), /channel unavailable/);
});

test('HML controller refuses another executor before filesystem, Docker or startup', () => {
  const run = spawnSync(process.execPath, ['scripts/legado/hml-control.mjs', 'start'], {
    encoding: 'utf8', env: { ...process.env, CODESPACE_NAME: 'not-the-authorized-codespace' },
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /HML_CONTROL_BLOCKED/);
  assert.doesNotMatch(run.stderr, /secret|password|token/i);
});

test('active HTTP and upgraded connections reproduce blocked close; owned draining leaves foreign server intact', async () => {
  const stages = [], shutdown = createOwnedShutdown({ graceMs: 30, timeoutMs: 2000, onStage: stage => stages.push(stage) });
  const api = shutdown.track('api', http.createServer((_, res) => { res.writeHead(200); res.write('synthetic pending'); }));
  const web = shutdown.track('web', http.createServer());
  web.on('upgrade', (_, socket) => socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n'));
  const foreign = http.createServer((_, res) => { res.writeHead(200); res.write('synthetic foreign'); });
  const sockets = [];
  const stream = async server => {
    const request = http.get(`http://127.0.0.1:${server.address().port}`);
    request.on('error', () => {});
    const [response] = await once(request, 'response'); response.on('error', () => {});
    sockets.push(response); return response;
  };
  try {
    for (const server of [api, web, foreign]) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); }
    await stream(api);
    const untouched = await stream(foreign);
    const upgrade = net.createConnection(web.address().port, '127.0.0.1'); sockets.push(upgrade);
    await once(upgrade, 'connect');
    upgrade.write('GET / HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
    await once(upgrade, 'data');
    let oldCloseDone = false;
    // The previous lifecycle waited indefinitely for this close before inspecting persistence.
    api.close(() => { oldCloseDone = true; });
    await new Promise(resolve => setTimeout(resolve, 15)); assert.equal(oldCloseDone, false);
    const first = shutdown.close({ close: async () => {} });
    assert.equal(shutdown.close(), first);
    const result = await first;
    assert.ok(result.forcedConnections >= 2);
    assert.equal(untouched.destroyed, false); assert.equal(foreign.listening, true);
    assert.ok(stages.some(stage => stage.stage === 'owned-connections' && stage.phase === 'DRAINED'));
    assert.equal(api.listening, false); assert.equal(web.listening, false);
    assert.throws(() => shutdown.track('api', foreign));
  } finally {
    for (const socket of sockets) socket.destroy();
    for (const server of [api, web, foreign]) { server.closeAllConnections(); server.close(); }
  }
});

test('failed Vite, trace or deadline never reports clean shutdown and still closes owned HTTP', async () => {
  for (const kind of ['vite', 'trace', 'timeout']) {
    const server = http.createServer();
    const shutdown = createOwnedShutdown({ graceMs: 5, timeoutMs: 30,
      onStage: () => { if (kind === 'trace') throw new Error('synthetic trace failure'); } });
    shutdown.track('web', server); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    await assert.rejects(shutdown.close({ close: () => kind === 'timeout' ? new Promise(() => {})
      : kind === 'vite' ? Promise.reject(new Error('synthetic vite failure')) : Promise.resolve() }), /HML_CLOSE/);
    assert.equal(server.listening, false);
  }
});

test('recovery requires fresh pinned full rows and rejects changed identity, writes, partial and stale evidence', () => {
  const now = Date.now(), baseline = { state: { rows: Array.from({ length: 100 }, (_, id) => ({ id: String(id).padStart(3, '0') })) } };
  const conservation = { observedAt: new Date(now).toISOString(), rows: 100, fullRowsMatch: true,
    readOnly: true, rolledBack: true, businessWrites: 0,
    sha256: createHash('sha256').update(JSON.stringify(baseline.state.rows)).digest('hex') };
  const plan = { pid: 12345, observedAt: now, stoppedAt: now - 1000, stateSha256: digest, lockSha256: digest,
    conservationSha256: digest, baselineSha256: digest };
  const state = { pid: plan.pid, state: 'STOPPED_EMERGENCY_REQUIRES_INSPECTION' }, lock = { pid: plan.pid };
  assert.equal(validateRecoveryEvidence(plan, state, lock, conservation, baseline, now), true);
  for (const patch of [{ rows: 99 }, { fullRowsMatch: false }, { rolledBack: false }, { readOnly: false },
    { businessWrites: 1 }, { sha256: digest }, { observedAt: new Date(now - 300001).toISOString() }]) {
    assert.throws(() => validateRecoveryEvidence(plan, state, lock, { ...conservation, ...patch }, baseline, now));
  }
  assert.throws(() => validateRecoveryEvidence(plan, { ...state, state: 'RUNNING' }, lock, conservation, baseline, now));
  assert.throws(() => validateRecoveryEvidence(plan, state, { pid: 12346 }, conservation, baseline, now));
  assert.throws(() => validateRecoveryEvidence({ ...plan, observedAt: now - 300001 }, state, lock, conservation, baseline, now));
  assert.throws(() => validateRecoveryEvidence(plan, state, lock, { ...conservation, observedAt: new Date(now - 1001).toISOString() }, baseline, now));
});

test('inspected resource archival preserves old bytes; interrupted archival blocks start rather than deleting evidence', () => {
  for (const interrupt of [false, true]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hml-recovery-synthetic-'));
    const state = JSON.stringify({ pid: 12345, state: 'STOPPED_EMERGENCY_REQUIRES_INSPECTION' });
    const lock = JSON.stringify({ pid: 12345 });
    const plan = { pid: 12345, socket: null, stateSha256: createHash('sha256').update(state).digest('hex'),
      lockSha256: createHash('sha256').update(lock).digest('hex'), conservationSha256: createHash('sha256').update('{}').digest('hex') };
    const originals = { 'api-bootstrap.private.json': state, 'writer.lock': lock,
      'hml-recovery.private.json': JSON.stringify(plan), 'recovery-conservation.private.json': '{}' };
    for (const [name, value] of Object.entries(originals)) fs.writeFileSync(path.join(root, name), value);
    try {
      let moved = 0;
      const run = () => archiveInspectedResources(root, plan, { now: 1,
        planSha256: createHash('sha256').update(originals['hml-recovery.private.json']).digest('hex'), move: (from, to) => {
        if (interrupt && ++moved === 2) throw new Error('synthetic disk failure');
        fs.renameSync(from, to);
      } });
      if (interrupt) { assert.throws(run, /synthetic disk failure/); assert.ok(fs.existsSync(path.join(root, 'hml-recovery.in-progress'))); }
      else { assert.equal(run().restartPerformed, false); assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'api-bootstrap.private.json'))).state, 'STOPPED'); }
      const archive = path.join(root, `recovery-1-${process.pid}`);
      for (const [name, value] of Object.entries(originals)) {
        const preserved = fs.existsSync(path.join(archive, name)) ? path.join(archive, name) : path.join(root, name);
        assert.equal(fs.readFileSync(preserved, 'utf8'), value);
      }
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});
