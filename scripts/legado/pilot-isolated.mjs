import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

process.umask(0o077);
const repo = '/workspaces/ERP-Zuccaro-codeX';
const privateBase = '/home/codespace/erp-legado-privado-20261023';
let root = process.argv[2];
const sourceSha = '3bfa4de4ddc3b99266c17b2cf92fe7000f9f2f81';
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const save = (name, data) => {
  const p = path.join(root, name);
  fs.writeFileSync(p + '.tmp', JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(p + '.tmp', p);
};
const run = (name, args) => {
  const r = spawnSync(name, args, { cwd: repo, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw Object.assign(new Error('PRIVATE_COMMAND_FAILED'), { tool: name, status: r.status });
  return r.stdout.trim();
};
const git = args => run('git', args);
let container = null;
let batch = null;
let admin = null;
let pool = null;
let complete = false;
const report = { operationalImport: false, authorization: '#344 ISOLATED_PILOT_ONLY', entities: {} };

export function preparePrivateInput(targetRoot) {
  const s = fs.lstatSync(privateBase);
  if (s.isSymbolicLink() || s.uid !== process.getuid() || (s.mode & 0o777) !== 0o700) throw new Error('PRIVATE_BASE_INVALID');
  const b = fs.readFileSync(path.join(privateBase, 'inbound/staging-vps.manifest.gcm'));
  const key = fs.readFileSync(path.join(privateBase, 'inbound/staging.key'));
  if (b.subarray(0, 7).toString() !== 'ERPLEG1' || key.length !== 32) throw new Error('SOURCE_ENVELOPE_INVALID');
  const d = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(7, 19));
  d.setAAD(Buffer.from('ERPLEG1')); d.setAuthTag(b.subarray(-16));
  const manifest = JSON.parse(Buffer.concat([d.update(b.subarray(19, -16)), d.final()]));
  if (targetRoot) {
    const stat = fs.lstatSync(targetRoot);
    if (path.dirname(targetRoot) !== privateBase || !/^functional-344-[a-f0-9]{16}$/.test(path.basename(targetRoot))
      || !stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid()
      || (stat.mode & 0o777) !== 0o700 || fs.existsSync(path.join(targetRoot, 'input.json'))) throw new Error('FUNCTIONAL_ROOT_INVALID');
    root = targetRoot;
  } else {
    root = path.join(privateBase, 'pilot-344-' + crypto.randomBytes(8).toString('hex'));
    fs.mkdirSync(root, { mode: 0o700 });
  }
  // These verified manifest entries were matched by headers during precheck.
  const sourceFiles = [[2, 'cliente'], [3, 'fornecedor'], [4, 'produto']]
    .map(([index, entity]) => ({ ...manifest.files[index], entity }));
  if (targetRoot) sourceFiles.push({ ...manifest.files[372], entity: 'unitMap' });
  save('source-descriptors.json', { sourceFiles });
  const python = `import csv,json,pathlib,sys,os,hashlib
os.umask(0o077)
root=pathlib.Path(sys.argv[1]); base=root.parent/'recovered'
descriptors=json.loads((root/'source-descriptors.json').read_text())
rows={}
required={'cliente':{'codigo_legado','tipo','cpf','cnpj','razao_social'},'fornecedor':{'codigo_legado','tipo_pessoa','cpf_cnpj'},'produto':{'codigo_legado','tipo_item','unidade_principal'}}
required['unitMap']={'approved_target_unit_id','scope_verified','semantic_equivalence_verified'}
for f in descriptors['sourceFiles']:
 p=base/f['relativePath']
 assert p.resolve().is_relative_to(base.resolve()) and not p.is_symlink()
 assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
 with p.open(encoding='utf-8-sig',newline='') as h:
  first=h.readline(); dialect=csv.Sniffer().sniff(first,delimiters=',;\\t|'); h.seek(0)
  reader=csv.DictReader(h,delimiter=dialect.delimiter,quotechar='"',doublequote=True,strict=True)
  assert required[f['entity']].issubset(set(reader.fieldnames))
  rows[f['entity']]=list(reader)
  assert all(None not in row and all(value is not None for value in row.values()) for row in rows[f['entity']])
data={'authorization':'#344 ISOLATED_PILOT_ONLY','sourceFiles':descriptors['sourceFiles'],'rows':rows}
(root/'input.json').write_text(json.dumps(data,ensure_ascii=True))
print(json.dumps({k:len(v) for k,v in rows.items()}))
`;
  const result = spawnSync('python3', ['-c', python, root], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (result.status !== 0) {
    fs.writeFileSync(path.join(root, 'preparation-failure-private.txt'), result.stderr, { mode: 0o600 });
    throw new Error('PRIVATE_INPUT_PREPARATION_FAILED');
  }
  if (!targetRoot) fs.writeFileSync(path.join(privateBase, 'current-pilot.json'), JSON.stringify({ root }), { mode: 0o600 });
  console.log(JSON.stringify({ prepared: true, sourceRows: JSON.parse(result.stdout) }));
  return root;
}

// Execution-only harness: existing mappers, services, repositories and audit own
// business behavior. No operational URL or private migration is accepted.
export function assertIsolationDescriptor(c, { name, batchId, image, privateRoot }) {
  const allowed = new Set([path.posix.join(privateRoot, 'pgdata'), path.posix.join(privateRoot, 'socket')]);
  if (c.Name !== '/' + name || c.Config.Labels['erp.legacy.pilot'] !== batchId
    || c.HostConfig.NetworkMode !== 'none' || c.HostConfig.Privileged
    || !c.HostConfig.ReadonlyRootfs || Object.keys(c.HostConfig.PortBindings || {}).length
    || c.Mounts.length !== 2 || c.Mounts.some(x => x.Type !== 'bind' || !allowed.has(x.Source))
    || c.Image !== image) throw new Error('ISOLATION_DESCRIPTOR_INVALID');
  return { network: 'none', publishedPorts: 0, privileged: false, readOnlyRoot: true,
    privateMountsOnly: true, imagePinned: true };
}

function inspectContainer(name, expected) {
  return assertIsolationDescriptor(JSON.parse(run('docker', ['inspect', name]))[0],
    { name, batchId: batch, image: expected, privateRoot: root });
}

async function main() {
  if (!root || path.dirname(root) !== privateBase || !/^pilot-344-[a-f0-9]{16}$/.test(path.basename(root))) {
    throw new Error('PRIVATE_ROOT_INVALID');
  }
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid()
    || (stat.mode & 0o777) !== 0o700) throw new Error('PRIVATE_ROOT_PROTECTION_INVALID');
  const allowedPaths = new Set(['scripts/legado/pilot-isolated.mjs', 'tests/legado-piloto-isolado.test.js']);
  const dirty = git(['status', '--porcelain']);
  if (git(['rev-parse', 'HEAD']) !== sourceSha || (dirty && dirty.split('\n').some(line => !allowedPaths.has(line.slice(3))))
    || git(['branch', '--show-current']) !== 'codex/consolidacao-infra-20261017') throw new Error('CHECKOUT_CHANGED');
  fs.writeFileSync(path.join(root, 'pilot.lock'), JSON.stringify({ pid: process.pid }), { flag: 'wx', mode: 0o600 });
  const input = readJson(path.join(root, 'input.json'));
  if (input.authorization !== '#344 ISOLATED_PILOT_ONLY' || !input.sourceFiles
    || !['cliente', 'fornecedor', 'produto'].every(e => Array.isArray(input.rows[e]))) throw new Error('INPUT_CONTRACT_INVALID');
  for (const f of input.sourceFiles) {
    const p = path.resolve(privateBase, 'recovered', f.relativePath);
    if (!p.startsWith(path.join(privateBase, 'recovered') + '/') || fs.lstatSync(p).isSymbolicLink()
      || digest(fs.readFileSync(p)) !== f.sha256) throw new Error('SOURCE_INTEGRITY_CHANGED');
  }
  batch = crypto.randomUUID();
  const tag = batch.replaceAll('-', '').slice(0, 16);
  const dbName = 'erp_legacy_pilot_' + tag;
  const adminUser = 'pilot_admin_' + tag;
  const dataUser = 'pilot_data_' + tag;
  const adminPassword = crypto.randomBytes(32).toString('hex');
  const dataPassword = crypto.randomBytes(32).toString('hex');
  const groupId = crypto.randomUUID(), actorId = crypto.randomUUID();
  const sourceSystem = 'LEGADO_ISOLATED_344';
  const pgdata = path.join(root, 'pgdata'), socket = path.join(root, 'socket');
  fs.mkdirSync(pgdata, { mode: 0o700 }); fs.mkdirSync(socket, { mode: 0o700 });
  const env = path.join(root, 'postgres-private.env');
  fs.writeFileSync(env, `POSTGRES_DB=${dbName}\nPOSTGRES_USER=${adminUser}\nPOSTGRES_PASSWORD=${adminPassword}\nPOSTGRES_INITDB_ARGS=--auth-local=scram-sha-256 --auth-host=scram-sha-256\n`, { flag: 'wx', mode: 0o600 });
  const image = JSON.parse(run('docker', ['image', 'inspect', 'postgres:16']))[0].Id;
  container = 'erp-legacy-pilot-' + tag;
  run('docker', ['run', '-d', '--pull=never', '--name', container, '--label', 'erp.legacy.pilot=' + batch,
    '--network', 'none', '--read-only', '--security-opt', 'no-new-privileges:true', '--log-driver', 'none',
    '--memory', '1g', '--cpus', '1', '--env-file', env, '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
    '--mount', `type=bind,source=${pgdata},target=/var/lib/postgresql/data`,
    '--mount', `type=bind,source=${socket},target=/var/run/postgresql`, image,
    'postgres', '-c', 'listen_addresses=', '-c', 'unix_socket_permissions=0777',
    '-c', 'log_statement=none', '-c', 'log_min_error_statement=panic',
    '-c', 'log_parameter_max_length=0', '-c', 'log_parameter_max_length_on_error=0']);
  const isolation = inspectContainer(container, image);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    // The image starts a temporary server before creating POSTGRES_DB.
    // Wait for the final server (PID 1) before accepting pg_isready.
    const finalServer = spawnSync('docker', ['exec', container, 'sh', '-c', 'test "$(cat /proc/1/comm)" = postgres']);
    const r = spawnSync('docker', ['exec', container, 'pg_isready', '-h', '/var/run/postgresql', '-d', dbName, '-U', adminUser]);
    if (finalServer.status === 0 && r.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('ISOLATED_POSTGRES_NOT_READY');
  const req = createRequire(path.join(repo, 'server/package.json'));
  const { Pool } = req('pg');
  admin = new Pool({ host: socket, database: dbName, user: adminUser, password: adminPassword, max: 2, connectionTimeoutMillis: 5000 });
  const identity = (await admin.query(`SELECT current_database() AS database, current_user AS role,
    inet_server_addr() AS network_address, (SELECT system_identifier::text FROM pg_control_system()) AS system_identifier`)).rows[0];
  const initial = (await admin.query(`SELECT count(*)::int AS total FROM information_schema.tables WHERE table_schema='public'`)).rows[0].total;
  if (identity.database !== dbName || identity.role !== adminUser || identity.network_address !== null || initial !== 0) {
    throw new Error('ISOLATED_DATABASE_IDENTITY_FAILED');
  }
  save('isolation-private.json', { batch, container, image, identity, initialTables: initial, ...isolation,
    groupId, actorId, sourceGroupPreservedInInput: true, targetGroup: 'SYNTHETIC_ISOLATED_NAMESPACE_ONLY', sourceSha });
  console.log(JSON.stringify({ phase: 'isolated_destination_proven', ...isolation, initialTables: initial }));
  const files = fs.readdirSync(path.join(repo, 'server/migrations')).filter(x => /^\d+_.*\.sql$/.test(x)).sort();
  for (const file of files) {
    const client = await admin.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(repo, 'server/migrations', file), 'utf8'));
      await client.query('INSERT INTO schema_migrations(id) VALUES($1)', [file]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  const migrationHashes = files.map(file => ({ file, sha256: digest(fs.readFileSync(path.join(repo, 'server/migrations', file))) }));
  save('schema-private.json', { migrationHashes, privateMigrationsApplied: false });
  await admin.query('INSERT INTO groups(id,nome_do_grupo) VALUES($1,$2)', [groupId, 'ISOLATED LEGACY PILOT - NOT A LEGAL COMPANY']);
  const permissions = { Cadastros: { cliente: ['visualizar', 'criar', 'importar', 'inativar'] } };
  await admin.query(`INSERT INTO profiles(id,email,full_name,group_id,empresa_id,permissoes,ativo)
    VALUES($1,$2,$3,$4,NULL,$5::jsonb,true)`, [actorId, 'pilot-actor@isolated.invalid', 'ISOLATED SYNTHETIC ACTOR', groupId, JSON.stringify(permissions)]);
  await admin.query(`CREATE ROLE "${dataUser}" LOGIN PASSWORD '${dataPassword}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
  await admin.query(`GRANT CONNECT ON DATABASE "${dbName}" TO "${dataUser}"`);
  await admin.query(`GRANT USAGE ON SCHEMA public TO "${dataUser}"`);
  await admin.query(`GRANT SELECT ON groups,profiles,clientes,cliente_empresas,entity_code_sequences TO "${dataUser}"`);
  await admin.query(`GRANT INSERT,UPDATE ON clientes,entity_code_sequences TO "${dataUser}"`);
  await admin.query(`GRANT INSERT ON audit_logs TO "${dataUser}"`);
  // Test-only policies in this newly proven empty cluster. Not migrations,
  // operational grants, or evidence that destination policies are approved.
  const tenant = `group_id = '${groupId}'::uuid AND group_id = NULLIF(current_setting('app.group_id',true),'')::uuid`;
  const groupScope = `NULLIF(current_setting('app.empresa_id',true),'') IS NULL`;
  await admin.query(`CREATE POLICY pilot_group_read ON groups FOR SELECT TO "${dataUser}"
    USING (id = '${groupId}'::uuid AND id = NULLIF(current_setting('app.group_id',true),'')::uuid AND ${groupScope})`);
  await admin.query(`CREATE POLICY pilot_profile_read ON profiles FOR SELECT TO "${dataUser}"
    USING (${tenant} AND ${groupScope} AND id = '${actorId}'::uuid AND empresa_id IS NULL)`);
  for (const table of ['clientes', 'entity_code_sequences']) {
    await admin.query(`CREATE POLICY pilot_group_data ON ${table} FOR ALL TO "${dataUser}"
      USING (${tenant} AND ${groupScope}) WITH CHECK (${tenant} AND ${groupScope})`);
  }
  await admin.query(`CREATE POLICY pilot_link_read ON cliente_empresas FOR SELECT TO "${dataUser}"
    USING (${tenant} AND ${groupScope})`);
  await admin.query(`CREATE POLICY pilot_audit_append ON audit_logs FOR INSERT TO "${dataUser}"
    WITH CHECK (${tenant} AND ${groupScope} AND actor_id = '${actorId}'::uuid AND empresa_id IS NULL)`);
  save('test-role-private.json', { restrictedRole: true, bypassRls: false, syntheticGroupAndActorOnly: true,
    operationalPoliciesProven: false, testOnlyPolicies: true });
  pool = new Pool({ host: socket, database: dbName, user: dataUser, password: dataPassword, max: 3, connectionTimeoutMillis: 5000 });
  const module = async p => import(pathToFileURL(path.join(repo, p)).href);
  const { createPoolDbClient } = await module('server/src/db/client.ts');
  const { PostgresClienteRepository } = await module('server/src/repositories/postgresClienteRepository.ts');
  const { PostgresAuditRepository } = await module('server/src/audit/auditRepository.ts');
  const { PostgresTenantGuard } = await module('server/src/db/tenantGuard.ts');
  const { PostgresRbacGuard } = await module('server/src/db/rbacGuard.ts');
  const { ClienteService } = await module('server/src/services/clienteService.ts');
  const { clienteCreateSchema } = await module('server/src/repositories/clienteTypes.ts');
  const { normalizeDocumento } = await module('server/src/db/documentoValidators.ts');
  const { persistirClienteGrupoLegado, mapLegadoRowToCanonicalStub, criarSnapshotReconciliacaoLegado,
    reconciliarPilotoGrupoLegado } = await module('scripts/legado/consumir-lote-staging.mjs');
  const db = createPoolDbClient(pool), rbac = new PostgresRbacGuard(db);
  const service = new ClienteService(new PostgresClienteRepository(db), new PostgresAuditRepository(db), new PostgresTenantGuard(db), rbac);
  const ctx = { groupId, empresaId: null, actorId, requestId: batch };
  const scoped = fn => db.withTenantContext(ctx, fn);
  const rowState = async () => (await admin.query('SELECT to_jsonb(c) AS row FROM clientes c ORDER BY id')).rows;
  const quarantine = [];
  const eligible = [];
  const duplicates = new Map(), documents = new Map();
  for (const [index, row] of input.rows.cliente.entries()) {
    const code = row.codigo_legado || '', hash = digest(JSON.stringify(row));
    const entry = duplicates.get(code) || { hashes: new Set(), indices: [] };
    entry.hashes.add(hash); entry.indices.push(index); duplicates.set(code, entry);
    const doc = normalizeDocumento(row.tipo === 'Pessoa Física' ? row.cpf : row.cnpj);
    if (doc) { const codes = documents.get(doc) || new Set(); codes.add(code); documents.set(doc, codes); }
  }
  const seen = new Set(); let duplicateRows = 0;
  for (const [index, row] of input.rows.cliente.entries()) {
    const code = row.codigo_legado || '', name = row.tipo === 'Pessoa Física' ? row.nome : row.razao_social;
    const doc = normalizeDocumento(row.tipo === 'Pessoa Física' ? row.cpf : row.cnpj);
    let reason = null;
    if (duplicates.get(code).hashes.size > 1 || (documents.get(doc)?.size || 0) > 1) reason = 'SOURCE_IDENTITY_CONFLICT';
    else if (row.quarantine_reasons && row.quarantine_reasons !== '[]') reason = 'SOURCE_QUARANTINE';
    else if (String(row.status).trim().toLowerCase() !== 'ativo') reason = 'STATUS_NOT_ELIGIBLE_FOR_ACTIVE_PILOT';
    else if (!/^\d{1,15}$/.test(code) || !code || !row.codigo) reason = 'SOURCE_CODE_RECONCILIATION_REQUIRED';
    const payload = { tipo: row.tipo, documento: doc, codigo: row.codigo || code, empresa_id: null,
      ...(row.tipo === 'Pessoa Física' ? { nome: name } : { razao_social: name }),
      ...(row.nome_fantasia ? { nome_fantasia: row.nome_fantasia } : {}), status: row.status,
      origem: 'MIGRACAO', codigo_legado: code, legacy_id: code, source_system: sourceSystem, migration_batch: batch };
    if (!reason && !clienteCreateSchema.safeParse(payload).success) reason = 'CANONICAL_VALIDATION_FAILED';
    if (reason) { quarantine.push({ entity: 'cliente', index, reason, sourceCode: code }); continue; }
    if (seen.has(code)) { duplicateRows++; continue; } seen.add(code);
    const mapped = mapLegadoRowToCanonicalStub({ codigo_legado: code, nome: name, documento: doc,
      nome_fantasia: row.nome_fantasia || '', group_id: groupId }, { entidade: 'cliente', groupId, arquivoNome: 'verified-private-staging' });
    eligible.push({ index, mapped, payload });
  }
  const selected = eligible.slice(0, 25);
  save('eligibility-private.json', { eligible: eligible.length, duplicateRows, quarantine });
  if (!selected.length) throw new Error('NO_ELIGIBLE_CLIENT_IN_STAGING');
  for (const entity of ['fornecedor', 'produto']) {
    for (const [index, row] of input.rows[entity].entries()) quarantine.push({ entity, index, sourceCode: row.codigo_legado,
      reason: entity === 'fornecedor' ? 'CANONICAL_SUPPLIER_PERSISTENCE_UNAVAILABLE' : 'CLASS_UNIT_MAP_NOT_APPROVED' });
    report.entities[entity] = { source: input.rows[entity].length, eligible: 0, imported: 0, duplicates: 0,
      rejected: input.rows[entity].length, reconciled: 0, reason: entity === 'fornecedor' ? 'CANONICAL_SUPPLIER_PERSISTENCE_UNAVAILABLE' : 'CLASS_UNIT_MAP_NOT_APPROVED' };
  }
  save('quarantine-private.json', quarantine);
  save('selection-private.json', { batch, groupId, sourceFiles: input.sourceFiles, selected, sourceGroupRetainedInInput: true });
  const snapshots = [], ids = [];
  for (const item of selected) {
    const adapter = { findByLegacyIdentity: service.findByLegacyIdentity.bind(service), sugerirVinculo: service.sugerirVinculo.bind(service),
      create: (scope, payload) => service.create(scope, { ...payload, codigo: item.payload.codigo, status: item.payload.status }) };
    const result = await scoped(() => persistirClienteGrupoLegado(ctx, item.mapped,
      { service: adapter, rbacGuard: rbac, tipo: item.payload.tipo, sourceSystem, batch }));
    if (result.reutilizado) throw new Error('FRESH_DATABASE_REUSED_UNEXPECTEDLY');
    assert.equal(result.registro.codigo, item.payload.codigo);
    assert.equal(result.registro.empresa_id, null);
    ids.push(result.registro.id);
    snapshots.push(criarSnapshotReconciliacaoLegado('cliente', { ...result.registro, ...item.payload, group_id: groupId }));
  }
  save('snapshots-private.json', snapshots);
  const reconciliation = await scoped(() => reconciliarPilotoGrupoLegado(ctx, snapshots, { services: { cliente: service }, rbacGuard: rbac }));
  assert.equal(reconciliation.equivalente, true);
  const beforeReplay = digest(JSON.stringify(await rowState()));
  let reused = 0;
  for (const item of selected) {
    const result = await scoped(() => persistirClienteGrupoLegado(ctx, item.mapped,
      { service, rbacGuard: rbac, tipo: item.payload.tipo, sourceSystem, batch }));
    if (!result.reutilizado) throw new Error('REPLAY_CREATED_NEW_RECORD'); reused++;
  }
  assert.equal(digest(JSON.stringify(await rowState())), beforeReplay);
  await assert.rejects(scoped(() => service.create({ ...ctx, actorId: crypto.randomUUID() }, selected[0].payload)), { code: 'PERMISSION_DENIED' });
  const other = { ...ctx, groupId: crypto.randomUUID() };
  await assert.rejects(db.withTenantContext(other, () => service.list(other)), { code: 'PERMISSION_DENIED' });
  const beforeReverse = await rowState();
  for (const id of ids) await scoped(() => service.softDelete(ctx, id));
  const afterReverse = await rowState();
  assert.equal(afterReverse.length, beforeReverse.length);
  assert.equal(afterReverse.filter(x => x.row.ativo).length, 0);
  for (const before of beforeReverse) {
    const after = afterReverse.find(x => x.row.id === before.row.id);
    assert.ok(after);
    assert.equal(before.row.status, 'Ativo');
    assert.equal(after.row.status, 'Inativo');
    for (const field of Object.keys(before.row).filter(x => !['ativo', 'status', 'updated_at', 'updated_by'].includes(x))) {
      assert.deepEqual(after.row[field], before.row[field]);
    }
  }
  const audits = (await admin.query(`SELECT action,count(*)::int AS total FROM audit_logs WHERE request_id=$1 GROUP BY action`, [batch])).rows;
  assert.equal(audits.find(x => x.action === 'create')?.total, selected.length);
  assert.equal(audits.find(x => x.action === 'soft_delete')?.total, selected.length);
  assert.equal((await admin.query('SELECT count(*)::int AS total FROM cliente_empresas')).rows[0].total, 0);
  report.entities.cliente = { source: input.rows.cliente.length, eligible: eligible.length, imported: selected.length,
    duplicates: duplicateRows, rejected: quarantine.filter(x => x.entity === 'cliente').length,
    deferredByPilotLimit: eligible.length - selected.length, reconciled: reconciliation.totais.equivalentes };
  Object.assign(report, { sourceSha, isolation, engine: 'PostgreSQL 16 real, isolated Docker, UNIX socket',
    idempotency: { reused, newRecords: 0, stateUnchanged: true },
    reversal: { deactivated: ids.length, activeRemaining: 0, identitiesAndFieldsPreserved: true, physicalDeletes: 0 },
    auditCreate: selected.length, auditReverse: selected.length, rbacNegativeTests: 2,
    groupScopeOnly: true, companyLinksCreated: 0, targetNamespaceSynthetic: true,
    operationalGroupCrosswalkProven: false, historicalFieldsComplete: false, authorization: '#344 ISOLATED_PILOT_ONLY',
    operationalImport: false, status: 'ISOLATED_CLIENT_PILOT_VERIFIED_SUPPLIER_PRODUCT_QUARANTINED' });
  save('result-private.json', { ...report, snapshots, reconciliation, sourceFiles: input.sourceFiles });
  save('result-sanitized.json', report);
  complete = true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
try { if (root === '--prepare') preparePrivateInput(); else await main(); }
catch (error) {
  if (root && path.dirname(root) === privateBase && fs.existsSync(root)) {
    save('failure-private.json', { code: error.code, message: error.message, stack: error.stack, batch });
  }
  console.error('ISOLATED_PILOT_FAILED_SEE_PRIVATE_RECEIPT');
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
  if (admin) await admin.end();
  if (container) {
    try {
      const c = JSON.parse(run('docker', ['inspect', container]))[0];
      if (c.Config.Labels['erp.legacy.pilot'] !== batch) throw new Error('CLEANUP_LABEL_MISMATCH');
      run('docker', ['stop', '--time', '20', container]);
      const stopped = !JSON.parse(run('docker', ['inspect', container]))[0].State.Running;
      if (!stopped) throw new Error('CLEANUP_FAILED');
      save('cleanup-private.json', { stopped, preservedPrivateDatabase: true, noVolumeDeleted: true });
    } catch { console.error('ISOLATED_PILOT_CLEANUP_FAILED'); process.exitCode = 1; }
  }
  if (complete && !process.exitCode) console.log(JSON.stringify(report));
}
}
