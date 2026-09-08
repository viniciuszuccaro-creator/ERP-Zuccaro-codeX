import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertConversaOnCreate,
  buildAssumirConversa,
  buildEscalarParaHub,
  buildFecharConversa,
  buildTransferirConversa,
  ingestCanalExterno,
  matchClientePorContato,
  ordenarFilaAtendimento,
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

test('canal inativo bloqueia ingestao', () => {
  assert.throws(
    () => ingestCanalExterno({
      payload: { text: 'Oi', from: '11999990000' },
      canal: 'WhatsApp',
      empresaId: 'e1',
      configs: [{ canal: 'WhatsApp', empresa_id: 'e1', ativo: false }],
    }),
    /inativo/,
  );
});

test('assumir transferir e fechar sao idempotentes no ciclo de vida', () => {
  const conversa = {
    id: 'c1',
    empresa_id: 'e1',
    status: 'Aguardando',
    canal: 'WhatsApp',
    sessao_id: 's1',
  };
  const user = { id: 'u1', full_name: 'Ana' };
  const first = buildAssumirConversa({ conversa, user, empresaId: 'e1' });
  assert.equal(first.reuse, false);
  assert.equal(first.patch.status, 'Em Progresso');
  const again = buildAssumirConversa({
    conversa: { ...conversa, ...first.patch },
    user,
    empresaId: 'e1',
  });
  assert.equal(again.reuse, true);

  const transfer = buildTransferirConversa({
    conversa: { ...conversa, ...first.patch },
    user,
    tipo: 'fila',
    nota: 'volta fila',
    empresaId: 'e1',
  });
  assert.equal(transfer.patch.status, 'Não Atribuída');
  const transferRetry = buildTransferirConversa({
    conversa: { ...conversa, ...first.patch, ...transfer.patch },
    user,
    tipo: 'fila',
    nota: 'volta fila',
    empresaId: 'e1',
  });
  assert.equal(transferRetry.reuse, true);

  const close = buildFecharConversa({
    conversa: { ...conversa, status: 'Em Progresso' },
    user,
    empresaId: 'e1',
  });
  assert.equal(close.patch.status, 'Resolvida');
  const closeAgain = buildFecharConversa({
    conversa: { ...conversa, ...close.patch },
    user,
    empresaId: 'e1',
  });
  assert.equal(closeAgain.reuse, true);
});

test('fila prioriza urgente e escala chatbot cria conversa no hub', () => {
  const ordered = ordenarFilaAtendimento([
    { id: '1', status: 'Aguardando', prioridade: 'Normal', transferido_em: '2026-01-01T10:00:00Z' },
    { id: '2', status: 'Não Atribuída', prioridade: 'Urgente', transferido_em: '2026-01-01T12:00:00Z' },
    { id: '3', status: 'Resolvida', prioridade: 'Urgente', transferido_em: '2026-01-01T09:00:00Z' },
  ]);
  assert.equal(ordered[0].id, '2');
  assert.equal(ordered.length, 2);

  const escalado = buildEscalarParaHub({
    sessaoId: 'session-Portal-cli-1',
    empresaId: 'e1',
    groupId: 'g1',
    canal: 'Portal',
    cliente: { id: 'cli-1', nome: 'Ana' },
    mensagem: 'quero atendente',
    sentimento: { tipo: 'Frustrado', frustrado: true },
  });
  assert.equal(escalado.conversa.status, 'Aguardando');
  assert.equal(escalado.conversa.prioridade, 'Urgente');
  assert.match(escalado.mensagem.mensagem, /Transbordo/);
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
  const fila = await readFile(new URL('../src/components/chatbot/ChatbotFilaEspera.jsx', import.meta.url), 'utf8');
  const chatbot = await readFile(new URL('../src/pages/ChatbotAtendimento.jsx', import.meta.url), 'utf8');
  assert.match(tester, /ingestCanalExterno/);
  assert.match(tester, /createInContext\('ConversaOmnicanal'/);
  assert.match(tester, /ConfiguracaoCanal/);
  assert.doesNotMatch(tester, /!canalConfig\?\.webhook_url/);
  assert.match(hub, /buildAssumirConversa/);
  assert.match(hub, /buildFecharConversa/);
  assert.match(hub, /Conversa assumida por atendente humano/);
  assert.match(widget, /resolveSessaoEstavel/);
  assert.doesNotMatch(widget, /atendentes\.length === 0/);
  assert.match(fila, /ordenarFilaAtendimento/);
  assert.match(fila, /buildAssumirConversa/);
  assert.match(chatbot, /buildEscalarParaHub/);
});
