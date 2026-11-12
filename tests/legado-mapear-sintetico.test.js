import assert from 'node:assert/strict';
import test from 'node:test';
import {
  avaliarQuarentenaLegado,
  buildChaveIdempotenteMigracaoLegado,
  mapLegadoLoteSintetico,
  mapLegadoRowToCanonicalStub,
  mapLegadoClienteContatos,
  resolverEmpresaLegadoCodigo,
} from '../scripts/legado/mapear-registro-sintetico.mjs';

test('mapear legado sintetico cliente carimba staging e remove segredo', () => {
  const out = mapLegadoRowToCanonicalStub({
    cod_cliente: 'LEG-9',
    razao_social: 'Acme Sintetica',
    cnpj: '123',
    senha: 'segredo',
    password: 'x',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa: '1',
  }, { entidade: 'cliente', arquivoNome: 'cli.csv' });

  assert.equal(out.codigo_legado, 'LEG-9');
  assert.equal(out.nome, 'Acme Sintetica');
  assert.equal(out.origem_migracao, 'erp_antigo');
  assert.equal(out.destino_migracao, 'staging');
  assert.equal(out.importacao_erp, true);
  assert.equal(out.quarentena, false);
  assert.equal('senha' in out, false);
  assert.equal('password' in out, false);
  assert.match(String(out.lote_migracao), /^MIG-/);
  assert.equal(out.scopeType, 'group');
  assert.equal(out.empresa_id, undefined);
  assert.equal(out.codigo_empresa_legado, '1');
  assert.equal(out.chave_idempotente_migracao, 'g1|grupo|erp_antigo|cliente|LEG-9');
});

test('mapear legado sintetico produto usa descricao', () => {
  const out = mapLegadoRowToCanonicalStub({
    sku: 'SKU-1',
    produto: 'Chapa sintetica',
    classe: 'CHAPA',
    unidade: 'KG',
    group_id: 'g1',
    empresa_id: 'e1',
  }, { entidade: 'produto', arquivoNome: 'prod.csv', produtoClassUnitMap: {
    'CHAPA|KG': { tipo_produto: 'MATERIA_PRIMA', unidade_medida_id: 'u-kg' },
  } });
  assert.equal(out.codigo_legado, 'SKU-1');
  assert.equal(out.descricao, 'Chapa sintetica');
  assert.equal(out.tipo_item, 'Matéria-Prima Produção');
  assert.equal(out.unidade_medida_id, 'u-kg');
  assert.equal(out.empresa_id, undefined);
  assert.match(out.chave_idempotente_migracao, /\|produto\|SKU-1$/);
});

test('mapear legado sintetico fornecedor (consumidor sem mapper paralelo)', () => {
  const lote = mapLegadoLoteSintetico([
    {
      cod_fornecedor: 'F-10',
      razao_social: 'Fornecedor Sintetico',
      cnpj: '00000000000191',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '2',
    },
    {
      cod_fornecedor: 'F-10',
      razao_social: 'Fornecedor Sintetico',
      cnpj: '00000000000191',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '2',
    },
    {
      cod_fornecedor: 'F-0',
      nome: 'Quarentena Forn',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '0',
    },
  ], { entidade: 'fornecedor', arquivoNome: 'fornecedores_sintetico.csv' });

  assert.equal(lote.entidade, 'fornecedor');
  assert.equal(lote.gravados.length, 2);
  assert.equal(lote.reusos.length, 1);
  assert.equal(lote.quarentenas.length, 1);
  assert.equal(lote.gravados[0].nome, 'Fornecedor Sintetico');
  assert.equal(lote.gravados[0].documento, '00000000000191');
  assert.equal(lote.gravados[0].destino_migracao, 'staging');
  assert.match(lote.gravados[0].chave_idempotente_migracao, /\|fornecedor\|F-10$/);
});

