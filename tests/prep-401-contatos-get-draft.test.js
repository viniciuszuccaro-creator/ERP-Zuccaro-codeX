import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

test('prep #401: Contatos adapter usa getInContext(Cliente) e bind fail-closed', () => {
  const src = read('src/components/comercial/GerenciarContatosCliente.jsx');
  // get-by-id canônico via getInContext (não filter({id}) — fachada HTTP não transmite id).
  assert.match(src, /getInContext\(\s*["']Cliente["']\s*,\s*clienteId\s*\)/);
  assert.match(src, /updateInContext\(\s*["']Cliente["']/);
  assert.doesNotMatch(src, /Cliente\.filter\(\{\s*id:\s*clienteId\s*\}\)/);
  assert.doesNotMatch(src, /entities\.Cliente\.get\(/);
  assert.doesNotMatch(src, /entities\.Cliente\.update\(/);
  assert.match(src, /actorId/);
  assert.match(src, /READ_STALE_SCOPE/);
  assert.match(src, /data-contatos-read-empty/);
  assert.match(src, /GerenciarContatosClienteForm/);
});

test('prep #401: Completo draft≠saveMutation; Forms commitMode+sync-lock', () => {
  const completo = read('src/components/cadastros/CadastroClienteCompleto.jsx');
  assert.match(completo, /applyContatosDraft/);
  assert.match(completo, /commitMode="draft"/);
  assert.match(completo, /saveMutation/);
  const contatos = read('src/components/cadastros/GerenciarContatosClienteForm.jsx');
  assert.match(contatos, /persistInFlightRef/);
  assert.match(contatos, /commitMode = "backend"/);
  const enderecos = read('src/components/cadastros/GerenciarEnderecosClienteForm.jsx');
  assert.match(enderecos, /persistInFlightRef/);
  assert.match(enderecos, /commitMode = "backend"/);
});
