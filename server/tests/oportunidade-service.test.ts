import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryOportunidadeRepository } from '../src/repositories/inMemoryOportunidadeRepository.ts';
import type { ClienteEmpresa } from '../src/repositories/clienteTypes.ts';
import type { Orcamento } from '../src/repositories/orcamentoTypes.ts';
import { OportunidadeService } from '../src/services/oportunidadeService.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';

const scope={groupId:ID.groupA,empresaId:ID.empresaA};
const ctx={...scope,actorId:ID.runtimeActorA,requestId:'crm-synthetic'};
const linkId='11111111-2222-4333-8444-555555555555';
const docId='66666666-2222-4333-8444-555555555555';
const input=(key='opportunity-create-1')=>({titulo:'Proposta sintética',cliente_nome:'Contato sintético',idempotency_key:key,valor_estimado:'999999999999.123456'});
function fixture() {
  const repo=new InMemoryOportunidadeRepository(), audit=new InMemoryAuditRepository(), tenant=new InMemoryTenantGuard(),rbac=new InMemoryRbacGuard();
  tenant.link(ID.empresaA,ID.groupA);tenant.link(ID.empresaA2,ID.groupA);tenant.link(ID.empresaB,ID.groupB);
  rbac.link({actorId:ID.runtimeActorA,groupId:ID.groupA,permissions:{CRM:{oportunidades:['_unused','visualizar','criar','editar','inativar','restaurar','aprovar','cancelar']},Comercial:{orcamento:['visualizar']}}});
  const link={id:linkId,cliente_id:ID.clientePjA,group_id:ID.groupA,empresa_id:ID.empresaA,ativo:true,bloqueado:false,habilitado_operacao:true} as ClienteEmpresa;
  const calls:{scope:unknown;lock:boolean|undefined}[]=[];
  const service=new OportunidadeService(repo,audit,tenant,rbac,{
    async getEmpresaLinkById(s,id){return s.groupId===link.group_id && s.empresaId===link.empresa_id && id===linkId?link:null;},
  },{async get(s,id,_tx,lock){calls.push({scope:s,lock});return id===docId && s.empresaId===ID.empresaA
    ? {id:docId,...{group_id:s.groupId,empresa_id:s.empresaId},cliente_empresa_id:linkId,status:'EM_ABERTO'} as Orcamento:null;}});
  return {repo,audit,tenant,rbac,link,calls,service};
}

