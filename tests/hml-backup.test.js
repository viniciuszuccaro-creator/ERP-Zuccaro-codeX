import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateManifest, verifyArchive, retainExternal } from '../scripts/vps/sync-hml-backup.mjs';

test('external copy rejects traversal, duplicate names, untested restores and corrupt bytes', () => {
  const valid = { name: 'hml-20261114T120000Z-00000000', bytes: 3,
    sha256: createHash('sha256').update('abc').digest('hex'), restoreVerified: true };
  assert.equal(validateManifest([valid]).length, 1);
  for (const edit of [{name:'../other'}, {restoreVerified:false}, {bytes:0}, {sha256:'wrong'}]) {
    assert.throws(() => validateManifest([{ ...valid, ...edit }]));
  }
  assert.throws(() => validateManifest([valid,valid]));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hml-copy-test-'));
  try {
    const file = path.join(dir,'archive'); fs.writeFileSync(file,'abc'); verifyArchive(file,valid);
    fs.writeFileSync(file,'def'); assert.throws(() => verifyArchive(file,valid));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('external retention removes only verified own generations and preserves older unrelated backup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hml-retain-test-'));
  try {
    fs.writeFileSync(path.join(dir,'original-backup.dump'),'preserve');
    for(let i=0;i<4;i++) {
      const name='hml-20261114T120000Z-'+i.toString(16).padStart(8,'0');
      fs.writeFileSync(path.join(dir,name+'.tar'),'abc');
      fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({name,bytes:3,
        sha256:createHash('sha256').update('abc').digest('hex'),restoreVerified:true}));
    }
    retainExternal(dir,2);
    assert.equal(fs.readdirSync(dir).filter(x=>x.endsWith('.tar')).length,2);
    assert.equal(fs.readFileSync(path.join(dir,'original-backup.dump'),'utf8'),'preserve');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('HML backup helper proves guarded retention, immutable receipts and recovery comparison', () => {
  const python = process.env.TEST_PYTHON_EXECUTABLE || 'python3';
  const code = String.raw`
import importlib.util, unittest, tempfile, pathlib, json, os
from unittest.mock import patch
s=importlib.util.spec_from_file_location('backup','scripts/vps/hml-backup.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Checks(unittest.TestCase):
 def config(self):
  r='/root/erp-private/hml-recovery-20261114/'
  return dict(container='erp-hml-pg',containerId='a'*64,image='sha256:'+'b'*64,
    database='hml_test',schema='hml_test',cluster='123',adminEnv=r+'source.env',
    appConfig=r+'config.json',backupDir=r+'scheduled-backups',pgdata=r+'pgdata-restored',keep=7)
 def test_config(self):
  self.assertEqual(m.validate_config(self.config())['keep'],7)
  for key,value in [('container','supabase-db'),('database','postgres'),('schema','public'),
   ('pgdata','/operational/pgdata-restored'),('backupDir','/tmp/scheduled-backups'),
   ('containerId','unknown'),('keep',True),('keep',1),('keep',31)]:
   c=self.config();c[key]=value
   with self.assertRaises(RuntimeError):m.validate_config(c)
 def test_comparison(self):
  m.verify_comparison({'count':2,'content':'abc'},{'count':2,'content':'abc'})
  with self.assertRaisesRegex(RuntimeError,'RESTORED_CONTENT'):m.verify_comparison({'count':2,'content':'abc'},{'count':2,'content':'different'})
 def test_wrong_container_stops_before_credentials(self):
  v=dict(Id='a'*64,Image='sha256:'+'b'*64,State=dict(Running=True),
   HostConfig=dict(NetworkMode='bridge',PortBindings={},Memory=1073741824,NanoCpus=400000000),Mounts=[])
  with patch.object(m,'command',return_value=json.dumps([v]).encode()),patch.object(m,'private') as secret:
   with self.assertRaisesRegex(RuntimeError,'PG_ISOLATION'):m.Database(self.config())
   secret.assert_not_called()
 def test_identifier(self):
  with self.assertRaises(RuntimeError):m.table_query('hml_test','x;drop table y')
 def test_receipt_immutable(self):
  with tempfile.TemporaryDirectory() as t:
   p=pathlib.Path(t)/'receipt.json';m.write_json(p,{'ok':True})
   with self.assertRaises(FileExistsError):m.write_json(p,{'ok':False})
   self.assertTrue(json.loads(p.read_text())['ok'])
 def test_checksum(self):
  with tempfile.TemporaryDirectory() as t:
   p=pathlib.Path(t)/'backup';p.write_bytes(b'first');before=m.digest(p);p.write_bytes(b'other')
   self.assertNotEqual(before,m.digest(p))
 def test_retention(self):
  with tempfile.TemporaryDirectory() as t:
   root=pathlib.Path(t);proofs=[]
   for i in range(9):
    n='hml-20261114T120000Z-'+format(i,'08x');item=dict(name=n,restoreVerified=True,bytes=1,sha256='a'*64);proofs.append(item)
    for ext in ['.tar','.json']:(root/(n+ext)).write_text('x')
   # Oldest is not copied externally: it must survive even beyond the seven kept.
   n=proofs[1]['name'];m.write_json(root/(n+'.external.json'),dict(sha256='a'*64,bytes=1))
   with patch.object(m,'items',return_value=proofs),patch.object(m,'private',side_effect=lambda p:pathlib.Path(p)):
    m.prune(root,7)
   self.assertTrue((root/(proofs[0]['name']+'.tar')).exists())
   self.assertFalse((root/(proofs[1]['name']+'.tar')).exists())
   self.assertTrue((root/(proofs[-1]['name']+'.tar')).exists())
 def test_bad_external_receipt(self):
  with tempfile.TemporaryDirectory() as t:
   root=pathlib.Path(t);n='hml-20261114T120000Z-00000000';p=dict(name=n,bytes=1,sha256='a'*64)
   m.write_json(root/(n+'.external.json'),dict(sha256='b'*64,bytes=1));(root/(n+'.tar')).write_text('x')
   with patch.object(m,'items',return_value=[p,p,p]),patch.object(m,'private',side_effect=lambda p:pathlib.Path(p)):
    with self.assertRaises(RuntimeError):m.prune(root,2)
   self.assertTrue((root/(n+'.tar')).exists())
unittest.main()
`;
  const result = spawnSync(python, ['-B', '-c', code], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true, timeout: 20000 });
  assert.equal(result.status, 0, `${result.error?.message || ''}\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /Ran 8 tests/);
});
