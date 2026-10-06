import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';

async function loadCadastroEditHelpers() {
  const source = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('export function isCadastroEditLoadComplete');
  assert.ok(start > 0, 'isCadastroEditLoadComplete deve existir');
  const end = source.indexOf('\n// ─── getDisplayValue', start);
  const fnSource = source.slice(start, end > start ? end : start + 4500).replace(/export /g, '');
  const { code } = transformSync(
    fnSource + '\nmodule.exports = { isCadastroEditLoadComplete, hasCadastroEntityPermission, buildCadastroEditSavePayload, assertCadastroRecordInTenant };',
    { loader: 'js', format: 'cjs' },
  );
  const require = createRequire(import.meta.url);
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
}

test('Empresa: carga completa exige id, nome e CNPJ; incompleta falha fechado', async () => {
  const { isCadastroEditLoadComplete } = await loadCadastroEditHelpers();
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
  assert.match(source, /buildCadastroEditSavePayload\(ENTITY, editItem, formData/);
  assert.match(source, /hasCadastroEntityPermission\(ENTITY, "editar"/);
  assert.match(source, /getInContext,/);
});

test('EmpresaForm preserva id/group_id e bloqueia save com carga incompleta', async () => {
  const form = await readFile(new URL('../src/components/cadastros/EmpresaForm.jsx', import.meta.url), 'utf8');
  assert.match(form, /\.\.\.\(dadosIniciais\?\.id \? \{ id: dadosIniciais\.id \} : \{\}\)/);
  assert.match(form, /Carga incompleta da empresa — salvamento bloqueado/);
  assert.match(form, /group_id: dadosIniciais\?\.group_id \|\| groupId/);
  assert.match(form, /disabled=\{isSubmitting \|\| !podeSalvar \|\| \(editando && !cargaCompleta\)\}/);
  assert.match(form, /canEdit\("Sistema", "Empresas"\)/);

  const completo = await readFile(new URL('../src/components/cadastros/EmpresaFormCompleto.jsx', import.meta.url), 'utf8');
  assert.match(completo, /\.\.\.\(dadosIniciaisProps\?\.id \? \{ id: dadosIniciaisProps\.id \} : \{\}\)/);
  assert.match(completo, /Carga incompleta da empresa — salvamento bloqueado/);
  assert.match(completo, /editando && !cargaCompleta/);
  assert.match(completo, /canEdit\("Sistema", "Empresas"\)/);
});

test('useContextoVisual expoe getInContext fail-closed por grupo/empresa', async () => {
  const source = await readFile(new URL('../src/components/lib/useContextoVisual.jsx', import.meta.url), 'utf8');
  assert.match(source, /getInContext: async \(entityName, id, campo = 'empresa_id'\) => \{/);
  assert.match(source, /Registro fora do grupo ativo — carga bloqueada/);
  assert.match(source, /base44\.entities\[entityName\]\.get\(id\)/);
});

test('Save Empresa: preserva id, group_id e vínculos; não apaga campos omitidos no form', async () => {
  const { buildCadastroEditSavePayload } = await loadCadastroEditHelpers();
  const loaded = {
    id: 'emp-1',
    group_id: 'g-1',
    razao_social: 'CPA Ferro',
    cnpj: '12345678000199',
    inscricao_estadual: 'ISENTO',
    certificado_digital: { tipo: 'A1', data_validade: '2030-01-01' },
    configuracao_fiscal: { serie_nfe: '1', ambiente_nfe: 'Homologacao' },
    status: 'Ativa',
  };
  const formPartial = {
    razao_social: 'CPA Ferro e Aco',
    cnpj: '12345678000199',
    nome_fantasia: 'CPA',
  };
  const payload = buildCadastroEditSavePayload('Empresa', loaded, formPartial, { groupId: 'g-1' });
  assert.equal(payload.id, 'emp-1');
  assert.equal(payload.group_id, 'g-1');
  assert.equal(payload.razao_social, 'CPA Ferro e Aco');
  assert.equal(payload.inscricao_estadual, 'ISENTO');
  assert.deepEqual(payload.certificado_digital, { tipo: 'A1', data_validade: '2030-01-01' });
  assert.equal(payload.configuracao_fiscal.serie_nfe, '1');
  assert.equal(payload.status, 'Ativa');
});

test('Save bloqueado se carga incompleta (projeção de grade)', async () => {
  const { buildCadastroEditSavePayload } = await loadCadastroEditHelpers();
  const gradeRow = { id: 'emp-1', razao_social: 'CPA', cnpj: '' };
  assert.throws(
    () => buildCadastroEditSavePayload('Empresa', gradeRow, { razao_social: 'X' }, { groupId: 'g-1' }),
    /carga do registro incompleta/i,
  );
});

test('Save bloqueado sem contexto grupo/empresa', async () => {
  const { buildCadastroEditSavePayload } = await loadCadastroEditHelpers();
  assert.throws(
    () => buildCadastroEditSavePayload('Cliente', null, { nome: 'A' }, {}),
    /Contexto de grupo\/empresa obrigatorio/i,
  );
});

test('RBAC: Sistema.Empresas libera owner/admin; sem permissão nega; Cadastros.Empresa também libera', async () => {
  const { hasCadastroEntityPermission } = await loadCadastroEditHelpers();
  const deny = {
    hasPermission: () => false,
    canCreate: () => false,
    canEdit: () => false,
    canDelete: () => false,
  };
  assert.equal(hasCadastroEntityPermission('Empresa', 'editar', deny), false);
  assert.equal(hasCadastroEntityPermission('Empresa', 'visualizar', deny), false);

  const sistemaOnly = {
    hasPermission: (mod, sec) => mod === 'Sistema' && sec === 'Empresas',
    canCreate: (mod, sec) => mod === 'Sistema' && sec === 'Empresas',
    canEdit: (mod, sec) => mod === 'Sistema' && sec === 'Empresas',
    canDelete: (mod, sec) => mod === 'Sistema' && sec === 'Empresas',
  };
  assert.equal(hasCadastroEntityPermission('Empresa', 'editar', sistemaOnly), true);
  assert.equal(hasCadastroEntityPermission('Empresa', 'criar', sistemaOnly), true);
  assert.equal(hasCadastroEntityPermission('Cliente', 'editar', sistemaOnly), false);

  const cadastrosEmpresa = {
    hasPermission: (mod, sec) => mod === 'Cadastros' && sec === 'Empresa',
    canCreate: (mod, sec) => mod === 'Cadastros' && sec === 'Empresa',
    canEdit: (mod, sec) => mod === 'Cadastros' && sec === 'Empresa',
    canDelete: (mod, sec) => mod === 'Cadastros' && sec === 'Empresa',
  };
  assert.equal(hasCadastroEntityPermission('Empresa', 'editar', cadastrosEmpresa), true);
});

test('Isolamento tenant: bloqueia outro grupo; Empresa não exige empresa_id; Cliente exige no escopo empresa', async () => {
  const { assertCadastroRecordInTenant } = await loadCadastroEditHelpers();
  const emp = { id: 'e1', group_id: 'g1', razao_social: 'A', cnpj: '12345678000199' };
  assert.equal(assertCadastroRecordInTenant('Empresa', emp, { groupId: 'g1', scopeType: 'grupo' }), emp);
  assert.throws(
    () => assertCadastroRecordInTenant('Empresa', emp, { groupId: 'g2', scopeType: 'grupo' }),
    /fora do grupo ativo/i,
  );
  const cli = { id: 'c1', group_id: 'g1', empresa_id: 'e1', nome: 'Cliente' };
  assert.throws(
    () => assertCadastroRecordInTenant('Cliente', cli, { groupId: 'g1', empresaId: 'e2', scopeType: 'empresa' }, 'empresa_id'),
    /fora da empresa ativa/i,
  );
  assert.equal(
    assertCadastroRecordInTenant('Cliente', cli, { groupId: 'g1', empresaId: 'e1', scopeType: 'empresa' }, 'empresa_id'),
    cli,
  );
});
