import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {z} from 'zod';
import {consolidation80Remainder} from './helpers/consolidation80Remainder.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const service='server/src/services/financialMovementService.ts';
test('financial command schema extraction retains exact previous service outside three approved hunks',()=>{
 const source=consolidation80Remainder(service,fs.readFileSync(service,'utf8')).replace(/\r\n/g,'\n');
 const previousImport="import {assertExactReconciliationPair,financialMovementSnapshotSchema,manualFinancialMovementSchema,manualMovementAmount} from './financialMovementPolicy.js';";
 const currentImport="import {assertExactReconciliationPair,financialMovementSnapshotSchema,manualFinancialMovementSchema,manualMovementAmount,\n  financialReconciliationCommandSchema as binding,financialMovementPageInputSchema} from './financialMovementPolicy.js';";
 const oldBinding="const binding=z.object({operationId:uuid,accountId:uuid,movementId:uuid,movementRevision:z.literal('1'),batchId:uuid,identityHash:hash,contentHash:hash}).strict();\n";
 const oldPage="    const page=z.object({accountId:uuid,limit:z.number().int().min(1).max(200).default(100),\n      offset:z.number().int().min(0).max(2147483647).default(0),unlinkedOnly:z.boolean().default(false)}).strict().parse(input);";
 assert.equal(source.split(currentImport).length,2);assert.equal(source.split('    const page=financialMovementPageInputSchema.parse(input);').length,2);
 const restored=source.replace(currentImport,previousImport).replace('const row=z.object(',oldBinding+'const row=z.object(')
  .replace('    const page=financialMovementPageInputSchema.parse(input);',oldPage);
 // Frozen complete source digest is set independently from the stage76 preservation.
 assert.equal(hash(restored),previousServiceHash);
});
import crypto from 'node:crypto';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const previousServiceHash='1d9d462c436a77279369d4e1d63b7956f4a6ad85875a52095684402b1331f843';
test('canonical policy retains its complete previous source outside the two extracted schema exports',()=>{
 const addition="export const financialReconciliationCommandSchema=z.object({operationId:uuid,accountId:uuid,movementId:uuid,\n  movementRevision:z.literal('1'),batchId:uuid,identityHash:hash,contentHash:hash}).strict();\nexport const financialMovementPageInputSchema=z.object({accountId:uuid,limit:z.number().int().min(1).max(200).default(100),\n  offset:z.number().int().min(0).max(2147483647).default(0),unlinkedOnly:z.boolean().default(false)}).strict();\n";
 const source=fs.readFileSync('server/src/services/financialMovementPolicy.ts','utf8').replace(/\r\n/g,'\n');
 assert.equal(source.split(addition).length,2);assert.equal(hash(source.replace(addition,'')),'50539d6b4fb4e8dfd8254a6948c66388782ebf47b91aa84266135828d5efa5fc');
});
test('prepared financial routes are not imported into operational assembly and add no movement reversal',()=>{
 for(const file of ['server/src/app.ts','server/src/api/router.ts'])assert.ok(!fs.readFileSync(file,'utf8').includes('mountFinancialMovementRoutes'));
 assert.ok(!fs.readFileSync(service,'utf8').includes('reverseMovement('));
 const route=fs.readFileSync('server/src/api/financialMovementRoutes.ts','utf8');
 assert.ok(route.includes('bankHttpBoundary'));assert.ok(route.includes('service.reverseLink(ctx,command)'));
});
test('extracted canonical input schemas preserve old acceptance and defaults without granting identities',()=>{
 const file='server/src/services/financialMovementPolicy.ts',source=fs.readFileSync(file,'utf8');
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),wanted=new Set(['financialReconciliationCommandSchema','financialMovementPageInputSchema']);
 const declarations=[];for(const statement of ast.statements)if(ts.isVariableStatement(statement))for(const decl of statement.declarationList.declarations)if(wanted.has(decl.name.getText(ast)))declarations.push(decl.getText(ast));
 assert.equal(declarations.length,2);
 const uuid=z.string().uuid(),digest=z.string().regex(/^[a-f0-9]{64}$/);
 const current=new Function('z','uuid','hash',declarations.map(text=>'const '+text+';').join('\n')+'return {binding:financialReconciliationCommandSchema,page:financialMovementPageInputSchema};')(z,uuid,digest);
 const oldBinding=z.object({operationId:uuid,accountId:uuid,movementId:uuid,movementRevision:z.literal('1'),batchId:uuid,identityHash:digest,contentHash:digest}).strict();
 const oldPage=z.object({accountId:uuid,limit:z.number().int().min(1).max(200).default(100),offset:z.number().int().min(0).max(2147483647).default(0),unlinkedOnly:z.boolean().default(false)}).strict();
 const id='11111111-1111-4111-8111-111111111111',binding={operationId:id,accountId:id,movementId:id,movementRevision:'1',batchId:id,identityHash:'a'.repeat(64),contentHash:'b'.repeat(64)};
 const outcome=result=>result.success?{success:true,data:result.data}:{success:false,issues:result.error.issues};
 for(const value of [binding,{}, {...binding,movementRevision:'2'},{...binding,groupId:id},{...binding,accountId:1}])assert.deepEqual(outcome(current.binding.safeParse(value)),outcome(oldBinding.safeParse(value)));
 for(const value of [{accountId:id},{accountId:id,limit:200,offset:2147483647,unlinkedOnly:true},{accountId:id,limit:201},{accountId:id,offset:-1},{accountId:id,unlinkedOnly:'true'},{accountId:id,groupId:id}])assert.deepEqual(outcome(current.page.safeParse(value)),outcome(oldPage.safeParse(value)));
});
test('prepared financial HTTP and existing canonical service/RBAC/audit suites execute using synthetic data only',()=>{
 const env={...process.env};for(const key of Object.keys(env))if(/DATABASE|SUPABASE|TOKEN|PASSWORD|SECRET|API_KEY|ERP_|BASE44|OPENAI|AUTH_|PGHOST|PGPORT|PGUSER|PGPASS|PGDATABASE/i.test(key))delete env[key];
 delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['--import','tsx','--test','--test-reporter=tap','tests/financial-movement-http.test.ts','tests/financial-movement-policy.test.ts','tests/financial-consolidacao.test.ts'],{cwd:path.join(root,'server'),env,encoding:'utf8',timeout:180000,maxBuffer:2e6,windowsHide:true});
 assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/# tests 22\b/);assert.match(result.stdout,/# pass 22\b/);assert.match(result.stdout,/# fail 0/);assert.match(result.stdout,/# skipped 0/);
});
