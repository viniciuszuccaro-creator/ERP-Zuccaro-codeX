import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('PainelDinamicoCliente monta TabsContent historico_produtos (não órfão)', async () => {
  const src = await readFile(new URL('../src/components/cadastros/PainelDinamicoCliente.jsx', import.meta.url), 'utf8');
  assert.match(src, /TabsTrigger value="historico_produtos"/);
  assert.match(src, /TabsContent value="historico_produtos"/);
  assert.match(src, /HistoricoProdutosCliente/);
  // Conteúdo fica dentro do Tabs — evita aba “vazia” com painel deslocado fora da coluna.
  assert.doesNotMatch(src, /activeTab === ['"]historico_produtos['"]/);
});
