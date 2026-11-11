/**
 * Recuperação: Separação clássica + Fechamento Comercial + ConfiguracoesUsuario.
 * Matriz keep both curto — não apagar IA/clássica; Fechamento no hub Comercial.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const expedicao = readFileSync('src/pages/Expedicao.jsx', 'utf8');
const comercial = readFileSync('src/pages/Comercial.jsx', 'utf8');
const fechamentoPage = readFileSync('src/pages/DashboardFechamentoPedidos.jsx', 'utf8');
const layout = readFileSync('src/Layout.jsx', 'utf8');

test('recuperação: Expedição expõe Separação IA e Conferência clássica', () => {
  assert.match(expedicao, /SeparacaoConferenciaIA/);
  assert.match(expedicao, /component:\s*SeparacaoConferencia[^I]/);
  assert.match(expedicao, /Separação Conferência/);
  assert.match(expedicao, /sectionKey:\s*'Separação'/);
});

test('recuperação: Comercial abre DashboardFechamentoPedidos no launchpad', () => {
  assert.match(comercial, /DashboardFechamentoPedidos/);
  assert.match(comercial, /title:\s*'Fechamento'/);
  assert.match(comercial, /sectionKey:\s*'Fechamento'/);
});

test('recuperação: rota Fechamento com ProtectedSection Comercial', () => {
  assert.match(fechamentoPage, /ProtectedSection/);
  assert.match(fechamentoPage, /module="Comercial"/);
  assert.match(fechamentoPage, /section="Fechamento"/);
  assert.match(layout, /DashboardFechamentoPedidos:\s*'Comercial'/);
});

test('recuperação: ConfiguracoesUsuario não audita como Sistema', () => {
  assert.match(layout, /ConfiguracoesUsuario:\s*'ConfiguracoesUsuario'/);
  assert.match(layout, /currentPageName === 'ConfiguracoesUsuario'/);
});
