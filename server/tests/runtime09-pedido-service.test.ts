import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.js';
import type { RequestContext } from '../src/audit/types.js';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.js';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.js';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import { InMemoryPedidoRepository } from '../src/repositories/inMemoryPedidoRepository.js';
import type { OrcamentoCreate } from '../src/repositories/orcamentoTypes.js';
import type { PedidoCreate } from '../src/repositories/pedidoTypes.js';
import { PedidoService } from '../src/services/pedidoService.js';

const groupId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',empresaId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',actorId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const clienteEmpresaId='11111111-1111-4111-8111-111111111111',clienteId='12111111-1111-4111-8111-111111111111',condicaoId='22222222-2222-4222-8222-222222222222',produtoId='33333333-3333-4333-8333-333333333333',unidadeId='44444444-4444-4444-8444-444444444444';
const ctx:RequestContext={requestId:'req-pedido',actorId,actorEmail:'synthetic@example.invalid',groupId,empresaId};
const direct:PedidoCreate={cliente_empresa_id:clienteEmpresaId,condicao_pagamento_id:condicaoId,tipo_operacao:'ENTREGA',data_entrega_solicitada:'2027-03-10T00:00:00.000Z',itens:[{produto_id:produtoId,unidade_id:unidadeId,descricao:'Produto sintetico',unidade_sigla:'UN',quantidade:'2',preco_unitario:'10',desconto:'0',requer_producao:true}]};
const quote:OrcamentoCreate={cliente_empresa_id:clienteEmpresaId,condicao_pagamento_id:condicaoId,validade_em:'2027-02-10T00:00:00.000Z',itens:[{produto_id:produtoId,unidade_id:unidadeId,descricao:'Produto sintetico',unidade_sigla:'UN',quantidade:'2',preco_unitario:'10',desconto:'0'}]};

function fixture() {
  const repo=new InMemoryPedidoRepository(),orcamentos=new InMemoryOrcamentoRepository(),audit=new InMemoryAuditRepository(),tenant=new InMemoryTenantGuard(),rbac=new InMemoryRbacGuard();
  tenant.link(empresaId,groupId);
  rbac.link({actorId,groupId,permissions:{Comercial:{pedido: ['visualizar','criar', 'aprovar','editar','cancelar','converter-pedido','alterar-status']}}});
  const service=new PedidoService(repo,orcamentos,audit,tenant,rbac,
    {getEmpresaLinkById:async()=>({id:clienteEmpresaId,cliente_id:clienteId,ativo:true,bloqueado:false,habilitado_operacao:true} as never)},
    {getById:async()=>({id:produtoId,ativo:true,unidade_medida_id:unidadeId} as never)},
    {getById:async()=>({id:unidadeId,ativo:true} as never)},
    {get:async()=>({id:condicaoId,ativo:true} as never)},
    {get:async()=>({id:'local',ativo:true} as never)},
    {get:async()=>({id:'obra',ativo:true} as never)},
    {get:async()=>({id:'tabela',ativo:true} as never)},
    {resolveSalePrice:async()=>({preco:'10.000000',tabela_preco_id:'tabela'})},
  );
  return {service,repo,orcamentos,audit,rbac};
}

test('PedidoService cria lista consulta atualiza e audita sem aceitar total do cliente',async()=>{const f=fixture();const created=await f.service.create(ctx,direct);assert.equal(created.total,'20.000000');await assert.rejects(f.service.create(ctx,{...direct,total:'999'}),/Invalid Pedido payload/);assert.equal((await f.service.list(ctx)).meta.total,1);assert.equal((await f.service.get(ctx,created.id)).id,created.id);const updated=await f.service.update(ctx,created.id,{...direct,itens:[{...direct.itens[0],quantidade:'3'}]});assert.equal(updated.numero,created.numero);assert.equal(updated.total,'30.000000');assert.deepEqual((await f.audit.listByEntity('Pedido',created.id)).map(row=>row.action),['create','update']);});

