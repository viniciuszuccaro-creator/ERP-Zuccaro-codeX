import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('formulario canonico integra secao PIM sem criar tela paralela', async () => {
  const form = await readFile(
    new URL('../src/components/cadastros/ProdutoFormV22_Completo.jsx', import.meta.url),
    'utf8',
  );
  const section = await readFile(
    new URL('../src/components/cadastros/produto/ProdutoPimSection.jsx', import.meta.url),
    'utf8',
  );
  assert.match(form, /ProdutoPimSection/);
  assert.match(form, /descricao_tecnica/);
  assert.match(form, /workflow_status: produto\.workflow_status \|\| 'RASCUNHO'/);
  for (const field of [
    'descricao_tecnica',
    'descricao_comercial',
    'titulo_seo',
    'embalagem_tipo',
    'multiplo_venda',
    'quantidade_minima_venda',
    'permite_fracionamento',
  ]) {
    assert.match(section, new RegExp(field));
  }
});
