import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveNativeProductRules, classifyLegacyAddresses } from '../scripts/legado/pilot-functional-policy.mjs';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const unitId = '11111111-aaaa-4aaa-8aaa-111111111111';
const row = { codigo_legado: '0007', codigo_origem: '0007', id_antigo: '0007' };
const material = { CODIGOMATERIAL: '0007', CODIGOCLASSE: 'C', UNIDADE: 'U', TIPOMATERIAL: 'T' };
const unit = { source_unit_code: 'U', approved_target_unit_id: unitId, scope_verified: true, semantic_equivalence_verified: true };
const rules = { groupId, classificationRules: [{ group_id: groupId, sourceClassIds: ['C'], sourceTypeId: 'T',
  tipo_item: 'Revenda', semantic_verified: true, contract_sha256: 'a'.repeat(64) }],
units: [{ id: unitId, group_id: groupId, ativo: true }] };
test('review is an auxiliary mode of the existing executor and invokes no mutation methods', () => {
  const main = fs.readFileSync(new URL('../scripts/legado/pilot-functional.mjs', import.meta.url), 'utf8');
  const review = fs.readFileSync(new URL('../scripts/legado/pilot-functional-review.mjs', import.meta.url), 'utf8');
  assert.match(main, /process\.argv\[2\] === '--review'/);
  assert.match(main, /runCompletenessReview\(\{ base, repo, json, run, mod, pause \}\)/);
  assert.doesNotMatch(review, /\.(?:create|importar|softDelete|correctInactiveLegacyName)\s*\(/);
  assert.doesNotMatch(review, /\b(?:INSERT\s+INTO|UPDATE\s+clientes|DELETE\s+FROM)\b/);
});
test('native identities and contract-backed rule release synthetic products without conversion', () => {
  const r = resolveNativeProductRules([row], [material], [unit], rules);
  assert.equal(r.released.length, 1); assert.equal(r.released[0].sourceCode, '0007');
  assert.equal(r.released[0].grupo_legado, 'C'); assert.equal(r.released[0].grupo_produto_id, null);
  assert.equal(r.released[0].unidade_medida_id, unitId); assert.equal(r.conversionFactorsInvented, 0);
});
test('names never resolve native IDs or replace classification contracts', () => {
  const r = resolveNativeProductRules([{ ...row, descricao: 'MATCHING NAME' }], [{ ...material, CODIGOMATERIAL: '7', DESCRICAO: 'MATCHING NAME' }], [unit], rules);
  assert.equal(r.released.length, 0); assert.equal(r.nativeIdentitiesProven, 0);
  const missing = resolveNativeProductRules([row], [material], [unit], { ...rules, classificationRules: [] });
  assert.equal(missing.released.length, 0);
});
test('explicit native type alias uses the existing canonical enum, never a staged default', () => {
  const r = resolveNativeProductRules([row], [{ ...material, TIPOMATERIAL: 'REVENDA   ' }], [unit],
    { ...rules, classificationRules: [] });
  assert.equal(r.classificationsProven, 1); assert.equal(r.released[0].tipo_item, 'Revenda');
  const noType = resolveNativeProductRules([row], [{ ...material, TIPOMATERIAL: '' }], [unit], { ...rules, classificationRules: [] });
  assert.equal(noType.released.length, 0);
});
test('outer native unit padding is preserved as evidence, not used to invent semantic approval', () => {
  const r = resolveNativeProductRules([row], [{ ...material, UNIDADE: ' U  ' }], [unit], rules);
  assert.equal(r.released[0].sourceUnit, 'U'); assert.equal(r.released[0].sourceUnitRaw, ' U  ');
  assert.equal(resolveNativeProductRules([row], [{ ...material, UNIDADE: ' U  ' }],
    [{ ...unit, semantic_equivalence_verified: false }], rules).released.length, 0);
});
test('ambiguous native rows and conflicting verified classifications remain blocked', () => {
  assert.equal(resolveNativeProductRules([row], [material, { ...material, CODIGOCLASSE: 'OTHER' }], [unit], rules).released.length, 0);
  const contradictory = { ...rules, classificationRules: [...rules.classificationRules,
    { ...rules.classificationRules[0], tipo_item: 'INVALID' }] };
  assert.equal(resolveNativeProductRules([row], [material], [unit], contradictory).released.length, 0);
});
test('unit semantic, group, activity and unique identity are independent gates', () => {
  assert.equal(resolveNativeProductRules([row], [material], [{ ...unit, semantic_equivalence_verified: false }], rules).released.length, 0);
  assert.equal(resolveNativeProductRules([row], [material], [unit], { ...rules, units: [{ ...rules.units[0], group_id: 'other' }] }).released.length, 0);
  assert.equal(resolveNativeProductRules([row], [material], [unit], { ...rules, units: [{ ...rules.units[0], ativo: false }] }).released.length, 0);
  assert.equal(resolveNativeProductRules([row], [material], [unit], { ...rules, units: [rules.units[0], rules.units[0]] }).released.length, 0);
});
test('shared missing rules are grouped instead of asking per product', () => {
  const r = resolveNativeProductRules([row, row], [material], [], { groupId });
  assert.equal(r.pending, 2); assert.equal(r.decisions.length, 2);
  assert.deepEqual(r.decisions[0].indices, [0, 1]);
});
test('address availability does not infer number, country, label or purpose', () => {
  const r = classifyLegacyAddresses({ rows: { cliente: [{ endereco_logradouro: 'SYNTHETIC STREET 99',
    endereco_cep: '00000-000', endereco_cidade: 'SYNTHETIC', endereco_estado: 'SP' }], fornecedor: [] } });
  assert.equal(r.ready, 0); assert.equal(r.fieldsInvented, 0);
  for (const key of ['numero', 'pais', 'nome', 'finalidades']) assert.ok(r.entries[0].missing.includes(key));
  assert.ok(r.entries[0].available.includes('uf'));
});
test('conflicting state fields, malformed billing and postal format are explicit', () => {
  const r = classifyLegacyAddresses({ rows: { cliente: [{ endereco_uf: 'SP', endereco_estado: 'RJ', endereco_cep: '1' }],
    fornecedor: [{ endereco_cobranca: '{INVALID' }] } });
  assert.equal(r.conflicting, 2);
  assert.ok(r.entries[0].conflicts.includes('STATE_FIELDS_CONFLICT'));
  assert.ok(r.entries[0].conflicts.includes('CEP_FORMAT'));
  assert.deepEqual(r.entries[1].conflicts, ['BILLING_JSON_INVALID']);
});
test('complete address still needs the canonical validator; no fictitious persistence proof', () => {
  const cliente = { endereco_nome: 'SYNTHETIC', endereco_cep: '00000000', endereco_logradouro: 'SYNTHETIC',
    endereco_numero: '10', endereco_bairro: 'SYNTHETIC', endereco_cidade: 'SYNTHETIC', endereco_uf: 'SP',
    endereco_pais: 'BR', endereco_finalidades: [{ finalidade: 'ENTREGA' }] };
  const input = { rows: { cliente: [cliente], fornecedor: [] } };
  assert.equal(classifyLegacyAddresses(input).ready, 0);
  assert.equal(classifyLegacyAddresses(input, { validateAddress: () => ({ success: false }) }).ready, 0);
  assert.equal(classifyLegacyAddresses(input, { validateAddress: () => ({ success: true }) }).ready, 1);
});

const ownerPurposeDecision = { version: 'OWNER_ADDRESS_PURPOSE_20261111', sha256: 'a'.repeat(64) };
test('new purpose revision classifies fiscal and excludes billing without rewriting source', () => {
  const input = { rows: { cliente: [{ endereco_logradouro: 'Synthetic', endereco_complemento: 'Fundos',
    endereco_referencia: 'Portao', cobranca_logradouro: 'Synthetic billing', cobranca_cep: '01310100' }], fornecedor: [] } };
  const before = structuredClone(input);
  const old = classifyLegacyAddresses(input);
  const revised = classifyLegacyAddresses(input, { ownerPurposeDecision });
  assert.equal(old.excludedFromActiveMigration, 0);
  assert.equal(old.entries[0].targetPurpose, null);
  assert.equal(revised.entries[0].targetPurpose, 'FISCAL');
  assert.ok(!revised.entries[0].missing.includes('finalidades'));
  for (const field of ['complemento','referencia']) assert.ok(revised.entries[0].preservedComponents.includes(field));
  for (const field of ['numero','pais']) assert.ok(revised.entries[0].missing.includes(field));
  assert.equal(revised.excludedFromActiveMigration, 1);
  assert.equal(revised.entries[1].canonicalReady, false);
  assert.deepEqual(input, before);
  assert.throws(() => classifyLegacyAddresses(input, { ownerPurposeDecision: { ...ownerPurposeDecision, sha256: '' } }), /EVIDENCE_REQUIRED/);
});

test('partial address with only complement remains explicitly preserved', () => {
  const result = classifyLegacyAddresses({ rows: { cliente: [{ endereco_complemento: 'Synthetic' }], fornecedor: [] } }, { ownerPurposeDecision });
  assert.equal(result.addresses, 1); assert.equal(result.ready, 0);
  assert.ok(result.entries[0].preservedComponents.includes('complemento'));
});

const nativeWork = sequence => ({ groupId, clienteId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  sourceIdentity: { table: 'dbo.ClientesObras', CODIGOCLIENTE: '00001', ITEM: 0, SEQUENCIA: sequence },
  sourceRowJsonSha256: 'b'.repeat(64), provenComponents: { logradouro: 'Synthetic', complemento: 'Fundos',
    referencia: 'Portao', cep: '01310100', ufNative: 'SP', latitude: 0, longitude: 0, coordinate_source: 'MANUAL' } });
test('native Obras preserve separate identities/components and never claim binding or permission', () => {
  const input = { rows: { cliente: [], fornecedor: [] }, nativeWorks: [nativeWork('0001'), nativeWork('0002')] };
  const before = structuredClone(input);
  const old = classifyLegacyAddresses(input);
  assert.ok(old.entries.every(e => e.conflicts.includes('NATIVE_PURPOSE_UNPROVEN')));
  const result = classifyLegacyAddresses(input, { ownerPurposeDecision, groupId, validateAddress: () => ({ success: true }) });
  assert.equal(result.addresses, 2); assert.equal(result.ready, 0);
  assert.equal(result.fieldsInvented, 0);
  for (const entry of result.entries) {
    assert.equal(entry.targetPurpose, 'ENTREGA');
    assert.ok(!entry.conflicts.includes('NATIVE_PURPOSE_UNPROVEN'));
    assert.ok(entry.conflicts.includes('NATIVE_BINDING_REVALIDATION_REQUIRED'));
    assert.equal(entry.recipientPromoted, false);
    for (const field of ['logradouro','complemento','referencia','latitude','longitude']) assert.ok(entry.preservedComponents.includes(field));
    for (const field of ['numero','pais']) assert.ok(entry.missing.includes(field));
  }
  assert.deepEqual(result.entries.map(e=>e.sourceIdentity.SEQUENCIA), ['0001','0002']);
  assert.deepEqual(input, before);
});

test('duplicated native identity, foreign group and invalid proof stay segregated', () => {
  const other = { ...nativeWork('3'), groupId: 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee', sourceRowJsonSha256: 'invalid' };
  const result = classifyLegacyAddresses({ rows: { cliente: [], fornecedor: [] }, nativeWorks: [nativeWork('1'),nativeWork('1'),other] }, { ownerPurposeDecision, groupId });
  assert.ok(result.entries.slice(0,2).every(e=>e.conflicts.includes('NATIVE_IDENTITY_DUPLICATED')));
  assert.ok(result.entries[2].conflicts.includes('NATIVE_BINDING_UNPROVEN'));
  assert.ok(result.entries[2].conflicts.includes('NATIVE_SOURCE_HASH_REQUIRED'));
  assert.equal(result.ready, 0);
});

test('native master and Obras use explicit columns without splitting street numbers or copying billing', () => {
  const nativeCustomers=[{ CODIGOCLIENTE:'00001',ENDERECO:'Synthetic street 99',COMPLEMENTOENDERECO:'Sala 2',
    BAIRRO:'Synthetic',CIDADE:'Synthetic',CODIGOUF:'SP',CEPCLIENTE:'01310100',ENDERECOCOBRANCA:'Other street' }];
  const nativeDeliveryRows=[{CODIGOCLIENTE:'00001',ITEM:'001',SEQUENCIA:'0002',ENDERECO:'Work street 100',
    ComplementoEndereco:'Portao lateral',REFERENCIA:'Synthetic reference',CIDADE:'Synthetic',CODIGOUF:'SP'}];
  const input={rows:{cliente:[],fornecedor:[]},nativeCustomers,nativeDeliveryRows,
    nativeParentBindings:{'00001':'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'}};
  const before=structuredClone(input);
  const result=classifyLegacyAddresses(input,{ownerPurposeDecision,groupId});
  assert.equal(result.addresses,3);assert.equal(result.excludedFromActiveMigration,1);assert.equal(result.ready,0);
  assert.equal(result.entries[0].targetPurpose,'FISCAL');assert.equal(result.entries[2].targetPurpose,'ENTREGA');
  assert.equal(result.entries[0].sourceIdentity.CODIGOCLIENTE,'00001');
  assert.equal(result.entries[2].sourceIdentity.ITEM,'001');
  assert.equal(result.entries[2].sourceIdentity.SEQUENCIA,'0002');
  assert.ok(result.entries[0].preservedComponents.includes('complemento'));
  assert.ok(result.entries[2].preservedComponents.includes('referencia'));
  for(const entry of [result.entries[0],result.entries[2]])for(const key of ['numero','pais'])assert.ok(entry.missing.includes(key));
  assert.deepEqual(input,before);
  assert.throws(()=>classifyLegacyAddresses({...input,rows:{cliente:[{}],fornecedor:[]}},{ownerPurposeDecision}),/SOURCE_AMBIGUOUS/);
  assert.throws(()=>classifyLegacyAddresses({...input,nativeWorks:[]},{ownerPurposeDecision}),/SOURCE_AMBIGUOUS/);
});

test('whitespace-only native billing does not create an address; zero coordinates remain evidence', () => {
  const input={rows:{cliente:[],fornecedor:[]},nativeCustomers:[{CODIGOCLIENTE:'01',ENDERECO:'Synthetic',
    CEPCOBRANCA:'        ',UFCOBRANCA:'  ',ENDERECOCOBRANCA:' ',BAIRROCOBRANCA:'  '}],nativeWorks:[nativeWork('1')]};
  const result=classifyLegacyAddresses(input,{ownerPurposeDecision});
  assert.equal(result.addresses,2);assert.equal(result.excludedFromActiveMigration,0);
  assert.ok(!result.entries.some(e=>e.kind==='cobranca'));
  assert.ok(result.entries[1].preservedComponents.includes('latitude'));
  assert.ok(result.entries[1].preservedComponents.includes('longitude'));
});
