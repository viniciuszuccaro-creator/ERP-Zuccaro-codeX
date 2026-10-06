import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isEditRequestCurrent, loadEmpresaForEdit } from '../src/components/lib/contextoMultiempresaPolicy.js';

const complete = Object.freeze({
  id: 'empresa-a', group_id: 'grupo-a', razao_social: 'Empresa Sintetica',
  nome_fantasia: 'Sintetica', cnpj: '00000000000191',
  configuracao_fiscal: { serie_nfe: '9' },
});

test('Editar Empresa rele cadastro completo e preserva identidade e configuracoes', async () => {
  let reads = 0;
  const record = await loadEmpresaForEdit({
    id: 'empresa-a', groupId: 'grupo-a', fetchById: async (id) => {
      reads += 1;
      assert.equal(id, 'empresa-a');
      return complete;
    },
  });
  assert.equal(reads, 1);
  assert.equal(record, complete);
  assert.equal(record.configuracao_fiscal.serie_nfe, '9');
});

test('Editar Empresa bloqueia resposta parcial, ID trocado e Grupo/Empresa estranhos', async () => {
  const attempt = (record, empresaId) => loadEmpresaForEdit({
    id: 'empresa-a', groupId: 'grupo-a', empresaId,
    fetchById: async () => record,
  });
  await assert.rejects(attempt({ id: 'empresa-a', group_id: 'grupo-a', razao_social: 'Parcial' }));
  await assert.rejects(attempt({ ...complete, id: 'empresa-b' }));
  await assert.rejects(attempt({ ...complete, group_id: 'grupo-b' }));
  await assert.rejects(attempt(complete, 'empresa-b'));
  await assert.rejects(loadEmpresaForEdit({ id: 'empresa-a', fetchById: async () => complete }));
});

test('Falha de leitura bloqueia; retentativa relê em vez de usar linha parcial', async () => {
  let reads = 0;
  const fetchById = async () => {
    reads += 1;
    if (reads === 1) throw new Error('falha sintetica');
    return complete;
  };
  const args = { id: 'empresa-a', groupId: 'grupo-a', fetchById };
  await assert.rejects(loadEmpresaForEdit(args), /falha sintetica/);
  assert.equal(await loadEmpresaForEdit(args), complete);
  assert.equal(reads, 2);
});

test('Leitura pendente deixa de ser atual apos Novo ou troca de contexto', () => {
  const pending = { request: 1, current: 1, requestedScope: 'Empresa:grupo-a:', activeScope: 'Empresa:grupo-a:' };
  assert.equal(isEditRequestCurrent(pending), true);
  assert.equal(isEditRequestCurrent({ ...pending, current: 2 }), false);
  assert.equal(isEditRequestCurrent({ ...pending, activeScope: 'Empresa:grupo-b:' }), false);
  assert.equal(isEditRequestCurrent({ ...pending, activeScope: 'Empresa:grupo-a:empresa-b' }), false);
});

test('Formulario usa gate efetivo e update nao reenvia configuracao fiscal oculta', async () => {
  const form = await readFile(new URL('../src/components/cadastros/EmpresaForm.jsx', import.meta.url), 'utf8');
  const viewer = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  assert.match(form, /data-permission=\{permissaoFormulario\}/);
  assert.match(form, /ID do cadastro \(somente leitura\)/);
  assert.match(form, /<code className="break-all select-text">\{dadosIniciais\.id\}<\/code>/);
  assert.doesNotMatch(form, /Cadastros\.Empresa\.salvar/);
  assert.match(form, /!dadosIniciais\?\.id \? \{ configuracao_fiscal:/);
  assert.match(viewer, /loadEmpresaForEdit\(/);
  assert.match(viewer, /setEditError\("Nao foi possivel carregar o cadastro completo/);
  assert.match(viewer, /editRequestRef\.current \+= 1;\s*setIsLoadingEdit\(false\);\s*setEditItem\(null\)/);
});
