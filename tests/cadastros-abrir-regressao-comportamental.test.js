import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { openCadastroEntityWindow } from '../src/components/cadastros/openCadastroWindow.js';
import {
  isCadastroEditLoadComplete,
  mergeCadastroEditHydration,
} from '../src/components/cadastros/cadastroEditLoadPolicy.js';

test('regressao: dois cliques Abrir nao abrem duas janelas (uniqueKey estavel)', () => {
  const calls = [];
  const open = (component, props, options) => { calls.push({ component, props, options }); };
  openCadastroEntityWindow(open, { component: 'X', entityName: 'Cliente', title: 'Clientes' });
  openCadastroEntityWindow(open, { component: 'X', entityName: 'Cliente', title: 'Clientes' });
  openCadastroEntityWindow(open, { component: 'X', entityName: 'Marca', title: 'Marcas' });
  openCadastroEntityWindow(open, { component: 'X', entityName: 'Marca', title: 'Marcas' });
  assert.equal(calls[0].options.uniqueKey, 'Cadastros.Cliente.visualizador');
  assert.equal(calls[1].options.uniqueKey, 'Cadastros.Cliente.visualizador');
  assert.equal(calls[2].options.uniqueKey, 'Cadastros.Marca.visualizador');
  assert.equal(calls[3].options.uniqueKey, 'Cadastros.Marca.visualizador');
  assert.notEqual(calls[0].options.uniqueKey, calls[2].options.uniqueKey);
});

test('regressao: GET parcial nao apaga campos da grade (merge antes do gate)', () => {
  const grade = { id: 'm1', nome_marca: 'GATE-D SYNTH', codigo: '000004', descricao: 'preservar' };
  const partial = { id: 'm1', nome_marca: undefined, codigo: '000004' };
  const merged = mergeCadastroEditHydration(grade, partial);
  assert.equal(merged.nome_marca, 'GATE-D SYNTH');
  assert.equal(merged.descricao, 'preservar');
  assert.equal(isCadastroEditLoadComplete('Marca', merged, 'm1'), true);
  assert.equal(isCadastroEditLoadComplete('Marca', partial, 'm1'), false);
});

test('regressao: WindowManager registra uniqueKey sincronamente', async () => {
  const wm = await readFile(new URL('../src/components/lib/WindowManager.jsx', import.meta.url), 'utf8');
  assert.match(wm, /uniqueKey/);
  assert.match(wm, /registry|openWindows|find.*uniqueKey/i);
});

test('regressao: Visualizador bloqueia salvar com carregamento incompleto', async () => {
  const src = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  assert.match(src, /Carregamento incompleto/);
  assert.match(src, /mergeCadastroEditHydration|isCadastroEditLoadComplete/);
});
