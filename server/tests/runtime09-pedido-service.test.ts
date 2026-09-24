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
const direct:PedidoCreate={cliente_empresa_id:clienteEmpresaId,condicao_pagamento_id:condicaoId,tipo_operacao:'ENTREGA',data_entrega_solicitada:'2027-03-10T00:00:00.000Z',itens:[{produto_id:produtoId,unidade_id:unidadeId,descricao:'Produto sintetico',unidade_sigla:'UN',quantidade:'2',preco_unitario:'10',desconto:'1',requer_producao:true}]};
const quote:OrcamentoCreate={cliente_empresa_id:clienteEmpresaId,condicao_pagamento_id:condicaoId,validade_em:'2027-02-10T00:00:00.000Z',itens:[{produto_id:produtoId,unidade_id:unidadeId,descricao:'Produto sintetico',unidade_sigla:'UN',quantidade:'2',preco_unitario:'10',desconto:'1'}]};

function fixture() {
  const repo=new InMemoryPedidoRepository(),orcamentos=new InMemoryOrcamentoRepository(),audit=new InMemoryAuditRepository(),tenant=new InMemoryTenantGuard(),rbac=new InMemoryRbacGuard();
  tenant.link(empresaId,groupId);
  rbac.link({actorId,groupId,permissions:{Comercial:{pedido:['visualizar','criar','editar','cancelar','converter-pedido','alterar-status']}}});
  const service=new PedidoService(repo,orcamentos,audit,tenant,rbac,
    {getEmpresaLinkById:async()=>({id:clienteEmpresaId,cliente_id:clienteId,ativo:true,bloqueado:false,habilitado_operacao:true} as never)},
    {getById:async()=>({id:produtoId,ativo:true,unidade_medida_id:unidadeId} as never)},
    {getById:async()=>({id:unidadeId,ativo:true} as never)},
    {get:async()=>({id:condicaoId,ativo:true} as never)},
    {get:async()=>({id:'local',ativo:true} as never)},
    {get:async()=>({id:'obra',ativo:true} as never)},
    {get:async()=>({id:'tabela',ativo:true} as never)},
  );
  return {service,repo,orcamentos,audit,rbac};
}

test('PedidoService cria lista consulta atualiza e audita sem aceitar total do cliente',async()=>{const f=fixture();const created=await f.service.create(ctx,direct);assert.equal(created.total,'19.000000');await assert.rejects(f.service.create(ctx,{...direct,total:'999'}),/Invalid Pedido payload/);assert.equal((await f.service.list(ctx)).meta.total,1);assert.equal((await f.service.get(ctx,created.id)).id,created.id);const updated=await f.service.update(ctx,created.id,{...direct,itens:[{...direct.itens[0],quantidade:'3'}]});assert.equal(updated.numero,created.numero);assert.equal(updated.total,'29.000000');assert.deepEqual((await f.audit.listByEntity('Pedido',created.id)).map(row=>row.action),['create','update']);});

test('conversao Orcamento Pedido e transacional idempotente e preserva snapshots',async()=>{const f=fixture();const original=await f.orcamentos.create({groupId,empresaId},quote);const order=await f.service.convert(ctx,original.id,{tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-03-10T00:00:00.000Z'});assert.equal(order.orcamento_id,original.id);assert.equal(order.numero,'00000001');assert.equal(order.total,original.total);assert.equal(order.itens[0].descricao,original.itens[0].descricao);assert.equal((await f.orcamentos.get({groupId,empresaId},original.id))?.status,'EM_ABERTO');await assert.rejects(f.service.convert(ctx,original.id,{tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-03-10T00:00:00.000Z'}),(error:any)=>error.statusCode===409&&error.code==='ORCAMENTO_ALREADY_CONVERTED');assert.equal((await f.repo.list({groupId,empresaId})).total,1);});

test('workflow Pedido bloqueia transicoes invalidas e registra historico Finalizado',async()=>{const f=fixture();const order=await f.service.create(ctx,direct);await assert.rejects(f.service.transition(ctx,order.id,'FINALIZADO'),(error:any)=>error.statusCode===409);await f.service.transition(ctx,order.id,'EM_PRODUCAO');await f.service.transition(ctx,order.id,'PRONTO_ENTREGA');const final=await f.service.transition(ctx,order.id,'FINALIZADO');assert.equal(final.status,'FINALIZADO');assert.deepEqual((await f.service.history(ctx,order.id)).map(row=>row.status_novo),['EM_ABERTO','EM_PRODUCAO','PRONTO_ENTREGA','FINALIZADO']);await assert.rejects(f.service.cancel(ctx,order.id,'cancelar'),(error:any)=>error.statusCode===409);});

test('PedidoService falha fechado em tenant e RBAC',async()=>{const f=fixture();await assert.rejects(f.service.list({...ctx,actorId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}),(error:any)=>error.statusCode===403);await assert.rejects(f.service.list({...ctx,empresaId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'}));await assert.rejects(f.service.get(ctx,'invalido'),(error:any)=>error.statusCode===400);});
