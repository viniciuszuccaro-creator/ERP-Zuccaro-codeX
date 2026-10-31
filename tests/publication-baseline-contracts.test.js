import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';
import {
  PUBLICATION_BASE,
  REOPEN_AUTHORIZED_CURRENT_SHA,
  REOPEN_AUTHORIZED_MANIFEST_ENTRY,
  REOPEN_AUTHORIZED_REFERENCES,
  REOPEN_CONSOLIDACAO_PATH,
  REOPEN_HISTORICAL_BEFORE_SHA,
  loadHistoricalReopenConsolidacao,
  normalizePublicationSource,
  publicationRestoredHash,
  restoreAuthorizedReopenConsolidacao,
} from './helpers/publicationReopenAuthorizedDelta.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const manifest=JSON.parse(fs.readFileSync(new URL('./helpers/publicationBaselineManifest.json',import.meta.url),'utf8'));
const base=PUBLICATION_BASE;
test('publication baseline is the verified composition commit and is available in Git history',()=>{
 assert.equal(manifest.base,base);
 assert.equal(execFileSync('git',['rev-parse',`${base}^{commit}`],{encoding:'utf8'}).trim(),base);
 execFileSync('git',['merge-base','--is-ancestor',base,'HEAD']);
 assert.equal(manifest.cases.length,18);
});
const previousBulkEnumeration = "  assert.deepEqual([...newMembers.keys()].filter(name => !oldMembers.has(name)), ['export', 'restoreBulkSnapshot']);";
const approvedBulkDelta = `  assert.deepEqual([...newMembers.keys()].filter(name => !oldMembers.has(name)),
    ['export', 'correctInactiveLegacyName', 'restoreBulkSnapshot']);
  // Keep the old-method invariant; the authorized lifecycle addition must remain a pure delegation.
  const expected = members(parse(\`class Expected {
  correctInactiveLegacyName(ctx: RequestContext, input: unknown) {
    return correctInactiveLegacyName({ repo: this.repo, audit: this.audit, rbac: this.rbacGuard }, ctx, input);
  }
}\`));
  assert.equal(newMembers.get('correctInactiveLegacyName'), expected.get('correctInactiveLegacyName'));
  assert(after.statements.some(statement => ts.isImportDeclaration(statement)
    && statement.moduleSpecifier.getText(after) === "'./clienteLegacyNameCorrection.js'"));`;
