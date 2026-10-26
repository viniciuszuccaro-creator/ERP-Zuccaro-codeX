import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const manifest=JSON.parse(fs.readFileSync(new URL('./helpers/publicationBaselineManifest.json',import.meta.url),'utf8'));
const base='e36231b3a7e546aa9fd2529abb8d5edb61d8189c';
test('publication baseline is the verified composition commit and is available in Git history',()=>{
 assert.equal(manifest.base,base);
 assert.equal(execFileSync('git',['rev-parse',`${base}^{commit}`],{encoding:'utf8'}).trim(),base);
 execFileSync('git',['merge-base','--is-ancestor',base,'HEAD']);
 assert.equal(manifest.cases.length,18);
});
const previousBulkEnumeration = "  assert.deepEqual([...newMembers.keys()].filter(name => !oldMembers.has(name)), ['export', 'restoreBulkSnapshot']);";
const approvedBulkDelta = `  assert.deepEqual([...newMembers.keys()].filter(name => !oldMembers.has(name)),
    ['export', 'correctInactiveLegacyName', 'restoreBulkSnapshot']);
  // Keep the old-method invariant; the authorized lifecycle addition must remain a pure delegation.
  const expected = members(parse(\`class Expected {
  correctInactiveLegacyName(ctx: RequestContext, input: unknown) {
    return correctInactiveLegacyName({ repo: this.repo, audit: this.audit, rbac: this.rbacGuard }, ctx, input);
  }
}\`));
  assert.equal(newMembers.get('correctInactiveLegacyName'), expected.get('correctInactiveLegacyName'));
  assert(after.statements.some(statement => ts.isImportDeclaration(statement)
    && statement.moduleSpecifier.getText(after) === "'./clienteLegacyNameCorrection.js'"));`;
function restoreApprovedBulkDelta(source) {
 assert.equal(source.split(approvedBulkDelta).length,2,'Only the exact authorized lifecycle delta may be normalized');
 return source.replace(approvedBulkDelta,previousBulkEnumeration);
}
test('bulk lifecycle evolution retains the original hash and rejects changed or repeated delegation assertions',()=>{
 const source=fs.readFileSync('server/tests/bulk-consolidacao.test.ts','utf8').replace(/\r\n/g,'\n');
 const restored=restoreApprovedBulkDelta(source);
 assert.equal(restored.includes(approvedBulkDelta),false);
 assert.throws(()=>restoreApprovedBulkDelta(source.replace('rbac: this.rbacGuard','rbac: this.otherGuard')));
 assert.throws(()=>restoreApprovedBulkDelta(source+approvedBulkDelta));
 assert.notEqual(crypto.createHash('sha256').update(restoreApprovedBulkDelta(source.replace('for (const [name, text] of oldMembers)','for (const [name, text] of newMembers)'))).digest('hex'),
   crypto.createHash('sha256').update(restored).digest('hex'));
});
for(const entry of manifest.cases)test(entry.path+': publication fixes only Git reference, preserving every prior assertion',()=>{
 const source=fs.readFileSync(entry.path,'utf8').replace(/\r\n/g,'\n');
 assert.equal(source.includes('HEAD:'),false);
 assert.equal(source.includes("'HEAD'"),false);
 assert.equal((source.match(new RegExp(base,'g'))||[]).length,entry.references);
 // The prior proof remains byte-identical after subtracting only the explicitly tested lifecycle addition.
 const reviewed=clienteConferenciaRemainder(entry.path,source);
 const prior=entry.path==='server/tests/bulk-consolidacao.test.ts'?restoreApprovedBulkDelta(reviewed):reviewed;
 const restored=prior.replaceAll(base+':','HEAD:').replaceAll(JSON.stringify(base),"'HEAD'");
 assert.equal(crypto.createHash('sha256').update(restored).digest('hex'),entry.beforeSha256);
});
test('CI retains historical source for proofs and checks frontend types before build',()=>{
 const source=fs.readFileSync('.github/workflows/erp-runtime-ci.yml','utf8');
 const frontend=source.slice(source.indexOf('  frontend:'),source.indexOf('  backend:'));
 assert.match(frontend,/fetch-depth: 0/);
 assert.ok(frontend.indexOf('npm run typecheck')>frontend.indexOf('npm ci'));
 assert.ok(frontend.indexOf('npm run typecheck')<frontend.indexOf('npm run build'));
});
test('future private exports and certificate/key files are ignored without reading any private file',()=>{
 for(const file of ['local-imports/synthetic-future.json','backups/synthetic-future.dump','synthetic-future.pfx','synthetic-future.p12','synthetic-future.pem','synthetic-future.key','.env.synthetic-future']){
  execFileSync('git',['check-ignore','--no-index','-q','--',file]);
 }
});

test('CANAL preserves every historical publication manifest byte',()=>{assert.equal(fs.readFileSync('tests/helpers/publicationBaselineManifest.json','utf8'),execFileSync('git',['show','90f0a315eb3d2b59e0c2bfcab7077abc27bc3613:tests/helpers/publicationBaselineManifest.json'],{encoding:'utf8'}));});