test('mapear legado sintetico empresa', () => {
  const out = mapLegadoRowToCanonicalStub({
    codigoempresa: '2',
    razao_social: 'Empresa Sintetica',
    cnpj: '999',
    group_id: 'g1',
    empresa_id: 'e1',
  }, { entidade: 'empresa', arquivoNome: 'emp.csv' });
  assert.equal(out.codigo_legado, '2');
  assert.equal(out.nome, 'Empresa Sintetica');
});

test('mapear legado sintetico obra e condicao_pagamento', () => {
  const obra = mapLegadoRowToCanonicalStub({
    cod_obra: 'OB-1',
    nome_obra: 'Obra Sintetica',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa: '1',
  }, { entidade: 'obra' });
  assert.equal(obra.codigo_legado, 'OB-1');
  assert.equal(obra.nome, 'Obra Sintetica');

  const cond = mapLegadoRowToCanonicalStub({
    cod_condicao: 'CP-30',
    descricao: '30 dias sintetico',
    group_id: 'g1',
    empresa_id: 'e1',
  }, { entidade: 'condicao_pagamento' });
  assert.equal(cond.codigo_legado, 'CP-30');
  assert.match(cond.chave_idempotente_migracao, /\|condicao_pagamento\|CP-30$/);
});

test('quarentena codigo empresa 0', () => {
  const q = avaliarQuarentenaLegado({ codigo_empresa: '0' }, { entidade: 'cliente' });
  assert.equal(q.quarentena, true);
  assert.ok(q.motivos.includes('codigo_empresa_legado_0'));

  const out = mapLegadoRowToCanonicalStub({
    cod_cliente: 'X',
    nome: 'Quarentena',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa: '0',
  }, { entidade: 'cliente' });
  assert.equal(out.quarentena, true);
  assert.equal(out.status_migracao, 'PENDING_MANUAL_RECONCILIATION');
  assert.equal(out.destino_migracao, 'staging');
});

test('resolver empresa legado codigo 2 e inativa 4', () => {
  const e2 = resolverEmpresaLegadoCodigo('2');
  assert.equal(e2.conhecido, true);
  assert.equal(e2.label, '3Z_Armacao');
  const e4 = mapLegadoRowToCanonicalStub({
    cod_cliente: 'Y',
    nome: 'Cliente Belgo',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa: '4',
  }, { entidade: 'cliente' });
  assert.equal(e4.quarentena, true);
  assert.ok(e4.quarentena_motivos.includes('codigo_empresa_legado_inativa'));
  assert.equal(e4.empresa_legado_label, 'Belgo_Cercas');
});

test('mapear legado sintetico falha sem codigo/nome', () => {
  assert.throws(() => mapLegadoRowToCanonicalStub({ foo: 'bar' }, { entidade: 'cliente' }));
});

test('chave idempotente exige group e legado', () => {
  assert.throws(() => buildChaveIdempotenteMigracaoLegado({ codigo_legado: 'X' }));
});

test('lote sintetico detecta duplicata, quarentena e reconcilia', () => {
  const lote = mapLegadoLoteSintetico([
    { cod_cliente: 'A1', nome: 'Um', group_id: 'g1', empresa_id: 'e1', valor: 10, codigo_empresa: '1' },
    { cod_cliente: 'A1', nome: 'Um', group_id: 'g1', empresa_id: 'e1', valor: 10, codigo_empresa: '1' },
    { cod_cliente: 'A2', nome: 'Dois', group_id: 'g1', empresa_id: 'e1', valor: 5, codigo_empresa: '1' },
    { cod_cliente: 'A0', nome: 'Zero', group_id: 'g1', empresa_id: 'e1', valor: 1, codigo_empresa: '0' },
  ], { entidade: 'cliente', arquivoNome: 'lote.csv' });

  assert.equal(lote.gravados.length, 3);
  assert.equal(lote.reusos.length, 1);
  assert.equal(lote.quarentenas.length, 1);
  assert.equal(lote.erros.length, 0);
  assert.equal(lote.reconciliacao.quantidade_origem, 4);
  assert.equal(lote.reconciliacao.quantidade_gravada, 3);
  assert.equal(lote.reconciliacao.quantidade_reuso, 1);
  assert.equal(lote.reconciliacao.divergencia_quantidade, 0);
  assert.equal(lote.destino_migracao, 'staging');
  assert.equal(new Set(lote.chaves).size, 3);
});

