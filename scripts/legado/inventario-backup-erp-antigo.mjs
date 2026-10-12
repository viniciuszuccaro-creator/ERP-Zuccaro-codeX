// Shared read-only engine extracted from the Bash inventory for Windows access and equivalence.
import { createHash } from 'node:crypto';
import { createReadStream,realpathSync } from 'node:fs';
import { readdir, lstat, mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const hash = value => createHash('sha256').update(value).digest('hex');
const secret = name => /USUSENHA|SENHA\.TPS$|PASSWORD/i.test(name);
const formats = { sql:'sql_texto', gz:'arquivo_gzip', zip:'arquivo_zip', bak:'backup_nativo_possivel',
  dump:'dump_binario_possivel', dmp:'dump_binario_possivel', mdf:'sqlserver_data_log', ldf:'sqlserver_data_log',
  csv:'planilha_texto', tsv:'planilha_texto', xlsx:'planilha_office', xls:'planilha_office',
  rar:'arquivo_compactado', '7z':'arquivo_compactado', tps:'clarion_tps' };
const digestFile = async path => {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
};
const safeError = code => Object.assign(new Error(code), { code });
const within = (root,path) => { const rel=relative(root,path); return !rel || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)); };

/** Verifies bytes of declared extraction files, not original-backup lineage or business equivalence. */
export async function verifyPrivateExtractionFiles(root,manifest,{hashFile=digestFile}={}) {
  if(manifest?.privateOnly!==true||manifest.operationalImportAuthorized!==false
    ||manifest.operationalDatabaseTouched!==false||manifest.originalBackupModified!==false
    ||!Array.isArray(manifest.files)||manifest.files.length<1||manifest.files.length>1000)
    throw safeError('LEGACY_EXTRACTION_MANIFEST_INVALID');
  const names=new Set();
  for(const file of manifest.files){
    if(typeof file.fileName!=='string'||!file.fileName||file.fileName.length>255||/[\\/:\u0000-\u001f\u007f]/.test(file.fileName)
      ||['.','..'].includes(file.fileName)||names.has(file.fileName.toLowerCase())
      ||!Number.isSafeInteger(file.bytes)||file.bytes<0||!/^[a-f0-9]{64}$/.test(file.fileSha256))
      throw safeError('LEGACY_EXTRACTION_MANIFEST_INVALID');
    names.add(file.fileName.toLowerCase());
  }
  // Sync canonicalization is supported on the authorized Windows source where the native async API returns EPERM.
  // It still resolves links; source ACLs, containment and file-type checks are never suppressed.
  const origin=realpathSync(root),results=[];
  for(const [index,file] of manifest.files.entries()){
    if(secret(file.fileName)||/password|senha|token|credential|credencial|private[-_]key|^\.env(?:\.|$)|\.(?:pem|key|pfx|p12)$/i.test(file.fileName)){
      results.push({index,status:'blocked_secret'});continue;
    }
    try{
      const target=resolve(origin,file.fileName),before=await lstat(target,{bigint:true});
      if(before.isSymbolicLink()||!before.isFile()||before.nlink!==1n||!within(origin,realpathSync(target))){results.push({index,status:'blocked_link_or_type'});continue;}
      const digest=await hashFile(target),after=await lstat(target,{bigint:true});
      const stable=after.isFile()&&!after.isSymbolicLink()&&after.nlink===1n&&before.ino===after.ino&&before.size===after.size&&before.mtimeNs===after.mtimeNs;
      results.push({index,status:!stable?'source_changed':before.size===BigInt(file.bytes)&&digest===file.fileSha256?'verified':'divergent'});
    }catch(error){results.push({index,status:error.code==='ENOENT'?'missing':['EPERM','EACCES'].includes(error.code)?'access_denied':'unavailable'});}
  }
  return {scope:'extraction_file_hash_only',declaredFilesVerified:results.every(r=>r.status==='verified'),results,
    sourceLineageVerified:false,originalBackupEquivalent:false,importAuthorized:false,imported:false};
}

/** Resolves a unit-review manifest inside private staging, never by first match or sigla.
 * The manifest declares hashes, not sizes; extraction verification measures stability.
 * This proves referenced bytes only, never semantic identity or approved target IDs.
 */
