import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertConversaOnCreate,
  ingestCanalExterno,
  matchClientePorContato,
  resolveSessaoEstavel,
} from '../src/components/lib/atendimentoConversaPolicy.js';

test('conversa de atendimento exige empresa', () => {
  assert.throws(
    () => assertConversaOnCreate({ record: { canal: 'WhatsApp', sessao_id: 's1' }, conversas: [], clientes: [] }),
    /Empresa obrigatoria/,
  );
});

test('retry do mesmo canal e sessao reusa a conversa aberta', () => {
  const existing = { id: 'c1', empresa_id: 'e1', canal: 'WhatsApp', sessao_id: 's1', status: 'Aguardando' };
  const decision = assertConversaOnCreate({
    record: { empresa_id: 'e1', canal: 'WhatsApp', sessao_id: 's1' },
    conversas: [existing],
    clientes: [],
  });
  assert.equal(decision.reuse.id, 'c1');
});

test('identifica cliente pelo telefone', () => {
  const cliente = matchClientePorContato(
    [{ id: 'cli-1', nome: 'Ana', telefone: '(11) 98888-0000' }],
    { cliente_telefone: '11988880000' },
  );
  assert.equal(cliente.id, 'cli-1');
});

test('webhook externo vira conversa aguardando humano', () => {
  const inbound = ingestCanalExterno({
    payload: { text: 'Quero minha NF', from: '11988880000', name: 'Ana' },
    canal: 'WhatsApp',
    empresaId: 'e1',
    groupId: 'g1',
  });
  assert.equal(inbound.conversa.status, 'Aguardando');
  assert.equal(inbound.conversa.tipo_atendimento, 'Humano');
  assert.equal(inbound.mensagem.mensagem, 'Quero minha NF');
  assert.equal(inbound.conversa.cliente_telefone, '11988880000');
});

test('sessao do widget nao usa relogio quando o cliente e conhecido', () => {
  const primeira = resolveSessaoEstavel({ canal: 'Portal', clienteId: 'cli-1', empresaId: 'e1' });
  const segunda = resolveSessaoEstavel({ canal: 'Portal', clienteId: 'cli-1', empresaId: 'e1' });
  assert.equal(primeira, 'session-Portal-cli-1');
  assert.equal(segunda, primeira);
  assert.doesNotMatch(primeira, /Date\.now/);
});

test('hub e webhook persistem canal externo no atendimento existente', async () => {
  const tester = await readFile(new URL('../src/components/chatbot/WebhooksTester.jsx', import.meta.url), 'utf8');
  const hub = await readFile(new URL('../src/pages/HubAtendimento.jsx', import.meta.url), 'utf8');
  const widget = await readFile(new URL('../src/components/chatbot/ChatbotWidget.jsx', import.meta.url), 'utf8');
  assert.match(tester, /ingestCanalExterno/);
  assert.match(tester, /createInContext\('ConversaOmnicanal'/);
  assert.match(hub, /useState\("Todas"\)/);
  assert.match(hub, /Conversa assumida por atendente humano/);
  assert.match(widget, /resolveSessaoEstavel/);
  assert.doesNotMatch(widget, /atendentes\.length === 0/);
});
