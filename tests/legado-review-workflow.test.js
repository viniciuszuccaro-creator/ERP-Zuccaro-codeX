import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { prepareAssistedReviewPackage, writeSyntheticAssistedReview } from '../scripts/legado/pilot-functional-review-package.mjs';
import { createSyntheticAssistedReviewRecords, normalizeReviewField, prepareAssistedReviewProposal,
  collectAssistedReviewProposal, protectReviewValue } from '../scripts/legado/pilot-functional-review-record.mjs';
import { renderAssistedReview } from '../scripts/legado/pilot-functional-review-view.mjs';
import { compareOperationalMigrationEvidence, buildOperationalLoadCandidate } from '../scripts/legado/pilot-functional-load-plan.mjs';

const h = 'a'.repeat(64), other = 'b'.repeat(64);
const command = record => ({ operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', expectedSourceFingerprint: record.sourceFingerprint,
  field: 'cep', proposedValue: '12345678', reason: 'Somente pontuacao comprovada', evidenceRefs: [] });
const context = record => ({ ...record.context, actorId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });
const guard = { assertAllowed: async () => {} };

test('revisao conserva as quatro situacoes, origem e bloqueios, sem conceder operacao', () => {
  const records = createSyntheticAssistedReviewRecords();
  assert.deepEqual(records.map(r => r.status), ['VALIDATED_ELIGIBLE', 'IMPORTED_PENDING', 'REVIEW_REQUIRED', 'HISTORY_ONLY']);
  for (const record of records) {
    assert.equal(record.actions.apply, false); assert.equal(record.operationalLoadAuthorized, false);
    assert.equal(record.fields.find(f => f.name === 'codigo').editable, false);
    assert.equal(record.fields.find(f => f.name === 'cep').original, '12.345-678');
  }
  assert.ok(records[2].blockedOperations.includes('fiscal.emitir'));
});

test('normalizacao limita-se a apresentacao; numero, pais, finalidade e unidade nao sao inferidos', () => {
  assert.equal(normalizeReviewField('cep', '12.345-678').proposed, '12345678');
  assert.equal(normalizeReviewField('uf', ' sp ').proposed, 'SP');
  for (const field of ['numero', 'pais', 'finalidades', 'unidade_principal', 'nome'])
    assert.equal(normalizeReviewField(field, ' brasil ').proposed, null);
  assert.equal(normalizeReviewField('cep', '1234').rule, null);
});

test('proposta revalida importar e editar, preserva original e oferece replay sem escrita mestre', async () => {
  const record = createSyntheticAssistedReviewRecords()[0], before = structuredClone(record), calls = [];
  const proposal = await prepareAssistedReviewProposal(record, command(record), { context: context(record),
    rbacGuard: { assertAllowed: async (...args) => calls.push(args) } });
  assert.equal(proposal.kind, 'FORMAT_ONLY'); assert.equal(proposal.applied, false);
  assert.deepEqual(calls.map(c => c[3]), ['importar', 'editar', 'importar', 'editar']);
  assert.ok(calls.every(c => c[4].allowGlobalWildcard === false));
  assert.deepEqual(record, before);
  const once = collectAssistedReviewProposal([], proposal), replay = collectAssistedReviewProposal(once.journal, proposal);
  assert.equal(once.masterWrites, 0); assert.equal(replay.reused, true); assert.equal(replay.journal.length, 1);
  assert.throws(() => collectAssistedReviewProposal([], { ...proposal, proposedValue: '99999999' }), /TAMPERED/);
  assert.throws(() => collectAssistedReviewProposal([{ ...proposal, reason: 'CHANGED' }], proposal), /JOURNAL_TAMPERED/);
});

