/**
 * #591 — Central Vendas360 evolui de Orçamentos existentes (sem paralelo).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('Comercial launchpad: OrcamentosTab canônico (sem OrcamentosV2)', () => {
  const src = read('src/pages/Comercial.jsx');
  assert.match(src, /const OrcamentosTab = React\.lazy/);
  assert.match(src, /component:\s*OrcamentosTab/);
  assert.doesNotMatch(src, /OrcamentosV2|CentralVendas360Nova|OrcamentosNovo/);
});

test('OrcamentosTab: proposal aside + rascunho; salvar bloqueado em proposalMode', () => {
  const src = read('src/components/comercial/OrcamentosTab.jsx');
  assert.match(src, /OrcamentoProposalAside/);
  assert.match(src, /proposalMode/);
  assert.match(src, /Proposta visual: gravação desabilitada/);
  assert.match(src, /disabled=\{proposalMode \|\| submitting/);
  assert.match(src, /Incluir item|Item<\/Button>|<Plus/);
});

test('OrcamentoProposalAside: Voltar/Avançar por painel sem perder rascunho do editor', () => {
  const src = read('src/components/comercial/OrcamentoProposalAside.jsx');
  assert.match(src, /data-action="proposta-voltar"/);
  assert.match(src, /data-action="proposta-avancar"/);
  assert.match(src, /Rascunho do editor permanece ao navegar/);
  assert.doesNotMatch(src, /OrcamentosV2|CentralVendas360Nova/);
  // Voltar/Avançar só muda painel — sem save/convert/efeitos externos.
  const voltarIdx = src.indexOf('data-action="proposta-voltar"');
  const avancarIdx = src.indexOf('data-action="proposta-avancar"');
  assert.ok(voltarIdx > 0 && avancarIdx > 0);
  const navSlice = src.slice(Math.min(voltarIdx, avancarIdx) - 120, Math.max(voltarIdx, avancarIdx) + 280);
  assert.match(navSlice, /goPanelByDelta\(/);
  assert.match(src, /ArrowLeft|ArrowRight/);
  assert.match(src, /setPanel\(\(current\)/);
  assert.doesNotMatch(navSlice, /save\(|convert|criarPedido|fetch\(|mutate\(/i);
});

test('OrcamentoProposalAside: capacidades existente/parcial/futuro sem owners paralelos', () => {
  const src = read('src/components/comercial/OrcamentoProposalAside.jsx');
  assert.match(src, /PROPOSTA_CAPACIDADES/);
  assert.match(src, /data-capacidade=/);
  assert.match(src, /data-block="proposta-capacidades"/);
  assert.match(src, /CentralCliente360Panel/);
  assert.match(src, /ValidadorEstoquePedido/);
  assert.match(src, /titleToModule/);
  assert.doesNotMatch(src, /ContatoClienteV2|CentralVendas360Nova|OrcamentosV2/);
});

test('CentralCliente360Panel: reabre OrcamentosTab existente (não paralela)', () => {
  const src = read('src/components/comercial/CentralCliente360Panel.jsx');
  assert.match(src, /OrcamentosTab/);
  assert.match(src, /canLoadCentralCliente360/);
  assert.doesNotMatch(src, /CentralVendas360Nova|OrcamentosV2/);
});
