import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('A1 native capability is built from canonical source and smoke-tested before short-lived export', () => {
  const workflow = readFileSync(new URL('../.github/workflows/erp-runtime-ci.yml', import.meta.url), 'utf8');
  const job = workflow.slice(workflow.indexOf('  a1-native-runtime:'), workflow.indexOf('  frontend:'));
  assert.match(job, /server\/Dockerfile server/);
  assert.match(job, /--network none --read-only --cap-drop ALL/);
  assert.match(job, /--tmpfs \/tmp:rw,noexec,nosuid,size=64m/);
  assert.ok(job.indexOf('node /run/a1-smoke.mjs') < job.indexOf('bash scripts/vps/package-a1-native.sh'));
  assert.match(job, /retention-days: 1/);
  assert.match(job, /if-no-files-found: error/);
  assert.doesNotMatch(job, /secrets\.|ssh |scp |deploy/i);
  const packager = readFileSync(new URL('../scripts/vps/package-a1-native.sh', import.meta.url), 'utf8');
  assert.match(packager, /linux\/amd64/);
  assert.match(packager, /mustPassExistingImageSmokeBeforeUse.*True/);
  assert.match(packager, /libssl\.so\.3 libcrypto\.so\.3/);
  assert.match(packager, /sha256sum/);
  assert.doesNotMatch(packager, /docker (?:system|volume) prune|apt-get|["']\.env["']/);
});
