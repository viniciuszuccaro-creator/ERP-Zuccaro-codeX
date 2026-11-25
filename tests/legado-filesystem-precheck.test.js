import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('private staging precheck uses real synthetic filesystem metadata only', () => {
  const run = spawnSync(process.env.TEST_PYTHON_EXECUTABLE || 'python3', [fileURLToPath(new URL('./legado_filesystem_precheck_test.py', import.meta.url))], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /Ran 6 tests/);
});
