/**
 * Unificação Empresas × Cadastros: canônico = Cadastros/EmpresaForm;
 * página Empresas preserva KPIs/visão (keep both curto, sem apagar).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const empresas = readFileSync('src/pages/Empresas.jsx', 'utf8');
const layout = readFileSync('src/Layout.jsx', 'utf8');
const bloco5 = readFileSync('src/components/cadastros/blocks/Bloco5Organizacional.jsx', 'utf8');

test('unificação: Cadastros Organizacional mantém EmpresaForm canônico', () => {
  assert.match(bloco5, /EmpresaForm/);
  assert.match(bloco5, /k:\s*'Empresa'/);
});

test('unificação: página Empresas aponta para Cadastros canônico sem remoção', () => {
  assert.match(empresas, /data-unify="empresas-cadastros-canonico"/);
  assert.match(empresas, /createPageUrl\('Cadastros'\)/);
  assert.match(empresas, /Gestão de Empresas e Filiais/);
  assert.match(empresas, /w-full h-full/);
});

test('unificação: Layout mapeia Empresas → módulo Cadastros', () => {
  assert.match(layout, /Empresas:\s*'Cadastros'/);
});