test('falha fechada: empresa, ator, fingerprint, codigo, valor vazio e permissao revogada', async () => {
  const record = createSyntheticAssistedReviewRecords()[0], c = command(record);
  for (const [cmd, ctx, permission] of [
    [c, { ...context(record), empresaId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }, guard],
    [c, { ...context(record), actorId: null }, guard],
    [{ ...c, expectedSourceFingerprint: other }, context(record), guard],
    [{ ...c, field: 'codigo' }, context(record), guard],
    [{ ...c, proposedValue: '' }, context(record), guard],
    [c, context(record), { assertAllowed: async () => { throw new Error('DENIED'); } }],
  ]) await assert.rejects(prepareAssistedReviewProposal(record, cmd, { context: ctx, rbacGuard: permission }));
  let calls = 0;
  await assert.rejects(prepareAssistedReviewProposal(record, c, { context: context(record),
    rbacGuard: { assertAllowed: async () => { if (++calls === 4) throw new Error('REVOKED'); } } }), /REVOKED/);
});

test('alteracao de significado exige evidencia e captura inputs antes da primeira autorizacao assincrona', async () => {
  const record = createSyntheticAssistedReviewRecords()[0], c = { ...command(record), field: 'nome', proposedValue: 'Nome SINTETICO revisado' };
  await assert.rejects(prepareAssistedReviewProposal(record, c, { context: context(record), rbacGuard: guard }), /EVIDENCE_REQUIRED/);
  c.evidenceRefs = [{ ref: 'synthetic-source:1', sha256: h }];
  const ctx = context(record);
  const result = await prepareAssistedReviewProposal(record, c, { context: ctx,
    rbacGuard: { assertAllowed: async () => { c.proposedValue = 'TAMPERED'; ctx.groupId = null; } } });
  assert.equal(result.proposedValue, 'Nome SINTETICO revisado'); assert.equal(result.kind, 'MEANING_CHANGE');
});

test('preview sintetica nega fonte privada e neutraliza HTML e segredos recursivos', () => {
  const records = createSyntheticAssistedReviewRecords();
  records[0].fields[1].original = '</script><img src=x onerror=alert(1)>';
  const html = renderAssistedReview(records, { kind: 'synthetic' });
  assert.equal(html.includes('<img src=x'), false); assert.match(html, /connect-src 'none'/);
  assert.match(html, /UNTRUSTED_REVIEW_DRAFT/); assert.match(html, /Aplicar no cadastro/);
  assert.throws(() => renderAssistedReview([{ ...records[0], synthetic: false }], { kind: 'synthetic' }), /DENIED/);
  const protectedRecords = createSyntheticAssistedReviewRecords(); protectedRecords[0].actions.viewProtected = false;
  assert.equal(renderAssistedReview(protectedRecords).includes('Pessoa SINTETICA 1'), false);
  assert.deepEqual(protectReviewValue({ value: { password: 'DENIED', safe: true } }), { value: { safe: true } });
});

test('migrations usam nome completo e bytes, sem equivalencia por prefixo ou renumeracao', () => {
  const result = compareOperationalMigrationEvidence({ candidates: [{ name: '045_bulk.sql', sha256: h, automatic: false }],
    deployed: [{ name: '045_cursor.sql', sha256: h }, { name: '045_bulk.sql', sha256: other }] });
  assert.equal(result.journalVerified, false); assert.equal(result.pending, null);
  assert.deepEqual(result.sameNameDifferentBytes, ['045_bulk.sql']); assert.equal(result.numericCollisions.length, 1);
  assert.equal(result.executeMigrations, false); assert.equal(result.renameAuthorized, false);
  assert.throws(() => compareOperationalMigrationEvidence({ candidates: [{ name: '../045.sql', sha256: h }] }));
});

test('roteiro de metadata permanece fora das migrations e somente leitura, sem dados de cadastros', () => {
  const sql = fs.readFileSync(new URL('../scripts/legado/target-metadata-readonly.sql', import.meta.url), 'utf8').replace(/--[^\n]*/g, '');
  assert.match(sql, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(sql, /ROLLBACK;/);
  assert.equal(/\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|COPY|DO|CALL)\b/i.test(sql), false);
  assert.equal(/FROM\s+(clientes|fornecedores|produtos)\b/i.test(sql), false);
  assert.match(sql, /SELECT id, applied_at FROM schema_migrations/);
});

