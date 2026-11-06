import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pagesConfig = readFileSync('src/pages.config.js', 'utf8');
const cadastros = readFileSync('src/pages/Cadastros.jsx', 'utf8');
const layout = readFileSync('src/Layout.jsx', 'utf8');
const pageLayout = readFileSync('src/components/cadastros/CadastrosPageLayout.jsx', 'utf8');

test('superfície servida: pages.config → pages/Cadastros.jsx (não PageLayout)', () => {
  assert.match(pagesConfig, /import Cadastros from '\.\/pages\/Cadastros'/);
  assert.match(pagesConfig, /"Cadastros": Cadastros/);
  assert.doesNotMatch(pagesConfig, /CadastrosPageLayout/);
});

test('navegação Cadastros Gerais aponta createPageUrl("Cadastros")', () => {
  assert.match(layout, /createPageUrl\("Cadastros"\)/);
});

test('Cadastros.jsx canônico: cores por categoria (não forçar slate global)', () => {
  for (const token of [
    'from-blue-50 to-blue-100',
    'from-purple-50 to-purple-100',
    'from-green-50 to-green-100',
    'from-orange-50 to-orange-100',
    'from-indigo-50 to-indigo-100',
    'from-cyan-50 to-cyan-100',
  ]) {
    assert.match(cadastros, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('CadastrosPageLayout é órfão (sem consumidores) — não alterar Cadastros.jsx por causa dele', () => {
  assert.match(pageLayout, /text-slate-900/);
  // Sem imports no pages.config / Layout
  assert.doesNotMatch(pagesConfig, /CadastrosPageLayout/);
  assert.doesNotMatch(layout, /CadastrosPageLayout/);
});
