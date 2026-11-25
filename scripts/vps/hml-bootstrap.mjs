import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha = /^[a-f0-9]{40}$/;

// Offline comparison extracted from the private HML contract review, not a DB permission or DDL executor.
const clienteSourcePins = {
  contactsNullCas: '3645227e5e622dfb1ee432157175ff41c0f18105b8b6720f8cbeeb40fc95320a',
  legacyIdentity: '7ad80cecfdd1eed9b75fb478a0910f65cb57d13bd07e94abd75cd724405ae272',
};
const contactsCheck = "CHECK (((contatos IS NULL) OR CASE WHEN (jsonb_typeof(contatos) = 'array'::text) THEN (jsonb_array_length(contatos) <= 200) ELSE false END))";
const normalizeCatalog = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
const exactKeys = (value, keys) => assert.ok(value && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys.slice().sort()), 'HML_CLIENTE_METADATA_INVALID');

export function reviewHmlClienteContracts(snapshot, canonicalSources) {
  exactKeys(canonicalSources, ['contactsNullCas', 'legacyIdentity']);
  for (const [key, expected] of Object.entries(clienteSourcePins)) {
    assert.equal(typeof canonicalSources[key], 'string', 'HML_CANONICAL_SOURCE_REQUIRED');
    assert.equal(createHash('sha256').update(canonicalSources[key].replace(/\r\n/g, '\n')).digest('hex'), expected, 'HML_CANONICAL_SOURCE_CHANGED');
  }
  exactKeys(snapshot, ['kind', 'schema', 'observedAt', 'receiptSha256', 'column', 'contactsConstraint', 'legacyIndex']);
  assert.equal(snapshot.kind, 'HML_CLIENTE_CONTRACT_METADATA');
  assert.ok(snapshot.schema === null || /^hml[0-9a-z_]+$/.test(snapshot.schema), 'HML_CLIENTE_SCOPE_INVALID');
  assert.ok(snapshot.observedAt === null || (typeof snapshot.observedAt === 'string' && /Z$/.test(snapshot.observedAt) && Number.isFinite(Date.parse(snapshot.observedAt))), 'HML_METADATA_TIME_INVALID');
  assert.ok(snapshot.receiptSha256 === null || /^[a-f0-9]{64}$/.test(snapshot.receiptSha256), 'HML_METADATA_RECEIPT_INVALID');
  let column = 'UNVERIFIED';
  if (snapshot.column !== null) {
    exactKeys(snapshot.column, ['type', 'nullable', 'default']);
    assert.equal(typeof snapshot.column.nullable, 'boolean');
    assert.ok(typeof snapshot.column.type === 'string' && (snapshot.column.default === null || typeof snapshot.column.default === 'string'), 'HML_COLUMN_INVALID');
    column = snapshot.column.type !== 'jsonb' ? 'BLOCKED_TYPE'
      : snapshot.column.nullable && snapshot.column.default === null ? 'MATCHES_CURRENT_NULL_CAS' : 'REVIEW_EXISTING_NULL_CAS_CANDIDATE';
  }
  const scope = object => snapshot.schema !== null && object.schema === snapshot.schema && object.table === 'clientes';
  let contactsConstraint = 'UNVERIFIED';
  if (snapshot.contactsConstraint !== null) {
    const object = snapshot.contactsConstraint;
    exactKeys(object, ['schema', 'table', 'name', 'validated', 'definition']);
    assert.equal(typeof object.validated, 'boolean');
    contactsConstraint = !scope(object) ? 'BLOCKED_SCOPE' : object.name !== 'clientes_contatos_array_limit' ? 'BLOCKED_NAME'
      : !object.validated ? 'BLOCKED_UNVALIDATED'
        : normalizeCatalog(object.definition) === contactsCheck ? 'MATCHES_CANONICAL_DEFINITION' : 'BLOCKED_DEFINITION';
  }
  let legacyIndex = 'UNVERIFIED';
  if (snapshot.legacyIndex !== null) {
    const object = snapshot.legacyIndex;
    exactKeys(object, ['schema', 'table', 'name', 'unique', 'valid', 'ready', 'definition']);
    for (const key of ['unique', 'valid', 'ready']) assert.equal(typeof object[key], 'boolean');
    const expected = `CREATE UNIQUE INDEX clientes_legacy_identity_uidx ON ${snapshot.schema}.clientes USING btree (group_id, source_system, codigo_legado) WHERE ((source_system IS NOT NULL) AND (codigo_legado IS NOT NULL))`;
    legacyIndex = !scope(object) ? 'BLOCKED_SCOPE' : object.name !== 'clientes_legacy_identity_uidx' ? 'BLOCKED_NAME'
      : !object.unique || !object.valid || !object.ready ? 'BLOCKED_INDEX_STATE'
        : normalizeCatalog(object.definition) === expected ? 'MATCHES_CANONICAL_DEFINITION' : 'BLOCKED_DEFINITION';
  }
  return {
    kind: 'PREPARATION_ONLY_HML_CLIENTE_CONTRACT_REVIEW', contract: 'CURRENT_NULL_CAS_200_AND_GROUP_LEGACY_IDENTITY',
    sourcesVerified: true, column, contactsConstraint, legacyIndex,
    columnAction: column === 'MATCHES_CURRENT_NULL_CAS' ? 'PRESERVE_NO_COLUMN_CHANGE_JUSTIFIED' : 'REVIEW_CANONICAL_CONTACTS_PATH',
    evidencePresent: { schema: snapshot.schema !== null, time: snapshot.observedAt !== null, receipt: snapshot.receiptSha256 !== null },
    forbiddenInferredActions: ['SET_NOT_NULL', 'SET_DEFAULT_EMPTY_ARRAY', 'BACKFILL_NULL_TO_EMPTY_ARRAY', 'RECREATE_INDEX_BY_NAME'],
    canApply: false, targetAttested: false, businessRowsRead: 0, ddlExecuted: false,
  };
}

