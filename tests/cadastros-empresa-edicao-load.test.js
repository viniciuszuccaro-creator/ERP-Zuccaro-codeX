import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {
  assertCadastroRecordInTenant,
  buildCadastroEditSavePayload,
  classifyCadastroEditLoad,
  hasCadastroEntityPermission,
  isCadastroEditLoadComplete,
  isCadastroSelfManagedScopeCurrent,
  mergeCadastroEditHydration,
} from '../src/components/cadastros/cadastroEditLoadPolicy.js';
import {
  assertCadastroFormScopeCurrent,
  buildCadastroScopeSwitchReset,
  getScopedCadastroPlaceholder,
  isEditRequestCurrent,
  loadEmpresaForEdit,
} from '../src/components/lib/contextoMultiempresaPolicy.js';

test('formulários autogeridos bloqueiam escrita e efeitos tardios após troca CPA→3Z', () => {
  const cpa = { groupId: 'grupo-cpa', empresaId: 'empresa-cpa' };
  const tresZ = { groupId: 'grupo-cpa', empresaId: 'empresa-3z' };
  assert.equal(isCadastroSelfManagedScopeCurrent(cpa, cpa, cpa), true);
  assert.equal(isCadastroSelfManagedScopeCurrent(cpa, cpa, tresZ), false);
  assert.equal(isCadastroSelfManagedScopeCurrent(cpa, tresZ, tresZ), false);
  assert.equal(isCadastroSelfManagedScopeCurrent(null, cpa, cpa), false);
});

test('hook real congela sessão CPA mesmo com primeiro paint parcial; aceita render completo e rejeita 3Z', async () => {
  const source = await readFile(new URL('../src/components/cadastros/hooks/useCadastroFormScopeGuard.js', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const refs = []; let nextRef = 0;
  let active = { groupId: 'grupo-cpa', empresaId: 'empresa-cpa' };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (id) => ({
    react: { useRef: (initial) => refs[nextRef++] ||= { current: initial } },
    '@/api/base44Client': { isHttpBackendMode: true },
    '@/api/erpHttpSession': { readErpHttpSession: () => active },
    '../cadastroEditLoadPolicy.js': { isCadastroSelfManagedScopeCurrent },
  })[id] });
  const render = (groupId, empresaId) => { nextRef = 0; return exports.default(groupId, empresaId); };
  const partial = render('grupo-cpa', null);
  assert.equal(partial.isCurrent(), false);
  const complete = render('grupo-cpa', 'empresa-cpa');
  assert.doesNotThrow(() => complete.assertCurrent());
  active = { groupId: 'grupo-cpa', empresaId: 'empresa-3z' };
  assert.throws(() => complete.assertCurrent(), /Contexto alterado/);
  assert.equal(render('grupo-cpa', 'empresa-3z').isCurrent(), false);
});

test('formulário aberto na Empresa A não salva após troca para B, nem antes do efeito de fechamento', () => {
  const opened = 'Cliente:grupo-a:empresa-a';
  assert.doesNotThrow(() => assertCadastroFormScopeCurrent({
    formScope: opened, renderedScope: opened, activeScope: opened,
  }));
  assert.throws(() => assertCadastroFormScopeCurrent({
    formScope: opened, renderedScope: opened, activeScope: 'Cliente:grupo-a:empresa-b',
  }), /Contexto alterado/);
  assert.throws(() => assertCadastroFormScopeCurrent({
    formScope: opened, renderedScope: 'Cliente:grupo-a:empresa-b', activeScope: 'Cliente:grupo-a:empresa-b',
  }), /Contexto alterado/);
});

test('grade conserva placeholder só no mesmo tenant; CPA→3Z não mostra linhas de CPA', () => {
  const rowA = [{ id: 'cliente-a', empresa_id: 'empresa-a' }];
  const base = ['viz-v33', 'Cliente', 'updated_date', 'desc', 1, 25, '', 'empresa-a', 'grupo-a'];
  assert.deepEqual(getScopedCadastroPlaceholder(rowA, base, [...base.slice(0, 4), 2, ...base.slice(5)]), rowA);
  assert.deepEqual(getScopedCadastroPlaceholder(rowA, base, [...base.slice(0, 7), 'empresa-b', 'grupo-a']), []);
  assert.deepEqual(getScopedCadastroPlaceholder(rowA, base, [...base.slice(0, 6), 'busca', 'empresa-a', 'grupo-a']), []);
});

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

