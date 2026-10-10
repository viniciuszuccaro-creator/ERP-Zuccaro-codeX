import assert from 'node:assert/strict';
import test from 'node:test';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { PostgresTenantGuard } from '../src/db/tenantGuard.ts';
import { PostgresRbacGuard } from '../src/db/rbacGuard.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { PostgresOrcamentoRepository } from '../src/repositories/postgresOrcamentoRepository.ts';
import { PostgresOportunidadeRepository } from '../src/repositories/postgresOportunidadeRepository.ts';
import { OportunidadeService } from '../src/services/oportunidadeService.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { localCrmFixture, ROLE } from './helpers/crmFixture.ts';

test('CRM SQL: migration/repositório/auditoria/legado sob papel sem bypass',async()=>{
  const f=await localCrmFixture();
  try {
    const repo=new PostgresOportunidadeRepository(f.data),audit=new PostgresAuditRepository(f.admin);
    const service=new OportunidadeService(repo,audit,new PostgresTenantGuard(f.admin),new PostgresRbacGuard(f.admin),
      new PostgresClienteRepository(f.admin),new PostgresOrcamentoRepository(f.admin));
    const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'crm-sql-synthetic'};
    const scope={groupId:ctx.groupId,empresaId:ctx.empresaId};
    const ce=await f.admin.query<{id:string}>('SELECT id FROM cliente_empresas WHERE group_id=$1 AND empresa_id=$2 AND ativo=true AND habilitado_operacao AND NOT bloqueado LIMIT 1',[ctx.groupId,ctx.empresaId]);
    const input={titulo:'SQL sintético',cliente_empresa_id:ce.rows[0].id,idempotency_key:'sql-create-1',valor_estimado:'100.123456'};
    const row=await service.create(ctx,input);assert.equal(row.valor_estimado,'100.123456');
    assert.equal((await service.create(ctx,input)).id,row.id);
    await assert.rejects(service.get({...ctx,empresaId:ID.empresaA2},row.id),{code:'OPORTUNIDADE_NOT_FOUND'});
    const changed=await service.update(ctx,row.id,{expected_version:1,etapa:'Negociação'});assert.equal(changed.version,2);
    assert.equal(changed.historico_mudancas_etapa.length,1);
    await f.admin.query('UPDATE oportunidades SET legacy_store_id=$2,orcamento_id=$3 WHERE id=$1',[row.id,'oportunidade_original_textual','orcamento_original_textual']);
    const legacy=await service.getByLegacy(ctx,'oportunidade_original_textual');
    assert.equal(legacy.id,row.id);assert.equal(legacy.orcamento_id,'orcamento_original_textual');
    await assert.rejects(service.getByLegacy({...ctx,empresaId:ID.empresaA2},'oportunidade_original_textual'),{code:'OPORTUNIDADE_NOT_FOUND'});
    await f.data.withTransaction(async tx=>{
      const role=await tx.query<{rolsuper:boolean;rolbypassrls:boolean}>('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
      assert.equal(role.rows[0].rolsuper,false);assert.equal(role.rows[0].rolbypassrls,false);
      assert.equal((await tx.query('SELECT id FROM oportunidades')).rows.length,0);
      await tx.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id',$2,true)",[ID.groupA,ID.empresaA2]);
      assert.equal((await tx.query('SELECT id FROM oportunidades WHERE id=$1',[row.id])).rows.length,0);
      assert.equal((await tx.query('UPDATE oportunidades SET empresa_id=$2 WHERE id=$1 RETURNING id',[row.id,ID.empresaA])).rows.length,0);
    });
    await assert.rejects(f.data.withTransaction(async tx=>{
      await tx.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id',$2,true)",[ID.groupA,ID.empresaA]);
      await tx.query('UPDATE oportunidades SET empresa_id=$2 WHERE id=$1',[row.id,ID.empresaA2]);
    }),/row-level security/);
    // Real audit failure rolls back the opportunity and the shared sequence.
    await f.exec(`CREATE FUNCTION crm_force_audit_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN IF NEW.entity='Oportunidade' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER crm_force_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE crm_force_audit_failure();`);
    await assert.rejects(service.create(ctx,{...input,idempotency_key:'sql-audit-fail'}),/synthetic audit failure/);
    assert.equal((await service.list(ctx)).meta.total,1);
    await assert.rejects(service.update(ctx,row.id,{expected_version:2,titulo:'Nao persistir'}),/synthetic audit failure/);
    assert.equal((await service.get(ctx,row.id)).titulo,row.titulo);
    await f.exec('DROP TRIGGER crm_force_audit ON audit_logs; DROP FUNCTION crm_force_audit_failure();');
    const next=await service.create(ctx,{...input,idempotency_key:'sql-next'});assert.equal(next.codigo,'000002');
    const rls=await f.admin.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='oportunidades'::regclass");
    assert.ok(rls.rows[0].relrowsecurity&&rls.rows[0].relforcerowsecurity);
    assert.ok((await audit.listByEntity('Oportunidade',row.id)).length>=2);
    assert.equal(ROLE,'erp_crm_test_role');
  }finally{await f.close();}
});