function reviewClienteMetadataFile(file) {
  assert.ok(typeof file === 'string' && path.isAbsolute(file), 'PRIVATE_METADATA_PATH_REQUIRED');
  const stat = fs.lstatSync(file);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 256 * 1024, 'HML_METADATA_FILE_INVALID');
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
  const canonicalSources = Object.fromEntries([
    ['contactsNullCas', 'cliente_contatos_null_cas.sql'], ['legacyIdentity', 'cliente_legacy_identity.sql'],
  ].map(([key, name]) => [key, fs.readFileSync(new URL(`../../server/schema-candidates/${name}`, import.meta.url), 'utf8')]));
  return reviewHmlClienteContracts(snapshot, canonicalSources);
}

// Ported tokenizer from the existing private object-delta preparation; never execute its generator.
function splitOverlaySql(sql) {
  const result = [];
  let buffer = '', quote = null, dollar = null, lineComment = false, blockDepth = 0;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i], next = sql[i + 1];
    if (lineComment) {
      if (char === '\n') { lineComment = false; buffer += '\n'; }
      continue;
    }
    if (blockDepth) {
      if (char === '/' && next === '*') { blockDepth++; i++; }
      else if (char === '*' && next === '/') { blockDepth--; i++; }
      continue;
    }
    if (dollar) {
      if (sql.startsWith(dollar, i)) { buffer += dollar; i += dollar.length - 1; dollar = null; }
      else buffer += char;
      continue;
    }
    if (quote) {
      buffer += char;
      if (char === quote) {
        if (next === quote) { buffer += next; i++; }
        else quote = null;
      }
      continue;
    }
    if (char === '-' && next === '-') { lineComment = true; i++; continue; }
    if (char === '/' && next === '*') { blockDepth = 1; i++; continue; }
    if (char === "'" || char === '"') { quote = char; buffer += char; continue; }
    if (char === '$') {
      const tag = sql.slice(i).match(/^\$[A-Za-z_0-9]*\$/);
      if (tag) { dollar = tag[0]; buffer += dollar; i += dollar.length - 1; continue; }
    }
    if (char === ';') {
      if (buffer.trim()) result.push(buffer.trim() + ';');
      buffer = '';
    } else buffer += char;
  }
  assert.ok(!quote && !dollar && !blockDepth, 'HML_OVERLAY_UNCLOSED_SQL');
  if (buffer.trim()) result.push(buffer.trim());
  return result;
}

const overlayMatrixPin = '0e32130faf5f87e66c1022d9bd1dd57806678d856f5caf0a579de5f62498ff45';
const overlayHash = value => createHash('sha256').update(value).digest('hex');
function checkOverlayMatrix(matrix) {
  assert.equal(overlayHash(JSON.stringify({ sources: matrix.sources, objects: matrix.objects, emitted: matrix.emitted })), overlayMatrixPin, 'HML_OVERLAY_MATRIX_CHANGED');
  assert.ok(matrix.canApply === false && matrix.completeMigration === false && matrix.preserveExistingEight === true, 'HML_OVERLAY_NOT_EXECUTABLE');
}

