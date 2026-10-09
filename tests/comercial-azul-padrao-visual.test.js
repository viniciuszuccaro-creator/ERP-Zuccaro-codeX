import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

/**
 * Referência visual aprovada (screenshots proprietário):
 * hub Comercial com tiles Launchpad uniformemente blue;
 * janelas Cadastros com chrome azul (WindowModal).
 * Não reverter funcionalidades — só cor/padrão.
 */

test('Comercial: todos os módulos do launchpad usam color blue (padrão azul)', async () => {
  const source = await readFile(new URL('../src/pages/Comercial.jsx', import.meta.url), 'utf8');
  const block = source.match(/const modules = \[([\s\S]*?)\];\s*\n\s*const allowedModules/);
  assert.ok(block, 'bloco modules não encontrado');
  const body = block[1];
  const colors = [...body.matchAll(/color:\s*['"](\w+)['"]/g)].map((m) => m[1]);
  assert.ok(colors.length >= 8, `esperado ≥8 tiles, got ${colors.length}`);
  for (const c of colors) {
    assert.equal(c, 'blue', `tile color=${c} — padrão aprovado é blue`);
  }
  assert.doesNotMatch(body, /color:\s*['"](purple|green|orange|cyan|indigo|violet|red)['"]/);
  assert.match(source, /ModulosGridComercial|LaunchpadCard/);
});

test('WindowModal: barra de título azul (chrome aprovado das janelas Cadastros)', async () => {
  const source = await readFile(new URL('../src/components/lib/WindowModal.jsx', import.meta.url), 'utf8');
  assert.match(source, /from-blue-600 to-blue-700/);
  assert.match(source, /hover:bg-blue-800/);
});

test('V24: coluna nome vazia usa fallbacks (descricao/nome_grupo) sem reseed', async () => {
  const source = await readFile(
    new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /isLabelCol/);
  assert.match(source, /LABEL_FALLBACKS/);
  assert.match(source, /nome_grupo/);
  assert.match(source, /descricao/);
});

test('auxiliares: CentroCusto/GrupoProduto/GrupoEmpresarial expõem codigo + rótulo útil', async () => {
  const b3 = await readFile(new URL('../src/components/cadastros/blocks/Bloco3Financeiro.jsx', import.meta.url), 'utf8');
  const b2 = await readFile(new URL('../src/components/cadastros/blocks/Bloco2Produtos.jsx', import.meta.url), 'utf8');
  const b5 = await readFile(new URL('../src/components/cadastros/blocks/Bloco5Organizacional.jsx', import.meta.url), 'utf8');
  assert.match(b3, /CentroCusto[\s\S]*?\[['"]codigo['"]/);
  assert.match(b2, /GrupoProduto[\s\S]*?nome_grupo/);
  assert.match(b2, /SetorAtividade[\s\S]*?\[['"]codigo['"]/);
  assert.match(b5, /GrupoEmpresarial[\s\S]*?\[['"]codigo['"]/);
});