test('CRM service: create/replay concorrentes, código e decimais preservados',async()=>{
  const f=fixture();const rows=await Promise.all(Array.from({length:8},()=>f.service.create(ctx,input())));
  assert.equal(new Set(rows.map(r=>r.id)).size,1);assert.equal(rows[0].codigo,'000001');
  assert.equal(rows[0].codigo_oportunidade,'OPP-000001');assert.equal(rows[0].valor_estimado,'999999999999.123456');
  assert.equal((await f.audit.listByEntity('Oportunidade',rows[0].id)).length,1);
  await assert.rejects(f.service.create(ctx,{...input(),titulo:'Outro'}),{code:'OPORTUNIDADE_IDEMPOTENCY_CONFLICT'});
  const page=await f.service.list(ctx,{limit:1});assert.equal(page.meta.total,1);assert.equal(page.meta.hasMore,false);
  assert.equal((await f.service.get(ctx,rows[0].id)).id,rows[0].id);
});
test('CRM service: patch preserva campos, versão concorrente e histórico',async()=>{
  const f=fixture(),row=await f.service.create(ctx,input());
  const results=await Promise.allSettled([f.service.update(ctx,row.id,{expected_version:1,etapa:'Contato Inicial'}),
    f.service.update(ctx,row.id,{expected_version:1,etapa:'Qualificação'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const current=await f.service.get(ctx,row.id);assert.equal(current.version,2);assert.equal(current.valor_estimado,row.valor_estimado);
  assert.equal(current.historico_mudancas_etapa.length,1);assert.equal(current.cliente_nome,row.cliente_nome);
  const inactive=await f.service.setActive(ctx,row.id,{expected_version:2},false);assert.equal(inactive.ativo,false);
  await assert.rejects(f.service.update(ctx,row.id,{expected_version:3,titulo:'X'}),{code:'OPORTUNIDADE_STATE_CONFLICT'});
  const restored=await f.service.setActive(ctx,row.id,{expected_version:3},true);assert.equal(restored.version,4);
  assert.equal(restored.codigo,row.codigo);assert.equal(restored.ativo,true);
});
test('CRM service: RBAC exato, tenant e campos fabricados falham fechados',async()=>{
  const f=fixture(),row=await f.service.create(ctx,input());
  await assert.rejects(f.service.get({...ctx,empresaId:ID.empresaA2},row.id),{code:'OPORTUNIDADE_NOT_FOUND'});
  await assert.rejects(f.service.get({...ctx,empresaId:ID.empresaB},row.id),{code:'TENANT_MISMATCH'});
  for(const payload of [{...input(),group_id:ID.groupB},{...input(),legacy_store_id:'oportunidade_local'},
    {...input(),codigo_oportunidade:'OPP-999999'},{...input(),orcamento_id:docId}])
    await assert.rejects(f.service.create(ctx,payload),{code:'VALIDATION_ERROR'});
  f.rbac.link({actorId:ID.runtimeActorA,groupId:ID.groupA,permissions:{'*':['criar','visualizar']}});
  await assert.rejects(f.service.create(ctx,input('wildcard-only')),{code:'PERMISSION_DENIED'});
});
test('CRM service: auditoria falha reverte linha, alterações e reserva',async()=>{
  const f=fixture();let fail=true;const append=f.audit.append.bind(f.audit);
  f.audit.append=async(entry,tx)=>{if(fail)throw new Error('synthetic audit failure');await append(entry,tx);};
  await assert.rejects(f.service.create(ctx,input()),/synthetic audit failure/);
  assert.equal((await f.service.list(ctx)).meta.total,0);fail=false;
  const row=await f.service.create(ctx,input());assert.equal(row.codigo,'000001');
  fail=true;await assert.rejects(f.service.update(ctx,row.id,{expected_version:1,titulo:'Alterado'}),/audit failure/);
  assert.equal((await f.service.get(ctx,row.id)).titulo,row.titulo);assert.equal((await f.service.get(ctx,row.id)).version,1);
  await assert.rejects(f.service.setActive(ctx,row.id,{expected_version:1},false),/audit failure/);
  assert.equal((await f.service.get(ctx,row.id)).ativo,true);
});
test('CRM service: ClienteEmpresa validado e vínculo Orçamento usa porta canônica com lock',async()=>{
  const f=fixture();const row=await f.service.create(ctx,{...input(),cliente_empresa_id:linkId});
    await f.repo.update(scope,row.id,1,{...row,orcamento_id:'orcamento_original_textual'},ctx.actorId);
    await assert.rejects(f.service.linkOrcamento(ctx,row.id,{expected_version:2,orcamento_id:ID.obraA}),{code:'ORCAMENTO_NOT_FOUND'});
    const linked=await f.service.linkOrcamento(ctx,row.id,{expected_version:2,orcamento_id:docId});
  assert.equal(linked.status,'Ganho');assert.equal(linked.orcamento_id,docId);assert.equal(linked.etapa,'Fechamento');
  assert.ok(f.calls.every(c=>c.lock===true));assert.equal(linked.valor_estimado,row.valor_estimado);
    assert.equal(linked.legacy_orcamento_id,'orcamento_original_textual');
    const replay=await f.service.linkOrcamento(ctx,row.id,{expected_version:2,orcamento_id:docId});assert.equal(replay.version,3);
    assert.equal(replay.legacy_orcamento_id,'orcamento_original_textual');
  await assert.rejects(f.service.update(ctx,row.id,{expected_version:2,status:'Ganho',valor_estimado:'1'}),{code:'OPORTUNIDADE_STATE_CONFLICT'});
  f.link.bloqueado=true;
  await assert.rejects(f.service.create(ctx,{...input('blocked-customer'),cliente_empresa_id:linkId}),{code:'OPORTUNIDADE_CLIENTE_INVALID'});
});

test('CRM service: edição/reabertura preserva todos os campos do formulário existente',async()=>{
  const f=fixture();const payload={...input(),descricao:'Descrição detalhada',responsavel:'Equipe sintética',
    data_abertura:'2026-09-01',data_previsao:'2027-01-31',proxima_acao:'Retornar contato',data_proxima_acao:'2026-11-03',
    produtos_interesse:['Item pretendido',{produto_id:ID.produtoA,descricao:'Intenção sem autorização operacional'}],
    necessidades:'Medidas do projeto',orcamento_cliente:'1000.123456',observacoes:'Não apagar',cliente_email:'contato@synthetic.invalid',cliente_telefone:'ramal 10'};
  const row=await f.service.create(ctx,payload);
  const after=await f.service.update(ctx,row.id,{expected_version:1,titulo:'Somente título',descricao:undefined});
  for(const key of ['descricao','responsavel','data_abertura','data_previsao','proxima_acao','data_proxima_acao',
    'necessidades','orcamento_cliente','observacoes','cliente_email','cliente_telefone'] as const)
    assert.equal(after[key],row[key]);
  assert.deepEqual(after.produtos_interesse,row.produtos_interesse);
  const clear=await f.service.update(ctx,row.id,{expected_version:2,descricao:null,cliente_email:''});
  assert.equal(clear.descricao,null);assert.equal(clear.cliente_email,null);assert.equal(clear.observacoes,'Não apagar');
  await assert.rejects(f.service.update(ctx,row.id,{expected_version:3,data_previsao:'2027-02-31'}),{code:'VALIDATION_ERROR'});
});

test('CRM service: revogação após prepare e antes da escrita bloqueia a transação',async()=>{
  const f=fixture();f.repo.lockIdempotency=async()=>{f.rbac.link({actorId:ID.runtimeActorA,groupId:ID.groupA,permissions:{}});};
  await assert.rejects(f.service.create(ctx,input()),{code:'PERMISSION_DENIED'});
  assert.equal((await f.repo.list(scope,{limit:50,offset:0})).total,0);
});
