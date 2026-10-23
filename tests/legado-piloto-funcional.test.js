import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { selectFunctionalRows, planProductEvidence, projectionDifferences } from '../scripts/legado/pilot-functional-policy.mjs';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const unitId = '11111111-aaaa-4aaa-8aaa-111111111111';
const input = rows => ({ rows: { cliente: rows, fornecedor: [] } });
// Policy-only fixtures: real canonical schema/SQL behavior is tested separately.
const options = { groupId, batch: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', sourceSystem: 'SYNTHETIC',
  clienteSchema: { safeParse: data => ({ success: true, data }) },
  fornecedorSchema: { safeParse: data => ({ success: true, data }) } };
const client = { codigo: '000123', codigo_legado: '123', tipo: 'Pessoa Física', nome: 'SYNTHETIC', cpf: '52998224725', status: 'Ativo' };
test('reconciliation preserves changed source labels as explicit pending, ignoring only allocated batch', () => {
  assert.deepEqual(projectionDifferences({ nome: 'CORRECT', migration_batch: 'validation' },
    { nome: 'OLD', migration_batch: 'allocated' }), ['nome']);
  assert.deepEqual(projectionDifferences({ nome: 'CORRECT', migration_batch: 'validation' },
    { nome: 'CORRECT', migration_batch: 'allocated' }), []);
});

test('functional policy preserves inactive clients and keeps codes separate', () => {
  const result = selectFunctionalRows(input([client, { ...client, codigo: '000124', codigo_legado: '124', cpf: '', status: 'Inativo' }]), options);
  assert.equal(result.selected.cliente.length, 1);
  assert.equal(result.selected.cliente[0].payload.codigo, '000123');
  assert.equal(result.selected.cliente[0].payload.codigo_legado, '123');
  assert.equal(result.quarantine[0].reason, 'INACTIVE_CLIENT_PRESERVED_NOT_REACTIVATED');
});
test('functional policy quarantines all owners of conflicting identities', () => {
  const result = selectFunctionalRows(input([client, { ...client, nome: 'DIFFERENT' }]), options);
  assert.equal(result.selected.cliente.length, 0); assert.equal(result.quarantine.length, 2);
});
test('functional policy does not bypass canonical rejection or invent address fields', () => {
  const rejected = selectFunctionalRows(input([client]), { ...options, clienteSchema: { safeParse: () => ({ success: false }) } });
  assert.equal(rejected.selected.cliente.length, 0);
  const pending = selectFunctionalRows(input([{ ...client, endereco_logradouro: 'SYNTHETIC STREET' }]), options);
  assert.equal(pending.auxiliary[0].reason, 'ADDRESS_NUMBER_AND_COUNTRY_NOT_PROVEN');
  assert.equal(Object.hasOwn(pending.selected.cliente[0].payload, 'numero'), false);
});
const product = { codigo_legado: '1', descricao: 'SYNTHETIC', codigo_classe: '37', unidade_origem: 'UN', unidade_principal: 'UN', tipo_item: 'Revenda' };
const mapping = { groupId, classUnitMap: { '37|UN': { tipo_item: 'Revenda', unidade_medida_id: unitId } },
  unidadesCanonicas: [{ id: unitId, group_id: groupId, ativo: true }] };
test('equal unit names and proposed IDs never approve product mappings', () => {
  const r = planProductEvidence([product], [{ approved_target_unit_id: unitId, scope_verified: 'false', semantic_equivalence_verified: 'false' }], mapping);
  assert.equal(r.deterministicallyReleased, 0); assert.equal(r.pending, 1);
});
test('explicit classification, verified unit identity and same group permit deterministic release', () => {
  const r = planProductEvidence([product], [{ approved_target_unit_id: unitId, scope_verified: 'true', semantic_equivalence_verified: 'true' }], mapping);
  assert.deepEqual(r.released, [0]); assert.equal(r.pending, 0);
});
test('verified unit from another group still blocks product release', () => {
  const r = planProductEvidence([product], [{ approved_target_unit_id: unitId, scope_verified: true, semantic_equivalence_verified: true }],
    { ...mapping, unidadesCanonicas: [{ id: unitId, group_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', ativo: true }] });
  assert.equal(r.deterministicallyReleased, 0);
});

test('verified CSV parser preserves escaped billing JSON and rejects shifted columns', () => {
  const source = fs.readFileSync(new URL('../scripts/legado/pilot-isolated.mjs', import.meta.url), 'utf8');
  const python = source.match(/const python = `([\s\S]*?)`;/)?.[1];
  assert.ok(python);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-synthetic-csv-'));
  try {
    const job = path.join(root, 'job'), recovered = path.join(root, 'recovered');
    fs.mkdirSync(job); fs.mkdirSync(recovered);
    const csv = 'codigo_legado,tipo_pessoa,cpf_cnpj,endereco_cobranca,quarantine_reasons\n'
      + '1,Pessoa Juridica,11222333000181,"{""cidade"":""SYNTHETIC""}",\n';
    const prepare = text => {
      fs.writeFileSync(path.join(recovered, 'synthetic.csv'), text);
      fs.writeFileSync(path.join(job, 'source-descriptors.json'), JSON.stringify({ sourceFiles: [{
        entity: 'fornecedor', relativePath: 'synthetic.csv', sha256: crypto.createHash('sha256').update(text).digest('hex'),
      }] }));
      // Match the JavaScript template literal escape processing used by the harness.
      return spawnSync('python3', ['-c', python.replaceAll('\\\\', '\\'), job], { encoding: 'utf8' });
    };
    const valid = prepare(csv);
    assert.equal(valid.status, 0, valid.stderr);
    const row = JSON.parse(fs.readFileSync(path.join(job, 'input.json'))).rows.fornecedor[0];
    assert.deepEqual(JSON.parse(row.endereco_cobranca), { cidade: 'SYNTHETIC' });
    assert.equal(row.quarantine_reasons, ''); assert.equal(Object.hasOwn(row, 'null'), false);
    assert.notEqual(prepare(csv.replace(',\n', ',EXTRA,\n')).status, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
