import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {runLocalBackupRestorePipeline} from '../src/api/localBackupRestorePipeline.js';
import {applyBackupOnCreate, buildBackupEntitySnapshot, buildBackupResumo, assertBackupRestore, isStatusBackupConcluido} from '../src/components/lib/viradaProducaoPolicy.js';
import {backupCapabilityFile as file, backupCapabilityHunks as hunks, backupCapabilityRemainder as remainder} from './helpers/backupCapabilityRemainder.js';

const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const previous = remainder(file, source);
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
function command(text = source) {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX); let found;
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === 'restaurarMutation') { assert.ok(found === undefined); found = n.initializer.arguments[0].properties.find(p => p.name?.getText(ast) === 'mutationFn').initializer; }
    ts.forEachChild(n, visit);
  }
  visit(ast); assert.ok(found); return {ast, fn: found};
}
function bind(deps, text = source) {
  const {ast, fn} = command(text);
  return new Function(...Object.keys(deps), `return (${fn.getText(ast)});`)(...Object.values(deps));
}
function environment({api, context = true, allowed = true, auditFailure = false} = {}) {
  const calls = [], audits = [], notices = [];
  const service = api === undefined ? {async restore(id, options) { assert.equal(this, service); calls.push([id, options]); return {backup: {id}, summary: {Synthetic: {created: 1}}}; }} : api;
  const deps = {base44: {entities: {BackupAutomatico: service}}, contextoValido: context, canRestaurar: allowed,
    isStatusBackupConcluido, grupoAtivoId: 'synthetic-group', empresaAtivaId: 'synthetic-a',
    toast: {success: (...args) => notices.push(args)},
    auditBackup: async row => { audits.push(row); if (auditFailure) throw Error('synthetic audit failure'); },
  };
  return {deps, calls, audits, notices, run: bind(deps)};
}
const backup = {id: 'synthetic-backup', status: 'Concluido', numero_backup: 'SYNTHETIC'};

