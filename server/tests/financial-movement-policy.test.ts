import test from 'node:test';
import assert from 'node:assert/strict';
import {manualFinancialMovementSchema,manualMovementAmount,assertExactReconciliationPair} from '../src/services/financialMovementPolicy.ts';

const groupId='11111111-1111-4111-8111-111111111111',empresaId='22222222-2222-4222-8222-222222222222',
  accountId='33333333-3333-4333-8333-333333333333',id='44444444-4444-4444-8444-444444444444',
  batchId='55555555-5555-4555-8555-555555555555';
const scope={groupId,empresaId};
const manual={operationId:id,accountId,occurredAt:'2026-10-16T10:30:00-03:00',direction:'entrada',amountMinor:'9007199254740993',description:'Synthetic manual entry'};
const source={...scope,accountId,batchId,identityHash:'a'.repeat(64),contentHash:'b'.repeat(64),amountMinor:'9007199254740993',currency:'BRL',reversed:false};
const movement={...scope,id,accountId,currency:'BRL',amountMinor:'9007199254740993',occurredAt:manual.occurredAt,revision:'1',state:'POSTED',origin:'MANUAL'};

test('manual command preserves exact signed cents, zero and offset without creating a bank source or title',()=>{
  assert.equal(manualMovementAmount(manual),'9007199254740993');
  assert.equal(manualMovementAmount({...manual,direction:'saida'}),'-9007199254740993');
  for(const direction of ['entrada','saida'])assert.equal(manualMovementAmount({...manual,direction,amountMinor:'0'}),'0');
  assert.equal(manualFinancialMovementSchema.parse(manual).occurredAt,manual.occurredAt);
});

test('manual command rejects legacy IDs, floating point, signs, invalid calendar and claimed payment source',()=>{
  for(const patch of [{accountId:1},{amountMinor:1},{amountMinor:'1.23'},{amountMinor:'-1'},
    {amountMinor:'01'},{amountMinor:'1e3'},{occurredAt:'2026-02-30T10:00:00Z'},{occurredAt:'2026-10-16T10:00:00+99:99'},
    {sourceId:id},{origin:'PAYMENT'},{groupId},{empresaId},{state:'POSTED'}]){
    assert.throws(()=>manualFinancialMovementSchema.parse({...manual,...patch}));
  }
});

test('exact reconciliation checks independent bank evidence and posted movement identities without coercion',()=>{
  assert.deepEqual(assertExactReconciliationPair(scope,source,movement),{source,movement});
  for(const amountMinor of ['0','-1234']){
    assert.equal(assertExactReconciliationPair(scope,{...source,amountMinor},{...movement,amountMinor}).source.amountMinor,amountMinor);
  }
  for(const patch of [{groupId:id},{empresaId:id},{accountId:id},{amountMinor:'-9007199254740993'},
    {amountMinor:'9007199254740992'},{state:'REVERSED'}]){
    assert.throws(()=>assertExactReconciliationPair(scope,source,{...movement,...patch}),{code:'FINANCIAL_RECONCILIATION_CONFLICT'});
  }
  assert.throws(()=>assertExactReconciliationPair(scope,{...source,reversed:true},movement),{code:'FINANCIAL_RECONCILIATION_CONFLICT'});
  for(const patch of [{identityHash:''},{batchId:0},{amountMinor:'-0'},{amountMinor:0},{raw:{}}])
    assert.throws(()=>assertExactReconciliationPair(scope,{...source,...patch},movement));
});
