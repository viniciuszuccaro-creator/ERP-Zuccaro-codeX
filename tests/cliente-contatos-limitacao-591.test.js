/**
 * #591 — Completo declara limitação contatos/docs HTTP; cadastral≠entrega.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const completo = fs.readFileSync('src/components/cadastros/CadastroClienteCompleto.jsx', 'utf8');
const enderecos = fs.readFileSync('src/components/cadastros/GerenciarEnderecosClienteForm.jsx', 'utf8');
const hydrate = fs.readFileSync('src/api/clienteHttpPayload.js', 'utf8');

test('Completo: banner limitação contatos ricos + proíbe ContatoClienteV2', () => {
  assert.match(completo, /data-fonte="contatos-limitacao-http"/);
  assert.match(completo, /data-pendencia="contatos-ricos-bff"/);
  assert.match(completo, /Celular ≠ WhatsApp/);
  assert.match(completo, /Sem ContatoClienteV2/);
  assert.doesNotMatch(completo, /function ContatoClienteV2|import ContatoClienteV2/);
});

test('Completo: anexos distinguem identificação MASTER de documentos[]', () => {
  assert.match(completo, /data-fonte="documentos-limitacao-http"/);
  assert.match(completo, /Documento de identificação/);
  assert.match(completo, /ModeloDocumento/);
});

test('GerenciarEnderecos: Cadastral/Fiscal explícitos na UI', () => {
  assert.match(enderecos, /SelectItem value="Cadastral"/);
  assert.match(enderecos, /SelectItem value="Fiscal"/);
});

test('hydrate: documento→cpf/cnpj preserva string (zeros); tipo PF/PJ', () => {
  assert.match(hydrate, /hydrateClienteHttpRowForUi/);
  assert.match(hydrate, /record\.cpf = doc/);
  assert.match(hydrate, /record\.cnpj = doc/);
  assert.match(hydrate, /Pessoa Física/);
  assert.match(hydrate, /Pessoa Jurídica/);
  assert.match(hydrate, /Cadastral\/Fiscal ≠ Entrega/);
});

test('JobAgendado: windowMode sky chrome (fora reservas)', () => {
  const job = fs.readFileSync('src/components/cadastros/JobAgendadoForm.jsx', 'utf8');
  assert.match(job, /from-sky-50 to-sky-100/);
  assert.match(job, /data-cadastro-visual="sky-job-agendado"/);
});
