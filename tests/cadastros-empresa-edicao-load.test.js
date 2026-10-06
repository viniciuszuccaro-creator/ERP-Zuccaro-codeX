import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  assertCadastroRecordInTenant,
  buildCadastroEditSavePayload,
  hasCadastroEntityPermission,
  isCadastroEditLoadComplete,
} from '../src/components/cadastros/cadastroEditLoadPolicy.js';

test('Empresa: carga completa exige id, nome e CNPJ; incompleta falha fechado', () => {
  assert.equal(isCadastroEditLoadComplete('Empresa', null, 'e1'), false);
  assert.equal(isCadastroEditLoadComplete('Empresa', { id: 'e2', razao_social: 'A', cnpj: '123' }, 'e1'), false);
  assert.equal(isCadastroEditLoadComplete('Empresa', { id: 'e1', razao_social: 'A Ltda', cnpj: '12.345.678/0001-99' }, 'e1'), true);
  assert.equal(isCadastroEditLoadComplete('Empresa', { id: 'e1', nome_fantasia: 'A', cnpj: '12345678000199' }, 'e1'), true);
  assert.equal(isCadastroEditLoadComplete('Empresa', { id: 'e1', razao_social: 'A', cnpj: '' }, 'e1'), false);
});

test('Save Empresa: preserva id, group_id e nested; não carimba empresa_id do contexto', () => {
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
  const clean = buildCadastroEditSavePayload('Empresa', loaded, formPartial, {
    groupId: 'g-1',
    empresaId: 'outra-empresa-contexto',
  });
  assert.equal(clean.id, 'emp-1');
  assert.equal(clean.group_id, 'g-1');
  assert.equal(clean.razao_social, 'CPA Ferro e Aco');
  assert.equal(clean.inscricao_estadual, 'ISENTO');
  assert.equal(clean.certificado_digital.tipo, 'A1');
  assert.equal(clean.empresa_id, undefined);
});

test('Save incompleto de Empresa bloqueia', () => {
  assert.throws(
    () => buildCadastroEditSavePayload(
      'Empresa',
      { id: 'e1', razao_social: 'X', cnpj: '' },
      { razao_social: 'Y' },
      { groupId: 'g1' },
    ),
    /carga do registro incompleta/i,
  );
});

test('hasCadastroEntityPermission aceita Sistema.Empresas sem liberar admin cego', () => {
  const checkers = {
    hasPermission: (mod, sec) => mod === 'Sistema' && sec === 'Empresas',
    canEdit: (mod, sec) => mod === 'Sistema' && sec === 'Empresas',
    canCreate: () => false,
    canDelete: () => false,
  };
  assert.equal(hasCadastroEntityPermission('Empresa', 'editar', checkers), true);
  assert.equal(hasCadastroEntityPermission('Cliente', 'editar', checkers), false);
  assert.equal(hasCadastroEntityPermission('Empresa', 'editar', {}), false);
});

test('assertCadastroRecordInTenant: Empresa só exige group_id', () => {
  const ok = assertCadastroRecordInTenant(
    'Empresa',
    { id: 'e1', group_id: 'g1', cnpj: '1' },
    { groupId: 'g1', empresaId: 'e2', scopeType: 'empresa' },
  );
  assert.equal(ok.id, 'e1');
  assert.throws(
    () => assertCadastroRecordInTenant(
      'Empresa',
      { id: 'e1', group_id: 'outro' },
      { groupId: 'g1' },
    ),
    /fora do grupo/i,
  );
});

test('Visualizador usa getInContext + policy de carga/save', async () => {
  const source = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  assert.match(source, /cadastroEditLoadPolicy/);
  assert.match(source, /getInContext\(ENTITY, item\.id/);
  assert.match(source, /isCadastroEditLoadComplete/);
  assert.match(source, /buildCadastroEditSavePayload/);
  assert.match(source, /hasCadastroEntityPermission/);
  assert.match(source, /isTenantMasterEntity/);
  assert.match(source, /editLoadBlocked/);
});

test('EmpresaForm preserva id/group e bloqueia save enquanto load incompleto', async () => {
  const source = await readFile(new URL('../src/components/cadastros/EmpresaForm.jsx', import.meta.url), 'utf8');
  assert.match(source, /mergeEmpresaFormData/);
  assert.match(source, /loadIncomplete/);
  assert.match(source, /isLoadingRecord/);
  assert.match(source, /Aguarde o carregamento completo/);
  assert.match(source, /id: formData\.id \|\| dadosIniciais\?\.id/);
  assert.doesNotMatch(source, /empresa_id: contexto === ["']empresa["']/);
  assert.match(source, /canEdit\(["']Sistema["'], ["']Empresas["']\)/);
});

test('useContextoVisual expoe getInContext fail-closed', async () => {
  const source = await readFile(new URL('../src/components/lib/useContextoVisual.jsx', import.meta.url), 'utf8');
  assert.match(source, /const getInContext = async \(entityName, id, campo = 'empresa_id'\) => \{/);
  assert.match(source, /getInContext,/);
  assert.match(source, /Registro fora do grupo ativo — carga bloqueada/);
  assert.match(source, /base44\.entities\[entityName\]\.get\(id\)/);
});

test('localBase44 nao filtra Empresa/Grupo por empresa_id do contexto', async () => {
  const source = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  assert.match(source, /tenantMaster/);
  assert.match(source, /entityName === 'Empresa' \|\| entityName === 'GrupoEmpresarial'/);
});
