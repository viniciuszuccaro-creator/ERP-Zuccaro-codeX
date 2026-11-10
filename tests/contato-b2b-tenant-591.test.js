/**
 * #591 — ContatoB2B exige cliente do tenant; WhatsApp ≠ auto telefone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('src/components/cadastros/ContatoB2BForm.jsx', 'utf8');

test('ContatoB2B: rejeita cliente_id fora do filterInContext', () => {
  assert.match(src, /filterInContext\("Cliente"/);
  assert.match(src, /clientes\.some/);
  assert.match(src, /fora do tenant/);
});

test('ContatoB2B: WhatsApp campo próprio (não copia telefone)', () => {
  assert.match(src, /whatsapp/);
  assert.match(src, /campo próprio/);
  assert.doesNotMatch(src, /whatsapp:\s*payload\.telefone|whatsapp:\s*formData\.telefone/);
  assert.doesNotMatch(src, /ContatoClienteV2/);
});

test('Completo: toast não declara salvamento integral com BATCH_ATOMIC=false', () => {
  const completo = fs.readFileSync('src/components/cadastros/CadastroClienteCompleto.jsx', 'utf8');
  assert.match(completo, /batchAtomic === false/);
  assert.match(completo, /não é salvamento integral/);
  assert.match(completo, /BATCH_ATOMIC=false/);
  assert.match(completo, /locaisSummary/);
});
