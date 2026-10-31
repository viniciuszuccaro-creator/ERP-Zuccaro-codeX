import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { isAbsolute, normalize, parse, sep } from 'node:path';
import { AppError } from '../api/errors.js';
import type { A1ProtectionKeys } from './a1VaultEncryption.js';

const validId = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id);
function unavailable(): never {
  throw new AppError(503, 'A1_PROTECTION_KEY_UNAVAILABLE', 'Certificate protection key unavailable');
}

/** Server configuration only. Separate read-only secret mount; never an upload/storage directory. */
export class A1FileProtectionKeys implements A1ProtectionKeys {
  constructor(private readonly directory: string, private readonly activeId: string) {}

  async active(): Promise<{ id: string; bytes: Buffer }> {
    return { id: this.activeId, bytes: await this.read(this.activeId) };
  }

  async read(id: string): Promise<Buffer> {
    const handles = [];
    const scratch = Buffer.alloc(33);
    let result: Buffer | undefined;
    try {
      if (process.platform !== 'linux' || !process.getuid || !validId(id) || !validId(this.activeId)
        || !isAbsolute(this.directory) || normalize(this.directory) !== this.directory) return unavailable();
      const uid = process.getuid();
      const root = parse(this.directory).root;
      const segments = this.directory.slice(root.length).split(sep).filter(Boolean);
      if (!segments.length || segments.length > 32 || this.directory.length > 4096) return unavailable();
      let current = root;
      // Pin every ancestor by descriptor, rejecting symlinks and writable untrusted parents.
      for (let index = -1; index < segments.length; index++) {
        if (index >= 0) current = `/proc/self/fd/${handles[handles.length - 1].fd}/${segments[index]}`;
        const handle = await open(current, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        handles.push(handle);
        const stat = await handle.stat();
        const final = index === segments.length - 1;
        const trustedSticky = stat.uid === 0 && (stat.mode & 0o1000) !== 0;
        if (!stat.isDirectory() || (stat.uid !== 0 && stat.uid !== uid)
          || ((stat.mode & 0o022) !== 0 && !trustedSticky)
          || (final && (stat.uid !== uid || (stat.mode & 0o077) !== 0))) return unavailable();
      }
      const directory = handles[handles.length - 1];
      const file = await open(`/proc/self/fd/${directory.fd}/${id}.key`,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      handles.push(file);
      const before = await file.stat({ bigint: true });
      if (!before.isFile() || before.uid !== BigInt(uid) || before.nlink !== 1n || before.size !== 32n
        || (before.mode & 0o7777n) !== 0o400n) return unavailable();
      const { bytesRead } = await file.read(scratch, 0, scratch.length, 0);
      const after = await file.stat({ bigint: true });
      if (bytesRead !== 32 || after.size !== before.size || after.mtimeNs !== before.mtimeNs
        || after.ctimeNs !== before.ctimeNs || after.mode !== before.mode || after.uid !== before.uid
        || after.nlink !== before.nlink) return unavailable();
      result = Buffer.from(scratch.subarray(0, 32));
      return result;
    } catch { return unavailable(); }
    finally {
      scratch.fill(0);
      // All descriptors must be released, including after a preceding close failure.
      const closed = await Promise.allSettled(handles.reverse().map(handle => handle.close()));
      if (closed.some(entry => entry.status === 'rejected')) { result?.fill(0); unavailable(); }
    }
  }
}
