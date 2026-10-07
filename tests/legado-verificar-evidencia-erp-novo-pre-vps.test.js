import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  EXPECTED_EXPORT_SHA256_DEFAULT,
  VERIFIER_ERP_NOVO_VERSION,
  contarParesIdCnpj,
  verificarEvidenciaErpNovoPreVps,
} from '../scripts/legado/verificar-evidencia-erp-novo-pre-vps.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/legado/verificar-evidencia-erp-novo-pre-vps.mjs');

test('contarParesIdCnpj detecta id+cnpj_sha256 juntos', () => {
  const acc = contarParesIdCnpj({
    empresas: [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', cnpj_sha256: 'b'.repeat(64) },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    ],
  });
  assert.equal(acc.comIdECnpj, 1);
  assert.ok(acc.comId >= 2);
});

test('verifica mesmo arquivo quando sha bate e topology tem pares', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legado-erp-novo-'));
  const payload = Buffer.from('{"synthetic":true,"never":"pii"}');
  const digest = createHash('sha256').update(payload).digest('hex');
  const exportPath = path.join(dir, 'legado-empresas-api-20261006T153440Z.json');
  fs.writeFileSync(exportPath, payload);
  const topology = {
    groups: [{ id: '11111111-1111-4111-8111-111111111111', cnpj_sha256: 'a'.repeat(64) }],
    empresas: [
      { id: '22222222-2222-4222-8222-222222222222', cnpj_sha256: 'b'.repeat(64) },
      { id: '33333333-3333-4333-8333-333333333333', cnpj_sha256: 'c'.repeat(64) },
    ],
  };
  fs.writeFileSync(path.join(dir, 'current-erp-company-topology-proof.json'), JSON.stringify(topology));

  const r = verificarEvidenciaErpNovoPreVps({
    exportPath,
    expectedSha: digest,
    reportsDir: dir,
  });
  assert.equal(r.verifierVersion, VERIFIER_ERP_NOVO_VERSION);
  assert.equal(r.sameFileAsPaste, true);
  assert.equal(r.importAuthorized, false);
  assert.equal(r.cadespRedocumentRequested, false);
  assert.equal(r.ok, true);
  assert.equal(r.topologyPreVps.paresIdCnpj.comIdECnpj, 3);
});

test('CLI BLOCKED sem HD/export (reproduzivel)', () => {
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  const j = JSON.parse(run.stdout);
  assert.equal(j.importAuthorized, false);
  assert.ok(j.blocked.includes('LEGACY_EXPORT_PATH_MISSING'));
  assert.ok(j.blocked.includes('LEGACY_REPORTS_DIR_NOT_PROVIDED'));
  assert.equal(EXPECTED_EXPORT_SHA256_DEFAULT.length, 64);
});
