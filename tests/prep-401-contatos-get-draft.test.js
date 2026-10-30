import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

test('prep #401: Contatos adapter usa Cliente.get e bind fail-closed', () => {
  const src = read('src/components/comercial/GerenciarContatosCliente.jsx');
  assert.match(src, /Cliente\.get\(clienteId\)/);
  assert.doesNotMatch(src, /Cliente\.filter\(\{\s*id:\s*clienteId\s*\}\)/);
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
