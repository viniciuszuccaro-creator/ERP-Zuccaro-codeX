import { spawn, type ChildProcess, type StdioOptions } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { Writable } from 'node:stream';
import { AppError } from '../api/errors.js';

export type A1NativeRuntime = { binary?: string; timeoutMs?: number };
/** Internal backend runner; arguments and auxiliary pipes must never come from HTTP configuration. */
export async function runA1Native(args: string[], input: Buffer, pipes: Buffer[], runtime: A1NativeRuntime, signal?: AbortSignal) {
  const binary = runtime.binary ?? '/usr/bin/openssl', timeout = runtime.timeoutMs ?? 8000;
  if (process.platform !== 'linux' || !isAbsolute(binary) || binary.includes('\0') || binary.length > 4096
    || !Number.isInteger(timeout) || timeout < 1 || timeout > 8000)
    throw new AppError(503, 'A1_INSPECTION_UNAVAILABLE', 'Certificate inspection unavailable');
  if (signal?.aborted) throw new AppError(409, 'A1_INSPECTION_ABORTED', 'Certificate inspection cancelled');
  return new Promise<{ output: Buffer; diagnostics: Buffer }>((resolve, reject) => {
    const copied = pipes.map(pipe => Buffer.from(pipe));
    const stdio: StdioOptions = ['pipe', 'pipe', 'pipe'];
    for (let n = 0; n < pipes.length; n++) stdio.push('pipe');
    let child: ChildProcess;
    try {
      child = spawn(binary, args, { shell: false, windowsHide: true, stdio,
        env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', OPENSSL_CONF: '/dev/null' } });
    } catch {
      for (const bytes of copied) bytes.fill(0);
      reject(new AppError(503, 'A1_INSPECTION_UNAVAILABLE', 'Certificate inspection unavailable')); return;
    }
    const output: Buffer[] = [], diagnostics: Buffer[] = [];
    let outputSize = 0, diagnosticsSize = 0;
    let failed = false, timedOut = false, cancelled = false, missing = false;
    const kill = () => { if (child.exitCode === null) child.kill('SIGKILL'); };
    const abort = () => { cancelled = true; kill(); };
    const timer = setTimeout(() => { timedOut = true; kill(); }, timeout);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.on('error', () => { missing = true; });
    child.stdin?.on('error', () => { failed = true; kill(); });
    for (let n = 0; n < copied.length; n++) {
      const pipe = child.stdio[n + 3];
      if (!(pipe instanceof Writable)) { failed = true; kill(); continue; }
      pipe.on('error', () => { failed = true; kill(); }); pipe.end(copied[n]);
    }
    child.stdout?.on('data', (chunk: Buffer) => {
      outputSize += chunk.length;
      if (outputSize > 262144) { chunk.fill(0); failed = true; kill(); } else output.push(chunk);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      diagnosticsSize += chunk.length;
      if (diagnosticsSize > 16384) { chunk.fill(0); failed = true; kill(); } else diagnostics.push(chunk);
    });
    child.on('close', code => {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      try {
        if (missing) return reject(new AppError(503, 'A1_INSPECTION_UNAVAILABLE', 'Certificate inspection unavailable'));
        if (cancelled) return reject(new AppError(409, 'A1_INSPECTION_ABORTED', 'Certificate inspection cancelled'));
        if (timedOut) return reject(new AppError(503, 'A1_INSPECTION_TIMEOUT', 'Certificate inspection timed out'));
        if (failed || code !== 0) return reject(new AppError(422, 'A1_PKCS12_INVALID', 'Invalid certificate container'));
        resolve({ output: Buffer.concat(output), diagnostics: Buffer.concat(diagnostics) });
      } finally { for (const chunk of [...copied, ...output, ...diagnostics]) chunk.fill(0); }
    });
    child.stdin?.end(input);
  });
}
