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
});

test('CentralCliente360Panel: reabre OrcamentosTab existente (não paralela)', () => {
  const src = read('src/components/comercial/CentralCliente360Panel.jsx');
  assert.match(src, /OrcamentosTab/);
  assert.match(src, /canLoadCentralCliente360/);
  assert.doesNotMatch(src, /CentralVendas360Nova|OrcamentosV2/);
});