test('plano operacional nao reutiliza prova isolada, workspace ou filesystem do staging como prova do destino', () => {
  const candidates = Array.from({ length: 120 }, (_, index) => ({ index, sourceFingerprint: h, fileSha256: other,
    sourceActive: index !== 0, canonicalValidated: true, identityConflict: index === 1 }));
  const result = buildOperationalLoadCandidate({ candidates, proofs: { targetIdentity: { verified: true, proofSha256: h,
    environment: 'ISOLATED', observedAt: new Date().toISOString(), targetIdentitySha256: h } }, targetIdentitySha256: h });
  assert.equal(result.firstLoad.selected, 100); assert.equal(result.firstLoad.sourcePrepared, 118);
  assert.equal(result.cohort[0].sourceIndex, 2); assert.equal(result.sourceHeld, 2);
  assert.equal(result.operationalAuthorized, false); assert.equal(result.executable, false); assert.equal(result.operationalEligible, 0);
  assert.equal(result.gates.length, 5); assert.equal(result.gates[0].passed, false);
  assert.equal(result.productPrerequisites.blocksOnlyProductLoad, true);
});

test('recibos existentes geram revisao privada sem reexecutar piloto; linha inconsistente fica isolada', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'review-344-synthetic-'));
  try {
    const functional = path.join(base, 'functional-344-aaaaaaaaaaaaaaaa'), products = path.join(base, 'products-344-bbbbbbbbbbbbbbbb');
    for (const dir of [functional, products]) fs.mkdirSync(dir, { mode: 0o700 });
    const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data), { mode: 0o600 });
    write(path.join(base, 'current-functional.json'), { root: functional });
    write(path.join(base, 'current-products.json'), { root: products });
    const original = { nome: 'PESSOA SOMENTE SINTETICA', codigo: '123', password: 'NEVER_EXPORT' };
    write(path.join(functional, 'input.json'), { rows: { cliente: [original] }, sourceFiles: [{ entity: 'cliente', relativePath: 'synthetic.csv', sha256: h }] });
    fs.mkdirSync(path.join(products, 'assisted-review-v2'), { mode: 0o700 });
    const projection = createSyntheticAssistedReviewRecords()[3];
    const historical = { entity: 'cliente', index: 0, sourceReference: crypto.createHash('sha256').update('cliente:0').digest('hex'),
      status: projection.status, label: projection.label, reasons: projection.reasons, blockedOperations: projection.blockedOperations };
    const sourceFile = path.join(products, 'assisted-review-v2/projection-private.json');
    write(sourceFile, { records: [historical, { ...historical, index: 500 }] });
    const before = fs.readFileSync(sourceFile);
    const result = prepareAssistedReviewPackage({ base, repo: process.cwd(), context: projection.context });
    assert.equal(result.receipt.records, 1); assert.equal(result.receipt.quarantine, 1);
    assert.equal(result.receipt.counts.HISTORY_ONLY, 1); assert.equal(result.receipt.databaseAccess, false);
    assert.equal(result.receipt.sourceReleasedForOperationalLoad, 0);
    assert.deepEqual(fs.readFileSync(sourceFile), before);
    assert.equal(fs.readFileSync(path.join(result.root, 'records-private.json'), 'utf8').includes('NEVER_EXPORT'), false);
    assert.equal(fs.readFileSync(path.join(result.root, 'REVISAO_ASSISTIDA_344_PRIVADA.html'), 'utf8').includes(original.nome), false);
    const preview = path.join(base, 'synthetic.html');
    assert.equal(writeSyntheticAssistedReview(preview).syntheticOnly, true);
    assert.throws(() => writeSyntheticAssistedReview(preview), /EEXIST/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
