import { readFile } from 'node:fs/promises';
export const AUTH_IDS={group:'11111111-1111-4111-8111-111111111111',other:'22222222-2222-4222-8222-222222222222',
  company:'33333333-3333-4333-8333-333333333333',second:'44444444-4444-4444-8444-444444444444',inactive:'55555555-5555-4555-8555-555555555555',
  owner:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',branch:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',foreign:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  ownerProfile:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',branchProfile:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',foreignProfile:'ffffffff-ffff-4fff-8fff-ffffffffffff'};
export const authTables=`CREATE TABLE groups(id uuid PRIMARY KEY,nome_do_grupo text);
CREATE TABLE empresas(id uuid PRIMARY KEY,group_id uuid,razao_social text,nome_fantasia text,cnpj text,status text);
CREATE TABLE profiles(id uuid PRIMARY KEY,auth_user_id uuid,ativo boolean,group_id uuid,empresa_id uuid,role text,full_name text,permissoes jsonb);
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;ALTER TABLE groups FORCE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;ALTER TABLE empresas FORCE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;ALTER TABLE profiles FORCE ROW LEVEL SECURITY;`;
export function authSeed(){const i=AUTH_IDS;return `INSERT INTO groups VALUES ('${i.group}','Synthetic A'),('${i.other}','Synthetic B');
INSERT INTO empresas VALUES ('${i.company}','${i.group}','Synthetic 1','Synthetic 1',NULL,'Ativa'),('${i.second}','${i.group}','Synthetic 2','Synthetic 2',NULL,'Ativa'),('${i.inactive}','${i.group}','Synthetic off','Synthetic off',NULL,'Inativa');
INSERT INTO profiles VALUES ('${i.ownerProfile}','${i.owner}',true,'${i.group}',NULL,'admin','Synthetic owner','{}'),('${i.branchProfile}','${i.branch}',true,'${i.group}','${i.company}','user','Synthetic branch','{}'),('${i.foreignProfile}','${i.foreign}',true,'${i.other}',NULL,'admin','Synthetic foreign','{}');`;}
export function authColumnGrants(role:string){return `GRANT SELECT(id,auth_user_id,ativo,group_id,empresa_id,role,full_name,permissoes) ON profiles TO ${role};
GRANT SELECT(id,nome_do_grupo) ON groups TO ${role};GRANT SELECT(id,group_id,razao_social,nome_fantasia,cnpj,status) ON empresas TO ${role};`;}
export const authPolicy=()=>readFile(new URL('../../migrations/042_auth_bootstrap_select.sql',import.meta.url),'utf8');
