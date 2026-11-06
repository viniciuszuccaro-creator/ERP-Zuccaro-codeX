import { portalReadRemainder } from './helpers/portalReadRemainder.js';
import {runtimeProofSource} from './helpers/runtimeProofSource.js';
import { boletoSourceRemainder } from './helpers/boletoSourceRemainder.js';
import { partialInputRemainder } from './helpers/partialInputRemainder.js';
import { metricReportRemainder } from './helpers/metricReportRemainder.js';
import { consumerWindowRemainder } from './helpers/consumerWindowRemainder.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {queryKeyMigrationRemainder} from './helpers/queryKeyMigrationRemainder.js';
import {primitiveUiBoundaryRemainder} from './helpers/primitiveUiBoundaryRemainder.js';
import {iaResponseValidationRemainder} from './helpers/iaResponseValidationRemainder.js';
import {readBoundaryRemainder} from './helpers/readBoundaryRemainder.js';
import {componentContractRemainder} from './helpers/componentContractRemainder.js';

const fixtures=JSON.parse(fs.readFileSync('tests/fixtures/date-arithmetic-stage21.json','utf8'));
test('date arithmetic cohort is fixed at 28 modules and 79 proven native Date operands',()=>{
  assert.equal(fixtures.length,28);
  assert.equal(fixtures.reduce((n,f)=>n+f.operands,0),79);
  assert.equal(new Set(fixtures.map(f=>f.file)).size,28);
});
for(const fixture of fixtures) test(`${fixture.file}: exact timestamp edits preserve all remaining executable code`,()=>{
  let source=queryKeyMigrationRemainder(fixture.file,primitiveUiBoundaryRemainder(fixture.file,iaResponseValidationRemainder(fixture.file,readBoundaryRemainder(fixture.file,componentContractRemainder(fixture.file,portalReadRemainder(fixture.file,runtimeProofSource(fixture.file)))))));
  source=metricReportRemainder(fixture.file,boletoSourceRemainder(fixture.file,source));
  if(fixture.file==='src/components/rh/PontoTab.jsx')source=partialInputRemainder(fixture.file,source);
  if(fixture.file==='src/components/financeiro/contas-receber/TabelaReceber.jsx') source=consumerWindowRemainder(fixture.file,source);
  const ast=ts.createSourceFile(fixture.file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
  assert.equal(ast.parseDiagnostics.length,0);
  const replacements=new Map();
  for(const {before,after} of fixture.lines){
    assert.equal(after.split('.getTime()').join(''),before.split('.getTime()').join(''));
    const entry=replacements.get(after)||{before,count:0};
    assert.equal(entry.before,before);entry.count++;replacements.set(after,entry);
  }
  for(const [after,{before,count}] of replacements){
    assert.equal(source.split(after).length-1,count,'Changed-line occurrence count');
    source=source.split(after).join(before);
  }
  const emitted=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
    jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),fixture.emittedBeforeSha256);
});

const arithmeticProof=`const assert=require('node:assert/strict');
const values=[undefined,null,0,-1,1,86400000,-86400000,'invalid','',
'2024-02-29T23:59:59.999Z','2024-03-01T00:00:00.000Z',
'2024-11-03T01:30:00-04:00','2024-11-03T01:30:00-05:00',
'2018-11-04T00:30:00','2011-12-30T12:00:00',8640000000000000,-8640000000000000];
for(const left of values)for(const right of values){
  const a=new Date(left),b=new Date(right);
  const before=a-b,after=a.getTime()-b.getTime();
  assert.ok(Object.is(before,after));
  for(const unit of [1,1000,60000,3600000,86400000])for(const round of [Math.floor,Math.ceil,Math.round,Math.trunc])
    assert.ok(Object.is(round(before/unit),round(after/unit)));
  for(const limit of [-1,0,1,3600000,86400000]){
    assert.equal(before>limit,after>limit);assert.equal(before<limit,after<limit);
  }
  assert.ok(Object.is(1700000000000-a,1700000000000-a.getTime()));
  assert.ok(Object.is(a-1700000000000,a.getTime()-1700000000000));
}
const inputs=['2024-02-29','invalid','2024-03-01','1970-01-01'];
assert.deepEqual(inputs.toSorted((a,b)=>new Date(a)-new Date(b)),inputs.toSorted((a,b)=>new Date(a).getTime()-new Date(b).getTime()));`;
for(const timezone of ['UTC','America/Sao_Paulo','America/New_York','Pacific/Apia']) test(`native date differences, rounding, bounds, invalid dates and sorting remain equivalent in ${timezone}`,()=>{
  execFileSync(process.execPath,['-e',arithmeticProof],{env:{...process.env,TZ:timezone},stdio:'pipe'});
});
