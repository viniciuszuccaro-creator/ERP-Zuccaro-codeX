import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { capacityReport, forwardPrivate, validateConfig, validateMarker, withStartLease, codespace } from '../scripts/legado/hml-control.mjs';

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
