import { readFile, readdir } from 'node:fs/promises';
import type { DbClient, DbQueryExecutor } from '../../src/db/client.ts';
import { SEED_IDS as ID } from '../../scripts/seedDevIds.ts';
import { OWNER_ERP_PERMISSION_TREE } from '../../src/security/ownerPermissionTree.ts';

export const ROLE='erp_crm_test_role';
/** Reference policies here are isolated fixtures, never operational grants. */
export async function setupCrmFixture(exec:(sql:string)=>Promise<unknown>,role=ROLE) {
  if(!/^[a-z][a-z0-9_]{1,60}$/.test(role))throw new Error('CRM_TEST_ROLE_INVALID');
  const dir=new URL('../../migrations/',import.meta.url);
  const names=(await readdir(dir)).filter(n=>/^\d+.*\.sql$/.test(n)).sort();
  for(const name of names){const sql=await readFile(new URL(name,dir),'utf8');await exec(sql.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));}
  await exec(`CREATE TABLE IF NOT EXISTS schema_migrations(id TEXT PRIMARY KEY);
    INSERT INTO schema_migrations(id) VALUES('040_crm_oportunidades.sql') ON CONFLICT DO NOTHING;`);
  await exec(await readFile(new URL('../../scripts/seed-dev-synthetic.sql',import.meta.url),'utf8'));
  await exec(`UPDATE profiles SET empresa_id=NULL,permissoes='${JSON.stringify(OWNER_ERP_PERMISSION_TREE)}'::jsonb WHERE id IN ('${ID.runtimeActorA}','${ID.runtimeActorB}')`);
  await exec(`CREATE ROLE ${role} NOSUPERUSER NOBYPASSRLS NOLOGIN;
    GRANT SELECT,INSERT,UPDATE ON oportunidades,entity_code_sequences TO ${role};
    GRANT SELECT,INSERT ON audit_logs TO ${role};
    GRANT SELECT ON cliente_empresas,orcamentos,orcamento_itens,pedidos,pedido_itens TO ${role};
    GRANT SELECT ON profiles TO ${role};
    GRANT SELECT ON schema_migrations TO ${role};
    GRANT UPDATE(updated_at) ON orcamentos TO ${role};
    GRANT UPDATE(updated_at) ON pedidos TO ${role};
    GRANT EXECUTE ON FUNCTION reserve_entity_codigo(uuid,text,integer) TO ${role};`);
  for(const table of ['cliente_empresas','orcamentos','orcamento_itens','pedidos','pedido_itens','audit_logs'])await exec(`
    CREATE POLICY crm_fixture_scope ON ${table} FOR ALL TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
      AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)
    WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
      AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)`);
  await exec(`CREATE POLICY crm_fixture_sequence ON entity_code_sequences FOR ALL TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
    WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)`);
  await exec(`CREATE POLICY crm_fixture_profile ON profiles FOR SELECT TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
      AND (empresa_id IS NULL OR empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid))`);
}

/** Adapts the existing PGlite test engine to the shared DB executor. */
export async function localCrmFixture() {
  const {PGlite}=await import('@electric-sql/pglite');const pg=new PGlite();
  try {await setupCrmFixture(sql=>pg.exec(sql));}catch(error){await pg.close();throw error;}
  const query=(engine:any):DbQueryExecutor['query']=>async(sql,params)=>{
    const r=await engine.query(sql,params);return {rows:r.rows,rowCount:r.rows.length,command:'SELECT',oid:0,fields:[]};
  };
  const make=(restricted:boolean):DbClient=>({pool:null,query:restricted
    ? (sql,params)=>pg.transaction(async tx=>{await tx.exec(`SET LOCAL ROLE ${ROLE}`);return query(tx)(sql,params);})
    : query(pg),checkConnection:async()=>true,end:async()=>{},
    withTransaction:fn=>pg.transaction(async tx=>{
      if(restricted)await tx.exec(`SET LOCAL ROLE ${ROLE}`);
      return fn({query:query(tx)});
    })});
  return {admin:make(false),data:make(true),exec:(sql:string)=>pg.exec(sql),close:()=>pg.close()};
}

