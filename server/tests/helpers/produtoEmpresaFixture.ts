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

/** Isolated sales fixture only: no operational grants or policies are generated. */
export async function grantProdutoSalesFixture(exec:(sql:string)=>Promise<unknown>,role:string) {
  if(!/^[a-z][a-z0-9_]{1,60}$/.test(role))throw new Error('PRODUCT_TEST_ROLE_INVALID');
  await exec(`GRANT SELECT,INSERT,UPDATE ON orcamentos,orcamento_itens,pedidos,pedido_itens,pedido_historico TO ${role};
    GRANT SELECT ON unidades_medida,condicoes_pagamento,condicao_pagamento_empresas,condicao_pagamento_parcelas,
      tabelas_preco,tabela_preco_empresas,tabela_preco_itens TO ${role};`);
  for(const table of ['unidades_medida','condicoes_pagamento','condicao_pagamento_parcelas','tabelas_preco','tabela_preco_itens'])
    await exec(`CREATE POLICY produto_sale_reference_fixture ON ${table} FOR SELECT TO ${role}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)`);
  for(const table of ['condicao_pagamento_empresas','tabela_preco_empresas','pedido_historico'])
    await exec(`CREATE POLICY produto_sale_company_fixture ON ${table} FOR ALL TO ${role}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)`);
}
