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
  assert.match(src, /toast\.error/);
  assert.doesNotMatch(src, /\balert\(/);
});

test('ContatoB2B: WhatsApp campo próprio (não copia telefone)', () => {
  assert.match(src, /whatsapp/);
  assert.match(src, /campo próprio/);
  assert.match(src, /data-regra="whatsapp-campo-proprio"/);
  assert.doesNotMatch(src, /whatsapp:\s*payload\.telefone|whatsapp:\s*formData\.telefone/);
  assert.doesNotMatch(src, /function ContatoClienteV2|import ContatoClienteV2/);
});

test('ContatoB2B: banner FK ausente — Completo (b) bloqueada sem wire paralelo', () => {
  assert.match(src, /data-pendencia="contatob2b-fk-ausente"/);
  assert.match(src, /data-regra="contatob2b-completo-bloqueado"/);
  assert.match(src, /\(b\) bloqueada/);
  assert.match(src, /cliente_id/);
  assert.match(src, /empresa_id/);
  assert.match(src, /Sem ContatoClienteV2/);
  assert.doesNotMatch(src, /function ContatoClienteV2|import ContatoClienteV2|contatosStorageLocal/);
});

test('Completo: toast não declara salvamento integral com BATCH_ATOMIC=false', () => {
  const completo = fs.readFileSync('src/components/cadastros/CadastroClienteCompleto.jsx', 'utf8');
  assert.match(completo, /batchAtomic === false/);
  assert.match(completo, /não é salvamento integral/);
  assert.match(completo, /BATCH_ATOMIC=false/);
  assert.match(completo, /locaisSummary/);
});
