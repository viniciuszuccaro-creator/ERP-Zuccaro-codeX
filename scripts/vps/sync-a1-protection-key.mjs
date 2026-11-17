import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {secureRoot} from './sync-hml-backup.mjs';

const remoteRoot='/root/erp-private/hml-recovery-20261114/a1-vault-keys';
const strict=['-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes'];
export function validateA1KeyMetadata(value,keyId){
 assert.match(keyId,/^[A-Za-z0-9_-]{1,80}$/);
 assert.equal(value?.id,keyId);assert.equal(value?.bytes,32);assert.equal(value?.uid,1000);
 assert.equal(value?.mode,0o400);assert.equal(value?.links,1);assert.equal(value?.directoryMode,0o700);
 assert.equal(value?.directoryUid,1000);assert.match(value?.sha256,/^[a-f0-9]{64}$/);
 return value;
}
function run(bin,args,input,env=process.env){
 const p=spawnSync(bin,args,{input,env,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:8192});
 assert.equal(p.status,0,'A1_PRIVATE_TRANSFER_FAILED');return p.stdout;
}
/** Independent private key backup. No certificate discovery, key generation or database access. */
export function backupA1ProtectionKey(clientConfig,keyId){
 assert.match(keyId,/^[A-Za-z0-9_-]{1,80}$/);
 const c=JSON.parse(fs.readFileSync(clientConfig,'utf8'));
 assert.deepEqual(Object.keys(c).sort(),['localRoot','sshAlias']);secureRoot(c.localRoot);
 const folder=path.join(c.localRoot,'a1-protection-keys');
 if(!fs.existsSync(folder))fs.mkdirSync(folder,{mode:0o700});
 secureRoot(folder);
 const script=`import os,json,hashlib,stat
p='${remoteRoot}/${keyId}.key'
d=os.lstat('${remoteRoot}');assert stat.S_ISDIR(d.st_mode) and d.st_uid==1000 and stat.S_IMODE(d.st_mode)==0o700
fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
try:
 s=os.fstat(fd);assert stat.S_ISREG(s.st_mode) and s.st_uid==1000 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o400 and s.st_size==32
 b=os.read(fd,33);assert len(b)==32
 print(json.dumps({'id':'${keyId}','bytes':32,'uid':s.st_uid,'mode':stat.S_IMODE(s.st_mode),'links':s.st_nlink,'directoryMode':stat.S_IMODE(d.st_mode),'directoryUid':d.st_uid,'sha256':hashlib.sha256(b).hexdigest()}))
finally:os.close(fd)
`;
 // Maintenance alias is already authorized; do not widen the backup-only SSH principal.
 const meta=validateA1KeyMetadata(JSON.parse(run('ssh',[...strict,'erp-zuccaro-vps','python3','-'],script)),keyId);
 const file=path.join(folder,keyId+'.key'),receipt=path.join(folder,keyId+'.receipt.private.json');
 const inspectLocal=target=>{
  const s=fs.lstatSync(target);assert.ok(s.isFile()&&!s.isSymbolicLink()&&s.size===32&&s.nlink===1);
  if(process.platform==='win32'){
   const check='$ErrorActionPreference="Stop";$me=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value;'
    +'foreach($a in (Get-Acl -LiteralPath $env:A1_BACKUP_FILE).Access){if($a.AccessControlType -eq "Allow"){$sid=$a.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value;if($sid -notin @($me,"S-1-5-18","S-1-5-32-544")){throw "PRIVATE_FILE_ACL"}}};"PRIVATE_FILE_ACL_OK"';
   assert.match(run('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(check,'utf16le').toString('base64')],undefined,
    {...process.env,A1_BACKUP_FILE:target}),/PRIVATE_FILE_ACL_OK/);
  }else{assert.equal(s.uid,process.getuid());assert.equal(s.mode&0o077,0);}
  const bytes=fs.readFileSync(target);try{assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);}finally{bytes.fill(0);}
 };
 if(fs.existsSync(file)){
  inspectLocal(file);assert.ok(fs.existsSync(receipt),'A1_BACKUP_RECEIPT_REQUIRED');
  assert.equal(JSON.parse(fs.readFileSync(receipt,'utf8')).sha256,meta.sha256);
  return {status:'PRIVATE_A1_KEY_BACKUP_VERIFIED',replay:true};
 }
 assert.ok(!fs.existsSync(receipt),'A1_BACKUP_CONFLICT');
 const partial=path.join(folder,'.'+keyId+'-'+randomUUID()+'.partial');
 run('scp',[...strict,'erp-zuccaro-vps:'+remoteRoot+'/'+keyId+'.key',partial]);
 inspectLocal(partial);secureRoot(folder);
 if(process.platform!=='win32')fs.chmodSync(partial,0o400);
 fs.renameSync(partial,file);
 fs.writeFileSync(receipt,JSON.stringify({kind:'INDEPENDENT_PRIVATE_KEY_BACKUP',at:new Date().toISOString(),id:keyId,
  sha256:meta.sha256,bytes:32,transport:'EXISTING_SSH',atRest:'PRIVATE_OS_ACL_NOT_CLAIMED_ENCRYPTED',
  includedInDatabaseBackup:false,restoreDrillVerified:false}),{flag:'wx',mode:0o600});
 return {status:'PRIVATE_A1_KEY_BACKUP_VERIFIED',replay:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(backupA1ProtectionKey(process.argv[2],process.argv[3])));}
 catch{console.error('A1_PRIVATE_KEY_BACKUP_BLOCKED');process.exitCode=1;}
}