test('whole stage72 backup source retained outside exactly four capability/receipt/type hunks', () => {
  assert.equal(digest(previous), 'a532b5f8fed213b93176620436c5bcdf2544f29e838b268caefd06faad595731');
  for (const [after, before] of hunks) {
    assert.throws(() => remainder(file, source.replace(after, before)));
    assert.throws(() => remainder(file, source.replace(after, after + after)));
  }
  assert.notEqual(digest(remainder(file, '// unintended\n' + source)), digest(previous));
});
test('capability is an existing local factory method delegating to the existing backup-only pipeline, not an invented endpoint', () => {
  const local = fs.readFileSync('src/api/localBase44Client.js', 'utf8');
  const ast = ts.createSourceFile('local.js', local, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS); let factory;
  function visit(n) { if (ts.isVariableDeclaration(n) && n.name.getText(ast) === 'createEntityApi') { assert.ok(factory === undefined); factory = n.initializer; } ts.forEachChild(n, visit); }
  visit(ast); assert.ok(factory);
  const object = factory.body.expression || factory.body;
  const restore = object.properties.find(p => p.name?.getText(ast) === 'restore'); assert.ok(restore);
  assert.ok(restore.getText(ast).includes('runLocalBackupRestorePipeline({'));
  assert.ok(!source.includes('fetch('));
  assert.doesNotMatch(command().fn.getText(command().ast), /['"]\/api\//);
});
test('counterproof: absent SDK capability used to throw a TypeError; now fails explicitly before announcing start', async () => {
  const h = environment({api: {}});
  await assert.rejects(bind(h.deps, previous)(backup), TypeError);
  assert.equal(h.notices.length, 1); h.notices.length = 0;
  await assert.rejects(h.run(backup), /Restauracao indisponivel neste backend/);
  assert.equal(h.notices.length, 0); assert.equal(h.calls.length, 0);
  assert.equal(h.audits.at(-1).motivo, 'backend_sem_restauracao'); assert.equal(h.audits.at(-1).sucesso, false);
});
test('absent, null and noncallable capabilities are denied without calling provider', async () => {
  for (const api of [null, {}, {restore: false}, {restore: 'synthetic'}, {restore: {}}]) {
    const h = environment({api}); await assert.rejects(h.run(backup), /indisponivel/);
    assert.deepEqual(h.calls, []); assert.deepEqual(h.notices, []);
    assert.equal(h.audits[0].registroId, backup.id);
  }
});
test('existing context, permission and status gates still precede capability and restoration', async () => {
  for (const options of [{context: false}, {allowed: false}]) {
    const h = environment(options); await assert.rejects(h.run(backup)); assert.deepEqual(h.calls, []); assert.deepEqual(h.notices, []);
    if (options.allowed === false) assert.equal(h.audits[0].motivo, 'permissao_negada');
  }
  for (const status of ['Pendente', 'Falhou', undefined]) {
    const h = environment(); await assert.rejects(h.run({...backup, status}), /concluido/); assert.deepEqual(h.calls, []);
  }
});
test('malformed identities are blocked without coercing an object or calling provider', async () => {
  for (const id of [null, undefined, '', ' ', true, {}, [], NaN, Infinity]) {
    const h = environment(); await assert.rejects(h.run({...backup, id}), /Identidade/); assert.deepEqual(h.calls, []); assert.deepEqual(h.notices, []);
  }
});
test('valid string and finite numeric identities preserve method receiver, explicit scope and success audit', async () => {
  for (const id of ['synthetic-backup', 0, 12]) {
    const h = environment(), result = await h.run({...backup, id});
    assert.deepEqual(h.calls, [[id, {group_id: 'synthetic-group', empresa_id: 'synthetic-a'}]]);
    assert.equal(result.backup.id, id); assert.equal(h.audits.length, 1); assert.equal(h.audits[0].acao, 'Backup.restaurar');
    assert.equal(h.audits[0].detalhes.summary, result.summary); assert.equal(h.audits[0].registroId, id);
  }
});
test('counterproof: previous consumer accepted missing receipt; now rejects without success audit and warns against blind retry', async () => {
  const api = {restore: async () => undefined}, h = environment({api});
  assert.equal(await bind(h.deps, previous)(backup), undefined); assert.equal(h.audits.at(-1).acao, 'Backup.restaurar');
  h.audits.length = 0;
  await assert.rejects(h.run(backup), /verifique o resultado antes de repetir/);
  assert.deepEqual(h.audits.map(row => row.acao), ['Backup.restaurar_recibo_invalido']);
});
test('malformed, mismatched and opaque receipts are denied after delegation, never audited as success', async () => {
  for (const value of [null, false, [], 'synthetic', {}, {backup: null, summary: {}}, {backup: [], summary: {}},
    {backup: {id: 'synthetic-other'}, summary: {}}, {backup: {id: backup.id}}, {backup: {id: backup.id}, summary: []}, {backup: {id: backup.id}, summary: 'opaque'}]) {
    let count = 0; const h = environment({api: {restore: async () => { count++; return value; }}});
    await assert.rejects(h.run(backup), /Recibo/); assert.equal(count, 1);
    assert.equal(h.audits.length, 1); assert.equal(h.audits[0].sucesso, false);
    assert.ok(!h.audits.some(row => row.acao === 'Backup.restaurar'));
  }
});
test('provider and audit failures propagate, do not trigger a retry or claim transaction rollback', async () => {
  let count = 0;
  const h = environment({api: {restore: async () => { count++; throw Error('synthetic restore failure'); }}});
  await assert.rejects(h.run(backup), /synthetic restore failure/); assert.equal(count, 1); assert.deepEqual(h.audits, []);
  const failedAudit = environment({auditFailure: true});
  await assert.rejects(failedAudit.run(backup), /synthetic audit failure/); assert.equal(failedAudit.calls.length, 1);
  const unavailable = environment({api: {}, auditFailure: true});
  await assert.rejects(unavailable.run(backup), /synthetic audit failure/); assert.deepEqual(unavailable.calls, []);
});

function pipelineHarness({group = 'synthetic-group', company = 'synthetic-a', deny = false} = {}) {
  const snapshot = buildBackupEntitySnapshot({Cliente: [{id: 'synthetic-client', group_id: 'synthetic-group', empresa_id: 'synthetic-a'}]}, {groupId: 'synthetic-group', empresaId: 'synthetic-a'});
  const stored = applyBackupOnCreate({record: {...backup, group_id: 'synthetic-group', empresa_id: 'synthetic-a'}, records: [], resumo: buildBackupResumo(snapshot.entities), snapshotDados: snapshot});
  const db = {BackupAutomatico: [stored]}, trace = [];
  const h = environment({api: {async restore(id, options) {
    return runLocalBackupRestorePipeline({entityName: 'BackupAutomatico', id, options, dependencies: {
      assertPermissionAny: () => { trace.push('permission'); if (deny) throw Error('synthetic service denial'); },
      loadDb: () => db, getStore: (data, name) => data[name],
      getCurrentContext: () => ({groupId: group, empresaId: company, user: {id: 'synthetic-user'}}),
      assertBackupRestore,
      backupCountEntities: ['Cliente'], mergeSnapshotRecords: (data, name, rows) => { trace.push('merge'); data[name] = structuredClone(rows); return {created: rows.length, updated: 0}; },
      now: () => '2026-10-21T00:00:00.000Z', saveDb: () => trace.push('save'), notify: () => trace.push('notify'), auditMutation: () => trace.push('audit'),
    }});
  }}});
  h.deps.grupoAtivoId = group; h.deps.empresaAtivaId = company;
  return {...h, run: bind(h.deps), trace, db, stored};
}
test('actual existing local pipeline and snapshot policy restore synthetic scoped records through actual consumer', async () => {
  const h = pipelineHarness(), result = await h.run(h.stored);
  assert.deepEqual(h.trace, ['permission', 'merge', 'save', 'notify', 'audit']);
  assert.equal(h.db.Cliente[0].id, 'synthetic-client'); assert.equal(result.backup.id, backup.id);
  assert.equal(result.backup.restauracoes.length, 1); assert.equal(result.summary.Cliente.created, 1);
  assert.equal(h.audits[0].acao, 'Backup.restaurar');
});
test('existing local policy blocks synthetic other group/company and service denial before merge/save', async () => {
  for (const options of [{group: 'synthetic-other-group'}, {company: 'synthetic-b'}, {deny: true}]) {
    const h = pipelineHarness(options); await assert.rejects(h.run(h.stored));
    assert.deepEqual(h.trace, ['permission']); assert.equal(h.db.Cliente, undefined);
    assert.ok(!h.audits.some(row => row.acao === 'Backup.restaurar'));
  }
});
test('actual restoration parameter reuses canonical ViradaRecord contract without accepting invalid identity/status types', () => {
  const {ast, fn} = command(), filename = path.resolve('tests/synthetic-backup-capability.js');
  const lines = ["import {useMutation} from '@tanstack/react-query';", `const mutation=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{}});`,
    "mutation.mutate({id:'synthetic-backup',status:'Concluido'});", "mutation.mutate({id:0,status:'Concluido'});",
    "mutation.mutate({id:true,status:'Concluido'});", "mutation.mutate({id:'synthetic-backup',status:false});"];
  const options = {allowJs: true, checkJs: true, noEmit: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, baseUrl: process.cwd(), paths: {'@/*': ['./src/*']}};
  const host = ts.createCompilerHost(options), original = host.readFile; host.readFile = file => path.resolve(file) === filename ? lines.join('\n') : original(file);
  const errors = ts.createProgram([filename], options, host).getSemanticDiagnostics().filter(e => e.file && path.resolve(e.file.fileName) === filename);
  assert.deepEqual(errors.map(e => e.file.getLineAndCharacterOfPosition(e.start).line), [4, 5], JSON.stringify(errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n'))));
});