// Historical DEFER status and a source reference are not per-statement approval or target evidence.
export function reviewHmlOverlayObjects(matrix, canonicalSources) {
  checkOverlayMatrix(matrix);
  exactKeys(canonicalSources, matrix.sources.map(pin => pin.path));
  const statements = {};
  for (const pin of matrix.sources) {
    const sql = canonicalSources[pin.path];
    assert.equal(typeof sql, 'string', 'HML_OVERLAY_SOURCE_REQUIRED');
    const normalized = sql.replace(/\r\n/g, '\n');
    assert.equal(overlayHash(normalized), pin.sha256, 'HML_OVERLAY_SOURCE_CHANGED');
    statements[pin.path.split('/').at(-1)] = splitOverlaySql(normalized);
  }
  const references = source => Object.entries(matrix.relationReviews || {}).flatMap(([relation, review]) =>
    (review.sourcePins || []).some(pin => pin.path === `server/migrations/${source}` && matrix.sources.some(p => p.path === pin.path && p.sha256 === pin.sha256))
      ? [{ relation, reviewHead: review.reviewHead, evidence: 'SOURCE_REFERENCE_ONLY' }] : []);
  const preserved = new Set(['cliente_empresas','cliente_locais','clientes','condicoes_pagamento','empresas','groups','marcas','profiles']);
  const objects = [];
  for (const object of matrix.objects) {
    const sql = statements[object.source]?.[object.statement];
    assert.equal(typeof sql, 'string', 'HML_OVERLAY_STATEMENT_REQUIRED');
    assert.equal(overlayHash(sql), object.sha256, 'HML_OVERLAY_STATEMENT_CHANGED');
    if (object.status !== 'DEFER_REVIEW_KEEP_EXISTING') continue;
    let action = 'REVIEW_CANONICAL_RESTORE_PREREQUISITES';
    if (/^(UPDATE|INSERT|DELETE|TRUNCATE)\b/i.test(sql) || (/^WITH\b/i.test(sql) && /\b(UPDATE|INSERT|DELETE)\s+/i.test(sql))) {
      action = 'HISTORICAL_DATA_WRITE_REQUIRES_SEPARATE_GATE';
    } else if (/^COMMENT\b/i.test(sql)) {
      action = 'METADATA_ONLY_NOT_FUNCTIONAL_PROOF';
    } else if (preserved.has(object.table)) {
      action = 'PRESERVE_EXISTING_REQUIRES_RESTORED_DIFF';
    } else if (/^(DROP|REVOKE|GRANT)\b/i.test(sql) || object.kind === 'ALTER_TABLE') {
      action = 'REVIEW_DEFINITION_AND_LEAST_PRIVILEGE_NO_AUTOMATIC_CHANGE';
    } else if (object.kind === 'CONDITIONAL_REVIEW') {
      action = 'KEEP_ORIGINAL_GUARDS_TARGET_EVIDENCE_REQUIRED';
    }
    objects.push({ source: object.source, statement: object.statement, sha256: object.sha256,
      kind: object.kind, table: object.table, name: object.name, historicalStatus: object.status,
      action, sourceReviewReferences: references(object.source), perStatementAcceptanceProven: false, canApply: false });
  }
  return { kind: 'PREPARATION_ONLY_HML_OVERLAY_REVIEW', originalObjects: matrix.objects.length,
    originalEmitted: matrix.emitted.length, sourcesVerified: matrix.sources.length, objects,
    actionCounts: Object.fromEntries([...new Set(objects.map(x => x.action))].map(action => [action, objects.filter(x => x.action === action).length])),
    completeMigration: false, canApply: false, targetAttested: false, businessRowsRead: 0, ddlExecuted: false };
}

function reviewOverlayRepository() {
  const matrix = JSON.parse(fs.readFileSync(new URL('../../docs/evidence/hml-object-review-matrix-20261114.json', import.meta.url), 'utf8'));
  checkOverlayMatrix(matrix);
  const sources = Object.fromEntries(matrix.sources.map(pin => [pin.path, fs.readFileSync(new URL(`../../${pin.path}`, import.meta.url), 'utf8')]));
  return reviewHmlOverlayObjects(matrix, sources);
}

