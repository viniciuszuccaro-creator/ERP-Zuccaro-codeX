/**
 * #397 — chrome azul-claro (sky) nos blocos Cadastros de entrada em uso.
 * Não é redesign amplo; preserva data-permission / openCadastroEntityWindow.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const BLOCOS = [
  'Bloco1Pessoas.jsx',
  'Bloco2Produtos.jsx',
  'Bloco3Financeiro.jsx',
  'Bloco4Logistica.jsx',
  'Bloco5Organizacional.jsx',
  'Bloco6Tecnologia.jsx',
];

for (const name of BLOCOS) {
  test(`${name}: header/tiles usam sky (não purple/emerald/orange/indigo de bloco)`, async () => {
    const src = await readFile(new URL(`../src/components/cadastros/blocks/${name}`, import.meta.url), 'utf8');
    assert.match(src, /from-sky-50/);
    assert.match(src, /bg-sky-50/);
    assert.match(src, /bg-sky-600/);
    assert.match(src, /openCadastroEntityWindow|openList|openProdutos/);
    assert.match(src, /data-permission/);
    assert.doesNotMatch(src, /from-purple-50 to-pink-50/);
    assert.doesNotMatch(src, /from-blue-50 to-purple-50/);
    assert.doesNotMatch(src, /from-emerald-50 to-teal-50/);
    assert.doesNotMatch(src, /from-orange-50 to-amber-50/);
    assert.doesNotMatch(src, /from-indigo-50 to-violet-50/);
  });
}
