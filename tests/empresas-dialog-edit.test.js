import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('Empresas: edição controlada com EmpresaForm canônico (sem DialogTrigger/FormWrapper paralelo)', async () => {
  const source = await readFile(new URL('../src/pages/Empresas.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /DialogTrigger/);
  assert.doesNotMatch(source, /FormWrapper/);
  assert.doesNotMatch(source, /withContext=\{false\}/);
  assert.match(source, /import EmpresaForm from "@\/components\/cadastros\/EmpresaForm"/);
  assert.match(source, /data-unify=["']empresas-form-canonico["']/);
  assert.match(source, /data-action=["']empresa-edit["']/);
  assert.match(source, /data-action=["']empresa-nova["']/);
  assert.match(source, /data-action=["']empresa-form-dialog["']/);
  assert.match(source, /key=\{editingEmpresa\?\.id \|\| ['"]nova-empresa['"]\}/);
  assert.match(source, /<EmpresaForm/);
  assert.match(source, /handleEmpresaFormSubmit/);
  assert.match(source, /setIsDialogOpen\(true\)/);
  assert.match(source, /groupIdCadastro/);
  assert.match(source, /empresas-cadastro/);
  assert.match(source, /enabled:\s*Boolean\(groupIdCadastro\)/);
  assert.match(source, /group_id: groupId/);
  assert.match(source, /invalidateEmpresasQueries/);
  assert.match(source, /invalidateQueries\(\{\s*queryKey:\s*\[['"]empresas-cadastro['"]\]/);
});
