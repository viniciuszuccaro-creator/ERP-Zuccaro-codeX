import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/Integracoes.jsx', 'utf8');
const pagesConfig = readFileSync('src/pages.config.js', 'utf8');
const adminTabs = readFileSync('src/components/administracao-sistema/AdminTabs.jsx', 'utf8');
const layout = readFileSync('src/Layout.jsx', 'utf8');

test('recuperação: página Integracoes não está vazia e reusa IntegracoesIndex canônico', () => {
  assert.ok(page.trim().length > 0);
  assert.match(page, /from '@\/components\/administracao-sistema\/IntegracoesIndex'/);
  assert.match(page, /w-full h-full/);
  // Não importar shell paralelo legado nesta página
  assert.doesNotMatch(page, /import\s+.*CentralIntegracoes/);
});

test('recuperação: rota Integracoes registrada em pages.config', () => {
  assert.match(pagesConfig, /import Integracoes from '\.\/pages\/Integracoes'/);
  assert.match(pagesConfig, /"Integracoes": Integracoes/);
});

test('canônico Admin: aba Integrações permanece IntegracoesIndex', () => {
  assert.match(adminTabs, /IntegracoesIndex/);
  assert.match(adminTabs, /value: "integracoes"/);
});

test('navegação: Administração do Sistema aponta tab=integracoes', () => {
  assert.match(layout, /AdministracaoSistema\?tab=integracoes/);
});

test('parecer 6691042172: rota Integracoes com ProtectedSection granular', () => {
  assert.match(page, /ProtectedSection/);
  assert.match(page, /module="Sistema"/);
  assert.match(page, /section="Integracoes"/);
  assert.match(page, /action="visualizar"/);
  assert.match(layout, /Integracoes:\s*'Sistema'/);
});
