import test from 'node:test';
import assert from 'node:assert/strict';
import {validateA1KeyMetadata} from '../scripts/vps/sync-a1-protection-key.mjs';
test('private A1 key backup rejects unsafe metadata and never normalizes a path into a key id',()=>{
 const value={id:'a1-hml',bytes:32,uid:1000,mode:0o400,links:1,directoryMode:0o700,directoryUid:1000,sha256:'a'.repeat(64)};
 assert.equal(validateA1KeyMetadata(value,'a1-hml'),value);
 for(const patch of [{bytes:31},{uid:0},{mode:0o644},{links:2},{directoryMode:0o755},{directoryUid:0},{sha256:'invalid'}]){
  assert.throws(()=>validateA1KeyMetadata({...value,...patch},'a1-hml'));
 }
 for(const id of ['../key','key/other','','a'.repeat(81)])assert.throws(()=>validateA1KeyMetadata(value,id));
});