test('mergeCadastroEditHydration: vazio intencional do GET aplica; chave ausente preserva grade', () => {
  const merged = mergeCadastroEditHydration(
    { id: 'c1', nome: 'Cliente Lista', email: 'a@b.com', telefone: '11', obs: 'lista' },
    { id: 'c1', nome: '', email: 'novo@b.com', telefone: null, documento: '123' },
  );
  assert.equal(merged.nome, '');
  assert.equal(merged.email, 'novo@b.com');
  assert.equal(merged.telefone, null);
  assert.equal(merged.documento, '123');
  assert.equal(merged.obs, 'lista');
});

test('isCadastroEditLoadComplete: Cliente/Fornecedor/Produto exigem identidade', () => {
  assert.equal(isCadastroEditLoadComplete('Cliente', { id: 'c1' }, 'c1'), false);
  assert.equal(isCadastroEditLoadComplete('Cliente', { id: 'c1', nome: 'X' }, 'c1'), false);
  assert.equal(isCadastroEditLoadComplete('Cliente', {
    id: 'c1', razao_social: 'ACME', documento: '11222333000181',
  }, 'c1'), true);
  assert.equal(isCadastroEditLoadComplete('Fornecedor', {
    id: 'f1', nome: 'Forn', cnpj: '11222333000181',
  }, 'f1'), true);
  assert.equal(isCadastroEditLoadComplete('Produto', { id: 'p1', descricao: 'Barra' }, 'p1'), false);
  assert.equal(isCadastroEditLoadComplete('Produto', {
    id: 'p1', descricao: 'Barra', codigo: 'P-01',
  }, 'p1'), true);
});

test('classifyCadastroEditLoad: distingue falha, incompleto e ok', () => {
  assert.equal(classifyCadastroEditLoad({
    entityName: 'Cliente',
    expectedId: 'c1',
    listRow: { id: 'c1', nome: 'X' },
    loadError: new Error('rede'),
  }).kind, 'load_failed');
  assert.equal(classifyCadastroEditLoad({
    entityName: 'Empresa',
    expectedId: 'e1',
    fullRecord: { id: 'e1', razao_social: 'A', cnpj: '' },
  }).kind, 'load_incomplete');
  assert.equal(classifyCadastroEditLoad({
    entityName: 'Cliente',
    expectedId: 'c1',
    listRow: { id: 'c1', nome: 'Lista' },
    fullRecord: { id: 'c1' },
  }).kind, 'load_incomplete');
  const ok = classifyCadastroEditLoad({
    entityName: 'Empresa',
    expectedId: 'e1',
    listRow: { id: 'e1', razao_social: 'A' },
    fullRecord: { id: 'e1', razao_social: 'A Ltda', cnpj: '12345678000199' },
  });
  assert.equal(ok.kind, 'ok');
  assert.equal(ok.message, null);
});