// Portable form of the recovered private HML bootstrap; app/Auth/DB remain canonical.
export function validateHmlConfig(value, now = Date.now()) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).filter(key => key !== 'a1VaultConfigFile' && key !== 'enablePedidoFinanceiro').sort(), ['databaseUrl', 'expected', 'origin', 'provider', 'sha']);
  if (Object.hasOwn(value, 'enablePedidoFinanceiro')) {
    assert.equal(typeof value.enablePedidoFinanceiro, 'boolean');
  }
  if (value.a1VaultConfigFile !== undefined) {
    assert.equal(typeof value.a1VaultConfigFile, 'string');
    assert.match(value.a1VaultConfigFile, /^\/run\/a1-config\/[a-zA-Z0-9_-]+\.json$/);
  }
  assert.match(value.sha, sha);
  const origin = new URL(value.origin);
  assert.equal(origin.protocol, 'https:');
  assert.equal(origin.origin, value.origin);
  const url = new URL(value.databaseUrl);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.ok(url.username && url.password);
  assert.equal(url.hostname, 'localhost');
  assert.equal(url.port, '');
  assert.equal(url.hash, '');
  const parameters = [...url.searchParams.keys()];
  assert.deepEqual(parameters.sort(), ['host', 'options']);
  assert.equal(url.searchParams.get('host'), '/run/hml-pg');
  const expected = value.expected;
  assert.deepEqual(Object.keys(expected).sort(), ['authUserId', 'clusterIdentifier', 'database',
    'groupId', 'profileId', 'role', 'schema', 'schemaOid']);
  assert.match(expected.database, /^hml[0-9a-z_]+$/);
  assert.match(expected.schema, /^hml[0-9a-z_]+$/);
  assert.equal(decodeURIComponent(url.pathname.slice(1)), expected.database);
  assert.equal(decodeURIComponent(url.username), expected.role);
  assert.match(expected.clusterIdentifier, /^[0-9]+$/);
  assert.match(expected.schemaOid, /^[0-9]+$/);
  for (const key of ['profileId', 'authUserId', 'groupId']) assert.match(expected[key], uuid);
  assert.equal(url.searchParams.get('options'),
    `-c search_path=${expected.schema},pg_catalog,pg_temp -c statement_timeout=5000 -c idle_in_transaction_session_timeout=5000`);
  assert.deepEqual(Object.keys(value.provider).sort(), ['SUPABASE_ANON_KEY', 'SUPABASE_URL']);
  const provider = new URL(value.provider.SUPABASE_URL);
  assert.equal(provider.protocol, 'https:');
  assert.equal(provider.origin, value.provider.SUPABASE_URL);
  const token = JSON.parse(Buffer.from(value.provider.SUPABASE_ANON_KEY.split('.')[1], 'base64url').toString());
  assert.equal(token.role, 'anon');
  assert.ok(Number.isSafeInteger(token.exp) && token.exp * 1000 > now);
  return value;
}

export function readHmlConfig(file, io = fs, uid = process.getuid?.()) {
  assert.ok(Number.isInteger(uid), 'PRIVATE_CONFIG_OWNER_REQUIRED');
  const stat = io.lstatSync(file);
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(stat.uid, uid);
  assert.equal(stat.mode & 0o077, 0);
  assert.equal(io.realpathSync(file), file);
  return validateHmlConfig(JSON.parse(io.readFileSync(file, 'utf8')));
}

export function hmlAuthFetch(provider, originalFetch) {
  const origin = new URL(provider.SUPABASE_URL).origin;
  return (input, init = {}) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input));
    const method = String(init.method || request?.method || 'GET').toUpperCase();
    const allowed = (url.pathname === '/auth/v1/user' && method === 'GET')
      || (url.pathname === '/auth/v1/token' && method === 'POST');
    if (url.origin !== origin || url.username || url.password || !allowed) {
      throw new Error('HML_EXTERNAL_EFFECT_BLOCKED');
    }
    return originalFetch(input, { ...init, redirect: 'error' });
  };
}

