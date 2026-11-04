import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('canônicos Orçamento/Pedido: unidade principal only — gap explícito; Seletor não montado', async () => {
  const pedido = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const orc = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const picker = await readFile(new URL('../src/components/comercial/comercialMasterPicker.js', import.meta.url), 'utf8');
  const seletor = await readFile(new URL('../src/components/comercial/SeletorUnidadeComConversao.jsx', import.meta.url), 'utf8');

  assert.match(picker, /unidade_alternativa:\s*'somente unidade principal/);
  assert.match(pedido, /ORCAMENTO_PERSISTENCE_GAPS/);
  assert.match(pedido, /data-action="pedido-unidade-principal-only"/);
  assert.match(pedido, /title=\{ORCAMENTO_PERSISTENCE_GAPS\.unidade_alternativa\}/);
  assert.match(pedido, /somente a principal do produto/);
  assert.doesNotMatch(pedido, /SeletorUnidadeComConversao/);

  assert.match(orc, /data-action="orcamento-unidade-principal-only"/);
  assert.match(orc, /title=\{ORCAMENTO_PERSISTENCE_GAPS\.unidade_alternativa\}/);
  assert.doesNotMatch(orc, /SeletorUnidadeComConversao/);

  // Componente existe para fluxos legados; não prova montagem canônica.
  assert.match(seletor, /SELETOR UNIVERSAL DE UNIDADE COM CONVERSÃO/);
});

test('Pedido canônico: concorrência submit usa mutationGate — sem inventar mestres filterInContext', async () => {
  const pedido = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  assert.match(pedido, /sharedPedidoMutationGate/);
  assert.match(pedido, /comercialMasters\.list/);
  assert.doesNotMatch(pedido, /filterInContext\(/);
});