test('lote sintetico vazio falha', () => {
  assert.throws(() => mapLegadoLoteSintetico([]));
});

test('cadastro compartilhado reusa entre empresas, mas divergencia vira conflito', () => {
  const out = mapLegadoLoteSintetico([
    { cod_cliente: 'C-1', nome: 'Mesmo', group_id: 'g1', codigo_empresa: '1' },
    { cod_cliente: 'C-1', nome: 'Mesmo', group_id: 'g1', codigo_empresa: '2' },
    { cod_cliente: 'C-1', nome: 'Outro', group_id: 'g1', codigo_empresa: '2' },
  ], { entidade: 'cliente' });
  assert.equal(out.gravados.length, 1);
  assert.equal(out.reusos.length, 1);
  assert.equal(out.conflitos.length, 1);
  assert.equal(out.gravados[0].empresa_id, undefined);
  assert.deepEqual(out.gravados[0].origens_empresa_legado, ['1', '2']);
});

test('produto sem classe/unidade comprovada fica em quarentena', () => {
  const out = mapLegadoRowToCanonicalStub({
    sku: 'P-1', descricao: 'Item', group_id: 'g1', classe: 'X', unidade: 'CX',
  }, { entidade: 'produto' });
  assert.equal(out.quarentena, true);
  assert.ok(out.quarentena_motivos.includes('produto_classe_unidade_sem_mapeamento'));
  assert.equal(out.tipo_produto, undefined);
});

test('Grupo de destino nao oculta tenant divergente na origem', () => {
  for (const field of ['group_id', 'grupo_id']) {
    assert.throws(() => mapLegadoRowToCanonicalStub({
      cod_cliente: 'C-1', nome: 'Sintetico', [field]: 'outro-grupo',
    }, { entidade: 'cliente', groupId: 'grupo-destino' }), /LEGACY_GROUP_MISMATCH/);
  }
});

test('classe mapeada exige tipo canonico e unidade textual sem default', () => {
  for (const entry of [
    { tipo_produto: 'TIPO_DESCONHECIDO', unidade_medida_id: 'u-kg' },
    { tipo_produto: 'REVENDA', unidade_medida_id: '   ' },
    { tipo_produto: 'REVENDA', unidade_medida_id: {} },
  ]) {
    const out = mapLegadoRowToCanonicalStub({
      sku: 'P-1', descricao: 'Item', group_id: 'g1', classe: 'CHAPA', unidade: 'KG',
    }, { entidade: 'produto', produtoClassUnitMap: { 'CHAPA|KG': entry } });
    assert.equal(out.quarentena, true);
    assert.equal(out.tipo_produto, undefined);
    assert.equal(out.unidade_medida_id, undefined);
  }
});

test('linha em quarentena nao absorve duplicata valida posterior', () => {
  const out = mapLegadoLoteSintetico([
    { cod_cliente: 'C-1', nome: 'Mesmo', group_id: 'g1', codigo_empresa: '0' },
    { cod_cliente: 'C-1', nome: 'Mesmo', group_id: 'g1', codigo_empresa: '1' },
  ], { entidade: 'cliente' });
  assert.equal(out.reusos.length, 0);
  assert.equal(out.gravados.filter((r) => !r.quarentena).length, 1);
  assert.equal(out.quarentenas.length, 1);
});

