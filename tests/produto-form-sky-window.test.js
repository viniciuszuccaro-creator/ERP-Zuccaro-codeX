import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('ProdutoFormV22 windowMode: chrome sky + ID técnico (sem 3º módulo)', async () => {
  const src = await readFile(new URL('../src/components/cadastros/ProdutoFormV22_Completo.jsx', import.meta.url), 'utf8');
  assert.match(src, /windowMode = false/);
  assert.match(src, /data-produto-v22-window-sky/);
  assert.match(src, /from-sky-50 to-sky-100/);
  assert.match(src, /ID técnico/);
  assert.match(src, /text-sky-600/);
  // Persistência/RBAC existentes preservados — chrome só envolve content
  assert.match(src, /isSelfManagedCadastro = true/);
  assert.match(src, /podeEditar|podeCriar/);
});

test('ProdutoFormCompleto legado: windowMode sky keep-both (Importação NFe)', async () => {
  const src = await readFile(new URL('../src/components/cadastros/ProdutoFormCompleto.jsx', import.meta.url), 'utf8');
  assert.match(src, /windowMode = false/);
  assert.match(src, /data-produto-window-sky/);
  assert.match(src, /from-sky-50 to-sky-100/);
  assert.match(src, /ImportacaoProdutoNFe/);
  assert.match(src, /bg-sky-100/);
  // Sem apagar path legado nem criar V3
  assert.doesNotMatch(src, /ProdutoFormV3|ProdutoFormNovo/);
});
