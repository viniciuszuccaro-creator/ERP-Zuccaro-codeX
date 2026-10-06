import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';

async function loadIsCadastroEditLoadComplete() {
  const source = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('export function isCadastroEditLoadComplete');
  assert.ok(start > 0, 'isCadastroEditLoadComplete deve existir');
  const end = source.indexOf('\n// ─── getDisplayValue', start);
  const fnSource = source.slice(start, end > start ? end : start + 800).replace('export ', '');
  const { code } = transformSync(fnSource + '\nmodule.exports = { isCadastroEditLoadComplete };', {
    loader: 'js',
    format: 'cjs',
  });
  const require = createRequire(import.meta.url);
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports.isCadastroEditLoadComplete;
}

test('Empresa: carga completa exige id, nome e CNPJ; incompleta falha fechado', async () => {
  const isCadastroEditLoadComplete = await loadIsCadastroEditLoadComplete();
  assert.equal(isCadastroEditLoadComplete('Empresa', null, 'e1'), false);
  assert.equal(isCadastroEditLoadComplete('Empresa', { id: 'e2', razao_social: 'A', cnpj: '123' }, 'e1'), false);
  assert.equal(isCadastroEditLoadComplete('Empresa', { id: 'e1', razao_social: 'A Ltda', cnpj: '12.345.678/0001-99' }, 'e1'), true);
  assert.equal(isCadastroEditLoadComplete('Empresa', { id: 'e1', nome_fantasia: 'A', cnpj: '12345678000199' }, 'e1'), true);
  assert.equal(isCadastroEditLoadComplete('Empresa', { id: 'e1', razao_social: 'A', cnpj: '' }, 'e1'), false);
});

test('Visualizador carrega registro completo via getInContext antes de editar e bloqueia save incompleto', async () => {
  const source = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  assert.match(source, /const full = await getInContext\(ENTITY, item\.id/);
  assert.match(source, /if \(!isCadastroEditLoadComplete\(ENTITY, full, item\.id\)\)/);
  assert.match(source, /Salvamento bloqueado: carga do registro incompleta/);
  assert.match(source, /clean\.id = editItem\.id/);
  assert.match(source, /getInContext,/);
});

test('EmpresaForm preserva id/group_id e bloqueia save com carga incompleta', async () => {
  const form = await readFile(new URL('../src/components/cadastros/EmpresaForm.jsx', import.meta.url), 'utf8');
  assert.match(form, /\.\.\.\(dadosIniciais\?\.id \? \{ id: dadosIniciais\.id \} : \{\}\)/);
  assert.match(form, /Carga incompleta da empresa — salvamento bloqueado/);
  assert.match(form, /group_id: dadosIniciais\?\.group_id \|\| groupId/);
  assert.match(form, /disabled=\{isSubmitting \|\| !podeSalvar \|\| \(editando && !cargaCompleta\)\}/);

  const completo = await readFile(new URL('../src/components/cadastros/EmpresaFormCompleto.jsx', import.meta.url), 'utf8');
  assert.match(completo, /\.\.\.\(dadosIniciaisProps\?\.id \? \{ id: dadosIniciaisProps\.id \} : \{\}\)/);
  assert.match(completo, /Carga incompleta da empresa — salvamento bloqueado/);
  assert.match(completo, /editando && !cargaCompleta/);
});

test('useContextoVisual expoe getInContext fail-closed por grupo/empresa', async () => {
  const source = await readFile(new URL('../src/components/lib/useContextoVisual.jsx', import.meta.url), 'utf8');
  assert.match(source, /getInContext: async \(entityName, id, campo = 'empresa_id'\) => \{/);
  assert.match(source, /Registro fora do grupo ativo — carga bloqueada/);
  assert.match(source, /base44\.entities\[entityName\]\.get\(id\)/);
});
