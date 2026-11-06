import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { assertIsolationDescriptor } from './pilot-isolated.mjs';
import { rowHash, resolveNativeProductRules, isReleasedProductPilotRow } from './pilot-functional-policy.mjs';
import { mapLegadoRowToCanonicalStub } from './mapear-registro-sintetico.mjs';
import { persistirProdutoGrupoLegado } from './consumir-lote-staging.mjs';

/** Auxiliary of the existing isolated executor. No operational URL or migration input. */
export async function runProductPilot({ base, repo, json, run, mod, pause }) {
  process.umask(0o077);
  const pointer = json(path.join(base, 'current-products.json')), root = pointer.root;
  assert.equal(path.dirname(root), base); assert.match(path.basename(root), /^products-344-[a-f0-9]{16}$/);
  const stat = fs.lstatSync(root);
  assert.equal(stat.isSymbolicLink(), false); assert.equal(stat.uid, process.getuid()); assert.equal(stat.mode & 0o777, 0o700);
  assert.equal(run('git', ['branch', '--show-current']), 'codex/consolidacao-infra-20261017');
  const head = run('git', ['rev-parse', 'HEAD']);
  assert.equal(run('git', ['merge-base', pointer.codeBase, head]), pointer.codeBase);
  const old = json(path.join(base, 'current-functional.json')).root;
  assert.equal(path.dirname(old), base); assert.match(path.basename(old), /^functional-344-[a-f0-9]{16}$/);
  assert.equal(fs.existsSync(path.join(old, 'writer.lock')), false);
  const functional = json(path.join(old, 'state-private.json'));
  const lock = path.join(root, 'writer.lock'); fs.writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 });
  const save = (name, value) => {
    fs.writeFileSync(path.join(root, name + '.tmp'), JSON.stringify(value), { mode: 0o600 });
    fs.renameSync(path.join(root, name + '.tmp'), path.join(root, name));
  };
  let admin, pool, container, started = false, role;
  try {
    const files = ['scripts/legado/pilot-functional-products.mjs', 'scripts/legado/consumir-lote-staging.mjs',
      'scripts/legado/pilot-functional-policy.mjs', 'scripts/legado/mapear-registro-sintetico.mjs'];
    const code = Object.fromEntries(files.map(n => [n, rowHash(fs.readFileSync(path.join(repo, n)).toString())]));
    if (fs.existsSync(path.join(root, 'code-pin.json'))) assert.deepEqual(json(path.join(root, 'code-pin.json')), code);
    else save('code-pin.json', code);
    const approvalBytes = fs.readFileSync(path.join(root, 'owner-approval-private.json'));
    assert.equal(crypto.createHash('sha256').update(approvalBytes).digest('hex'), pointer.ownerApprovalSha256);
    const approval = JSON.parse(approvalBytes.toString());
    assert.equal(approval.scope, 'ISOLATED_PRODUCT_PILOT_ONLY'); assert.equal(approval.conversionAuthorized, false);
    assert.equal(approval.mergePieceAndUnit, false); assert.equal(approval.excludeTestUnits, true);
    const input = json(path.join(old, 'input.json')), material = json(path.join(old, 'raw-material-source-private.json'));
    for (const d of [...input.sourceFiles.filter(x => x.entity === 'produto'), material.descriptor]) {
      const name = path.resolve(base, 'recovered', d.relativePath);
      assert.equal(name.startsWith(path.join(base, 'recovered') + '/'), true);
      assert.equal(fs.lstatSync(name).isSymbolicLink(), false);
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex'), d.sha256);
    }
    const previous = json(path.join(base, 'current-pilot.json')).root;
    const proof = json(path.join(previous, 'isolation-private.json')); container = proof.container;
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
      .map(s => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; }));
    const { Pool } = createRequire(path.join(repo, 'server/package.json'))('pg');
    const connection = { host: path.join(previous, 'socket'), database: env.POSTGRES_DB, max: 3, connectionTimeoutMillis: 5000 };
    admin = new Pool({ ...connection, user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD });
    assert.deepEqual((await admin.query(`SELECT current_database() AS database,current_user AS role,inet_server_addr() AS network_address,
      (SELECT system_identifier::text FROM pg_control_system()) AS system_identifier`)).rows[0], proof.identity);
    const policies = (await admin.query("SELECT relname,relrowsecurity FROM pg_class WHERE oid=ANY($1::regclass[])",
      [['produtos', 'unidades_medida', 'profiles', 'audit_logs', 'entity_code_sequences']])).rows;
    assert.equal(policies.length, 5); assert.equal(policies.every(r => r.relrowsecurity === true), true);
    const preserved = async () => rowHash((await admin.query(`SELECT * FROM (
      SELECT 'cliente' AS kind,to_jsonb(c) AS row FROM clientes c
      UNION ALL SELECT 'fornecedor',to_jsonb(f) FROM fornecedores f) preserved ORDER BY kind,row::text`)).rows);
    const before = await preserved();
    if (fs.existsSync(path.join(root, 'preserved-hash.json'))) assert.equal(json(path.join(root, 'preserved-hash.json')).hash, before);
    else save('preserved-hash.json', { hash: before });
    const state = fs.existsSync(path.join(root, 'state-private.json')) ? json(path.join(root, 'state-private.json')) : {
      actorId: crypto.randomUUID(), groupId: functional.groupId, password: crypto.randomBytes(32).toString('hex'),
      sourceSystem: 'LEGADO_ISOLATED_344_PRODUCTS', units: {}, batches: {}, initialized: false };
    assert.equal(state.groupId, functional.groupId); save('state-private.json', state);
    role = 'pilot_prod_' + state.actorId.replaceAll('-', '').slice(0, 12);
    if (!state.initialized) {
      const q = await admin.connect();
      try {
        await q.query('BEGIN');
        await q.query(`INSERT INTO profiles(id,email,full_name,group_id,empresa_id,permissoes,ativo) VALUES($1,$2,$3,$4,NULL,$5::jsonb,true)`,
          [state.actorId, 'products@isolated.invalid', 'SYNTHETIC PRODUCT PILOT', state.groupId,
            JSON.stringify({ Cadastros: { produto: ['visualizar', 'criar', 'importar', 'inativar'],
              unidade_medida: ['visualizar', 'criar', 'inativar'] } })]);
        await q.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${state.password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
        await q.query(`GRANT CONNECT ON DATABASE "${env.POSTGRES_DB}" TO "${role}"; GRANT USAGE ON SCHEMA public TO "${role}";
          GRANT SELECT ON profiles,produtos,unidades_medida,entity_code_sequences,marcas,grupos_produto,setores_atividade TO "${role}";
          GRANT INSERT,UPDATE ON produtos,unidades_medida,entity_code_sequences TO "${role}"; GRANT INSERT ON audit_logs TO "${role}"`);
        const tenant = `group_id='${state.groupId}'::uuid AND group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
          AND NULLIF(current_setting('app.empresa_id',true),'') IS NULL`;
        for (const table of ['produtos', 'unidades_medida', 'entity_code_sequences']) await q.query(`CREATE POLICY ${role} ON ${table}
          FOR ALL TO "${role}" USING(${tenant}) WITH CHECK(${tenant})`);
        await q.query(`CREATE POLICY ${role} ON profiles FOR SELECT TO "${role}" USING(${tenant} AND id='${state.actorId}'::uuid)`);
        await q.query(`CREATE POLICY ${role} ON audit_logs FOR INSERT TO "${role}" WITH CHECK(${tenant} AND actor_id='${state.actorId}'::uuid)`);
        await q.query('COMMIT'); state.initialized = true; save('state-private.json', state);
      } catch (error) { await q.query('ROLLBACK'); throw error; } finally { q.release(); }
    } else await admin.query(`ALTER ROLE "${role}" LOGIN`);
    await admin.query(`GRANT EXECUTE ON FUNCTION reserve_entity_codigo(uuid,text,integer) TO "${role}"`);
    pool = new Pool({ ...connection, user: role, password: state.password });
    assert.equal((await pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows
      .every(r => r.rolsuper === false && r.rolbypassrls === false), true);
    const { createPoolDbClient } = await mod('server/src/db/client.ts');
    const { PostgresRbacGuard } = await mod('server/src/db/rbacGuard.ts');
    const { PostgresAuditRepository } = await mod('server/src/audit/auditRepository.ts');
    const { PostgresTenantGuard } = await mod('server/src/db/tenantGuard.ts');
    const { PostgresUnidadeRepository } = await mod('server/src/repositories/postgresCadastroRepositories.ts');
    const { unidadeCreateSchemaWithCodigo, unidadeUpdateSchema } = await mod('server/src/repositories/cadastroTypes.ts');
    const { TenantCrudService } = await mod('server/src/services/tenantCrudService.ts');
    const { PostgresProdutoRepository } = await mod('server/src/repositories/postgresProdutoRepository.ts');
    const { PostgresProdutoRelationGuard } = await mod('server/src/db/produtoRelationGuard.ts');
    const { ProdutoService } = await mod('server/src/services/produtoService.ts');
    const db = createPoolDbClient(pool), rbac = new PostgresRbacGuard(db), audit = new PostgresAuditRepository(db), tenant = new PostgresTenantGuard(db);
    const unitService = new TenantCrudService(new PostgresUnidadeRepository(db), audit, tenant, {
      entityName: 'UnidadeMedida', notFoundCode: 'UNIDADE_NOT_FOUND', createSchema: unidadeCreateSchemaWithCodigo,
      updateSchema: unidadeUpdateSchema, getEmpresaId: r => r.empresa_id,
      resolveEmpresaIdFromCreate: (r, s) => r.empresa_id ?? s.empresaId, resolveEmpresaIdFromUpdate: (r, b) => r.empresa_id ?? b.empresa_id });
    const product = new ProdutoService(new PostgresProdutoRepository(db), audit, tenant, new PostgresProdutoRelationGuard(db), rbac);
    const ctx = requestId => ({ groupId: state.groupId, empresaId: null, actorId: state.actorId, requestId });
    const scoped = (context, fn) => db.withTenantContext(context, () => db.withTransaction(async q => {
      await rbac.assertAllowed(context, 'Cadastros', 'produto', 'importar', { allowGlobalWildcard: false, executor: q });
      const result = await fn(q);
      await rbac.assertAllowed(context, 'Cadastros', 'produto', 'importar', { allowGlobalWildcard: false, executor: q }); return result;
    }));
    const native = resolveNativeProductRules(input.rows.produto, material.rows, [], { groupId: state.groupId });
    const codes = [...new Set(native.details.filter(x => x.nativeIdentityProven).map(x => x.sourceUnit))];
    const existingUnits = (await admin.query('SELECT * FROM unidades_medida WHERE group_id=$1', [state.groupId])).rows;
    if (existingUnits.some(u => !Object.values(state.units).some(v => v.id === u.id))) throw new Error('UNREVIEWED_UNIT_TARGET_ID');
    for (const code of codes) {
      const meaning = approval.meanings[code]; if (!meaning) throw new Error('OWNER_UNIT_MEANING_REQUIRED');
      const context = ctx('unit-' + code);
      if (!state.units[code]) {
        const created = await scoped(context, async q => {
          await rbac.assertAllowed(context, 'Cadastros', 'unidade_medida', 'criar', { allowGlobalWildcard: false, executor: q });
          return unitService.create(context, { empresa_id: null, sigla: code, nome_completo: meaning.name,
            tipo_grandeza: meaning.dimension, unidade_base_conversao: null, permite_conversao: false });
        });
        state.units[code] = created; save('state-private.json', state);
      }
      const actual = await scoped(context, () => unitService.get(context, state.units[code].id));
      assert.equal(actual.group_id, state.groupId); assert.equal(actual.empresa_id, null); assert.equal(actual.ativo, true);
      assert.equal(actual.nome_completo, meaning.name); assert.equal(actual.permite_conversao, false); assert.equal(actual.unidade_base_conversao, null);
      assert.equal(rowHash(actual), rowHash(state.units[code]));
    }
    assert.notEqual(state.units.PC?.id, state.units.UN?.id);
    const units = Object.values(state.units), unitRows = codes.map(code => ({ source_unit_code: code,
      approved_target_unit_id: state.units[code].id, scope_verified: true, semantic_equivalence_verified: true }));
    const resolution = resolveNativeProductRules(input.rows.produto, material.rows, unitRows, { groupId: state.groupId, units });
    const eligible = resolution.released.filter(r => {
      const raw = input.rows.produto[r.index];
      return isReleasedProductPilotRow(raw);
    });
    const held = resolution.released.filter(r => !eligible.includes(r)).map(r => ({ index: r.index,
      reason: input.rows.produto[r.index].status !== 'Ativo' ? 'SOURCE_NOT_ACTIVE_PRESERVED' : 'SOURCE_QUARANTINE_PRESERVED' }));
    save('map-private.json', { ownerApproval: approval, nativeResolution: resolution, units, unitRows, held, conversionExecuted: false });
    const map = {};
    for (const r of resolution.released) {
      const key = r.sourceClass.trim() + '|' + r.sourceUnit;
      const value = { tipo_item: r.tipo_item, unidade_medida_id: r.unidade_medida_id };
      if (map[key]) assert.deepEqual(map[key], value); map[key] = value;
    }
    const log = path.join(root, 'journal-private.ndjson');
    const events = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
    const loaded = new Map(events.filter(e => e.phase === 'load').map(e => [e.index, e]));
    const replayed = new Set(events.filter(e => e.phase === 'replay').map(e => e.index));
    const reversed = new Set(events.filter(e => e.phase === 'reverse').map(e => e.index));
    const rejected = new Set(events.filter(e => e.phase === 'reject').map(e => e.index));
    const append = e => fs.appendFileSync(log, JSON.stringify(e) + '\n', { mode: 0o600 });
    const batchFor = position => {
      const key = Math.floor(position / 250); if (!state.batches[key]) { state.batches[key] = crypto.randomUUID(); save('state-private.json', state); }
      return state.batches[key];
    };
    const load = (r, batch) => {
      const raw = input.rows.produto[r.index], context = ctx(batch);
      const mapped = mapLegadoRowToCanonicalStub({ cod_produto: r.sourceCode, descricao: raw.descricao,
        classe: r.sourceClass.trim(), unidade: r.sourceUnit }, { groupId: state.groupId, entidade: 'produto', produtoClassUnitMap: map });
      const adapter = { findByLegacyIdentity: product.findByLegacyIdentity.bind(product),
        create: (scope, payload) => product.create(scope, { ...payload, grupo_legado: mapped.classe_legado }) };
      return scoped(context, async () => {
        const result = await persistirProdutoGrupoLegado(context, mapped,
          { service: adapter, unidadeService: unitService, rbacGuard: rbac, sourceSystem: state.sourceSystem, batch, produtoClassUnitMap: map });
        assert.equal(result.registro.grupo_legado, mapped.classe_legado);
        assert.deepEqual(result.registro.fatores_conversao, {}); assert.deepEqual(result.registro.unidades_secundarias, []);
        return result;
      });
    };
    for (const [position, r] of eligible.entries()) {
      if (loaded.has(r.index) || rejected.has(r.index)) continue;
      const batch = batchFor(position);
      try { const result = await load(r, batch), e = { phase: 'load', index: r.index, batch, record: result.registro, reused: result.reutilizado };
        append(e); loaded.set(r.index, e);
      } catch (error) {
        if (!['VALIDATION_ERROR', 'CONFLICT', 'LEGACY_RECONCILIATION_REQUIRED'].includes(error.code)) throw error;
        append({ phase: 'reject', index: r.index, reason: error.code }); rejected.add(r.index);
      }
    }
    for (const r of eligible) {
      const oldRow = loaded.get(r.index); if (!oldRow || replayed.has(r.index) || reversed.has(r.index)) continue;
      const again = await load(r, oldRow.batch); assert.equal(again.reutilizado, true); assert.equal(rowHash(again.registro), rowHash(oldRow.record));
      append({ phase: 'replay', index: r.index }); replayed.add(r.index);
    }
    for (const e of loaded.values()) {
      if (reversed.has(e.index)) continue;
      const context = ctx(e.batch);
      await scoped(context, async q => {
        const current = await new PostgresProdutoRepository(db).getById(context, e.record.id, q, { forUpdate: true });
        assert.equal(rowHash(current), rowHash(e.record));
        const after = await product.softDelete(context, e.record.id);
        assert.equal(after.ativo, false);
        for (const key of Object.keys(e.record).filter(k => !['ativo', 'updated_at'].includes(k))) assert.equal(rowHash(after[key]), rowHash(e.record[key]));
      });
      append({ phase: 'reverse', index: e.index }); reversed.add(e.index);
    }
    const count = (await admin.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE ativo)::int AS active,
      count(DISTINCT (source_system,codigo_legado))::int AS origins FROM produtos WHERE group_id=$1 AND source_system=$2`,
    [state.groupId, state.sourceSystem])).rows[0];
    assert.equal(count.total, loaded.size); assert.equal(count.origins, loaded.size); assert.equal(count.active, 0);
    assert.equal(await preserved(), before);
    const result = { source: input.rows.produto.length, nativeProven: resolution.nativeIdentitiesProven,
      released: eligible.length, processed: loaded.size + rejected.size, written: [...loaded.values()].filter(e => !e.reused).length,
      reused: [...loaded.values()].filter(e => e.reused).length, rejected: rejected.size, pending: resolution.pending + held.length,
      inactiveOrQuarantinedPreserved: held.length,
      reconciled: loaded.size, replayReused: replayed.size, replayNew: 0, reversed: reversed.size, activeRemaining: count.active,
      canonicalUnits: units.length, pcAndUnDistinct: true, sourcePreserved: true, conversionsExecuted: 0,
      unitConversionDisabled: units.every(u => u.permite_conversao === false && u.unidade_base_conversao == null),
      stockOrFinancialWrites: 0, operationalLoad: false, executionHead: head };
    save('result-sanitized.json', result); console.log(JSON.stringify(result));
  } catch (error) {
    save('failure-private.json', { code: error.code, message: error.message, stack: error.stack });
    throw new Error('PRODUCT_PILOT_FAILED_PRIVATE_RECEIPT');
  } finally {
    if (pool) await pool.end();
    try {
      if (admin) {
        try { if (role && (await admin.query('SELECT to_regrole($1) AS role', [role])).rows[0].role) await admin.query(`ALTER ROLE "${role}" NOLOGIN`); }
        finally { await admin.end(); }
      }
    } finally {
      try { if (started) { run('docker', ['stop', '--time', '20', container]); save('cleanup-private.json', { stopped: true, databasePreserved: true }); } }
      finally { fs.unlinkSync(lock); }
    }
  }
}
