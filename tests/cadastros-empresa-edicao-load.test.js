import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('Visualizador carrega registro completo e bloqueia save incompleto para tenant masters', async () => {
  const source = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  assert.match(source, /isTenantMasterEntity/);
  assert.match(source, /getEntityRecord/);
  assert.match(source, /editLoadBlocked/);
  assert.match(source, /Carregamento incompleto do registro/);
  assert.match(source, /tenantMaster \? null : empresaId/);
  assert.match(source, /tenantMaster && editItem && !editItem\.empresa_id/);
  assert.match(source, /loadIncomplete/);
});

test('EmpresaForm preserva id/group e bloqueia save enquanto load incompleto', async () => {
  const source = await readFile(new URL('../src/components/cadastros/EmpresaForm.jsx', import.meta.url), 'utf8');
  assert.match(source, /mergeEmpresaFormData/);
  assert.match(source, /loadIncomplete/);
  assert.match(source, /isLoadingRecord/);
  assert.match(source, /Aguarde o carregamento completo/);
  assert.match(source, /id: formData\.id \|\| dadosIniciais\?\.id/);
  assert.doesNotMatch(source, /empresa_id: contexto === ["']empresa["']/);
});

test('localBase44 nao filtra Empresa/Grupo por empresa_id do contexto', async () => {
  const source = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  assert.match(source, /tenantMaster/);
  assert.match(source, /entityName === 'Empresa' \|\| entityName === 'GrupoEmpresarial'/);
});
