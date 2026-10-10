import type { DbQueryExecutor } from './client.js';

/** Only catalogs/ledger are read. No tenant rows, credentials or names are returned. */
export async function inspectCrmPreflight(db:DbQueryExecutor,expected:{database:string;schema:string;stage?:'before_migration'|'after_migration'}) {
  if(!expected.database?.trim() || !expected.schema?.trim())throw new Error('CRM_PREFLIGHT_DESTINATION_REQUIRED');
  if(expected.stage && !['before_migration','after_migration'].includes(expected.stage))throw new Error('CRM_PREFLIGHT_STAGE_INVALID');
  const identity=await db.query<{database:string;schema:string;rolsuper:boolean;rolbypassrls:boolean}>(
    'SELECT current_database() AS database,current_schema() AS schema,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
  const who=identity.rows[0];
  const checks:Record<string,boolean>={destination:!!who&&who.database===expected.database&&who.schema===expected.schema,
    restrictedRole:!!who&&!who.rolsuper&&!who.rolbypassrls};
  if(!checks.destination)return {ready:false,checks,blocked:Object.keys(checks).filter(k=>!checks[k])};
  const relations=await db.query<{name:string;oid:string;rls:boolean;force:boolean;kind:string}>(
    `SELECT c.relname AS name,c.oid::text AS oid,c.relrowsecurity AS rls,c.relforcerowsecurity AS force,c.relkind AS kind
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1
       AND c.relname IN ('oportunidades','schema_migrations','entity_code_sequences')`,[expected.schema]);
  const opportunity=relations.rows.find(r=>r.name==='oportunidades');
  const schema='"'+expected.schema.replaceAll('"','""')+'"';
  const hasLedger=relations.rows.some(r=>r.name==='schema_migrations'&&r.kind==='r');
  if(expected.stage==='before_migration') {
    checks.baseline039=false;checks.crmAbsent=!opportunity;
    if(hasLedger) {
      const ledger=await db.query<{baseline:boolean;crm:boolean;later:boolean}>(`SELECT
        EXISTS(SELECT 1 FROM ${schema}.schema_migrations WHERE id=$1) AS baseline,
        EXISTS(SELECT 1 FROM ${schema}.schema_migrations WHERE id=$2) AS crm,
        EXISTS(SELECT 1 FROM ${schema}.schema_migrations WHERE substring(id from '^([0-9]+)_')::numeric>39) AS later`,['039_orcamentos_tabela_preco.sql','040_crm_oportunidades.sql']);
      checks.baseline039=ledger.rows[0]?.baseline===true&&ledger.rows[0]?.later===false;
      checks.crmAbsent=checks.crmAbsent&&ledger.rows[0]?.crm===false;
    }
    const blocked=Object.keys(checks).filter(k=>!checks[k]);return {ready:blocked.length===0,checks,blocked};
  }
  checks.schema=opportunity?.kind==='r'&&relations.rows.some(r=>r.name==='entity_code_sequences'&&r.kind==='r');
  checks.rls=!!opportunity?.rls&&!!opportunity?.force;
  checks.migration=false;
  if(hasLedger) {
    // Identifier originates in a separately validated destination, not interpolated raw.
    const ledger=await db.query<{applied:boolean}>(`SELECT EXISTS(SELECT 1 FROM ${schema}.schema_migrations WHERE id=$1) AS applied`,['040_crm_oportunidades.sql']);
    checks.migration=ledger.rows[0]?.applied===true;
  }
  checks.policy=false;checks.columns=false;checks.codeTrigger=false;checks.exclusivePedido=false;checks.grants=false;checks.noPublicDml=false;
  if(opportunity) {
    const oid=opportunity.oid;
    const policies=await db.query<{cmd:string;roles:string;using:string;check:string}>(
      `SELECT polcmd AS cmd,polroles::text AS roles,pg_get_expr(polqual,polrelid) AS "using",
       pg_get_expr(polwithcheck,polrelid) AS "check" FROM pg_policy WHERE polrelid=$1::oid`,[oid]);
    const canonical="group_id = NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id = NULLIF(current_setting('app.empresa_id',true),'')::uuid";
    const p=policies.rows[0];checks.policy=policies.rows.length===1&&p.cmd==='*'&&p.roles==='{0}'
      &&tokens(p.using)===tokens(canonical)&&tokens(p.check)===tokens(canonical);
    const columns=await db.query<{name:string;number:number}>('SELECT attname AS name,attnum::int AS number FROM pg_attribute WHERE attrelid=$1::oid AND attnum>0 AND NOT attisdropped',[oid]);
    checks.columns=['legacy_store_id','legacy_orcamento_id','legacy_pedido_id','convertido_em_id','version','codigo'].every(n=>columns.rows.some(r=>r.name===n));
    const triggers=await db.query<{enabled:string;definer:boolean;name:string;triggerName:string;type:number;attrs:string;condition:string|null;args:number;namespace:string}>(
      `SELECT t.tgenabled AS enabled,p.prosecdef AS definer,p.proname AS name,t.tgname AS "triggerName",t.tgtype::int AS type,
       t.tgattr::text AS attrs,pg_get_expr(t.tgqual,t.tgrelid) AS condition,octet_length(t.tgargs)::int AS args,n.nspname AS namespace
       FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE t.tgrelid=$1::oid AND NOT t.tgisinternal`,[oid]);
    const attrs=columns.rows.filter(c=>['codigo','group_id'].includes(c.name)).map(c=>String(c.number)).sort().join(' ');
    checks.codeTrigger=triggers.rows.some(t=>t.name==='sync_oportunidade_codigo'&&t.triggerName==='trg_oportunidades_codigo'
      &&!t.definer&&['O','A'].includes(t.enabled)&&t.type===23&&t.condition===null&&t.args===0&&t.namespace===expected.schema
      &&t.attrs.trim().split(/\s+/).sort().join(' ')===attrs);
    const indexes=await db.query<{valid:boolean;unique:boolean;definition:string;predicate:string}>(
      `SELECT indisvalid AS valid,indisunique AS unique,pg_get_indexdef(indexrelid) AS definition,
       pg_get_expr(indpred,indrelid) AS predicate FROM pg_index WHERE indrelid=$1::oid`,[oid]);
    checks.exclusivePedido=indexes.rows.some(i=>i.valid&&i.unique&&/\(group_id, empresa_id, convertido_em_id\)/.test(i.definition)
      &&tokens(i.predicate)===tokens("convertido_em = 'pedido'"));
    const grants=await db.query<{ok:boolean}>(`SELECT has_table_privilege(current_user,$1::oid,'SELECT')
      AND has_table_privilege(current_user,$1::oid,'INSERT') AND has_table_privilege(current_user,$1::oid,'UPDATE')
      AND has_table_privilege(current_user,$2::oid,'SELECT') AND has_table_privilege(current_user,$2::oid,'INSERT')
      AND has_table_privilege(current_user,$2::oid,'UPDATE') AS ok`,[oid,relations.rows.find(r=>r.name==='entity_code_sequences')?.oid??oid]);
    checks.grants=checks.schema&&grants.rows[0]?.ok===true;
    const publicAcl=await db.query<{ok:boolean}>(`SELECT NOT EXISTS(SELECT 1 FROM pg_class c,
      LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid=$1::oid AND a.grantee=0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE')) AS ok`,[oid]);
    checks.noPublicDml=publicAcl.rows[0]?.ok===true;
  }
  const blocked=Object.keys(checks).filter(k=>!checks[k]);
  return {ready:blocked.length===0,checks,blocked};
}

// Parentheses/casts added by pg_get_expr are normalized without altering quoted
// GUC names, identifiers or literals. Extra operators/policies fail closed.
function tokens(sql:string|null|undefined) {
  if(!sql)return '';
  return (sql.match(/'(?:[^']|'')*'|"(?:[^"]|"")*"|::text|[A-Za-z_][A-Za-z_0-9]*|::|[^\s]/g)??[])
    .filter(t=>!['(',')','::text'].includes(t)).map(t=>/^["']/.test(t)?t:t.toLowerCase()).join('|');
}