export async function preflightHml(db, expected) {
  return db.withTransaction(async q => {
    await q.query('SET TRANSACTION READ ONLY');
    const physical = (await q.query(`SELECT current_database() AS database,current_schema() AS schema,
      current_schema()::regnamespace::oid::text AS schema_oid,current_user AS role,session_user AS login,
      (SELECT system_identifier::text FROM pg_control_system()) AS cluster,
      r.rolsuper,r.rolbypassrls,s.rolsuper AS login_super,s.rolbypassrls AS login_bypass,
      (SELECT count(*)::int FROM pg_roles p WHERE (p.rolsuper OR p.rolbypassrls)
        AND pg_has_role(session_user,p.oid,'MEMBER')) AS dangerous_memberships
      FROM pg_roles r JOIN pg_roles s ON s.rolname=session_user WHERE r.rolname=current_user`)).rows[0];
    assert.ok(physical);
    for (const [actual, key] of [['database', 'database'], ['schema', 'schema'], ['schema_oid', 'schemaOid'],
      ['role', 'role'], ['login', 'role'], ['cluster', 'clusterIdentifier']]) {
      assert.equal(physical[actual], expected[key], 'HML_PHYSICAL_TARGET_MISMATCH');
    }
    for (const key of ['rolsuper', 'rolbypassrls', 'login_super', 'login_bypass']) assert.equal(physical[key], false);
    assert.equal(physical.dangerous_memberships, 0);
    await q.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id','',true)", [expected.groupId]);
    const profile = (await q.query(`SELECT id,auth_user_id,group_id,empresa_id,ativo FROM profiles
      WHERE id=$1 AND group_id=$2`, [expected.profileId, expected.groupId])).rows[0];
    assert.ok(profile && profile.ativo === true && profile.empresa_id === null, 'HML_PROFILE_INVALID');
    assert.equal(profile.id, expected.profileId);
    assert.equal(profile.auth_user_id, expected.authUserId);
    assert.equal(profile.group_id, expected.groupId);
    return { database: physical.database, schema: physical.schema, role: physical.role,
      schemaOid: physical.schema_oid, clusterIdentifier: physical.cluster };
  });
}

export async function startHml(file, apiRoot) {
  const source = readHmlConfig(file);
  const { loadConfig } = await import(pathToFileURL(path.join(apiRoot, 'dist/config/env.js')));
  const { createRuntimeDbClients } = await import(pathToFileURL(path.join(apiRoot, 'dist/db/client.js')));
  const { createApp } = await import(pathToFileURL(path.join(apiRoot, 'dist/app.js')));
  const config = loadConfig({ NODE_ENV: 'production', ERP_ENV: 'hml', ERP_AUTH_MODE: 'supabase_user',
    REQUIRE_DATABASE: 'true', ENABLE_TENANT_CONTEXT: 'true', DATABASE_URL: source.databaseUrl,
    AUTH_DATABASE_URL: source.databaseUrl, ...source.provider, APP_VERSION: source.sha, CORS_ORIGINS: source.origin,
    ENABLE_PEDIDO_FINANCEIRO_HML: String(source.enablePedidoFinanceiro === true) });
  const clients = await createRuntimeDbClients(config);
  const originalFetch = globalThis.fetch;
  try {
    assert.equal(clients.db, clients.authDb);
    await preflightHml(clients.db, source.expected);
    const authFetch = hmlAuthFetch(source.provider, originalFetch);
    globalThis.fetch = authFetch;
    const { createConfiguredA1Vault } = await import(pathToFileURL(path.join(apiRoot, 'dist/services/a1VaultConfiguration.js')));
    const a1VaultService = await createConfiguredA1Vault(clients.db, source.a1VaultConfigFile);
    const { app } = createApp({ config, db: clients.db, authDb: clients.authDb,
      tenantContextEnabled: true, authFetchImpl: authFetch, a1VaultService,
      pedidoFinanceiroEnabled: config.pedidoFinanceiroEnabled });
    const server = app.listen(config.port, '0.0.0.0');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      await new Promise(resolve => server.close(resolve));
      await clients.end();
    };
    process.once('SIGTERM', () => void close());
    process.once('SIGINT', () => void close());
    console.log(JSON.stringify({ event: 'HML_CANONICAL_API_READY', sha: source.sha,
      auth: 'supabase_user', physicalVerified: true, externalEffects: false }));
    return { close, server };
  } catch (error) {
    globalThis.fetch = originalFetch;
    await clients.end();
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--review-overlay') {
    try {
      assert.equal(process.argv.length, 3);
      console.log(JSON.stringify(reviewOverlayRepository()));
    } catch {
      console.error('HML_OVERLAY_REVIEW_FAILED');
      process.exitCode = 1;
    }
  } else if (process.argv[2] === '--review-cliente-contracts') {
    try {
      assert.equal(process.argv.length, 4);
      console.log(JSON.stringify(reviewClienteMetadataFile(process.argv[3])));
    } catch {
      console.error('HML_CLIENTE_CONTRACT_REVIEW_FAILED');
      process.exitCode = 1;
    }
  } else {
    startHml(process.argv[2], process.argv[3]).catch(() => {
      console.error('HML_STARTUP_PREFLIGHT_FAILED');
      process.exitCode = 1;
    });
  }
}
