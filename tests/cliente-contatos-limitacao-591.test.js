/**
 * #591 — Completo: contatos[] MASTER (decisão a); cadastral≠entrega; Sem ContatoClienteV2.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const completo = fs.readFileSync('src/components/cadastros/CadastroClienteCompleto.jsx', 'utf8');
const enderecos = fs.readFileSync('src/components/cadastros/GerenciarEnderecosClienteForm.jsx', 'utf8');
const contatosForm = fs.readFileSync('src/components/cadastros/GerenciarContatosClienteForm.jsx', 'utf8');
const hydrate = fs.readFileSync('src/api/clienteHttpPayload.js', 'utf8');

test('Completo: contrato contatos[] MASTER (a) + Celular ≠ WhatsApp + Sem ContatoClienteV2', () => {
  assert.match(completo, /data-fonte="contatos-jsonb-http"/);
  assert.match(completo, /data-contrato="contatos-array-master"/);
  assert.match(completo, /Celular ≠ WhatsApp/);
  assert.match(completo, /Sem ContatoClienteV2/);
  assert.match(completo, /ContatoB2B FK/);
  assert.doesNotMatch(completo, /function ContatoClienteV2|import ContatoClienteV2/);
  assert.doesNotMatch(completo, /data-fonte="contatos-limitacao-http"/);
  assert.doesNotMatch(completo, /pack a\/b\/c/);
});

test('Endereços (form): Outro único + Completo toast BATCH_ATOMIC ≠ integral (peels Completo intacto)', () => {
  // Regras UI Outro único vivem no form (não no Completo peels stage48).
  assert.match(enderecos, /data-regra="outro-unico"/);
  assert.match(enderecos, /Tipo Outro é único por cliente/);
  assert.match(completo, /BATCH_ATOMIC=false/);
  assert.match(completo, /não é salvamento integral/);
  assert.doesNotMatch(completo, /data-fonte="cliente-locais-regras-ui"/);
});

test('Completo: negativo — não presume ContatoB2B equivalente nem storage paralelo', () => {
  assert.doesNotMatch(completo, /entities\.ContatoB2B|from ['"].*ContatoB2B/);
  assert.doesNotMatch(completo, /function ContatoClienteV2|import ContatoClienteV2|documentosClienteParalelo|contatosStorageLocal/);
  assert.match(completo, /GerenciarContatosClienteForm/);
  assert.match(completo, /omit-if-unknown|Omitir no save/);
});

test('Completo: quarentena de canal inválido não aparece como contato válido', () => {
  assert.match(completo, /data-fonte="contatos-quarentena"/);
  assert.match(completo, /partitionContatosByCanal/);
  assert.match(completo, /isContatoCanalCanonico/);
  assert.match(completo, /não exibidos como contato válido/);
});

test('GerenciarContatos: UI declara Celular ≠ WhatsApp (sem conversão automática)', () => {
  assert.match(contatosForm, /data-regra="celular-nao-whatsapp"/);
  assert.match(contatosForm, /Celular ≠ WhatsApp/);
  assert.match(contatosForm, /não há conversão automática/);
  assert.match(contatosForm, /data-block="contato-dialog-fields"/);
  // Campos do dialog também respeitam persistBusy (não só Salvar).
  assert.match(contatosForm, /disabled=\{bloqueado \|\| !podeEditar\}/);
  // Overlay/ESC não fecha dialog durante persistBusy.
  assert.match(contatosForm, /if \(!open && bloqueado\) return/);
});

test('Completo: anexos distinguem identificação MASTER de documentos[]', () => {
  assert.match(completo, /data-fonte="documentos-limitacao-http"/);
  assert.match(completo, /Documento de identificação/);
  assert.match(completo, /ModeloDocumento/);
});

test('GerenciarEnderecos: Cadastral/Fiscal explícitos na UI', () => {
  assert.match(enderecos, /SelectItem value="Cadastral"/);
  assert.match(enderecos, /SelectItem value="Fiscal"/);
  assert.match(enderecos, /data-regra="cadastral-fiscal-nao-entrega"/);
  assert.match(enderecos, /Cadastral\/Fiscal ≠ Entrega/);
  // Sem duplicata de opção Outro no select.
  assert.equal((enderecos.match(/SelectItem value="Outro"/g) || []).length, 1);
  // Outro único: UI + save fail-closed (não segundo Outro).
  assert.match(enderecos, /data-regra="outro-unico"/);
  assert.match(enderecos, /Tipo Outro é único por cliente/);
  assert.match(enderecos, /Já existe um endereço do tipo Outro/);
  assert.match(enderecos, /idx !== enderecoEditando/);
  // Cancelar/Salvar respeitam persistBusy (paridade Contatos).
  assert.match(enderecos, /disabled=\{bloqueado\}/);
  assert.match(enderecos, /disabled=\{bloqueado \|\| !podeEditar\}/);
  assert.match(enderecos, /data-block="endereco-dialog-fields"/);
  assert.match(enderecos, /if \(!open && bloqueado\) return/);
});

test('hydrate: documento→cpf/cnpj preserva string (zeros); tipo PF/PJ', () => {
  assert.match(hydrate, /hydrateClienteHttpRowForUi/);
  assert.match(hydrate, /record\.cpf = doc/);
  assert.match(hydrate, /record\.cnpj = doc/);
  assert.match(hydrate, /Pessoa Física/);
  assert.match(hydrate, /Pessoa Jurídica/);
});

test('payload: contatos[] em ALLOWED_KEYS; WhatsApp ≠ celular', () => {
  assert.match(hydrate, /'contatos'/);
  assert.match(hydrate, /return 'whatsapp'/);
  assert.doesNotMatch(hydrate, /includes\('whats'\) return 'celular'/);
  assert.match(hydrate, /sanitizeContatosForHttp/);
  assert.match(hydrate, /partitionContatosByCanal/);
});
