import {localCrmFixture,ROLE} from './crmFixture.ts';
import {realCrmFixture} from './crmPostgresFixture.ts';
import {ProdutoService} from '../../src/services/produtoService.ts';
import {PostgresProdutoRepository} from '../../src/repositories/postgresProdutoRepository.ts';
import {PostgresAuditRepository} from '../../src/audit/auditRepository.ts';
import {PostgresTenantGuard} from '../../src/db/tenantGuard.ts';
import {PostgresRbacGuard} from '../../src/db/rbacGuard.ts';
import {PostgresProdutoRelationGuard} from '../../src/db/produtoRelationGuard.ts';

// Only the isolated test role receives these grants/policies, never DEV.
export async function produtoEmpresaFixture(url?:string) {
  const f=url?await realCrmFixture(url):await localCrmFixture();
  const role='role' in f?f.role:ROLE;
  try {
    await f.exec(`GRANT SELECT,INSERT,UPDATE ON produto_empresas TO ${role};
      GRANT SELECT ON produtos,empresas TO ${role};GRANT UPDATE(updated_at) ON produtos,empresas TO ${role};
      CREATE POLICY produto_operacao_fixture ON produtos FOR ALL TO ${role}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid);
      CREATE POLICY empresa_operacao_fixture ON empresas FOR ALL TO ${role}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND id=NULLIF(current_setting('app.empresa_id',true),'')::uuid);`);
    const repo=new PostgresProdutoRepository(f.data,true);
    const service=new ProdutoService(repo,new PostgresAuditRepository(f.admin),new PostgresTenantGuard(f.admin),
      new PostgresProdutoRelationGuard(f.admin),new PostgresRbacGuard(f.admin));
    return {...f,repo,service};
  }catch(error){await f.close();throw error;}
}
