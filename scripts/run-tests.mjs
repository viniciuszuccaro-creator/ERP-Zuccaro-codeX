import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Shell contract tests require Git Bash on Windows, not the unrelated WSL launcher.
export function testEnvironment(env, platform = process.platform, exists = fs.existsSync) {
  if (platform !== 'win32') return { ...env };
  const key = Object.keys(env).find(name => name.toLowerCase() === 'path') || 'Path';
  const candidates = [
    ...String(env[key] || '').split(';').map(folder => path.win32.join(folder, 'bash.exe')),
    ...[env.ProgramFiles, env['ProgramFiles(x86)']].filter(Boolean).map(folder => path.win32.join(folder, 'Git', 'bin', 'bash.exe')),
    ...(env.LOCALAPPDATA ? [path.win32.join(env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe')] : []),
  ];
  const bash = candidates.find(candidate => /[\\/]Git[\\/](?:usr[\\/])?bin[\\/]bash\.exe$/i.test(candidate) && exists(candidate));
  if (!bash) throw new Error('Test prerequisite missing: install Git Bash for Windows; shell tests were not skipped.');
  const bin = path.win32.dirname(bash);
  const root = path.win32.dirname(bin).endsWith('usr') ? path.win32.dirname(path.win32.dirname(bin)) : path.win32.dirname(bin);
  return { ...env, [key]: [bin, path.win32.join(root, 'usr', 'bin'), env[key] || ''].join(';') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const child = spawn(process.execPath, ['--test', ...(args.length ? args : ['tests/**/*.test.js'])], {
    env: testEnvironment(process.env), stdio: 'inherit', windowsHide: true,
  });
  child.on('error', error => { console.error('Unable to start test runner:', error.code); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
}