test('headers do staging SQL preservam codigo original e fantasia sem inferir empresa', () => {
  const cliente = mapLegadoRowToCanonicalStub({ CODIGOCLIENTE: '0007', RAZAOSOCIAL: 'Cliente Sintetico',
    NOMEGUERRA: 'Fantasia Sintetica', CGC: '00000000000000' }, { entidade: 'cliente', groupId: 'g1' });
  assert.equal(cliente.codigo_legado, '0007');
  assert.equal(cliente.nome_fantasia, 'Fantasia Sintetica');
  assert.equal(cliente.empresa_id, undefined);
  const fornecedor = mapLegadoRowToCanonicalStub({ CODIGOFORNEC: '0009', RAZAOSOCIAL: 'Fornecedor Sintetico',
    NOMEFANTASIA: 'Fornecedor Fantasia', CGCFORNEC: '00000000000001' }, { entidade: 'fornecedor', groupId: 'g1' });
  assert.equal(fornecedor.codigo_legado, '0009');
  assert.equal(fornecedor.documento, '00000000000001');
  const lote = mapLegadoLoteSintetico([{ ...cliente }, { ...cliente, nome_fantasia: 'Outra Fantasia' }], { entidade: 'cliente' });
  assert.equal(lote.conflitos.length, 1);
});

test('material SQL usa classe e unidade da origem somente com mapa explicito', () => {
  const input = { CODIGOMATERIAL: '0012', DESCRICAO: 'Material Sintetico', CODIGOCLASSE: '08', UNIDADE: 'KG' };
  const options = { entidade: 'produto', groupId: 'g1' };
  assert.equal(mapLegadoRowToCanonicalStub(input, options).quarentena, true);
  const mapped = mapLegadoRowToCanonicalStub(input, { ...options,
    produtoClassUnitMap: { '08|KG': { tipo_produto: 'MATERIA_PRIMA', unidade_medida_id: 'unidade-isolada' } } });
  assert.equal(mapped.quarentena, false);
  assert.equal(mapped.codigo_legado, '0012');
  assert.equal(mapped.classe_legado, '08');
  assert.equal(mapped.unidade_legado, 'KG');
});

test('produto explicito aceita chave e rotulo canonicos e grava tipo_item sem default', () => {
  for (const tipo of ['MATERIA_PRIMA', 'Matéria-Prima Produção']) {
    const out = mapLegadoRowToCanonicalStub({ sku: 'P-1', descricao: 'Item', classe: 'C', unidade: 'KG' },
      { entidade: 'produto', groupId: 'g1', produtoClassUnitMap: {
        'C|KG': { tipo_item: tipo, unidade_medida_id: 'u-kg' },
      } });
    assert.equal(out.quarentena, false);
    assert.equal(out.tipo_item, 'Matéria-Prima Produção');
    assert.equal('tipo_produto' in out, false);
  }
});

test('opcoes nao substituem empresa da operacao sem comprovacao', () => {
  assert.throws(() => mapLegadoRowToCanonicalStub({ cod_obra: 'O-1', nome: 'Obra',
    group_id: 'g1', empresa_id: 'origem', codigo_empresa: '1' },
  { entidade: 'obra', empresaId: 'destino' }), /LEGACY_COMPANY_MISMATCH/);
});