export async function verifyPrivateUnitReviewReferences(root,manifest,{hashFile=digestFile,maxDepth=5,maxEntries=10000}={}) {
  const fields=['sourceFile','apiSnapshotFile','reviewFile'];
  if(manifest?.operationalImportAuthorized!==false||manifest.exactSiglaIsIdentityProof!==false
    ||!Number.isSafeInteger(maxDepth)||maxDepth<0||maxDepth>10
    ||!Number.isSafeInteger(maxEntries)||maxEntries<1||maxEntries>100000)
    throw safeError('LEGACY_UNIT_REVIEW_MANIFEST_INVALID');
  const names=new Set();
  for(const key of fields){
    const name=manifest[key];
    if(typeof name!=='string'||!name||name.length>255||/[\\/:\u0000-\u001f\u007f]/.test(name)
      ||['.','..'].includes(name)||names.has(name.toLowerCase())
      ||!/^[a-f0-9]{64}$/.test(manifest[key.replace('File','Sha256')]))
      throw safeError('LEGACY_UNIT_REVIEW_MANIFEST_INVALID');
    names.add(name.toLowerCase());
  }
  const origin=realpathSync(root),matches=new Map([...names].map(name=>[name,[]]));
  let entries=0,scanComplete=true;
  async function walk(directory,depth){
    for(const item of await readdir(directory,{withFileTypes:true})){
      if(++entries>maxEntries)throw safeError('LEGACY_REVIEW_SCAN_LIMIT');
      const target=resolve(directory,item.name),stat=await lstat(target);
      // Never follow linked subdirectories or ignore an inaccessible subtree.
      if(stat.isSymbolicLink()||!within(origin,realpathSync(target)))throw safeError('LEGACY_REVIEW_SCAN_LINK');
      if(stat.isDirectory()){
        if(depth>=maxDepth)throw safeError('LEGACY_REVIEW_SCAN_LIMIT');
        await walk(target,depth+1);
      }else if(matches.has(item.name.toLowerCase()))matches.get(item.name.toLowerCase()).push(target);
    }
  }
  try{await walk(origin,0);}catch{scanComplete=false;}
  const results=[];
  for(const [index,key]of fields.entries()){
    const candidates=matches.get(manifest[key].toLowerCase());
    if(!scanComplete){results.push({index,status:'scan_incomplete'});continue;}
    if(candidates.length!==1){results.push({index,status:candidates.length?'ambiguous':'missing'});continue;}
    try{
      const target=candidates[0],stat=await lstat(target,{bigint:true});
      if(!within(origin,realpathSync(target))){results.push({index,status:'blocked_link_or_type'});continue;}
      if(stat.size>BigInt(Number.MAX_SAFE_INTEGER)){results.push({index,status:'unavailable'});continue;}
      const report=await verifyPrivateExtractionFiles(dirname(target),{privateOnly:true,
        operationalImportAuthorized:false,operationalDatabaseTouched:false,originalBackupModified:false,
        files:[{fileName:basename(target),fileSha256:manifest[key.replace('File','Sha256')],bytes:Number(stat.size)}]}, {hashFile});
      results.push({index,status:report.results[0].status});
    }catch(error){results.push({index,status:error.code==='ENOENT'?'missing':['EPERM','EACCES'].includes(error.code)?'access_denied':'unavailable'});}
  }
  return {scope:'unit_review_reference_hash_only',scanComplete,
    declaredReferencesVerified:results.every(result=>result.status==='verified'),results,
    semanticEquivalenceVerified:false,targetMappingApproved:false,sourceLineageVerified:false,
    originalBackupEquivalent:false,importAuthorized:false,imported:false};
}

export async function writeInventoryReport(root, report, result) {
  const origin=await realpath(root), target=resolve(report);
  if (within(origin,target)) throw safeError('LEGACY_REPORT_MUST_BE_OUTSIDE_SOURCE');
  let ancestor=dirname(target), canonical;
  while (!canonical) {
    try { canonical=await realpath(ancestor); }
    catch (error) {
      if (error.code !== 'ENOENT' || dirname(ancestor) === ancestor) throw error;
      ancestor=dirname(ancestor);
    }
  }
  if (within(origin,resolve(canonical,relative(ancestor,target)))) throw safeError('LEGACY_REPORT_MUST_BE_OUTSIDE_SOURCE');
  await mkdir(dirname(target),{recursive:true});
  const parent=await realpath(dirname(target));
  if (within(origin,parent)) throw safeError('LEGACY_REPORT_MUST_BE_OUTSIDE_SOURCE');
  // Never overwrite a symlink or an existing backup/report.
  await writeFile(target,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
}

export async function inventoryBackup(root, { hashFile = digestFile } = {}) {
  const origin = await realpath(root);
  const files = [];
  async function walk(directory) {
    // No rglob error suppression: an unreadable subtree invalidates the complete inventory.
    for (const item of (await readdir(directory, { withFileTypes:true })).sort((a,b)=>a.name.localeCompare(b.name))) {
      const path = resolve(directory, item.name);
      const before = await lstat(path, { bigint:true });
      if (before.isSymbolicLink()) throw safeError('LEGACY_SYMLINK_REQUIRES_REVIEW');
      if (before.isDirectory()) { await walk(path); continue; }
      if (!before.isFile()) throw safeError('LEGACY_SPECIAL_FILE_REQUIRES_REVIEW');
      if (before.nlink > 1n) throw safeError('LEGACY_HARDLINK_REQUIRES_REVIEW');
      const blocked = secret(item.name);
      const digest = blocked ? null : await hashFile(path);
      const after = await lstat(path, { bigint:true });
      if (before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ino !== after.ino) {
        throw safeError('LEGACY_SOURCE_CHANGED_DURING_INVENTORY');
      }
      if (before.size > BigInt(Number.MAX_SAFE_INTEGER)) throw safeError('LEGACY_FILE_SIZE_UNSAFE');
      const extension = (item.name.includes('.') ? item.name.split('.').at(-1).toLowerCase() : '') || 'sem_extensao';
      files.push({ name:blocked ? 'BLOCKED_SECRET_FILENAME' : item.name.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g,'REDACTED_EMAIL').replace(/[\u0000-\u001f\u007f]/g,'_'), extension,
        path_sha256:hash(relative(origin,path).split(sep).join('/')), bytes:Number(before.size), sha256:digest,
        format:blocked ? 'blocked_secret_candidate' : (formats[extension] || `ext_${extension}`),
        mtime_utc:new Date(Number(before.mtimeMs)).toISOString() });
    }
  }
  await walk(origin);
  return { schema_version:2, complete:true, generated_at_utc:new Date().toISOString(), file_count:files.length,
    bytes_total:files.reduce((sum,file)=>sum+file.bytes,0), files,
    note:'Somente metadados. Sem conteudo. Nao commitar manifestos privados ou dumps.' };
}

