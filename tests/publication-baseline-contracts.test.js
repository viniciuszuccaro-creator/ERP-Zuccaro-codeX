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
for(const entry of manifest.cases)test(entry.path+': publication fixes only Git reference, preserving every prior assertion',()=>{
 const source=fs.readFileSync(entry.path,'utf8').replace(/\r\n/g,'\n');
 assert.equal(source.includes('HEAD:'),false);
 assert.equal(source.includes("'HEAD'"),false);
 assert.equal((source.match(new RegExp(base,'g'))||[]).length,entry.references);
 const restored=source.replaceAll(base+':','HEAD:').replaceAll(JSON.stringify(base),"'HEAD'");
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