// Completes the class/unit inventory without exposing source customer/product records.
import { catalogarProdutoClasseUnidadeLegado } from '../scripts/legado/mapear-registro-sintetico.mjs';
test('catalogo classe/unidade reconcilia contagens e exige destino ativo do mesmo Grupo', () => {
 const rows = [{sku:'001',descricao:'Synthetic private',classe:'08',unidade:'KG'},
   {sku:'002',descricao:'Other private',classe:'08',unidade:'KG'},
   {sku:'003',descricao:'Unmapped',classe:'09',unidade:'UN'}];
 const opts = {groupId:'g1',produtoClassUnitMap:{'08|KG':{tipo_item:'MATERIA_PRIMA',unidade_medida_id:'kg'}},
   unidadesCanonicas:[{id:'kg',group_id:'g1',ativo:true}]};
 const out=catalogarProdutoClasseUnidadeLegado(rows,opts);
 assert.equal(out.quantidade_origem,3);assert.equal(out.quantidade_catalogada,3);
 assert.equal(out.quantidade_sem_mapa,1);assert.equal(out.grupos[0].mapeamento_comprovado,true);
 assert.equal(out.grupos[0].quantidade,2);assert.equal(out.importado_operacional,false);
 assert.equal(JSON.stringify(out).includes('Synthetic private'),false);
 assert.equal(JSON.stringify(out).includes('001'),false);
 assert.deepEqual(catalogarProdutoClasseUnidadeLegado([...rows].reverse(),opts),out);
 for(const unidade of [{id:'kg',group_id:'g2',ativo:true},{id:'kg',group_id:'g1',ativo:false}]) {
  assert.equal(catalogarProdutoClasseUnidadeLegado(rows,{...opts,unidadesCanonicas:[unidade]}).quantidade_sem_mapa,3);
 }
 assert.equal(catalogarProdutoClasseUnidadeLegado(rows,{...opts,unidadesCanonicas:[]}).quantidade_sem_mapa,3);
});
test('catalogo preserva codigos e separa pares ambiguos sem aceitar mapa implicito', () => {
 const out=catalogarProdutoClasseUnidadeLegado([
  {sku:'A',descricao:'A',classe:'C|U',unidade:'X'},
  {sku:'B',descricao:'B',classe:'C',unidade:'U|X'}],{groupId:'g1'});
 assert.equal(out.grupos.length,2);assert.equal(out.quantidade_sem_mapa,2);
 assert(out.grupos.every(g=>g.motivos.includes('chave_mapeamento_ambigua')));
 assert.throws(()=>catalogarProdutoClasseUnidadeLegado(null),/LEGACY_ROWS_REQUIRED/);
});

const contactBatch = '11111111-1111-4111-8111-111111111111';
const contactRecord = () => ({
  nativeParent: { CODIGOCLIENTE: '0007', EMAIL: 'parent@example.invalid', ENDERECO: 'Incomplete source' },
  nativeKey: '0007', sourceSystem: 'SYNTHETIC',
  canonical: { id: '22222222-2222-4222-8222-222222222222', group_id: contactBatch,
    empresa_id: null, codigo_legado: '0007', source_system: 'SYNTHETIC', contatos: null },
  contacts34: [
    { CODIGOCLIENTE: '0007', SEQUENCIA: 1, TELEFCLIENTE: '001122', EMAIL: 'one@example.invalid',
      NOMECONTATO: 'SYNTHETIC one', CARGOSETOR: 'Compras', TIPO: 'WhatsApp', LOCALIDADE: 'Not an address' },
    { CODIGOCLIENTE: '0007', SEQUENCIA: 2, TELEFCLIENTE: '001122', NOMECONTATO: 'SYNTHETIC two' },
  ],
});
// Tests dependency injection/field isolation here; backend tests use the actual strict schema.
const contactOptions = { batchUUID: contactBatch,
  validateContact: value => ({ success: !Object.values(value).includes('INVALID') }) };

