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
  const contatos = read('src/components/cadastros/GerenciarContatosClienteForm.jsx');
  assert.match(contatos, /SelectItem value="Telefone"/);
  assert.match(contatos, /SelectItem value="WhatsApp"/);
  assert.match(contatos, /tipo: "Telefone"/);
  const end = read('src/components/cadastros/GerenciarEnderecosClienteForm.jsx');
  assert.match(end, /SelectItem value="Entrega"/);
  assert.match(end, /SelectItem value="Cobrança"/);
});
