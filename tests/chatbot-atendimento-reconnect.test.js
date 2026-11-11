/**
 * Recuperação: ChatbotAtendimento existia em pages.config sem entrada no Layout.
 * Fonte: página canônica + Hub complementar (matriz keep both).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ChatbotAtendimento.jsx', 'utf8');
const layout = readFileSync('src/Layout.jsx', 'utf8');
const pagesConfig = readFileSync('src/pages.config.js', 'utf8');

test('recuperação: ChatbotAtendimento permanece rota registrada', () => {
  assert.match(pagesConfig, /import ChatbotAtendimento from '\.\/pages\/ChatbotAtendimento'/);
  assert.match(pagesConfig, /"ChatbotAtendimento": ChatbotAtendimento/);
});

test('recuperação: Layout reconecta menu ao ChatbotAtendimento', () => {
  assert.match(layout, /createPageUrl\("ChatbotAtendimento"\)/);
  assert.match(layout, /Chatbot de Atendimento/);
  assert.match(layout, /ChatbotAtendimento:\s*'CRM'/);
});

test('recuperação: página com ProtectedSection CRM/Atendimento', () => {
  assert.match(page, /ProtectedSection/);
  assert.match(page, /module="CRM"/);
  assert.match(page, /section="Atendimento"/);
  assert.match(page, /action="visualizar"/);
  assert.match(page, /buildEscalarParaHub/);
});