test('Marca/Grupo/Setor: GET parcial hidrata com grade e libera identidade', () => {
  assert.equal(isCadastroEditLoadComplete('Marca', { id: 'm1', nome_marca: 'GATE-D SYNTH' }, 'm1'), true);
  assert.equal(isCadastroEditLoadComplete('GrupoProduto', { id: 'g1', nome_grupo: 'Longos' }, 'g1'), true);
  assert.equal(isCadastroEditLoadComplete('SetorAtividade', { id: 's1', nome: 'Construcao' }, 's1'), true);
  const marcaOk = classifyCadastroEditLoad({
    entityName: 'Marca',
    expectedId: 'm1',
    listRow: { id: 'm1', nome_marca: 'GATE-D SYNTH', codigo: '000001' },
    fullRecord: { id: 'm1', descricao: '', cnpj: '', pais_origem: '' },
  });
  assert.equal(marcaOk.kind, 'ok');
  const grupoOk = classifyCadastroEditLoad({
    entityName: 'GrupoProduto',
    expectedId: 'g1',
    listRow: { id: 'g1', nome_grupo: 'GATE-D SYNTH', codigo: 'GATED-GP' },
    fullRecord: { id: 'g1', natureza: 'Revenda' },
  });
  assert.equal(grupoOk.kind, 'ok');
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

test('hasCadastroEntityPermission: mestres exigem Organizacional como o backend', () => {
  const sistemaOnly = {
    hasPermission: (mod, sec) => mod === 'Sistema' && sec === 'Empresas',
    canEdit: (mod, sec) => mod === 'Sistema' && sec === 'Empresas',
    canCreate: () => false,
    canDelete: () => false,
  };
  assert.equal(hasCadastroEntityPermission('Empresa', 'editar', sistemaOnly), false);
  assert.equal(hasCadastroEntityPermission('GrupoEmpresarial', 'editar', sistemaOnly), false);
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
  const entidadeOnly = {
    hasPermission: (mod, sec) => mod === 'Cadastros' && sec === 'Empresa',
    canEdit: (mod, sec) => mod === 'Cadastros' && sec === 'Empresa',
  };
  assert.equal(hasCadastroEntityPermission('Empresa', 'visualizar', entidadeOnly), false);
  assert.equal(hasCadastroEntityPermission('Empresa', 'editar', entidadeOnly), false);
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

test('buildCadastroScopeSwitchReset: fecha form, zera seleção e bump formKey (sem rascunho cross-tenant)', () => {
  const dirty = {
    formKey: 3,
    showForm: true,
    editItem: { id: 'emp-a', razao_social: 'Sintetica A' },
    isLoadingEdit: true,
    editLoadBlocked: true,
    editError: 'erro sintetico',
    isSaving: true,
    selectedIds: new Set(['id-a', 'id-b']),
    deselectedIds: new Set(['id-c']),
    crossPageAll: true,
  };
  const reset = buildCadastroScopeSwitchReset(dirty);
  assert.equal(reset.showForm, false);
  assert.equal(reset.editItem, null);
  assert.equal(reset.isLoadingEdit, false);
  assert.equal(reset.editLoadBlocked, false);
  assert.equal(reset.editError, null);
  assert.equal(reset.isSaving, false);
  assert.equal(reset.crossPageAll, false);
  assert.equal(reset.selectedIds.size, 0);
  assert.equal(reset.deselectedIds.size, 0);
  assert.equal(reset.formKey, 4);
  assert.equal(reset.bumpEditRequest, true);
  // Sets novos — não reutiliza referência da seleção anterior
  assert.notEqual(reset.selectedIds, dirty.selectedIds);
  assert.notEqual(reset.deselectedIds, dirty.deselectedIds);
  assert.equal(dirty.selectedIds.size, 2);
});

test('buildCadastroScopeSwitchReset: formKey ausente ou inválido inicia em 1', () => {
  assert.equal(buildCadastroScopeSwitchReset({}).formKey, 1);
  assert.equal(buildCadastroScopeSwitchReset({ formKey: 'x' }).formKey, 1);
  assert.equal(buildCadastroScopeSwitchReset({ formKey: -1 }).formKey, 0);
});

test('Visualizador: Empresa usa loadEmpresaForEdit; demais getInContext + policy', async () => {
  const source = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  assert.match(source, /cadastroEditLoadPolicy/);
  assert.match(source, /loadEmpresaForEdit\(/);
  assert.match(source, /isEditRequestCurrent/);
  assert.match(source, /buildCadastroScopeSwitchReset/);
  assert.match(source, /assertCadastroFormScopeCurrent/);
  assert.match(source, /getScopedCadastroPlaceholder/);
  assert.match(source, /formScopeRef/);
  assert.match(source, /setSelectedIds\(reset\.selectedIds\)/);
  assert.match(source, /setDeselectedIds\(reset\.deselectedIds\)/);
  assert.match(source, /setCrossPageAll\(reset\.crossPageAll\)/);
  assert.match(source, /getInContext\(ENTITY, item\.id/);
  assert.match(source, /isCadastroEditLoadComplete/);
  assert.match(source, /mergeCadastroEditHydration/);
  assert.match(source, /classifyCadastroEditLoad/);
  assert.match(source, /buildCadastroEditSavePayload/);
  assert.match(source, /hasCadastroEntityPermission/);
  assert.match(source, /isTenantMasterEntity/);
  assert.match(source, /editLoadBlocked/);
  assert.match(source, /classifyCadastroEditLoad\(/);
  assert.match(source, /Falha ao carregar registro completo/);
  assert.match(source, /permSection = isTenantMasterEntity\(ENTITY\) \? "Organizacional" : ENTITY/);
  assert.match(source, /Fallbacks só de rótulo/);
  assert.match(source, /uniqueKey: `Comercial\.Cliente\.detalhes\.\$\{item\.id\}`/);
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

test('Bloco5 Empresas: gate Organizacional sem aliases recusados no backend', async () => {
  const block = await readFile(new URL('../src/components/cadastros/blocks/Bloco5Organizacional.jsx', import.meta.url), 'utf8');
  assert.match(block, /permissionSectionFor/);
  assert.match(block, /section:\s*"Organizacional"/);
  assert.match(block, /"Empresa",\s*"GrupoEmpresarial"/);
  assert.match(block, /dataPermissionFor\(k\)/);
  assert.doesNotMatch(block, /hasPermission\("Sistema", "Empresas", "visualizar"\)/);
  assert.doesNotMatch(block, /Cadastros\.Empresa\.visualizar/);
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
  assert.doesNotMatch(source, /TENANT_MASTER_PERMISSION_ALIASES/);
  assert.doesNotMatch(source, /module: 'Sistema', section: 'Empresas'/);
});
