/**
 * Launcher Node para o harness PGlite BFF (usa tsx do server).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const serverDir = path.join(repoRoot, 'server');
const harness = path.join(serverDir, 'scripts/expedicao-pglite-bff-harness.ts');

const child = spawn(
  process.execPath,
  ['--import', 'tsx', harness],
  {
    cwd: serverDir,
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: 'inherit',
  },
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
