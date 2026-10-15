import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('Empresas: dialog usa EmpresaForm canônico sem formulário paralelo', async () => {
  const source = await readFile(new URL('../src/pages/Empresas.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /DialogTrigger/);
  assert.match(source, /import EmpresaForm from ["']@\/components\/cadastros\/EmpresaForm["']/);
  assert.match(source, /data-action=["']empresa-edit["']/);
  assert.match(source, /data-action=["']empresa-nova["']/);
  assert.match(source, /data-action=["']empresa-form-dialog["']/);
  assert.match(source, /key=\{editingEmpresa\?\.id \|\| ["']nova-empresa["']\}/);
  assert.match(source, /<EmpresaForm[\s\S]*onSubmit=\{handleEmpresaSubmit\}/);
  assert.match(source, /setIsDialogOpen\(true\)/);
  assert.match(source, /groupIdCadastro/);
  assert.match(source, /empresas-cadastro/);
  assert.match(source, /enabled:\s*Boolean\(groupIdCadastro\)/);
  assert.match(source, /group_id: groupId/);
  assert.match(source, /invalidateEmpresasQueries/);
  assert.match(source, /invalidateQueries\(\{\s*queryKey:\s*\[['"]empresas-cadastro['"]\]/);
  assert.match(source, /deleteInContext/);
  assert.match(source, /_action === ["']delete["']/);
  // Sem schema/FormWrapper paralelo no dialog (canônico em EmpresaForm)
  assert.doesNotMatch(source, /empresaSchema|FormWrapper|z\.object/);
  assert.doesNotMatch(source, /bg-purple-500/);
});

test('EmpresaForm recupera tipo Matriz/Filial, matriz e contato da página Empresas', async () => {
  const form = await readFile(new URL('../src/components/cadastros/EmpresaForm.jsx', import.meta.url), 'utf8');
  const shared = await readFile(new URL('../src/components/cadastros/empresaFormShared.js', import.meta.url), 'utf8');
  assert.match(form, /data-action=["']selecionar-tipo-empresa["']/);
  assert.match(form, /data-action=["']empresa-matriz-secao["']/);
  assert.match(form, /data-action=["']selecionar-matriz-empresa["']/);
  assert.match(form, /data-action=["']empresa-contato-secao["']/);
  assert.match(form, /SelectItem value=["']Filial["']/);
  assert.match(shared, /matriz_id/);
  assert.match(shared, /contato:/);
});

test('FilialForm é adapter canônico do EmpresaForm', async () => {
  const source = await readFile(new URL('../src/components/cadastros/FilialForm.jsx', import.meta.url), 'utf8');
  assert.match(source, /import EmpresaForm from ["']@\/components\/cadastros\/EmpresaForm["']/);
  assert.match(source, /tipo:\s*["']Filial["']/);
  assert.match(source, /<EmpresaForm/);
  assert.doesNotMatch(source, /createTable|FilialStore|useState/);
});