test('Pedido direto reexecuta a mesma chave sem duplicar, mas rejeita payload divergente',async()=>{
  const f=fixture();
  const input={...direct,idempotency_key:'55555555-5555-4555-8555-555555555555'};
  const first=await f.service.create(ctx,input);
  const replay=await f.service.create({...ctx,requestId:'retry-after-lost-response'},input);
  assert.equal(replay.id,first.id);
  assert.equal((await f.repo.list({groupId,empresaId})).total,1);
  assert.equal((await f.audit.listByEntity('Pedido',first.id)).filter(row=>row.action==='create').length,1);
  f.rbac.link({actorId,groupId,permissions:{Comercial:{pedido:['criar']}}});
  assert.equal((await f.service.create({...ctx,requestId:'retry-create-only'},input)).id,first.id);
  const otherActor='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  f.rbac.link({actorId:otherActor,groupId,permissions:{Comercial:{pedido:['criar']}}});
  await assert.rejects(f.service.create({...ctx,actorId:otherActor},input),(error:any)=>error.statusCode===409&&error.code==='PEDIDO_IDEMPOTENCY_CONFLICT');
  await assert.rejects(f.service.create(ctx,{...input,itens:[{...input.itens[0],quantidade:'3'}]}),(error:any)=>error.statusCode===409&&error.code==='PEDIDO_IDEMPOTENCY_CONFLICT');
  assert.equal((await f.repo.list({groupId,empresaId})).total,1);
  await assert.rejects(f.service.create({...ctx,actorId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'},input),(error:any)=>error.statusCode===403);
  f.rbac.link({actorId,groupId,permissions:{Comercial:{pedido:['editar']}}});
  await assert.rejects(f.service.update(ctx,first.id,input),(error:any)=>error.statusCode===422);
});

test('cinco retries concorrentes da mesma intenção geram um Pedido e uma auditoria',async()=>{
  const f=fixture();
  const input={...direct,idempotency_key:'66666666-6666-4666-8666-666666666666'};
  const results=await Promise.all(Array.from({length:5},(_,index)=>f.service.create({...ctx,requestId:`parallel-${index}`},input)));
  assert.equal(new Set(results.map(row=>row.id)).size,1);
  assert.equal((await f.repo.list({groupId,empresaId})).total,1);
  assert.equal((await f.audit.listByEntity('Pedido',results[0].id)).filter(row=>row.action==='create').length,1);
});

test('conversao Orcamento Pedido e transacional idempotente e preserva snapshots',async()=>{const f=fixture();const original=await f.orcamentos.create({groupId,empresaId},quote);const order=await f.service.convert(ctx,original.id,{tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-03-10T00:00:00.000Z'});assert.equal(order.orcamento_id,original.id);assert.equal(order.numero,'00000001');assert.equal(order.total,original.total);assert.equal(order.itens[0].descricao,original.itens[0].descricao);assert.equal((await f.orcamentos.get({groupId,empresaId},original.id))?.status,'EM_ABERTO');await assert.rejects(f.service.convert(ctx,original.id,{tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-03-10T00:00:00.000Z'}),(error:any)=>error.statusCode===409&&error.code==='ORCAMENTO_ALREADY_CONVERTED');assert.equal((await f.repo.list({groupId,empresaId})).total,1);});

test('workflow Pedido bloqueia transicoes invalidas e registra historico Finalizado',async()=>{const f=fixture();const order=await f.service.create(ctx,direct);await assert.rejects(f.service.transition(ctx,order.id,'FINALIZADO'),(error:any)=>error.statusCode===409);await f.service.transition(ctx,order.id,'EM_PRODUCAO');await f.service.transition(ctx,order.id,'PRONTO_ENTREGA');const final=await f.service.transition(ctx,order.id,'FINALIZADO');assert.equal(final.status,'FINALIZADO');assert.deepEqual((await f.service.history(ctx,order.id)).map(row=>row.status_novo),['EM_ABERTO','EM_PRODUCAO','PRONTO_ENTREGA','FINALIZADO']);await assert.rejects(f.service.cancel(ctx,order.id,'cancelar'),(error:any)=>error.statusCode===409);});

test('PedidoService falha fechado em tenant e RBAC',async()=>{const f=fixture();await assert.rejects(f.service.list({...ctx,actorId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}),(error:any)=>error.statusCode===403);await assert.rejects(f.service.list({...ctx,empresaId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'}));await assert.rejects(f.service.get(ctx,'invalido'),(error:any)=>error.statusCode===400);});
test('Pedido revalida criar editar status cancelar e conversao sem efeitos quando permissao muda',async()=>{
 for(const action of ['criar','editar','alterar-status','cancelar','converter-pedido'])for(const revokeAt of [2,3]){
  const f=fixture(),order=await f.service.create(ctx,direct),original=await f.orcamentos.create({groupId,empresaId},quote);
  const before={orders:await f.repo.list({groupId,empresaId}),history:await f.repo.history({groupId,empresaId},order.id),audit:await f.audit.listByEntity('Pedido',order.id)};
  const allowed=f.rbac.assertAllowed.bind(f.rbac);let calls=0;
  f.rbac.assertAllowed=async(...args:any[])=>{if(args[3]===action&&++calls===revokeAt)throw Object.assign(Error('synthetic revoked permission'),{code:'PERMISSION_DENIED'});return(allowed as any)(...args);};
  const run=()=>action==='criar'?f.service.create(ctx,direct):action==='editar'?f.service.update(ctx,order.id,direct):action==='alterar-status'?f.service.transition(ctx,order.id,'EM_PRODUCAO'):action==='cancelar'?f.service.cancel(ctx,order.id,'Synthetic cancellation'):f.service.convert(ctx,original.id,{tipo_operacao:'RETIRADA',data_entrega_solicitada:direct.data_entrega_solicitada});
  await assert.rejects(run,e=>e.code==='PERMISSION_DENIED');assert.equal(calls,revokeAt);
  assert.deepEqual({orders:await f.repo.list({groupId,empresaId}),history:await f.repo.history({groupId,empresaId},order.id),audit:await f.audit.listByEntity('Pedido',order.id)},before);
  f.rbac.assertAllowed=allowed;assert.equal((await f.service.create(ctx,direct)).numero,'00000002');
 }
});
test('Pedido captura tenant e ator antes da espera sem seguir alteracao do chamador',async()=>{
 const f=fixture(),caller={...ctx},transaction=f.repo.withTransaction.bind(f.repo);
 f.repo.withTransaction=fn=>transaction(async tx=>{caller.groupId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';caller.actorId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';return fn(tx);});
 const order=await f.service.create(caller,direct);assert.equal(order.group_id,ctx.groupId);assert.equal(order.vendedor_id,ctx.actorId);
 assert.equal((await f.audit.listByEntity('Pedido',order.id))[0].actorId,ctx.actorId);
});

test('Pedido get/list/history nao promovem ator trocado durante espera de tenant', async () => {
  for (const method of ['get', 'list', 'history'] as const) {
    const f = fixture();
    const row = await f.service.create(ctx, direct);
    const caller = { ...ctx, actorId: '99999999-9999-4999-8999-999999999999' };
    const pending = method === 'get' ? f.service.get(caller, row.id)
      : method === 'list' ? f.service.list(caller) : f.service.history(caller, row.id);
    caller.actorId = ctx.actorId;
    await assert.rejects(pending, error => error instanceof Error
      && 'code' in error && error.code === 'PERMISSION_DENIED', method);
    assert.equal((await f.repo.list({ groupId, empresaId })).total, 1);
    assert.equal((await f.audit.listByEntity('Pedido', row.id)).length, 1);
  }
});

test('Pedido reabertura lista e historico preservam contexto capturado', async () => {
  const f = fixture();
  const row = await f.service.create(ctx, direct);
  const caller = { ...ctx };
  const pendingGet = f.service.get(caller, row.id);
  const pendingList = f.service.list(caller);
  const pendingHistory = f.service.history(caller, row.id);
  caller.groupId = '99999999-9999-4999-8999-999999999999';
  caller.empresaId = caller.groupId;
  caller.actorId = caller.groupId;
  const [reopened, page, history] = await Promise.all([pendingGet, pendingList, pendingHistory]);
  assert.equal(reopened.id, row.id);
  assert.equal(page.data[0].id, row.id);
  assert.equal(history[0].status_novo, 'EM_ABERTO');
});

test('Pedido exige motivo explicito de cancelamento sem efeitos em tentativas invalidas', async()=>{
  const f=fixture(), order=await f.service.create(ctx,direct);
  const scope={groupId,empresaId};
  const snapshot=async()=>({row:await f.service.get(ctx,order.id),history:await f.repo.history(scope,order.id),audit:await f.audit.listByEntity('Pedido',order.id)});
  const before=await snapshot();
  for(const motivo of [undefined,null,'','  ','ab',' x ',123,{},'a'.repeat(501)]){
    await assert.rejects(f.service.cancel(ctx,order.id,motivo),(error:any)=>error.statusCode===422&&error.code==='VALIDATION_ERROR');
    assert.deepEqual(await snapshot(),before);
  }
  const cancelled=await f.service.cancel(ctx,order.id,'Cancelamento solicitado em teste');
  assert.equal(cancelled.status,'CANCELADO');
  assert.deepEqual(cancelled.itens,order.itens);
  assert.equal(cancelled.numero,order.numero);
  assert.deepEqual((await f.audit.listByEntity('Pedido',order.id)).map(row=>row.action),['create','change_status']);
  await assert.rejects(f.service.cancel(ctx,order.id,'Cancelamento repetido'),(error:any)=>error.statusCode===409);
});