test('native contacts: exact approved fields, typed PK provenance and no inferred flags or address dependency', () => {
  const input = contactRecord(), before = structuredClone(input);
  const result = mapLegadoClienteContatos(input, contactOptions);
  assert.deepEqual(input, before); assert.equal(result.status, 'ready'); assert.equal(result.operationalImport, false);
  assert.equal(result.contatos.length, 4);
  const phones = result.contatos.filter(c => c.tipo === 'Telefone');
  assert.equal(phones.length, 2); assert.equal(phones[0].valor, phones[1].valor);
  assert.notEqual(phones[0].id, phones[1].id); assert.notEqual(phones[0].legacy_id, phones[1].legacy_id);
  assert.equal(new Set(result.contatos.map(c => c.id)).size, 4);
  for (const channel of result.contatos) {
    assert.match(channel.id, /^[a-f0-9]{64}$/);
    assert.equal(channel.migration_batch, contactBatch);
    for (const absent of ['principal', 'ativo', 'endereco', 'ramal']) assert.equal(Object.hasOwn(channel, absent), false);
    assert(['Telefone', 'E-mail'].includes(channel.tipo));
  }
  assert.deepEqual(result.provenance.find(p => p.table === 'ClientesTelefones' && p.field === 'TELEFCLIENTE').pk, ['0007', 1]);
  assert.deepEqual(mapLegadoClienteContatos({ ...input, contacts34: [...input.contacts34].reverse() }, contactOptions).contatos, result.contatos);
});

test('native contacts: per-field rejection retains other fields and prior canonical channels', () => {
  const input = contactRecord(), initial = mapLegadoClienteContatos(input, contactOptions);
  input.canonical.contatos = initial.contatos;
  input.contacts34[0].TELEFCLIENTE = 'INVALID'; input.contacts34[0].NOMECONTATO = 'INVALID';
  input.contacts34[0].CARGOSETOR = 'Financeiro';
  const result = mapLegadoClienteContatos(input, contactOptions);
  assert.equal(result.status, 'partial'); assert.equal(result.contatos.length, 4);
  const phone = initial.contatos.find(c => c.tipo === 'Telefone' && c.nome === 'SYNTHETIC one');
  assert.deepEqual(result.contatos.find(c => c.id === phone.id), phone);
  const email = result.contatos.find(c => c.tipo === 'E-mail' && c.valor === 'one@example.invalid');
  assert.equal(email.nome, 'SYNTHETIC one'); assert.equal(email.cargo, 'Compras');
  assert.deepEqual(result.contatos, initial.contatos);
  assert(result.quarentena.some(q => q.reason === 'CONTACT_EXISTING_CHANNEL_CONFLICT'));
  assert(result.quarentena.some(q => q.field === 'TELEFCLIENTE'));
  assert(result.quarentena.some(q => q.field === 'NOMECONTATO'));
  assert.equal(input.contacts34[0].TELEFCLIENTE, 'INVALID');
  const repeat = mapLegadoClienteContatos({ ...input, canonical: { ...input.canonical, contatos: result.contatos } }, contactOptions);
  assert.deepEqual(repeat.contatos, result.contatos);
});

test('native contacts: manual value/name/cargo survive reprocessing; conflict is explicit and new PK still appends', () => {
  for (const field of ['valor', 'nome', 'cargo']) {
    const input = contactRecord(), first = mapLegadoClienteContatos(input, contactOptions);
    const prior = structuredClone(first.contatos);
    const phone = prior.find(c => c.tipo === 'Telefone' && c.nome === 'SYNTHETIC one');
    phone[field] = `MANUAL ${field}`;
    phone.observacao = 'MANUAL note'; phone.principal = true; phone.ativo = false;
    input.canonical.contatos = prior;
    input.contacts34.push({ CODIGOCLIENTE: '0007', SEQUENCIA: 3, TELEFCLIENTE: '009988' });
    const before = structuredClone(input);
    const result = mapLegadoClienteContatos(input, contactOptions);
    assert.deepEqual(input, before);
    assert.equal(result.status, 'partial'); assert.equal(result.contatos.length, prior.length + 1);
    assert.deepEqual(result.contatos.slice(0, prior.length), prior, 'every pre-existing channel stays byte-for-value equivalent');
    assert.deepEqual(result.contatos.find(c => c.id === phone.id), phone);
    assert.equal(result.contatos.at(-1).valor, '009988');
    assert(result.quarentena.some(q => q.field === 'TELEFCLIENTE' && q.reason === 'CONTACT_EXISTING_CHANNEL_CONFLICT'));
    const again = mapLegadoClienteContatos({ ...input, canonical: { ...input.canonical, contatos: result.contatos } }, contactOptions);
    assert.deepEqual(again.contatos, result.contatos);
    assert(again.quarentena.some(q => q.reason === 'CONTACT_EXISTING_CHANNEL_CONFLICT'));
  }
});