function validatedManifest(manifest) {
  if (manifest?.schema_version !== 2 || manifest.complete !== true || !Array.isArray(manifest.files)
    || manifest.file_count !== manifest.files.length) throw safeError('LEGACY_MANIFEST_INVALID');
  const keys = new Set();
  for (const file of manifest.files) {
    if (!/^[a-f0-9]{64}$/.test(file.path_sha256) || keys.has(file.path_sha256)
      || !Number.isSafeInteger(file.bytes) || file.bytes < 0
      || (file.format !== 'blocked_secret_candidate' && !/^[a-f0-9]{64}$/.test(file.sha256))
      || (file.format === 'blocked_secret_candidate' && file.sha256 !== null)) throw safeError('LEGACY_MANIFEST_INVALID');
    keys.add(file.path_sha256);
  }
  if (manifest.bytes_total !== manifest.files.reduce((sum,file)=>sum+file.bytes,0)) throw safeError('LEGACY_MANIFEST_INVALID');
  return new Map(manifest.files.map(file=>[file.path_sha256,file]));
}

export function compareBackupManifests(source, copy) {
  const left = validatedManifest(source), right = validatedManifest(copy);
  let missing=0, changed=0, blocked=0, matched=0;
  for (const [key,file] of left) {
    const other=right.get(key);
    if (!other) { missing++; continue; }
    if (file.format === 'blocked_secret_candidate' || other.format === 'blocked_secret_candidate') {
      blocked++;if(file.bytes !== other.bytes) changed++;continue;
    }
    if (file.bytes !== other.bytes || file.sha256 !== other.sha256) changed++; else matched++;
  }
  const extra=[...right.keys()].filter(key=>!left.has(key)).length;
  return { equivalent:missing===0 && extra===0 && changed===0 && blocked===0, matched,missing,extra,changed,blocked,
    imported:false, note:'Equivalencia de bytes e caminhos; significado, referencias e destino ainda exigem reconciliacao.' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === '--compare') {
      if (process.argv.length !== 5) throw safeError('LEGACY_COMPARE_REQUIRES_TWO_MANIFESTS');
      const [source,copy]=await Promise.all(process.argv.slice(3).map(async path=>JSON.parse(await readFile(path,'utf8'))));
      const result=compareBackupManifests(source,copy);
      console.log(JSON.stringify(result));
      if (!result.equivalent) process.exitCode=1;
    } else {
    const root=process.env.BACKUP_DIR, report=process.env.REPORT;
    if (!root) throw safeError('LEGACY_SOURCE_REQUIRED');
    const result=await inventoryBackup(root);
    result.folder_name=process.env.FOLDER_NAME || 'BACKUP ERP ANTIGO - CODEX';
    console.log(`file_count=${result.file_count}`);
    for (const file of result.files) {
      console.log(`file name=${file.name} bytes=${file.bytes} sha256=${file.sha256 || 'NOT_READ'} format=${file.format} mtime_utc=${file.mtime_utc}`);
      if (file.format === 'blocked_secret_candidate') console.log('NOTE blocked_secret_candidate=nao_abrir_conteudo');
    }
    console.log(`bytes_total=${result.bytes_total}`);
    for (const [field,prefix,title] of [['extension','ext','EXTENSOES'],['format','format','FORMATOS']]) {
      const counts=new Map();for(const file of result.files) counts.set(file[field],(counts.get(file[field])||0)+1);
      console.log(`--- ${title} ---`);
      for(const key of [...counts.keys()].sort()) console.log(`${prefix}_${key}=${counts.get(key)}`);
    }
    if (report) { await writeInventoryReport(root,report,result); console.log('report_written=YES'); }
    }
  } catch (error) { console.error(`BLOCKED: ${error.code || 'LEGACY_INVENTORY_FAILED'}`); process.exitCode=1; }
}
