import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { preparePrivateInput, assertIsolationDescriptor } from './pilot-isolated.mjs';
import { rowHash, selectFunctionalRows, planProductEvidence, projectionDifferences } from './pilot-functional-policy.mjs';

const base = '/home/codespace/erp-legado-privado-20261023', repo = '/workspaces/ERP-Zuccaro-codeX';
const baseline = '505a76ed06bf956a076f0e9577f8018ade1fa4b8';
const json = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const run = (tool, args) => {
  const r = spawnSync(tool, args, { cwd: repo, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw Object.assign(new Error('FUNCTIONAL_COMMAND_FAILED'), { tool, status: r.status });
  return r.stdout.trim();
};
const mod = p => import(pathToFileURL(path.join(repo, p)).href);
const pause = () => new Promise(resolve => setTimeout(resolve, 1000));

export async function runFunctionalPilot() {
  process.umask(0o077);
  const root = json(path.join(base, 'current-functional.json')).root;
  const stat = fs.lstatSync(root);
  assert.equal(path.dirname(root), base); assert.match(path.basename(root), /^functional-344-[a-f0-9]{16}$/);
  assert.equal(stat.isSymbolicLink(), false); assert.equal(stat.uid, process.getuid()); assert.equal(stat.mode & 0o777, 0o700);
  const executionHead = run('git', ['rev-parse', 'HEAD']);
  assert.equal(run('git', ['merge-base', baseline, executionHead]), baseline);
  assert.equal(run('git', ['branch', '--show-current']), 'codex/consolidacao-infra-20261017');
  const save = (name, value) => {
    fs.writeFileSync(path.join(root, name + '.tmp'), JSON.stringify(value), { mode: 0o600 });
    fs.renameSync(path.join(root, name + '.tmp'), path.join(root, name));
  };
  const lock = path.join(root, 'writer.lock');
  if (fs.existsSync(lock)) {
    const old = json(lock); let alive = true;
    try { process.kill(old.pid, 0); } catch (e) { if (e.code === 'ESRCH') alive = false; else throw e; }
    if (alive) throw new Error('FUNCTIONAL_WRITER_ALREADY_RUNNING');
    fs.renameSync(lock, lock + '.stale-' + Date.now());
  }
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid }), { flag: 'wx', mode: 0o600 });
  let admin, pool, started = false, container;
  try {
    const pins = ['scripts/legado/pilot-isolated.mjs', 'scripts/legado/pilot-functional.mjs',
      'scripts/legado/pilot-functional-policy.mjs', 'server/src/services/fornecedorService.ts',
      'server/src/repositories/fornecedorTypes.ts', 'server/src/repositories/postgresFornecedorRepository.ts',
      'server/schema-candidates/fornecedor_master.sql'];
    const code = Object.fromEntries(pins.map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, p))).digest('hex')]));
    if (fs.existsSync(path.join(root, 'code-pin-private.json'))) assert.deepEqual(json(path.join(root, 'code-pin-private.json')), code);
    else save('code-pin-private.json', code);
    const space = fs.statfsSync(root);
    if (space.bavail * space.bsize < 512 * 1024 * 1024) throw new Error('PRIVATE_FILESYSTEM_CAPACITY_INSUFFICIENT');
    save('capacity-private.json', { freeBytes: space.bavail * space.bsize, minimumBytes: 512 * 1024 * 1024 });
    if (!fs.existsSync(path.join(root, 'input.json'))) preparePrivateInput(root);
    const input = json(path.join(root, 'input.json'));
    const previous = json(path.join(base, 'current-pilot.json')).root;
    const proof = json(path.join(previous, 'isolation-private.json'));
    container = proof.container;
    const inspect = () => JSON.parse(run('docker', ['inspect', container]))[0];
    const originalContainer = inspect();
    assertIsolationDescriptor(originalContainer, { name: container, batchId: proof.batch, image: proof.image, privateRoot: previous });
    if (originalContainer.State.Running) throw new Error('PRESERVE_ACTIVE_CONTAINER');
    run('docker', ['start', container]); started = true;
    let ready = false;
    for (let i = 0; i < 60; i++) {
      const r = spawnSync('docker', ['exec', container, 'pg_isready', '-h', '/var/run/postgresql'], { stdio: 'ignore' });
      if (r.status === 0) { ready = true; break; } await pause();
    }
    assert.equal(ready, true);
    const env = Object.fromEntries(fs.readFileSync(path.join(previous, 'postgres-private.env'), 'utf8').trim().split('\n')
      .map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
    const { Pool } = createRequire(path.join(repo, 'server/package.json'))('pg');
    const connection = { host: path.join(previous, 'socket'), database: env.POSTGRES_DB, max: 3, connectionTimeoutMillis: 5000 };
    admin = new Pool({ ...connection, user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD });
    const identity = (await admin.query(`SELECT current_database() AS database,current_user AS role,inet_server_addr() AS network_address,
      (SELECT system_identifier::text FROM pg_control_system()) AS system_identifier`)).rows[0];
    assert.deepEqual(identity, proof.identity);
    const preserved = async () => rowHash((await admin.query('SELECT to_jsonb(c) AS row FROM clientes c WHERE group_id=$1 ORDER BY id', [proof.groupId])).rows);
    const beforeOriginal = await preserved();
    if (fs.existsSync(path.join(root, 'original-proof-hash.json'))) assert.equal(json(path.join(root, 'original-proof-hash.json')).hash, beforeOriginal);
    else save('original-proof-hash.json', { hash: beforeOriginal });
    let state = fs.existsSync(path.join(root, 'state-private.json')) ? json(path.join(root, 'state-private.json')) : {
      groupId: crypto.randomUUID(), actorId: crypto.randomUUID(), validationBatch: crypto.randomUUID(),
      sourceSystem: 'LEGADO_ISOLATED_344_FUNCTIONAL', password: crypto.randomBytes(32).toString('hex'),
      batches: {}, initialized: false, completed: false };
    save('state-private.json', state);
    const role = 'pilot_func_' + state.groupId.replaceAll('-', '').slice(0, 12);
    save('isolation-private.json', { sameCluster: true, sameDatabase: true, network: 'none', publishedPorts: 0,
      originalPilotPreserved: true, targetGroupSynthetic: true, operationalGroupCrosswalkProven: false, operationalImport: false });
    console.log(JSON.stringify({ phase: 'functional_isolation_proven', sameCluster: true, network: 'none', originalPilotNotRepeated: true }));
    if (!state.initialized) {
      const tx = await admin.connect();
      try {
        await tx.query('BEGIN');
        if ((await tx.query("SELECT to_regclass('public.fornecedores') AS existing")).rows[0].existing) throw new Error('SUPPLIER_SCHEMA_EXISTS_REVIEW_REQUIRED');
        await tx.query(fs.readFileSync(path.join(repo, 'server/schema-candidates/fornecedor_master.sql'), 'utf8'));
        await tx.query('INSERT INTO groups(id,nome_do_grupo) VALUES($1,$2)', [state.groupId, 'ISOLATED FUNCTIONAL PILOT - NOT A LEGAL COMPANY']);
        await tx.query(`INSERT INTO profiles(id,email,full_name,group_id,empresa_id,permissoes,ativo)
          VALUES($1,$2,$3,$4,NULL,$5::jsonb,true)`, [state.actorId, 'functional-pilot@isolated.invalid', 'SYNTHETIC PILOT ACTOR', state.groupId,
        JSON.stringify({ Cadastros: { cliente: ['visualizar', 'criar', 'importar', 'inativar'], fornecedor: ['visualizar', 'criar', 'importar', 'inativar'] } })]);
        await tx.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${state.password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
        await tx.query(`GRANT CONNECT ON DATABASE "${env.POSTGRES_DB}" TO "${role}"; GRANT USAGE ON SCHEMA public TO "${role}";
          GRANT SELECT ON profiles,clientes,cliente_empresas,entity_code_sequences,fornecedores TO "${role}";
          GRANT INSERT,UPDATE ON clientes,fornecedores,entity_code_sequences TO "${role}"; GRANT INSERT ON audit_logs TO "${role}"`);
        const tenant = `group_id='${state.groupId}'::uuid AND group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
          AND NULLIF(current_setting('app.empresa_id',true),'') IS NULL`;
        for (const table of ['clientes', 'fornecedores', 'entity_code_sequences']) await tx.query(`CREATE POLICY ${role} ON ${table}
          FOR ALL TO "${role}" USING(${tenant}) WITH CHECK(${tenant})`);
        await tx.query(`CREATE POLICY ${role} ON profiles FOR SELECT TO "${role}"
          USING(${tenant} AND id='${state.actorId}'::uuid AND empresa_id IS NULL)`);
        await tx.query(`CREATE POLICY ${role} ON cliente_empresas FOR SELECT TO "${role}" USING(${tenant})`);
        await tx.query(`CREATE POLICY ${role} ON audit_logs FOR INSERT TO "${role}"
          WITH CHECK(${tenant} AND actor_id='${state.actorId}'::uuid AND empresa_id IS NULL)`);
        await tx.query('COMMIT'); state.initialized = true; save('state-private.json', state);
      } catch (error) { await tx.query('ROLLBACK'); throw error; } finally { tx.release(); }
    }
    pool = new Pool({ ...connection, user: role, password: state.password });
    const { createPoolDbClient } = await mod('server/src/db/client.ts');
    const { PostgresRbacGuard } = await mod('server/src/db/rbacGuard.ts');
    const { PostgresTenantGuard } = await mod('server/src/db/tenantGuard.ts');
    const { PostgresAuditRepository } = await mod('server/src/audit/auditRepository.ts');
    const { PostgresClienteRepository } = await mod('server/src/repositories/postgresClienteRepository.ts');
    const { ClienteService } = await mod('server/src/services/clienteService.ts');
    const { clienteCreateSchema } = await mod('server/src/repositories/clienteTypes.ts');
    const { fornecedorImportSchema } = await mod('server/src/repositories/fornecedorTypes.ts');
    const { PostgresFornecedorRepository } = await mod('server/src/repositories/postgresFornecedorRepository.ts');
    const { FornecedorService, fingerprintFornecedor } = await mod('server/src/services/fornecedorService.ts');
    const { persistirClienteGrupoLegado } = await mod('scripts/legado/consumir-lote-staging.mjs');
    const db = createPoolDbClient(pool), rbac = new PostgresRbacGuard(db), audit = new PostgresAuditRepository(db);
    const clientRepo = new PostgresClienteRepository(db);
    const services = { cliente: new ClienteService(clientRepo, audit, new PostgresTenantGuard(db), rbac),
      fornecedor: new FornecedorService(new PostgresFornecedorRepository(db), audit, rbac) };
    const selection = selectFunctionalRows(input, { groupId: state.groupId, batch: state.validationBatch,
      sourceSystem: state.sourceSystem, clienteSchema: clienteCreateSchema, fornecedorSchema: fornecedorImportSchema });
    const products = planProductEvidence(input.rows.produto, input.rows.unitMap, { groupId: state.groupId });
    save('selection-private.json', selection); save('product-map-decisions-private.json', products);
    if (products.released.length) throw new Error('RELEASED_PRODUCT_TARGET_REQUIRES_VALIDATION');
    const logPath = path.join(root, 'journal-private.ndjson'), events = fs.existsSync(logPath)
      ? fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
    const applied = new Map(), replayed = new Set(), reversed = new Set(), rejected = new Map();
    const consume = e => {
      const key = `${e.entity}:${e.index}`;
      if (e.phase === 'load') applied.set(key, e);
      if (e.phase === 'replay') replayed.add(key);
      if (e.phase === 'reverse') reversed.add(key);
      if (e.phase === 'reject') rejected.set(key, e);
    };
    events.forEach(consume);
    const append = e => { fs.appendFileSync(logPath, JSON.stringify(e) + '\n', { mode: 0o600 }); consume(e); };
    const ctx = requestId => ({ groupId: state.groupId, actorId: state.actorId, empresaId: null, requestId });
    const scoped = (context, fn) => db.withTenantContext(context, fn);
    const batchFor = (entity, position) => {
      const name = `${entity}:${Math.floor(position / 250)}`;
      if (!state.batches[name]) { state.batches[name] = { id: crypto.randomUUID(), reverseId: crypto.randomUUID() }; save('state-private.json', state); }
      return state.batches[name];
    };
    const importRow = async (entity, item, batch) => {
      const context = ctx(batch.id), payload = { ...item.payload, migration_batch: batch.id };
      if (entity === 'fornecedor') return scoped(context, () => services.fornecedor.importar(context, payload));
      const service = services.cliente;
      const adapter = { findByLegacyIdentity: service.findByLegacyIdentity.bind(service), sugerirVinculo: service.sugerirVinculo.bind(service),
        create: scope => service.create(scope, payload) };
      return scoped(context, () => persistirClienteGrupoLegado(context, item.mapped,
        { service: adapter, rbacGuard: rbac, tipo: payload.tipo, sourceSystem: state.sourceSystem, batch: batch.id }));
    };
    for (const entity of ['fornecedor', 'cliente']) {
      for (const [position, item] of selection.selected[entity].entries()) {
        const key = `${entity}:${item.index}`, batch = batchFor(entity, position);
        if (applied.has(key) || rejected.has(key)) continue;
        try {
          const result = await importRow(entity, item, batch);
          append({ phase: 'load', entity, index: item.index, position, batch, record: result.registro, reused: result.reutilizado });
        } catch (error) {
          if (!['DUPLICATE_DOCUMENT_OR_CODE', 'LEGACY_RECONCILIATION_REQUIRED', 'VALIDATION_ERROR', 'DUPLICATE_DOCUMENT'].includes(error.code)) throw error;
          append({ phase: 'reject', entity, index: item.index, reason: error.code });
        }
        if ((position + 1) % 250 === 0) console.log(JSON.stringify({ phase: 'load_checkpoint', entity, processedEligible: position + 1, applied: applied.size }));
      }
    }
    for (const entity of ['fornecedor', 'cliente']) {
      for (const item of selection.selected[entity]) {
        const key = `${entity}:${item.index}`, known = applied.get(key);
        if (!known || replayed.has(key) || reversed.has(key)) continue;
        const again = await importRow(entity, item, known.batch);
        assert.equal(again.reutilizado, true); assert.equal(rowHash(again.registro), rowHash(known.record));
        append({ phase: 'replay', entity, index: item.index });
      }
      console.log(JSON.stringify({ phase: 'replay_verified', entity, records: [...applied.values()].filter(x => x.entity === entity).length }));
    }
    for (const entity of ['fornecedor', 'cliente']) {
      for (const item of selection.selected[entity]) {
        const key = `${entity}:${item.index}`, known = applied.get(key);
        if (!known || reversed.has(key)) continue;
        const context = ctx(known.batch.reverseId), service = services[entity];
        const after = await scoped(context, () => db.withTransaction(async q => {
          await rbac.assertAllowed(context, 'Cadastros', entity, 'inativar', { allowGlobalWildcard: false, executor: q });
          const table = entity === 'cliente' ? 'clientes' : 'fornecedores';
          assert.equal((await q.query(`SELECT id FROM ${table} WHERE group_id=$1 AND id=$2 FOR UPDATE`, [state.groupId, known.record.id])).rowCount, 1);
          const current = entity === 'cliente' ? await clientRepo.getById({ groupId: state.groupId, empresaId: null }, known.record.id, q)
            : await service.get(context, known.record.id);
          if (!current.ativo && current.status === 'Inativo') {
            const prior = (await admin.query("SELECT id FROM audit_logs WHERE request_id=$1 AND entity_id=$2 AND action='soft_delete'", [known.batch.reverseId, known.record.id])).rows;
            if (known.record.ativo && prior.length !== 1) throw new Error('INACTIVE_TARGET_CHANGED_OUTSIDE_BATCH');
            for (const field of Object.keys(known.record).filter(k => !['ativo', 'status', 'revision', 'updated_at', 'updated_by'].includes(k))) {
              assert.equal(rowHash(current[field]), rowHash(known.record[field]));
            }
            return current;
          }
          assert.equal(rowHash(current), rowHash(known.record));
          return entity === 'cliente' ? service.softDelete(context, current.id)
            : service.softDelete(context, current.id, current.revision, state.sourceSystem, known.batch.id, fingerprintFornecedor(current));
        }));
        assert.equal(after.ativo, false); assert.equal(after.status, 'Inativo');
        for (const field of Object.keys(known.record).filter(k => !['ativo', 'status', 'revision', 'updated_at', 'updated_by'].includes(k))) {
          assert.equal(rowHash(after[field]), rowHash(known.record[field]));
        }
        append({ phase: 'reverse', entity, index: item.index, recordHash: rowHash(after) });
      }
    }
    assert.equal(await preserved(), beforeOriginal);
    const entities = {};
    const reconciliationPending = [];
    for (const entity of ['cliente', 'fornecedor']) {
      const records = [...applied.values()].filter(x => x.entity === entity), table = entity === 'cliente' ? 'clientes' : 'fornecedores';
      const expected = new Map(selection.selected[entity].map(item => [item.index, item.payload]));
      const conflicts = records.filter(record => {
        const payload = expected.get(record.index);
        const fields = payload ? projectionDifferences(payload, record.record) : ['source_eligibility'];
        if (fields.length) reconciliationPending.push({ entity, index: record.index, id: record.record.id,
          fields, reason: 'SOURCE_PROJECTION_CHANGED_REVERSED_RECORD_PRESERVED', reactivationAuthorized: false });
        return fields.length > 0;
      });
      const count = (await admin.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE ativo)::int AS active,
        count(DISTINCT (source_system,codigo_legado))::int AS unique_origins FROM ${table} WHERE group_id=$1`, [state.groupId])).rows[0];
      assert.equal(count.total, records.length); assert.equal(count.active, 0); assert.equal(count.unique_origins, records.length);
      entities[entity] = { ...selection.counts[entity], written: records.filter(x => !x.reused).length,
        reused: records.filter(x => x.reused).length, replayReused: records.filter(x => replayed.has(`${entity}:${x.index}`)).length,
        persistenceRejected: [...rejected.values()].filter(x => x.entity === entity).length,
        reconciled: records.length - conflicts.length, reconciliationPending: conflicts.length,
        reversed: records.filter(x => reversed.has(`${entity}:${x.index}`)).length,
        activeRemaining: 0, auxiliaryPending: selection.auxiliary.filter(x => x.entity === entity).length,
        completeCadastroProven: false };
    }
    save('reconciliation-pending-private.json', reconciliationPending);
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM cliente_empresas WHERE group_id=$1', [state.groupId])).rows[0].n, 0);
    const summary = { status: 'FUNCTIONAL_MASTER_PILOT_VERIFIED_PRODUCT_AND_AUXILIARY_GATES_OPEN', sourceSha: baseline, executionHead,
      entities, products: { source: input.rows.produto.length, processed: products.processed, written: 0,
        reused: 0, rejected: 0, pending: products.pending, reconciled: 0, verifiedUnitRows: products.verifiedUnitRows },
      original25Preserved: true, operationalImport: false, companyLinksCreated: 0, physicalDeletes: 0,
      perBatchCheckpoints: Object.keys(state.batches).length, replayNewRecords: 0, syntheticGroupOnly: true,
      testOnlyRlsPolicies: true, supplierSchemaCandidateOnly: true };
    state.completed = true; save('state-private.json', state); save('result-sanitized.json', summary);
    console.log(JSON.stringify(summary));
  } catch (error) {
    save('failure-private.json', { code: error.code, message: error.message, stack: error.stack });
    console.error('FUNCTIONAL_PILOT_FAILED_PRIVATE_RECEIPT'); process.exitCode = 1;
  } finally {
    if (pool) await pool.end(); if (admin) await admin.end();
    if (started) { run('docker', ['stop', '--time', '20', container]); save('cleanup-private.json', { stopped: true, databasePreserved: true }); }
    fs.unlinkSync(lock);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runFunctionalPilot();