/** Empty synthetic entry fixture: baseline is not a claim about operational SQL history. */
export async function setupEntryFixture(exec: (sql: string) => Promise<unknown>, role: string) {
  if (!/^[a-z][a-z0-9_]{1,60}$/.test(role)) throw new Error('ENTRY_TEST_ROLE_INVALID');
  const dir = new URL('../../migrations/', import.meta.url);
  const names = (await readdir(dir)).filter(name => /^\d{3}_.*\.sql$/.test(name)).sort();
  const baseline = [...Array.from({ length: 24 }, (_, i) => String(i + 1).padStart(3, '0')), '038', '039'];
  const deltas = ['041', '042', '044']; // Product/company operation, verified Auth bootstrap and Pedido insert.
  for (const prefix of [...baseline, ...deltas]) {
    if (prefix === '041') {
      const source = await readFile(new URL('040_crm_oportunidades.sql', dir), 'utf8');
      const prerequisite = 'CREATE UNIQUE INDEX IF NOT EXISTS uq_empresas_id_group_scope ON empresas(id, group_id);';
      if (source.split(prerequisite).length !== 2) throw new Error('ENTRY_FIXTURE_PREREQUISITE_IDENTITY');
      // Reuse only the exact company identity prerequisite, not all CRM DDL.
      await exec(prerequisite);
    }
    const matches = names.filter(name => name.startsWith(prefix + '_'));
    if (matches.length !== 1) throw new Error('ENTRY_FIXTURE_MIGRATION_IDENTITY');
    await exec((await readFile(new URL(matches[0], dir), 'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''));
  }
  await exec(await readFile(new URL('../../schema-candidates/pedido_idempotency_pair.sql', import.meta.url), 'utf8'));
  await exec(await readFile(new URL('../../schema-candidates/fornecedor_master.sql', import.meta.url), 'utf8'));
  await exec(await readFile(new URL('../../scripts/seed-dev-synthetic.sql', import.meta.url), 'utf8'));
  await exec(`UPDATE profiles SET empresa_id=NULL,permissoes='${JSON.stringify(OWNER_ERP_PERMISSION_TREE)}'::jsonb WHERE id='${ID.runtimeActorA}';
    UPDATE produtos SET empresa_id=NULL WHERE id='${ID.produtoA}';
    INSERT INTO produto_empresas(group_id,empresa_id,produto_id,ativo,habilitado_operacao,created_by,updated_by)
    VALUES('${ID.groupA}','${ID.empresaA}','${ID.produtoA}',true,true,'${ID.runtimeActorA}','${ID.runtimeActorA}');
    CREATE ROLE ${role} NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT NOLOGIN;`);
  const groupTables = ['produtos', 'unidades_medida', 'tabelas_preco', 'tabela_preco_itens',
    'condicoes_pagamento', 'condicao_pagamento_parcelas', 'cliente_locais', 'cliente_local_finalidades', 'obras', 'obra_locais', 'entity_code_sequences', 'fornecedores'];
  const companyTables = ['cliente_empresas', 'orcamentos', 'orcamento_itens', 'pedidos', 'pedido_itens',
    'pedido_historico', 'produto_empresas', 'tabela_preco_empresas', 'condicao_pagamento_empresas', 'obra_empresas'];
  for (const table of [...groupTables, ...companyTables]) {
    const company = companyTables.includes(table) ? " AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid" : '';
    await exec(`GRANT SELECT ON ${table} TO ${role};
      CREATE POLICY entry_fixture_scope ON ${table} FOR ALL TO ${role}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid${company})
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid${company});`);
  }
  for (const table of ['clientes', 'profiles', 'audit_logs']) await exec(`
    CREATE POLICY entry_fixture_optional_company ON ${table} FOR ALL TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
      AND (empresa_id IS NULL OR empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid))
    WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
      AND (empresa_id IS NULL OR empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid));`);
  await exec(`CREATE POLICY entry_fixture_company ON empresas FOR ALL TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)
    WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND id=NULLIF(current_setting('app.empresa_id',true),'')::uuid);
    GRANT SELECT ON clientes TO ${role};
    GRANT SELECT(id,group_id,status) ON empresas TO ${role};
    GRANT SELECT(id,ativo,group_id,empresa_id,permissoes) ON profiles TO ${role};
    -- Existing Pedido creator/segregation lookup uses AuditRepository.listByEntity.
    GRANT SELECT(group_id,empresa_id,actor_id,actor_email,entity,entity_id,action,before_data,after_data,request_id,ip_address,created_at),
      INSERT ON audit_logs TO ${role};
    GRANT INSERT ON clientes,cliente_empresas,orcamentos,orcamento_itens,pedidos,pedido_itens,pedido_historico,entity_code_sequences,fornecedores TO ${role};
    GRANT UPDATE(updated_at) ON empresas,clientes,cliente_empresas,produtos,produto_empresas,pedidos TO ${role};
    GRANT UPDATE(updated_at) ON orcamentos TO ${role};
    GRANT UPDATE(cliente_empresa_id,condicao_pagamento_id,tabela_preco_id,validade_em,observacoes,subtotal,desconto,total,status,ativo) ON orcamentos TO ${role};
    GRANT UPDATE(cliente_empresa_id,cliente_local_id,obra_id,tabela_preco_id,condicao_pagamento_id,tipo_operacao,data_entrega_solicitada,observacoes,subtotal,desconto,total,updated_by,status,ativo) ON pedidos TO ${role};
    -- Canonical update replaces scoped item rows atomically; never grants master deletion.
    GRANT DELETE ON orcamento_itens,pedido_itens TO ${role};
    -- Existing Cliente repository updates this exact allowlist, retaining codigo and identity.
    GRANT UPDATE(empresa_id,tipo,documento,documento_normalizado,nome,razao_social,nome_fantasia,nome_social,inscricao_estadual,inscricao_municipal,email,telefone,celular,status,origem,codigo_legado,legacy_id,source_system,migration_batch,observacoes,ativo) ON clientes TO ${role};
    GRANT UPDATE(next_value,updated_at) ON entity_code_sequences TO ${role};
    GRANT UPDATE(ativo,status,revision,updated_by,updated_at) ON fornecedores TO ${role};
    GRANT EXECUTE ON FUNCTION reserve_entity_codigo(uuid,text,integer) TO ${role};`);
}
