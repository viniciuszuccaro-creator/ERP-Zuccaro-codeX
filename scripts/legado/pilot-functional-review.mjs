import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { assertIsolationDescriptor } from './pilot-isolated.mjs';
import { rowHash, resolveNativeProductRules, classifyLegacyAddresses } from './pilot-functional-policy.mjs';

/** New review mode reads the preserved pilot; never invokes a load or real correction. */
export async function reviewFunctionalCompleteness({ base, repo, json, run, mod, pause }) {
  process.umask(0o077);
  const pointer = json(path.join(base, 'current-completeness.json')), root = pointer.root;
  const stat = fs.lstatSync(root);
  assert.equal(path.dirname(root), base); assert.match(path.basename(root), /^completeness-344-[a-f0-9]{16}$/);
  assert.equal(stat.uid, process.getuid()); assert.equal(stat.mode & 0o777, 0o700); assert.equal(stat.isSymbolicLink(), false);
  assert.equal(run('git', ['rev-parse', 'HEAD']), pointer.sourceSha);
  assert.equal(run('git', ['branch', '--show-current']), 'codex/consolidacao-infra-20261017');
  const old = pointer.sourceFunctional, state = json(path.join(old, 'state-private.json'));
  assert.equal(path.dirname(old), base); assert.match(path.basename(old), /^functional-344-[a-f0-9]{16}$/);
  assert.equal(fs.existsSync(path.join(old, 'writer.lock')), false);
  const lock = path.join(root, 'review.lock'); fs.writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 });
  const save = (name, data) => fs.writeFileSync(path.join(root, name), JSON.stringify(data), { flag: 'wx', mode: 0o600 });
  let admin, pool, container, started = false;
  try {
    const input = json(path.join(old, 'input.json'));
    for (const descriptor of input.sourceFiles) {
      const source = path.resolve(base, 'recovered', descriptor.relativePath);
      assert.equal(source.startsWith(path.join(base, 'recovered') + '/'), true);
      assert.equal(fs.lstatSync(source).isSymbolicLink(), false);
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), descriptor.sha256);
    }
    const material = json(path.join(old, 'raw-material-source-private.json'));
    const rawSource = path.resolve(base, 'recovered', material.descriptor.relativePath);
    assert.equal(rawSource.startsWith(path.join(base, 'recovered') + '/'), true);
    assert.equal(fs.lstatSync(rawSource).isSymbolicLink(), false);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(rawSource)).digest('hex'), material.descriptor.sha256);
    const previous = json(path.join(base, 'current-pilot.json')).root, proof = json(path.join(previous, 'isolation-private.json'));
    container = proof.container;
    const info = JSON.parse(run('docker', ['inspect', container]))[0];
    assertIsolationDescriptor(info, { name: container, batchId: proof.batch, image: proof.image, privateRoot: previous });
    assert.equal(info.State.Running, false); run('docker', ['start', container]); started = true;
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (spawnSync('docker', ['exec', container, 'pg_isready', '-h', '/var/run/postgresql'], { stdio: 'ignore' }).status === 0) { ready = true; break; }
      await pause();
    }
    assert.equal(ready, true);
    const env = Object.fromEntries(fs.readFileSync(path.join(previous, 'postgres-private.env'), 'utf8').trim().split('\n')
      .map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
    const { Pool } = createRequire(path.join(repo, 'server/package.json'))('pg');
    const connection = { host: path.join(previous, 'socket'), database: env.POSTGRES_DB, max: 2,
      connectionTimeoutMillis: 5000, options: '-c default_transaction_read_only=on' };
    admin = new Pool({ ...connection, user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD });
    assert.deepEqual((await admin.query(`SELECT current_database() AS database,current_user AS role,inet_server_addr() AS network_address,
      (SELECT system_identifier::text FROM pg_control_system()) AS system_identifier`)).rows[0], proof.identity);
    assert.equal((await admin.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
    // Existing canonical reads acquire row locks. No mutation method is invoked.
    pool = new Pool({ ...connection, options: '-c default_transaction_read_only=off',
      user: 'pilot_func_' + state.groupId.replaceAll('-', '').slice(0, 12), password: state.password });
    const { createPoolDbClient } = await mod('server/src/db/client.ts');
    const { PostgresRbacGuard } = await mod('server/src/db/rbacGuard.ts');
    const { PostgresAuditRepository } = await mod('server/src/audit/auditRepository.ts');
    const { PostgresTenantGuard } = await mod('server/src/db/tenantGuard.ts');
    const { PostgresClienteRepository } = await mod('server/src/repositories/postgresClienteRepository.ts');
    const { ClienteService } = await mod('server/src/services/clienteService.ts');
    const { FornecedorService } = await mod('server/src/services/fornecedorService.ts');
    const { PostgresFornecedorRepository } = await mod('server/src/repositories/postgresFornecedorRepository.ts');
    const { clienteLocalCreateSchema } = await mod('server/src/repositories/clienteLocalTypes.ts');
    const { legacyNameFingerprint } = await mod('server/src/services/clienteLegacyNameCorrection.ts');
    const db = createPoolDbClient(pool), rbac = new PostgresRbacGuard(db), audit = new PostgresAuditRepository(db);
    const clienteRepo = new PostgresClienteRepository(db), cliente = new ClienteService(clienteRepo, audit, new PostgresTenantGuard(db), rbac);
    const fornecedor = new FornecedorService(new PostgresFornecedorRepository(db), audit, rbac);
    const ctx = { groupId: state.groupId, empresaId: null, actorId: state.actorId, requestId: crypto.randomUUID() };
    const scoped = fn => db.withTenantContext(ctx, fn);
    const units = (await admin.query('SELECT id,group_id,ativo FROM unidades_medida WHERE group_id=$1', [state.groupId])).rows;
    const products = resolveNativeProductRules(input.rows.produto, material.rows, input.rows.unitMap, { groupId: state.groupId, units });
    save('products-rule-decisions-private.json', products);
    const addresses = classifyLegacyAddresses(input, { validateAddress: fields => clienteLocalCreateSchema.safeParse(fields) });
    save('addresses-completeness-private.json', addresses);
    const first = await scoped(() => cliente.list(ctx, { ativo: false, limit: 200, offset: 0 }));
    const second = await scoped(() => cliente.list(ctx, { ativo: false, limit: 200, offset: 200 }));
    assert.equal(first.meta.total, state.completed ? 17471 : -1); assert.equal(second.meta.total, first.meta.total);
    assert.equal(new Set([...first.data, ...second.data].map(r => r.id)).size, first.data.length + second.data.length);
    assert.equal(first.data.every(r => r.group_id === state.groupId && r.ativo === false), true);
    const selection = json(path.join(old, 'selection-private.json'));
    const suppliers = (await admin.query('SELECT id FROM fornecedores WHERE group_id=$1 ORDER BY id LIMIT 2', [state.groupId])).rows;
    const supplierDemo = [];
    for (const r of suppliers) supplierDemo.push(await scoped(() => fornecedor.get(ctx, r.id)));
    await assert.rejects(scoped(() => cliente.get(ctx, first.data[0].id)), { code: 'CLIENTE_NOT_FOUND' });
    const pending = json(path.join(old, 'reconciliation-pending-private.json')); assert.equal(pending.length, 1);
    const item = pending[0], corrected = selection.selected.cliente.find(r => r.index === item.index);
    const snapshot = await scoped(() => db.withTransaction(async q => {
      await rbac.assertAllowed(ctx, 'Cadastros', 'cliente', 'visualizar', { allowGlobalWildcard: false, executor: q });
      return clienteRepo.getBulkSnapshot(ctx, item.id, q);
    }));
    assert.equal(snapshot.ativo, false); assert.equal(snapshot.status, 'Inativo'); assert.notEqual(snapshot.nome, corrected.payload.nome);
    const source = input.sourceFiles.find(d => d.entity === 'cliente');
    const verifyRow = spawnSync('python3', ['-c', `import csv,json,sys,itertools
with open(sys.argv[1],encoding='utf-8-sig',newline='') as h:
 d=csv.Sniffer().sniff(h.readline(),delimiters=',;\\t|'); h.seek(0)
 r=next(itertools.islice(csv.DictReader(h,delimiter=d.delimiter,quotechar='"',doublequote=True,strict=True),int(sys.argv[2]),None))
 assert None not in r and all(v is not None for v in r.values())
 print(json.dumps(r))`, path.resolve(base, 'recovered', source.relativePath), String(item.index)], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    assert.equal(verifyRow.status, 0); assert.deepEqual(JSON.parse(verifyRow.stdout), input.rows.cliente[item.index]);
    save('inactive-name-plan-private.json', { status: 'PREPARED_NOT_AUTHORIZED_REAL_CORRECTION', realApplied: false,
      sourceIndex: item.index, sourceCodePreserved: snapshot.codigo, beforeName: snapshot.nome,
      command: { mode: 'apply', id: item.id, operationId: crypto.randomUUID(), expectedFingerprint: legacyNameFingerprint(snapshot),
        sourceSystem: snapshot.source_system, legacyCode: snapshot.codigo_legado, batch: snapshot.migration_batch,
        correctedName: corrected.payload.nome, sourceProof: { fileSha256: source.sha256,
          rowSha256: rowHash(input.rows.cliente[item.index]), parser: 'csv-rfc4180-doublequote-v1' } },
      sourceParserVerified: true, preserves: ['id', 'codigo', 'ativo', 'status', 'procedencia', 'vinculos'] });
    const demo = { warning: 'PRIVATE ISOLATED READ ONLY - NOT OPERATIONAL', clientReadPath: 'ClienteService.list(ativo=false)',
      inactiveStandardGet: '404 as contracted', firstPageTotal: first.meta.total, distinctPages: true,
      clients: first.data.slice(0, 2), supplierReadPath: 'FornecedorService.get', suppliers: supplierDemo };
    save('canonical-private-demo.json', demo);
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const table = records => '<table><tr><th>Codigo</th><th>Nome</th><th>Status</th></tr>'
      + records.map(r => `<tr><td>${escape(r.codigo)}</td><td>${escape(r.nome || r.razao_social)}</td><td>${escape(r.status)}</td></tr>`).join('') + '</table>';
    fs.writeFileSync(path.join(root, 'canonical-private-demo.html'), '<!doctype html><meta charset="utf-8"><title>Ensaio privado #344</title>'
      + '<style>body{font:16px sans-serif;margin:24px}table{border-collapse:collapse}td,th{border:1px solid #999;padding:8px;text-align:left}th{background:#def}</style>'
      + '<h1>Ensaio privado #344 - leitura canonica</h1><p>Somente teste isolado. Sem carga operacional. Cadastros revertidos.</p>'
      + '<h2>Clientes: listagem explicita de inativos</h2>' + table(demo.clients)
      + '<h2>Fornecedores: leitura autorizada pelo servico</h2>' + table(supplierDemo), { flag: 'wx', mode: 0o600 });
    const candidate = { status: 'NOT_AUTHORIZED_OPERATIONAL_LOAD', codeBase: pointer.sourceSha,
      coveredFields: Object.fromEntries(['cliente', 'fornecedor'].map(entity => [entity, Object.keys(selection.selected[entity][0].payload)])),
      masterScope: 'GROUP_WITHOUT_GUESSED_COMPANY_LINKS', inactiveClientsPreserved: 987,
      principalReconciliation: json(path.join(old, 'result-sanitized.json')).entities,
      productReleased: products.released.length, addressReady: addresses.ready, realNameCorrectionApplied: false,
      gates: { operationalTargetIdentity: false, targetBackupAndRestore: false, targetSchemaAndMigrationJournals: false,
        leastPrivilegeRbac: false, operationalGroupCompanyCrosswalk: false, destinationDuplicateReconciliation: false,
        productDefinitionsAndUnits: products.pending === 0, addressesAndAuxiliaryCompleteness: addresses.ready === addresses.addresses,
        specificNameCorrectionAuthorization: false, operationalLoadAuthorization: false },
      isolatedReplayAndLogicalReversalPreviouslyProven: true, operationalRollbackProven: false };
    save('operational-candidate-private.json', candidate);
    const result = { sourceSha: pointer.sourceSha, adminSessionReadOnly: true, canonicalReadCallsOnly: true,
      canonicalReadsAcquireLocks: true, canonicalClientPages: 2, canonicalClientTotal: first.meta.total,
      supplierCanonicalReads: supplierDemo.length, inactiveStandardGet404: true, privateDemoPrepared: true,
      productNativeIdentities: products.nativeIdentitiesProven, productClassificationsProven: products.classificationsProven,
      productsReleased: products.released.length,
      productsPending: products.pending, productDecisionRules: products.decisions.length, targetGroupUnitRows: units.length,
      addresses: addresses.addresses, addressReady: addresses.ready, addressMissing: addresses.missingRequired,
      addressConflicting: addresses.conflicting, addressGroups: addresses.groups.length,
      nameCorrectionPrepared: true, realCorrectionApplied: false, operationalLoad: false };
    save('completeness-sanitized.json', result); console.log(JSON.stringify(result));
  } finally {
    if (pool) await pool.end(); if (admin) await admin.end();
    if (started) { run('docker', ['stop', '--time', '20', container]); save('review-cleanup.json', { stopped: true, canonicalReadCallsOnly: true }); }
    fs.unlinkSync(lock);
  }
}