function restoreApprovedBulkDelta(source) {
 assert.equal(source.split(approvedBulkDelta).length,2,'Only the exact authorized lifecycle delta may be normalized');
 return source.replace(approvedBulkDelta,previousBulkEnumeration);
}
const previousCallbackAfter = "  const after = parse(file, fs.readFileSync(file, 'utf8'));\n";
const approvedCallbackImport = "import {cadastroCodigoRegistroRemainder} from './helpers/cadastroCodigoRegistroRemainder.js';\n";
const approvedCallbackAfter = "  // #353: CodigoField autorizado em RotaPadrao/TabelaPreco — remainder restaura pin e36231b3.\n  const after = parse(file, cadastroCodigoRegistroRemainder(file, fs.readFileSync(file, 'utf8')));\n";
function restoreApprovedCodigoFieldCallbackDelta(source) {
 assert.equal(source.split(approvedCallbackImport).length,2,'Only the exact CodigoField import delta may be normalized');
 assert.equal(source.split(approvedCallbackAfter).length,2,'Only the exact CodigoField after-parse delta may be normalized');
 return source.replace(approvedCallbackImport,'').replace(approvedCallbackAfter,previousCallbackAfter);
}
test('bulk lifecycle evolution retains the original hash and rejects changed or repeated delegation assertions',()=>{
 const source=fs.readFileSync('server/tests/bulk-consolidacao.test.ts','utf8').replace(/\r\n/g,'\n');
 const restored=restoreApprovedBulkDelta(source);
 assert.equal(restored.includes(approvedBulkDelta),false);
 assert.throws(()=>restoreApprovedBulkDelta(source.replace('rbac: this.rbacGuard','rbac: this.otherGuard')));
 assert.throws(()=>restoreApprovedBulkDelta(source+approvedBulkDelta));
 assert.notEqual(crypto.createHash('sha256').update(restoreApprovedBulkDelta(source.replace('for (const [name, text] of oldMembers)','for (const [name, text] of newMembers)'))).digest('hex'),
   crypto.createHash('sha256').update(restored).digest('hex'));
});
for(const entry of manifest.cases)test(entry.path+': publication fixes only Git reference, preserving every prior assertion',()=>{
 const source=fs.readFileSync(entry.path,'utf8').replace(/\r\n/g,'\n');
 assert.equal(source.includes('HEAD:'),false);
 assert.equal(source.includes("'HEAD'"),false);
 assert.equal((source.match(new RegExp(base,'g'))||[]).length,entry.references);
 // The prior proof remains byte-identical after subtracting only the explicitly tested lifecycle addition.
 const reviewed=clienteConferenciaRemainder(entry.path,source);
 const prior=entry.path===REOPEN_CONSOLIDACAO_PATH
  ? restoreAuthorizedReopenConsolidacao(reviewed)
  : entry.path==='server/tests/bulk-consolidacao.test.ts'
    ? restoreApprovedBulkDelta(reviewed)
    : entry.path==='tests/cursor-callback-record-state.test.js'
      ? restoreApprovedCodigoFieldCallbackDelta(reviewed)
      : reviewed;
 const restored=prior.replaceAll(base+':','HEAD:').replaceAll(JSON.stringify(base),"'HEAD'");
 assert.equal(crypto.createHash('sha256').update(restored).digest('hex'),entry.beforeSha256);
});
test('CI retains historical source for proofs and checks frontend types before build',()=>{
 const source=fs.readFileSync('.github/workflows/erp-runtime-ci.yml','utf8');
 const frontend=source.slice(source.indexOf('  frontend:'),source.indexOf('  backend:'));
 assert.match(frontend,/fetch-depth: 0/);
 assert.ok(frontend.indexOf('npm run typecheck')>frontend.indexOf('npm ci'));
 assert.ok(frontend.indexOf('npm run typecheck')<frontend.indexOf('npm run build'));
});
test('future private exports and certificate/key files are ignored without reading any private file',()=>{
 for(const file of ['local-imports/synthetic-future.json','backups/synthetic-future.dump','synthetic-future.pfx','synthetic-future.p12','synthetic-future.pem','synthetic-future.key','.env.synthetic-future']){
  execFileSync('git',['check-ignore','--no-index','-q','--',file]);
 }
});

test('CANAL publication tip does not rewrite manifest; P1 reopen delta is the exact authorized entry only',()=>{
  // Tip Codex 118e8438: normalização do canal NÃO altera o manifesto vs pai 79d002a3.
  const tipPub=execFileSync('git',['show','118e8438f6ba5c5ae97a31482e6a083fb98fb81d:tests/helpers/publicationBaselineManifest.json'],{encoding:'utf8'});
  const parentPub=execFileSync('git',['show','79d002a3a6b0d0e5a2e6ea4f2372930737ca4656:tests/helpers/publicationBaselineManifest.json'],{encoding:'utf8'});
  assert.equal(tipPub,parentPub);
  const historical=JSON.parse(execFileSync('git',['show','90f0a315eb3d2b59e0c2bfcab7077abc27bc3613:tests/helpers/publicationBaselineManifest.json'],{encoding:'utf8'}));
  const current=JSON.parse(fs.readFileSync('tests/helpers/publicationBaselineManifest.json','utf8'));
  assert.equal(current.cases.length,18);
  assert.equal(historical.cases.length,18);
  assert.equal(current.base,historical.base);
  for(const entry of historical.cases){
    const now=current.cases.find((c)=>c.path===entry.path);
    assert.ok(now,entry.path);
    if(entry.path===REOPEN_CONSOLIDACAO_PATH){
      // Delta autorizado fixo: beforeSha histórico + references=2. Sem notEqual+continue.
      assert.deepEqual(now, REOPEN_AUTHORIZED_MANIFEST_ENTRY);
      assert.notDeepEqual(now, entry);
      continue;
    }
    assert.deepEqual(now,entry);
  }
  // Contraprova: adulterar outro case deve divergir do histórico.
  const forged={...current,cases:current.cases.map((c)=>c.path===REOPEN_CONSOLIDACAO_PATH?c:{...c,references:(c.references||0)+99})};
  assert.notEqual(JSON.stringify(forged.cases.find((c)=>c.path!==REOPEN_CONSOLIDACAO_PATH)),JSON.stringify(historical.cases.find((c)=>c.path!==REOPEN_CONSOLIDACAO_PATH)));
});

