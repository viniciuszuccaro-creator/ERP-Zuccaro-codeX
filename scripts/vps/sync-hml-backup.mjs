import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootRemote = '/root/erp-private/hml-recovery-20261114';
const pattern = /^hml-\d{8}T\d{6}Z-[a-f0-9]{8}$/;
const strict = ['-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes'];

export function validateManifest(value) {
  assert.ok(Array.isArray(value));
  const seen = new Set();
  for (const m of value) {
    assert.match(m.name, pattern);
    assert.ok(!seen.has(m.name)); seen.add(m.name);
    assert.match(m.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(m.bytes) && m.bytes > 0 && m.bytes <= 512 * 1024 * 1024);
    assert.equal(m.restoreVerified, true);
  }
  return value;
}

function command(bin, args, env = process.env) {
  const p = spawnSync(bin, args, { env, windowsHide: true, encoding: 'utf8', timeout: 180000, maxBuffer: 1024 * 1024 });
  assert.equal(p.status, 0, `${bin}_FAILED`);
  return p.stdout;
}

export function secureRoot(root) {
  assert.equal(path.resolve(root), root);
  assert.ok(!/^d:/i.test(root), 'EXTERNAL_BACKUP_HD_NOT_A_RUNTIME');
  const stat = fs.lstatSync(root);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
  assert.equal(fs.realpathSync(root), root);
  if (process.platform === 'win32') {
    const check = '$ErrorActionPreference="Stop"; $me=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; '
      + '$acl=[System.IO.Directory]::GetAccessControl($env:HML_BACKUP_LOCAL_ROOT); '
      + 'foreach($a in $acl.Access){if($a.AccessControlType -eq "Allow"){$sid=$a.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value; '
      + 'if($sid -notin @($me,"S-1-5-18","S-1-5-32-544")){throw "PRIVATE_DIRECTORY_ACL"}}}; "PRIVATE_ACL_OK"';
    // EncodedCommand preserves quoting across Node/Windows argv; no policy bypass.
    assert.match(command('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(check, 'utf16le').toString('base64')],
      { ...process.env, HML_BACKUP_LOCAL_ROOT: root }), /PRIVATE_ACL_OK/);
  } else {
    assert.equal(stat.uid, process.getuid());
    assert.equal(stat.mode & 0o077, 0);
  }
}

export function verifyArchive(file, manifest) {
  const s = fs.lstatSync(file);
  assert.ok(s.isFile() && !s.isSymbolicLink());
  assert.equal(s.size, manifest.bytes);
  const fd = fs.openSync(file, 'r');
  const h = createHash('sha256'), buf = Buffer.alloc(1024 * 1024);
  try { let n; while ((n = fs.readSync(fd, buf)) > 0) h.update(buf.subarray(0, n)); }
  finally { fs.closeSync(fd); }
  assert.equal(h.digest('hex'), manifest.sha256);
}

export function retainExternal(root, keep = 30) {
  assert.ok(Number.isSafeInteger(keep) && keep >= 2);
  const records = fs.readdirSync(root).filter(n => pattern.test(n.replace(/\.json$/, '')) && n.endsWith('.json'))
    .sort().map(n => {
      const file = path.join(root, n), s = fs.lstatSync(file);
      assert.ok(s.isFile() && !s.isSymbolicLink());
      const item = JSON.parse(fs.readFileSync(file, 'utf8'));
      validateManifest([item]); assert.equal(item.name + '.json', n);
      verifyArchive(path.join(root, item.name + '.tar'), item);
      return item;
    });
  for (const item of records.slice(0, Math.max(0, records.length - keep))) {
    fs.unlinkSync(path.join(root, item.name + '.tar'));
    fs.unlinkSync(path.join(root, item.name + '.json'));
  }
}

export function sync(configFile) {
  const c = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert.deepEqual(Object.keys(c).sort(), ['localRoot', 'sshAlias']);
  assert.equal(c.sshAlias, 'erp-zuccaro-vps');
  secureRoot(c.localRoot);
  const lock = path.join(c.localRoot, '.copy.lock');
  const fd = fs.openSync(lock, 'wx', 0o600);
  try {
  const ssh = (...args) => command('ssh', [...strict, c.sshAlias, ...args]);
  const remote = `${rootRemote}/backup-runtime/hml-backup.py`;
  const config = `${rootRemote}/backup.private.json`;
  const manifest = validateManifest(JSON.parse(ssh(`python3 ${remote} --list ${config}`)));
  assert.ok(manifest.length > 0, 'NO_VERIFIED_BACKUPS');
  const disk = fs.statfsSync(c.localRoot);
  assert.ok(disk.bavail * disk.bsize > 1024 ** 3 + manifest.reduce((n, m) => n + m.bytes, 0), 'EXTERNAL_DISK_RESERVE');
  for (const item of manifest) {
    const final = path.join(c.localRoot, item.name + '.tar');
    const receipt = path.join(c.localRoot, item.name + '.json');
    if (!fs.existsSync(final)) {
      const partial = final + '.partial';
      assert.ok(!fs.existsSync(partial), 'PARTIAL_BACKUP_REQUIRES_REVIEW');
      command('scp', [...strict, `${c.sshAlias}:${rootRemote}/scheduled-backups/${item.name}.tar`, partial]);
      verifyArchive(partial, item);
      fs.chmodSync(partial, 0o600); fs.renameSync(partial, final);
    }
    verifyArchive(final, item);
    if (!fs.existsSync(receipt)) fs.writeFileSync(receipt, JSON.stringify(item), { flag: 'wx', mode: 0o600 });
    else {
      assert.ok(fs.lstatSync(receipt).isFile() && !fs.lstatSync(receipt).isSymbolicLink());
      assert.deepEqual(JSON.parse(fs.readFileSync(receipt, 'utf8')), item);
    }
    assert.match(ssh(`python3 ${remote} --ack ${config} ${item.name} ${item.sha256}`), /EXTERNAL_ACK_VERIFIED/);
  }
  retainExternal(c.localRoot);
  console.log(JSON.stringify({ status: 'PRIVATE_EXTERNAL_COPIES_VERIFIED', backups: manifest.length }));
  } finally {
    fs.closeSync(fd); fs.unlinkSync(lock);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { assert.equal(process.argv.length, 3); sync(process.argv[2]); }
  catch (error) { console.error('HML_EXTERNAL_COPY_BLOCKED:' + error.code); process.exitCode = 1; }
}
