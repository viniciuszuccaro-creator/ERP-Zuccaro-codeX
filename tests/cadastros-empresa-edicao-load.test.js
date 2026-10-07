import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  assertCadastroRecordInTenant,
  buildCadastroEditSavePayload,
  hasCadastroEntityPermission,
  isCadastroEditLoadComplete,
} from '../src/components/cadastros/cadastroEditLoadPolicy.js';
import {
  isEditRequestCurrent,
  loadEmpresaForEdit,
} from '../src/components/lib/contextoMultiempresaPolicy.js';

const completeEmpresa = Object.freeze({
  id: 'empresa-a',
  group_id: 'grupo-a',
  razao_social: 'Empresa Sintetica',
  nome_fantasia: 'Sintetica',
  cnpj: '00000000000191',
  configuracao_fiscal: { serie_nfe: '9' },
});

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
  assert.equal(clean.configuracao_fiscal.serie_nfe, '1');
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

test('hasCadastroEntityPermission: Organizacional + Sistema.Empresas; Cadastros.Empresa sozinho não edita', () => {
  const sistemaOnly = {
    hasPermission: (mod, sec) => mod === 'Sistema' && sec === 'Empresas',
    canEdit: (mod, sec) => mod === 'Sistema' && sec === 'Empresas',
    canCreate: () => false,
    canDelete: () => false,
  };
  assert.equal(hasCadastroEntityPermission('Empresa', 'editar', sistemaOnly), true);
  assert.equal(hasCadastroEntityPermission('Cliente', 'editar', sistemaOnly), false);
  assert.equal(hasCadastroEntityPermission('Empresa', 'editar', {}), false);

  const organizacional = {
    hasPermission: (mod, sec) => mod === 'Cadastros' && sec === 'Organizacional',
    canEdit: (mod, sec) => mod === 'Cadastros' && sec === 'Organizacional',
    canCreate: (mod, sec) => mod === 'Cadastros' && sec === 'Organizacional',
    canDelete: () => false,
  };
  assert.equal(hasCadastroEntityPermission('Empresa', 'editar', organizacional), true);
  assert.equal(hasCadastroEntityPermission('Empresa', 'criar', organizacional), true);
  assert.equal(hasCadastroEntityPermission('Empresa', 'visualizar', organizacional), true);

  const soEmpresa = {
    hasPermission: (mod, sec) => mod === 'Cadastros' && sec === 'Empresa',
    canEdit: (mod, sec) => mod === 'Cadastros' && sec === 'Empresa',
    canCreate: (mod, sec) => mod === 'Cadastros' && sec === 'Empresa',
    canDelete: () => false,
  };
  assert.equal(hasCadastroEntityPermission('Empresa', 'visualizar', soEmpresa), true);
  assert.equal(hasCadastroEntityPermission('Empresa', 'editar', soEmpresa), false);
  assert.equal(hasCadastroEntityPermission('Empresa', 'criar', soEmpresa), false);
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

test('loadEmpresaForEdit: lê completo e bloqueia parcial/ID/grupo/empresa estranhos', async () => {
  let reads = 0;
  const record = await loadEmpresaForEdit({
    id: 'empresa-a',
    groupId: 'grupo-a',
    fetchById: async (id) => {
      reads += 1;
      assert.equal(id, 'empresa-a');
      return completeEmpresa;
    },
  });
  assert.equal(reads, 1);
  assert.equal(record, completeEmpresa);
  assert.equal(record.configuracao_fiscal.serie_nfe, '9');

  const attempt = (row, empresaId) => loadEmpresaForEdit({
    id: 'empresa-a', groupId: 'grupo-a', empresaId,
    fetchById: async () => row,
  });
  await assert.rejects(attempt({ id: 'empresa-a', group_id: 'grupo-a', razao_social: 'Parcial' }));
  await assert.rejects(attempt({ ...completeEmpresa, id: 'empresa-b' }));
  await assert.rejects(attempt({ ...completeEmpresa, group_id: 'grupo-b' }));
  await assert.rejects(attempt(completeEmpresa, 'empresa-b'));
  await assert.rejects(loadEmpresaForEdit({ id: 'empresa-a', fetchById: async () => completeEmpresa }));
});

test('loadEmpresaForEdit: falha de leitura bloqueia; retentativa relê', async () => {
  let reads = 0;
  const fetchById = async () => {
    reads += 1;
    if (reads === 1) throw new Error('falha sintetica');
    return completeEmpresa;
  };
  const args = { id: 'empresa-a', groupId: 'grupo-a', fetchById };
  await assert.rejects(loadEmpresaForEdit(args), /falha sintetica/);
  assert.equal(await loadEmpresaForEdit(args), completeEmpresa);
  assert.equal(reads, 2);
});

test('isEditRequestCurrent invalida após Novo ou troca de contexto', () => {
  const pending = {
    request: 1, current: 1,
    requestedScope: 'Empresa:grupo-a:',
    activeScope: 'Empresa:grupo-a:',
  };
  assert.equal(isEditRequestCurrent(pending), true);
  assert.equal(isEditRequestCurrent({ ...pending, current: 2 }), false);
  assert.equal(isEditRequestCurrent({ ...pending, activeScope: 'Empresa:grupo-b:' }), false);
});

test('Visualizador: Empresa usa loadEmpresaForEdit; demais getInContext + policy', async () => {
  const source = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  assert.match(source, /cadastroEditLoadPolicy/);
  assert.match(source, /loadEmpresaForEdit\(/);
  assert.match(source, /isEditRequestCurrent/);
  assert.match(source, /getInContext\(ENTITY, item\.id/);
  assert.match(source, /isCadastroEditLoadComplete/);
  assert.match(source, /buildCadastroEditSavePayload/);
  assert.match(source, /hasCadastroEntityPermission/);
  assert.match(source, /isTenantMasterEntity/);
  assert.match(source, /editLoadBlocked/);
  assert.match(source, /Nao foi possivel carregar o cadastro completo/);
});

test('EmpresaForm: ID visível, deep-merge, Organizacional, certificado granular, sem wipe fiscal', async () => {
  const source = await readFile(new URL('../src/components/cadastros/EmpresaForm.jsx', import.meta.url), 'utf8');
  assert.match(source, /mergeEmpresaFormData/);
  assert.match(source, /loadIncomplete/);
  assert.match(source, /isLoadingRecord/);
  assert.match(source, /Aguarde o carregamento completo/);
  assert.match(source, /id: formData\.id \|\| dadosIniciais\?\.id/);
  assert.match(source, /ID do cadastro \(somente leitura\)/);
  assert.match(source, /<code className="break-all select-text">\{dadosIniciais\.id\}<\/code>/);
  assert.match(source, /hasCadastroEntityPermission\("Empresa"/);
  assert.match(source, /Cadastros\.Organizacional\.editar/);
  assert.match(source, /Cadastros\.Empresa\.Certificado\.editar/);
  assert.match(source, /!dadosIniciais\?\.id/);
  assert.match(source, /delete payload\.configuracao_fiscal/);
  assert.doesNotMatch(source, /empresa_id: contexto === ["']empresa["']/);
  assert.doesNotMatch(source, /Cadastros\.Empresa\.salvar/);
});

test('Bloco5 Empresas: gate Organizacional + aliases Sistema/Empresa', async () => {
  const block = await readFile(new URL('../src/components/cadastros/blocks/Bloco5Organizacional.jsx', import.meta.url), 'utf8');
  assert.match(block, /hasPermission\("Cadastros", "Organizacional", "visualizar"\)/);
  assert.match(block, /hasPermission\("Sistema", "Empresas", "visualizar"\)/);
  assert.match(block, /k === "Empresa" \|\| k === "GrupoEmpresarial" \? "Organizacional"/);
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
  assert.match(source, /Empresa: \{ module: 'Cadastros', section: 'Organizacional' \}/);
});