test('P1 reopen guards reject assertion removal after beforeSha recalculation (Codex contraprova)',()=>{
  const authorized=normalizePublicationSource(fs.readFileSync(REOPEN_CONSOLIDACAO_PATH,'utf8'));
  assert.equal(publicationRestoredHash(authorized), REOPEN_AUTHORIZED_CURRENT_SHA);
  assert.equal(restoreAuthorizedReopenConsolidacao(authorized), loadHistoricalReopenConsolidacao());

  // Ataque Codex: remover assertion do caso reabertura e recalcular beforeSha.
  const attacked=authorized.replace(
    "assert.equal(decideCadastroReopen({\n    idChanged: false, updatedChanged: false, isDirty: true, matchesIncoming: false,\n  }), 'keep');\n\n  ",
    '',
  );
  assert.notEqual(attacked, authorized);
  const attackedHash=publicationRestoredHash(attacked);
  assert.notEqual(attackedHash, REOPEN_AUTHORIZED_CURRENT_SHA);
  assert.throws(()=>restoreAuthorizedReopenConsolidacao(attacked), /exact authorized reopen/);

  // Guard 1 (per-file): mesmo com beforeSha adulterado no manifesto, o restore real falha.
  const forgedManifestEntry={
    path: REOPEN_CONSOLIDACAO_PATH,
    beforeSha256: attackedHash,
    references: REOPEN_AUTHORIZED_REFERENCES,
  };
  assert.throws(()=>{
    const prior=restoreAuthorizedReopenConsolidacao(attacked);
    const restored=prior.replaceAll(`${base}:`,'HEAD:').replaceAll(JSON.stringify(base),"'HEAD'");
    assert.equal(crypto.createHash('sha256').update(restored).digest('hex'), forgedManifestEntry.beforeSha256);
  }, /exact authorized reopen/);

  // Guard 2 (CANAL/manifesto): entrada deve ser exatamente a autorizada — notEqual+continue rejeitado.
  assert.notDeepEqual(forgedManifestEntry, REOPEN_AUTHORIZED_MANIFEST_ENTRY);
  assert.throws(()=>assert.deepEqual(forgedManifestEntry, REOPEN_AUTHORIZED_MANIFEST_ENTRY));
});

test('P1 reopen guards reject internal mutation, omission, repetition and baseline tampering',()=>{
  const authorized=normalizePublicationSource(fs.readFileSync(REOPEN_CONSOLIDACAO_PATH,'utf8'));

  // Mutação interna (trocar outcome keep→apply).
  const internal=authorized.replace("}), 'keep');", "}), 'apply');");
  assert.throws(()=>restoreAuthorizedReopenConsolidacao(internal), /exact authorized reopen/);

  // Omissão do delta (source histórico como se fosse o atual).
  const historical=loadHistoricalReopenConsolidacao();
  assert.throws(()=>restoreAuthorizedReopenConsolidacao(historical), /exact authorized reopen|omission/i);

  // Repetição / adulteração externa: concatenar lixo fora do delta.
  assert.throws(()=>restoreAuthorizedReopenConsolidacao(`${authorized}\n`), /exact authorized reopen/);
  assert.throws(()=>restoreAuthorizedReopenConsolidacao(`// forged\n${authorized}`), /exact authorized reopen/);

  // Baseline histórico adulterado: hash histórico pinado deve bater com git show.
  assert.equal(publicationRestoredHash(historical), REOPEN_HISTORICAL_BEFORE_SHA);
  const tamperedBaseline=historical.replace('Dirty value', 'Tampered dirty');
  assert.notEqual(publicationRestoredHash(tamperedBaseline), REOPEN_HISTORICAL_BEFORE_SHA);

  // Manifesto: references adulterada ou beforeSha trocado rejeitados pelo deepEqual autorizado.
  assert.throws(()=>assert.deepEqual(
    { path: REOPEN_CONSOLIDACAO_PATH, beforeSha256: REOPEN_HISTORICAL_BEFORE_SHA, references: 1 },
    REOPEN_AUTHORIZED_MANIFEST_ENTRY,
  ));
  assert.throws(()=>assert.deepEqual(
    { path: REOPEN_CONSOLIDACAO_PATH, beforeSha256: REOPEN_AUTHORIZED_CURRENT_SHA, references: REOPEN_AUTHORIZED_REFERENCES },
    REOPEN_AUTHORIZED_MANIFEST_ENTRY,
  ));
});
