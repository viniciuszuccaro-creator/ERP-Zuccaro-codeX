import test from 'node:test';
import assert from 'node:assert/strict';
import { testEnvironment } from '../scripts/run-tests.mjs';

test('test runner preserves Linux environment without probing Windows paths', () => {
  const env = { PATH: '/synthetic/bin', SYNTHETIC: 'unchanged' };
  assert.deepEqual(testEnvironment(env, 'linux', () => { throw Error('unexpected probe'); }), env);
});
test('Windows runner discovers Git Bash and changes only child PATH without dropping fixtures', () => {
  const env = { Path: 'C:\\Windows\\System32;C:\\synthetic-bin', ProgramFiles: 'C:\\Program Files', SYNTHETIC: 'unchanged' };
  const snapshot = { ...env };
  const result = testEnvironment(env, 'win32', candidate => candidate === 'C:\\Program Files\\Git\\bin\\bash.exe');
  assert.deepEqual(env, snapshot);
  assert.equal(result.SYNTHETIC, env.SYNTHETIC);
  assert.ok(result.Path.startsWith('C:\\Program Files\\Git\\bin;C:\\Program Files\\Git\\usr\\bin;'));
  assert.ok(result.Path.endsWith(env.Path));
});
test('Windows runner rejects missing Git Bash rather than reporting skipped shell coverage', () => {
  assert.throws(() => testEnvironment({ Path: 'C:\\Windows\\System32' }, 'win32', () => false), /prerequisite missing/);
});
