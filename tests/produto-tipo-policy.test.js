import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  PRODUTO_TIPOS_CANONICOS,
  getProdutoTipoOptions,
  isProdutoMateriaPrima,
  isProdutoRevenda,
  isProdutoVendavel,
  normalizeProdutoTipoItem,
  resolveProdutoTipoImportacao,
} from '../src/components/cadastros/produto/produtoTipoPolicy.js';

test('classificação frontend normaliza aliases canônicos e preserva tipo legado', () => {
  assert.equal(normalizeProdutoTipoItem('materia_prima'), PRODUTO_TIPOS_CANONICOS.MATERIA_PRIMA);
  assert.equal(normalizeProdutoTipoItem('fabricado'), PRODUTO_TIPOS_CANONICOS.FABRICADO);
  assert.equal(normalizeProdutoTipoItem('servico'), PRODUTO_TIPOS_CANONICOS.SERVICO);
  assert.equal(normalizeProdutoTipoItem('producao_aco'), 'producao_aco');

  const legacyOptions = getProdutoTipoOptions('Linha Legada Especial');
  assert.equal(legacyOptions.at(-1).value, 'Linha Legada Especial');
  assert.equal(legacyOptions.at(-1).legacy, true);
  assert.equal(getProdutoTipoOptions('Revenda').some((option) => option.legacy), false);
});

test('formulário canônico de Produto reutiliza a política sem lista local paralela', async () => {
  const source = await readFile(
    new URL('../src/components/cadastros/ProdutoFormV22_Completo.jsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /getProdutoTipoOptions\(formData\.tipo_item\)/);
  assert.match(source, /normalizeProdutoTipoItem\(produto\.tipo_item\)/);
  assert.match(source, /PRODUTO_TIPOS_CANONICOS\.REVENDA/);
  assert.doesNotMatch(source, /<SelectItem value="Produto Acabado">/);
});

test('predicados de tipo tratam aliases sem reclassificar valores legados', () => {
  assert.equal(isProdutoRevenda('revenda'), true);
  assert.equal(isProdutoMateriaPrima('materia_prima'), true);
  assert.equal(isProdutoMateriaPrima('Matéria-Prima Produção'), true);
  assert.equal(isProdutoVendavel('produto-acabado'), true);
  assert.equal(isProdutoVendavel('Linha Legada Especial'), false);
  assert.equal(isProdutoMateriaPrima('producao_aco'), false);
});

test('consumidores de estoque, comercial e produção reutilizam a policy canônica', async () => {
  const files = [
    '../src/pages/Estoque.jsx',
    '../src/components/estoque/ProdutosTab.jsx',
    '../src/components/comercial/AdicionarItemRevendaModal.jsx',
    '../src/components/producao/SeletorProdutosProducao.jsx',
    '../src/components/producao/FormularioOrdemProducao.jsx',
    '../src/components/cadastros/HistoricoProduto.jsx',
  ];
  const sources = await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), 'utf8')));
  for (const source of sources) {
    assert.match(source, /produtoTipoPolicy/);
  }
  assert.match(sources[0], /isProdutoRevenda\(p\.tipo_item\)/);
  assert.match(sources[1], /isProdutoMateriaPrima\(p\.tipo_item\)/);
  assert.match(sources[2], /isProdutoVendavel\(p\.tipo_item\)/);
  assert.match(sources[3], /isProdutoMateriaPrima\(p\.tipo_item\)/);
  assert.match(sources[4], /isProdutoMateriaPrima\(p\.tipo_item\)/);
  assert.match(sources[5], /PRODUTO_TIPOS_CANONICOS\.MATERIA_PRIMA/);
}
);
test('importação normaliza allowlist e exige revisão para classificação desconhecida', () => {
  assert.deepEqual(resolveProdutoTipoImportacao(''), {
    value: PRODUTO_TIPOS_CANONICOS.REVENDA,
    requiresReview: false,
    usedDefault: true,
  });
  assert.deepEqual(resolveProdutoTipoImportacao('materia_prima'), {
    value: PRODUTO_TIPOS_CANONICOS.MATERIA_PRIMA,
    requiresReview: false,
    usedDefault: false,
  });
  assert.deepEqual(resolveProdutoTipoImportacao('Linha Legada Especial'), {
    value: 'Linha Legada Especial',
    requiresReview: true,
    usedDefault: false,
  });
});

test('importadores existentes usam a classificação canônica e bloqueiam ambiguidade', async () => {
  const planilha = await readFile(new URL('../src/components/estoque/ImportadorProdutosPlanilha.jsx', import.meta.url), 'utf8');
  const lote = await readFile(new URL('../src/components/cadastros/ImportarProdutosLote.jsx', import.meta.url), 'utf8');
  const nfe = await readFile(new URL('../src/components/cadastros/ImportarProdutosNFe.jsx', import.meta.url), 'utf8');
  const xml = await readFile(new URL('../src/components/fiscal/ImportarXMLNFe.jsx', import.meta.url), 'utf8');

  assert.match(planilha, /resolveProdutoTipoImportacao\(value\)\.value/);
  assert.match(planilha, /classificacoesPendentes/);
  assert.match(planilha, /\.requiresReview/);
  assert.doesNotMatch(planilha, /s\.includes\('rev'\)/);
  assert.match(lote, /PRODUTO_TIPOS_CANONICOS\.REVENDA/);
  assert.match(nfe, /PRODUTO_TIPOS_CANONICOS\.REVENDA/);
  assert.match(xml, /PRODUTO_TIPOS_CANONICOS\.MATERIA_PRIMA/);
});