test('native contacts: over 200 or conflicting native PK is whole-client pending without truncation', () => {
  const input = contactRecord();
  input.nativeParent.EMAIL = null;
  input.contacts34 = Array.from({ length: 200 }, (_, i) => ({ CODIGOCLIENTE: '0007', SEQUENCIA: i, TELEFCLIENTE: '001122' }));
  assert.equal(mapLegadoClienteContatos(input, contactOptions).contatos.length, 200);
  input.contacts34.push({ CODIGOCLIENTE: '0007', SEQUENCIA: 200, TELEFCLIENTE: '001122' });
  const overflow = mapLegadoClienteContatos(input, contactOptions);
  assert.equal(overflow.status, 'pending'); assert.equal(Object.hasOwn(overflow, 'contatos'), false);
  assert.equal(overflow.proposedCount, 201); assert(overflow.reasons.includes('CONTACT_LIMIT_EXCEEDED'));
  for (const contacts34 of [[input.contacts34[0], input.contacts34[0]],
    [{ ...input.contacts34[0], CODIGOCLIENTE: 7 }]]) {
    const result = mapLegadoClienteContatos({ ...input, contacts34 }, contactOptions);
    assert.equal(result.status, 'pending'); assert.equal(Object.hasOwn(result, 'contatos'), false);
  }
});

test('native contacts: missing baseline/binding/validator rejects; no valid channels never clears contacts', () => {
  const input = contactRecord();
  assert.throws(() => mapLegadoClienteContatos(input, { batchUUID: contactBatch }), /CONTACT_VALIDATOR_REQUIRED/);
  assert.throws(() => mapLegadoClienteContatos(input, { ...contactOptions, batchUUID: 'bad' }), /CONTACT_BATCH_UUID_REQUIRED/);
  for (const delta of [{ nativeKey: 7 }, { sourceSystem: 'OTHER' },
    { canonical: { ...input.canonical, empresa_id: contactBatch } }]) {
    assert.throws(() => mapLegadoClienteContatos({ ...input, ...delta }, contactOptions), /CONTACT_NATIVE_CANONICAL_BINDING_REQUIRED/);
  }
  assert.throws(() => mapLegadoClienteContatos({ ...input, canonical: { ...input.canonical, contatos: undefined } }, contactOptions),
    /CONTACT_COMPLETE_BASELINE_REQUIRED/);
  const result = mapLegadoClienteContatos({ ...input, nativeParent: { CODIGOCLIENTE: '0007', EMAIL: null },
    contacts34: [{ CODIGOCLIENTE: '0007', SEQUENCIA: 1, NOMECONTATO: 'SYNTHETIC only name' }] }, contactOptions);
  assert.equal(result.status, 'pending'); assert.equal(Object.hasOwn(result, 'contatos'), false);
  assert(result.quarentena.some(q => q.field === 'NOMECONTATO'));
  const baseline = mapLegadoClienteContatos(input, contactOptions).contatos;
  const mismatched = structuredClone(baseline); mismatched[0].codigo_legado = 'OTHER';
  const conflict = mapLegadoClienteContatos({ ...input, canonical: { ...input.canonical, contatos: mismatched } }, contactOptions);
  assert(conflict.reasons.includes('CONTACT_IDENTITY_CONFLICT')); assert.equal(Object.hasOwn(conflict, 'contatos'), false);
  const principals = baseline.map(c => ({ ...c, principal: true }));
  assert.throws(() => mapLegadoClienteContatos({ ...input, canonical: { ...input.canonical, contatos: principals } }, contactOptions),
    /CONTACT_CANONICAL_BASELINE_INVALID/);
});
