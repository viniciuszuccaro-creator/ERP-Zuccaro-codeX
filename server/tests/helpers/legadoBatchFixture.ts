import {createHash,randomUUID} from 'node:crypto';
import {parse} from 'csv-parse/sync';
import {createPoolDbClient,type DbClient} from '../../src/db/client.ts';
import {PostgresClienteRepository} from '../../src/repositories/postgresClienteRepository.ts';
import {PostgresAuditRepository} from '../../src/audit/auditRepository.ts';
import {ClienteService} from '../../src/services/clienteService.ts';
import {clienteCreateSchema} from '../../src/repositories/clienteTypes.ts';
import {fornecedorImportSchema} from '../../src/repositories/fornecedorTypes.ts';
import {InMemoryRbacGuard} from '../../src/db/rbacGuard.ts';
import {InMemoryTenantGuard} from '../../src/db/tenantGuard.ts';
import {SEED_IDS as ID} from '../../scripts/seedDevIds.ts';
import {prepararPersistenciaClientesLegado} from '../../../scripts/legado/staging-persistence.mjs';

export const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
export function syntheticCpf(i:number) {
  const digits=String(700000000+i).split('').map(Number);
  for(const n of [10,11]){const sum=digits.reduce((total,value,index)=>total+value*(n-index),0);const d=(sum*10)%11;digits.push(d===10?0:d);}
  return digits.join('');
}
export function batchDependencies(db:DbClient) {
  const rbac=new InMemoryRbacGuard();
  const permissions={Cadastros:{cliente:['visualizar','criar','editar','importar','inativar']}};
  rbac.link({actorId:ID.runtimeActorA,groupId:ID.groupA,permissions});
  const audit=new PostgresAuditRepository(db),repo=new PostgresClienteRepository(db);
  const service=new ClienteService(repo,audit,new InMemoryTenantGuard(),rbac);
  return {db,rbac,audit,repo,service,schemas:{clienteSchema:clienteCreateSchema,fornecedorSchema:fornecedorImportSchema,parseCsv:parse}};
}
export function nestedPgliteClient(admin:DbClient):DbClient {
  // The fixture's single engine stands in for a Pool, exercising the production ALS transaction implementation.
  const query=admin.query.bind(admin);
  return createPoolDbClient({query,connect:async()=>({query,release:()=>{}})} as never);
}
export async function syntheticBatch(deps:ReturnType<typeof batchDependencies>,count:number,offset=0) {
  const fields=['codigo_legado','codigo','tipo','cpf','cnpj','nome','razao_social','status','telefone','contato_email','COMENTARIO'];
  const rows=Array.from({length:count},(_,index)=>({codigo_legado:String(100000+offset+index),codigo:String(100000+offset+index),
    tipo:'Pessoa Física',cpf:syntheticCpf(offset+index),cnpj:'',nome:`Synthetic migration ${offset+index}`,razao_social:'',status:'Ativo',
    telefone:'001100000000',contato_email:`synthetic-${offset+index}@example.invalid`,COMENTARIO:'PRESERVED_PENDING_NOT_OBSERVACOES'}));
  const csv=Buffer.from([fields.join(';'),...rows.map(row=>fields.map(key=>row[key as keyof typeof row]).join(';'))].join('\n'));
  const sourceBytes=Buffer.from(JSON.stringify({rows:{cliente:rows,fornecedor:[]}}));
  const target=(await deps.db.query(`SELECT current_database() AS database,current_schema() AS schema,current_user AS principal,
    (SELECT oid::int FROM pg_database WHERE datname=current_database()) AS "databaseOid",
    (SELECT oid::int FROM pg_namespace WHERE nspname=current_schema()) AS "schemaOid",
    (SELECT system_identifier::text FROM pg_control_system()) AS "clusterIdentifier"`)).rows[0];
  const input={sourceBytes,sourceSha256:sha(sourceBytes),originalSource:{bytes:csv,sha256:sha(csv),delimiter:';'},
    runId:randomUUID(),sourceSystem:'SYNTHETIC_SCALE_TEST',ctx:{groupId:ID.groupA,actorId:ID.runtimeActorA,requestId:randomUUID(),scopeType:'grupo'},
    target,batchSize:Math.min(count,1000),limit:count,batchIndex:0};
  const plan=prepararPersistenciaClientesLegado(input,deps.schemas);
  return {...input,manifestSha256:plan.manifestSha256};
}
