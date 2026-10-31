import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {runtimeProofSource} from './helpers/runtimeProofSource.js';

const digest = text => crypto.createHash('sha256').update(text).digest('hex');
const emit = source => ts.transpileModule(source, {compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  jsx: ts.JsxEmit.React, removeComments: true,
}}).outputText;

test('LF and CRLF source yield the original CRLF proof without dropping any other byte', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-synthetic-eol-'));
  try {
    const lf = 'const value = `Synthetic\nfixture`;\n';
    const crlf = lf.replace(/\n/g, '\r\n');
    const a = path.join(directory, 'lf.js'), b = path.join(directory, 'crlf.js');
    fs.writeFileSync(a, lf); fs.writeFileSync(b, crlf);
    assert.notEqual(digest(emit(lf)), digest(emit(crlf)), 'reproduce raw emitter hash mismatch');
    assert.equal(new Function(emit(lf) + ';return value;')(), new Function(emit(crlf) + ';return value;')());
    assert.equal(runtimeProofSource(a), crlf);
    assert.equal(runtimeProofSource(b), crlf);
    assert.equal(digest(emit(runtimeProofSource(a))), digest(emit(crlf)));
    fs.writeFileSync(a, lf.replace('fixture', 'MUTATED'));
    assert.notEqual(digest(emit(runtimeProofSource(a))), digest(emit(crlf)), 'executable mutation still rejected');
    fs.writeFileSync(a, 'const value = "a\\r";\rconst next = 1;');
    assert.equal(runtimeProofSource(a), fs.readFileSync(a, 'utf8'), 'lone CR and escaped characters retained');
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
});

test('all six proof suites retain every frozen expected SHA from the published commit', () => {
  const suites = ['approval-command-batch-types', 'audit-callback-contract-types',
    'command-payload-batch-types', 'date-arithmetic-contracts',
    'product-query-v5-options', 'shared-query-dom-contracts'];
  for (const suite of suites) {
    const file = 'tests/' + suite + '.test.js';
    const original = execFileSync('git', ['show', 'd312fbcd46641c4be9d05b17bce1ecb1fbd4c9c3:' + file], {encoding:'utf8'});
    assert.deepEqual(fs.readFileSync(file, 'utf8').match(/[a-f0-9]{64}/g), original.match(/[a-f0-9]{64}/g), file);
  }
});
