import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import {
  criarSnapshotReconciliacaoLegado, reconciliarPilotoGrupoLegado,
  persistirEnderecoClienteGrupoLegado,
} from '../scripts/legado/consumir-lote-staging.mjs';

const sourcePath='scripts/legado/consumir-lote-staging.mjs';
const exportLine="export { persistirEnderecoClienteGrupoLegado, criarRegistroEnderecoPilotoPostgres } from './persistencia-endereco-legado.mjs';\n";
const readHead=path=>execFileSync('git',['show',`e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`],{encoding:'utf8'}).replaceAll('\r\n','\n');

test('importer consolidation preserves every remote consumer/reconciliation byte except the reviewed address export',()=>{
  const current=fs.readFileSync(sourcePath,'utf8').replaceAll('\r\n','\n');
  assert.equal(current.split(exportLine).length,2);
  assert.equal(current.replace(exportLine,''),readHead(sourcePath));
});

test('importer consolidation retains all remote staging tests unchanged while adding preserved address tests',()=>{
  const path='tests/legado-consumir-lote-staging.test.js';
  const collect=text=>{
    const file=ts.createSourceFile(path,text.replaceAll('\r\n','\n'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    return new Map(file.statements.filter(ts.isExpressionStatement).map(statement=>statement.expression)
      .filter(expression=>ts.isCallExpression(expression)&&expression.expression.getText(file)==='test')
      .map(expression=>[expression.arguments[0].text,expression.getText(file)]));
  };
  const before=collect(readHead(path)),after=collect(fs.readFileSync(path,'utf8'));
  assert.equal(before.size,13);assert.equal(after.size,23);
  for(const [name,text] of before)assert.equal(after.get(name),text,name);
});

test('remote pilot reconciliation remains read-only, ambiguous identities blocked and reports exclude private values',async()=>{
  const ctx={groupId:'synthetic-group',empresaId:null,actorId:'synthetic-actor',requestId:'synthetic-correlation'};
  const record={id:'synthetic-client',group_id:ctx.groupId,empresa_id:null,codigo:'000001',ativo:true,
    origem:'MIGRACAO',source_system:'SYNTHETIC_PRIVATE_SOURCE',codigo_legado:'SYNTHETIC_PRIVATE_CODE',legacy_id:'SYNTHETIC_PRIVATE_CODE',
    migration_batch:'SYNTHETIC_PRIVATE_BATCH',tipo:'Pessoa Física',nome:'SYNTHETIC_PRIVATE_NAME',documento:null,razao_social:null};
  const snapshot=criarSnapshotReconciliacaoLegado('cliente',record);
  let denied=false,ambiguous=false,reads=0;
  const rbacGuard={assertAllowed:async(scope,module,section,action,options)=>{
    assert.equal(scope,ctx);assert.equal(module,'Cadastros');assert.equal(section,'cliente');assert.equal(action,'visualizar');
    assert.equal(options.allowGlobalWildcard,false);if(denied)throw Object.assign(new Error('SYNTHETIC_DENIED'),{code:'PERMISSION_DENIED'});
  }};
  const options={rbacGuard,services:{cliente:{findByLegacyIdentity:async(scope,system,code)=>{
    reads++;assert.equal(scope,ctx);assert.equal(system,record.source_system);assert.equal(code,record.codigo_legado);
    if(ambiguous)throw Object.assign(new Error('SYNTHETIC_AMBIGUOUS'),{code:'LEGACY_RECONCILIATION_REQUIRED'});
    return structuredClone(record);
  }}}};
  const report=await reconciliarPilotoGrupoLegado(ctx,[snapshot],options);
  assert.equal(report.equivalente,true);assert.equal(report.somente_leitura,true);assert.equal(report.aprovacao_importacao_operacional,false);
  for(const value of [record.id,record.nome,record.source_system,record.codigo_legado,record.migration_batch])assert(!JSON.stringify(report).includes(value));
  ambiguous=true;
  const conflict=await reconciliarPilotoGrupoLegado(ctx,[snapshot],options);
  assert.equal(conflict.equivalente,false);assert.equal(conflict.totais.ambiguos,1);
  assert.equal(conflict.resultados[0].resultado,'identidade_ambigua');
  denied=true;const before=reads;
  await assert.rejects(reconciliarPilotoGrupoLegado(ctx,[snapshot],options),{code:'PERMISSION_DENIED'});
  assert.equal(reads,before);
  await assert.rejects(reconciliarPilotoGrupoLegado({...ctx,empresaId:'synthetic-company'},[snapshot],options),/LEGACY_RECONCILIATION_CONTRACT_REQUIRED/);
});

test('address persistence has no default transaction, rejects company/actor mismatch and cannot silently authorize the pilot',async()=>{
  const source={groupId:'synthetic-group',key:'synthetic-address-key',clienteId:'synthetic-client',fingerprint:'a'.repeat(64),
    raw:{endereco:'SYNTHETIC_ADDRESS'},transformation:{version:'synthetic-v1'},payload:{legacy_id:'synthetic-legacy-address'}};
  await assert.rejects(persistirEnderecoClienteGrupoLegado(source),/LEGACY_ADDRESS_TRANSACTION_REQUIRED/);
  let permissionCalls=0;
  for(const ctx of [{groupId:source.groupId,empresaId:'synthetic-company',actorId:'synthetic-actor'},
    {groupId:source.groupId,empresaId:null,actorId:null},{groupId:'another-group',actorId:'synthetic-actor'}]){
    const transaction=async(_source,work)=>work({ctx,service:{},registry:{},rbacGuard:{assertAllowed:async()=>{permissionCalls++;}}});
    await assert.rejects(persistirEnderecoClienteGrupoLegado(source,{transaction}),/LEGACY_ADDRESS_SCOPE_INVALID/);
  }
  assert.equal(permissionCalls,0);
  assert.equal(clienteConferenciaRemainder('server/src/api/router.ts',fs.readFileSync('server/src/api/router.ts','utf8')),readHead('server/src/api/router.ts'));
  assert.equal(execFileSync('git',['diff',"e36231b3a7e546aa9fd2529abb8d5edb61d8189c",'--','server/migrations','server/src/app.ts'],{encoding:'utf8'}),'');
});
