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

/** Hub ERP (ref #257 baba91a6): azul uniforme; Financeiro mantém semântica CR≠Régua. */
test('launchpads operacionais usam color blue (azul-claro global seletivo)', async () => {
  const pages = [
    '../src/pages/Estoque.jsx',
    '../src/pages/Expedicao.jsx',
    '../src/pages/Compras.jsx',
    '../src/pages/Fiscal.jsx',
    '../src/pages/Producao.jsx',
    '../src/pages/RH.jsx',
    '../src/pages/CRM.jsx',
  ];
  for (const rel of pages) {
    const source = await readFile(new URL(rel, import.meta.url), 'utf8');
    const colors = [...source.matchAll(/color:\s*['"](\w+)['"]/g)].map((m) => m[1]);
    assert.ok(colors.length >= 4, `${rel}: esperado ≥4 tiles, got ${colors.length}`);
    for (const c of colors) {
      assert.equal(c, 'blue', `${rel}: tile color=${c}`);
    }
  }
  const fin = await readFile(new URL('../src/pages/Financeiro.jsx', import.meta.url), 'utf8');
  assert.match(fin, /color:\s*['"]green['"]/);
  assert.match(fin, /color:\s*['"]violet['"]|color:\s*['"]purple['"]/);
  assert.match(fin, /CentralAprovacoesManager/);
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

test('auxiliares: CentroCusto/GrupoProduto codigo; GrupoEmpresarial ID técnico', async () => {
  const b3 = await readFile(new URL('../src/components/cadastros/blocks/Bloco3Financeiro.jsx', import.meta.url), 'utf8');
  const b2 = await readFile(new URL('../src/components/cadastros/blocks/Bloco2Produtos.jsx', import.meta.url), 'utf8');
  const b5 = await readFile(new URL('../src/components/cadastros/blocks/Bloco5Organizacional.jsx', import.meta.url), 'utf8');
  assert.match(b3, /CentroCusto[\s\S]*?\[['"]codigo['"]/);
  assert.match(b2, /GrupoProduto[\s\S]*?nome_grupo/);
  assert.match(b2, /SetorAtividade[\s\S]*?\[['"]codigo['"]/);
  assert.match(b5, /GrupoEmpresarial[\s\S]*?\[['"]id['"]/);
});

test('Estoque/Expedição launchpad KPIs usam sky (sem purple/indigo)', async () => {
  const estoque = await readFile(new URL('../src/components/estoque/estoque-launchpad/KPIsEstoque.jsx', import.meta.url), 'utf8');
  const expedicao = await readFile(new URL('../src/components/expedicao/expedicao-launchpad/KPIsExpedicao.jsx', import.meta.url), 'utf8');
  const header = await readFile(new URL('../src/components/estoque/estoque-launchpad/HeaderEstoqueCompacto.jsx', import.meta.url), 'utf8');
  for (const [src, label] of [[estoque,'KPIsEstoque'],[expedicao,'KPIsExpedicao'],[header,'HeaderEstoque']]) {
    assert.match(src, /sky-/, `${label} sky`);
    assert.doesNotMatch(src, /purple-|indigo-|violet-/, `${label} sem purple/indigo`);
  }
});

test('Estoque/Expedição tabs alta frequência: sky sem purple/indigo', async () => {
  const files = [
    '../src/components/expedicao/EntregasListagem.jsx',
    '../src/components/expedicao/DetalhesEntregaView.jsx',
    '../src/components/estoque/ProdutosTab.jsx',
    '../src/components/estoque/MovimentacaoForm.jsx',
  ];
  for (const rel of files) {
    const src = await readFile(new URL(rel, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /purple-|indigo-|violet-/, `${rel} sem purple/indigo`);
  }
});
