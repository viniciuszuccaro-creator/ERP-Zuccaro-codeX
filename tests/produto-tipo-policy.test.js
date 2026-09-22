import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  PRODUTO_TIPOS_CANONICOS,
  getProdutoTipoOptions,
  normalizeProdutoTipoItem,
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
