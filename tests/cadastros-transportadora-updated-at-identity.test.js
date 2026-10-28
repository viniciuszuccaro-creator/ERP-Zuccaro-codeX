/**
 * #353 recuperação — forms RecordState: identidade de reopen reconhece updated_at HTTP.
 * Mantém useCadastroRecordState (pins callback); só corrige a chave que ignorava refresh canônico.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const TRANSPORTADORA = new URL('../src/components/cadastros/TransportadoraForm.jsx', import.meta.url);
const PRODUTO = new URL('../src/components/cadastros/ProdutoForm.jsx', import.meta.url);
const DESPESA = new URL('../src/components/cadastros/ConfiguracaoDespesaRecorrenteForm.jsx', import.meta.url);

test('TransportadoraForm: identidade usa updated_at ?? updated_date (não só updated_date)', async () => {
  const src = await readFile(TRANSPORTADORA, 'utf8');
  assert.match(src, /useCadastroRecordState/);
  assert.match(
    src,
    /transportadora\?\.updated_at\s*\?\?\s*transportadora\?\.updated_date/,
  );
  assert.doesNotMatch(
    src,
    /JSON\.stringify\(\[\s*transportadora\?\.id\s*\?\?\s*null,\s*transportadora\?\.updated_date\s*\?\?\s*null/,
  );
});

test('TransportadoraForm: preserva payload owner e CadastroCodigoRegistroField', async () => {
  const src = await readFile(TRANSPORTADORA, 'utf8');
  assert.match(src, /codigo-registro-transportadora/);
  assert.match(src, /CadastroCodigoRegistroField/);
  assert.match(src, /podeCriar/);
  assert.match(src, /podeEditar/);
  assert.match(src, /contextoValido/);
});

test('ProdutoForm: identidade usa updated_at ?? updated_date (não só updated_date)', async () => {
  const src = await readFile(PRODUTO, 'utf8');
  assert.match(src, /useCadastroRecordState/);
  assert.match(
    src,
    /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/,
  );
});

test('ConfiguracaoDespesaRecorrenteForm: identidade usa updated_at ?? updated_date', async () => {
  const src = await readFile(DESPESA, 'utf8');
  assert.match(src, /useCadastroRecordState/);
  assert.match(
    src,
    /config\?\.updated_at\s*\?\?\s*config\?\.updated_date/,
  );
});

test('Config forms Bloco integração: identidade usa updated_at ?? updated_date', async () => {
  const files = [
    ['ConfiguracaoBoletosForm.jsx', /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/],
    ['ConfiguracaoWhatsAppForm.jsx', /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/],
    ['ConfiguracaoIntegracaoForm.jsx', /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/],
    ['ConfiguracaoNFeForm.jsx', /config\?\.updated_at\s*\?\?\s*config\?\.updated_date/],
  ];
  for (const [name, re] of files) {
    const src = await readFile(new URL(`../src/components/cadastros/${name}`, import.meta.url), 'utf8');
    assert.match(src, /useCadastroRecordState/);
    assert.match(src, re, name);
  }
});

test('Cliente comercial (fluxo diário): identidade updated_at ?? updated_date', async () => {
  const files = [
    ['ClienteForm.jsx', /cliente\?\.updated_at\s*\?\?\s*cliente\?\.updated_date/],
    ['ClienteFormCompleto.jsx', /cliente\?\.updated_at\s*\?\?\s*cliente\?\.updated_date/],
  ];
  for (const [name, re] of files) {
    const src = await readFile(new URL(`../src/components/comercial/${name}`, import.meta.url), 'utf8');
    assert.match(src, re, name);
  }
});

test('Matriz início de uso RecordState: identidade updated_at ?? updated_date', async () => {
  // Fora de #398–#400 (ApiExterna / ParametroRoteirizacao / ChatbotCanal).
  const files = [
    ['TabelaPrecoForm.jsx', /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/],
    ['CadastroFiscalForm.jsx', /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/],
    ['GrupoEmpresarialForm.jsx', /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/],
    ['UsuarioForm.jsx', /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/],
    ['WebhookForm.jsx', /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/],
    ['GatewayPagamentoForm.jsx', /gateway\?\.updated_at\s*\?\?\s*gateway\?\.updated_date/],
    ['EventoNotificacaoForm.jsx', /evento\?\.updated_at\s*\?\?\s*evento\?\.updated_date/],
    ['ChatbotIntentForm.jsx', /chatbotIntent\?\.updated_at\s*\?\?\s*chatbotIntent\?\.updated_date/],
    ['ModeloDocumentoForm.jsx', /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/],
    ['CentroOperacaoForm.jsx', /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/],
    ['TabelaFiscalForm.jsx', /tabela\?\.updated_at\s*\?\?\s*tabela\?\.updated_date/],
    ['ParametroCaixaDiarioForm.jsx', /parametro\?\.updated_at\s*\?\?\s*parametro\?\.updated_date/],
    ['ParametroPortalClienteForm.jsx', /parametro\?\.updated_at\s*\?\?\s*parametro\?\.updated_date/],
    ['ParametroRecebimentoNFeForm.jsx', /parametro\?\.updated_at\s*\?\?\s*parametro\?\.updated_date/],
    ['ParametroConciliacaoBancariaForm.jsx', /parametro\?\.updated_at\s*\?\?\s*parametro\?\.updated_date/],
    ['ParametroOrigemPedidoForm.jsx', /parametro\?\.updated_at\s*\?\?\s*parametro\?\.updated_date/],
    ['PerfilAcessoForm.jsx', /perfil\?\.updated_at\s*\?\?\s*perfil\?\.updated_date/],
  ];
  for (const [name, re] of files) {
    const src = await readFile(new URL(`../src/components/cadastros/${name}`, import.meta.url), 'utf8');
    assert.match(src, /useCadastroRecordState/, name);
    assert.match(src, re, name);
  }
});
