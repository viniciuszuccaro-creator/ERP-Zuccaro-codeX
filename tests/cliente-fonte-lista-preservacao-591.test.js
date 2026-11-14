/**
 * #591 — origem da lista Cliente ≠ contagem API; locais_entrega omit-if-unknown.
 * Sem dados reais.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('HTTP MASTER extras preserve loaded values, omission and explicit null without inventing or truncating', async () => {
  const { toClienteMasterHttpPayload, hydrateClienteHttpRowForUi, CLIENTE_MASTER_EXTRA_KEYS } = await import('../src/api/clienteHttpPayload.js');
  const fields = { rg: '000123-X', numero_caixa_postal: '00017', cep_caixa_postal: '01234000',
    caixa_postal_cobranca: '0009', inscricao_produtor_rural: '0000123' };
  assert.deepEqual(CLIENTE_MASTER_EXTRA_KEYS, Object.keys(fields));
  const source = { id: 'synthetic', nome: 'SYNTHETIC', ...fields }, before = structuredClone(source);
  const hydrated = hydrateClienteHttpRowForUi(source);
  const wire = toClienteMasterHttpPayload(hydrated, { mode: 'update' });
  for (const [key,value] of Object.entries(fields)) assert.equal(wire[key], value);
  assert.deepEqual(source,before);
  for (const key of CLIENTE_MASTER_EXTRA_KEYS) {
    for (const value of [undefined,'']) assert.equal(Object.hasOwn(toClienteMasterHttpPayload({ [key]: value }),key),false);
    assert.equal(toClienteMasterHttpPayload({ [key]: '   ' })[key],'   ','explicit invalid whitespace must reach canonical validation, not disappear');
    assert.equal(toClienteMasterHttpPayload({ [key]: null })[key],null);
    const invalid='x'.repeat(200);
    assert.equal(toClienteMasterHttpPayload({ [key]: invalid })[key],invalid,'canonical backend must reject invalid values, never front-end truncation');
  }
  assert.throws(()=>toClienteMasterHttpPayload({ vendedor_responsavel_id: 'unproven-link' }),e=>e.status===422);
});

test('V24 Cliente: banner e empty distinguem fonte local / piloto off / erro', () => {
  const src = read('src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx');
  assert.match(src, /isHttpClienteListMode/);
  assert.match(src, /clienteHttpSemPiloto/);
  assert.match(src, /clienteFonteLocalOnly/);
  assert.match(src, /data-fonte-dados="http-piloto-cliente-off"/);
  assert.match(src, /data-fonte-estado="erro-api"/);
  assert.match(src, /Erro ao carregar dados/);
  assert.match(src, /Modo local — store local vazio/);
  assert.match(src, /!clienteHttpSemPiloto/);
});

test('CadastroClienteCompleto: locais/contatos/documentos omitidos quando ausentes (não wipe)', () => {
  const src = read('src/components/cadastros/CadastroClienteCompleto.jsx');
  assert.match(src, /data\.locais_entrega === undefined/);
  assert.match(src, /record\.locais_entrega === undefined/);
  assert.match(src, /data\.contatos === undefined/);
  assert.match(src, /data\.documentos === undefined/);
  assert.match(src, /record\.documentos === undefined/);
  assert.match(src, /data-pendencia="cliente-parcial"/);
  assert.match(src, /contatosViewForUi/);
  assert.match(src, /data-fonte="contatos-escalares-http"/);
  assert.match(src, /push\("Celular", formData\.celular\)/);
  assert.doesNotMatch(src, /push\("WhatsApp", formData\.celular\)/);
  assert.doesNotMatch(
    src,
    /locais_entrega: Array\.isArray\(data\.locais_entrega\) \? data\.locais_entrega\.slice\(0, 50\)\.map\(sanitizeEndereco\) : \[\],\n    condicao_comercial/,
  );
  // CPF/CNPJ/CEP: sanitizeCode preserva dígitos como string (zeros à esquerda)
  assert.match(src, /const sanitizeCode = \(value, max = 80\) => String\(value \?\? ""\)/);
  assert.doesNotMatch(src, /Number\(data\.cpf\)|parseInt\(data\.cpf|Number\(data\.cnpj\)|Number\(.*\.cep/);
});

test('useCadastrosAllCounts: sem contexto → missing ALL (não 0 fabricado)', () => {
  const src = read('src/components/cadastros/hooks/useCadastrosAllCounts.jsx');
  assert.match(src, /if \(!contextoValido\)/);
  assert.match(src, /missing: ALL_ENTITIES\.slice\(\)/);
  assert.doesNotMatch(src, /emptyCadastrosCounts\(\)/);
});

test('runtimeBackend: isHttpClienteListEnabled alinhado ao piloto', () => {
  const { isHttpClienteListEnabled, resolveHttpPilotEntities } = require('../src/api/runtimeBackend.js');
  assert.equal(isHttpClienteListEnabled({ VITE_ERP_BACKEND: 'http', VITE_ERP_HTTP_CLIENTE: 'true' }), true);
  assert.equal(
    resolveHttpPilotEntities({ VITE_ERP_BACKEND: 'http', VITE_ERP_HTTP_CLIENTE: 'true' }).includes('Cliente'),
    true,
  );
  assert.equal(
    resolveHttpPilotEntities({ VITE_ERP_BACKEND: 'http' }).includes('Cliente'),
    false,
  );
});

test('Formulário Cliente: abas contatos/endereços canônicas (não texto único)', () => {
  const src = read('src/components/cadastros/CadastroClienteCompleto.jsx');
  assert.match(src, /GerenciarContatosClienteForm/);
  assert.match(src, /GerenciarEnderecosClienteForm/);
  assert.match(src, /value="contatos"/);
  assert.match(src, /value="enderecos"/);
  assert.match(src, /value="anexos"/); // aba Documentos/anexos canônica
  assert.match(src, /Upload de Documentos/);
  const contatos = read('src/components/cadastros/GerenciarContatosClienteForm.jsx');
  assert.match(contatos, /SelectItem value="Telefone"/);
  assert.match(contatos, /SelectItem value="Celular"/);
  assert.match(contatos, /SelectItem value="WhatsApp"/);
  assert.match(contatos, /tipo: "Telefone"/);
  assert.doesNotMatch(contatos, /tipo: "WhatsApp"/); // default ≠ WhatsApp
  const end = read('src/components/cadastros/GerenciarEnderecosClienteForm.jsx');
  assert.match(end, /SelectItem value="Entrega"/);
  assert.match(end, /SelectItem value="Cobrança"/);
});

test('sanitizeCode preserva zeros à esquerda (CPF/CNPJ/CEP sintéticos)', () => {
  const src = read('src/components/cadastros/CadastroClienteCompleto.jsx');
  const match = src.match(
    /const sanitizeCode = \(value, max = 80\) => ([^;]+);/,
  );
  assert.ok(match, 'sanitizeCode localizável');
  const sanitizeCode = new Function('value', 'max', `return (${match[1]});`);
  assert.equal(sanitizeCode('01234567890', 18), '01234567890');
  assert.equal(sanitizeCode('00.000.000/0001-91', 24), '00.000.000/0001-91');
  assert.equal(sanitizeCode('01310-100', 12), '01310-100');
});

test('HTTP Cliente MASTER: lacunas explícitas (sem storage paralelo)', () => {
  const payload = read('src/api/clienteHttpPayload.js');
  assert.match(payload, /ALLOWED_KEYS/);
  assert.match(payload, /'contatos'/);
  assert.match(payload, /CONTATOS_SCALAR_OVERFLOW/);
  assert.match(payload, /CLIENTE_HTTP_UNSUPPORTED_FIELDS/);
  assert.match(payload, /assertClienteHttpRichFieldsWritable/);
  assert.match(payload, /NÃO injeta `contatos` fabricados/);
  // ALLOWED_KEYS não lista locais/documentos (fail-closed se não vazios)
  assert.doesNotMatch(payload, /ALLOWED_KEYS = \[[^\]]*'locais_entrega'/s);
  assert.doesNotMatch(payload, /ALLOWED_KEYS = \[[^\]]*'documentos'/s);
  assert.match(payload, /tipo: 'Celular'/);
  assert.doesNotMatch(payload, /tipo: 'WhatsApp', valor: celular/);
  assert.match(payload, /return 'whatsapp'/);
});
